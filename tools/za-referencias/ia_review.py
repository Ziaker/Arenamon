"""Gera revisão file:// independente. Não lê nem altera armazenamento humano."""
import copy
import hashlib
import json
import os
from pathlib import Path


def render_review(batch, export, evidences, output_path):
    """Grava HTML autocontido e retorna Path; evidences é mapping id -> evidência.

    batch é a saída de ia_pipeline.read_lote; caminhos de evidência são relativos
    à saída. Fontes originais usam batch.html como base. Sem batch.html, assume
    o lote_02 irmão para compatibilidade com consumidores anteriores.
    """
    output = Path(output_path)
    if output.name != "rotulagem_ia_review.html":
        raise ValueError("A revisão deve chamar rotulagem_ia_review.html; original protegido")
    if export.get("lote") != batch.get("hash"):
        raise ValueError("Lote da proposta não corresponde ao HTML")
    data = {"batch": copy.deepcopy(batch), "export": copy.deepcopy(export), "evidences": copy.deepcopy(evidences)}
    original = Path(batch["html"]).parent if batch.get("html") else output.parent.parent / "lote_02"
    if "media_base" in batch:
        original = output.parent / batch["media_base"]
    for item in data["batch"]["itens"]:
        for kind in ("videos", "folhas"):
            item[kind] = [Path(os.path.relpath(original / source, output.parent)).as_posix() for source in item.get(kind, [])]
    raw = json.dumps(data, ensure_ascii=False)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
    raw = raw.replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    template = Path(__file__).with_name("ia_review_template.html").read_text(encoding="utf-8")
    html = template.replace("/*DADOS_JSON*/", raw).replace("/*REVISAO_HASH*/", digest)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8")
    return output
