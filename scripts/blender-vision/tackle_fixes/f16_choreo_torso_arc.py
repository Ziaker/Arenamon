import bpy
import math

DESCRIPTION = ("COREOGRAFIA (familia 1/2): o tronco nao participava do golpe (coluna praticamente identica de g4 a g26 e o corpo virava uma bola agachada). "
               "Agora: giro do tronco (torcao para a direita no windup, ate +43 graus para a esquerda no fim do arco, pelve com 40%), inclinacao a frente crescente (ate +28 graus), "
               "quadril desce ate 3 cm e avanca ate 6 cm no lunge, cabeca olhando a frente; o arco do braco D e REDISTRIBUIDO ao longo de g9-g17 "
               "(antes chegava ao fim em g13 e ficava parado); pes mantidos no mundo por IK; g27-g34 voltam gradualmente ao desenho anterior.")

# ---- curvas (por frame autoral) --------------------------------------------------------------
TWIST = {4: -12, 5: -15, 6: -18, 7: -15, 8: -12, 9: -4, 10: 4, 11: 12, 12: 22, 13: 30, 14: 36, 15: 40, 16: 42, 17: 43}
LEAN = {4: -4, 5: -5, 6: -5, 7: -4, 8: -3, 9: 3, 10: 6, 11: 10, 12: 14, 13: 18, 14: 21, 15: 24, 16: 26, 17: 28}
HIPS_DZ = {9: 0.0, 11: -0.01, 13: -0.02, 15: -0.03, 17: -0.03}
HIPS_DY = {9: 0.0, 11: 0.02, 13: 0.03, 15: 0.05, 17: 0.06}          # + = para a frente (-Y)
# direcoes do braco D (esquerda, cima, frente) no frame fixo do mundo: arco do alto/direita para baixo/esquerda
ARC = {10: (-0.50, 0.70, 0.30), 11: (-0.25, 0.55, 0.62), 12: (0.0, 0.25, 0.80), 13: (0.20, -0.10, 0.90), 14: (0.30, -0.45, 0.80),
       15: (0.35, -0.65, 0.65), 16: (0.36, -0.75, 0.55), 17: (0.36, -0.80, 0.50)}
HOLD_ARM = (0.34, -0.84, 0.45)


def interp(tbl, g, lo, hi, default_lo=0.0):
    if g <= lo:
        return tbl.get(lo, default_lo)
    if g >= hi:
        return tbl.get(hi, tbl[max(tbl)])
    ks = sorted(tbl)
    a = max(k for k in ks if k <= g)
    b = min(k for k in ks if k >= g)
    if a == b:
        return tbl[a]
    t = (g - a) / (b - a)
    return tbl[a] + (tbl[b] - tbl[a]) * t


def params(g):
    """twist, lean, dz, dy, arm_override(or None), weight_of_choreography"""
    if g <= 17:
        tw, ln = interp(TWIST, g, 4, 17), interp(LEAN, g, 4, 17)
        dz, dy = interp(HIPS_DZ, g, 9, 17), interp(HIPS_DY, g, 9, 17)
        arm = ARC.get(g)
        return tw, ln, dz, dy, arm
    if g <= 26:
        # sustentacao: g18-g26 em torno da pose de g17 com assentamento residual (senoide de 8 frames)
        ph = math.sin(2 * math.pi * (g - 17) / 8.0)
        return TWIST[17] + 1.5 * ph, LEAN[17] + 2.0 * ph, HIPS_DZ[17] + 0.012 * ph, HIPS_DY[17], tuple(c + 0.03 * ph * s for c, s in zip(HOLD_ARM, (0.0, -1.0, 1.0)))
    # g27-g34: volta gradual ao desenho anterior (peso decai de 1 a 0)
    w = max(0.0, 1.0 - (g - 26) / 8.0)
    return TWIST[17] * w, LEAN[17] * w, HIPS_DZ[17] * w, HIPS_DY[17] * w, None


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    for g in range(4, 35):
        ctx.go(g)
        snap = pl.snapshot_effectors(arm)
        tw, ln, dz, dy, arm_dir = params(g)
        if abs(tw) < 1e-3 and abs(ln) < 1e-3 and abs(dz) < 1e-6 and arm_dir is None and g not in range(4, 10):
            continue
        # quadril: pelve gira 40% da torcao e inclina 30% do lean; desloca (frente = -Y)
        pl.set_hips_rel(arm, dz=dz, dxy=(0.0, -dy), yaw=0.4 * tw, lean=0.3 * ln)
        # coluna: restante da torcao e do lean distribuido em Spine1/Spine2 (rotacao do osso e dos filhos)
        for name, f in (("Spine1", 0.3), ("Spine2", 0.3)):
            pl.rotate_bone_world(arm, name, (0, 0, 1), f * tw)
        for name, f in (("Spine", 0.2), ("Spine1", 0.25), ("Spine2", 0.25)):
            pl.rotate_bone_world(arm, name, (1, 0, 0), f * ln)
        # cabeca olha a frente (mistura do desenho anterior com 'olhar o alvo' conforme a torcao)
        wgt = min(1.0, abs(tw) / 43.0)
        for b in ("Neck", "Head"):
            old = snap["head"][b]
            tgt = pl.fix_dir((0.0, 0.97, 0.22))
            pl.aim_world(arm, b, (old * (1 - wgt) + tgt * wgt).normalized())
        # braco D: arco coreografado em g10-g26; fora disso mantem a direcao de mundo anterior
        for b in ("RightArm", "RightForeArm", "RightHand"):
            if arm_dir is not None:
                pl.aim_fix(arm, b, arm_dir)
            else:
                pl.aim_world(arm, b, snap["armD"][b])
        # pes: voltam as posicoes de mundo anteriores (IK de 2 ossos, joelho como na pose atual)
        pole = {s: pl.leg_pole_body(arm, s) for s in ("Left", "Right")}
        eL = pl.ik_leg(arm, "Left", snap["foot"]["Left"], pole["Left"])
        eR = pl.ik_leg(arm, "Right", snap["foot"]["Right"], pole["Right"])
        pl.key(arm, ["Hips"], g + 1, props=("location", "rotation_quaternion"))
        pl.key(arm, ["Spine", "Spine1", "Spine2", "Neck", "Head", "RightShoulder", "LeftShoulder", "RightArm", "RightForeArm", "RightHand",
                     "LeftArm", "LeftForeArm", "LeftHand", "LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"], g + 1)
        ctx.log.append("g%d: tw %.1f lean %.1f dz %.3f dy %.3f arco %s erro IK E %.3f D %.3f" % (g, tw, ln, dz, dy, arm_dir, eL, eR))
    pl.set_interp(ctx.action, "BEZIER", frames=set(range(5, 36)))
