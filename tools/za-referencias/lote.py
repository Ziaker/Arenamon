"""Processamento retomável: cache por chave de conteúdo, retomada após interrupção, falha por tarefa.

Cada tarefa é {"chave": str, "args": ..., "arquivo": str}. A chave já deve conter o hash dos
arquivos de entrada (.tranm/.trskl); `config_hash` (decodificador + limiares) entra junto, então
mudar a configuração invalida o cache. `medir(args)` devolve uma lista de linhas; uma linha com a
chave "_falha" é uma falha registrada de um clipe dentro da tarefa (determinística, vai ao cache).
Uma exceção da tarefa inteira vira uma falha e NÃO vai ao cache, para ser refeita na próxima rodada.
"""
import json
import multiprocessing as mp
import os
import time
import traceback


def _caminho(pasta_cache, chave, config_hash):
    nome = "%s_%s.json" % (chave, config_hash or "x")
    return os.path.join(pasta_cache, chave[:2], nome)


def _ler(caminho):
    try:
        with open(caminho, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def _gravar(caminho, linhas):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    tmp = caminho + ".tmp%d" % os.getpid()
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(linhas, fh, ensure_ascii=False)
    os.replace(tmp, caminho)


def _executar(pacote):
    medir, tarefa = pacote
    try:
        return tarefa["chave"], medir(tarefa["args"]), None
    except KeyboardInterrupt:
        raise
    except Exception as ex:
        return tarefa["chave"], None, {"arquivo": tarefa.get("arquivo", tarefa["chave"]), "etapa": "tarefa",
                                       "erro": repr(ex), "traceback_curto": traceback.format_exc(limit=3)[-600:]}


def rodar(tarefas, medir, pasta_cache, config_hash=None, processos=None, progresso=None):
    t0 = time.time()
    resultados, falhas = {}, []
    pendentes = []
    do_cache = 0
    for t in tarefas:
        r = _ler(_caminho(pasta_cache, t["chave"], config_hash))
        if r is None:
            pendentes.append(t)
        else:
            resultados[t["chave"]] = r
            do_cache += 1
    medidos = 0

    def receber(chave, linhas, falha, i):
        nonlocal medidos
        if falha:
            falhas.append(falha)
        else:
            _gravar(_caminho(pasta_cache, chave, config_hash), linhas)
            resultados[chave] = linhas
            medidos += 1
        if progresso:
            progresso(i + 1, len(pendentes), time.time() - t0)

    if processos and processos > 1 and len(pendentes) > 1:
        with mp.Pool(processos) as pool:
            for i, (chave, linhas, falha) in enumerate(
                    pool.imap_unordered(_executar, [(medir, t) for t in pendentes], chunksize=1)):
                receber(chave, linhas, falha, i)
    else:
        for i, t in enumerate(pendentes):
            receber(*_executar((medir, t)), i)

    linhas = []
    for t in tarefas:
        for l in resultados.get(t["chave"], []):
            if "_falha" in l:
                falhas.append(l["_falha"])
            else:
                linhas.append(l)
    return {"linhas": linhas, "medidos": medidos, "do_cache": do_cache, "falhas": len(falhas),
            "lista_falhas": falhas, "segundos": round(time.time() - t0, 1)}


def gravar_jsonl(caminho, linhas):
    """Escrita atômica de um .jsonl."""
    tmp = caminho + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        for l in linhas:
            fh.write(json.dumps(l, ensure_ascii=False) + "\n")
    os.replace(tmp, caminho)
