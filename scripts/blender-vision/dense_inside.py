"""Roda DENTRO do Blender: blender -b ARQUIVO --python dense_inside.py -- config.json

Analise temporal densa (TODOS os frames consecutivos) de uma action: trajetorias, velocidade, aceleracao, espacamento,
paradas classificadas por tipo de interpolacao, fase dos pes e perfil de ritmo. Opcionalmente compara com uma action de
referencia aprovada (cfg["ref_action"]) ou perfil salvo (cfg["ref_profile"]) e avalia criterios do diretor (cfg["criteria"]).

Somente leitura: nunca salva o .blend. Nao julga qualidade artistica; entrega medidas.
"""
import bpy
import json
import math
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vision_common as vc

cfg = json.load(open(sys.argv[sys.argv.index("--") + 1], encoding="utf-8"))
OUT = cfg["out"]
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
OFFSET = int(cfg.get("offset", 0))


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
W = arm.matrix_world


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


def pb(n):
    return arm.pose.bones.get(n) or arm.pose.bones.get("mixamorig:" + n)


JOINTS = [j for j in ["Hips", "Spine2", "Head", "LeftHand", "RightHand", "LeftForeArm", "RightForeArm", "LeftFoot", "RightFoot", "LeftLeg", "RightLeg"] if pb(j)]


LIGHT = bool(cfg.get("corpus"))


def analyse(name):
    act = set_action(name)
    frames = list(range(int(round(act.frame_range[0])), int(round(act.frame_range[1])) + 1))
    P = {j: np.zeros((len(frames), 3)) for j in JOINTS}
    for i, f in enumerate(frames):
        sc.frame_set(f)
        for j in JOINTS:
            p = W @ pb(j).head
            P[j][i] = (p.x, p.y, p.z)
    Hh = P["Hips"]
    n = len(frames)
    speed, accel, speed_hips = {}, {}, {}
    for j in JOINTS:
        v = np.zeros(n)
        v[1:] = np.linalg.norm(P[j][1:] - P[j][:-1], axis=1)
        a = np.zeros(n)
        a[1:] = v[1:] - v[:-1]
        al = P[j] - Hh
        vh = np.zeros(n)
        vh[1:] = np.linalg.norm(al[1:] - al[:-1], axis=1)
        speed[j], accel[j], speed_hips[j] = v, a, vh
    # cinematica (vision_common.kinematics: vetores reais por diferencas centrais), velocidade angular LOCAL e de MUNDO, espaco relativo ao quadril
    kin, angl, angw, rel = {}, {}, {}, {}
    for j in JOINTS:
        kin[j] = vc.kinematics(P[j])
        rel[j] = P[j] - Hh
        if LIGHT:
            angl[j] = angw[j] = np.zeros(n)
            continue
        ql, qw = [], []
        for f in frames:
            sc.frame_set(f)
            bj = pb(j)
            ql.append(tuple(bj.rotation_quaternion))
            qw.append(tuple((W @ bj.matrix).to_3x3().normalized().to_quaternion()))
        angl[j] = vc.quat_angular_speed(ql)
        angw[j] = vc.quat_angular_speed(qw)
    total = sum(speed[j] for j in JOINTS)
    total_hips = sum(speed_hips[j] for j in JOINTS if j != "Hips")
    ip = vc.interp_profile(act, frames)
    dense_baked = float(np.mean([ip["chaveado"][f] for f in frames])) > 0.9
    # paradas (movimento total do corpo abaixo de 2% do pico) classificadas pelo tipo de interpolacao
    eps = max(0.02 * float(total.max()), 0.002)
    holds = []
    for run in vc.runs_of([x < eps for x in total], frames, 2):
        i0, i1 = frames.index(run[0]), frames.index(run[-1])
        c = float(np.mean([ip["constante"][f] for f in run]))
        kstart = ip["chaveado"][run[0]] > 0.5 or run[0] == frames[0]
        kend = ip["chaveado"][min(run[-1] + 1, frames[-1])] > 0.5
        if c >= 0.9:
            tipo, nota = "hold_por_interpolacao_constante", "pose mantida por interpolacao constante (blocking): provavelmente intencional"
        elif dense_baked:
            tipo, nota = "parado_em_clip_bakeado", "clip com chave em todo frame: nao ha estrutura de chaves para distinguir hold de defeito; intencao desconhecida"
        elif kstart and kend:
            tipo, nota = "hold_chaveado", "chaves nas duas pontas com movimento ~0: hold provavelmente intencional"
        else:
            tipo, nota = "possivel_congelamento", "interpolada, sem chaves nas pontas, movimento ~0: pode ser defeito (conferir)"
        holds.append({"frames_autorais": [run[0] - OFFSET, run[-1] - OFFSET], "duracao": len(run), "tipo": tipo, "nota": nota, "frac_constante": round(c, 2)})
    # fase dos pes
    feet = {}
    for side in ("Left", "Right"):
        j = side + "Foot"
        if j in P and "Hips" in P:
            feet[side] = vc.foot_phase({f: P[j][i] for i, f in enumerate(frames)}, {f: Hh[i] for i, f in enumerate(frames)}, frames)
            for k in ("estado_por_frame",):
                feet[side][k] = {str(int(f) - OFFSET): s for f, s in feet[side][k].items()}
            for rr in feet[side]["trechos_deslizando"]:
                rr["frames"] = [x - OFFSET for x in rr["frames"]]
            for k in ("frames_apoiado", "frames_deslizando", "frames_no_ar"):
                feet[side][k] = [f - OFFSET for f in feet[side][k]]
    both_air = [f - OFFSET for i, f in enumerate(frames) if all(feet[s]["estado_por_frame"].get(str(f - OFFSET), 0) == 2 for s in feet)] if len(feet) == 2 else []
    prof_all = vc.timing_profile(total)
    prof_hands = vc.timing_profile(speed["LeftHand"] + speed["RightHand"]) if "LeftHand" in JOINTS and "RightHand" in JOINTS else {}
    prof_hips = vc.timing_profile(speed["Hips"])
    r4 = lambda arr: [round(float(x), 4) for x in arr]
    traj = {j: {"velocidade_m_frame": r4(speed[j]), "aceleracao_escalar_m_frame2": r4(accel[j]),
                "velocidade_vetorial_m_frame": [r4(row) for row in kin[j]["vel"]],
                "aceleracao_vetorial_m_frame2": [r4(row) for row in kin[j]["acc"]], "aceleracao_modulo_m_frame2": r4(kin[j]["acc_mag"]),
                "jerk_vetorial_m_frame3": [r4(row) for row in kin[j]["jerk"]], "jerk_modulo_m_frame3": r4(kin[j]["jerk_mag"]),
                "curvatura_1_por_m": r4(kin[j]["curvature"]), "mudanca_de_direcao_graus": [round(float(x), 1) for x in kin[j]["turn_deg"]],
                "velocidade_angular_local_graus_frame": [round(float(x), 2) for x in angl[j]],
                "velocidade_angular_mundo_graus_frame": [round(float(x), 2) for x in angw[j]],
                "posicao_relativa_ao_quadril": [r4(row) for row in rel[j]] if j != "Hips" else None,
                "velocidade_alinhada_quadril": r4(speed_hips[j]),
                "percurso_m": round(float(speed[j].sum()), 3), "pico_vel": round(float(speed[j].max()), 4), "frame_do_pico": int(frames[int(np.argmax(speed[j]))]) - OFFSET}
            for j in JOINTS}
    # saltos de espacamento: variacao de velocidade entre frames consecutivos relativa ao PICO da propria junta (razoes explodem quando o frame anterior esta parado)
    saltos = {}
    for j in ("LeftHand", "RightHand", "Hips", "Head"):
        if j in speed:
            v = speed[j]
            pk = float(v.max()) or 1.0
            saltos[j] = [(int(frames[i]) - OFFSET, round(float((v[i] - v[i - 1]) / pk), 2)) for i in range(1, n) if abs(v[i] - v[i - 1]) > 0.35 * pk][:12]
    # contribuicao por regiao (fracao do percurso total, alinhado ao quadril quando aplicavel)
    reg = {"braco_E": ("LeftForeArm", "LeftHand"), "braco_D": ("RightForeArm", "RightHand"), "perna_E": ("LeftLeg", "LeftFoot"), "perna_D": ("RightLeg", "RightFoot"), "tronco_cabeca": ("Spine2", "Head"), "quadril": ("Hips",)}
    path_total = sum(float(speed_hips[j].sum()) for j in JOINTS if j != "Hips") + float(speed["Hips"].sum()) or 1.0
    contrib = {}
    for k, js in reg.items():
        s = sum((float(speed["Hips"].sum()) if j == "Hips" else float(speed_hips[j].sum())) for j in js if j in JOINTS)
        contrib[k] = round(s / path_total, 3)
    win = None
    if cfg.get("impact_window"):
        w0, w1 = str(cfg["impact_window"]).split("-")
        win = (int(w0), int(w1))
    cand = vc.phase_candidates(total, [f - OFFSET for f in frames], win)
    return {"action": name, "offset": OFFSET, "frames_autorais": [frames[0] - OFFSET, frames[-1] - OFFSET], "interpolacao": {"canais": ip["canais"], "clip_bakeado_denso": dense_baked,
            "frac_constante_media": round(float(np.mean(list(ip["constante"].values()))), 3)},
            "movimento_total_por_frame": [round(float(x), 4) for x in total], "movimento_alinhado_quadril_por_frame": [round(float(x), 4) for x in total_hips],
            "paradas": holds, "contribuicao_por_regiao": contrib, "fases_candidatas": cand, "pes": feet, "frames_com_ambos_os_pes_no_ar": both_air,
            "perfil_ritmo": {"corpo": prof_all, "maos": prof_hands, "quadril": prof_hips},
            "trajetorias": traj, "saltos_de_espacamento_x4": saltos}


if cfg.get("corpus"):
    # modo corpus: resumo por action (ritmo, pes, paradas) para calibrar limiares/envelopes com clips reais; nada e salvo no .blend
    res = {}
    for nm in cfg["corpus"]:
        try:
            r_ = analyse(nm)
        except SystemExit:
            continue
        res[nm] = {"frames": len(r_["movimento_total_por_frame"]), "perfil_ritmo": r_["perfil_ritmo"], "paradas": [x["tipo"] for x in r_["paradas"]],
                   "pes": {s: {"modo": f["modo"], "apoiado": len(f["frames_apoiado"]), "deslizando": len(f["frames_deslizando"]), "no_ar": len(f["frames_no_ar"]),
                               "tipos_de_deslize": [t["tipo"].split(" ")[0] for t in f["trechos_deslizando"]]} for s, f in r_["pes"].items()},
                   "fases": r_["fases_candidatas"]}
    json.dump(res, open(os.path.join(OUT, "corpus_report.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("VISION_OK corpus", len(res), "actions")
    raise SystemExit(0)
rep = analyse(cfg["action"])
ref = None
if cfg.get("ref_action"):
    ref = analyse(cfg["ref_action"])["perfil_ritmo"]
    set_action(cfg["action"])
elif cfg.get("ref_profile"):
    ref = json.load(open(cfg["ref_profile"], encoding="utf-8-sig"))["perfil_ritmo"]
if ref:
    rep["comparacao_com_referencia"] = {k: vc.compare_profiles(rep["perfil_ritmo"][k], ref[k]) for k in ("corpo", "maos", "quadril") if ref.get(k) and rep["perfil_ritmo"].get(k)}
    rep["comparacao_com_referencia"]["aviso"] = "a referencia so vale se o diretor a aprovou; a ferramenta nao sabe se o ritmo dela e bom"
if cfg.get("criteria"):
    crit = json.load(open(cfg["criteria"], encoding="utf-8-sig"))
    rep["criterios_origem"] = os.path.basename(cfg["criteria"]) + (" (envelope EMPIRICO do corpus: mede o quao tipico e, nao se e bom)" if "corpus_envelope" in cfg["criteria"] else " (faixas fornecidas pelo diretor)")
    rep["criterios_do_diretor"] = {k: vc.eval_criteria(rep["perfil_ritmo"][k], crit.get(k, {})) for k in ("corpo", "maos", "quadril") if crit.get(k)}
rep["aviso"] = "medidas, nao julgamento artistico: pesado/rapido/agressivo so existem aqui como faixas fornecidas pelo diretor"
json.dump(rep, open(os.path.join(OUT, "dense_report.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("VISION_OK dense", rep["action"], len(rep["movimento_total_por_frame"]), "frames")
