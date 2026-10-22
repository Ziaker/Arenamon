"""Protocolo de diagnostico (A-G) e seu validador. Um diagnostico so e ACEITO se o que ele afirma estiver ancorado em evidencia observada.

A. O que esta visivel?        B. O que e interpretado?       C. Que dados sustentam?        D. Interpretacoes alternativas?
E. O que falta observar?      F. Correcao sugerida (NUNCA aplicada aqui)       G. Grau de sustentacao.

O validador rejeita: folha citada sem o codigo de leitura correto; regiao afirmada em frame/vista em que nao foi observada; afirmacao
visual com menos de 2 vistas independentes; fato geometrico sem medida resolvivel; aprovacao artistica sem referencia aprovada com escopo;
texto generico do tipo "esta fluida"; correcao marcada como aplicada. Nao verifica se a descricao esta CERTA (so a pessoa/agente que olhou
a imagem sabe), e isso e dito no resultado.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

from perception_geom import QUERY_REGIONS, independent_of


def _jl(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _jd(obj, path):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=1, ensure_ascii=False)

NIVEIS = ("fato_geometrico", "observacao_visual", "hipotese_coreografica", "preferencia_artistica")
GENERICAS = [r"\best[aá] fluid", r"\bimpacto (est[aá] )?forte", r"\bparece (bom|bem|ok)", r"\bficou (bom|bem|[oó]timo|excelente)", r"\bexcelente\b", r"\bperfeit[oa]\b",
             r"\best[aá] (ok|[oó]timo|bonit)", r"\bsem problemas\b", r"\btudo certo\b"]
APROVACAO = [r"\baprovad[oa]\b", r"\bcertificad[oa]\b", r"\bpassou\b"]
MIN_DESC, MIN_JUST, MIN_ALT = 40, 25, 15


def resolve(path: str, roots: dict[str, Any]) -> Any:
    cur: Any = roots
    for part in path.split("."):
        if isinstance(cur, dict):
            if part in cur:
                cur = cur[part]
            elif part.isdigit() and int(part) in cur:
                cur = cur[int(part)]
            else:
                raise KeyError(path)
        elif isinstance(cur, list):
            try:
                cur = cur[int(part)]
            except (ValueError, IndexError):
                raise KeyError(path)
        else:
            raise KeyError(path)
    return cur


def load_bundle(investigation: str | None, motion: str | None, contacts: str | None) -> dict[str, Any]:
    b: dict[str, Any] = {"dirs": {}}
    if investigation:
        b["dirs"]["investigation"] = os.path.abspath(investigation)
        b["investigation"] = _jl(os.path.join(investigation, "investigation.json"))
        b["index"] = _jl(os.path.join(investigation, "evidence_index.json"))
    if motion:
        b["motion"] = _jl(os.path.join(motion, "motion_report.json"))
    if contacts:
        b["contacts"] = _jl(os.path.join(contacts, "contacts.json"))
    return b


def _generic(text: str) -> str | None:
    t = (text or "").lower()
    for pat in GENERICAS:
        if re.search(pat, t):
            return pat
    return None


def _sheet(index: dict[str, Any], f: str) -> dict[str, Any] | None:
    for s in index.get("sheets", []):
        if s["file"] == f:
            return s
    return None


def _view_ok_at(sheet: dict[str, Any], frame: int, min_visible: float, max_clipped: float) -> bool:
    pf = sheet.get("per_frame") or {}
    m = pf.get(str(frame)) or pf.get(frame)
    return bool(m) and m.get("visible_frac") is not None and m["visible_frac"] >= min_visible and m.get("clipped_frac", 1.0) <= max_clipped


def _reference_ok(ref_id: str | None, aspect: str | None, refs_dir: str) -> tuple[bool, str]:
    if not ref_id:
        return False, "sem referencia aprovada vinculada"
    p = os.path.join(refs_dir, ref_id + ".json")
    if not os.path.isfile(p):
        return False, "referencia '%s' nao existe em %s" % (ref_id, refs_dir)
    r = _jl(p)
    if not r.get("approved") or not r.get("approved_by"):
        return False, "referencia '%s' nao esta aprovada por um responsavel" % ref_id
    if aspect and r.get("scope") and aspect not in r["scope"]:
        return False, "referencia '%s' aprovada apenas para %s, nao para '%s'" % (ref_id, r["scope"], aspect)
    return True, ""


def validate(diag: dict[str, Any], bundle: dict[str, Any], refs_dir: str) -> dict[str, Any]:
    index = bundle.get("index") or {}
    params = (bundle.get("investigation") or {}).get("params", {})
    min_vis, max_clip = params.get("min_visible", 0.6), params.get("max_clipped", 0.02)
    roots = {k: bundle[k] for k in ("investigation", "motion", "contacts") if k in bundle}
    results, seen_desc = [], {}
    entries = diag.get("entries")
    if not entries:
        return {"status": "REJEITADO", "entries": [], "rejeicoes_gerais": ["diagnostico sem entradas"], "nota": _NOTA}
    for e in entries:
        why, warn = [], []
        eid = e.get("id", "?")
        region, frames = e.get("region"), [int(x) for x in e.get("frames", [])]
        if region not in QUERY_REGIONS:
            why.append("regiao '%s' desconhecida (%s)" % (region, ", ".join(QUERY_REGIONS)))
        if not frames:
            why.append("frames ausentes")
        A, B, C = e.get("A_visivel") or {}, e.get("B_interpretacao") or "", e.get("C_dados") or {}
        D, E, Fc, Gs = e.get("D_alternativas") or [], e.get("E_falta_observar"), e.get("F_correcao") or {}, e.get("G_sustentacao") or {}
        nivel = Gs.get("nivel")
        # texto
        desc = A.get("descricao", "")
        if len(desc.strip()) < MIN_DESC:
            why.append("A: descricao do que esta visivel curta demais (< %d caracteres)" % MIN_DESC)
        for nm, tx in (("A", desc), ("B", B), ("G", Gs.get("justificativa", ""))):
            g = _generic(tx)
            if g:
                why.append("%s: texto generico sem observacao especifica (%s)" % (nm, g))
        if len(B.strip()) < 20:
            why.append("B: interpretacao ausente ou curta")
        if len(Gs.get("justificativa", "").strip()) < MIN_JUST:
            why.append("G: justificativa do grau de sustentacao curta demais")
        if nivel not in NIVEIS:
            why.append("G: nivel '%s' invalido (%s)" % (nivel, ", ".join(NIVEIS)))
        if not D or any(len(str(x).strip()) < MIN_ALT for x in D):
            why.append("D: informe ao menos uma interpretacao alternativa substantiva")
        if Fc.get("aplicada"):
            why.append("F: correcao marcada como aplicada; esta fase so SUGERE")
        if not Fc.get("descricao"):
            why.append("F: correcao sugerida ausente")
        if desc.strip() and seen_desc.get(desc.strip()):
            warn.append("descricao identica a da entrada %s" % seen_desc[desc.strip()])
        seen_desc[desc.strip()] = eid
        # imagens
        cited = A.get("folhas") or C.get("imagens") or []
        valid_views = []
        for c in cited:
            sh = _sheet(index, c.get("file", ""))
            if sh is None:
                why.append("folha '%s' nao consta no indice de evidencias" % c.get("file"))
                continue
            if str(c.get("leitura", "")).strip().upper() != sh["token"].upper():
                why.append("folha '%s': codigo de leitura ausente/incorreto (a folha nao foi comprovadamente aberta)" % c.get("file"))
                continue
            if sh["kind"] != "rgb":
                continue
            if region in QUERY_REGIONS and sh["region"] != region and sh["region"] != "corpo_todo":
                why.append("folha '%s' e da regiao '%s', nao de '%s'" % (c["file"], sh["region"], region))
                continue
            if not set(frames) <= set(sh["frames"]):
                why.append("folha '%s' nao contem todos os frames citados %s" % (c["file"], frames))
                continue
            valid_views.append(sh)
        # cobertura por frame, com independencia
        unobserved = []
        for f in frames:
            good = [s for s in valid_views if _view_ok_at(s, f, min_vis, max_clip)]
            picked: list[Any] = []
            for s in good:
                if independent_of(s["direction"], [p["direction"] for p in picked]):
                    picked.append(s)
            if nivel == "observacao_visual" and len(picked) < 2:
                why.append("regiao '%s' no frame %d NAO foi observada em 2 vistas independentes com visibilidade >= %.0f%% (%d valida(s)); afirmacao visual proibida" % (region, f, 100 * min_vis, len(picked)))
            if nivel == "hipotese_coreografica" and len(picked) < 1:
                why.append("regiao '%s' no frame %d nao foi observada em nenhuma vista citada; nem hipotese visual pode ser sustentada" % (region, f))
            if len(picked) < 2:
                unobserved.append(f)
        if unobserved and (E is None or not [x for x in E if len(str(x).strip()) >= 10]):
            why.append("E: ha frames sem 2 vistas independentes %s; descreva o que falta observar" % unobserved)
        if nivel == "hipotese_coreografica" and not E:
            why.append("E: hipotese exige declarar o que falta observar para confirma-la")
        # medicoes
        meds = C.get("medicoes") or []
        for m in meds:
            try:
                resolve(m, roots)
            except KeyError:
                why.append("C: medicao '%s' nao existe nos relatorios fornecidos" % m)
        if nivel == "fato_geometrico" and not meds:
            why.append("G: fato geometrico exige ao menos uma medicao citada em C")
        # aprovacao artistica
        wants_art = nivel == "preferencia_artistica" or e.get("aprovacao_artistica") or any(re.search(p, (B + " " + Gs.get("justificativa", "")).lower()) for p in APROVACAO)
        if wants_art:
            ok, msg = _reference_ok(e.get("referencia_aprovada"), e.get("aspecto"), refs_dir)
            if not ok:
                why.append("aprovacao/preferencia artistica: " + msg)
        results.append({"id": eid, "status": "REJEITADO" if why else ("ACEITO_COM_AVISOS" if warn else "ACEITO"), "motivos": why, "avisos": warn, "frames_sem_2_vistas": unobserved})
    rej = [r for r in results if r["status"] == "REJEITADO"]
    return {"status": "REJEITADO" if rej else "ACEITO", "aceitas": sum(1 for r in results if r["status"] != "REJEITADO"), "rejeitadas": len(rej), "entries": results, "nota": _NOTA}


_NOTA = ("ACEITO = a afirmacao esta ancorada em folhas abertas, em regioes realmente observadas e sem aprovacao artistica indevida. "
         "NAO prova que a descricao esta correta nem que o agente entendeu a imagem.")


def template(questions: list[dict[str, Any]], bundle: dict[str, Any]) -> dict[str, Any]:
    """esqueleto A-G com uma entrada por pergunta aplicavel (campos vazios; o agente preenche depois de ABRIR as folhas)"""
    sheets = [s for s in (bundle.get("index") or {}).get("sheets", []) if s["kind"] == "rgb"]
    out = []
    for i, q in enumerate(q for q in questions if q["aplicavel"]):
        reg = next((r for r in q["regioes_para_abrir"] if r in QUERY_REGIONS), "corpo_todo")
        rel = [s["file"] for s in sheets if s["region"] == reg]
        out.append({"id": "d%02d" % (i + 1), "principio": q["principio"], "region": reg, "frames": q["frames"], "pergunta": q["pergunta_visual"], "folhas_sugeridas": rel,
                    "A_visivel": {"descricao": "", "folhas": [{"file": f, "leitura": ""} for f in rel]}, "B_interpretacao": "",
                    "C_dados": {"medicoes": [m for m in q["medidas_relacionadas"] if "*" not in m]}, "D_alternativas": [], "E_falta_observar": [],
                    "F_correcao": {"descricao": "", "aplicada": False}, "G_sustentacao": {"nivel": "", "justificativa": ""},
                    "aprovacao_artistica": False, "referencia_aprovada": None, "a_medida_nao_responde": q["a_medida_nao_responde"]})
    return {"reviewer": "", "entries": out}
