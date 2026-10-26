"""Monta as propostas IA (rótulos + evidências + revisão + relatório) a partir de uma interpretação declarada.

  python ia_propostas.py <lote>/rotulagem.html <saida_ia> <interpretacao.json> [--testes "resumo dos testes"]

A interpretação (JSON) é o único lugar onde ficam as respostas, cada uma com nível de evidência (A/B/C/INCONCLUSIVO),
quadros, vistas e justificativa. Este script não decide nada sozinho: só junta, confere com
ia_pipeline.validate_export e grava. Nada é escrito na pasta do lote humano.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

import ia_pipeline

VERSAO = "ia-propostas-1"
NIVEL_CONF = {"A": "alta", "B": "media", "C": "baixa", "INCONCLUSIVO": "sem base"}
ORDEM_CONF = ["alta", "media", "baixa"]
# confiança por bloco da página de rotulagem (conf_*) <- campos que o bloco cobre
BLOCOS = {"conf_executa": ["executores"], "conf_apoio": ["apoio_impulso"], "conf_inicio": ["iniciadores", "iniciador"],
          "conf_antecipacao": ["antecipacao"], "conf_fases": ["antecipacao_q", "fase_recuo_inicio", "fase_recuo_fim",
                                                             "fase_golpe_inicio", "fase_golpe_pico", "fase_pose_fim",
                                                             "fase_recuperacao_fim"]}
CAMPOS_CONTADOS = ["executores", "apoio_impulso", "iniciador", "iniciadores", "antecipacao", "parte_some_aparece",
                   "apoio", "leitura_pose", "massa_aparente", "intencao"]


def _inconclusivo(v):
    return v == "INCONCLUSIVO" or v == ["INCONCLUSIVO"] or v is None


def montar(batch, interp, fontes=None):
    """Devolve (exportação no formato do rotulagem.html, evidências por id). Falha se faltar item ativo."""
    itens = interp.get("itens", {})
    faltando = [it["id"] for it in batch["itens"] if it["id"] not in itens]
    if faltando:
        raise ValueError("Itens ativos sem interpretação (não invento respostas): %s" % ", ".join(faltando))
    rotulos, evid = [], {}
    for it in batch["itens"]:
        dado = itens[it["id"]]
        resp = dado["respostas"]
        row = {"id": it["id"]}
        for campo, p in resp.items():
            row[campo] = p["valor"]
        conf = {c: NIVEL_CONF.get(p.get("nivel"), "sem base") for c, p in resp.items()}
        for bloco, campos in BLOCOS.items():
            niveis = [conf[c] for c in campos if c in conf and conf[c] in ORDEM_CONF]
            if niveis:   # o bloco vale o campo mais fraco
                row[bloco] = max(niveis, key=ORDEM_CONF.index)
        row["observacao"] = dado["observacao"]
        rotulos.append(row)
        f = (fontes or {}).get(it["id"], {})
        evid[it["id"]] = {"id": it["id"], "versao_analise": interp.get("versao_analise", VERSAO),
                          "analista": interp.get("analista", "IA não validada por humano"),
                          "fontes": {"videos": f.get("videos", []), "imagens": dado.get("imagens", []),
                                     "animacao_3d": f.get("animacao_3d")},
                          "eventos": dado.get("eventos", []), "respostas": resp, "confianca_por_campo": conf,
                          "limitacoes": dado.get("limitacoes", []), "revisao_humana": "PENDENTE"}
    exp = {"lote": batch["hash"], "revisor": interp.get("revisor", "IA — não validada por humano"),
           "origem": "PROPOSTO_IA", "rotulos": rotulos}
    return exp, evid


def inconclusivos_por_campo(exp):
    return {c: sum(1 for r in exp["rotulos"] if c in r and _inconclusivo(r[c])) for c in CAMPOS_CONTADOS}


def saida_segura(html, saida):
    lote = Path(html).resolve().parent
    s = Path(saida).resolve()
    if s == lote or lote in s.parents:
        raise ValueError("A saída da IA não pode ficar dentro da pasta do lote humano: %s" % s)
    return s


def _sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for b in iter(lambda: fh.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def _gravar(caminho, valor):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    tmp = caminho.with_suffix(caminho.suffix + ".tmp")
    tmp.write_text(json.dumps(valor, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, caminho)


def fontes_do_lote(saida, batch):
    """Vídeos com hash (preparação) e cinemática original por item, quando existirem."""
    out = {}
    man = saida / "preparacao_manifesto.json"
    prep = {x["id"]: x for x in json.loads(man.read_text(encoding="utf-8"))["itens"]} if man.exists() else {}
    for it in batch["itens"]:
        slug = it["id"].replace("/", "__")
        p = prep.get(it["id"], {})
        cin = saida / "cinematica" / (slug + ".json")
        out[it["id"]] = {
            "videos": [{"original": s["original"], "sha256": s["sha256"]} for s in p.get("fontes", []) if s["original"].endswith(".webm")],
            "animacao_3d": ({"arquivo": str(cin.relative_to(saida)).replace("\\", "/"), "sha256": _sha(cin)} if cin.exists() else None),
            "sincronia": p.get("sincronia")}
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("html")
    ap.add_argument("saida")
    ap.add_argument("interpretacao")
    ap.add_argument("--testes", default="não informado")
    a = ap.parse_args()
    saida = saida_segura(a.html, a.saida)
    batch = ia_pipeline.read_lote(a.html)
    interp = json.loads(Path(a.interpretacao).read_text(encoding="utf-8"))
    fontes = fontes_do_lote(saida, batch)
    exp, evid = montar(batch, interp, fontes)
    erros = ia_pipeline.validate_export(exp, batch, evid)
    if erros:
        raise SystemExit("Validação falhou (nada gravado):\n- " + "\n- ".join(erros))
    _gravar(saida / "rotulos_ia.json", exp)
    for i, e in evid.items():
        _gravar(saida / "evidencias" / (i.replace("/", "__") + ".json"), e)
    sem3d = [i for i, f in fontes.items() if not f["animacao_3d"]]
    rel = {"versao": VERSAO, "lote": batch["hash"], "html": batch["html"], "html_sha256": batch["html_sha256"],
           "itens_ativos": len(batch["itens"]), "ignorados": batch["lote"].get("ignorados", []),
           "analisados": len(exp["rotulos"]), "com_cinematica_original": len(batch["itens"]) - len(sem3d),
           "so_video": sem3d, "inconclusivos_por_campo": inconclusivos_por_campo(exp),
           "videos_com_problema": {i: f["sincronia"]["problemas"] for i, f in fontes.items()
                                   if f.get("sincronia") and not f["sincronia"]["compativeis"]},
           "arquivos": ["rotulos_ia.json", "evidencias/", "rotulagem_ia_review.html", "relatorio_execucao.json"],
           "testes": a.testes, "validacao_export": "sem erros (ia_pipeline.validate_export)",
           "pendente_revisao_humana": [r["id"] for r in exp["rotulos"]],
           "aviso": "Propostas de IA não validadas por humano; não são gabarito do A/B."}
    _gravar(saida / "relatorio_execucao.json", rel)
    import ia_review
    batch_rev = dict(batch)
    ia_review.render_review(batch_rev, exp, evid, saida / "rotulagem_ia_review.html")
    print(json.dumps({"rotulos": len(exp["rotulos"]), "inconclusivos": rel["inconclusivos_por_campo"],
                      "revisao": str(saida / "rotulagem_ia_review.html")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
