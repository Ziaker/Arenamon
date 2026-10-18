import bpy

DESCRIPTION = ("Familia 7 (contato com o chao), g31-g33: depois do pulinho, ambos os pes aterrissam e ficam PLANTADOS (IK de 2 ossos, joelho como na idle) nas posicoes que ja usavam em g34-g35: "
               "pe E (0.14,-0.22,0.13) e pe D (-0.16,0.0,0.13). Corrige o deslizamento do pe E em g30-g34 que a interpolacao suave (v17) deixou aparecer.")

LEFT = (0.14, -0.22, 0.13)
RIGHT = (-0.16, 0.0, 0.13)


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    idle, cur = bpy.data.actions["idle"], ctx.action
    pl.assign(arm, idle)
    ctx.scene.frame_set(1)
    pole = {s: pl.leg_pole_body(arm, s) for s in ("Left", "Right")}
    pl.assign(arm, cur)
    for g in (31, 32, 33):
        ctx.go(g)
        eL = pl.ik_leg(arm, "Left", LEFT, pole["Left"])
        eR = pl.ik_leg(arm, "Right", RIGHT, pole["Right"])
        pl.key(arm, ["LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"], g + 1)
        ctx.log.append("g%d: pes plantados (erro IK E %.3f D %.3f)" % (g, eL, eR))
