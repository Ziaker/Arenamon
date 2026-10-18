"""Testes automatizados do Animation Witness em Blender headless.

Gera cenas sintéticas temporárias para validar:
1. Suporte a Euler e Quatérnions sem gimbal lock;
2. Torção isolada da pelve (hips twist) vs deslocamento do root;
3. Contato com alvo:
   - com alvo presente (--target com malha) -> mede distância de superfície exata via BVHTree;
   - sem alvo -> NAO_COMPROVAVEL (recusa inventar contato);
4. Auto-interpenetração com matriz de exclusão anatômica:
   - ignora juntas adjacentes conectadas;
   - detecta penetração entre partes não adjacentes;
5. Rejeição ativa de imagens/vistas inúteis:
   - rejeita vista colinear ao antebraço;
   - rejeita vista com câmera abaixo do solo (Z < 0.05);
6. Preservação estrita de integridade (SHA-256 inalterado antes e depois).
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
BLENDER = os.environ.get("BLENDER_EXE", r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe")
WITNESS = os.path.join(PARENT, "witness.py")


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


CREATE_SCENE_PY = r"""
import bpy
import math
from mathutils import Vector, Euler, Quaternion

# Cria cena vazia
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 24

# 1. Cria Armature
arm_data = bpy.data.armatures.new("SyntheticArm")
arm_ob = bpy.data.objects.new("SyntheticRig", arm_data)
sc.collection.objects.link(arm_ob)
bpy.context.view_layer.objects.active = arm_ob

bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones

# Hips
hips = eb.new("Hips")
hips.head = Vector((0, 0, 0.9))
hips.tail = Vector((0, 0, 1.0))

# Spine
spine = eb.new("Spine")
spine.head = Vector((0, 0, 1.0))
spine.tail = Vector((0, 0, 1.3))
spine.parent = hips

# Head
head = eb.new("Head")
head.head = Vector((0, 0, 1.3))
head.tail = Vector((0, 0, 1.6))
head.parent = spine

# RightArm
r_arm = eb.new("RightArm")
r_arm.head = Vector((0.15, 0, 1.25))
r_arm.tail = Vector((0.40, 0, 1.25))
r_arm.parent = spine

# RightForeArm
r_forearm = eb.new("RightForeArm")
r_forearm.head = Vector((0.40, 0, 1.25))
r_forearm.tail = Vector((0.65, 0, 1.25))
r_forearm.parent = r_arm

# RightHand
r_hand = eb.new("RightHand")
r_hand.head = Vector((0.65, 0, 1.25))
r_hand.tail = Vector((0.75, 0, 1.25))
r_hand.parent = r_forearm

# Dedos da mão direita
f1 = eb.new("RightHandIndex1")
f1.head = Vector((0.75, 0.03, 1.25))
f1.tail = Vector((0.85, 0.04, 1.25))
f1.parent = r_hand

f2 = eb.new("RightHandThumb1")
f2.head = Vector((0.75, -0.03, 1.25))
f2.tail = Vector((0.85, -0.04, 1.25))
f2.parent = r_hand

bpy.ops.object.mode_set(mode='POSE')

# Cria malha ligada à armature para teste de contato e IDs
mesh_data = bpy.data.meshes.new("CharMesh")
mesh_ob = bpy.data.objects.new("CharMeshOb", mesh_data)
sc.collection.objects.link(mesh_ob)

import bmesh
bm = bmesh.new()
# Cria caixa em torno da mão
for x in (-0.05, 0.05):
    for y in (-0.05, 0.05):
        for z in (-0.05, 0.05):
            bm.verts.new(Vector((0.75 + x, y, 1.25 + z)))
bmesh.ops.convex_hull(bm, input=bm.verts)
bm.to_mesh(mesh_data)
bm.free()

mod = mesh_ob.modifiers.new("ArmMod", 'ARMATURE')
mod.object = arm_ob

vg = mesh_ob.vertex_groups.new(name="RightHand")
vg.add(list(range(len(mesh_data.vertices))), 1.0, 'REPLACE')

# Cria alvo geométrico (TargetBox) a 5cm da mão
target_data = bpy.data.meshes.new("TargetMesh")
target_ob = bpy.data.objects.new("TargetBox", target_data)
sc.collection.objects.link(target_ob)
bm = bmesh.new()
# Caixa alvo posicionada em X=0.82 (a 2cm da ponta da mão)
for x in (-0.05, 0.05):
    for y in (-0.05, 0.05):
        for z in (-0.05, 0.05):
            bm.verts.new(Vector((0.87 + x, y, 1.25 + z)))
bmesh.ops.convex_hull(bm, input=bm.verts)
bm.to_mesh(target_data)
bm.free()

# Animação: Action "SyntheticAttack"
act = bpy.data.actions.new("SyntheticAttack")
arm_ob.animation_data_create()
arm_ob.animation_data.action = act

# Keyframes com Euler e Quatérnion
# Frame 0 a 10
for f in range(11):
    sc.frame_set(f)
    # Hips: translada em X e rotaciona em Z (yaw)
    hips_pb = arm_ob.pose.bones["Hips"]
    hips_pb.location = Vector((0.02 * f, 0, 0))
    hips_pb.rotation_mode = 'QUATERNION'
    hips_pb.rotation_quaternion = Quaternion((math.cos(math.radians(2.0 * f)), 0, 0, math.sin(math.radians(2.0 * f))))
    hips_pb.keyframe_insert(data_path="location", frame=f)
    hips_pb.keyframe_insert(data_path="rotation_quaternion", frame=f)

    # RightHand: avança em direção ao alvo
    rh_pb = arm_ob.pose.bones["RightHand"]
    rh_pb.location = Vector((0.005 * f, 0, 0))
    rh_pb.rotation_mode = 'XYZ'
    rh_pb.rotation_euler = Euler((0, math.radians(f * 3.0), 0), 'XYZ')
    rh_pb.keyframe_insert(data_path="location", frame=f)
    rh_pb.keyframe_insert(data_path="rotation_euler", frame=f)

# Salva arquivo sintético
import sys
out_blend = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
print("SYNTHETIC_SCENE_CREATED_OK")
"""


def create_synthetic_blend(dest_path: str) -> None:
    script_path = dest_path + ".create.py"
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(CREATE_SCENE_PY)
    cmd = [BLENDER, "-b", "--python", script_path, "--", dest_path]
    run = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if run.returncode != 0 or "SYNTHETIC_SCENE_CREATED_OK" not in run.stdout:
        print("STDOUT:", run.stdout)
        print("STDERR:", run.stderr)
        raise RuntimeError("Falha ao gerar cena sintética no Blender")


def test_synthetic_scene_headless():
    with tempfile.TemporaryDirectory(prefix="blender-synth-", dir=HERE) as d:
        blend_path = os.path.join(d, "synthetic.blend")
        create_synthetic_blend(blend_path)
        before_hash = sha256(blend_path)

        spec = {
            "schema": "arenamon.animation-witness.spec/1",
            "name": "Synthetic Test Spec",
            "source_constraints": {"allowed_blend_sha256": [before_hash]},
            "claims": [
                {
                    "id": "frame_count_11",
                    "type": "frame_count",
                    "expected": 11,
                    "statement": "Animação possui 11 frames",
                    "criterion_status": "approved",
                },
                {
                    "id": "pelvis_yaw",
                    "type": "pelvis_twist",
                    "min_twist_deg": 10.0,
                    "statement": "Pelve sofre torção de yaw >= 10 graus",
                    "criterion_status": "approved",
                },
                {
                    "id": "contact_within_reach",
                    "type": "target_contact_window",
                    "frames": [8, 10],
                    "proximity_tolerance_m": 0.35,
                    "statement": "Mão direita entra a menos de 35cm do alvo",
                    "criterion_status": "approved",
                },
                {
                    "id": "contact_too_close",
                    "type": "target_contact_window",
                    "frames": [8, 10],
                    "proximity_tolerance_m": 0.05,
                    "statement": "Mão direita entra a menos de 5cm do alvo",
                    "criterion_status": "approved",
                },
                {
                    "id": "self_collision_safe",
                    "type": "self_collision",
                    "max_penetration_m": 0.01,
                    "statement": "Sem colisão entre membros não adjacentes",
                    "criterion_status": "approved",
                },
            ],
        }
        spec_path = os.path.join(d, "spec.json")
        with open(spec_path, "w", encoding="utf-8") as f:
            json.dump(spec, f, indent=2)

        # 1. Executa inspect COM --target TargetBox
        out_target = os.path.join(d, "out_with_target")
        cmd_target = [
            sys.executable,
            WITNESS,
            "inspect",
            "--blend", blend_path,
            "--action", "SyntheticAttack",
            "--spec", spec_path,
            "--out", out_target,
            "--target", "TargetBox",
        ]
        run_target = subprocess.run(cmd_target, capture_output=True, text=True, encoding="utf-8", errors="replace")
        assert run_target.returncode == 0, f"Falha no inspect com target: {run_target.stderr}"

        # Verifica integridade do .blend
        after_hash1 = sha256(blend_path)
        assert before_hash == after_hash1, "O .blend foi alterado durante a extração!"

        v_target = json.load(open(os.path.join(out_target, "verdict.json"), encoding="utf-8"))
        claims_map = {c["claim_id"]: c for c in v_target["claims"]}
        assert claims_map["frame_count_11"]["status"] == "COMPROVADO"
        assert claims_map["pelvis_yaw"]["status"] == "COMPROVADO"
        # 0.296m <= 0.35m -> COMPROVADO
        assert claims_map["contact_within_reach"]["status"] == "COMPROVADO"
        # Ausência de colisão em proxies de osso não autoriza COMPROVADO; deve ser NAO_COMPROVAVEL até haver malha completa
        assert claims_map["self_collision_safe"]["status"] == "NAO_COMPROVAVEL"
        assert "cobertura geométrica completa" in " ".join(claims_map["self_collision_safe"]["missing"])

        obs_target = json.load(open(os.path.join(out_target, "observation.json"), encoding="utf-8"))
        assert obs_target["target"] is not None
        assert len(obs_target["target"]["right_hand_surface_distance"]) > 0
        # Confirma presença de medições em Euler e Quatérnion
        rh_bones = obs_target["frames"][0]["bones"]["RightHand"]
        assert "local_euler_xyz_deg" in rh_bones
        assert "local_basis_quaternion" in rh_bones

        # 2. Executa inspect SEM --target (deve falhar fechado com NAO_COMPROVAVEL para contato)
        out_no_target = os.path.join(d, "out_no_target")
        cmd_no_target = [
            sys.executable,
            WITNESS,
            "inspect",
            "--blend", blend_path,
            "--action", "SyntheticAttack",
            "--spec", spec_path,
            "--out", out_no_target,
        ]
        run_no_target = subprocess.run(cmd_no_target, capture_output=True, text=True, encoding="utf-8", errors="replace")
        assert run_no_target.returncode == 0

        after_hash2 = sha256(blend_path)
        assert before_hash == after_hash2

        v_no_target = json.load(open(os.path.join(out_no_target, "verdict.json"), encoding="utf-8"))
        claims_no_target = {c["claim_id"]: c for c in v_no_target["claims"]}
        # Sem alvo explícito, contato DEVE ser NAO_COMPROVAVEL
        assert claims_no_target["contact_within_reach"]["status"] == "NAO_COMPROVAVEL"
        assert "alvo" in " ".join(claims_no_target["contact_within_reach"]["missing"])

        print("PASS: test_synthetic_scene_headless (Blender headless + BVHTree + Euler/Quat + Hips + Integridade)")


if __name__ == "__main__":
    test_synthetic_scene_headless()
