"""Roda DENTRO do Blender (headless). Percepcao ativa: visibilidade por regiao (raycast na malha deformada real), passes geometricos
(profundidade, normais, ids por pixel), renders Workbench com a regiao destacada, trilha de poses e contatos/penetracoes.

  blender -b ARQ.blend --python perception_inside.py -- CONFIG.json     (use perception.py; nao chame direto)

NUNCA salva o .blend. Tudo sai em JSON/PNG/NPZ na pasta `out` do config. Os passes vem da geometria real: nada e reconstruido.
Limites declarados no resultado: Workbench headless (nao e o viewport); ids por pixel = rotulo dominante de pesos por triangulo.
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import perception_geom as G  # noqa: E402

cfg = json.load(open(sys.argv[sys.argv.index("--") + 1], encoding="utf-8"))
OUT = cfg["out"]
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
OFFSET = int(cfg.get("offset", 0))
FLOOR_Z = float(cfg.get("floor_z", 0.0))
LABEL_IDX = {l: i for i, l in enumerate(G.LABELS)}
OTHER = len(G.LABELS)


def fail(msg):
    print("PERCEPTION_FAIL:", msg, flush=True)
    raise SystemExit(msg)


# ------------------------------------------------------------------ cena
arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
if cfg.get("armature"):
    arm = bpy.data.objects.get(cfg["armature"])
    if arm is None or arm.type != "ARMATURE":
        fail("armature '%s' nao existe. Disponiveis: %s" % (cfg["armature"], ", ".join(a.name for a in arms)))
else:
    if len(arms) != 1:
        fail("o arquivo tem %d armatures (%s); informe --armature" % (len(arms), ", ".join(a.name for a in arms) or "nenhum"))
    arm = arms[0]
meshes = [o for o in bpy.data.objects if o.type == "MESH" and any(m.type == "ARMATURE" and m.object == arm for m in o.modifiers)]
if not meshes:
    fail("nenhuma malha ligada ao armature %s" % arm.name)
act = bpy.data.actions.get(cfg["action"])
if act is None:
    fail("action '%s' nao existe. Disponiveis: %s" % (cfg["action"], ", ".join(sorted(a.name for a in bpy.data.actions))))
if arm.animation_data is None:
    arm.animation_data_create()
arm.animation_data.action = act
try:
    arm.animation_data.action_slot = act.slots[0]
except Exception:
    pass


def pbone(n):
    return arm.pose.bones.get(n) or arm.pose.bones.get("mixamorig:" + n)


def short(n):
    return n.replace("mixamorig:", "")


# rotulo dominante por vertice (por grupo de vertice -> rotulo da particao)
VLAB = {}
for m in meshes:
    gl = {g.index: G.label_of_bone(g.name) for g in m.vertex_groups}
    lab = np.full(len(m.data.vertices), OTHER, dtype=np.int16)
    for v in m.data.vertices:
        acc = {}
        for g in v.groups:
            l = gl.get(g.group)
            if l is not None:
                acc[l] = acc.get(l, 0.0) + g.weight
        if acc:
            lab[v.index] = LABEL_IDX[max(acc, key=acc.get)]
    VLAB[m.name] = lab


def at_frame(f):
    sc.frame_set(int(f) + OFFSET)
    return bpy.context.evaluated_depsgraph_get()


def eval_geometry(dg):
    """malha deformada do frame atual: V (n,3) mundo, N (n,3) normais mundo, T (m,3) triangulos, TL (m,) rotulos, VL (n,) rotulos"""
    Vs, Ns, Ts, TLs, VLs = [], [], [], [], []
    base = 0
    for m in meshes:
        ev = m.evaluated_get(dg)
        me = ev.to_mesh()
        n = len(me.vertices)
        co = np.empty(n * 3, dtype=np.float64)
        me.vertices.foreach_get("co", co)
        co = co.reshape(n, 3)
        nr = np.empty(n * 3, dtype=np.float64)
        me.vertex_normals.foreach_get("vector", nr)
        nr = nr.reshape(n, 3)
        mw = np.array(m.matrix_world, dtype=np.float64)
        w = co @ mw[:3, :3].T + mw[:3, 3]
        wn = nr @ np.linalg.inv(mw[:3, :3]).T
        wn /= np.maximum(np.linalg.norm(wn, axis=1, keepdims=True), 1e-9)
        me.calc_loop_triangles()
        nt = len(me.loop_triangles)
        tv = np.empty(nt * 3, dtype=np.int64)
        me.loop_triangles.foreach_get("vertices", tv)
        tv = tv.reshape(nt, 3)
        vl = VLAB[m.name]
        if len(vl) != n:  # modificadores que mudam a topologia: sem rotulo por vertice
            vl = np.full(n, OTHER, dtype=np.int16)
        tl = vl[tv]
        # rotulo do triangulo = maioria; empate -> primeiro vertice
        maj = tl[:, 0].copy()
        use1 = (tl[:, 1] == tl[:, 2]) & (tl[:, 0] != tl[:, 1])
        maj[use1] = tl[use1, 1]
        Vs.append(w); Ns.append(wn); Ts.append(tv + base); TLs.append(maj); VLs.append(vl)
        base += n
        ev.to_mesh_clear()
    return np.vstack(Vs), np.vstack(Ns), np.vstack(Ts), np.concatenate(TLs), np.concatenate(VLs)


FLOOR_ID = 253


def with_floor(V, T, TL):
    """acrescenta o plano do chao (z=FLOOR_Z, 40 m) a geometria de OCLUSAO: geometria abaixo do chao fica escondida no jogo e no render;
    ignorar o chao fazia a mao enterrada contar como 'visivel'. A amostragem de regioes continua usando so a malha do personagem."""
    n = len(V)
    q = np.array([(-20, -20, FLOOR_Z), (20, -20, FLOOR_Z), (20, 20, FLOOR_Z), (-20, 20, FLOOR_Z)], dtype=np.float64)
    V2 = np.vstack([V, q])
    T2 = np.vstack([T, [[n, n + 1, n + 2], [n, n + 2, n + 3]]])
    TL2 = np.concatenate([TL, [FLOOR_ID, FLOOR_ID]])
    return V2, T2, TL2


def label_name(lab):
    lab = int(lab)
    return "chao" if lab == FLOOR_ID else (G.LABELS[lab] if lab < OTHER else "other")


def build_bvh(V, T):
    return BVHTree.FromPolygons([tuple(v) for v in V], [tuple(int(i) for i in t) for t in T], all_triangles=True)


def joints_now():
    out = {}
    mw = arm.matrix_world
    for pb in arm.pose.bones:
        out[short(pb.name)] = list(mw @ pb.head)
    return out


def region_labels(region):
    return [LABEL_IDX[l] for l in G.QUERY_REGIONS[region]]


def view_by_name(name, cands):
    for c in cands:
        if c["name"] == name:
            return c
    fail("vista '%s' desconhecida. Candidatas: %s" % (name, ", ".join(c["name"] for c in cands)))


def frames_of(spec):
    fr = [int(x) for x in spec]
    if not fr:
        fail("lista de frames vazia")
    return fr


# ------------------------------------------------------------------ ops
def ref_candidates(ref_frame):
    at_frame(ref_frame)
    j = joints_now()
    for need in ("RightUpLeg", "LeftUpLeg"):
        if need not in j:
            fail("osso %s nao encontrado: nao ha como definir o referencial do corpo" % need)
    return G.body_frame(j), G.candidate_views(G.body_frame(j))


def op_info(op):
    frames = frames_of(op["frames"])
    frame, cands = ref_candidates(frames[0])
    dg = at_frame(frames[0])
    V, N, T, TL, VL = eval_geometry(dg)
    counts = {l: int((VL == i).sum()) for l, i in LABEL_IDX.items()}
    counts["other"] = int((VL == OTHER).sum())
    return {"op": "info", "body_frame": frame, "candidates": [c["name"] for c in cands], "label_vertex_counts": counts,
            "bones": [short(b.name) for b in arm.pose.bones], "meshes": [m.name for m in meshes],
            "frame_range_action": list(act.frame_range), "fps": sc.render.fps, "armature_scale": list(arm.scale)}


def surface_samples(V, T, TL, region, cap=600):
    """pontos na SUPERFICIE da regiao (triangulos dos rotulos pedidos, amostragem por area, semente fixa) e normais de face.
    Independe da quantidade de vertices: uma mao com 8 vertices tambem tem area para ser observada."""
    tri = T[np.isin(TL, region_labels(region))]
    if len(tri) == 0:
        return np.zeros((0, 3)), np.zeros((0, 3))
    a, b, c = V[tri[:, 0]], V[tri[:, 1]], V[tri[:, 2]]
    nrm = np.cross(b - a, c - a)
    area = np.linalg.norm(nrm, axis=1)
    ok = area > 1e-12
    tri, a, b, c, nrm, area = tri[ok], a[ok], b[ok], c[ok], nrm[ok], area[ok]
    rng = np.random.default_rng(12345)
    pick = rng.choice(len(tri), size=cap, p=area / area.sum())
    r1, r2 = rng.random(cap), rng.random(cap)
    s1 = np.sqrt(r1)
    P = a[pick] * (1 - s1)[:, None] + b[pick] * (s1 * (1 - r2))[:, None] + c[pick] * (s1 * r2)[:, None]
    Nn = nrm[pick] / np.linalg.norm(nrm[pick], axis=1, keepdims=True)
    return P, Nn


def visibility_for(view, frames, region):
    """por frame: fracao dos pontos VOLTADOS para a camera (da regiao) que a camera enxerga; quem oculta o resto; corte de quadro."""
    per, occl_hist = [], {}
    centroids, rels = [], []
    geo = {}
    for f in frames:
        geo[f] = eval_geometry(at_frame(f))
    basis = G.camera_basis(view["direction"])
    # escala unica para todos os frames (compara frames entre si), alvo = centroide da regiao no frame
    for f in frames:
        V, N, T, TL, VL = geo[f]
        pts = V[np.isin(VL, region_labels(region))]
        if len(pts) == 0:
            fail("regiao '%s' nao possui vertices neste rig (grupos de vertice sem os ossos esperados)" % region)
        c = pts.mean(axis=0)
        centroids.append(c)
        rels.append(pts - c)
    span = G.fit_span(np.vstack(rels)[:: max(1, len(np.vstack(rels)) // 4000)], basis)
    d = np.array(basis["dir"])
    D = 6.0
    for f, c in zip(frames, centroids):
        V, N, T, TL, VL = geo[f]
        Vo, To, TLo = with_floor(V, T, TL)
        bvh = build_bvh(Vo, To)
        allpts, allN = surface_samples(V, T, TL, region)
        u = (allpts - c) @ np.array(basis["right"]) / span
        v = (allpts - c) @ np.array(basis["up"]) / span
        clipped = float(np.mean((np.abs(u) > 0.5) | (np.abs(v) > 0.5)))
        facing = np.where(allN @ d > 0.05)[0]   # normais de face (enrolamento da malha): pressupoe normais para fora
        vis = 0
        for i in facing:
            p = allpts[i]
            o = Vector(p + d * D)
            hit = bvh.ray_cast(o, Vector(-d), D + 1.0)
            if hit[0] is None or hit[3] >= D - 0.006:
                vis += 1
            else:
                name = label_name(TLo[hit[2]])
                occl_hist[name] = occl_hist.get(name, 0) + 1
        per.append({"frame": f, "facing_points": int(len(facing)), "visible_points": int(vis),
                    "visible_frac": (round(vis / len(facing), 4) if len(facing) >= 8 else None), "clipped_frac": round(clipped, 4)})
    vals = [p["visible_frac"] for p in per if p["visible_frac"] is not None]
    tot_occ = sum(occl_hist.values()) or 1
    return {"name": view["name"], "direction": view["direction"], "span": span,
            "visible_min": (min(vals) if vals else None), "visible_mean": (float(np.mean(vals)) if vals else None),
            "frames_without_enough_facing_points": [p["frame"] for p in per if p["visible_frac"] is None],
            "clipped_max": max(p["clipped_frac"] for p in per),
            "occluded_by": {k: round(v / tot_occ, 3) for k, v in sorted(occl_hist.items(), key=lambda kv: -kv[1])},
            "per_frame": {p["frame"]: p for p in per}}


def op_probe(op):
    frames = frames_of(op["frames"])
    frame, cands = ref_candidates(frames[0])
    names = op.get("views") or [c["name"] for c in cands]
    res = [visibility_for(view_by_name(n, cands), frames, op["region"]) for n in names]
    return {"op": "probe", "region": op["region"], "frames": frames, "views": res}


def tint_attribute(region):
    """cor por vertice: regiao investigada em laranja, resto em cinza claro (so em memoria; o .blend nunca e salvo)"""
    sel = set(region_labels(region))
    for m in meshes:
        me = m.data
        vl = VLAB[m.name]
        for nm in list(me.color_attributes.keys()):
            if nm == "perc_region":
                me.color_attributes.remove(me.color_attributes[nm])
        ca = me.color_attributes.new("perc_region", "FLOAT_COLOR", "POINT")
        col = np.empty((len(me.vertices), 4), dtype=np.float32)
        col[:] = (0.74, 0.76, 0.80, 1.0)
        mask = np.isin(vl, list(sel)) if len(vl) == len(me.vertices) else np.zeros(len(me.vertices), bool)
        col[mask] = (1.0, 0.55, 0.12, 1.0)
        ca.data.foreach_set("color", col.ravel())
        me.color_attributes.active_color = ca
        try:
            me.color_attributes.render_color_index = list(me.color_attributes.keys()).index("perc_region")
        except Exception:
            pass


_setup_done = {}


def setup_render(size):
    if _setup_done.get("ok"):
        sc.render.resolution_x = sc.render.resolution_y = size
        return
    for o in bpy.data.objects:
        o.hide_render = True
    for m in meshes:
        m.hide_render = False
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    try:
        sc.view_settings.view_transform = "Standard"
    except Exception:
        pass
    world = sc.world or bpy.data.worlds.new("PercWorld")
    sc.world = world
    world.color = (0.19, 0.20, 0.22)
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.color_type = "VERTEX"
    sh.show_object_outline = True
    sh.object_outline_color = (0, 0, 0)
    sh.show_cavity = False
    sh.show_shadows = False
    sh.show_xray = False
    # chao: plano fino em FLOOR_Z, so referencia visual
    me = bpy.data.meshes.new("P_floor")
    me.from_pydata([(-4, -4, FLOOR_Z - 0.002), (4, -4, FLOOR_Z - 0.002), (4, 4, FLOOR_Z - 0.002), (-4, 4, FLOOR_Z - 0.002)], [], [(0, 1, 2, 3)])
    fl = bpy.data.objects.new("P_floor", me)
    sc.collection.objects.link(fl)
    fl.hide_render = False
    _setup_done["floor"] = fl
    cd = bpy.data.cameras.new("P_cam")
    cam = bpy.data.objects.new("P_cam", cd)
    sc.collection.objects.link(cam)
    cd.type = "ORTHO"
    cd.clip_start, cd.clip_end = 0.05, 60
    sc.camera = cam
    _setup_done["cam"] = cam
    _setup_done["cd"] = cd
    _setup_done["ok"] = True


def place_cam(basis, target, span):
    cam, cd = _setup_done["cam"], _setup_done["cd"]
    cd.ortho_scale = span
    d = Vector(basis["dir"])
    R = Matrix(((basis["right"][0], basis["up"][0], d[0]), (basis["right"][1], basis["up"][1], d[1]), (basis["right"][2], basis["up"][2], d[2])))
    cam.matrix_world = Matrix.Translation(Vector(target) + d * 6.0) @ R.to_4x4()


def raycast_passes(bvh, V, TL, basis, target, span, n):
    """profundidade (m, do plano da camera), normais (mundo) e rotulos por pixel, a partir do raio real na malha"""
    d = Vector(basis["dir"])
    right, up = Vector(basis["right"]), Vector(basis["up"])
    origin0 = Vector(target) + d * 6.0
    depth = np.full((n, n), np.nan, dtype=np.float32)
    nrm = np.zeros((n, n, 3), dtype=np.float32)
    ids = np.full((n, n), 255, dtype=np.uint8)
    for iy in range(n):
        v = (0.5 - (iy + 0.5) / n) * span
        for ix in range(n):
            u = ((ix + 0.5) / n - 0.5) * span
            o = origin0 + right * u + up * v
            hit = bvh.ray_cast(o, -d, 12.0)
            if hit[0] is not None:
                depth[iy, ix] = hit[3]
                nrm[iy, ix] = hit[1]
                lab = int(TL[hit[2]])
                ids[iy, ix] = lab if lab < OTHER else (253 if lab == FLOOR_ID else 254)
    return depth, nrm, ids


def op_observe(op):
    frames = frames_of(op["frames"])
    frame, cands = ref_candidates(frames[0])
    size = int(op.get("size", 360))
    pn = int(op.get("pass_res", 112))
    setup_render(size)
    tint_attribute(op["region"])
    res = []
    for vname in op["views"]:
        view = view_by_name(vname, cands)
        meas = visibility_for(view, frames, op["region"])
        basis = G.camera_basis(view["direction"])
        span = meas["span"]
        files = []
        for f in frames:
            dg = at_frame(f)
            V, N, T, TL, VL = eval_geometry(dg)
            pts = V[np.isin(VL, region_labels(op["region"]))]
            c = pts.mean(axis=0)
            place_cam(basis, c, span)
            png = os.path.join(OUT, "rgb_%s_%s_g%03d.png" % (op["region"], vname, f))
            sc.render.filepath = png
            bpy.ops.render.render(write_still=True)
            rec = {"frame": f, "rgb": os.path.basename(png), "target": [float(x) for x in c], "span": span}
            if op.get("passes", True):
                Vo, To, TLo = with_floor(V, T, TL)
                bvh = build_bvh(Vo, To)
                depth, nrm, ids = raycast_passes(bvh, Vo, TLo, basis, c, span, pn)
                np.savez_compressed(os.path.join(OUT, "passes_%s_%s_g%03d.npz" % (op["region"], vname, f)), depth=depth, normal=nrm, ids=ids)
                rec["passes"] = "passes_%s_%s_g%03d.npz" % (op["region"], vname, f)
                reg_ids = region_labels(op["region"])
                tot = int(np.isin(ids, reg_ids).sum())
                rec["region_pixels"] = tot
            files.append(rec)
        meas["images"] = files
        res.append(meas)
    return {"op": "observe", "region": op["region"], "frames": frames, "views": res, "pass_res": pn, "render_size": size}


def op_pose(op):
    frames = frames_of(op["frames"])
    joints, quats, scales, blen, com = {}, {}, {}, {}, []
    label_minz = {l: [] for l in G.LABELS}
    label_bbox = {l: [] for l in G.LABELS}
    mw = arm.matrix_world
    for f in frames:
        dg = at_frame(f)
        for pb in arm.pose.bones:
            n = short(pb.name)
            joints.setdefault(n, []).append([round(float(x), 6) for x in (mw @ pb.head)])
            q = (mw @ pb.matrix).to_quaternion()
            quats.setdefault(n, []).append([round(float(x), 6) for x in q])
            scales.setdefault(n, []).append([round(float(x), 6) for x in pb.scale])
            blen.setdefault(n, []).append(round(float((mw @ pb.tail - mw @ pb.head).length), 6))
        V, N, T, TL, VL = eval_geometry(dg)
        com.append([round(float(x), 6) for x in V.mean(axis=0)])
        for l, i in LABEL_IDX.items():
            pts = V[VL == i]
            if len(pts):
                label_minz[l].append(round(float(pts[:, 2].min()), 6))
                label_bbox[l].append([round(float(x), 6) for x in (pts.max(axis=0) - pts.min(axis=0))])
            else:
                label_minz[l].append(None)
                label_bbox[l].append(None)
    from vision_common import iter_fcurves
    keys = sorted({int(round(k.co[0])) - OFFSET for fc in iter_fcurves(act) for k in fc.keyframe_points})
    return {"op": "pose", "frames": frames, "fps": sc.render.fps, "key_frames": keys, "joints": joints, "quat": quats, "pose_scale": scales, "bone_length": blen,
            "mesh_centroid": com, "label_min_z": label_minz, "label_bbox": label_bbox, "floor_z": FLOOR_Z,
            "aviso": "mesh_centroid e a media dos vertices (proxy de centro de massa, nao massa real)"}


def op_contacts(op):
    """interpenetracao e distancia entre rotulos (pares), com dois testes independentes; sempre HIPOTESE de contato"""
    frames = frames_of(op["frames"])
    pairs = op["pairs"]
    out = []
    # 14 direcoes (6 eixos + 8 diagonais): "cercado" = TODAS bloqueadas pela malha vizinha. Nao depende de orientacao de normais nem de
    # faces coincidentes (paridade de raios falha em malhas vizinhas justapostas); em malha ABERTA os raios escapam e a fracao cai (conservador).
    axes = [Vector(a).normalized() for a in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)) ] +            [Vector((sx, sy, sz)).normalized() for sx in (1, -1) for sy in (1, -1) for sz in (1, -1)]
    for f in frames:
        V, N, T, TL, VL = eval_geometry(at_frame(f))
        row = {"frame": f, "pairs": {}}
        for a, b in pairs:
            ia, ib = LABEL_IDX[a], LABEL_IDX[b]
            tb = T[TL == ib]
            pa = np.where(VL == ia)[0]
            if len(tb) == 0 or len(pa) == 0:
                row["pairs"]["%s|%s" % (a, b)] = {"erro": "rotulo sem geometria"}
                continue
            if len(pa) > 400:
                pa = pa[np.linspace(0, len(pa) - 1, 400).astype(int)]
            bvh = build_bvh(V, tb)
            e = np.sort(np.concatenate([tb[:, [0, 1]], tb[:, [1, 2]], tb[:, [2, 0]]]), axis=1)
            open_edges = int((np.unique(e, axis=0, return_counts=True)[1] == 1).sum())
            inside_n, inside_p, depths, mind = 0, 0, [], 1e9
            for i in pa:
                p = Vector(V[i])
                loc, nrm, idx, dist = bvh.find_nearest(p, 1.0)
                if loc is None:
                    continue
                mind = min(mind, dist)
                sgn_in = (p - loc).dot(nrm) < 0
                if sgn_in:
                    inside_n += 1
                    depths.append(dist)
                if all(bvh.ray_cast(p + ax * 1e-5, ax, 5.0)[0] is not None for ax in axes):
                    inside_p += 1
            n = len(pa)
            row["pairs"]["%s|%s" % (a, b)] = {"samples": int(n), "inside_normal_frac": round(inside_n / n, 4), "inside_enclosed_frac": round(inside_p / n, 4),
                                               "max_inside_depth_m": round(float(max(depths)) if depths else 0.0, 5), "min_distance_m": round(float(mind), 5),
                                               "malha_vizinha_arestas_abertas": open_edges}
        out.append(row)
    return {"op": "contacts", "frames": frames, "rows": out,
            "aviso": "normal assinada e cercado-por-raios dependem de a malha vizinha ser fechada (a primeira tambem de ter normais para fora): tratar como HIPOTESE ate confirmar em imagem"}


OPS = {"info": op_info, "probe": op_probe, "observe": op_observe, "pose": op_pose, "contacts": op_contacts}
results = []
for op in cfg["ops"]:
    if op["op"] not in OPS:
        fail("op '%s' desconhecida (%s)" % (op["op"], ", ".join(OPS)))
    results.append(OPS[op["op"]](op))
with open(os.path.join(OUT, "perception_result.json"), "w", encoding="utf-8") as fh:
    json.dump({"results": results, "blend": bpy.data.filepath, "action": cfg["action"], "offset": OFFSET}, fh, ensure_ascii=False)
print("PERCEPTION_OK")
