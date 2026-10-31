# Motion Lens — parte «report» (dividida de motion_lens.py; a API pública continua em motion_lens.py).
import bpy
import base64
import html
import os
from .analysis import analyze_motion, build_report
from .common import _context, _ensure_output_dir
from .graphs import render_graphs
from .sheets import render_contact_sheet, render_skeleton_sheet
from .version import VERSION_TEXT


def _image_data_uri(path):
    with open(path, "rb") as handle:
        encoded = base64.b64encode(handle.read()).decode("ascii")
    return "data:image/png;base64," + encoded


def build_html_report(context=None, output_path=None, include_renders=True):
    """Gera relatorio HTML autocontido. Renderizacoes podem ser desativadas em background."""
    context = _context(context)
    scene = context.scene
    analysis = analyze_motion(context)
    report = build_report(context)
    images = []
    graph_path = render_graphs(context, analysis=analysis)
    images.append(("Velocidade, altura e energia", graph_path))
    skeleton_path = render_skeleton_sheet(context)
    images.append(("Esqueleto", skeleton_path))
    if include_renders:
        contact_path = render_contact_sheet(context)
        silhouette_path = render_contact_sheet(context, silhouette=True)
        images.extend((("Contact sheet", contact_path), ("Silhueta", silhouette_path)))
    blocks = []
    for title, path in images:
        blocks.append("<section><h2>%s</h2><img src='%s'></section>" % (html.escape(title), _image_data_uri(path)))
    document = """<!doctype html><meta charset='utf-8'><title>Motion Lens</title>
<style>body{font-family:system-ui;background:#17171c;color:#eee;max-width:1400px;margin:auto;padding:24px}pre{white-space:pre-wrap;background:#22232b;padding:16px}img{max-width:100%%;background:#fff}section{margin:28px 0}</style>
<h1>Motion Lens %s</h1><pre>%s</pre>%s
<p><strong>Limite:</strong> o relatorio mede sinais tecnicos; peso, ritmo, intencao e qualidade artistica continuam dependendo de avaliacao humana.</p>""" % (VERSION_TEXT, html.escape(report), "".join(blocks))
    output_path = output_path or os.path.join(_ensure_output_dir(scene), "motion_lens_report.html")
    with open(output_path, "w", encoding="utf-8") as handle:
        handle.write(document)
    return output_path
