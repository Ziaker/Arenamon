import math

DESCRIPTION = ("COREOGRAFIA (2a tentativa; a 1a girou/inclinou demais e deitou o corpo): o tronco agora PARTICIPA do golpe com amplitude moderada - torcao do tronco de -18 (windup, "
               "direita) ate +34 graus (fim do arco, esquerda), inclinacao a frente ate 8 graus, quadril desce 2.5 cm e avanca 5 cm; o arco do braco D vai do alto/direita (g9) ate baixo/esquerda "
               "(g17) por uma curva de Bezier com EASE-OUT (rapido no contato g9-g13, assenta em g17: antes chegava ao fim em g13 e ficava parado); pes: apoio E no mundo, pe D acompanha o quadril "
               "(joelho dobrado preservado), ambos no mundo a partir da aterrissagem g31; g27-g34 voltam ao desenho anterior.")


def S(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def lerp3(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


P0, P1, P2 = (-0.65, 0.72, -0.10), (0.15, 0.35, 0.85), (0.66, -0.74, 0.28)


def arc(g):
    t = (g - 9) / 8.0
    s = 1.0 - (1.0 - max(0.0, min(1.0, t))) ** 2.8          # ease-out: mais rapido no inicio (contato g9-g13)
    a, b = lerp3(P0, P1, s), lerp3(P1, P2, s)
    v = lerp3(a, b, s)
    n = math.sqrt(sum(x * x for x in v))
    return tuple(x / n for x in v)


def params(g):
    if g <= 8:
        tw = {4: -12, 5: -15, 6: -18, 7: -15, 8: -10}[g]
        return tw, {4: -3, 5: -4, 6: -4, 7: -3, 8: -2}[g], 0.0, 0.0, None
    if g <= 17:
        u = S((g - 8) / 9.0)
        return -10 + 44 * u, -2 + 10 * u, -0.025 * u, 0.05 * u, arc(g)
    if g <= 26:
        ph = math.sin(2 * math.pi * (g - 17) / 8.0)
        a = arc(17)
        return 34 + 1.5 * ph, 8 + 1.5 * ph, -0.025 + 0.012 * ph, 0.05, (a[0], a[1] - 0.03 * ph, a[2] + 0.03 * ph)
    w = max(0.0, 1.0 - (g - 26) / 8.0)
    return 34 * w, 8 * w, -0.025 * w, 0.05 * w, None


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    for g in range(4, 35):
        ctx.go(g)
        snap = pl.snapshot_effectors(arm)
        hips_old = pl.world_head(arm, "Hips").copy()
        hipj_old = {sd: pl.world_head(arm, sd + "UpLeg").copy() for sd in ("Left", "Right")}
        rel_right = snap["foot"]["Right"] - hipj_old["Right"]
        rel_left = snap["foot"]["Left"] - hipj_old["Left"]
        pole_w = {}
        for sd in ("Left", "Right"):
            H_, K_, A_ = pl.world_head(arm, sd + "UpLeg"), pl.world_head(arm, sd + "Leg"), pl.world_head(arm, sd + "Foot")
            ha_ = (A_ - H_).normalized()
            p_ = K_ - H_
            pole_w[sd] = (p_ - ha_ * p_.dot(ha_)).normalized()
        tw, ln, dz, dy, arm_dir = params(g)
        pl.set_hips_rel(arm, dz=dz, dxy=(0.0, -dy), yaw=0.4 * tw, lean=0.3 * ln)
        for name, f in (("Spine1", 0.3), ("Spine2", 0.3)):
            pl.rotate_bone_world(arm, name, (0, 0, 1), f * tw)
        for name, f in (("Spine", 0.2), ("Spine1", 0.25), ("Spine2", 0.25)):
            pl.rotate_bone_world(arm, name, (1, 0, 0), f * ln)
        wgt = min(1.0, abs(tw) / 34.0)
        for b in ("Neck", "Head"):
            old = snap["head"][b]
            tgt = pl.fix_dir((0.0, 0.97, 0.22))
            pl.aim_world(arm, b, (old * (1 - wgt) + tgt * wgt).normalized())
        for b in ("RightArm", "RightForeArm", "RightHand"):
            if arm_dir is not None:
                pl.aim_fix(arm, b, arm_dir)
            else:
                pl.aim_world(arm, b, snap["armD"][b])
        hips_new = pl.world_head(arm, "Hips")
        # pes: apoio E no mundo de g9 a g26 e de g31; antes/durante o pulo o pe acompanha o quadril; pe D no mundo so a partir de g31
        tL = snap["foot"]["Left"] if (9 <= g <= 26 or g >= 31) else pl.world_head(arm, "LeftUpLeg") + rel_left
        tR = snap["foot"]["Right"] if g >= 31 else pl.world_head(arm, "RightUpLeg") + rel_right
        pole = {s: tuple(pl.to_body(arm, pole_w[s])) for s in ("Left", "Right")}
        eL = pl.ik_leg(arm, "Left", tL, pole["Left"])
        eR = pl.ik_leg(arm, "Right", tR, pole["Right"])
        pl.key(arm, ["Hips"], g + 1, props=("location", "rotation_quaternion"))
        pl.key(arm, ["Spine", "Spine1", "Spine2", "Neck", "Head", "RightShoulder", "LeftShoulder", "RightArm", "RightForeArm", "RightHand",
                     "LeftArm", "LeftForeArm", "LeftHand", "LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"], g + 1)
        ctx.log.append("g%d: tw %.1f lean %.1f dz %.3f dy %.3f erro IK E %.3f D %.3f" % (g, tw, ln, dz, dy, eL, eR))
    pl.set_interp(ctx.action, "BEZIER", frames=set(range(5, 36)))
