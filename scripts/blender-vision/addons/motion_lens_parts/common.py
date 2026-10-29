# Motion Lens — parte «common» (dividida de motion_lens.py; a API pública continua em motion_lens.py).
import bpy
import json
import math
import os
import statistics
from contextlib import contextmanager
from mathutils import Vector


GHOST_COLL = "ML_Ghosts"
TRAIL_COLL = "ML_Trails"
TEMP_COLL = "ML_Temp"
REPORT_TEXT = "ML_Report"
GRAPH_COLORS = {
    "Hips": (0.95, 0.25, 0.20),
    "Head": (0.95, 0.75, 0.15),
    "LeftHand": (0.20, 0.70, 1.00),
    "RightHand": (0.10, 0.95, 0.55),
    "LeftFoot": (0.60, 0.35, 1.00),
    "RightFoot": (1.00, 0.35, 0.75),
    "Energy": (1.00, 1.00, 1.00),
}
DEFAULT_ROLES = (
    "Hips", "Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot",
    "LeftArm", "LeftForeArm", "RightArm", "RightForeArm",
    "LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg",
)
EXTRA_ROLES = ("Crest", "Tail1", "Tail2", "Tail3", "Tail4")
SKELETON_EDGES = (
    ("Hips", "Head"),
    ("Head", "Crest"),
    ("LeftArm", "LeftForeArm"), ("LeftForeArm", "LeftHand"),
    ("RightArm", "RightForeArm"), ("RightForeArm", "RightHand"),
    ("LeftUpLeg", "LeftLeg"), ("LeftLeg", "LeftFoot"),
    ("RightUpLeg", "RightLeg"), ("RightLeg", "RightFoot"),
    ("Hips", "Tail1"), ("Tail1", "Tail2"), ("Tail2", "Tail3"), ("Tail3", "Tail4"),
)
PROFILE_KEYS = (
    "motion_lens_frames", "motion_lens_bones", "motion_lens_bone_map",
    "motion_lens_contact_margin", "motion_lens_locked_speed", "motion_lens_slide_threshold",
    "motion_lens_ground_z", "motion_lens_penetration_tolerance", "motion_lens_pop_min",
    "motion_lens_pop_mad", "motion_lens_direction_min", "motion_lens_direction_dot",
    "motion_lens_rotation_jump", "motion_lens_scale_tolerance", "motion_lens_support_margin",
    "motion_lens_capsule_radius", "motion_lens_hyperextension", "motion_lens_camera_names",
    "motion_lens_pause_speed", "motion_lens_pause_frames",
    "motion_lens_uniform_frames", "motion_lens_uniform_cv",
    "motion_lens_arc_break_angle", "motion_lens_arc_straight_angle",
    "motion_lens_arc_straight_frames", "motion_lens_tangent_break_ratio",
    "motion_lens_extra_motion_min",
)


def _context(context=None):
    return context or bpy.context


def _armature(context=None, name=None):
    context = _context(context)
    if name:
        ob = bpy.data.objects.get(name)
        return ob if ob and ob.type == 'ARMATURE' else None
    ob = context.active_object
    if ob and ob.type == 'ARMATURE':
        return ob
    arms = [o for o in context.scene.objects if o.type == 'ARMATURE']
    return arms[0] if len(arms) == 1 else None


def _meshes_of(arm):
    return [
        ob for ob in bpy.data.objects
        if ob.type == 'MESH'
        and any(m.type == 'ARMATURE' and m.object == arm for m in ob.modifiers)
    ]


def _collection(scene, name):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        scene.collection.children.link(coll)
    return coll


def _remove_object_and_data(ob):
    data = ob.data
    bpy.data.objects.remove(ob, do_unlink=True)
    if data and data.users == 0:
        if isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)
        elif isinstance(data, bpy.types.Curve):
            bpy.data.curves.remove(data)
        elif isinstance(data, bpy.types.Camera):
            bpy.data.cameras.remove(data)


def _clear_collection(name):
    coll = bpy.data.collections.get(name)
    if not coll:
        return
    for ob in list(coll.objects):
        _remove_object_and_data(ob)


def clear_generated():
    for name in (GHOST_COLL, TRAIL_COLL, TEMP_COLL):
        _clear_collection(name)


@contextmanager
def _restore_frame(scene):
    frame = scene.frame_current
    subframe = scene.frame_subframe
    try:
        yield
    finally:
        scene.frame_set(frame, subframe=subframe)


def _parse_frames(text, scene):
    out = []
    for part in (text or "").replace(";", ",").split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part[1:]:
            split_at = part[1:].find("-") + 1
            a, b = int(part[:split_at]), int(part[split_at + 1:])
            step = 1 if b >= a else -1
            out.extend(range(a, b + step, step))
        else:
            out.append(int(part))
    valid = [f for f in out if scene.frame_start <= f <= scene.frame_end]
    return list(dict.fromkeys(valid))


def _parse_mapping(text):
    if not text or not text.strip():
        return {}
    value = json.loads(text)
    if not isinstance(value, dict):
        raise ValueError("O mapeamento deve ser um objeto JSON")
    return {str(k): str(v) for k, v in value.items()}


def _resolve_bone(arm, role, mapping=None):
    mapping = mapping or {}
    requested = mapping.get(role, role)
    pb = arm.pose.bones.get(requested)
    if pb:
        return pb
    pb = arm.pose.bones.get("mixamorig:" + requested)
    if pb:
        return pb
    matches = [b for b in arm.pose.bones if b.name.split(":")[-1] == requested]
    return matches[0] if len(matches) == 1 else None


def _color(t):
    r = min(1.0, max(0.0, 2.0 * t))
    b = min(1.0, max(0.0, 1.0 - 2.0 * t))
    g = 1.0 - abs(2.0 * t - 1.0)
    return (r, g, b)


def _material(name, rgb, alpha=1.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*rgb, alpha)
    node = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if node:
        if "Base Color" in node.inputs:
            node.inputs["Base Color"].default_value = (*rgb, 1.0)
        if "Alpha" in node.inputs:
            node.inputs["Alpha"].default_value = alpha
    return mat


def _world_point(arm, pb, use_tail=False):
    return arm.matrix_world @ (pb.tail if use_tail else pb.head)


def _safe_angle(a, b, c):
    va, vb = a - b, c - b
    if va.length < 1e-8 or vb.length < 1e-8:
        return None
    return math.degrees(va.angle(vb))


def _mesh_min_z(meshes, depsgraph):
    result = None
    for ob in meshes:
        ev = ob.evaluated_get(depsgraph)
        me = ev.to_mesh()
        try:
            if not me.vertices:
                continue
            z = min((ev.matrix_world @ v.co).z for v in me.vertices)
            result = z if result is None else min(result, z)
        finally:
            ev.to_mesh_clear()
    return result


def _median_mad(values):
    if not values:
        return 0.0, 0.0
    med = statistics.median(values)
    mad = statistics.median(abs(v - med) for v in values)
    return med, mad


def _severity(score):
    if score >= 3.0:
        return "ALTO"
    if score >= 1.5:
        return "MEDIO"
    return "BAIXO"


def _point_segment_distance_2d(point, a, b):
    p = Vector((point.x, point.y))
    v0 = Vector((a.x, a.y))
    v1 = Vector((b.x, b.y))
    edge = v1 - v0
    if edge.length_squared < 1e-12:
        return (p - v0).length
    t = max(0.0, min(1.0, (p - v0).dot(edge) / edge.length_squared))
    return (p - (v0 + edge * t)).length


def _segment_distance(a0, a1, b0, b1):
    """Distancia minima entre dois segmentos 3D (algoritmo robusto sem dependencias)."""
    u, v, w = a1 - a0, b1 - b0, a0 - b0
    aa, bb, cc = u.dot(u), u.dot(v), v.dot(v)
    dd, ee = u.dot(w), v.dot(w)
    den = aa * cc - bb * bb
    small = 1e-10
    if den < small:
        s_num, s_den, t_num, t_den = 0.0, 1.0, ee, cc
    else:
        s_num, s_den = bb * ee - cc * dd, den
        t_num, t_den = aa * ee - bb * dd, den
        if s_num < 0.0:
            s_num, t_num, t_den = 0.0, ee, cc
        elif s_num > s_den:
            s_num, t_num, t_den = s_den, ee + bb, cc
    if t_num < 0.0:
        t_num = 0.0
        if -dd < 0.0:
            s_num = 0.0
        elif -dd > aa:
            s_num, s_den = s_den, s_den
        else:
            s_num, s_den = -dd, aa
    elif t_num > t_den:
        t_num = t_den
        if -dd + bb < 0.0:
            s_num = 0.0
        elif -dd + bb > aa:
            s_num, s_den = s_den, s_den
        else:
            s_num, s_den = -dd + bb, aa
    sc = 0.0 if abs(s_num) < small else s_num / s_den
    tc = 0.0 if abs(t_num) < small else t_num / t_den
    return (w + sc * u - tc * v).length


def _action_keyed_frames(action):
    """Extrai frames de keyframes nas Actions em camadas do Blender 5.x."""
    result = set()
    if action is None:
        return result
    for layer in getattr(action, "layers", ()):
        for strip in getattr(layer, "strips", ()):
            for bag in getattr(strip, "channelbags", ()):
                for curve in getattr(bag, "fcurves", ()):
                    for point in curve.keyframe_points:
                        result.add(int(round(point.co.x)))
    return result



def _ensure_output_dir(scene):
    path = bpy.path.abspath(scene.motion_lens_output_dir or "//motion_lens_output")
    os.makedirs(path, exist_ok=True)
    return path
