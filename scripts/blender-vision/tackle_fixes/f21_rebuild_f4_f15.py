import math

from mathutils import Vector

DESCRIPTION = ("REFEITO DO ZERO F4-F15 (g3-g14), a pedido do diretor: todas as chaves de rotacao/posicao de t4 a t15 foram REMOVIDAS (as de escala do Smear/Stretch foram preservadas) e refeitas com acao mais suave: "
               "(1) F2-F3 gravados como estao (continuam o frame 1 do diretor); (2) F4 = pose de windup do diretor com o braco D em carga; "
               "(3) F5-F15: braco D num ARCO continuo (sino de velocidade, pico unico, chegada suave) enquanto o resto do corpo sai do windup para a pose-alvo de F16 com ease-in-out ESCALONADO "
               "(acao sobreposta: quadril/pernas primeiro, depois coluna, depois peito/cabeca/ombros; braco E acompanha); pes por IK (E desce em arco ate o apoio, D descola atras); "
               "abertura do polegar D em rampa (F8 a F10); cauda com atraso e contra-giro; Bezier em todas as chaves novas. F16 em diante e F1 ficam como estavam.")


def S(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


# ---- arco do braco D (mesma geometria validada em v41, agora ate g14) --------------------------------------
PHI0 = -55.0
_raw = [math.exp(-(((g + 0.5) - 8.8) / 3.4) ** 2) for g in range(3, 17)]
VEL = [213.0 * r / sum(_raw) for r in _raw]


def phi(g):
    return PHI0 if g <= 3 else PHI0 + sum(VEL[: g - 3])


def arm_dir(g):
    lat = -0.35 + 1.15 * S((g - 5) / 12.0)
    r = math.sqrt(max(0.0, 1.0 - lat * lat))
    ph = math.radians(phi(g))
    return (lat, r * math.cos(ph), r * math.sin(ph))


PARTS = {  # (inicio, duracao) em frames autorais: acao sobreposta
    "hips": (4.0, 10.5), "legs": (4.0, 10.5), "spine": (5.0, 9.5), "chest": (6.0, 9.0), "left_arm": (4.0, 11.0), "tail": (6.0, 10.0),
}


def part_of(name):
    if name == "Hips":
        return "hips"
    if name == "Spine":
        return "spine"
    if name in ("Spine1", "Spine2"):
        return "chest"
    if name in ("Neck", "Head", "LeftShoulder", "RightShoulder"):
        return "chest"
    if name.startswith("Left") and ("Arm" in name or "Hand" in name):
        return "left_arm"
    if name.startswith("Tail") or name.startswith("Crest"):
        return "tail"
    return None


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    act = ctx.action
    # ---- A) captura (antes de apagar nada) --------------------------------------------------------------
    ctx.go(0)
    qA = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    hA = pl.pbone(arm, "Hips").location.copy()
    footA = {s: pl.world_head(arm, s + "Foot").copy() for s in ("Left", "Right")}
    poleA = {s: pl.leg_pole_body(arm, s) for s in ("Left", "Right")}
    # F2, F3 (g1, g2) como estao hoje: serao gravados como chaves para continuar t1 depois que t4 sair
    baked = {}
    for g in (1, 2):
        ctx.go(g)
        baked[g] = ({b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}, pl.pbone(arm, "Hips").location.copy())
    # F4 (g3) como estava: windup do diretor + braco D em carga; guarda o dedo (polegar) fechado
    ctx.go(3)
    q3 = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    h3 = pl.pbone(arm, "Hips").location.copy()
    ctx.go(15)
    qB = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    hB = pl.pbone(arm, "Hips").location.copy()
    footB = {s: pl.world_head(arm, s + "Foot").copy() for s in ("Left", "Right")}
    # ---- B) remove as chaves de t4 a t15 (exceto escala) --------------------------------------------------
    removed = 0
    for fc in pl.iter_fcurves(act):
        if fc.data_path.endswith(".scale"):
            continue
        for kp in list(fc.keyframe_points):
            if 4 <= round(kp.co[0]) <= 15:
                fc.keyframe_points.remove(kp)
                removed += 1
        fc.update()
    ctx.log.append("chaves removidas em t4-t15: %d (escala preservada)" % removed)
    # ---- C) F2, F3 gravados --------------------------------------------------------------------------------
    for g, (qq, hh) in baked.items():
        ctx.go(g)
        for b in arm.pose.bones:
            b.rotation_quaternion = qq[b.name]
            b.keyframe_insert("rotation_quaternion", frame=g + 1)
        hp = pl.pbone(arm, "Hips")
        hp.location = hh
        hp.keyframe_insert("location", frame=g + 1)
    # ---- D) F4-F15 (g3-g14) do zero -----------------------------------------------------------------------------
    for g in range(3, 15):
        ctx.go(g)
        for b in arm.pose.bones:
            nm = b.name.replace("mixamorig:", "")
            part = part_of(nm)
            if part is None:
                if nm.startswith("RightHandThumb") or nm.startswith("RightHandIndex"):
                    b.rotation_quaternion = qA[b.name]          # dedos D partem da pose fechada do diretor; abertura vem depois
                    b.keyframe_insert("rotation_quaternion", frame=g + 1)
                continue
            st, du = PARTS[part]
            base = q3[b.name] if g == 3 else qA[b.name]
            w = 0.0 if g <= 3 else S((g - st) / du)
            b.rotation_quaternion = (q3[b.name] if g == 3 else qA[b.name].slerp(qB[b.name], w))
            b.keyframe_insert("rotation_quaternion", frame=g + 1)
        wh = 0.0 if g <= 3 else S((g - PARTS["hips"][0]) / PARTS["hips"][1])
        hp = pl.pbone(arm, "Hips")
        hp.location = h3 if g == 3 else hA.lerp(hB, wh)
        hp.keyframe_insert("location", frame=g + 1)
        # braco D: arco; mao D, polegar abre (rampa F8-F10)
        d = arm_dir(g)
        for bn in ("RightArm", "RightForeArm", "RightHand"):
            pl.aim_fix(arm, bn, d)
        pl.key(arm, ["RightArm", "RightForeArm", "RightHand"], g + 1)
        amp = 0.0 if g < 7 else (40.0 * S((g - 7) / 2.5))
        if amp > 0.5:
            pl.spread_digit(arm, "Right", "Thumb", amp)
        pl.key(arm, ["RightHandThumb1", "RightHandThumb2", "RightHandThumb3", "RightHandIndex1", "RightHandIndex2", "RightHandIndex3"], g + 1)
        # pes por IK
        wl = 0.0 if g <= 3 else S((g - 3.5) / 6.0)
        wr = S((g - 5.0) / 9.0) if g > 3 else 0.0
        tL = footA["Left"].lerp(footB["Left"], wl) + Vector((0, 0, 0.10 * math.sin(math.pi * min(1.0, wl))))
        tR = footA["Right"].lerp(footB["Right"], wr) if g > 3 else footA["Right"]
        pole = {s: tuple(poleA[s]) for s in ("Left", "Right")}
        eL = pl.ik_leg(arm, "Left", tL, pole["Left"])
        eR = pl.ik_leg(arm, "Right", tR, pole["Right"])
        pl.key(arm, ["LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"], g + 1)
        ctx.log.append("g%d: arco phi %.0f, wh %.2f, IK E %.3f D %.3f" % (g, phi(g), wh, eL, eR))
    pl.set_interp(act, "BEZIER", frames=set(range(2, 17)))
