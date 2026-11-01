"""Testes unitários para F04 — Comparação Cross-Rig (arenamon.cross-rig-compare/1)."""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from cross_rig_compare import (
    CrossRigCompareError,
    compare_cross_rig_actions,
    export_cross_rig_to_agent_report,
    validate_cross_rig_compare,
)
from rig_map import build_rig_map


class TestF04CrossRigCompare(unittest.TestCase):

    def setUp(self):
        # Rig A: Mixamo padrão (H=1.80m)
        self.rig_map_a = build_rig_map(
            bone_names=["mixamorig:Hips", "mixamorig:Head", "mixamorig:LeftHand", "mixamorig:RightHand", "mixamorig:LeftFoot", "mixamorig:RightFoot"],
            rig_id="human_mixamo",
            armature_name="Armature_Mixamo",
        )
        # Rig B: AlienRig do Arenamon (H=1.20m)
        self.rig_map_b = build_rig_map(
            bone_names=["Hips", "Head", "LeftArm", "RightArm", "LeftFoot", "RightFoot"],
            rig_id="alien_rig",
            armature_name="AlienRig",
        )

    def test_cross_rig_comparison_with_full_spatial_normalization(self):
        """Testa que modelos em posições arbitrárias de mundo e com orientações distintas
        são perfeitamente alinhados e centralizados pela normalização canônica.
        """
        sample_count = 5
        h_a = 1.80
        h_b = 1.20

        # Rig A no mundo: localizado em (10.0, 5.0, 0.0), virado a 90° (yaw = 90°)
        # Em relação à pelve (10, 5, 1.0):
        # Cabeça está em (10, 5, 1.7) -> offset local (0, 0, 0.7)
        # Pé esquerdo virado a 90°: no espaço local alinhado seria x=-0.2, y=0. Mas rodado 90° fica x=0, y=-0.2
        pelv_a_world = (10.0, 5.0, 1.0)
        head_a_world = (10.0, 5.0, 1.7)
        # Rodado 90°: dx_rot = dx*cos(-90) - dy*sin(-90)
        # Para que no local alinhado x_can = -0.2, y_can = 0.0:
        # No mundo rodado 90°: dx = -0.2*cos(90) = 0, dy = -0.2*sin(90) = -0.2 -> world = (10.0, 4.8, 0.05)
        lf_a_world = (10.0, 4.8, 0.05)
        rf_a_world = (10.0, 5.2, 0.05)

        samples_a = {
            "pelvis": [pelv_a_world for _ in range(sample_count)],
            "head": [head_a_world for _ in range(sample_count)],
            "left_foot": [lf_a_world for _ in range(sample_count)],
            "right_foot": [rf_a_world for _ in range(sample_count)],
        }
        yaws_a = [90.0 for _ in range(sample_count)]

        # Rig B no mundo: localizado na origem (0.0, 0.0, 0.0), virado para o norte canônico (yaw = 0°)
        # Escala proporcional a H_B = 1.20:
        # Cabeça: dz_rel = 0.7 * (1.20 / 1.80) = 0.4667 -> world = (0.0, 0.0, 0.6667 + 0.4667 = 1.1333)
        # Pés: dx_rel = 0.2 * (1.20 / 1.80) = 0.1333
        pelv_b_world = (0.0, 0.0, 0.6667)
        head_b_world = (0.0, 0.0, 1.1333)
        lf_b_world = (-0.1333, 0.0, 0.0333)
        rf_b_world = (0.1333, 0.0, 0.0333)

        samples_b = {
            "pelvis": [pelv_b_world for _ in range(sample_count)],
            "head": [head_b_world for _ in range(sample_count)],
            "left_foot": [lf_b_world for _ in range(sample_count)],
            "right_foot": [rf_b_world for _ in range(sample_count)],
        }
        yaws_b = [0.0 for _ in range(sample_count)]

        comparison = compare_cross_rig_actions(
            comparison_id="mixamo_vs_alien_spatial_test",
            rig_map_a=self.rig_map_a,
            rig_map_b=self.rig_map_b,
            action_a_meta={"action_name": "Human_Idle", "armature_name": "Armature_Mixamo", "duration_seconds": 1.5, "fps": 30.0},
            action_b_meta={"action_name": "Alien_Idle", "armature_name": "AlienRig", "duration_seconds": 1.0, "fps": 24.0},
            height_a_m=h_a,
            height_b_m=h_b,
            samples_a_by_role=samples_a,
            samples_b_by_role=samples_b,
            sample_count=sample_count,
            yaws_a_deg=yaws_a,
            yaws_b_deg=yaws_b,
        )

        is_valid, errors = validate_cross_rig_compare(comparison)
        self.assertTrue(is_valid, f"Erros: {errors}")

        # Com centralização na pelve, rotação yaw inversa e divisão por H,
        # a discrepância espacial deve ser virtualmente nula (< 1% de H)!
        self.assertLess(comparison["global_mean_discrepancy_rel_H"], 0.01)
        self.assertLess(comparison["peak_discrepancy_rel_H"], 0.01)
        # Pelve centralizada na origem tem discrepância nula
        self.assertAlmostEqual(comparison["role_comparisons"]["pelvis"]["mean_discrepancy_rel_H"], 0.0, places=3)

    def test_prohibition_of_incompatible_or_unmapped_roles(self):
        rig_map_c = build_rig_map(
            bone_names=["tail_only", "prop_only"],
            rig_id="prop_rig",
            armature_name="PropArmature",
        )
        with self.assertRaises(CrossRigCompareError):
            compare_cross_rig_actions(
                comparison_id="invalid_compare",
                rig_map_a=self.rig_map_a,
                rig_map_b=rig_map_c,
                action_a_meta={},
                action_b_meta={},
                height_a_m=1.8,
                height_b_m=0.5,
                samples_a_by_role={},
                samples_b_by_role={},
            )

    def test_export_cross_rig_to_agent_report_f15(self):
        sample_count = 3
        samples = {"pelvis": [(0.0, 0.0, 1.0) for _ in range(sample_count)]}
        comp = compare_cross_rig_actions(
            "test_rep", self.rig_map_a, self.rig_map_b,
            {"action_name": "ActA", "armature_name": "ArmA", "duration_seconds": 1.0, "fps": 30.0, "frame_count": 30},
            {"action_name": "ActB", "armature_name": "ArmB", "duration_seconds": 1.0, "fps": 30.0, "frame_count": 30},
            1.8, 1.2, samples, samples, sample_count=sample_count
        )
        rep = export_cross_rig_to_agent_report(comp, source_file_a="model_a.blend", rig_mapping_a=self.rig_map_a)

        from agent_report import validate_agent_report
        is_valid, errors = validate_agent_report(rep, verify_files=False)
        self.assertTrue(is_valid, f"Erros: {errors}")
        self.assertEqual(rep["schema"], "arenamon.agent-report/1")


if __name__ == "__main__":
    unittest.main()
