import bpy

DESCRIPTION = ("Familia 7 (contato com o chao), g18-g26: com a oscilacao residual (v19) o pe E de apoio flutuava ate 1.2 cm (g20-g21) e PENETRAVA o chao ate 2.7 cm (g24-g25). "
               "IK de 2 ossos trava o tornozelo E em (0.14,-0.36,0.13) em todos os frames do apoio g18-g26 (joelho como na idle).")

TARGET = (0.14, -0.36, 0.13)


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    idle, cur = bpy.data.actions["idle"], ctx.action
    pl.assign(arm, idle)
    ctx.scene.frame_set(1)
    pole = pl.leg_pole_body(arm, "Left")
    pl.assign(arm, cur)
    for g in range(18, 27):
        ctx.go(g)
        e = pl.ik_leg(arm, "Left", TARGET, pole)
        pl.key(arm, ["LeftUpLeg", "LeftLeg"], g + 1)
        ctx.log.append("g%d: pe E travado, erro %.4f m" % (g, e))
