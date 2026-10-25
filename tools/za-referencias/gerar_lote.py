"""Gera e congela o lote de rotulagem humana (Task 9 / 1I).

  python.exe (do Blender) gerar_lote.py <clipes.jsonl> <pasta_dump> <saida_lote>

1. Divide o banco em dev/teste sem vazamento (avaliacao.dividir) e grava o relatório de vazamento.
2. Escolhe 40 clipes do TESTE (semente 1025): 30 attack01 (um por espécie, revezando classes anatômicas),
   com pelo menos 5 com partes ocultas por escala e 5 com squash/stretch, e o resto de outras categorias.
3. Renderiza as folhas visuais de cada clipe (folhas_visuais.py, Blender em segundo plano).
4. Grava lote.json (sem nenhum valor calculado: avaliação cega), rotulagem.html e o hash do lote.
   As previsões do sistema ficam FORA da pasta do lote, em <saida_lote>_sistema/, para o A/B depois dos rótulos.
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
    p = {"id": l["id"],
         "executores": l.get("executores") if l.get("papeis_status") != "INCONCLUSIVO" else "INCONCLUSIVO",
         "iniciador": l.get("iniciador") or "INCONCLUSIVO",
         "antecipacao": ("sim" if l.get("antecipacao") else "nao") if l.get("status") == "MEDIDO" else "INCONCLUSIVO",
         "apoio_impulso": l.get("apoio_impulso") or [],
         "parte_some_aparece": "sim" if l.get("trocas_visibilidade_n") else "nao"}
    if l.get("papeis_status") == "REVISADO":   # rótulo humano, não previsão do sistema
        del p["executores"]
    return p


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


def refazer_previsoes(banco, saida):
    """Lote já congelado (lote.json e hash intactos): só regrava <saida>_sistema/previsoes_b.json com o banco novo."""
    with open(os.path.join(saida, "lote.json"), encoding="utf-8") as fh:
        ids = [it["id"] for it in json.load(fh)["itens"]]
    por_id = {}
    with open(banco, encoding="utf-8") as fh:
        for x in fh:
            if x.strip():
                l = json.loads(x)
                l["id"] = "%s/%s" % (l["modelo"], l["clipe"])
                por_id[l["id"]] = l
    prev = [previsao(por_id[i]) for i in ids if i in por_id]
    sistema = saida.rstrip("/\\") + "_sistema"
    os.makedirs(sistema, exist_ok=True)
    with open(os.path.join(sistema, "previsoes_b.json"), "w", encoding="utf-8") as fh:
        json.dump(prev, fh, ensure_ascii=False, indent=1)
    return len(prev), len(ids)


# lote diverso (lote 02): (categoria, classe anatômica ou None, condição extra ou None) por vaga
VAGAS_DIVERSO = [("attack", c, None) for c in ("bipede", "quadrupede", "serpentino", "alado", "outro", "sem_membros")] + [
    ("walk", "quadrupede", None), ("walk", "serpentino", None), ("run", "bipede", None),
    ("charge", None, "com_executor"), ("charge", None, "sem_executor"), ("charge", None, None),
    ("damage", None, None), ("rangeattack", None, None), ("land", None, None)]
# completam o lote quando uma vaga não tem candidato na parte de teste (classe rara)
RESERVA_DIVERSO = [("attack", None, None), ("roar", None, None), ("jumpup", None, None), ("stun", None, None),
                   ("eat", None, None), ("turnmove", None, None), ("down", None, None), ("rangeattack", None, None)]


def escolher_diverso(teste, excluir_especies=(), semente=2026, n=15, excluir_cadeias=()):
    """~15 itens variados para rotular: uma espécie e uma linha evolutiva por item (nada redundante), formas comuns
    (_00_00), conjunto 0, revezando classes do corpo e categorias. Espécies de lotes anteriores ficam de fora.
    'charge' entra com e sem executor previsto, para conferir os charge sem membro que cicla."""
    rnd = random.Random(semente)
    medidos = sorted((l for l in teste if l.get("status") == "MEDIDO" and l.get("especie") not in excluir_especies),
                     key=lambda l: l["id"])
    rnd.shuffle(medidos)
    base = [l for l in medidos if l.get("conjunto", 0) == 0 and l["modelo"].endswith("_00_00")]
    usadas_esp, usadas_cad, escolha = set(), set(excluir_cadeias), []
    for cat, classe, cond in VAGAS_DIVERSO + RESERVA_DIVERSO:
        if len(escolha) >= n:
            break
        cands = [l for l in base if l["categoria"] == cat and (classe is None or l.get("anatomia_classe") == classe)
                 and l["especie"] not in usadas_esp and (l.get("cadeia") or l["especie"]) not in usadas_cad
                 and (cond != "com_executor" or l.get("executores")) and (cond != "sem_executor" or not l.get("executores"))]
        if classe is None:   # sem classe pedida: prefere uma classe ainda pouco usada
            cont = defaultdict(int)
            for e in escolha:
                cont[e.get("anatomia_classe")] += 1
            cands.sort(key=lambda l: cont[l.get("anatomia_classe")])
        if not cands and classe is not None:
            # classe rara esgotada no conjunto 0: aceita outra categoria, conjunto ou forma da mesma classe
            cands = [l for l in medidos if l.get("anatomia_classe") == classe and l["especie"] not in usadas_esp
                     and (l.get("cadeia") or l["especie"]) not in usadas_cad]
            cands.sort(key=lambda l: (l["categoria"] != cat, l.get("conjunto", 0) != 0))
        cands.sort(key=lambda l: l.get("variante") != "01")   # variante 01 primeiro (sort estável)
        if cands:
            l = cands[0]
            escolha.append(l)
            usadas_esp.add(l["especie"])
            usadas_cad.add(l.get("cadeia") or l["especie"])
    return escolha


def main():
    if sys.argv[1] == "--previsoes":
        print("previsões: %d de %d itens" % refazer_previsoes(sys.argv[2], sys.argv[3]))
        return
    diverso = sys.argv[1] == "--diverso"
    if diverso:
        sys.argv.pop(1)
    banco, dump, saida = sys.argv[1:4]
    anteriores = sys.argv[4:]   # pastas de lotes anteriores: espécies que não podem repetir
    with open(os.path.join(AQUI, "especies.json"), encoding="utf-8") as fh:
        esp = json.load(fh)["especies"]
    with open(banco, encoding="utf-8") as fh:
        clipes = [json.loads(x) for x in fh if x.strip()]
    for l in clipes:
        l["id"] = "%s/%s" % (l["modelo"], l["clipe"])
        l["cadeia"] = (esp.get(str(l.get("especie"))) or {}).get("cadeia")
    corpo = [l for l in clipes if l.get("codigo") and not l["codigo"].startswith("08") and not l.get("parado")]
    div = avaliacao.dividir(corpo)
    sistema = saida.rstrip("/\\") + "_sistema"   # FORA da pasta entregue aos revisores (avaliação cega)
    os.makedirs(sistema, exist_ok=True)
    os.makedirs(saida, exist_ok=True)
    if diverso:
        excl, excl_cad = set(), set()
        for pasta in anteriores:
            with open(os.path.join(pasta, "lote.json"), encoding="utf-8") as fh:
                ids = {it["id"] for it in json.load(fh)["itens"]}
            excl |= {l["especie"] for l in clipes if l["id"] in ids}
            excl_cad |= {l.get("cadeia") or l["especie"] for l in clipes if l["id"] in ids}
        lote = escolher_diverso(div["teste"], excl, excluir_cadeias=excl_cad)
    else:
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
    corpo_lote = {"versao": 1, "semente": 2026 if diverso else 1025, "itens": itens}
    texto = json.dumps(corpo_lote, ensure_ascii=False, indent=1)
    h = hashlib.sha256(texto.encode()).hexdigest()
    with open(os.path.join(saida, "lote.json"), "w", encoding="utf-8") as fh:
        fh.write(texto)
    with open(os.path.join(saida, "lote.sha256"), "w") as fh:
        fh.write(h + "\n")
    with open(os.path.join(sistema, "previsoes_b.json"), "w", encoding="utf-8") as fh:
        json.dump([previsao(l) for l in lote], fh, ensure_ascii=False, indent=1)
    with open(os.path.join(sistema, "LEIA.txt"), "w", encoding="utf-8") as fh:
        fh.write("Previsões do sistema para o A/B. NÃO abra antes de terminar a rotulagem (avaliação cega).\n")
    with open(os.path.join(saida, "relatorio_vazamento.json"), "w", encoding="utf-8") as fh:
        json.dump({"grupos": div["grupos"], **div["relatorio_vazamento"], "n_dev": len(div["dev"]),
                   "n_teste": len(div["teste"]),
                   "limites": ["quase duplicata = correlação >= 0,9999 da curva de energia + mesmos quadros + energia de pico "
                               "a até 1%: só pega cópias quase exatas; animação retargetada para outro rig/proporção NÃO é "
                               "detectada (precisaria comparar curvas por osso). Desvio do plano (0,98 + curva do executor) "
                               "aguardando confirmação do responsável."]}, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(AQUI, "rotulagem.html"), encoding="utf-8") as fh:
        pagina = fh.read().replace("/*LOTE*/null", texto).replace("{{HASH}}", h[:12])
    with open(os.path.join(saida, "rotulagem.html"), "w", encoding="utf-8") as fh:
        fh.write(pagina)
    for f in os.listdir(saida):
        if f.startswith("indice_") and f.endswith(".json"):
            shutil.move(os.path.join(saida, f), os.path.join(sistema, f))
    print("lote congelado: sha256 %s" % h)


if __name__ == "__main__":
    main()
