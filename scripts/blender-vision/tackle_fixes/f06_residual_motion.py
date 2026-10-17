import math

DESCRIPTION = ("Familia 6 (congelamento), Mid 3 g19-g25: movimento residual de peso (respiracao/assentamento) em keyframes por frame: quadril +-6 mm, Spine1 +-0.03 de inclinacao "
               "a frente e balanco do braco D +-0.02, senoide de periodo 8 frames em torno da pose de g18; interpolacao suave (Bezier) so nessas chaves.")


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    for g in range(19, 26):
        ctx.go(g)
        ph = math.sin(2 * math.pi * (g - 18) / 8.0)
        d1 = pl.body_dirs(arm, ["Spine1", "RightArm"])
        s = d1["Spine1"]
        pl.aim(arm, "Spine1", (s[0], s[1], s[2] + 0.03 * ph))
        a_ = d1["RightArm"]
        pl.aim(arm, "RightArm", (a_[0], a_[1] - 0.02 * ph, a_[2] + 0.02 * ph))
        pl.shift_hips(arm, 0.006 * ph)
        pl.key(arm, ["Hips"], g + 1, props=("location", "rotation_quaternion"))
        pl.key(arm, ["Spine1", "RightArm"], g + 1)
        ctx.log.append("g%d: fase %.2f" % (g, ph))
    pl.set_interp(ctx.action, "BEZIER", frames={19, 20, 21, 22, 23, 24, 25, 26, 27})
