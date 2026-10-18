"""Roda no Blender: cria uma NOVA versao do Tackle a partir da anterior. NUNCA salva o .blend de origem.

    blender -b ORIGEM.blend --python apply_fix.py -- config.json

cfg: {"src_action": "...", "new_action": "...", "fix": "caminho/fix.py", "save_as": "NOVO.blend", "offset": 1, "out": "pasta"}
O modulo de correcao define DESCRIPTION (str) e apply(ctx). A copia e gravada com save_as_mainfile(copy=True); recusa sobrescrever um arquivo existente.
Nao altera malha, pesos, hierarquia, nomes nem rest pose: so keyframes da action nova.
"""
import importlib.util
import json
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pose_lib as pl

cfg = json.load(open(sys.argv[sys.argv.index("--") + 1], encoding="utf-8"))
os.makedirs(cfg["out"], exist_ok=True)


def fail(msg):
    print("VISION_FAIL:", msg, flush=True)
    raise SystemExit(msg)


if os.path.exists(cfg["save_as"]):
    fail("o arquivo de destino ja existe (versoes anteriores nunca sao sobrescritas): " + cfg["save_as"])
arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
if len(arms) != 1:
    fail("esperava 1 armature, achei %d" % len(arms))
arm = arms[0]
if cfg["src_action"] not in bpy.data.actions:
    fail("action de origem '%s' nao existe" % cfg["src_action"])
if cfg["new_action"] in bpy.data.actions:
    fail("a action '%s' ja existe neste arquivo" % cfg["new_action"])
before_bones = [(b.name, b.parent.name if b.parent else None, tuple(round(x, 6) for x in b.head_local), tuple(round(x, 6) for x in b.tail_local)) for b in arm.data.bones]
before_mesh = {o.name: (len(o.data.vertices), sum(len(v.groups) for v in o.data.vertices)) for o in bpy.data.objects if o.type == "MESH" and o.modifiers}
act = pl.duplicate_action(cfg["src_action"], cfg["new_action"])
pl.assign(arm, act)
sc = bpy.context.scene
sc.render.fps = 30
sc.render.fps_base = 1.0
sc.frame_start, sc.frame_end = 1, 41
spec = importlib.util.spec_from_file_location("tackle_fix", cfg["fix"])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class Ctx:
    pass


ctx = Ctx()
ctx.arm, ctx.action, ctx.scene, ctx.pl, ctx.offset = arm, act, sc, pl, int(cfg.get("offset", 1))
ctx.log = []


def go(g):
    sc.frame_set(g + ctx.offset)
    bpy.context.view_layer.update()


ctx.go = go
mod.apply(ctx)
pl.assign(arm, act)
sc.frame_set(1)
# integridade do rig: hierarquia/rest/malha identicas
after_bones = [(b.name, b.parent.name if b.parent else None, tuple(round(x, 6) for x in b.head_local), tuple(round(x, 6) for x in b.tail_local)) for b in arm.data.bones]
after_mesh = {o.name: (len(o.data.vertices), sum(len(v.groups) for v in o.data.vertices)) for o in bpy.data.objects if o.type == "MESH" and o.modifiers}
if before_bones != after_bones or before_mesh != after_mesh:
    fail("a correcao alterou hierarquia/rest pose/malha (proibido)")
bpy.ops.wm.save_as_mainfile(filepath=cfg["save_as"], copy=True)
json.dump({"description": getattr(mod, "DESCRIPTION", ""), "log": ctx.log, "new_action": cfg["new_action"], "rig_intacto": True}, open(os.path.join(cfg["out"], "fix_log.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("VISION_OK fix", cfg["new_action"])
