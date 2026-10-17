"""Validador de utilidade visual de imagens para o Animation Witness.

Verifica se uma imagem capturada ou planejada possui valor informativo real:
- Rejeita corte em bordas (margem minima configuravel, padrao 5%);
- Rejeita colapso projetado de dedos/garras (separacao projetada minima em pixels);
- Rejeita oclusao severa por antebraco/tronco via passes de ID e bounding box;
- Rejeita dominancia insuficiente de area (resolucao muito baixa);
- Verifica independencia geometrica de vistas (angulo entre eixos >= 35 graus).
"""
from __future__ import annotations

import math
import os
from typing import Any, Iterable, Sequence


MIN_INDEPENDENT_ANGLE_DEG = 35.0
DEFAULT_EDGE_MARGIN_RATIO = 0.05
MIN_DIGIT_SEPARATION_PX = 8.0
MIN_TARGET_PIXEL_COUNT = 30


def vec_length(v: Sequence[float]) -> float:
    return math.sqrt(sum(float(x) ** 2 for x in v))


def vec_dot(a: Sequence[float], b: Sequence[float]) -> float:
    return sum(float(x) * float(y) for x, y in zip(a, b))


def vec_sub(a: Sequence[float], b: Sequence[float]) -> list[float]:
    return [float(x) - float(y) for x, y in zip(a, b)]


def angle_between_vectors_deg(v1: Sequence[float], v2: Sequence[float]) -> float:
    l1, l2 = vec_length(v1), vec_length(v2)
    if l1 < 1e-9 or l2 < 1e-9:
        return 0.0
    dot = vec_dot(v1, v2) / (l1 * l2)
    dot = max(-1.0, min(1.0, dot))
    return math.degrees(math.acos(dot))


def are_views_independent(
    cam1_pos: Sequence[float],
    cam1_target: Sequence[float],
    cam2_pos: Sequence[float],
    cam2_target: Sequence[float],
    min_angle_deg: float = MIN_INDEPENDENT_ANGLE_DEG,
) -> tuple[bool, float]:
    """Verifica se duas vistas sao geometricamente independentes (angulo >= min_angle_deg).

    Duas imagens do mesmo angulo com zoom ou distancia diferente NAO sao independentes.
    """
    v1 = vec_sub(cam1_target, cam1_pos)
    v2 = vec_sub(cam2_target, cam2_pos)
    ang = angle_between_vectors_deg(v1, v2)
    return (ang >= min_angle_deg, round(ang, 2))
def project_3d_to_pixel(
    point_world: Sequence[float],
    cam_location: Sequence[float],
    cam_target: Sequence[float],
    cam_up: Sequence[float] = (0.0, 0.0, 1.0),
    ortho_scale: float = 1.0,
    image_width: int = 512,
    image_height: int = 512,
    is_ortho: bool = True,
    lens: float = 50.0,
    sensor_width: float = 36.0,
) -> tuple[float, float, float]:
    """Projeta um ponto 3D mundial para coordenadas de pixel (u, v) e profundidade z_cam."""
    cz = [float(cam_location[i]) - float(cam_target[i]) for i in range(3)]
    lz = math.sqrt(sum(x**2 for x in cz))
    cz = [0.0, 0.0, 1.0] if lz < 1e-9 else [x / lz for x in cz]

    up = [float(x) for x in cam_up]
    cx = [
        up[1] * cz[2] - up[2] * cz[1],
        up[2] * cz[0] - up[0] * cz[2],
        up[0] * cz[1] - up[1] * cz[0],
    ]
    lx = math.sqrt(sum(x**2 for x in cx))
    cx = [1.0, 0.0, 0.0] if lx < 1e-9 else [x / lx for x in cx]

    cy = [
        cz[1] * cx[2] - cz[2] * cx[1],
        cz[2] * cx[0] - cz[0] * cx[2],
        cz[0] * cx[1] - cz[1] * cx[0],
    ]

    target = [float(x) for x in cam_target]
    v = [float(point_world[i]) - target[i] for i in range(3)]
    x_cam = sum(v[i] * cx[i] for i in range(3))
    y_cam = sum(v[i] * cy[i] for i in range(3))
    z_cam = sum(v[i] * cz[i] for i in range(3))

    if is_ortho:
        scale = max(float(ortho_scale), 1e-4)
        u = (image_width * 0.5) + (x_cam / scale) * image_width
        v = (image_height * 0.5) - (y_cam / scale) * image_height
    else:
        dist_to_cam = math.sqrt(sum((float(cam_location[i]) - float(point_world[i]))**2 for i in range(3)))
        focal_px = (float(lens) / max(float(sensor_width), 1e-3)) * float(image_width)
        z_depth = max(dist_to_cam, 1e-3)
        u = (image_width * 0.5) + (x_cam / z_depth) * focal_px
        v = (image_height * 0.5) - (y_cam / z_depth) * focal_px

    return round(u, 2), round(v, 2), round(z_cam, 4)


def check_edge_clipping(
    points_2d: Sequence[Sequence[float]],
    width: int,
    height: int,
    margin_ratio: float = DEFAULT_EDGE_MARGIN_RATIO,
) -> tuple[bool, float, list[str]]:
    """Verifica se pontos de interesse estao cortados ou perigosamente proximos da borda."""
    if not points_2d or width <= 0 or height <= 0:
        return True, 1.0, []

    margin_x = width * margin_ratio
    margin_y = height * margin_ratio
    min_dist_px = float("inf")
    reasons: list[str] = []

    for i, pt in enumerate(points_2d):
        x, y = float(pt[0]), float(pt[1])
        dx_left = x
        dx_right = width - x
        dy_top = y
        dy_bottom = height - y

        d_edge = min(dx_left, dx_right, dy_top, dy_bottom)
        if d_edge < min_dist_px:
            min_dist_px = d_edge

        if x < 0 or x > width or y < 0 or y > height:
            reasons.append(f"ponto #{i} fora do quadro (x={x:.1f}, y={y:.1f})")
        elif d_edge < min(margin_x, margin_y):
            reasons.append(
                f"ponto #{i} proximo da borda ({d_edge:.1f}px < {min(margin_x, margin_y):.1f}px)"
            )

    is_ok = len(reasons) == 0
    return is_ok, round(min_dist_px, 2), reasons


def check_projected_separation(
    tips_2d: Sequence[Sequence[float]],
    min_pixel_distance: float = MIN_DIGIT_SEPARATION_PX,
) -> tuple[bool, float, str | None]:
    """Calcula a distancia minima projetada entre pontas de dedos/garras.

    Se as pontas colapsarem visualmente na projecao (< min_pixel_distance),
    a configuracao dos dedos nao pode ser afirmada nessa vista.
    """
    if len(tips_2d) < 2:
        return True, float("inf"), None

    min_d = float("inf")
    for i in range(len(tips_2d)):
        for j in range(i + 1, len(tips_2d)):
            dx = float(tips_2d[i][0]) - float(tips_2d[j][0])
            dy = float(tips_2d[i][1]) - float(tips_2d[j][1])
            d = math.hypot(dx, dy)
            if d < min_d:
                min_d = d

    if min_d < min_pixel_distance:
        reason = (
            f"REJEITADA_COLAPSO_PROJETADO: separacao minima entre pontas de dedos "
            f"({min_d:.1f}px) menor que o limiar ({min_pixel_distance:.1f}px)"
        )
        return False, round(min_d, 2), reason

    return True, round(min_d, 2), None


def evaluate_view_utility(view_info: dict[str, Any]) -> dict[str, Any]:
    """Avalia a utilidade visual de um enquadramento/imagem.

    view_info deve conter:
    - view_name: str
    - image_width: int
    - image_height: int
    - keypoints_2d: list[[x, y]] (ex: pontas de dedos, pulso)
    - digit_tips_2d: list[[x, y]] (opcional, para teste de separacao)
    - target_pixels: int (opcional, contagem de pixels da regiao alvo)
    - occluder_pixels: int (opcional, contagem de pixels de oclusores no bbox)
    - is_forearm_collinear: bool (opcional)
    """
    reasons: list[str] = []
    width = int(view_info.get("image_width", 512))
    height = int(view_info.get("image_height", 512))

    # 1. Borda / Enquadramento
    keypoints = view_info.get("keypoints_2d", [])
    if keypoints:
        edge_ok, min_edge_d, edge_reasons = check_edge_clipping(keypoints, width, height)
        if not edge_ok:
            for r in edge_reasons:
                reasons.append(f"REJEITADA_BORDA: {r}")

    # 2. Separacao dos dedos
    digit_tips = view_info.get("digit_tips_2d", [])
    min_sep = float("inf")
    if len(digit_tips) >= 2:
        sep_ok, min_sep, sep_reason = check_projected_separation(digit_tips)
        if not sep_ok and sep_reason:
            reasons.append(sep_reason)

    # 3. Colinearidade com o antebraco
    if view_info.get("is_forearm_collinear"):
        reasons.append("REJEITADA_OCLUSAO: visao colinear ao antebraco bloqueia profundidade dos dedos")

    # 4. Oclusao por pixels / area
    target_px = view_info.get("target_pixels")
    total_px = width * height
    if target_px is not None:
        min_ratio = 0.001
        if target_px < MIN_TARGET_PIXEL_COUNT:
            reasons.append(
                f"REJEITADA_RESOLUCAO: regiao alvo ocupa apenas {target_px} pixels (< {MIN_TARGET_PIXEL_COUNT}px)"
            )
        elif (target_px / max(total_px, 1)) < min_ratio:
            reasons.append(
                f"REJEITADA_RESOLUCAO: regiao alvo ocupa apenas {target_px} pixels ({target_px / total_px * 100:.2f}% < {min_ratio * 100:.1f}%)"
            )

    occluder_px = view_info.get("occluder_pixels")
    if target_px is not None and occluder_px is not None and target_px > 0:
        ratio = occluder_px / (target_px + occluder_px)
        if ratio > 0.55:
            reasons.append(
                f"REJEITADA_OCLUSAO: oclusor cobre {ratio * 100:.1f}% da projecao do membro de interesse"
            )

    # 5. Camera abaixo do solo
    cam_z = view_info.get("cam_location_z")
    if cam_z is not None and cam_z < 0.05:
        reasons.append(f"REJEITADA_SOLO: camera abaixo do chao (Z={cam_z:.3f}m < 0.05m)")

    is_useful = len(reasons) == 0
    score = 1.0 if is_useful else max(0.0, 1.0 - 0.3 * len(reasons))

    res = {
        "view_name": view_info.get("view_name", "unknown"),
        "is_useful": is_useful,
        "utility_score": round(score, 3),
        "rejection_reasons": reasons,
        "metrics": {
            "image_size": [width, height],
            "digit_tip_separation_px": None if math.isinf(min_sep) else min_sep,
            "target_pixels": target_px,
        },
    }
    if view_info.get("camera"):
        res["camera"] = view_info["camera"]
        res["metrics"]["camera"] = view_info["camera"]
    return res
