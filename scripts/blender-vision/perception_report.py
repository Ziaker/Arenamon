#!/usr/bin/env python
"""Gera relatorio.html (autocontido, abre direto do disco) a partir da pasta de evidencias da percepcao.

  python scripts/blender-vision/perception_report.py scripts/blender-vision/evidence/perception_mosh

Espera na pasta: investigation/{investigation.json,evidence_index.json,sheets/}, motion/{motion_report.json}, contacts/contacts.json,
diagnostico_*.json, validacao_diagnostico.json, validador_adversarial.json, bench_dev.json, bench_eval.json, antes_depois.json,
resumo.json (texto escrito por quem analisou: titulo, resumo[], nao_provado[], limitacoes[], reproduzir[]).
Todo link e relativo: o relatorio funciona de qualquer lugar da pasta oficial.
"""
import html
import json
import os
import sys

esc = html.escape


def J(p, default=None):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except OSError:
        return default


CSS = """
:root{color-scheme:dark;--bg:#070b12;--card:#101a28;--line:#26384f;--text:#edf6ff;--muted:#96aac1;--blue:#38bdf8;--green:#34d399;--amber:#fbbf24;--red:#f87171;--violet:#a78bfa}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% 0,#142843 0,var(--bg) 55%);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px 16px 60px}
main{max-width:1180px;margin:auto}h1{font-size:clamp(1.6rem,4vw,2.4rem);margin:.2em 0}h2{margin:34px 0 10px;font-size:1.3rem;border-bottom:1px solid var(--line);padding-bottom:6px}h3{margin:18px 0 6px;font-size:1.05rem}
p,li{color:#d6e4f2}.muted{color:var(--muted)}a{color:var(--blue)}.back{display:inline-block;margin-bottom:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:12px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
table{border-collapse:collapse;width:100%;font-size:.88rem}th,td{border:1px solid var(--line);padding:6px 9px;text-align:left;vertical-align:top}th{background:#0d1521}
.tag{display:inline-block;padding:1px 9px;border-radius:99px;font-size:.78rem;font-weight:700;border:1px solid var(--line)}.ok{color:var(--green);border-color:var(--green)}.warn{color:var(--amber);border-color:var(--amber)}.bad{color:var(--red);border-color:var(--red)}.info{color:var(--violet);border-color:var(--violet)}
img{max-width:100%;border:1px solid var(--line);border-radius:10px;background:#000}details{margin:8px 0;border:1px solid var(--line);border-radius:12px;padding:6px 14px;background:#0d1521}summary{cursor:pointer;padding:6px 0;font-weight:700}
code{background:#0d1521;border:1px solid var(--line);border-radius:6px;padding:1px 6px;font-size:.85em;color:#cbeeff}pre{background:#0d1521;border:1px solid var(--line);border-radius:10px;padding:12px;overflow:auto;font-size:.82rem}
.notice{border:1px solid rgba(251,191,36,.45);background:rgba(251,191,36,.08);border-radius:12px;padding:10px 16px}
"""


def tag(txt, cls):
    return '<span class="tag %s">%s</span>' % (cls, esc(str(txt)))


def status_tag(s):
    s = str(s)
    cls = "ok" if s in ("ACEITO", "OBSERVADO_SUFICIENTE", "COMPROVADO") else "bad" if s in ("REJEITADO", "NAO_OBSERVAVEL") else "warn"
    return tag(s, cls)


def build(d):
    R = J(os.path.join(d, "resumo.json"), {})
    inv = J(os.path.join(d, "investigation", "investigation.json"), {})
    idx = J(os.path.join(d, "investigation", "evidence_index.json"), {})
    mot = J(os.path.join(d, "motion", "motion_report.json"), {})
    con = J(os.path.join(d, "contacts", "contacts.json"), {})
    ad = J(os.path.join(d, "antes_depois.json"), {})
    val = J(os.path.join(d, "validacao_diagnostico.json"), {})
    adv = J(os.path.join(d, "validador_adversarial.json"), [])
    bd, be = J(os.path.join(d, "bench_dev.json"), {}), J(os.path.join(d, "bench_eval.json"), {})
    vt = J(os.path.join(d, "verificacao_tempo_fbx_x_glb.json"), {})
    diag_file = next((f for f in sorted(os.listdir(d)) if f.startswith("diagnostico_") and f.endswith(".json")), None)
    diag = J(os.path.join(d, diag_file), {}) if diag_file else {}
    out = ['<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>%s</title><style>%s</style></head><body><main>' % (esc(R.get("titulo", "Percepcao ativa")), CSS)]
    out.append('<a class="back" href="../../../../ABRIR_ARENAMON.html">&larr; Central Arenamon</a>')
    out.append("<h1>%s</h1>" % esc(R.get("titulo", "Percepcao ativa")))
    out.append('<p class="muted">%s</p>' % esc(R.get("subtitulo", "")))
    out.append('<div class="notice"><strong>Antes de ler:</strong> isto prova que a ferramenta passou a <em>saber o que viu e o que nao viu</em> e a recusar conclusoes sem evidencia. Nao prova julgamento artistico equivalente ao de um animador, e nenhuma animacao foi alterada.</div>')
    out.append("<h2>Resumo</h2><ul>%s</ul>" % "".join("<li>%s</li>" % esc(x) for x in R.get("resumo", [])))
    # ---- antes x depois
    out.append("<h2>Antes &times; depois</h2>")
    a_, d_ = ad.get("enquadramento", {}).get("antes_ferramenta_anterior", {}), ad.get("enquadramento", {}).get("depois_percepcao_ativa", {})
    w = ad.get("witness_anterior_no_mosh", {})
    out.append('<div class="grid"><div class="card"><h3>Ferramenta anterior neste clipe</h3><ul><li>Enquadramento padr&atilde;o: personagem <strong>cortado pela borda em %s de %s vistas</strong> (a ferramenta n&atilde;o verifica corte de quadro).</li><li>Animation Witness: %s. N&atilde;o diz onde est&aacute; a m&atilde;o, se o chap&eacute;u cobre o corpo, nem se algo afunda no ch&atilde;o.</li></ul>'
               '<a href="antes/antes_sheet_side_nX.png"><img loading="lazy" src="antes/antes_sheet_side_nX.png" alt="antes, vista lateral"></a><p class="muted">Vista lateral padr&atilde;o da ferramenta anterior (personagem cortado em g1, g6, g8).</p></div>' % (a_.get("total_cortados"), a_.get("total"), esc(json.dumps(w.get("resumo", {}), ensure_ascii=False))))
    out.append('<div class="card"><h3>Percep&ccedil;&atilde;o ativa</h3><ul><li>C&acirc;mera ajustada ao corpo, escala &uacute;nica: <strong>%s de %s vistas cortadas</strong>.</li><li>Cada regi&atilde;o recebe vistas at&eacute; haver 2 independentes por frame, ou o motivo de n&atilde;o haver.</li><li>Passes reais de profundidade, normais e ids por pixel.</li></ul>'
               '<a href="investigation/sheets/folha_corpo_todo_lado_D_e12.png"><img loading="lazy" src="investigation/sheets/folha_corpo_todo_lado_D_e12.png" alt="depois, corpo todo lado D"></a><p class="muted">Corpo todo, lado D, 12 frames, mesma escala.</p></div></div>' % (d_.get("total_cortados"), d_.get("total")))
    # ---- investigacao
    out.append("<h2>Observa&ccedil;&atilde;o por regi&atilde;o (quem foi realmente visto)</h2>")
    out.append("<table><tr><th>Regi&atilde;o</th><th>Status</th><th>Frames com 2+ vistas</th><th>S&oacute; 1 vista</th><th>Sem vista</th><th>Vistas pedidas (por rodada)</th><th>Parou porque</th></tr>")
    for r, v in (inv.get("regions") or {}).items():
        f = v["final"]
        out.append("<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>" % (esc(r), status_tag(f["status"]), esc(str(f["frames_ok"])), esc(str(f["frames_one_view"])), esc(str(f["frames_not_observed"])),
                   esc(" | ".join(", ".join(x["requested"]) for x in v["rounds"])), esc(v["stop_reason"])))
    out.append("</table>")
    out.append("<p class='muted'>Frames sem vista n&atilde;o s&atilde;o &ldquo;corretos&rdquo;: s&atilde;o <em>n&atilde;o observados</em>. Ex.: a m&atilde;o D em g6, g7, g9, g11 e g21 fica sob o chap&eacute;u ou abaixo do ch&atilde;o em todas as vistas.</p>")
    # ---- folhas
    out.append("<h2>Folhas lidas (com c&oacute;digo de leitura)</h2><div class='grid'>")
    for s in idx.get("sheets", []):
        if os.path.isfile(os.path.join(d, "investigation", s["file"])):
            out.append('<div class="card"><a href="investigation/%s"><img loading="lazy" src="investigation/%s" alt="%s"></a><p><code>%s</code> &middot; c&oacute;digo <code>%s</code> &middot; %s</p></div>' % (esc(s["file"]), esc(s["file"]), esc(s["file"]), esc(os.path.basename(s["file"])), esc(s["token"]), esc("regi&atilde;o %s" % s["region"])))
    out.append("</div>")
    # ---- movimento
    out.append("<h2>Movimento (medidas e hip&oacute;teses)</h2>")
    if mot:
        ph = "".join("<tr><td>%s</td><td>g%s&ndash;g%s</td><td>%s</td><td>%s</td></tr>" % (esc(p["fase"]), p["frames"][0], p["frames"][1], tag(p["status"], "warn"), esc(p["base"])) for p in mot["fases"]["fases"])
        out.append("<div class='card'><p>Efetuador: <code>%s</code> (%s). Frame de contato: <strong>%s</strong> &mdash; %s</p><table><tr><th>Fase candidata</th><th>Frames</th><th>Status</th><th>Base</th></tr>%s</table></div>" % (esc(mot["efetuador"]), esc(mot.get("referencial_do_efetuador", "")), esc(str(mot["fases"].get("contact_frame"))), esc(mot["fases"].get("motivo_contato", "")), ph))
        a = mot["antecipacao"]
        sq = mot["sequencia_do_corpo"]
        out.append("<div class='grid'><div class='card'><h3>Anteced&ecirc;ncia</h3><p>Presente: %s &middot; raz&atilde;o recuo/curso %s</p><p class='muted'>%s</p></div><div class='card'><h3>Sequ&ecirc;ncia do corpo</h3><p>Ordem (alfa m&eacute;dio): %s</p><p>M&atilde;o &times; tronco: %s &middot; ordem robusta entre alfas: %s</p></div>" % (esc(str(a.get("presente"))), esc(str(a.get("razao_recuo_curso"))), esc(a.get("nota", "")), esc(" &rarr; ".join(sq["ordem"])), esc(str(sq.get("mao_vs_tronco"))), esc(str(sq.get("ordem_robusta_entre_alfas")))))
        ch = mot.get("chao", {}).get("por_rotulo", {})
        out.append("<div class='card'><h3>Geometria abaixo do ch&atilde;o (plano z=%s)</h3><table><tr><th>R&oacute;tulo</th><th>Prof. m&aacute;x. (m)</th><th>Frame</th><th>Frames</th></tr>%s</table><p class='muted'>%s</p></div></div>" % (esc(str(mot.get("chao", {}).get("plano_z"))),
                   "".join("<tr><td>%s</td><td>%s</td><td>g%s</td><td>%s</td></tr>" % (esc(k), v["prof_max_m"], v["frame_prof_max"], esc(str(v["frames"]))) for k, v in ch.items()), esc(mot.get("chao", {}).get("nota", ""))))
    # ---- contatos
    out.append("<h2>Contatos e atravessamentos (hip&oacute;teses)</h2>")
    if con:
        rows = []
        for pr, fr in con.get("classificacao", {}).items():
            hits = {k: v for k, v in fr.items() if v["classe"].startswith("ATRAV")}
            rows.append("<tr><td>%s</td><td>%s</td><td>%s</td></tr>" % (esc(pr), esc(", ".join("g%s (%s)" % (k, "alta" if "alta" in v["criterio"] else "media") for k, v in hits.items()) or "nenhum frame com ATRAVESSAMENTO_PROVAVEL"), esc("baseline: %s f%s" % (con.get("baseline", {}).get("action"), con.get("baseline", {}).get("frame")))))
        out.append("<table><tr><th>Par</th><th>Frames com ATRAVESSAMENTO_PROVAVEL</th><th>Baseline</th></tr>%s</table><p class='muted'>Sempre hip&oacute;tese: o teste n&atilde;o prova a interseccao; em malha vizinha aberta (o chap&eacute;u tem milhares de arestas abertas) o cercamento por raios &eacute; menos confi&aacute;vel e a normal assinada sozinha nunca basta.</p>" % "".join(rows))
    # ---- diagnostico
    out.append("<h2>Diagn&oacute;stico A&ndash;G (validado)</h2><p>Resultado do validador: %s &mdash; %s entradas aceitas, %s rejeitadas. %s</p>" % (status_tag(val.get("status", "?")), val.get("aceitas"), val.get("rejeitadas"), esc(val.get("nota", ""))))
    vmap = {e["id"]: e for e in val.get("entries", [])}
    for e in diag.get("entries", []):
        v = vmap.get(e["id"], {})
        out.append("<details><summary>%s &middot; %s &middot; %s &middot; frames %s &middot; %s %s</summary>" % (esc(e["id"]), esc(e.get("principio", "")), esc(e["region"]), esc(str(e["frames"])), tag(e["G_sustentacao"]["nivel"], "info"), status_tag(v.get("status", "?"))))
        out.append("<p><strong>A &mdash; vis&iacute;vel:</strong> %s</p><p><strong>B &mdash; interpreta&ccedil;&atilde;o:</strong> %s</p><p><strong>C &mdash; dados:</strong> folhas %s; medi&ccedil;&otilde;es %s</p>" % (esc(e["A_visivel"]["descricao"]), esc(e["B_interpretacao"]),
                   esc(", ".join("%s [%s]" % (os.path.basename(f["file"]), f["leitura"]) for f in e["A_visivel"].get("folhas", [])) or "nenhuma"), esc(", ".join(e["C_dados"].get("medicoes", [])) or "nenhuma")))
        out.append("<p><strong>D &mdash; alternativas:</strong></p><ul>%s</ul><p><strong>E &mdash; falta observar:</strong></p><ul>%s</ul><p><strong>F &mdash; corre&ccedil;&atilde;o sugerida (n&atilde;o aplicada):</strong> %s</p><p><strong>G &mdash; sustenta&ccedil;&atilde;o:</strong> %s</p>" % (
                   "".join("<li>%s</li>" % esc(x) for x in e["D_alternativas"]), "".join("<li>%s</li>" % esc(x) for x in e["E_falta_observar"]), esc(e["F_correcao"]["descricao"]), esc(e["G_sustentacao"]["justificativa"])))
        if v.get("frames_sem_2_vistas"):
            out.append("<p class='muted'>Frames sem 2 vistas independentes nesta entrada: %s (por isso o n&iacute;vel n&atilde;o &eacute; &ldquo;observa&ccedil;&atilde;o visual&rdquo;).</p>" % esc(str(v["frames_sem_2_vistas"])))
        out.append("</details>")
    out.append("<h3>O validador tamb&eacute;m recusa (testado sobre este mesmo pacote)</h3><table><tr><th>Caso adversarial</th><th>Resultado</th><th>Motivo</th></tr>%s</table>" % "".join(
        "<tr><td>%s</td><td>%s</td><td>%s</td></tr>" % (esc(c["caso"]), status_tag(c["resultado"]), esc(c["motivos"][0] if c["motivos"] else "")) for c in adv))
    # ---- benchmark
    out.append("<h2>Casos controlados (sint&eacute;ticos): desenvolvimento &times; avalia&ccedil;&atilde;o</h2>")
    for nm, b in (("Desenvolvimento (limiares podiam ser ajustados aqui)", bd), ("Avalia&ccedil;&atilde;o (congelada; nada foi ajustado depois de rodar)", be)):
        if not b:
            continue
        out.append("<h3>%s: %s/%s</h3><p class='muted'>falsos negativos: %s &middot; falsos positivos: %s &middot; inconclusivos errados: %s</p><details><summary>ver os %s casos</summary><table><tr><th>Caso</th><th>Tipo</th><th>Esperado</th><th>Observado</th><th></th></tr>%s</table></details>" % (
            nm, b["ok"], b["total"], esc(str(b["falsos_negativos"])), esc(str(b["falsos_positivos"])), esc(str(b["inconclusivos_errados"])), b["total"],
            "".join("<tr><td>%s &mdash; %s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>" % (esc(r["id"]), esc(r["descricao"]), esc(r["tipo"]), esc(str(r["esperado"])), esc(json.dumps(r["observado"], ensure_ascii=False)[:160]), tag("ok" if r["ok"] else "FALHA", "ok" if r["ok"] else "bad")) for r in b["resultados"])))
    out.append("<div class='notice'>%s</div>" % esc(R.get("nota_benchmark", "")))
    # ---- integridade
    ig = ad.get("integridade", {})
    out.append("<h2>Integridade</h2><ul><li>Origem: <code>%s</code> &middot; SHA-256 <code>%s</code> &middot; igual antes/depois: <strong>%s</strong></li><li>C&oacute;pia derivada e descart&aacute;vel: %s (SHA-256 <code>%s</code>)</li><li>Verifica&ccedil;&atilde;o de tempo FBX &times; GLB: %s</li></ul>" % (
        esc(ig.get("origem", "")), esc(ig.get("origem_sha256", "")), esc(str(ig.get("origem_sha256_depois_igual"))), esc(ig.get("copia_derivada", "")), esc(str(ig.get("copia_sha256"))), esc(vt.get("conclusao", ""))))
    out.append("<h2>Achados que mudaram a ferramenta durante o caso</h2><ul>%s</ul>" % "".join("<li>%s</li>" % esc(x) for x in ad.get("achados_de_ferramenta_corrigidos_durante_o_caso", [])))
    out.append("<h2>N&atilde;o provado</h2><ul>%s</ul><h2>Limita&ccedil;&otilde;es</h2><ul>%s</ul>" % ("".join("<li>%s</li>" % esc(x) for x in R.get("nao_provado", [])), "".join("<li>%s</li>" % esc(x) for x in R.get("limitacoes", []))))
    out.append("<h2>Como reproduzir</h2><pre>%s</pre>" % esc("\n".join(R.get("reproduzir", []))))
    out.append("<h2>Arquivos</h2><ul>%s</ul>" % "".join('<li><a href="%s">%s</a></li>' % (esc(p), esc(p)) for p in ("resumo.json", "antes_depois.json", "investigation/investigation.json", "investigation/evidence_index.json", "motion/motion_report.json", "motion/questions.json", "contacts/contacts.json",
                                                                                                                      diag_file or "", "validacao_diagnostico.json", "validador_adversarial.json", "bench_dev.json", "bench_eval.json", "verificacao_tempo_fbx_x_glb.json") if p))
    out.append("</main></body></html>")
    return "\n".join(out)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    folder = os.path.abspath(sys.argv[1])
    with open(os.path.join(folder, "relatorio.html"), "w", encoding="utf-8") as f:
        f.write(build(folder))
    print(os.path.join(folder, "relatorio.html"))
