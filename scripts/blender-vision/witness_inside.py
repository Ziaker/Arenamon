"""Extrator somente leitura do Animation Witness. Executado dentro do Blender.

Extrai:
- Transformações exatas de ossos e articulações;
- Representações em Euler (XYZ) e Quatérnions sem gimbal lock;
- Torção isolada da pelve (hips twist);
- Distância de superfície malha ↔ alvo via BVHTree quando --target for informado;
- Auto-interpenetração com matriz de exclusão anatômica (ignora juntas conectadas);
- Projeção e configurações de garras.
"""
from __future__ import annotations

import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
import witness_core as core


def fail(message: str) -> None:
    print("WITNESS_FAIL:", message, flush=True)
    raise SystemExit(8)


cfg = json.load(open(sys.argv[sys.argv.index("--") + 1], encoding="utf-8"))
out_path = cfg["observation_path"]
scene = bpy.context.scene

arms = [x for x in bpy.data.objects if x.type == "ARMATURE"]
if cfg.get("armature"):
    arm = bpy.data.objects.get(cfg["armature"])
    if arm is None or arm.type != "ARMATURE":
        fail("armature solicitado não existe")
elif len(arms) == 1:
    arm = arms[0]
else:
    fail("arquivo possui %d armatures; informe --armature" % len(arms))

action = bpy.data.actions.get(cfg["action"])
if action is None:
    fail("action '%s' não existe" % cfg["action"])
if arm.animation_data is None:
    arm.animation_data_create()
arm.animation_data.action = action
try:
    arm.animation_data.action_slot = action.slots[0]
except Exception:
    pass

offset = int(cfg.get("offset", 0))
start = int(round(action.frame_range[0]))
end = int(round(action.frame_range[1]))
frames = list(range(start, end + 1))


def pose_bone(short_name: str):
    return arm.pose.bones.get(short_name) or arm.pose.bones.get("mixamorig:" + short_name)


aliases = [
    "Hips", "Spine", "Spine1", "Spine2", "Neck", "Head",
    "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
    "RightShoulder", "RightArm", "RightForeArm", "RightHand",
    "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase",
    "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase",
]
selected = {x: pose_bone(x) for x in aliases if pose_bone(x) is not None}
if "Hips" not in selected:
    fail("osso Hips não encontrado; não é possível construir eixos do corpo")


def rounded(values, n=7):
    return [round(float(x), n) for x in values]


def matrix_values(matrix):
    return [rounded(row) for row in matrix]


def world_matrix(pb):
    return arm.matrix_world @ pb.matrix


def digit_chains(side: str):
    names = []
    suffix = "_L" if side == "Left" else "_R"
    word = side.lower()
    for bone in arm.data.bones:
        low = bone.name.lower()
        is_digit = any(token in low for token in ("finger", "handindex", "handthumb"))
        if is_digit and (bone.name.endswith(suffix) or word in low):
            names.append(bone.name)
    roots = []
    pool = set(names)
    for name in names:
        bone = arm.data.bones[name]
        if bone.parent is None or bone.parent.name not in pool:
            chain = []
            cur = bone
            while cur is not None and cur.name in pool:
                chain.append(cur.name)
                children = [x for x in cur.children if x.name in pool]
                cur = children[0] if len(children) == 1 else None
            roots.append(chain)
    return sorted(roots)


DIGIT_CHAINS = {"Left": digit_chains("Left"), "Right": digit_chains("Right")}
for chains in DIGIT_CHAINS.values():
    for chain in chains:
        for bone_name in chain:
            selected.setdefault(bone_name, arm.pose.bones.get(bone_name))

# Encontra malhas ligadas à armature
char_meshes = [
    o for o in bpy.data.objects
    if o.type == "MESH" and any(m.type == "ARMATURE" and m.object == arm for m in o.modifiers)
]

# Configuração de alvo geométrico
target_info = None
target_obj = None
target_name = cfg.get("target")
if target_name:
    target_obj = bpy.data.objects.get(target_name)
    if target_obj is None:
        fail("target '%s' não existe" % target_name)
    target_info = {
        "name": target_obj.name,
        "type": target_obj.type,
        "right_hand_surface_distance": [],
    }

frame_rows = []
self_collisions = []

# Mapeia vértices por osso para a mão direita e detecção de auto-colisão
rh_bone_names = {"RightHand", "mixamorig:RightHand"}
for chain in DIGIT_CHAINS["Right"]:
    rh_bone_names.update(chain)

for timeline_frame in frames:
    scene.frame_set(timeline_frame)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    hips_world = world_matrix(selected["Hips"])
    body_inv = hips_world.inverted_safe()
    bones = {}

    for short, pb in selected.items():
        wm = world_matrix(pb)
        wh = arm.matrix_world @ pb.head
        wt = arm.matrix_world @ pb.tail
        bh = body_inv @ wh
        bt = body_inv @ wt
        q_basis = pb.matrix_basis.to_quaternion()
        euler_basis_xyz = [math.degrees(x) for x in pb.matrix_basis.to_euler("XYZ")]
        euler_world_xyz = [math.degrees(x) for x in wm.to_euler("XYZ")]

        bones[short] = {
            "world_head": rounded(wh),
            "world_tail": rounded(wt),
            "body_head": rounded(bh),
            "body_tail": rounded(bt),
            "world_matrix": matrix_values(wm),
            "local_basis_quaternion": rounded(q_basis),
            "local_euler_xyz_deg": rounded(euler_basis_xyz, 3),
            "world_quaternion": rounded(wm.to_quaternion()),
            "world_euler_xyz_deg": rounded(euler_world_xyz, 3),
            "local_scale": rounded(pb.matrix_basis.to_scale()),
            "rotation_mode": pb.rotation_mode,
        }

    # Torção isolada da pelve (yaw relativo ao corpo)
    hips_pb = selected["Hips"]
    hips_local_q = hips_pb.matrix_basis.to_quaternion()
    twist_norm = math.hypot(hips_local_q.w, hips_local_q.z)
    hips_twist_deg = math.degrees(2.0 * math.atan2(hips_local_q.z / twist_norm, hips_local_q.w / twist_norm)) if twist_norm > 1e-9 else 0.0

    author_f = timeline_frame - offset
    frame_rows.append({
        "timeline_frame": timeline_frame,
        "author_frame": author_f,
        "body_frame_world": matrix_values(hips_world),
        "hips_twist_deg": round(hips_twist_deg, 2),
        "bones": bones,
    })

    # Medição de distância de superfície ao alvo quando target_obj existir
    if target_obj is not None and target_obj.type == "MESH" and char_meshes:
        target_eval = target_obj.evaluated_get(depsgraph)
        target_bvh = BVHTree.FromObject(target_eval, depsgraph)
        target_mw = target_eval.matrix_world.copy()
        target_inv = target_mw.inverted_safe()
        min_hand_dist = float("inf")
        nearest_hand_pt = None
        nearest_target_pt = None

        for m_ob in char_meshes:
            m_eval = m_ob.evaluated_get(depsgraph)
            me = m_eval.data
            v_groups = {g.index: g.name for g in m_ob.vertex_groups}
            mw = m_eval.matrix_world

            for v in me.vertices:
                # Checa se vértice pertence à mão direita
                is_rh = False
                for g in v.groups:
                    g_name = v_groups.get(g.group, "")
                    if g_name in rh_bone_names and g.weight > 0.2:
                        is_rh = True
                        break
                if not is_rh:
                    continue

                v_world = mw @ v.co
                v_target_local = target_inv @ v_world
                loc_local, normal, idx, _ = target_bvh.find_nearest(v_target_local)
                if loc_local is not None:
                    loc_world = target_mw @ loc_local
                    dist_world = (v_world - loc_world).length
                    if dist_world < min_hand_dist:
                        min_hand_dist = dist_world
                        nearest_hand_pt = rounded(v_world)
                        nearest_target_pt = rounded(loc_world)

        if min_hand_dist < float("inf"):
            target_info["right_hand_surface_distance"].append({
                "frame": author_f,
                "distance_m": round(min_hand_dist, 5),
                "nearest_hand_pt": nearest_hand_pt,
                "nearest_target_pt": nearest_target_pt,
            })

    # Verificação de auto-interpenetração entre pares não-adjacentes
    # Amostra posições das partes principais
    major_parts = {
        "Head": bones.get("Head", {}).get("world_head"),
        "Spine": bones.get("Spine", {}).get("world_head"),
        "RightHand": bones.get("RightHand", {}).get("world_tail"),
        "LeftHand": bones.get("LeftHand", {}).get("world_tail"),
        "RightForeArm": bones.get("RightForeArm", {}).get("world_head"),
        "LeftForeArm": bones.get("LeftForeArm", {}).get("world_head"),
        "RightFoot": bones.get("RightFoot", {}).get("world_head"),
        "LeftFoot": bones.get("LeftFoot", {}).get("world_head"),
    }
    part_keys = list(major_parts.keys())
    for i in range(len(part_keys)):
        for j in range(i + 1, len(part_keys)):
            p1, p2 = part_keys[i], part_keys[j]
            if core.is_anatomically_adjacent(p1, p2):
                continue
            pt1, pt2 = major_parts[p1], major_parts[p2]
            if pt1 and pt2:
                d = core.vec_distance(pt1, pt2)
                # Limiar de proximidade crítica não-adjacente (ex: colisão direta da mão com cabeça ou outra mão)
                if d < 0.04:
                    self_collisions.append({
                        "frame": author_f,
                        "part_a": p1,
                        "part_b": p2,
                        "distance_m": round(d, 4),
                        "penetration_m": round(max(0.0, 0.04 - d), 4),
                    })

observation = {
    "schema": "arenamon.animation-witness.observation/2",
    "scene": {
        "blender_version": bpy.app.version_string,
        "actions": sorted(x.name for x in bpy.data.actions),
        "objects": [{"name": x.name, "type": x.type} for x in bpy.data.objects],
        "fps": scene.render.fps / max(scene.render.fps_base, 1e-12),
    },
    "armature": {"name": arm.name, "matrix_world": matrix_values(arm.matrix_world)},
    "action": {
        "name": action.name,
        "timeline_range": [start, end],
        "author_range": [start - offset, end - offset],
        "frame_count": len(frames),
    },
    "rig": {
        "bones": sorted(x.name for x in arm.data.bones),
        "observed_aliases": sorted(selected),
        "digit_chains": DIGIT_CHAINS,
    },
    "frames": frame_rows,
    "target": target_info,
    "self_collision": self_collisions,
    "self_collision_method": "bone_proxy_distance",
    "self_collision_full_mesh_coverage": False,
    "limitations": [
        "transformações, inventário e distâncias são fatos do Blender avaliado",
        "nenhuma qualidade artística é inferida neste arquivo",
        "contato exige alvo explícito e evidência geométrica adicional",
        "matriz anatômica exclui juntas conectadas de falsos positivos de colisão",
        "auto-colisão utiliza proxy de 8 pontos de ossos; não equivale a teste triângulo-triângulo de malha fechada",
    ],
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(observation, f, indent=2, ensure_ascii=False, sort_keys=True)
print("WITNESS_OK", action.name, len(frames), flush=True)
