import json
import math
import os

from mathutils import Vector

DESCRIPTION = ("EDICAO DO DIRETOR no frame 1 (windup alto: tronco inclinado para tras, braco D para cima/tras, perna E bem alta, braco E a frente) importada como pose de g0 e "
               "t3-t10 (g2-g9) refeitos para CONTINUAR esse movimento: t4 (g3) = pose do diretor (coil), braco D com a descida de carga de v36 em g3; "
               "g4-g8: tronco/quadril/pernas/braco E saem da pose de windup para a pose de g9 de v36 com ease-in (o braco dispara ANTES; o corpo acompanha depois), "
               "pe E desce em arco ate o apoio e o pe D descola do chao por IK; interpolacao Bezier de t1 a t10.")

EDIT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "chars", "vigor", "tackle_history", "user_edits", "frame1_edit_do_usuario.json")
ARM_D = ("RightShoulder", "RightArm", "RightForeArm", "RightHand")


def S(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def short(b):
    return b.name.replace("mixamorig:", "")


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    ed = json.load(open(EDIT, encoding="utf-8"))
    # ---- 1) frame 1 do diretor
    n = 0
    for fc in pl.iter_fcurves(ctx.action):
        k = "%s|%d" % (fc.data_path, fc.array_index)
        if k in ed:
            for kp in fc.keyframe_points:
                if round(kp.co[0]) == 1:
                    kp.co[1] = ed[k]
                    kp.handle_left[1] = kp.handle_right[1] = ed[k]
                    n += 1
        fc.update()
    ctx.log.append("t1: %d canais importados do diretor" % n)
    # ---- 2) coleta (antes de alterar t2-t10): pose de v36 em g9, direcoes de mundo do braco D em g3-g9, posicoes de pe em g9
    ctx.go(9)
    q9 = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    h9 = pl.pbone(arm, "Hips").location.copy()
    foot9 = {s: pl.world_head(arm, s + "Foot").copy() for s in ("Left", "Right")}
    armdirs = {}
    for g in range(3, 10):
        ctx.go(g)
        armdirs[g] = {b: pl.seg_dir_world(arm, b).copy() for b in ("RightArm", "RightForeArm", "RightHand")}
    # ---- 3) t4 (g3): pose do diretor em todos os ossos exceto braco D (que mantem a direcao de carga de v36)
    ctx.go(0)
    q1 = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    h1 = pl.pbone(arm, "Hips").location.copy()
    ctx.go(3)
    for b in arm.pose.bones:
        if short(b).startswith(ARM_D) or short(b).startswith("RightHand"):
            continue
        b.rotation_quaternion = q1[b.name]
        b.keyframe_insert("rotation_quaternion", frame=4)
    hp = pl.pbone(arm, "Hips")
    hp.location = h1
    hp.keyframe_insert("location", frame=4)
    for b in ("RightArm", "RightForeArm", "RightHand"):
        pl.aim_world(arm, b, armdirs[3][b])
    pl.key(arm, ["RightArm", "RightForeArm", "RightHand"], 4)
    ctx.go(3)
    footW = {s: pl.world_head(arm, s + "Foot").copy() for s in ("Left", "Right")}
    ctx.log.append("g3: pose do diretor; pe E (%.2f,%.2f,%.2f) pe D (%.2f,%.2f,%.2f)" % (*footW["Left"], *footW["Right"]))
    poleL = pl.leg_pole_body(arm, "Left")
    poleR = pl.leg_pole_body(arm, "Right")
    q4 = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    h4 = pl.pbone(arm, "Hips").location.copy()
    # ---- 4) g4-g8: do windup (t4) para g9 (t10) com ease-in; braco D dispara antes
    for g in range(4, 9):
        ctx.go(g)
        w = ((g - 3) / 6.0) ** 2            # ease-in: g4 .03 g5 .11 g6 .25 g7 .44 g8 .69 (g9 = 1)
        for b in arm.pose.bones:
            sh = short(b)
            if sh.startswith(ARM_D) or sh.startswith("RightHand"):
                continue
            b.rotation_quaternion = q4[b.name].slerp(q9[b.name], w)
            b.keyframe_insert("rotation_quaternion", frame=g + 1)
        hp = pl.pbone(arm, "Hips")
        hp.location = h4.lerp(h9, w)
        hp.keyframe_insert("location", frame=g + 1)
        for b in ("RightArm", "RightForeArm", "RightHand"):
            pl.aim_world(arm, b, armdirs[g][b])
        pl.key(arm, ["RightArm", "RightForeArm", "RightHand"], g + 1)
        # pes por IK: E desce em arco ate o apoio; D descola depois do g5
        wl = S((g - 3) / 6.0)
        wr = S((g - 5) / 4.0)
        tL = footW["Left"].lerp(foot9["Left"], wl) + Vector((0, 0, 0.12 * math.sin(math.pi * wl)))
        tR = footW["Right"].lerp(foot9["Right"], wr)
        eL = pl.ik_leg(arm, "Left", tL, poleL)
        eR = pl.ik_leg(arm, "Right", tR, poleR)
        pl.key(arm, ["LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"], g + 1)
        ctx.log.append("g%d: w %.2f wl %.2f wr %.2f | IK E %.3f D %.3f" % (g, w, wl, wr, eL, eR))
    pl.set_interp(ctx.action, "BEZIER", frames=set(range(1, 11)))
