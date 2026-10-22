"""Referencias artisticas APROVADAS pelo diretor (registro + comparacao medida).

Regras (todas aplicadas em codigo):
- uma referencia so existe como `approved: true` se `approved_by` (pessoa) e `scope` (aspectos) forem informados; nada e aprovado por padrao;
- animacoes do projeto NAO viram referencia por estarem disponiveis; videos da internet nao entram;
- uma rejeicao vale para os aspectos listados (`rejected_aspects`), nao para a animacao inteira;
- `compare` devolve SEMELHANCA MEDIDA por aspecto declarado no escopo. Semelhanca nao e adequacao: o resultado sempre traz
  `adequacao_artistica: NAO_AVALIADA` e nunca um veredito global.
"""
from __future__ import annotations

import json
import os
import time
from typing import Any


def _jl(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _jd(obj, path):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=1, ensure_ascii=False)

ASPECTS = ["timing", "anticipation", "sequencing", "arcs", "silhouette", "line_of_action", "weight", "exaggeration", "impact", "continuity", "other"]
KINDS = ["pose_images", "animation_3d", "description", "approved_example", "rejected_example"]
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DIR = os.path.join(HERE, "references")


class RefError(Exception):
    pass


def features_from_motion(m: dict[str, Any]) -> dict[str, Any]:
    """aspectos MEDIVEIS extraidos de um motion_report (so numeros e ordens; sem juizo)"""
    f0, f1 = m["frames"]
    n = f1 - f0 + 1
    feat: dict[str, Any] = {"n_frames": n}
    pk = (m["fases"].get("pico") or {}).get("frame")
    if pk is not None:
        feat["pico_posicao_normalizada"] = round((pk - f0) / max(1, n - 1), 3)
    ph = {p["fase"]: p["frames"] for p in m["fases"]["fases"]}
    feat["fases_normalizadas"] = {k: [round((v[0] - f0) / max(1, n - 1), 3), round((v[1] - f0) / max(1, n - 1), 3)] for k, v in ph.items()}
    a = m["antecipacao"]
    feat["antecipacao"] = {"presente": a.get("presente"), "razao_recuo_curso": a.get("razao_recuo_curso")}
    feat["ordem_do_corpo"] = m["sequencia_do_corpo"]["ordem"]
    feat["virada_max_graus"] = m["arco"]["virada_max_graus"]
    return feat


def add(ref_id: str, name: str, kind: str, origin: str, scope: list[str], approved_by: str | None, features: dict[str, Any] | None = None,
        rejected_aspects: list[str] | None = None, justification: str = "", files: list[str] | None = None, refs_dir: str = DEFAULT_DIR, fixture: bool = False) -> dict[str, Any]:
    if kind not in KINDS:
        raise RefError("kind invalido: %s" % KINDS)
    for a in scope + (rejected_aspects or []):
        if a not in ASPECTS:
            raise RefError("aspecto '%s' invalido: %s" % (a, ASPECTS))
    if not scope and not rejected_aspects:
        raise RefError("informe o escopo (aspectos aprovados) ou os aspectos rejeitados")
    if kind == "rejected_example" and not (justification or "").strip():
        raise RefError("exemplo rejeitado exige justificativa")
    if not origin.strip():
        raise RefError("informe a origem dos criterios")
    ref = {"schema": "arenamon.art-reference/1", "id": ref_id, "name": name, "kind": kind, "origin": origin,
           "approved": bool(approved_by), "approved_by": approved_by or None, "approval_date": time.strftime("%Y-%m-%d") if approved_by else None,
           "scope": scope, "rejected_aspects": rejected_aspects or [], "justification": justification, "files": files or [],
           "features": features or {}, "fixture": fixture}
    os.makedirs(refs_dir, exist_ok=True)
    p = os.path.join(refs_dir, ref_id + ".json")
    if os.path.exists(p):
        raise RefError("referencia '%s' ja existe (nao sobrescrevo)" % ref_id)
    _jd(ref, p)
    return ref


def load(ref_id: str, refs_dir: str = DEFAULT_DIR) -> dict[str, Any]:
    p = os.path.join(refs_dir, ref_id + ".json")
    if not os.path.isfile(p):
        raise RefError("referencia '%s' nao encontrada em %s" % (ref_id, refs_dir))
    return _jl(p)


def list_refs(refs_dir: str = DEFAULT_DIR) -> list[dict[str, Any]]:
    if not os.path.isdir(refs_dir):
        return []
    out = []
    for f in sorted(os.listdir(refs_dir)):
        if f.endswith(".json"):
            r = _jl(os.path.join(refs_dir, f))
            out.append({k: r.get(k) for k in ("id", "name", "kind", "approved", "approved_by", "scope", "rejected_aspects", "fixture")})
    return out


def compare(ref: dict[str, Any], motion: dict[str, Any], tol_pos: float = 0.08, tol_phase: float = 0.10) -> dict[str, Any]:
    """semelhanca MEDIDA nos aspectos do escopo aprovado. Recusa referencia nao aprovada."""
    if not ref.get("approved") or not ref.get("approved_by"):
        return {"status": "REFERENCIA_NAO_APROVADA", "adequacao_artistica": "NAO_AVALIADA", "motivo": "sem aprovacao de um responsavel nao ha comparacao valida"}
    cand = features_from_motion(motion)
    rf = ref.get("features", {})
    rows = {}
    for asp in ref.get("scope", []):
        if asp == "timing" and "pico_posicao_normalizada" in rf:
            d = abs(cand["pico_posicao_normalizada"] - rf["pico_posicao_normalizada"])
            ph = []
            for k, rv in rf.get("fases_normalizadas", {}).items():
                cv = cand["fases_normalizadas"].get(k)
                ph.append({"fase": k, "ref": rv, "cand": cv, "dif_inicio": None if cv is None else round(abs(cv[0] - rv[0]), 3)})
            rows["timing"] = {"pico_ref": rf["pico_posicao_normalizada"], "pico_cand": cand["pico_posicao_normalizada"], "dif_pico": round(d, 3), "dentro_da_tolerancia": d <= tol_pos, "fases": ph}
        elif asp == "anticipation" and rf.get("antecipacao"):
            rows["anticipation"] = {"ref": rf["antecipacao"], "cand": cand["antecipacao"], "mesmo_estado": rf["antecipacao"].get("presente") == cand["antecipacao"].get("presente")}
        elif asp == "sequencing" and rf.get("ordem_do_corpo"):
            rows["sequencing"] = {"ref": rf["ordem_do_corpo"], "cand": cand["ordem_do_corpo"], "mesma_ordem": rf["ordem_do_corpo"] == cand["ordem_do_corpo"]}
        elif asp == "arcs" and rf.get("virada_max_graus") is not None:
            rows["arcs"] = {"ref": rf["virada_max_graus"], "cand": cand["virada_max_graus"]}
        else:
            rows[asp] = {"status": "SEM_MEDIDA_AUTOMATICA", "nota": "este aspecto exige comparacao visual de imagens da referencia com folhas da animacao; nao ha medida aqui"}
    return {"status": "COMPARADO", "referencia": ref["id"], "aprovada_por": ref["approved_by"], "escopo": ref["scope"], "semelhanca_medida": rows,
            "adequacao_artistica": "NAO_AVALIADA",
            "aviso": "semelhanca de curvas/ordens NAO significa que a animacao e boa; aspectos fora do escopo aprovado nao foram comparados"}
