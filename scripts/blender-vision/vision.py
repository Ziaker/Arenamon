#!/usr/bin/env python
"""Visao do Blender para o Claude: captura -> PNG -> Read (o Claude ve a imagem de verdade).

  python scripts/blender-vision/vision.py doctor
  python scripts/blender-vision/vision.py shot --blend A.blend --action X --frames 0-40:4 | smart:12 --offset 1 --views front,side_nX --modes solid,bones,onion,contact,sil --out DIR
  python scripts/blender-vision/vision.py pair --blend A.blend --action-a X --action-b Y --frames 3,9,11 --offset 1 --out DIR
  python scripts/blender-vision/vision.py compare DIR_ANTES DIR_DEPOIS --out DIR
  python scripts/blender-vision/vision.py video DIR --view side_nX --mode solid --out clip.mp4

Garantias: nunca salva o .blend (hash antes/depois; se mudar, erro critico com evidencia), saida atomica
(pasta temporaria -> renomeia so apos sucesso), timeouts nos processos externos.
Nao e o viewport real: renderizacao Workbench headless (ver manifest.json).
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER = os.environ.get("BLENDER_EXE", r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe")
T_BLENDER = int(os.environ.get("VISION_TIMEOUT_BLENDER", "900"))
T_MAGICK = int(os.environ.get("VISION_TIMEOUT_MAGICK", "180"))
T_FFMPEG = int(os.environ.get("VISION_TIMEOUT_FFMPEG", "300"))


class VisionError(SystemExit):
    pass


def die(msg, code=2):
    print("ERRO: " + msg, file=sys.stderr)
    raise VisionError(code)


def run(cmd, timeout):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
    except subprocess.TimeoutExpired:
        die("processo excedeu o timeout de %ds e foi encerrado: %s" % (timeout, os.path.basename(cmd[0])), 4)
    except FileNotFoundError:
        die("executavel nao encontrado: %s" % cmd[0], 5)


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for ch in iter(lambda: f.read(1 << 20), b""):
            h.update(ch)
    return h.hexdigest()


def parse_frames(spec):
    out = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        step = 1
        if ":" in part:
            part, s = part.split(":")
            step = int(s)
        if "-" in part[1:]:
            neg = part.startswith("-")
            core = part[1:] if neg else part
            a, b = core.split("-", 1)
            a = int(a) * (-1 if neg else 1)
            out += list(range(a, int(b) + 1, step))
        else:
            out.append(int(part))
    return sorted(set(out))


def montage(files, labels, out, cols, title=None):
    cmd = ["magick", "montage", "-background", "#17181a", "-fill", "white", "-pointsize", "16", "-geometry", "+3+3", "-tile", "%dx" % cols]
    if title:
        cmd += ["-title", title]
    for f, l in zip(files, labels):
        cmd += ["-label", l, f]
    cmd.append(out)
    r = run(cmd, T_MAGICK)
    if r.returncode:
        die("magick montage falhou: " + r.stderr[:300], 6)


# ------------------------------------------------------------------ saida atomica + integridade
def provenance(blend, *extra):
    """quem gerou o resultado: hash do codigo das ferramentas, do .blend e dos arquivos de entrada (briefing, criterios)"""
    code = {}
    for f in ("vision.py", "check_inside.py", "inside_blender.py", "dense_inside.py", "vision_common.py"):
        p = os.path.join(HERE, f)
        if os.path.exists(p):
            code[f] = sha(p)[:16]
    ins = {os.path.basename(p): sha(p)[:16] for p in extra if p and os.path.exists(p)}
    for env in ("interp_envelope.json", "corpus_envelope.json"):
        p = os.path.join(HERE, "criteria", env)
        if os.path.exists(p):
            ins[env] = sha(p)[:16]
    return {"codigo_sha256_16": code, "blend": os.path.basename(blend), "blend_sha256_16": sha(blend)[:16], "entradas_sha256_16": ins, "quando": time.strftime("%Y-%m-%d %H:%M:%S")}


def safe_rmtree_output(out):
    """remove uma pasta de saida SOMENTE se for claramente uma saida desta ferramenta (marcador) ou estiver vazia; nunca raiz, home, repositorio ou pastas do projeto"""
    out = os.path.abspath(out)
    protegidos = {os.path.abspath(os.sep), os.path.expanduser("~"), os.path.abspath(os.path.join(HERE, "..", "..")), os.path.abspath(os.path.join(HERE, "..")), HERE,
                  os.path.abspath(os.path.join(HERE, "..", "..", "chars")), os.path.abspath(os.path.join(HERE, "..", "..", "prototypes"))}
    if out in protegidos or os.path.dirname(out) == out or len(out) < 12:
        die("recuso apagar '%s': caminho protegido" % out, 7)
    if os.path.exists(out) and os.listdir(out) and not os.path.exists(os.path.join(out, ".vision_output")):
        die("recuso apagar '%s': nao tem o marcador .vision_output (nao parece ser uma saida desta ferramenta). Aponte outra pasta ou apague manualmente." % out, 7)
    shutil.rmtree(out)


def prepare_out(out, overwrite):
    out = os.path.abspath(out)
    if os.path.exists(out) and os.listdir(out) and not overwrite:
        die("a pasta de saida ja existe e nao esta vazia: %s (use --overwrite)" % out, 7)
    tmp = out + ".tmp-%d" % os.getpid()
    if os.path.exists(tmp):
        shutil.rmtree(tmp)
    os.makedirs(tmp)
    return out, tmp


def finish_out(out, tmp, overwrite):
    if os.path.exists(out):
        os.rename(out, out + ".prev-%d" % int(time.time()))
    os.rename(tmp, out)


def fail_out(out, tmp, why, code=2):
    dest = out + ".FAILED-%d" % int(time.time())
    try:
        os.rename(tmp, dest)
    except OSError:
        dest = tmp
    print("ERRO: %s\nEvidencias preservadas em: %s" % (why, dest), file=sys.stderr)
    raise VisionError(code)


def run_blender(blend, cfg, tmp, out, label, script="inside_blender.py"):
    cfg = dict(cfg, out=tmp, blend=blend)
    cfgp = os.path.join(tmp, "_config.json")
    json.dump(cfg, open(cfgp, "w", encoding="utf-8"), indent=1)
    before = sha(blend)
    try:
        r = run([BLENDER, "-b", blend, "--python", os.path.join(HERE, script), "--", cfgp], T_BLENDER)
    except VisionError as e:
        fail_out(out, tmp, "o Blender excedeu o timeout de %ds e foi encerrado (saida parcial NAO e valida)" % T_BLENDER, 4)
    after = sha(blend)
    log = (r.stdout or "") + (r.stderr or "")
    open(os.path.join(tmp, "_blender.log"), "w", encoding="utf-8").write(log)
    if before != after:
        json.dump({"blend": blend, "sha256_antes": before, "sha256_depois": after, "quando": time.ctime()},
                  open(os.path.join(tmp, "INTEGRITY_FAILURE.json"), "w"), indent=1)
        fail_out(out, tmp, "O ARQUIVO .blend FOI MODIFICADO durante a captura (hash mudou). Nao confie nesta saida.", 3)
    if "VISION_FAIL:" in log:
        msg = log.split("VISION_FAIL:")[1].splitlines()[0].strip()
        fail_out(out, tmp, msg, 8)
    if "VISION_OK" not in log:
        fail_out(out, tmp, "o Blender nao gerou as imagens (ver _blender.log): " + log[-400:].replace("\n", " "), 9)
    return before


# ------------------------------------------------------------------ relatorio HTML
def build_html(d, man):
    items = man["items"]
    rows = []
    for it in items:
        rows.append('<a class="th" data-view="%s" data-mode="%s" data-frame="%s" href="%s"><img loading="lazy" src="%s"><span>%s %s g%s</span></a>' % (
            it["view"], it["mode"], it["frame_autoral"], it["file"], it["file"], it["view"], it["mode"], it["frame_autoral"]))
    views = sorted({i["view"] for i in items})
    modes = sorted({i["mode"] for i in items})
    extra = json.dumps(man.get("extra", {}), indent=1, ensure_ascii=False)
    sheets = "".join('<h3>%s</h3><a href="%s"><img style="max-width:100%%" src="%s"></a>' % (s, s, s) for s in man.get("sheets", []))
    html = """<!doctype html><meta charset="utf-8"><title>blender-vision</title>
<style>body{background:#17181a;color:#ddd;font:14px system-ui;margin:16px}a{color:#8cf}.g{display:flex;flex-wrap:wrap;gap:6px}
.th{display:block;width:240px;text-decoration:none;color:#ccc}.th img{width:100%%;display:block}pre{background:#0e0f10;padding:10px;overflow:auto}select,input{background:#222;color:#ddd}</style>
<h2>blender-vision</h2>
<p><b>%s</b> | action: %s | engine: %s | tamanho: %s | offset: %s | <i>%s</i></p>
<p>blend_untouched: <b>%s</b> | sha256: <code>%s</code></p>
<p>Vista <select id=v><option value="">todas</option>%s</select> Modo <select id=m><option value="">todos</option>%s</select> Frame <input id=f size=4 placeholder="g"></p>
<div class=g id=grid>%s</div><h3>Sheets</h3>%s<h3>Metricas e extras</h3><pre>%s</pre>
<script>function F(){var v=document.getElementById('v').value,m=document.getElementById('m').value,f=document.getElementById('f').value;
document.querySelectorAll('.th').forEach(function(e){var ok=(!v||e.dataset.view==v)&&(!m||e.dataset.mode==m)&&(!f||e.dataset.frame==f);e.style.display=ok?'':'none'})}
['v','m','f'].forEach(function(i){document.getElementById(i).oninput=F})</script>""" % (
        man.get("blend", ""), man.get("action") or man.get("actions"), man.get("engine"), man.get("size"), man.get("offset"), man.get("render_note", ""),
        man.get("blend_untouched"), man.get("blend_sha256", ""),
        "".join("<option>%s</option>" % v for v in views), "".join("<option>%s</option>" % m for m in modes), "".join(rows), sheets, extra)
    open(os.path.join(d, "report.html"), "w", encoding="utf-8").write(html)


def region_visibility(d, man):
    """mapa de oclusao: para cada imagem do passe de ids, quantos pixels de cada regiao aparecem. Regiao com < 0,05% da imagem = OCULTA nessa camera
    (nao da para afirmar nada sobre ela naquela vista). Cores por vizinho mais proximo (sRGB), limite de distancia 0.15."""
    try:
        import numpy as np
        from PIL import Image
    except Exception:
        return None
    src = open(os.path.join(HERE, "inside_blender.py"), encoding="utf-8-sig").read()
    m = re.search(r"ID_COLORS = \{(.*?)\}", src, re.S)
    if not m:
        return None
    table = {k: tuple(float(x) for x in vals.split(",")) for k, vals in re.findall(r'"(\w+)": \(([^)]*)\)', m.group(1))}
    lin2srgb = lambda x: np.where(np.array(x) <= 0.0031308, np.array(x) * 12.92, 1.055 * np.power(np.maximum(x, 1e-9), 1 / 2.4) - 0.055)
    names = list(table)
    ref = np.stack([lin2srgb(table[k]) for k in names])
    out = {}
    for it in man["items"]:
        if it["mode"] != "ids":
            continue
        a = np.asarray(Image.open(os.path.join(d, it["file"])).convert("RGB")).astype(np.float32) / 255.0
        flat = a.reshape(-1, 3)
        dist = np.linalg.norm(flat[:, None, :] - ref[None, :, :], axis=2)
        k = dist.argmin(axis=1)
        ok = dist.min(axis=1) < 0.15
        total = flat.shape[0]
        cnt = {names[i]: int(((k == i) & ok).sum()) for i in range(len(names))}
        key = "%s_g%s" % (it["view"], it["frame_autoral"])
        out[key] = {"pixels": cnt, "ocultas": [n for n, c in cnt.items() if c < 0.0005 * total]}
    return out


def sheets_for_shot(d, man, cols):
    sheets = []
    groups = {}
    for it in man["items"]:
        tag = ("_z%d" % round(it["zoom_radius_m"] * 100)) if it.get("zoom_radius_m") else ""
        groups.setdefault((it["view"], it["mode"], tag), []).append(it)
    for (v, m, tag), its in groups.items():
        its.sort(key=lambda i: i["frame_timeline"])
        files = [os.path.join(d, i["file"]) for i in its]
        labels = [("g%d (t%d)" % (i["frame_autoral"], i["frame_timeline"])) + ((" " + (man["smart_reasons"].get(str(i["frame_timeline"])) or [""])[0]) if man.get("smart_reasons") else "") for i in its]
        name = "sheet_%s_%s%s.png" % (v, m, tag)
        montage(files, labels, os.path.join(d, name), min(cols, len(files)),
                title="%s | %s%s | acao: %s | alinhamento: %s | g=autoral t=timeline" % (v, m, tag, man.get("action"), man.get("align")))
        sheets.append(name)
    for pm in man.get("extra", {}).get("permanence", []):
        sheets.append(pm["file"])
    if len({i["frame_timeline"] for i in man["items"]}) == 1:
        its = man["items"]
        name = "multiview_g%d.png" % its[0]["frame_autoral"]
        montage([os.path.join(d, i["file"]) for i in its], ["%s/%s" % (i["view"], i["mode"]) for i in its], os.path.join(d, name), min(4, len(its)))
        sheets.append(name)
    return sheets


def cmd_doctor(a):
    res = {}
    res["blender_exe"] = {"caminho": BLENDER, "existe": os.path.exists(BLENDER)}
    if res["blender_exe"]["existe"]:
        r = run([BLENDER, "--version"], 60)
        ver = (r.stdout or "").splitlines()[0] if r.stdout else ""
        res["blender_exe"]["versao"] = ver
        res["blender_exe"]["e_5_2"] = "5.2" in ver
    for nm, cmd in (("magick", ["magick", "-version"]), ("ffmpeg", ["ffmpeg", "-version"])):
        try:
            r = run(cmd, 30)
            res[nm] = {"ok": r.returncode == 0, "versao": ((r.stdout or "").splitlines() or [""])[0][:80]}
        except VisionError:
            res[nm] = {"ok": False, "versao": "nao encontrado"}
    td = tempfile.mkdtemp(prefix="vision_doctor_")
    try:
        open(os.path.join(td, "w.txt"), "w").write("ok")
        res["escrita_temp"] = True
    except OSError:
        res["escrita_temp"] = False
    script = os.path.join(td, "mini.py")
    open(script, "w").write(
        "import bpy\nsc=bpy.context.scene\nsc.render.engine='BLENDER_WORKBENCH'\nsc.render.resolution_x=64\nsc.render.resolution_y=64\n"
        "engs=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]\nprint('ENGINES',','.join(engs))\n"
        "sc.render.filepath=r'%s'\nbpy.ops.render.render(write_still=True)\nprint('MINI_RENDER_OK')\n" % os.path.join(td, "mini.png").replace("\\", "/"))
    try:
        r = run([BLENDER, "-b", "--factory-startup", "--python", script], 120)
        out = (r.stdout or "") + (r.stderr or "")
        res["render_minimo_workbench"] = ("MINI_RENDER_OK" in out) and os.path.exists(os.path.join(td, "mini.png"))
        res["motores_disponiveis"] = next((l.split(" ", 1)[1] for l in out.splitlines() if l.startswith("ENGINES ")), "?")
    except VisionError:
        res["render_minimo_workbench"] = False
    shutil.rmtree(td, ignore_errors=True)
    ok = res["blender_exe"].get("existe") and res["blender_exe"].get("e_5_2") and res["magick"]["ok"] and res["render_minimo_workbench"] and res["escrita_temp"]
    res["pronto"] = bool(ok)
    res["ffmpeg_opcional"] = res["ffmpeg"]["ok"]
    print(json.dumps(res, indent=1, ensure_ascii=False))
    if not ok:
        raise VisionError(1)


def base_cfg(a):
    return dict(offset=a.offset, size=a.size, armature=a.armature)


def cmd_shot(a):
    blend = os.path.abspath(a.blend)
    if not os.path.exists(blend):
        die("arquivo nao existe: " + blend)
    out, tmp = prepare_out(a.out, a.overwrite)
    if a.zoom_preset == "hand":
        a.zoom_radius, a.bone_cam = "0.6,0.25,0.12", True
        if not a.zoom:
            die("--zoom-preset hand exige --zoom (ex.: --zoom RightHand)")
    cfg = base_cfg(a)
    cfg.update(mode="shot", action=a.action, views=a.views.split(","), modes=a.modes.split(","), align=a.align, zoom=a.zoom,
               zoom_radii=[float(x) for x in a.zoom_radius.split(",")] if a.zoom else None, bone_cam=a.bone_cam, onion_step=a.onion_step)
    if getattr(a, "custom_cameras", None) and os.path.isfile(a.custom_cameras):
        try:
            cfg["custom_cameras"] = json.load(open(a.custom_cameras, encoding="utf-8"))
        except Exception:
            pass
    if a.frames.startswith("smart:"):
        cfg["frames_spec"] = a.frames
        cfg["frames"] = []
    else:
        cfg["frames"] = [f + a.offset for f in parse_frames(a.frames)]
    h = run_blender(blend, cfg, tmp, out, "shot")
    man = json.load(open(os.path.join(tmp, "manifest.json"), encoding="utf-8"))
    man["blend_untouched"] = True
    man["blend_sha256"] = h
    man["proveniencia"] = provenance(blend)
    vis = region_visibility(tmp, man)
    if vis:
        man["visibilidade_por_regiao"] = vis      # regioes ocultas por camera: nada pode ser afirmado sobre elas nessa vista
    man["sheets"] = sheets_for_shot(tmp, man, a.cols)
    json.dump(man, open(os.path.join(tmp, "manifest.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    build_html(tmp, man)
    finish_out(out, tmp, a.overwrite)
    print(json.dumps({"out": out, "imagens": len(man["items"]), "sheets": [os.path.join(out, s) for s in man["sheets"]], "html": os.path.join(out, "report.html"),
                      "blend_untouched": True, "action": man.get("action"), "smart": man.get("smart_reasons") or None, "aviso": man["render_note"]}, indent=1, ensure_ascii=False))


def cmd_pair(a):
    blend = os.path.abspath(a.blend)
    out, tmp = prepare_out(a.out, a.overwrite)
    cfg = base_cfg(a)
    cfg.update(mode="pair", actions=[a.action_a, a.action_b], frames=parse_frames(a.frames), views=a.views.split(","))
    h = run_blender(blend, cfg, tmp, out, "pair")
    man = json.load(open(os.path.join(tmp, "manifest.json"), encoding="utf-8"))
    man["blend_untouched"] = True
    man["blend_sha256"] = h
    sheets = []
    for cm in man["camera_modes"]:
        for v in man["views"]:
            its = sorted([i for i in man["items"] if i["camera_mode"] == cm and i["view"] == v], key=lambda i: i["frame_timeline"])
            files, labels = [], []
            for i in its:
                files += [os.path.join(tmp, i["A"]), os.path.join(tmp, i["B"]), os.path.join(tmp, i["file"])]
                labels += ["A %s g%d" % (man["actions"][0], i["frame_autoral"]), "B %s" % man["actions"][1], "DIFF IoU=%.2f" % i["iou"]]
            name = "sheet_pair_%s_%s.png" % (cm, v)
            montage(files, labels, os.path.join(tmp, name), 3, title="%s | camera %s | vermelho=so A, azul=so B, cinza=comum" % (v, cm))
            sheets.append(name)
    man["sheets"] = sheets
    for it in man["items"]:
        it["mode"] = it["mode"]
    json.dump(man, open(os.path.join(tmp, "manifest.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    build_html(tmp, man)
    summ = {}
    for it in man["items"]:
        summ.setdefault("%s/%s" % (it["camera_mode"], it["view"]), []).append((it["iou"], it["frame_autoral"]))
    resumo = {k: {"iou_medio": round(sum(x for x, _ in v) / len(v), 3), "pior_frame": min(v)[1], "pior_iou": min(v)[0]} for k, v in summ.items()}
    finish_out(out, tmp, a.overwrite)
    print(json.dumps({"out": out, "sheets": [os.path.join(out, s) for s in sheets], "html": os.path.join(out, "report.html"), "resumo_iou": resumo,
                      "juntas_que_mais_mudaram_alinhado_pelo_quadril": man["extra"]["joint_diff_top_alinhado"][:6],
                      "juntas_que_mais_mudaram_global": man["extra"]["joint_diff_top_global"][:6],
                      "esqueleto_px_top": man["extra"]["skeleton_px_top"][:6], "blend_untouched": True}, indent=1, ensure_ascii=False))


def cmd_compare(a):
    A, B = os.path.abspath(a.antes), os.path.abspath(a.depois)
    ma = json.load(open(os.path.join(A, "manifest.json"), encoding="utf-8"))
    mb = json.load(open(os.path.join(B, "manifest.json"), encoding="utf-8"))
    for k in ("size", "offset", "engine", "align"):
        if ma.get(k) != mb.get(k):
            die("manifestos incompativeis em '%s': %s != %s" % (k, ma.get(k), mb.get(k)), 10)
    ka = {(i["view"], i["mode"], i["frame_timeline"]): i for i in ma["items"]}
    kb = {(i["view"], i["mode"], i["frame_timeline"]): i for i in mb["items"]}
    if set(ka) != set(kb):
        die("conjuntos de frames/vistas/modos diferentes entre as duas capturas; use o mesmo --frames/--views/--modes", 10)
    for k in ka:
        ca, cb = ka[k]["camera"], kb[k]["camera"]
        if ca["type"] != cb["type"] or abs(ca["ortho_scale"] - cb["ortho_scale"]) > 1e-3 or ca["lens"] != cb["lens"]:
            die("a camera difere (escala/lente/tipo) em %s; a comparacao seria enganosa" % (k,), 10)
        if max(abs(x - y) for x, y in zip(ca["center"], cb["center"])) > 1e-3 and not a.allow_unlocked:
            die("o enquadramento (centro da camera) difere em %s: as capturas seguiram quadris diferentes. "
                "Use 'vision.py pair' (camera travada) ou --allow-unlocked para aceitar o risco." % (k,), 10)
    out, tmp = prepare_out(a.out, a.overwrite)
    rows, files, labels = [], [], []
    for k in sorted(ka):
        n = ka[k]["file"]
        d = os.path.join(tmp, "diff_" + n)
        r = run(["magick", "compare", "-metric", "RMSE", "-compose", "src", os.path.join(A, n), os.path.join(B, n), d], T_MAGICK)
        txt = (r.stderr or r.stdout or "").strip()
        val = None
        if "(" in txt and ")" in txt:
            try:
                val = float(txt[txt.index("(") + 1:txt.index(")")])
            except ValueError:
                pass
        rows.append({"arquivo": n, "rmse_normalizado_0_1": val})
        files += [os.path.join(A, n), os.path.join(B, n), d]
        labels += ["ANTES " + n[:-4], "DEPOIS", "DIFERENCA rmse=%s" % (round(val, 3) if val is not None else "?")]
    montage(files, labels, os.path.join(tmp, "compare_sheet.png"), 3)
    json.dump(rows, open(os.path.join(tmp, "compare.json"), "w", encoding="utf-8"), indent=1)
    finish_out(out, tmp, a.overwrite)
    print(json.dumps({"sheet": os.path.join(out, "compare_sheet.png"), "pares": len(rows),
                      "piores": sorted(rows, key=lambda r: -(r["rmse_normalizado_0_1"] or 0))[:5]}, indent=1, ensure_ascii=False))


def cmd_video(a):
    d = os.path.abspath(a.dir)
    man = json.load(open(os.path.join(d, "manifest.json"), encoding="utf-8"))
    its = sorted([i for i in man["items"] if i["view"] == a.view and i["mode"] == a.mode], key=lambda i: i["frame_timeline"])
    if not its:
        die("nenhum frame para essa vista/modo")
    lst = os.path.join(tempfile.gettempdir(), "vision_concat.txt")
    with open(lst, "w") as f:
        for i in its:
            f.write("file '%s'\nduration %.5f\n" % (os.path.join(d, i["file"]).replace("\\", "/"), 1.0 / a.fps))
        f.write("file '%s'\n" % os.path.join(d, its[-1]["file"]).replace("\\", "/"))
    r = run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-vf", "fps=%d,format=yuv420p" % a.fps, os.path.abspath(a.out)], T_FFMPEG)
    print("ok" if r.returncode == 0 else r.stderr[-800:], os.path.abspath(a.out))


# ------------------------------------------------------------------ check / historico / cycle / footlock
def format_check(rep, only_problems=False):
    rs = rep["resumo"]
    L = ["REGRAS (%s | action %s): %d regras = PASS %d | FAIL %d | HIPOTESE %d | INCONCLUSIVO %d" % (rep.get("brief") or "sem briefing", rep["action"],
         len(rep["regras"]), rs.get("PASS", 0), rs.get("FAIL", 0), rs.get("HIPOTESE", 0), rs.get("INCONCLUSIVO", 0))]
    order = {"FAIL": 0, "HIPOTESE": 1, "INCONCLUSIVO": 2, "PASS": 3}
    for r in sorted(rep["regras"], key=lambda r: order.get(r["status"], 3)):
        if only_problems and r["status"] == "PASS":
            continue
        fr = (" frames=" + ",".join(map(str, r["frames_com_falha"][:14])) + ("..." if len(r["frames_com_falha"]) > 14 else "")) if r["frames_com_falha"] else ""
        L.append("  [%s] %s: %s%s" % (r["status"], r["id"], r["detalhe"], fr))
    rg = rep["rig"]
    L.append("RIG: %d ossos | dedos E=%s D=%s | %s" % (rg["bones"], rg["digits"]["Left_total_dedos"], rg["digits"]["Right_total_dedos"], rg["garra_aberta_representavel"]))
    m = rep["metricas"]
    L.append("METRICAS: %d frames | frames quase parados %d | deslizamento max pe E %.3f / D %.3f m/frame" % (m["frames"], m["frames_quase_parados"], m["deslizamento_max_Left"], m["deslizamento_max_Right"]))
    return "\n".join(L)


def hist_dir(a, blend):
    return os.path.abspath(a.history) if getattr(a, "history", None) else os.path.join(os.path.dirname(os.path.abspath(blend)), "vision_history")


def run_check(a, out, extra=None):
    blend = os.path.abspath(a.blend)
    out, tmp = prepare_out(out, True)
    cfg = dict(mode="check", action=a.action, offset=a.offset, armature=a.armature, brief=os.path.abspath(a.brief) if getattr(a, "brief", None) else None,
               interpenetration_always=True, brief_mode=getattr(a, "mode", None), baseline_action=getattr(a, "baseline_action", None),
               interp_envelope=os.path.join(os.path.dirname(os.path.abspath(__file__)), "criteria", "interp_envelope.json"))
    cfg.update(extra or {})
    h = run_blender(blend, cfg, tmp, out, "check", script="check_inside.py")
    rep = json.load(open(os.path.join(tmp, "check_report.json"), encoding="utf-8"))
    rep["blend_sha256"] = h
    rep["blend_untouched"] = True
    rep["proveniencia"] = provenance(blend, getattr(a, "brief", None))
    json.dump(rep, open(os.path.join(tmp, "check_report.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    finish_out(out, tmp, True)
    return out, rep


def snap_diff(old, new):
    L = []
    ro = {r["id"]: r["status"] for r in old["regras"]}
    for r in new["regras"]:
        o = ro.get(r["id"])
        if o and o != r["status"]:
            L.append("  regra %s: %s -> %s%s" % (r["id"], o, r["status"], "  (MELHOROU)" if r["status"] == "PASS" else "  (PIOROU)" if o == "PASS" else ""))
    for j, mm in new["metricas"]["por_junta"].items():
        o = old["metricas"]["por_junta"].get(j)
        if o and abs(mm["vel_pico_m_frame"] - o["vel_pico_m_frame"]) > 0.05:
            L.append("  pico de velocidade %s: %.3f -> %.3f m/frame (frame %s)" % (j, o["vel_pico_m_frame"], mm["vel_pico_m_frame"], mm["frame_autoral_do_pico"]))
    for k in ("deslizamento_max_Left", "deslizamento_max_Right", "frames_quase_parados"):
        if new["metricas"].get(k) != old["metricas"].get(k):
            L.append("  %s: %s -> %s" % (k, old["metricas"].get(k), new["metricas"].get(k)))
    pa, pb_ = old["metricas"]["posicoes_alinhadas_quadril"], new["metricas"]["posicoes_alinhadas_quadril"]
    common = sorted(set(pa) & set(pb_), key=int)
    if common:
        dj = {}
        for f in common:
            for j, v in pb_[f].items():
                if j in pa[f]:
                    dj.setdefault(j, []).append(sum((x - y) ** 2 for x, y in zip(v, pa[f][j])) ** 0.5)
        top = sorted(dj, key=lambda j: -max(dj[j]))[:5]
        L.append("  juntas que mais mudaram de pose (alinhado pelo quadril, max m): " + ", ".join("%s %.2f" % (j, max(dj[j])) for j in top))
    return L or ["  nenhuma diferenca relevante de regras/metricas"]


def cmd_check(a):
    out, rep = run_check(a, a.out)
    print(format_check(rep, a.only_problems))
    print("\nrelatorio completo:", os.path.join(out, "check_report.json"))


def action_base(name):
    """nome da action sem sufixos de versao/ferramenta (_v2, _v2_x, _footlock, _FT); '--base' sobrepoe"""
    b = re.sub(r"(_footlock|_FT)+$", "", name)
    b = re.sub(r"_v\d+.*$", "", b)
    return b or name


def identity(rep, base=None):
    """personagem (armature+malhas), ataque (nome do briefing) e action-base: so versoes iguais nos 3 sao comparaveis"""
    return {"personagem": rep.get("armature"), "malhas": sorted(rep.get("rig", {}).get("shape_keys", {}).keys()),
            "ataque": rep.get("brief"), "action_base": base or action_base(rep.get("action", ""))}


def same_identity(a, b):
    return all(a.get(k) == b.get(k) for k in ("personagem", "malhas", "ataque", "action_base"))


def load_hist(d):
    out = []
    for f in sorted(os.listdir(d)):
        if f.endswith(".json"):
            try:
                r = json.load(open(os.path.join(d, f), encoding="utf-8"))
            except Exception:
                continue
            out.append((f, r, r.get("identidade") or identity(r)))      # snapshots antigos: identidade derivada do conteudo
    return out


def cmd_snap(a):
    d = hist_dir(a, a.blend)
    os.makedirs(d, exist_ok=True)
    tmpout = os.path.join(tempfile.gettempdir(), "vision_snap_%d" % os.getpid())
    out, rep = run_check(a, tmpout)
    ident = identity(rep, getattr(a, "base", None))
    prev = [(f, r) for f, r, i in load_hist(d) if same_identity(i, ident)]       # so mesma personagem + ataque + action-base
    skipped = len(load_hist(d)) - len(prev)
    name = "%s__%s__%s.json" % (time.strftime("%Y%m%d-%H%M%S"), a.action, a.label)
    rep["label"] = a.label
    rep["identidade"] = ident
    json.dump(rep, open(os.path.join(d, name), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    shutil.rmtree(out, ignore_errors=True)
    print("snapshot gravado:", os.path.join(d, name))
    print("identidade:", json.dumps(ident, ensure_ascii=False))
    print(format_check(rep, True))
    if prev:
        f, old = prev[-1]
        print("\nDIFERENCA contra o snapshot anterior comparavel (%s):" % f)
        print("\n".join(snap_diff(old, rep)))
    else:
        print("\n(sem snapshot comparavel: nenhum anterior com a mesma personagem, ataque e action-base; %d snapshot(s) de outra identidade ignorado(s))" % skipped)


def cmd_history(a):
    d = os.path.abspath(a.dir)
    groups = {}
    for f, r, i in load_hist(d):
        groups.setdefault(json.dumps({k: i.get(k) for k in ("personagem", "ataque", "action_base")}, ensure_ascii=False), []).append((f, r))
    for g, items in groups.items():
        print("== " + g)
        for f, r in items:
            print("  %s  PASS %d FAIL %d HIP %d INC %d" % (f, r["resumo"].get("PASS", 0), r["resumo"].get("FAIL", 0), r["resumo"].get("HIPOTESE", 0), r["resumo"].get("INCONCLUSIVO", 0)))


def cmd_cycle(a):
    """modificar -> capturar -> medir -> comparar -> resumir, em um comando"""
    out = os.path.abspath(a.out)
    if os.path.exists(out) and not a.overwrite:
        die("a pasta de saida ja existe: %s (use --overwrite)" % out, 7)
    if os.path.exists(out):
        safe_rmtree_output(out)
    os.makedirs(out)
    open(os.path.join(out, ".vision_output"), "w").write("saida do blender-vision cycle")
    me = [sys.executable, os.path.abspath(__file__)]
    base = ["--blend", a.blend, "--offset", str(a.offset)] + (["--armature", a.armature] if a.armature else [])
    print("== 1/3 regras e snapshot")
    r1 = subprocess.run(me + ["snap"] + base + ["--action", a.action, "--label", a.label] + (["--brief", a.brief] if a.brief else []) + (["--history", a.history] if a.history else []) + (["--mode", a.mode] if a.mode else []) + (["--baseline-action", a.baseline_action] if a.baseline_action else []),
                        capture_output=True, text=True, encoding="utf-8", errors="replace")
    print(r1.stdout.strip() or r1.stderr.strip())
    if r1.returncode:
        die("cycle interrompido: etapa 1 (snap) falhou (codigo %d)" % r1.returncode, r1.returncode)
    print("\n== 2/3 imagens (frames smart)")
    r2 = subprocess.run(me + ["shot"] + base + ["--action", a.action, "--frames", "smart:%d" % a.n, "--views", "side_nX,front", "--modes", "solid,sil,contact", "--size", "260",
                                                 "--cols", str(min(a.n, 6)), "--out", os.path.join(out, "imagens"), "--overwrite"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r2.returncode:
        print(r2.stderr.strip()[-600:])
        die("cycle interrompido: etapa 2 (shot) falhou (codigo %d); entrega PARCIAL nao e valida" % r2.returncode, r2.returncode)
    imgs = [os.path.join(out, "imagens", f) for f in ("sheet_side_nX_solid.png", "sheet_front_solid.png", "sheet_side_nX_contact.png", "permanence_side_nX.png")]
    overview = os.path.join(out, "OVERVIEW.png")
    have = [p for p in imgs[:2] if os.path.exists(p)]
    if have:
        run(["magick"] + have + ["-append", overview], T_MAGICK)
    print("\n== 3/3 comparacao")
    pair_sheet = None
    if a.prev_action:
        r3 = subprocess.run(me + ["pair"] + base + ["--action-a", a.prev_action, "--action-b", a.action, "--frames", a.pair_frames, "--views", "side_nX,front", "--size", "260",
                                                     "--out", os.path.join(out, "comparacao"), "--overwrite"], capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r3.returncode:
            print(r3.stderr.strip()[-400:])
            die("cycle interrompido: etapa 3 (pair) falhou (codigo %d)" % r3.returncode, r3.returncode)
        try:
            j = json.loads(r3.stdout)
            pair_sheet = j["sheets"][0] if j.get("sheets") else None
            print("IoU medio:", {k: v["iou_medio"] for k, v in j["resumo_iou"].items()}, "| juntas que mais mudaram:", j["juntas_que_mais_mudaram_alinhado_pelo_quadril"][:4])
        except Exception:
            print(r3.stderr.strip()[-400:])
    else:
        print("(sem --prev-action: comparacao de imagens ignorada)")
    print("\nIMAGENS PARA LER COM Read (nesta ordem):")
    for p in ([overview] if os.path.exists(overview) else []) + [imgs[2], imgs[3]] + ([pair_sheet] if pair_sheet else []):
        if p and os.path.exists(p):
            print("  ", p)


def cmd_footlock(a):
    blend = os.path.abspath(a.blend)
    out, tmp = prepare_out(a.out, a.overwrite)
    save_as = os.path.abspath(a.save_as)
    if os.path.abspath(save_as) == blend:
        die("--save-as nao pode ser o proprio .blend de origem")
    if os.path.exists(save_as) and not a.overwrite_save_as:
        die("--save-as '%s' ja existe: recuso sobrescrever (use --overwrite-save-as se for mesmo isso)" % save_as, 7)
    if save_as.lower().endswith(".blend1") or os.path.splitext(save_as)[1].lower() != ".blend":
        die("--save-as precisa terminar em .blend", 7)
    cfg = dict(mode="footlock", action=a.action, new_action=a.new_action or (a.action + "_footlock"), offset=a.offset, armature=a.armature, save_as=save_as)
    if a.ranges:
        rg = {}
        for part in a.ranges.split(";"):
            side, rr = part.split(":")
            rg[side] = [tuple(int(x) for x in seg.split("-")) for seg in rr.split(",")]
        cfg["ranges"] = rg
    h = run_blender(blend, cfg, tmp, out, "footlock", script="check_inside.py")
    rep = json.load(open(os.path.join(tmp, "footlock_report.json"), encoding="utf-8"))
    rep["blend_origem_intacto"] = True
    rep["copia_salva_em"] = save_as
    json.dump(rep, open(os.path.join(tmp, "footlock_report.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    finish_out(out, tmp, a.overwrite)
    print(json.dumps(rep, indent=1, ensure_ascii=False))


def cmd_dense(a):
    """analise temporal densa de TODOS os frames (somente leitura) + grafico PNG + comparacao com referencia/criterios do diretor"""
    blend = os.path.abspath(a.blend)
    out, tmp = prepare_out(a.out, a.overwrite)
    cfg = dict(mode="dense", action=a.action, offset=a.offset, armature=a.armature, ref_action=a.ref_action, impact_window=a.impact_window,
               ref_profile=os.path.abspath(a.ref_profile) if a.ref_profile else None, criteria=os.path.abspath(a.criteria) if a.criteria else None)
    env = os.path.join(os.path.dirname(os.path.abspath(__file__)), "criteria", "corpus_envelope.json")
    if not cfg["criteria"] and os.path.exists(env):
        cfg["criteria"] = env          # sem criterio do diretor: usa o envelope EMPIRICO do corpus (tipico, nao 'bom')
    h = run_blender(blend, cfg, tmp, out, "dense", script="dense_inside.py")
    rep = json.load(open(os.path.join(tmp, "dense_report.json"), encoding="utf-8"))
    rep["blend_sha256"] = h
    rep["blend_untouched"] = True
    rep["proveniencia"] = provenance(blend, a.criteria, a.ref_profile)
    json.dump(rep, open(os.path.join(tmp, "dense_report.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    try:
        draw_dense(rep, os.path.join(tmp, "dense_graph.png"))
    except Exception as e:                                   # grafico e opcional (PIL no Python do sistema)
        print("aviso: grafico nao gerado:", e)
    if a.save_profile:
        json.dump({"action": rep["action"], "perfil_ritmo": rep["perfil_ritmo"], "nota": "perfil de ritmo MEDIDO; so e referencia se o diretor aprovar a action de origem"},
                  open(os.path.abspath(a.save_profile), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    finish_out(out, tmp, a.overwrite)
    print(format_dense(rep))
    print("\nrelatorio:", os.path.join(out, "dense_report.json"))


def format_dense(r):
    L = ["DENSA: %s | frames autorais %s..%s | interpolacao constante media %.2f | clip bakeado denso: %s" % (r["action"], r["frames_autorais"][0], r["frames_autorais"][1], r["interpolacao"]["frac_constante_media"], r["interpolacao"]["clip_bakeado_denso"])]
    for h in r["paradas"]:
        L.append("  parada g%d-g%d (%d fr): %s" % (h["frames_autorais"][0], h["frames_autorais"][1], h["duracao"], h["tipo"]))
    for s, f in r["pes"].items():
        L.append("  pe %s: modo %s | apoiado %d fr, deslizando %d fr (max %.3f m/fr), no ar %d fr" % (s, f["modo"], len(f["frames_apoiado"]), len(f["frames_deslizando"]), f["deslize_max_m_frame"], len(f["frames_no_ar"])))
    pc = r["perfil_ritmo"]["corpo"]
    if "t50" in pc:
        L.append("  ritmo do corpo: 10%%/50%%/90%% do percurso em t=%.2f/%.2f/%.2f | pico em %.2f | pico/media %.1f | parado %.0f%%" % (pc["t10"], pc["t50"], pc["t90"], pc["pico_norm"], pc["pico_sobre_media"], 100 * pc["fracao_parada"]))
    for k, c in r.get("comparacao_com_referencia", {}).items():
        if isinstance(c, dict):
            L.append("  vs referencia (%s): RMSE da curva acumulada %s | delta t50 %s | delta duracao %s" % (k, c.get("rmse_curva_acumulada"), c.get("delta_t50"), c.get("diferenca_duracao_frames")))
    if r.get("criterios_origem"):
        L.append("  criterios: " + r["criterios_origem"])
    for k, rows in r.get("criterios_do_diretor", {}).items():
        for row in rows:
            L.append("  criterio [%s] %s: %s (valor %s, faixa %s)" % (k, row["medida"], row["status"], row.get("valor"), row.get("faixa")))
    return "\n".join(L)


def draw_dense(r, path):
    """grafico denso legivel: titulo fora dos paineis, margens fixas, eixos com unidades, frames globais (g) e do Blender (t), legenda, picos rotulados"""
    from PIL import Image, ImageDraw, ImageFont

    def font(sz):
        for n in ("arial.ttf", "segoeui.ttf", "DejaVuSans.ttf"):
            try:
                return ImageFont.truetype(n, sz)
            except Exception:
                continue
        return ImageFont.load_default()
    F1, F2, F3 = font(22), font(16), font(14)
    W, H = 1500, 1180
    img = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(img)
    n = len(r["movimento_total_por_frame"])
    f0 = r["frames_autorais"][0]
    off = 1
    L, R = 110, 40
    x0, x1 = L, W - R
    X = lambda i: x0 + (x1 - x0) * i / max(1, n - 1)
    d.text((L, 14), "Analise temporal densa - %s | frames autorais g%d-g%d (timeline t = g + %d) | 30 FPS" % (r["action"], f0, f0 + n - 1, off), fill=(0, 0, 0), font=F1)
    cols = {"hold_por_interpolacao_constante": ((205, 225, 255), "hold constante (blocking)"), "hold_chaveado": ((205, 255, 215), "hold chaveado"),
            "possivel_congelamento": ((255, 205, 205), "possivel congelamento"), "parado_em_clip_bakeado": ((225, 225, 225), "parado em clip bakeado")}

    def axes(y0, y1, title, ymax, unit):
        d.text((x0, y0 - 30), title, fill=(0, 0, 0), font=F2)
        d.rectangle([x0, y0, x1, y1], outline=(120, 120, 120))
        for k in range(5):
            yy = y1 - (y1 - y0) * k / 4
            d.line([x0 - 5, yy, x0, yy], fill=(80, 80, 80))
            d.text((x0 - 8, yy - 8), "%.2f" % (ymax * k / 4), fill=(60, 60, 60), font=F3, anchor="ra")
            if 0 < k < 4:
                d.line([x0, yy, x1, yy], fill=(235, 235, 235))
        d.text((12, (y0 + y1) / 2 - 8), unit, fill=(60, 60, 60), font=F3)

    def xticks(y1):
        for i in range(0, n, 5):
            d.line([X(i), y1, X(i), y1 + 5], fill=(80, 80, 80))
            d.text((X(i), y1 + 7), "g%d" % (f0 + i), fill=(0, 0, 0), font=F3, anchor="ma")
            d.text((X(i), y1 + 23), "t%d" % (f0 + i + off), fill=(120, 120, 120), font=F3, anchor="ma")

    def shade(y0, y1):
        for h in r["paradas"]:
            c = cols.get(h["tipo"], ((235, 235, 235), ""))[0]
            d.rectangle([X(h["frames_autorais"][0] - f0), y0 + 1, X(h["frames_autorais"][1] - f0 + 1), y1 - 1], fill=c)
    # painel 1: movimento total
    p1 = (90, 300)
    mt = max(r["movimento_total_por_frame"]) or 1
    axes(p1[0], p1[1], "1) Movimento total do corpo (soma da velocidade das 11 juntas-chave)", mt * 1.1, "m/frame")
    shade(*p1)
    pts = [(X(i), p1[1] - (p1[1] - p1[0]) * min(1.0, v_ / (mt * 1.1))) for i, v_ in enumerate(r["movimento_total_por_frame"])]
    d.line(pts, fill=(20, 20, 20), width=2)
    order = sorted(range(n), key=lambda i: -r["movimento_total_por_frame"][i])
    placed = []
    for i in order[:6]:
        if any(abs(i - j) < 4 for j in placed):
            continue
        placed.append(i)
        if len(placed) >= 3:
            break
    for i in placed:
        d.ellipse([pts[i][0] - 4, pts[i][1] - 4, pts[i][0] + 4, pts[i][1] + 4], fill=(200, 0, 0))
        d.text((pts[i][0] + 7, pts[i][1] - 2), "pico g%d (t%d) %.2f" % (f0 + i, f0 + i + off, r["movimento_total_por_frame"][i]), fill=(160, 0, 0), font=F3)
    # legenda das paradas
    lx = x0
    for k, (c, nm) in cols.items():
        if any(h["tipo"] == k for h in r["paradas"]):
            d.rectangle([lx, p1[1] + 52, lx + 16, p1[1] + 66], fill=c, outline=(120, 120, 120))
            d.text((lx + 22, p1[1] + 51), nm, fill=(0, 0, 0), font=F3)
            lx += 40 + 8 * len(nm)
    xticks(p1[1])
    # painel 2: velocidades por junta
    p2 = (440, 690)
    tr = r["trajetorias"]
    series = [("Mao E", "LeftHand", (30, 90, 220)), ("Mao D", "RightHand", (220, 40, 40)), ("Quadril", "Hips", (30, 150, 60)), ("Cabeca", "Head", (230, 140, 0)), ("Pe D", "RightFoot", (140, 60, 190))]
    series = [s for s in series if s[1] in tr]
    mh = max(max(tr[j]["velocidade_m_frame"]) for _, j, _ in series) or 1
    axes(p2[0], p2[1], "2) Velocidade por junta (m/frame, mundo)", mh * 1.1, "m/frame")
    shade(*p2)
    for nm, j, col in series:
        pp = [(X(i), p2[1] - (p2[1] - p2[0]) * min(1.0, v_ / (mh * 1.1))) for i, v_ in enumerate(tr[j]["velocidade_m_frame"])]
        d.line(pp, fill=col, width=2)
        i = max(range(n), key=lambda k: tr[j]["velocidade_m_frame"][k])
        d.ellipse([pp[i][0] - 4, pp[i][1] - 4, pp[i][0] + 4, pp[i][1] + 4], fill=col)
        k_ = [s_[0] for s_ in series].index(nm)
        d.text((pp[i][0] + 7, pp[i][1] - 14 + 15 * k_), "%s g%d %.2f" % (nm, f0 + i, tr[j]["velocidade_m_frame"][i]), fill=col, font=F3)
    lx = x0
    for nm, j, col in series:
        d.line([lx, p2[1] + 60, lx + 28, p2[1] + 60], fill=col, width=3)
        d.text((lx + 34, p2[1] + 52), nm, fill=(0, 0, 0), font=F3)
        lx += 110
    xticks(p2[1])
    # painel 3: fase dos pes
    p3 = (830, 930)
    d.text((x0, p3[0] - 30), "3) Fase dos pes (heuristica de altura + velocidade)", fill=(0, 0, 0), font=F2)
    for k, s in enumerate(("Left", "Right")):
        if s not in r["pes"]:
            continue
        y_a = p3[0] + k * 52
        d.text((x0 - 8, y_a + 14), "Pe E" if s == "Left" else "Pe D", fill=(0, 0, 0), font=F2, anchor="ra")
        for i in range(n):
            st = r["pes"][s]["estado_por_frame"].get(str(f0 + i), 2)
            d.rectangle([X(i), y_a, X(i + 1) if i < n - 1 else x1, y_a + 40], fill=[(60, 180, 90), (240, 200, 40), (90, 140, 230)][st])
    for c, nm, k in (((60, 180, 90), "apoiado", 0), ((240, 200, 40), "deslizando", 1), ((90, 140, 230), "no ar", 2)):
        lx = x0 + k * 150
        d.rectangle([lx, p3[1] + 52, lx + 16, p3[1] + 66], fill=c)
        d.text((lx + 22, p3[1] + 51), nm, fill=(0, 0, 0), font=F3)
    xticks(p3[1] - 5 + 52 - 52 + 5)
    d.text((x0, H - 28), "Medidas, nao julgamento artistico. g = frame autoral; t = frame do Blender (t = g + 1).", fill=(90, 90, 90), font=F3)
    img.save(path)

def cmd_corpus(a):
    """roda o resumo denso em varias actions (somente leitura) para calibrar limiares com clips reais"""
    blend = os.path.abspath(a.blend)
    out, tmp = prepare_out(a.out, a.overwrite)
    cfg = dict(mode="dense", action=a.actions[0], corpus=a.actions, offset=a.offset, armature=a.armature)
    h = run_blender(blend, cfg, tmp, out, "corpus", script="dense_inside.py")
    finish_out(out, tmp, a.overwrite)
    print("corpus gravado em", os.path.join(out, "corpus_report.json"), "| sha256 do .blend:", h[:16])


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("doctor"); d.set_defaults(fn=cmd_doctor)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--blend", required=True)
    common.add_argument("--armature")
    common.add_argument("--offset", type=int, default=0, help="frame_timeline = frame_autoral + offset")
    common.add_argument("--size", type=int, default=480)
    common.add_argument("--out", default=None)
    common.add_argument("--overwrite", action="store_true")
    s = sub.add_parser("shot", parents=[common])
    s.add_argument("--action")
    s.add_argument("--frames", default="0", help="autorais: 14 | 1,5,9 | 0-40 | 0-40:4 | smart:12")
    s.add_argument("--views", default="front,side_nX,q3")
    s.add_argument("--modes", default="solid", help="solid,bones,bones_only,onion,contact,sil")
    s.add_argument("--align", default="hips", choices=["hips", "root", "none"])
    s.add_argument("--zoom", help="osso para aproximar")
    s.add_argument("--zoom-radius", default="0.45", dest="zoom_radius", help="lista em m, ex.: 0.6,0.25,0.12")
    s.add_argument("--bone-cam", action="store_true", dest="bone_cam", help="adiciona cameras alinhadas aos eixos do osso (bone_px/nx/pz/nz)")
    s.add_argument("--zoom-preset", choices=["hand"], dest="zoom_preset", help="hand: raios 0.6,0.25,0.12 + cameras do osso + resolucao 2x nos raios pequenos")
    s.add_argument("--cols", type=int, default=6)
    s.add_argument("--onion-step", type=int, default=1, dest="onion_step", help="distancia em frames do anterior/proximo no modo onion")
    s.add_argument("--custom-cameras", dest="custom_cameras", help="arquivo JSON com configuracoes de cameras customizadas")
    s.set_defaults(fn=cmd_shot)
    pr = sub.add_parser("pair", parents=[common])
    pr.add_argument("--action-a", required=True, dest="action_a")
    pr.add_argument("--action-b", required=True, dest="action_b")
    pr.add_argument("--frames", required=True)
    pr.add_argument("--views", default="front,side_nX,top")
    pr.set_defaults(fn=cmd_pair)
    ck = sub.add_parser("check", parents=[common])
    ck.add_argument("--action", required=True)
    ck.add_argument("--brief", help="JSON com as regras do briefing (ver briefs/)")
    ck.add_argument("--mode", choices=["oneshot", "loop"], help="tipo de animacao (oneshot desliga loop_seam); NAO altera o briefing")
    ck.add_argument("--baseline-action", dest="baseline_action", help="action de referencia para subtrair o falso positivo de base da interpenetracao")
    ck.add_argument("--only-problems", action="store_true", dest="only_problems")
    ck.set_defaults(fn=cmd_check, overwrite=True)
    sn = sub.add_parser("snap", parents=[common])
    sn.add_argument("--action", required=True)
    sn.add_argument("--label", required=True)
    sn.add_argument("--brief")
    sn.add_argument("--history")
    sn.add_argument("--mode", choices=["oneshot", "loop"]); sn.add_argument("--baseline-action", dest="baseline_action")
    sn.add_argument("--base", help="action-base explicita (padrao: nome da action sem _vNN/_footlock/_FT)")
    sn.set_defaults(fn=cmd_snap, overwrite=True, out="unused")
    hs = sub.add_parser("history")
    hs.add_argument("dir")
    hs.set_defaults(fn=cmd_history)
    cy = sub.add_parser("cycle", parents=[common])
    cy.add_argument("--action", required=True)
    cy.add_argument("--label", required=True)
    cy.add_argument("--brief")
    cy.add_argument("--history")
    cy.add_argument("--mode", choices=["oneshot", "loop"]); cy.add_argument("--baseline-action", dest="baseline_action")
    cy.add_argument("--prev-action", dest="prev_action")
    cy.add_argument("--pair-frames", default="0-40:5", dest="pair_frames")
    cy.add_argument("-n", type=int, default=8)
    cy.set_defaults(fn=cmd_cycle)
    fl = sub.add_parser("footlock", parents=[common])
    fl.add_argument("--action", required=True)
    fl.add_argument("--new-action", dest="new_action")
    fl.add_argument("--save-as", required=True, dest="save_as", help="NOVO .blend (copia); o de origem nunca e salvo")
    fl.add_argument("--overwrite-save-as", action="store_true", dest="overwrite_save_as", help="permite substituir um .blend de destino que ja existe (nunca o de origem)")
    fl.add_argument("--ranges", help='opcional, frames autorais: "Left:9-20;Right:0-8,25-30"')
    fl.set_defaults(fn=cmd_footlock)
    dn = sub.add_parser("dense", parents=[common])
    dn.add_argument("--action", required=True)
    dn.add_argument("--ref-action", dest="ref_action", help="action de referencia APROVADA pelo diretor, no mesmo .blend")
    dn.add_argument("--ref-profile", dest="ref_profile", help="perfil de ritmo salvo (--save-profile)")
    dn.add_argument("--criteria", help="JSON do diretor com faixas por medida (ver criteria/template.json)")
    dn.add_argument("--impact-window", dest="impact_window", help="janela de impacto DECLARADA pelo briefing, frames autorais, ex.: 9-13 (a ferramenta nao escolhe o frame de contato)")
    dn.add_argument("--save-profile", dest="save_profile", help="grava o perfil de ritmo medido desta action")
    dn.set_defaults(fn=cmd_dense)
    co = sub.add_parser("corpus", parents=[common])
    co.add_argument("--actions", nargs="+", required=True)
    co.set_defaults(fn=cmd_corpus)
    c = sub.add_parser("compare")
    c.add_argument("antes"); c.add_argument("depois")
    c.add_argument("--out", required=True)
    c.add_argument("--overwrite", action="store_true")
    c.add_argument("--allow-unlocked", action="store_true", dest="allow_unlocked")
    c.set_defaults(fn=cmd_compare)
    v = sub.add_parser("video")
    v.add_argument("dir"); v.add_argument("--view", default="side_nX"); v.add_argument("--mode", default="solid")
    v.add_argument("--fps", type=int, default=30); v.add_argument("--out", required=True)
    v.set_defaults(fn=cmd_video)
    a = p.parse_args()
    if a.cmd in ("shot", "pair", "check", "footlock", "cycle", "dense", "corpus") and not a.out:
        p.error("--out e obrigatorio para '%s'" % a.cmd)
    a.fn(a)


if __name__ == "__main__":
    main()
