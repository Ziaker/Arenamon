"""Regressões de autoria não destrutiva de exagero e smear do Motion Lens 0.4."""
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
from unittest import mock

import bpy
from mathutils import Vector


args = sys.argv[sys.argv.index("--") + 1:]
ADDON = os.path.abspath(args[0])
spec = importlib.util.spec_from_file_location("motion_lens_exaggeration_test", ADDON)
ml = importlib.util.module_from_spec(spec)
sys.modules["motion_lens_exaggeration_test"] = ml
spec.loader.exec_module(ml)
ml.register()
from motion_lens_parts import exaggeration
from motion_lens_parts.strikes import _action_fcurves


def make_rig():
    arm_data = bpy.data.armatures.new("ExaggerationArmature")
    arm = bpy.data.objects.new("ExaggerationRig", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for index, name in enumerate(("Hips", "Head", "RightHand", "LeftHand")):
        bone = arm_data.edit_bones.new(name)
        bone.head = Vector((0.0, 0.0, 0.4 + index * 0.25))
        bone.tail = bone.head + Vector((0.0, 0.0, 0.18))
    bpy.ops.object.mode_set(mode="POSE")
    action = bpy.data.actions.new("ExaggerationSource")
    arm.animation_data_create()
    arm.animation_data.action = action
    for frame, amount in ((10, 0.0), (15, 0.7), (20, 1.1)):
        bpy.context.scene.frame_set(frame)
        arm.pose.bones["RightHand"].location.x = amount
        arm.pose.bones["LeftHand"].location.x = -amount * 0.75
        for name in ("Hips", "Head", "RightHand", "LeftHand"):
            arm.pose.bones[name].keyframe_insert("location", frame=frame)
            arm.pose.bones[name].keyframe_insert("rotation_quaternion", frame=frame)
            arm.pose.bones[name].keyframe_insert("scale", frame=frame)
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm, action


def curves_snapshot(action):
    return [
        (curve.data_path, curve.array_index, [(point.co.x, point.co.y) for point in curve.keyframe_points])
        for curve in _action_fcurves(action)
    ]


scene = bpy.context.scene
arm, source = make_rig()
source_slot = arm.animation_data.action_slot
secondary_slot = source.slots.new('OBJECT', "Secondary")
arm.animation_data.action_slot = secondary_slot
scene.motion_lens_smear_bones = "RightHand,LeftHand,MissingBone"
scene.motion_lens_smear_frame_start = 10
scene.motion_lens_smear_frame_end = 20
scene.motion_lens_smear_frame_step = 2
scene.motion_lens_smear_width = 0.08
scene.motion_lens_smear_min_speed = 0.0

before = curves_snapshot(source)
analysis = exaggeration.analyze_exaggeration(bpy.context)
assert analysis["action"] == source.name
assert len(analysis["candidates"]) == 2
assert analysis["missing_bones"] == ["MissingBone"]
assert arm.animation_data.action is source
assert arm.animation_data.action_slot == secondary_slot

for preset in exaggeration.PRESETS:
    scene.motion_lens_smear_shape = preset
    result = exaggeration.create_smear_meshes(bpy.context)
    assert result["shape"] == preset
    assert result["objects"], preset
    assert all(bpy.data.objects[name].get("motion_lens_generated") for name in result["objects"])
    assert arm.animation_data.action is source
    assert arm.animation_data.action_slot == secondary_slot
    exaggeration.clear_exaggeration_generated()

actions_before_failure = set(bpy.data.objects)
with mock.patch.object(exaggeration, "_material", side_effect=RuntimeError("falha injetada")):
    try:
        exaggeration.create_smear_meshes(bpy.context)
        raise AssertionError("a falha deveria propagar")
    except RuntimeError as exc:
        assert "falha injetada" in str(exc)
assert set(bpy.data.objects) == actions_before_failure
assert arm.animation_data.action is source
assert arm.animation_data.action_slot == secondary_slot

variants = exaggeration.create_exaggeration_variants(bpy.context)
assert len(variants["actions"]) == 3
assert variants["active"] == variants["actions"][1]
assert curves_snapshot(source) == before
assert arm.animation_data.action.name == variants["active"]
assert arm.animation_data.action_slot.identifier == secondary_slot.identifier

arm.animation_data.action = source
arm.animation_data.action_slot = secondary_slot
with tempfile.TemporaryDirectory(prefix="motion-lens-exaggeration-", dir=Path(__file__).parent) as temp_dir:
    scene.motion_lens_output_dir = temp_dir
    path, report = exaggeration.build_agent_exaggeration_report(bpy.context)
    assert os.path.isfile(path)
    assert report["schema"] == "arenamon.motion-lens-exaggeration/1"
    assert len(report["proposals"]) == 3

assert curves_snapshot(source) == before
ml.unregister()
print("PASS: 8 formas, variantes A/B/C, relatorio e origem preservada")
