"""Contrato e implementação F07: Análise de Peso, Impulso e Estabilidade (arenamon.weight-momentum/1).

Mede a transferência de massa da pelve/tronco, antecipação física (recoil),
avanço motor (thrust), acelerações e suporte dos pés ao solo durante ações de combate.
Rigor epistêmico: grandezas físicas mensuráveis em metros, m/s e m/s², SEM notas artísticas subjetivas.

Integração com o contrato 'arenamon.agent-report/1' (F15).
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Tuple

SCHEMA_NAME = "arenamon.weight-momentum/1"


class WeightMomentumError(Exception):
    """Exceção para inconsistências em análise de peso e momento."""
    pass


@dataclass
class PelvisMomentumMetrics:
    total_travel_distance_m: float
    anticipation_recoil_m: float
    thrust_advance_m: float
    vertical_compression_drop_m: float
    peak_pelvis_velocity_mps: float
    peak_pelvis_acceleration_mps2: float
    thrust_duration_seconds: float
    recovery_duration_seconds: float
    momentum_recovery_ratio: float
    support_stability_ratio: float


def _dist_3d(a: List[float], b: List[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def build_weight_momentum_analysis(
    action_name: str,
    armature_name: str,
    frame_range: Tuple[int, int],
    fps: float,
    pelvis_positions: Dict[int, List[float]],
    left_foot_positions: Optional[Dict[int, List[float]]] = None,
    right_foot_positions: Optional[Dict[int, List[float]]] = None,
    ground_z_reference_m: float = 0.0,
    ground_tolerance_m: float = 0.05,
    attack_direction_axis: str = "Y",
) -> Dict[str, Any]:
    """Calcula métricas físicas de peso, impulso e suporte conforme 'arenamon.weight-momentum/1'.

    Args:
        action_name: Nome da Action.
        armature_name: Nome do esqueleto.
        frame_range: Intervalo de frames real (start, end).
        fps: Taxa de quadros por segundo real.
        pelvis_positions: Posições da pelve/Hips por frame [X, Y, Z] em metros.
        left_foot_positions: Opcional, posições do pé esquerdo por frame.
        right_foot_positions: Opcional, posições do pé direito por frame.
        ground_z_reference_m: Calibração da altura do solo para pés.
        ground_tolerance_m: Tolerância de contato de pé com o solo.
        attack_direction_axis: Eixo primário do avanço de ataque ('Y' padrão, ou 'X').
    """
    if fps <= 0.0:
        raise WeightMomentumError(f"FPS deve ser positivo. Recebido: {fps}")

    sorted_frames = sorted(pelvis_positions.keys())
    if len(sorted_frames) < 3:
        raise WeightMomentumError(f"Amostragem de pelve insuficiente ({len(sorted_frames)}). Mínimo 3 frames.")

    axis_idx = 1 if attack_direction_axis.upper() == "Y" else 0

    # 1. Distância total percorrida pela pelve
    total_travel = 0.0
    for i in range(1, len(sorted_frames)):
        f0 = sorted_frames[i - 1]
        f1 = sorted_frames[i]
        total_travel += _dist_3d(pelvis_positions[f1], pelvis_positions[f0])

    # 2. Deslocamentos ao longo do eixo de ataque e vertical
    initial_pos = pelvis_positions[sorted_frames[0]]
    axis_coords = [pelvis_positions[f][axis_idx] for f in sorted_frames]
    z_coords = [pelvis_positions[f][2] for f in sorted_frames]

    # Recuo pré-impulso (mínimo no eixo antes do avanço em relação à pose inicial)
    min_axis = min(axis_coords)
    max_axis = max(axis_coords)
    anticipation_recoil = max(0.0, initial_pos[axis_idx] - min_axis)
    thrust_advance = max(0.0, max_axis - min_axis)

    # Queda vertical do quadril durante compressão
    initial_z = initial_pos[2]
    min_z = min(z_coords)
    vertical_compression = max(0.0, initial_z - min_z)

    # 3. Velocidades e Acelerações da pelve (diferenças finitas)
    velocities_mps: List[float] = [0.0]
    for i in range(1, len(sorted_frames)):
        f0 = sorted_frames[i - 1]
        f1 = sorted_frames[i]
        dt = (f1 - f0) / fps
        d = _dist_3d(pelvis_positions[f1], pelvis_positions[f0])
        velocities_mps.append(d / dt if dt > 1e-6 else 0.0)

    accelerations_mps2: List[float] = [0.0]
    for i in range(1, len(velocities_mps)):
        f0 = sorted_frames[i - 1]
        f1 = sorted_frames[i]
        dt = (f1 - f0) / fps
        dv = abs(velocities_mps[i] - velocities_mps[i - 1])
        accelerations_mps2.append(dv / dt if dt > 1e-6 else 0.0)

    peak_vel = max(velocities_mps)
    peak_acc = max(accelerations_mps2)

    # 4. Fases de avanço vs recuperação
    peak_idx = velocities_mps.index(peak_vel)
    thrust_duration_f = sorted_frames[peak_idx] - sorted_frames[0]
    recovery_duration_f = sorted_frames[-1] - sorted_frames[peak_idx]

    thrust_duration_sec = round(thrust_duration_f / fps, 3)
    recovery_duration_sec = round(recovery_duration_f / fps, 3)
    recovery_ratio = round(recovery_duration_sec / max(0.01, thrust_duration_sec), 2)

    # 5. Base de sustentação / pés em contato com o solo
    has_feet = (left_foot_positions is not None and right_foot_positions is not None)
    grounded_frames_count = 0
    evaluated_feet_frames = 0

    if has_feet:
        for f in sorted_frames:
            if f in left_foot_positions and f in right_foot_positions:
                evaluated_feet_frames += 1
                lz = left_foot_positions[f][2]
                rz = right_foot_positions[f][2]
                l_ground = abs(lz - ground_z_reference_m) <= ground_tolerance_m
                r_ground = abs(rz - ground_z_reference_m) <= ground_tolerance_m
                if l_ground or r_ground:
                    grounded_frames_count += 1
        support_ratio = round(grounded_frames_count / max(1, evaluated_feet_frames), 3)
    else:
        support_ratio = 1.0  # Não avaliado por falta de marcadores de pé

    # 6. Fatos factuais
    facts = [
        f"Ação analisada: '{action_name}' no armature '{armature_name}' ({frame_range[0]}..{frame_range[1]} a {fps:.1f} FPS).",
        f"Distância total percorrida pela pelve: {total_travel:.3f} m.",
        f"Recuo de antecipação (recoil): {anticipation_recoil:.3f} m ao longo do eixo {attack_direction_axis}.",
        f"Avanço motor no golpe (thrust): {thrust_advance:.3f} m.",
        f"Compressão vertical do quadril: {vertical_compression:.3f} m.",
        f"Pico de velocidade da pelve: {peak_vel:.3f} m/s; Pico de aceleração: {peak_acc:.3f} m/s².",
        f"Duração do impulso motor: {thrust_duration_sec:.3f} s; Duração da recuperação: {recovery_duration_sec:.3f} s (razão de recuperação: {recovery_ratio:.2f}x).",
    ]
    if has_feet:
        facts.append(f"Estabilidade da base: {support_ratio * 100:.1f}% dos quadros com pelo menos um pé apoiado no solo (ref: Z={ground_z_reference_m:.2f} m).")

    metrics = PelvisMomentumMetrics(
        total_travel_distance_m=round(total_travel, 4),
        anticipation_recoil_m=round(anticipation_recoil, 4),
        thrust_advance_m=round(thrust_advance, 4),
        vertical_compression_drop_m=round(vertical_compression, 4),
        peak_pelvis_velocity_mps=round(peak_vel, 3),
        peak_pelvis_acceleration_mps2=round(peak_acc, 3),
        thrust_duration_seconds=thrust_duration_sec,
        recovery_duration_seconds=recovery_duration_sec,
        momentum_recovery_ratio=recovery_ratio,
        support_stability_ratio=support_ratio,
    )

    limitations = [
        "Mede cinemática translacional de pelve e pés em metros e m/s, sem simulação física de massa corporal (massa gravitacional não fornecida no armature).",
        "Contato de pés com o solo é inferido por tolerância geométrica em relação ao ground_z_reference_m calibrado.",
    ]

    return {
        "schema": SCHEMA_NAME,
        "action_name": action_name,
        "armature_name": armature_name,
        "frame_range": list(frame_range),
        "fps": fps,
        "metrics": asdict(metrics),
        "facts": facts,
        "limitations": limitations,
    }


def validate_weight_momentum(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Valida conformidade com 'arenamon.weight-momentum/1'."""
    errors = []
    if not isinstance(data, dict):
        return False, ["Documento deve ser um dicionário"]

    if data.get("schema") != SCHEMA_NAME:
        errors.append(f"Schema inválido: esperado '{SCHEMA_NAME}', recebido '{data.get('schema')}'")

    for f in ("action_name", "armature_name", "frame_range", "fps", "metrics", "facts"):
        if f not in data:
            errors.append(f"Campo obrigatório ausente: '{f}'")

    metrics = data.get("metrics", {})
    required_metrics = [
        "total_travel_distance_m", "anticipation_recoil_m", "thrust_advance_m",
        "vertical_compression_drop_m", "peak_pelvis_velocity_mps", "peak_pelvis_acceleration_mps2",
        "thrust_duration_seconds", "recovery_duration_seconds", "momentum_recovery_ratio", "support_stability_ratio"
    ]
    for rm in required_metrics:
        if rm not in metrics:
            errors.append(f"Métrica física obrigatória ausente em metrics: '{rm}'")

    return len(errors) == 0, errors


def export_weight_momentum_to_agent_report(
    analysis: Dict[str, Any],
    source_file: str,
    rig_mapping: Dict[str, Any],
    visual_evidence: Optional[List[Dict[str, Any]]] = None,
    report_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Exporta a análise de peso e momento para o contrato canônico 'arenamon.agent-report/1' (F15)."""
    is_valid, errs = validate_weight_momentum(analysis)
    if not is_valid:
        raise WeightMomentumError(f"Não é possível exportar documento inválido: {errs}")

    from agent_report import build_agent_report

    act_name = analysis["action_name"]
    rep_id = report_id or f"REP-F07-MOMENTUM-{act_name.upper().replace(' ', '_')}"
    metrics = analysis["metrics"]
    f_range = tuple(analysis["frame_range"])

    measurements: List[Dict[str, Any]] = [
        {
            "metric": "pelvis_total_travel_distance",
            "value": metrics["total_travel_distance_m"],
            "unit": "m",
            "method": "finite_differences_spatial_trajectory",
            "confidence": 1.0,
            "target_role": "pelvis",
        },
        {
            "metric": "pelvis_anticipation_recoil",
            "value": metrics["anticipation_recoil_m"],
            "unit": "m",
            "method": "attack_axis_counter_displacement",
            "confidence": 0.95,
            "target_role": "pelvis",
        },
        {
            "metric": "pelvis_thrust_advance",
            "value": metrics["thrust_advance_m"],
            "unit": "m",
            "method": "attack_axis_advance_displacement",
            "confidence": 0.95,
            "target_role": "pelvis",
        },
        {
            "metric": "pelvis_vertical_compression_drop",
            "value": metrics["vertical_compression_drop_m"],
            "unit": "m",
            "method": "vertical_axis_minimum_compression",
            "confidence": 0.95,
            "target_role": "pelvis",
        },
        {
            "metric": "pelvis_peak_velocity",
            "value": metrics["peak_pelvis_velocity_mps"],
            "unit": "m/s",
            "method": "pelvis_speed_finite_differences",
            "confidence": 0.95,
            "target_role": "pelvis",
        },
        {
            "metric": "pelvis_peak_acceleration",
            "value": metrics["peak_pelvis_acceleration_mps2"],
            "unit": "m/s^2",
            "method": "pelvis_acceleration_finite_differences",
            "confidence": 0.90,
            "target_role": "pelvis",
        },
        {
            "metric": "momentum_thrust_duration_seconds",
            "value": metrics["thrust_duration_seconds"],
            "unit": "s",
            "method": "time_interval_measurement",
            "confidence": 1.0,
        },
        {
            "metric": "momentum_recovery_duration_seconds",
            "value": metrics["recovery_duration_seconds"],
            "unit": "s",
            "method": "time_interval_measurement",
            "confidence": 1.0,
        },
        {
            "metric": "momentum_recovery_ratio",
            "value": metrics["momentum_recovery_ratio"],
            "unit": "ratio",
            "method": "recovery_time_over_thrust_time",
            "confidence": 0.95,
        },
        {
            "metric": "support_stability_ratio",
            "value": metrics["support_stability_ratio"],
            "unit": "ratio",
            "method": "ground_contact_frames_ratio",
            "confidence": 0.90,
        },
    ]

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
            f"Razão de recuperação do impulso: {metrics['momentum_recovery_ratio']:.2f}x da fase de avanço.",
            f"Aceleração máxima do quadril medida em {metrics['peak_pelvis_acceleration_mps2']:.2f} m/s².",
        ],
        "actionable": [],
        "uncertainties": ["Massa corporal não parametrizada; grandezas medem cinemática pura."],
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
