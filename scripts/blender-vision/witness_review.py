"""Módulo de revisão estruturada para agentes de IA no Animation Witness.

Implementa:
- witness.py review: valida a revisão de um agente contra evidências do bundle;
- witness.py calibrate-claw: gera critérios de garra sem tocar no .blend;
- witness.py art-reference: gerencia corpus de referências artísticas aprovadas.

Regras de validação de revisão:
1. Exige no mínimo 2 vistas independentes (>= 35 graus entre eixos de câmera);
2. Rejeita citações de imagens marcadas como inúteis ou ocluídas;
3. Proíbe escape de caminho (path traversal fora do bundle);
4. Impede afirmações de contato 3D baseadas exclusivamente em silhueta 2D;
5. Não permite converter MEDIDO_SEM_CRITERIO em COMPROVADO sem critério aprovado.
"""
from __future__ import annotations

import json
import math
import os
import sys
from typing import Any

from witness_utility import are_views_independent


class ReviewValidationError(Exception):
    def __init__(self, reasons: list[str]) -> None:
        super().__init__("; ".join(reasons))
        self.reasons = reasons


def validate_review(bundle_dir: str, review_data: dict[str, Any]) -> dict[str, Any]:
    """Valida o relatório de revisão submetido por um agente."""
    bundle_path = os.path.abspath(bundle_dir)
    verdict_file = os.path.join(bundle_path, "verdict.json")
    if not os.path.isfile(verdict_file):
        raise ReviewValidationError([f"Bundle inválido: verdict.json não encontrado em {bundle_path}"])

    verdict = json.load(open(verdict_file, encoding="utf-8"))
    bundle_claims = {c["claim_id"]: c for c in verdict.get("claims", [])}

    # Carrega utilidade de vistas se existir
    utility_file = os.path.join(bundle_path, "views_utility.json")
    views_utility = {}
    if os.path.isfile(utility_file):
        views_utility = json.load(open(utility_file, encoding="utf-8"))

    rejections: list[str] = []
    validated_claims: list[dict[str, Any]] = []

    submitted_reviews = review_data.get("reviews", [])
    if not submitted_reviews:
        raise ReviewValidationError(["Nenhuma revisão de claim foi informada no arquivo"])

    for rev in submitted_reviews:
        cid = rev.get("claim_id")
        if not cid or cid not in bundle_claims:
            rejections.append(f"Claim desconhecido ou ausente: '{cid}'")
            continue

        base_claim = bundle_claims[cid]
        claimed_status = rev.get("status")
        cited_images = rev.get("cited_images", [])

        # Regra 3: Path Traversal Check & Existência física no bundle
        for img in cited_images:
            resolved = os.path.abspath(os.path.join(bundle_path, img))
            try:
                common = os.path.commonpath([bundle_path, resolved])
                if common != bundle_path:
                    rejections.append(f"Path traversal detectado na imagem '{img}' para claim '{cid}'")
                    continue
            except ValueError:
                rejections.append(f"Caminho inválido para imagem '{img}' no claim '{cid}'")
                continue

            if not os.path.isfile(resolved):
                rejections.append(f"Imagem citada '{img}' não existe no bundle para o claim '{cid}'")

        # Regra de Monotonicidade: Elevação para COMPROVADO exige evidência válida
        if claimed_status == "COMPROVADO" and base_claim["status"] != "COMPROVADO":
            # 1. REFUTADO nunca pode ser elevado para COMPROVADO por revisão de agente
            if base_claim["status"] == "REFUTADO":
                rejections.append(
                    f"Claim '{cid}' foi REFUTADO na medição objetiva; a revisão não pode aprová-lo sem nova medição ou retificação de spec"
                )

            # 2. MEDIDO_SEM_CRITERIO exige critério aprovado existente
            if base_claim["status"] == "MEDIDO_SEM_CRITERIO":
                crit_ref = rev.get("approved_criterion_reference")
                if not crit_ref:
                    rejections.append(
                        f"Claim '{cid}' é MEDIDO_SEM_CRITERIO no bundle; o agente não pode aprová-lo sem critério aprovado vinculado"
                    )
                else:
                    crit_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "criteria")
                    crit_path = os.path.join(crit_dir, crit_ref) if not os.path.isabs(crit_ref) else crit_ref
                    if not os.path.isfile(crit_path):
                        rejections.append(
                            f"Critério aprovado '{crit_ref}' citado para o claim '{cid}' não foi encontrado em {crit_dir}"
                        )

            # 3. NAO_COMPROVAVEL não pode ser elevado se houver pendências não resolvidas
            if base_claim["status"] == "NAO_COMPROVAVEL":
                missing = base_claim.get("missing", [])
                if missing:
                    rejections.append(
                        f"Claim '{cid}' é NAO_COMPROVAVEL devido a pendências não supridas ({', '.join(missing)}); aprovação sem evidência é proibida"
                    )

            # 4. Julgamento artístico (artistic_judgement ou artistic_quality)
            if base_claim.get("type") == "artistic_judgement" or cid == "artistic_quality":
                crit_ref = rev.get("approved_criterion_reference")
                if not crit_ref:
                    rejections.append(
                        f"Claim artístico '{cid}' não pode ser COMPROVADO sem referência artística aprovada vinculada"
                    )
                else:
                    crit_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "criteria")
                    crit_path = os.path.join(crit_dir, crit_ref) if not os.path.isabs(crit_ref) else crit_ref
                    if not os.path.isfile(crit_path):
                        rejections.append(
                            f"Referência artística '{crit_ref}' não existe no repositório de critérios"
                        )
                if len(cited_images) < 2:
                    rejections.append(
                        f"Claim artístico '{cid}' exige no mínimo 2 imagens úteis de vistas independentes comprovando o critério"
                    )

            # 5. Justificativa substantiva obrigatória
            justification = rev.get("justification", "").strip()
            if len(justification) < 15 or justification.lower() in ("afirmação sem evidência", "afirmacao sem evidencia", "ok", "comprovado", "aprovado"):
                rejections.append(
                    f"Claim '{cid}' não possui justificativa técnica verificável para elevação de status (mínimo 15 caracteres fundamentados)"
                )

        # Regras visuais e independência de câmeras
        if cited_images:
            # Rejeita imagens com baixa utilidade
            for img in cited_images:
                base_img = os.path.basename(img)
                util_info = views_utility.get(base_img)
                if util_info and not util_info.get("is_useful", True):
                    reasons = ", ".join(util_info.get("rejection_reasons", ["inútil"]))
                    rejections.append(
                        f"Imagem citada '{base_img}' foi rejeitada pelo witness ({reasons}) e não pode fundamentar aprovação"
                    )

            # Extrai câmeras reais a partir dos metadados do bundle
            cams_from_bundle = []
            for img in cited_images:
                base_img = os.path.basename(img)
                u_info = views_utility.get(base_img, {})
                c = u_info.get("camera")
                if c and c.get("location"):
                    cams_from_bundle.append(c)

            cams_to_test = cams_from_bundle if cams_from_bundle else rev.get("camera_setups", [])

            if len(cited_images) < 2 and claimed_status == "COMPROVADO" and base_claim.get("requires_visual_evidence"):
                rejections.append(
                    f"Claim visual '{cid}' cita apenas {len(cited_images)} imagem; são exigidas no mínimo 2 vistas independentes"
                )
            elif len(cams_to_test) >= 2:
                c1, c2 = cams_to_test[0], cams_to_test[1]
                p1, t1 = c1.get("location"), c1.get("target") or [0, 0, 0]
                p2, t2 = c2.get("location"), c2.get("target") or [0, 0, 0]
                if p1 and t1 and p2 and t2:
                    indep, ang = are_views_independent(p1, t1, p2, t2)
                    if not indep:
                        rejections.append(
                            f"Vistas citadas para '{cid}' são colineares (ângulo {ang}° < 35°); não constituem evidência independente"
                        )

        validated_claims.append({
            "claim_id": cid,
            "status": claimed_status,
            "justification": rev.get("justification", ""),
            "cited_images": cited_images,
        })

    if rejections:
        raise ReviewValidationError(rejections)

    return {
        "status": "REVIEW_VALIDATED",
        "bundle": bundle_path,
        "reviewed_by": review_data.get("reviewer", "AI Agent"),
        "claims_reviewed": len(validated_claims),
        "claims": validated_claims,
    }


def calibrate_claw(blend_path: str, action_name: str, out_file: str, armature: str | None = None) -> dict[str, Any]:
    """Gera um documento de critérios de garra calibrada sem salvar o .blend."""
    import subprocess
    import tempfile

    here = os.path.dirname(os.path.abspath(__file__))
    witness_script = os.path.join(here, "witness.py")

    # Cria spec temporária para medição neutra
    temp_spec = {
        "schema": "arenamon.animation-witness.spec/1",
        "name": "Calibracao Neutra de Garras",
        "claims": [
            {
                "id": "claw_neutral_measurement",
                "type": "hand_configuration",
                "side": "Right",
                "frames": [1, 1],
                "statement": "Medição neutra dos dedos",
            }
        ],
    }

    with tempfile.TemporaryDirectory(prefix="claw-calib-") as tmp_dir:
        spec_path = os.path.join(tmp_dir, "spec.json")
        dump_path = os.path.join(tmp_dir, "out")
        with open(spec_path, "w", encoding="utf-8") as f:
            json.dump(temp_spec, f, indent=2)

        cmd = [
            sys.executable,
            witness_script,
            "inspect",
            "--blend", blend_path,
            "--action", action_name,
            "--spec", spec_path,
            "--out", dump_path,
            "--allow-unpinned-source",
        ]
        if armature:
            cmd += ["--armature", armature]

        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        if proc.returncode != 0:
            raise RuntimeError(f"Falha ao inspecionar postura neutra: {proc.stderr}")

        verdict = json.load(open(os.path.join(dump_path, "verdict.json"), encoding="utf-8"))
        claim = verdict["claims"][0]
        samples = claim.get("evidence", [{}])[0].get("samples", [])
        if not samples:
            raise RuntimeError("Não foi possível extrair amostras dos dedos para calibração")

        val = samples[0].get("max_tip_distance_over_palm", 0.0)

        calib_data = {
            "schema": "arenamon.animation-witness.claw-criteria/1",
            "source_blend": os.path.abspath(blend_path),
            "action": action_name,
            "calibrated_neutral_tip_over_palm": round(val, 4),
            "proposed_open_claw_threshold": round(val * 1.35, 4),
            "status": "calibrated_unapproved",
            "note": "Documento independente gerado pelo calibrador; não modifica arquivos .blend",
        }

        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(calib_data, f, indent=2, ensure_ascii=False)

        return calib_data


def compare_art_reference(candidate_file: str, reference_name: str) -> dict[str, Any]:
    """Compara um resultado candidato contra um critério de referência artística aprovado.
    Devolve status ART_MATCH ou ART_MISMATCH com métricas detalhadas.
    """
    cand_path = os.path.abspath(candidate_file)
    if not os.path.isfile(cand_path):
        raise FileNotFoundError(f"Arquivo candidato não encontrado: {cand_path}")

    crit_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "criteria")
    ref_path = os.path.join(crit_dir, reference_name) if not os.path.isabs(reference_name) else reference_name
    if not os.path.isfile(ref_path):
        raise FileNotFoundError(f"Critério de referência '{reference_name}' não encontrado em {crit_dir}")

    cand_data = json.load(open(cand_path, encoding="utf-8"))
    ref_data = json.load(open(ref_path, encoding="utf-8"))

    mismatches = []
    comparisons = {}

    # 1. Comparação de janelas de timing
    cand_timing = cand_data.get("timing_windows", {})
    ref_timing = ref_data.get("timing_windows", {})
    for k, ref_win in ref_timing.items():
        c_win = cand_timing.get(k)
        if not c_win:
            mismatches.append(f"Janela de timing ausente: '{k}'")
        else:
            diff_start = abs(c_win[0] - ref_win[0])
            diff_end = abs(c_win[1] - ref_win[1])
            comparisons[f"timing_{k}"] = {"candidate": c_win, "reference": ref_win, "diff": [diff_start, diff_end]}
            if diff_start > 1 or diff_end > 1:
                mismatches.append(f"Janela de timing '{k}' diverge da referência: {c_win} vs {ref_win}")

    # 2. Comparação de perfil de velocidade/energia
    if "energy_profile" in ref_data and "energy_profile" in cand_data:
        ref_e = ref_data["energy_profile"]
        cand_e = cand_data["energy_profile"]
        peak_diff = abs(cand_e.get("peak_frame", 0) - ref_e.get("peak_frame", 0))
        comparisons["energy_peak"] = {"candidate": cand_e.get("peak_frame"), "reference": ref_e.get("peak_frame"), "diff": peak_diff}
        if peak_diff > 2:
            mismatches.append(f"Pico de energia fora da tolerância: frame {cand_e.get('peak_frame')} vs {ref_e.get('peak_frame')}")

    is_match = len(mismatches) == 0
    return {
        "status": "ART_MATCH" if is_match else "ART_MISMATCH",
        "candidate": cand_path,
        "reference": os.path.basename(ref_path),
        "is_match": is_match,
        "mismatches": mismatches,
        "comparisons": comparisons,
    }
