"""Calibra o limite de interpenetracao a partir de clips AUTORAIS reais (sem defeitos presumidos) e grava criteria/interp_envelope.json.

    python scripts/blender-vision/calibrate_interp.py --blend chars/vigor/Vigoroth_tackle_v1.blend --work PASTA_TEMP

Para cada clip, roda `check` (somente leitura) e coleta, por categoria de par (arm~body, leg~body, arm~leg, ...), a MAIOR fracao de vertices
dentro da regiao vizinha. limite_fracao = min(0.9, 1.5 x maximo autoral). Sem aprovacao humana: o limite e empirico (o quanto este rig
ja se sobrepoe em animacoes autorais, por causa do skinning). Remova `--clips` padrao se o corpus mudar.
"""
import argparse
import json
import os
import subprocess
import sys

CLIPS = ["idle", "alt idle", "Standing Block Idle", "Walk fwd", "Walk Backward", "Walk Strafe Right", "run", "Headbutt", "Tackle 1", "Drop Kick", "Flip Kick",
         "Standing Melee Attack Backhand", "Zombie Attack", "chop sweep", "get hit", "Jump", "land", "Falling Idle", "Standing Up", "Wall Crash", "Zombie Stand Up",
         "Sitting Dazed", "Flying Knee Punch Combo", "Jump Attack", "perfect guard kick", "sand kick", "Running Slide", "dodge 2", "Center Block"]
HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blend", required=True)
    ap.add_argument("--work", required=True)
    ap.add_argument("--clips", nargs="*", default=CLIPS)
    a = ap.parse_args()
    brief = os.path.join(HERE, "tests", "cases.brief.interp.json")
    envfile = os.path.join(HERE, "criteria", "interp_envelope.json")
    stash = None
    if os.path.exists(envfile):          # mede SEM o envelope atual (senao a regra mudaria de caminho)
        stash = open(envfile, "rb").read()
        os.remove(envfile)
    try:
        mx, dm, per = {}, {}, {}
        for c in a.clips:
            out = os.path.join(a.work, "cal_" + c.replace(" ", "_"))
            r = subprocess.run([sys.executable, os.path.join(HERE, "vision.py"), "check", "--blend", a.blend, "--action", c, "--offset", "1", "--brief", brief, "--out", out, "--overwrite"],
                               capture_output=True, text=True, encoding="utf-8", errors="replace")
            if r.returncode:
                print("pulado (falhou):", c)
                continue
            rep = json.load(open(os.path.join(out, "check_report.json"), encoding="utf-8"))
            ev = [x for x in rep["regras"] if x["type"] == "no_interpenetration"][0]["evidencia"]
            for k, v in ev.items():
                cat = k.replace("_L", "").replace("_R", "")
                mx[cat] = max(mx.get(cat, 0), v["fracao_de_vertices_dentro_max"])
                dm[cat] = max(dm.get(cat, 0), v["profundidade_max_m"])
                per.setdefault(c, {})[cat] = max(per.get(c, {}).get(cat, 0), v["fracao_de_vertices_dentro_max"])
            print("%-34s ok" % c, flush=True)
    finally:
        if stash is not None:
            open(envfile, "wb").write(stash)
    # validacao leave-one-out: o limite calculado SEM o clip i marcaria o clip i? (sem isto, "0 falsos positivos" seria circular)
    fp = []
    for c in per:
        for cat, v in per[c].items():
            outros = [per[o][cat] for o in per if o != c and cat in per[o]]
            if outros and v > min(0.9, 1.5 * max(outros)):
                fp.append({"clip": c, "par": cat, "fracao": v, "limite_sem_o_clip": round(min(0.9, 1.5 * max(outros)), 3)})
    n_testes = sum(len(v) for v in per.values())
    loo = {"falsos_positivos": fp, "testes": n_testes, "taxa": round(len(fp) / max(1, n_testes), 4)}
    env = {"validacao_leave_one_out": loo, "_leia": "Limite EMPIRICO de sobreposicao membro~regiao vizinha, derivado de clips autorais do projeto (maximo x 1.5, teto 0.9). Sem aprovacao humana. Veja calibrate_interp.py.",
           "clips": a.clips, "pares": {cat: {"max_fracao_autoral": round(v, 4), "max_profundidade_autoral_m": round(dm[cat], 4), "limite_fracao": round(min(0.9, 1.5 * v), 3)} for cat, v in mx.items()}}
    os.makedirs(os.path.dirname(envfile), exist_ok=True)
    json.dump(env, open(envfile, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(json.dumps(env["pares"], ensure_ascii=False))
    print("leave-one-out:", json.dumps(loo, ensure_ascii=False))


main()
