#!/usr/bin/env python
"""Percepcao ativa, compreensao do movimento e protocolo de diagnostico do Animation Witness.

  python scripts/blender-vision/perception.py investigate --blend A.blend --action X --frames 1-54:6 --regions tronco_quadril,mao_D --out DIR
  python scripts/blender-vision/perception.py motion      --blend A.blend --action X --frames 1-54 --out DIR [--stroke-bone RightHand]
  python scripts/blender-vision/perception.py contacts    --blend A.blend --action X --frames 1-54:3 --pairs arm_R:torso --out DIR
  python scripts/blender-vision/perception.py diagnose-template DIR > diagnostico.json
  python scripts/blender-vision/perception.py validate-diagnosis DIR diagnostico.json
  python scripts/blender-vision/perception.py reference add|list|compare ...

Garantias herdadas do blender-vision: o .blend nunca e gravado (SHA-256 antes/depois; mudou = erro 3), saida atomica, timeouts.
Aqui o sistema NAO afirma que viu: ele produz imagens + metricas de visibilidade, e so deixa um diagnostico citar uma regiao que
foi de fato observada (>= 2 vistas independentes, sem corte de quadro). A leitura das imagens e feita pelo agente com a ferramenta
Read; cada folha traz um codigo de leitura que o diagnostico precisa citar (prova de que a folha foi aberta, nao de que foi entendida).
"""
import argparse
import hashlib
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import perception_geom as G  # noqa: E402


def _jl(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _jd(obj, path):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=1, ensure_ascii=False)

BLENDER = os.environ.get("BLENDER_EXE", r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe")
T_BLENDER = int(os.environ.get("VISION_TIMEOUT_BLENDER", "900"))
MARK = ".perception_output"


class PErr(SystemExit):
    pass


def die(msg, code=2):
    print("ERRO: " + msg, file=sys.stderr)
    raise PErr(code)


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for ch in iter(lambda: f.read(1 << 20), b""):
            h.update(ch)
    return h.hexdigest()


def parse_frames(spec):
    out = []
    for part in str(spec).split(","):
        part = part.strip()
        if not part:
            continue
        step = 1
        if ":" in part:
            part, st = part.split(":")
            step = int(st)
        if "-" in part[1:]:
            a, b = part.split("-", 1) if not part.startswith("-") else (part, part)
            out += list(range(int(a), int(b) + 1, step))
        else:
            out.append(int(part))
    out = sorted(set(out))
    if not out:
        die("--frames vazio")
    return out


# ------------------------------------------------------------------ execucao no Blender (integridade, timeout, falha explicita)
class Runner:
    def __init__(self, blend, action, offset=0, armature=None, floor_z=0.0, work=None):
        if not os.path.isfile(blend):
            die("blend nao existe: " + blend)
        self.blend, self.action, self.offset, self.armature, self.floor_z = os.path.abspath(blend), action, offset, armature, floor_z
        self.work = work
        self.hash0 = sha(self.blend)
        self.calls = 0

    def run(self, ops, subdir):
        self.calls += 1
        out = os.path.join(self.work, subdir)
        os.makedirs(out, exist_ok=True)
        cfg = {"out": out, "action": self.action, "offset": self.offset, "armature": self.armature, "floor_z": self.floor_z, "ops": ops}
        cp = os.path.join(out, "_config.json")
        with open(cp, "w", encoding="utf-8") as f:
            json.dump(cfg, f)
        cmd = [BLENDER, "-b", "--factory-startup", self.blend, "--python", os.path.join(HERE, "perception_inside.py"), "--", cp]
        try:
            p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=T_BLENDER)
        except subprocess.TimeoutExpired:
            die("o Blender excedeu %ds e foi encerrado" % T_BLENDER, 4)
        with open(os.path.join(out, "_blender.log"), "w", encoding="utf-8") as f:
            f.write(p.stdout + "\n--- stderr ---\n" + p.stderr)
        if sha(self.blend) != self.hash0:
            with open(os.path.join(self.work, "INTEGRITY_FAILURE.json"), "w") as f:
                json.dump({"blend": self.blend, "antes": self.hash0, "depois": sha(self.blend)}, f)
            die("INTEGRIDADE: o .blend mudou durante a execucao", 3)
        rp = os.path.join(out, "perception_result.json")
        if p.returncode != 0 or "PERCEPTION_OK" not in p.stdout or not os.path.isfile(rp):
            fl = [l for l in p.stdout.splitlines() if "PERCEPTION_FAIL" in l]
            err = [l for l in p.stderr.splitlines() if l.strip()]
            detail = fl[-1] if fl else (err[-1] if err else "sem detalhe (o Blender terminou sem PERCEPTION_OK)")
            die("falha dentro do Blender: %s (log: %s)" % (detail, os.path.join(out, "_blender.log")), 6)
        return _jl(rp)["results"], out


class Workdir:
    """pasta de saida atomica: grava em .tmp-PID e so renomeia no sucesso; falha vira .FAILED-hora"""

    def __init__(self, out, overwrite):
        self.final = os.path.abspath(out)
        if os.path.exists(self.final):
            if not overwrite:
                die("a pasta de saida ja existe (use --overwrite): " + self.final)
            if not os.path.isfile(os.path.join(self.final, MARK)):
                die("recuso apagar uma pasta que nao foi criada por esta ferramenta: " + self.final)
            shutil.rmtree(self.final)
        self.tmp = self.final + ".tmp-%d" % os.getpid()
        os.makedirs(self.tmp)
        open(os.path.join(self.tmp, MARK), "w").write("saida do perception.py\n")

    def commit(self):
        os.replace(self.tmp, self.final)

    def fail(self):
        dest = self.final + ".FAILED-" + time.strftime("%H%M%S")
        try:
            os.replace(self.tmp, dest)
        except OSError:
            pass


# ------------------------------------------------------------------ imagens (PIL so no lado do sistema, nunca dentro do Blender)
def _font(size):
    from PIL import ImageFont
    for f in ("arial.ttf", "DejaVuSans.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    return ImageFont.load_default()


def stamp_token(img, salt):
    """codigo de leitura visivel na barra de titulo: derivado do conteudo da folha + sal do bundle"""
    from PIL import ImageDraw
    h = hashlib.sha256(salt.encode() + img.tobytes()).hexdigest()[:5].upper()
    d = ImageDraw.Draw(img)
    d.rectangle([img.width - 190, 0, img.width, 34], fill=(255, 235, 120))
    d.text((img.width - 182, 3), "LEITURA " + h, fill=(0, 0, 0), font=_font(24))
    return h


def make_sheet(tiles, title, path, salt, cols=6, tile=None):
    """tiles: [(PIL.Image, legenda)] -> folha com titulo, legenda por tile e codigo de leitura"""
    from PIL import Image, ImageDraw
    tile = tile or tiles[0][0].width
    cols = min(cols, len(tiles))
    rows = (len(tiles) + cols - 1) // cols
    cap = 26
    W, H = cols * tile, 40 + rows * (tile + cap)
    sheet = Image.new("RGB", (W, H), (20, 21, 24))
    d = ImageDraw.Draw(sheet)
    d.text((8, 6), title, fill=(235, 235, 235), font=_font(22))
    for i, (im, label) in enumerate(tiles):
        x, y = (i % cols) * tile, 40 + (i // cols) * (tile + cap)
        sheet.paste(im.resize((tile, tile)) if im.width != tile else im, (x, y))
        d.text((x + 6, y + tile + 3), label, fill=(235, 235, 235), font=_font(18))
    tok = stamp_token(sheet, salt)
    sheet.save(path)
    return tok


def pass_tiles(npz_path, label):
    """depth (claro = perto), normais (RGB do vetor) e ids (cor por rotulo) como tres tiles"""
    import numpy as np
    from PIL import Image
    z = np.load(npz_path)
    depth, nrm, ids = z["depth"], z["normal"], z["ids"]
    ok = ~np.isnan(depth)
    dn = np.zeros_like(depth)
    if ok.any():
        lo, hi = float(depth[ok].min()), float(depth[ok].max())
        dn[ok] = 1.0 - (depth[ok] - lo) / max(hi - lo, 1e-6)
    d_img = Image.fromarray((np.stack([dn] * 3, -1) * 255).astype("uint8"))
    n_img = Image.fromarray(((nrm * 0.5 + 0.5) * 255).clip(0, 255).astype("uint8"))
    pal = {i: c for i, c in enumerate([(160, 160, 165), (240, 200, 60), (90, 160, 255), (255, 110, 90), (60, 200, 120), (255, 140, 30), (170, 110, 255), (120, 220, 220), (255, 120, 200), (150, 200, 80)])}
    ii = np.zeros(ids.shape + (3,), dtype="uint8") + 24
    for k, c in pal.items():
        ii[ids == k] = c
    ii[ids == 254] = (100, 100, 100)
    ii[ids == 253] = (60, 60, 70)   # chao (oclusor)
    return [(d_img.resize((200, 200), Image.NEAREST), "prof " + label), (n_img.resize((200, 200), Image.NEAREST), "normal " + label), (Image.fromarray(ii).resize((200, 200), Image.NEAREST), "ids " + label)]


# ------------------------------------------------------------------ investigate
def cmd_investigate(a):
    from PIL import Image
    frames = parse_frames(a.frames)
    regions = [r.strip() for r in a.regions.split(",") if r.strip()]
    for r in regions:
        if r not in G.QUERY_REGIONS:
            die("regiao '%s' desconhecida. Validas: %s" % (r, ", ".join(G.QUERY_REGIONS)))
    wd = Workdir(a.out, a.overwrite)
    try:
        R = Runner(a.blend, a.action, a.offset, a.armature, a.floor_z, wd.tmp)
        salt = secrets.token_hex(8)
        info, _ = R.run([{"op": "info", "frames": frames}], "info")
        info = info[0]
        report = {"schema": "arenamon.perception.investigation/1", "blend": R.blend, "blend_sha256": R.hash0, "action": a.action, "offset": a.offset,
                  "frames": frames, "params": {"min_visible": a.min_visible, "max_clipped": a.max_clipped, "max_rounds": a.max_rounds, "min_independent_deg": G.MIN_INDEPENDENT_ANGLE_DEG},
                  "rig": {"bones": len(info["bones"]), "label_vertex_counts": info["label_vertex_counts"]}, "regions": {}, "sheets": []}
        initial_names = [s for s in a.initial_views.split(",") if s]
        cand_names = set(info["candidates"])
        for n in initial_names:
            if n not in cand_names:
                die("vista inicial '%s' desconhecida. Candidatas: %s" % (n, ", ".join(sorted(cand_names))))
        raw_dir = os.path.join(wd.tmp, "raw")
        os.makedirs(raw_dir, exist_ok=True)
        sheets_dir = os.path.join(wd.tmp, "sheets")
        os.makedirs(sheets_dir, exist_ok=True)
        for region in regions:
            seq = {"n": 0}

            def observe(views, region=region, seq=seq):
                seq["n"] += 1
                res, out = R.run([{"op": "observe", "region": region, "frames": frames, "views": [v["name"] for v in views], "size": a.size}], "obs_%s_%d" % (region, seq["n"]))
                for v in res[0]["views"]:
                    for im in v["images"]:
                        for k in ("rgb", "passes"):
                            if k in im:
                                src = os.path.join(out, im[k])
                                if not os.path.isfile(src) or os.path.getsize(src) == 0:
                                    die("render falhou: arquivo ausente ou vazio (%s) na vista %s, frame %s; nenhuma conclusao pode usar esta vista" % (im[k], v["name"], im["frame"]), 6)
                                shutil.move(src, os.path.join(raw_dir, im[k]))
                return res[0]["views"]

            def probe(region=region):
                res, _ = R.run([{"op": "probe", "region": region, "frames": frames}], "probe_%s" % region)
                return res[0]["views"]

            initial = [{"name": n} for n in initial_names]
            r = G.investigate(initial, frames, probe, observe, a.min_visible, a.max_clipped, a.max_rounds)
            for v in r["views"]:
                tiles = [(Image.open(os.path.join(raw_dir, im["rgb"])).convert("RGB"), "g%d" % im["frame"]) for im in v["images"]]
                sp = os.path.join(sheets_dir, "folha_%s_%s.png" % (region, v["name"]))
                tok = make_sheet(tiles, "%s | vista %s | %s | regiao laranja" % (a.action, v["name"], region), sp, salt, cols=a.cols, tile=tiles[0][0].width)
                pt = []
                for im in v["images"]:
                    if "passes" in im:
                        pt += pass_tiles(os.path.join(raw_dir, im["passes"]), "g%d" % im["frame"])[:3]
                pp = None
                if pt:
                    pp = os.path.join(sheets_dir, "passes_%s_%s.png" % (region, v["name"]))
                    ptok = make_sheet(pt, "passes geometricos (profundidade | normais | ids) | %s | %s" % (region, v["name"]), pp, salt, cols=6, tile=200)
                    report["sheets"].append({"file": "sheets/" + os.path.basename(pp), "kind": "passes", "region": region, "view": v["name"], "token": ptok, "frames": frames,
                                             "sha256": sha(pp)})
                report["sheets"].append({"file": "sheets/" + os.path.basename(sp), "kind": "rgb", "region": region, "view": v["name"], "token": tok, "frames": frames,
                                         "direction": v["direction"], "visible_min": v["visible_min"], "visible_mean": v["visible_mean"], "clipped_max": v["clipped_max"], "per_frame": v["per_frame"],
                                         "occluded_by": v["occluded_by"], "frames_without_enough_facing_points": v["frames_without_enough_facing_points"],
                                         "sha256": sha(sp)})
                v.pop("images", None)
            report["regions"][region] = {"labels": list(G.QUERY_REGIONS[region]), "final": r["final"], "stop_reason": r["stop_reason"], "rounds": r["rounds"], "views": r["views"]}
        report["limites"] = [
            "visibilidade = pontos da malha deformada voltados para a camera cujo raio nao e bloqueado; nao e percepcao humana",
            "ids por pixel usam o rotulo dominante de pesos por triangulo; fronteiras entre regioes sao aproximadas",
            "OBSERVADO_SUFICIENTE diz que a regiao esta ao alcance de 2+ vistas independentes; NAO diz que a pose esta correta",
            "o codigo de leitura prova que a folha foi aberta, nao que foi compreendida",
        ]
        with open(os.path.join(wd.tmp, "investigation.json"), "w", encoding="utf-8") as f:
            json.dump(report, f, indent=1, ensure_ascii=False)
        with open(os.path.join(wd.tmp, "evidence_index.json"), "w", encoding="utf-8") as f:
            json.dump({"salt_sha256": hashlib.sha256(salt.encode()).hexdigest(), "sheets": report["sheets"], "frames": frames, "action": a.action, "params": report["params"]}, f, indent=1)
        if sha(R.blend) != R.hash0:
            die("INTEGRIDADE: o .blend mudou", 3)
        wd.commit()
    except BaseException:
        wd.fail()
        raise
    print(json.dumps({"out": wd.final, "regioes": {r: {"status": v["final"]["status"], "frames_ok": v["final"]["frames_ok"], "frames_1_vista": v["final"]["frames_one_view"], "frames_sem_vista": v["final"]["frames_not_observed"], "parou": v["stop_reason"]} for r, v in report["regions"].items()},
                      "folhas": len(report["sheets"]), "chamadas_blender": R.calls}, ensure_ascii=False, indent=1))


# ------------------------------------------------------------------ motion
def cmd_motion(a):
    import perception_motion as M
    frames = parse_frames(a.frames)
    wd = Workdir(a.out, a.overwrite)
    try:
        R = Runner(a.blend, a.action, a.offset, a.armature, a.floor_z, wd.tmp)
        res, _ = R.run([{"op": "pose", "frames": frames}], "pose")
        pose = res[0]
        with open(os.path.join(wd.tmp, "pose_track.json"), "w", encoding="utf-8") as f:
            json.dump(pose, f)
        declared = _jl(a.declared) if a.declared else None
        window = tuple(int(x) for x in a.window.split("-")) if a.window else None
        rep = M.analyze(pose, a.stroke_bone, a.side, declared, window, None, a.stroke_frame)
        rep.update({"schema": "arenamon.perception.motion/1", "blend": R.blend, "blend_sha256": R.hash0, "action": a.action, "offset": a.offset,
                    "limiares": {k: v for k, v in M.DEFAULTS.items()}, "aviso": "medidas e hipoteses; nenhuma frase aqui certifica qualidade artistica"})
        with open(os.path.join(wd.tmp, "motion_report.json"), "w", encoding="utf-8") as f:
            json.dump(rep, f, indent=1, ensure_ascii=False)
        import perception_principles as P
        with open(os.path.join(wd.tmp, "questions.json"), "w", encoding="utf-8") as f:
            json.dump(P.build_questions(rep, pose.get("key_frames"), float(pose.get("fps", 30))), f, indent=1, ensure_ascii=False)
        if sha(R.blend) != R.hash0:
            die("INTEGRIDADE: o .blend mudou", 3)
        wd.commit()
    except BaseException:
        wd.fail()
        raise
    print(json.dumps({"out": wd.final, "efetuador": rep["efetuador"], "fases": [(p["fase"], p["frames"]) for p in rep["fases"]["fases"]],
                      "antecipacao": rep["antecipacao"].get("presente"), "ordem": rep["sequencia_do_corpo"]["ordem"]}, ensure_ascii=False, indent=1))


# ------------------------------------------------------------------ contacts
def cmd_contacts(a):
    frames = parse_frames(a.frames)
    pairs = [p.split(":") for p in a.pairs.split(",") if p]
    import perception_geom as GG
    for x in pairs:
        if len(x) != 2 or any(l not in GG.LABELS for l in x):
            die("par invalido %s; rotulos validos: %s" % (x, ", ".join(GG.LABELS)))
    wd = Workdir(a.out, a.overwrite)
    try:
        R = Runner(a.blend, a.action, a.offset, a.armature, a.floor_z, wd.tmp)
        res, _ = R.run([{"op": "contacts", "frames": frames, "pairs": pairs}], "contacts")
        rep = {"schema": "arenamon.perception.contacts/1", "blend_sha256": R.hash0, "action": a.action, "frames": frames, "pairs": a.pairs, **res[0]}
        base = None
        if a.baseline_action:
            R2 = Runner(a.blend, a.baseline_action, a.offset, a.armature, a.floor_z, wd.tmp)
            bres, _ = R2.run([{"op": "contacts", "frames": [a.baseline_frame], "pairs": pairs}], "contacts_base")
            base = {pr: v for pr, v in bres[0]["rows"][0]["pairs"].items()}
            rep["baseline"] = {"action": a.baseline_action, "frame": a.baseline_frame, "pairs": base}
        rep["classificacao"] = classify_contacts(rep["rows"], a.inside_frac, base)
        with open(os.path.join(wd.tmp, "contacts.json"), "w", encoding="utf-8") as f:
            json.dump(rep, f, indent=1, ensure_ascii=False)
        if sha(R.blend) != R.hash0:
            die("INTEGRIDADE: o .blend mudou", 3)
        wd.commit()
    except BaseException:
        wd.fail()
        raise
    print(json.dumps({"out": wd.final, "classificacao": rep["classificacao"]}, ensure_ascii=False, indent=1))


def classify_contacts(rows, inside_frac, base=None, deep_m=0.03):
    """ATRAVESSAMENTO_PROVAVEL quando o cercamento por raios passa do limite (confianca alta se a normal assinada concorda); a normal assinada sozinha NUNCA basta (INCONCLUSIVO);
    um so = INCONCLUSIVO; nenhum = SEM_INDICIO (ausencia de indicio, nao prova de ausencia; com malha vizinha aberta, SEM_INDICIO_MALHA_ABERTA). Sempre HIPOTESE ate confirmar em imagem onde a interseccao e visivel."""
    out = {}
    for row in rows:
        for pr, v in row["pairs"].items():
            if "erro" in v:
                out.setdefault(pr, {})[row["frame"]] = {"classe": "INCONCLUSIVO", "motivo": v["erro"]}
                continue
            bn = (base or {}).get(pr, {}).get("inside_normal_frac", 0.0)
            bp = (base or {}).get(pr, {}).get("inside_enclosed_frac", 0.0)
            bd = (base or {}).get(pr, {}).get("max_inside_depth_m", 0.0)
            n, p = v["inside_normal_frac"] - bn >= inside_frac, v["inside_enclosed_frac"] - bp >= inside_frac
            if n and p:
                cl, conf = "ATRAVESSAMENTO_PROVAVEL", "confianca alta: normal assinada e cercamento por raios concordam"
            elif p:
                cl, conf = "ATRAVESSAMENTO_PROVAVEL", "confianca media: cercado em todas as direcoes pela malha vizinha; a normal assinada nao confirmou (normais invertidas ou faces internas)"
            elif n:
                cl, conf = "INCONCLUSIVO", "so a normal assinada passou do limite: ela nao e confiavel em malha vizinha aberta/nao orientada nem em costuras de articulacao"
            else:
                cl, conf = "SEM_INDICIO", "nenhum teste passou do limite"
            if cl == "SEM_INDICIO" and v.get("malha_vizinha_arestas_abertas", 0) > 0:
                cl = "SEM_INDICIO_MALHA_ABERTA"  # o cercamento por raios nao e confiavel em malha aberta: ausencia de indicio nao exclui atravessamento
            out.setdefault(pr, {})[row["frame"]] = {"classe": cl, "criterio": conf, "profundidade_max_m": v["max_inside_depth_m"], "inside_normal": v["inside_normal_frac"], "inside_enclosed": v["inside_enclosed_frac"], "arestas_abertas": v.get("malha_vizinha_arestas_abertas"), "excesso_sobre_baseline": None if base is None else [round(v["inside_normal_frac"] - bn, 4), round(v["inside_enclosed_frac"] - bp, 4)], "distancia_min_m": v["min_distance_m"]}
    return out


# ------------------------------------------------------------------ diagnostico
def cmd_diag_template(a):
    import perception_diagnosis as D
    b = D.load_bundle(a.investigation, None, None)
    qs = _jl(os.path.join(a.questions, "questions.json"))
    print(json.dumps(D.template(qs, b), indent=1, ensure_ascii=False))


def cmd_validate(a):
    import perception_diagnosis as D
    import perception_refs as RF
    b = D.load_bundle(a.investigation, a.motion, a.contacts)
    diag = _jl(a.diagnosis)
    res = D.validate(diag, b, a.refs_dir or RF.DEFAULT_DIR)
    print(json.dumps(res, indent=1, ensure_ascii=False))
    if res["status"] != "ACEITO":
        raise PErr(7)


def cmd_reference(a):
    import perception_refs as RF
    rd = a.refs_dir or RF.DEFAULT_DIR
    try:
        if a.action == "list":
            print(json.dumps(RF.list_refs(rd), indent=1, ensure_ascii=False))
        elif a.action == "add":
            feats = None
            if a.from_motion:
                feats = RF.features_from_motion(_jl(os.path.join(a.from_motion, "motion_report.json")))
            r = RF.add(a.id, a.name or a.id, a.kind, a.origin, [x for x in (a.scope or "").split(",") if x], a.approved_by, feats,
                       [x for x in (a.rejected_aspects or "").split(",") if x], a.justification or "", None, rd, a.fixture)
            print(json.dumps({k: r[k] for k in ("id", "approved", "approved_by", "scope", "rejected_aspects")}, ensure_ascii=False))
        elif a.action == "compare":
            ref = RF.load(a.id, rd)
            m = _jl(os.path.join(a.motion, "motion_report.json"))
            print(json.dumps(RF.compare(ref, m), indent=1, ensure_ascii=False))
    except RF.RefError as e:
        die(str(e))


def calibrate_floor(a):
    """chao calibrado por uma action de referencia (ex.: idle em pe): menor altura da malha dos pes em todos os frames.
    Evita assumir que o chao do jogo e z=0 do arquivo: a malha pode ter folga propria na sola."""
    with tempfile.TemporaryDirectory(prefix="perc-floor-") as tmp:
        R = Runner(a.blend, a.floor_from_action, a.offset, a.armature, 0.0, tmp)
        info, _ = R.run([{"op": "info", "frames": [1]}], "i")
        fr = list(range(int(info[0]["frame_range_action"][0]), int(info[0]["frame_range_action"][1]) + 1, 3))
        pose, _ = R.run([{"op": "pose", "frames": fr}], "p")
        zs = [z for lab in ("foot_L", "foot_R") for z in pose[0]["label_min_z"][lab] if z is not None]
        if not zs:
            die("nao foi possivel calibrar o chao: action '%s' sem geometria nos pes" % a.floor_from_action)
        return round(min(zs), 5)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p):
        p.add_argument("--blend", required=True)
        p.add_argument("--action", required=True)
        p.add_argument("--offset", type=int, default=0)
        p.add_argument("--armature")
        p.add_argument("--floor-z", type=float, default=0.0)
        p.add_argument("--floor-from-action", help="calibra o chao pela menor altura dos pes nesta action (ex.: idle); sobrepoe --floor-z")
        p.add_argument("--frames", required=True)
        p.add_argument("--out", required=True)
        p.add_argument("--overwrite", action="store_true")

    p = sub.add_parser("investigate")
    common(p)
    p.add_argument("--regions", required=True)
    p.add_argument("--initial-views", default="frente_e12,lado_D_e12")
    p.add_argument("--min-visible", type=float, default=0.6)
    p.add_argument("--max-clipped", type=float, default=0.02)
    p.add_argument("--max-rounds", type=int, default=3)
    p.add_argument("--size", type=int, default=300)
    p.add_argument("--cols", type=int, default=6)
    p.set_defaults(fn=cmd_investigate)
    p = sub.add_parser("motion")
    common(p)
    p.add_argument("--stroke-bone")
    p.add_argument("--side", default="Right")
    p.add_argument("--stroke-frame", choices=["hips", "world"], default="hips", help="referencial da trajetoria do efetuador")
    p.add_argument("--declared", help="JSON com janelas de deformacao intencional documentadas: [{bones, frames:[a,b], kind}]")
    p.add_argument("--window", help="janela autoral a-b para o sequenciamento do corpo")
    p.set_defaults(fn=cmd_motion)

    p = sub.add_parser("contacts")
    common(p)
    p.add_argument("--pairs", required=True, help="pares rotulo:rotulo, ex.: arm_R:torso,hand_R:torso")
    p.add_argument("--inside-frac", type=float, default=0.15, help="fracao de vertices dentro (nos DOIS testes) para ATRAVESSAMENTO_PROVAVEL")
    p.add_argument("--baseline-action", help="action de referencia (ex.: idle) cujo valor e descontado: costura ombro/tronco ja mostra 'dentro' em repouso")
    p.add_argument("--baseline-frame", type=int, default=1)
    p.set_defaults(fn=cmd_contacts)

    p = sub.add_parser("diagnose-template", help="esqueleto A-G a partir de questions.json (pasta do motion) e do bundle de investigate")
    p.add_argument("--investigation", required=True)
    p.add_argument("--questions", required=True, help="pasta do comando motion (contem questions.json)")
    p.set_defaults(fn=cmd_diag_template)

    p = sub.add_parser("validate-diagnosis")
    p.add_argument("--investigation", required=True)
    p.add_argument("--motion")
    p.add_argument("--contacts")
    p.add_argument("--refs-dir")
    p.add_argument("diagnosis")
    p.set_defaults(fn=cmd_validate)

    p = sub.add_parser("reference")
    p.add_argument("action", choices=["add", "list", "compare"])
    p.add_argument("--id")
    p.add_argument("--name")
    p.add_argument("--kind", default="approved_example")
    p.add_argument("--origin", default="")
    p.add_argument("--scope", help="aspectos aprovados, separados por virgula")
    p.add_argument("--rejected-aspects")
    p.add_argument("--justification")
    p.add_argument("--approved-by", help="pessoa que aprovou (obrigatorio para approved=true)")
    p.add_argument("--from-motion", help="pasta do comando motion de onde extrair features")
    p.add_argument("--motion", help="pasta do comando motion a comparar")
    p.add_argument("--fixture", action="store_true", help="marca fixture de teste (nunca e referencia real)")
    p.add_argument("--refs-dir")
    p.set_defaults(fn=cmd_reference)
    a = ap.parse_args()
    if getattr(a, "floor_from_action", None):
        a.floor_z = calibrate_floor(a)
        print("chao calibrado por '%s': z=%.5f" % (a.floor_from_action, a.floor_z), file=sys.stderr)
    a.fn(a)


if __name__ == "__main__":
    main()
