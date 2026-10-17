"""Biblioteca de pose para o Blender (roda DENTRO do Blender; usada pelos scripts de correcao do Tackle).

Idea: em vez de mexer em quaternions as cegas, cada segmento osseo e apontado numa DIRECAO em coordenadas do CORPO
(esquerda, cima, frente do personagem) e o resultado e medido/verificado pelas ferramentas.

    dirs = body_dirs(arm)                  # direcao atual de cada segmento no espaco do corpo (para diagnostico)
    aim(arm, "RightArm", (-1, 0.2, -0.3))  # aponta o segmento (cabeca->ponta do osso) para (esq, cima, frente) do corpo
    key(arm, ["RightArm"], frame)          # insere keyframes de rotacao

O espaco do corpo e recalculado a cada chamada a partir do quadril/coxas/coluna do frame atual: (L)esquerda do personagem, (U)cima, (F)rente = L x U.
O personagem olha para -Y no mundo. Nada aqui altera malha, pesos, hierarquia, nomes ou rest pose: so rotation_quaternion/location/scale de pose bones.
"""
import math

import bpy
from mathutils import Matrix, Quaternion, Vector

BONES = {
    "Hips": "Hips", "Spine": "Spine", "Spine1": "Spine1", "Spine2": "Spine2", "Neck": "Neck", "Head": "Head",
    "LeftShoulder": "LeftShoulder", "LeftArm": "LeftArm", "LeftForeArm": "LeftForeArm", "LeftHand": "LeftHand",
    "RightShoulder": "RightShoulder", "RightArm": "RightArm", "RightForeArm": "RightForeArm", "RightHand": "RightHand",
    "LeftUpLeg": "LeftUpLeg", "LeftLeg": "LeftLeg", "LeftFoot": "LeftFoot", "LeftToeBase": "LeftToeBase",
    "RightUpLeg": "RightUpLeg", "RightLeg": "RightLeg", "RightFoot": "RightFoot", "RightToeBase": "RightToeBase",
}


def pbone(arm, name):
    return arm.pose.bones.get(name) or arm.pose.bones.get("mixamorig:" + name)


def world_head(arm, name):
    return arm.matrix_world @ pbone(arm, name).head


def world_tail(arm, name):
    return arm.matrix_world @ pbone(arm, name).tail


def body_axes(arm):
    """(L, U, F) em coordenadas de mundo para o frame atual: esquerda, cima, frente do personagem"""
    L = (world_head(arm, "LeftUpLeg") - world_head(arm, "RightUpLeg")).normalized()
    U0 = (world_head(arm, "Spine2") - world_head(arm, "Hips")).normalized()
    U = (U0 - L * U0.dot(L)).normalized()
    return L, U, L.cross(U)


def to_body(arm, v, axes=None):
    L, U, F = axes or body_axes(arm)
    return Vector((v.dot(L), v.dot(U), v.dot(F)))


def from_body(arm, v, axes=None):
    L, U, F = axes or body_axes(arm)
    v = Vector(v)
    return (L * v.x + U * v.y + F * v.z).normalized()


def seg_dir_world(arm, name):
    return (world_tail(arm, name) - world_head(arm, name)).normalized()


def body_dirs(arm, names=None):
    ax = body_axes(arm)
    out = {}
    for n in names or ("Spine", "Spine1", "Spine2", "Neck", "Head", "LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand",
                       "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot"):
        if pbone(arm, n):
            d = to_body(arm, seg_dir_world(arm, n), ax)
            out[n] = tuple(round(x, 2) for x in d)
    return out


def aim(arm, name, dir_body, keep_roll=True):
    """gira o osso (rotacao MINIMA) para que cabeca->ponta aponte para dir_body (esquerda, cima, frente do corpo). Pais devem ja estar na pose final."""
    bpy.context.view_layer.update()
    pb = pbone(arm, name)
    target = from_body(arm, dir_body)
    cur = seg_dir_world(arm, name)
    qw = cur.rotation_difference(target)
    mw3 = arm.matrix_world.to_3x3()
    r_arm = mw3.inverted() @ qw.to_matrix() @ mw3
    m = pb.matrix.copy()
    head = m.to_translation()
    new3 = r_arm @ m.to_3x3()
    nm = new3.to_4x4()
    nm.translation = head
    pb.matrix = nm
    bpy.context.view_layer.update()
    return pb


def key(arm, names, frame, props=("rotation_quaternion",)):
    for n in names:
        pb = pbone(arm, n)
        for p in props:
            pb.keyframe_insert(p, frame=frame)


def set_interp(action, interp="BEZIER", frames=None):
    """interpolacao de TODOS os keyframes (ou so dos frames dados): 'CONSTANT', 'LINEAR', 'BEZIER'"""
    sys_path = None
    for fc in iter_fcurves(action):
        for k in fc.keyframe_points:
            if frames is None or round(k.co[0]) in frames:
                k.interpolation = interp
                if interp == "BEZIER":
                    k.handle_left_type = k.handle_right_type = "AUTO_CLAMPED"
        fc.update()


def iter_fcurves(action):
    try:
        for layer in action.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    for fc in cb.fcurves:
                        yield fc
        return
    except AttributeError:
        pass
    for fc in action.fcurves:
        yield fc


def assign(arm, action):
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    try:
        arm.animation_data.action_slot = action.slots[0]
    except Exception:
        pass
    return action


def duplicate_action(name_src, name_dst):
    a = bpy.data.actions[name_src].copy()
    a.name = name_dst
    a.use_fake_user = True
    return a


def ground_foot(arm, side, frame, z=None):
    """ajusta a altura do quadril (location Z do pose bone Hips no espaco local do osso, via armature) para o tornozelo do lado `side` ficar em z (padrao: altura de repouso medida no frame 1 da idle)"""
    pb = pbone(arm, "Hips")
    bpy.context.view_layer.update()
    foot = world_head(arm, side + "Foot")
    if z is None:
        z = GROUND_ANKLE.get(side, foot.z)
    dz = z - foot.z
    m = pb.matrix.copy()
    t = m.translation + arm.matrix_world.to_3x3().inverted() @ Vector((0, 0, dz))
    m.translation = t
    pb.matrix = m
    bpy.context.view_layer.update()
    return dz


GROUND_ANKLE = {}


def spread_digit(arm, side, digit, deg, chain=("1",), toward="Index"):
    """abre o dedo `digit` (ex.: 'Thumb') afastando-o do `toward` (ex.: 'Index') em `deg` graus, girando em torno do eixo perpendicular aos dois; so o 1o osso (os seguintes acompanham)"""
    bpy.context.view_layer.update()
    pb = pbone(arm, side + "Hand" + digit + "1")
    d_dig = seg_dir_world(arm, side + "Hand" + digit + "1")
    d_to = seg_dir_world(arm, side + "Hand" + toward + "1")
    axis = d_to.cross(d_dig)
    if axis.length < 1e-6:
        axis = Vector((0, 0, 1))
    axis.normalize()
    rot = Quaternion(axis, math.radians(deg))        # gira d_dig para longe de d_to (sentido d_to -> d_dig)
    aim_world(arm, side + "Hand" + digit + "1", rot @ d_dig)


def aim_world(arm, name, dir_world):
    bpy.context.view_layer.update()
    pb = pbone(arm, name)
    cur = seg_dir_world(arm, name)
    qw = cur.rotation_difference(Vector(dir_world).normalized())
    mw3 = arm.matrix_world.to_3x3()
    r_arm = mw3.inverted() @ qw.to_matrix() @ mw3
    m = pb.matrix.copy()
    head = m.to_translation()
    nm = (r_arm @ m.to_3x3()).to_4x4()
    nm.translation = head
    pb.matrix = nm
    bpy.context.view_layer.update()


def thumb_index_angle(arm, side):
    """angulo (graus) entre indicador e polegar, como o verificador mede (pontas)"""
    bpy.context.view_layer.update()
    vi = (arm.matrix_world @ pbone(arm, side + "HandIndex3").tail) - world_head(arm, side + "HandIndex1")
    vt = (arm.matrix_world @ pbone(arm, side + "HandThumb3").tail) - world_head(arm, side + "HandThumb1")
    return math.degrees(vi.angle(vt))


def shift_hips(arm, dz_world):
    """desloca o quadril verticalmente (mundo) em dz metros; pernas/braco seguem pela hierarquia"""
    pb = pbone(arm, "Hips")
    bpy.context.view_layer.update()
    m = pb.matrix.copy()
    m.translation = m.translation + arm.matrix_world.to_3x3().inverted() @ Vector((0, 0, dz_world))
    pb.matrix = m
    bpy.context.view_layer.update()


def ik_leg(arm, side, target_world, pole_body=(0.0, 0.0, 1.0)):
    """IK analitico de 2 ossos para a perna: coloca o TORNOZELO em target_world (limitado ao alcance) com o joelho na direcao `pole_body` (padrao: para a frente).
    Usa o quadril ja na pose final do frame. Devolve a distancia residual (m) entre o tornozelo e o alvo."""
    bpy.context.view_layer.update()
    H = world_head(arm, side + "UpLeg")
    K0 = world_head(arm, side + "Leg")
    A0 = world_head(arm, side + "Foot")
    l1, l2 = (K0 - H).length, (A0 - K0).length
    T = Vector(target_world)
    v = T - H
    d = min(max(v.length, abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4)
    dirv = v.normalized()
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(l1 * l1 - a * a, 0.0))
    pole = from_body(arm, pole_body)
    pole = (pole - dirv * pole.dot(dirv)).normalized()
    K = H + dirv * a + pole * h
    aim_world(arm, side + "UpLeg", (K - H).normalized())
    K2 = world_head(arm, side + "Leg")
    aim_world(arm, side + "Leg", (H + dirv * d - K2).normalized())
    return (world_head(arm, side + "Foot") - T).length


def leg_pole_body(arm, side):
    """direcao do joelho (ortogonal a linha quadril->tornozelo) no espaco do corpo, na pose ATUAL: usada como 'pole' do IK para copiar a articulacao de outra pose (ex.: idle)"""
    bpy.context.view_layer.update()
    H, K, A = world_head(arm, side + "UpLeg"), world_head(arm, side + "Leg"), world_head(arm, side + "Foot")
    ha = (A - H).normalized()
    p = (K - H)
    p = (p - ha * p.dot(ha)).normalized()
    return tuple(to_body(arm, p))


# ---------------------------------------------------------------- frame FIXO do mundo (esquerda=+X, cima=+Z, frente=-Y) para coreografar torso/braco como o espectador ve
def fix_dir(v):
    return (Vector((1, 0, 0)) * v[0] + Vector((0, 0, 1)) * v[1] + Vector((0, -1, 0)) * v[2]).normalized()


def aim_fix(arm, name, v):
    aim_world(arm, name, fix_dir(v))


def fix_of_world(vw):
    """vetor de mundo -> (esquerda, cima, frente) do frame fixo"""
    return (vw.x, vw.z, -vw.y)


def rotate_bone_world(arm, name, axis_world, deg, about_head=True):
    """gira o osso (e tudo que depende dele) em torno de um eixo de mundo passando pela cabeca do osso"""
    bpy.context.view_layer.update()
    pb = pbone(arm, name)
    m = pb.matrix.copy()
    mw3 = arm.matrix_world.to_3x3()
    R = Quaternion(Vector(axis_world).normalized(), math.radians(deg)).to_matrix()
    r_arm = mw3.inverted() @ R @ mw3
    head = m.to_translation()
    nm = (r_arm @ m.to_3x3()).to_4x4()
    nm.translation = head
    pb.matrix = nm
    bpy.context.view_layer.update()


def set_hips_rel(arm, dz=0.0, dxy=(0.0, 0.0), yaw=0.0, lean=0.0):
    """quadril: desloca (mundo) e gira: yaw>0 vira o personagem para a ESQUERDA; lean>0 inclina o tronco para a FRENTE (-Y)"""
    bpy.context.view_layer.update()
    pb = pbone(arm, "Hips")
    m = pb.matrix.copy()
    mw3 = arm.matrix_world.to_3x3()
    R = Quaternion((0, 0, 1), math.radians(yaw)).to_matrix() @ Quaternion((1, 0, 0), math.radians(lean)).to_matrix()
    r_arm = mw3.inverted() @ R @ mw3
    t = m.translation.copy()
    nm = (r_arm @ m.to_3x3()).to_4x4()
    nm.translation = t + mw3.inverted() @ Vector((dxy[0], dxy[1], dz))
    pb.matrix = nm
    bpy.context.view_layer.update()


def snapshot_effectors(arm):
    """posicoes de mundo dos tornozelos e direcoes de mundo dos segmentos do braco D (para restaurar depois de mexer no tronco)"""
    bpy.context.view_layer.update()
    return {"foot": {s: world_head(arm, s + "Foot").copy() for s in ("Left", "Right")},
            "armD": {b: seg_dir_world(arm, b).copy() for b in ("RightArm", "RightForeArm", "RightHand")},
            "head": {b: seg_dir_world(arm, b).copy() for b in ("Neck", "Head")}}
