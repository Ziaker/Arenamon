"""Gera normas (normas_za.json) e o relatório HTML a partir do banco (clipes.jsonl).

  python -I gerar_relatorio.py <clipes.jsonl> <pasta_saida>

Normas = mediana e faixa p10–p90 de cada medida, por categoria + fase de clipe (ex.: attack, start),
contando um clipe por espécie/categoria/fase/conjunto para que Pokémon com muitas formas não pesem mais.
"""
import html
import json
import os
import sys
from collections import Counter, defaultdict

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import inventario  # noqa: E402
import config  # noqa: E402
import normas as normas_mod  # noqa: E402

MEDIDAS = [
    ("duracao_s", "Duração", "s"),
    ("ate_pico_s", "Início → pico", "s"),
    ("recuperacao_s", "Pico → fim do movimento", "s"),
    ("pico_rel", "Posição do pico no clipe", "0–1"),
    ("antecipacao_q", "Antecipação (quadros, quando há)", "q"),
    ("antecipacao_rel_golpe", "Recuo da antecipação / tamanho do golpe", "×"),
    ("antecipacao_ate_golpe_q", "Do recuo máximo ao pico do golpe", "q"),
    ("hold_total_q", "Quadros em hold", "q"),
    ("overshoot_rel", "Overshoot do efetor", "×"),
    ("ease", "Ease (fração lenta)", "0–1"),
    ("snap", "Snap (pico / mediana)", "×"),
    ("subida_max_H", "Subida máx. da raiz", "H"),
    ("desloc_horizontal_H", "Deslocamento horizontal", "H"),
]
CATEGORIAS_DESTAQUE = ["attack", "rangeattack", "damage", "walk", "run", "jumpup", "jumpdown", "land",
                       "roar", "appeal", "defaultwait", "battlewait", "turn", "turnmove", "down", "stun",
                       "charge", "glad", "notice", "hate", "eat", "sleep", "rest", "search", "refresh"]
ROTULOS = {
    "attack": "Ataque físico", "rangeattack": "Ataque à distância", "damage": "Levar dano",
    "walk": "Andar", "run": "Correr", "jumpup": "Pulo (subida)", "jumpdown": "Pulo (descida)",
    "land": "Pouso", "roar": "Rugido", "appeal": "Exibição", "defaultwait": "Espera (campo)",
    "battlewait": "Espera (batalha)", "turn": "Virar parado", "turnmove": "Virar andando",
    "down": "Cair/desmaiar", "stun": "Atordoado", "charge": "Carregar", "glad": "Alegria",
    "notice": "Notar", "hate": "Raiva", "eat": "Comer", "sleep": "Dormir", "rest": "Descansar",
    "search": "Procurar", "refresh": "Sacudir-se",
}


def q(vals, p):
    return float(np.percentile(vals, p)) if vals else None


def resumo(vals):
    vals = [v for v in vals if v is not None]
    if not vals:
        return None
    return {"n": len(vals), "p10": round(q(vals, 10), 3), "mediana": round(q(vals, 50), 3),
            "p90": round(q(vals, 90), 3)}


def carregar(caminho):
    with open(caminho, encoding="utf-8") as fh:
        return [json.loads(l) for l in fh if l.strip()]


def um_por_especie(linhas):
    """Mantém o primeiro clipe de cada (espécie, categoria, fase, extra, conjunto), preferindo a forma 0."""
    vistos, out = set(), []
    for l in sorted(linhas, key=lambda l: (l["forma"], l["variante"] or "")):
        k = (l["especie"] or l["modelo"][:6], l["categoria"], l["fase"], l["extra"], l["conjunto"])
        if k not in vistos:
            vistos.add(k)
            out.append(l)
    return out


def normas(linhas):
    grupos = defaultdict(list)
    for l in linhas:
        if l.get("parado"):
            continue
        grupos[(l["categoria"], l["fase"])].append(l)
    out = {}
    for (cat, fase), ls in grupos.items():
        g = {"clipes": len(ls), "especies": len({l["especie"] for l in ls})}
        for m, _, _ in MEDIDAS:
            if m.startswith("antecipacao_") and m != "antecipacao":
                vals = [l.get(m) for l in ls if l.get("antecipacao")]
            else:
                vals = [l.get(m) for l in ls]
            g[m] = resumo(vals)
        nsa = all(l.get("antecipacao_status") == "NAO_SE_APLICA" for l in ls)
        g["com_antecipacao"] = None if nsa else round(sum(1 for l in ls if l.get("antecipacao")) / len(ls), 3)
        g["com_hold"] = round(sum(1 for l in ls if l.get("holds")) / len(ls), 3)
        curvas = np.array([l["curva_energia"] for l in ls if l.get("curva_energia")])
        if len(curvas):
            g["curva"] = {k: [round(float(v), 3) for v in np.percentile(curvas, p, axis=0)]
                          for k, p in (("p25", 25), ("mediana", 50), ("p75", 75))}
        out["%s|%s" % (cat, fase)] = g
    return out


def chaves(linhas):
    dens = sum(l.get("faixas_densas", 0) for l in linhas)
    esp = sum(l.get("faixas_esparsas", 0) for l in linhas)
    fixas = sum(l.get("faixas_fixas", 0) for l in linhas)
    razao = [l["chaves_por_faixa_esparsa"] / l["quadros"] for l in linhas
             if l.get("chaves_por_faixa_esparsa") and l["quadros"] > 10]
    return {"faixas_densas": dens, "faixas_esparsas": esp, "faixas_fixas": fixas,
            "chaves_por_quadro_esparsas": resumo(razao)}


def svg_curva(c, w=220, h=64):
    if not c:
        return ""
    n = len(c["mediana"])

    def pts(vals):
        return " ".join("%.1f,%.1f" % (i * (w - 4) / (n - 1) + 2, h - 2 - min(v, 1.2) / 1.2 * (h - 4))
                        for i, v in enumerate(vals))

    banda = pts(c["p75"]) + " " + " ".join(reversed(pts(c["p25"]).split(" ")))
    return ('<svg viewBox="0 0 %d %d" class="curva" role="img" aria-label="Curva típica de energia">'
            '<polygon points="%s" class="banda"/><polyline points="%s" class="linha"/></svg>'
            % (w, h, banda, pts(c["mediana"])))


def fmt(r, unidade=""):
    if not r or r.get("mediana") is None:
        return '<span class="vazio">—</span>'
    return ('<b>%s</b><small> %s–%s</small>' % (_n(r["mediana"]), _n(r["p10"]), _n(r["p90"])))


def _n(v):
    return ("%.2f" % v).rstrip("0").rstrip(".") if isinstance(v, float) else str(v)


def main():
    banco, saida = sys.argv[1], sys.argv[2]
    os.makedirs(saida, exist_ok=True)
    todas = carregar(banco)
    corpo = [l for l in todas if l["codigo"] and not l["codigo"].startswith("08")]
    conjuntos = sorted({l["conjunto"] for l in corpo})
    por_conj = {c: um_por_especie([l for l in corpo if l["conjunto"] == c]) for c in conjuntos}
    norm = {"conjunto_%d" % c: normas(por_conj[c]) for c in conjuntos}
    info = {
        "clipes": len(todas), "modelos": len({l["modelo"] for l in todas}),
        "especies": len({l["especie"] for l in todas if l["especie"]}),
        "por_conjunto": dict(Counter(l["conjunto"] for l in todas)),
        "fps": dict(Counter(l["fps"] for l in todas)),
        "chaves": chaves(todas),
        "escala_animada": sum(1 for l in todas if l.get("escala_animada")),
        "faixas_sem_osso": sum(l.get("faixas_sem_osso", 0) for l in todas),
        "formas_corpo": dict(Counter(l["forma_corpo"] for l in um_por_especie(corpo) if l["categoria"] == "attack")),
    }
    grupos = grupos_normas(corpo)
    curvas = {k: {"curva": v.get("curva")} for k, v in norm["conjunto_0"].items() if v.get("curva")}
    with open(os.path.join(saida, "normas_za.json"), "w", encoding="utf-8") as fh:
        json.dump({"sobre": info, "medidas": {m: [r, u] for m, r, u in MEDIDAS}, "n_especies_min": config.N_ESPECIES_MIN,
                   "grupos": {"%s|%s" % k: v for k, v in grupos.items()}, "curvas_conjunto_0": curvas,
                   "por_conjunto_legado": norm}, fh, ensure_ascii=False, indent=1)

    # por forma do corpo, só ataques físicos (conjunto 0)
    por_forma = defaultdict(list)
    for l in por_conj[0]:
        if l["categoria"] == "attack" and not l["fase"] and not l.get("parado"):
            por_forma[l["forma_corpo"]].append(l)

    # dados compactos para a busca
    busca = [[l["nome"], l["modelo"], l["clipe"], l["duracao_s"], l.get("ate_pico_s"),
              l.get("antecipacao_q") if l.get("antecipacao") else 0, l.get("hold_total_q"),
              l.get("overshoot_rel"), l.get("efetor", ""), l["conjunto"]]
             for l in corpo if not l.get("parado")]
    info["reconciliacao"] = inventario.reconciliar(todas)
    with open(os.path.join(saida, "normas_grupos_za.json"), "w", encoding="utf-8") as fh:
        json.dump({"%s|%s" % k: v for k, v in grupos.items() if v["n_clipes"]}, fh, ensure_ascii=False, indent=1)
    escrever_html(os.path.join(saida, "relatorio.html"), info, norm, por_forma, busca,
                  fase1=secoes_fase1(corpo, por_conj[0]), grupos=grupos)
    print("relatório e normas em", saida)


def grupos_normas(corpo, aprovacoes=None):
    """Grupos (categoria, fase) do conjunto 0 pelo normas.grupo: status com config.N_ESPECIES_MIN e aprovações."""
    apr = normas_mod.carregar_aprovacoes() if aprovacoes is None else aprovacoes
    out = {}
    for cat in sorted({l["categoria"] for l in corpo}):
        for fase in ("", "start", "loop", "end"):
            g = normas_mod.grupo(corpo, cat, fase, aprovacoes=apr)
            if g["n_clipes"]:
                out[(cat, fase)] = g
    return out


def ontologia_regras():
    import ontologia
    return ontologia.carregar_regras()


def _pct(a, b):
    return "%d%%" % round(100 * a / b) if b else "—"


def _tabela(cab, linhas):
    return ('<div class="wrap"><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (
        "".join("<th>%s</th>" % html.escape(c) for c in cab),
        "".join("<tr>%s</tr>" % "".join("<td>%s</td>" % c for c in l) for l in linhas)))


def secoes_fase1(corpo, por_conj0):
    """Camadas 1C–1G no relatório: papéis, ontologia, eventos, escala, locomoção e poses-chave."""
    out = []
    ataques = [l for l in por_conj0 if l["categoria"] == "attack" and not l["fase"] and l.get("status") == "MEDIDO"]
    na = len(ataques)
    if na:
        ex = Counter(r for l in ataques for r in (l.get("executores") or []))
        inc = sum(1 for l in ataques if l.get("papeis_status") == "INCONCLUSIVO")
        dois = sum(1 for l in ataques if len(l.get("executores") or []) >= 2)
        ini = Counter(l.get("iniciador") for l in ataques if l.get("iniciador"))
        face_antigo = sum(1 for l in ataques if any(t in (l.get("efetor_maior_percurso") or "")
                                                   for t in ("eye", "ear", "feeler")))
        face_novo = sum(1 for l in ataques if any(r in ("olho_palpebra", "apendice_sensorial")
                                                 for r in (l.get("executores") or [])))
        out.append("<h2>Quem executa o ataque físico (1C)</h2>")
        out.append("<p class=\"nota\">%d ataques físicos (um por espécie, conjunto 0). O executor é escolhido por regras de ação + anatomia "
                   "(<code>regras_papeis.json</code>), nunca pelo osso que mais se move. Olho/orelha/antena como “efetor” pelo critério antigo: "
                   "<b>%d</b>; como executor agora: <b>%d</b>. Inconclusivo: <b>%s</b>. Com 2 ou mais executores: <b>%s</b>. "
                   "Status: <b>CANDIDATO</b> até o gabarito humano da avaliação cega.</p>" % (
                       na, face_antigo, face_novo, _pct(inc, na), _pct(dois, na)))
        out.append(_tabela(["Região executora", "Ataques", "%"], [[html.escape(r), n, _pct(n, na)] for r, n in ex.most_common(12)]))
        out.append(_tabela(["Quem começa a se mover", "Ataques", "%"], [[html.escape(r), n, _pct(n, na)] for r, n in ini.most_common(8)]))
        com_ap = sum(1 for l in ataques if l.get("apoio_impulso"))
        ap = Counter(r for l in ataques for r in (l.get("apoio_impulso") or []))
        out.append("<h3>Pernas de apoio/impulso</h3>")
        out.append("<p class=\"nota\">Executor é só quem golpeia. Perna que não golpeia mas dobra ≥ %s° da preparação ao golpe "
                   "(sustenta o peso ou empurra) fica em <code>apoio_impulso</code>. Ataques com pelo menos uma perna de apoio: <b>%s</b>. "
                   "Status: <b>CANDIDATO</b>; o limiar ainda não foi calibrado com rótulos.</p>" % (
                       _n(ontologia_regras().get("apoio_impulso", {}).get("flexao_minima_graus", "?")), _pct(com_ap, na)))
        if ap:
            out.append(_tabela(["Perna de apoio/impulso", "Ataques", "%"], [[html.escape(r), n, _pct(n, na)] for r, n in ap.most_common(6)]))
    cats_loco = set(ontologia_regras().get("locomocao", {}).get("categorias", []))
    loops = [l for l in por_conj0 if l["categoria"] in cats_loco and l.get("fase") == "loop" and l.get("status") == "MEDIDO"]
    if loops:
        linhas_l = []
        for cat in sorted({l["categoria"] for l in loops}):
            ls = [l for l in loops if l["categoria"] == cat]
            sem = sum(1 for l in ls if not l.get("executores"))
            reg = Counter(r for l in ls for r in (l.get("executores") or []))
            linhas_l.append([html.escape(cat), len(ls), _pct(sem, len(ls)),
                             html.escape(", ".join("%s %s" % (r, _pct(n, len(ls))) for r, n in reg.most_common(4)))])
        out.append("<h2>Papéis na locomoção</h2>")
        out.append("<p class=\"nota\">Em loops de locomoção (%s) todo membro que cicla é executor e a antecipação <b>não se aplica</b>. "
                   "Sem executor = nenhum membro passa do pico mínimo (corpo avançando inteiro ou pose quase parada).</p>" % html.escape(", ".join(sorted(cats_loco))))
        out.append(_tabela(["Categoria (loop)", "Clipes", "Sem executor", "Membros mais comuns"], linhas_l))
    fr = [l.get("ontologia_outro_frac") for l in corpo if l.get("ontologia_outro_frac") is not None]
    if fr:
        por_rig = {}
        for l in corpo:
            if l.get("ontologia_outro_frac") is not None:
                por_rig[l["modelo"]] = (l["ontologia_outro_frac"], l.get("ontologia_outro_ossos") or [])
        piores = sorted(por_rig.items(), key=lambda kv: -kv[1][0])[:8]
        med = float(np.median([v[0] for v in por_rig.values()]))
        acima = sum(1 for v in por_rig.values() if v[0] > 0.05)
        out.append("<h2>Cobertura da ontologia</h2>")
        out.append("<p>Fração dos ossos animados que nenhuma regra classificou (região <code>outro</code>), por modelo: mediana <b>%.1f%%</b>; "
                   "modelos acima da meta de 5%%: <b>%d de %d</b>. Os piores e alguns ossos sem região:</p>" % (100 * med, acima, len(por_rig)))
        out.append(_tabela(["Modelo", "Em 'outro'", "Exemplos de ossos"],
                           [[m, "%.0f%%" % (100 * v[0]), html.escape(", ".join(v[1][:6]))] for m, v in piores]))
    if na:
        multi = sum(1 for l in ataques if (l.get("n_eventos") or 0) > 1)
        por_classe = defaultdict(Counter)
        for l in ataques:
            if l.get("ordem_ativacao"):
                por_classe[l.get("anatomia_classe", "?")][l["ordem_ativacao"][0]] += 1
        out.append("<h2>Eventos e ordem de ativação (1D)</h2>")
        out.append("<p>Ataques em que a velocidade do executor tem mais de um pico (preparação, golpe e recuperação contam separados): <b>%s</b>. Região motora que se move primeiro na preparação do golpe, por classe do corpo:</p>" % _pct(multi, na))
        out.append(_tabela(["Classe", "1ª região (mais comum)", "n"],
                           [[c, html.escape(", ".join("%s %d" % kv for kv in cnt.most_common(3))), sum(cnt.values())]
                            for c, cnt in sorted(por_classe.items(), key=lambda kv: -sum(kv[1].values()))]))
    cats = Counter(l["categoria"] for l in corpo)
    linhas = []
    for cat, _ in cats.most_common(12):
        ls = [l for l in corpo if l["categoria"] == cat and l.get("status") == "MEDIDO"]
        if not ls:
            continue
        linhas.append([html.escape(cat), len(ls), _pct(sum(1 for l in ls if l.get("squash_stretch_regioes")), len(ls)),
                       _pct(sum(1 for l in ls if l.get("partes_ocultas")), len(ls))])
    out.append("<h2>Squash/stretch e partes escondidas (L08)</h2>")
    out.append("<p>Squash/stretch = região com escala ≠ 1 que volta ao normal. Parte escondida = o jogo zera a escala (cauda, asas…); "
               "esses quadros ficam fora de todas as medidas de movimento.</p>")
    out.append(_tabela(["Categoria", "Clipes", "Com squash/stretch", "Com partes escondidas"], linhas))
    loc = [l for l in corpo if l["categoria"] in ("walk", "run") and l.get("fase") == "loop" and l.get("locomocao_modo")]
    if loc:
        modo = Counter(l["locomocao_modo"] for l in loc)
        mot = Counter(m for l in loc for m in (l.get("locomocao_motivos") or []))
        esc = sum(1 for l in loc if (l.get("escorregoes_n") or 0) > 0)
        cad = [l["cadencia_passos_s"] for l in loc if l.get("cadencia_passos_s")]
        out.append("<h2>Locomoção e apoio (1E)</h2>")
        out.append("<p class=\"nota\">%d loops de andar/correr. O contato é <b>inferido</b> de um chão estimado (o Z-A não traz o chão); "
                   "nunca é confirmado sem revisão visual. Modo: %s. Com escorregão inferido: <b>%s</b>. Cadência mediana: <b>%s passos/s</b>.</p>" % (
                       len(loc), html.escape(", ".join("%s %d" % kv for kv in modo.most_common())), _pct(esc, len(loc)),
                       _n(float(np.median(cad))) if cad else "—"))
        if mot:
            out.append(_tabela(["Motivo de SEM_INFORMACAO", "Clipes"], [[html.escape(m), n] for m, n in mot.most_common(6)]))
    pc = [l for l in corpo if l.get("poses_chave_n")]
    if pc:
        linhas = []
        for cat, _ in Counter(l["categoria"] for l in pc).most_common(10):
            ls = [l for l in pc if l["categoria"] == cat]
            conc = [l["poses_chave_concordancia_arquivo"] for l in ls if l.get("poses_chave_concordancia_arquivo") is not None]
            linhas.append([html.escape(cat), len(ls), "%.0f%%" % (100 * float(np.median([l["poses_chave_frac"] for l in ls]))),
                           _n(float(np.median([l["poses_chave_n"] for l in ls]))),
                           "%.0f%%" % (100 * float(np.median(conc))) if conc else "—"])
        out.append("<h2>Poses-chave (1G)</h2>")
        out.append("<p class=\"nota\"><b>Aproximação, não o blocking do animador.</b> Menor conjunto de quadros que reconstrói o clipe "
                   "dentro de 1% da altura e 3°. A concordância compara com os quadros em que pelo menos metade das faixas do arquivo têm chave.</p>")
        out.append(_tabela(["Categoria", "Clipes", "Quadros-chave (% do clipe)", "Nº mediano", "Concordância com o arquivo"], linhas))
    out.append("<h2>Avaliação cega (1I)</h2>")
    out.append("<p>Lote de 40 animações para rotulagem humana (a página mostra só os itens mantidos pelo revisor): <a href=\"avaliacao/lote_01/rotulagem.html\">abrir a página de rotulagem</a>. "
               "As previsões do sistema ficam guardadas à parte e só são comparadas depois dos rótulos (A/B com McNemar).</p>")
    return "\n".join(out)


def escrever_html(caminho, info, norm, por_forma, busca, fase1="", grupos=None):
    n0 = norm["conjunto_0"]
    linhas = []
    for cat in CATEGORIAS_DESTAQUE:
        for fase in ("", "start", "loop", "end"):
            g = n0.get("%s|%s" % (cat, fase))
            if not g or g["especies"] < 5:
                continue
            nome = ROTULOS.get(cat, cat) + (" · " + fase if fase else "")
            gn = (grupos or {}).get((cat, fase))
            if not gn:
                continue
            md = gn["medidas"]
            rotulo = "MEDIDO, NÃO APROVADO" if gn["status"] == "MEDIDO" else "SEM BASE COMPARÁVEL"
            linhas.append(
                "<tr data-n=\"%d\"><th>%s<small>%d clipes · %d espécies · %d rigs · %s</small></th><td>%s</td><td>%s</td><td>%s</td><td>%s</td>"
                "<td>%s<small> %s q</small></td><td>%s</td><td>%d%%</td><td>%s</td><td>%s</td></tr>" % (
                    gn["n_especies"], html.escape(nome), gn["n_clipes"], gn["n_especies"], gn["n_rigs_estruturais"], rotulo,
                    svg_curva(g.get("curva")), fmt(md["duracao_s"]), fmt(md["ate_pico_s"]), fmt(md["pico_rel"]),
                    "%d%%" % round(100 * gn["com_antecipacao_frac"]) if gn["com_antecipacao_frac"] is not None else "não se aplica",
                    _n(md["antecipacao_q"]["mediana"]) if md["antecipacao_q"].get("mediana") is not None else "—",
                    fmt(md["antecipacao_ate_golpe_q"]), round(100 * (gn["com_hold_frac"] or 0)),
                    fmt(md["overshoot_rel"]), fmt(md["ease"])))
    formas = []
    for f, ls in sorted(por_forma.items(), key=lambda kv: -len(kv[1])):
        if len(ls) < 3:
            continue
        formas.append("<tr><th>%s<small>%d espécies</small></th><td>%s</td><td>%s</td><td>%d%%</td><td>%s</td></tr>" % (
            html.escape(f), len(ls), fmt(resumo([l["duracao_s"] for l in ls])),
            fmt(resumo([l.get("ate_pico_s") for l in ls])),
            round(100 * sum(1 for l in ls if l.get("antecipacao")) / len(ls)),
            fmt(resumo([l.get("antecipacao_q") for l in ls if l.get("antecipacao")]))))
    ch = info["chaves"]
    tot = ch["faixas_densas"] + ch["faixas_esparsas"] + ch["faixas_fixas"]
    cpq = ch["chaves_por_quadro_esparsas"] or {}
    def m(g, k):
        return _n(g[k]["mediana"]) if g.get(k) else "—"

    conj = []
    for chave in sorted(norm):
        c = int(chave.split("_")[1])
        a = norm[chave].get("attack|", {})
        conj.append("<tr><th>%dxxxx</th><td>%d</td><td>%d</td><td>%s</td><td>%s</td><td>%s</td></tr>" % (
            c, info["por_conjunto"].get(c, 0), a.get("especies", 0), m(a, "duracao_s"), m(a, "ate_pico_s"),
            "%d%%" % round(100 * a["com_antecipacao"]) if a and a.get("com_antecipacao") is not None else "—"))

    rec = info["reconciliacao"]
    cob = "".join(
        "<tr><th>%sxxxx</th><td>%d</td><td>%d</td><td>%d</td><td>%d</td></tr>" % (
            g, v["total"], v["na_busca"], v["rosto"], v["parado"]) for g, v in rec["por_grupo"].items())
    cob += "<tr><th>Total</th><td><b>%d</b></td><td><b>%d</b></td><td><b>%d</b></td><td><b>%d</b></td></tr>" % (
        rec["total"], rec["na_busca"], rec["excluidos"]["rosto"], rec["excluidos"]["parado"])
    doc = TEMPLATE.format(
        esc_anim=f"{info['escala_animada']:,}".replace(",", "."), sem_osso=info["faixas_sem_osso"],
        cobertura=cob, fora_busca=", ".join(rec["modelos_fora_da_busca"]) or "nenhum",
        rotulos=", ".join(rec["rotulos_tecnicos"]) or "nenhum", fora_padrao=rec["excluidos"]["fora_do_padrao"],
        esp_ids=rec["especies_ids_nao_zero"], rot_busca=rec["rotulos_na_busca"],
        mod_total=rec["modelos_total"], mod_busca=rec["modelos_na_busca"],
        clipes=f"{info['clipes']:,}".replace(",", "."), modelos=info["modelos"], especies=info["especies"],
        fps=", ".join("%s fps: %d" % kv for kv in sorted(info["fps"].items())),
        pct_esp=round(100 * ch["faixas_esparsas"] / max(tot, 1)), pct_dens=round(100 * ch["faixas_densas"] / max(tot, 1)),
        pct_fixa=round(100 * ch["faixas_fixas"] / max(tot, 1)),
        cpq=round(100 * cpq.get("mediana", 0)), cpq10=round(100 * cpq.get("p10", 0)), cpq90=round(100 * cpq.get("p90", 0)),
        conj="\n".join(conj),
        linhas="\n".join(linhas), formas="\n".join(formas),
        busca=json.dumps(busca, ensure_ascii=False, separators=(",", ":")), fase1=fase1,
    )
    with open(caminho, "w", encoding="utf-8") as fh:
        fh.write(doc)


TEMPLATE = """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Referências Z-A</title>
<style>
:root{{--bg:#0f1419;--card:#171d24;--tx:#e6e9ee;--mut:#8b96a5;--ac:#38bdf8;--ln:#26303b;--banda:rgba(56,189,248,.18)}}
@media (prefers-color-scheme: light){{:root:not([data-theme="dark"]){{--bg:#f6f7f9;--card:#fff;--tx:#14181d;--mut:#5d6773;--ac:#0369a1;--ln:#e3e7ec;--banda:rgba(3,105,161,.14)}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 system-ui,Segoe UI,sans-serif}}
main{{max-width:1180px;margin:0 auto;padding:24px 16px 64px}}h1{{margin:.2em 0 .1em;font-size:1.7em}}h2{{margin:1.8em 0 .5em;font-size:1.2em}}
p,li{{color:var(--mut)}}b{{color:var(--tx)}}.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}}
.card{{background:var(--card);border:1px solid var(--ln);border-radius:10px;padding:12px 14px}}.card b{{display:block;font-size:1.5em}}
.wrap{{overflow-x:auto;background:var(--card);border:1px solid var(--ln);border-radius:10px}}
table{{border-collapse:collapse;width:100%;font-size:13.5px}}th,td{{padding:7px 10px;border-bottom:1px solid var(--ln);text-align:left;vertical-align:middle;white-space:nowrap}}
thead th{{color:var(--mut);font-weight:600;font-size:12px;position:sticky;top:0;background:var(--card)}}tbody th small,td small{{display:block;color:var(--mut);font-weight:400;font-size:11.5px}}
td small{{display:inline}}.vazio{{color:var(--mut)}}.curva{{width:150px;height:44px;display:block}}.banda{{fill:var(--banda)}}.linha{{fill:none;stroke:var(--ac);stroke-width:2}}
input{{width:100%;max-width:420px;padding:9px 12px;border-radius:8px;border:1px solid var(--ln);background:var(--card);color:var(--tx);font-size:15px}}
dl{{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;color:var(--mut)}}dt{{color:var(--tx);font-weight:600}}
.nota{{border-left:3px solid var(--ac);padding:6px 12px;background:var(--card);border-radius:0 8px 8px 0}}
</style></head><body><main>
<h1>Banco de referências de animação · Pokémon Legends: Z-A</h1>
<p>Cada animação do jogo virou números de timing e espaçamento, calculados a partir do esqueleto real. A cinemática direta (com a compensação de escala do rig) foi conferida contra o Blender em 8 rigs e 16 clipes, em todos os quadros: erro máximo de 0,0007% da altura e 0,026° (detalhe em <code>evidencia/paridade/</code>). Estas são as normas profissionais que o Motion Lens e o Blender Vision podem usar como referência.</p>
<div class="cards">
<div class="card"><b>{clipes}</b>clipes medidos</div><div class="card"><b>{especies}</b>espécies</div>
<div class="card"><b>{modelos}</b>modelos (formas)</div><div class="card"><b>{pct_esp}%</b>das faixas têm chaves esparsas</div></div>

<h2>Cobertura: o que está no banco e o que a busca mostra</h2>
<p>Todos os clipes do dump estão no banco. A busca e as normas deixam de fora dois tipos, contados aqui para que a soma feche: clipes de <b>rosto</b> (código 08xxx, olhos e boca) e clipes <b>parados</b> (o corpo não se move). Nomes fora do padrão de código: {fora_padrao}.</p>
<div class="wrap"><table><thead><tr><th>Grupo</th><th>No banco</th><th>Na busca</th><th>Rosto (fora)</th><th>Parado (fora)</th></tr></thead><tbody>{cobertura}</tbody></table></div>
<p>Modelos: {mod_total} no banco, {mod_busca} na busca. Fora da busca (só têm clipes parados ou de rosto): {fora_busca}. Espécies: {esp_ids} IDs diferentes de zero no banco (inclui o 9999, sem nome no catálogo); {rot_busca} rótulos na busca. Rótulos técnicos (sem nome de espécie): {rotulos}.</p>

<h2>Como o jogo guarda as chaves</h2>
<p class="nota">As animações <b>não</b> são todas "assadas". <b>{pct_esp}%</b> das faixas de osso guardam só algumas chaves (esparsas), <b>{pct_dens}%</b> têm chave em todo quadro e <b>{pct_fixa}%</b> são um valor fixo. Nas esparsas, a mediana é <b>{cpq}%</b> dos quadros com chave (p10–p90: {cpq10}%–{cpq90}%). Essa é uma redução automática de chaves, não necessariamente a escolha do animador, mas mostra a densidade que o jogo aceita sem perder o movimento. {fps}.</p>
<p><b>Denominador:</b> cada osso tem até duas faixas contadas separadamente, translação e rotação. A escala não entra na conta. "Esparsa" = faixa com lista de quadros (Framed8/Framed16); "densa" = um valor por quadro (Dynamic); "fixa" = um valor só (Fixed). Ossos sem faixa no clipe não são contados.</p>
<p><b>Escala animada:</b> {esc_anim} clipes têm algum osso com escala diferente de 1 (mais de 2%), o que indica squash/stretch ou crescimento de partes. A cinemática aplica essa escala com a compensação por osso do rig. Faixas com nome de osso que não existe no esqueleto: {sem_osso}, ignoradas. São nós de controle de expressão (<code>exp_ops_root</code>, <code>exp_op_000</code>…), não ossos.</p>

<h2>Conjuntos de clipes (primeiro dígito do código)</h2>
<p>O mesmo clipe aparece com códigos 0xxxx, 1xxxx, 2xxxx…: são animações diferentes, não cópias. O jogo não diz o que cada conjunto é (campo, batalha, variante?). Isso <b>não foi confirmado</b>. As normas abaixo usam o conjunto 0; os outros estão em <code>normas_za.json</code>.</p>
<div class="wrap"><table><thead><tr><th>Conjunto</th><th>Clipes</th><th>Espécies com ataque físico</th><th>Duração do ataque (s)</th><th>Início → pico (s)</th><th>Com antecipação</th></tr></thead><tbody>{conj}</tbody></table></div>

<h2>Normas por tipo de clipe (conjunto 0, um clipe por espécie)</h2>
<p><label>Mostrar só grupos com pelo menos <input id="nmin" type="number" min="1" max="400" value="8" style="width:70px"> espécies</label> (abaixo disso o grupo é <b>SEM_BASE_COMPARAVEL</b>). Todas as normas são <b>medidas, não aprovadas</b>: a adequação artística fica <b>NÃO AVALIADA</b> até alguém aprovar um aspecto com nome.</p>
<p>Cada célula: <b>mediana</b> e faixa p10–p90. A curva é a energia típica do movimento ao longo do clipe (linha = mediana, faixa = p25–p75).</p>
<div class="wrap"><table><thead><tr><th>Tipo</th><th>Curva de energia</th><th>Duração (s)</th><th>Início → pico (s)</th><th>Pico no clipe (0–1)</th><th>Com antecipação</th><th>Recuo → golpe (q)</th><th>Com hold</th><th>Overshoot (×)</th><th>Ease (0–1)</th></tr></thead>
<tbody>{linhas}</tbody></table></div>

{fase1}

<h2>Ataque físico por forma do corpo</h2>
<p>A forma do corpo vem da classificação da PokeAPI (humanoide, quadrúpede, asas…). Use para escolher referência parecida com o Pokémon do Arenamon.</p>
<div class="wrap"><table><thead><tr><th>Forma</th><th>Duração (s)</th><th>Início → pico (s)</th><th>Com antecipação</th><th>Antecipação (q)</th></tr></thead><tbody>{formas}</tbody></table></div>

<h2>Buscar um Pokémon ou clipe</h2>
<p>Digite parte do nome (em inglês, ex.: <b>lucario</b>, <b>golisopod</b>) e/ou do clipe (ex.: <b>attack01</b>). Mostra até 200 linhas.</p>
<input id="q" placeholder="ex.: lucario attack" autocomplete="off">
<div class="wrap" style="margin-top:10px"><table><thead><tr><th>Pokémon</th><th>Modelo</th><th>Clipe</th><th>Duração (s)</th><th>Início → pico (s)</th><th>Antecipação (q)</th><th>Hold (q)</th><th>Overshoot</th><th>Efetor</th></tr></thead><tbody id="res"></tbody></table></div>

<h2>O que cada medida significa</h2>
<dl>
<dt>H</dt><dd>altura do esqueleto em repouso; distâncias em H comparam Pokémon de tamanhos diferentes.</dd>
<dt>Energia</dt><dd>velocidade média dos ossos do corpo, medida em relação ao quadril (tira o deslocamento).</dd>
<dt>Início / fim do movimento</dt><dd>primeiro e último quadro com energia ≥ 10% do pico.</dd>
<dt>Efetor</dt><dd>o osso que mais percorre caminho no clipe (geralmente mão, pé, cauda ou ponta).</dd>
<dt>Antecipação</dt><dd>o efetor recua contra a direção do golpe antes do pico de velocidade. "Recuo → golpe" é quantos quadros separam o ponto de maior recuo do pico do golpe.</dd>
<dt>Hold</dt><dd>trecho de 3+ quadros no meio do movimento com energia abaixo de 10% do pico.</dd>
<dt>Overshoot</dt><dd>quanto o efetor passa da pose final na direção do golpe, relativo ao tamanho do golpe.</dd>
<dt>Ease</dt><dd>fração dos quadros ativos com energia abaixo de 30% do pico (alto = muito tempo devagar e um pico curto).</dd>
</dl>
<h2>Limites</h2>
<ul>
<li>As medidas são geométricas, sem julgamento artístico. Em clipes de loop (andar, esperar), "antecipação" e "overshoot" medem oscilação, não golpe.</li>
<li>A escala dos ossos entra na cinemática (com a compensação por osso do rig); partes escondidas por escala ficam fora das medidas de movimento. O contato com o chão é inferido de um chão estimado, nunca confirmado sem revisão visual.</li>
<li>A forma do corpo é a da espécie, não a de cada forma ou Mega.</li>
<li>Curvas .trcrv, efeitos .traef e câmera não entram.</li>
</ul>
</main>
<script>
const D={busca};
const q=document.getElementById('q'),res=document.getElementById('res');
const f=v=>v===null||v===undefined?'—':(typeof v==='number'?(+v.toFixed(2)).toString():v);
function render(){{const t=q.value.toLowerCase().trim().split(/\\s+/).filter(Boolean);
if(!t.length){{res.innerHTML='<tr><td colspan="9" class="vazio">Digite para buscar.</td></tr>';return}}
const out=[];for(const r of D){{const s=(r[0]+' '+r[1]+' '+r[2]).toLowerCase();if(t.every(x=>s.includes(x))){{out.push(r);if(out.length>=200)break}}}}
res.innerHTML=out.map(r=>`<tr><th>${{r[0]}}</th><td>${{r[1]}}</td><td>${{r[2]}}</td><td>${{f(r[3])}}</td><td>${{f(r[4])}}</td><td>${{f(r[5])}}</td><td>${{f(r[6])}}</td><td>${{f(r[7])}}</td><td>${{r[8]}}</td></tr>`).join('')||'<tr><td colspan="9" class="vazio">Nada encontrado.</td></tr>'}}
q.addEventListener('input',render);render();
const nmin=document.getElementById('nmin');
function filtrar(){{const v=+nmin.value||1;document.querySelectorAll('tr[data-n]').forEach(r=>{{r.style.display=(+r.dataset.n>=v)?'':'none'}})}}
nmin.addEventListener('input',filtrar);filtrar();
</script></body></html>
"""

if __name__ == "__main__":
    main()
