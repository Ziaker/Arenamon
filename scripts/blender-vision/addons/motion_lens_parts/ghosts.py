# Motion Lens — parte «ghosts» (dividida de motion_lens.py; a API pública continua em motion_lens.py).
import bpy
from .analysis import build_report
from .common import GHOST_COLL, REPORT_TEXT, TRAIL_COLL, _armature, _clear_collection, _collection, _color, _context, _material, _meshes_of, _parse_frames, _parse_mapping, _resolve_bone, _restore_frame, _world_point


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
