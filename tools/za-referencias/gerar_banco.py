"""Gera o banco de referências: mede TODOS os clipes do dump do Z-A (uma linha JSON por clipe).

  python.exe (do Blender) gerar_banco.py <pasta_dump> <catalogo.trpmcatalog> <saida.jsonl>

<pasta_dump>  ex.: "dumper test/LegendsZAPkmnModelDumpWithDLC" (pmXXXX/pmXXXX_YY_ZZ/*.tranm)
<catalogo>    poke_resource_table.trpmcatalog (diz qual espécie/forma é cada pasta)

Retomável (lote.py): cada forma tem uma chave = hash dos seus .tranm + .trskl + configuração.
Uma segunda rodada só mede o que mudou; uma interrupção não perde o que já foi medido.
Cache em <pasta da saída>/cache; falhas por arquivo em <saída>.falhas.jsonl.
"""
import hashlib
import json
import os
import sys
import traceback

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(os.path.dirname(AQUI), "za-extrator"))

import config  # noqa: E402
import lote  # noqa: E402


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


def _sha(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as fh:
        for b in iter(lambda: fh.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def medir_forma(args):
    """Mede todos os clipes de uma forma. Falha de um clipe vira linha {"_falha": ...}."""
    import metricas
    import za_anim
    pasta, especie, forma, info, hashes = args["pasta"], args["especie"], args["forma"], args["info"], args["hashes"]
    base = os.path.basename(pasta)
    import ontologia
    esq = za_anim.Esqueleto(za_anim.esqueleto_do_modelo(pasta))
    raiz = metricas.raiz_do_corpo(esq)
    regs = ontologia.regioes(esq)
    anat = ontologia.anatomia(esq, regs)
    revisoes = ontologia.carregar_revisoes()
    assinatura = ontologia.assinatura_rig(esq)
    pose_hash = hashlib.sha256(np.round(np.concatenate([esq.loc_repouso.ravel(), esq.rot_repouso.ravel()]), 5)
                               .tobytes()).hexdigest()[:16]
    animados_forma = set()
    linhas = []
    for f in sorted(hashes):
        nome = f[len(base) + 1:-6] if f.startswith(base + "_") else f[:-6]
        cls = metricas.classificar(nome)
        try:
            c = za_anim.Clipe(os.path.join(pasta, f), esq)
            c.eh_loop = cls["fase"] == "loop"
            m = metricas.medir(c, esq, raiz, categoria=cls["categoria"], regs=regs, anat=anat)
            animados_forma |= c.ossos_animados
            if "%s/%s" % (base, nome) in revisoes:
                rv = revisoes["%s/%s" % (base, nome)]
                m.update({"executores": rv.get("executores", []), "papeis_status": "REVISADO",
                          "revisado_por": rv.get("por")})
        except Exception as ex:
            linhas.append({"_falha": {"arquivo": "%s/%s" % (base, f), "sha256": hashes[f], "etapa": "medir",
                                      "erro": repr(ex), "traceback_curto": traceback.format_exc(limit=3)[-600:]}})
            continue
        linha = {"modelo": base, "especie": especie, "nome": info.get("nome", base),
                 "forma_corpo": info.get("forma", "?"), "forma": forma, "clipe": nome,
                 "fonte_sha256": hashes[f], "decoder_versao": config.DECODER_VERSAO,
                 "espaco": config.ESPACO, "interpolacao": config.INTERPOLACAO, "limiares": config.limiares()}
        linha.update(cls)
        linha.update(m)
        linha["assinatura_rig"] = assinatura
        linha["pose_repouso_hash"] = pose_hash
        linhas.append(linha)
    frac = round(ontologia.fracao_outro(animados_forma, regs), 4)
    outros = sorted({esq.nomes[i] for i in animados_forma if regs[i] == "outro"})
    for l in linhas:
        if "_falha" not in l:
            l["ontologia_outro_frac"] = frac
            l["ontologia_outro_ossos"] = outros[:40]
    return linhas


def montar_tarefas(dump, catalogo):
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
            if not os.path.isdir(p):
                continue
            tranms = [x for x in os.listdir(p) if x.endswith(".tranm")]
            if not tranms:
                continue
            hashes = {x: _sha(os.path.join(p, x)) for x in tranms}
            skl = [x for x in os.listdir(p) if x.endswith(".trskl")]
            h = hashlib.sha256()
            for x in sorted(hashes):
                h.update((x + hashes[x]).encode())
            for x in sorted(skl):
                h.update((x + _sha(os.path.join(p, x))).encode())
            especie, forma = cat.get(fm, (0, 0))
            tarefas.append({"chave": h.hexdigest()[:32], "arquivo": "%s/%s" % (sp, fm),
                            "args": {"pasta": p, "especie": especie, "forma": forma,
                                     "info": especies.get(str(especie), {}), "hashes": hashes}})
    return tarefas


def main():
    dump, catalogo, saida = sys.argv[1:4]
    pasta_saida = os.path.dirname(os.path.abspath(saida))
    os.makedirs(pasta_saida, exist_ok=True)
    print("calculando hashes...", flush=True)
    tarefas = montar_tarefas(dump, catalogo)
    print("%d formas com animação" % len(tarefas), flush=True)

    def progresso(i, n, s):
        if i % 25 == 0 or i == n:
            print("  %d/%d formas a medir, %.0f s" % (i, n, s), flush=True)

    r = lote.rodar(tarefas, medir_forma, os.path.join(pasta_saida, "cache"), config_hash=config.hash_config(),
                   processos=max(1, (os.cpu_count() or 2) - 1), progresso=progresso)
    lote.gravar_jsonl(saida, r["linhas"])
    lote.gravar_jsonl(saida + ".falhas.jsonl", r["lista_falhas"])
    print("%d clipes no banco (%d formas medidas agora, %d do cache) em %.0f s; %d falhas" % (
        len(r["linhas"]), r["medidos"], r["do_cache"], r["segundos"], r["falhas"]))
    for f in r["lista_falhas"][:10]:
        print("  falha", f["arquivo"], f["erro"])


if __name__ == "__main__":
    main()
