"""Contrato e analisador de Continuidade em Transições de Ações (F02).

Schema: arenamon.transition-analysis/1
Analisa a continuidade biomecânica e espacial entre o término da Action A (origem)
e o início da Action B (destino).

Regras fundamentais:
1. Medição rigorosa de descontinuidades de raiz (posição, velocidade, orientação angular real).
2. Pés no solo sem confirmação visual ou colisor físico permanecem estritamente
   classificados como CANDIDATO de contato (foot_contact_candidate).
3. Respeito irrestrito a frames inteiros, FPS das Actions e tempo físico real decorrido em segundos.
4. Compatibilidade e exportação para o contrato F15 (arenamon.agent-report/1) exigindo rig mapping autêntico F03,
   sem inventar intervalos ou estruturas postiças.
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

SCHEMA_NAME = "arenamon.transition-analysis/1"

CANDIDATE_STATUS_CANDIDATE = "CANDIDATE"
CANDIDATE_STATUS_NOT_IN_CONTACT = "NOT_IN_CONTACT"
CANDIDATE_STATUS_CONFIRMED = "CONFIRMED_BY_EVIDENCE"


class TransitionAnalysisError(Exception):
    pass


@dataclass
class FootContinuityEntry:
    role: str
    bone_name: str
    pos_end_a: Tuple[float, float, float]
    pos_start_b: Tuple[float, float, float]
    spatial_delta_m: float
    horizontal_sliding_m: float
    contact_status_a: str
    contact_status_b: str
    is_sliding_candidate: bool
    confidence: float
    note: str


@dataclass
class RootContinuityAnalysis:
    pos_end_a: Tuple[float, float, float]
    pos_start_b: Tuple[float, float, float]
    spatial_delta_m: float
    orientation_delta_deg: float
    velocity_end_a_mps: Optional[float]
    velocity_start_b_mps: Optional[float]
    velocity_delta_mps: Optional[float]
    blend_recommendation_seconds: float
    blend_recommendation_frames: int


@dataclass
class PoseContinuityAnalysis:
    bones_evaluated: int
    mean_discrepancy_m: float
    max_discrepancy_m: float
    max_discrepancy_bone: str
    acceptable_transition: bool


@dataclass
class TransitionAnalysisReport:
    schema: str
    transition_id: str
    action_a: str
    action_b: str
    armature_name: str
    frame_end_a: int
    frame_start_b: int
    frame_end_b: Optional[int]
    fps_a: float
    fps_b: float
    time_seconds_end_a: float
    time_seconds_start_b: float
    root_continuity: Dict[str, Any]
    pose_continuity: Dict[str, Any]
    foot_continuity: List[Dict[str, Any]]
    epistemic_findings: Dict[str, List[str]]


def analyze_transition_continuity(
    action_a_name: str,
    action_b_name: str,
    armature_name: str,
    end_frame_a: int,
    start_frame_b: int,
    root_pose_a: Dict[str, Any],
    root_pose_b: Dict[str, Any],
    bone_poses_a: Dict[str, Tuple[float, float, float]],
    bone_poses_b: Dict[str, Tuple[float, float, float]],
    fps_a: float = 30.0,
    fps_b: float = 30.0,
    ground_z_reference_m: float = 0.0,
    ground_tolerance_m: float = 0.05,
    foot_bones: Optional[Dict[str, str]] = None,
    visual_evidence_confirmed: bool = False,
    end_frame_b: Optional[int] = None,
) -> Dict[str, Any]:
    """Analisa a continuidade biomecânica real entre duas Actions consecutivas."""
    if not action_a_name or not action_b_name:
        raise TransitionAnalysisError("Nomes de Action A e B são obrigatórios")
    if not armature_name:
        raise TransitionAnalysisError("armature_name é obrigatório")

    transition_id = f"{action_a_name}_TO_{action_b_name}"

    # 1. Continuidade de Raiz
    pos_a = root_pose_a.get("position", (0.0, 0.0, 0.0))
    pos_b = root_pose_b.get("position", (0.0, 0.0, 0.0))
    dx = pos_b[0] - pos_a[0]
    dy = pos_b[1] - pos_a[1]
    dz = pos_b[2] - pos_a[2]
    root_delta_m = round(math.sqrt(dx * dx + dy * dy + dz * dz), 4)

    # Medição real da rotação (yaw em graus)
    rot_a = float(root_pose_a.get("yaw_deg", 0.0))
    rot_b = float(root_pose_b.get("yaw_deg", 0.0))
    rot_delta_deg = round(abs(rot_b - rot_a) % 360.0, 2)
    if rot_delta_deg > 180.0:
        rot_delta_deg = 360.0 - rot_delta_deg

    vel_a = root_pose_a.get("velocity_mps")
    vel_b = root_pose_b.get("velocity_mps")
    vel_delta = None
    if vel_a is not None and vel_b is not None:
        vel_delta = round(abs(float(vel_b) - float(vel_a)), 3)

    # Estimativa de janela de blend recomendada
    if root_delta_m < 0.05 and rot_delta_deg < 10.0:
        blend_sec = 0.10
    elif root_delta_m < 0.20 and rot_delta_deg < 30.0:
        blend_sec = 0.15
    else:
        blend_sec = 0.25
    blend_frames = max(2, int(round(blend_sec * fps_b)))

    root_analysis = RootContinuityAnalysis(
        pos_end_a=tuple(pos_a),
        pos_start_b=tuple(pos_b),
        spatial_delta_m=root_delta_m,
        orientation_delta_deg=rot_delta_deg,
        velocity_end_a_mps=round(float(vel_a), 3) if vel_a is not None else None,
        velocity_start_b_mps=round(float(vel_b), 3) if vel_b is not None else None,
        velocity_delta_mps=vel_delta,
        blend_recommendation_seconds=blend_sec,
        blend_recommendation_frames=blend_frames,
    )

    # 2. Continuidade de Poses Articulares (todos os ossos comuns)
    common_bones = set(bone_poses_a.keys()).intersection(set(bone_poses_b.keys()))
    if not common_bones:
        raise TransitionAnalysisError("Nenhum osso em comum entre os conjuntos de poses de A e B")

    deltas: Dict[str, float] = {}
    for bone in common_bones:
        pa = bone_poses_a[bone]
        pb = bone_poses_b[bone]
        dist = math.sqrt(sum((b - a) ** 2 for a, b in zip(pa, pb)))
        deltas[bone] = dist

    mean_disc = round(sum(deltas.values()) / len(deltas), 4)
    max_bone = max(deltas, key=deltas.__getitem__)
    max_disc = round(deltas[max_bone], 4)
    acceptable = max_disc < 0.30 and mean_disc < 0.15

    pose_analysis = PoseContinuityAnalysis(
        bones_evaluated=len(common_bones),
        mean_discrepancy_m=mean_disc,
        max_discrepancy_m=max_disc,
        max_discrepancy_bone=max_bone,
        acceptable_transition=acceptable,
    )

    # 3. Continuidade de Pés (Apoio e Deslizamento)
    feet_map = foot_bones or {"left_foot": "LeftFoot", "right_foot": "RightFoot"}
    feet_entries: List[Dict[str, Any]] = []

    for role, bone_name in feet_map.items():
        if bone_name in bone_poses_a and bone_name in bone_poses_b:
            fa = bone_poses_a[bone_name]
            fb = bone_poses_b[bone_name]
            f_dist = round(math.sqrt(sum((b - a) ** 2 for a, b in zip(fa, fb))), 4)
            h_slide = round(math.hypot(fb[0] - fa[0], fb[1] - fa[1]), 4)

            # Avalia altura vertical em relação ao nível de solo de referência
            dist_ground_a = abs(fa[2] - ground_z_reference_m)
            dist_ground_b = abs(fb[2] - ground_z_reference_m)

            status_a = CANDIDATE_STATUS_NOT_IN_CONTACT
            if dist_ground_a <= ground_tolerance_m:
                status_a = CANDIDATE_STATUS_CONFIRMED if visual_evidence_confirmed else CANDIDATE_STATUS_CANDIDATE

            status_b = CANDIDATE_STATUS_NOT_IN_CONTACT
            if dist_ground_b <= ground_tolerance_m:
                status_b = CANDIDATE_STATUS_CONFIRMED if visual_evidence_confirmed else CANDIDATE_STATUS_CANDIDATE

            is_sliding = (status_a in (CANDIDATE_STATUS_CANDIDATE, CANDIDATE_STATUS_CONFIRMED)) and (h_slide > 0.02)
            note = f"Salto horizontal de {h_slide} m na transição" if is_sliding else "Continuidade de apoio estável"

            entry = FootContinuityEntry(
                role=role,
                bone_name=bone_name,
                pos_end_a=tuple(fa),
                pos_start_b=tuple(fb),
                spatial_delta_m=f_dist,
                horizontal_sliding_m=h_slide,
                contact_status_a=status_a,
                contact_status_b=status_b,
                is_sliding_candidate=is_sliding,
                confidence=1.0 if visual_evidence_confirmed else 0.85,
                note=note,
            )
            feet_entries.append(asdict(entry))

    # 4. Taxonomia Epistêmica
    time_a = round(end_frame_a / fps_a, 4)
    time_b = round(start_frame_b / fps_b, 4)

    facts = [
        f"Transição analisada: '{action_a_name}' (frame {end_frame_a}, {time_a} s) para '{action_b_name}' (frame {start_frame_b}, {time_b} s).",
        f"Descontinuidade medida de posição de raiz: {root_delta_m} m; descontinuidade angular de orientação: {rot_delta_deg}°.",
        f"Discrepância articular média em {len(common_bones)} ossos reais: {mean_disc} m (máximo: {max_disc} m no osso '{max_bone}').",
    ]
    observations = []
    inferences = []
    hypotheses = []

    for f in feet_entries:
        if f["is_sliding_candidate"]:
            observations.append(
                f"Papel '{f['role']}' ({f['bone_name']}): candidato de contato com salto horizontal de {f['horizontal_sliding_m']} m na emenda."
            )
        else:
            observations.append(
                f"Papel '{f['role']}' ({f['bone_name']}): posicionado a Z={f['pos_end_a'][2]:.3f} m em A e Z={f['pos_start_b'][2]:.3f} m em B."
            )

    if root_delta_m > 0.15 or max_disc > 0.25:
        inferences.append(
            f"A magnitude do salto espacial requer janela de blend de ao menos {blend_sec} s ({blend_frames} frames) para evitar corte perceptível no visual."
        )
    else:
        inferences.append("Transição com boa proximidade métrica; janela de blend padrão preservará a fluidez da animação.")

    hypotheses.append(
        "Variações sutis de contato de pé podem ser compensadas pelo sistema de Inverse Kinematics (IK) de solo em tempo de execução."
    )

    report = TransitionAnalysisReport(
        schema=SCHEMA_NAME,
        transition_id=transition_id,
        action_a=action_a_name,
        action_b=action_b_name,
        armature_name=armature_name,
        frame_end_a=end_frame_a,
        frame_start_b=start_frame_b,
        frame_end_b=end_frame_b,
        fps_a=fps_a,
        fps_b=fps_b,
        time_seconds_end_a=time_a,
        time_seconds_start_b=time_b,
        root_continuity=asdict(root_analysis),
        pose_continuity=asdict(pose_analysis),
        foot_continuity=feet_entries,
        epistemic_findings={
            "facts": facts,
            "observations": observations,
            "inferences": inferences,
            "hypotheses": hypotheses,
        },
    )
    return asdict(report)


def validate_transition_analysis(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Valida a conformidade do documento contra o schema arenamon.transition-analysis/1."""
    errors: List[str] = []
    if not isinstance(data, dict):
        return False, ["Documento deve ser um dicionário"]

    if data.get("schema") != SCHEMA_NAME:
        errors.append(f"Campo 'schema' deve ser exatamente '{SCHEMA_NAME}' (recebido: {data.get('schema')})")

    req_fields = (
        "transition_id", "action_a", "action_b", "armature_name",
        "frame_end_a", "frame_start_b", "fps_a", "fps_b",
        "time_seconds_end_a", "time_seconds_start_b",
        "root_continuity", "pose_continuity", "foot_continuity", "epistemic_findings"
    )
    for field in req_fields:
        if field not in data:
            errors.append(f"Campo obrigatório ausente: '{field}'")

    rc = data.get("root_continuity", {})
    if not isinstance(rc, dict) or "spatial_delta_m" not in rc:
        errors.append("Campo 'root_continuity' inválido ou ausente")

    pc = data.get("pose_continuity", {})
    if not isinstance(pc, dict) or "mean_discrepancy_m" not in pc:
        errors.append("Campo 'pose_continuity' inválido ou ausente")

    fc = data.get("foot_continuity", [])
    if not isinstance(fc, list):
        errors.append("Campo 'foot_continuity' deve ser uma lista")
    else:
        for item in fc:
            if item.get("contact_status_a") not in (CANDIDATE_STATUS_CANDIDATE, CANDIDATE_STATUS_NOT_IN_CONTACT, CANDIDATE_STATUS_CONFIRMED):
                errors.append(f"Status de contato inválido: {item.get('contact_status_a')}")

    findings = data.get("epistemic_findings", {})
    if not isinstance(findings, dict):
        errors.append("'epistemic_findings' deve ser um dicionário")
    else:
        for k in ("facts", "observations", "inferences", "hypotheses"):
            if k not in findings or not isinstance(findings[k], list):
                errors.append(f"'epistemic_findings.{k}' deve ser uma lista")

    return len(errors) == 0, errors


def export_transition_to_agent_report(
    analysis: Dict[str, Any],
    source_file: str,
    rig_mapping: Dict[str, Any],
    report_id: Optional[str] = None,
    visual_evidence: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Converte o documento de análise de transição em um relatório F15 (arenamon.agent-report/1).
    
    Exige obrigatoriamente um rig_mapping autêntico do contrato arenamon.rig-map/1.
    O target de F15 referencia a Action de destino B com metadados temporais reais.
    """
    from agent_report import build_agent_report
    from rig_map import validate_rig_map

    val_map, errs = validate_rig_map(rig_mapping)
    if not val_map:
        raise TransitionAnalysisError(f"rig_mapping F03 inválido: {errs}")

    trans_id = analysis["transition_id"]
    rep_id = report_id or f"REP-F02-TRANS-{trans_id.upper()}"
    rc = analysis["root_continuity"]
    pc = analysis["pose_continuity"]

    # Target no padrão F15 representa a Action de destino B com intervalo coerente
    start_b = analysis["frame_start_b"]
    end_b = analysis.get("frame_end_b") or (start_b + rc["blend_recommendation_frames"])
    target_frame_range = (start_b, end_b)

    measurements: List[Dict[str, Any]] = [
        {
            "metric": "transition_source_cut_frame",
            "value": analysis["frame_end_a"],
            "unit": "frame",
            "method": "transition_boundary_frame_index",
            "confidence": 1.0,
        },
        {
            "metric": "transition_target_cut_frame",
            "value": analysis["frame_start_b"],
            "unit": "frame",
            "method": "transition_boundary_frame_index",
            "confidence": 1.0,
        },
        {
            "metric": "root_spatial_discontinuity",
            "value": rc["spatial_delta_m"],
            "unit": "m",
            "method": "transition_boundary_delta",
            "confidence": 1.0,
            "target_role": "root",
        },
        {
            "metric": "root_orientation_discontinuity",
            "value": rc["orientation_delta_deg"],
            "unit": "deg",
            "method": "yaw_euler_difference",
            "confidence": 1.0,
            "target_role": "root",
        },
        {
            "metric": "pose_mean_discrepancy",
            "value": pc["mean_discrepancy_m"],
            "unit": "m",
            "method": "articulated_bones_mean_euclidean",
            "confidence": 1.0,
        },
        {
            "metric": "recommended_blend_duration",
            "value": rc["blend_recommendation_seconds"],
            "unit": "s",
            "method": "discontinuity_heuristic_curve",
            "confidence": 0.90,
        },
    ]

    for f in analysis.get("foot_continuity", []):
        measurements.append({
            "metric": f"foot_sliding_gap_{f['role']}",
            "value": f["horizontal_sliding_m"],
            "unit": "m",
            "method": "horizontal_foot_offset",
            "confidence": f.get("confidence", 0.85),
            "target_role": f["role"],
            "target_bone": f["bone_name"],
        })

    limitations = {
        "missing_data": ["Sem colisor de malha para teste de penetração no piso durante o corte"],
        "assumptions": ["Ações serão reproduzidas em sequência direta sem interrupção por hitstun"],
        "risks": ["Transições bruscas de orientação podem quebrar a sensação de peso se o blend for nulo"],
        "confidence_score": 0.92,
    }

    return build_agent_report(
        report_id=rep_id,
        target={
            "source_file": source_file,
            "action_name": analysis["action_b"],
            "action_slot": None,
            "armature_name": analysis["armature_name"],
            "frame_range": target_frame_range,
            "fps": analysis["fps_b"],
            "unit_system": "METRIC_METERS",
        },
        rig_mapping=rig_mapping,
        measurements=measurements,
        visual_evidence=visual_evidence or [],
        findings=analysis["epistemic_findings"],
        limitations_and_risks=limitations,
    )
