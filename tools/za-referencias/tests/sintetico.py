"""Fábrica de dados sintéticos para os testes (sem o dump do Z-A)."""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))


def c(modelo, clipe, parado=False, especie=1, nome=None, **extra):
    """Linha do banco (clipes.jsonl) mínima para inventário/normas."""
    import metricas
    linha = {"modelo": modelo, "clipe": clipe, "especie": especie, "nome": nome or modelo}
    linha.update(metricas.classificar(clipe))
    if parado:
        linha["parado"] = True
    linha.update(extra)
    return linha
