"""Núcleo puro do Animation Witness.

O Witness não tenta converter heurísticas em aprovação artística. Ele avalia
afirmações contra observações registradas pelo Blender e se abstém quando falta
alvo, critério aprovado ou capacidade do rig.

Distingue quatro dimensões de avaliação:
- geométrica (geometric_status)
- temporal (temporal_status)
- visual (visual_status)
- artística (artistic_status)
E sintetiza o status final por regras fechadas fail-closed.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
from dataclasses import asdict, dataclass, field
from typing import Any, Iterable, Sequence

from witness_utility import (
    MIN_INDEPENDENT_ANGLE_DEG,
    are_views_independent,
    evaluate_view_utility,
)

# Status universais
PROVEN = "COMPROVADO"
REFUTED = "REFUTADO"
MEASURED = "MEDIDO_SEM_CRITERIO"
UNPROVABLE = "NAO_COMPROVAVEL"

# Status visuais
VISUAL_USEFUL = "UTIL"
VISUAL_INSUFFICIENT = "INSUFICIENTE"
VISUAL_OCCLUDED = "OCLUIDO"
VISUAL_UNVERIFIABLE = "NAO_VERIFICAVEL"

# Status artísticos
ART_ANALYSIS = "EM_ANALISE"
ART_NO_REF = "SEM_REFERENCIA"
ART_MATCH = "REFERENCIA_ADERENTE"
ART_MISMATCH = "REFERENCIA_DISCREPANTE"

# Pares anatômicos adjacentes (excluídos de falsos positivos de auto-interpenetração)
ANATOMICAL_ADJACENT_PAIRS = {
    frozenset({"Hips", "Spine"}),
    frozenset({"Spine", "Spine1"}),
    frozenset({"Spine1", "Spine2"}),
    frozenset({"Spine2", "Neck"}),
    frozenset({"Neck", "Head"}),
    frozenset({"Spine2", "LeftShoulder"}),
    frozenset({"LeftShoulder", "LeftArm"}),
    frozenset({"LeftArm", "LeftForeArm"}),
    frozenset({"LeftForeArm", "LeftHand"}),
    frozenset({"Spine2", "RightShoulder"}),
    frozenset({"RightShoulder", "RightArm"}),
    frozenset({"RightArm", "RightForeArm"}),
    frozenset({"RightForeArm", "RightHand"}),
    frozenset({"Hips", "LeftUpLeg"}),
    frozenset({"LeftUpLeg", "LeftLeg"}),
    frozenset({"LeftLeg", "LeftFoot"}),
    frozenset({"LeftFoot", "LeftToeBase"}),
    frozenset({"Hips", "RightUpLeg"}),
    frozenset({"RightUpLeg", "RightLeg"}),
    frozenset({"RightLeg", "RightFoot"}),
    frozenset({"RightFoot", "RightToeBase"}),
}


def is_anatomically_adjacent(bone_a: str, bone_b: str) -> bool:
    """Verifica se dois ossos são adjacentes no rig (não devem disparar self-collision)."""
    clean_a = bone_a.replace("mixamorig:", "")
    clean_b = bone_b.replace("mixamorig:", "")
    if clean_a == clean_b:
        return True
    if frozenset({clean_a, clean_b}) in ANATOMICAL_ADJACENT_PAIRS:
        return True
    # Conexões de dedos com a mão
    for side in ("Left", "Right"):
        hand = side + "Hand"
        if (clean_a == hand and side in clean_b and ("Finger" in clean_b or "Thumb" in clean_b or "Index" in clean_b)) or \
           (clean_b == hand and side in clean_a and ("Finger" in clean_a or "Thumb" in clean_a or "Index" in clean_a)):
            return True
        # Phalanges consecutivas
        if side in clean_a and side in clean_b:
            for digit in ("Index", "Thumb", "Middle", "Ring", "Little", "Finger"):
                if digit in clean_a and digit in clean_b:
                    return True
    return False


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def canonical(path: str) -> str:
    return os.path.normcase(os.path.realpath(os.path.abspath(path)))


def same_path(a: str, b: str) -> bool:
    ca, cb = canonical(a), canonical(b)
    if ca == cb:
        return True
    try:
        return os.path.samefile(ca, cb)
    except (FileNotFoundError, OSError):
        return False


def dump_json(path: str, value: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(value, f, indent=2, ensure_ascii=False, sort_keys=True)


def vec_distance(a: Iterable[float], b: Iterable[float]) -> float:
    aa, bb = list(a), list(b)
    return math.sqrt(sum((float(x) - float(y)) ** 2 for x, y in zip(aa, bb)))


@dataclass
class Verdict:
    claim_id: str
    status: str
    statement: str
    evidence: list[dict[str, Any]]
    missing: list[str]
    limitations: list[str]
    criterion_origin: str
    geometric_status: str = UNPROVABLE
    temporal_status: str = UNPROVABLE
    visual_status: str = VISUAL_UNVERIFIABLE
    artistic_status: str = ART_NO_REF
    criterion_status: str = "undefined"

    def json(self) -> dict[str, Any]:
        return asdict(self)


def synthesize_final_status(
    geometric: str,
    temporal: str,
    visual: str,
    artistic: str,
    requires_visual: bool = False,
    requires_temporal: bool = False,
    requires_approved_criterion: bool = False,
    criterion_status: str = "undefined",
    is_artistic_claim: bool = False,
) -> tuple[str, list[str]]:
    """Aplica as regras fail-closed de síntese multi-dimensional."""
    notes: list[str] = []

    # 1. Qualquer refutação física refuta o resultado final
    if geometric == REFUTED or temporal == REFUTED:
        return REFUTED, ["afirmação refutada por evidência geométrica/temporal"]

    # 2. Falha fechada em ausência de medição ou alvo ausente
    if geometric == UNPROVABLE:
        return UNPROVABLE, ["dados geométricos insuficientes"]
    if requires_temporal and temporal == UNPROVABLE:
        return UNPROVABLE, ["dados temporais insuficientes"]

    # 3. Afirmações artísticas sem referência
    if is_artistic_claim:
        if artistic == ART_MATCH:
            return PROVEN, ["referência aprovada aderente"]
        elif artistic == ART_MISMATCH:
            return REFUTED, ["discrepante da referência aprovada"]
        else:
            return UNPROVABLE, ["qualidade artística não possui referência aprovada no corpus"]

    # 4. Requisitos de critério aprovado (quando a medição foi calculada mas o limiar é proposto)
    if requires_approved_criterion and criterion_status != "approved":
        notes.append("cálculo executado, mas limiar não aprovado pelo diretor")
        return MEASURED, notes

    # 5. Medições sem critério não podem virar aprovação
    if geometric == MEASURED or temporal == MEASURED:
        return MEASURED, ["medido sem critério de corte aprovado"]

    # 6. Dependência de confirmação visual
    if requires_visual:
        if visual != VISUAL_USEFUL:
            notes.append(f"confirmação visual insuficiente ({visual}); mínimo de duas vistas úteis necessárias")
            return MEASURED if geometric == PROVEN else UNPROVABLE, notes

    # 7. Comprovação plena
    if geometric == PROVEN:
        if requires_temporal and temporal != PROVEN:
            return MEASURED, ["geometria comprovada, mas comportamento temporal pendente"]
        return PROVEN, ["comprovado por evidência"]

    return UNPROVABLE, ["estado não contemplado por regra de aprovação"]


def _frames(obs: dict[str, Any], start: int, end: int) -> list[dict[str, Any]]:
    return [x for x in obs.get("frames", []) if start <= int(x.get("author_frame", 0)) <= end]


def _bone(frame: dict[str, Any], name: str) -> dict[str, Any] | None:
    return frame.get("bones", {}).get(name) or frame.get("bones", {}).get("mixamorig:" + name)


def _onset(rows: list[dict[str, Any]], bone: str, threshold: float) -> int | None:
    pts = []
    for row in rows:
        b = _bone(row, bone)
        if b is None:
            return None
        pts.append((int(row["author_frame"]), b["body_head"]))
    if not pts:
        return None
    origin = pts[0][1]
    for frame, p in pts[1:]:
        if vec_distance(p, origin) >= threshold:
            return frame
    return None


def evaluate(observation: dict[str, Any], spec: dict[str, Any]) -> dict[str, Any]:
    """Avalia afirmações com separação dimensional e regras fechadas fail-closed."""
    verdicts: list[Verdict] = []

    for claim in spec.get("claims", []):
        cid = claim["id"]
        kind = claim["type"]
        statement = claim.get("statement", cid)
        origin = claim.get("criterion_origin", "nao_informado")
        crit_status = claim.get("criterion_status", "undefined")
        req_crit = claim.get("requires_approved_criterion", False)
        req_visual = claim.get("requires_visual_evidence", False)
        evidence: list[dict[str, Any]] = []
        missing: list[str] = []
        limits: list[str] = []

        g_status = UNPROVABLE
        t_status = UNPROVABLE
        v_status = VISUAL_UNVERIFIABLE
        a_status = ART_NO_REF
        is_art = False

        if kind == "frame_count":
            actual = int(observation["action"]["frame_count"])
            expected = int(claim["expected"])
            evidence.append({"kind": "action_range", "actual": actual, "expected": expected})
            g_status = PROVEN if actual == expected else REFUTED
            t_status = g_status

        elif kind == "inventory":
            actions = set(observation.get("scene", {}).get("actions", []))
            required = set(claim.get("required_actions", []))
            absent = sorted(required - actions)
            evidence.append({"kind": "action_inventory", "present": sorted(actions), "absent": absent})
            g_status = PROVEN if not absent else REFUTED
            t_status = g_status

        elif kind == "root_displacement":
            hips = [_bone(x, "Hips") for x in observation.get("frames", [])]
            if not hips or any(x is None for x in hips):
                missing.append("osso Hips")
            else:
                start, end = hips[0]["world_head"], hips[-1]["world_head"]
                distance = vec_distance(start, end)
                evidence.append({"kind": "exact_transform", "start": start, "end": end, "net_m": distance})
                g_status = MEASURED
                limits.append("P3 declara deslocamento real indefinido; nenhum limite de aprovação foi inventado")

        elif kind == "pelvis_twist":
            hips = [_bone(x, "Hips") for x in observation.get("frames", [])]
            if not hips or any(x is None for x in hips):
                missing.append("osso Hips")
            else:
                # Medição do ângulo de torção da pelve (yaw) relativo ao corpo via decomposição swing-twist
                angles = []
                for f, row in enumerate(observation.get("frames", [])):
                    h = _bone(row, "Hips")
                    q = h.get("local_basis_quaternion", [1, 0, 0, 0])
                    # Decomposição swing-twist em torno do eixo Z (0, 0, 1) da pelve
                    # q = [w, x, y, z]
                    w_val, x_val, y_val, z_val = float(q[0]), float(q[1]), float(q[2]), float(q[3])
                    twist_norm = math.hypot(w_val, z_val)
                    if twist_norm > 1e-9:
                        tw_w = w_val / twist_norm
                        tw_z = z_val / twist_norm
                        yaw = 2.0 * math.atan2(tw_z, tw_w)
                        # Normaliza para [-pi, pi]
                        yaw = (yaw + math.pi) % (2.0 * math.pi) - math.pi
                    else:
                        yaw = 0.0
                    angles.append({"frame": row["author_frame"], "yaw_rad": round(yaw, 4), "yaw_deg": round(math.degrees(yaw), 2)})
                evidence.append({"kind": "pelvis_twist_measurement", "decomposition": "swing_twist", "samples": angles})
                max_twist = max(abs(x["yaw_deg"]) for x in angles) if angles else 0.0
                thresh = claim.get("min_twist_deg")
                if thresh is None:
                    g_status = MEASURED
                    missing.append("limiar de torção de quadril aprovado")
                else:
                    g_status = PROVEN if max_twist >= float(thresh) else REFUTED

        elif kind == "rig_digits":
            side = claim.get("side", "Right")
            chains = observation.get("rig", {}).get("digit_chains", {}).get(side, [])
            evidence.append({"kind": "rig_inventory", "side": side, "chains": chains, "count": len(chains)})
            minimum = claim.get("minimum")
            if minimum is None:
                g_status = MEASURED
            else:
                g_status = PROVEN if len(chains) >= int(minimum) else REFUTED

        elif kind == "hand_configuration":
            side = claim.get("side", "Right")
            hand = side + "Hand"
            chains = observation.get("rig", {}).get("digit_chains", {}).get(side, [])
            start, end = map(int, claim["frames"])
            rows = _frames(observation, start, end)
            samples = []
            for row in rows:
                hb = _bone(row, hand)
                if hb is None or "body_head" not in hb or "body_tail" not in hb:
                    continue
                palm_len = max(vec_distance(hb["body_head"], hb["body_tail"]), 1e-9)
                tips = []
                for chain in chains:
                    if chain and _bone(row, chain[-1]):
                        tips.append(_bone(row, chain[-1])["body_tail"])
                distances = [vec_distance(tips[i], tips[j]) for i in range(len(tips)) for j in range(i + 1, len(tips))]
                samples.append({
                    "frame": row["author_frame"],
                    "digit_tips": tips,
                    "max_tip_distance_m": max(distances) if distances else None,
                    "max_tip_distance_over_palm": (max(distances) / palm_len) if distances else None,
                })
            evidence.append({"kind": "exact_digit_skeleton", "chains": chains, "samples": samples})
            if len(chains) < 2:
                missing.append("ao menos duas cadeias de dedos para medir abertura")
            elif not samples or not any(x["max_tip_distance_over_palm"] is not None for x in samples):
                missing.append("transformações avaliadas dos dedos")
            else:
                threshold = claim.get("min_tip_distance_over_palm")
                if threshold is None:
                    g_status = MEASURED
                    missing.append("limiar aprovado que define 'aberta em garra' para este rig de dois dedos")
                else:
                    values = [x["max_tip_distance_over_palm"] for x in samples if x["max_tip_distance_over_palm"] is not None]
                    g_status = PROVEN if values and all(x >= float(threshold) for x in values) else REFUTED

        elif kind == "body_relative_onset":
            start, end = map(int, claim["frames"])
            rows = _frames(observation, start, end)
            threshold = float(claim["threshold_m"])
            a = _onset(rows, claim["bone"], threshold)
            b = _onset(rows, claim["other"], threshold)
            evidence.append({
                "kind": "body_relative_transform",
                "bone_onset": a,
                "other_onset": b,
                "threshold_m": threshold,
                "window": [start, end],
            })
            if a is None or b is None:
                missing.append("movimento mensurável dos dois ossos dentro da janela")
            elif a < b:
                g_status = PROVEN
                t_status = PROVEN
            elif a > b:
                g_status = REFUTED
                t_status = REFUTED
            else:
                g_status = UNPROVABLE
                t_status = UNPROVABLE
                limits.append("empate de onset não demonstra precedência, especialmente em blocking constante")

        elif kind == "target_contact_window":
            target = observation.get("target")
            if not target:
                missing.append("objeto/alvo geométrico explicitamente identificado (--target)")
                limits.append("janela temporal não prova contato sem uma superfície-alvo real")
                g_status = UNPROVABLE
            else:
                start, end = map(int, claim["frames"])
                samples = [x for x in target.get("right_hand_surface_distance", []) if start <= x.get("frame", -999) <= end]
                if not samples:
                    missing.append("distância malha da mão direita ↔ malha do alvo")
                    g_status = UNPROVABLE
                else:
                    best = min(samples, key=lambda x: x["distance_m"])
                    evidence.append({"kind": "surface_proximity", "best": best, "window": [start, end]})
                    tolerance = claim.get("proximity_tolerance_m")
                    if tolerance is None:
                        g_status = MEASURED
                    else:
                        g_status = PROVEN if best["distance_m"] <= float(tolerance) else REFUTED
                    limits.append("proximidade de superfície não demonstra força, peso ou intenção do impacto")

        elif kind == "self_collision":
            # Verificação com matriz de exclusão anatômica
            collisions = observation.get("self_collision", [])
            max_tol = float(claim.get("max_penetration_m", 0.005))
            filtered = []
            for col in collisions:
                p1, p2 = col.get("part_a", ""), col.get("part_b", "")
                if not is_anatomically_adjacent(p1, p2):
                    filtered.append(col)
            has_mesh_coverage = observation.get("self_collision_full_mesh_coverage", False)
            evidence.append({
                "kind": "self_collision_audit",
                "method": observation.get("self_collision_method", "bone_proxy_distance"),
                "full_mesh_coverage": has_mesh_coverage,
                "checked_pairs": len(filtered),
                "collisions": filtered
            })
            if filtered:
                worst = max(c.get("penetration_m", 0.0) for c in filtered)
                if worst > max_tol:
                    g_status = REFUTED
                    limits.append(f"penetração excessiva entre partes não adjacentes ({worst:.4f}m > {max_tol:.4f}m)")
                else:
                    g_status = MEASURED
                    limits.append("proximidade entre partes não adjacentes detectada abaixo da tolerância de corte")
            else:
                if not has_mesh_coverage:
                    g_status = UNPROVABLE
                    missing.append("cobertura geométrica completa de malha (BVH/interseção triângulo-triângulo)")
                    limits.append("proxy de ossos não detectou colisão nos pontos testados, mas não garante ausência de interpenetração de malha sem cobertura geométrica completa")
                else:
                    g_status = PROVEN

        elif kind == "deformation_window":
            bones = claim.get("bones", [])
            if not bones:
                missing.append("lista aprovada de ossos que devem produzir a deformação")
            else:
                start, end = map(int, claim["frames"])
                rows = _frames(observation, start, end)
                threshold = claim.get("min_scale_delta")
                per_frame = []
                for row in rows:
                    vals = []
                    for name in bones:
                        b = _bone(row, name)
                        if b:
                            vals.append(max(abs(float(x) - 1.0) for x in b.get("local_scale", [1, 1, 1])))
                    per_frame.append({"frame": row["author_frame"], "max_scale_delta": max(vals) if vals else None})
                evidence.append({"kind": "bone_scale", "samples": per_frame, "window": [start, end]})
                if threshold is None:
                    g_status = MEASURED
                    missing.append("limiar de deformação aprovado")
                elif any(x["max_scale_delta"] is None for x in per_frame):
                    missing.append("todos os ossos declarados presentes")
                else:
                    g_status = PROVEN if all(x["max_scale_delta"] >= float(threshold) for x in per_frame) else REFUTED

        elif kind == "artistic_judgement":
            is_art = True
            art_ref = claim.get("art_reference")
            if not art_ref:
                missing.append("referências aprovadas e decisões rotuladas pelo diretor")
                limits.append("peso, agressividade, clareza e qualidade não são fatos geométricos")
                a_status = ART_NO_REF
                g_status = UNPROVABLE
            else:
                a_status = ART_ANALYSIS

        else:
            missing.append("avaliador implementado para o tipo %s" % kind)
            g_status = UNPROVABLE

        # Síntese multi-dimensional
        req_temporal = claim.get("requires_temporal", False)
        final_status, syn_notes = synthesize_final_status(
            geometric=g_status,
            temporal=t_status,
            visual=v_status,
            artistic=a_status,
            requires_visual=req_visual,
            requires_temporal=req_temporal,
            requires_approved_criterion=req_crit,
            criterion_status=crit_status,
            is_artistic_claim=is_art,
        )
        limits.extend(syn_notes)

        verdicts.append(
            Verdict(
                claim_id=cid,
                status=final_status,
                statement=statement,
                evidence=evidence,
                missing=missing,
                limitations=limits,
                criterion_origin=origin,
                geometric_status=g_status,
                temporal_status=t_status,
                visual_status=v_status,
                artistic_status=a_status,
                criterion_status=crit_status,
            )
        )

    counts = {x: 0 for x in (PROVEN, REFUTED, MEASURED, UNPROVABLE)}
    for row in verdicts:
        counts[row.status] = counts.get(row.status, 0) + 1

    return {
        "schema": "arenamon.animation-witness.verdict/2",
        "spec_name": spec.get("name"),
        "summary": counts,
        "claims": [x.json() for x in verdicts],
        "policy": {
            "green_means": "somente afirmação comprovada pela evidência declarada",
            "measured_is_not_approval": True,
            "unknown_claims_fail_closed": True,
            "artistic_claims_require_approved_examples": True,
            "fail_closed_on_unprovable": True,
        },
    }


def update_visual_evidence_in_verdict(
    verdict: dict[str, Any],
    captures: list[dict[str, Any]],
    views_utility: dict[str, Any],
) -> None:
    """Atualiza o status visual dos claims no veredito a partir das capturas reais e do gate visual."""
    claims = verdict.get("claims", [])
    claim_images: dict[str, list[str]] = {}
    for cap in captures:
        rel_dir = cap.get("relative_dir", "").replace("\\", "/")
        req_claims = cap.get("required_for_claims", [])
        for cid in req_claims:
            claim_images.setdefault(cid, [])
            for img_name in views_utility:
                if cap.get("name") in img_name or rel_dir in img_name:
                    if img_name not in claim_images[cid]:
                        claim_images[cid].append(img_name)

    for c in claims:
        cid = c["claim_id"]
        imgs = claim_images.get(cid, [])
        if not imgs:
            imgs = [k for k in views_utility if cid in k]

        if not imgs:
            continue

        useful_imgs = []
        occluded_imgs = []
        rejected_reasons = []

        for img in imgs:
            u_info = views_utility.get(img, {})
            if u_info.get("is_useful"):
                useful_imgs.append(img)
            else:
                reasons = u_info.get("rejection_reasons", [])
                rejected_reasons.extend(reasons)
                if any("OCLUSAO" in r for r in reasons):
                    occluded_imgs.append(img)

        useful_cams = []
        for img in useful_imgs:
            cam = views_utility.get(img, {}).get("camera")
            if cam:
                useful_cams.append(cam)

        has_two_independent = False
        if len(useful_cams) >= 2:
            for i in range(len(useful_cams)):
                for j in range(i + 1, len(useful_cams)):
                    c1, c2 = useful_cams[i], useful_cams[j]
                    indep, _ = are_views_independent(
                        c1.get("location", [0, 0, 0]), c1.get("target", [0, 0, 0]),
                        c2.get("location", [0, 0, 0]), c2.get("target", [0, 0, 0])
                    )
                    if indep:
                        has_two_independent = True
                        break
                if has_two_independent:
                    break
        elif len(useful_imgs) >= 2:
            view_names = {views_utility.get(im, {}).get("view_name") for im in useful_imgs}
            if len(view_names) >= 2:
                has_two_independent = True

        if has_two_independent and len(useful_imgs) >= 2:
            c["visual_status"] = VISUAL_USEFUL
        elif occluded_imgs and not useful_imgs:
            c["visual_status"] = VISUAL_OCCLUDED
        else:
            c["visual_status"] = VISUAL_INSUFFICIENT

        c["visual_evidence_summary"] = {
            "total_images": len(imgs),
            "useful_images": len(useful_imgs),
            "useful_files": useful_imgs,
            "has_independent_views": has_two_independent,
            "gate_rejections": sorted(list(set(rejected_reasons))),
        }
