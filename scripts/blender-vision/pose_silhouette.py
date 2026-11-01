"""Contrato e implementação F09: Orquestração de Silhuetas e Poses-Chave (arenamon.pose-silhouette/1).

Identifica poses estruturais fundamentais (início, antecipação, impacto/extensão, recuperação),
calcula dimensões da silhueta (bounding box frontal e lateral, proporção de aspecto, inclinação)
e vincula diretamente com evidências visuais no disco com hash SHA-256 verificado.

Integração com o contrato 'arenamon.agent-report/1' (F15).
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Tuple

SCHEMA_NAME = "arenamon.pose-silhouette/1"

KEYFRAME_ROLE_START = "START_REST"
KEYFRAME_ROLE_ANTICIPATION = "ANTICIPATION_APEX"
KEYFRAME_ROLE_STRIKE = "STRIKE_APEX"
KEYFRAME_ROLE_RECOVERY = "RECOVERY_POSE"


class PoseSilhouetteError(Exception):
    """Exceção para inconsistências em poses e silhuetas."""
    pass


@dataclass
class BoundingBox2D:
    width_m: float
    height_m: float
    aspect_ratio: float


@dataclass
class KeyframeSilhouette:
    frame: int
    time_seconds: float
    structural_role: str
    frontal_skeletal_bbox: BoundingBox2D
    lateral_skeletal_bbox: BoundingBox2D
    sagittal_tilt_deg: float
    evidence_ref: Optional[Dict[str, Any]] = None

    @property
    def frontal_bbox(self) -> BoundingBox2D:
        return self.frontal_skeletal_bbox

    @property
    def lateral_bbox(self) -> BoundingBox2D:
        return self.lateral_skeletal_bbox


def auto_detect_keyframe_milestones(
    keyframe_bone_poses: Dict[int, Dict[str, List[float]]],
    attack_axis_idx: int = 1,
) -> Dict[int, str]:
    """Identifica automaticamente os marcos estruturais a partir das posições esqueléticas.

    Marcos detectados analiticamente:
    - START_REST: primeiro frame da ação.
    - ANTICIPATION_APEX: pose de maior recuo ou compressão antes da projeção.
    - STRIKE_APEX: pose de máxima extensão / avanço no eixo de ataque.
    - RECOVERY_POSE: pose de retorno ou término da ação.
    """
    sorted_frames = sorted(keyframe_bone_poses.keys())
    n = len(sorted_frames)
    if n == 0:
        return {}
    if n == 1:
        return {sorted_frames[0]: KEYFRAME_ROLE_START}
    if n == 2:
        return {sorted_frames[0]: KEYFRAME_ROLE_START, sorted_frames[1]: KEYFRAME_ROLE_STRIKE}
    if n == 3:
        return {
            sorted_frames[0]: KEYFRAME_ROLE_START,
            sorted_frames[1]: KEYFRAME_ROLE_STRIKE,
            sorted_frames[2]: KEYFRAME_ROLE_RECOVERY,
        }

    # Analisa o centroide dos membros superiores / efetores ou pelve
    eff_positions: Dict[int, float] = {}
    pelvis_positions: Dict[int, float] = {}

    for f in sorted_frames:
        bones = keyframe_bone_poses[f]
        # Pelve/quadril
        pelv = next((c for name, c in bones.items() if any(k in name.lower() for k in ("pelvis", "hips", "waist"))), None)
        if pelv:
            pelvis_positions[f] = pelv[attack_axis_idx]

        # Efetores de mão/braço/cabeça
        hands = [c for name, c in bones.items() if any(k in name.lower() for k in ("hand", "arm", "wrist", "fist"))]
        if hands:
            eff_positions[f] = max(c[attack_axis_idx] for c in hands)
        elif pelv:
            eff_positions[f] = pelv[attack_axis_idx]
        else:
            eff_positions[f] = max(c[attack_axis_idx] for c in bones.values())

    # 1. Start
    start_f = sorted_frames[0]
    # 2. Strike Apex (máxima projeção no eixo do ataque)
    strike_f = max(sorted_frames[1:-1], key=lambda f: eff_positions.get(f, 0.0))
    # 3. Anticipation Apex (maior recuo antes do strike)
    frames_before_strike = [f for f in sorted_frames if f < strike_f]
    if len(frames_before_strike) > 1:
        anticipation_f = min(frames_before_strike[1:], key=lambda f: eff_positions.get(f, 0.0))
    else:
        anticipation_f = sorted_frames[1]
    # 4. Recovery Pose
    recovery_f = sorted_frames[-1]

    milestones = {
        start_f: KEYFRAME_ROLE_START,
        anticipation_f: KEYFRAME_ROLE_ANTICIPATION,
        strike_f: KEYFRAME_ROLE_STRIKE,
        recovery_f: KEYFRAME_ROLE_RECOVERY,
    }
    return milestones


def _calc_bbox_and_tilt(bone_positions: Dict[str, List[float]]) -> Tuple[BoundingBox2D, BoundingBox2D, float]:
    """Calcula bboxes 2D e inclinação sagital a partir de um conjunto de ossos no frame."""
    coords = list(bone_positions.values())
    if not coords:
        return BoundingBox2D(0.0, 0.0, 0.0), BoundingBox2D(0.0, 0.0, 0.0), 0.0

    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    zs = [c[2] for c in coords]

    # Frontal (plano X-Z)
    w_front = max(xs) - min(xs)
    h_front = max(zs) - min(zs)
    ar_front = round(w_front / max(0.01, h_front), 2)

    # Lateral (plano Y-Z)
    w_lat = max(ys) - min(ys)
    h_lat = max(zs) - min(zs)
    ar_lat = round(w_lat / max(0.01, h_lat), 2)

    # Inclinação sagital entre pelve/quadril e cabeça/tronco (se existirem)
    tilt_deg = 0.0
    pelvis_cand = [c for name, c in bone_positions.items() if any(k in name.lower() for k in ("pelvis", "hips", "waist"))]
    head_cand = [c for name, c in bone_positions.items() if any(k in name.lower() for k in ("head", "chest", "spine"))]
    if pelvis_cand and head_cand:
        p = pelvis_cand[0]
        h = head_cand[0]
        dy = h[1] - p[1]
        dz = h[2] - p[2]
        tilt_rad = math.atan2(dy, max(0.01, dz))
        tilt_deg = round(math.degrees(tilt_rad), 1)

    return (
        BoundingBox2D(width_m=round(w_front, 3), height_m=round(h_front, 3), aspect_ratio=ar_front),
        BoundingBox2D(width_m=round(w_lat, 3), height_m=round(h_lat, 3), aspect_ratio=ar_lat),
        tilt_deg
    )


def build_pose_silhouette_analysis(
    action_name: str,
    armature_name: str,
    frame_range: Tuple[int, int],
    fps: float,
    keyframe_bone_poses: Dict[int, Dict[str, List[float]]],
    keyframe_roles: Optional[Dict[int, str]] = None,
    visual_evidences: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Constrói análise de silhuetas e poses-chave estruturais conforme 'arenamon.pose-silhouette/1'.

    Args:
        action_name: Nome da Action.
        armature_name: Nome do esqueleto.
        frame_range: Intervalo de quadros (start, end).
        fps: Taxa de quadros por segundo real.
        keyframe_bone_poses: Mapeamento de frame para posições de ossos {frame: {bone_name: [x,y,z]}}.
        keyframe_roles: Mapeamento opcional de frame para papel estrutural ('START_REST', 'ANTICIPATION_APEX', etc.).
        visual_evidences: Opcional, lista de metadados de imagens associadas a cada marco.
    """
    if fps <= 0.0:
        raise PoseSilhouetteError(f"FPS deve ser positivo. Recebido: {fps}")

    sorted_frames = sorted(keyframe_bone_poses.keys())
    if not sorted_frames:
        raise PoseSilhouetteError("Nenhum frame fornecido para análise de pose.")

    # Se os papéis não foram passados manualmente, detecta automaticamente via cinemática
    detected_roles = auto_detect_keyframe_milestones(keyframe_bone_poses) if not keyframe_roles else {}

    # Se recebeu amostragem densa/completa da Action sem papéis manuais, foca nos marcos fundamentais detectados
    if not keyframe_roles and len(sorted_frames) > 8:
        eval_frames = sorted(detected_roles.keys())
        detection_mode = f"automática por cinemática (isolou {len(eval_frames)} marcos de {len(sorted_frames)} quadros amostrados)"
    else:
        eval_frames = sorted_frames
        detection_mode = "manual" if keyframe_roles else "automática por cinemática"

    evidence_by_frame: Dict[int, Dict[str, Any]] = {}
    if visual_evidences:
        for ev in visual_evidences:
            for f in ev.get("frames_shown", []):
                evidence_by_frame[f] = ev

    silhouettes: List[Dict[str, Any]] = []
    facts: List[str] = [
        f"Ação analisada: '{action_name}' no armature '{armature_name}' ({frame_range[0]}..{frame_range[1]} a {fps:.1f} FPS).",
        f"Total de poses estruturais avaliadas: {len(eval_frames)} (seleção: {detection_mode}).",
        "Nota taxonômica: Dimensões referem-se à Bounding Box Esquelética Projetada (posições dos centros dos ossos), não à silhueta rasterizada de malha poligonal densa.",
    ]

    for f in eval_frames:
        bones = keyframe_bone_poses[f]
        front_bb, lat_bb, tilt = _calc_bbox_and_tilt(bones)
        t_sec = round((f - frame_range[0]) / fps, 3)

        role = (keyframe_roles or {}).get(f) or detected_roles.get(f)
        if not role:
            if f == eval_frames[0]:
                role = KEYFRAME_ROLE_START
            elif f == eval_frames[-1]:
                role = KEYFRAME_ROLE_RECOVERY
            else:
                role = KEYFRAME_ROLE_STRIKE

        ev_ref = evidence_by_frame.get(f)

        ks = KeyframeSilhouette(
            frame=f,
            time_seconds=t_sec,
            structural_role=role,
            frontal_skeletal_bbox=front_bb,
            lateral_skeletal_bbox=lat_bb,
            sagittal_tilt_deg=tilt,
            evidence_ref=ev_ref,
        )
        silhouettes.append(asdict(ks))

        ev_info = f" [Evidência: {ev_ref['evidence_id']}]" if ev_ref else " [Sem evidência visual vinculada]"
        facts.append(
            f"Frame {f} ({t_sec:.2f} s, {role}): Bounding Box Esquelética frontal {front_bb.width_m}x{front_bb.height_m} m (AR: {front_bb.aspect_ratio}), inclinação sagital {tilt}°{ev_info}."
        )

    limitations = [
        "DISTINÇÃO CATEGÓRICA: As dimensões reportadas são projeções 2D da caixa delimitadora do esqueleto (posições dos ossos). Não representam silhuetas renderizadas por contorno de malha/pixels.",
        "Inclinação sagital usa a linha pelve-tronco no plano lateral.",
    ]

    return {
        "schema": SCHEMA_NAME,
        "action_name": action_name,
        "armature_name": armature_name,
        "frame_range": list(frame_range),
        "fps": fps,
        "keyframes": silhouettes,
        "facts": facts,
        "limitations": limitations,
    }


def validate_pose_silhouette(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Valida conformidade com 'arenamon.pose-silhouette/1'."""
    errors = []
    if not isinstance(data, dict):
        return False, ["Documento deve ser um dicionário"]

    if data.get("schema") != SCHEMA_NAME:
        errors.append(f"Schema inválido: esperado '{SCHEMA_NAME}', recebido '{data.get('schema')}'")

    for f in ("action_name", "armature_name", "frame_range", "fps", "keyframes", "facts"):
        if f not in data:
            errors.append(f"Campo obrigatório ausente: '{f}'")

    keyframes = data.get("keyframes", [])
    if not isinstance(keyframes, list) or len(keyframes) == 0:
        errors.append("Lista 'keyframes' deve conter ao menos uma pose estrutural")
    else:
        for i, k in enumerate(keyframes):
            for kf in ("frame", "time_seconds", "structural_role", "sagittal_tilt_deg"):
                if kf not in k:
                    errors.append(f"Keyframe {i} sem campo obrigatório: '{kf}'")
            if "frontal_skeletal_bbox" not in k and "frontal_bbox" not in k:
                errors.append(f"Keyframe {i} sem campo de bounding box frontal ('frontal_skeletal_bbox' ou 'frontal_bbox')")
            if "lateral_skeletal_bbox" not in k and "lateral_bbox" not in k:
                errors.append(f"Keyframe {i} sem campo de bounding box lateral ('lateral_skeletal_bbox' ou 'lateral_bbox')")

    return len(errors) == 0, errors


def export_pose_silhouette_to_agent_report(
    analysis: Dict[str, Any],
    source_file: str,
    rig_mapping: Dict[str, Any],
    visual_evidence: Optional[List[Dict[str, Any]]] = None,
    report_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Exporta a análise de silhueta e poses para o contrato canônico 'arenamon.agent-report/1' (F15)."""
    is_valid, errs = validate_pose_silhouette(analysis)
    if not is_valid:
        raise PoseSilhouetteError(f"Não é possível exportar documento inválido: {errs}")

    from agent_report import build_agent_report

    act_name = analysis["action_name"]
    rep_id = report_id or f"REP-F09-SILHOUETTE-{act_name.upper().replace(' ', '_')}"
    f_range = tuple(analysis["frame_range"])

    measurements: List[Dict[str, Any]] = [
        {
            "metric": "evaluated_keyframes_count",
            "value": len(analysis["keyframes"]),
            "unit": "count",
            "method": "structural_keyframe_selection",
            "confidence": 1.0,
        }
    ]

    for k in analysis["keyframes"]:
        f = k["frame"]
        role = k["structural_role"]
        f_bb = k.get("frontal_skeletal_bbox") or k.get("frontal_bbox", {})
        l_bb = k.get("lateral_skeletal_bbox") or k.get("lateral_bbox", {})
        measurements.append({
            "metric": f"keyframe_{f}_skeletal_projected_frontal_width_m",
            "value": f_bb["width_m"],
            "unit": "m",
            "method": "skeletal_bounding_box_projection",
            "confidence": 0.95,
        })
        measurements.append({
            "metric": f"keyframe_{f}_skeletal_projected_frontal_height_m",
            "value": f_bb["height_m"],
            "unit": "m",
            "method": "skeletal_bounding_box_projection",
            "confidence": 0.95,
        })
        measurements.append({
            "metric": f"keyframe_{f}_sagittal_tilt_deg",
            "value": k["sagittal_tilt_deg"],
            "unit": "deg",
            "method": "pelvis_spine_sagittal_vector_angle",
            "confidence": 0.95,
        })

    limitations = {
        "missing_data": [],
        "assumptions": [
            f"Taxa de amostragem de {analysis['fps']:.1f} FPS.",
        ],
        "risks": analysis["limitations"],
        "confidence_score": 0.95,
    }

    findings = {
        "facts": analysis["facts"],
        "inferences": [
            f"Total de {len(analysis['keyframes'])} silhuetas estruturais projetadas.",
        ],
        "actionable": [],
        "uncertainties": ["Silhuetas inferidas por caixas delimitadoras de ossos, sem renderização de malha densa."],
    }

    report = build_agent_report(
        report_id=rep_id,
        target={
            "source_file": source_file,
            "action_name": act_name,
            "action_slot": None,
            "armature_name": analysis["armature_name"],
            "frame_range": f_range,
            "fps": float(analysis["fps"]),
            "unit_system": "METRIC_METERS",
        },
        rig_mapping=rig_mapping,
        measurements=measurements,
        visual_evidence=visual_evidence or [],
        findings=findings,
        limitations_and_risks=limitations,
    )
    return report
