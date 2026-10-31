# Motion Lens — parte «comparison» (dividida de motion_lens.py; a API pública continua em motion_lens.py).
import bpy
import json
import math
import os
import statistics
from .analysis import analyze_motion
from .common import DEFAULT_ROLES, EXTRA_ROLES, _armature, _context, _ensure_output_dir, _parse_frames, _parse_mapping, _resolve_bone, _restore_frame, _world_point
from .graphs import _draw_line, _draw_text, _set_pixel


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
    original_slot = arm.animation_data.action_slot
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
            if original_slot is not None:
                arm.animation_data.action_slot = original_slot
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
    original_slot = arm.animation_data.action_slot
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
            if original_slot is not None:
                arm.animation_data.action_slot = original_slot
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
    original_slot = arm.animation_data.action_slot
    with _restore_frame(scene):
        try:
            _, current_segments = _sample_action(context, arm, current, sample_count, segments=True)
            _, reference_segments = _sample_action(context, arm, reference, sample_count, segments=True)
        finally:
            arm.animation_data.action = original
            if original_slot is not None:
                arm.animation_data.action_slot = original_slot
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
