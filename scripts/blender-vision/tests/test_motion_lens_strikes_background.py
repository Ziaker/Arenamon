"""Regressões dos operadores de golpe do Motion Lens no Blender 5.2."""
import importlib.util
import os
import sys
from unittest import mock

import bpy
from mathutils import Vector


args = sys.argv[sys.argv.index("--") + 1:]
ADDON = os.path.abspath(args[0])
spec = importlib.util.spec_from_file_location("motion_lens_strikes_test", ADDON)
ml = importlib.util.module_from_spec(spec)
sys.modules["motion_lens_strikes_test"] = ml
spec.loader.exec_module(ml)
ml.register()
from motion_lens_parts import strikes


def make_rig():
    arm_data = bpy.data.armatures.new("StrikeArmature")
    arm = bpy.data.objects.new("StrikeRig", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for index, name in enumerate(("Hips", "Head", "RightHand")):
        bone = arm_data.edit_bones.new(name)
        bone.head = Vector((0.0, 0.0, 0.5 + index * 0.3))
        bone.tail = bone.head + Vector((0.0, 0.0, 0.2))
    bpy.ops.object.mode_set(mode="POSE")
    action = bpy.data.actions.new("StrikeSource")
    arm.animation_data_create()
    arm.animation_data.action = action
    for frame, x in ((10, 0.0), (15, 0.7), (20, 0.72)):
        bpy.context.scene.frame_set(frame)
        for name in ("Hips", "Head"):
            arm.pose.bones[name].keyframe_insert("location", frame=frame)
        hand = arm.pose.bones["RightHand"]
        hand.location.x = x
        hand.keyframe_insert("location", frame=frame)
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm, action


def curves_snapshot(action):
    return [
        (curve.data_path, curve.array_index, [(point.co.x, point.co.y) for point in curve.keyframe_points])
        for curve in strikes._action_fcurves(action)
    ]


scene = bpy.context.scene
arm, source = make_rig()
scene.frame_start, scene.frame_end = 1, 250
assert hasattr(scene, "motion_lens_strike_effectors"), "propriedades de golpe nao foram registradas"
scene.motion_lens_strike_effectors = "RightHand"
scene.motion_lens_strike_frames = 3
scene.motion_lens_hold_frames = 2
scene.motion_lens_hold_speed = 0.01

info = strikes.analyze_strike(bpy.context)
assert info["frames"] == [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], info["frames"]
assert info["contact_status"] == "CANDIDATO", info
assert "CANDIDATO" in info["text"]
assert "m/frame" in info["text"] and "m/s" in info["text"]
assert "s)" in info["text"]

before = curves_snapshot(source)
source_slot = arm.animation_data.action_slot
frame_end = scene.frame_end
with mock.patch.object(strikes, "analyze_strike", return_value={"contact": 15, "windup": 10}):
    result = strikes.apply_impact(bpy.context)
derived = arm.animation_data.action
assert derived is not source
assert result["action"] == derived.name
assert curves_snapshot(source) == before
assert scene.frame_end == frame_end
assert arm.animation_data.action_slot is not None
assert arm.animation_data.action_slot.identifier == source_slot.identifier

arm.animation_data.action = source
arm.animation_data.action_slot = source_slot
actions_before = set(bpy.data.actions)
with mock.patch.object(strikes, "analyze_strike", return_value={"contact": 15, "windup": 10}), \
     mock.patch.object(strikes, "_action_fcurves", side_effect=RuntimeError("falha injetada")):
    try:
        strikes.apply_impact(bpy.context)
        raise AssertionError("a falha injetada deveria propagar")
    except RuntimeError as exc:
        assert "falha injetada" in str(exc)
assert arm.animation_data.action is source
assert arm.animation_data.action_slot == source_slot
assert set(bpy.data.actions) == actions_before
assert scene.frame_end == frame_end
assert curves_snapshot(source) == before

secondary_slot = source.slots.new('OBJECT', "Secondary")
arm.animation_data.action = source
arm.animation_data.action_slot = secondary_slot
comparison = source.copy()
comparison.name = "StrikeComparison"
scene.frame_set(13, subframe=0.25)
frame_before = (scene.frame_current, scene.frame_subframe)
camera_before = scene.camera
render_before = (scene.render.engine, scene.render.filepath, scene.render.resolution_x, scene.render.resolution_y)
selected_before = tuple(obj.name for obj in bpy.context.selected_objects)
ml.compare_actions_data(bpy.context, source, comparison, sample_count=3)
assert arm.animation_data.action is source
assert arm.animation_data.action_slot == secondary_slot
assert (scene.frame_current, scene.frame_subframe) == frame_before
assert scene.camera is camera_before
assert (scene.render.engine, scene.render.filepath, scene.render.resolution_x, scene.render.resolution_y) == render_before
assert tuple(obj.name for obj in bpy.context.selected_objects) == selected_before

ml.unregister()
print("PASS: strike candidato, intervalo real, unidades e derivacao transacional")
