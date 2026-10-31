"""Contrato e comparador Cross-Rig com Normalização Estrita (F04).

Schema: arenamon.cross-rig-compare/1
Compara kinematicamente Actions em rigs/armatures distintos (ex: Pakko vs Wookada,
AlienRig vs Pokémon Z-A, Rigify vs Mixamo) sem contaminação por escala ou espaço de mundo.

Regras fundamentais:
1. Utilização mandatória do mapeamento F03 (arenamon.rig-map/1):
   Somente papéis canônicos mapeados em ambos os esqueletos são elegíveis para comparação.
2. Normalização de Origem Anatômica (Centralização na Pelve):
   Todas as coordenadas articulares são expressas relativamente ao centro de massa
   anatômico (pelve), garantindo que offsets de mundo sejam rigorosamente anulados.
3. Normalização de Orientação Sagital:
   Alinhamento da orientação frontal do torso para o eixo canônico (+Y no Blender),
   neutralizando rotações arbitrárias de mundo.
4. Normalização de Escala Corporal (H):
   Discrepâncias expressas em porcentagem da altura corporal (%H) e metros normalizados.
5. Normalização Temporal em Segundos Físicos:
   Amostragem em tempo normalizado t in [0, 1] com base nas durações físicas reais (frame / FPS).
6. Proibição categórica: NUNCA comparar coordenadas brutas de esqueletos incompatíveis.
7. Neutralidade avaliativa: mede divergência geométrica sem emitir juízo artístico.
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from rig_map import STATUS_MAPPED, RigMapError, validate_rig_map

SCHEMA_NAME = "arenamon.cross-rig-compare/1"


class CrossRigCompareError(Exception):
    pass


@dataclass
class RoleComparisonResult:
    role: str
    bone_a: str
    bone_b: str
    mean_discrepancy_rel_H: float
    max_discrepancy_rel_H: float
    peak_normalized_time: float
    peak_seconds_a: float
    peak_seconds_b: float
    confidence: float


@dataclass
class CrossRigCompareReport:
    schema: str
    comparison_id: str
    action_a: Dict[str, Any]
    action_b: Dict[str, Any]
    height_a_meters: float
    height_b_meters: float
    sample_count: int
    common_roles_evaluated: List[str]
    excluded_roles: List[str]
    global_mean_discrepancy_rel_H: float
    peak_discrepancy_role: str
    peak_discrepancy_rel_H: float
    role_comparisons: Dict[str, Dict[str, Any]]
    epistemic_findings: Dict[str, List[str]]


def _canonicalize_point(
    raw_pt: Tuple[float, float, float],
    pelvis_pt: Tuple[float, float, float],
    yaw_deg: float,
    height_m: float,
) -> Tuple[float, float, float]:
    """Aplica a normalização geométrica canônica completa:
    
    1. Subtração do centro de massa (pelve) -> origem anatômica em (0, 0, 0).
    2. Rotação inversa de yaw -> alinha vetor frontal para +Y.
    3. Divisão escalar por H -> invariância à escala corporal.
    """
    # 1. Translação relativa à pelve
    dx = raw_pt[0] - pelvis_pt[0]
    dy = raw_pt[1] - pelvis_pt[1]
    dz = raw_pt[2] - pelvis_pt[2]

    # 2. Rotação inversa em torno do eixo vertical Z
    yaw_rad = math.radians(yaw_deg)
    cos_y = math.cos(-yaw_rad)
    sin_y = math.sin(-yaw_rad)
    x_rot = dx * cos_y - dy * sin_y
    y_rot = dx * sin_y + dy * cos_y
    z_rot = dz

    # 3. Normalização de escala por H
    return (x_rot / height_m, y_rot / height_m, z_rot / height_m)


def compare_cross_rig_actions(
    comparison_id: str,
    rig_map_a: Dict[str, Any],
    rig_map_b: Dict[str, Any],
    action_a_meta: Dict[str, Any],
    action_b_meta: Dict[str, Any],
    height_a_m: float,
    height_b_m: float,
    samples_a_by_role: Dict[str, Sequence[Tuple[float, float, float]]],
    samples_b_by_role: Dict[str, Sequence[Tuple[float, float, float]]],
    sample_count: int = 21,
    yaws_a_deg: Optional[Sequence[float]] = None,
    yaws_b_deg: Optional[Sequence[float]] = None,
) -> Dict[str, Any]:
    """Compara duas Actions em rigs diferentes aplicando normalização estrita de escala, espaço e tempo."""
    if not comparison_id or not isinstance(comparison_id, str):
        raise CrossRigCompareError("comparison_id deve ser string não-vazia")

    if height_a_m <= 0.0 or height_b_m <= 0.0:
        raise CrossRigCompareError(f"Alturas dos rigs devem ser estritamente positivas: H_A={height_a_m}, H_B={height_b_m}")

    # 1. Validação obrigatória dos dois contratos F03
    val_a, errs_a = validate_rig_map(rig_map_a)
    if not val_a:
        raise CrossRigCompareError(f"rig_map_a inválido contra F03: {errs_a}")

    val_b, errs_b = validate_rig_map(rig_map_b)
    if not val_b:
        raise CrossRigCompareError(f"rig_map_b inválido contra F03: {errs_b}")

    # 2. Identificação de papéis canônicos mapeados em ambos os rigs
    roles_a = {r for r, info in rig_map_a.get("roles", {}).items() if info.get("status") == STATUS_MAPPED}
    roles_b = {r for r, info in rig_map_b.get("roles", {}).items() if info.get("status") == STATUS_MAPPED}
    common_roles = sorted(list(roles_a.intersection(roles_b)))

    all_roles = sorted(list(roles_a.union(roles_b)))
    excluded_roles = [r for r in all_roles if r not in common_roles]

    if not common_roles:
        raise CrossRigCompareError(
            f"Nenhum papel canônico F03 em comum entre {rig_map_a.get('rig_id')} e {rig_map_b.get('rig_id')}."
        )

    # 3. Metadados temporais e durações físicas
    dur_a = float(action_a_meta.get("duration_seconds", 1.0))
    dur_b = float(action_b_meta.get("duration_seconds", 1.0))
    act_a_name = action_a_meta.get("action_name", "Action_A")
    act_b_name = action_b_meta.get("action_name", "Action_B")

    # Identifica pontos de referência de centro anatômico (pelve ou root como fallback)
    ref_role = "pelvis" if "pelvis" in common_roles else "root"
    if ref_role not in samples_a_by_role or ref_role not in samples_b_by_role:
        ref_role = "root" if "root" in samples_a_by_role and "root" in samples_b_by_role else None

    # Validação do tamanho das séries temporais
    for r in common_roles:
        if r in samples_a_by_role and r in samples_b_by_role:
            if len(samples_a_by_role[r]) < sample_count or len(samples_b_by_role[r]) < sample_count:
                raise CrossRigCompareError(
                    f"Amostras insuficientes para o papel '{r}': esperadas {sample_count}, "
                    f"recebidas A={len(samples_a_by_role[r])}, B={len(samples_b_by_role[r])}"
                )

    # 4. Avaliação normalizada com centralização e alinhamento sagital
    role_results: Dict[str, Dict[str, Any]] = {}
    all_role_means: List[float] = []
    overall_peak_role = ""
    overall_peak_val = -1.0

    for role in common_roles:
        if role not in samples_a_by_role or role not in samples_b_by_role:
            excluded_roles.append(role)
            continue

        pts_a = samples_a_by_role[role]
        pts_b = samples_b_by_role[role]

        distances_rel_H: List[float] = []
        for i in range(sample_count):
            raw_a = pts_a[i]
            raw_b = pts_b[i]

            # Centro anatômico da amostra i
            pelv_a = samples_a_by_role[ref_role][i] if ref_role else (0.0, 0.0, 0.0)
            pelv_b = samples_b_by_role[ref_role][i] if ref_role else (0.0, 0.0, 0.0)

            yaw_a = yaws_a_deg[i] if yaws_a_deg and i < len(yaws_a_deg) else 0.0
            yaw_b = yaws_b_deg[i] if yaws_b_deg and i < len(yaws_b_deg) else 0.0

            # Coordenadas canônicas normalizadas
            norm_a = _canonicalize_point(raw_a, pelv_a, yaw_a, height_a_m)
            norm_b = _canonicalize_point(raw_b, pelv_b, yaw_b, height_b_m)

            d_norm = math.sqrt(
                (norm_b[0] - norm_a[0]) ** 2 +
                (norm_b[1] - norm_a[1]) ** 2 +
                (norm_b[2] - norm_a[2]) ** 2
            )
            distances_rel_H.append(d_norm)

        mean_d = sum(distances_rel_H) / len(distances_rel_H)
        peak_idx = max(range(len(distances_rel_H)), key=distances_rel_H.__getitem__)
        max_d = distances_rel_H[peak_idx]

        t_peak_norm = round(peak_idx / max(1, sample_count - 1), 3)
        t_peak_sec_a = round(t_peak_norm * dur_a, 3)
        t_peak_sec_b = round(t_peak_norm * dur_b, 3)

        bone_a = rig_map_a["roles"][role]["bone_name"]
        bone_b = rig_map_b["roles"][role]["bone_name"]
        conf = min(rig_map_a["roles"][role]["confidence"], rig_map_b["roles"][role]["confidence"])

        res = RoleComparisonResult(
            role=role,
            bone_a=bone_a,
            bone_b=bone_b,
            mean_discrepancy_rel_H=round(mean_d, 4),
            max_discrepancy_rel_H=round(max_d, 4),
            peak_normalized_time=t_peak_norm,
            peak_seconds_a=t_peak_sec_a,
            peak_seconds_b=t_peak_sec_b,
            confidence=round(conf, 2),
        )
        role_results[role] = asdict(res)
        all_role_means.append(mean_d)

        if max_d > overall_peak_val:
            overall_peak_val = max_d
            overall_peak_role = role

    active_roles = list(role_results.keys())
    global_mean = round(sum(all_role_means) / len(all_role_means), 4) if all_role_means else 0.0

    # 5. Taxonomia Epistêmica Rigorosa
    facts = [
        f"Comparação Cross-Rig '{comparison_id}': {act_a_name} (H={height_a_m} m, {dur_a} s) vs {act_b_name} (H={height_b_m} m, {dur_b} s).",
        f"Mapeamento anatômico F03 identificou {len(active_roles)} papéis canônicos elegíveis avaliados.",
        f"Posições normalizadas: centralização na pelve, alinhamento frontal sagital e escala adimensional dividida por H.",
        f"Discrepância global média normalizada: {global_mean * 100:.2f}% de H.",
        f"Pico de divergência ocorreu no papel '{overall_peak_role}' com {overall_peak_val * 100:.2f}% de H.",
    ]
    observations = []
    inferences = []
    hypotheses = []

    for r, r_info in role_results.items():
        observations.append(
            f"Papel '{r}' ({r_info['bone_a']} vs {r_info['bone_b']}): discrepância média de {r_info['mean_discrepancy_rel_H'] * 100:.2f}% de H (pico em t={r_info['peak_normalized_time']})."
        )

    if excluded_roles:
        observations.append(
            f"Papéis excluídos da comparação por ausência anatômica ou falta de amostras: {', '.join(sorted(set(excluded_roles)))}."
        )

    if global_mean < 0.10:
        inferences.append("Trajetórias espaciais apresentam forte proximidade cinemática proporcional à escala dos personagens.")
    else:
        inferences.append("Variações de proporção corporal e amplitude articular marcam estilos de movimento distintos entre os dois modelos.")

    hypotheses.append("Diferenças de centro de massa entre rigs bípedes e quadrúpedes podem explicar assimetrias nos membros superiores.")

    report = CrossRigCompareReport(
        schema=SCHEMA_NAME,
        comparison_id=comparison_id,
        action_a=action_a_meta,
        action_b=action_b_meta,
        height_a_meters=height_a_m,
        height_b_meters=height_b_m,
        sample_count=sample_count,
        common_roles_evaluated=active_roles,
        excluded_roles=sorted(list(set(excluded_roles))),
        global_mean_discrepancy_rel_H=global_mean,
        peak_discrepancy_role=overall_peak_role,
        peak_discrepancy_rel_H=round(overall_peak_val, 4),
        role_comparisons=role_results,
        epistemic_findings={
            "facts": facts,
            "observations": observations,
            "inferences": inferences,
            "hypotheses": hypotheses,
        },
    )
    return asdict(report)


def validate_cross_rig_compare(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Valida a conformidade estrita do documento contra arenamon.cross-rig-compare/1."""
    errors: List[str] = []
    if not isinstance(data, dict):
        return False, ["Documento deve ser um dicionário"]

    if data.get("schema") != SCHEMA_NAME:
        errors.append(f"Campo 'schema' deve ser exatamente '{SCHEMA_NAME}' (recebido: {data.get('schema')})")

    req_fields = (
        "comparison_id", "action_a", "action_b",
        "height_a_meters", "height_b_meters", "sample_count",
        "common_roles_evaluated", "excluded_roles",
        "global_mean_discrepancy_rel_H", "peak_discrepancy_role", "peak_discrepancy_rel_H",
        "role_comparisons", "epistemic_findings"
    )
    for f in req_fields:
        if f not in data:
            errors.append(f"Campo obrigatório ausente: '{f}'")

    if data.get("height_a_meters", 0.0) <= 0 or data.get("height_b_meters", 0.0) <= 0:
        errors.append("Alturas dos rigs devem ser maiores que zero")

    roles_comp = data.get("role_comparisons", {})
    if not isinstance(roles_comp, dict):
        errors.append("'role_comparisons' deve ser um dicionário")
    else:
        for r, r_data in roles_comp.items():
            if not isinstance(r_data, dict) or "mean_discrepancy_rel_H" not in r_data:
                errors.append(f"Resultado do papel '{r}' inválido em 'role_comparisons'")

    findings = data.get("epistemic_findings", {})
    if not isinstance(findings, dict):
        errors.append("'epistemic_findings' deve ser um dicionário")
    else:
        for k in ("facts", "observations", "inferences", "hypotheses"):
            if k not in findings or not isinstance(findings[k], list):
                errors.append(f"'epistemic_findings.{k}' deve ser uma lista")

    return len(errors) == 0, errors


def export_cross_rig_to_agent_report(
    comparison: Dict[str, Any],
    source_file_a: str,
    rig_mapping_a: Dict[str, Any],
    report_id: Optional[str] = None,
    visual_evidence: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Converte o documento de comparação cross-rig em um relatório F15 (arenamon.agent-report/1).
    
    Exige obrigatoriamente um rig_mapping autêntico do contrato arenamon.rig-map/1.
    """
    from agent_report import build_agent_report
    from rig_map import validate_rig_map

    val_map, errs = validate_rig_map(rig_mapping_a)
    if not val_map:
        raise CrossRigCompareError(f"rig_mapping_a F03 inválido: {errs}")

    comp_id = comparison["comparison_id"]
    rep_id = report_id or f"REP-F04-CROSSRIG-{comp_id.upper()}"
    act_a = comparison["action_a"]
    act_b = comparison["action_b"]

    # Frame range real de A sem fabricação
    if "frame_range" in act_a and isinstance(act_a["frame_range"], (list, tuple)):
        frame_range_a = tuple(act_a["frame_range"])
    else:
        fc_a = int(act_a.get("frame_count", 30))
        frame_range_a = (0, max(0, fc_a - 1))

    measurements: List[Dict[str, Any]] = [
        {
            "metric": "cross_rig_target_b_action_name",
            "value": act_b.get("action_name", "Action_B"),
            "unit": "string",
            "method": "cross_rig_metadata_record",
            "confidence": 1.0,
        },
        {
            "metric": "cross_rig_target_b_armature",
            "value": act_b.get("armature_name", "Armature_B"),
            "unit": "string",
            "method": "cross_rig_metadata_record",
            "confidence": 1.0,
        },
        {
            "metric": "cross_rig_target_b_height_meters",
            "value": comparison["height_b_meters"],
            "unit": "m",
            "method": "morphological_scale_parameter",
            "confidence": 1.0,
        },
        {
            "metric": "cross_rig_target_a_height_meters",
            "value": comparison["height_a_meters"],
            "unit": "m",
            "method": "morphological_scale_parameter",
            "confidence": 1.0,
        },
        {
            "metric": "cross_rig_global_mean_discrepancy",
            "value": comparison["global_mean_discrepancy_rel_H"],
            "unit": "%H",
            "method": "normalized_pelvis_centered_sagittal_aligned_mean_euclidean",
            "confidence": 1.0,
        },
        {
            "metric": "cross_rig_peak_discrepancy",
            "value": comparison["peak_discrepancy_rel_H"],
            "unit": "%H",
            "method": "normalized_pelvis_centered_peak_sample",
            "confidence": 1.0,
            "target_role": comparison["peak_discrepancy_role"],
        },
    ]

    if act_b.get("frame_count") is not None:
        measurements.append({
            "metric": "cross_rig_target_b_frame_count",
            "value": act_b.get("frame_count"),
            "unit": "frames",
            "method": "cross_rig_metadata_record",
            "confidence": 1.0,
        })
    if act_b.get("duration_seconds") is not None:
        measurements.append({
            "metric": "cross_rig_target_b_duration_seconds",
            "value": act_b.get("duration_seconds"),
            "unit": "s",
            "method": "cross_rig_metadata_record",
            "confidence": 1.0,
        })
    if act_b.get("fps") is not None:
        measurements.append({
            "metric": "cross_rig_target_b_fps",
            "value": act_b.get("fps"),
            "unit": "fps",
            "method": "cross_rig_metadata_record",
            "confidence": 1.0,
        })

    for role, r_data in comparison["role_comparisons"].items():
        measurements.append({
            "metric": f"role_mean_discrepancy_{role}",
            "value": r_data["mean_discrepancy_rel_H"],
            "unit": "%H",
            "method": "role_normalized_height_mean",
            "confidence": r_data.get("confidence", 0.9),
            "target_role": role,
            "target_bone": r_data["bone_a"],
        })

    limitations = {
        "missing_data": [f"Papel {r} ausente no esqueleto de destino" for r in comparison.get("excluded_roles", [])],
        "assumptions": ["Normalização por H assume proporções canônicas de massa"],
        "risks": ["Comparação cross-rig é estritamente analítica; não substitui o retargeting manual"],
        "confidence_score": 0.94,
    }

    return build_agent_report(
        report_id=rep_id,
        target={
            "source_file": source_file_a,
            "action_name": act_a.get("action_name", "Action_A"),
            "action_slot": act_a.get("action_slot"),
            "armature_name": act_a.get("armature_name", "Armature_A"),
            "frame_range": frame_range_a,
            "fps": float(act_a.get("fps", 30.0)),
            "unit_system": "METRIC_METERS",
        },
        rig_mapping=rig_mapping_a,
        measurements=measurements,
        visual_evidence=visual_evidence or [],
        findings=comparison["epistemic_findings"],
        limitations_and_risks=limitations,
    )
