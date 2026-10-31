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
    RELATION_INDEPENDENT,
    RELATION_RUNTIME_ROTATED,
    RELATION_SYMMETRIC_MIRRORED,
    angular_difference,
    build_direction_coverage_analysis,
    calculate_horizontal_angle,
    export_direction_coverage_to_agent_report,
    normalize_direction_name,
    validate_direction_coverage,
)


class TestF01DirectionCoverage(unittest.TestCase):

    def test_normalize_direction_aliases(self):
        self.assertEqual(normalize_direction_name("FORWARD"), "N")
        self.assertEqual(normalize_direction_name("front"), "N")
        self.assertEqual(normalize_direction_name("RIGHT"), "E")
        self.assertEqual(normalize_direction_name("LEFT"), "W")
        self.assertEqual(normalize_direction_name("BACKWARD"), "S")
        self.assertEqual(normalize_direction_name("FORWARD_RIGHT"), "NE")
        self.assertEqual(normalize_direction_name("fl"), "NW")

    def test_calculate_horizontal_angle_blender_xy(self):
        # N = +Y -> dx=0, dy=1 -> 0°
        self.assertAlmostEqual(calculate_horizontal_angle(0.0, 1.0, "XY"), 0.0, places=2)
        # E = +X -> dx=1, dy=0 -> 90°
        self.assertAlmostEqual(calculate_horizontal_angle(1.0, 0.0, "XY"), 90.0, places=2)
        # S = -Y -> dx=0, dy=-1 -> 180°
        self.assertAlmostEqual(calculate_horizontal_angle(0.0, -1.0, "XY"), 180.0, places=2)
        # W = -X -> dx=-1, dy=0 -> 270°
        self.assertAlmostEqual(calculate_horizontal_angle(-1.0, 0.0, "XY"), 270.0, places=2)

    def test_angular_difference(self):
        self.assertAlmostEqual(angular_difference(10.0, 350.0), 20.0, places=2)
        self.assertAlmostEqual(angular_difference(0.0, 180.0), 180.0, places=2)
        self.assertAlmostEqual(angular_difference(45.0, 50.0), 5.0, places=2)

    def test_full_8way_coverage_and_symmetry(self):
        actions = {
            "N": {"action_name": "Run_F", "displacement_vector": (0.0, 2.0, 0.0), "duration_seconds": 1.0},
            "NE": {"action_name": "Run_FR", "displacement_vector": (1.41, 1.41, 0.0), "duration_seconds": 1.0, "symmetry_with_opposite": 0.02},
            "E": {"action_name": "Run_R", "displacement_vector": (2.0, 0.0, 0.0), "duration_seconds": 1.0, "symmetry_with_opposite": 0.03},
            "SE": {"action_name": "Run_BR", "displacement_vector": (1.41, -1.41, 0.0), "duration_seconds": 1.0, "symmetry_with_opposite": 0.12},
            "S": {"action_name": "Run_B", "displacement_vector": (0.0, -2.0, 0.0), "duration_seconds": 1.0},
            "SW": {"action_name": "Run_BL", "displacement_vector": (-1.41, -1.41, 0.0), "duration_seconds": 1.0},
            "W": {"action_name": "Run_L", "displacement_vector": (-2.0, 0.0, 0.0), "duration_seconds": 1.0},
            "NW": {"action_name": "Run_FL", "displacement_vector": (-1.41, 1.41, 0.0), "duration_seconds": 1.0},
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

        # Simetria E vs W: discrepância de 0.03m <= 0.05m -> SYMMETRIC_MIRRORED
        sym_e_w = [s for s in analysis["symmetry_pairs"] if tuple(s["pair"]) == ("E", "W")][0]
        self.assertEqual(sym_e_w["relation_type"], RELATION_SYMMETRIC_MIRRORED)

        # Simetria SE vs SW: discrepância de 0.12m > 0.05m -> INDEPENDENT_AUTHORIAL
        sym_se_sw = [s for s in analysis["symmetry_pairs"] if tuple(s["pair"]) == ("SE", "SW")][0]
        self.assertEqual(sym_se_sw["relation_type"], RELATION_INDEPENDENT)

    def test_partial_coverage_and_deviation(self):
        # Apenas 2 direções, e uma com ângulo desviado (N apontando para E)
        actions = {
            "N": {"action_name": "Run_Wrong", "displacement_vector": (2.0, 0.1, 0.0), "duration_seconds": 1.0},
            "S": {"action_name": "Run_Back", "displacement_vector": (0.0, -2.0, 0.0), "duration_seconds": 1.0},
        }

        analysis = build_direction_coverage_analysis(
            set_id="partial_run",
            armature_name="HeroArmature",
            actions_by_direction=actions,
            max_angular_tolerance_deg=20.0,
        )

        self.assertEqual(analysis["coverage_count"], 2)
        self.assertAlmostEqual(analysis["coverage_ratio"], 0.25, places=2)
        # N mediu ~87° quando devia ser 0° -> DEVIATED
        self.assertEqual(analysis["directions"]["N"]["status"], STATUS_DEVIATED)
        self.assertEqual(analysis["directions"]["E"]["status"], STATUS_ABSENT)

    def test_export_to_agent_report_f15(self):
        actions = {
            "N": {"action_name": "Run_N", "displacement_vector": (0.0, 3.0, 0.0), "duration_seconds": 1.0, "fps": 30.0},
            "S": {"action_name": "Run_S", "displacement_vector": (0.0, -3.0, 0.0), "duration_seconds": 1.0, "fps": 30.0},
        }
        analysis = build_direction_coverage_analysis("run_set", "Armature", actions)
        rep = export_direction_coverage_to_agent_report(analysis, source_file="hero.blend")

        from agent_report import validate_agent_report
        is_valid, errors = validate_agent_report(rep, verify_files=False)
        self.assertTrue(is_valid, f"Erros no relatório F15: {errors}")
        self.assertEqual(rep["schema"], "arenamon.agent-report/1")


if __name__ == "__main__":
    unittest.main()
