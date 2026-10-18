DESCRIPTION = ("Familia 1 (membro), Mid 2/Mid 3 (g9-g13, g17, g18, g22, g26): perna D articulada (joelho dobrado ~120 graus) e projetada para tras. "
               "A coxa D e mantida como estava; so a canela D e redirecionada (para tras e para cima).")

KEY_G = [9, 10, 11, 12, 13, 17, 18, 22, 26]
SHIN = (0.10, 0.35, -0.93)        # esquerda, cima, frente: canela para tras e levemente para cima (calcanhar em direcao ao gluteo)


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    for g in KEY_G:
        ctx.go(g)
        pl.aim(arm, "RightLeg", SHIN)
        pl.key(arm, ["RightLeg"], g + 1)
        ctx.log.append("g%d: canela D -> %s" % (g, SHIN))
