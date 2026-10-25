"""Gera o banco de referências: mede TODOS os clipes do dump do Z-A (uma linha JSON por clipe).

  python.exe (do Blender) gerar_banco.py <pasta_dump> <catalogo.trpmcatalog> <saida.jsonl>

<pasta_dump>  ex.: "dumper test/LegendsZAPkmnModelDumpWithDLC" (pmXXXX/pmXXXX_YY_ZZ/*.tranm)
<catalogo>    poke_resource_table.trpmcatalog (diz qual espécie/forma é cada pasta)
"""
import json
import multiprocessing as mp
import os
import sys
import time
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(os.path.dirname(AQUI), "za-extrator"))


def mapa_catalogo(caminho):
    """pasta da forma (pmXXXX_YY_ZZ) -> (espécie nacional, forma)."""
    from extrair_za import Table, _string, _subtable
    with open(caminho, "rb") as fh:
        cat = Table.root(fh.read())
    out = {}
    for e in cat.tables(1):
        info = _subtable(e, 0)
        modelo = _string(e, 1)
        if info and modelo:
            pasta = modelo.split("/")[1] if "/" in modelo else modelo
            out.setdefault(pasta, (info.scalar(0, "H"), info.scalar(1, "H")))
    return out


def medir_pasta(tarefa):
    pasta, especie, forma, especies = tarefa
    import metricas
    import za_anim
    linhas, erros = [], []
    try:
        esq = za_anim.Esqueleto(za_anim.esqueleto_do_modelo(pasta))
        raiz = metricas.raiz_do_corpo(esq)
    except Exception as ex:
        return [], ["%s: esqueleto: %r" % (os.path.basename(pasta), ex)]
    base = os.path.basename(pasta)
    info = especies.get(str(especie), {})
    for f in sorted(os.listdir(pasta)):
        if not f.endswith(".tranm"):
            continue
        nome = f[len(base) + 1:-6] if f.startswith(base + "_") else f[:-6]
        cls = metricas.classificar(nome)
        try:
            c = za_anim.Clipe(os.path.join(pasta, f), esq)
            c.eh_loop = cls["fase"] == "loop"
            m = metricas.medir(c, esq, raiz)
        except Exception as ex:
            erros.append("%s/%s: %r" % (base, nome, ex))
            continue
        linha = {"modelo": base, "especie": especie, "nome": info.get("nome", base),
                 "forma_corpo": info.get("forma", "?"), "forma": forma, "clipe": nome}
        linha.update(cls)
        linha.update(m)
        linhas.append(linha)
    return linhas, erros


def main():
    dump, catalogo, saida = sys.argv[1:4]
    with open(os.path.join(AQUI, "especies.json"), encoding="utf-8") as fh:
        especies = json.load(fh)["especies"]
    cat = mapa_catalogo(catalogo)
    tarefas = []
    for sp in sorted(os.listdir(dump)):
        d = os.path.join(dump, sp)
        if not (sp.startswith("pm") and os.path.isdir(d)):
            continue
        for fm in sorted(os.listdir(d)):
            p = os.path.join(d, fm)
            if os.path.isdir(p) and any(x.endswith(".tranm") for x in os.listdir(p)):
                especie, forma = cat.get(fm, (0, 0))
                tarefas.append((p, especie, forma, especies))
    print("%d formas com animação" % len(tarefas), flush=True)
    os.makedirs(os.path.dirname(os.path.abspath(saida)), exist_ok=True)
    t0, n, todos_erros = time.time(), 0, []
    with open(saida, "w", encoding="utf-8") as out, mp.Pool(max(1, os.cpu_count() - 1)) as pool:
        for i, (linhas, erros) in enumerate(pool.imap_unordered(medir_pasta, tarefas, chunksize=1)):
            for l in linhas:
                out.write(json.dumps(l, ensure_ascii=False) + "\n")
            n += len(linhas)
            todos_erros += erros
            if (i + 1) % 25 == 0:
                print("  %d/%d formas, %d clipes, %.0f s" % (i + 1, len(tarefas), n, time.time() - t0), flush=True)
    print("%d clipes medidos em %.0f s; %d erros" % (n, time.time() - t0, len(todos_erros)))
    with open(saida + ".erros.txt", "w", encoding="utf-8") as fh:
        fh.write("\n".join(todos_erros))
    for e in todos_erros[:10]:
        print("  erro", e)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
