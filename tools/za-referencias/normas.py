"""Normas por subgrupo (Task 8 / 1H): distribuições com n de clipes, espécies e rigs; SEM_BASE_COMPARAVEL
quando a base é pequena; aprovação só por aspecto e só com nome de quem aprovou.

Um clipe por espécie (formas e Megas da mesma espécie não pesam mais); prefere a forma 0.
Toda norma sai MEDIDA e NÃO aprovada: adequacao_artistica = NAO_AVALIADA sempre.
"""
import json
import os
import sys
import time

import numpy as np

import config

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(AQUI)), "scripts", "blender-vision"))
from perception_refs import ASPECTS, RefError  # noqa: E402

CAMINHO_APROVACOES = os.path.join(AQUI, "aprovacoes_za.json")

MEDIDAS = ["duracao_s", "ate_pico_s", "recuperacao_s", "pico_rel", "antecipacao_q", "antecipacao_rel_golpe",
           "antecipacao_ate_golpe_q", "hold_total_q", "overshoot_rel", "ease", "snap", "subida_max_H",
           "desloc_horizontal_H", "n_eventos", "poses_chave_frac", "escala_max_desvio", "cadencia_passos_s",
           "simetria_apoio", "escorregoes_n"]
SO_COM_ANTECIPACAO = ("antecipacao_q", "antecipacao_rel_golpe", "antecipacao_ate_golpe_q")


def _especie(l):
    return l.get("especie") or l["modelo"][:6]


def um_por_especie(linhas):
    vistos, out = set(), []
    for l in sorted(linhas, key=lambda l: (l.get("forma", 0), l.get("variante") or "", l["modelo"])):
        k = (_especie(l), l.get("categoria"), l.get("fase"), l.get("extra"), l.get("conjunto"))
        if k not in vistos:
            vistos.add(k)
            out.append(l)
    return out


def _dist(vals, total):
    vals = [float(v) for v in vals if v is not None]
    falt = round(1 - len(vals) / total, 3) if total else None
    if not vals:
        return {"n": 0, "faltantes_frac": falt}
    a = np.array(vals)
    p = {k: round(float(np.percentile(a, q)), 4) for k, q in
         (("p10", 10), ("p25", 25), ("mediana", 50), ("p75", 75), ("p90", 90))}
    p["mad"] = round(float(np.median(np.abs(a - np.median(a)))), 4)
    p["iqr"] = round(p["p75"] - p["p25"], 4)
    p["n"] = len(vals)
    p["faltantes_frac"] = falt
    return p


def grupo_id(categoria, fase, classe_anatomica, conjunto):
    return "%s|%s|%s|%s" % (categoria, fase, classe_anatomica or "", conjunto)


def grupo(clipes, categoria, fase, classe_anatomica=None, conjunto=0, n_min=None, aprovacoes=None):
    n_min = config.N_ESPECIES_MIN if n_min is None else n_min
    sel = [l for l in clipes if l.get("categoria") == categoria and (l.get("fase") or "") == (fase or "")
           and l.get("conjunto", 0) == conjunto and not l.get("parado")
           and (classe_anatomica is None or l.get("anatomia_classe") == classe_anatomica)]
    sel = um_por_especie(sel)
    n_esp = len({_especie(l) for l in sel})
    motivos = []
    if n_esp < n_min:
        motivos.append("n_especies=%d < %d" % (n_esp, n_min))
    medidas = {}
    for m in MEDIDAS:
        base = [l for l in sel if l.get("antecipacao")] if m in SO_COM_ANTECIPACAO else sel
        medidas[m] = _dist([l.get(m) for l in base], len(base))
    gid = grupo_id(categoria, fase, classe_anatomica, conjunto)
    aprov = [a for a in (aprovacoes or {}).get("aprovacoes", []) if a["grupo_id"] == gid]
    n = len(sel)
    return {
        "grupo_id": gid, "status": "SEM_BASE_COMPARAVEL" if motivos else "MEDIDO", "motivos": motivos,
        "n_clipes": n, "n_especies": n_esp,
        "n_rigs_estruturais": len({l.get("assinatura_rig") for l in sel if l.get("assinatura_rig")}),
        "n_poses_repouso": len({l.get("pose_repouso_hash") for l in sel if l.get("pose_repouso_hash")}),
        "com_escala_animada_frac": round(sum(1 for l in sel if l.get("escala_animada")) / n, 3) if n else None,
        "com_partes_ocultas_frac": round(sum(1 for l in sel if l.get("partes_ocultas")) / n, 3) if n else None,
        "com_antecipacao_frac": round(sum(1 for l in sel if l.get("antecipacao")) / n, 3) if n else None,
        "medidas": medidas,
        "aprovacao": {"aspectos_aprovados": sorted({a["aspecto"] for a in aprov}),
                      "art_approved_by": aprov[-1]["por"] if aprov else None},
        "adequacao_artistica": "NAO_AVALIADA",
    }


def carregar_aprovacoes(caminho=CAMINHO_APROVACOES):
    try:
        with open(caminho, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {"aprovacoes": []}


def aprovar(aspecto, gid, por, escopo, caminho=CAMINHO_APROVACOES, justificativa=""):
    """Registra a aprovação de UM aspecto de um grupo. Sem pessoa ou com aspecto fora da lista: RefError."""
    if not por:
        raise RefError("aprovação exige o nome de quem aprova (approved_by)")
    if aspecto not in ASPECTS:
        raise RefError("aspecto '%s' fora da lista %s" % (aspecto, ASPECTS))
    if not escopo or aspecto not in escopo:
        raise RefError("o escopo precisa conter o aspecto aprovado")
    dados = carregar_aprovacoes(caminho)
    item = {"aspecto": aspecto, "grupo_id": gid, "por": por, "escopo": list(escopo),
            "justificativa": justificativa, "quando": time.strftime("%Y-%m-%d %H:%M:%S")}
    dados.setdefault("aprovacoes", []).append(item)
    tmp = caminho + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(dados, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, caminho)
    return item
