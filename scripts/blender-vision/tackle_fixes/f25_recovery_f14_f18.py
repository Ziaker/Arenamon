import bpy
from mathutils import Vector

DESCRIPTION = ("RECOVERY de 5 frames a partir de F14 (g13) ate F18 (g17), com POUCAS chaves (pedido do diretor): sai a chave de F15-F17 e entra UMA chave de respiro em F16, as de F14 e F18 ficam; "
               "Bezier faz o resto. Acao sobreposta: quadril sobe primeiro, coluna desenrola depois, peito/cabeca por ultimo e o braco D ATRASA (follow-through: ainda baixo quando o corpo ja levanta); "
               "pe E segue apoiado no mundo (IK), pe D acompanha o quadril; pes com sola paralela e mao acima do chao.")

W = {"hips": 0.62, "spine": 0.50, "chest": 0.40, "head": 0.30, "leftarm": 0.45, "tail": 0.28}


def part(nm):
    if nm == "Hips":
        return "hips"
    if nm == "Spine":
        return "spine"
    if nm in ("Spine1", "Spine2", "LeftShoulder", "RightShoulder"):
        return "chest"
    if nm in ("Neck", "Head"):
        return "head"
    if nm.startswith("Left") and ("Arm" in nm or "Hand" in nm):
        return "leftarm"
    if nm.startswith("Tail") or nm.startswith("Crest"):
        return "tail"
    return None


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    act = ctx.action
    idle = bpy.data.actions["idle"]
    pl.assign(arm, idle)
    ctx.scene.frame_set(1)
    fdir = {s: pl.seg_dir_world(arm, s + "Foot").copy() for s in ("Left", "Right")}
    tdir = {s: pl.seg_dir_world(arm, s + "ToeBase").copy() for s in ("Left", "Right")}
    pl.assign(arm, act)
    ctx.go(13)
    q14 = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    h14 = pl.pbone(arm, "Hips").location.copy()
    armd14 = {b: pl.seg_dir_world(arm, b).copy() for b in ("RightArm", "RightForeArm", "RightHand")}
    footL = pl.world_head(arm, "LeftFoot").copy()
    ctx.go(17)
    q18 = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    h18 = pl.pbone(arm, "Hips").location.copy()
    armd18 = {b: pl.seg_dir_world(arm, b).copy() for b in ("RightArm", "RightForeArm", "RightHand")}
    # remove as chaves de F15, F16, F17 (t15-t17) exceto escala
    removed = 0
    for fc in pl.iter_fcurves(act):
        if fc.data_path.endswith(".scale"):
            continue
        for kp in list(fc.keyframe_points):
            if 15 <= round(kp.co[0]) <= 17:
                fc.keyframe_points.remove(kp)
                removed += 1
        fc.update()
    ctx.log.append("chaves removidas em F15-F17: %d" % removed)
    # chave de respiro em F16 (g15)
    g = 15
    ctx.go(g)
    poles = {}
    for sd in ("Left", "Right"):
        H_, K_, A_ = pl.world_head(arm, sd + "UpLeg"), pl.world_head(arm, sd + "Leg"), pl.world_head(arm, sd + "Foot")
        ha_ = (A_ - H_).normalized()
        p_ = K_ - H_
        poles[sd] = (p_ - ha_ * p_.dot(ha_)).normalized()
    # pe D relativo ao quadril, medido em F14 e F18 (interpola)
    for b in arm.pose.bones:
        nm = b.name.replace("mixamorig:", "")
        p = part(nm)
        if p is None:
            continue
        b.rotation_quaternion = q14[b.name].slerp(q18[b.name], W[p])
        b.keyframe_insert("rotation_quaternion", frame=g + 1)
    hp = pl.pbone(arm, "Hips")
    hp.location = h14.lerp(h18, W["hips"])
    hp.keyframe_insert("location", frame=g + 1)
    # braco D atrasa: direcao de mundo entre F14 e F18 com peso 0.30 (so 30% do caminho)
    for bn in ("RightArm", "RightForeArm", "RightHand"):
        d = (armd14[bn] * 0.70 + armd18[bn] * 0.30).normalized()
        pl.aim_world(arm, bn, d)
    pl.key(arm, ["RightArm", "RightForeArm", "RightHand"], g + 1)
    # pernas por IK: E apoiado no mundo; D acompanha o quadril (deslocamento relativo medio de F14/F18)
    eL = pl.ik_leg(arm, "Left", footL, tuple(pl.to_body(arm, poles["Left"])))
    ctx.go(13)
    relD14 = pl.world_head(arm, "RightFoot") - pl.world_head(arm, "RightUpLeg")
    ctx.go(17)
    relD18 = pl.world_head(arm, "RightFoot") - pl.world_head(arm, "RightUpLeg")
    ctx.go(g)
    tR = pl.world_head(arm, "RightUpLeg") + relD14.lerp(relD18, W["hips"])
    eR = pl.ik_leg(arm, "Right", tR, tuple(pl.to_body(arm, poles["Right"])))
    pl.key(arm, ["LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"], g + 1)
    for s in ("Left", "Right"):
        pl.aim_world(arm, s + "Foot", fdir[s])
        pl.aim_world(arm, s + "ToeBase", tdir[s])
    pl.key(arm, ["LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"], g + 1)
    # mao D acima do chao
    n_it = 0
    def tip_z():
        return min((arm.matrix_world @ pl.pbone(arm, n).tail).z for n in ("RightHandThumb3", "RightHandIndex3", "RightHandIndex4", "RightHand") if pl.pbone(arm, n))
    while tip_z() < 0.04 and n_it < 90:
        nd = (pl.seg_dir_world(arm, "RightArm") + Vector((0, 0, 0.06))).normalized()
        for bn in ("RightArm", "RightForeArm", "RightHand"):
            pl.aim_world(arm, bn, nd)
        n_it += 1
    if n_it:
        pl.key(arm, ["RightArm", "RightForeArm", "RightHand"], g + 1)
    ctx.log.append("F16: chave de respiro; IK E %.3f D %.3f; mao levantada %d passos" % (eL, eR, n_it))
    pl.set_interp(act, "BEZIER", frames={14, 16, 18})
