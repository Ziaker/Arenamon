DESCRIPTION = ("Familia 2 (mao D aberta em garra), g9-g13 (janela de contato): polegar D afastado do indicador (~+40 graus) em todos os keyframes da janela. "
               "O rig so tem polegar e indicador: isto e uma abertura PROXY, nao uma garra completa (limitacao registrada no contrato).")


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    for g in range(9, 14):
        ctx.go(g)
        before = pl.thumb_index_angle(arm, "Right")
        pl.spread_digit(arm, "Right", "Thumb", 40)
        pl.key(arm, ["RightHandThumb1", "RightHandThumb2", "RightHandThumb3"], g + 1)
        ctx.log.append("g%d: abertura polegar-indicador D %.0f -> %.0f graus" % (g, before, pl.thumb_index_angle(arm, "Right")))
