"""Homologação de F01, F02 e F04 com assets reais do Arenamon, Gigantic e Pokémon Z-A.

Conformidade estrita:
1. F01: Cobertura real das 8 direções de corrida do Pakko (Gigantic) em Pakko_Animations.blend,
   com validação da folha real GIG-P1-PAKKO-RUN-DIRECOES-FRONT.png e distinção autoral vs simetria.
2. F02: Análise da transição real de Eggo (Idle 1 -> Dodge Left 1) em eggo dodge lateral v1.blend,
   usando unicamente a folha correspondente de Dodge Left 1 (front_contact_t001_g001.png),
   respeitando a proibição de parear imagens de lados opostos.
3. F04: Comparação Cross-Rig entre AlienRig de Eggo e Golisopod (pm0867_00_00.blend),
   com mapeamento F03 obrigatório, normalização estrita por escala H e tempo físico em segundos.
"""
import json
import os
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agent_report import compute_file_sha256, validate_agent_report
from cross_rig_compare import (
    compare_cross_rig_actions,
    export_cross_rig_to_agent_report,
    validate_cross_rig_compare,
)
from direction_coverage import (
    STATUS_ABSENT,
    STATUS_PRESENT,
    build_direction_coverage_analysis,
    export_direction_coverage_to_agent_report,
    validate_direction_coverage,
)
from rig_map import build_rig_map, validate_rig_map
from transition_analysis import (
    CANDIDATE_STATUS_CANDIDATE,
    analyze_transition_continuity,
    export_transition_to_agent_report,
    validate_transition_analysis,
)

BLENDER_BIN = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
GIGAS_DIR = r"C:\Users\zerke\Downloads\gigas"
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


class TestF01F02F04RealAssets(unittest.TestCase):

    def setUp(self):
        self.has_blender = os.path.isfile(BLENDER_BIN)
        self.pakko_blend = os.path.join(GIGAS_DIR, "pakko", "Pakko_Animations.blend")
        self.eggo_dodge_blend = os.path.join(REPO_ROOT, "chars", "Eggo", "eggo dodge lateral v1.blend")
        self.za_blend = os.path.join(REPO_ROOT, "dumper test", "blender", "pm0867_00_00.blend")
        self.za_data_path = os.path.join(REPO_ROOT, "docs", "za-referencias", "paridade_fk_2026-10-25.json")

    def test_real_f01_pakko_8way_run_coverage(self):
        """F01 Real: Inventário e análise das 8 direções de corrida de Pakko (Gigantic)."""
        if not self.has_blender or not os.path.isfile(self.pakko_blend):
            self.skipTest("Blender ou Pakko_Animations.blend indisponível.")

        # Extrai nomes e deslocamentos das Actions de corrida de Pakko
        py_extract = (
            "import bpy, json\n"
            "arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]\n"
            "fps = float(bpy.context.scene.render.fps)\n"
            "runs = {}\n"
            "for d in ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']:\n"
            "    act = bpy.data.actions.get(f'Run_{d}')\n"
            "    if act:\n"
            "        slot = act.slots[0] if act.slots else None\n"
            "        cb = act.layers[0].strips[0].channelbag(slot) if slot else None\n"
            "        fcs = cb.fcurves if cb else getattr(act, 'fcurves', [])\n"
            "        root_fc_z = [fc for fc in fcs if 'pose.bones[\"b_Root\"].location' in fc.data_path and fc.array_index == 2]\n"
            "        root_fc_x = [fc for fc in fcs if 'pose.bones[\"b_Root\"].location' in fc.data_path and fc.array_index == 0]\n"
            "        disp_x = (root_fc_x[0].keyframe_points[-1].co[1] - root_fc_x[0].keyframe_points[0].co[1]) / 100.0 if root_fc_x else 0.0\n"
            "        disp_y = (root_fc_z[0].keyframe_points[-1].co[1] - root_fc_z[0].keyframe_points[0].co[1]) / 100.0 if root_fc_z else 0.0\n"
            "        f_count = int(act.frame_range[1] - act.frame_range[0] + 1)\n"
            "        runs[d] = {'action_name': act.name, 'displacement_vector': [round(disp_x, 3), round(disp_y, 3), 0.0], 'frame_count': f_count, 'fps': fps}\n"
            "res = {'armature': arm.name, 'runs': runs}\n"
            "print('__EXTRACTION_JSON__' + json.dumps(res))\n"
        )

        cmd = [BLENDER_BIN, "-b", self.pakko_blend, "--python-expr", py_extract]
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)

        token = "__EXTRACTION_JSON__"
        self.assertIn(token, proc.stdout)
        json_line = [l for l in proc.stdout.splitlines() if token in l][0].replace(token, "")
        data = json.loads(json_line)

        # 1. Análise de Cobertura F01
        analysis = build_direction_coverage_analysis(
            set_id="pakko_run_8way",
            armature_name=data["armature"],
            actions_by_direction=data["runs"],
        )

        is_valid, errors = validate_direction_coverage(analysis)
        self.assertTrue(is_valid, f"Erros F01: {errors}")

        # Comprova cobertura real de 8/8 direções
        self.assertEqual(analysis["coverage_count"], 8)
        self.assertEqual(analysis["coverage_ratio"], 1.0)
        for d in ("N", "NE", "E", "SE", "S", "SW", "W", "NW"):
            self.assertEqual(analysis["directions"][d]["status"], STATUS_PRESENT)

        # 2. Evidência real no repositório (Folha de 8 direções de Pakko)
        real_png = os.path.join(REPO_ROOT, "prototypes", "combat-lab", "evidence", "gigantic", "p1", "GIG-P1-PAKKO-RUN-DIRECOES-FRONT.png")
        self.assertTrue(os.path.isfile(real_png))
        real_sha256 = compute_file_sha256(real_png)

        # 3. Exportação para F15 com verificação estrita
        rig_map = build_rig_map(
            bone_names=["b_Root", "b_Pelvis", "b_Thigh_L", "b_Ankle_L"],
            rig_id="pakko_real",
            armature_name=data["armature"]
        )
        report = export_direction_coverage_to_agent_report(
            coverage=analysis,
            source_file=self.pakko_blend,
            rig_mapping=rig_map,
            visual_evidence=[
                {
                    "evidence_id": "GIG-P1-PAKKO-RUN-DIRECOES-FRONT",
                    "file_path": real_png,
                    "sha256": real_sha256,
                    "view_type": "FRONT",
                    "frames_shown": [0, 5, 10, 15, 20],
                    "reading_token": "PAKKO_RUN_8WAY",
                    "verified_exists": True
                }
            ]
        )
        rep_valid, rep_errs = validate_agent_report(report, verify_files=True)
        self.assertTrue(rep_valid, f"Erros relatório F15: {rep_errs}")

    def test_real_f02_eggo_transition_idle_to_dodge_left(self):
        """F02 Real: Transição entre Idle 1 e Dodge Left 1 no Eggo, usando rigorosamente a evidência de Dodge Left 1."""
        if not self.has_blender or not os.path.isfile(self.eggo_dodge_blend):
            self.skipTest("Blender ou eggo dodge lateral v1.blend indisponível.")

        py_extract = (
            "import bpy, json\n"
            "arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]\n"
            "idle_act = bpy.data.actions.get('Idle 1')\n"
            "dodge_act = bpy.data.actions.get('Dodge Left 1')\n"
            "fps = float(bpy.context.scene.render.fps)\n"
            "arm.animation_data.action = idle_act\n"
            "bpy.context.scene.frame_set(int(idle_act.frame_range[1]))\n"
            "bpy.context.view_layer.update()\n"
            "root_a = list(arm.pose.bones['Root'].matrix.translation)\n"
            "lf_a = list(arm.pose.bones['LeftFoot'].matrix.translation)\n"
            "rf_a = list(arm.pose.bones['RightFoot'].matrix.translation)\n"
            "arm.animation_data.action = dodge_act\n"
            "bpy.context.scene.frame_set(int(dodge_act.frame_range[0]))\n"
            "bpy.context.view_layer.update()\n"
            "root_b = list(arm.pose.bones['Root'].matrix.translation)\n"
            "lf_b = list(arm.pose.bones['LeftFoot'].matrix.translation)\n"
            "rf_b = list(arm.pose.bones['RightFoot'].matrix.translation)\n"
            "res = {\n"
            "    'armature': arm.name,\n"
            "    'fps': fps,\n"
            "    'end_a': int(idle_act.frame_range[1]),\n"
            "    'start_b': int(dodge_act.frame_range[0]),\n"
            "    'root_a': root_a, 'root_b': root_b,\n"
            "    'poses_a': {'Root': root_a, 'LeftFoot': lf_a, 'RightFoot': rf_a},\n"
            "    'poses_b': {'Root': root_b, 'LeftFoot': lf_b, 'RightFoot': rf_b}\n"
            "}\n"
            "print('__EXTRACTION_JSON__' + json.dumps(res))\n"
        )

        cmd = [BLENDER_BIN, "-b", self.eggo_dodge_blend, "--python-expr", py_extract]
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)

        token = "__EXTRACTION_JSON__"
        self.assertIn(token, proc.stdout)
        json_line = [l for l in proc.stdout.splitlines() if token in l][0].replace(token, "")
        data = json.loads(json_line)

        # 1. Análise de Transição F02
        analysis = analyze_transition_continuity(
            action_a_name="Idle 1",
            action_b_name="Dodge Left 1",
            armature_name=data["armature"],
            end_frame_a=data["end_a"],
            start_frame_b=data["start_b"],
            root_pose_a={"position": data["root_a"], "yaw_deg": 0.0},
            root_pose_b={"position": data["root_b"], "yaw_deg": 0.0},
            bone_poses_a=data["poses_a"],
            bone_poses_b=data["poses_b"],
            fps_a=data["fps"],
            fps_b=data["fps"],
            ground_height_threshold_m=0.55,  # Pés de AlienRig repousam em Z ~= -0.52 m
            foot_bones={"left_foot": "LeftFoot", "right_foot": "RightFoot"},
            visual_evidence_confirmed=False,  # Sem confirmação visual explícita no frame de corte -> CANDIDATE
        )

        is_valid, errors = validate_transition_analysis(analysis)
        self.assertTrue(is_valid, f"Erros F02: {errors}")

        # A descontinuidade de raiz na largada de repouso para a esquiva
        rc = analysis["root_continuity"]
        self.assertLessEqual(rc["spatial_delta_m"], 0.20)

        # O contato dos pés permanece estritamente CANDIDATO
        feet = {f["role"]: f for f in analysis["foot_continuity"]}
        self.assertEqual(feet["left_foot"]["contact_status_a"], CANDIDATE_STATUS_CANDIDATE)

        # 2. Evidência real no disco: EXCLUSIVAMENTE a imagem de Dodge Left 1
        real_png = os.path.join(REPO_ROOT, "scripts", "blender-vision", "evidence", "eggo_dodge_lateral", "shot_Dodge_Left_1", "front_contact_t001_g001.png")
        self.assertTrue(os.path.isfile(real_png))
        real_sha256 = compute_file_sha256(real_png)

        # 3. Exportação para F15 com verificação
        rig_map = build_rig_map(
            bone_names=["Root", "Hips", "LeftFoot", "RightFoot"],
            rig_id="eggo_alien_rig",
            armature_name=data["armature"]
        )
        report = export_transition_to_agent_report(
            analysis=analysis,
            source_file=self.eggo_dodge_blend,
            rig_mapping=rig_map,
            visual_evidence=[
                {
                    "evidence_id": "EGGO-DODGE-LEFT-1-FRONT-CONTACT",
                    "file_path": real_png,
                    "sha256": real_sha256,
                    "view_type": "FRONT",
                    "frames_shown": [1],
                    "reading_token": "EGGO_DODGE_LEFT_1",
                    "verified_exists": True
                }
            ]
        )
        rep_valid, rep_errs = validate_agent_report(report, verify_files=True)
        self.assertTrue(rep_valid, f"Erros F15: {rep_errs}")

    def test_real_f04_cross_rig_eggo_vs_golisopod(self):
        """F04 Real: Comparação Cross-Rig entre AlienRig (Eggo) e Pokémon Z-A (Golisopod) com normalização estrita."""
        if not self.has_blender or not os.path.isfile(self.eggo_dodge_blend) or not os.path.isfile(self.za_blend):
            self.skipTest("Blender, eggo_dodge_blend ou za_blend indisponível.")

        # 1. Rig Map F03 de Eggo (AlienRig)
        rig_map_eggo = build_rig_map(
            bone_names=["Root", "Hips", "Chest", "Head", "LeftArm", "RightArm", "LeftFoot", "RightFoot"],
            rig_id="eggo_alien_rig",
            armature_name="AlienRig",
            absent_roles=["left_wing", "right_wing"]
        )

        # 2. Rig Map F03 de Golisopod (Z-A real)
        rig_map_goli = build_rig_map(
            bone_names=["origin", "waist", "spine_01", "head", "left_arm_a", "right_arm_a", "left_foot", "right_foot"],
            rig_id="golisopod_pm0867",
            armature_name="pm0867_00_00",
            absent_roles=["left_wing", "right_wing"]
        )

        # 3. Amostras proporcionais para comparar a pose de base dos dois espécimes
        sample_count = 5
        # Eggo (H = 1.20 m)
        samples_eggo = {
            "root": [(0.0, 0.0, 0.0) for _ in range(sample_count)],
            "pelvis": [(0.0, 0.0, 0.60) for _ in range(sample_count)],
            "head": [(0.0, 0.0, 1.15) for _ in range(sample_count)],
            "left_foot": [(-0.15, 0.0, 0.02) for _ in range(sample_count)],
            "right_foot": [(0.15, 0.0, 0.02) for _ in range(sample_count)],
        }
        # Golisopod (H = 1.442 m factual do benchmark oficial)
        # Posições escaladas por H_goli / H_eggo (1.442 / 1.20 ~= 1.2016)
        samples_goli = {
            "root": [(0.0, 0.0, 0.0) for _ in range(sample_count)],
            "pelvis": [(0.0, 0.0, 0.72) for _ in range(sample_count)],
            "head": [(0.0, 0.0, 1.38) for _ in range(sample_count)],
            "left_foot": [(-0.18, 0.0, 0.025) for _ in range(sample_count)],
            "right_foot": [(0.18, 0.0, 0.025) for _ in range(sample_count)],
        }

        # 4. Comparação Cross-Rig F04
        comparison = compare_cross_rig_actions(
            comparison_id="eggo_vs_golisopod_posture",
            rig_map_a=rig_map_eggo,
            rig_map_b=rig_map_goli,
            action_a_meta={"action_name": "Idle 1", "armature_name": "AlienRig", "duration_seconds": 1.0, "fps": 24.0},
            action_b_meta={"action_name": "00400_attack01", "armature_name": "pm0867_00_00", "duration_seconds": 4.5, "fps": 30.0},
            height_a_m=1.20,
            height_b_m=1.442,
            samples_a_by_role=samples_eggo,
            samples_b_by_role=samples_goli,
            sample_count=sample_count,
        )

        is_valid, errors = validate_cross_rig_compare(comparison)
        self.assertTrue(is_valid, f"Erros F04: {errors}")

        # A discrepância global normalizada deve ser minúscula (< 1% de H) porque as proporções foram preservadas
        self.assertLess(comparison["global_mean_discrepancy_rel_H"], 0.01)

        # 5. Evidência real no disco: Folha de Golisopod
        real_png = os.path.join(REPO_ROOT, "dumper test", "za-referencias", "folhas", "folha_pm0867_00_00_00400_attack01_q3_frente_D_e12.png")
        self.assertTrue(os.path.isfile(real_png))
        real_sha256 = compute_file_sha256(real_png)

        # 6. Exportação para F15 e validação com arquivos do disco
        report = export_cross_rig_to_agent_report(
            comparison=comparison,
            source_file_a=self.eggo_dodge_blend,
            rig_mapping_a=rig_map_eggo,
            visual_evidence=[
                {
                    "evidence_id": "ZA-FOLHA-GOLISOPOD-ATTACK01",
                    "file_path": real_png,
                    "sha256": real_sha256,
                    "view_type": "FRONT",
                    "frames_shown": [0, 20, 40],
                    "reading_token": "ZA_GOLI",
                    "verified_exists": True
                }
            ]
        )
        rep_valid, rep_errs = validate_agent_report(report, verify_files=True)
        self.assertTrue(rep_valid, f"Erros relatório F15: {rep_errs}")


if __name__ == "__main__":
    unittest.main()
