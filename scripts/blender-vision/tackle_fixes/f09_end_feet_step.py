from mathutils import Vector

DESCRIPTION = ("Familia 7 (contato com o chao/deslizamento), End g34-g39: os dois pes deslizavam ~4-7 cm/frame ate a posicao da idle. Agora cada pe fica plantado e faz um pequeno passo "
               "(IK analitico de 2 ossos, elevacao maxima de 4 cm) ate o ponto da idle e replanta em g38-g40. Pe E: planta em (0.14,-0.22) ate g35, passo g36-g37; pe D: planta ate g36, passo g37.")

# alvos do TORNOZELO em mundo (x, y, z)
LEFT = {34: (0.14, -0.22, 0.13), 35: (0.14, -0.22, 0.13), 36: (0.215, -0.11, 0.17), 37: (0.265, -0.03, 0.15), 38: (0.29, 0.006, 0.145), 39: (0.29, 0.006, 0.145)}
RIGHT = {34: (-0.16, 0.0, 0.13), 35: (-0.16, 0.0, 0.13), 36: (-0.16, 0.0, 0.13), 37: (-0.22, 0.006, 0.17), 38: (-0.279, 0.011, 0.152), 39: (-0.279, 0.011, 0.152)}


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    for g in range(34, 40):
        ctx.go(g)
        eL = pl.ik_leg(arm, "Left", LEFT[g])
        eR = pl.ik_leg(arm, "Right", RIGHT[g])
        pl.key(arm, ["LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"], g + 1)
        ctx.log.append("g%d: pe E -> %s (erro %.3f m), pe D -> %s (erro %.3f m)" % (g, LEFT[g], eL, RIGHT[g], eR))
