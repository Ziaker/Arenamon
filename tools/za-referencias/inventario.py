"""Inventário do dump (hash por arquivo) e reconciliação entre o banco e a busca do relatório.

  python.exe (do Blender) inventario.py <pasta_dump> <clipes.jsonl> [saida.json]

A busca do relatório deixa de fora clipes de rosto (código 08xxx) e clipes parados (corpo sem
movimento). A reconciliação conta cada exclusão por grupo de código para que a soma feche.
"""
import hashlib
import json
import os
import sys
from collections import defaultdict

BLOCO = 1 << 20


def dentro_da_raiz(raiz, caminho):
    raiz = os.path.realpath(raiz)
    return os.path.commonpath([raiz, os.path.realpath(caminho)]) == raiz


def _sha256(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as fh:
        for bloco in iter(lambda: fh.read(BLOCO), b""):
            h.update(bloco)
    return h.hexdigest()


def manifesto(pasta_dump):
    """Um item por .tranm: modelo, clipe, arquivo (relativo), sha256, bytes, grupo."""
    out = []
    for raiz, _, arquivos in os.walk(pasta_dump):
        for nome in sorted(arquivos):
            if not nome.endswith(".tranm"):
                continue
            caminho = os.path.join(raiz, nome)
            if not dentro_da_raiz(pasta_dump, caminho):
                continue
            modelo = os.path.basename(raiz)
            clipe = nome[len(modelo) + 1:-6] if nome.startswith(modelo + "_") else nome[:-6]
            out.append({"modelo": modelo, "clipe": clipe,
                        "arquivo": os.path.relpath(caminho, pasta_dump).replace("\\", "/"),
                        "sha256": _sha256(caminho), "bytes": os.path.getsize(caminho),
                        "grupo": clipe[0] if clipe[:5].isdigit() else "?"})
    return out


def motivo_exclusao(linha):
    """Por que um clipe do banco fica fora da busca do relatório (None = está na busca)."""
    if linha.get("codigo") and linha["codigo"].startswith("08"):
        return "rosto"
    if linha.get("parado"):
        return "parado"
    return None


def reconciliar(clipes):
    por_grupo = defaultdict(lambda: {"total": 0, "na_busca": 0, "rosto": 0, "parado": 0})
    excluidos = {"rosto": 0, "parado": 0, "fora_do_padrao": 0}
    modelos_total, modelos_busca, rotulos = set(), set(), set()
    na_busca = 0
    for l in clipes:
        g = str(l["conjunto"]) if l.get("conjunto") is not None else "?"
        por_grupo[g]["total"] += 1
        modelos_total.add(l["modelo"])
        if l.get("nome_fora_do_padrao"):
            excluidos["fora_do_padrao"] += 1
        m = motivo_exclusao(l)
        if m:
            excluidos[m] += 1
            por_grupo[g][m] += 1
            continue
        na_busca += 1
        por_grupo[g]["na_busca"] += 1
        modelos_busca.add(l["modelo"])
        if str(l.get("nome", "")).startswith("pm"):
            rotulos.add(l["nome"])
    especies = {l["especie"] for l in clipes}
    return {
        "total": len(clipes), "na_busca": na_busca, "excluidos": excluidos,
        "por_grupo": {k: dict(v) for k, v in sorted(por_grupo.items())},
        "modelos_total": len(modelos_total), "modelos_na_busca": len(modelos_busca),
        "modelos_fora_da_busca": sorted(modelos_total - modelos_busca),
        "rotulos_tecnicos": sorted(rotulos),
        "especies_com_nome": len({l["especie"] for l in clipes if not str(l.get("nome", "")).startswith("pm")}),
        "especies_ids_nao_zero": len(especies - {0}),
        "rotulos_na_busca": len({l["nome"] for l in clipes if not motivo_exclusao(l)}),
    }


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    dump, banco = sys.argv[1], sys.argv[2]
    saida = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(banco), "inventario.json")
    with open(banco, encoding="utf-8") as fh:
        clipes = [json.loads(l) for l in fh if l.strip()]
    rec = reconciliar(clipes)
    man = manifesto(dump)
    nomes_banco = {(l["modelo"], l["clipe"]) for l in clipes}
    nomes_disco = {(m["modelo"], m["clipe"]) for m in man}
    rec["arquivos_no_disco"] = len(man)
    rec["no_disco_sem_linha_no_banco"] = sorted("/".join(x) for x in nomes_disco - nomes_banco)[:50]
    rec["no_banco_sem_arquivo"] = sorted("/".join(x) for x in nomes_banco - nomes_disco)[:50]
    tmp = saida + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump({"reconciliacao": rec, "manifesto": man}, fh, ensure_ascii=False)
    os.replace(tmp, saida)
    print("total %d, na_busca %d, rosto %d, parado %d, fora_do_padrao %d" % (
        rec["total"], rec["na_busca"], rec["excluidos"]["rosto"], rec["excluidos"]["parado"],
        rec["excluidos"]["fora_do_padrao"]))
    print("modelos_fora_da_busca", rec["modelos_fora_da_busca"])
    print("por_grupo", json.dumps(rec["por_grupo"]))
    print("rotulos_tecnicos", rec["rotulos_tecnicos"])
    print("arquivos no disco %d; sem linha no banco %d; no banco sem arquivo %d" % (
        len(man), len(nomes_disco - nomes_banco), len(nomes_banco - nomes_disco)))
    print("gravado", saida)


if __name__ == "__main__":
    main()
