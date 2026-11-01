"""Autoria não destrutiva de exagero e smear 3D para o Motion Lens."""
import bpy
import bmesh
import json
import math
import os
from mathutils import Quaternion, Vector

from .common import _armature, _context, _ensure_output_dir, _parse_mapping, _resolve_bone, _restore_frame, _world_point


COLLECTION = "ML_Exaggeration"
REPORT_TEXT = "ML_Exaggeration_Report"
PRESETS = ("RIBBON", "TUBE", "CONE", "DROP", "BLADE", "ARC", "ECHO", "HULL")


def _unique_name(base, database):
    if database.get(base) is None:
        return base
    index = 1
    while database.get("%s_%02d" % (base, index)) is not None:
        index += 1
    return "%s_%02d" % (base, index)


def _collection(scene):
    coll = bpy.data.collections.get(COLLECTION)
    if coll is None:
        coll = bpy.data.collections.new(COLLECTION)
        scene.collection.children.link(coll)
    return coll


def clear_exaggeration_generated():
    coll = bpy.data.collections.get(COLLECTION)
    if coll is None:
        return 0
    count = len(coll.objects)
    for obj in list(coll.objects):
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if data and data.users == 0:
            if isinstance(data, bpy.types.Mesh):
                bpy.data.meshes.remove(data)
            elif isinstance(data, bpy.types.Curve):
                bpy.data.curves.remove(data)
    bpy.data.collections.remove(coll)
    return count


def _roles(scene):
    return [value.strip() for value in scene.motion_lens_smear_bones.split(",") if value.strip()]


def _frames(scene, action):
    start, end = action.frame_range
    first = max(math.floor(start), scene.motion_lens_smear_frame_start)
    last = min(math.ceil(end), scene.motion_lens_smear_frame_end)
    if last < first:
        raise RuntimeError("Intervalo de smear fora da Action")
    step = max(1, scene.motion_lens_smear_frame_step)
    frames = list(range(first, last + 1, step))
    if frames[-1] != last:
        frames.append(last)
    if len(frames) < 2:
        raise RuntimeError("Smear precisa de pelo menos dois frames")
    return frames


def _sample(context, arm, action, roles, frames):
    scene = context.scene
    mapping = _parse_mapping(scene.motion_lens_bone_map)
    bones = {role: _resolve_bone(arm, role, mapping) for role in roles}
    missing = [role for role, bone in bones.items() if bone is None]
    bones = {role: bone for role, bone in bones.items() if bone is not None}
    if not bones:
        raise RuntimeError("Nenhum osso de smear foi encontrado")
    original = arm.animation_data.action
    original_slot = arm.animation_data.action_slot
    result = {role: [] for role in bones}
    with _restore_frame(scene):
        try:
            arm.animation_data.action = action
            for frame in frames:
                scene.frame_set(frame)
                context.view_layer.update()
                for role, bone in bones.items():
                    result[role].append(_world_point(arm, bone, scene.motion_lens_smear_use_tail).copy())
        finally:
            arm.animation_data.action = original
            if original_slot is not None:
                arm.animation_data.action_slot = original_slot
    return result, missing


def _guide_points(scene):
    name = scene.motion_lens_smear_guide.strip()
    obj = bpy.data.objects.get(name) if name else None
    if obj is None or obj.type != 'CURVE' or not obj.data.splines:
        return None
    points = []
    for spline in obj.data.splines:
        if spline.type == 'BEZIER':
            points.extend(obj.matrix_world @ point.co for point in spline.bezier_points)
        else:
            points.extend(obj.matrix_world @ point.co.xyz for point in spline.points)
    return points if len(points) >= 2 else None


def _side_vector(points, index):
    direction = points[min(index + 1, len(points) - 1)] - points[max(0, index - 1)]
    if direction.length < 1e-7:
        direction = Vector((0, 1, 0))
    direction.normalize()
    side = direction.cross(Vector((0, 0, 1)))
    if side.length < 1e-7:
        side = direction.cross(Vector((1, 0, 0)))
    return side.normalized()


def _width(preset, t, width):
    if preset == "CONE":
        return width * max(0.04, 1.0 - t)
    if preset == "DROP":
        return width * max(0.08, math.sin(math.pi * t) ** 0.55)
    if preset == "BLADE":
        return width * max(0.03, math.sin(math.pi * t))
    if preset == "ARC":
        return width * (0.45 + 0.55 * math.sin(math.pi * t))
    return width


def _ribbon_geometry(points, preset, width):
    vertices, faces = [], []
    for index, point in enumerate(points):
        t = index / max(1, len(points) - 1)
        side = _side_vector(points, index) * _width(preset, t, width)
        vertices.extend((point - side, point + side))
        if index:
            base = index * 2
            faces.append((base - 2, base - 1, base + 1, base))
    return vertices, faces


def _tube_geometry(points, preset, width, sides=8):
    vertices, faces = [], []
    for index, point in enumerate(points):
        t = index / max(1, len(points) - 1)
        tangent = points[min(index + 1, len(points) - 1)] - points[max(0, index - 1)]
        tangent = tangent.normalized() if tangent.length > 1e-7 else Vector((0, 1, 0))
        axis_a = tangent.cross(Vector((0, 0, 1)))
        if axis_a.length < 1e-7:
            axis_a = tangent.cross(Vector((1, 0, 0)))
        axis_a.normalize()
        axis_b = tangent.cross(axis_a).normalized()
        radius = _width(preset, t, width)
        for side in range(sides):
            angle = math.tau * side / sides
            vertices.append(point + radius * (math.cos(angle) * axis_a + math.sin(angle) * axis_b))
        if index:
            base = index * sides
            prev = base - sides
            for side in range(sides):
                nxt = (side + 1) % sides
                faces.append((prev + side, prev + nxt, base + nxt, base + side))
    faces.append(tuple(range(sides - 1, -1, -1)))
    end = (len(points) - 1) * sides
    faces.append(tuple(end + side for side in range(sides)))
    return vertices, faces


def _echo_geometry(points, width):
    vertices, faces = [], []
    base_shape = (
        Vector((width, 0, 0)), Vector((-width, 0, 0)), Vector((0, width, 0)),
        Vector((0, -width, 0)), Vector((0, 0, width)), Vector((0, 0, -width)),
    )
    oct_faces = ((0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5))
    for point in points:
        base = len(vertices)
        vertices.extend(point + offset for offset in base_shape)
        faces.extend(tuple(base + index for index in face) for face in oct_faces)
    return vertices, faces


def _hull_geometry(points, width):
    mesh = bpy.data.meshes.new("ML_Hull_Temp")
    bm = bmesh.new()
    for point in points:
        for offset in (Vector((width, 0, 0)), Vector((-width, 0, 0)), Vector((0, width, 0)), Vector((0, -width, 0)), Vector((0, 0, width)), Vector((0, 0, -width))):
            bm.verts.new(point + offset)
    bm.verts.ensure_lookup_table()
    bmesh.ops.convex_hull(bm, input=list(bm.verts))
    bm.to_mesh(mesh)
    bm.free()
    vertices = [vertex.co.copy() for vertex in mesh.vertices]
    faces = [tuple(poly.vertices) for poly in mesh.polygons]
    bpy.data.meshes.remove(mesh)
    return vertices, faces


def _material(scene):
    name = "ML_Smear_Material"
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.surface_render_method = 'DITHERED'
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexCoord")
    separate = nodes.new("ShaderNodeSeparateXYZ")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*scene.motion_lens_smear_color[:3], 0.0)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (*scene.motion_lens_smear_color[:3], scene.motion_lens_smear_opacity)
    base = next((socket for socket in principled.inputs if socket.identifier == "Base Color"), principled.inputs[0])
    alpha = next((socket for socket in principled.inputs if socket.identifier == "Alpha"), None)
    emission_color = next((socket for socket in principled.inputs if socket.identifier == "Emission Color"), None)
    emission_strength = next((socket for socket in principled.inputs if socket.identifier == "Emission Strength"), None)
    base.default_value = (*scene.motion_lens_smear_color[:3], 1.0)
    if emission_color:
        emission_color.default_value = (*scene.motion_lens_smear_color[:3], 1.0)
    if emission_strength:
        emission_strength.default_value = scene.motion_lens_smear_emission
    material.node_tree.links.new(tex.outputs["Generated"], separate.inputs[0])
    material.node_tree.links.new(separate.outputs[0], ramp.inputs[0])
    material.node_tree.links.new(ramp.outputs["Color"], base)
    if alpha:
        material.node_tree.links.new(ramp.outputs["Alpha"], alpha)
    material.node_tree.links.new(principled.outputs[0], output.inputs[0])
    return material


def analyze_exaggeration(context=None):
    context = _context(context)
    scene = context.scene
    arm = _armature(context)
    if arm is None or arm.animation_data is None or arm.animation_data.action is None:
        raise RuntimeError("Selecione um armature com Action ativa")
    action = arm.animation_data.action
    frames = _frames(scene, action)
    samples, missing = _sample(context, arm, action, _roles(scene), frames)
    candidates = []
    for role, points in samples.items():
        speeds = [(points[index] - points[index - 1]).length for index in range(1, len(points))]
        peak = max(range(len(speeds)), key=speeds.__getitem__) if speeds else 0
        candidates.append({
            "bone": role,
            "peak_frame": frames[min(peak + 1, len(frames) - 1)],
            "peak_m_per_frame": speeds[peak] if speeds else 0.0,
            "travel_m": sum(speeds),
            "suggestion": "smear" if speeds and speeds[peak] >= scene.motion_lens_smear_min_speed else "exagerar_pose",
        })
    return {"schema": "arenamon.motion-lens-exaggeration/1", "action": action.name, "frames": frames, "candidates": candidates, "missing_bones": missing}


def create_smear_meshes(context=None):
    context = _context(context)
    scene = context.scene
    arm = _armature(context)
    if arm is None or arm.animation_data is None or arm.animation_data.action is None:
        raise RuntimeError("Selecione um armature com Action ativa")
    action = arm.animation_data.action
    frames = _frames(scene, action)
    samples, missing = _sample(context, arm, action, _roles(scene), frames)
    guide = _guide_points(scene)
    preset = scene.motion_lens_smear_shape
    if preset not in PRESETS:
        raise RuntimeError("Forma de smear invalida")
    created = []
    try:
        material = _material(scene)
        routes = {"Guide": guide} if guide else samples
        if preset == "HULL":
            routes = {"Silhouette": [point for points in samples.values() for point in points]}
        for role, points in routes.items():
            if max((points[index] - points[index - 1]).length for index in range(1, len(points))) < scene.motion_lens_smear_min_speed:
                continue
            width = scene.motion_lens_smear_width
            if preset == "ECHO":
                vertices, faces = _echo_geometry(points, width)
            elif preset == "HULL":
                vertices, faces = _hull_geometry(points, width)
            elif preset == "TUBE":
                vertices, faces = _tube_geometry(points, preset, width)
            else:
                vertices, faces = _ribbon_geometry(points, preset, width)
            if not faces:
                continue
            mesh = bpy.data.meshes.new(_unique_name("ML_Smear_%s" % role, bpy.data.meshes))
            mesh.from_pydata(vertices, [], faces)
            mesh.update()
            obj = bpy.data.objects.new(_unique_name("ML_Smear_%s" % role, bpy.data.objects), mesh)
            _collection(scene).objects.link(obj)
            obj.data.materials.append(material)
            obj["motion_lens_generated"] = True
            obj["motion_lens_shape"] = preset
            obj["motion_lens_action"] = action.name
            created.append(obj)
        if not created:
            raise RuntimeError("Nenhuma trajetoria ultrapassou a velocidade minima")
        return {"objects": [obj.name for obj in created], "shape": preset, "frames": frames, "missing_bones": missing}
    except Exception:
        for obj in created:
            data = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if data.users == 0:
                bpy.data.meshes.remove(data)
        raise


def _assign_action(arm, action, preferred_slot=None):
    arm.animation_data.action = action
    slots = list(getattr(action, "slots", ()))
    slot = next((candidate for candidate in slots if preferred_slot and candidate.identifier == preferred_slot.identifier), None)
    if slot is None and slots:
        slot = slots[0]
    if slot is not None:
        arm.animation_data.action_slot = slot


def _exaggerate_pose_bone(pb, factor):
    pb.location *= factor
    pb.scale = Vector((1.0 + (value - 1.0) * factor for value in pb.scale))
    if pb.rotation_mode == 'QUATERNION':
        axis, angle = pb.rotation_quaternion.to_axis_angle()
        pb.rotation_quaternion = Quaternion(axis, angle * factor)
    elif pb.rotation_mode == 'AXIS_ANGLE':
        pb.rotation_axis_angle[0] *= factor
    else:
        pb.rotation_euler = [value * factor for value in pb.rotation_euler]


def create_exaggeration_variants(context=None):
    context = _context(context)
    scene = context.scene
    arm = _armature(context)
    if arm is None or arm.animation_data is None or arm.animation_data.action is None:
        raise RuntimeError("Selecione um armature com Action ativa")
    source = arm.animation_data.action
    source_slot = arm.animation_data.action_slot
    original_frame = scene.frame_current
    roles = _roles(scene)
    mapping = _parse_mapping(scene.motion_lens_bone_map)
    bones = [_resolve_bone(arm, role, mapping) for role in roles]
    bones = [bone for bone in bones if bone is not None]
    if not bones:
        raise RuntimeError("Nenhum osso para exagerar")
    frames = _frames(scene, source)
    strengths = (("Sutil", 0.5), ("Estilizada", 1.0), ("Extrema", 1.5))
    created = []
    try:
        for label, multiplier in strengths:
            action = source.copy()
            action.name = _unique_name("%s_Exagero_%s" % (source.name, label), bpy.data.actions)
            action.use_fake_user = True
            created.append(action)
            _assign_action(arm, action, source_slot)
            factor = 1.0 + scene.motion_lens_exaggeration_strength * multiplier
            for frame in frames:
                scene.frame_set(frame)
                context.view_layer.update()
                weight = math.sin(math.pi * (frame - frames[0]) / max(1, frames[-1] - frames[0]))
                pose_factor = 1.0 + (factor - 1.0) * weight
                for bone in bones:
                    _exaggerate_pose_bone(bone, pose_factor)
                    bone.keyframe_insert("location", frame=frame)
                    bone.keyframe_insert("scale", frame=frame)
                    bone.keyframe_insert("rotation_quaternion" if bone.rotation_mode == 'QUATERNION' else ("rotation_axis_angle" if bone.rotation_mode == 'AXIS_ANGLE' else "rotation_euler"), frame=frame)
        _assign_action(arm, created[1], source_slot)
        return {"source": source.name, "actions": [action.name for action in created], "active": created[1].name, "frames": frames}
    except Exception:
        _assign_action(arm, source, source_slot)
        for action in created:
            bpy.data.actions.remove(action)
        raise
    finally:
        scene.frame_set(original_frame)


def build_agent_exaggeration_report(context=None):
    context = _context(context)
    scene = context.scene
    analysis = analyze_exaggeration(context)
    analysis["controls"] = {
        "shape": scene.motion_lens_smear_shape,
        "bones": _roles(scene),
        "width_m": scene.motion_lens_smear_width,
        "min_speed_m_per_frame": scene.motion_lens_smear_min_speed,
        "exaggeration_strength": scene.motion_lens_exaggeration_strength,
    }
    analysis["limits"] = [
        "candidatos medem trajetoria; nao julgam qualidade artistica",
        "malhas sao auxiliares e nao alteram hitbox",
        "variantes sao Actions derivadas; a fonte permanece intacta",
    ]
    analysis["proposals"] = [
        {"level": "Sutil", "factor": 0.5},
        {"level": "Estilizada", "factor": 1.0},
        {"level": "Extrema", "factor": 1.5},
    ]
    path = os.path.join(_ensure_output_dir(scene), "motion_lens_exaggeration.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(analysis, handle, ensure_ascii=False, indent=2)
    block = bpy.data.texts.get(REPORT_TEXT) or bpy.data.texts.new(REPORT_TEXT)
    block.clear()
    block.write(json.dumps(analysis, ensure_ascii=False, indent=2))
    return path, analysis


def run_agent_animation_pipeline(context=None):
    """Escolhe parâmetros, gera smear/variantes e entrega relatório sem exigir ajuste manual."""
    context = _context(context)
    scene = context.scene
    arm = _armature(context)
    if arm is None or arm.animation_data is None or arm.animation_data.action is None:
        raise RuntimeError("Selecione um armature com Action ativa")
    action = arm.animation_data.action
    mapping = _parse_mapping(scene.motion_lens_bone_map)
    preferred = ("RightHand", "LeftHand", "RightFoot", "LeftFoot", "Head", "Hips")
    available = [role for role in preferred if _resolve_bone(arm, role, mapping) is not None]
    if not available:
        raise RuntimeError("A IA nao encontrou papeis semanticos utilizaveis no rig")
    scene.motion_lens_smear_bones = ",".join(available[:4])
    start, end = action.frame_range
    scene.motion_lens_smear_frame_start = math.floor(start)
    scene.motion_lens_smear_frame_end = math.ceil(end)
    scene.motion_lens_smear_frame_step = max(1, int(round(max(1.0, end - start) / 12.0)))
    rig_size = max((abs(value) for value in arm.dimensions), default=1.0)
    scene.motion_lens_smear_width = min(0.30, max(0.025, rig_size * 0.045))
    scene.motion_lens_smear_min_speed = 0.0
    first_analysis = analyze_exaggeration(context)
    moving = [item for item in first_analysis["candidates"] if item["peak_m_per_frame"] > 1e-5]
    chosen_slot = arm.animation_data.action_slot
    if not moving:
        for slot in getattr(action, "slots", ()):
            arm.animation_data.action_slot = slot
            candidate_analysis = analyze_exaggeration(context)
            candidate_moving = [item for item in candidate_analysis["candidates"] if item["peak_m_per_frame"] > 1e-5]
            if candidate_moving:
                first_analysis = candidate_analysis
                moving = candidate_moving
                chosen_slot = slot
                break
    if not moving:
        raise RuntimeError("A IA nao encontrou movimento suficiente para propor smear")
    peak = max(item["peak_m_per_frame"] for item in moving)
    travel = max(item["travel_m"] for item in moving)
    scene.motion_lens_smear_min_speed = peak * 0.35
    scene.motion_lens_exaggeration_strength = min(0.55, max(0.12, travel / max(rig_size, 1e-5) * 0.35))
    scene.motion_lens_smear_shape = "BLADE" if len(moving) == 1 else ("HULL" if len(moving) >= 4 else "ARC")
    smear = create_smear_meshes(context)
    report_path, report = build_agent_exaggeration_report(context)
    variants = create_exaggeration_variants(context)
    result = {
        "schema": "arenamon.motion-lens-agent-pipeline/1",
        "source": action.name,
        "decision": {
            "bones": available[:4],
            "frames": [scene.motion_lens_smear_frame_start, scene.motion_lens_smear_frame_end],
            "shape": scene.motion_lens_smear_shape,
            "action_slot": chosen_slot.identifier if chosen_slot else None,
            "width_m": scene.motion_lens_smear_width,
            "min_speed_m_per_frame": scene.motion_lens_smear_min_speed,
            "exaggeration_strength": scene.motion_lens_exaggeration_strength,
        },
        "smear": smear,
        "variants": variants,
        "recommended_action": variants["active"],
        "report": report_path,
        "candidate_count": len(report["candidates"]),
    }
    block = bpy.data.texts.get("ML_AI_Animation_Result") or bpy.data.texts.new("ML_AI_Animation_Result")
    block.clear()
    block.write(json.dumps(result, ensure_ascii=False, indent=2))
    return result
