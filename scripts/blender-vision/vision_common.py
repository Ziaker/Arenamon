"""Auxiliares puros (rodam dentro do Blender, mas sem depender de cena): interpolacao e fase dos pes.

Tudo aqui e HEURISTICA medida, nunca julgamento artistico. Cada resultado traz o criterio usado.
"""
import math
import numpy as np


def iter_fcurves(action):
    """fcurves da action (API de camadas do Blender 5.x; cai para action.fcurves em versoes antigas)"""
    try:
        for layer in action.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    for fc in cb.fcurves:
                        yield fc
        return
    except AttributeError:
        pass
    for fc in action.fcurves:
        yield fc


def interp_profile(action, frames):
    """por frame: fracao de canais cujo segmento ativo e CONSTANTE e fracao de canais com chave exatamente nesse frame"""
    curves = []
    for fc in iter_fcurves(action):
        kp = fc.keyframe_points
        if len(kp) == 0:
            continue
        xs = np.array([k.co[0] for k in kp], dtype=np.float64)
        const = np.array([k.interpolation == "CONSTANT" for k in kp])
        curves.append((xs, const))
    n = max(1, len(curves))
    const_frac, key_frac = {}, {}
    for f in frames:
        c = k = 0
        for xs, const in curves:
            i = int(np.searchsorted(xs, f, side="right")) - 1
            if i >= 0 and const[i]:
                c += 1
            if np.any(np.abs(xs - f) < 1e-3):
                k += 1
        const_frac[f] = c / n
        key_frac[f] = k / n
    return {"constante": const_frac, "chaveado": key_frac, "canais": len(curves)}


def runs_of(flags, frames, min_len):
    runs, cur = [], []
    for f, x in zip(frames, flags):
        if x:
            cur.append(f)
        else:
            if len(cur) >= min_len:
                runs.append(cur)
            cur = []
    if len(cur) >= min_len:
        runs.append(cur)
    return runs


def foot_phase(foot, hips, frames):
    """foot/hips: {frame: (x,y,z)} em metros de mundo. Estados: 0 apoiado, 1 deslizando, 2 no ar.

    - baixo = altura a menos de 12% do comprimento maximo quadril->tornozelo acima do minimo do proprio pe;
    - modo 'deslocamento_real' (deslocamento liquido do quadril > 40% do comprimento da perna): apoiado exige velocidade de mundo ~0;
    - modo 'in_place' (esteira): apoiado exige velocidade ~CONSTANTE (a mediana dos frames baixos), pois o pe recua a velocidade fixa.
    Limite: fases de passada muito curtas ou pe que pisa em movimento lento podem ser classificadas como deslizando.
    """
    fr = list(frames)
    F = np.array([foot[f] for f in fr], dtype=np.float64)
    H = np.array([hips[f] for f in fr], dtype=np.float64)
    legl = float(np.max(np.linalg.norm(H - F, axis=1)))
    zmin = float(F[:, 2].min())
    low = F[:, 2] < zmin + 0.12 * legl
    vel = np.zeros((len(fr), 2))
    vel[1:] = F[1:, :2] - F[:-1, :2]
    hv = np.zeros((len(fr), 2))
    hv[1:] = H[1:, :2] - H[:-1, :2]
    travel = float(np.linalg.norm(H[-1, :2] - H[0, :2]))      # deslocamento LIQUIDO (balanco lateral/vertical do quadril nao conta)
    mode = "deslocamento_real" if travel > 0.4 * legl else "in_place"
    lowv = vel[low & (np.arange(len(fr)) > 0)]
    ref = np.median(lowv, axis=0) if (mode == "in_place" and len(lowv)) else np.zeros(2)
    dev = np.linalg.norm(vel - ref, axis=1)
    thr = max(0.006, 0.25 * float(np.linalg.norm(ref)))
    state = []
    for i in range(len(fr)):
        if not low[i]:
            state.append(2)
        elif i == 0:
            state.append(0 if (len(fr) < 2 or dev[1] < thr) else 1)     # sem frame anterior: usa o seguinte
        else:
            state.append(0 if dev[i] < thr else 1)
    # passagem rasante do pe em balanco (baixo e rapido por < 4 frames) nao e escorregao: conta como no ar
    i = 0
    while i < len(state):
        if state[i] == 1:
            j = i
            while j < len(state) and state[j] == 1:
                j += 1
            if j - i < 4:
                for k in range(i, j):
                    state[k] = 2
            i = j
        else:
            i += 1
    runs_s = []
    i = 0
    while i < len(state):
        if state[i] == 1:
            j = i
            while j < len(state) and state[j] == 1:
                j += 1
            seg = dev[i:j]
            mono = all(seg[k] >= seg[k + 1] - 1e-4 for k in range(len(seg) - 1))
            if j < len(state) and state[j] == 0 and mono and seg[0] > 1.5 * seg[-1]:
                tipo = "desaceleracao_ate_o_apoio (pouso/frenagem; nao e necessariamente escorregao)"
            elif float(seg.std()) < 0.25 * float(seg.mean()):
                tipo = "arrasto_de_velocidade_quase_constante (provavel escorregao)"
            else:
                tipo = "indefinido (conferir em imagem)"
            runs_s.append({"frames": [fr[i], fr[j - 1]], "tipo": tipo, "vel_media_m_frame": round(float(seg.mean()), 4)})
            i = j
        else:
            i += 1
    slide = [float(dev[i]) for i in range(1, len(fr)) if state[i] == 1]
    return {"modo": mode, "comprimento_perna_m": round(legl, 3), "altura_min_m": round(zmin, 3), "limiar_deslize_m_frame": round(thr, 4),
            "velocidade_esteira_m_frame": [round(float(x), 4) for x in ref], "quadril_percurso_m": round(travel, 3),
            "estado_por_frame": {str(f): s for f, s in zip(fr, state)},
            "frames_apoiado": [f for f, s in zip(fr, state) if s == 0], "frames_deslizando": [f for f, s in zip(fr, state) if s == 1],
            "frames_no_ar": [f for f, s in zip(fr, state) if s == 2],
            "trechos_deslizando": runs_s, "deslize_max_m_frame": round(max(slide), 4) if slide else 0.0,
            "criterio": "heuristica de fase (altura relativa + velocidade vs. modo); nao e prova de escorregao"}


def timing_profile(path_per_frame):
    """medidas de ritmo a partir do percurso por frame (m): instantes (0-1) em que 10/50/90% do percurso total ja ocorreu etc."""
    p = np.asarray(path_per_frame, dtype=np.float64)
    n = len(p)
    tot = float(p.sum())
    if n < 3 or tot <= 1e-9:
        return {"frames": n, "percurso_total_m": round(tot, 4), "aviso": "sem movimento medivel"}
    cum = np.cumsum(p) / tot
    t = lambda q: float((int(np.searchsorted(cum, q)) + 1) / n)
    pk = int(np.argmax(p))
    still = float((p < max(0.02 * p.max(), 0.002)).mean())
    xs = np.linspace(0, 1, 21)
    curve = np.interp(xs, (np.arange(n) + 1) / n, cum)
    return {"frames": n, "percurso_total_m": round(tot, 4), "t10": round(t(0.10), 3), "t50": round(t(0.50), 3), "t90": round(t(0.90), 3),
            "pico_norm": round((pk + 1) / n, 3), "pico_sobre_media": round(float(p.max() / p.mean()), 2), "fracao_parada": round(still, 3),
            "curva_acumulada_21": [round(float(x), 4) for x in curve]}


def compare_profiles(cur, ref):
    if "curva_acumulada_21" not in cur or "curva_acumulada_21" not in ref:
        return {"aviso": "perfil sem movimento medivel"}
    a, b = np.array(cur["curva_acumulada_21"]), np.array(ref["curva_acumulada_21"])
    out = {"rmse_curva_acumulada": round(float(np.sqrt(((a - b) ** 2).mean())), 4),
           "diferenca_duracao_frames": cur["frames"] - ref["frames"]}
    for k in ("t10", "t50", "t90", "pico_norm", "pico_sobre_media", "fracao_parada"):
        out["delta_" + k] = round(cur[k] - ref[k], 3)
    return out


def eval_criteria(profile, criteria):
    """criteria: {medida: [min, max]} ou null; fornecido pelo diretor. A ferramenta so compara, nao inventa alvos."""
    rows = []
    for k, rng in criteria.items():
        if k.startswith("_") or rng is None:
            continue
        v = profile.get("frames") if k == "duracao_frames" else profile.get(k)
        if v is None:
            rows.append({"medida": k, "status": "INCONCLUSIVO", "valor": None})
            continue
        lo, hi = rng
        ok = (lo is None or v >= lo) and (hi is None or v <= hi)
        rows.append({"medida": k, "valor": v, "faixa": rng, "status": "DENTRO" if ok else "FORA"})
    return rows


def kinematics(p):
    """cinematica por diferencas centrais (np.gradient, edge_order=2) de uma trajetoria p (n,3), em unidades/frame.

    Devolve vetores REAIS (velocidade, aceleracao, jerk) e escalares derivados (modulos, curvatura k = |v x a| / |v|^3 em 1/unidade,
    mudanca de direcao em graus entre deslocamentos consecutivos). Validado contra casos analiticos em tests/test_kinematics.py."""
    p = np.asarray(p, dtype=np.float64)
    n = len(p)
    z3 = np.zeros((n, 3))
    if n < 4:
        return {"vel": z3, "acc": z3, "jerk": z3, "speed": np.zeros(n), "acc_mag": np.zeros(n), "jerk_mag": np.zeros(n), "curvature": np.zeros(n), "turn_deg": np.zeros(n)}
    v = np.gradient(p, axis=0, edge_order=2)
    a = np.gradient(v, axis=0, edge_order=2)
    j = np.gradient(a, axis=0, edge_order=2)
    sp = np.linalg.norm(v, axis=1)
    cr = np.linalg.norm(np.cross(v, a), axis=1)
    curv = np.where(sp > 1e-6, cr / np.maximum(sp, 1e-6) ** 3, 0.0)
    d = np.zeros((n, 3))
    d[1:] = p[1:] - p[:-1]
    turn = np.zeros(n)
    for i in range(2, n):
        na, nb = np.linalg.norm(d[i - 1]), np.linalg.norm(d[i])
        if na > 1e-6 and nb > 1e-6:
            turn[i] = math.degrees(math.atan2(float(np.linalg.norm(np.cross(d[i - 1], d[i]))), float(d[i - 1] @ d[i])))      # atan2: estavel perto de 0 graus
    return {"vel": v, "acc": a, "jerk": j, "speed": sp, "acc_mag": np.linalg.norm(a, axis=1), "jerk_mag": np.linalg.norm(j, axis=1), "curvature": curv, "turn_deg": turn}


def quat_angular_speed(q):
    """graus/frame entre quaternions consecutivos q (n,4) [w,x,y,z] (rotacao mais curta); 0 no primeiro frame"""
    q = np.asarray(q, dtype=np.float64)
    q = q / np.maximum(np.linalg.norm(q, axis=1, keepdims=True), 1e-12)
    out = np.zeros(len(q))
    for i in range(1, len(q)):
        out[i] = math.degrees(2.0 * math.acos(min(1.0, abs(float(q[i] @ q[i - 1])))))
    return out


def phase_candidates(total, frames_auth, window=None):
    """candidatos a antecipacao/impacto/recuperacao sobre o movimento total por frame (heuristica; NAO escolhe frame de contato).

    - salto de borda: ultimo (ou primeiro) frame com movimento > 3x a media dos 5 anteriores (ex.: snap para a pose de saida) e excluido da busca de pico;
    - com `window` (a, b) declarada pelo briefing: nada e inferido, so se mede o que ha antes, dentro e depois dela;
    - sem janela: o pico (fora das bordas) e so 'pico de movimento', explicitamente diferente de contato."""
    t = np.asarray(total, dtype=np.float64)
    n = len(t)
    fa = list(frames_auth)
    borda = []
    if n > 6 and t[-1] > 3.0 * max(float(t[-6:-1].mean()), 1e-4):
        borda.append(fa[-1])
    if n > 6 and t[0] > 3.0 * max(float(t[1:6].mean()), 1e-4):
        borda.append(fa[0])
    ok = np.array([f not in borda for f in fa])

    def stats(sel, nome):
        idx = [i for i in range(n) if sel(fa[i])]
        if not idx:
            return {"fase": nome, "frames_autorais": None}
        use = [i for i in idx if ok[i]]
        arr = t[use] if use else np.array([0.0])
        return {"fase": nome, "frames_autorais": [fa[idx[0]], fa[idx[-1]]], "movimento_medio_m_frame": round(float(arr.mean()), 4),
                "movimento_total_m": round(float(arr.sum()), 4), "pico_m_frame": round(float(arr.max()), 4),
                "frame_do_pico": fa[use[int(np.argmax(t[use]))]] if use else None}
    out = {"saltos_de_borda_excluidos": borda}
    if window:
        a, b = window
        out["impacto"] = dict(stats(lambda f: a <= f <= b, "impacto (janela declarada)"), selecionado_frame_de_contato=None,
                              nota="janela vem do briefing; a ferramenta nao escolhe o frame de contato")
        out["antecipacao"] = stats(lambda f: f < a, "antes da janela")
        out["recuperacao"] = stats(lambda f: f > b, "depois da janela")
    else:
        i = int(np.argmax(np.where(ok, t, -1.0)))
        out["impacto"] = {"fase": "pico de movimento (NAO e contato)", "frame_autoral": fa[i], "criterio": "maior movimento total fora dos saltos de borda; informe --impact-window para medir por janela"}
        out["antecipacao"] = stats(lambda f: f < fa[i], "antes do pico")
        out["recuperacao"] = stats(lambda f: f > fa[i], "depois do pico")
    out["aviso"] = "candidatos por limiar/janela; nao sao julgamento artistico"
    return out
