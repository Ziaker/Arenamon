import bpy

DESCRIPTION = ("Familia 7 (deslizamento dos pes), End g34-g38: passos curtos plantados com IK de 2 ossos (pe E planta ate g35, passo g36-g37; pe D planta ate g36, passo g37), "
               "com o joelho orientado como na idle (pole copiado da idle) para que a pose de g38 case com a idle de g40 e o ultimo passo nao cresca. g39 permanece o slerp da tentativa anterior.")

LEFT = {34: (0.14, -0.22, 0.13), 35: (0.14, -0.22, 0.13), 36: (0.215, -0.11, 0.17), 37: (0.265, -0.03, 0.15), 38: (0.29, 0.006, 0.145)}
RIGHT = {34: (-0.16, 0.0, 0.13), 35: (-0.16, 0.0, 0.13), 36: (-0.16, 0.0, 0.13), 37: (-0.22, 0.006, 0.17), 38: (-0.279, 0.011, 0.152)}


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    cur = ctx.action
    idle = bpy.data.actions["idle"]
    pl.assign(arm, idle)
    ctx.scene.frame_set(1)
    pole = {s: pl.leg_pole_body(arm, s) for s in ("Left", "Right")}
    pl.assign(arm, cur)
    ctx.log.append("pole dos joelhos copiado da idle: %s" % pole)
    for g in range(34, 39):
        ctx.go(g)
        eL = pl.ik_leg(arm, "Left", LEFT[g], pole["Left"])
        eR = pl.ik_leg(arm, "Right", RIGHT[g], pole["Right"])
        pl.key(arm, ["LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"], g + 1)
        ctx.log.append("g%d: erro IK E %.3f D %.3f m" % (g, eL, eR))
