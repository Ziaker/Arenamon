"""Calibra envelopes e taxas de falso positivo a partir do corpus de clips reais (corpus_report.json, gerado por `vision.py corpus`).

    python scripts/blender-vision/calibrate.py CORPUS_REPORT.json --out scripts/blender-vision/criteria/corpus_envelope.json

O envelope e EMPIRICO: percentis 10-90 do que clips de ataque existentes ja fazem. Nao diz que o ritmo e bom, so quao tipico ele e.
"""
import argparse
import json
import sys

import numpy as np

ATAQUES = ["Headbutt", "Tackle 1", "Drop Kick", "Flip Kick", "Flying Knee Punch Combo", "Jump Attack", "Standing Melee Attack Backhand", "Zombie Attack",
           "chop sweep", "perfect guard kick", "sand kick", "Running Slide"]
LOCOMOCAO = ["Walk fwd", "Walk Backward", "Walk Strafe Right", "run"]
MEDIDAS = ["t10", "t50", "t90", "pico_norm", "pico_sobre_media", "fracao_parada"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("corpus")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    C = json.load(open(a.corpus, encoding="utf-8"))
    env = {"_leia": "Envelope EMPIRICO (percentis 10 e 90) de clips de ataque existentes do projeto. Mede o quao tipico e um ritmo; NAO julga qualidade artistica. Derivado automaticamente; nenhuma aprovacao humana envolvida.",
           "clips_de_ataque_usados": [n for n in ATAQUES if n in C]}
    for reg in ("corpo", "maos", "quadril"):
        env[reg] = {}
        for m in MEDIDAS + (["duracao_frames"] if reg == "corpo" else []):
            vals = [(C[n]["frames"] if m == "duracao_frames" else C[n]["perfil_ritmo"][reg].get(m)) for n in ATAQUES if n in C]
            vals = [v for v in vals if v is not None]
            if len(vals) >= 5:
                env[reg][m] = [round(float(np.percentile(vals, 10)), 3), round(float(np.percentile(vals, 90)), 3)]
    json.dump(env, open(a.out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("envelope:", json.dumps({k: env[k] for k in ("corpo",)}, ensure_ascii=False))
    # taxa de "deslizando"/arrasto em locomocao autoral (nao deveria haver arrasto constante)
    tot = arr = 0
    for n in LOCOMOCAO:
        if n in C:
            for s, f in C[n]["pes"].items():
                for t in f["tipos_de_deslize"]:
                    tot += 1
                    arr += t.startswith("arrasto")
    print("locomocao autoral: %d trechos 'deslizando', %d classificados como arrasto constante (falso positivo se > 0)" % (tot, arr))
    for n in LOCOMOCAO + ["idle", "alt idle", "Standing Block Idle"]:
        if n in C:
            print("  %-22s %s" % (n, {s: (f["modo"], f["deslizando"], f["tipos_de_deslize"]) for s, f in C[n]["pes"].items()}))
    return 0


sys.exit(main())
