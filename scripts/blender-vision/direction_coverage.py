"""Contrato e analisador de Cobertura Direcional em Oito Direções (F01).

Schema: arenamon.direction-coverage/1
Analisa conjuntos de Actions de locomoção e esquiva nas oito direções (N, NE, E, SE, S, SW, W, NW).
Compara poses, trajetórias, orientação da raiz e simetria de pares opostos.

Regras fundamentais:
1. Distinção estrita entre semelhança geométrica e funcionamento de runtime:
   A paridade métrica de espelhamento não autoriza afirmar que o motor de jogo usa espelhamento procedural.
2. Não presumir rotação procedural sem prova de runtime.
3. Tratamento explícito de coberturas assimétricas ou incompletas (ex: 4 direções, 1 direção, etc.).
4. Compatibilidade nativa com o contrato F15 (arenamon.agent-report/1).
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

SCHEMA_NAME = "arenamon.direction-coverage/1"

DIRECTIONS_8 = ("N", "NE", "E", "SE", "S", "SW", "W", "NW")

DIRECTION_ANGLES: Dict[str, float] = {
    "N": 0.0,
    "NE": 45.0,
    "E": 90.0,
    "SE": 135.0,
    "S": 180.0,
    "SW": 225.0,
    "W": 270.0,
    "NW": 315.0,
}

DIRECTION_ALIASES: Dict[str, str] = {
    "N": "N",
    "FORWARD": "N",
    "F": "N",
    "FRONT": "N",
    "NE": "NE",
    "FORWARD_RIGHT": "NE",
    "FR": "NE",
    "FRONT_RIGHT": "NE",
    "E": "E",
    "RIGHT": "E",
    "R": "E",
    "SE": "SE",
    "BACKWARD_RIGHT": "SE",
    "BR": "SE",
    "BACK_RIGHT": "SE",
    "S": "S",
    "BACKWARD": "S",
    "B": "S",
    "BACK": "S",
    "SW": "SW",
    "BACKWARD_LEFT": "SW",
    "BL": "SW",
    "BACK_LEFT": "SW",
    "W": "W",
    "LEFT": "W",
    "L": "W",
    "NW": "NW",
    "FORWARD_LEFT": "NW",
    "FL": "NW",
    "FRONT_LEFT": "NW",
}

SYMMETRY_PAIRS = (
    ("E", "W"),
    ("NE", "NW"),
    ("SE", "SW"),
)

STATUS_PRESENT = "PRESENT"
STATUS_ABSENT = "ABSENT"
STATUS_DEVIATED = "DEVIATED"

RELATION_INDEPENDENT = "INDEPENDENT_AUTHORIAL"
RELATION_SYMMETRIC_MIRRORED = "SYMMETRIC_MIRRORED"
RELATION_RUNTIME_ROTATED = "RUNTIME_ROTATED"
RELATION_INCOMPLETE = "INCOMPLETE"


class DirectionCoverageError(Exception):
    pass


def normalize_direction_name(raw: str) -> str:
    """Normaliza identificador ou alias para uma das 8 direções canônicas."""
    clean = raw.strip().upper().replace("-", "_").replace(" ", "_")
    if clean in DIRECTION_ALIASES:
        return DIRECTION_ALIASES[clean]
    for alias, canon in DIRECTION_ALIASES.items():
        if alias in clean:
            return canon
    raise DirectionCoverageError(f"Direção desconhecida: '{raw}'. Opções válidas: {list(DIRECTION_ANGLES.keys())}")


def calculate_horizontal_angle(dx: float, dy: float, ground_plane: str = "XY") -> float:
    """Calcula o ângulo horizontal no sentido horário em graus [0, 360), onde N=0° (+Y em Blender)."""
    # Blender XY: Frente é +Y (0°), Direita é +X (90°), Trás é -Y (180°), Esquerda é -X (270°)
    if ground_plane.upper() == "XY":
        angle_rad = math.atan2(dx, dy)
    elif ground_plane.upper() == "XZ":
        # Three.js / OpenGL XZ: Frente é -Z ou +Z dependendo da convenção. Se Frente=-Z e Direita=+X:
        angle_rad = math.atan2(dx, -dy)
    else:
        raise DirectionCoverageError(f"Plano de solo inválido: '{ground_plane}'. Use 'XY' ou 'XZ'.")

    deg = math.degrees(angle_rad)
    return (deg + 360.0) % 360.0


def angular_difference(a: float, b: float) -> float:
    """Calcula a menor distância angular em graus [0, 180] entre dois ângulos."""
    diff = abs(a - b) % 360.0
    return 360.0 - diff if diff > 180.0 else diff


@dataclass
class DirectionEntry:
    direction: str
    nominal_angle_deg: float
    status: str
    action_name: Optional[str] = None
    displacement_vector: Optional[Tuple[float, float, float]] = None
    measured_angle_deg: Optional[float] = None
    angular_deviation_deg: Optional[float] = None
    speed_mps: Optional[float] = None
    duration_seconds: Optional[float] = None
    frame_count: Optional[int] = None
    confidence: float = 1.0


@dataclass
class SymmetryPairAnalysis:
    pair: Tuple[str, str]
    action_a: Optional[str]
    action_b: Optional[str]
    relation_type: str
    mirror_discrepancy_m: Optional[float]
    confidence: float
    rationale: str


@dataclass
class DirectionCoverageReport:
    schema: str
    set_id: str
    armature_name: str
    ground_plane: str
    coverage_count: int
    coverage_ratio: float
    directions: Dict[str, Dict[str, Any]]
    symmetry_pairs: List[Dict[str, Any]]
    epistemic_findings: Dict[str, List[str]]


def build_direction_coverage_analysis(
    set_id: str,
    armature_name: str,
    actions_by_direction: Dict[str, Dict[str, Any]],
    ground_plane: str = "XY",
    max_angular_tolerance_deg: float = 25.0,
    mirror_similarity_threshold_m: float = 0.05,
) -> Dict[str, Any]:
    """Constrói análise completa de cobertura nas 8 direções com rigor epistêmico."""
    if not set_id or not isinstance(set_id, str):
        raise DirectionCoverageError("set_id deve ser string não-vazia")
    if not armature_name or not isinstance(armature_name, str):
        raise DirectionCoverageError("armature_name deve ser string não-vazia")

    # Mapeia as entradas fornecidas para direções canônicas
    mapped_inputs: Dict[str, Dict[str, Any]] = {}
    for raw_dir, data in actions_by_direction.items():
        canon = normalize_direction_name(raw_dir)
        mapped_inputs[canon] = data

    directions_out: Dict[str, Dict[str, Any]] = {}
    present_count = 0
    facts: List[str] = []
    observations: List[str] = []
    inferences: List[str] = []
    hypotheses: List[str] = []

    for d in DIRECTIONS_8:
        nom_ang = DIRECTION_ANGLES[d]
        if d not in mapped_inputs:
            entry = DirectionEntry(
                direction=d,
                nominal_angle_deg=nom_ang,
                status=STATUS_ABSENT,
                confidence=1.0,
            )
            directions_out[d] = asdict(entry)
            continue

        item = mapped_inputs[d]
        act_name = item.get("action_name", f"Action_{d}")
        disp = item.get("displacement_vector")
        fps = float(item.get("fps", 30.0))
        frames = item.get("frame_count")
        duration = item.get("duration_seconds")
        if duration is None and frames is not None and fps > 0:
            duration = frames / fps

        measured_ang = None
        ang_dev = None
        speed = None
        status = STATUS_PRESENT

        if disp is not None:
            dx, dy = disp[0], disp[1]
            # Se for plano XZ, Y é Z no vetor tridimensional
            if ground_plane.upper() == "XZ":
                dy = disp[2]
            horiz_dist = math.hypot(dx, dy)
            if horiz_dist > 0.01:
                measured_ang = round(calculate_horizontal_angle(dx, dy, ground_plane), 2)
                ang_dev = round(angular_difference(measured_ang, nom_ang), 2)
                if ang_dev > max_angular_tolerance_deg:
                    status = STATUS_DEVIATED
            if duration and duration > 0:
                speed = round(horiz_dist / duration, 3)

        present_count += 1
        entry = DirectionEntry(
            direction=d,
            nominal_angle_deg=nom_ang,
            status=status,
            action_name=act_name,
            displacement_vector=tuple(disp) if disp else None,
            measured_angle_deg=measured_ang,
            angular_deviation_deg=ang_dev,
            speed_mps=speed,
            duration_seconds=duration,
            frame_count=frames,
            confidence=1.0 if status == STATUS_PRESENT else 0.85,
        )
        directions_out[d] = asdict(entry)

    # Análise de simetria de pares opostos
    symmetry_results: List[Dict[str, Any]] = []
    for dir_a, dir_b in SYMMETRY_PAIRS:
        entry_a = directions_out.get(dir_a)
        entry_b = directions_out.get(dir_b)
        act_a = entry_a.get("action_name") if entry_a and entry_a["status"] != STATUS_ABSENT else None
        act_b = entry_b.get("action_name") if entry_b and entry_b["status"] != STATUS_ABSENT else None

        if not act_a or not act_b:
            pair_res = SymmetryPairAnalysis(
                pair=(dir_a, dir_b),
                action_a=act_a,
                action_b=act_b,
                relation_type=RELATION_INCOMPLETE,
                mirror_discrepancy_m=None,
                confidence=1.0,
                rationale=f"Par incompleto: {dir_a}={'presente' if act_a else 'ausente'}, {dir_b}={'presente' if act_b else 'ausente'}",
            )
            symmetry_results.append(asdict(pair_res))
            continue

        # Verifica se foi fornecida medição métrica explícita de discrepância pós-espelhamento
        pair_key = f"{dir_a}_{dir_b}"
        pair_key_rev = f"{dir_b}_{dir_a}"
        custom_pair_data = (
            mapped_inputs.get(dir_a, {}).get("symmetry_with_opposite")
            or mapped_inputs.get(dir_b, {}).get("symmetry_with_opposite")
        )
        mirror_disc = None
        if isinstance(custom_pair_data, (int, float)):
            mirror_disc = float(custom_pair_data)

        if act_a == act_b:
            # Mesma Action mapeada para ambas as direções
            rel_type = RELATION_RUNTIME_ROTATED
            rationale = f"Mesma Action '{act_a}' associada a direções opostas; rotação em tempo de execução."
            conf = 0.95
        elif mirror_disc is not None and mirror_disc <= mirror_similarity_threshold_m:
            rel_type = RELATION_SYMMETRIC_MIRRORED
            rationale = f"Discrepância pós-espelhamento de {mirror_disc:.3f} m (abaixo de {mirror_similarity_threshold_m} m); indica forte simetria bilateral geométrica."
            conf = 0.90
        elif mirror_disc is not None:
            rel_type = RELATION_INDEPENDENT
            rationale = f"Discrepância pós-espelhamento de {mirror_disc:.3f} m; denota autoria de movimento independente entre os lados."
            conf = 0.90
        else:
            rel_type = RELATION_INDEPENDENT
            rationale = "Actions com identificadores distintos sem espelhamento demonstrado nos dados."
            conf = 0.80

        pair_res = SymmetryPairAnalysis(
            pair=(dir_a, dir_b),
            action_a=act_a,
            action_b=act_b,
            relation_type=rel_type,
            mirror_discrepancy_m=mirror_disc,
            confidence=conf,
            rationale=rationale,
        )
        symmetry_results.append(asdict(pair_res))

    # Construção da taxonomia epistêmica estrita
    facts.append(f"O conjunto '{set_id}' possui {present_count} de 8 direções mapeadas no armature '{armature_name}'.")
    ratio = round(present_count / 8.0, 3)
    facts.append(f"A taxa de cobertura direcional e de {ratio * 100:.1f}%.")

    for d in DIRECTIONS_8:
        info = directions_out[d]
        if info["status"] == STATUS_PRESENT and info.get("displacement_vector"):
            facts.append(
                f"Direcao {d}: Action '{info['action_name']}' translada raiz em {info['displacement_vector']} m com angulo medido de {info['measured_angle_deg']}° (nominal {info['nominal_angle_deg']}°)."
            )
        elif info["status"] == STATUS_DEVIATED:
            observations.append(
                f"Direcao {d}: Desvio angular de {info['angular_deviation_deg']}° excede a tolerancia de {max_angular_tolerance_deg}°."
            )
        elif info["status"] == STATUS_ABSENT:
            observations.append(f"Direcao {d}: Nenhuma Action mapeada neste conjunto.")

    for sym in symmetry_results:
        p_str = f"{sym['pair'][0]}/{sym['pair'][1]}"
        if sym["relation_type"] == RELATION_SYMMETRIC_MIRRORED:
            inferences.append(f"Par {p_str}: Semelhança geométrica estrita sugere espelhamento de malha/esqueleto.")
        elif sym["relation_type"] == RELATION_INDEPENDENT:
            inferences.append(f"Par {p_str}: Assimetrias detectadas indicam desenvolvimento coreográfico autoral para cada lado.")
        elif sym["relation_type"] == RELATION_RUNTIME_ROTATED:
            hypotheses.append(f"Par {p_str}: O runtime pode estar aplicando rotação orientada sobre a mesma Action básica.")

    report = DirectionCoverageReport(
        schema=SCHEMA_NAME,
        set_id=set_id,
        armature_name=armature_name,
        ground_plane=ground_plane,
        coverage_count=present_count,
        coverage_ratio=ratio,
        directions=directions_out,
        symmetry_pairs=symmetry_results,
        epistemic_findings={
            "facts": facts,
            "observations": observations,
            "inferences": inferences,
            "hypotheses": hypotheses,
        },
    )
    return asdict(report)


def validate_direction_coverage(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Valida a conformidade estrita do documento contra arenamon.direction-coverage/1."""
    errors: List[str] = []
    if not isinstance(data, dict):
        return False, ["Documento deve ser um dicionário"]

    if data.get("schema") != SCHEMA_NAME:
        errors.append(f"Campo 'schema' deve ser exatamente '{SCHEMA_NAME}' (recebido: {data.get('schema')})")

    for req_field in ("set_id", "armature_name", "ground_plane", "coverage_count", "coverage_ratio", "directions", "symmetry_pairs", "epistemic_findings"):
        if req_field not in data:
            errors.append(f"Campo obrigatório ausente: '{req_field}'")

    directions = data.get("directions", {})
    if not isinstance(directions, dict):
        errors.append("'directions' deve ser um dicionário")
    else:
        for d in DIRECTIONS_8:
            if d not in directions:
                errors.append(f"Direção canônica ausente em 'directions': '{d}'")
            else:
                entry = directions[d]
                if entry.get("status") not in (STATUS_PRESENT, STATUS_ABSENT, STATUS_DEVIATED):
                    errors.append(f"Status inválido na direção '{d}': {entry.get('status')}")

    syms = data.get("symmetry_pairs", [])
    if not isinstance(syms, list):
        errors.append("'symmetry_pairs' deve ser uma lista")

    findings = data.get("epistemic_findings", {})
    if not isinstance(findings, dict):
        errors.append("'epistemic_findings' deve ser um dicionário")
    else:
        for key in ("facts", "observations", "inferences", "hypotheses"):
            if key not in findings or not isinstance(findings[key], list):
                errors.append(f"'epistemic_findings.{key}' deve ser uma lista de strings")

    return len(errors) == 0, errors


def export_direction_coverage_to_agent_report(
    coverage: Dict[str, Any],
    source_file: str,
    rig_mapping: Optional[Dict[str, Any]] = None,
    fps: float = 30.0,
    report_id: Optional[str] = None,
    visual_evidence: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Converte o documento de cobertura direcional em um relatório F15 (arenamon.agent-report/1)."""
    from agent_report import build_agent_report
    from rig_map import build_rig_map

    set_id = coverage["set_id"]
    armature = coverage["armature_name"]
    rep_id = report_id or f"REP-F01-DIR-COVERAGE-{set_id.upper()}"

    active_rig_map = rig_mapping or build_rig_map(
        bone_names=["Root", "Hips"],
        rig_id=f"rig_{armature.lower()}",
        armature_name=armature
    )

    measurements: List[Dict[str, Any]] = [
        {
            "metric": "direction_coverage_count",
            "value": coverage["coverage_count"],
            "unit": "directions",
            "method": "directional_action_mapping",
            "confidence": 1.0,
        },
        {
            "metric": "direction_coverage_ratio",
            "value": coverage["coverage_ratio"],
            "unit": "ratio",
            "method": "directional_action_mapping",
            "confidence": 1.0,
        },
    ]

    for d, info in coverage["directions"].items():
        if info["status"] != STATUS_ABSENT and info.get("speed_mps") is not None:
            measurements.append({
                "metric": f"root_speed_direction_{d}",
                "value": info["speed_mps"],
                "unit": "m/s",
                "method": "root_fcurve_average_velocity",
                "confidence": info.get("confidence", 0.9),
                "target_role": "root",
            })

    limitations = {
        "missing_data": [f"Direcao {d} ausente no conjunto" for d, inf in coverage["directions"].items() if inf["status"] == STATUS_ABSENT],
        "assumptions": ["Deslocamento de raiz reflete velocidade horizontal média pretendida"],
        "risks": ["Semelhança de espelhamento não garante comportamento idêntico de colisores no combate"],
        "confidence_score": 0.95,
    }

    return build_agent_report(
        report_id=rep_id,
        target={
            "source_file": source_file,
            "action_name": f"{set_id}_8way_blend",
            "action_slot": None,
            "armature_name": armature,
            "frame_range": [0, 30],
            "fps": fps,
            "unit_system": "METRIC_METERS",
        },
        rig_mapping=active_rig_map,
        measurements=measurements,
        visual_evidence=visual_evidence or [],
        findings=coverage["epistemic_findings"],
        limitations_and_risks=limitations,
    )
