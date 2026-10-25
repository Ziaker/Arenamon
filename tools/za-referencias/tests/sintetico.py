"""Fábrica de dados sintéticos para os testes (sem o dump do Z-A)."""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))


def c(modelo, clipe, parado=False, especie=1, nome=None, **extra):
    """Linha do banco (clipes.jsonl) mínima para inventário/normas."""
    import metricas
    linha = {"modelo": modelo, "clipe": clipe, "especie": especie, "nome": nome or modelo}
    linha.update(metricas.classificar(clipe))
    if parado:
        linha["parado"] = True
    linha.update(extra)
    return linha


def empacotar_quat(q):
    """Inverso de za_anim._desempacotar_quat: (w, x, y, z) -> (x16, y16, z16) do formato de 48 bits."""
    import math
    w, x, y, z = (float(v) for v in q)
    comp = [x, y, z, w]
    m = max(range(4), key=lambda i: abs(comp[i]))
    neg = comp[m] < 0
    if neg:
        comp = [-v for v in comp]
    resto = [comp[i] for i in range(4) if i != m]
    ints = [max(0, min(0x7FFF, int(round((v + math.pi / 4) / (math.pi / 2) * 0x7FFF)))) for v in resto]
    pack = m | (int(neg) << 2) | (ints[0] << 3) | (ints[1] << 18) | (ints[2] << 33)
    return pack & 0xFFFF, (pack >> 16) & 0xFFFF, (pack >> 32) & 0xFFFF


def escrever_tranm(caminho, quadros, fps, faixas):
    """Monta um .tranm com as classes do addon. faixas: {osso: {"rot_fixa": q} | {"rot_quadros": (quadros, [q])}
    | {"escala_fixa": [x, y, z]}}."""
    import flatbuffers
    import za_anim  # noqa: F401  (põe o addon no sys.path)
    from GFLib.Anim.Animation import AnimationT
    from GFLib.Anim.BoneAnimation import BoneAnimationT
    from GFLib.Anim.BoneTrack import BoneTrackT
    from GFLib.Anim.FixedRotationTrack import FixedRotationTrackT
    from GFLib.Anim.FixedVectorTrack import FixedVectorTrackT
    from GFLib.Anim.Framed16RotationTrack import Framed16RotationTrackT
    from GFLib.Anim.Info import InfoT
    from GFLib.Anim.RotationTrack import RotationTrack
    from GFLib.Anim.sVec3 import sVec3T
    from GFLib.Anim.Vec3 import Vec3T
    from GFLib.Anim.VectorTrack import VectorTrack

    def sv(q):
        s = sVec3T()
        s.x, s.y, s.z = empacotar_quat(q)
        return s

    tracks = []
    for nome, spec in faixas.items():
        t = BoneTrackT()
        t.name = nome
        if "rot_fixa" in spec:
            r = FixedRotationTrackT()
            r.co = sv(spec["rot_fixa"])
            t.rotateType, t.rotate = RotationTrack.FixedRotationTrack, r
        if "rot_quadros" in spec:
            r = Framed16RotationTrackT()
            r.frames = list(spec["rot_quadros"][0])
            r.co = [sv(q) for q in spec["rot_quadros"][1]]
            t.rotateType, t.rotate = RotationTrack.Framed16RotationTrack, r
        if "escala_fixa" in spec:
            v = FixedVectorTrackT()
            v.co = Vec3T()
            v.co.x, v.co.y, v.co.z = spec["escala_fixa"]
            t.scaleType, t.scale = VectorTrack.FixedVectorTrack, v
        tracks.append(t)
    an = AnimationT()
    an.info = InfoT()
    an.info.keyFrames, an.info.frameRate = quadros, fps
    an.skeleton = BoneAnimationT()
    an.skeleton.tracks = tracks
    b = flatbuffers.Builder(1024)
    b.Finish(an.Pack(b))
    with open(caminho, "wb") as fh:
        fh.write(b.Output())
    return caminho


# ---------------------------------------------------------------- rigs e clipes sintéticos (Tasks 3+)
import math as _m

import numpy as _np

_IDENT = _np.array([1.0, 0, 0, 0])

# nome, pai, posição local (relativa ao pai), Y para cima, +Z para frente
_HUMANOIDE = [
    ("pm9000_00_00", None, (0, 0, 0)),
    ("origin", "pm9000_00_00", (0, 0, 0)),
    ("waist", "origin", (0, 1.0, 0)),
    ("spine_01", "waist", (0, 0.3, 0)),
    ("neck", "spine_01", (0, 0.3, 0)),
    ("head", "neck", (0, 0.2, 0)),
    ("jaw", "head", (0, -0.05, 0.1)),
    ("left_eyelid", "head", (0.05, 0.05, 0.1)),
    ("left_feeler_a", "head", (0.05, 0.15, 0)),
    ("left_feeler_b", "left_feeler_a", (0, 0.3, 0)),
    ("left_arm", "spine_01", (0.3, 0.2, 0)),
    ("left_hand", "left_arm", (0.4, 0, 0)),
    ("right_arm", "spine_01", (-0.3, 0.2, 0)),
    ("right_hand", "right_arm", (-0.4, 0, 0)),
    ("left_leg", "waist", (0.15, -0.5, 0)),
    ("left_foot", "left_leg", (0, -0.5, 0)),
    ("right_leg", "waist", (-0.15, -0.5, 0)),
    ("right_foot", "right_leg", (0, -0.5, 0)),
    ("tail_01", "waist", (0, 0, -0.2)),
    ("tail_02", "tail_01", (0, 0, -0.4)),
]

_SERPENTE = [("pm9001_00_00", None, (0, 0, 0)), ("origin", "pm9001_00_00", (0, 0, 0)), ("waist", "origin", (0, 0.2, 0))] + \
    [("spine_%02d" % (i + 1), "waist" if i == 0 else "spine_%02d" % i, (0, 0, 0.3)) for i in range(4)] + \
    [("head", "spine_04", (0, 0.1, 0.2))]

_QUADRUPEDE = [
    ("pm9002_00_00", None, (0, 0, 0)), ("origin", "pm9002_00_00", (0, 0, 0)), ("waist", "origin", (0, 0.6, 0)),
    ("spine_01", "waist", (0, 0, 0.5)), ("head", "spine_01", (0, 0.3, 0.3)),
    ("left_arm", "spine_01", (0.2, -0.3, 0)), ("left_hand", "left_arm", (0, -0.3, 0)),
    ("right_arm", "spine_01", (-0.2, -0.3, 0)), ("right_hand", "right_arm", (0, -0.3, 0)),
    ("left_leg", "waist", (0.2, -0.3, 0)), ("left_foot", "left_leg", (0, -0.3, 0)),
    ("right_leg", "waist", (-0.2, -0.3, 0)), ("right_foot", "right_leg", (0, -0.3, 0)),
]


def _rig(tabela):
    import za_anim
    nomes = [t[0] for t in tabela]
    pais = [nomes.index(t[1]) if t[1] else -1 for t in tabela]
    loc = _np.array([t[2] for t in tabela], dtype=float)
    return za_anim.Esqueleto.de_arrays(nomes, pais, loc, _np.tile(_IDENT, (len(nomes), 1)))


def humanoide():
    return _rig(_HUMANOIDE)


def serpente():
    return _rig(_SERPENTE)


def quadrupede():
    return _rig(_QUADRUPEDE)


def pulso(n, pico, largura, amplitude):
    """Deslocamento suave 0 -> amplitude -> 0 com pico no quadro `pico` (gaussiana)."""
    f = _np.arange(n)
    return amplitude * _np.exp(-0.5 * ((f - pico) / largura) ** 2)


def clipe(esq, n=60, mover=None, escala=None, rot=None, fps=60):
    """mover: {osso: array [n, 3]} somado à translação local de repouso; rot: {osso: array [n, 4]}."""
    import za_anim
    loc = _np.repeat(esq.loc_repouso[None], n, axis=0)
    r = _np.repeat(esq.rot_repouso[None], n, axis=0)
    animados = set()
    for nome, d in (mover or {}).items():
        loc[:, esq.indice[nome]] += d
        animados.add(esq.indice[nome])
    for nome, q in (rot or {}).items():
        r[:, esq.indice[nome]] = q
        animados.add(esq.indice[nome])
    esc = None
    if escala:
        esc = _np.ones((n, len(esq.nomes), 3))
        for nome, s in escala.items():
            esc[:, esq.indice[nome]] = s
            animados.add(esq.indice[nome])
    return za_anim.Clipe.de_arrays(esq, fps, loc, r, escala=esc, animados=animados)


def frente(n, pico, amp, largura=3.0):
    d = _np.zeros((n, 3))
    d[:, 2] = pulso(n, pico, largura, amp)
    return d


def giro_x(n, pico, graus, largura=3.0):
    a = _np.radians(pulso(n, pico, largura, graus))
    return _np.stack([_np.cos(a / 2), _np.sin(a / 2), _np.zeros(n), _np.zeros(n)], axis=1)


def golpe_com_antena():
    esq = humanoide()
    n = 60
    antena = _np.zeros((n, 3))
    antena[:, 0] = 0.25 * _np.sin(_np.arange(n) * 2 * _np.pi / 12)   # balança muito, o clipe inteiro
    return esq, clipe(esq, n, {"right_hand": frente(n, 30, 0.6), "left_feeler_b": antena})


def golpe_dois_bracos(defasagem=2):
    esq = humanoide()
    return esq, clipe(esq, 60, {"right_hand": frente(60, 30, 0.6), "left_hand": frente(60, 30 + defasagem, 0.6)})


def cabecada():
    esq = humanoide()
    return esq, clipe(esq, 60, {"head": frente(60, 30, 0.4)})


def mordida(abertura_graus=30):
    esq = humanoide()
    return esq, clipe(esq, 60, {"head": frente(60, 30, 0.4)}, rot={"jaw": giro_x(60, 30, abertura_graus)})


def so_palpebra():
    esq = humanoide()
    d = _np.zeros((60, 3))
    d[:, 1] = pulso(60, 30, 3, -0.04)
    return esq, clipe(esq, 60, {"left_eyelid": d})


def cadeia_quadril_braco(atraso=3):
    """Núcleo (waist) avança a partir do q10 com rampa; o braço direito começa `atraso` quadros depois."""
    esq = humanoide()
    n = 60
    f = _np.arange(n)
    rampa = lambda ini: _np.clip((f - ini) / 10.0, 0, 1) ** 2
    q = _np.zeros((n, 3))
    q[:, 2] = 0.3 * rampa(10)
    m = _np.zeros((n, 3))
    m[:, 2] = 0.6 * rampa(10 + atraso) ** 2
    return esq, clipe(esq, n, {"waist": q, "right_hand": m})


def serpente_bote():
    esq = serpente()
    return esq, clipe(esq, 60, {"head": frente(60, 30, 0.6)})


def cauda_escondida():
    """Cauda com escala 0,01 até o q14 (escondida) e 1 depois: ao reaparecer, a ponta 'salta'. A mão golpeia no q40."""
    esq = humanoide()
    n = 60
    esc = _np.ones((n, 3))
    esc[:15] = 0.01
    return esq, clipe(esq, n, {"right_hand": frente(n, 40, 0.6)}, escala={"tail_01": esc})


def cadeia_defasada(atraso=3):
    """Núcleo e braço com o MESMO formato de pulso; o braço começa `atraso` quadros depois."""
    esq = humanoide()
    return esq, clipe(esq, 60, {"waist": frente(60, 20, 0.3), "right_hand": frente(60, 20 + atraso, 0.3)})


def vel_dois_picos(n=80):
    return pulso(n, 20, 3, 5.0) + pulso(n, 50, 3, 4.0)


def curvas_cauda_amortecida(atraso=4, razao=0.5):
    n = 80
    ref = {"vel": pulso(n, 20, 3, 6.0)}
    cauda = {"vel": pulso(n, 20 + atraso, 2.5, 3.0) + pulso(n, 20 + atraso + 10, 2.5, 3.0 * razao)}
    return {"braco_D": ref, "cauda": cauda}, "braco_D", ["cauda"]


def squash_antes_do_golpe():
    """Mão golpeia no q30; a cauda achata (escala 0,7 em Y) com pico no q25."""
    esq = humanoide()
    n = 60
    esc = _np.ones((n, 3))
    esc[:, 1] = 1.0 - pulso(n, 25, 3, 0.3)
    return esq, clipe(esq, n, {"right_hand": frente(n, 30, 0.6)}, escala={"tail_01": esc})


def um_quadro():
    esq = humanoide()
    return esq, clipe(esq, 1)


def andar(esteira=False, deslize_pe=None, perna_oculta=None, n=60, periodo=30, v=1.2, fps=60, balanco=0.0,
          mergulho_no_ar=0.0, altura_passo=0.12, rasante_frac=0.0):
    """Ciclo de passo do humanoide. Real: origem avança a v m/s e o pé de apoio fica parado no mundo.
    Esteira: origem parada e o pé de apoio escorrega para trás a v (como numa esteira).
    deslize_pe: nome do pé que desliza para frente 0,15 m durante o apoio (escorregão de verdade).
    perna_oculta: (nome da perna, q0, q1) com escala 0,01 nesses quadros."""
    esq = humanoide()
    t = _np.arange(n) / fps
    origem = _np.zeros((n, 3))
    if not esteira:
        origem[:, 2] = v * t
    origem[:, 1] = balanco * _np.sin(2 * _np.pi * _np.arange(n) / (periodo / 2))
    mover = {"origin": origem}
    passo = v * periodo / fps
    for k, pe in enumerate(("left_foot", "right_foot")):
        fase = (_np.arange(n) + k * periodo // 2) % periodo
        apoio = fase < periodo // 2
        mundo = _np.zeros((n, 3))
        z = 0.0
        for f in range(n):
            if f > 0:
                if apoio[f]:
                    dz = 0.0 if not esteira else -v / fps
                    if deslize_pe == pe:
                        dz += 0.15 / (periodo // 2)
                else:
                    dz = (passo / (periodo // 2)) if not esteira else (v / fps)
                z += dz
            mundo[f, 2] = z
            u = (fase[f] - periodo // 2) / (periodo // 2)
            arco = altura_passo * _np.sin(_np.pi * u)
            if mergulho_no_ar:   # pé faz um "vale" no ar: dois arcos com mínimo local a `mergulho_no_ar` m do chão
                arco = arco - (0.12 - mergulho_no_ar) * _np.exp(-((u - 0.5) / 0.12) ** 2)
            if rasante_frac and u >= 1 - rasante_frac:   # fim do balanço rente ao chão, ainda avançando rápido
                arco = 0.0
            mundo[f, 1] = 0.0 if apoio[f] else arco
        mover[pe] = mundo - origem
    esc = None
    if perna_oculta:
        nome, q0, q1 = perna_oculta
        e = _np.ones((n, 3))
        e[q0:q1] = 0.01
        esc = {nome: e}
    return esq, clipe(esq, n, mover, escala=esc, fps=fps)


def pulo(n=60):
    esq = humanoide()
    o = _np.zeros((n, 3))
    o[:, 1] = pulso(n, 30, 6, 0.6)
    return esq, clipe(esq, n, {"origin": o})


def golpe_no_ar():
    esq = humanoide()
    return esq, clipe(esq, 60, {"right_hand": frente(60, 30, 0.6)})


def linear(n=60):
    esq = humanoide()
    d = _np.zeros((n, 3))
    d[:, 2] = _np.linspace(0, 0.6, n)
    return esq, clipe(esq, n, {"right_hand": d})


def dobra_no_q30(n=60):
    esq = humanoide()
    f = _np.arange(n)
    d = _np.zeros((n, 3))
    d[:, 2] = _np.minimum(f, 30) * 0.02
    d[:, 1] = _np.maximum(f - 30, 0) * 0.02
    return esq, clipe(esq, n, {"right_hand": d})


def _angulo_por_partes(n, pontos):
    f = _np.arange(n)
    xs, ys = zip(*pontos)
    return _np.interp(f, xs, ys)


def torcao_de_mao(n=60):
    """A mão (ponta, sem filhos) gira 40° no próprio eixo X entre q20 e q30 e volta até q40; a posição não muda."""
    esq = humanoide()
    a = _np.radians(_angulo_por_partes(n, [(0, 0), (20, 0), (30, 40), (40, 0), (n - 1, 0)]))
    q = _np.stack([_np.cos(a / 2), _np.sin(a / 2), _np.zeros(n), _np.zeros(n)], axis=1)
    return esq, clipe(esq, n, rot={"right_hand": q})


def cabeca_inclina(pico_q=25, graus=20, n=60):
    esq = humanoide()
    return esq, clipe(esq, n, rot={"head": giro_x(n, pico_q, graus, largura=4.0)})


def antena_balanca_nucleo_prepara():
    """Antena balança o clipe inteiro (idle); o núcleo prepara a partir do q15; a mão golpeia no q32."""
    esq = humanoide()
    n = 60
    antena = _np.zeros((n, 3))
    antena[:, 0] = 0.25 * _np.sin(_np.arange(n) * 2 * _np.pi / 12)
    return esq, clipe(esq, n, {"left_feeler_b": antena, "waist": frente(n, 22, 0.15, largura=4.0),
                               "right_hand": frente(n, 32, 0.6)})


def deslizar_sem_levantar(n=60, v=1.2, fps=60):
    """Criatura que 'patina': a origem avança e os pés acompanham sem nunca sair do chão."""
    esq = humanoide()
    o = _np.zeros((n, 3))
    o[:, 2] = v * _np.arange(n) / fps
    return esq, clipe(esq, n, {"origin": o})
