# Motion Lens — parte «sheets» (dividida de motion_lens.py; a API pública continua em motion_lens.py).
import bpy
import os
import shutil
import tempfile
from mathutils import Vector
from .common import _armature, _color, _context, _ensure_output_dir, _meshes_of, _parse_frames, _remove_object_and_data, _restore_frame, _world_point
from .graphs import _draw_line, _draw_text


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
