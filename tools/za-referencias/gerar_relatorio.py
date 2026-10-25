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
        g["com_antecipacao"] = round(sum(1 for l in ls if l.get("antecipacao")) / len(ls), 3)
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
    if not r:
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
        "formas_corpo": dict(Counter(l["forma_corpo"] for l in um_por_especie(corpo) if l["categoria"] == "attack")),
    }
    with open(os.path.join(saida, "normas_za.json"), "w", encoding="utf-8") as fh:
        json.dump({"sobre": info, "medidas": {m: [r, u] for m, r, u in MEDIDAS}, "normas": norm}, fh,
                  ensure_ascii=False, indent=1)

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
    escrever_html(os.path.join(saida, "relatorio.html"), info, norm, por_forma, busca)
    print("relatório e normas em", saida)


def escrever_html(caminho, info, norm, por_forma, busca):
    n0 = norm["conjunto_0"]
    linhas = []
    for cat in CATEGORIAS_DESTAQUE:
        for fase in ("", "start", "loop", "end"):
            g = n0.get("%s|%s" % (cat, fase))
            if not g or g["especies"] < 5:
                continue
            nome = ROTULOS.get(cat, cat) + (" · " + fase if fase else "")
            linhas.append(
                "<tr><th>%s<small>%d espécies</small></th><td>%s</td><td>%s</td><td>%s</td><td>%s</td>"
                "<td>%d%%<small> %s q</small></td><td>%s</td><td>%d%%</td><td>%s</td><td>%s</td></tr>" % (
                    html.escape(nome), g["especies"], svg_curva(g.get("curva")), fmt(g["duracao_s"]),
                    fmt(g["ate_pico_s"]), fmt(g["pico_rel"]), round(100 * g["com_antecipacao"]),
                    _n(g["antecipacao_q"]["mediana"]) if g.get("antecipacao_q") else "—",
                    fmt(g["antecipacao_ate_golpe_q"]), round(100 * g["com_hold"]),
                    fmt(g["overshoot_rel"]), fmt(g["ease"])))
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
            "%d%%" % round(100 * a["com_antecipacao"]) if a else "—"))

    rec = info["reconciliacao"]
    cob = "".join(
        "<tr><th>%sxxxx</th><td>%d</td><td>%d</td><td>%d</td><td>%d</td></tr>" % (
            g, v["total"], v["na_busca"], v["rosto"], v["parado"]) for g, v in rec["por_grupo"].items())
    cob += "<tr><th>Total</th><td><b>%d</b></td><td><b>%d</b></td><td><b>%d</b></td><td><b>%d</b></td></tr>" % (
        rec["total"], rec["na_busca"], rec["excluidos"]["rosto"], rec["excluidos"]["parado"])
    doc = TEMPLATE.format(
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
        busca=json.dumps(busca, ensure_ascii=False, separators=(",", ":")),
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
<p>Cada animação do jogo virou números de timing e espaçamento, calculados a partir do esqueleto real (cinemática direta conferida contra o Blender: erro máximo de 0,2% da altura). Estas são as normas profissionais que o Motion Lens e o Blender Vision podem usar como referência.</p>
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

<h2>Conjuntos de clipes (primeiro dígito do código)</h2>
<p>O mesmo clipe aparece com códigos 0xxxx, 1xxxx, 2xxxx…: são animações diferentes, não cópias. O jogo não diz o que cada conjunto é (campo, batalha, variante?). Isso <b>não foi confirmado</b>. As normas abaixo usam o conjunto 0; os outros estão em <code>normas_za.json</code>.</p>
<div class="wrap"><table><thead><tr><th>Conjunto</th><th>Clipes</th><th>Espécies com ataque físico</th><th>Duração do ataque (s)</th><th>Início → pico (s)</th><th>Com antecipação</th></tr></thead><tbody>{conj}</tbody></table></div>

<h2>Normas por tipo de clipe (conjunto 0, um clipe por espécie)</h2>
<p>Cada célula: <b>mediana</b> e faixa p10–p90. A curva é a energia típica do movimento ao longo do clipe (linha = mediana, faixa = p25–p75).</p>
<div class="wrap"><table><thead><tr><th>Tipo</th><th>Curva de energia</th><th>Duração (s)</th><th>Início → pico (s)</th><th>Pico no clipe (0–1)</th><th>Com antecipação</th><th>Recuo → golpe (q)</th><th>Com hold</th><th>Overshoot (×)</th><th>Ease (0–1)</th></tr></thead>
<tbody>{linhas}</tbody></table></div>

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
<li>Escala de osso é ignorada (quase sempre 1). Contato com o chão e passos por ciclo ainda não são medidos.</li>
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
</script></body></html>
"""

if __name__ == "__main__":
    main()
