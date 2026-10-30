"""Filtro de espécies do lote 03 (decisão do responsável, 29/10/2026):

  - sem baby;
  - só 2º ou 3º estágio da linha evolutiva (o estágio conta a partir da pré-evolução mais antiga, baby incluído);
  - espécie sem evolução nenhuma (linha de um estágio só) entra apenas se o egg group for Humanoide (humanshape)
    ou Monster.

Dados: PokeAPI (pokemon_species.csv e pokemon_egg_groups.csv), em dumper test/_ref/. CLI:
  python elegibilidade.py <pokemon_species.csv> <pokemon_egg_groups.csv> <saida.json>
"""
import csv
import json
import sys

EGG_MONSTER, EGG_HUMANSHAPE = 1, 8


def estagios(especies):
    """id -> estágio (1, 2, 3...) seguindo evolves_from_species_id até a raiz."""
    pai = {e["id"]: e.get("evolves_from_species_id") for e in especies}
    out = {}
    for i in pai:
        n, atual, vistos = 1, i, {i}
        while pai.get(atual) and pai[atual] in pai and pai[atual] not in vistos:
            atual = pai[atual]
            vistos.add(atual)
            n += 1
        out[i] = n
    return out


def elegiveis(especies, grupos_de_ovo):
    """especies: linhas com id, evolves_from_species_id, evolution_chain_id, is_baby. grupos_de_ovo: id -> {egg_group_id}."""
    est = estagios(especies)
    com_filho = {e["evolves_from_species_id"] for e in especies if e.get("evolves_from_species_id")}
    out = set()
    for e in especies:
        i = e["id"]
        if e.get("is_baby"):
            continue
        if est[i] >= 2:
            out.add(i)
        elif i not in com_filho and grupos_de_ovo.get(i, set()) & {EGG_MONSTER, EGG_HUMANSHAPE}:
            out.add(i)
    return out


def _int(v):
    return int(v) if v not in (None, "") else None


def ler_csv(especies_csv, ovos_csv):
    with open(especies_csv, encoding="utf-8") as fh:
        esp = [{"id": int(r["id"]), "evolves_from_species_id": _int(r["evolves_from_species_id"]),
                "evolution_chain_id": int(r["evolution_chain_id"]), "is_baby": int(r["is_baby"])}
               for r in csv.DictReader(fh)]
    ovos = {}
    with open(ovos_csv, encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            ovos.setdefault(int(r["species_id"]), set()).add(int(r["egg_group_id"]))
    return esp, ovos


if __name__ == "__main__":
    esp, ovos = ler_csv(sys.argv[1], sys.argv[2])
    ids = sorted(elegiveis(esp, ovos))
    with open(sys.argv[3], "w", encoding="utf-8") as fh:
        json.dump({"regra": "sem baby; 2º/3º estágio; sem evolução só com egg group Humanoide ou Monster",
                   "fonte": "PokeAPI pokemon_species.csv + pokemon_egg_groups.csv", "especies": ids}, fh)
    print("elegíveis: %d de %d espécies" % (len(ids), len(esp)))
