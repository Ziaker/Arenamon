import math

DESCRIPTION = ("POLIMENTO DE ATAQUE (referencia: lutadores de ZZZ/Smash): (1) [antecipacao em g3 testada e descartada: quebrava perna D esticada, mao E e a precedencia do braco]; "
               "(2) PICO DE IMPACTO com OVERSHOOT em g11-g16: lunge extra (quadril ate -3 cm e +4.5 cm a frente, torcao +10, inclinacao +6) e o braco D passa do ponto final (mais baixo/esquerda) "
               "e ASSENTA de volta em g17; (3) FOLLOW-THROUGH da cauda: Tail1-4 com atraso de 2 frames e sentido oposto ao giro do tronco (g4-g30). Pes mantidos no mundo por IK; resto igual a v32.")

DELTA = {11: (4, 3, -0.015, 0.02), 12: (8, 5, -0.025, 0.035), 13: (10, 6, -0.03, 0.045), 14: (10, 6, -0.03, 0.045), 15: (6, 4, -0.02, 0.03), 16: (3, 2, -0.01, 0.015)}
OVER = {12: 0.3, 13: 0.7, 14: 0.9, 15: 0.7, 16: 0.35}
# giro total do tronco por frame (mesma curva da coreografia base) para a cauda
TW = {4: -12, 5: -15, 6: -18, 7: -15, 8: -10}


def tw_of(g):
    if g in TW:
        return TW[g]
    if g < 4:
        return 0.0
    if g <= 17:
        t = max(0.0, min(1.0, (g - 8) / 9.0))
        return -10 + 44 * t * t * (3 - 2 * t)
    if g <= 26:
        return 34.0
    return 34.0 * max(0.0, 1.0 - (g - 26) / 8.0)


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    for g, (tw, ln, dz, dy) in DELTA.items():
        ctx.go(g)
        snap = pl.snapshot_effectors(arm)
        hj = {sd: pl.world_head(arm, sd + "UpLeg").copy() for sd in ("Left", "Right")}
        relL, relR = snap["foot"]["Left"] - hj["Left"], snap["foot"]["Right"] - hj["Right"]
        pole_w = {}
        for sd in ("Left", "Right"):
            H_, K_, A_ = pl.world_head(arm, sd + "UpLeg"), pl.world_head(arm, sd + "Leg"), pl.world_head(arm, sd + "Foot")
            ha_ = (A_ - H_).normalized()
            p_ = K_ - H_
            pole_w[sd] = (p_ - ha_ * p_.dot(ha_)).normalized()
        pl.set_hips_rel(arm, dz=dz, dxy=(0.0, -dy), yaw=0.4 * tw, lean=0.3 * ln)
        for name, f in (("Spine1", 0.3), ("Spine2", 0.3)):
            pl.rotate_bone_world(arm, name, (0, 0, 1), f * tw)
        for name, f in (("Spine", 0.2), ("Spine1", 0.25), ("Spine2", 0.25)):
            pl.rotate_bone_world(arm, name, (1, 0, 0), f * ln)
        for b in ("Neck", "Head"):
            pl.aim_world(arm, b, snap["head"][b])
        ov = OVER.get(g, 0.0)
        for b in ("RightArm", "RightForeArm", "RightHand"):
            d = snap["armD"][b]
            if ov:
                d = (d + pl.fix_dir((0.7, -0.2, 0.0)) * ov * 0.4).normalized()
            pl.aim_world(arm, b, d)
        # pes: g3 pe D no mundo (apoio) e pe E acompanha; g11-g16 pe E no mundo (apoio), pe D acompanha o quadril
        tL = pl.world_head(arm, "LeftUpLeg") + relL if g <= 8 else snap["foot"]["Left"]
        tR = snap["foot"]["Right"] if g <= 3 else pl.world_head(arm, "RightUpLeg") + relR
        pole = {s: tuple(pl.to_body(arm, pole_w[s])) for s in ("Left", "Right")}
        eL = pl.ik_leg(arm, "Left", tL, pole["Left"])
        eR = pl.ik_leg(arm, "Right", tR, pole["Right"])
        pl.key(arm, ["Hips"], g + 1, props=("location", "rotation_quaternion"))
        pl.key(arm, ["Spine", "Spine1", "Spine2", "Neck", "Head", "RightShoulder", "LeftShoulder", "RightArm", "RightForeArm", "RightHand",
                     "LeftArm", "LeftForeArm", "LeftHand", "LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"], g + 1)
        ctx.log.append("g%d: delta tw %.0f ln %.0f dz %.3f dy %.3f overshoot %.1f (IK E %.3f D %.3f)" % (g, tw, ln, dz, dy, ov, eL, eR))
    # cauda: atraso de 2 frames, sentido oposto ao giro do tronco, distribuido em Tail1-4
    tails = [n for n in ("Tail1", "Tail2", "Tail3", "Tail4") if pl.pbone(arm, n)]
    for g in range(4, 31):
        ctx.go(g)
        a = -0.06 * tw_of(g - 2)
        for n in tails:
            pl.rotate_bone_world(arm, n, (0, 0, 1), a)
        pl.key(arm, tails, g + 1)
    ctx.log.append("cauda: %s com atraso de 2 frames" % tails)
    pl.set_interp(ctx.action, "BEZIER", frames=set(range(4, 36)))
