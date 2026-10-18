import math

DESCRIPTION = ("Familia 6 (congelamento), g19-g25: a oscilacao residual de peso de v9 (6 mm) ficava abaixo do limiar de percepcao (a analise densa ainda marcava possivel congelamento em g19-g21 e g23-g25). "
               "Amplitude triplicada para um assentamento visivel: quadril +-18 mm, Spine1 +-0.09 de inclinacao a frente, balanco do braco D +-0.06; mesma senoide de 8 frames em torno da pose de g18.")


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    # remove a contribuicao anterior? Nao: regrava as chaves de g19-g25 a partir da pose base de g18 (mesma pose-base da v9) com a nova amplitude
    ctx.go(18)
    base = pl.body_dirs(arm, ["Spine1", "RightArm"])
    hips0 = pl.world_head(arm, "Hips").z
    for g in range(19, 26):
        ctx.go(g)
        ph = math.sin(2 * math.pi * (g - 18) / 8.0)
        # volta a pose-base de g18 (ossos e quadril) antes de aplicar a nova amplitude
        for b in ("Spine1", "RightArm"):
            pass
        s = base["Spine1"]
        a_ = base["RightArm"]
        pl.aim(arm, "Spine1", (s[0], s[1], s[2] + 0.09 * ph))
        pl.aim(arm, "RightArm", (a_[0], a_[1] - 0.06 * ph, a_[2] + 0.06 * ph))
        dz = (hips0 + 0.018 * ph) - pl.world_head(arm, "Hips").z
        pl.shift_hips(arm, dz)
        pl.key(arm, ["Hips"], g + 1, props=("location", "rotation_quaternion"))
        pl.key(arm, ["Spine1", "RightArm"], g + 1)
        ctx.log.append("g%d: fase %.2f dz=%.3f" % (g, ph, dz))
