"""Compreensao temporal (sem bpy): fases candidatas, sequenciamento do corpo, antecipacao, snap x rapido, arco, apoio e deformacao.

Entrada: a trilha de poses de `perception_inside.py` (op `pose`): juntas e quaternions em MUNDO por frame, escala de pose, comprimento de osso,
centroide da malha e altura minima por regiao. Tudo e MEDIDA com limiar declarado e sensibilidade informada; nenhuma saida diz que o
movimento "esta bom". Os limiares padrao sao PROPOSTOS (calibrados so no conjunto de DESENVOLVIMENTO dos testes, ver tests/) e podem ser
trocados por argumento. Nunca escolhe o frame de contato: sem alvo geometrico autorizado, `contact_frame` e sempre None.
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np

DEFAULTS = {
    "onset_alphas": (0.10, 0.20, 0.30),   # fracao do proprio pico para considerar que o segmento "comecou"
    "onset_floor_m": 0.01,                # deslocamento minimo (m) / rotacao minima (graus) para existir movimento
    "onset_floor_deg": 4.0,
    "simultaneous_lag_frames": 1,
    "antic_min_ratio": 0.12,              # recuo / curso do golpe
    "antic_min_frames": 2,
    "snap_isolated_ratio": 3.0,           # passo >= 3x o maior vizinho
    "snap_hold_frac": 0.15,               # vizinhos "parados" = passo <= 15% do passo do impulso
    "turn_abrupt_deg": 60.0,
    "turn_min_speed_frac": 0.30,
    "ground_contact_m": 0.010,
    "ground_air_m": 0.030,
    "stretch_ratio": 0.05,
    "scale_dev": 0.02,
}


def _a(x) -> np.ndarray:
    return np.asarray(x, dtype=np.float64)


def quat_angle_deg(q1: np.ndarray, q2: np.ndarray) -> np.ndarray:
    d = np.abs(np.sum(q1 * q2, axis=-1)).clip(0.0, 1.0)
    return np.degrees(2.0 * np.arccos(d))


def quat_conj(q: np.ndarray) -> np.ndarray:
    return q * np.array([1.0, -1.0, -1.0, -1.0])


def quat_mul(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    w1, x1, y1, z1 = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    w2, x2, y2, z2 = b[..., 0], b[..., 1], b[..., 2], b[..., 3]
    return np.stack([w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2, w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
                     w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2, w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2], axis=-1)


def rel_quat(parent: np.ndarray, child: np.ndarray) -> np.ndarray:
    """rotacao do filho no referencial do pai (q_pai^-1 * q_filho)"""
    return quat_mul(quat_conj(parent), child)


def step_len(p: np.ndarray) -> np.ndarray:
    """comprimento do passo entre frames consecutivos; indice i = |p[i]-p[i-1]|, p[0]=0"""
    d = np.zeros(len(p))
    d[1:] = np.linalg.norm(np.diff(p, axis=0), axis=1)
    return d


def _side(side: str) -> str:
    if side not in ("Left", "Right"):
        raise ValueError("lado deve ser Left ou Right")
    return side


def _frame_of(frames, i):
    return int(frames[i])


# ------------------------------------------------------------------ sequenciamento do corpo
def segment_signals(pose: dict[str, Any], side: str = "Right") -> dict[str, np.ndarray]:
    """escalar de 'quanto ja se moveu desde o primeiro frame' por segmento (unidade: m ou graus)"""
    s = _side(side)
    J = {k: _a(v) for k, v in pose["joints"].items()}
    Q = {k: _a(v) for k, v in pose["quat"].items()}
    need = ["Hips", "Spine2", s + "Arm", s + "ForeArm", s + "Hand"]
    miss = [n for n in need if n not in J or n not in Q]
    if miss:
        raise KeyError("ossos ausentes na trilha de poses: %s" % miss)
    sig = {}
    sig["quadril_deslocamento_m"] = np.linalg.norm(J["Hips"] - J["Hips"][0], axis=1)
    sig["quadril_rotacao_graus"] = quat_angle_deg(Q["Hips"], Q["Hips"][:1])
    tq = rel_quat(Q["Hips"], Q["Spine2"])
    sig["tronco_rot_rel_quadril_graus"] = quat_angle_deg(tq, tq[:1])
    aq = rel_quat(Q["Spine2"], Q[s + "Arm"])
    sig["braco_rot_rel_tronco_graus"] = quat_angle_deg(aq, aq[:1])
    fq = rel_quat(Q[s + "Arm"], Q[s + "ForeArm"])
    sig["antebraco_rot_rel_braco_graus"] = quat_angle_deg(fq, fq[:1])
    hp = J[s + "Hand"] - J["Hips"]
    sig["mao_pos_rel_quadril_m"] = np.linalg.norm(hp - hp[:1], axis=1)
    return sig


def _onset(sig: np.ndarray, alpha: float, floor: float) -> int | None:
    peak = float(sig.max())
    if peak < floor:
        return None
    thr = max(alpha * peak, floor)
    return int(np.argmax(sig >= thr))


def body_sequence(pose: dict[str, Any], side: str = "Right", window: tuple[int, int] | None = None, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    """Quem comeca a se mover primeiro? Ordem dos segmentos com sensibilidade ao limiar alfa; `robusta` = mesma ordem em todos os alfas."""
    c = {**DEFAULTS, **(cfg or {})}
    frames = list(pose["frames"])
    lo, hi = 0, len(frames) - 1
    if window:
        lo = max(0, next(i for i, f in enumerate(frames) if f >= window[0]))
        hi = max(i for i, f in enumerate(frames) if f <= window[1])
    # re-ancora cada sinal no inicio da janela
    sig = {k: np.abs(v[lo:hi + 1] - v[lo]) for k, v in segment_signals(pose, side).items()}
    per_alpha = {}
    for al in c["onset_alphas"]:
        row = {}
        for k, v in sig.items():
            fl = c["onset_floor_m"] if k.endswith("_m") else c["onset_floor_deg"]
            o = _onset(v, al, fl)
            row[k] = None if o is None else _frame_of(frames, lo + o)
        per_alpha[str(al)] = row
    def order(row):
        return [k for k, _ in sorted(((k, f) for k, f in row.items() if f is not None), key=lambda kv: (kv[1], kv[0]))]
    orders = [order(r) for r in per_alpha.values()]
    mid = per_alpha[str(c["onset_alphas"][len(c["onset_alphas"]) // 2])]
    valid = {k: f for k, f in mid.items() if f is not None}
    lag = (max(valid.values()) - min(valid.values())) if valid else 0
    hand = valid.get("mao_pos_rel_quadril_m")
    trunk = [valid[k] for k in ("tronco_rot_rel_quadril_graus", "quadril_rotacao_graus") if k in valid]
    rel = None
    if hand is not None and trunk:
        t0 = min(trunk)
        rel = "mao_antes_do_tronco" if hand + c["simultaneous_lag_frames"] < t0 else "tronco_antes_da_mao" if t0 + c["simultaneous_lag_frames"] < hand else "simultaneo"
    return {"side": side, "window": [frames[lo], frames[hi]], "onset_by_alpha": per_alpha, "ordem": order(mid),
            "ordem_robusta_entre_alfas": all(o == orders[0] for o in orders), "ordens": orders, "defasagem_total_frames": int(lag),
            "mao_vs_tronco": rel, "sem_movimento": sorted(k for k, f in mid.items() if f is None),
            "nota": "MEDIDA: 'comecou' = atingir fracao alfa do proprio pico na janela; em chaves esparsas o frame de inicio e o da chave (empates frequentes). A leitura de coordenacao exige as imagens."}


# ------------------------------------------------------------------ golpe: eixo, antecipacao, fases
def effector_path(pose: dict[str, Any], bone: str, rel_to: str | None = "Hips") -> np.ndarray:
    J = {k: _a(v) for k, v in pose["joints"].items()}
    if bone not in J:
        raise KeyError("osso '%s' ausente" % bone)
    p = J[bone]
    return p - J[rel_to] if rel_to else p


def stroke_info(path: np.ndarray, frames) -> dict[str, Any]:
    d = step_len(path)
    ip = int(np.argmax(d))
    a = max(0, ip - 2)
    b = min(len(path) - 1, ip + 1)
    axis = path[b] - path[a]
    n = np.linalg.norm(axis)
    axis = axis / n if n > 1e-9 else np.array([0.0, 0.0, 0.0])
    return {"peak_index": ip, "peak_frame": _frame_of(frames, ip), "axis": [round(float(x), 5) for x in axis], "peak_step_m": round(float(d[ip]), 5)}


def anticipation(path: np.ndarray, frames, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    """Recuo antes do golpe: quanto o efetuador anda CONTRA o eixo do golpe antes do pico, em relacao ao curso do golpe."""
    c = {**DEFAULTS, **(cfg or {})}
    st = stroke_info(path, frames)
    ax = np.array(st["axis"])
    if not ax.any():
        return {"presente": None, "motivo": "efetuador sem movimento mensuravel", **st}
    proj = (path - path[0]) @ ax
    ip = st["peak_index"]
    pre = proj[: ip + 1]
    low_i = int(np.argmin(pre))
    back = float(-pre[low_i]) if pre[low_i] < 0 else 0.0
    post = proj[ip:]
    top = float(post.max())
    stroke_len = top - float(pre[low_i])
    ratio = back / stroke_len if stroke_len > 1e-9 else 0.0
    # frames em que o efetuador esta recuando (projecao decrescente) ate o minimo
    back_frames = int(np.sum(np.diff(pre[: low_i + 1]) < -1e-4)) if low_i > 0 else 0
    pres = ratio >= c["antic_min_ratio"] and back_frames >= c["antic_min_frames"]
    return {"presente": bool(pres), "recuo_m": round(back, 4), "curso_m": round(stroke_len, 4), "razao_recuo_curso": round(ratio, 3), "frames_de_recuo": back_frames,
            "frame_do_recuo_maximo": _frame_of(frames, low_i), "limiares": {"razao": c["antic_min_ratio"], "frames": c["antic_min_frames"]}, **st,
            "nota": "medida geometrica no eixo do golpe; 'antecipacao legivel' ainda exige olhar a pose (silhueta, corpo todo)"}


def snap_events(path: np.ndarray, frames, cfg: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Distingue 'salto isolado' (parado -> grande passo -> parado, sem rampa) de 'rapido com rampa' (aceleracao distribuida)."""
    c = {**DEFAULTS, **(cfg or {})}
    d = step_len(path)
    peak = float(d.max())
    if peak < 1e-6:
        return []
    out = []
    for i in range(1, len(d) - 1):
        if d[i] < 0.35 * peak:
            continue
        prev_n, next_n = d[i - 1], d[i + 1]
        prev2 = d[i - 2] if i >= 2 else 0.0
        next2 = d[i + 2] if i + 2 < len(d) else 0.0
        iso = d[i] >= c["snap_isolated_ratio"] * max(prev_n, next_n, 1e-9) and max(prev_n, next_n, prev2, next2) <= c["snap_hold_frac"] * d[i] * 2.0
        ramp = prev_n >= 0.25 * d[i] and next_n >= 0.25 * d[i]
        out.append({"frame": _frame_of(frames, i), "passo_m": round(float(d[i]), 4), "anterior_m": round(float(prev_n), 4), "seguinte_m": round(float(next_n), 4),
                    "classe": "salto_isolado" if iso else "rapido_com_rampa" if ramp else "rapido_rampa_parcial"})
    return out


def arc_continuity(path: np.ndarray, frames, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    """Angulo de virada entre passos sucessivos (so onde ha velocidade): arco continuo = virada pequena e distribuida; quina = virada brusca em alta velocidade."""
    c = {**DEFAULTS, **(cfg or {})}
    v = np.diff(path, axis=0)
    sp = np.linalg.norm(v, axis=1)
    peak = float(sp.max()) if len(sp) else 0.0
    turns = []
    for i in range(1, len(v)):
        if sp[i] < 1e-6 or sp[i - 1] < 1e-6:
            continue
        cosang = float(np.dot(v[i - 1], v[i]) / (sp[i] * sp[i - 1]))
        ang = math.degrees(math.acos(max(-1.0, min(1.0, cosang))))
        turns.append((i, ang, min(sp[i], sp[i - 1]) / peak if peak else 0.0))
    sharp = [{"frame": _frame_of(frames, i), "virada_graus": round(a, 1), "velocidade_rel": round(s, 2)} for i, a, s in turns if a >= c["turn_abrupt_deg"] and s >= c["turn_min_speed_frac"]]
    mx = max(turns, key=lambda t: t[1]) if turns else None
    return {"quinas_em_velocidade": sharp, "virada_max_graus": None if mx is None else round(mx[1], 1), "frame_da_virada_max": None if mx is None else _frame_of(frames, mx[0]),
            "classe": "mudanca_abrupta" if sharp else "arco_continuo", "limiar_graus": c["turn_abrupt_deg"],
            "nota": "mede a trajetoria do efetuador no espaco; um arco 'bonito' ou 'com intencao' ainda depende de ver a pose"}


def phase_hypotheses(path: np.ndarray, frames, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    """Fases CANDIDATAS a partir da velocidade do efetuador e do recuo. Sao hipoteses: nada aqui afirma contato nem 'impacto'."""
    ant = anticipation(path, frames, cfg)
    d = step_len(path)
    peak = float(d.max())
    n = len(d)
    if peak < 1e-6:
        return {"fases": [], "contact_frame": None, "nota": "sem movimento"}
    ip = ant["peak_index"]
    active = np.where(d >= 0.10 * peak)[0]
    a0, a1 = int(active.min()), int(active.max())
    ph = []

    def add(name, i0, i1, basis):
        if i1 >= i0:
            ph.append({"fase": name, "frames": [_frame_of(frames, i0), _frame_of(frames, i1)], "base": basis, "status": "HIPOTESE"})

    if a0 > 0:
        add("repouso_inicial", 0, a0 - 1, "velocidade < 10% do pico")
    if ant["presente"]:
        lo = ant["frame_do_recuo_maximo"]
        li = int(np.argmax(np.array(list(frames)) == lo))
        add("antecipacao_candidata", a0, li, "efetuador recua contra o eixo do golpe (razao %.2f)" % ant["razao_recuo_curso"])
        add("aceleracao_candidata", li + 1, ip - 1, "do recuo maximo ate o pico de velocidade")
    else:
        add("aceleracao_candidata", a0, ip - 1, "sem recuo mensuravel; do inicio ao pico de velocidade")
    add("pico_de_movimento", max(ip - 1, 0), min(ip + 1, n - 1), "pico de velocidade do efetuador: NAO e frame de contato")
    below = [i for i in range(ip + 1, n) if d[i] < 0.5 * peak]
    dec_end = below[0] if below else n - 1
    add("desaceleracao_candidata", ip + 2, dec_end, "queda ate < 50% do pico")
    add("recuperacao_candidata", dec_end + 1, a1, "velocidade residual ate < 10% do pico")
    if a1 < n - 1:
        add("repouso_final", a1 + 1, n - 1, "velocidade < 10% do pico")
    return {"fases": ph, "contact_frame": None, "motivo_contato": "sem alvo geometrico autorizado: o frame de contato nao e escolhido pelo pico de velocidade",
            "pico": {"frame": ant["peak_frame"], "passo_m": ant["peak_step_m"]}}


# ------------------------------------------------------------------ apoio, massa, deformacao
def foot_ground(pose: dict[str, Any], side: str, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    """Altura da malha do pe sobre o chao (floor_z), por frame, e classe com tolerancias declaradas."""
    c = {**DEFAULTS, **(cfg or {})}
    lab = "foot_L" if side == "Left" else "foot_R"
    z = [v for v in pose["label_min_z"][lab]]
    fl = float(pose.get("floor_z", 0.0))
    rows = []
    for f, v in zip(pose["frames"], z):
        if v is None:
            rows.append({"frame": int(f), "folga_m": None, "classe": "sem_geometria"})
            continue
        h = v - fl
        cl = "apoiado" if h <= c["ground_contact_m"] else "suspenso" if h > c["ground_air_m"] else "proximo_ambiguo"
        rows.append({"frame": int(f), "folga_m": round(h, 4), "classe": cl})
    return {"side": side, "rows": rows, "tolerancias_m": {"contato": c["ground_contact_m"], "suspenso": c["ground_air_m"]},
            "nota": "altura do vertice mais baixo do pe sobre o plano z=%.3f: toque real exige o chao verdadeiro do jogo; 'proximo_ambiguo' nao e decidido" % fl}


def support_vs_mass(pose: dict[str, Any], cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    """Distancia horizontal (m) do centroide da malha ao ponto medio dos pes apoiados; proxy, nao massa real."""
    c = {**DEFAULTS, **(cfg or {})}
    com = _a(pose["mesh_centroid"])
    fl = float(pose.get("floor_z", 0.0))
    J = {k: _a(v) for k, v in pose["joints"].items()}
    out = []
    for i, f in enumerate(pose["frames"]):
        sup = []
        for side, lab in (("Left", "foot_L"), ("Right", "foot_R")):
            z = pose["label_min_z"][lab][i]
            if z is not None and z - fl <= c["ground_air_m"] and (side + "Foot") in J:
                sup.append(J[side + "Foot"][i][:2])
        if sup:
            m = np.mean(sup, axis=0)
            out.append({"frame": int(f), "pes_apoiados": len(sup), "dist_horizontal_m": round(float(np.linalg.norm(com[i][:2] - m)), 4)})
        else:
            out.append({"frame": int(f), "pes_apoiados": 0, "dist_horizontal_m": None})
    return {"rows": out, "nota": "centroide dos vertices (proxy); sem pe apoiado nao ha base de apoio para comparar (ex.: salto/voo)"}


def ground_penetration(pose: dict[str, Any], cfg: dict[str, Any] | None = None, tol_m: float = 0.01) -> dict[str, Any]:
    """Quanto a malha de cada rotulo entra ABAIXO do plano do chao (floor_z) por frame. Fato geometrico dado o plano assumido; o plano
    deve vir de --floor-z ou --floor-from-action (pe em repouso). Tolerancia de `tol_m` (1 cm): a sola encostando no chao nao conta."""
    fl = float(pose.get("floor_z", 0.0))
    frames = list(pose["frames"])
    out = {}
    for lab, zs in pose["label_min_z"].items():
        rows = [(int(f), round(fl - z, 4)) for f, z in zip(frames, zs) if z is not None and fl - z > tol_m]
        if not rows:
            continue
        mx = max(rows, key=lambda r: r[1])
        out[lab] = {"frames": [r[0] for r in rows], "prof_max_m": mx[1], "frame_prof_max": mx[0], "ignora_pes_ate_m": tol_m}
    return {"plano_z": fl, "por_rotulo": out, "nota": "plano do chao assumido (z=%.4f); se o chao do jogo for outro (altura visual/apoio), os numeros mudam" % fl}


def deformation_report(pose: dict[str, Any], declared: list[dict[str, Any]] | None = None, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    """Escala de pose e esticamento de osso (comprimento mundo vs frame 0). `declared` = janelas intencionais documentadas
    [{bones:[..], frames:[a,b], kind}]. Mudanca fora delas = inesperada; dentro = documentada (nao julga se esta bonita)."""
    c = {**DEFAULTS, **(cfg or {})}
    frames = list(pose["frames"])
    declared = declared or []

    def is_decl(b, f):
        return any((not d.get("bones") or b in d["bones"]) and d["frames"][0] <= f <= d["frames"][1] for d in declared)

    events = []
    for b, rows in pose["pose_scale"].items():
        a = _a(rows)
        dev = np.abs(a - 1.0).max(axis=1)
        for i in np.where(dev > c["scale_dev"])[0]:
            f = frames[int(i)]
            events.append({"bone": b, "frame": int(f), "tipo": "escala_de_pose", "desvio": round(float(dev[i]), 3), "classe": "documentada" if is_decl(b, f) else "inesperada"})
    for b, rows in pose["bone_length"].items():
        a = _a(rows)
        if a[0] < 1e-9:
            continue
        r = np.abs(a / a[0] - 1.0)
        for i in np.where(r > c["stretch_ratio"])[0]:
            f = frames[int(i)]
            events.append({"bone": b, "frame": int(f), "tipo": "comprimento_do_osso", "desvio": round(float(r[i]), 3), "classe": "documentada" if is_decl(b, f) else "inesperada"})
    unexpected = [e for e in events if e["classe"] == "inesperada"]
    return {"eventos": events, "inesperados": len(unexpected), "documentados": len(events) - len(unexpected),
            "nota": "so compara com janelas declaradas; sem declaracao, toda mudanca e 'inesperada' por construcao (nao e defeito provado)."}


def suggest_frames(phases: dict[str, Any], frames: list[int], limit: int = 14) -> list[int]:
    """frames para ler com imagem: limites de fase, pico +-1, inicio/fim; completa com espacamento uniforme ate `limit`"""
    pick = {frames[0], frames[-1]}
    for ph in phases.get("fases", []):
        pick.update(ph["frames"])
    pk = (phases.get("pico") or {}).get("frame")
    if pk is not None:
        pick.update({pk - 1, pk, pk + 1})
    pick = {f for f in pick if frames[0] <= f <= frames[-1]}
    k = 1
    while len(pick) < limit and k < len(frames):
        step = max(1, len(frames) // (limit - len(pick) + 1))
        pick.update(frames[::step][:limit])
        break
    out = sorted(pick)
    while len(out) > limit:  # poda os mais proximos entre si, preservando extremos e pico
        gaps = sorted(range(1, len(out) - 1), key=lambda i: out[i + 1] - out[i - 1])
        for i in gaps:
            if out[i] != pk:
                del out[i]
                break
        else:
            break
    return out


def analyze(pose: dict[str, Any], stroke_bone: str | None = None, side: str = "Right", declared: list[dict[str, Any]] | None = None,
            window: tuple[int, int] | None = None, cfg: dict[str, Any] | None = None, stroke_frame: str = "hips") -> dict[str, Any]:
    frames = list(pose["frames"])
    if stroke_bone is None:
        best = None
        for s in ("Left", "Right"):
            try:
                p = effector_path(pose, s + "Hand")
            except KeyError:
                continue
            L = float(step_len(p).sum())
            if best is None or L > best[1]:
                best = (s, L)
        if best is None:
            raise KeyError("sem maos no rig; informe stroke_bone")
        side, stroke_bone = best[0], best[0] + "Hand"
    rel = None if (stroke_bone == "Hips" or stroke_frame == "world") else "Hips"
    path = effector_path(pose, stroke_bone, rel)
    res = {"efetuador": stroke_bone, "referencial_do_efetuador": "mundo" if rel is None else "quadril", "lado": side, "frames": [frames[0], frames[-1]],
           "sequencia_do_corpo": body_sequence(pose, side, window, cfg),
           "antecipacao": anticipation(path, frames, cfg), "snap": snap_events(path, frames, cfg), "arco": arc_continuity(path, frames, cfg),
           "fases": phase_hypotheses(path, frames, cfg), "pe_E": foot_ground(pose, "Left", cfg), "pe_D": foot_ground(pose, "Right", cfg),
           "apoio_x_massa": support_vs_mass(pose, cfg), "deformacao": deformation_report(pose, declared, cfg), "chao": ground_penetration(pose, cfg)}
    res["frames_sugeridos_para_imagem"] = suggest_frames(res["fases"], frames)
    return res
