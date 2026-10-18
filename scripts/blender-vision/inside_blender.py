"""Roda DENTRO do Blender (blender -b ARQUIVO --python inside_blender.py -- config.json).

cfg["mode"]: "shot" (capturas de uma action) ou "pair" (duas actions com camera travada e diffs).
Renderiza com Workbench headless; NAO salva o .blend (alteracoes so em memoria).

AVISO: nao e o viewport real do Blender. Camera, luz de estudio e chao/grade sao proprios da ferramenta.
"""
import bpy
import bmesh
import json
import math
import os
import sys
import numpy as np
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

cfg = json.load(open(sys.argv[sys.argv.index("--") + 1], encoding="utf-8"))
OUT = cfg["out"]
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
SIZE = int(cfg.get("size", 480))
OFFSET = int(cfg.get("offset", 0))
MODE = cfg.get("mode", "shot")


def fail(msg):
    print("VISION_FAIL:", msg, flush=True)
    raise SystemExit(msg)


# ------------------------------------------------------------------ armature / malhas (validado)
arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
if cfg.get("armature"):
    arm = bpy.data.objects.get(cfg["armature"])
    if arm is None or arm.type != 'ARMATURE':
        fail("armature '%s' nao existe. Disponiveis: %s" % (cfg["armature"], ", ".join(a.name for a in arms)))
else:
    if len(arms) != 1:
        fail("o arquivo tem %d armatures (%s); informe --armature" % (len(arms), ", ".join(a.name for a in arms) or "nenhum"))
    arm = arms[0]
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' and m.object == arm for m in o.modifiers)]
if not meshes:
    fail("nenhuma malha ligada ao armature %s" % arm.name)


def set_action(name):
    act = bpy.data.actions.get(name)
    if act is None:
        fail("action '%s' nao existe. Disponiveis: %s" % (name, ", ".join(sorted(a.name for a in bpy.data.actions))))
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = act
    try:
        arm.animation_data.action_slot = act.slots[0]
    except Exception:
        pass
    return act


if MODE == "shot":
    if cfg.get("action"):
        set_action(cfg["action"])
    cur_action = arm.animation_data.action if arm.animation_data and arm.animation_data.action else None
else:
    cur_action = set_action(cfg["actions"][0])

for o in bpy.data.objects:
    o.hide_render = True
for o in meshes:
    o.hide_render = False

sc.render.engine = 'BLENDER_WORKBENCH'
sc.render.resolution_x = SIZE
sc.render.resolution_y = SIZE
sc.render.resolution_percentage = 100
sc.render.film_transparent = False
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'
sc.display_settings.display_device = 'sRGB'
try:
    sc.view_settings.view_transform = 'Standard'
except Exception:
    pass
world = sc.world or bpy.data.worlds.new("VisionWorld")
sc.world = world
BG = (0.19, 0.20, 0.22)
world.color = BG
sh = sc.display.shading


def shading_normal():
    sh.light = 'STUDIO'
    sh.color_type = 'MATERIAL'
    sh.show_object_outline = True
    sh.object_outline_color = (0, 0, 0)
    sh.show_cavity = False
    sh.show_shadows = False
    sh.show_xray = False
    world.color = BG


shading_normal()


# ------------------------------------------------------------------ materiais e geometria auxiliar
def mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1.0)
    return m


M_FLOOR, M_GRID = mat("V_floor", (0.30, 0.31, 0.34)), mat("V_grid", (0.55, 0.56, 0.60))
BONE_MATS = [mat("V_boneC", (1.0, 0.85, 0.1)), mat("V_boneL", (1.0, 0.45, 0.05)), mat("V_boneR", (0.1, 0.8, 1.0)),
             mat("V_boneX", (0.9, 0.2, 0.9)), mat("V_pivot", (1.0, 1.0, 1.0))]
CONTACT_MATS = [mat("V_cLow", (0.1, 0.9, 0.2)), mat("V_cSlide", (1.0, 0.85, 0.0)), mat("V_cPen", (1.0, 0.1, 0.1)),
                mat("V_cAir", (0.25, 0.45, 1.0)), mat("V_cTrail", (0.8, 0.8, 0.8))]


def box(bm, c, sx, sy, sz, mi):
    x, y, z = c
    vs = [bm.verts.new((x + dx * sx, y + dy * sy, z + dz * sz)) for dx in (-1, 1) for dy in (-1, 1) for dz in (-1, 1)]
    for f in [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]:
        bm.faces.new([vs[i] for i in f]).material_index = mi


def new_obj(name, mats):
    ob = bpy.data.objects.new(name, bpy.data.meshes.new(name))
    sc.collection.objects.link(ob)
    for m_ in mats:
        ob.data.materials.append(m_)
    ob.hide_render = True
    return ob


floor_obs = []
bm = bmesh.new(); box(bm, (0, 0, -0.007), 3, 3, 0.006, 0)
me = bpy.data.meshes.new("V_floor"); bm.to_mesh(me); bm.free(); me.materials.append(M_FLOOR)
floor_obs.append(bpy.data.objects.new("V_floor", me))
bm = bmesh.new()
for i in range(-6, 7):
    w = 0.006 if i else 0.012
    box(bm, (i * 0.5, 0, 0.0), w, 3, 0.001, 0); box(bm, (0, i * 0.5, 0.0), 3, w, 0.001, 0)
me = bpy.data.meshes.new("V_grid"); bm.to_mesh(me); bm.free(); me.materials.append(M_GRID)
floor_obs.append(bpy.data.objects.new("V_grid", me))
for o in floor_obs:
    sc.collection.objects.link(o)
bones_ob = new_obj("V_bones", BONE_MATS)
bones_ob.show_in_front = True
contact_ob = new_obj("V_contact", CONTACT_MATS)
contact_ob.show_in_front = True


def bone_mat_index(name):
    n = name.replace("mixamorig:", "")
    if n.startswith("Tail") or n == "Crest":
        return 3
    return 1 if n.startswith("Left") else 2 if n.startswith("Right") else 0


def rebuild_bones():
    bm = bmesh.new()
    W = arm.matrix_world
    for pb in arm.pose.bones:
        h, t = W @ pb.head, W @ pb.tail
        d = t - h
        L = d.length
        if L < 1e-5:
            continue
        dn = d / L
        ref = Vector((0, 0, 1)) if abs(dn.z) < 0.9 else Vector((1, 0, 0))
        u = dn.cross(ref).normalized(); v = dn.cross(u).normalized()
        w = max(0.006, 0.16 * L); mid = h + d * 0.14
        ring = [bm.verts.new(mid + u * w), bm.verts.new(mid + v * w), bm.verts.new(mid - u * w), bm.verts.new(mid - v * w)]
        vh, vt = bm.verts.new(h), bm.verts.new(t)
        mi = bone_mat_index(pb.name)
        for i in range(4):
            a, b = ring[i], ring[(i + 1) % 4]
            bm.faces.new((vh, b, a)).material_index = mi
            bm.faces.new((vt, a, b)).material_index = mi
        box(bm, tuple(h), 0.009, 0.009, 0.009, 4)
    bm.to_mesh(bones_ob.data); bm.free(); bones_ob.data.update()


# ------------------------------------------------------------------ camera
cam_data = bpy.data.cameras.new("V_cam")
cam = bpy.data.objects.new("V_cam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
cam_data.clip_start, cam_data.clip_end = 0.05, 200
cam_data.sensor_width = 36.0

# direcao alvo->camera. O personagem olha para -Y neste rig.
VIEWS = {
    "front": ((0, -1, 0), True, "frente (camera em -Y)"),
    "back": ((0, 1, 0), True, "tras (camera em +Y)"),
    "side_pX": ((1, 0, 0), True, "lado, camera em +X (lado ESQUERDO do personagem)"),
    "side_nX": ((-1, 0, 0), True, "lado, camera em -X (lado DIREITO do personagem)"),
    "top": ((0, 0, 1), True, "topo (frente do personagem para baixo da imagem)"),
    "q3": ((-0.7, -0.7, 0.42), False, "3/4 frente-direita"),
    "q3_left": ((0.7, -0.7, 0.42), False, "3/4 frente-esquerda"),
    "q3_back": ((-0.7, 0.7, 0.42), False, "3/4 tras-direita"),
}
BONE_VIEWS = {"bone_px": 0, "bone_nx": 1, "bone_pz": 2, "bone_nz": 3}     # camera nos eixos locais do osso; Y do osso para cima
ALL_VIEW_NAMES = list(VIEWS) + list(BONE_VIEWS)
VALID_MODES = ("solid", "bones", "bones_only", "onion", "contact", "sil", "ids")

# regioes para o passe de identificacao granular (cores chapadas); vermelho/laranja = lado direito, azul/ciano = esquerdo
ID_COLORS = {
    "palma_D": (1.0, 0.1, 0.1), "indicador_D": (1.0, 0.45, 0.05), "polegar_D": (1.0, 0.75, 0.1),
    "antebraco_D": (0.7, 0.0, 0.0), "braco_D": (0.45, 0.0, 0.0),
    "palma_E": (0.1, 0.4, 1.0), "indicador_E": (0.1, 0.7, 1.0), "polegar_E": (0.3, 0.9, 1.0),
    "antebraco_E": (0.0, 0.2, 0.7), "braco_E": (0.0, 0.1, 0.4),
    "pe_D": (0.2, 1.0, 0.2), "perna_D": (0.0, 0.5, 0.0), "pe_E": (0.0, 1.0, 1.0), "perna_E": (0.0, 0.5, 0.6),
    "tronco": (0.8, 0.8, 0.8), "cabeca": (1.0, 0.9, 0.1), "cauda_crista": (1.0, 0.2, 1.0),
    "alvo": (0.9, 0.1, 0.9), "mao_D": (1.0, 0.1, 0.1), "mao_E": (0.1, 0.4, 1.0),
}


def id_region(gname):
    n = gname.replace("mixamorig:", "")
    if n.startswith(("Tail", "Crest")):
        return "cauda_crista"
    if n.startswith(("Head", "Neck")):
        return "cabeca"
    for side, tag in (("Left", "E"), ("Right", "D")):
        if n.startswith(side):
            core = n[len(side):]
            if "Thumb" in core:
                return "polegar_" + tag
            if "Index" in core or "Finger" in core:
                return "indicador_" + tag
            if core.startswith("Hand"):
                return "palma_" + tag
            if core.startswith("ForeArm"):
                return "antebraco_" + tag
            if core.startswith(("Arm", "Shoulder")):
                return "braco_" + tag
            if core.startswith(("Foot", "Toe")):
                return "pe_" + tag
            if core.startswith(("UpLeg", "Leg")):
                return "perna_" + tag
    return "tronco"


def make_id_attributes():
    for ob in meshes:
        me = ob.data
        names = {g.index: g.name for g in ob.vertex_groups}
        cols = []
        for v in me.vertices:
            reg = id_region(names[max(v.groups, key=lambda g: g.weight).group]) if v.groups else "tronco"
            cols.extend(list(ID_COLORS[reg]) + [1.0])
        ca = me.color_attributes.get("V_ids") or me.color_attributes.new("V_ids", 'FLOAT_COLOR', 'POINT')
        ca.data.foreach_set("color", cols)
        me.color_attributes.active_color = ca
        me.color_attributes.render_color_index = list(me.color_attributes).index(ca)
for v in cfg.get("views", []):
    if v not in ALL_VIEW_NAMES:
        fail("vista invalida '%s'. Validas: %s" % (v, ", ".join(ALL_VIEW_NAMES)))
for m_ in cfg.get("modes", ["solid"]):
    if m_ not in VALID_MODES:
        fail("modo invalido '%s'. Validos: %s" % (m_, ", ".join(VALID_MODES)))


def aim(pos, target, up):
    z = (pos - target).normalized()
    x = up.cross(z)
    if x.length < 1e-6:
        x = Vector((1, 0, 0)).cross(z)
    x.normalize()
    y = z.cross(x)
    cam.location = pos
    cam.rotation_euler = Matrix(((x.x, y.x, z.x), (x.y, y.y, z.y), (x.z, y.z, z.z))).to_euler()


def bone_axes(bone_name):
    pb = arm.pose.bones.get(bone_name) or arm.pose.bones.get("mixamorig:" + bone_name)
    if pb is None:
        fail("osso '%s' nao existe" % bone_name)
    M = arm.matrix_world @ pb.matrix
    return pb, [M.col[0].to_3d().normalized(), M.col[1].to_3d().normalized(), M.col[2].to_3d().normalized()], M.translation.copy()


def place_camera(view, ctr, span, bone=None):
    """posiciona a camera; devolve dict com a convencao completa (para travar/validar comparacoes)"""
    custom_cams = cfg.get("custom_cameras", {})
    if view in BONE_VIEWS:
        pb, axes, _ = bone_axes(bone)
        k = BONE_VIEWS[view]
        sign = 1 if k in (0, 2) else -1
        dv = axes[0 if k < 2 else 2] * sign
        up = axes[1]
        ortho = True
    elif view in custom_cams:
        cinfo = custom_cams[view]
        dv = Vector(cinfo.get("direction", (0, -1, 0))).normalized()
        up = Vector(cinfo.get("up", (0, 0, 1)))
        ortho = cinfo.get("ortho", True)
        if "target" in cinfo:
            ctr = Vector(cinfo["target"])
        if "span" in cinfo:
            span = cinfo["span"]
        if "location" in cinfo:
            cam_loc = Vector(cinfo["location"])
            if ortho:
                cam_data.type = 'ORTHO'
                cam_data.ortho_scale = span
            else:
                cam_data.type = 'PERSP'
                cam_data.lens = cinfo.get("lens", 50)
            aim(cam_loc, ctr, up)
            return {"view": view, "type": cam_data.type, "ortho_scale": round(cam_data.ortho_scale, 4), "lens": cam_data.lens,
                    "center": [round(x, 4) for x in ctr], "location": [round(x, 4) for x in cam.location]}
    else:
        d, ortho, _ = VIEWS.get(view, ((0, -1, 0), True, view))
        dv = Vector(d).normalized()
        up = Vector((0, 1, 0)) if view == "top" else Vector((0, 0, 1))
    if ortho:
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = span
        aim(ctr + dv * (span * 3.0 + 1.0), ctr, up)
    else:
        cam_data.type = 'PERSP'
        cam_data.lens = 50
        aim(ctr + dv * (span * 1.55), ctr, up)
    return {"view": view, "type": cam_data.type, "ortho_scale": round(cam_data.ortho_scale, 4), "lens": cam_data.lens,
            "center": [round(x, 4) for x in ctr], "location": [round(x, 4) for x in cam.location]}


# ------------------------------------------------------------------ medicao
def world_bbox(dg):
    mn = Vector((1e9,) * 3)
    mx = Vector((-1e9,) * 3)
    for o in meshes:
        ev = o.evaluated_get(dg)
        for c in ev.bound_box:
            p = ev.matrix_world @ Vector(c)          # matriz avaliada (constraints/parentesco)
            mn = Vector((min(mn.x, p.x), min(mn.y, p.y), min(mn.z, p.z)))
            mx = Vector((max(mx.x, p.x), max(mx.y, p.y), max(mx.z, p.z)))
    return mn, mx


def pbone(n):
    return arm.pose.bones.get(n) or arm.pose.bones.get("mixamorig:" + n)


def hips_pos():
    b = pbone("Hips")
    return arm.matrix_world @ b.head if b else None


def ankle(side):
    b = pbone(side + "Foot")
    return arm.matrix_world @ b.head if b else None


def action_frames():
    act = arm.animation_data.action
    a, b = act.frame_range
    return list(range(int(round(a)), int(round(b)) + 1))


# ------------------------------------------------------------------ frames (inclui selecao inteligente)
def smart_frames(n, frames):
    J = ["Hips", "Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot"]
    P = {}
    for f in frames:
        sc.frame_set(f)
        P[f] = {j: arm.matrix_world @ pbone(j).head for j in J if pbone(j)}
    sp = {}
    for i, f in enumerate(frames):
        sp[f] = 0.0 if i == 0 else sum((P[f][j] - P[frames[i - 1]][j]).length for j in P[f])
    why = {frames[0]: ["inicio"], frames[-1]: ["fim"]}
    score = {f: 0.0 for f in frames}
    mxs = max(sp.values()) or 1.0

    def add(f, reason, s):
        why.setdefault(f, []).append(reason)
        score[f] += s
    for i in range(1, len(frames) - 1):
        f = frames[i]
        if sp[f] >= sp[frames[i - 1]] and sp[f] >= sp[frames[i + 1]] and sp[f] > 0.25 * mxs:
            add(f, "pico_velocidade", 3 * sp[f] / mxs)
        if sp[f] <= sp[frames[i - 1]] and sp[f] <= sp[frames[i + 1]] and sp[f] < 0.12 * mxs and i > 2:
            add(f, "pausa", 1.2)
        for j in ("LeftHand", "RightHand", "Head"):
            if j in P[f]:
                a = P[f][j] - P[frames[i - 1]][j]; b = P[frames[i + 1]][j] - P[f][j]
                if a.length > 0.03 and b.length > 0.03 and a.normalized().dot(b.normalized()) < -0.4:
                    add(f, "inversao_" + j, 2.0)
    for side in ("Left", "Right"):
        zs = [P[f][side + "Foot"].z for f in frames]
        lo = min(zs)
        low = [z < lo + 0.05 for z in zs]
        for i in range(1, len(frames)):
            if low[i] != low[i - 1]:
                add(frames[i], "contato_%s_%s" % (side, "inicio" if low[i] else "fim"), 2.5)
    for f in sorted(frames, key=lambda f: -sp[f])[:2]:
        add(f, "maior_mudanca", 1.5)
    chosen = [frames[0], frames[-1]]
    for f in sorted(score, key=lambda f: -score[f]):
        if len(chosen) >= n:
            break
        if score[f] > 0 and all(abs(f - c) >= 2 for c in chosen):
            chosen.append(f)
    k = 0
    while len(chosen) < n and k < len(frames):
        f = frames[int(k * (len(frames) - 1) / max(1, n - 1))]
        if f not in chosen:
            chosen.append(f); why.setdefault(f, []).append("preenchimento")
        k += 1
    chosen = sorted(set(chosen))[:max(n, 2)]
    return chosen, {str(f): why.get(f, []) for f in chosen}


def resolve_frames():
    spec = cfg.get("frames_spec")
    if spec and spec.startswith("smart:"):
        n = int(spec.split(":")[1])
        ch, why = smart_frames(n, action_frames())
        return ch, why
    return cfg["frames"], {}


# ------------------------------------------------------------------ render
TMP = os.path.join(OUT, "_tmp.png")


def render_png(path):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def load_arr(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(h, w, 4)


def save_arr(a, path):
    h, w = a.shape[:2]
    img = bpy.data.images.new("v_tmp", w, h, alpha=False)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :3] = a[:, :, :3]
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


FLOOR_ON = True      # desligado nas cameras alinhadas ao osso (podem ficar abaixo do chao)


def hide_helpers(show_floor=True):
    bones_ob.hide_render = True
    contact_ob.hide_render = True
    for o in floor_obs:
        o.hide_render = not (show_floor and FLOOR_ON)
    for o in meshes:
        o.hide_render = False


def render_mask():
    """silhueta binaria do personagem (True = personagem), camera atual"""
    old = (sh.light, sh.color_type, sh.show_object_outline, world.color[:])
    sh.light = 'FLAT'; sh.color_type = 'SINGLE'; sh.single_color = (0, 0, 0); sh.show_object_outline = False
    sh.show_xray = False
    world.color = (1, 1, 1)
    hide_helpers(show_floor=False)
    render_png(TMP)
    a = load_arr(TMP)
    sh.light, sh.color_type, sh.show_object_outline = old[0], old[1], old[2]
    world.color = old[3]
    hide_helpers(True)
    return a[:, :, 0] < 0.5


def render_solid(path):
    shading_normal()
    hide_helpers(True)
    render_png(path)


def render_bones(path):
    shading_normal()
    hide_helpers(True)
    sh.show_xray = True
    sh.xray_alpha = 0.22
    render_png(path)
    bones_ob.hide_render = False
    for o in meshes:
        o.hide_render = True
    for o in floor_obs:
        o.hide_render = True
    sh.show_xray = False
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = 'RGBA'
    render_png(TMP)
    base = load_arr(path)
    ov = load_arr(TMP)
    al = ov[:, :, 3:4]
    out = base.copy()
    out[:, :, :3] = ov[:, :, :3] * al + base[:, :, :3] * (1 - al)
    save_arr(out, path)
    sc.render.film_transparent = False
    sc.render.image_settings.color_mode = 'RGB'
    shading_normal()
    hide_helpers(True)


def render_bones_only(path):
    shading_normal()
    bones_ob.hide_render = False
    for o in meshes:
        o.hide_render = True
    render_png(path)
    hide_helpers(True)


# ---- contato com o chao
FOOT = {}


FOOT_VERTS = {}


def foot_vertex_sets():
    """vertices da malha cujo grupo dominante (peso >= 0.5) e o pe/ponta do pe de cada lado: o contato com o chao usa ESTES vertices,
    nao a malha inteira (cauda, mao ou crista abaixo do chao nao devem classificar o pe como penetrando)"""
    for side in ("Left", "Right"):
        FOOT_VERTS[side] = []
        for m in meshes:
            names = {g.index: g.name.replace("mixamorig:", "") for g in m.vertex_groups}
            idx = []
            for v in m.data.vertices:
                if not v.groups:
                    continue
                g = max(v.groups, key=lambda x: x.weight)
                nm = names.get(g.group, "")
                if g.weight >= 0.5 and nm.startswith(side) and ("Foot" in nm[len(side):] or "Toe" in nm[len(side):]):
                    idx.append(v.index)
            if idx:
                FOOT_VERTS[side].append((m, idx))


def foot_min_z(side, dg):
    """menor z de mundo dos vertices do pe (None se o rig nao tem grupos de pe: o chamador cai para a malha inteira e isso e declarado)"""
    if not FOOT_VERTS.get(side):
        return None
    z = 1e9
    for m, idx in FOOT_VERTS[side]:
        ev = m.evaluated_get(dg)
        me = ev.to_mesh()
        if len(me.vertices) != len(m.data.vertices):
            ev.to_mesh_clear()
            return None
        mw = ev.matrix_world
        z = min(z, min((mw @ me.vertices[i].co).z for i in idx))
        ev.to_mesh_clear()
    return z


def foot_prepass(frames):
    foot_vertex_sets()
    for side in ("Left", "Right"):
        FOOT[side] = {}
    for f in frames:
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        mn, _ = world_bbox(dg)
        for side in ("Left", "Right"):
            a = ankle(side)
            fz = foot_min_z(side, dg)
            FOOT[side][f] = (a.copy(), mn.z if fz is None else fz)
    for side in ("Left", "Right"):
        zs = [FOOT[side][f][0].z for f in frames]
        lo = min(zs)
        st = {}
        for i, f in enumerate(frames):
            a, zmin = FOOT[side][f]
            sp = 0.0 if i == 0 else math.hypot(a.x - FOOT[side][frames[i - 1]][0].x, a.y - FOOT[side][frames[i - 1]][0].y)
            low = a.z < lo + 0.05
            other = FOOT["Right" if side == "Left" else "Left"][f][0].z
            if zmin < -0.02 and (FOOT_VERTS.get(side) or a.z <= other):
                state = 2          # penetrando: vertice do PROPRIO pe abaixo do chao (sem grupos de pe: malha inteira + tornozelo mais baixo, como antes)
            elif low and sp >= 0.012:
                state = 1
            elif low:
                state = 0
            else:
                state = 3
            st[f] = (state, sp)
        FOOT[side] = {f: (FOOT[side][f][0], st[f][0], st[f][1]) for f in frames}


def build_contact(frame, frames):
    bm = bmesh.new()
    for side in ("Left", "Right"):
        for f in frames:
            if f > frame:
                break
            a, state, sp = FOOT[side][f]
            if f == frame:
                box(bm, (a.x, a.y, 0.03), 0.07, 0.07, 0.03, state)
            else:
                box(bm, (a.x, a.y, 0.004), 0.012, 0.012, 0.004, 4)
    bm.to_mesh(contact_ob.data); bm.free(); contact_ob.data.update()


# ------------------------------------------------------------------ montagem de itens
manifest = {
    "blend": cfg["blend"], "armature": arm.name, "meshes": [m.name for m in meshes], "mode_run": MODE,
    "engine": "BLENDER_WORKBENCH", "size": SIZE, "offset": OFFSET,
    "frame_note": "frame_autoral = frame_timeline - offset",
    "render_note": "Workbench headless, NAO e o viewport real do Blender. Camera, luz e grade de chao sao proprias da ferramenta.",
    "views": {}, "items": [], "extra": {},
}

# ================================================================== SHOT
if MODE == "shot":
    frames, why = resolve_frames()
    frames = [f for f in frames]
    manifest["action"] = cur_action.name if cur_action else None
    manifest["smart_reasons"] = why
    align = cfg.get("align", "hips")
    if align not in ("none", "hips", "root"):
        fail("--align invalido: %s" % align)
    manifest["align"] = align
    # pre-passada: bbox por frame, hips, tamanho global
    bb, hp = {}, {}
    Smax = 0.0
    for f in frames:
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        bb[f] = world_bbox(dg)
        hp[f] = hips_pos()
        Smax = max(Smax, (bb[f][1] - bb[f][0]).length)
    zmid = sum((bb[f][0].z + bb[f][1].z) * 0.5 for f in frames) / len(frames)
    gcenter = Vector((sum((bb[f][0].x + bb[f][1].x) * 0.5 for f in frames) / len(frames),
                      sum((bb[f][0].y + bb[f][1].y) * 0.5 for f in frames) / len(frames), zmid))
    manifest["scale_ref_m"] = round(Smax, 3)
    manifest["camera_policy"] = "alinhamento=%s; escala e lente fixas para todos os frames" % align
    modes = cfg.get("modes", ["solid"])
    views = cfg.get("views", ["front"])
    zoom = cfg.get("zoom")
    radii = cfg.get("zoom_radii") or ([cfg.get("zoom_radius", 0.45)] if zoom else [None])
    ALLF = action_frames()
    if "contact" in modes:
        foot_prepass(ALLF)          # velocidade calculada entre frames CONSECUTIVOS da action (nao entre os frames escolhidos)
    for v in views:
        manifest["views"][v] = VIEWS[v][2] if v in VIEWS else "camera alinhada ao osso '%s' (%s)" % (zoom, v)
    perm_acc = {}
    for f in frames:
        sc.frame_set(f)
        bpy.context.view_layer.update()
        rebuild_bones()
        mn, mx = bb[f]
        if align == "none":
            ctr = gcenter
        elif align == "root":          # segue so o deslocamento horizontal do quadril; altura da camera fixa (o balanco vertical aparece)
            ctr = Vector((hp[f].x, hp[f].y, zmid))
        else:                          # hips: segue o quadril em x, y E z (cancela tambem o balanco vertical)
            h0 = hp[frames[0]] if hp.get(frames[0]) else hp[f]
            ctr = Vector((hp[f].x, hp[f].y, zmid + (hp[f].z - h0.z))) if hp[f] else Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, zmid))
        for rad in radii:
            for vname in views + ([bv for bv in BONE_VIEWS] if (cfg.get("bone_cam") and zoom) else []):
                if vname in BONE_VIEWS and not zoom:
                    continue
                if zoom:
                    pb, axes_, wpos = bone_axes(zoom)
                    hand_pts = [wpos, arm.matrix_world @ pb.tail]
                    for child in pb.children:
                        hand_pts.append(arm.matrix_world @ child.tail)
                        for gchild in child.children:
                            hand_pts.append(arm.matrix_world @ gchild.tail)
                    if len(hand_pts) > 2:
                        c2 = sum(hand_pts, Vector((0.0, 0.0, 0.0))) / len(hand_pts)
                        max_reach = max((p - c2).length for p in hand_pts)
                        span = max(rad * 2.2 if rad else max_reach * 2.5, max_reach * 2.2)
                    else:
                        c2, span = wpos + axes_[1] * (pb.length * 0.6), rad * 2.2
                else:
                    c2, span = ctr, Smax * 1.12
                camrec = place_camera(vname, c2, span, bone=zoom)
                FLOOR_ON = vname not in BONE_VIEWS
                res_mult = 2 if (rad is not None and rad <= 0.25) else 1          # zoom em mao/dedos: resolucao 2x
                sc.render.resolution_x = sc.render.resolution_y = SIZE * res_mult
                tag = "" if rad is None else "_z%d" % round(rad * 100)
                for mode in modes:
                    name = "%s_%s%s_t%03d_g%03d.png" % (vname, mode, tag, f, f - OFFSET)
                    path = os.path.join(OUT, name)
                    extra = {}
                    if mode == "solid":
                        render_solid(path)
                    elif mode == "bones":
                        render_bones(path)
                    elif mode == "bones_only":
                        render_bones_only(path)
                    elif mode == "ids":
                        if not manifest["extra"].get("ids_legend"):
                            make_id_attributes()
                            manifest["extra"]["ids_legend"] = {k: "#%02x%02x%02x" % tuple(int(c * 255) for c in v) for k, v in ID_COLORS.items()}
                        old_ids = (sh.light, sh.color_type, sh.show_object_outline)
                        sh.light = 'FLAT'; sh.color_type = 'VERTEX'; sh.show_object_outline = False; sh.show_xray = False
                        hide_helpers(False)
                        render_png(path)
                        sh.light, sh.color_type, sh.show_object_outline = old_ids
                        hide_helpers(True)
                    elif mode == "sil":
                        m = render_mask()
                        a = np.ones(m.shape + (3,), dtype=np.float32)
                        a[m] = 0.05
                        save_arr(a, path)
                        key = (vname, tag)
                        perm_acc.setdefault(key, []).append(m.astype(np.float32))
                    elif mode == "contact":
                        shading_normal(); hide_helpers(True)
                        build_contact(f, ALLF)
                        contact_ob.hide_render = False
                        render_png(path)
                        contact_ob.hide_render = True
                        extra = {"pe_esq": ["no_chao_parado", "deslizando", "penetrando", "no_ar"][FOOT["Left"][f][1]],
                                 "pe_dir": ["no_chao_parado", "deslizando", "penetrando", "no_ar"][FOOT["Right"][f][1]]}
                    elif mode == "onion":
                        af = action_frames()
                        st_ = int(cfg.get("onion_step", 1))
                        fp = max(af[0], f - st_); fn = min(af[-1], f + st_)       # frames CONSECUTIVOS reais (nao os vizinhos da lista)
                        masks = {}
                        for ff in (fp, fn):
                            sc.frame_set(ff)
                            masks[ff] = render_mask()
                        sc.frame_set(f)
                        render_solid(TMP)
                        base = load_arr(TMP)[:, :, :3]
                        out = base * 0.55
                        cur = render_mask()      # silhueta REAL do frame atual (nao diferenca de cor: gerava borda vermelha falsa)
                        mp, mn_ = masks[fp] & ~cur, masks[fn] & ~cur
                        out[mp] = out[mp] * 0.45 + np.array([0.20, 0.45, 1.0], dtype=np.float32) * 0.55
                        out[mn_] = out[mn_] * 0.45 + np.array([1.0, 0.25, 0.20], dtype=np.float32) * 0.55
                        out[cur] = base[cur]
                        save_arr(out, path)
                        extra = {"anterior_azul": fp - OFFSET, "proximo_vermelho": fn - OFFSET}
                    sc.frame_set(f)
                    manifest["items"].append({
                        "file": name, "view": vname, "mode": mode, "frame_timeline": f, "frame_autoral": f - OFFSET,
                        "zoom": zoom, "zoom_radius_m": rad, "camera": camrec, "bbox_min_z_m": round(mn.z, 3),
                        "bbox_size_m": [round(x, 3) for x in (mx - mn)], **extra})
    # mapa de permanencia (densidade de silhuetas)
    for (vname, tag), lst in perm_acc.items():
        dens = np.mean(lst, axis=0)
        cols = np.zeros(dens.shape + (3,), dtype=np.float32)
        t = dens[..., None]
        cols[:] = (1 - t) * np.array([0.05, 0.05, 0.10], dtype=np.float32) + t * np.array([1.0, 0.95, 0.4], dtype=np.float32)
        cols[dens > 0.85] = np.array([1.0, 1.0, 1.0], dtype=np.float32)
        pth = "permanence_%s%s.png" % (vname, tag)
        save_arr(cols, os.path.join(OUT, pth))
        manifest["extra"].setdefault("permanence", []).append({"file": pth, "view": vname, "frames": len(lst),
                                                               "leitura": "branco = quase sempre ocupado (congelado); amarelo = rastros de movimento"})
    if "contact" in modes:
        manifest["extra"]["contact_legend"] = "verde=no chao e parado, amarelo=no chao deslizando, vermelho=penetrando, azul=no ar, pontos cinza=trilha no piso"

# ================================================================== PAIR
elif MODE == "pair":
    A, B = cfg["actions"]
    frames_auth = cfg["frames"]
    frames = [f + OFFSET for f in frames_auth] if not cfg.get("frames_are_timeline") else frames_auth
    views = cfg.get("views", ["front", "side_nX", "top"])
    camera_modes = ["global", "hips"]
    data = {}
    for nm in (A, B):
        set_action(nm)
        d = {"bbox": {}, "hips": {}, "joints": {}}
        for f in frames:
            sc.frame_set(f)
            dg = bpy.context.evaluated_depsgraph_get()
            d["bbox"][f] = world_bbox(dg)
            d["hips"][f] = hips_pos().copy()
            d["joints"][f] = {pb.name: (arm.matrix_world @ pb.head).copy() for pb in arm.pose.bones}
        data[nm] = d
    Smax = max((data[n]["bbox"][f][1] - data[n]["bbox"][f][0]).length for n in (A, B) for f in frames)
    zmid = sum((data[n]["bbox"][f][0].z + data[n]["bbox"][f][1].z) * 0.5 for n in (A, B) for f in frames) / (2 * len(frames))
    gx = sum((data[n]["bbox"][f][0].x + data[n]["bbox"][f][1].x) * 0.5 for n in (A, B) for f in frames) / (2 * len(frames))
    gy = sum((data[n]["bbox"][f][0].y + data[n]["bbox"][f][1].y) * 0.5 for n in (A, B) for f in frames) / (2 * len(frames))
    gcenter = Vector((gx, gy, zmid))
    span = Smax * 1.12
    manifest.update({"actions": [A, B], "camera_policy": "mesma lente, mesma escala (%.3f m) e mesmo centro global nas duas actions; no modo 'hips' cada action e centrada no proprio quadril" % span,
                     "camera_modes": camera_modes, "scale_ref_m": round(Smax, 3)})
    for v in views:
        manifest["views"][v] = VIEWS[v][2]
    # diff de juntas (metros), global e alinhado pelo quadril
    jd = {}
    for pbn in data[A]["joints"][frames[0]]:
        g_, h_ = [], []
        for f in frames:
            pa, pb_ = data[A]["joints"][f][pbn], data[B]["joints"][f][pbn]
            g_.append((pa - pb_).length)
            h_.append(((pa - data[A]["hips"][f]) - (pb_ - data[B]["hips"][f])).length)
        i1 = int(np.argmax(g_)); i2 = int(np.argmax(h_))
        jd[pbn.replace("mixamorig:", "")] = {"global_media_m": round(float(np.mean(g_)), 4), "global_max_m": round(float(max(g_)), 4), "global_max_frame": frames_auth[i1],
                                             "alinhado_media_m": round(float(np.mean(h_)), 4), "alinhado_max_m": round(float(max(h_)), 4), "alinhado_max_frame": frames_auth[i2]}
    manifest["extra"]["joint_diff_m"] = jd
    manifest["extra"]["joint_diff_top_alinhado"] = sorted(jd, key=lambda k: -jd[k]["alinhado_max_m"])[:10]
    manifest["extra"]["joint_diff_top_global"] = sorted(jd, key=lambda k: -jd[k]["global_max_m"])[:10]
    KEY = ["Hips", "Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot", "LeftForeArm", "RightForeArm", "LeftLeg", "RightLeg"]
    pxrec = {}
    for f in frames:
        for cm in camera_modes:
            for vname in views:
                imgs, masks, camrecs = {}, {}, {}
                for nm in (A, B):
                    set_action(nm)
                    sc.frame_set(f)
                    bpy.context.view_layer.update()
                    if cm == "global":
                        ctr = gcenter
                    else:
                        h = data[nm]["hips"][f]
                        ctr = Vector((h.x, h.y, zmid))
                    camrecs[nm] = place_camera(vname, ctr, span)
                    pth = os.path.join(OUT, "%s_%s_%s_t%03d_g%03d.png" % (cm, "A", vname, f, f - OFFSET)) if nm == A else os.path.join(OUT, "%s_%s_%s_t%03d_g%03d.png" % (cm, "B", vname, f, f - OFFSET))
                    render_solid(pth)
                    imgs[nm] = load_arr(pth)[:, :, :3]
                    masks[nm] = render_mask()
                    if cm == "global":
                        for jn in KEY:
                            b = pbone(jn)
                            co = world_to_camera_view(sc, cam, arm.matrix_world @ b.head)
                            pxrec.setdefault((jn, vname), []).append((nm, f, np.array([co.x * SIZE, co.y * SIZE])))
                mA, mB = masks[A], masks[B]
                inter = float(np.logical_and(mA, mB).sum()); uni = float(np.logical_or(mA, mB).sum()) or 1.0
                diff = np.ones(mA.shape + (3,), dtype=np.float32) * 0.93
                diff[np.logical_and(mA, mB)] = 0.55
                diff[np.logical_and(mA, ~mB)] = np.array([0.85, 0.12, 0.15], dtype=np.float32)
                diff[np.logical_and(mB, ~mA)] = np.array([0.1, 0.6, 0.9], dtype=np.float32)
                dname = "%s_diff_%s_t%03d_g%03d.png" % (cm, vname, f, f - OFFSET)
                save_arr(diff, os.path.join(OUT, dname))
                rm = float(np.sqrt(np.mean((imgs[A] - imgs[B]) ** 2)))
                same_cam = camrecs[A]["center"] == camrecs[B]["center"] and camrecs[A]["ortho_scale"] == camrecs[B]["ortho_scale"] and camrecs[A]["lens"] == camrecs[B]["lens"]
                manifest["items"].append({
                    "file": dname, "view": vname, "mode": "pair_" + cm, "camera_mode": cm, "frame_timeline": f, "frame_autoral": f - OFFSET,
                    "A": "%s_A_%s_t%03d_g%03d.png" % (cm, vname, f, f - OFFSET), "B": "%s_B_%s_t%03d_g%03d.png" % (cm, vname, f, f - OFFSET),
                    "iou": round(inter / uni, 4), "area_so_A_px": int(np.logical_and(mA, ~mB).sum()), "area_so_B_px": int(np.logical_and(mB, ~mA).sum()),
                    "area_comum_px": int(inter), "rmse_normalizado_0_1": round(rm, 4), "camera_identica_nas_duas": bool(same_cam) if cm == "global" else None,
                    "camera": camrecs[A]})
    # diff de esqueleto projetado (pixels, camera global travada)
    sk = {}
    for (jn, vname), lst in pxrec.items():
        byf = {}
        for nm, f, p in lst:
            byf.setdefault(f, {})[nm] = p
        ds = [float(np.linalg.norm(v[A] - v[B])) for v in byf.values() if A in v and B in v]
        sk.setdefault(jn, {})[vname] = {"media_px": round(float(np.mean(ds)), 1), "max_px": round(float(max(ds)), 1)}
    manifest["extra"]["skeleton_px_diff"] = sk
    manifest["extra"]["skeleton_px_top"] = sorted(sk, key=lambda j: -max(v["max_px"] for v in sk[j].values()))[:8]

if cfg.get("_selftest_touch"):      # so para testar a deteccao de alteracao do .blend; nunca usar em producao
    open(cfg["blend"], "ab").write(b"\0")
if os.path.exists(TMP):
    os.remove(TMP)
with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, indent=1, ensure_ascii=False)
print("VISION_OK", len(manifest["items"]), "imagens")
