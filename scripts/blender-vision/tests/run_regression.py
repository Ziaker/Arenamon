"""Regressao das correcoes da revisao externa, contra um .blend real (somente leitura). Uso:
   python scripts/blender-vision/tests/run_regression.py --blend chars/vigor/Vigoroth_tackle_v1.blend --brief scripts/blender-vision/briefs/vigoroth_tackle.brief.json --work PASTA_TEMP"""
import argparse, hashlib, json, os, subprocess, sys, time

VIS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "vision.py")


class NaoTestado(Exception):
    pass


def run(args, expect_fail=False):
    """returncode e SEMPRE conferido: uma etapa que falha torna o resultado NAO TESTADO (nunca se le JSON de execucao anterior)"""
    r = subprocess.run([sys.executable, VIS] + args, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode and not expect_fail:
        raise NaoTestado("etapa falhou (codigo %d): %s | %s" % (r.returncode, " ".join(args)[:120], (r.stderr or r.stdout)[-300:]))
    return r.returncode, r.stdout, r.stderr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blend", required=True); ap.add_argument("--brief", required=True); ap.add_argument("--work", required=True)
    ap.add_argument("--action", default="Tackle_blocking_v2"); ap.add_argument("--baseline", default="idle")
    a = ap.parse_args()
    a.work = os.path.join(a.work, "run-%s-%d" % (time.strftime("%Y%m%d-%H%M%S"), os.getpid()))      # pasta NOVA: nunca reaproveita saida antiga
    os.makedirs(a.work)
    h0 = hashlib.sha256(open(a.blend, "rb").read()).hexdigest()
    T = []

    def t(nome, ok, det=""):
        T.append((nome, bool(ok), det))
        print("%-58s %s %s" % (nome, "OK  " if ok else "FALHOU", det))

    base = ["--blend", a.blend, "--offset", "1"]
    d = os.path.join(a.work, "reg_dense")
    c, o, e = run(["dense"] + base + ["--action", a.action, "--out", d, "--overwrite"])
    r = json.load(open(os.path.join(d, "dense_report.json"), encoding="utf-8"))
    n = len(r["movimento_total_por_frame"])
    t("duracao do perfil == numero de frames da action", r["perfil_ritmo"]["corpo"]["frames"] == n == 41, "%s/%s" % (r["perfil_ritmo"]["corpo"]["frames"], n))
    need = ["aceleracao_vetorial_m_frame2", "aceleracao_modulo_m_frame2", "jerk_vetorial_m_frame3", "jerk_modulo_m_frame3", "velocidade_vetorial_m_frame", "velocidade_angular_local_graus_frame", "velocidade_angular_mundo_graus_frame", "mudanca_de_direcao_graus", "curvatura_1_por_m", "velocidade_alinhada_quadril"]
    tr = r["trajetorias"]["RightHand"]
    t("campos cinematicos presentes e com 1 valor por frame", all(k in tr and len(tr[k]) == n for k in need))
    t("aceleracao e jerk sao VETORES (3 componentes) e o modulo bate", all(len(row) == 3 for row in tr["aceleracao_vetorial_m_frame2"]) and all(abs((sum(x * x for x in row) ** 0.5) - m) < 2e-4 for row, m in zip(tr["aceleracao_vetorial_m_frame2"], tr["aceleracao_modulo_m_frame2"])))
    t("espaco relativo ao quadril presente (maos)", tr["posicao_relativa_ao_quadril"] is not None and len(tr["posicao_relativa_ao_quadril"]) == n)
    t("contribuicao por regiao soma ~1", abs(sum(r["contribuicao_por_regiao"].values()) - 1.0) < 0.02, str(round(sum(r["contribuicao_por_regiao"].values()), 3)))
    t("fases candidatas presentes", all(k in r["fases_candidatas"] for k in ("impacto", "antecipacao", "recuperacao", "saltos_de_borda_excluidos")))
    # semantica: dentro de hold por constante (frames 0-2 autorais) toda cinematica e zero
    holds = [p for p in r["paradas"] if p["tipo"] == "hold_por_interpolacao_constante"]
    zero = True
    for p in holds:
        i0, i1 = p["frames_autorais"]
        for j, tj in r["trajetorias"].items():
            for k in ("velocidade_m_frame", "velocidade_angular_local_graus_frame", "velocidade_angular_mundo_graus_frame"):
                zero &= all(abs(x) < 1e-3 for x in tj[k][i0 + 1:i1 + 1])
    t("hold constante => velocidade linear e angular ~0", holds and zero, "%d holds" % len(holds))
    t("saltos de espacamento sem razoes absurdas (|delta/pico| <= 1)", all(abs(v) <= 1.0001 for s in r["saltos_de_espacamento_x4"].values() for _, v in s))
    # fases candidatas: com janela declarada o impacto nao e escolhido; sem janela o snap de borda g40 nunca vira "impacto"
    dw = os.path.join(a.work, "reg_dense_win")
    run(["dense"] + base + ["--action", a.action, "--impact-window", "9-13", "--out", dw, "--overwrite"])
    rw = json.load(open(os.path.join(dw, "dense_report.json"), encoding="utf-8"))
    t("janela declarada: frame de contato NAO selecionado", rw["fases_candidatas"]["impacto"]["selecionado_frame_de_contato"] is None and rw["fases_candidatas"]["impacto"]["frames_autorais"] == [9, 13])
    t("snap de saida g40 excluido da busca de pico", 40 in r["fases_candidatas"]["saltos_de_borda_excluidos"] and r["fases_candidatas"]["impacto"].get("frame_autoral") != 40, str(r["fases_candidatas"]["impacto"]))
    d2 = os.path.join(a.work, "reg_check")
    c, o, e = run(["check"] + base + ["--action", a.action, "--brief", a.brief, "--mode", "oneshot", "--baseline-action", a.baseline, "--out", d2, "--overwrite"])
    rep = json.load(open(os.path.join(d2, "check_report.json"), encoding="utf-8"))
    rs = rep["resumo"]
    t("resumo soma todas as regras e inclui HIPOTESE", sum(rs.values()) == len(rep["regras"]) and "HIPOTESE %d" % rs.get("HIPOTESE", 0) in o and ("%d regras" % len(rep["regras"])) in o, str(rs))
    sw = {x["id"]: x for x in rep["regras"] if x["type"] == "scale_window"}
    parcial = [i for i, x in sw.items() if "frames da janela sem efeito: []" not in x["detalhe"]]
    t("scale_window com frame sem efeito NUNCA e PASS", all(sw[i]["status"] == "FAIL" for i in parcial), "janelas parciais: %s" % parcial)
    ip = [x for x in rep["regras"] if x["type"] == "no_interpenetration"][0]
    ok = True
    for k, v in ip["evidencia"].items():
        if "limite_fracao_do_corpus" in v:
            esperado = sorted(int(f) for f, dd in v["fracao_de_vertices_dentro_por_frame_autoral"].items() if dd > v["limite_fracao_do_corpus"])
        else:
            esperado = sorted(int(f) for f, dd in v["profundidade_por_frame_autoral"].items() if dd - v["baseline_m"] > 0.02)
        ok &= v["frames_acima_da_tolerancia"] == esperado
    t("interpenetracao: frames = os que passam o limite (envelope do corpus ou baseline+tolerancia)", ok)
    # regras relacionais da coreografia: conferencia cruzada contra a analise densa (caminho de codigo diferente)
    dc = os.path.join(a.work, "reg_coreo")
    coreo = os.path.join(os.path.dirname(a.brief), "vigoroth_tackle.coreografia.brief.json")
    run(["check"] + base + ["--action", a.action, "--brief", coreo, "--out", dc, "--overwrite"])
    rc = {x["id"]: x for x in json.load(open(os.path.join(dc, "check_report.json"), encoding="utf-8"))["regras"]}
    t("briefing relacional: 8 regras avaliadas, nenhuma com erro de avaliacao", len(rc) == 8 and not any("erro ao avaliar" in x["detalhe"] for x in rc.values()))
    xs = [row[0] for row in tr["posicao_relativa_ao_quadril"]]
    cruz = [i + 1 for i in range(len(xs) - 1) if 5 <= i + 1 <= 20 and xs[i] * xs[i + 1] < 0]
    t("crosses_value (RightHand x) == mudanca de sinal na analise densa", (rc["mao_D_cruza_a_frente_do_tronco"]["status"] == "PASS") == bool(cruz), "regra=%s densa=%s" % (rc["mao_D_cruza_a_frente_do_tronco"]["status"], cruz))
    # snapshot de regressao: estado de CADA regra relacional do Tackle v2 (se mudar, a mudanca e deliberada e tem de ser lida)
    esperado = {"braco_D_acelera_antes_do_tronco": "INCONCLUSIVO", "mao_D_trajetoria_descendente_g9_g17": "PASS", "mao_D_cruza_a_frente_do_tronco": "PASS",
                "elevacao_e_aterrissagem_g27_g30": "PASS", "end_distancia_a_idle_diminui": "INCONCLUSIVO", "movimento_residual_g18_g26": "PASS",
                "mao_D_com_movimento_relevante_na_janela_g9_g13": "PASS", "contato_g9_g13_exige_imagem": "INCONCLUSIVO"}
    dif = {k: (rc[k]["status"], v) for k, v in esperado.items() if rc[k]["status"] != v}
    t("cada regra relacional tem o status esperado (snapshot)", not dif, str(dif))
    t("regras trazem nivel de confianca", all("confianca" in x for x in rc.values()))
    t("nenhuma regra relacional escolhe frame de contato", all("frame de contato" not in x["detalhe"] or "NAO escolhe" in x["detalhe"] for x in rc.values()))
    c, o, e = run(["cycle"] + base + ["--action", "NAO_EXISTE", "--label", "x", "--history", os.path.join(a.work, "hist_reg"), "--out", os.path.join(a.work, "cy_bad"), "--overwrite"], expect_fail=True)
    t("cycle aborta (exit != 0) e sem OVERVIEW quando snap falha", c != 0 and not os.path.exists(os.path.join(a.work, "cy_bad", "OVERVIEW.png")), "exit=%d" % c)
    # negativos e positivos de regras: idle (parada) nao pode passar regras de movimento; Jump tem elevacao real
    dn = os.path.join(a.work, "reg_neg")
    run(["check"] + base + ["--action", "idle", "--brief", os.path.join(os.path.dirname(os.path.abspath(__file__)), "rules.brief.negative.json"), "--out", dn, "--overwrite"])
    rn = {x["id"]: x["status"] for x in json.load(open(os.path.join(dn, "check_report.json"), encoding="utf-8"))["regras"]}
    t("negativos: idle FALHA lift_and_land, path_descends, crosses_value, motion_present", all(v == "FAIL" for v in rn.values()) and len(rn) == 4, str(rn))
    dp = os.path.join(a.work, "reg_pos")
    run(["check"] + base + ["--action", "Jump", "--brief", os.path.join(os.path.dirname(os.path.abspath(__file__)), "rules.brief.positive.json"), "--out", dp, "--overwrite"])
    rp = {x["id"]: x["status"] for x in json.load(open(os.path.join(dp, "check_report.json"), encoding="utf-8"))["regras"]}
    t("positivos: Jump (elevacao real) passa lift_and_land e motion_present", all(v == "PASS" for v in rp.values()) and len(rp) == 2, str(rp))
    prov = rep.get("proveniencia", {})
    code_now = {f: hashlib.sha256(open(os.path.join(os.path.dirname(VIS), f), "rb").read()).hexdigest()[:16] for f in ("vision.py", "check_inside.py")}
    t("proveniencia no relatorio coincide com o codigo atual", all(prov.get("codigo_sha256_16", {}).get(f) == h for f, h in code_now.items()) and prov.get("blend_sha256_16") == h0[:16])
    t("hash do .blend de origem inalterado", hashlib.sha256(open(a.blend, "rb").read()).hexdigest() == h0)
    print("\n%d/%d" % (sum(x[1] for x in T), len(T)))
    sys.exit(0 if all(x[1] for x in T) else 1)


try:
    main()
except NaoTestado as e:
    print(chr(10) + "NAO TESTADO:", e)
    sys.exit(3)
