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
