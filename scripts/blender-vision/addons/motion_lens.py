bl_info = {
    "name": "Motion Lens (Arenamon)",
    "author": "Arenamon",
    "version": (0, 3, 1),
    "blender": (5, 0, 0),
    "location": "View3D > Sidebar > Motion Lens",
    "description": "Comprime movimento em contact sheets, graficos e diagnosticos priorizados",
    "category": "Animation",
}

import bpy
import base64
import html
import json
import math
import os
import shutil
import statistics
import tempfile
from contextlib import contextmanager
from mathutils import Vector
from bpy.props import BoolProperty, FloatProperty, IntProperty, StringProperty


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


def _load_json_value(value):
    if not value:
        return {}
    if isinstance(value, dict):
        return value
    path = bpy.path.abspath(str(value))
    if os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    parsed = json.loads(str(value))
    if not isinstance(parsed, dict):
        raise ValueError("Esperado objeto JSON ou caminho para JSON")
    return parsed


def load_contract(scene, value=None):
    return _load_json_value(value if value is not None else scene.motion_lens_contract)


def check_contract(analysis, contract):
    """Verifica somente regras objetivas declaradas; não infere Smear/Stretch artisticamente."""
    if not contract:
        return {"violations": [], "notes": ["Nenhum contrato carregado."]}
    frames = analysis["frames"]
    violations, notes = [], []
    expected_start = contract.get("frame_start")
    expected_end = contract.get("frame_end")
    expected_count = contract.get("frame_count")
    if expected_start is not None and frames[0] != int(expected_start):
        violations.append("Inicio %d; esperado %d" % (frames[0], expected_start))
    if expected_end is not None and frames[-1] != int(expected_end):
        violations.append("Fim %d; esperado %d" % (frames[-1], expected_end))
    if expected_count is not None and len(frames) != int(expected_count):
        violations.append("Duracao %d frames; esperado %d" % (len(frames), expected_count))
    windows = contract.get("windows", {})
    for name, spec in windows.items():
        if isinstance(spec, (list, tuple)) and len(spec) == 2:
            start, end = int(spec[0]), int(spec[1])
            if start < frames[0] or end > frames[-1] or end < start:
                violations.append("Janela %s invalida: %s" % (name, spec))
            continue
        if not isinstance(spec, dict):
            notes.append("Janela %s nao possui formato verificavel" % name)
            continue
        start, end, duration = spec.get("start"), spec.get("end"), spec.get("duration")
        if start is not None and end is not None and duration is not None:
            actual = int(end) - int(start) + 1
            if actual != int(duration):
                violations.append("Janela %s tem %d frames; contrato pede %d" % (name, actual, duration))
        elif duration is not None:
            notes.append("%s pede %s frames, mas nao declara onde a janela comeca" % (name, duration))
    contact = windows.get("contact") or contract.get("contact_window")
    if isinstance(contact, dict):
        contact = [contact.get("start"), contact.get("end")]
    if isinstance(contact, (list, tuple)) and len(contact) == 2 and None not in contact:
        allowed = set(range(int(contact[0]), int(contact[1]) + 1))
        actual = set()
        for info in analysis["contacts"].values():
            actual.update(info["frames"])
        if actual and not (actual & allowed):
            violations.append("Nenhum contato de pe detectado na janela %d..%d" % (contact[0], contact[1]))
        notes.append("Contato narrativo/impacto de mao exige papel de osso explicito; contato dos pes foi verificado separadamente.")
    for name in ("smear", "stretch"):
        if name in windows:
            notes.append("A duracao de %s e verificavel; a intencao visual ainda exige aprovacao humana." % name)
            spec = windows[name]
            if isinstance(spec, dict) and spec.get("start") is not None and spec.get("end") is not None:
                allowed = set(range(int(spec["start"]), int(spec["end"]) + 1))
                scales = analysis.get("scales", {})
                tolerance = float(spec.get("scale_tolerance", 0.02))
                min_dev = float(spec.get("min_deviation", 0.05))
                if not spec.get("bones"):
                    notes.append("NAO VERIFICADO: %s nao declara 'bones'; a deformacao dentro/fora da janela nao foi checada" % name)
                for role in spec.get("bones", []):
                    # PATCH: todo frame da janela precisa ter desvio >= min_deviation em algum eixo (antes so se checava o FORA da janela)
                    _vals = scales.get(role, [])
                    _ex = int(spec.get("edge_exempt", 0))
                    _srt = sorted(allowed)
                    _isento = set(_srt[:_ex] + _srt[len(_srt) - _ex:]) if _ex else set()      # PATCH: bordas da janela (entrada/retorno) podem ficar abaixo do minimo
                    _sem = [frames[i] for i, s in enumerate(_vals) if frames[i] in allowed and frames[i] not in _isento and max(abs(s.x - 1.0), abs(s.y - 1.0), abs(s.z - 1.0)) < min_dev]
                    if not _vals:
                        violations.append("%s: sem dados de escala para %s (papel de osso ausente?)" % (name, role))
                    elif _sem:
                        violations.append("%s: %s sem deformacao (desvio < %s) dentro da janela em f%s" % (name, role, min_dev, ",".join(map(str, _sem))))
                    values = scales.get(role, [])
                    for index, scale in enumerate(values):
                        frame = frames[index]
                        deviation = max(abs(scale.x - 1.0), abs(scale.y - 1.0), abs(scale.z - 1.0))
                        # PATCH: janelas ADJACENTES no mesmo osso (smear e stretch no braco D) nao contam como "fora da janela" uma da outra
                        _outros = set()
                        for _n2 in ("smear", "stretch"):
                            _s2 = windows.get(_n2)
                            if _n2 != name and isinstance(_s2, dict) and _s2.get("start") is not None and role in (_s2.get("bones") or []):
                                _outros.update(range(int(_s2["start"]), int(_s2["end"]) + 1))
                        if frame not in allowed and frame not in _outros and deviation > tolerance:
                            violations.append("%s: %s permanece escalado fora da janela em f%d" % (name, role, frame))
                            break
    return {"violations": violations, "notes": notes}


def save_profile(context=None, path=None):
    context = _context(context)
    scene = context.scene
    path = bpy.path.abspath(path or scene.motion_lens_profile_path or os.path.join(_ensure_output_dir(scene), "motion_lens_profile.json"))
    payload = {key: getattr(scene, key) for key in PROFILE_KEYS if hasattr(scene, key)}
    payload["schema"] = 1
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    return path


def load_profile(context=None, path=None):
    context = _context(context)
    scene = context.scene
    path = bpy.path.abspath(path or scene.motion_lens_profile_path)
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    for key in PROFILE_KEYS:
        if key in payload and hasattr(scene, key):
            setattr(scene, key, payload[key])
    return path


def analyze_motion(context=None, armature_name=None, bone_map=None, max_issues=None):
    """Analisa a action ativa sem editar rig, malha, pesos ou keyframes.

    Retorna um dicionario Python. `issues` vem ordenado por relevancia.
    """
    context = _context(context)
    scene = context.scene
    arm = _armature(context, armature_name)
    if arm is None:
        raise RuntimeError("Selecione um armature ou informe armature_name")
    mapping = bone_map if isinstance(bone_map, dict) else _parse_mapping(
        bone_map if isinstance(bone_map, str) else scene.motion_lens_bone_map
    )
    _act = arm.animation_data.action if arm.animation_data else None
    if _act is not None:
        # PATCH: analisa o intervalo REAL da action (cena 1-250 com ataque de 41 frames extrapolaria frames inexistentes)
        frames = list(range(int(round(_act.frame_range[0])), int(round(_act.frame_range[1])) + 1))
    else:
        frames = list(range(scene.frame_start, scene.frame_end + 1))
    if len(frames) < 2:
        raise RuntimeError("O intervalo precisa ter pelo menos 2 frames")
    roles = {}
    missing = []
    for role in DEFAULT_ROLES:
        pb = _resolve_bone(arm, role, mapping)
        if pb:
            roles[role] = pb.name
        else:
            missing.append(role)
    extra_present = []
    for role in EXTRA_ROLES:
        pb = _resolve_bone(arm, role, mapping)
        if pb:
            roles[role] = pb.name
            extra_present.append(role)
    meshes = _meshes_of(arm)
    positions = {role: [] for role in roles}
    rotations = {role: [] for role in roles}
    scales = {role: [] for role in roles}
    angles = {"LeftElbow": [], "RightElbow": [], "LeftKnee": [], "RightKnee": []}
    mesh_min_z = []
    with _restore_frame(scene):
        for frame in frames:
            scene.frame_set(frame)
            depsgraph = context.evaluated_depsgraph_get()
            world_q = arm.matrix_world.to_quaternion()
            for role, bone_name in roles.items():
                pb = arm.pose.bones[bone_name]
                positions[role].append(_world_point(arm, pb))
                rotations[role].append((world_q @ pb.matrix.to_quaternion()).normalized())
                scales[role].append(pb.matrix.to_scale())
            for side in ("Left", "Right"):
                arm_role, fore_role, hand_role = side + "Arm", side + "ForeArm", side + "Hand"
                up_role, leg_role, foot_role = side + "UpLeg", side + "Leg", side + "Foot"
                if all(r in positions for r in (arm_role, fore_role, hand_role)):
                    angles[side + "Elbow"].append(_safe_angle(
                        positions[arm_role][-1], positions[fore_role][-1], positions[hand_role][-1]
                    ))
                else:
                    angles[side + "Elbow"].append(None)
                if all(r in positions for r in (up_role, leg_role, foot_role)):
                    angles[side + "Knee"].append(_safe_angle(
                        positions[up_role][-1], positions[leg_role][-1], positions[foot_role][-1]
                    ))
                else:
                    angles[side + "Knee"].append(None)
            mesh_min_z.append(_mesh_min_z(meshes, depsgraph))

    speed = {}
    height = {}
    issues = []
    for role, points in positions.items():
        speed[role] = [0.0] + [(points[i] - points[i - 1]).length for i in range(1, len(points))]
        height[role] = [p.z for p in points]
        nonzero = speed[role][1:]
        med, mad = _median_mad(nonzero)
        pop_threshold = max(scene.motion_lens_pop_min, med + scene.motion_lens_pop_mad * max(mad, 1e-6))
        for i in range(1, len(points)):
            value = speed[role][i]
            if value > pop_threshold:
                score = value / max(pop_threshold, 1e-6)
                issues.append({
                    "frame": frames[i], "kind": "pop", "bone": role, "score": score,
                    "detail": "velocidade %.3f m/frame (limiar adaptativo %.3f)" % (value, pop_threshold),
                })
        for i in range(2, len(points)):
            v0, v1 = points[i - 1] - points[i - 2], points[i] - points[i - 1]
            if v0.length > scene.motion_lens_direction_min and v1.length > scene.motion_lens_direction_min:
                dot = v0.normalized().dot(v1.normalized())
                if dot < scene.motion_lens_direction_dot:
                    score = (-dot) * (v0.length + v1.length) / max(scene.motion_lens_direction_min * 2.0, 1e-6)
                    issues.append({
                        "frame": frames[i], "kind": "reversao", "bone": role, "score": score,
                        "detail": "inversao brusca de direcao (dot %.2f)" % dot,
                    })
        quats = rotations[role]
        for i in range(1, len(quats)):
            raw_dot = quats[i - 1].dot(quats[i])
            degrees = math.degrees(2.0 * math.acos(min(1.0, abs(raw_dot))))
            if degrees > scene.motion_lens_rotation_jump:
                issues.append({
                    "frame": frames[i], "kind": "rotacao", "bone": role,
                    "score": degrees / scene.motion_lens_rotation_jump,
                    "detail": "salto angular %.1f graus/frame" % degrees,
                })
            if raw_dot < -0.5:
                issues.append({
                    "frame": frames[i], "kind": "quat_sign", "bone": role, "score": 0.6,
                    "detail": "troca de sinal do quaternion; pode ser inocua, mas merece inspecao",
                })
        for i, scale in enumerate(scales[role]):
            dev = max(abs(scale.x - 1.0), abs(scale.y - 1.0), abs(scale.z - 1.0))
            if dev > scene.motion_lens_scale_tolerance:
                issues.append({
                    "frame": frames[i], "kind": "escala", "bone": role,
                    "score": dev / scene.motion_lens_scale_tolerance,
                    "detail": "escala desvia %.3f de 1" % dev,
                })

    contacts = {}
    for foot in ("LeftFoot", "RightFoot"):
        points = positions.get(foot)
        if not points:
            continue
        threshold = min(p.z for p in points) + scene.motion_lens_contact_margin
        flags = [p.z <= threshold for p in points]
        locked = [flags[i] and speed[foot][i] <= scene.motion_lens_locked_speed for i in range(len(points))]
        slides = []
        for i in range(1, len(points)):
            if flags[i - 1] and flags[i]:
                dxy = Vector((points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)).length
                if dxy > scene.motion_lens_slide_threshold:
                    slides.append((frames[i], dxy))
                    issues.append({
                        "frame": frames[i], "kind": "deslizamento", "bone": foot,
                        "score": dxy / scene.motion_lens_slide_threshold,
                        "detail": "%.3f m entre frames baixos consecutivos" % dxy,
                    })
        contacts[foot] = {
            "height_threshold": threshold,
            "frames": [frames[i] for i, flag in enumerate(flags) if flag],
            "locked_frames": [frames[i] for i, flag in enumerate(locked) if flag],
            "max_step_slide": max((d for _, d in slides), default=0.0),
        }

    for i, z in enumerate(mesh_min_z):
        if z is not None and z < scene.motion_lens_ground_z - scene.motion_lens_penetration_tolerance:
            depth = scene.motion_lens_ground_z - z
            issues.append({
                "frame": frames[i], "kind": "penetracao", "bone": "Mesh",
                "score": depth / scene.motion_lens_penetration_tolerance,
                "detail": "malha %.3f m abaixo do plano de chao" % depth,
            })

    # Energia corporal aproximada: soma ponderada das velocidades das juntas.
    energy_weights = {
        "Hips": 0.42, "Head": 0.14, "LeftHand": 0.07, "RightHand": 0.07,
        "LeftFoot": 0.15, "RightFoot": 0.15,
    }
    energy = []
    for i in range(len(frames)):
        weighted = [(speed[r][i], w) for r, w in energy_weights.items() if r in speed]
        energy.append(sum(v * w for v, w in weighted) / max(sum(w for _, w in weighted), 1e-8))

    # Pausas involuntarias e trechos mecanicamente uniformes são indícios, não erros artísticos.
    run_start = None
    for i, value in enumerate(energy):
        if value <= scene.motion_lens_pause_speed:
            run_start = i if run_start is None else run_start
        else:
            if run_start is not None and i - run_start >= scene.motion_lens_pause_frames:
                issues.append({
                    "frame": frames[run_start], "kind": "pausa", "bone": "Body", "score": 1.2,
                    "detail": "energia quase zero por %d frames" % (i - run_start),
                })
            run_start = None
    if run_start is not None and len(frames) - run_start >= scene.motion_lens_pause_frames:
        issues.append({
            "frame": frames[run_start], "kind": "pausa", "bone": "Body", "score": 1.2,
            "detail": "energia quase zero por %d frames" % (len(frames) - run_start),
        })
    window = max(3, scene.motion_lens_uniform_frames)
    for start in range(1, max(1, len(energy) - window + 1)):
        values = energy[start:start + window]
        mean = sum(values) / len(values)
        if mean > scene.motion_lens_pause_speed * 2.0:
            spread = statistics.pstdev(values) / max(mean, 1e-8)
            if spread < scene.motion_lens_uniform_cv:
                issues.append({
                    "frame": frames[start], "kind": "uniforme", "bone": "Body", "score": 1.0,
                    "detail": "%d frames com energia quase constante (CV %.3f)" % (window, spread),
                })
                break

    # Centro de massa aproximado e estabilidade em relação aos apoios detectados.
    com_weights = {
        "Hips": 0.48, "Head": 0.16, "LeftHand": 0.05, "RightHand": 0.05,
        "LeftFoot": 0.13, "RightFoot": 0.13,
    }
    com = []
    support_distance = []
    for i in range(len(frames)):
        samples = [(positions[r][i], w) for r, w in com_weights.items() if r in positions]
        total = sum(w for _, w in samples)
        center = sum((p * w for p, w in samples), Vector((0.0, 0.0, 0.0))) / max(total, 1e-8)
        com.append(center)
        feet = [foot for foot in ("LeftFoot", "RightFoot") if foot in contacts and frames[i] in contacts[foot]["frames"]]
        if len(feet) == 2:
            distance = _point_segment_distance_2d(center, positions[feet[0]][i], positions[feet[1]][i])
        elif len(feet) == 1:
            foot_point = positions[feet[0]][i]
            distance = Vector((center.x - foot_point.x, center.y - foot_point.y)).length
        else:
            distance = None
        support_distance.append(distance)
        if distance is not None and distance > scene.motion_lens_support_margin:
            issues.append({
                "frame": frames[i], "kind": "equilibrio", "bone": "COM",
                "score": distance / scene.motion_lens_support_margin,
                "detail": "centro aproximado %.3f m fora do apoio simplificado" % distance,
            })

    # Colisão aproximada por cápsulas nos principais segmentos.
    collision_distance = []
    collision_pairs = (
        (("LeftArm", "LeftHand"), ("Hips", "Head"), "braco L/torso"),
        (("RightArm", "RightHand"), ("Hips", "Head"), "braco R/torso"),
        (("LeftUpLeg", "LeftFoot"), ("RightUpLeg", "RightFoot"), "pernas"),
    )
    for i in range(len(frames)):
        closest = None
        for (a0, a1), (b0, b1), label in collision_pairs:
            if not all(r in positions for r in (a0, a1, b0, b1)):
                continue
            distance = _segment_distance(positions[a0][i], positions[a1][i], positions[b0][i], positions[b1][i])
            closest = distance if closest is None else min(closest, distance)
            threshold = scene.motion_lens_capsule_radius * 2.0
            if distance < threshold:
                issues.append({
                    "frame": frames[i], "kind": "intersecao", "bone": label,
                    "score": (threshold - distance) / max(threshold, 1e-8) + 1.0,
                    "detail": "capsulas a %.3f m; confirmar na malha" % distance,
                })
        collision_distance.append(closest)

    # Hiperextensão e ângulos extremos.
    for joint, values in angles.items():
        for i, value in enumerate(values):
            if value is None:
                continue
            if value >= scene.motion_lens_hyperextension:
                issues.append({
                    "frame": frames[i], "kind": "hiperextensao", "bone": joint,
                    "score": 1.0 + (value - scene.motion_lens_hyperextension) / 10.0,
                    "detail": "angulo %.1f graus" % value,
                })

    # Curvatura dos arcos e quebras de tangente em frames chave.
    keyed_frames = _action_keyed_frames(arm.animation_data.action if arm.animation_data else None)
    arc_curvature = {}
    for role in ("Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot"):
        points = positions.get(role)
        if not points:
            continue
        values = [0.0] * len(points)
        straight_run = 0
        for i in range(2, len(points)):
            v0, v1 = points[i - 1] - points[i - 2], points[i] - points[i - 1]
            if v0.length < 1e-7 or v1.length < 1e-7:
                continue
            angle = math.degrees(v0.angle(v1))
            values[i] = angle
            if angle > scene.motion_lens_arc_break_angle:
                issues.append({
                    "frame": frames[i], "kind": "arco", "bone": role,
                    "score": angle / scene.motion_lens_arc_break_angle,
                    "detail": "quebra de curvatura %.1f graus" % angle,
                })
            straight_run = straight_run + 1 if angle < scene.motion_lens_arc_straight_angle else 0
            if straight_run == scene.motion_lens_arc_straight_frames:
                issues.append({
                    "frame": frames[i - straight_run + 1], "kind": "arco_reto", "bone": role,
                    "score": 0.8, "detail": "%d frames quase retilineos" % straight_run,
                })
            if frames[i - 1] in keyed_frames:
                before, after = v0.length, v1.length
                ratio = abs(after - before) / max(before, after, 1e-8)
                if ratio > scene.motion_lens_tangent_break_ratio:
                    issues.append({
                        "frame": frames[i - 1], "kind": "tangente", "bone": role,
                        "score": ratio / scene.motion_lens_tangent_break_ratio,
                        "detail": "mudanca de velocidade %.0f%% junto a chave" % (ratio * 100.0),
                    })
        arc_curvature[role] = values

    # Ossos extras do Vigoroth: presença, imobilidade e resposta relativa ao corpo.
    extra_status = {}
    hips_motion = sum(speed.get("Hips", []))
    for role in EXTRA_ROLES:
        if role not in positions:
            extra_status[role] = "ausente"
            continue
        travel = sum(speed[role])
        extra_status[role] = "movimento_total=%.4f" % travel
        if hips_motion > scene.motion_lens_extra_motion_min and travel < scene.motion_lens_extra_motion_min:
            issues.append({
                "frame": frames[0], "kind": "osso_extra_estatico", "bone": role, "score": 1.0,
                "detail": "corpo se move, mas o osso quase nao responde",
            })

    pre_contract = {
        "frames": frames, "contacts": contacts, "positions": positions, "scales": scales,
    }
    contract_result = check_contract(pre_contract, load_contract(scene))
    for message in contract_result["violations"]:
        issues.append({
            "frame": frames[0], "kind": "contrato", "bone": "Action", "score": 3.0,
            "detail": message,
        })

    issues.sort(key=lambda item: (-item["score"], item["frame"], item["bone"]))
    limit = max_issues if max_issues is not None else scene.motion_lens_max_issues
    return {
        "armature": arm.name,
        "frames": frames,
        "fps": scene.render.fps / max(scene.render.fps_base, 1e-8),
        "roles": roles,
        "missing_roles": missing,
        "extra_bones": extra_status,
        "positions": positions,
        "rotations": rotations,
        "scales": scales,
        "speed": speed,
        "height": height,
        "energy": energy,
        "center_of_mass": com,
        "support_distance": support_distance,
        "collision_distance": collision_distance,
        "arc_curvature": arc_curvature,
        "angles": angles,
        "mesh_min_z": mesh_min_z,
        "contacts": contacts,
        "contract": contract_result,
        "issues": issues[:limit],
        "issue_count_total": len(issues),
    }


def build_report(context=None, armature_name=None, bone_map=None, max_issues=None):
    data = analyze_motion(context, armature_name, bone_map, max_issues)
    frames = data["frames"]
    lines = [
        "MOTION LENS 0.3 - diagnostico priorizado",
        "Armature: %s" % data["armature"],
        "Frames: %d..%d (%d) | %.3f FPS | %.3f s" % (
            frames[0], frames[-1], len(frames), data["fps"], len(frames) / data["fps"]
        ),
    ]
    if data["missing_roles"]:
        lines.append("Ossos nao resolvidos: " + ", ".join(data["missing_roles"]))
    if data["extra_bones"]:
        lines.append("Ossos extras: " + ", ".join("%s=%s" % item for item in data["extra_bones"].items()))
    lines.append("")
    lines.append("FRAMES SUSPEITOS (ordenados por relevancia; sao alertas, nao julgamento artistico)")
    if not data["issues"]:
        lines.append("  Nenhum alerta pelos limiares atuais.")
    for issue in data["issues"]:
        lines.append("  [%s] f%-4d %-13s %-10s %s" % (
            _severity(issue["score"]), issue["frame"], issue["kind"], issue["bone"], issue["detail"]
        ))
    omitted = data["issue_count_total"] - len(data["issues"])
    if omitted > 0:
        lines.append("  ... %d alertas de menor prioridade omitidos" % omitted)
    lines.extend(["", "RESUMO POR JUNTA"])
    for role in ("Hips", "Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot"):
        values = data["speed"].get(role)
        if not values:
            continue
        peak_i = max(range(len(values)), key=values.__getitem__)
        lines.append("  %-10s pico %.3f m/frame em f%d | media %.3f" % (
            role, values[peak_i], frames[peak_i], sum(values[1:]) / max(1, len(values) - 1)
        ))
    lines.extend(["", "CONTATO (limiar relativo ao minimo de cada pe)"])
    for foot, info in data["contacts"].items():
        lines.append("  %s: %d baixos, %d quase travados, slide max %.3f m/frame, z<=%.3f" % (
            foot, len(info["frames"]), len(info["locked_frames"]),
            info["max_step_slide"], info["height_threshold"]
        ))
    valid_z = [z for z in data["mesh_min_z"] if z is not None]
    if valid_z:
        lines.append("  Malha: z minimo %.4f m" % min(valid_z))
    lines.extend(["", "CONTRATO"])
    if data["contract"]["violations"]:
        lines.extend("  VIOLACAO: " + item for item in data["contract"]["violations"])
    else:
        lines.append("  Nenhuma violacao objetiva detectada.")
    lines.extend("  Nota: " + item for item in data["contract"]["notes"])
    lines.extend([
        "",
        "LIMITES: estes dados detectam descontinuidades e riscos mensuraveis; nao avaliam peso percebido, ritmo, intencao, silhueta ou gosto.",
    ])
    return "\n".join(lines)


def _ensure_output_dir(scene):
    path = bpy.path.abspath(scene.motion_lens_output_dir or "//motion_lens_output")
    os.makedirs(path, exist_ok=True)
    return path


def _set_pixel(buf, width, height, x, y, rgb, alpha=1.0):
    if 0 <= x < width and 0 <= y < height:
        i = (y * width + x) * 4
        buf[i:i + 4] = [rgb[0], rgb[1], rgb[2], alpha]


def _draw_line(buf, width, height, x0, y0, x1, y1, rgb, thickness=1):
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    dx, sx = abs(x1 - x0), 1 if x0 < x1 else -1
    dy, sy = -abs(y1 - y0), 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        for ox in range(-thickness + 1, thickness):
            for oy in range(-thickness + 1, thickness):
                _set_pixel(buf, width, height, x0 + ox, y0 + oy, rgb)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


FONT = {
    "0": ("111", "101", "101", "101", "111"), "1": ("010", "110", "010", "010", "111"),
    "2": ("111", "001", "111", "100", "111"), "3": ("111", "001", "111", "001", "111"),
    "4": ("101", "101", "111", "001", "001"), "5": ("111", "100", "111", "001", "111"),
    "6": ("111", "100", "111", "101", "111"), "7": ("111", "001", "010", "010", "010"),
    "8": ("111", "101", "111", "101", "111"), "9": ("111", "101", "111", "001", "111"),
    "F": ("111", "100", "110", "100", "100"), "S": ("111", "100", "111", "001", "111"),
    "T": ("111", "010", "010", "010", "010"), "C": ("111", "100", "100", "100", "111"),
    "A": ("010", "101", "111", "101", "101"), "B": ("110", "101", "110", "101", "110"),
    "R": ("110", "101", "110", "101", "101"), "-": ("000", "000", "111", "000", "000"),
    "D": ("110", "101", "101", "101", "110"), "E": ("111", "100", "110", "100", "111"),
    "G": ("111", "100", "101", "101", "111"), "H": ("101", "101", "111", "101", "101"),
    "I": ("111", "010", "010", "010", "111"), "J": ("001", "001", "001", "101", "111"),
    "K": ("101", "101", "110", "101", "101"), "L": ("100", "100", "100", "100", "111"),
    "M": ("101", "111", "111", "101", "101"), "N": ("101", "111", "111", "111", "101"),
    "O": ("111", "101", "101", "101", "111"), "P": ("110", "101", "110", "100", "100"),
    "Q": ("111", "101", "101", "111", "001"), "U": ("101", "101", "101", "101", "111"),
    "V": ("101", "101", "101", "101", "010"), "W": ("101", "101", "111", "111", "101"),
    "X": ("101", "101", "010", "101", "101"), "Y": ("101", "101", "010", "010", "010"),
    "Z": ("111", "001", "010", "100", "111"), ".": ("000", "000", "000", "000", "010"),
    "/": ("001", "001", "010", "100", "100"), ":": ("000", "010", "000", "010", "000"),
    "=": ("000", "111", "000", "111", "000"),
    " ": ("000", "000", "000", "000", "000"),
}


def _draw_text(buf, width, height, x, y, text, rgb=(1, 1, 1), scale=2):
    x, y, scale = int(round(x)), int(round(y)), max(1, int(scale))   # PATCH: coordenadas float quebravam o fatiamento
    cursor = x
    for char in str(text).upper():
        glyph = FONT.get(char, FONT[" "])
        for row, bits in enumerate(reversed(glyph)):
            for col, bit in enumerate(bits):
                if bit == "1":
                    for oy in range(scale):
                        for ox in range(scale):
                            _set_pixel(buf, width, height, cursor + col * scale + ox, y + row * scale + oy, rgb)
        cursor += 4 * scale


def render_graphs(context=None, output_path=None, analysis=None):
    """Salva PNG autocontido: nomes, eixos, frames, unidades e picos."""
    context = _context(context)
    scene = context.scene
    data = analysis or analyze_motion(context)
    frames = data["frames"]
    width, height = 1500, 1050
    buf = [0.035, 0.035, 0.045, 1.0] * (width * height)
    left, right, info_x = 175, 1120, 1160
    roles = [r for r in ("Hips", "Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot") if r in data["speed"]]
    panels = [
        {"title": "VELOCIDADE", "unit": "M/FRAME", "bottom": 720, "top": 970,
         "series": {r: data["speed"][r] for r in roles}, "zero": True},
        {"title": "ALTURA", "unit": "M", "bottom": 390, "top": 640,
         "series": {r: data["height"][r] for r in roles}, "zero": False},
        {"title": "ENERGIA", "unit": "MEDIA PONDERADA", "bottom": 60, "top": 310,
         "series": {"Energy": data["energy"]}, "zero": True},
    ]
    frame_indices = sorted(set(round(i * (len(frames) - 1) / 4) for i in range(5)))
    for panel in panels:
        bottom, top, selected = panel["bottom"], panel["top"], panel["series"]
        flat = [value for values in selected.values() for value in values]
        if panel["zero"]:
            lo, hi = 0.0, max(flat, default=1.0)
        else:
            lo, hi = (min(flat), max(flat)) if flat else (0.0, 1.0)
        if abs(hi - lo) < 1e-9:
            hi = lo + 1.0
        pad = (hi - lo) * 0.06
        if panel["zero"]:
            hi += pad
        else:
            lo -= pad; hi += pad
        _draw_text(buf, width, height, 20, top + 14, panel["title"], (0.92, 0.92, 0.95), 2)   # PATCH: acima do primeiro rotulo do eixo
        _draw_text(buf, width, height, 20, top - 28, panel["unit"], (0.65, 0.67, 0.72), 1)
        for tick in range(6):
            ratio = tick / 5.0
            y = bottom + (top - bottom) * ratio
            value = lo + (hi - lo) * ratio
            _draw_line(buf, width, height, left, y, right, y, (0.16, 0.16, 0.19))
            _draw_text(buf, width, height, 92, y - 4, "%.2f" % value, (0.68, 0.70, 0.74), 1)
        for index in frame_indices:
            x = left + (right - left) * index / max(1, len(frames) - 1)
            _draw_line(buf, width, height, x, bottom, x, top, (0.11, 0.11, 0.14))
            _draw_text(buf, width, height, x - 10, bottom - 20, str(frames[index]), (0.72, 0.74, 0.78), 1)
        _draw_text(buf, width, height, right - 55, bottom - 35, "FRAME", (0.62, 0.64, 0.69), 1)
        for role, values in selected.items():
            color = GRAPH_COLORS[role]
            for i in range(1, len(values)):
                x0 = left + (right - left) * (i - 1) / max(1, len(values) - 1)
                x1 = left + (right - left) * i / max(1, len(values) - 1)
                y0 = bottom + (top - bottom) * (values[i - 1] - lo) / (hi - lo)
                y1 = bottom + (top - bottom) * (values[i] - lo) / (hi - lo)
                _draw_line(buf, width, height, x0, y0, x1, y1, color, 2)
            peak_i = max(range(len(values)), key=values.__getitem__)
            px = left + (right - left) * peak_i / max(1, len(values) - 1)
            py = bottom + (top - bottom) * (values[peak_i] - lo) / (hi - lo)
            _draw_line(buf, width, height, px - 4, py, px + 4, py, color, 2)
            _draw_line(buf, width, height, px, py - 4, px, py + 4, color, 2)
        _draw_line(buf, width, height, left, bottom, right, bottom, (0.7, 0.7, 0.75))
        _draw_line(buf, width, height, left, bottom, left, top, (0.7, 0.7, 0.75))
    _draw_text(buf, width, height, info_x, 985, "LEGENDA", (1, 1, 1), 2)
    for row, role in enumerate(roles):
        y = 945 - row * 36
        _draw_line(buf, width, height, info_x, y, info_x + 32, y, GRAPH_COLORS[role], 3)
        _draw_text(buf, width, height, info_x + 45, y - 5, role.upper(), (0.88, 0.89, 0.92), 1)
    _draw_text(buf, width, height, info_x, 675, "PICOS", (1, 1, 1), 2)
    for row, role in enumerate(roles):
        values = data["speed"][role]
        peak_i = max(range(len(values)), key=values.__getitem__)
        text = "%s F%d %.3f" % (role.upper(), frames[peak_i], values[peak_i])
        _draw_text(buf, width, height, info_x, 640 - row * 34, text, GRAPH_COLORS[role], 1)
    _draw_text(buf, width, height, info_x, 365, "CORES IGUAIS", (0.8, 0.81, 0.84), 1)
    _draw_text(buf, width, height, info_x, 345, "NOS 3 GRAFICOS", (0.8, 0.81, 0.84), 1)
    image = bpy.data.images.get("ML_Graphs") or bpy.data.images.new("ML_Graphs", width, height)
    if image.size[0] != width or image.size[1] != height:
        bpy.data.images.remove(image)
        image = bpy.data.images.new("ML_Graphs", width, height)
    image.pixels.foreach_set(buf)
    image.update()
    output_path = output_path or os.path.join(_ensure_output_dir(scene), "motion_lens_graphs.png")
    image.filepath_raw = output_path
    image.file_format = 'PNG'
    image.save()
    return output_path


def _evaluated_bounds(context, meshes):
    depsgraph = context.evaluated_depsgraph_get()
    points = []
    for ob in meshes:
        ev = ob.evaluated_get(depsgraph)
        for corner in ev.bound_box:
            points.append(ev.matrix_world @ Vector(corner))
    if not points:
        raise RuntimeError("Nenhuma malha deformada ligada ao armature")
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return lo, hi


def _camera_for_view(camera, center, size, view):
    direction = {"FRONT": Vector((0, -1, 0)), "SIDE": Vector((1, 0, 0)), "TOP": Vector((0, 0, 1))}[view]
    camera.location = center + direction * max(2.0, size * 3.0)
    up = 'Y' if view != "TOP" else 'X'
    camera.rotation_euler = (-direction).to_track_quat('-Z', up).to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = max(0.1, size * 1.25)


def _bounds_for_frames(context, scene, meshes, frames):
    lows, highs = [], []
    with _restore_frame(scene):
        for frame in frames:
            scene.frame_set(frame)
            lo, hi = _evaluated_bounds(context, meshes)
            lows.append(lo)
            highs.append(hi)
    lo = Vector((min(v.x for v in lows), min(v.y for v in lows), min(v.z for v in lows)))
    hi = Vector((max(v.x for v in highs), max(v.y for v in highs), max(v.z for v in highs)))
    return lo, hi


def _capture_skeleton_frames(scene, arm, frames):
    result = []
    with _restore_frame(scene):
        for frame in frames:
            scene.frame_set(frame)
            result.append([
                (pb.name.split(":")[-1], _world_point(arm, pb, False).copy(), _world_point(arm, pb, True).copy())
                for pb in arm.pose.bones
            ])
    return result


def render_skeleton_sheet(context=None, frames=None, output_path=None, cell_size=320):
    context = _context(context)
    scene = context.scene
    arm = _armature(context)
    if arm is None:
        raise RuntimeError("Selecione um armature")
    frames = _parse_frames(frames or scene.motion_lens_frames, scene) if isinstance(frames or scene.motion_lens_frames, str) else list(frames)
    if not frames:
        raise RuntimeError("Nenhum frame valido")
    captures = _capture_skeleton_frames(scene, arm, frames)
    points = [p for capture in captures for _, a, b in capture for p in (a, b)]
    views = ("FRONT", "SIDE", "TOP")
    width, height = cell_size * len(frames), cell_size * len(views)
    sheet = [0.04, 0.04, 0.05, 1.0] * (width * height)

    def project(point, view):
        if view == "FRONT":
            return point.x, point.z
        if view == "SIDE":
            return point.y, point.z
        return point.x, point.y

    for row, view in enumerate(views):
        projected = [project(p, view) for p in points]
        lo_x, hi_x = min(p[0] for p in projected), max(p[0] for p in projected)
        lo_y, hi_y = min(p[1] for p in projected), max(p[1] for p in projected)
        span = max(hi_x - lo_x, hi_y - lo_y, 1e-5) * 1.15
        center_x, center_y = (lo_x + hi_x) * 0.5, (lo_y + hi_y) * 0.5
        for col, (frame, capture) in enumerate(zip(frames, captures)):
            ox, oy = col * cell_size, (len(views) - 1 - row) * cell_size
            color = _color(col / max(1, len(frames) - 1))
            labels = {
                "Hips": "HIPS", "Head": "HEAD", "LeftHand": "LHAND", "RightHand": "RHAND",
                "LeftFoot": "LFOOT", "RightFoot": "RFOOT", "Crest": "CREST", "Tail4": "TAIL4",
            }
            for name, a, b in capture:
                ax, ay = project(a, view)
                bx, by = project(b, view)
                x0 = ox + cell_size * (0.5 + (ax - center_x) / span)
                y0 = oy + cell_size * (0.5 + (ay - center_y) / span)
                x1 = ox + cell_size * (0.5 + (bx - center_x) / span)
                y1 = oy + cell_size * (0.5 + (by - center_y) / span)
                _draw_line(sheet, width, height, x0, y0, x1, y1, color, 3)
                if name in labels:
                    _draw_text(sheet, width, height, x0 + 4, y0 + 4, labels[name], (0.92, 0.92, 0.96), 1)
            _draw_text(sheet, width, height, ox + 8, oy + 8, view[0] + " " + str(frame), (1, 1, 1), 2)
    image = bpy.data.images.get("ML_SkeletonSheet") or bpy.data.images.new("ML_SkeletonSheet", width, height)
    if image.size[0] != width or image.size[1] != height:
        bpy.data.images.remove(image)
        image = bpy.data.images.new("ML_SkeletonSheet", width, height)
    image.pixels.foreach_set(sheet)
    image.update()
    output_path = output_path or os.path.join(_ensure_output_dir(scene), "motion_lens_skeleton_sheet.png")
    image.filepath_raw = output_path
    image.file_format = 'PNG'
    image.save()
    return output_path


def render_contact_sheet(
    context=None, frames=None, output_path=None, cell_size=256,
    camera_names=None, silhouette=False, fixed_framing=True,
):
    """Renderiza FRONT/SIDE/TOP em um unico PNG, com frame em cada celula.

    Usa o render OpenGL do viewport e restaura frame, camera e configuracoes.
    """
    context = _context(context)
    scene = context.scene
    arm = _armature(context)
    if arm is None:
        raise RuntimeError("Selecione um armature")
    meshes = _meshes_of(arm)
    if not meshes:
        raise RuntimeError("Nenhuma malha ligada ao armature")
    if frames is None:
        frames = _parse_frames(scene.motion_lens_frames, scene)
    elif isinstance(frames, str):
        frames = _parse_frames(frames, scene)
    frames = list(frames)
    if not frames:
        raise RuntimeError("Nenhum frame valido para o contact sheet")
    if len(frames) > 16:
        raise RuntimeError("Use no maximo 16 frames por contact sheet")
    if camera_names is None:
        camera_names = [s.strip() for s in scene.motion_lens_camera_names.split(",") if s.strip()]
    real_cameras = []
    for name in camera_names or []:
        camera = bpy.data.objects.get(name)
        if camera and camera.type == 'CAMERA':
            real_cameras.append(camera)
    views = [("CAM%d" % (i + 1), camera) for i, camera in enumerate(real_cameras)]
    if not views:
        views = [(name, None) for name in ("FRONT", "SIDE", "TOP")]
    width, height = cell_size * len(frames), cell_size * len(views)
    sheet = [0.08, 0.08, 0.08, 1.0] * (width * height)
    cam_data = bpy.data.cameras.new("ML_TempCamera")
    cam = bpy.data.objects.new("ML_TempCamera", cam_data)
    scene.collection.objects.link(cam)
    view_layer = context.view_layer
    silhouette_material = None
    temp_dir = tempfile.mkdtemp(prefix="ml_contact_", dir=_ensure_output_dir(scene))      # PATCH: sob a saida; o %TEMP% do sandbox pode conter {} (expressao no Blender 5.2)
    hidden_state = [(ob, ob.hide_render) for ob in scene.objects]
    old = {
        "camera": scene.camera, "x": scene.render.resolution_x, "y": scene.render.resolution_y,
        "pct": scene.render.resolution_percentage, "film": scene.render.film_transparent,
        "engine": scene.render.engine, "filepath": scene.render.filepath,
        "color_mode": scene.render.image_settings.color_mode,
        "fmt": scene.render.image_settings.file_format,
        "override": view_layer.material_override,
        "world_color": scene.world.color[:] if scene.world else None,
    }
    try:
        scene.render.resolution_x = cell_size
        scene.render.resolution_y = cell_size
        scene.render.resolution_percentage = 100
        scene.render.film_transparent = False
        scene.render.engine = 'BLENDER_WORKBENCH'
        scene.render.image_settings.file_format = 'PNG'
        scene.render.image_settings.color_mode = 'RGBA'
        # Isola o personagem: chão, grades, luzes e cenografia não podem cobrir a captura.
        allowed = set(meshes + real_cameras + [cam])
        for ob in scene.objects:
            if ob not in allowed:
                ob.hide_render = True
        if silhouette:
            # PATCH: em Workbench o material_override nao tinge a malha; usa-se cor unica preta, luz plana e fundo branco
            _shd = scene.display.shading
            old["shading"] = (_shd.light, _shd.color_type, tuple(_shd.single_color), _shd.show_object_outline, _shd.show_xray)
            _shd.light = 'FLAT'
            _shd.color_type = 'SINGLE'
            _shd.single_color = (0.0, 0.0, 0.0)
            _shd.show_object_outline = False
            _shd.show_xray = False
            if scene.world:
                scene.world.color = (1.0, 1.0, 1.0)
        fixed = _bounds_for_frames(context, scene, meshes, frames) if fixed_framing else None
        with _restore_frame(scene):
            for col, frame in enumerate(frames):
                scene.frame_set(frame)
                lo, hi = fixed if fixed else _evaluated_bounds(context, meshes)
                center = (lo + hi) * 0.5
                size = max((hi - lo).x, (hi - lo).y, (hi - lo).z)
                for row, (view, real_camera) in enumerate(views):
                    if real_camera:
                        scene.camera = real_camera
                    else:
                        scene.camera = cam
                        _camera_for_view(cam, center, size, view)
                    cell_path = os.path.join(temp_dir, "cell_%02d_%02d.png" % (col, row))
                    scene.render.filepath = cell_path
                    bpy.ops.render.render(write_still=True)
                    result = bpy.data.images.load(cell_path, check_existing=False)
                    src = list(result.pixels[:])
                    bpy.data.images.remove(result)
                    if silhouette:
                        # PATCH: binariza o render final (preto = personagem, branco puro = fundo); a transformacao de vista deixava o fundo cinza (~196)
                        for _i in range(0, len(src), 4):
                            _v = 0.0 if src[_i] < 0.35 else 1.0
                            src[_i] = src[_i + 1] = src[_i + 2] = _v
                            src[_i + 3] = 1.0
                    expected = cell_size * cell_size * 4
                    if len(src) != expected:
                        raise RuntimeError("Render com tamanho inesperado: %d; esperado %d" % (len(src), expected))
                    ox, oy = col * cell_size, (len(views) - 1 - row) * cell_size
                    for y in range(cell_size):
                        dst0 = ((oy + y) * width + ox) * 4
                        src0 = (y * cell_size) * 4
                        sheet[dst0:dst0 + cell_size * 4] = src[src0:src0 + cell_size * 4]
                    _draw_text(sheet, width, height, ox + 8, oy + 8, view[0] + " " + str(frame), (1, 1, 1), 2)
    finally:
        scene.camera = old["camera"]
        scene.render.resolution_x = old["x"]
        scene.render.resolution_y = old["y"]
        scene.render.resolution_percentage = old["pct"]
        scene.render.film_transparent = old["film"]
        scene.render.engine = old["engine"]
        scene.render.filepath = old["filepath"]
        scene.render.image_settings.color_mode = old["color_mode"]
        scene.render.image_settings.file_format = old["fmt"]      # PATCH: restaurava so o color_mode
        for ob, hidden in hidden_state:
            if ob.name in bpy.data.objects:
                ob.hide_render = hidden
        view_layer.material_override = old["override"]
        if "shading" in old:
            _shd = scene.display.shading
            _shd.light, _shd.color_type, _shd.single_color, _shd.show_object_outline, _shd.show_xray = old["shading"]
        if scene.world and old["world_color"] is not None:
            scene.world.color = old["world_color"]
        _remove_object_and_data(cam)
        shutil.rmtree(temp_dir, ignore_errors=True)
    image = bpy.data.images.get("ML_ContactSheet") or bpy.data.images.new("ML_ContactSheet", width, height)
    if image.size[0] != width or image.size[1] != height:
        bpy.data.images.remove(image)
        image = bpy.data.images.new("ML_ContactSheet", width, height)
    image.pixels.foreach_set(sheet)
    image.update()
    default_name = "motion_lens_silhouette_sheet.png" if silhouette else "motion_lens_contact_sheet.png"
    output_path = output_path or os.path.join(_ensure_output_dir(scene), default_name)
    image.filepath_raw = output_path
    image.file_format = 'PNG'
    image.save()
    return output_path


def compare_actions(context=None, action_a=None, action_b=None, sample_count=41, armature_name=None):
    """Compara duas actions por tempo normalizado e restaura a action original."""
    context = _context(context)
    scene = context.scene
    arm = _armature(context, armature_name)
    if arm is None:
        raise RuntimeError("Selecione um armature")
    a = bpy.data.actions.get(action_a) if isinstance(action_a, str) else action_a
    b = bpy.data.actions.get(action_b) if isinstance(action_b, str) else action_b
    if not a or not b:
        raise RuntimeError("Informe duas actions existentes")
    if arm.animation_data is None:
        arm.animation_data_create()
    original = arm.animation_data.action
    roles = {r: _resolve_bone(arm, r) for r in ("Hips", "Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot")}
    roles = {r: pb for r, pb in roles.items() if pb}
    def sample(action):
        arm.animation_data.action = action
        start, end = action.frame_range
        out = {r: [] for r in roles}
        for i in range(sample_count):
            t = i / max(1, sample_count - 1)
            value = start + (end - start) * t
            whole = math.floor(value)
            scene.frame_set(whole, subframe=value - whole)
            context.view_layer.update()
            for role, pb in roles.items():
                out[role].append(_world_point(arm, pb).copy())
        return out
    with _restore_frame(scene):
        try:
            pa, pb = sample(a), sample(b)
        finally:
            arm.animation_data.action = original
    lines = ["COMPARACAO NORMALIZADA: %s x %s (%d amostras)" % (a.name, b.name, sample_count)]
    for role in roles:
        distances = [(x - y).length for x, y in zip(pa[role], pb[role])]
        peak = max(range(len(distances)), key=distances.__getitem__)
        lines.append("  %-10s diff media %.3f m | pico %.3f em %.0f%%" % (
            role, sum(distances) / len(distances), distances[peak], peak * 100 / max(1, len(distances) - 1)
        ))
    lines.append("Isto mede diferenca espacial normalizada; nao determina qual action e artisticamente melhor.")
    return "\n".join(lines)


def _sample_action(context, arm, action, sample_count, roles=None, segments=False):
    start, end = action.frame_range
    output = {role: {"positions": [], "rotations": []} for role in (roles or {})}
    segment_samples = []
    arm.animation_data.action = action
    for index in range(sample_count):
        t = index / max(1, sample_count - 1)
        value = start + (end - start) * t
        whole = math.floor(value)
        context.scene.frame_set(whole, subframe=value - whole)
        context.view_layer.update()
        world_q = arm.matrix_world.to_quaternion()
        for role, bone_name in (roles or {}).items():
            pb = arm.pose.bones[bone_name]
            output[role]["positions"].append(_world_point(arm, pb).copy())
            output[role]["rotations"].append((world_q @ pb.matrix.to_quaternion()).normalized())
        if segments:
            segment_samples.append([
                (_world_point(arm, pb, False).copy(), _world_point(arm, pb, True).copy())
                for pb in arm.pose.bones
            ])
    return output, segment_samples


def compare_actions_data(context=None, action_a=None, action_b=None, sample_count=41, armature_name=None):
    """Retorna diferencas posicionais e angulares por osso em tempo normalizado."""
    context = _context(context)
    scene = context.scene
    arm = _armature(context, armature_name)
    if arm is None:
        raise RuntimeError("Selecione um armature")
    first = bpy.data.actions.get(action_a) if isinstance(action_a, str) else action_a
    second = bpy.data.actions.get(action_b) if isinstance(action_b, str) else action_b
    if not first or not second:
        raise RuntimeError("Informe duas actions existentes")
    if arm.animation_data is None:
        arm.animation_data_create()
    original = arm.animation_data.action
    mapping = _parse_mapping(scene.motion_lens_bone_map)
    roles = {}
    for role in DEFAULT_ROLES + EXTRA_ROLES:
        pb = _resolve_bone(arm, role, mapping)
        if pb:
            roles[role] = pb.name
    with _restore_frame(scene):
        try:
            a, _ = _sample_action(context, arm, first, sample_count, roles)
            b, _ = _sample_action(context, arm, second, sample_count, roles)
        finally:
            arm.animation_data.action = original
    result = {"action_a": first.name, "action_b": second.name, "samples": sample_count, "bones": {}}
    for role in roles:
        positional, angular = [], []
        for pa, pb, qa, qb in zip(
            a[role]["positions"], b[role]["positions"],
            a[role]["rotations"], b[role]["rotations"],
        ):
            positional.append((pa - pb).length)
            angular.append(math.degrees(2.0 * math.acos(min(1.0, abs(qa.dot(qb))))))
        result["bones"][role] = {"position": positional, "angle": angular}
    return result


def render_pose_diff_heatmap(context=None, action_a=None, action_b=None, output_path=None, sample_count=41):
    data = compare_actions_data(context, action_a, action_b, sample_count)
    scene = _context(context).scene
    roles = list(data["bones"])
    cell_w, cell_h, label_w = 18, 18, 80
    width = label_w + sample_count * cell_w
    height = max(1, len(roles)) * cell_h
    pixels = [0.04, 0.04, 0.05, 1.0] * (width * height)
    combined = []
    for role in roles:
        values = []
        pos = data["bones"][role]["position"]
        ang = data["bones"][role]["angle"]
        for p, a in zip(pos, ang):
            values.append(p + a / 180.0)
        combined.extend(values)
        data["bones"][role]["combined"] = values
    cap = max(statistics.quantiles(combined, n=20)[-1] if len(combined) >= 20 else max(combined, default=1.0), 1e-8)
    for row, role in enumerate(roles):
        y0 = height - (row + 1) * cell_h
        _draw_text(pixels, width, height, 4, y0 + 4, str(row + 1), (1, 1, 1), 1)
        for col, value in enumerate(data["bones"][role]["combined"]):
            t = min(1.0, value / cap)
            color = (t, 0.15 * (1.0 - t), 1.0 - t)
            for y in range(y0, y0 + cell_h - 1):
                for x in range(label_w + col * cell_w, label_w + (col + 1) * cell_w - 1):
                    _set_pixel(pixels, width, height, x, y, color)
    image = bpy.data.images.get("ML_PoseDiff") or bpy.data.images.new("ML_PoseDiff", width, height)
    if image.size[0] != width or image.size[1] != height:
        bpy.data.images.remove(image)
        image = bpy.data.images.new("ML_PoseDiff", width, height)
    image.pixels.foreach_set(pixels)
    image.update()
    output_path = output_path or os.path.join(_ensure_output_dir(scene), "motion_lens_pose_diff.png")
    image.filepath_raw, image.file_format = output_path, 'PNG'
    image.save()
    legend_path = os.path.splitext(output_path)[0] + ".json"
    with open(legend_path, "w", encoding="utf-8") as handle:
        json.dump({"sampling": "tempo NORMALIZADO (cada action amostrada em fracoes iguais da propria duracao); o rotulo de frame NAO e o frame literal das duas actions", "rows": {str(i + 1): role for i, role in enumerate(roles)}, "comparison": data}, handle, ensure_ascii=False, indent=2)
    return output_path


def render_reference_overlay_sheet(
    context=None, reference_action=None, current_action=None,
    frames=None, output_path=None, cell_size=256,
):
    """Sobrepoe esqueletos: atual em vermelho, referencia em ciano."""
    context = _context(context)
    scene = context.scene
    arm = _armature(context)
    if arm is None:
        raise RuntimeError("Selecione um armature")
    if arm.animation_data is None:
        arm.animation_data_create()
    current = bpy.data.actions.get(current_action) if isinstance(current_action, str) else current_action
    current = current or arm.animation_data.action
    reference = bpy.data.actions.get(reference_action) if isinstance(reference_action, str) else reference_action
    if current is None or reference is None:
        raise RuntimeError("Defina a action atual e a action de referencia")
    if frames is None:
        frames = _parse_frames(scene.motion_lens_frames, scene)
    sample_count = len(frames)
    if not 1 <= sample_count <= 16:
        raise RuntimeError("Use entre 1 e 16 amostras")
    original = arm.animation_data.action
    with _restore_frame(scene):
        try:
            _, current_segments = _sample_action(context, arm, current, sample_count, segments=True)
            _, reference_segments = _sample_action(context, arm, reference, sample_count, segments=True)
        finally:
            arm.animation_data.action = original
    views = ("FRONT", "SIDE", "TOP")
    width, height = cell_size * sample_count, cell_size * len(views)
    pixels = [0.035, 0.035, 0.045, 1.0] * (width * height)
    all_points = [p for group in (current_segments, reference_segments) for sample in group for seg in sample for p in seg]
    def project(point, view):
        return (point.x, point.z) if view == "FRONT" else ((point.y, point.z) if view == "SIDE" else (point.x, point.y))
    for row, view in enumerate(views):
        projected = [project(p, view) for p in all_points]
        lo_x, hi_x = min(p[0] for p in projected), max(p[0] for p in projected)
        lo_y, hi_y = min(p[1] for p in projected), max(p[1] for p in projected)
        span = max(hi_x - lo_x, hi_y - lo_y, 1e-5) * 1.15
        cx, cy = (lo_x + hi_x) * 0.5, (lo_y + hi_y) * 0.5
        for col in range(sample_count):
            ox, oy = col * cell_size, (len(views) - 1 - row) * cell_size
            for segments, color in ((reference_segments[col], (0.0, 0.9, 1.0)), (current_segments[col], (1.0, 0.2, 0.15))):
                for a, b in segments:
                    ax, ay = project(a, view); bx, by = project(b, view)
                    _draw_line(
                        pixels, width, height,
                        ox + cell_size * (0.5 + (ax - cx) / span), oy + cell_size * (0.5 + (ay - cy) / span),
                        ox + cell_size * (0.5 + (bx - cx) / span), oy + cell_size * (0.5 + (by - cy) / span),
                        color, 1,
                    )
            label = frames[col] if col < len(frames) else col
            _draw_text(pixels, width, height, ox + 8, oy + 8, view[0] + " " + str(label), (1, 1, 1), 2)
    image = bpy.data.images.get("ML_ReferenceOverlay") or bpy.data.images.new("ML_ReferenceOverlay", width, height)
    if image.size[0] != width or image.size[1] != height:
        bpy.data.images.remove(image)
        image = bpy.data.images.new("ML_ReferenceOverlay", width, height)
    image.pixels.foreach_set(pixels)
    image.update()
    output_path = output_path or os.path.join(_ensure_output_dir(scene), "motion_lens_reference_overlay.png")
    image.filepath_raw, image.file_format = output_path, 'PNG'
    image.save()
    return output_path


def _metrics_from_analysis(data):
    kinds = {}
    for issue in data["issues"]:
        kinds[issue["kind"]] = kinds.get(issue["kind"], 0) + 1
    peaks = {role: max(values, default=0.0) for role, values in data["speed"].items()}
    slides = {foot: info["max_step_slide"] for foot, info in data["contacts"].items()}
    valid_z = [z for z in data["mesh_min_z"] if z is not None]
    return {
        "schema": 1, "frames": [data["frames"][0], data["frames"][-1]],
        "issue_counts": kinds, "peak_speed": peaks, "max_slide": slides,
        "min_mesh_z": min(valid_z) if valid_z else None,
    }


def save_baseline(context=None, path=None):
    context = _context(context)
    data = analyze_motion(context, max_issues=100000)
    path = bpy.path.abspath(path or context.scene.motion_lens_baseline_path or os.path.join(_ensure_output_dir(context.scene), "motion_lens_baseline.json"))
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(_metrics_from_analysis(data), handle, ensure_ascii=False, indent=2)
    return path


def compare_baseline(context=None, path=None, tolerance=0.10):
    context = _context(context)
    path = bpy.path.abspath(path or context.scene.motion_lens_baseline_path)
    with open(path, "r", encoding="utf-8") as handle:
        baseline = json.load(handle)
    current = _metrics_from_analysis(analyze_motion(context, max_issues=100000))
    regressions = []
    for role, value in current["peak_speed"].items():
        old = baseline.get("peak_speed", {}).get(role)
        if old is not None and value > old * (1.0 + tolerance) + 1e-6:
            regressions.append("%s: pico %.3f > baseline %.3f" % (role, value, old))
    for foot, value in current["max_slide"].items():
        old = baseline.get("max_slide", {}).get(foot)
        if old is not None and value > old * (1.0 + tolerance) + 1e-6:
            regressions.append("%s: slide %.3f > baseline %.3f" % (foot, value, old))
    old_z, new_z = baseline.get("min_mesh_z"), current.get("min_mesh_z")
    if old_z is not None and new_z is not None and new_z < old_z - max(0.005, abs(old_z) * tolerance):
        regressions.append("Malha desceu: z minimo %.4f < baseline %.4f" % (new_z, old_z))
    return {"passed": not regressions, "regressions": regressions, "baseline": baseline, "current": current}


def _image_data_uri(path):
    with open(path, "rb") as handle:
        encoded = base64.b64encode(handle.read()).decode("ascii")
    return "data:image/png;base64," + encoded


def build_html_report(context=None, output_path=None, include_renders=True):
    """Gera relatorio HTML autocontido. Renderizacoes podem ser desativadas em background."""
    context = _context(context)
    scene = context.scene
    analysis = analyze_motion(context)
    report = build_report(context)
    images = []
    graph_path = render_graphs(context, analysis=analysis)
    images.append(("Velocidade, altura e energia", graph_path))
    skeleton_path = render_skeleton_sheet(context)
    images.append(("Esqueleto", skeleton_path))
    if include_renders:
        contact_path = render_contact_sheet(context)
        silhouette_path = render_contact_sheet(context, silhouette=True)
        images.extend((("Contact sheet", contact_path), ("Silhueta", silhouette_path)))
    blocks = []
    for title, path in images:
        blocks.append("<section><h2>%s</h2><img src='%s'></section>" % (html.escape(title), _image_data_uri(path)))
    document = """<!doctype html><meta charset='utf-8'><title>Motion Lens</title>
<style>body{font-family:system-ui;background:#17171c;color:#eee;max-width:1400px;margin:auto;padding:24px}pre{white-space:pre-wrap;background:#22232b;padding:16px}img{max-width:100%%;background:#fff}section{margin:28px 0}</style>
<h1>Motion Lens 0.3</h1><pre>%s</pre>%s
<p><strong>Limite:</strong> o relatorio mede sinais tecnicos; peso, ritmo, intencao e qualidade artistica continuam dependendo de avaliacao humana.</p>""" % (html.escape(report), "".join(blocks))
    output_path = output_path or os.path.join(_ensure_output_dir(scene), "motion_lens_report.html")
    with open(output_path, "w", encoding="utf-8") as handle:
        handle.write(document)
    return output_path


def _octahedron_mesh():
    me = bpy.data.meshes.get("ML_TickMesh")
    if me:
        return me
    me = bpy.data.meshes.new("ML_TickMesh")
    verts = [(0, 0, 1), (1, 0, 0), (0, 1, 0), (-1, 0, 0), (0, -1, 0), (0, 0, -1)]
    faces = [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 1), (5, 2, 1), (5, 3, 2), (5, 4, 3), (5, 1, 4)]
    me.from_pydata(verts, [], faces)
    return me


def create_ghosts(context=None, frames=None):
    context = _context(context)
    scene = context.scene
    arm = _armature(context)
    if arm is None:
        raise RuntimeError("Selecione um armature")
    frames = _parse_frames(frames or scene.motion_lens_frames, scene) if isinstance(frames or scene.motion_lens_frames, str) else list(frames)
    meshes = _meshes_of(arm)
    _clear_collection(GHOST_COLL)
    coll = _collection(scene, GHOST_COLL)
    count = 0
    with _restore_frame(scene):
        for i, frame in enumerate(frames):
            scene.frame_set(frame)
            depsgraph = context.evaluated_depsgraph_get()
            mat = _material("ML_ghost_%02d" % i, _color(i / max(1, len(frames) - 1)), scene.motion_lens_alpha)
            for ob in meshes:
                ev = ob.evaluated_get(depsgraph)
                me = bpy.data.meshes.new_from_object(ev, depsgraph=depsgraph)
                ghost = bpy.data.objects.new("ML_ghost_f%d_%s" % (frame, ob.name), me)
                ghost.matrix_world = ev.matrix_world.copy()
                me.materials.clear()
                me.materials.append(mat)
                ghost.hide_select = True
                coll.objects.link(ghost)
                count += 1
    return count


def create_trails(context=None, bones=None, use_tail=None):
    context = _context(context)
    scene = context.scene
    arm = _armature(context)
    if arm is None:
        raise RuntimeError("Selecione um armature")
    names = bones or [s.strip() for s in scene.motion_lens_bones.split(",") if s.strip()]
    use_tail = scene.motion_lens_use_tail if use_tail is None else use_tail
    mapping = _parse_mapping(scene.motion_lens_bone_map)
    resolved = [(name, _resolve_bone(arm, name, mapping)) for name in names]
    resolved = [(name, pb) for name, pb in resolved if pb]
    if not resolved:
        raise RuntimeError("Nenhum osso encontrado")
    _clear_collection(TRAIL_COLL)
    coll = _collection(scene, TRAIL_COLL)
    points = {name: [] for name, _ in resolved}
    with _restore_frame(scene):
        for frame in range(scene.frame_start, scene.frame_end + 1):
            scene.frame_set(frame)
            for name, pb in resolved:
                points[name].append(_world_point(arm, pb, use_tail).copy())
    tick_mesh = _octahedron_mesh()
    for k, (name, _) in enumerate(resolved):
        values = points[name]
        curve = bpy.data.curves.new("ML_trail_" + name, 'CURVE')
        curve.dimensions = '3D'
        curve.bevel_depth = 0.006
        spline = curve.splines.new('POLY')
        spline.points.add(len(values) - 1)
        for i, value in enumerate(values):
            spline.points[i].co = (*value, 1.0)
        ob = bpy.data.objects.new("ML_trail_" + name, curve)
        curve.materials.append(_material("ML_trail_%d" % k, _color(k / max(1, len(resolved) - 1))))
        ob.hide_select = True
        coll.objects.link(ob)
        for i in range(0, len(values), max(1, scene.motion_lens_tick_step)):
            tick = bpy.data.objects.new("ML_tick_%s_%d" % (name, scene.frame_start + i), tick_mesh)
            tick.location = values[i]
            tick.scale = (0.012, 0.012, 0.012)
            tick.hide_select = True
            coll.objects.link(tick)
    return len(resolved)


def write_report(context=None):
    text = build_report(context)
    block = bpy.data.texts.get(REPORT_TEXT) or bpy.data.texts.new(REPORT_TEXT)
    block.clear()
    block.write(text)
    print(text)
    return text


class ML_OT_ghosts(bpy.types.Operator):
    bl_idname = "motionlens.ghosts"
    bl_label = "Fantasmas de pose"
    def execute(self, context):
        try:
            count = create_ghosts(context)
            self.report({'INFO'}, "%d fantasmas criados" % count)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_trails(bpy.types.Operator):
    bl_idname = "motionlens.trails"
    bl_label = "Trilhas das juntas"
    def execute(self, context):
        try:
            count = create_trails(context)
            self.report({'INFO'}, "%d trilhas criadas" % count)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_report(bpy.types.Operator):
    bl_idname = "motionlens.report"
    bl_label = "Diagnostico priorizado"
    def execute(self, context):
        try:
            write_report(context)
            self.report({'INFO'}, "Relatorio em ML_Report")
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_graphs(bpy.types.Operator):
    bl_idname = "motionlens.graphs"
    bl_label = "Graficos PNG"
    def execute(self, context):
        try:
            path = render_graphs(context)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_contact_sheet(bpy.types.Operator):
    bl_idname = "motionlens.contact_sheet"
    bl_label = "Contact sheet PNG"
    def execute(self, context):
        try:
            path = render_contact_sheet(context)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_silhouette_sheet(bpy.types.Operator):
    bl_idname = "motionlens.silhouette_sheet"
    bl_label = "Silhuetas PNG"
    def execute(self, context):
        try:
            path = render_contact_sheet(context, silhouette=True)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_skeleton_sheet(bpy.types.Operator):
    bl_idname = "motionlens.skeleton_sheet"
    bl_label = "Esqueleto PNG"
    def execute(self, context):
        try:
            path = render_skeleton_sheet(context)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_reference_overlay(bpy.types.Operator):
    bl_idname = "motionlens.reference_overlay"
    bl_label = "Sobrepor referencia"
    def execute(self, context):
        try:
            path = render_reference_overlay_sheet(context, context.scene.motion_lens_reference_action)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_pose_diff(bpy.types.Operator):
    bl_idname = "motionlens.pose_diff"
    bl_label = "Mapa de diferencas"
    def execute(self, context):
        try:
            current = context.active_object.animation_data.action if context.active_object and context.active_object.animation_data else None
            path = render_pose_diff_heatmap(context, current, context.scene.motion_lens_reference_action)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_html_report(bpy.types.Operator):
    bl_idname = "motionlens.html_report"
    bl_label = "Relatorio HTML completo"
    def execute(self, context):
        try:
            path = build_html_report(context)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_save_profile(bpy.types.Operator):
    bl_idname = "motionlens.save_profile"
    bl_label = "Salvar perfil"
    def execute(self, context):
        try:
            self.report({'INFO'}, "Salvo: " + save_profile(context))
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_load_profile(bpy.types.Operator):
    bl_idname = "motionlens.load_profile"
    bl_label = "Carregar perfil"
    def execute(self, context):
        try:
            self.report({'INFO'}, "Carregado: " + load_profile(context))
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_save_baseline(bpy.types.Operator):
    bl_idname = "motionlens.save_baseline"
    bl_label = "Salvar baseline"
    def execute(self, context):
        try:
            self.report({'INFO'}, "Salvo: " + save_baseline(context))
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_check_baseline(bpy.types.Operator):
    bl_idname = "motionlens.check_baseline"
    bl_label = "Comparar baseline"
    def execute(self, context):
        try:
            result = compare_baseline(context)
            text = "BASELINE: PASSOU" if result["passed"] else "BASELINE: FALHOU\n" + "\n".join(result["regressions"])
            block = bpy.data.texts.get("ML_Regression") or bpy.data.texts.new("ML_Regression")
            block.clear(); block.write(text)
            self.report({'INFO'} if result["passed"] else {'WARNING'}, text.splitlines()[0])
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_clear(bpy.types.Operator):
    bl_idname = "motionlens.clear"
    bl_label = "Limpar auxiliares"
    def execute(self, context):
        clear_generated()
        return {'FINISHED'}


class ML_PT_panel(bpy.types.Panel):
    bl_label = "Motion Lens 0.3.1"
    bl_idname = "ML_PT_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "Motion Lens"
    def draw(self, context):
        scene = context.scene
        col = self.layout.column(align=True)
        col.prop(scene, "motion_lens_frames")
        col.prop(scene, "motion_lens_output_dir")
        col.operator("motionlens.contact_sheet")
        col.operator("motionlens.silhouette_sheet")
        col.operator("motionlens.skeleton_sheet")
        col.operator("motionlens.graphs")
        col.operator("motionlens.report")
        col.operator("motionlens.html_report")
        col.separator()
        col.prop(scene, "motion_lens_reference_action")
        col.operator("motionlens.reference_overlay")
        col.operator("motionlens.pose_diff")
        col.separator()
        col.prop(scene, "motion_lens_bones")
        col.prop(scene, "motion_lens_use_tail")
        col.operator("motionlens.trails")
        col.prop(scene, "motion_lens_alpha")
        col.operator("motionlens.ghosts")
        col.separator()
        col.prop(scene, "motion_lens_bone_map")
        col.prop(scene, "motion_lens_contract")
        col.prop(scene, "motion_lens_camera_names")
        col.prop(scene, "motion_lens_max_issues")
        col.separator()
        col.prop(scene, "motion_lens_profile_path")
        row = col.row(align=True)
        row.operator("motionlens.save_profile")
        row.operator("motionlens.load_profile")
        col.prop(scene, "motion_lens_baseline_path")
        row = col.row(align=True)
        row.operator("motionlens.save_baseline")
        row.operator("motionlens.check_baseline")
        col.operator("motionlens.clear")


classes = (
    ML_OT_ghosts, ML_OT_trails, ML_OT_report, ML_OT_graphs,
    ML_OT_contact_sheet, ML_OT_silhouette_sheet, ML_OT_skeleton_sheet,
    ML_OT_reference_overlay, ML_OT_pose_diff, ML_OT_html_report,
    ML_OT_save_profile, ML_OT_load_profile, ML_OT_save_baseline, ML_OT_check_baseline,
    ML_OT_clear, ML_PT_panel,
)


PROPERTIES = {
    "motion_lens_frames": StringProperty(name="Frames", default="1,5,9,13,17,21,25,29,33,37,41"),
    "motion_lens_alpha": FloatProperty(name="Opacidade", default=0.35, min=0.05, max=1.0),
    "motion_lens_bones": StringProperty(name="Ossos", default="RightHand,LeftHand,RightFoot,LeftFoot,Head,Hips"),
    "motion_lens_use_tail": BoolProperty(name="Usar ponta do osso", default=False),
    "motion_lens_bone_map": StringProperty(name="Mapa JSON", default="{}", description='Ex.: {"Hips":"root"}'),
    "motion_lens_output_dir": StringProperty(name="Saida", subtype='DIR_PATH', default="//motion_lens_output"),
    "motion_lens_max_issues": IntProperty(name="Max. alertas", default=12, min=1, max=100),
    "motion_lens_tick_step": IntProperty(name="Passo das marcas", default=5, min=1, max=100),
    "motion_lens_contact_margin": FloatProperty(name="Margem contato", default=0.035, min=0.001, max=1.0, unit='LENGTH'),
    "motion_lens_locked_speed": FloatProperty(name="Velocidade travado", default=0.015, min=0.0001, max=1.0),
    "motion_lens_slide_threshold": FloatProperty(name="Limiar slide", default=0.025, min=0.001, max=1.0, unit='LENGTH'),
    "motion_lens_ground_z": FloatProperty(name="Chao Z", default=0.0, unit='LENGTH'),
    "motion_lens_penetration_tolerance": FloatProperty(name="Tolerancia penetracao", default=0.02, min=0.001, max=1.0, unit='LENGTH'),
    "motion_lens_pop_min": FloatProperty(name="Pop minimo", default=0.08, min=0.001, max=10.0),
    "motion_lens_pop_mad": FloatProperty(name="Pop MAD", default=6.0, min=1.0, max=30.0),
    "motion_lens_direction_min": FloatProperty(name="Movimento minimo", default=0.015, min=0.001, max=1.0),
    "motion_lens_direction_dot": FloatProperty(name="Dot inversao", default=-0.75, min=-1.0, max=0.0),
    "motion_lens_rotation_jump": FloatProperty(name="Salto rotacao (graus)", default=75.0, min=1.0, max=180.0),
    "motion_lens_scale_tolerance": FloatProperty(name="Tolerancia escala", default=0.02, min=0.001, max=1.0),
    "motion_lens_contract": StringProperty(name="Contrato JSON", default="", subtype='FILE_PATH'),
    "motion_lens_profile_path": StringProperty(name="Perfil", default="", subtype='FILE_PATH'),
    "motion_lens_baseline_path": StringProperty(name="Baseline", default="", subtype='FILE_PATH'),
    "motion_lens_reference_action": StringProperty(name="Action referencia", default=""),
    "motion_lens_camera_names": StringProperty(name="Cameras", default="", description="Nomes separados por virgula; vazio usa frontal/lateral/topo"),
    "motion_lens_support_margin": FloatProperty(name="Margem apoio", default=0.12, min=0.001, max=2.0, unit='LENGTH'),
    "motion_lens_capsule_radius": FloatProperty(name="Raio capsula", default=0.07, min=0.001, max=1.0, unit='LENGTH'),
    "motion_lens_hyperextension": FloatProperty(name="Hiperextensao", default=175.0, min=90.0, max=180.0),
    "motion_lens_pause_speed": FloatProperty(name="Velocidade pausa", default=0.006, min=0.0001, max=1.0),
    "motion_lens_pause_frames": IntProperty(name="Frames pausa", default=3, min=2, max=30),
    "motion_lens_uniform_frames": IntProperty(name="Janela uniforme", default=5, min=3, max=60),
    "motion_lens_uniform_cv": FloatProperty(name="CV uniforme", default=0.08, min=0.001, max=1.0),
    "motion_lens_arc_break_angle": FloatProperty(name="Quebra de arco", default=65.0, min=1.0, max=180.0),
    "motion_lens_arc_straight_angle": FloatProperty(name="Arco quase reto", default=2.0, min=0.0, max=45.0),
    "motion_lens_arc_straight_frames": IntProperty(name="Frames arco reto", default=5, min=2, max=60),
    "motion_lens_tangent_break_ratio": FloatProperty(name="Quebra tangente", default=0.65, min=0.01, max=1.0),
    "motion_lens_extra_motion_min": FloatProperty(name="Movimento extra minimo", default=0.02, min=0.0001, max=2.0),
}


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    for name, prop in PROPERTIES.items():
        setattr(bpy.types.Scene, name, prop)


def unregister():
    for name in PROPERTIES:
        if hasattr(bpy.types.Scene, name):
            delattr(bpy.types.Scene, name)
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
