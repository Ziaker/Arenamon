DESCRIPTION = ("Familia 2 (pose/leitura), Mid 2 final e Mid 3 (g13, g17, g18, g22, g26): braco D estendido e mais baixo, mas a FRENTE do tronco (antes cruzava para dentro da barriga "
               "e ficava escondido). Direcao do braco/antebraco/mao em coordenadas do corpo (esquerda, cima, frente).")

POSES = {13: (0.45, -0.35, 0.82), 17: (0.38, -0.55, 0.74), 18: (0.35, -0.60, 0.72), 22: (0.32, -0.65, 0.69), 26: (0.30, -0.70, 0.65)}


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    for g, d in POSES.items():
        ctx.go(g)
        for b in ("RightArm", "RightForeArm", "RightHand"):
            pl.aim(arm, b, d)
        pl.key(arm, ["RightArm", "RightForeArm", "RightHand"], g + 1)
        ctx.log.append("g%d: braco D estendido na direcao %s" % (g, d))
