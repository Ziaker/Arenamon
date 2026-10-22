"""Gera .blend SINTETICOS (humanoide de caixas fechadas + actions de casos controlados) para testar a percepcao. Roda dentro do Blender:

  blender -b --factory-startup --python perception_synth.py -- --split dev|eval --out ARQ.blend

Nada de origem autoral e usado. O mesmo esqueleto tem nomes tipo Mixamo ("mixamorig:..."). Cada caso e uma action com 1..30 frames.
Conjuntos: `dev` serve para ajustar limiares; `eval` usa outros valores (amplitude x1.3, tempo +2 frames, personagem girado 35 graus e escala 1.15)
e NAO pode ser usado para ajustar nada.
"""
import math
import sys

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
split = argv[argv.index("--split") + 1]
out = argv[argv.index("--out") + 1]
PAR = {"dev": dict(k=1.0, shift=0, yaw=0.0, scale=1.0), "eval": dict(k=1.3, shift=2, yaw=35.0, scale=1.15)}[split]
P = "mixamorig:"

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 30
bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"

# ------------------------------------------------------------------ esqueleto (T-pose, olhando para -Y; direita do personagem = -X)
BONES = {  # nome: (head, tail, parent)
    "Hips": ((0, 0, 0.90), (0, 0, 1.00), None), "Spine": ((0, 0, 1.00), (0, 0, 1.15), "Hips"), "Spine1": ((0, 0, 1.15), (0, 0, 1.30), "Spine"),
    "Spine2": ((0, 0, 1.30), (0, 0, 1.45), "Spine1"), "Neck": ((0, 0, 1.45), (0, 0, 1.55), "Spine2"), "Head": ((0, 0, 1.55), (0, 0, 1.75), "Neck"),
}
for side, sx in (("Left", 1), ("Right", -1)):
    BONES[side + "Shoulder"] = ((sx * 0.18, 0, 1.42), (sx * 0.25, 0, 1.42), "Spine2")
    BONES[side + "Arm"] = ((sx * 0.25, 0, 1.42), (sx * 0.55, 0, 1.42), side + "Shoulder")
    BONES[side + "ForeArm"] = ((sx * 0.55, 0, 1.42), (sx * 0.80, 0, 1.42), side + "Arm")
    BONES[side + "Hand"] = ((sx * 0.80, 0, 1.42), (sx * 0.90, 0, 1.42), side + "ForeArm")
    BONES[side + "UpLeg"] = ((sx * 0.10, 0, 0.90), (sx * 0.10, 0, 0.50), "Hips")
    BONES[side + "Leg"] = ((sx * 0.10, 0, 0.50), (sx * 0.10, 0, 0.12), side + "UpLeg")
    BONES[side + "Foot"] = ((sx * 0.10, 0, 0.12), (sx * 0.10, -0.12, 0.05), side + "Leg")
    BONES[side + "ToeBase"] = ((sx * 0.10, -0.12, 0.05), (sx * 0.10, -0.22, 0.03), side + "Foot")
BOXES = {  # centro, tamanho total (x,y,z) -- caixas FECHADAS por osso
    "Hips": ((0, 0, 0.95), (0.30, 0.20, 0.12)), "Spine": ((0, 0, 1.075), (0.30, 0.20, 0.15)), "Spine1": ((0, 0, 1.225), (0.34, 0.21, 0.15)),
    "Spine2": ((0, 0, 1.375), (0.36, 0.22, 0.15)), "Neck": ((0, 0, 1.50), (0.08, 0.08, 0.10)), "Head": ((0, 0, 1.65), (0.20, 0.20, 0.20)),
}
for side, sx in (("Left", 1), ("Right", -1)):
    BOXES[side + "Shoulder"] = ((sx * 0.215, 0, 1.42), (0.07, 0.08, 0.08))
    BOXES[side + "Arm"] = ((sx * 0.40, 0, 1.42), (0.30, 0.08, 0.08))
    BOXES[side + "ForeArm"] = ((sx * 0.675, 0, 1.42), (0.25, 0.07, 0.07))
    BOXES[side + "Hand"] = ((sx * 0.85, 0, 1.42), (0.10, 0.06, 0.04))
    BOXES[side + "UpLeg"] = ((sx * 0.10, 0, 0.70), (0.12, 0.12, 0.40))
    BOXES[side + "Leg"] = ((sx * 0.10, 0, 0.31), (0.10, 0.10, 0.38))
    BOXES[side + "Foot"] = ((sx * 0.10, -0.05, 0.05), (0.09, 0.20, 0.10))
    BOXES[side + "ToeBase"] = ((sx * 0.10, -0.17, 0.03), (0.09, 0.08, 0.06))

adata = bpy.data.armatures.new("Rig")
arm = bpy.data.objects.new("Rig", adata)
sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for n, (h, t, par) in BONES.items():
    eb = adata.edit_bones.new(P + n)
    eb.head, eb.tail = h, t
    if par:
        eb.parent = adata.edit_bones[P + par]
bpy.ops.object.mode_set(mode="OBJECT")

bm = bmesh.new()
groups = {}
for n, (c, s) in BOXES.items():
    v0 = len(bm.verts)
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.LocRotScale(Vector(c), None, Vector(s)))
    groups[n] = list(range(v0, len(bm.verts)))
bm.verts.ensure_lookup_table()
me = bpy.data.meshes.new("Body")
bm.to_mesh(me)
bm.free()
body = bpy.data.objects.new("Body", me)
sc.collection.objects.link(body)
for n, idx in groups.items():
    vg = body.vertex_groups.new(name=P + n)
    vg.add(idx, 1.0, "REPLACE")
mod = body.modifiers.new("Armature", "ARMATURE")
mod.object = arm
body.parent = arm
if PAR["yaw"] or PAR["scale"] != 1.0:
    arm.rotation_euler = (0, 0, math.radians(PAR["yaw"]))
    arm.scale = (PAR["scale"],) * 3

REST = {n: arm.data.bones[P + n].matrix_local.to_3x3() for n in BONES}
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"


def pbn(n):
    return arm.pose.bones[P + n]


def reset_pose():
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)


def set_rot(n, rx=0.0, ry=0.0, rz=0.0):
    """rotacao em graus sobre os eixos X,Y,Z do REPOUSO (carregados pelo pai): previsivel para FK de membros"""
    R = Matrix.Rotation(math.radians(rx), 3, "X") @ Matrix.Rotation(math.radians(ry), 3, "Y") @ Matrix.Rotation(math.radians(rz), 3, "Z")  # rz primeiro, depois ry, depois rx
    pbn(n).rotation_quaternion = (REST[n].inverted() @ R @ REST[n]).to_quaternion()


def set_loc(n, dx=0.0, dy=0.0, dz=0.0):
    pbn(n).location = REST[n].inverted() @ Vector((dx, dy, dz))


def hand_world(side="Right"):
    """posicao da mao para a pose MANUAL atual (desliga a action para a pose manual nao ser sobrescrita pela animacao)"""
    ad = arm.animation_data
    keep = ad.action if ad else None
    if ad:
        ad.action = None
    bpy.context.view_layer.update()
    p = arm.matrix_world @ pbn(side + "Hand").head.copy()
    if ad:
        ad.action = keep
    return p


def new_action(name):
    reset_pose()
    a = bpy.data.actions.new(name)
    a.use_fake_user = True
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = a
    try:
        arm.animation_data.action_slot = a.slots[0] if a.slots else None
    except Exception:
        pass
    return a


def key_all(frame, interp=None):
    for pb in arm.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        pb.keyframe_insert("location", frame=frame)
        pb.keyframe_insert("scale", frame=frame)


def finish(a, interp=None):
    from_ = interp
    if from_:
        sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__))))
        from vision_common import iter_fcurves
        for fc in iter_fcurves(a):
            for k in fc.keyframe_points:
                k.interpolation = from_


def S(f):
    return f + PAR["shift"]


K = PAR["k"]
CASES = {}


def case(name):
    def deco(fn):
        CASES[name] = fn
        return fn
    return deco


def pose_frames(a, plan, interp=None, last=30):
    """plan: [(frame, fn)]; fn() ajusta os ossos para esse frame. Chaveia TODOS os ossos (evita herdar pose de outro caso)."""
    reset_pose()
    for f, fn in plan:
        reset_pose()
        fn()
        key_all(f)
    finish(a, interp)
    a.use_frame_range = True
    a.frame_start, a.frame_end = 1, last


def pw(points):
    """funcao linear por partes: points=[(frame, valor)]"""
    def f(x):
        if x <= points[0][0]:
            return points[0][1]
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            if x <= x1:
                return y0 + (y1 - y0) * (x - x0) / float(x1 - x0) if x1 > x0 else y1
        return points[-1][1]
    return f


def keyed(a, frames, setter, interp="LINEAR"):
    """chaveia nos frames dados; setter(frame) ajusta os ossos para aquele frame"""
    pose_frames(a, [(f, (lambda f=f: setter(f))) for f in sorted(set(frames))], interp)


R = lambda n: n  # noqa: E731

# ---- 0 repouso (baseline dos contatos)
a = new_action("rest")
pose_frames(a, [(1, lambda: None), (30, lambda: None)])

# ---- 1 braco atravessando o tronco x braco atras do tronco (oculto) x mao dentro do tronco (inconclusivo visual)
for nm, ang in (("arm_through_torso", 180), ("arm_behind_torso", 240)):
    a = new_action(nm)
    keyed(a, [1, S(10), 30], lambda f, ang=ang: set_rot("RightArm", rz=pw([(1, 0), (S(10), ang), (30, ang)])(f)))
chosen = None
for rz, ry in ((180, 90), (180, -90)):
    reset_pose()
    set_rot("RightArm", rz=rz)
    set_rot("RightForeArm", ry=ry)
    local = arm.matrix_world.inverted() @ hand_world("Right")
    if abs(local.x) < 0.15 and abs(local.y) < 0.09 and 1.0 < local.z < 1.4:
        chosen = (rz, ry)
        break
assert chosen, "nao consegui colocar a mao dentro do tronco (sintetico quebrado)"
a = new_action("hand_inside_torso")
keyed(a, [1, S(10), 30], lambda f: (set_rot("RightArm", rz=pw([(1, 0), (S(10), chosen[0]), (30, chosen[0])])(f)),
                                    set_rot("RightForeArm", ry=pw([(1, 0), (S(10), chosen[1]), (30, chosen[1])])(f))))

# ---- 2 pe apoiado x proximo (2 cm) x suspenso (8 cm): o quadril sobe dz (corpo todo)
for nm, dz in (("foot_planted", 0.0), ("foot_near", 0.02), ("foot_air", 0.08)):
    a = new_action(nm)
    keyed(a, [1, 30], lambda f, dz=dz: set_loc("Hips", dz=dz))

# ---- 3 snap x rapido com rampa (mao D)
SW = 60 * K
a = new_action("snap_jump")
keyed(a, [1, S(9), S(10), 30], lambda f: set_rot("RightArm", rz=-pw([(1, 0), (S(9), 0), (S(10), SW), (30, SW)])(f)), "LINEAR")
a = new_action("fast_ramp")
keyed(a, [1, S(7), S(12), 30], lambda f: set_rot("RightArm", rz=-pw([(1, 0), (S(7), 0), (S(12), SW), (30, SW)])(f)), "BEZIER")

# ---- 4 antecipacao ausente x presente (golpe para frente = rz negativo na mao D)
STR = 70 * K
a = new_action("no_anticipation")
keyed(a, [1, S(8), S(14), 30], lambda f: set_rot("RightArm", rz=-pw([(1, 0), (S(8), 0), (S(14), STR), (30, STR)])(f)), "BEZIER")
a = new_action("with_anticipation")
keyed(a, [1, S(4), S(9), S(14), 30], lambda f: set_rot("RightArm", rz=-pw([(1, 0), (S(4), 0), (S(9), -25 * K), (S(14), STR), (30, STR)])(f)), "BEZIER")

# ---- 5 arco continuo x quina abrupta
a = new_action("arc_smooth")
keyed(a, [1, S(8), S(20), 30], lambda f: set_rot("RightArm", rz=-pw([(1, 0), (S(8), 0), (S(20), 80 * K), (30, 80 * K)])(f)), "BEZIER")
a = new_action("arc_corner")
keyed(a, [1, S(8), S(12), S(16), 30], lambda f: set_rot("RightArm", rz=-pw([(1, 0), (S(8), 0), (S(12), 60 * K), (30, 60 * K)])(f),
                                                       rx=pw([(1, 0), (S(12), 0), (S(16), 60 * K), (30, 60 * K)])(f)), "LINEAR")

# ---- 6 braco antes do tronco x simultaneo (rotacao do braco comeca em S(5); a do tronco em S(10) ou S(5))
for nm, t0 in (("arm_before_torso", 10), ("arm_with_torso", 5)):
    a = new_action(nm)
    keyed(a, [1, S(5), S(10), S(12), S(t0 + 7), 30],
          lambda f, t0=t0: (set_rot("RightArm", rz=-pw([(1, 0), (S(5), 0), (S(12), 70 * K), (30, 70 * K)])(f)),
                            set_rot("Spine2", rz=pw([(1, 0), (S(t0), 0), (S(t0 + 7), 30 * K), (30, 30 * K)])(f))), "LINEAR")

# ---- 7 deformacao: Spine1 estica durante S(8)..S(12) (a mesma action serve a "documentada" e "inesperada": muda so a declaracao)
a = new_action("stretch_spine")
keyed(a, [1, S(8), S(12), S(14), 30],
      lambda f: setattr(pbn("Spine1"), "scale", (1.0, pw([(1, 1.0), (S(8), 1.0), (S(9), 1.4), (S(12), 1.4), (S(14), 1.0), (30, 1.0)])(f), 1.0)), "LINEAR")

# ---- 8 casos DIFICEIS adicionados depois do primeiro ciclo dev/eval (nao participaram do ajuste de limiares)
a = new_action("arm_hanging")  # braco pendurado ao lado do corpo, a ~3 cm do tronco: negativo para atravessamento
reset_pose()
set_rot("RightArm", ry=-90)
assert hand_world("Right").z < 1.1 * PAR["scale"], "braco nao ficou pendurado"
keyed(a, [1, S(10), 30], lambda f: set_rot("RightArm", ry=pw([(1, 0), (S(10), -90), (30, -90)])(f)))
a = new_action("two_frame_fast")  # movimento muito rapido em 2 frames (sem rampa): nao e snap de 1 frame
keyed(a, [1, S(9), S(11), 30], lambda f: set_rot("RightArm", rz=-pw([(1, 0), (S(9), 0), (S(11), SW), (30, SW)])(f)), "LINEAR")

a = new_action("hand_underground")  # mao enterrada: quadril desce 1.0 m com o braco pendurado (mao a 0.77 m do quadril-origem fica a -0.23 m); chao em z=0
keyed(a, [1, S(10), 30], lambda f: (set_rot("RightArm", ry=pw([(1, 0), (S(10), -90), (30, -90)])(f)), set_loc("Hips", dz=pw([(1, 0), (S(10), -1.0), (30, -1.0)])(f))))

reset_pose()
arm.animation_data.action = bpy.data.actions["rest"]
sc.frame_start, sc.frame_end = 1, 30
bpy.ops.wm.save_as_mainfile(filepath=out)
print("SYNTH_OK", split, PAR, sorted(bpy.data.actions.keys()))
