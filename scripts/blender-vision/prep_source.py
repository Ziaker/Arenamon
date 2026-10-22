#!/usr/bin/env python
"""Gera uma COPIA DERIVADA e descartavel (.blend) a partir de um GLB/FBX autoral, para as ferramentas do blender-vision
(que recebem --blend). O arquivo de origem nunca e alterado (SHA-256 conferido antes/depois).

  python scripts/blender-vision/prep_source.py --src chars/mosh/Cogumelo.glb --out %TEMP%/arenamon-vision/mosh_source.blend \
      [--time-scale 1.25] [--drop Icosphere]

Normalizacao de tempo (so na copia): o glTF do Cogumelo foi importado a 24 fps, mas os clipes Mixamo sao de 30 fps
(tecla autoral f vira o frame 0,8*f). `--time-scale 1.25` devolve a base autoral (f = 1..N); a cena passa a 30 fps.
A equivalencia e verificada pelo comando `verify-time` com as posicoes do quadril do FBX original.
Um relatorio `<out>.prep.json` registra origem, hashes, objetos removidos e a escala aplicada.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER = os.environ.get("BLENDER_EXE", r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe")


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for ch in iter(lambda: f.read(1 << 20), b""):
            h.update(ch)
    return h.hexdigest()


def inside(argv):
    import bpy
    sys.path.insert(0, HERE)
    from vision_common import iter_fcurves
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--time-scale", type=float, default=1.0)
    ap.add_argument("--fps", type=int, default=0)
    ap.add_argument("--drop", nargs="*", default=[])
    a = ap.parse_args(argv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ext = os.path.splitext(a.src)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=a.src)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=a.src)
    else:
        raise SystemExit("formato nao suportado: " + ext)
    dropped = []
    for name in a.drop:
        o = bpy.data.objects.get(name)
        if o is not None:
            dropped.append({"nome": name, "tipo": o.type, "dim": [round(x, 4) for x in o.dimensions]})
            bpy.data.objects.remove(o, do_unlink=True)
    n_curves = 0
    if abs(a.time_scale - 1.0) > 1e-9:
        for act in bpy.data.actions:
            for fc in iter_fcurves(act):
                for k in fc.keyframe_points:
                    k.co[0] *= a.time_scale
                    k.handle_left[0] *= a.time_scale
                    k.handle_right[0] *= a.time_scale
                fc.update()
                n_curves += 1
    if a.fps:
        bpy.context.scene.render.fps = a.fps
    for act in bpy.data.actions:
        act.use_fake_user = True
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=a.out, copy=True)
    print("PREP_JSON" + json.dumps({
        "removidos": dropped, "fcurves_reescaladas": n_curves,
        "actions": {x.name: [round(v, 3) for v in x.frame_range] for x in bpy.data.actions},
        "fps": bpy.context.scene.render.fps}))


def main():
    try:
        import bpy  # noqa: F401
        inside(sys.argv[sys.argv.index("--") + 1:])
        return
    except ImportError:
        pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--time-scale", type=float, default=1.0)
    ap.add_argument("--fps", type=int, default=0)
    ap.add_argument("--drop", nargs="*", default=[])
    a = ap.parse_args()
    src, out = os.path.abspath(a.src), os.path.abspath(a.out)
    if not os.path.isfile(src):
        raise SystemExit("origem nao existe: " + src)
    before = sha(src)
    cmd = [BLENDER, "-b", "--factory-startup", "--python", os.path.abspath(__file__), "--", "--src", src, "--out", out,
           "--time-scale", str(a.time_scale), "--fps", str(a.fps)]
    if a.drop:
        cmd += ["--drop"] + a.drop
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900)
    prep = None
    for line in p.stdout.splitlines():
        if line.startswith("PREP_JSON"):
            prep = json.loads(line[len("PREP_JSON"):])
    if p.returncode != 0 or prep is None or not os.path.isfile(out):
        sys.stderr.write(p.stdout[-2000:] + p.stderr[-2000:])
        raise SystemExit("falha ao preparar a copia derivada")
    after = sha(src)
    if before != after:
        raise SystemExit("INTEGRIDADE: a origem mudou durante a preparacao")
    rep = {"origem": src, "origem_sha256": before, "origem_sha256_depois": after, "copia": out, "copia_sha256": sha(out),
           "time_scale": a.time_scale, **prep,
           "aviso": "copia derivada e descartavel; a origem nunca e gravada"}
    with open(out + ".prep.json", "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=2, ensure_ascii=False)
    print(json.dumps({k: rep[k] for k in ("copia", "origem_sha256", "removidos", "fps")}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
