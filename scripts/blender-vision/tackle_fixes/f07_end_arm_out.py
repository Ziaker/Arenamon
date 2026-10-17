DESCRIPTION = ("Familia 8 (interpenetracao) + retorno a idle, End g27-g34: o braco D descia atravessando a barriga ate g35; agora varre para baixo/para fora em direcoes do corpo "
               "(esquerda, cima, frente) de (0.25,-0.75,0.60) em g27 ate (-0.28,-0.90,0.0) em g34, ja proximo da direcao da idle (lateral/atras), sem cruzar o tronco.")

POSES = {27: (0.25, -0.75, 0.60), 28: (0.15, -0.82, 0.55), 29: (0.08, -0.87, 0.48), 30: (0.0, -0.90, 0.40), 32: (-0.15, -0.92, 0.20), 34: (-0.28, -0.90, 0.0)}


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    for g, d in POSES.items():
        ctx.go(g)
        for b in ("RightArm", "RightForeArm", "RightHand"):
            pl.aim(arm, b, d)
        pl.key(arm, ["RightArm", "RightForeArm", "RightHand"], g + 1)
        ctx.log.append("g%d: braco D -> %s" % (g, d))
