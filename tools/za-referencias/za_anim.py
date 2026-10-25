"""Leitura de esqueleto (.trskl) e animação (.tranm) do Z-A sem o Blender, com cinemática direta.

Usa as classes FlatBuffers geradas do addon Pokémon Switch V3 (GFLib/Titan), então precisa do
pacote `flatbuffers` e do numpy. O Python do Blender 5.2 já tem os dois:
  "C:\\Program Files\\Blender Foundation\\Blender 5.2\\5.2\\python\\bin\\python.exe"

Convenções (iguais às do addon, conferidas contra o Blender em conferir_fk.py):
  - Trinity é Y-up; aqui nada é girado: altura = eixo Y.
  - Pose local de cada osso = translação/rotação da faixa, ou a de repouso quando a faixa não existe.
  - Escala é ignorada na cinemática (quase sempre 1; as medidas são de posição).
  - Faixas "Framed" (chaves esparsas) são interpoladas: linear na posição, slerp na rotação.
"""
import math
import os
import site
import sys

import numpy as np

ADDON = os.path.join(os.environ.get("APPDATA", ""), "Blender Foundation", "Blender", "5.2",
                     "scripts", "addons", "PokemonSwitchV3")
if site.getusersitepackages() not in sys.path:
    sys.path.append(site.getusersitepackages())
if ADDON not in sys.path:
    sys.path.append(ADDON)

from GFLib.Anim.Animation import Animation  # noqa: E402
from Titan.Model.TRMDL import TRMDL  # noqa: E402
from Titan.Model.TRSKL import TRSKL  # noqa: E402

# Tipos da união VectorTrack/RotationTrack: 1 Fixed, 2 Dynamic, 3 Framed16, 4 Framed8
FIXO, DINAMICO, QUADROS16, QUADROS8 = 1, 2, 3, 4


def euler_xyz_para_quat(x, y, z):
    """Euler XYZ (ordem do mathutils.Euler padrão) -> quaternion (w, x, y, z)."""
    cx, sx = math.cos(x / 2), math.sin(x / 2)
    cy, sy = math.cos(y / 2), math.sin(y / 2)
    cz, sz = math.cos(z / 2), math.sin(z / 2)
    # R = Rz * Ry * Rx
    return np.array([
        cz * cy * cx + sz * sy * sx,
        cz * cy * sx - sz * sy * cx,
        cz * sy * cx + sz * cy * sx,
        sz * cy * cx - cz * sy * sx,
    ])


def quat_para_matriz(q):
    """q[..., 4] (w, x, y, z) -> matriz de rotação [..., 3, 3]."""
    q = q / np.linalg.norm(q, axis=-1, keepdims=True)
    w, x, y, z = q[..., 0], q[..., 1], q[..., 2], q[..., 3]
    m = np.empty(q.shape[:-1] + (3, 3))
    m[..., 0, 0] = 1 - 2 * (y * y + z * z)
    m[..., 0, 1] = 2 * (x * y - w * z)
    m[..., 0, 2] = 2 * (x * z + w * y)
    m[..., 1, 0] = 2 * (x * y + w * z)
    m[..., 1, 1] = 1 - 2 * (x * x + z * z)
    m[..., 1, 2] = 2 * (y * z - w * x)
    m[..., 2, 0] = 2 * (x * z - w * y)
    m[..., 2, 1] = 2 * (y * z + w * x)
    m[..., 2, 2] = 1 - 2 * (x * x + y * y)
    return m


class Esqueleto:
    def __init__(self, caminho_trskl):
        with open(caminho_trskl, "rb") as fh:
            sk = TRSKL.GetRootAsTRSKL(bytearray(fh.read()), 0)
        self.nomes, self.pais, loc, rot = [], [], [], []
        for i in range(sk.TransformNodesLength()):
            n = sk.TransformNodes(i)
            t = n.Transform()
            self.nomes.append(n.Name().decode("utf-8"))
            self.pais.append(n.ParentIdx())
            v = t.VecTranslate()
            loc.append((v.X(), v.Y(), v.Z()))
            r = t.VecRot()
            rot.append(euler_xyz_para_quat(r.X(), r.Y(), r.Z()))
        self.loc_repouso = np.array(loc, dtype=np.float64)
        self.rot_repouso = np.array(rot, dtype=np.float64)
        self.indice = {n: i for i, n in enumerate(self.nomes)}
        self.ordem = self._ordem_topologica()
        self.posicoes_repouso = self.fk(self.loc_repouso[None], self.rot_repouso[None])[0]

    def _ordem_topologica(self):
        feitos, ordem = set(), []
        while len(ordem) < len(self.nomes):
            antes = len(ordem)
            for i, p in enumerate(self.pais):
                if i not in feitos and (p < 0 or p >= len(self.nomes) or p in feitos):
                    feitos.add(i)
                    ordem.append(i)
            if len(ordem) == antes:  # ciclo: solta o resto como raiz
                ordem += [i for i in range(len(self.nomes)) if i not in feitos]
                break
        return ordem

    def fk(self, loc, rot):
        """loc [F, B, 3], rot [F, B, 4] locais -> posições no espaço do modelo [F, B, 3]."""
        f, b = loc.shape[:2]
        mrot = quat_para_matriz(rot)
        wr = np.zeros((f, b, 3, 3))
        wp = np.zeros((f, b, 3))
        for i in self.ordem:
            p = self.pais[i]
            if 0 <= p < b:
                wr[:, i] = wr[:, p] @ mrot[:, i]
                wp[:, i] = wp[:, p] + np.einsum("fij,fj->fi", wr[:, p], loc[:, i])
            else:
                wr[:, i] = mrot[:, i]
                wp[:, i] = loc[:, i]
        return wp


def _desempacotar_quat(x, y, z):
    """Quaternion de 48 bits (mesma rotina do gfbanm_importer) -> (w, x, y, z)."""
    pack = (z << 32) | (y << 16) | x
    esc = (math.pi / 2) / 0x7FFF

    def exp(i):
        return i * esc - math.pi / 4

    q = [exp((pack >> 3) & 0x7FFF), exp((pack >> 18) & 0x7FFF), exp((pack >> 33) & 0x7FFF)]
    q.insert(pack & 0b11, math.sqrt(max(1.0 - (q[0] ** 2 + q[1] ** 2 + q[2] ** 2), 0.0)))
    s = -1.0 if pack & 0b100 else 1.0
    return (s * q[3], s * q[0], s * q[1], s * q[2])


def _slerp(a, b, t):
    d = float(np.dot(a, b))
    if d < 0:
        b, d = -b, -d
    if d > 0.9995:
        r = a + t * (b - a)
        return r / np.linalg.norm(r)
    th = math.acos(min(d, 1.0))
    return (math.sin((1 - t) * th) * a + math.sin(t * th) * b) / math.sin(th)


def _faixa(tab, tipo, n, eh_rot):
    """Lê uma faixa (união) -> (array [n, 3|4] ou None, quadros com chave)."""
    if tab is None or tipo == 0:
        return None, 0
    from GFLib.Anim.DynamicRotationTrack import DynamicRotationTrack
    from GFLib.Anim.DynamicVectorTrack import DynamicVectorTrack
    from GFLib.Anim.FixedRotationTrack import FixedRotationTrack
    from GFLib.Anim.FixedVectorTrack import FixedVectorTrack
    from GFLib.Anim.Framed16RotationTrack import Framed16RotationTrack
    from GFLib.Anim.Framed16VectorTrack import Framed16VectorTrack
    from GFLib.Anim.Framed8RotationTrack import Framed8RotationTrack
    from GFLib.Anim.Framed8VectorTrack import Framed8VectorTrack

    classes = {
        (FIXO, False): FixedVectorTrack, (DINAMICO, False): DynamicVectorTrack,
        (QUADROS16, False): Framed16VectorTrack, (QUADROS8, False): Framed8VectorTrack,
        (FIXO, True): FixedRotationTrack, (DINAMICO, True): DynamicRotationTrack,
        (QUADROS16, True): Framed16RotationTrack, (QUADROS8, True): Framed8RotationTrack,
    }
    t = classes[(tipo, eh_rot)]()
    t.Init(tab.Bytes, tab.Pos)

    def val(c):
        return _desempacotar_quat(c.X(), c.Y(), c.Z()) if eh_rot else (c.X(), c.Y(), c.Z())

    if tipo == FIXO:
        c = t.Co()
        if c is None:
            return None, 0
        v = np.array(val(c))
        return np.tile(v, (n, 1)), 1
    cos = [val(t.Co(i)) for i in range(t.CoLength())]
    if not cos:
        return None, 0
    cos = np.array(cos, dtype=np.float64)
    if tipo == DINAMICO:
        out = np.empty((n, cos.shape[1]))
        k = min(n, len(cos))
        out[:k] = cos[:k]
        out[k:] = cos[k - 1]
        return out, len(cos)
    quadros = [int(t.Frames(i)) for i in range(t.FramesLength())]
    out = np.empty((n, cos.shape[1]))
    for f in range(n):
        j = int(np.searchsorted(quadros, f, side="right")) - 1
        if j < 0:
            out[f] = cos[0]
        elif j >= len(quadros) - 1 or quadros[j] == f:
            out[f] = cos[min(j, len(cos) - 1)]
        else:
            f0, f1 = quadros[j], quadros[j + 1]
            u = (f - f0) / (f1 - f0)
            out[f] = _slerp(cos[j], cos[j + 1], u) if eh_rot else cos[j] + u * (cos[j + 1] - cos[j])
    return out, len(quadros)


class Clipe:
    def __init__(self, caminho_tranm, esq):
        with open(caminho_tranm, "rb") as fh:
            an = Animation.GetRootAs(bytearray(fh.read()), 0)
        info = an.Info()
        self.fps = int(info.FrameRate())
        self.quadros = int(info.KeyFrames())
        n, b = self.quadros, len(esq.nomes)
        self.loc = np.repeat(esq.loc_repouso[None], n, axis=0)
        self.rot = np.repeat(esq.rot_repouso[None], n, axis=0)
        self.faixas = {"fixa": 0, "densa": 0, "esparsa": 0}
        self.chaves_esparsas = []  # chaves por faixa esparsa
        self.ossos_animados = set()
        sk = an.Skeleton()
        for i in range(sk.TracksLength() if sk else 0):
            tr = sk.Tracks(i)
            nome = tr.Name().decode("utf-8") if tr.Name() else ""
            bi = esq.indice.get(nome)
            if bi is None:
                continue
            for tipo, tab, eh_rot, destino in ((tr.TranslateType(), tr.Translate(), False, self.loc),
                                               (tr.RotateType(), tr.Rotate(), True, self.rot)):
                arr, chaves = _faixa(tab, tipo, n, eh_rot)
                if arr is None:
                    continue
                destino[:, bi] = arr
                if tipo == FIXO:
                    self.faixas["fixa"] += 1
                elif tipo == DINAMICO:
                    self.faixas["densa"] += 1
                    self.ossos_animados.add(bi)
                else:
                    self.faixas["esparsa"] += 1
                    self.chaves_esparsas.append(chaves)
                    self.ossos_animados.add(bi)
        # quaternions contínuos (sem troca de sinal entre quadros) para medir velocidade angular
        for f in range(1, n):
            troca = np.einsum("bi,bi->b", self.rot[f], self.rot[f - 1]) < 0
            self.rot[f, troca] *= -1
        self.posicoes = esq.fk(self.loc, self.rot)


def esqueleto_do_modelo(pasta):
    """Acha o .trskl que o .trmdl da pasta usa."""
    for f in os.listdir(pasta):
        if f.endswith(".trmdl"):
            with open(os.path.join(pasta, f), "rb") as fh:
                md = TRMDL.GetRootAsTRMDL(bytearray(fh.read()), 0)
            sk = md.Skeleton()
            if sk is not None and sk.Filename():
                cam = os.path.join(pasta, sk.Filename().decode("utf-8"))
                if os.path.exists(cam):
                    return cam
    cands = sorted(f for f in os.listdir(pasta) if f.endswith(".trskl"))
    return os.path.join(pasta, cands[0]) if cands else None
