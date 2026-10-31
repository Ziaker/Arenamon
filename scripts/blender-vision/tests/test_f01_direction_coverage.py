"""Testes unitários para F01 — Cobertura em Oito Direções (arenamon.direction-coverage/1)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from direction_coverage import (
    DIRECTIONS_8,
    STATUS_ABSENT,
    STATUS_DEVIATED,
    STATUS_PRESENT,
    RELATION_DISTINCT_UNMEASURED,
    RELATION_INDEPENDENT,
    RELATION_SAME_ACTION_REUSED,
    RELATION_SYMMETRIC_MIRRORED,
    angular_difference,
    build_direction_coverage_analysis,
    calculate_horizontal_angle,
    export_direction_coverage_to_agent_report,
    normalize_direction_name,
    validate_direction_coverage,
)
from rig_map import build_rig_map


class TestF01DirectionCoverage(unittest.TestCase):

    def test_normalize_direction_token_isolation(self):
        # Validação estrita contra o bug de colisão por substring
        self.assertEqual(normalize_direction_name("Run_N"), "N")
        self.assertEqual(normalize_direction_name("Run_NE"), "NE")
        self.assertEqual(normalize_direction_name("Run_E"), "E")
        self.assertEqual(normalize_direction_name("Run_SE"), "SE")
        self.assertEqual(normalize_direction_name("Run_S"), "S")
        self.assertEqual(normalize_direction_name("Run_SW"), "SW")
        self.assertEqual(normalize_direction_name("Run_W"), "W")
        self.assertEqual(normalize_direction_name("Run_NW"), "NW")
        self.assertEqual(normalize_direction_name("Dodge_Forward"), "N")
        self.assertEqual(normalize_direction_name("Dodge_Right"), "E")
        self.assertEqual(normalize_direction_name("Dodge_Left"), "W")
        self.assertEqual(normalize_direction_name("Dodge_Backward"), "S")

    def test_calculate_horizontal_angle_blender_xy(self):
        self.assertAlmostEqual(calculate_horizontal_angle(0.0, 1.0, "XY"), 0.0, places=2)
        self.assertAlmostEqual(calculate_horizontal_angle(1.0, 0.0, "XY"), 90.0, places=2)
        self.assertAlmostEqual(calculate_horizontal_angle(0.0, -1.0, "XY"), 180.0, places=2)
        self.assertAlmostEqual(calculate_horizontal_angle(-1.0, 0.0, "XY"), 270.0, places=2)

    def test_in_place_cycle_handling(self):
        # Ciclo in-place (deslocamento raiz < 0.05m) deve ser PRESENT com is_in_place=True
        actions = {
            "Run_N": {
                "action_name": "Pakko_Run_N",
                "displacement_vector": (0.0, 0.001, 0.0),
                "is_in_place": True,
                "facing_angle_deg": 0.0,
                "frame_count": 20,
                "fps": 30.0,
            }
        }
        analysis = build_direction_coverage_analysis("pakko_inplace", "Armature", actions)
        n_entry = analysis["directions"]["N"]
        self.assertEqual(n_entry["status"], STATUS_PRESENT)
        self.assertTrue(n_entry["is_in_place"])
        self.assertEqual(n_entry["measured_angle_deg"], 0.0)

    def test_full_8way_coverage_and_symmetry(self):
        actions = {
            "Run_N": {"action_name": "Run_F", "displacement_vector": (0.0, 2.0, 0.0), "duration_seconds": 1.0, "frame_count": 30},
            "Run_NE": {"action_name": "Run_FR", "displacement_vector": (1.41, 1.41, 0.0), "duration_seconds": 1.0, "frame_count": 30, "symmetry_with_opposite": 0.02},
            "Run_E": {"action_name": "Run_R", "displacement_vector": (2.0, 0.0, 0.0), "duration_seconds": 1.0, "frame_count": 30, "symmetry_with_opposite": 0.03},
            "Run_SE": {"action_name": "Run_BR", "displacement_vector": (1.41, -1.41, 0.0), "duration_seconds": 1.0, "frame_count": 30, "symmetry_with_opposite": 0.12},
            "Run_S": {"action_name": "Run_B", "displacement_vector": (0.0, -2.0, 0.0), "duration_seconds": 1.0, "frame_count": 30},
            "Run_SW": {"action_name": "Run_BL", "displacement_vector": (-1.41, -1.41, 0.0), "duration_seconds": 1.0, "frame_count": 30},
            "Run_W": {"action_name": "Run_L", "displacement_vector": (-2.0, 0.0, 0.0), "duration_seconds": 1.0, "frame_count": 30},
            "Run_NW": {"action_name": "Run_FL", "displacement_vector": (-1.41, 1.41, 0.0), "duration_seconds": 1.0, "frame_count": 30},
        }

        analysis = build_direction_coverage_analysis(
            set_id="synthetic_hero_run",
            armature_name="HeroArmature",
            actions_by_direction=actions,
            mirror_similarity_threshold_m=0.05,
        )

        is_valid, errors = validate_direction_coverage(analysis)
        self.assertTrue(is_valid, f"Erros: {errors}")

        self.assertEqual(analysis["coverage_count"], 8)
        self.assertEqual(analysis["coverage_ratio"], 1.0)
        self.assertEqual(analysis["directions"]["N"]["status"], STATUS_PRESENT)
        self.assertEqual(analysis["directions"]["E"]["status"], STATUS_PRESENT)

        # Simetria E vs W: 0.03m <= 0.05m -> SYMMETRIC_MIRRORED
        sym_e_w = [s for s in analysis["symmetry_pairs"] if tuple(s["pair"]) == ("E", "W")][0]
        self.assertEqual(sym_e_w["relation_type"], RELATION_SYMMETRIC_MIRRORED)

        # Simetria SE vs SW: 0.12m > 0.05m -> INDEPENDENT_AUTHORIAL
        sym_se_sw = [s for s in analysis["symmetry_pairs"] if tuple(s["pair"]) == ("SE", "SW")][0]
        self.assertEqual(sym_se_sw["relation_type"], RELATION_INDEPENDENT)

    def test_unmeasured_symmetry_distinct_vs_reused(self):
        # A e B distintas sem medição geométrica -> DISTINCT_ACTIONS_UNMEASURED
        actions = {
            "Run_E": {"action_name": "Action_Right", "displacement_vector": (1.0, 0.0, 0.0)},
            "Run_W": {"action_name": "Action_Left", "displacement_vector": (-1.0, 0.0, 0.0)},
        }
        analysis = build_direction_coverage_analysis("test_unmeasured", "Armature", actions)
        sym = [s for s in analysis["symmetry_pairs"] if tuple(s["pair"]) == ("E", "W")][0]
        self.assertEqual(sym["relation_type"], RELATION_DISTINCT_UNMEASURED)

        # Mesma Action em ambas -> SAME_ACTION_REUSED
        actions_same = {
            "Run_E": {"action_name": "Action_Omni", "displacement_vector": (1.0, 0.0, 0.0)},
            "Run_W": {"action_name": "Action_Omni", "displacement_vector": (-1.0, 0.0, 0.0)},
        }
        analysis_same = build_direction_coverage_analysis("test_same", "Armature", actions_same)
        sym_same = [s for s in analysis_same["symmetry_pairs"] if tuple(s["pair"]) == ("E", "W")][0]
        self.assertEqual(sym_same["relation_type"], RELATION_SAME_ACTION_REUSED)

    def test_export_to_agent_report_f15(self):
        actions = {
            "Run_N": {"action_name": "Run_N", "displacement_vector": (0.0, 3.0, 0.0), "duration_seconds": 1.0, "fps": 30.0, "frame_count": 30},
            "Run_S": {"action_name": "Run_S", "displacement_vector": (0.0, -3.0, 0.0), "duration_seconds": 1.0, "fps": 30.0, "frame_count": 30},
        }
        rig_map = build_rig_map(
            bone_names=["Root", "Hips", "LeftFoot", "RightFoot"],
            rig_id="hero_rig",
            armature_name="HeroArmature"
        )
        analysis = build_direction_coverage_analysis("run_set", "HeroArmature", actions)
        rep = export_direction_coverage_to_agent_report(analysis, source_file="hero.blend", rig_mapping=rig_map)

        from agent_report import validate_agent_report
        is_valid, errors = validate_agent_report(rep, verify_files=False)
        self.assertTrue(is_valid, f"Erros no relatório F15: {errors}")
        self.assertEqual(rep["schema"], "arenamon.agent-report/1")


if __name__ == "__main__":
    unittest.main()
