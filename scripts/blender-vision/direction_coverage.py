"""Contrato e analisador de Cobertura Direcional em Oito Direções (F01).

Schema: arenamon.direction-coverage/1
Analisa conjuntos de Actions de locomoção e esquiva nas oito direções (N, NE, E, SE, S, SW, W, NW).
Compara poses, trajetórias, orientação da raiz e simetria de pares opostos.

Regras fundamentais:
1. Normalização estrita de identificadores por tokenização exata (sem falsos positivos por substring).
2. Distinção estrita entre semelhança geométrica e funcionamento de runtime:
   A paridade métrica de espelhamento não autoriza afirmar que o motor de jogo usa espelhamento procedural.
3. Não presumir rotação procedural; se a mesma Action for reutilizada, registrar como fato
   e manter a rotação de runtime estritamente como hipótese.
4. Suporte a ciclos de locomoção in-place (sem deslocamento de raiz), avaliando orientação pela pose.
5. Compatibilidade nativa com o contrato F15 (arenamon.agent-report/1) exigindo rig mapping autêntico F03.
"""
from __future__ import annotations

import math
import re
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
    "FRONT": "N",
    "F": "N",
    "NE": "NE",
    "FORWARD_RIGHT": "NE",
    "FRONT_RIGHT": "NE",
    "FR": "NE",
    "E": "E",
    "RIGHT": "E",
    "R": "E",
    "SE": "SE",
    "BACKWARD_RIGHT": "SE",
    "BACK_RIGHT": "SE",
    "BR": "SE",
    "S": "S",
    "BACKWARD": "S",
    "BACK": "S",
    "B": "S",
    "SW": "SW",
    "BACKWARD_LEFT": "SW",
    "BACK_LEFT": "SW",
    "BL": "SW",
    "W": "W",
    "LEFT": "W",
    "L": "W",
    "NW": "NW",
    "FORWARD_LEFT": "NW",
    "FRONT_LEFT": "NW",
    "FL": "NW",
}

SYMMETRY_PAIRS = (
    ("E", "W"),
    ("NE", "NW"),
    ("SE", "SW"),
)

STATUS_PRESENT = "PRESENT"
STATUS_ABSENT = "ABSENT"
STATUS_DEVIATED = "DEVIATED"

RELATION_GEOMETRIC_ASYMMETRY = "GEOMETRIC_ASYMMETRY"
RELATION_INDEPENDENT = RELATION_GEOMETRIC_ASYMMETRY  # Alias de retrocompatibilidade
RELATION_SYMMETRIC_MIRRORED = "SYMMETRIC_MIRRORED"
RELATION_SAME_ACTION_REUSED = "SAME_ACTION_REUSED"
RELATION_DISTINCT_UNMEASURED = "DISTINCT_ACTIONS_UNMEASURED"
RELATION_INCOMPLETE = "INCOMPLETE"


class DirectionCoverageError(Exception):
    pass


def normalize_direction_name(raw: str) -> str:
    """Normaliza identificador ou alias para uma das 8 direções canônicas usando tokenização exata.
    
    Previne categoricamente colisões por substring (ex: 'Run_E' não pode ser casada com 'N'
    apenas porque 'Run' contém a letra 'n').
    """
    clean = raw.strip().upper().replace("-", "_").replace(" ", "_")

    # 1. Correspondência exata da string completa
    if clean in DIRECTION_ALIASES:
        return DIRECTION_ALIASES[clean]

    # 2. Decomposição em tokens delimitados por sublinhado
    tokens = [t for t in clean.split("_") if t]

    # Verifica combinação dos dois últimos tokens (ex: FORWARD_RIGHT, BACK_LEFT)
    if len(tokens) >= 2:
        last_two = f"{tokens[-2]}_{tokens[-1]}"
        if last_two in DIRECTION_ALIASES:
            return DIRECTION_ALIASES[last_two]

    # Verifica o último token isolado (ex: Run_N, Dodge_E, Walk_SW)
    if tokens and tokens[-1] in DIRECTION_ALIASES:
        return DIRECTION_ALIASES[tokens[-1]]

    # Verifica o primeiro token isolado (ex: N_Run, Left_Dodge)
    if tokens and tokens[0] in DIRECTION_ALIASES:
        return DIRECTION_ALIASES[tokens[0]]

    # 3. Busca por token canônico exato delimitado por borda
    for alias in sorted(DIRECTION_ALIASES.keys(), key=len, reverse=True):
        pattern = rf"(^|_){re.escape(alias)}(_|$)"
        if re.search(pattern, clean):
            return DIRECTION_ALIASES[alias]

    raise DirectionCoverageError(
        f"Direção desconhecida: '{raw}'. Opções canônicas válidas: {list(DIRECTION_ANGLES.keys())}"
    )


def calculate_horizontal_angle(dx: float, dy: float, ground_plane: str = "XY") -> float:
    """Calcula o ângulo horizontal no sentido horário em graus [0, 360), onde N=0° (+Y em Blender)."""
    if ground_plane.upper() == "XY":
        angle_rad = math.atan2(dx, dy)
    elif ground_plane.upper() == "XZ":
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
    is_in_place: bool = False
    measured_angle_deg: Optional[float] = None
    angular_deviation_deg: Optional[float] = None
    speed_mps: Optional[float] = None
    duration_seconds: Optional[float] = None
    frame_count: Optional[int] = None
    confidence: float = 1.0
    note: str = ""


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
                note="Nenhuma Action mapeada para esta orientação",
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
        note = ""

        # Detecção de locomoção in-place vs root motion translativo
        is_in_place = False
        horiz_dist = 0.0
        if disp is not None:
            dx, dy = disp[0], disp[1]
            if ground_plane.upper() == "XZ":
                dy = disp[2]
            horiz_dist = math.hypot(dx, dy)
            if horiz_dist < 0.05:
                is_in_place = True

        if item.get("is_in_place", False):
            is_in_place = True

        # Avaliação de orientação
        if is_in_place:
            note = "Ciclo in-place (sem deslocamento de raiz no Blender)."
            # Se fornecida orientação da pose (ex: facing_angle_deg), avalia
            if "facing_angle_deg" in item:
                measured_ang = float(item["facing_angle_deg"])
                ang_dev = round(angular_difference(measured_ang, nom_ang), 2)
                if ang_dev > max_angular_tolerance_deg:
                    status = STATUS_DEVIATED
            elif "measured_angle_deg" in item:
                measured_ang = float(item["measured_angle_deg"])
                ang_dev = round(angular_difference(measured_ang, nom_ang), 2)
                if ang_dev > max_angular_tolerance_deg:
                    status = STATUS_DEVIATED
        elif disp is not None and horiz_dist >= 0.05:
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
            is_in_place=is_in_place,
            measured_angle_deg=measured_ang,
            angular_deviation_deg=ang_dev,
            speed_mps=speed,
            duration_seconds=duration,
            frame_count=frames,
            confidence=1.0 if status == STATUS_PRESENT else 0.85,
            note=note,
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

        custom_pair_data = (
            mapped_inputs.get(dir_a, {}).get("symmetry_with_opposite")
            or mapped_inputs.get(dir_b, {}).get("symmetry_with_opposite")
        )
        mirror_disc = None
        if isinstance(custom_pair_data, (int, float)):
            mirror_disc = float(custom_pair_data)

        if act_a == act_b:
            # Mesma Action mapeada para ambas as direções
            rel_type = RELATION_SAME_ACTION_REUSED
            rationale = f"Mesma Action '{act_a}' associada a direções opostas nos dados."
            conf = 1.0
        elif mirror_disc is not None:
            if mirror_disc <= mirror_similarity_threshold_m:
                rel_type = RELATION_SYMMETRIC_MIRRORED
                rationale = f"Discrepância pós-espelhamento de {mirror_disc:.3f} m (abaixo de {mirror_similarity_threshold_m} m); comprova forte simetria bilateral geométrica."
                conf = 0.95
            else:
                rel_type = RELATION_GEOMETRIC_ASYMMETRY
                rationale = f"Discrepância pós-espelhamento medida de {mirror_disc:.3f} m (acima de {mirror_similarity_threshold_m} m); constata assimetria geométrica entre os lados nos dados analisados."
                conf = 0.95
        else:
            rel_type = RELATION_DISTINCT_UNMEASURED
            rationale = "Actions com identificadores distintos, mas sem medição métrica de espelhamento fornecida."
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
    facts.append(f"A taxa de cobertura direcional é de {ratio * 100:.1f}%.")

    for d in DIRECTIONS_8:
        info = directions_out[d]
        if info["status"] == STATUS_PRESENT:
            if info["is_in_place"]:
                facts.append(f"Direção {d}: Action '{info['action_name']}' é um ciclo in-place.")
            elif info.get("displacement_vector"):
                facts.append(
                    f"Direção {d}: Action '{info['action_name']}' translada raiz em {info['displacement_vector']} m com ângulo medido de {info['measured_angle_deg']}°."
                )
        elif info["status"] == STATUS_DEVIATED:
            observations.append(
                f"Direção {d}: Desvio angular de {info['angular_deviation_deg']}° excede a tolerância de {max_angular_tolerance_deg}°."
            )
        elif info["status"] == STATUS_ABSENT:
            observations.append(f"Direção {d}: Nenhuma Action mapeada neste conjunto.")

    for sym in symmetry_results:
        p_str = f"{sym['pair'][0]}/{sym['pair'][1]}"
        if sym["relation_type"] == RELATION_SYMMETRIC_MIRRORED:
            inferences.append(f"Par {p_str}: Semelhança geométrica estrita pós-espelhamento comprova simetria bilateral de malha/esqueleto.")
        elif sym["relation_type"] == RELATION_GEOMETRIC_ASYMMETRY:
            observations.append(f"Par {p_str}: Discrepância geométrica medida de {sym['mirror_discrepancy_m']:.3f} m pós-espelhamento constata assimetria entre os lados.")
        elif sym["relation_type"] == RELATION_SAME_ACTION_REUSED:
            hypotheses.append(f"Par {p_str}: A mesma Action '{sym['action_a']}' pode ser orientada por rotação procedural no motor de jogo.")
        elif sym["relation_type"] == RELATION_DISTINCT_UNMEASURED:
            observations.append(f"Par {p_str}: Actions distintas ('{sym['action_a']}' vs '{sym['action_b']}'); diferença geométrica não medida.")

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
    rig_mapping: Dict[str, Any],
    reference_direction: Optional[str] = None,
    fps: float = 30.0,
    report_id: Optional[str] = None,
    visual_evidence: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Converte o documento de cobertura direcional em um relatório F15 (arenamon.agent-report/1).
    
    Preserva a proveniência temporal exata: o target referencia uma Action real do conjunto
    (por padrão a direção de referência 'N' ou a primeira presente), e os metadados de cada
    uma das demais Actions são registrados individualmente em measurements sem fabricação.
    """
    from agent_report import build_agent_report
    from rig_map import validate_rig_map

    val_map, errs = validate_rig_map(rig_mapping)
    if not val_map:
        raise DirectionCoverageError(f"rig_mapping F03 inválido: {errs}")

    set_id = coverage["set_id"]
    armature = coverage["armature_name"]
    rep_id = report_id or f"REP-F01-DIR-COVERAGE-{set_id.upper()}"

    # Identifica a Action de referência primária real no conjunto
    ref_dir = reference_direction or "N"
    ref_info = coverage["directions"].get(ref_dir)
    if not ref_info or ref_info["status"] == STATUS_ABSENT:
        # Pega a primeira direção presente
        for d in DIRECTIONS_8:
            if coverage["directions"][d]["status"] != STATUS_ABSENT:
                ref_dir = d
                ref_info = coverage["directions"][d]
                break

    if not ref_info or ref_info["status"] == STATUS_ABSENT:
        raise DirectionCoverageError("O conjunto direcional não possui nenhuma Action presente para referência temporal")

    ref_act_name = ref_info["action_name"] or f"Action_{ref_dir}"
    ref_fps = float(ref_info.get("fps") or fps)
    ref_f_count = int(ref_info.get("frame_count") or 30)
    ref_frame_range = (0, max(0, ref_f_count - 1))

    measurements: List[Dict[str, Any]] = [
        {
            "metric": "direction_set_id",
            "value": set_id,
            "unit": "id",
            "method": "directional_collection_identifier",
            "confidence": 1.0,
        },
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

    # Registra a proveniência temporal e cinemática individual de cada Action
    for d in DIRECTIONS_8:
        info = coverage["directions"][d]
        if info["status"] != STATUS_ABSENT:
            act_n = info["action_name"]
            fc = info.get("frame_count")
            dur = info.get("duration_seconds")
            speed = info.get("speed_mps")
            inp = info.get("is_in_place", False)

            measurements.append({
                "metric": f"action_metadata_{d}_name",
                "value": act_n,
                "unit": "string",
                "method": "action_provenance_record",
                "confidence": 1.0,
            })
            if fc is not None:
                measurements.append({
                    "metric": f"action_metadata_{d}_frame_count",
                    "value": fc,
                    "unit": "frames",
                    "method": "action_header_extraction",
                    "confidence": 1.0,
                })
            if dur is not None:
                measurements.append({
                    "metric": f"action_metadata_{d}_duration_seconds",
                    "value": dur,
                    "unit": "s",
                    "method": "action_header_extraction",
                    "confidence": 1.0,
                })
            measurements.append({
                "metric": f"action_metadata_{d}_is_in_place",
                "value": inp,
                "unit": "bool",
                "method": "root_displacement_threshold_test",
                "confidence": 1.0,
            })
            if speed is not None:
                measurements.append({
                    "metric": f"root_speed_direction_{d}",
                    "value": speed,
                    "unit": "m/s",
                    "method": "root_fcurve_average_velocity",
                    "confidence": info.get("confidence", 0.9),
                    "target_role": "root",
                })

    limitations = {
        "missing_data": [f"Direção {d} ausente no conjunto" for d, inf in coverage["directions"].items() if inf["status"] == STATUS_ABSENT],
        "assumptions": ["Deslocamento de raiz reflete velocidade horizontal média pretendida"],
        "risks": ["Semelhança de espelhamento não garante comportamento idêntico de colisores no combate"],
        "confidence_score": 0.95,
    }

    return build_agent_report(
        report_id=rep_id,
        target={
            "source_file": source_file,
            "action_name": ref_act_name,
            "action_slot": None,
            "armature_name": armature,
            "frame_range": ref_frame_range,
            "fps": ref_fps,
            "unit_system": "METRIC_METERS",
        },
        rig_mapping=rig_mapping,
        measurements=measurements,
        visual_evidence=visual_evidence or [],
        findings=coverage["epistemic_findings"],
        limitations_and_risks=limitations,
    )
