"""Contrato e validador de Relatório Estruturado para Agentes de IA (F15).

Schema: arenamon.agent-report/1
Formato padronizado consumível por Claude, Codex e Antigravity.
Registra de forma rastreável: fontes, medições, papéis anatômicos (F03),
evidências visuais verificáveis, taxonomia epistêmica e propostas não-executadas.

Regras fundamentais:
1. Taxonomia epistêmica estrita: separação entre fatos, observações, inferências e hipóteses.
2. Não-aplicação automática: o campo 'applied' em proposed_corrections é estritamente False.
3. Rastreabilidade de evidência: imagens e folhas devem possuir caminhos e hashes verificáveis.
4. Respeito à temporalidade e unidades: frames, FPS, duração em segundos e unidades explícitas.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

SCHEMA_NAME = "arenamon.agent-report/1"

GENERIC_BANNED_PHRASES = [
    r"\best[aá] fluid",
    r"\bimpacto (est[aá] )?forte",
    r"\bparece (bom|bem|ok)",
    r"\bficou (bom|bem|[oó]timo|excelente)",
    r"\bexcelente\b",
    r"\bperfeit[oa]\b",
    r"\best[aá] (ok|[oó]timo|bonit)",
    r"\bsem problemas\b",
    r"\btudo certo\b",
]


class AgentReportError(Exception):
    pass


@dataclass
class TargetMetadata:
    source_file: str
    action_name: str
    action_slot: Optional[str]
    armature_name: str
    frame_range: Tuple[int, int]
    frame_count: int
    fps: float
    duration_seconds: float
    unit_system: str = "METRIC_METERS"


@dataclass
class MeasurementItem:
    metric: str
    value: Any
    unit: str
    method: str
    confidence: float
    target_role: Optional[str] = None
    target_bone: Optional[str] = None


@dataclass
class VisualEvidenceItem:
    evidence_id: str
    file_path: str
    sha256: str
    view_type: str
    frames_shown: List[int]
    reading_token: Optional[str] = None
    verified_exists: bool = False


@dataclass
class FindingsEpistemic:
    facts: List[str]
    observations: List[str]
    inferences: List[str]
    hypotheses: List[str]


@dataclass
class ProposedCorrection:
    proposal_id: str
    target_role: str
    frame_range: Tuple[int, int]
    suggested_action: str
    parameters: Dict[str, Any]
    rationale: str
    applied: bool = False  # SEMPRE False no contrato; correções nunca são aplicadas automaticamente


def compute_file_sha256(path: str) -> Optional[str]:
    """Calcula o hash SHA-256 de um arquivo se ele existir."""
    if not os.path.isfile(path):
        return None
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while chunk := fh.read(65536):
            h.update(chunk)
    return h.hexdigest()


def build_agent_report(
    report_id: str,
    target: Dict[str, Any],
    rig_mapping: Dict[str, Any],
    measurements: Sequence[Dict[str, Any]],
    visual_evidence: Sequence[Dict[str, Any]],
    findings: Dict[str, Sequence[str]],
    limitations_and_risks: Dict[str, Any],
    proposed_corrections: Optional[Sequence[Dict[str, Any]]] = None,
    reproduction: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Constrói um relatório padronizado arenamon.agent-report/1 validado."""

    # Validação do target
    f_start, f_end = target["frame_range"]
    f_count = f_end - f_start + 1
    fps = float(target["fps"])
    if fps <= 0:
        raise AgentReportError("FPS deve ser estritamente positivo.")
    duration = round(f_count / fps, 3)

    target_data = {
        "source_file": target["source_file"],
        "action_name": target["action_name"],
        "action_slot": target.get("action_slot"),
        "armature_name": target.get("armature_name", "Armature"),
        "frame_range": [f_start, f_end],
        "frame_count": f_count,
        "fps": fps,
        "duration_seconds": duration,
        "unit_system": target.get("unit_system", "METRIC_METERS"),
    }

    # Estruturação epistêmica
    findings_data = {
        "facts": list(findings.get("facts", [])),
        "observations": list(findings.get("observations", [])),
        "inferences": list(findings.get("inferences", [])),
        "hypotheses": list(findings.get("hypotheses", [])),
    }

    # Propostas de correção (sempre applied = False)
    corrections_data = []
    for prop in proposed_corrections or []:
        p_dict = dict(prop)
        p_dict["applied"] = False  # Força invariante de segurança
        corrections_data.append(p_dict)

    repro_data = reproduction or {
        "tool": "blender_headless",
        "command_template": "blender.exe -b <file> -P <script>",
        "validation_checklist": [
            "Conferir consistência de Action Slot na versão 5.2.2 do Blender",
            "Verificar hashes SHA-256 das folhas de evidência contra manifest.json",
            "Avaliar medições numéricas sem presumir intenção artística",
        ],
    }

    report = {
        "schema": SCHEMA_NAME,
        "report_id": report_id,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "target": target_data,
        "rig_mapping": rig_mapping,
        "measurements": list(measurements),
        "visual_evidence": list(visual_evidence),
        "findings": findings_data,
        "limitations_and_risks": limitations_and_risks,
        "proposed_corrections": corrections_data,
        "reproduction": repro_data,
    }

    validate_agent_report(report, verify_files=False)
    return report


def validate_agent_report(
    data: Dict[str, Any],
    verify_files: bool = False,
    base_dir: Optional[str] = None,
) -> Tuple[bool, List[str]]:
    """Valida um relatório contra as regras de integridade do arenamon.agent-report/1.

    Args:
        data: Dicionário do relatório.
        verify_files: Se True, verifica existência e hash SHA-256 de todas as evidências visuais.
        base_dir: Diretório base para resolução de caminhos relativos de evidência.

    Retorna (is_valid, error_list). Lança AgentReportError em caso de invalidade estrita.
    """
    errors: List[str] = []

    if not isinstance(data, dict):
        raise AgentReportError("O relatório deve ser um objeto JSON.")

    if data.get("schema") != SCHEMA_NAME:
        errors.append(f"Campo 'schema' deve ser '{SCHEMA_NAME}', recebido '{data.get('schema')}'")

    for req_field in (
        "report_id",
        "timestamp",
        "target",
        "rig_mapping",
        "measurements",
        "visual_evidence",
        "findings",
        "limitations_and_risks",
        "proposed_corrections",
        "reproduction",
    ):
        if req_field not in data:
            errors.append(f"Campo obrigatório ausente: '{req_field}'")

    # 1. Validação de Target
    target = data.get("target", {})
    if isinstance(target, dict):
        for tf in ("source_file", "action_name", "frame_range", "frame_count", "fps", "duration_seconds"):
            if tf not in target:
                errors.append(f"Target ausente de campo obrigatório '{tf}'")

        fr = target.get("frame_range")
        fc = target.get("frame_count")
        fps = target.get("fps")
        dur = target.get("duration_seconds")

        if isinstance(fr, (list, tuple)) and len(fr) == 2:
            calc_count = fr[1] - fr[0] + 1
            if fc != calc_count:
                errors.append(f"frame_count inconsistente: frame_range {fr} implica {calc_count}, mas recebeu {fc}")
            if fps and isinstance(fps, (int, float)) and fps > 0:
                expected_dur = round(calc_count / fps, 3)
                if dur is not None and abs(dur - expected_dur) > 0.02:
                    errors.append(f"duration_seconds inconsistente: {dur} s vs esperado {expected_dur} s")
        else:
            errors.append("frame_range deve ser uma lista ou tupla com [start_frame, end_frame]")

    # 2. Validação do Rig Mapping F03
    rig_m = data.get("rig_mapping", {})
    if isinstance(rig_m, dict):
        if "schema" in rig_m and rig_m["schema"] != "arenamon.rig-map/1":
            errors.append(f"rig_mapping schema inválido: '{rig_m.get('schema')}'")
    else:
        errors.append("rig_mapping deve ser um objeto.")

    # 3. Validação de Medições
    meas = data.get("measurements", [])
    if isinstance(meas, list):
        for idx, m in enumerate(meas):
            if not isinstance(m, dict):
                errors.append(f"Medição #{idx} não é um objeto.")
                continue
            for mf in ("metric", "value", "unit", "method"):
                if mf not in m:
                    errors.append(f"Medição #{idx} ausente de '{mf}'")
    else:
        errors.append("measurements deve ser uma lista.")

    # 4. Validação Epistêmica dos Achados
    findings = data.get("findings", {})
    if isinstance(findings, dict):
        for ep_key in ("facts", "observations", "inferences", "hypotheses"):
            if ep_key not in findings:
                errors.append(f"findings ausente de '{ep_key}'")
            elif not isinstance(findings[ep_key], list):
                errors.append(f"findings.{ep_key} deve ser uma lista.")
            else:
                for text_item in findings[ep_key]:
                    # Checagem contra frases genéricas vazias
                    t_low = str(text_item).lower()
                    for ban_pat in GENERIC_BANNED_PHRASES:
                        if re.search(ban_pat, t_low):
                            errors.append(f"Frase genérica não-fundamentada detectada em findings.{ep_key}: '{text_item}'")
    else:
        errors.append("findings deve ser um objeto.")

    # 5. Validação de Propostas de Correção (Invariante: applied SEMPRE False)
    props = data.get("proposed_corrections", [])
    if isinstance(props, list):
        for idx, p in enumerate(props):
            if not isinstance(p, dict):
                errors.append(f"Proposta #{idx} não é um objeto.")
                continue
            if p.get("applied") is not False:
                errors.append(f"VIOLAÇÃO DE CONTRATO: proposta #{idx} ('{p.get('proposal_id')}') possui 'applied' != False. Auto-aplicação é proibida.")
            for pf in ("proposal_id", "target_role", "suggested_action", "rationale"):
                if pf not in p:
                    errors.append(f"Proposta #{idx} ausente de campo '{pf}'")
    else:
        errors.append("proposed_corrections deve ser uma lista.")

    # 6. Validação de Limitações e Riscos
    lims = data.get("limitations_and_risks", {})
    if isinstance(lims, dict):
        for lf in ("missing_data", "assumptions", "risks", "confidence_score"):
            if lf not in lims:
                errors.append(f"limitations_and_risks ausente de '{lf}'")
        conf_score = lims.get("confidence_score")
        if conf_score is not None and not (0.0 <= conf_score <= 1.0):
            errors.append(f"confidence_score fora da faixa [0.0, 1.0]: {conf_score}")
    else:
        errors.append("limitations_and_risks deve ser um objeto.")

    # 7. Validação de Evidências Visuais e Hashes
    evidences = data.get("visual_evidence", [])
    if isinstance(evidences, list):
        for idx, ev in enumerate(evidences):
            if not isinstance(ev, dict):
                errors.append(f"Evidência #{idx} não é um objeto.")
                continue
            for ef in ("evidence_id", "file_path", "sha256", "view_type"):
                if ef not in ev:
                    errors.append(f"Evidência #{idx} ausente de '{ef}'")

            fpath = ev.get("file_path", "")
            expected_hash = ev.get("sha256")

            if verify_files:
                resolved_path = os.path.join(base_dir, fpath) if base_dir and not os.path.isabs(fpath) else fpath
                if not os.path.isfile(resolved_path):
                    errors.append(f"Arquivo de evidência #{idx} não existe no disco: '{resolved_path}'")
                elif expected_hash:
                    actual_hash = compute_file_sha256(resolved_path)
                    if actual_hash != expected_hash:
                        errors.append(f"Hash SHA-256 divergente na evidência #{idx} ('{resolved_path}'): esperado {expected_hash}, obtido {actual_hash}")
    else:
        errors.append("visual_evidence deve ser uma lista.")

    if errors:
        raise AgentReportError("Falha de validação no agent-report:\n- " + "\n- ".join(errors))

    return True, []
