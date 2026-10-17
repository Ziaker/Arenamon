DESCRIPTION = ("Familia 5 (continuidade/transicao para idle), End g35-g39: o salto de g34 para a idle em g40 (2.6 m de mudanca de pose em 1 frame) e distribuido em 5 keyframes novos "
               "(slerp ease-in-out entre a pose de g34 e a idle de g40, todos os ossos + quadril). Nenhuma outra fase e tocada.")

STEPS = {35: 0.08, 36: 0.26, 37: 0.52, 38: 0.78, 39: 0.94}


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    ctx.go(34)
    q0 = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    h0 = pl.pbone(arm, "Hips").location.copy()
    ctx.go(40)
    q1 = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    h1 = pl.pbone(arm, "Hips").location.copy()
    for g, s in STEPS.items():
        ctx.go(g)
        for b in arm.pose.bones:
            b.rotation_quaternion = q0[b.name].slerp(q1[b.name], s)
            b.keyframe_insert("rotation_quaternion", frame=g + 1)
        hp = pl.pbone(arm, "Hips")
        hp.location = h0.lerp(h1, s)
        hp.keyframe_insert("location", frame=g + 1)
        ctx.log.append("g%d: pose = slerp(g34, idle g40, %.2f)" % (g, s))
    pl.set_interp(ctx.action, "LINEAR", frames={35, 36, 37, 38, 39, 40, 41})
