DESCRIPTION = ("Familia 1 (precedencia), g3: o braco D passa a disparar ANTES do restante do corpo. No keyframe de g3 todos os ossos fora do braco D/mao D/dedos D voltam a pose de g0 "
               "(tronco, quadril, pernas, braco E acompanham a partir de g4). Antes, braco e tronco mudavam no mesmo frame (g3).")

ARM_D = ("RightShoulder", "RightArm", "RightForeArm", "RightHand", "RightHandThumb", "RightHandIndex")


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    ctx.go(0)
    q0 = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    h0 = pl.pbone(arm, "Hips").location.copy()
    ctx.go(3)
    n = 0
    for b in arm.pose.bones:
        short = b.name.replace("mixamorig:", "")
        if short.startswith(ARM_D):
            continue
        b.rotation_quaternion = q0[b.name]
        b.keyframe_insert("rotation_quaternion", frame=4)
        n += 1
    hp = pl.pbone(arm, "Hips")
    hp.location = h0
    hp.keyframe_insert("location", frame=4)
    ctx.log.append("g3: %d ossos (todos exceto braco D) voltam a pose de g0; quadril tambem" % n)
