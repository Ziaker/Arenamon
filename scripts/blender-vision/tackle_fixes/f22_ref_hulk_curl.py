import math

from mathutils import Vector

DESCRIPTION = ("REFERENCIA DO DIRETOR (sprite do Hulk, MvC): o golpe e uma CURVA em C do corpo inteiro: windup inclinado para tras, braco por cima enquanto a coluna enrola para a frente, "
               "IMPACTO com o tronco dobrado ~55 graus a frente, cabeca abaixada, quadril rebaixado e avancado, HOLD de 2 frames (F12-F13) e levantada gradual. Antes a inclinacao maxima era ~8 graus. "
               "Delta de inclinacao a frente (0 -> +54 -> 0 entre F5 e F20) distribuido em quadril/coluna/cabeca, quadril desce ate 10 cm e avanca 10 cm; braco D mantem a direcao de mundo "
               "(a mao acompanha o ombro e chega ao chao), pes por IK.")

LEAN = {4: 0, 5: 3, 6: 8, 7: 16, 8: 26, 9: 36, 10: 46, 11: 52, 12: 54, 13: 54, 14: 48, 15: 38, 16: 30, 17: 20, 18: 10, 19: 4}


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    for g, ln in LEAN.items():
        if ln == 0:
            continue
        ctx.go(g)
        k = ln / 54.0
        dz, dy = -0.10 * k, 0.10 * k
        snap = pl.snapshot_effectors(arm)
        hj = {sd: pl.world_head(arm, sd + "UpLeg").copy() for sd in ("Left", "Right")}
        relR = snap["foot"]["Right"] - hj["Right"]
        relL = snap["foot"]["Left"] - hj["Left"]
        pole_w = {}
        for sd in ("Left", "Right"):
            H_, K_, A_ = pl.world_head(arm, sd + "UpLeg"), pl.world_head(arm, sd + "Leg"), pl.world_head(arm, sd + "Foot")
            ha_ = (A_ - H_).normalized()
            p_ = K_ - H_
            pole_w[sd] = (p_ - ha_ * p_.dot(ha_)).normalized()
        pl.set_hips_rel(arm, dz=dz, dxy=(0.0, -dy), yaw=0.0, lean=0.2 * ln)
        for name, f in (("Spine", 0.2), ("Spine1", 0.3), ("Spine2", 0.3)):
            pl.rotate_bone_world(arm, name, (1, 0, 0), f * ln)
        # cabeca: acompanha parcialmente (abaixa, mas continua olhando o alvo)
        from mathutils import Quaternion
        rot = Quaternion((1, 0, 0), math.radians(0.35 * ln))
        for b in ("Neck", "Head"):
            pl.aim_world(arm, b, (rot @ snap["head"][b]).normalized())
        for b in ("RightArm", "RightForeArm", "RightHand"):
            pl.aim_world(arm, b, snap["armD"][b])
        tL = snap["foot"]["Left"] if g >= 9 else pl.world_head(arm, "LeftUpLeg") + relL
        tR = pl.world_head(arm, "RightUpLeg") + relR if g < 27 else snap["foot"]["Right"]
        pole = {s: tuple(pl.to_body(arm, pole_w[s])) for s in ("Left", "Right")}
        eL = pl.ik_leg(arm, "Left", tL, pole["Left"])
        eR = pl.ik_leg(arm, "Right", tR, pole["Right"])
        pl.key(arm, ["Hips"], g + 1, props=("location", "rotation_quaternion"))
        pl.key(arm, ["Spine", "Spine1", "Spine2", "Neck", "Head", "RightShoulder", "LeftShoulder", "RightArm", "RightForeArm", "RightHand",
                     "LeftArm", "LeftForeArm", "LeftHand", "LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"], g + 1)
        ctx.log.append("g%d: +%d graus de curva, dz %.3f dy %.3f, IK E %.3f D %.3f" % (g, ln, dz, dy, eL, eR))
    pl.set_interp(ctx.action, "BEZIER", frames=set(range(5, 21)))
