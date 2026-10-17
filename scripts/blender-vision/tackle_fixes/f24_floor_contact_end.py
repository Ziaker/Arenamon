import bpy
from mathutils import Vector

DESCRIPTION = ("CHAO, 2a parte (g21-g34, F22-F35): medi o ponto mais baixo da malha por frame: ate -0.47 m (a MAO D afundando no chao no fim do arco, com o tronco enrolado) e -0.15/-0.21 m "
               "(dedos dos PES, porque a orientacao do pe nao seguia o IK: o pe apontava para baixo). Correcao: (1) pes (Foot e ToeBase) recebem a orientacao da idle em g4-g20 (sola paralela ao chao); "
               "(2) a mao D e levantada em passos de 3.4 graus (direcao do braco para cima) ate a ponta dos dedos ficar >= 4 cm acima do chao; (3) quadril nao desce abaixo de 0.36 m. "
               "Regra nova no contrato: malha >= -0.05 m em todos os frames.")

HIPS_MIN = 0.36


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    idle, cur = bpy.data.actions["idle"], ctx.action
    pl.assign(arm, idle)
    ctx.scene.frame_set(1)
    fdir = {s: pl.seg_dir_world(arm, s + "Foot").copy() for s in ("Left", "Right")}
    tdir = {s: pl.seg_dir_world(arm, s + "ToeBase").copy() for s in ("Left", "Right")}
    pl.assign(arm, cur)
    for g in range(21, 40):
        ctx.go(g)
        # (3) quadril minimo: sobe o quadril e deixa os pes no lugar (IK) se estiver abaixo do limite
        hz = pl.world_head(arm, "Hips").z
        if hz < HIPS_MIN:
            feet = {s: pl.world_head(arm, s + "Foot").copy() for s in ("Left", "Right")}
            poles = {}
            for sd in ("Left", "Right"):
                H_, K_, A_ = pl.world_head(arm, sd + "UpLeg"), pl.world_head(arm, sd + "Leg"), pl.world_head(arm, sd + "Foot")
                ha_ = (A_ - H_).normalized()
                p_ = K_ - H_
                poles[sd] = (p_ - ha_ * p_.dot(ha_)).normalized()
            pl.shift_hips(arm, HIPS_MIN - hz)
            for sd in ("Left", "Right"):
                pl.ik_leg(arm, sd, feet[sd], tuple(pl.to_body(arm, poles[sd])))
            pl.key(arm, ["Hips"], g + 1, props=("location", "rotation_quaternion"))
            pl.key(arm, ["LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"], g + 1)
            ctx.log.append("g%d: quadril %.3f -> %.2f" % (g, hz, HIPS_MIN))
        # (1) orientacao dos pes
        for s in ("Left", "Right"):
            pl.aim_world(arm, s + "Foot", fdir[s])
            pl.aim_world(arm, s + "ToeBase", tdir[s])
        pl.key(arm, ["LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"], g + 1)
        # (2) mao D acima do chao
        def tip_z():
            pl.bpy.context.view_layer.update() if hasattr(pl, "bpy") else None
            zs = [(arm.matrix_world @ pl.pbone(arm, n).tail).z for n in ("RightHandThumb3", "RightHandIndex3", "RightHandIndex4", "RightHand") if pl.pbone(arm, n)]
            return min(zs)
        n_it = 0
        while tip_z() < 0.04 and n_it < 90:
            d = pl.seg_dir_world(arm, "RightArm").copy()
            nd = (d + Vector((0, 0, 0.06))).normalized()
            for b in ("RightArm", "RightForeArm", "RightHand"):
                pl.aim_world(arm, b, nd)
            n_it += 1
        if n_it:
            pl.key(arm, ["RightArm", "RightForeArm", "RightHand"], g + 1)
            ctx.log.append("g%d: mao D levantada em %d passos" % (g, n_it))
    pl.set_interp(ctx.action, "BEZIER", frames=set(range(21, 41)))
