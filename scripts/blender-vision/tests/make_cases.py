"""Roda no Blender: blender -b ORIGEM.blend --python make_cases.py -- SAIDA.blend

Gera casos de teste ROTULADOS A MAO a partir de clips existentes (idle, Walk fwd), numa COPIA (SAIDA.blend, via save_as copy=True).
O .blend de origem nunca e salvo. Os rotulos esperados estao em cases.json; quem os escreveu foi um humano/agente raciocinando
sobre o que cada manipulacao DEVE produzir, independentemente das metricas da ferramenta.

Casos:
  case_skate         idle com o quadril transladando 0.6 m: pes arrastam (escorregao real)
  case_stepped_hold  Walk fwd com chaves a cada 5 frames, interpolacao CONSTANTE: holds intencionais de blocking
  case_arm_into_body idle com o braco E girado para dentro do tronco (frames 20-80): atravessamento real (conferir em imagem)
  case_arm_clear     idle com o braco E afastado do corpo (frames 20-80): sem atravessamento
"""
import bpy
import math
import os
import sys
from mathutils import Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import vision_common as vc

OUT = sys.argv[sys.argv.index("--") + 1]
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
sc = bpy.context.scene


def clone(src, name):
    a = bpy.data.actions[src].copy()
    a.name = name
    a.use_fake_user = True      # sem isto a action some ao salvar a copia
    return a


def setact(a):
    arm.animation_data.action = a
    try:
        arm.animation_data.action_slot = a.slots[0]
    except Exception:
        pass


def fcs(a, bone, prop):
    pat = 'pose.bones["mixamorig:%s"].%s' % (bone, prop)
    return {fc.array_index: fc for fc in vc.iter_fcurves(a) if fc.data_path == pat}


# ---- skate: quadril transladando
a = clone("idle", "case_skate")
setact(a)
loc = fcs(a, "Hips", "location")
base = {i: [k.co[1] for k in fc.keyframe_points] for i, fc in loc.items()}
best = None
for axis in range(3):
    for sign in (1, -1):
        for fc, b in ((loc[axis], base[axis]),):
            for k, v in zip(fc.keyframe_points, b):
                k.co[1] = v
            fc.update()
        sc.frame_set(1)
        p0 = arm.matrix_world @ arm.pose.bones["mixamorig:Hips"].head
        for k in loc[axis].keyframe_points:
            t = min(1.0, max(0.0, (k.co[0] - 1) / 30.0))
            k.co[1] = base[axis][int(k.co[0]) - 1] + sign * 0.6 * t       # unidades locais do osso (cm no FBX original)
            k.handle_left[1] = k.handle_right[1] = k.co[1]
        loc[axis].update()
        sc.frame_set(31)
        d = ((arm.matrix_world @ arm.pose.bones["mixamorig:Hips"].head) - p0)
        d.z = 0
        score = d.length
        if best is None or score > best[0]:
            best = (score, axis, sign)
        for k, v in zip(loc[axis].keyframe_points, base[axis]):
            k.co[1] = v
            k.handle_left[1] = k.handle_right[1] = v
        loc[axis].update()
_, axis, sign = best
for k in loc[axis].keyframe_points:
    t = min(1.0, max(0.0, (k.co[0] - 1) / 30.0))
    k.co[1] = base[axis][int(k.co[0]) - 1] + sign * 0.6 * t
    k.handle_left[1] = k.handle_right[1] = k.co[1]
loc[axis].update()
sc.frame_set(1)
p0 = arm.matrix_world @ arm.pose.bones["mixamorig:Hips"].head
sc.frame_set(31)
print("CASE skate deslocamento horizontal do quadril (m):", round(((arm.matrix_world @ arm.pose.bones["mixamorig:Hips"].head) - p0).xy.length, 3))

# ---- stepped hold: chaves a cada 5 frames, CONSTANTE
a = clone("Walk fwd", "case_stepped_hold")
for fc in vc.iter_fcurves(a):
    kp = fc.keyframe_points
    keep = [k for k in kp if int(round(k.co[0])) % 5 == 1]
    vals = [(k.co[0], k.co[1]) for k in keep]
    for i in range(len(kp) - 1, -1, -1):
        kp.remove(kp[i])
    for x, y in vals:
        k = kp.insert(x, y)
        k.interpolation = 'CONSTANT'
    fc.update()


# ---- braco E para dentro / para fora do tronco: busca (ombro x cotovelo) que aproxima/afasta a mao do tronco
def bone_q(a, bone, f0, f1):
    fq = fcs(a, bone, "rotation_quaternion")
    orig = {f: Quaternion([fq[i].evaluate(f) for i in range(4)]) for f in range(f0, f1 + 1)}
    return fq, orig


def write_q(fq, orig, dq, f0, f1):
    for f in range(f0, f1 + 1):
        q = orig[f] @ dq
        for i in range(4):
            for k in fq[i].keyframe_points:
                if int(round(k.co[0])) == f:
                    k.co[1] = q[i]
                    k.handle_left[1] = k.handle_right[1] = q[i]
    for fc in fq.values():
        fc.update()


def arm_case(name, toward):
    a = clone("idle", name)
    setact(a)
    F0, F1 = 20, 80
    sh_fq, sh_o = bone_q(a, "LeftArm", F0, F1)
    el_fq, el_o = bone_q(a, "LeftForeArm", F0, F1)
    cands = [Quaternion(Vector(ax), math.radians(s * d)) for ax in ((1, 0, 0), (0, 1, 0), (0, 0, 1)) for s in (1, -1) for d in (50, 80, 110)]
    cands.append(Quaternion())
    best = None
    for qs in cands:
        write_q(sh_fq, sh_o, qs, F0, F1)
        for qe in cands:
            write_q(el_fq, el_o, qe, F0, F1)
            sc.frame_set(50)
            hand = arm.matrix_world @ arm.pose.bones["mixamorig:LeftHand"].head
            sp = arm.matrix_world @ ((arm.pose.bones["mixamorig:Spine"].head + arm.pose.bones["mixamorig:Hips"].head) * 0.5)      # centro da barriga
            d = (hand - sp).length
            if best is None or (d < best[0] if toward else d > best[0]):
                best = (d, qs.copy(), qe.copy())
    write_q(sh_fq, sh_o, best[1], F0, F1)
    write_q(el_fq, el_o, best[2], F0, F1)
    print("CASE", name, "distancia mao-centro da barriga (m):", round(best[0], 3))


def leg_case(name):
    """perna E cruzando para dentro da coxa D (frames 20-80): busca (quadril x joelho) que leva o tornozelo ao centro da coxa oposta"""
    a = clone("idle", name)
    setact(a)
    F0, F1 = 20, 80
    sh_fq, sh_o = bone_q(a, "LeftUpLeg", F0, F1)
    el_fq, el_o = bone_q(a, "LeftLeg", F0, F1)
    cands = [Quaternion(Vector(ax), math.radians(s * d)) for ax in ((1, 0, 0), (0, 1, 0), (0, 0, 1)) for s in (1, -1) for d in (30, 60, 90)]
    cands.append(Quaternion())
    best = None
    for qs in cands:
        write_q(sh_fq, sh_o, qs, F0, F1)
        for qe in cands:
            write_q(el_fq, el_o, qe, F0, F1)
            sc.frame_set(50)
            foot = arm.matrix_world @ arm.pose.bones["mixamorig:LeftFoot"].head
            tgt = arm.matrix_world @ ((arm.pose.bones["mixamorig:RightUpLeg"].head + arm.pose.bones["mixamorig:RightLeg"].head) * 0.5)
            d = (foot - tgt).length
            if best is None or d < best[0]:
                best = (d, qs.copy(), qe.copy())
    write_q(sh_fq, sh_o, best[1], F0, F1)
    write_q(el_fq, el_o, best[2], F0, F1)
    print("CASE", name, "distancia pe-centro da coxa oposta (m):", round(best[0], 3))


arm_case("case_arm_into_body", True)
leg_case("case_leg_into_leg")
arm_case("case_arm_clear", False)
bpy.ops.wm.save_as_mainfile(filepath=OUT, copy=True)
print("CASES_OK", OUT)
