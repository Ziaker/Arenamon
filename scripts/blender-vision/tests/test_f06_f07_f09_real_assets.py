"""Homologação de F06, F07 e F09 com assets reais (Golisopod pm0867_00_00.blend).

Conformidade e rigor epistêmico estrito:
1. F06: Extração real de trajetória do efetor de ataque ('right_hand_a') em '00400_attack01'.
   - Mede velocidades reais via Blender headless e detecta o marco de impacto.
   - Distingue contato candidato de confirmação por alvo geométrico.
2. F07: Extração real da trajetória de pelve ('waist') para medir recuo, impulso e deslocamentos.
3. F09: Extração de silhueta e vinculação com evidência visual real do disco (SHA-256).
4. Diferenciação formal entre dados extraídos do Blender e parâmetros manuais.
"""
import json
import os
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agent_report import compute_file_sha256, validate_agent_report
from pose_silhouette import (
    KEYFRAME_ROLE_ANTICIPATION,
    KEYFRAME_ROLE_RECOVERY,
    KEYFRAME_ROLE_START,
    KEYFRAME_ROLE_STRIKE,
    build_pose_silhouette_analysis,
    export_pose_silhouette_to_agent_report,
    validate_pose_silhouette,
)
from rig_map import build_rig_map
from strike_analysis import (
    CONTACT_STATUS_CANDIDATE,
    CONTACT_STATUS_CONFIRMED_TARGET,
    build_strike_analysis,
    export_strike_to_agent_report,
    validate_strike_analysis,
)
from weight_momentum import (
    build_weight_momentum_analysis,
    export_weight_momentum_to_agent_report,
    validate_weight_momentum,
)

BLENDER_BIN = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

# ---------------------------------------------------------------------------
# PARÂMETROS FORNECIDOS MANUALMENTE / METADADOS EXTERNOS DE REFERÊNCIA
# ---------------------------------------------------------------------------
PARAMETRO_MANUAL_ALTURA_GOLISOPOD_M = 1.442
PARAMETRO_MANUAL_META_STRIKE_FRAMES = 15
PARAMETRO_MANUAL_META_HOLD_FRAMES = 5
PARAMETRO_MANUAL_ROLES_AUSENTES = ["left_wing", "right_wing"]


class TestF06F07F09RealAssets(unittest.TestCase):

    def setUp(self):
        self.has_blender = os.path.isfile(BLENDER_BIN)
        self.za_blend = os.path.join(REPO_ROOT, "dumper test", "blender", "pm0867_00_00.blend")
        self.za_folha = os.path.join(
            REPO_ROOT, "dumper test", "za-referencias", "folhas",
            "folha_pm0867_00_00_00400_attack01_q3_frente_D_e12.png"
        )

    def test_real_f06_golisopod_strike_kinematics(self):
        """F06 Real: Análise de golpe em 00400_attack01 de Golisopod extraída via Blender headless."""
        if not self.has_blender or not os.path.isfile(self.za_blend):
            self.skipTest("Blender ou pm0867_00_00.blend indisponível.")

        # Extrai trajetórias de efetor de ataque (right_hand_a) e tronco a cada 2 frames
        py_extract = (
            "import bpy, json\n"
            "arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]\n"
            "act = bpy.data.actions['00400_attack01']\n"
            "arm.animation_data.action = act\n"
            "fps = float(bpy.context.scene.render.fps)\n"
            "all_bones = [b.name for b in arm.data.bones]\n"
            "f_start, f_end = int(act.frame_range[0]), int(act.frame_range[1])\n"
            "step = 2\n"
            "frames = list(range(f_start, f_end + 1, step))\n"
            "hand_samples = {}\n"
            "waist_samples = {}\n"
            "for f in frames:\n"
            "    bpy.context.scene.frame_set(f)\n"
            "    bpy.context.view_layer.update()\n"
            "    pb_hand = arm.pose.bones.get('right_hand_a')\n"
            "    pb_waist = arm.pose.bones.get('waist')\n"
            "    if pb_hand:\n"
            "        hand_samples[f] = [round(c, 4) for c in pb_hand.matrix.translation]\n"
            "    if pb_waist:\n"
            "        waist_samples[f] = [round(c, 4) for c in pb_waist.matrix.translation]\n"
            "res = {\n"
            "    'armature': arm.name,\n"
            "    'bones': all_bones,\n"
            "    'fps': fps,\n"
            "    'frame_range': [f_start, f_end],\n"
            "    'hand_samples': hand_samples,\n"
            "    'waist_samples': waist_samples,\n"
            "}\n"
            "print('__EXTRACTION_JSON__' + json.dumps(res))\n"
        )

        cmd = [BLENDER_BIN, "-b", self.za_blend, "--python-expr", py_extract]
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)

        token = "__EXTRACTION_JSON__"
        self.assertIn(token, proc.stdout)
        json_line = [l for l in proc.stdout.splitlines() if token in l][0].replace(token, "")
        data = json.loads(json_line)

        # Conversão de chaves para int
        hand_traj = {int(k): v for k, v in data["hand_samples"].items()}
        waist_traj = {int(k): v for k, v in data["waist_samples"].items()}

        # 1. Análise F06 — modo candidato cinemático
        analysis = build_strike_analysis(
            action_name="00400_attack01",
            armature_name=data["armature"],
            frame_range=tuple(data["frame_range"]),
            fps=data["fps"],
            strike_effector_role="right_hand",
            effector_positions=hand_traj,
            pelvis_positions=waist_traj,
            target_strike_frames=PARAMETRO_MANUAL_META_STRIKE_FRAMES,
            target_hold_frames=PARAMETRO_MANUAL_META_HOLD_FRAMES,
        )

        is_valid, errs = validate_strike_analysis(analysis)
        self.assertTrue(is_valid, f"Erros F06: {errs}")

        metrics = analysis["metrics"]
        self.assertEqual(metrics["contact_status"], CONTACT_STATUS_CANDIDATE)
        self.assertGreater(metrics["peak_speed_mps"], 0.2)
        self.assertGreater(metrics["strike_duration_frames"], 0)

        # 2. Verificação de evidência visual real do repositório
        self.assertTrue(os.path.isfile(self.za_folha))
        real_sha256 = compute_file_sha256(self.za_folha)

        # 3. Exportação para F15
        rig_map = build_rig_map(
            bone_names=data["bones"],
            rig_id="golisopod_real",
            armature_name=data["armature"],
            absent_roles=PARAMETRO_MANUAL_ROLES_AUSENTES,
        )
        report = export_strike_to_agent_report(
            analysis=analysis,
            source_file=self.za_blend,
            rig_mapping=rig_map,
            visual_evidence=[
                {
                    "evidence_id": "ZA-GOLISOPOD-ATTACK01-FOLHA",
                    "file_path": self.za_folha,
                    "sha256": real_sha256,
                    "view_type": "FRONT",
                    "frames_shown": [0, 20, 40],
                    "reading_token": "ZA_GOLI",
                    "verified_exists": True,
                }
            ],
        )

        rep_valid, rep_errs = validate_agent_report(report, verify_files=True)
        self.assertTrue(rep_valid, f"Erros F15: {rep_errs}")

    def test_real_f07_golisopod_weight_momentum(self):
        """F07 Real: Transferência de peso e impulso de Golisopod em 00400_attack01."""
        if not self.has_blender or not os.path.isfile(self.za_blend):
            self.skipTest("Blender ou pm0867_00_00.blend indisponível.")

        py_extract = (
            "import bpy, json\n"
            "arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]\n"
            "act = bpy.data.actions['00400_attack01']\n"
            "arm.animation_data.action = act\n"
            "fps = float(bpy.context.scene.render.fps)\n"
            "f_start, f_end = int(act.frame_range[0]), int(act.frame_range[1])\n"
            "all_bones = [b.name for b in arm.data.bones]\n"
            "waist_samples = {}\n"
            "for f in range(f_start, f_end + 1, 3):\n"
            "    bpy.context.scene.frame_set(f)\n"
            "    bpy.context.view_layer.update()\n"
            "    pb = arm.pose.bones.get('waist')\n"
            "    if pb:\n"
            "        waist_samples[f] = [round(c, 4) for c in pb.matrix.translation]\n"
            "res = {'armature': arm.name, 'bones': all_bones, 'fps': fps, 'range': [f_start, f_end], 'waist': waist_samples}\n"
            "print('__EXTRACTION_JSON__' + json.dumps(res))\n"
        )

        proc = subprocess.run([BLENDER_BIN, "-b", self.za_blend, "--python-expr", py_extract],
                              capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
        token = "__EXTRACTION_JSON__"
        self.assertIn(token, proc.stdout)
        json_line = [l for l in proc.stdout.splitlines() if token in l][0].replace(token, "")
        data = json.loads(json_line)
        waist_traj = {int(k): v for k, v in data["waist"].items()}

        analysis = build_weight_momentum_analysis(
            action_name="00400_attack01",
            armature_name=data["armature"],
            frame_range=tuple(data["range"]),
            fps=data["fps"],
            pelvis_positions=waist_traj,
        )

        is_valid, errs = validate_weight_momentum(analysis)
        self.assertTrue(is_valid, f"Erros F07: {errs}")

        metrics = analysis["metrics"]
        self.assertGreater(metrics["total_travel_distance_m"], 0.05)
        self.assertGreater(metrics["peak_pelvis_velocity_mps"], 0.1)

        rig_map = build_rig_map(
            bone_names=data["bones"],
            rig_id="golisopod_real",
            armature_name=data["armature"],
            absent_roles=PARAMETRO_MANUAL_ROLES_AUSENTES,
        )
        report = export_weight_momentum_to_agent_report(
            analysis=analysis,
            source_file=self.za_blend,
            rig_mapping=rig_map,
        )
        rep_valid, rep_errs = validate_agent_report(report, verify_files=False)
        self.assertTrue(rep_valid, f"Erros F15: {rep_errs}")

    def test_real_f09_golisopod_pose_silhouette_orchestration(self):
        """F09 Real: Silhuetas de marcos fundamentais de Golisopod amarradas à folha visual com SHA-256."""
        if not self.has_blender or not os.path.isfile(self.za_blend) or not os.path.isfile(self.za_folha):
            self.skipTest("Blender, blend ou folha visual indisponível.")

        py_extract = (
            "import bpy, json\n"
            "arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]\n"
            "act = bpy.data.actions['00400_attack01']\n"
            "arm.animation_data.action = act\n"
            "fps = float(bpy.context.scene.render.fps)\n"
            "all_bones = [b.name for b in arm.data.bones]\n"
            "key_frames = [0, 20, 40, 80]\n"
            "poses = {}\n"
            "for f in key_frames:\n"
            "    bpy.context.scene.frame_set(f)\n"
            "    bpy.context.view_layer.update()\n"
            "    poses[f] = {b.name: [round(c, 4) for c in b.matrix.translation] for b in arm.pose.bones}\n"
            "res = {'armature': arm.name, 'bones': all_bones, 'fps': fps, 'poses': poses}\n"
            "print('__EXTRACTION_JSON__' + json.dumps(res))\n"
        )

        proc = subprocess.run([BLENDER_BIN, "-b", self.za_blend, "--python-expr", py_extract],
                              capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
        token = "__EXTRACTION_JSON__"
        self.assertIn(token, proc.stdout)
        json_line = [l for l in proc.stdout.splitlines() if token in l][0].replace(token, "")
        data = json.loads(json_line)
        poses = {int(k): v for k, v in data["poses"].items()}

        real_sha256 = compute_file_sha256(self.za_folha)
        evidences = [
            {
                "evidence_id": "ZA-FOLHA-GOLISOPOD-ATTACK01",
                "file_path": self.za_folha,
                "sha256": real_sha256,
                "view_type": "FRONT",
                "frames_shown": [0, 20, 40, 80],
                "verified_exists": True,
            }
        ]

        roles = {
            0: KEYFRAME_ROLE_START,
            20: KEYFRAME_ROLE_ANTICIPATION,
            40: KEYFRAME_ROLE_STRIKE,
            80: KEYFRAME_ROLE_RECOVERY,
        }

        analysis = build_pose_silhouette_analysis(
            action_name="00400_attack01",
            armature_name=data["armature"],
            frame_range=(0, 135),
            fps=data["fps"],
            keyframe_bone_poses=poses,
            keyframe_roles=roles,
            visual_evidences=evidences,
        )

        is_valid, errs = validate_pose_silhouette(analysis)
        self.assertTrue(is_valid, f"Erros F09: {errs}")

        self.assertEqual(len(analysis["keyframes"]), 4)
        for k in analysis["keyframes"]:
            self.assertGreater(k["frontal_bbox"]["width_m"], 0.2)
            self.assertGreater(k["frontal_bbox"]["height_m"], 0.2)
            self.assertIsNotNone(k["evidence_ref"])

        rig_map = build_rig_map(
            bone_names=data["bones"],
            rig_id="golisopod_real",
            armature_name=data["armature"],
            absent_roles=PARAMETRO_MANUAL_ROLES_AUSENTES,
        )
        report = export_pose_silhouette_to_agent_report(
            analysis=analysis,
            source_file=self.za_blend,
            rig_mapping=rig_map,
            visual_evidence=evidences,
        )
        rep_valid, rep_errs = validate_agent_report(report, verify_files=True)
        self.assertTrue(rep_valid, f"Erros F15: {rep_errs}")


if __name__ == "__main__":
    unittest.main()
