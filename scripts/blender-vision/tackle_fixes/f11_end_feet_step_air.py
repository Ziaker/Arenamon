import bpy

DESCRIPTION = ("Familia 7 (deslizamento dos pes), End g34-g39: passos curtos de reposicionamento COM FASE AEREA (z >= 0.19 m) e aterrissagem de baixa velocidade, via IK de 2 ossos com o joelho "
               "orientado como na idle. Pe E: planta g34-g35, passo g36-g37, planta g38; pe D: planta g34-g36, passo g37-g38, planta g39. A tentativa anterior mantinha o pe baixo "
               "enquanto se movia (lido como deslizamento).")

LEFT = {34: (0.14, -0.22, 0.13), 35: (0.14, -0.22, 0.13), 36: (0.255, -0.04, 0.21), 37: (0.288, 0.004, 0.19), 38: (0.29, 0.006, 0.145), 39: (0.29, 0.006, 0.145)}
RIGHT = {34: (-0.16, 0.0, 0.13), 35: (-0.16, 0.0, 0.13), 36: (-0.16, 0.0, 0.13), 37: (-0.215, 0.006, 0.21), 38: (-0.276, 0.011, 0.19), 39: (-0.279, 0.011, 0.152)}


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    idle = bpy.data.actions["idle"]
    cur = ctx.action
    pl.assign(arm, idle)
    ctx.scene.frame_set(1)
    pole = {s: pl.leg_pole_body(arm, s) for s in ("Left", "Right")}
    pl.assign(arm, cur)
    for g in range(34, 40):
        ctx.go(g)
        eL = pl.ik_leg(arm, "Left", LEFT[g], pole["Left"])
        eR = pl.ik_leg(arm, "Right", RIGHT[g], pole["Right"])
        pl.key(arm, ["LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"], g + 1)
        ctx.log.append("g%d: erro IK E %.3f D %.3f m" % (g, eL, eR))
