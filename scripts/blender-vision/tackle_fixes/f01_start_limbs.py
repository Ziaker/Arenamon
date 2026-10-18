DESCRIPTION = ("Familia 1 (membro/lado), Start g0-g3: perna D esticada e apoiada; braco E erguido a frente dos olhos com o polegar afastado do indicador (mao aberta, proxy). "
               "Nenhuma outra fase e tocada.")

RIGHT_LEG = (-0.10, -0.99, 0.08)          # esquerda, cima, frente do corpo: coxa/canela quase verticais, levemente para fora/frente
LEFT_UPPER = (0.30, -0.15, 0.94)          # umero E: para frente, levemente para baixo
LEFT_FORE = (0.05, 0.92, 0.38)            # antebraco E: para cima (mao na altura dos olhos), levemente para frente
LEFT_HAND = (0.0, 0.8, 0.6)


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    for g in (0, 3):
        ctx.go(g)
        for b in ("RightUpLeg", "RightLeg"):
            pl.aim(arm, b, RIGHT_LEG)
        pl.aim(arm, "RightFoot", (0.0, -0.35, 0.94))
        dz = pl.ground_foot(arm, "Right", g, z=0.13)
        ctx.log.append("g%d: perna D esticada; quadril ajustado %.3f m para apoiar o pe D" % (g, dz))
        pl.aim(arm, "LeftArm", LEFT_UPPER)
        pl.aim(arm, "LeftForeArm", LEFT_FORE)
        pl.aim(arm, "LeftHand", LEFT_HAND)
        before = pl.thumb_index_angle(arm, "Left")
        pl.spread_digit(arm, "Left", "Thumb", 40)
        ctx.log.append("g%d: abertura polegar-indicador E %.0f -> %.0f graus" % (g, before, pl.thumb_index_angle(arm, "Left")))
        t = g + 1
        pl.key(arm, ["Hips"], t, props=("rotation_quaternion", "location"))
        pl.key(arm, ["RightUpLeg", "RightLeg", "RightFoot", "LeftArm", "LeftForeArm", "LeftHand", "LeftHandThumb1", "LeftHandThumb2", "LeftHandThumb3"], t)
    pl.set_interp(ctx.action, "CONSTANT", frames={1, 4})
