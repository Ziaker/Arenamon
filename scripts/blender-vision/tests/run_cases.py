"""Gera os casos rotulados (copia temporaria) e confere a ferramenta contra cases.json. Uso:
   python scripts/blender-vision/tests/run_cases.py --blend chars/vigor/Vigoroth_tackle_v1.blend --work PASTA_TEMP
Nunca grava no .blend de origem."""
import argparse, hashlib, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
VIS = os.path.join(os.path.dirname(HERE), "vision.py")
BLENDER = os.environ.get("BLENDER_EXE", r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe")


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def run(args):
    r = subprocess.run([sys.executable, VIS] + args, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise SystemExit("falhou: %s\n%s" % (args, (r.stdout + r.stderr)[-800:]))
    return r.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blend", required=True)
    ap.add_argument("--work", required=True)
    a = ap.parse_args()
    os.makedirs(a.work, exist_ok=True)
    h0 = sha(a.blend)
    cases_blend = os.path.join(a.work, "cases.blend")
    subprocess.run([BLENDER, "-b", a.blend, "--python", os.path.join(HERE, "make_cases.py"), "--", cases_blend], capture_output=True)
    labels = json.load(open(os.path.join(HERE, "cases.json"), encoding="utf-8"))["casos"]
    rows = []
    for c in labels:
        act, exp = c["action"], c["esperado"]
        ok, got = True, {}
        out = os.path.join(a.work, "o_" + act.replace(" ", "_"))
        if c["tipo"] == "dense":
            run(["dense", "--blend", cases_blend, "--action", act, "--offset", "1", "--out", out, "--overwrite"])
            r = json.load(open(os.path.join(out, "dense_report.json"), encoding="utf-8"))
            nd = [len(f["frames_deslizando"]) for f in r["pes"].values()]
            got = {"pes_deslizando_frames": nd, "modo": [f["modo"] for f in r["pes"].values()], "paradas": [p["tipo"] for p in r["paradas"]]}
            if "pes_deslizando_max_frames" in exp:
                ok &= max(nd) <= exp["pes_deslizando_max_frames"]
            if "modo" in exp:
                ok &= all(m == exp["modo"] for m in got["modo"])
            if "pes_deslizando_min_frames" in exp:
                ok &= min(nd) >= exp["pes_deslizando_min_frames"]
            if exp.get("sem_arrasto_constante"):
                tipos = [t["tipo"] for f in r["pes"].values() for t in f["trechos_deslizando"]]
                got["tipos_de_deslize"] = tipos
                ok &= not any(t.startswith("arrasto") for t in tipos)
            if "paradas_tipo_unico" in exp:
                ok &= len(got["paradas"]) >= exp["paradas_min"] and set(got["paradas"]) == {exp["paradas_tipo_unico"]}
            if exp.get("check_not_frozen_nao_e_FAIL"):
                run(["check", "--blend", cases_blend, "--action", act, "--offset", "1", "--brief", os.path.join(HERE, "cases.brief.frozen.json"), "--out", out + "_chk"])
                rc = json.load(open(os.path.join(out + "_chk", "check_report.json"), encoding="utf-8"))
                st = rc["regras"][0]["status"]
                got["not_frozen"] = st
                ok &= st != "FAIL"
        else:
            run(["check", "--blend", cases_blend, "--action", act, "--offset", "1", "--brief", os.path.join(HERE, "cases.brief.interp.json"), "--baseline-action", "idle", "--out", out])
            rc = json.load(open(os.path.join(out, "check_report.json"), encoding="utf-8"))
            got = {"status": rc["regras"][0]["status"], "detalhe": rc["regras"][0]["detalhe"][:160]}
            ok &= got["status"] == exp["status"]
        conhecida = (not ok) and bool(c.get("limitacao_conhecida"))
        rows.append({"action": act, "esperado": exp, "obtido": got, "acertou": bool(ok), "motivo": c["motivo"], "limitacao_conhecida": c.get("limitacao_conhecida") if conhecida else None})
        print("%-20s %s  esperado=%s obtido=%s" % (act, "ACERTOU" if ok else ("LIMITACAO CONHECIDA" if conhecida else "ERROU  "), exp, got))
    h1 = sha(a.blend)
    conhecidas = [r["action"] for r in rows if r["limitacao_conhecida"]]
    res = {"acertos": sum(r["acertou"] for r in rows), "total": len(rows), "limitacoes_conhecidas_nao_detectadas": conhecidas, "erros_novos": [r["action"] for r in rows if not r["acertou"] and not r["limitacao_conhecida"]], "blend_origem_intacto": h0 == h1, "sha256": h1, "casos": rows}
    json.dump(res, open(os.path.join(a.work, "resultado_casos.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(chr(10) + "%d/%d casos (+ %d limitacao conhecida nao detectada: %s) | erros novos: %s | .blend de origem intacto: %s" % (res["acertos"], res["total"], len(conhecidas), conhecidas, res["erros_novos"], res["blend_origem_intacto"]))
    sys.exit(1 if res["erros_novos"] or not res["blend_origem_intacto"] else 0)


main()
