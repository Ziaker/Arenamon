"""Regressões isoladas do Direction Lines em Blender headless.

Executar:
  blender -b --factory-startup --python scripts/blender-vision/tests/test_direction_lines_background.py -- ADDON.py
"""
import importlib.util
import os
import sys
from unittest import mock

import bpy
from mathutils import Vector


args = sys.argv[sys.argv.index("--") + 1:]
ADDON = os.path.abspath(args[0])
spec = importlib.util.spec_from_file_location("direction_lines_test", ADDON)
dl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dl)
dl.register()


def check(name, condition, detail=""):
    print(("PASS" if condition else "FAIL"), name, detail)
    if not condition:
        raise AssertionError(name + (": " + str(detail) if detail else ""))


def invoke(operator):
    try:
        return operator()
    except RuntimeError:
        return {"CANCELLED"}


def make_armature(bones):
    arm_data = bpy.data.armatures.new("TestArmature")
    arm = bpy.data.objects.new("TestRig", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    parent = None
    for index, name in enumerate(bones):
        bone = arm_data.edit_bones.new(name)
        bone.head = Vector((0.0, 0.0, index * 0.2))
        bone.tail = Vector((0.0, 0.0, index * 0.2 + 0.15))
        bone.parent = parent
        parent = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


clear_scene()
result = invoke(bpy.ops.dirlines.new_action)
check("criar linha de acao cancela sem armature", result == {"CANCELLED"}, result)

clear_scene()
make_armature(["Hips"])
result = invoke(bpy.ops.dirlines.new_action)
check("criar linha de acao rejeita coluna com menos de dois pontos", result == {"CANCELLED"}, result)

clear_scene()
arm = make_armature(["Hips", "Spine", "Head", "RightHand"])
bpy.context.scene.dl_bone = "RightHand"
bpy.context.scene.dl_f0 = 10
bpy.context.scene.dl_f1 = 5
result = invoke(bpy.ops.dirlines.new_motion)
check("criar linha de movimento rejeita intervalo invertido", result == {"CANCELLED"}, result)

curve = bpy.data.curves.new("Degenerate", "CURVE")
curve.dimensions = "3D"
spline = curve.splines.new("POLY")
spline.points.add(0)
guide = bpy.data.objects.new("DegenerateGuide", curve)
guide["dl_kind"] = "ACTION"
guide["dl_frame"] = 1
dl._coll(bpy.context.scene).objects.link(guide)
report = dl.compare(bpy.context)
check("comparacao ignora guia com menos de dois pontos", "menos de dois pontos" in report, report)

motion_curve = bpy.data.curves.new("MotionFailure", "CURVE")
motion_curve.dimensions = "3D"
motion_spline = motion_curve.splines.new("POLY")
motion_spline.points.add(1)
motion_spline.points[0].co = (0.0, 0.0, 0.0, 1.0)
motion_spline.points[1].co = (1.0, 0.0, 0.0, 1.0)
motion_guide = bpy.data.objects.new("MotionFailureGuide", motion_curve)
motion_guide["dl_kind"] = "MOTION"
motion_guide["dl_bone"] = "RightHand"
motion_guide["dl_f0"] = 5
motion_guide["dl_f1"] = 8
dl._coll(bpy.context.scene).objects.link(motion_guide)
bpy.context.scene.frame_set(37, subframe=0.25)
with mock.patch.object(dl, "_nearest", side_effect=RuntimeError("falha injetada")):
    try:
        dl.compare(bpy.context)
        raise AssertionError("a falha injetada deveria propagar")
    except RuntimeError as exc:
        check("falha de comparacao preserva frame", "falha injetada" in str(exc))
check("comparacao restaura frame e subframe", bpy.context.scene.frame_current == 37 and abs(bpy.context.scene.frame_subframe - 0.25) < 1e-6)

dl.unregister()
print("PASS: Direction Lines robustez")
