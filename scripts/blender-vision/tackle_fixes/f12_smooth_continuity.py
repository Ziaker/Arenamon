DESCRIPTION = ("Familia 5 (continuidade temporal), g13-g34: os trechos restantes em interpolacao CONSTANTE (holds de blocking de 3 frames em g14-g16 e o picote com quadros de movimento zero em g31/g33) "
               "passam a Bezier auto-clamped (sem overshoot). Nenhuma pose-chave e alterada; so a interpolacao entre elas de t14 a t35.")


def apply(ctx):
    pl = ctx.pl
    frames = set(range(14, 36))
    pl.set_interp(ctx.action, "BEZIER", frames=frames)
    ctx.log.append("interpolacao Bezier (auto clamped) nas chaves t14-t35")
