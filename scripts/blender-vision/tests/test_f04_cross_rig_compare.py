"""Testes unitários para F04 — Comparação Cross-Rig (arenamon.cross-rig-compare/1)."""
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

    def test_cross_rig_comparison_with_scale_and_time_normalization(self):
        sample_count = 11
        # Amostras para Rig A (escala 1.80m)
        samples_a = {
            "pelvis": [(0.0, 0.0, 1.0) for _ in range(sample_count)],
            "head": [(0.0, 0.0, 1.7) for _ in range(sample_count)],
            "left_foot": [(-0.2, 0.0, 0.05) for _ in range(sample_count)],
            "right_foot": [(0.2, 0.0, 0.05) for _ in range(sample_count)],
        }
        # Amostras para Rig B (escala 1.20m, proporcionalmente similar)
        # Cabeça relativa a 1.20m é 1.20 * (1.7/1.8) ~= 1.133m
        samples_b = {
            "pelvis": [(0.0, 0.0, 0.667) for _ in range(sample_count)],
            "head": [(0.0, 0.0, 1.133) for _ in range(sample_count)],
            "left_foot": [(-0.133, 0.0, 0.033) for _ in range(sample_count)],
            "right_foot": [(0.133, 0.0, 0.033) for _ in range(sample_count)],
        }

        comparison = compare_cross_rig_actions(
            comparison_id="mixamo_vs_alien_idle",
            rig_map_a=self.rig_map_a,
            rig_map_b=self.rig_map_b,
            action_a_meta={"action_name": "Human_Idle", "armature_name": "Armature_Mixamo", "duration_seconds": 1.5, "fps": 30.0},
            action_b_meta={"action_name": "Alien_Idle", "armature_name": "AlienRig", "duration_seconds": 1.0, "fps": 24.0},
            height_a_m=1.80,
            height_b_m=1.20,
            samples_a_by_role=samples_a,
            samples_b_by_role=samples_b,
            sample_count=sample_count,
        )

        is_valid, errors = validate_cross_rig_compare(comparison)
        self.assertTrue(is_valid, f"Erros: {errors}")

        # Como as posições foram construídas proporcionalmente às alturas, a discrepância relativa H deve ser muito baixa
        self.assertLess(comparison["global_mean_discrepancy_rel_H"], 0.02)  # Menos de 2% de H
        self.assertIn("head", comparison["common_roles_evaluated"])
        self.assertIn("pelvis", comparison["common_roles_evaluated"])

    def test_prohibition_of_incompatible_or_unmapped_roles(self):
        # Rig C com papéis totalmente disjuntos não pode comparar
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
        sample_count = 5
        samples = {"pelvis": [(0.0, 0.0, 1.0) for _ in range(sample_count)]}
        comp = compare_cross_rig_actions(
            "test_rep", self.rig_map_a, self.rig_map_b,
            {"action_name": "ActA", "armature_name": "ArmA", "duration_seconds": 1.0, "fps": 30.0},
            {"action_name": "ActB", "armature_name": "ArmB", "duration_seconds": 1.0, "fps": 30.0},
            1.8, 1.2, samples, samples, sample_count=sample_count
        )
        rep = export_cross_rig_to_agent_report(comp, source_file_a="model_a.blend", rig_mapping_a=self.rig_map_a)

        from agent_report import validate_agent_report
        is_valid, errors = validate_agent_report(rep, verify_files=False)
        self.assertTrue(is_valid, f"Erros: {errors}")
        self.assertEqual(rep["schema"], "arenamon.agent-report/1")


if __name__ == "__main__":
    unittest.main()
