"""Gera e congela o lote de rotulagem humana (Task 9 / 1I).

  python.exe (do Blender) gerar_lote.py <clipes.jsonl> <pasta_dump> <saida_lote>

1. Divide o banco em dev/teste sem vazamento (avaliacao.dividir) e grava o relatório de vazamento.
2. Escolhe 40 clipes do TESTE (semente 1025): 30 attack01 (um por espécie, revezando classes anatômicas),
   com pelo menos 5 com partes ocultas por escala e 5 com squash/stretch, e o resto de outras categorias.
3. Renderiza as folhas visuais de cada clipe (folhas_visuais.py, Blender em segundo plano).
4. Grava lote.json (sem nenhum valor calculado: avaliação cega), rotulagem.html e o hash do lote.
   As previsões do sistema ficam à parte em _sistema/previsoes_b.json, para o A/B depois dos rótulos.
"""
import hashlib
import json
import os
import random
import shutil
import subprocess
import sys
from collections import defaultdict

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)

import avaliacao  # noqa: E402

BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
N_LOTE, N_ATAQUES, MIN_OCULTOS, MIN_SQUASH = 40, 30, 5, 5
OUTRAS = ["walk", "run", "damage", "roar", "land", "rangeattack", "jumpup", "down", "appeal"]


def previsao(l):
    """O que o sistema (com corpus) responde para as mesmas perguntas da página de rotulagem."""
    return {"id": l["id"],
            "executores": l.get("executores") if l.get("papeis_status") != "INCONCLUSIVO" else "INCONCLUSIVO",
            "iniciador": l.get("iniciador") or "INCONCLUSIVO",
            "antecipacao": ("sim" if l.get("antecipacao") else "nao") if l.get("status") == "MEDIDO" else "INCONCLUSIVO",
            "parte_some_aparece": "sim" if l.get("trocas_visibilidade_n") else "nao"}


def escolher(teste, semente=1025):
    rnd = random.Random(semente)
    ataques = [l for l in teste if l["categoria"] == "attack" and not l["fase"] and l.get("variante") == "01"
               and l.get("conjunto") == 0 and l.get("status") == "MEDIDO"]
    por_classe = defaultdict(list)
    vistos = set()
    for l in sorted(ataques, key=lambda l: (l.get("forma", 0), l["modelo"])):
        if l["especie"] in vistos:
            continue
        vistos.add(l["especie"])
        por_classe[l.get("anatomia_classe", "?")].append(l)
    for v in por_classe.values():
        rnd.shuffle(v)
    escolha = []
    classes = sorted(por_classe)
    while len(escolha) < N_ATAQUES and any(por_classe.values()):
        for c in classes:
            if por_classe[c] and len(escolha) < N_ATAQUES:
                escolha.append(por_classe[c].pop())
    ids = {l["id"] for l in escolha}
    resto = [l for l in teste if l["id"] not in ids and l.get("status") == "MEDIDO"]
    rnd.shuffle(resto)

    def garantir(cond, minimo):
        tem = sum(1 for l in escolha if cond(l))
        for l in resto:
            if tem >= minimo or len(escolha) >= N_LOTE:
                break
            if cond(l) and l["id"] not in ids:
                escolha.append(l)
                ids.add(l["id"])
                tem += 1

    garantir(lambda l: l.get("partes_ocultas"), MIN_OCULTOS)
    garantir(lambda l: bool(l.get("squash_stretch_regioes")), MIN_SQUASH)
    for cat in OUTRAS * 3:
        if len(escolha) >= N_LOTE:
            break
        for l in resto:
            if l["categoria"] == cat and l["id"] not in ids:
                escolha.append(l)
                ids.add(l["id"])
                break
    return escolha


def main():
    banco, dump, saida = sys.argv[1:4]
    with open(os.path.join(AQUI, "especies.json"), encoding="utf-8") as fh:
        esp = json.load(fh)["especies"]
    with open(banco, encoding="utf-8") as fh:
        clipes = [json.loads(x) for x in fh if x.strip()]
    for l in clipes:
        l["id"] = "%s/%s" % (l["modelo"], l["clipe"])
        l["cadeia"] = (esp.get(str(l.get("especie"))) or {}).get("cadeia")
    corpo = [l for l in clipes if l.get("codigo") and not l["codigo"].startswith("08") and not l.get("parado")]
    div = avaliacao.dividir(corpo)
    os.makedirs(os.path.join(saida, "_sistema"), exist_ok=True)
    lote = escolher(div["teste"])
    print("divisão: %d grupos, teste %.1f%%; lote %d clipes" % (div["grupos"], 100 * div["relatorio_vazamento"]["frac_teste_real"], len(lote)), flush=True)
    itens = []
    for n, l in enumerate(lote, 1):
        sp, fm = l["modelo"][:6], l["modelo"]
        pasta = os.path.join(dump, sp, fm)
        r = subprocess.run([BLENDER, "-b", "--factory-startup", "--addons", "PokemonSwitchV3", "--python",
                            os.path.join(AQUI, "folhas_visuais.py"), "--", pasta, l["clipe"], saida, "cego"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        linha = next((x for x in r.stdout.splitlines() if x.startswith("[folhas]")), None)
        info = json.loads(linha[9:]) if linha else {"arquivos": [], "codigo": None}
        itens.append({"id": l["id"], "n": n, "pokemon": l.get("nome"), "clipe": l["clipe"], "categoria": l["categoria"],
                      "folhas": info["arquivos"], "codigo_leitura": info["codigo"], "quadros": info.get("quadros")})
        print("  %d/%d %s %s" % (n, len(lote), l["id"], "ok" if linha else "SEM FOLHA"), flush=True)
    corpo_lote = {"versao": 1, "semente": 1025, "itens": itens}
    texto = json.dumps(corpo_lote, ensure_ascii=False, indent=1)
    h = hashlib.sha256(texto.encode()).hexdigest()
    with open(os.path.join(saida, "lote.json"), "w", encoding="utf-8") as fh:
        fh.write(texto)
    with open(os.path.join(saida, "lote.sha256"), "w") as fh:
        fh.write(h + "\n")
    with open(os.path.join(saida, "_sistema", "previsoes_b.json"), "w", encoding="utf-8") as fh:
        json.dump([previsao(l) for l in lote], fh, ensure_ascii=False, indent=1)
    with open(os.path.join(saida, "_sistema", "LEIA.txt"), "w", encoding="utf-8") as fh:
        fh.write("Previsões do sistema para o A/B. NÃO abra antes de terminar a rotulagem (avaliação cega).\n")
    with open(os.path.join(saida, "relatorio_vazamento.json"), "w", encoding="utf-8") as fh:
        json.dump({"grupos": div["grupos"], **div["relatorio_vazamento"], "n_dev": len(div["dev"]),
                   "n_teste": len(div["teste"])}, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(AQUI, "rotulagem.html"), encoding="utf-8") as fh:
        pagina = fh.read().replace("/*LOTE*/null", texto).replace("{{HASH}}", h[:12])
    with open(os.path.join(saida, "rotulagem.html"), "w", encoding="utf-8") as fh:
        fh.write(pagina)
    for f in os.listdir(saida):
        if f.startswith("indice_") and f.endswith(".json"):
            shutil.move(os.path.join(saida, f), os.path.join(saida, "_sistema", f))
    print("lote congelado: sha256 %s" % h)


if __name__ == "__main__":
    main()
