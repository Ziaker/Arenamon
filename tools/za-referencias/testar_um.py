"""Mede uma forma (pasta pmXXXX_YY_ZZ) e imprime as medidas de alguns clipes. Uso de conferência.

  python.exe (do Blender) testar_um.py <pasta_do_modelo> [clipe ...]
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import metricas  # noqa: E402
import za_anim  # noqa: E402

pasta = os.path.abspath(sys.argv[1])
alvos = sys.argv[2:]
esq = za_anim.Esqueleto(za_anim.esqueleto_do_modelo(pasta))
raiz = metricas.raiz_do_corpo(esq)
prefixo = os.path.basename(pasta) + "_"
t0 = time.time()
arqs = sorted(f for f in os.listdir(pasta) if f.endswith(".tranm"))
for f in arqs:
    nome = f[len(prefixo):-6]
    if alvos and nome not in alvos:
        continue
    c = za_anim.Clipe(os.path.join(pasta, f), esq)
    c.eh_loop = metricas.classificar(nome)["fase"] == "loop"
    m = metricas.medir(c, esq, raiz)
    m.pop("curva_energia", None)
    print(nome, json.dumps(m, ensure_ascii=False))
print("tempo %.2f s" % (time.time() - t0))
