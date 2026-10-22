"""Geometria pura (sem bpy) da percepcao ativa: regioes do corpo, cameras candidatas, suficiencia de evidencia e laco de investigacao.

Reaproveita `witness_utility.are_views_independent` (>= 35 graus). Nada aqui julga qualidade artistica: so decide se uma
regiao FOI OBSERVADA o bastante para que alguem possa afirmar algo sobre ela.
"""
from __future__ import annotations

import math
from typing import Any, Callable, Sequence

from witness_utility import MIN_INDEPENDENT_ANGLE_DEG, angle_between_vectors_deg

# Particao DISJUNTA do corpo (rig tipo Mixamo; nomes sem o prefixo "mixamorig:"). Serve tanto para o mapa de ids por pixel
# quanto para atribuir quem oculta quem.
LABEL_BONES: dict[str, tuple[str, ...]] = {
    "torso": ("Hips", "Spine", "Spine1", "Spine2"),
    "head": ("Neck", "Head", "HeadTop_End"),
    "arm_L": ("LeftShoulder", "LeftArm", "LeftForeArm"),
    "arm_R": ("RightShoulder", "RightArm", "RightForeArm"),
    "hand_L": ("LeftHand",),
    "hand_R": ("RightHand",),
    "leg_L": ("LeftUpLeg", "LeftLeg"),
    "leg_R": ("RightUpLeg", "RightLeg"),
    "foot_L": ("LeftFoot", "LeftToeBase", "LeftToe_End"),
    "foot_R": ("RightFoot", "RightToeBase", "RightToe_End"),
}
DIGIT_WORDS = ("Thumb", "Index", "Middle", "Ring", "Pinky")
LABELS = tuple(LABEL_BONES)

# Regioes de INVESTIGACAO (uma pergunta visual aponta para uma delas) -> rotulos da particao.
QUERY_REGIONS: dict[str, tuple[str, ...]] = {
    "tronco_quadril": ("torso",),
    "cabeca": ("head",),
    "ombros_bracos_D": ("arm_R", "hand_R"),
    "ombros_bracos_E": ("arm_L", "hand_L"),
    "mao_D": ("hand_R",),
    "mao_E": ("hand_L",),
    "pernas_D": ("leg_R", "foot_R"),
    "pernas_E": ("leg_L", "foot_L"),
    "pe_D": ("foot_R",),
    "pe_E": ("foot_L",),
    "corpo_todo": LABELS,
}


def label_of_bone(short_name: str) -> str | None:
    """Rotulo da particao para um osso (sem prefixo). Dedos pertencem a mao do lado."""
    n = short_name.replace("mixamorig:", "")
    side = "L" if n.startswith("Left") else "R" if n.startswith("Right") else None
    if side and any(w in n for w in DIGIT_WORDS):
        return "hand_" + side
    for lab, bones in LABEL_BONES.items():
        if n in bones:
            return lab
    return None


# ------------------------------------------------------------------ vetores
def _norm(v: Sequence[float]) -> list[float]:
    l = math.sqrt(sum(float(x) ** 2 for x in v))
    return [0.0, 0.0, 1.0] if l < 1e-9 else [float(x) / l for x in v]


def _cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def _dot(a, b):
    return sum(float(x) * float(y) for x, y in zip(a, b))


def body_frame(joints: dict[str, Sequence[float]]) -> dict[str, list[float]]:
    """Eixos do corpo no frame de referencia: right (do personagem), forward (para onde ele olha), up=+Z.
    Usa so a linha dos quadris; nao presume orientacao de modelo (o forward sai de up x right)."""
    up = [0.0, 0.0, 1.0]
    r = [joints["RightUpLeg"][i] - joints["LeftUpLeg"][i] for i in range(3)]
    r[2] = 0.0
    r = _norm(r)
    f = _norm(_cross(up, r))
    return {"right": r, "forward": f, "up": up}


def camera_basis(direction: Sequence[float]) -> dict[str, list[float]]:
    """Base da camera ortografica olhando de `direction` (alvo->camera) para o alvo. +Z do mundo = 'para cima' quando possivel."""
    d = _norm(direction)
    fwd = [-x for x in d]
    up_world = [0.0, 0.0, 1.0] if abs(d[2]) < 0.97 else [0.0, 1.0, 0.0]
    right = _norm(_cross(fwd, up_world))
    up = _norm(_cross(right, fwd))
    return {"dir": d, "forward": fwd, "right": right, "up": up}


def candidate_views(frame: dict[str, list[float]], elevations: Sequence[float] = (12.0, 35.0)) -> list[dict[str, Any]]:
    """Direcoes candidatas (alvo -> camera) em torno do corpo, definidas no frame de referencia do personagem.
    azimute 0 = camera na frente do personagem, +90 = do lado DIREITO dele."""
    names = {0: "frente", 45: "q3_frente_D", 90: "lado_D", 135: "q3_tras_D", 180: "tras", 225: "q3_tras_E", 270: "lado_E", 315: "q3_frente_E"}
    out = []
    f, r, up = frame["forward"], frame["right"], frame["up"]
    for el in elevations:
        ce, se = math.cos(math.radians(el)), math.sin(math.radians(el))
        for az, nm in names.items():
            ca, sa = math.cos(math.radians(az)), math.sin(math.radians(az))
            d = [ce * (ca * f[i] + sa * r[i]) + se * up[i] for i in range(3)]
            out.append({"name": "%s_e%d" % (nm, int(el)), "azimuth": az, "elevation": el, "direction": _norm(d)})
    out.append({"name": "topo", "azimuth": 0, "elevation": 85.0, "direction": _norm([0.12 * f[i] + up[i] for i in range(3)])})
    return out


def independent_of(direction: Sequence[float], others: Sequence[Sequence[float]], min_deg: float = MIN_INDEPENDENT_ANGLE_DEG) -> bool:
    """Direcoes de olhar quase iguais NAO sao duas evidencias: exige >= min_deg entre as direcoes alvo->camera
    (vistas opostas, como frente e costas, mostram superficies diferentes e contam como independentes)."""
    return all(angle_between_vectors_deg(direction, o) >= min_deg for o in others)


def fit_span(rel_points: Sequence[Sequence[float]], basis: dict[str, list[float]], margin: float = 1.3, floor: float = 0.18) -> float:
    """Escala ortografica (lado do quadro) para conter todos os pontos relativos ao alvo, com margem; serve a todos os frames."""
    ext = 0.0
    for p in rel_points:
        ext = max(ext, abs(_dot(p, basis["right"])), abs(_dot(p, basis["up"])))
    return round(max(floor, 2.0 * ext * margin), 4)


# ------------------------------------------------------------------ suficiencia e laco
# Metricas de uma vista (uma regiao): {name, direction, per_frame: {frame: {visible_frac|None, clipped_frac}}, ...}.
# A decisao e POR FRAME: a mao pode estar escondida em g1 e visivel em g13; um minimo global esconderia isso.
def _pf(view: dict[str, Any], f):
    d = view.get("per_frame") or {}
    return d.get(f) if f in d else d.get(str(f))


def frame_good(view: dict[str, Any], f, min_visible: float, max_clipped: float) -> bool:
    m = _pf(view, f)
    return bool(m) and m.get("visible_frac") is not None and m["visible_frac"] >= min_visible and m.get("clipped_frac", 1.0) <= max_clipped


def frame_independent_count(views: Sequence[dict[str, Any]], f, min_visible: float, max_clipped: float) -> tuple[int, list[str]]:
    picked: list[dict[str, Any]] = []
    for v in sorted((v for v in views if frame_good(v, f, min_visible, max_clipped)), key=lambda x: -_pf(x, f)["visible_frac"]):
        if independent_of(v["direction"], [p["direction"] for p in picked]):
            picked.append(v)
    return len(picked), [p["name"] for p in picked]


def assess(views: Sequence[dict[str, Any]], frames: Sequence[int], min_visible: float = 0.6, max_clipped: float = 0.02, min_views: int = 2) -> dict[str, Any]:
    """Evidencia suficiente POR FRAME = >= min_views vistas boas e mutuamente independentes naquele frame.
    Status da regiao: SUFICIENTE (todos os frames), PARCIAL (alguns) ou NAO_OBSERVAVEL (nenhum frame tem sequer 1 vista boa)."""
    ok, partial, none = [], [], []
    per = {}
    for f in frames:
        n, names = frame_independent_count(views, f, min_visible, max_clipped)
        per[f] = {"independent_good_views": n, "views": names}
        (ok if n >= min_views else partial if n >= 1 else none).append(f)
    if len(ok) == len(frames):
        st = "OBSERVADO_SUFICIENTE"
    elif len(none) == len(frames):
        st = "NAO_OBSERVAVEL"
    else:
        st = "OBSERVADO_PARCIAL"
    missing = []
    if partial:
        missing.append("frames com so 1 vista boa (falta a 2a independente): %s" % list(partial))
    if none:
        missing.append("frames sem nenhuma vista com a regiao visivel >= %.0f%% e sem corte de quadro: %s" % (100 * min_visible, list(none)))
    return {"status": st, "frames_ok": ok, "frames_one_view": partial, "frames_not_observed": none, "per_frame": per, "missing": missing}


def gain_of(candidate: dict[str, Any], taken: Sequence[dict[str, Any]], frames: Sequence[int], min_visible: float, max_clipped: float, min_views: int = 2) -> float:
    """quanto a candidata aproxima os frames ainda sem evidencia suficiente do alvo (independentes boas, limitado a min_views por frame)"""
    g = 0.0
    for f in frames:
        before, _ = frame_independent_count(taken, f, min_visible, max_clipped)
        if before >= min_views:
            continue
        after, _ = frame_independent_count(list(taken) + [candidate], f, min_visible, max_clipped)
        g += min(after, min_views) - before
    return g


def rank_candidates(probes: Sequence[dict[str, Any]], taken: Sequence[dict[str, Any]], frames: Sequence[int], min_visible: float, max_clipped: float) -> list[dict[str, Any]]:
    used = {t["name"] for t in taken}
    scored = [(gain_of(p, taken, frames, min_visible, max_clipped), p) for p in probes if p["name"] not in used]
    scored = [(g, p) for g, p in scored if g > 0]
    scored.sort(key=lambda gp: (-gp[0], -(gp[1].get("visible_mean") or 0.0)))
    return [dict(p, gain=g) for g, p in scored]


def investigate(initial: Sequence[dict[str, Any]], frames: Sequence[int], probe: Callable[[], list[dict[str, Any]]], observe: Callable[[list[dict[str, Any]]], list[dict[str, Any]]],
                min_visible: float = 0.6, max_clipped: float = 0.02, max_rounds: int = 3, per_round: int = 2) -> dict[str, Any]:
    """Observar -> avaliar -> pedir nova vista -> reavaliar, com freios: suficiencia, limite de rodadas e ganho zero.
    `probe()` devolve metricas baratas de TODAS as candidatas; `observe(views)` realiza as pedidas (render real).
    Nunca declara SUFICIENTE por cansaco: ao esgotar, devolve PARCIAL/NAO_OBSERVAVEL com os frames que ficaram sem evidencia."""
    taken = list(observe(list(initial)))
    history = [{"round": 0, "requested": [v["name"] for v in initial], "result": assess(taken, frames, min_visible, max_clipped)}]
    stop = "limite de %d rodadas" % max_rounds
    for rnd in range(1, max_rounds + 1):
        if history[-1]["result"]["status"] == "OBSERVADO_SUFICIENTE":
            stop = "evidencia suficiente em todos os frames"
            break
        ranked = rank_candidates(probe(), taken, frames, min_visible, max_clipped)
        if not ranked:
            stop = "nenhuma vista candidata acrescenta evidencia independente nos frames que faltam"
            break
        want = ranked[:per_round]
        taken += observe(want)
        history.append({"round": rnd, "requested": [c["name"] for c in want], "gains": [c["gain"] for c in want], "result": assess(taken, frames, min_visible, max_clipped)})
    else:
        if history[-1]["result"]["status"] == "OBSERVADO_SUFICIENTE":
            stop = "evidencia suficiente em todos os frames"
    return {"final": history[-1]["result"], "stop_reason": stop, "rounds": history, "views": taken}
