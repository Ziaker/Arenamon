"""Confere um .blend montado: lista clipes e renderiza quadros de alguns deles (Workbench).

  blender.exe -b <arquivo.blend> --python conferir_blend.py -- <pasta_png> <clipe1> [clipe2 ...]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
saida, clipes = os.path.abspath(args[0]), args[1:]
os.makedirs(saida, exist_ok=True)

arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
print("[conferir] meshes:", len(meshes), "com armature:",
      sum(any(m.type == "ARMATURE" and m.object == arm for m in o.modifiers) for o in meshes))
for a in sorted(bpy.data.actions, key=lambda a: a.name):
    print("[conferir] clipe %-32s quadros %d-%d" % (a.name, *a.frame_range))
faltando = sorted({i.filepath for i in bpy.data.images if i.source == "FILE" and not os.path.exists(bpy.path.abspath(i.filepath))})
print("[conferir] imagens faltando:", len(faltando), faltando[:3])

sc = bpy.context.scene
sc.render.engine = sc.render.engine if os.environ.get("CONFERIR_MANTER_ENGINE") else "BLENDER_WORKBENCH"
sc.display.shading.color_type = "MATERIAL"
sc.render.resolution_x, sc.render.resolution_y = 480, 480
sc.render.image_settings.file_format = "PNG"

ad = arm.animation_data
for tr in ad.nla_tracks:
    tr.mute = True

cam_data = bpy.data.cameras.new("conferir_cam")
cam = bpy.data.objects.new("conferir_cam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
sun = bpy.data.objects.new("conferir_sol", bpy.data.lights.new("conferir_sol", "SUN"))
sc.collection.objects.link(sun)


def enquadrar():
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in meshes:
        ev = o.evaluated_get(dg)
        pts += [ev.matrix_world @ Vector(c) for c in ev.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    centro, raio = (lo + hi) / 2, (hi - lo).length / 2
    d = Vector((0.7, -1.0, 0.45)).normalized()
    cam.location = centro + d * raio * 2.6
    cam.rotation_euler = (centro - cam.location).to_track_quat("-Z", "Y").to_euler()


for nome in clipes:
    act = bpy.data.actions.get(nome)
    if not act:
        print("[conferir] clipe não existe:", nome)
        continue
    ad.action = act
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    sc.frame_set(f0)
    enquadrar()
    for k in range(4):
        f = f0 + round((f1 - f0) * k / 3)
        sc.frame_set(f)
        sc.render.filepath = os.path.join(saida, "%s_f%03d.png" % (nome, f))
        bpy.ops.render.render(write_still=True)
print("[conferir] renders em", saida)
