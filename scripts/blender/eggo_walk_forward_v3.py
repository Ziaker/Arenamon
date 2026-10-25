"""Build Eggo's broad, weighted forward locomotion in the open Blender file.

Keeps the earlier walks as separate actions. Run inside Blender's Python console.
"""

import math

import bpy
import numpy as np
from mathutils import Euler, Quaternion, Vector


rig = bpy.data.objects["AlienRig"]
scene = bpy.context.scene
original = bpy.data.actions["Walk Forward 2 Fast"]
slot = original.slots[0]
joint_names = (
    "Hips", "Spine", "Chest", "Head",
    "LeftUpLeg", "LeftLeg", "LeftFoot",
    "RightUpLeg", "RightLeg", "RightFoot",
)
sample = {}
foot_orientations = {}
rig.animation_data.action = original
rig.animation_data.action_slot = slot
for frame in range(1, 20):
    scene.frame_set(frame)
    sample[frame] = {
        name: (rig.pose.bones[name].location.copy(), rig.pose.bones[name].rotation_quaternion.copy())
        for name in joint_names
    }
    foot_orientations[frame] = {
        side: (rig.matrix_world @ rig.pose.bones[side + "Foot"].matrix).to_quaternion()
        for side in ("Left", "Right")
    }

name = "Walk Forward 3 Weighted"
old = bpy.data.actions.get(name)
if old:
    bpy.data.actions.remove(old)
action = original.copy()
action.name = name
action.use_fake_user = True
rig.animation_data.action = action
rig.animation_data.action_slot = action.slots[0]
curves = action.layers[0].strips[0].channelbag(action.slots[0]).fcurves
lookup = {(c.data_path, c.array_index): c for c in curves}


def put(name, field, values, frame):
    path = f'pose.bones["{name}"].{field}'
    for i, value in enumerate(values):
        curve = lookup[(path, i)]
        point = next((p for p in curve.keyframe_points if abs(p.co.x - frame) < 0.01), None)
        if point is None:
            point = curve.keyframe_points.insert(frame, float(value))
        point.co.y = float(value)
        point.interpolation = "BEZIER"
        point.handle_left_type = "AUTO_CLAMPED"
        point.handle_right_type = "AUTO_CLAMPED"
        curve.update()


def rotate(name, euler_delta, frame):
    base = sample[frame][name][1]
    local = base.to_euler("XYZ")
    for axis in range(3):
        local[axis] += euler_delta[axis]
    put(name, "rotation_quaternion", Euler(local, "XYZ").to_quaternion(), frame)


def foot_position(name, frame):
    scene.frame_set(frame)
    return (rig.matrix_world @ rig.pose.bones[name].matrix).translation.copy()


def solve_leg(side, target, frame):
    thigh = side + "UpLeg"
    shin = side + "Leg"
    foot = side + "Foot"
    bases = [sample[frame][n][1].to_euler("XYZ") for n in (thigh, shin)]
    values = np.zeros(4)

    def evaluate(v):
        for name, base, pair in ((thigh, bases[0], v[:2]), (shin, bases[1], v[2:])):
            e = base.copy()
            e.x += float(pair[0])
            e.z += float(pair[1])
            put(name, "rotation_quaternion", Euler(e, "XYZ").to_quaternion(), frame)
        return np.array(foot_position(foot, frame), dtype=float)

    for _ in range(11):
        current = evaluate(values)
        error = np.array(target) - current
        if np.linalg.norm(error) < 0.0015:
            break
        jac = np.column_stack([(evaluate(values + np.eye(4)[i] * 0.002) - current) / 0.002 for i in range(4)])
        step = np.linalg.solve(jac.T @ jac + np.eye(4) * 0.00025, jac.T @ error)
        values += np.clip(step, -0.16, 0.16)
    end = evaluate(values)
    return float(np.linalg.norm(end - target))


def orient_foot(side, frame):
    name = side + "Foot"
    bone = rig.pose.bones[name]
    world = rig.matrix_world @ bone.matrix
    goal = foot_orientations[frame][side].to_matrix().to_4x4()
    goal.translation = world.translation
    bone.matrix = rig.matrix_world.inverted() @ goal
    put(name, "rotation_quaternion", bone.rotation_quaternion, frame)
    scene.frame_set(frame)


errors = []
for frame in range(1, 19):
    t = (frame - 1) / 18.0
    w = 2 * math.pi * t
    step = math.sin(w) ** 2
    impact = math.cos(2 * w)

    # Down at each contact, rise through the passing pose. Lateral transfer and
    # counter-rotation make the upper body respond to the planted foot.
    hip = sample[frame]["Hips"][0].copy()
    hip.x = 0.017 * math.cos(w)
    hip.y = -0.057 + 0.041 * step
    hip.z = 0.043 + 0.007 * impact
    put("Hips", "location", hip, frame)
    rotate("Hips", (0.025 * math.sin(w), 0.012 * math.sin(w), 0.042 * math.cos(w)), frame)
    rotate("Spine", (-0.060 * math.sin(w - 0.35), 0.040 * math.sin(w), -0.065 * math.cos(w - 0.20)), frame)
    rotate("Chest", (0.082 * math.sin(w - 0.55), -0.035 * math.sin(w), 0.110 * math.cos(w - 0.50)), frame)
    rotate("Head", (-0.045 * math.sin(w - 0.65), 0.014 * math.sin(w), -0.048 * math.cos(w - 0.35)), frame)

    for side, sign, shift in (("Left", 1, 0), ("Right", -1, math.pi)):
        phase = w + shift
        swing = max(0.0, -math.sin(phase)) ** 2
        # Broad front/back stride, with a little more lateral room. The contact
        # foot stays low while the opposite leg clears the ground.
        target = np.array((
            sign * (0.247 + 0.006 * math.sin(phase)),
            -0.0881 - 0.149 * math.cos(phase),
            0.060 + 0.090 * swing,
        ))
        errors.append((frame, side, solve_leg(side, target, frame)))
        orient_foot(side, frame)

# Exact matching endpoint gives a seamless loop. All curves already have a 19
# key in the copied action, so overwrite it with the first pose for moved bones.
for bone in joint_names:
    for field in ("location", "rotation_quaternion"):
        path = f'pose.bones["{bone}"].{field}'
        count = 3 if field == "location" else 4
        put(bone, field, [lookup[(path, i)].evaluate(1.0) for i in range(count)], 19)

scene.frame_start = 1
scene.frame_end = 19
scene.frame_set(1)
print("created", action.name, "max_ankle_error_m", max(x[2] for x in errors))
print("worst", sorted(errors, key=lambda x: x[2], reverse=True)[:4])
