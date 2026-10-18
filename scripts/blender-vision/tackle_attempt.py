"""Ciclo autonomo de tentativas do Tackle do Vigoroth (Arenamon, Teste 01).

    python scripts/blender-vision/tackle_attempt.py attempt --fix scripts/blender-vision/tackle_fixes/f01_xxx.py [--base N]
    python scripts/blender-vision/tackle_attempt.py status

Por tentativa: duplica a ultima versao valida -> aplica UMA correcao pequena (modulo de correcao) -> salva Vigoroth_tackle_v(N+1).blend (nunca
sobrescreve) -> captura -> mede -> verifica o contrato (Tackle.motion_contract.json) -> compara com a versao anterior -> aceita/rejeita ->
grava registro IMUTAVEL em chars/vigor/tackle_history/vNN.json (+ imagens) -> imprime resumo curto.
Os originais (todos os .blend/.blend1 existentes) tem o SHA-256 conferido antes e depois; qualquer mudanca aborta e marca a tentativa como invalida.
"""
import argparse
import glob
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
CHAR = os.path.join(REPO, "chars", "vigor")
HIST = os.path.join(CHAR, "tackle_history")
VIS = os.path.join(HERE, "vision.py")
CONTRACT = os.path.join(CHAR, "Tackle.motion_contract.json")
BLENDER = os.environ.get("BLENDER_EXE", r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe")
OFFSET = 1

# prioridade das familias de problema (1 = mais importante), do briefing do usuario
FAMILY = {}
for _i, _ids in {
    0: ["g_41_frames", "g_30_fps"],
    1: ["s_perna_D_apoiada", "s_perna_D_esticada", "s_perna_E_levantada", "s_braco_D_recuado_lateral", "s_braco_D_recuado_para_tras", "s_braco_E_a_frente", "s_braco_E_na_altura_dos_olhos",
        "m1_braco_D_antes_do_tronco", "m1_tronco_acompanha", "m3_braco_E_atras", "m3_braco_D_baixo", "m3_perna_D_articulada_atras", "m2_perna_D_atras", "m2_perna_D_articulada"],
    2: ["s_mao_E_aberta", "s_palma_E_ao_adversario", "m2_parte_do_alto_a_direita", "m2_cruza_frente_do_tronco", "m2_arco_descendente", "m2_golpe_continuo",
        "m2_movimento_na_janela_de_contato", "m2_garra_aberta_no_contato", "m2_sem_frame_unico_de_contato", "s_linha_de_acao_arco", "m3_braco_D_estendido"],
    3: ["v_mao_D_visivel_no_contato", "v_braco_D_legivel", "v_braco_D_legivel_mid3", "v_mao_E_visivel_no_start"],
    4: ["m1_smear_g4_g8", "m2_stretch_g9_g12", "g_escala_limpa"],
    5: ["e_sem_salto_final"],
    6: ["m3_nao_congelar", "m3_movimento_residual"],
    7: ["m2_perna_E_apoio", "m3_perna_E_sustenta", "e_perna_D_no_chao", "e_apoio_bilateral", "g_sem_root_motion", "e_pes_sem_deslizar", "x_chao_nao_atravessa"],
    8: ["x_sem_interpenetracao"],
    9: ["e_retorno_gradual_idle", "e_pose_final_perto_da_idle"],
    10: ["e_pulinho_g27_g30"],
}.items():
    for _r in _ids:
        FAMILY[_r] = _i
RANK = {"confirmed": 3, "partially_representable": 3, "not_applicable": 3, "uncertain": 2, "failed": 0, "not_representable": 2}


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for ch in iter(lambda: f.read(1 << 20), b""):
            h.update(ch)
    return h.hexdigest().upper()


def run(cmd, timeout=1800):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
    return r


def die(msg, code=2):
    print("ERRO:", msg, file=sys.stderr)
    sys.exit(code)


def tools_version():
    names = ["vision.py", "check_inside.py", "inside_blender.py", "dense_inside.py", "vision_common.py", "pose_lib.py", "apply_fix.py", "tackle_attempt.py"]
    return {n: sha(os.path.join(HERE, n))[:12] for n in names if os.path.exists(os.path.join(HERE, n))}


def blend_of(n):
    return os.path.join(CHAR, "Vigoroth_tackle_v%d.blend" % n)


def action_of(n):
    return "Tackle_blocking_v2" if n == 1 else "Tackle_v%02d" % n


def existing_versions():
    out = []
    for p in glob.glob(os.path.join(CHAR, "Vigoroth_tackle_v*.blend")):
        m = re.search(r"_v(\d+)\.blend$", p)
        if m:
            out.append(int(m.group(1)))
    return sorted(out)


def best_version():
    p = os.path.join(HIST, "best.json")
    return json.load(open(p, encoding="utf-8"))["version"] if os.path.exists(p) else 1


def originals():
    return {os.path.basename(p): sha(p) for p in glob.glob(os.path.join(CHAR, "*.blend")) + glob.glob(os.path.join(CHAR, "*.blend1"))}


def parse_frames(spec):
    out = []
    for part in str(spec).split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-")
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


# ------------------------------------------------------------------ medicao e contrato
def measure(blend, action, workdir, frames_extra=()):
    os.makedirs(workdir, exist_ok=True)
    base = ["--blend", blend, "--offset", str(OFFSET)]
    chk = os.path.join(workdir, "check")
    r = run([sys.executable, VIS, "check"] + base + ["--action", action, "--brief", CONTRACT, "--mode", "oneshot", "--out", chk, "--overwrite"])
    if r.returncode:
        raise RuntimeError("check falhou (%d): %s" % (r.returncode, (r.stderr or r.stdout)[-400:]))
    check = json.load(open(os.path.join(chk, "check_report.json"), encoding="utf-8"))
    den = os.path.join(workdir, "dense")
    r = run([sys.executable, VIS, "dense"] + base + ["--action", action, "--impact-window", "9-13", "--out", den, "--overwrite"])
    if r.returncode:
        raise RuntimeError("dense falhou (%d): %s" % (r.returncode, (r.stderr or r.stdout)[-400:]))
    dense = json.load(open(os.path.join(den, "dense_report.json"), encoding="utf-8"))
    return check, dense


def build_contract_report(check, contract):
    rules_def = {r["id"]: r for r in contract["rules"]}
    out = []
    for r in check["regras"]:
        d = rules_def.get(r["id"], {})
        st = r["status"]
        if r["type"] == "hand_open_proxy":
            status = "partially_representable" if st == "PASS" else ("failed" if st == "FAIL" else "uncertain")
        elif r["id"] == "m2_sem_frame_unico_de_contato":
            status = "not_applicable"
        elif st == "PASS":
            status = "confirmed"
        elif st == "FAIL":
            status = "failed"
        else:
            status = "uncertain"
        frames = r.get("frames_com_falha") or []
        if not frames and "frames" in d:
            frames = parse_frames(d["frames"])
        out.append({"id": r["id"], "phase": d.get("phase"), "desc": d.get("desc"), "status": status, "tool_status": st,
                    "frames_g": frames, "frames_t": [f + OFFSET for f in frames], "medicao": r["detalhe"], "confianca": r.get("confianca"),
                    "imagem": None, "sugestao": d.get("sugestao") if status in ("failed", "uncertain") else None, "familia": FAMILY.get(r["id"], 5)})
    return out


def render_evidence(blend, action, rules, workdir):
    """imagens: visao geral (front+side), passes de id nos frames criticos, zoom da mao D, grafico denso; devolve caminhos + visibilidade por regiao"""
    base = ["--blend", blend, "--offset", str(OFFSET), "--action", action]
    ev = {}
    key = [0, 3, 4, 8, 9, 12, 13, 17, 22, 26, 27, 30, 35, 40]
    d1 = os.path.join(workdir, "shot_overview")
    r = run([sys.executable, VIS, "shot"] + base + ["--frames", ",".join(map(str, key)), "--views", "front,side_nX,top", "--modes", "solid,sil", "--size", "240", "--cols", "7", "--out", d1, "--overwrite"])
    if r.returncode:
        raise RuntimeError("shot overview falhou: " + (r.stderr or r.stdout)[-300:])
    sheets = [os.path.join(d1, "sheet_front_solid.png"), os.path.join(d1, "sheet_side_nX_solid.png")]
    ov = os.path.join(workdir, "1_visao_geral_front_side.png")
    subprocess.run(["magick"] + sheets + ["-append", ov], check=True)
    ev["visao_geral"] = ov
    ev["silhueta_front"] = os.path.join(d1, "sheet_front_sil.png")
    crit = sorted({f for r_ in rules if r_["status"] in ("failed", "uncertain") for f in r_["frames_g"] if 0 <= f <= 40})
    crit = sorted(set(crit) | {9, 11, 13, 18, 22, 26})
    if len(crit) > 14:       # no maximo 12 frames: os de janela de contato + os mais cedo/tarde das falhas
        crit = sorted(set([9, 11, 13, 18, 22, 26] + crit[:: max(1, len(crit) // 9)]))[:14]
    d2 = os.path.join(workdir, "shot_ids")
    r = run([sys.executable, VIS, "shot"] + base + ["--frames", ",".join(map(str, crit)), "--views", "front,side_nX,top", "--modes", "solid,ids", "--size", "240", "--cols", "6", "--out", d2, "--overwrite"])
    if r.returncode:
        raise RuntimeError("shot ids falhou: " + (r.stderr or r.stdout)[-300:])
    man = json.load(open(os.path.join(d2, "manifest.json"), encoding="utf-8"))
    ids_sheet = os.path.join(workdir, "2_passes_de_id.png")
    subprocess.run(["magick"] + [os.path.join(d2, "sheet_%s_ids.png" % v) for v in ("front", "side_nX", "top")] + ["-append", ids_sheet], check=True)
    ev["ids"] = ids_sheet
    ev["shot_ids_dir"] = d2
    ev["visibilidade"] = man.get("visibilidade_por_regiao", {})
    ev["frames_criticos"] = crit
    d3 = os.path.join(workdir, "shot_mao")
    r = run([sys.executable, VIS, "shot"] + base + ["--frames", "4,8,9,11,13,15", "--views", "front,side_nX", "--modes", "solid", "--zoom", "RightHand", "--zoom-radius", "0.25", "--size", "300", "--cols", "6", "--out", d3, "--overwrite"])
    if r.returncode:
        raise RuntimeError("zoom da mao falhou: " + (r.stderr or r.stdout)[-300:])
    zs = sorted(glob.glob(os.path.join(d3, "sheet_*.png")))
    zoom = os.path.join(workdir, "3_zoom_mao_D.png")
    subprocess.run(["magick"] + zs[:2] + ["-append", zoom], check=True)
    ev["zoom_mao_D"] = zoom
    ev["_shots"] = {"overview": d1, "ids": d2, "mao": d3}
    return ev


def visibility_rules(ev):
    """regras de leitura baseadas nos passes de id: uma regiao 'oculta' na vista nao permite afirmar nada sobre ela"""
    vis = ev["visibilidade"]
    out = []

    def seen(region, g, thr=0.0005, total=240 * 240):
        best = 0
        for v in ("front", "side_nX", "top"):
            k = "%s_g%d" % (v, g)
            if k in vis:
                best = max(best, vis[k]["pixels"].get(region, 0))
        return best / total >= thr, best

    for rid, region, frames, fam_desc, sug in [
        ("v_mao_D_visivel_no_contato", "mao_D", [9, 11, 13], "mao D visivel em pelo menos uma vista (frontal/lateral/superior) na janela de contato", "reposicionar braco/tronco para nao esconder a mao D"),
        ("v_braco_D_legivel", "braco_D", [9, 11, 13], "braco D legivel em pelo menos uma vista na janela de contato", "reposicionar o braco D fora da silhueta do tronco"),
        ("v_braco_D_legivel_mid3", "braco_D", [18, 22, 26], "braco D estendido legivel (nao escondido no tronco) em g18-g26", "afastar o braco D do tronco: mais a frente/para baixo, menos cruzando a barriga"),
    ]:
        res = [(g, *seen(region, g)) for g in frames if ("front_g%d" % g) in vis or ("side_nX_g%d" % g) in vis]
        bad = [g for g, ok, px in res if not ok]
        out.append({"id": rid, "phase": "mid2", "desc": fam_desc, "status": "confirmed" if res and not bad else ("failed" if bad else "uncertain"), "tool_status": "PASS" if res and not bad else "FAIL",
                    "frames_g": bad or frames, "frames_t": [f + OFFSET for f in (bad or frames)], "medicao": "pixels da regiao %s (melhor vista) por frame: %s" % (region, {g: px for g, ok, px in res}),
                    "confianca": "alta (passe de id)", "imagem": None, "sugestao": sug if bad else None, "familia": 3})
    return out


def attach_images(rules, ev, workdir):
    """para cada regra falha/incerta copia a imagem do frame representativo (front/side) para a pasta de evidencias"""
    dest = os.path.join(workdir, "evidencias_por_regra")
    os.makedirs(dest, exist_ok=True)
    d2 = ev["_shots"]["ids"]
    avail = {}
    for p in glob.glob(os.path.join(d2, "*_solid_t*_g*.png")):
        m = re.match(r"(.+)_solid_t(\d+)_g(\d+)\.png", os.path.basename(p))
        if m:
            avail.setdefault(int(m.group(3)), {})[m.group(1)] = p
    for r in rules:
        if r["status"] not in ("failed", "uncertain", "partially_representable"):
            continue
        cand = [f for f in r["frames_g"] if f in avail] or []
        if not cand:
            near = sorted(avail, key=lambda a: min([abs(a - f) for f in r["frames_g"]] or [0]))
            cand = near[:1]
        if cand:
            g = cand[0]
            p = avail[g].get("front") or next(iter(avail[g].values()))
            q = os.path.join(dest, "%s_g%d.png" % (r["id"], g))
            shutil.copy(p, q)
            r["imagem"] = os.path.relpath(q, workdir)


# ------------------------------------------------------------------ comparacao
def compare_rules(prev, new):
    pm = {r["id"]: r for r in prev}
    cmp = []
    for r in new:
        o = pm.get(r["id"])
        if not o:
            cmp.append({"id": r["id"], "resultado": "comparacao inconclusiva", "de": None, "para": r["status"]})
            continue
        a, b = RANK[o["status"]], RANK[r["status"]]
        if r["status"] == o["status"]:
            res = "permaneceu equivalente"
        else:
            res = "melhorou" if b > a else ("piorou" if b < a else "permaneceu equivalente")
        cmp.append({"id": r["id"], "familia": r["familia"], "de": o["status"], "para": r["status"], "resultado": res})
    return cmp


def numeric_metrics(check, dense):
    m = {}
    for r in check["regras"]:
        if r["id"] == "e_sem_salto_final":
            m["ultimo_passo_pose_m"] = r["evidencia"].get("ultimo_passo_m")
        if r["id"] == "x_sem_interpenetracao":
            ev = r.get("evidencia") or {}
            m["interpenetracao_fracao_max"] = max([v.get("fracao_de_vertices_dentro_max", 0) for v in ev.values()] or [0])
            m["interpenetracao_frames_acima_do_limite"] = len({f for v in ev.values() for f in v.get("frames_acima_da_tolerancia", [])})
        if r["id"] == "m3_nao_congelar":
            mm = re.search(r"(\d+)% dos frames", r["detalhe"])
            m["fracao_frames_ativos_g18_g26_pct"] = int(mm.group(1)) if mm else None
    m["fracao_parada_corpo"] = dense["perfil_ritmo"]["corpo"].get("fracao_parada")
    m["pico_mao_D_m_frame"] = dense["trajetorias"]["RightHand"]["pico_vel"]
    m["frames_com_ambos_os_pes_no_ar"] = len(dense.get("frames_com_ambos_os_pes_no_ar", []))
    m["frames_pe_deslizando"] = sum(len(f["frames_deslizando"]) for f in dense["pes"].values())
    return m


def classify_metrics(prev, new):
    better_low = {"frames_pe_deslizando", "ultimo_passo_pose_m", "interpenetracao_fracao_max", "interpenetracao_frames_acima_do_limite", "fracao_parada_corpo", "frames_com_ambos_os_pes_no_ar"}
    out = {}
    for k, v in new.items():
        o = prev.get(k)
        if o is None or v is None:
            out[k] = "comparacao inconclusiva"
            continue
        if abs(v - o) <= 0.05 * max(abs(o), 1e-6):
            out[k] = "permaneceu equivalente"
        else:
            lower = v < o
            out[k] = "melhorou" if lower == (k in better_low) else "piorou"
    return out


def decide(cmp, new_rules, mcmp=None):
    improved = [c for c in cmp if c["resultado"] == "melhorou"]
    worse = [c for c in cmp if c["resultado"] == "piorou"]
    # metricas numericas tambem contam (ex.: interpenetracao menor mesmo que o status da regra continue HIPOTESE)
    for k, v in (mcmp or {}).items():
        if v == "melhorou":
            improved.append({"id": "metrica:" + k, "familia": 8 if "interpen" in k else 5, "resultado": "melhorou"})
        elif v == "piorou" and k != "frames_com_ambos_os_pes_no_ar":
            worse.append({"id": "metrica:" + k, "familia": 8 if "interpen" in k else 5, "resultado": "piorou", "para": "metrica"})
    pass_new = sum(1 for r in new_rules if r["status"] in ("confirmed", "partially_representable", "not_applicable"))
    grave = [c for c in worse if c.get("familia", 5) <= 6 and c["para"] == "failed"]
    best_fam = min([c.get("familia", 5) for c in improved] or [99])
    if grave and min(c["familia"] for c in grave) <= best_fam:
        return "rejeitada", "regressao grave em familia de prioridade igual/maior que a melhoria: " + ", ".join(c["id"] for c in grave)
    if len(worse) > len(improved):
        return "rejeitada", "mais regressoes (%d) que melhorias (%d)" % (len(worse), len(improved))
    if not improved and not worse:
        return "rejeitada", "sem melhoria mensuravel"
    return "aceita", "%d melhorias, %d regressoes (nao graves)" % (len(improved), len(worse))


# ------------------------------------------------------------------ comandos
def load_record(n):
    p = os.path.join(HIST, "v%d.json" % n)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None


def baseline_of(n, workdir):
    """regras/metricas da versao base (registro existente ou medicao do .blend base)"""
    rec = load_record(n)
    if rec:
        return rec["regras"], rec["metricas"]
    contract = json.load(open(CONTRACT, encoding="utf-8-sig"))
    check, dense = measure(blend_of(n), action_of(n), os.path.join(workdir, "base_v%d" % n))
    return build_contract_report(check, contract), numeric_metrics(check, dense)


def cmd_attempt(a):
    os.makedirs(HIST, exist_ok=True)
    base = a.base or best_version()
    new = max(existing_versions() + [1]) + 1
    if not os.path.exists(blend_of(base)):
        die("versao base v%d nao existe" % base)
    dst = blend_of(new)
    if os.path.exists(dst) or os.path.exists(os.path.join(HIST, "v%d.json" % new)):
        die("v%d ja existe: versoes e registros nunca sao sobrescritos" % new)
    fix = os.path.abspath(a.fix)
    if not os.path.exists(fix):
        die("modulo de correcao nao existe: " + fix)
    work = os.path.join(HIST, "v%d_work" % new)
    os.makedirs(work, exist_ok=True)
    before = originals()
    t0 = time.time()
    cfgp = os.path.join(work, "apply_cfg.json")
    json.dump({"src_action": action_of(base), "new_action": action_of(new), "fix": fix, "save_as": dst, "offset": OFFSET, "out": work}, open(cfgp, "w", encoding="utf-8"))
    r = run([BLENDER, "-b", blend_of(base), "--python", os.path.join(HERE, "apply_fix.py"), "--", cfgp], 900)
    log = (r.stdout or "") + (r.stderr or "")
    open(os.path.join(work, "_apply.log"), "w", encoding="utf-8").write(log)
    if "VISION_OK" not in log or not os.path.exists(dst):
        die("a correcao falhou: " + (log.split("VISION_FAIL:")[1].splitlines()[0] if "VISION_FAIL:" in log else log[-500:]), 8)
    after = originals()
    changed = [k for k, v in before.items() if after.get(k) != v]
    if changed:
        die("INTEGRIDADE: originais modificados: %s (tentativa invalida)" % changed, 3)
    contract = json.load(open(CONTRACT, encoding="utf-8-sig"))
    check, dense = measure(dst, action_of(new), work)
    rules = build_contract_report(check, contract)
    ev = render_evidence(dst, action_of(new), rules, work)
    rules += visibility_rules(ev)
    attach_images(rules, ev, work)
    prev_rules, prev_metrics = baseline_of(base, work)
    # regras/metricas novas desde que o registro base foi gravado: mede a base de novo so para o que falta (comparacao justa)
    if (set(r_["id"] for r_ in rules if r_["id"].startswith(("e_", "m", "s_", "g_", "x_")) and not r_["id"].startswith("v_")) - set(r_["id"] for r_ in prev_rules)) or (set(metrics := numeric_metrics(check, dense)) - set(prev_metrics)):
        chk_b, den_b = measure(blend_of(base), action_of(base), os.path.join(work, "rebase_v%d" % base))
        extra_rules = build_contract_report(chk_b, contract)
        have = {r_["id"] for r_ in prev_rules}
        prev_rules = prev_rules + [r_ for r_ in extra_rules if r_["id"] not in have]
        mb = numeric_metrics(chk_b, den_b)
        for k_, v_ in mb.items():
            prev_metrics.setdefault(k_, v_)
    cmp = compare_rules(prev_rules, rules)
    metrics = numeric_metrics(check, dense)
    mcmp = classify_metrics(prev_metrics, metrics)
    decision, why = decide(cmp, rules, mcmp)
    fixlog = json.load(open(os.path.join(work, "fix_log.json"), encoding="utf-8"))
    final_dir = os.path.join(HIST, "v%d" % new)
    os.makedirs(final_dir)
    imgs = {}
    for k in ("visao_geral", "ids", "zoom_mao_D", "silhueta_front"):
        if ev.get(k) and os.path.exists(ev[k]):
            q = os.path.join(final_dir, os.path.basename(ev[k]) if k != "silhueta_front" else "4_silhueta_front.png")
            shutil.copy(ev[k], q)
            imgs[k] = os.path.relpath(q, HIST)
    g = os.path.join(work, "dense", "dense_graph.png")
    if os.path.exists(g):
        shutil.copy(g, os.path.join(final_dir, "5_grafico_denso.png"))
        imgs["grafico"] = "v%d/5_grafico_denso.png" % new
    evid = os.path.join(work, "evidencias_por_regra")
    if os.path.isdir(evid):
        shutil.copytree(evid, os.path.join(final_dir, "evidencias_por_regra"))
    for r_ in rules:
        if r_["imagem"]:
            r_["imagem"] = "v%d/%s" % (new, r_["imagem"].replace("\\", "/"))
    record = {"versao": new, "base": base, "arquivo": os.path.basename(dst), "sha256": sha(dst), "action": action_of(new), "intervalo_t": [1, 41], "fps": 30,
              "data": time.strftime("%Y-%m-%d %H:%M:%S"), "ferramentas_sha12": tools_version(), "mudancas_aplicadas": fixlog["description"], "log_da_correcao": fixlog["log"],
              "regras": rules, "contagem": {s: sum(1 for r_ in rules if r_["status"] == s) for s in ("confirmed", "failed", "uncertain", "partially_representable", "not_representable", "not_applicable")},
              "frames_suspeitos_g": sorted({f for r_ in rules if r_["status"] == "failed" for f in r_["frames_g"]}), "metricas": metrics, "metricas_vs_anterior": mcmp,
              "comparacao_com_anterior": cmp, "imagens": imgs, "resultado": decision, "motivo": why, "originais_sha256_antes_depois_iguais": True,
              "duracao_s": round(time.time() - t0)}
    rp = os.path.join(HIST, "v%d.json" % new)
    json.dump(record, open(rp, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    os.chmod(rp, stat.S_IREAD)       # registro imutavel
    if decision == "aceita":
        json.dump({"version": new}, open(os.path.join(HIST, "best.json"), "w"))
    shutil.rmtree(work, ignore_errors=True) if not a.keep_work else None
    build_index()
    summary(record)


def build_index():
    """chars/vigor/tackle_history/index.html: tabela de versoes, matriz regra x versao (cores) e links para imagens; tudo local e relativo"""
    recs = []
    for p in sorted(glob.glob(os.path.join(HIST, "v*.json")), key=lambda s: int(re.search(r"v(\d+)\.json$", s).group(1)) if re.search(r"v(\d+)\.json$", s) else 0):
        if p.endswith(".review.json"):
            continue
        recs.append(json.load(open(p, encoding="utf-8")))
    ids = []
    for r in recs:
        for x in r["regras"]:
            if x["id"] not in ids:
                ids.append(x["id"])
    color = {"confirmed": "#2e9e4f", "partially_representable": "#8bc34a", "not_applicable": "#9aa", "uncertain": "#e0a800", "failed": "#d33", "not_representable": "#888"}
    rows = []
    for r in recs:
        c = r["contagem"]
        imgs = " ".join('<a href="%s">%s</a>' % (v, k) for k, v in r["imagens"].items())
        rows.append("<tr class=\"vrow\" data-v=\"%d\"><td>v%d</td><td>%s</td><td>%s</td><td>%d / %d / %d</td><td>%s</td><td>%s</td></tr>" % (
            r["versao"], r["versao"], r["resultado"], r["motivo"], c["confirmed"], c["failed"], c["uncertain"], r["mudancas_aplicadas"][:140], imgs))
    head = "".join("<th>v%d</th>" % r["versao"] for r in recs)
    mat = []
    for i in ids:
        cells = ""
        for r in recs:
            st = next((x["status"] for x in r["regras"] if x["id"] == i), None)
            cells += '<td style="background:%s;color:#fff" title="%s">%s</td>' % (color.get(st, "#eee"), st, (st or "-")[:1].upper())
        mat.append("<tr data-r=\"%s\"><th>%s</th>%s</tr>" % (i, i, cells))
    doc = """<!doctype html><meta charset="utf-8"><title>Tackle - historico</title><style>body{font:14px system-ui;margin:16px;background:#fff;color:#111}table{border-collapse:collapse;margin:12px 0}td,th{border:1px solid #bbb;padding:3px 6px;font-size:13px}th{background:#f2f2f2;text-align:left}a{color:#0645ad;margin-right:6px}input{margin:6px 0;padding:4px}</style>
<h2>Tackle do Vigoroth: historico de tentativas</h2><p>Registros imutaveis em <code>tackle_history/vNN.json</code>. C=confirmed, F=failed, U=uncertain, P=partially_representable, N=not_applicable.</p>
<h3>Versoes</h3><table><tr><th>versao</th><th>resultado</th><th>motivo</th><th>confirmed / failed / uncertain</th><th>mudanca</th><th>imagens</th></tr>%s</table>
<h3>Regras x versoes</h3><input id="q" placeholder="filtrar regra (ex.: m2_)"><table id="mat"><tr><th>regra</th>%s</tr>%s</table>
<script>document.getElementById('q').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('#mat tr[data-r]').forEach(t=>t.style.display=t.dataset.r.toLowerCase().includes(q)?'':'none')}</script>""" % ("".join(rows), head, "".join(mat))
    open(os.path.join(HIST, "index.html"), "w", encoding="utf-8").write(doc)
    return os.path.join(HIST, "index.html")


def summary(rec):
    print("== TACKLE v%d vs v%d: %s (%s)" % (rec["versao"], rec["base"], rec["resultado"].upper(), rec["motivo"]))
    print("mudanca: %s" % rec["mudancas_aplicadas"])
    c = rec["contagem"]
    print("contrato: confirmed %d | failed %d | uncertain %d | partially %d" % (c["confirmed"], c["failed"], c["uncertain"], c["partially_representable"]))
    imp = [x["id"] for x in rec["comparacao_com_anterior"] if x["resultado"] == "melhorou"]
    wor = [x["id"] for x in rec["comparacao_com_anterior"] if x["resultado"] == "piorou"]
    print("melhorou: %s\npiorou: %s" % (imp or "-", wor or "-"))
    fails = sorted([r for r in rec["regras"] if r["status"] == "failed"], key=lambda r: r["familia"])
    for r in fails[:8]:
        print("  FALHA f%d %s g%s: %s" % (r["familia"], r["id"], r["frames_g"][:6], r["medicao"][:110]))
    if fails:
        print("proxima correcao sugerida: %s -> %s" % (fails[0]["id"], fails[0]["sugestao"]))
    print("metricas:", rec["metricas_vs_anterior"])
    print("imagens (principais):", [rec["imagens"].get(k) for k in ("visao_geral", "ids", "grafico") if rec["imagens"].get(k)])


def cmd_status(a):
    print("versoes .blend:", existing_versions(), "| melhor:", best_version())
    for n in existing_versions():
        r = load_record(n)
        if r:
            print("  v%d: %s | %s" % (n, r["resultado"], r["contagem"]))


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    at = sub.add_parser("attempt")
    at.add_argument("--fix", required=True)
    at.add_argument("--base", type=int)
    at.add_argument("--keep-work", action="store_true", dest="keep_work")
    at.set_defaults(fn=cmd_attempt)
    ix = sub.add_parser("index")
    ix.set_defaults(fn=lambda a: print(build_index()))
    st = sub.add_parser("status")
    st.set_defaults(fn=cmd_status)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
