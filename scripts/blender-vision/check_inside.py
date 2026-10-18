"""Roda DENTRO do Blender: blender -b ARQUIVO --python check_inside.py -- config.json

cfg["mode"]:
  "check"    -> avalia as regras de um briefing (JSON) + metricas + capacidades do rig; grava check_report.json
  "footlock" -> cria uma COPIA da action com os pes travados (IK) e salva SOMENTE num .blend novo (cfg["save_as"])

Nunca salva o .blend de origem. Todas as medidas usam coordenadas de mundo em metros.
"""
import bpy
import json
import math
import os
import sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vision_common as vc
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

cfg = json.load(open(sys.argv[sys.argv.index("--") + 1], encoding="utf-8"))
OUT = cfg["out"]
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
OFFSET = int(cfg.get("offset", 0))
MODE = cfg["mode"]


def fail(msg):
    print("VISION_FAIL:", msg, flush=True)
    raise SystemExit(msg)


arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
if cfg.get("armature"):
    arm = bpy.data.objects.get(cfg["armature"])
    if arm is None or arm.type != 'ARMATURE':
        fail("armature '%s' nao existe" % cfg["armature"])
else:
    if len(arms) != 1:
        fail("o arquivo tem %d armatures; informe --armature" % len(arms))
    arm = arms[0]
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' and m.object == arm for m in o.modifiers)]
if not meshes:
    fail("nenhuma malha ligada ao armature")
W = arm.matrix_world
INV = W.inverted()


def set_action(name):
    act = bpy.data.actions.get(name)
    if act is None:
        fail("action '%s' nao existe" % name)
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = act
    try:
        arm.animation_data.action_slot = act.slots[0]
    except Exception:
        pass
    return act


ACT = set_action(cfg["action"])
FR = list(range(int(round(ACT.frame_range[0])), int(round(ACT.frame_range[1])) + 1))
AUTH = lambda f: f - OFFSET


def pb(n):
    return arm.pose.bones.get(n) or arm.pose.bones.get("mixamorig:" + n)


def wp(n):
    return W @ pb(n).head


def parse_frames(spec):
    out = []
    for part in str(spec).split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part[1:]:
            a, b = part.rsplit("-", 1) if part.count("-") == 1 else (part.split("-", 1)[0], part.split("-", 1)[1])
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


BRIEF_MODE = ""
KEYJ = [j for j in ["Hips", "Spine2", "Head", "LeftHand", "RightHand", "LeftForeArm", "RightForeArm", "LeftFoot", "RightFoot", "LeftLeg", "RightLeg"] if pb(j)]


BODY = {}
CHEST = {}
STEPPED = False
EXTRA_J = ["LeftArm", "RightArm", "LeftUpLeg", "RightUpLeg", "Spine", "Spine1", "Neck", "LeftHandIndex1", "LeftHandIndex2", "LeftHandIndex3", "LeftHandThumb1", "LeftHandThumb2", "LeftHandThumb3",
           "RightHandIndex1", "RightHandIndex2", "RightHandIndex3", "RightHandThumb1", "RightHandThumb2", "RightHandThumb3"]


def collect():
    P = {}
    for f in FR:
        sc.frame_set(f)
        P[f] = {j: wp(j).copy() for j in KEYJ}
        for j in EXTRA_J:
            if pb(j):
                P[f][j] = wp(j).copy()
        for side in ("Left", "Right"):         # pontas dos dedos (cauda do ultimo osso de cada dedo)
            for dg in ("Index3", "Thumb3"):
                b_ = pb(side + "Hand" + dg)
                if b_:
                    P[f][side + "Hand" + dg + "_tip"] = (W @ b_.tail).copy()
        try:        # eixos do CORPO: esquerda (UpLeg E - D), cima (Hips->Spine2 ortogonalizado), frente (esquerda x cima)
            L = (wp("LeftUpLeg") - wp("RightUpLeg")).normalized()
            U0 = (wp("Spine2") - wp("Hips")).normalized()
            U = (U0 - L * U0.dot(L)).normalized()
            BODY[f] = (L, U, L.cross(U))
        except Exception:
            BODY[f] = None
        try:
            Lc = (P[f]["LeftArm"] - P[f]["RightArm"]).normalized()
            U0c = (P[f]["Head"] - P[f]["Spine2"]).normalized()
            Uc = (U0c - Lc * U0c.dot(Lc)).normalized()
            CHEST[f] = (Lc, Uc, Lc.cross(Uc))
        except Exception:
            CHEST[f] = None
    return P


AXIS_IDX = {"x": 0, "y": 1, "z": 2, "left": 0, "up": 1, "forward": 2}


def relpos(P, f, j, space="hips"):
    """posicao da junta relativa ao quadril: espaco 'hips' (eixos do mundo, origem no quadril) ou 'body' (esquerda/cima/frente do personagem)"""
    if space == "world":
        return P[f][j].copy()
    if space == "chest" and CHEST.get(f):
        # torso: origem em Spine2, eixos esquerda/cima/frente do TORSO (a pelve pode girar menos que os ombros)
        Lc, Uc, Fc = CHEST[f]
        dd = P[f][j] - P[f]["Spine2"]
        return Vector((dd.dot(Lc), dd.dot(Uc), dd.dot(Fc)))
    d = P[f][j] - P[f]["Hips"]
    if space == "body" and BODY.get(f):
        L, U, F = BODY[f]
        return Vector((d.dot(L), d.dot(U), d.dot(F)))
    return d


# ---------------------------------------------------------------- capacidades do rig (dedos, extras)
def rig_caps():
    caps = {"armature": arm.name, "bones": len(arm.pose.bones), "digits": {}}
    for side in ("Left", "Right"):
        chains = {}
        for b in arm.pose.bones:
            n = b.name.replace("mixamorig:", "")
            if n.startswith(side + "Hand") and n != side + "Hand":
                digit = n[len(side + "Hand"):].rstrip("0123456789")
                chains.setdefault(digit, []).append(n)
        caps["digits"][side] = {d: len(v) for d, v in chains.items()}
        caps["digits"][side + "_total_dedos"] = len(chains)
    caps["extras"] = [b.name.replace("mixamorig:", "") for b in arm.pose.bones if b.name.replace("mixamorig:", "").startswith(("Tail", "Crest"))]
    caps["shape_keys"] = {m.name: bool(m.data.shape_keys) for m in meshes}
    caps["constraints"] = sum(len(b.constraints) for b in arm.pose.bones)
    ft = min(caps["digits"]["Left_total_dedos"], caps["digits"]["Right_total_dedos"])
    caps["garra_aberta_representavel"] = ("apenas %d dedo(s) por mao: uma garra com mais dedos NAO e representavel neste rig" % ft) if ft < 4 else "ok (>=4 dedos)"
    return caps


# ---------------------------------------------------------------- interpenetracao por malha real
REGION_OF = {}


def region_of_group(name):
    n = name.replace("mixamorig:", "")
    if n.startswith(("Left", "Right")):
        side = "L" if n.startswith("Left") else "R"
        core = n[len(side == "L" and "Left" or "Right"):]
        if core.startswith(("Shoulder", "Arm", "ForeArm", "Hand")):
            return "arm_" + side
        if core.startswith(("UpLeg", "Leg", "Foot", "Toe")):
            return "leg_" + side
    return "body"


PARITY_DIRS = [Vector(d).normalized() for d in ((1.0, 0.13, 0.07), (-0.11, 1.0, 0.17), (0.09, -0.15, 1.0))]


def inside_by_parity(bvh, p):
    """ponto dentro da regiao? lanca 3 raios em direcoes distintas e conta cruzamentos da superficie: impar = dentro; voto 2 de 3
    (regioes abertas, como o tronco nos buracos dos ombros/pernas, dao paridade errada em alguns raios; o voto reduz isso, nao elimina)"""
    votes = 0
    for dv in PARITY_DIRS:
        o = p + dv * 1e-4
        n = 0
        while n < 24:
            hit = bvh.ray_cast(o, dv)
            if hit[0] is None:
                break
            n += 1
            o = hit[0] + dv * 1e-4
        votes += n % 2
    return votes >= 2


IP_META = {}


def interpenetration(frames, tol):
    FRAC = {}
    # TODAS as malhas ligadas ao rig, em coordenadas de MUNDO; malha cuja topologia avaliada difere da original (modificador que muda vertices) e ignorada e declarada
    IP_META.clear()
    regs = {}
    for mi, m in enumerate(meshes):
        vg = {g.index: g.name for g in m.vertex_groups}
        rr = {}
        for v in m.data.vertices:
            best = max(v.groups, key=lambda g: g.weight) if v.groups else None
            rr[v.index] = (region_of_group(vg[best.group]) if best else "body", best.weight if best else 0)
        regs[mi] = rr
    IP_META.update({"malhas_ligadas": [m.name for m in meshes], "malhas_ignoradas": {}, "malhas_analisadas": []})
    roots = {"arm_L": wp("LeftArm"), "arm_R": wp("RightArm"), "leg_L": wp("LeftUpLeg"), "leg_R": wp("RightUpLeg")}
    pairs = [("arm_L", "body"), ("arm_R", "body"), ("leg_L", "body"), ("leg_R", "body"), ("arm_L", "leg_L"), ("arm_R", "leg_R"), ("arm_L", "arm_R"), ("leg_L", "leg_R")]
    res = {}
    for f in frames:
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        co, reg, tris_by = [], {}, {}
        for mi, m in enumerate(meshes):
            ev = m.evaluated_get(dg)
            me = ev.to_mesh()
            if len(me.vertices) != len(m.data.vertices):
                IP_META["malhas_ignoradas"][m.name] = "topologia avaliada (%d vertices) difere da original (%d): indices de pesos nao valem" % (len(me.vertices), len(m.data.vertices))
                ev.to_mesh_clear()
                continue
            if m.name not in IP_META["malhas_analisadas"]:
                IP_META["malhas_analisadas"].append(m.name)
            me.calc_loop_triangles()
            off = len(co)
            mw = m.matrix_world
            co.extend(mw @ v.co for v in me.vertices)
            for i, rw in regs[mi].items():
                reg[off + i] = rw
            for t in me.loop_triangles:
                rs = {regs[mi][i][0] for i in t.vertices}
                if len(rs) == 1:
                    tris_by.setdefault(next(iter(rs)), []).append(tuple(off + i for i in t.vertices))
            ev.to_mesh_clear()
        if not co:
            continue
        bvh = {r: BVHTree.FromPolygons(co, tl) for r, tl in tris_by.items()}
        rts = {k: (W @ pb({"arm_L": "LeftArm", "arm_R": "RightArm", "leg_L": "LeftUpLeg", "leg_R": "RightUpLeg"}[k]).head) for k in roots}
        for a, b in pairs:
            if a not in bvh or b not in bvh:
                continue
            worst = 0.0
            n_in = n_all = 0
            for i, (r, w) in reg.items():
                if r != a or w < 0.85:
                    continue
                p = co[i]
                if (p - rts[a]).length < 0.25:
                    continue
                n_all += 1
                loc, nrm, idx, d = bvh[b].find_nearest(co[i], 0.45)
                if loc is not None and inside_by_parity(bvh[b], co[i]):
                    worst = max(worst, d)
                    n_in += 1
            if worst > 0:
                res.setdefault(a + "~" + b, []).append((f, worst))
                FRAC.setdefault(a + "~" + b, {})[f] = round(n_in / max(1, n_all), 4)
    out = {}
    for k, lst in res.items():
        bad = [(f, d) for f, d in lst if d > tol]
        out[k] = {"frames_acima_da_tolerancia": [AUTH(f) for f, _ in bad], "profundidade_max_m": round(max(d for _, d in lst), 4),
                  "no_frame_autoral": AUTH(max(lst, key=lambda x: x[1])[0]), "profundidade_por_frame_autoral": {str(AUTH(f)): round(d, 4) for f, d in lst},
                  "fracao_de_vertices_dentro_max": max(FRAC.get(k, {0: 0}).values()), "fracao_de_vertices_dentro_por_frame_autoral": {str(AUTH(f)): v for f, v in FRAC.get(k, {}).items()}}
    return out


# ---------------------------------------------------------------- regras
CONFIANCA = {"frame_count": "alta (contagem exata)", "joint_height": "alta (posicao de juntas)", "joint_rel": "alta (posicao de juntas)", "limb_extended": "alta (angulo entre juntas)",
             "scale_window": "alta (escala dos ossos)", "hand_digits": "alta (estrutura do rig)", "pose_matches_action": "alta (rotacoes dos ossos)",
             "foot_planted": "media (heuristica de altura/velocidade)", "foot_airborne": "media (altura do tornozelo)", "not_frozen": "media (limiar de movimento)",
             "loop_seam": "media", "no_interpenetration": "baixa (geometria aproximada; sempre HIPOTESE, nunca prova)", "leads_before": "media (onset por limiar)",
             "path_descends": "media", "crosses_value": "media (depende do eixo/espaco)", "lift_and_land": "media", "distance_to_action_decreases": "media",
             "motion_present": "media", "window_speed_ratio": "media", "visual_only": "nenhuma (exige humano/imagem)",
             "joint_compare": "alta (posicao relativa de juntas)", "chain_angle": "alta (angulo entre juntas)", "speed_peaks_max": "media (picos por limiar)",
             "no_last_frame_snap": "media", "no_root_motion": "alta (posicao do quadril)", "scale_clean": "alta (escala dos ossos)", "min_active_fraction": "media (limiar de movimento)",
             "fps": "alta", "mesh_above_floor": "alta (malha avaliada)", "foot_no_slide": "media (heuristica de fase dos pes)", "hand_open_proxy": "baixa (apenas polegar e indicador no rig)"}


def angle3(a, b, c):
    return math.degrees((a - b).angle(c - b))


def evaluate(rules, P):
    results = []
    first = {j: P[FR[0]][j] for j in KEYJ}
    for r in rules:
        t = r["type"]
        fr = [f + OFFSET for f in parse_frames(r["frames"])] if "frames" in r else FR
        fr = [f for f in fr if f in P]
        res = {"id": r["id"], "type": t, "status": "PASS", "detalhe": "", "frames_com_falha": [], "evidencia": {}}
        try:
            if t == "frame_count":
                res["status"] = "PASS" if len(FR) == r["expected"] else "FAIL"
                res["detalhe"] = "a action tem %d frames (esperado %d)" % (len(FR), r["expected"])
            elif t == "limb_extended":
                side = r["side"]
                angs = {}
                for f in fr:
                    sc.frame_set(f)
                    if r.get("kind", "arm") == "arm":
                        angs[f] = angle3(wp(side + "Arm"), wp(side + "ForeArm"), wp(side + "Hand"))
                    else:
                        angs[f] = angle3(wp(side + "UpLeg"), wp(side + "Leg"), wp(side + "Foot"))
                bad = [f for f in fr if angs[f] < r["min_angle"]]
                res["frames_com_falha"] = [AUTH(f) for f in bad]
                res["status"] = "PASS" if not bad else "FAIL"
                mn = min(angs, key=angs.get)
                res["detalhe"] = "menor angulo %.0f graus (180=esticado) no frame %d; exigido >= %s" % (angs[mn], AUTH(mn), r["min_angle"])
                res["evidencia"] = {"menor_angulo": round(angs[mn], 1), "frame": AUTH(mn)}
            elif t == "foot_planted":
                j = r["side"] + "Foot"
                bad = []
                for i, f in enumerate(fr):
                    a = P[f][j]
                    if a.z > r["max_height"]:
                        bad.append(f)
                    elif i > 0:
                        b = P[fr[i - 1]][j]
                        if math.hypot(a.x - b.x, a.y - b.y) > r.get("max_slide", 0.02):
                            bad.append(f)
                res["frames_com_falha"] = sorted({AUTH(f) for f in bad})
                res["status"] = "PASS" if not bad else "FAIL"
                res["detalhe"] = "tornozelo z<=%s e deslize<=%s m/frame nos frames pedidos" % (r["max_height"], r.get("max_slide", 0.02))
            elif t == "foot_airborne":
                j = r["side"] + "Foot"
                bad = [f for f in fr if P[f][j].z < r["min_height"]]
                res["frames_com_falha"] = [AUTH(f) for f in bad]
                res["status"] = "PASS" if not bad else "FAIL"
                res["detalhe"] = "tornozelo z>=%s" % r["min_height"]
            elif t == "joint_height":
                j = r["bone"]
                bad = [f for f in fr if (r.get("min_z") is not None and P[f][j].z < r["min_z"]) or (r.get("max_z") is not None and P[f][j].z > r["max_z"])]
                res["frames_com_falha"] = [AUTH(f) for f in bad]
                res["status"] = "PASS" if not bad else "FAIL"
                res["detalhe"] = "%s z entre %s e %s" % (j, r.get("min_z"), r.get("max_z"))
            elif t == "joint_rel":
                j, ax = r["bone"], AXIS_IDX[r["axis"]]
                bad = []
                vals = []
                for f in fr:
                    v = relpos(P, f, j, r.get("space", "hips"))[ax]
                    vals.append(v)
                    if (r.get("min") is not None and v < r["min"]) or (r.get("max") is not None and v > r["max"]):
                        bad.append(f)
                res["frames_com_falha"] = [AUTH(f) for f in bad]
                res["status"] = "PASS" if not bad else "FAIL"
                res["detalhe"] = "%s relativo ao quadril, eixo %s, entre %s e %s (visto: %.2f a %.2f)" % (j, r["axis"], r.get("min"), r.get("max"), min(vals), max(vals))
            elif t == "scale_window":
                inside = set(fr)
                tol = r.get("tol_fora", 0.03)
                ignore = {x + OFFSET for x in parse_frames(r["ignore_frames"])} if r.get("ignore_frames") else set()   # janelas de OUTROS efeitos nos mesmos ossos
                devin, outbad, inbad = {}, [], []
                for f in FR:
                    sc.frame_set(f)
                    d = max(abs(pb(b).scale[i] - 1.0) for b in r["bones"] for i in range(3))
                    if f in inside:
                        devin[f] = d
                    elif d > tol and f not in ignore:
                        outbad.append(f)
                ins_sorted = sorted(inside)
                exempt = set(ins_sorted[:r.get("edge_exempt", 0)] + ins_sorted[len(ins_sorted) - r.get("edge_exempt", 0):]) if r.get("edge_exempt") else set()
                inbad = [f for f in inside if f not in exempt and devin.get(f, 0) < r.get("min_dev", 0.05)]
                if r.get("return_tol") is not None and ins_sorted and devin.get(ins_sorted[-1], 0) > r["return_tol"]:
                    outbad.append(ins_sorted[-1])         # a deformacao precisa ter voltado ao normal DENTRO da propria janela
                res["frames_com_falha"] = sorted({AUTH(f) for f in outbad + inbad})
                if outbad or inbad:          # janela PARCIALMENTE sem efeito tambem reprova (antes so reprovava se todos os frames falhassem)
                    res["status"] = "FAIL"
                res["detalhe"] = "dentro da janela (%d frames): desvio de escala max %.2f; frames FORA da janela ainda deformados: %s; frames da janela sem efeito: %s" % (
                    len(inside), max(devin.values()) if devin else 0, [AUTH(f) for f in outbad][:12], [AUTH(f) for f in inbad][:12])
                res["evidencia"] = {"duracao_janela": len(inside), "desvio_max": round(max(devin.values()), 3) if devin else 0}
            elif t == "not_frozen":
                mn = r.get("min_motion", 0.004)
                frozen = []
                for i, f in enumerate(fr):
                    if i == 0:
                        continue
                    mv = sum((P[f][j] - P[fr[i - 1]][j]).length for j in KEYJ)
                    if mv < mn:
                        frozen.append(f)
                runs, cur = [], []
                for f in frozen:
                    if cur and f == cur[-1] + 1:
                        cur.append(f)
                    else:
                        if len(cur) >= r.get("min_run", 3):
                            runs.append(cur)
                        cur = [f]
                if len(cur) >= r.get("min_run", 3):
                    runs.append(cur)
                res["frames_com_falha"] = [AUTH(f) for run in runs for f in run]
                res["status"] = "PASS" if not runs else "FAIL"
                if runs:
                    ipf = vc.interp_profile(ACT, [f for run in runs for f in run])
                    const = float(np.mean([ipf["constante"][f] for run in runs for f in run]))
                    if const >= 0.9:
                        res["status"] = "INCONCLUSIVO"      # blocking em constante: hold costuma ser intencional
                        res["evidencia"] = {"frac_interpolacao_constante": round(const, 2)}
                res["detalhe"] = "trechos congelados (>=%d frames com movimento total < %s m): %s%s" % (r.get("min_run", 3), mn, [(AUTH(x[0]), AUTH(x[-1])) for x in runs], " [INCONCLUSIVO: interpolacao constante, hold possivelmente intencional]" if res["status"] == "INCONCLUSIVO" else "")
            elif t == "pose_matches_action":
                ref = bpy.data.actions.get(r["action"])
                if ref is None:
                    res["status"] = "INCONCLUSIVO"; res["detalhe"] = "action de referencia '%s' nao existe" % r["action"]
                else:
                    f_cur = fr[-1] if "frame" not in r else r["frame"] + OFFSET
                    set_action(r["action"])
                    f_ref = int(round(ref.frame_range[0])) + int(r.get("ref_frame", 0))
                    sc.frame_set(f_ref)
                    refq = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
                    set_action(cfg["action"])
                    sc.frame_set(f_cur)
                    worst = (-1.0, "nenhum")
                    for b in arm.pose.bones:
                        a = math.degrees(b.rotation_quaternion.rotation_difference(refq[b.name]).angle)
                        a = min(a, 360 - a)
                        if a > worst[0]:
                            worst = (a, b.name)
                    worst = (max(worst[0], 0.0), worst[1])
                    res["status"] = "PASS" if worst[0] <= r["max_deg"] else "FAIL"
                    res["detalhe"] = "maior diferenca angular %.1f graus em %s (limite %s) contra %s frame %d" % (worst[0], worst[1].replace("mixamorig:", ""), r["max_deg"], r["action"], r.get("ref_frame", 0))
                    res["evidencia"] = {"max_deg": round(worst[0], 1), "osso": worst[1]}
            elif t == "loop_seam":
                if BRIEF_MODE == "oneshot":
                    res["status"] = "INCONCLUSIVO"
                    res["detalhe"] = "briefing declara mode=oneshot: costura de loop nao se aplica (primeiro != ultimo frame e esperado)"
                else:
                    d = max((P[FR[0]][j] - P[FR[-1]][j]).length for j in KEYJ)
                    res["status"] = "PASS" if d <= r["max_dist"] else "FAIL"
                    res["detalhe"] = "maior distancia primeiro->ultimo frame %.3f m (limite %s)" % (d, r["max_dist"])
            elif t == "no_interpenetration":
                ip = interpenetration(fr, r.get("max_depth", 0.02))
                nao_analisavel = not IP_META.get("malhas_analisadas")
                # a deteccao por malha real tem falso positivo de base (~8-12 cm ate em idle de Mixamo): com
                # baseline_action, mede-se o EXCESSO sobre a mesma medida feita nessa action de referencia
                base = {}
                BA = r.get("baseline_action") or cfg.get("baseline_action")
                if BA:
                    cur_name = ACT.name
                    set_action(BA)
                    bfr = list(range(int(round(bpy.data.actions[BA].frame_range[0])), int(round(bpy.data.actions[BA].frame_range[1])) + 1))
                    bip = interpenetration(bfr, 9.0)
                    set_action(cur_name)
                    base = {k: v["profundidade_max_m"] for k, v in bip.items()}
                tol = r.get("max_depth", 0.02)
                bad_by = {}
                for k, v in ip.items():
                    b0 = base.get(k, 0.0)
                    v["baseline_m"] = b0
                    v["excesso_max_m"] = round(max(0.0, v["profundidade_max_m"] - b0), 4)
                    # frames: so os que passam de baseline + tolerancia NO PROPRIO FRAME (nao a lista bruta)
                    v["frames_acima_da_tolerancia"] = sorted(int(f) for f, d in v["profundidade_por_frame_autoral"].items() if d - b0 > tol)
                    if v["frames_acima_da_tolerancia"]:
                        bad_by[k] = v
                ENV = None
                if cfg.get("interp_envelope") and os.path.exists(cfg["interp_envelope"]):
                    ENV = json.load(open(cfg["interp_envelope"], encoding="utf-8-sig"))["pares"]
                if ENV:
                    # criterio PRINCIPAL: fracao de vertices do membro DENTRO da regiao vizinha (paridade de raios) acima do maximo visto em clips reais x 1.5.
                    # A profundidade sozinha nao separa (clips autorais chegam a 0.2-0.37 m neste rig); a fracao separa (0.8 vs <= 0.31).
                    bad_by = {}
                    for k, v in ip.items():
                        cat = k.replace("_L", "").replace("_R", "")
                        lim = ENV.get(cat, {}).get("limite_fracao", 0.5)
                        v["limite_fracao_do_corpus"] = lim
                        v["frames_acima_da_tolerancia"] = sorted(int(f) for f, fr_ in v["fracao_de_vertices_dentro_por_frame_autoral"].items() if fr_ > lim)
                        if v["frames_acima_da_tolerancia"]:
                            bad_by[k] = v
                    bad = sorted({f for v in bad_by.values() for f in v["frames_acima_da_tolerancia"]})
                    res["frames_com_falha"] = bad
                    res["status"] = "PASS" if not bad else "HIPOTESE"
                    res["detalhe"] = "fracao de vertices dentro da regiao vizinha acima do limite derivado do corpus: %s%s" % (
                        {k: (v["fracao_de_vertices_dentro_max"], v["limite_fracao_do_corpus"], v["no_frame_autoral"]) for k, v in bad_by.items()},
                        " [HIPOTESE: geometria aproximada, regioes abertas; conferir em imagem]" if bad else "")
                    res["evidencia"] = ip
                    raise_skip = True
                else:
                    raise_skip = False
                if not raise_skip:
                    bad = sorted({f for v in bad_by.values() for f in v["frames_acima_da_tolerancia"]})
                    res["frames_com_falha"] = bad
                    res["status"] = "PASS" if not bad else "HIPOTESE"      # nunca vira FAIL (prova = imagem/zoom)
                    aviso = "" if base else " [SEM envelope do corpus nem baseline_action: valor bruto, falso positivo esperado mesmo em clips autorais]"
                    res["detalhe"] = "pares acima de %s m%s: %s%s" % (tol, " de excesso sobre '%s'" % BA if base else "", {k: (v["profundidade_max_m"], v.get("excesso_max_m"), v["no_frame_autoral"]) for k, v in bad_by.items()}, aviso)
                    res["evidencia"] = ip
                res["malhas"] = dict(IP_META)
                if nao_analisavel:
                    res["status"] = "INCONCLUSIVO"
                    res["detalhe"] = "nenhuma malha analisavel (" + json.dumps(IP_META.get("malhas_ignoradas", {}), ensure_ascii=False) + "): sem prova geometrica"
                elif IP_META.get("malhas_ignoradas"):
                    res["detalhe"] += " [PARCIAL: malhas ignoradas: %s]" % list(IP_META["malhas_ignoradas"])
            elif t == "leads_before":
                # onset SUBFRAME: cruzamento (interpolado linearmente) do limiar frac x pico da propria junta na janela. Empate dentro de `tol_frames`
                # (padrao 0.25) nao e "antes": vira INCONCLUSIVO (em blocking constante duas partes mudam no mesmo frame de chave)
                def onset(j, sp_, stepped):
                    sps = [(f, (relpos(P, f, j, sp_) - relpos(P, f - 1, j, sp_)).length) for f in fr if (f - 1) in P]
                    pk = max((s for _, s in sps), default=0.0)
                    if pk <= 1e-6:
                        return None
                    thr = r.get("frac", 0.15) * pk
                    prev = 0.0
                    for f, s in sps:
                        if s >= thr:
                            if stepped:
                                return float(f)          # blocking em constante: a pose muda NO frame f; interpolar um subframe seria inventar precisao
                            return (f - 1) + (thr - prev) / max(s - prev, 1e-9) if prev < thr else float(f - 1)
                        prev = s
                    return None
                sp_ = r.get("space", "hips") if r.get("relative_to_hips", True) else "world"
                # blocking em constante e decidido NA JANELA da regra (uma action com so parte constante, ex.: retorno linear no fim, nao muda a leitura do inicio)
                STEPPED_W = float(np.mean(list(vc.interp_profile(ACT, fr)["constante"].values()))) >= 0.9 if fr else False
                oa, ob = onset(r["bone"], sp_, STEPPED_W), onset(r["other"], sp_, STEPPED_W)
                tolf = r.get("tol_frames", 0.25)
                if oa is None or ob is None:
                    res["status"] = "INCONCLUSIVO"; res["detalhe"] = "sem movimento medivel na janela (%s: %s, %s: %s)" % (r["bone"], oa, r["other"], ob)
                else:
                    diff = ob - oa
                    res["status"] = "INCONCLUSIVO" if abs(diff) < tolf else ("PASS" if diff > 0 else "FAIL")
                    res["detalhe"] = "inicio SUBFRAME do movimento (>= %.0f%% do proprio pico, espaco %s): %s g%.2f, %s g%.2f; %s %.2f frame(s) %s (tolerancia de empate %.2f)" % (
                        100 * r.get("frac", 0.15), sp_, r["bone"], oa - OFFSET, r["other"], ob - OFFSET, r["bone"], abs(diff), "antes" if diff > 0 else "depois" if diff < 0 else "junto", tolf)
                    res["evidencia"] = {"onset_" + r["bone"]: round(oa - OFFSET, 3), "onset_" + r["other"]: round(ob - OFFSET, 3), "diferenca_frames": round(diff, 3)}
            elif t == "path_descends":
                sp_ = r.get("space", "world")
                ax_ = AXIS_IDX[r.get("axis", "z" if sp_ == "world" else "up")]
                z = [relpos(P, f, r["bone"], sp_)[ax_] for f in fr]
                steps = [z[i + 1] - z[i] for i in range(len(z) - 1)]
                drop = z[0] - z[-1]
                frac = sum(1 for s in steps if s <= r.get("tol_up", 0.005)) / max(1, len(steps))
                res["status"] = "PASS" if (drop >= r["min_drop"] and frac >= r.get("min_frac", 0.7)) else "FAIL"
                res["detalhe"] = "%s: queda liquida %.2f m (min %s), %.0f%% dos passos sem subir (min %.0f%%)" % (r["bone"], drop, r["min_drop"], 100 * frac, 100 * r.get("min_frac", 0.7))
                res["evidencia"] = {"queda_m": round(drop, 3), "fracao_passos_descendo": round(frac, 2)}
            elif t == "crosses_value":
                ax = AXIS_IDX[r["axis"]]
                sp_ = r.get("space", "hips") if r.get("relative_to_hips", True) else "world"
                vals = [(relpos(P, f, r["bone"], sp_)[ax] if sp_ != "world" else P[f][r["bone"]][ax]) for f in fr]
                v0 = r.get("value", 0.0)
                # sinais ignorando zeros exatos: um frame exatamente em `value` entre lados opostos TAMBEM e cruzamento
                sg = [(i, 1 if x - v0 > 1e-9 else -1) for i, x in enumerate(vals) if abs(x - v0) > 1e-9]
                cross = [AUTH(fr[sg[k + 1][0]]) for k in range(len(sg) - 1) if sg[k][1] != sg[k + 1][1]]
                res["status"] = "PASS" if cross else "FAIL"
                res["detalhe"] = "%s (eixo %s, espaco %s) cruza %s na janela: %s (visto %.2f a %.2f)" % (r["bone"], r["axis"], sp_, v0, ("g" + ",g".join(map(str, cross))) if cross else "nao cruza", min(vals), max(vals))
                res["frames_com_falha"] = [] if cross else [AUTH(f) for f in fr]
            elif t == "lift_and_land":
                z = [P[f][r["bone"]].z for f in fr]
                rise = max(z) - z[0]
                back = z[-1] - z[0]
                res["status"] = "PASS" if (rise >= r["min_rise"] and abs(back) <= r.get("land_tol", 0.05)) else "FAIL"
                res["detalhe"] = "%s sobe %.2f m (min %s) e termina %.2f m do nivel inicial (tol %s)" % (r["bone"], rise, r["min_rise"], back, r.get("land_tol", 0.05))
                res["evidencia"] = {"subida_m": round(rise, 3), "frame_do_topo": AUTH(fr[int(np.argmax(z))]), "diferenca_final_m": round(back, 3)}
            elif t == "distance_to_action_decreases":
                ref = bpy.data.actions.get(r["action"])
                if ref is None:
                    res["status"] = "INCONCLUSIVO"; res["detalhe"] = "action de referencia '%s' nao existe" % r["action"]
                else:
                    set_action(r["action"])
                    sc.frame_set(int(round(ref.frame_range[0])) + int(r.get("ref_frame", 0)))
                    refp = {j: (wp(j) - wp("Hips")) for j in KEYJ if j != "Hips"}
                    set_action(cfg["action"])
                    ds = [float(np.mean([(P[f][j] - P[f]["Hips"] - refp[j]).length for j in refp])) for f in fr]
                    dec = sum(1 for i in range(len(ds) - 1) if ds[i + 1] <= ds[i] + 1e-4) / max(1, len(ds) - 1)
                    res["status"] = "PASS" if (ds[-1] < ds[0] and dec >= r.get("min_frac", 0.7)) else "FAIL"
                    queda_total = ds[0] - ds[-1]
                    if res["status"] == "PASS" and len(ds) > 2 and queda_total > 1e-6 and (ds[-2] - ds[-1]) > 0.5 * queda_total:
                        res["status"] = "INCONCLUSIVO"      # PASS trivial: a distancia so desaparece no ultimo passo (snap/copia da pose de saida), nao ha curva de aproximacao
                        res["evidencia"] = {"snap_no_ultimo_frame": True}
                    res["detalhe"] = "distancia media das juntas (alinhadas ao quadril) para '%s': %.3f -> %.3f m; %.0f%% dos passos sem aumentar (min %.0f%%)" % (r["action"], ds[0], ds[-1], 100 * dec, 100 * r.get("min_frac", 0.7))
                    res["evidencia"] = {"inicio_m": round(ds[0], 3), "fim_m": round(ds[-1], 3)}
            elif t == "motion_present":
                rel_ = r.get("relative_to_hips", True)       # deslocamento do corpo inteiro nao conta como movimento das partes
                mv = [sum(((relpos(P, f, j) - relpos(P, f - 1, j)) if rel_ else (P[f][j] - P[f - 1][j])).length for j in KEYJ if (j != "Hips" or not rel_)) for f in fr if (f - 1) in P]
                mean = float(np.mean(mv)) if mv else 0.0
                res["status"] = "PASS" if mean >= r["min_mean"] else "FAIL"
                res["detalhe"] = "movimento total medio %.4f m/frame na janela (min %s)" % (mean, r["min_mean"])
            elif t == "window_speed_ratio":
                # a junta atinge pelo menos `min_ratio` do pico de velocidade do ataque DENTRO da janela (pico do ataque ignora frames excluidos, ex.: snap de saida).
                # Nao escolhe frame de contato: so mede se a janela declarada tem movimento relevante.
                excl = {x + OFFSET for x in parse_frames(r["exclude_frames"])} if r.get("exclude_frames") else set()
                allf = [f for f in FR if (f - 1) in P and f not in excl]
                rel_ = r.get("relative_to_hips", True)
                sp = {f: ((relpos(P, f, r["bone"]) - relpos(P, f - 1, r["bone"])) if rel_ else (P[f][r["bone"]] - P[f - 1][r["bone"]])).length for f in allf}
                pk_all = max(sp.values()) if sp else 0.0
                win = [f for f in fr if f in sp]
                pk_win = max((sp[f] for f in win), default=0.0)
                ratio = pk_win / pk_all if pk_all > 1e-9 else 0.0
                res["status"] = "PASS" if ratio >= r["min_ratio"] else "FAIL"
                res["detalhe"] = "velocidade maxima de %s na janela g%d-g%d = %.0f%% do pico do ataque (g%d, fora de %s); minimo %.0f%%. NAO escolhe frame de contato." % (
                    r["bone"], AUTH(min(win)) if win else -1, AUTH(max(win)) if win else -1, 100 * ratio, AUTH(max(sp, key=sp.get)) if sp else -1, sorted(AUTH(x) for x in excl), 100 * r["min_ratio"])
                res["evidencia"] = {"razao_janela_sobre_pico": round(ratio, 3)}
            elif t == "joint_compare":
                # relacao espacial entre duas juntas: valor = pos(a)[eixo] - pos(b)[eixo] no espaco dado (world absoluto | hips | body)
                ax = AXIS_IDX[r["axis"]]
                sp_ = r.get("space", "body")
                vals = [(relpos(P, f, r["a"], sp_)[ax] - relpos(P, f, r["b"], sp_)[ax]) for f in fr]
                bad = [f for f, v in zip(fr, vals) if (r.get("min") is not None and v < r["min"]) or (r.get("max") is not None and v > r["max"])]
                res["frames_com_falha"] = [AUTH(f) for f in bad]
                res["status"] = "PASS" if not bad else "FAIL"
                res["detalhe"] = "%s - %s no eixo %s (%s): visto %.2f a %.2f; exigido entre %s e %s" % (r["a"], r["b"], r["axis"], sp_, min(vals), max(vals), r.get("min"), r.get("max"))
                res["evidencia"] = {"min": round(min(vals), 3), "max": round(max(vals), 3)}
            elif t == "chain_angle":
                bad, angs = [], {}
                for f in fr:
                    angs[f] = angle3(P[f][r["a"]], P[f][r["b"]], P[f][r["c"]])
                    if (r.get("max_angle") is not None and angs[f] > r["max_angle"]) or (r.get("min_angle") is not None and angs[f] < r["min_angle"]):
                        bad.append(f)
                res["frames_com_falha"] = [AUTH(f) for f in bad]
                res["status"] = "PASS" if not bad else "FAIL"
                res["detalhe"] = "angulo %s-%s-%s de %.0f a %.0f graus; exigido entre %s e %s" % (r["a"], r["b"], r["c"], min(angs.values()), max(angs.values()), r.get("min_angle"), r.get("max_angle"))
                res["evidencia"] = {"min": round(min(angs.values()), 1), "max": round(max(angs.values()), 1)}
            elif t == "speed_peaks_max":
                # numero de picos locais (>= frac do maior) da velocidade da junta na janela: golpe CONTINUO = no maximo 1 pico
                sps = [(relpos(P, f, r["bone"], r.get("space", "hips")) - relpos(P, f - 1, r["bone"], r.get("space", "hips"))).length for f in fr if (f - 1) in P]
                pk = max(sps) if sps else 0.0
                peaks = [i for i in range(len(sps)) if sps[i] >= r.get("frac", 0.3) * pk and (i == 0 or sps[i] >= sps[i - 1]) and (i == len(sps) - 1 or sps[i] > sps[i + 1])]
                res["status"] = "PASS" if len(peaks) <= r.get("max_peaks", 1) else "FAIL"
                res["detalhe"] = "%s: %d pico(s) de velocidade (>= %.0f%% do maior) na janela; maximo %s" % (r["bone"], len(peaks), 100 * r.get("frac", 0.3), r.get("max_peaks", 1))
                res["evidencia"] = {"frames_dos_picos": [AUTH([f for f in fr if (f - 1) in P][i]) for i in peaks]}
            elif t == "no_last_frame_snap":
                # a mudanca de pose do ultimo passo nao pode ser muito maior que a mediana dos passos anteriores (transicao abrupta/snap)
                allf = FR
                def step(f):
                    return sum((relpos(P, f, j) - relpos(P, f - 1, j)).length for j in KEYJ if j != "Hips")
                last = allf[-1]
                prev = [step(f) for f in allf[-1 - r.get("n_prev", 6):-1] if (f - 1) in P]
                med = float(np.median(prev)) if prev else 0.0
                lastv = step(last)
                lim = max(r.get("factor", 3.0) * med, r.get("floor", 0.05))
                res["status"] = "PASS" if lastv <= lim else "FAIL"
                res["detalhe"] = "mudanca de pose no ultimo passo %.3f m (mediana dos %d anteriores %.3f; limite %.3f)" % (lastv, len(prev), med, lim)
                res["frames_com_falha"] = [] if lastv <= lim else [AUTH(last)]
                res["evidencia"] = {"ultimo_passo_m": round(lastv, 4), "mediana_anteriores_m": round(med, 4)}
            elif t == "no_root_motion":
                # deslocamento horizontal de uma junta que deve ficar no lugar (padrao: Hips; para o corpo em pose de ataque use o PE DE APOIO nos frames de apoio,
                # pois o quadril se desloca legitimamente ao inclinar/avancar o tronco sem que o personagem se desloque no mundo)
                bn = r.get("bone", "Hips")
                frs = fr if "frames" in r else FR
                h0 = P[frs[0]][bn]
                dist = [math.hypot(P[f][bn].x - h0.x, P[f][bn].y - h0.y) for f in frs]
                res["status"] = "PASS" if max(dist) <= r.get("max_xy", 0.08) else "FAIL"
                res["detalhe"] = "deslocamento horizontal maximo de %s %.3f m (limite %s; P3: nenhum root motion inventado)" % (bn, max(dist), r.get("max_xy", 0.08))
                res["frames_com_falha"] = [AUTH(f) for f, d_ in zip(frs, dist) if d_ > r.get("max_xy", 0.08)]
            elif t == "scale_clean":
                # nenhum osso fora de `except_bones` pode ter escala diferente de 1 em frame nenhum (e os `except_bones` so fora das janelas ja checadas pelo scale_window)
                exc = set(r.get("except_bones", []))
                bad = []
                for f in FR:
                    sc.frame_set(f)
                    for b_ in arm.pose.bones:
                        nm = b_.name.replace("mixamorig:", "")
                        if nm in exc:
                            continue
                        if max(abs(b_.scale[i] - 1.0) for i in range(3)) > r.get("tol", 0.02):
                            bad.append((AUTH(f), nm))
                res["status"] = "PASS" if not bad else "FAIL"
                res["detalhe"] = "ossos com escala != 1 fora das excecoes: %s" % (sorted({n for _, n in bad})[:10] if bad else "nenhum")
                res["frames_com_falha"] = sorted({f for f, _ in bad})
            elif t == "min_active_fraction":
                eps = r.get("eps", 0.002)
                mv = [sum((relpos(P, f, j) - relpos(P, f - 1, j)).length for j in KEYJ if j != "Hips") for f in fr if (f - 1) in P]
                act = sum(1 for x in mv if x >= eps) / max(1, len(mv))
                res["status"] = "PASS" if act >= r.get("min_frac", 0.8) else "FAIL"
                res["detalhe"] = "%.0f%% dos frames da janela tem movimento relativo >= %s m (minimo %.0f%%): pose %s congelada" % (100 * act, eps, 100 * r.get("min_frac", 0.8), "NAO" if res["status"] == "PASS" else "esta")
                res["frames_com_falha"] = [AUTH(f) for f, x in zip([f for f in fr if (f - 1) in P], mv) if x < eps] if res["status"] == "FAIL" else []
            elif t == "fps":
                res["status"] = "PASS" if sc.render.fps == r["expected"] and sc.render.fps_base == 1.0 else "FAIL"
                res["detalhe"] = "fps %s / base %s (esperado %s)" % (sc.render.fps, sc.render.fps_base, r["expected"])
            elif t == "hand_open_proxy":
                # PROXY: so ha polegar e indicador. Aberta = indicador estendido (angulo em Index2) e polegar afastado do indicador. Nao prova garra.
                s = r["side"]
                need = [s + "HandIndex1", s + "HandIndex2", s + "HandIndex3", s + "HandThumb1", s + "HandThumb2", s + "HandThumb3", s + "HandIndex3_tip", s + "HandThumb3_tip"]
                if not all(n in P[FR[0]] for n in need):
                    res["status"] = "INCONCLUSIVO"; res["detalhe"] = "ossos de dedos ausentes"
                else:
                    bad, vals = [], []
                    for f in fr:
                        idx_ang = angle3(P[f][s + "HandIndex1"], P[f][s + "HandIndex2"], P[f][s + "HandIndex3"])
                        vi = P[f][s + "HandIndex3_tip"] - P[f][s + "HandIndex1"]
                        vt = P[f][s + "HandThumb3_tip"] - P[f][s + "HandThumb1"]
                        spread = math.degrees(vi.angle(vt))
                        vals.append((idx_ang, spread))
                        if idx_ang < r.get("min_index_angle", 150) or spread < r.get("min_spread", 25):
                            bad.append(f)
                    res["frames_com_falha"] = [AUTH(f) for f in bad]
                    res["status"] = "PASS" if not bad else "FAIL"
                    res["detalhe"] = "PROXY (so polegar+indicador): indicador estendido %.0f-%.0f graus (min %s), abertura polegar-indicador %.0f-%.0f graus (min %s). Nao prova 'garra'." % (
                        min(v[0] for v in vals), max(v[0] for v in vals), r.get("min_index_angle", 150), min(v[1] for v in vals), max(v[1] for v in vals), r.get("min_spread", 25))
                    res["evidencia"] = {"indicador_graus": [round(v[0]) for v in vals], "abertura_graus": [round(v[1]) for v in vals]}
            elif t == "foot_no_slide":
                # fase dos pes (vision_common.foot_phase): nenhum frame da janela em estado 'deslizando' (apoiado em movimento). Pe no ar nao conta.
                bad = []
                det = {}
                for side in ("Left", "Right"):
                    q = vc.foot_phase({f: tuple(P[f][side + "Foot"]) for f in FR}, {f: tuple(P[f]["Hips"]) for f in FR}, FR)
                    sl = [f for f in q["frames_deslizando"] if f in set(fr)]
                    det[side] = [AUTH(f) for f in sl]
                    bad += sl
                res["frames_com_falha"] = sorted({AUTH(f) for f in bad})
                res["status"] = "PASS" if not bad else "FAIL"
                res["detalhe"] = "frames com pe deslizando na janela: E %s, D %s (heuristica de fase; passo no ar nao conta)" % (det["Left"], det["Right"])
            elif t == "mesh_above_floor":
                # nenhum vertice da malha avaliada abaixo de min_z (chao = z 0; os frames F1-F4 aprovados pelo diretor ja chegam a -0.042 nos dedos do pe)
                lim = r.get("min_z", -0.05)
                worst, bad = {}, []
                for f in fr:
                    sc.frame_set(f)
                    dg = bpy.context.evaluated_depsgraph_get()
                    low = (1e9, "?")
                    for m_ in meshes:
                        ev_ = m_.evaluated_get(dg)
                        me_ = ev_.to_mesh()
                        if len(me_.vertices) == len(m_.data.vertices):
                            names_ = {g_.index: g_.name.replace("mixamorig:", "") for g_ in m_.vertex_groups}
                            mw_ = ev_.matrix_world
                            for v_ in me_.vertices:
                                z_ = (mw_ @ v_.co).z
                                if z_ < low[0]:
                                    gs = m_.data.vertices[v_.index].groups
                                    low = (z_, names_.get(max(gs, key=lambda x: x.weight).group, "?") if gs else "?")
                        ev_.to_mesh_clear()
                    worst[f] = low
                    if low[0] < lim:
                        bad.append(f)
                res["frames_com_falha"] = [AUTH(f) for f in bad]
                res["status"] = "PASS" if not bad else "FAIL"
                wf = min(worst, key=lambda k: worst[k][0])
                res["detalhe"] = "ponto mais baixo da malha: %.3f m em g%d (%s); limite %.2f m; %d frame(s) abaixo" % (worst[wf][0], AUTH(wf), worst[wf][1], lim, len(bad))
                res["evidencia"] = {"menor_z": round(worst[wf][0], 3), "frame": AUTH(wf), "regiao": worst[wf][1], "por_frame": {str(AUTH(f)): [round(v_[0], 3), v_[1]] for f, v_ in worst.items() if v_[0] < lim}}
            elif t == "hand_digits":
                caps = RIG
                n = caps["digits"][r["side"] + "_total_dedos"]
                res["status"] = "PASS" if n >= r["min_digits"] else "FAIL"
                res["detalhe"] = "o rig tem %d dedo(s) em %sHand (pedido >= %d). A FORMA aberta/fechada precisa ser conferida em imagem (zoom da mao)." % (n, r["side"], r["min_digits"])
            elif t == "visual_only":
                res["status"] = "INCONCLUSIVO"
                res["detalhe"] = r.get("note", "exige julgamento visual ou humano")
            else:
                res["status"] = "INCONCLUSIVO"; res["detalhe"] = "tipo de regra desconhecido: %s" % t
        except Exception as e:
            res["status"] = "INCONCLUSIVO"
            res["detalhe"] = "erro ao avaliar: %s" % e
        res["confianca"] = CONFIANCA.get(t, "media")
        results.append(res)
    return results


def metrics(P):
    m = {"frames": len(FR), "fps": sc.render.fps, "por_junta": {}, "posicoes_alinhadas_quadril": {}}
    for j in KEYJ:
        sp = [(P[FR[i]][j] - P[FR[i - 1]][j]).length for i in range(1, len(FR))]
        k = int(np.argmax(sp)) if sp else 0
        m["por_junta"][j] = {"vel_pico_m_frame": round(max(sp), 4) if sp else 0, "frame_autoral_do_pico": AUTH(FR[k + 1]) if sp else None, "vel_media": round(float(np.mean(sp)), 4) if sp else 0}
    for f in FR:
        m["posicoes_alinhadas_quadril"][str(AUTH(f))] = {j: [round(x, 4) for x in (P[f][j] - P[f]["Hips"])] for j in KEYJ}
    m["posicoes_mundo_quadril"] = {str(AUTH(f)): [round(x, 4) for x in P[f]["Hips"]] for f in FR}
    for side in ("Left", "Right"):
        j = side + "Foot"
        zs = [P[f][j].z for f in FR]
        lo = min(zs)
        slide = 0.0
        for i in range(1, len(FR)):
            if zs[i] < lo + 0.05 and zs[i - 1] < lo + 0.05:
                slide = max(slide, math.hypot(P[FR[i]][j].x - P[FR[i - 1]][j].x, P[FR[i]][j].y - P[FR[i - 1]][j].y))
        m["deslizamento_max_" + side] = round(slide, 4)
    mv = [sum((P[FR[i]][j] - P[FR[i - 1]][j]).length for j in KEYJ) for i in range(1, len(FR))]
    try:
        fp = {}
        for side in ("Left", "Right"):
            q = vc.foot_phase({f: tuple(P[f][side + "Foot"]) for f in FR}, {f: tuple(P[f]["Hips"]) for f in FR}, FR)
            fp[side] = {k: q[k] for k in ("modo", "limiar_deslize_m_frame", "deslize_max_m_frame", "criterio")}
            fp[side]["frames_deslizando_autorais"] = [AUTH(f) for f in q["frames_deslizando"]]
        m["apoio_por_fase"] = fp
    except Exception as e:
        m["apoio_por_fase"] = {"erro": str(e)}
    m["movimento_total_por_frame"] = [round(x, 4) for x in mv]
    m["frames_quase_parados"] = sum(1 for x in mv if x < 0.004)
    return m


# ================================================================== CHECK
if MODE == "check":
    RIG = rig_caps()
    P = collect()
    STEPPED = float(np.mean(list(vc.interp_profile(ACT, FR)["constante"].values()))) >= 0.9
    brief = json.load(open(cfg["brief"], encoding="utf-8-sig")) if cfg.get("brief") else {"rules": []}
    BRIEF_MODE = str(brief.get("mode") or cfg.get("brief_mode") or "").lower()
    results = evaluate(brief.get("rules", []), P)
    met = metrics(P)
    n = {"PASS": 0, "FAIL": 0, "INCONCLUSIVO": 0}
    for r in results:
        n[r["status"]] = n.get(r["status"], 0) + 1
    report = {"action": ACT.name, "armature": arm.name, "offset": OFFSET, "brief": brief.get("name"), "resumo": n, "regras": results, "rig": RIG, "metricas": met}
    if cfg.get("interpenetration_always") and not any(r["type"] == "no_interpenetration" for r in brief.get("rules", [])):
        ip = interpenetration(FR, 0.02)
        report["interpenetracao"] = ip
    json.dump(report, open(os.path.join(OUT, "check_report.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("VISION_OK", len(results), "regras")

# ================================================================== FOOTLOCK
elif MODE == "footlock":
    P = collect()
    side_keys = {"Left": ("LeftUpLeg", "LeftLeg", "LeftFoot"), "Right": ("RightUpLeg", "RightLeg", "RightFoot")}
    zmin = {s: min(P[f][s + "Foot"].z for f in FR) for s in side_keys}

    def planted_runs(side):
        j = side + "Foot"
        flags = []
        for i, f in enumerate(FR):
            low = P[f][j].z < zmin[side] + 0.05
            slow = i == 0 or math.hypot(P[f][j].x - P[FR[i - 1]][j].x, P[f][j].y - P[FR[i - 1]][j].y) < 0.02
            flags.append(low and slow)
        runs, cur = [], []
        for f, ok in zip(FR, flags):
            if ok:
                cur.append(f)
            else:
                if len(cur) >= 3:
                    runs.append((cur[0], cur[-1]))
                cur = []
        if len(cur) >= 3:
            runs.append((cur[0], cur[-1]))
        return runs
    runs = {s: planted_runs(s) for s in side_keys}
    if cfg.get("ranges"):
        runs = {s: [(a + OFFSET, b + OFFSET) for a, b in cfg["ranges"].get(s, [])] for s in side_keys}

    def ik_apply(up, kn, an, target, pole_dir):
        U, K, A = pb(up), pb(kn), pb(an)

        def swing(root, end, nv):
            cur = end.head - root.head
            q = cur.rotation_difference(nv)
            M = root.matrix.copy()
            root.matrix = Matrix.Translation(M.translation) @ (q.to_matrix() @ M.to_3x3().to_quaternion().to_matrix()).to_4x4()
            bpy.context.view_layer.update()
        l1 = (K.head - U.head).length
        l2 = (A.head - K.head).length
        v = target - U.head
        d = max(1e-4, min(v.length, (l1 + l2) * 0.999))
        dn = v.normalized()
        a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
        h = math.sqrt(max(0.0, l1 * l1 - a * a))
        p = pole_dir - dn * pole_dir.dot(dn)
        p = p.normalized() if p.length > 1e-6 else Vector((0, 1, 0))
        swing(U, K, dn * a + p * h)
        swing(K, A, (U.head + dn * d) - K.head)

    corrected = {}
    before = {}
    for side, (up, kn, an) in side_keys.items():
        for (a, b) in runs[side]:
            xs = [P[f][side + "Foot"] for f in range(a, b + 1)]
            ax_, ay_ = sum(p.x for p in xs) / len(xs), sum(p.y for p in xs) / len(xs)
            for f in range(a, b + 1):
                sc.frame_set(f)
                bpy.context.view_layer.update()
                an_w = wp(side + "Foot")
                orig_q = {n: pb(n).rotation_quaternion.copy() for n in (up, kn, an)}
                foot_rot = pb(an).matrix.to_3x3().copy()
                knee_dir = (pb(kn).head - (pb(up).head + pb(an).head) * 0.5)
                tgt = INV @ Vector((ax_, ay_, an_w.z))
                ik_apply(up, kn, an, tgt, knee_dir if knee_dir.length > 1e-5 else Vector((0, -1, 0)))
                pb(an).matrix = Matrix.Translation(pb(an).matrix.translation) @ foot_rot.to_4x4()
                bpy.context.view_layer.update()
                w = min(1.0, (f - a + 1) / 3.0, (b - f + 1) / 3.0)
                w = w * w * (3 - 2 * w)
                for n in (up, kn, an):
                    q = pb(n).rotation_quaternion.copy()
                    if orig_q[n].dot(q) < 0:
                        q = Quaternion((-q.w, -q.x, -q.y, -q.z))
                    corrected.setdefault(f, {})[n] = orig_q[n].slerp(q, w)
    # reavalia: cria action nova com as chaves corrigidas
    set_action(cfg["action"])
    new = ACT.copy()
    new.name = cfg["new_action"]
    new.use_fake_user = True
    arm.animation_data.action = new
    try:
        arm.animation_data.action_slot = new.slots[0]
    except Exception:
        pass
    for f, d in corrected.items():
        for n, q in d.items():
            pbn = pb(n)
            pbn.rotation_mode = 'QUATERNION'
            pbn.rotation_quaternion = q
            pbn.keyframe_insert("rotation_quaternion", frame=f)
    for l in new.layers:
        for s in l.strips:
            for cbk in s.channelbags:
                for fc in cbk.fcurves:
                    fc.update()

    def slide_report():
        rep = {}
        for side in side_keys:
            Pn = {}
            for f in FR:
                sc.frame_set(f)
                Pn[f] = wp(side + "Foot").copy()
            worst = 0.0
            for (a, b) in runs[side]:
                for f in range(a + 1, b + 1):
                    worst = max(worst, math.hypot(Pn[f].x - Pn[f - 1].x, Pn[f].y - Pn[f - 1].y))
            rep[side] = round(worst, 4)
        return rep
    after = slide_report()
    set_action(cfg["action"])
    before = slide_report()
    res = {"action_original": cfg["action"], "action_nova": cfg["new_action"], "trechos_travados_frames_autorais": {s: [(AUTH(a), AUTH(b)) for a, b in v] for s, v in runs.items()},
           "deslizamento_max_antes_m_por_frame": before, "deslizamento_max_depois_m_por_frame": after, "frames_corrigidos": len(corrected)}
    json.dump(res, open(os.path.join(OUT, "footlock_report.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    arm.animation_data.action = new
    bpy.ops.wm.save_as_mainfile(filepath=cfg["save_as"], copy=True)       # SOMENTE copia nova; o .blend de origem nao e tocado
    print("VISION_OK footlock")
