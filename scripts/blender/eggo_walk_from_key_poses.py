"""Carry the user's edited Eggo poses at frames 1 and 10 through the full walk.

Run in the already-open Eggo_Walk_Forward.blend while the edited action is live.
"""

import math
import re

import bpy
from mathutils import Quaternion


rig = bpy.data.objects["AlienRig"]
scene = bpy.context.scene
edited = rig.animation_data.action
base = bpy.data.actions["Walk Forward 3 Saved Base"]
assert edited.name == "Walk Forward 3 Weighted"
edited.name = "Walk Forward 3 Edited Poses"
edited.use_fake_user = True
base.name = "Walk Forward 3 Weighted"
base.use_fake_user = True

name = "Walk Forward 4 Expressive"
old = bpy.data.actions.get(name)
if old:
    bpy.data.actions.remove(old)
result = base.copy()
result.name = name
result.use_fake_user = True


def curves(action):
    bag = action.layers[0].strips[0].channelbag(action.slots[0])
    return {(fc.data_path, fc.array_index): fc for fc in bag.fcurves}


base_curves = curves(base)
edited_curves = curves(edited)
out_curves = curves(result)


def values(curve_map, path, count, frame):
    return [curve_map[(path, axis)].evaluate(frame) for axis in range(count)]


def key(path, numbers, frame):
    for axis, value in enumerate(numbers):
        fc = out_curves[(path, axis)]
        point = next((p for p in fc.keyframe_points if abs(p.co.x - frame) < 0.01), None)
        if point is None:
            point = fc.keyframe_points.insert(frame, value)
        point.co.y = value
        point.interpolation = "BEZIER"
        point.handle_left_type = "AUTO_CLAMPED"
        point.handle_right_type = "AUTO_CLAMPED"
        fc.update()


changed = []
paths = sorted(set(path for path, _ in base_curves) & set(path for path, _ in edited_curves))
for path in paths:
    if not re.match(r'^pose\.bones\[".+"\]\.(location|rotation_quaternion)$', path):
        continue
    rotation = path.endswith("rotation_quaternion")
    count = 4 if rotation else 3
    if not any(
        abs(x - y) > 1e-5
        for frame in (1, 10)
        for x, y in zip(values(base_curves, path, count, frame), values(edited_curves, path, count, frame))
    ):
        continue
    changed.append(path)
    b1, b10 = (values(base_curves, path, count, f) for f in (1, 10))
    u1, u10 = (values(edited_curves, path, count, f) for f in (1, 10))
    if rotation:
        d1 = Quaternion(u1).normalized() @ Quaternion(b1).normalized().inverted()
        d10 = Quaternion(u10).normalized() @ Quaternion(b10).normalized().inverted()
    else:
        d1 = [u - b for u, b in zip(u1, b1)]
        d10 = [u - b for u, b in zip(u10, b10)]
    for frame in range(1, 20):
        t = (frame - 1) / 18.0
        mix = (1 - math.cos(2 * math.pi * t)) * 0.5
        current = values(base_curves, path, count, frame)
        if rotation:
            correction = d1.slerp(d10, mix)
            new = correction @ Quaternion(current).normalized()
        else:
            new = [c + a * (1 - mix) + b * mix for c, a, b in zip(current, d1, d10)]
        key(path, new, frame)
    # Keep both of the user's anchor poses exactly as keyed, including quaternion
    # component values, rather than relying on numerical round-trip precision.
    key(path, u1, 1)
    key(path, u10, 10)
    key(path, u1, 19)

rig.animation_data.action = result
rig.animation_data.action_slot = result.slots[0]
scene.frame_start = 1
scene.frame_end = 19
scene.frame_set(1)
print("active", result.name, "reference", edited.name)
print("edited_paths", len(changed), *changed, sep="\n")
