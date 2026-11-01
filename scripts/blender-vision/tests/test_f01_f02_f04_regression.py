"""Testes de regressão específicos para F01, F02 e F04.

Cobre rigorosamente:
1. Proveniência temporal de F01 para F15 (sem nomes fabricados como *_8way_set,
   target apontando para Action real e metadados individuais preservados em measurements).
2. Classificação estrita de assimetria geométrica em F01 (GEOMETRIC_ASYMMETRY)
   sem inferência categórica sobre autoria independente.
3. Proveniência temporal e isolamento de metadados de F04 para F15
   (target com Action A real e preservação separada de todos os metadados de B em measurements).
4. Distinção explícita entre dados extraídos do Blender e parâmetros fornecidos manualmente.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agent_report import validate_agent_report
from cross_rig_compare import (
    compare_cross_rig_actions,
    export_cross_rig_to_agent_report,
)
from direction_coverage import (
    RELATION_DISTINCT_UNMEASURED,
    RELATION_GEOMETRIC_ASYMMETRY,
    RELATION_SAME_ACTION_REUSED,
    RELATION_SYMMETRIC_MIRRORED,
    STATUS_PRESENT,
    build_direction_coverage_analysis,
    export_direction_coverage_to_agent_report,
)
from rig_map import build_rig_map
import tests.test_f01_f02_f04_real_assets as real_assets_mod


class TestF01F02F04Regression(unittest.TestCase):

    def setUp(self):
        self.rig_map = build_rig_map(
            bone_names=["Root", "Hips", "Chest", "Head", "LeftArm", "RightArm", "LeftFoot", "RightFoot"],
            rig_id="test_rig",
            armature_name="TestArmature",
        )

    def test_regression_f01_provenance_preserves_action_metadata_without_fabricated_names(self):
        """Regressão 1: O exportador F01 não fabrica nomes agregados e registra a proveniência de cada Action."""
        actions = {
            "N": {"action_name": "Run_Forward_Real", "frame_count": 30, "fps": 30.0, "displacement_vector": [0.0, 3.0, 0.0], "is_in_place": False},
            "NE": {"action_name": "Run_Diag_NE_Real", "frame_count": 32, "fps": 30.0, "displacement_vector": [2.0, 2.0, 0.0], "is_in_place": False},
            "E": {"action_name": "Run_Right_Real", "frame_count": 28, "fps": 30.0, "displacement_vector": [3.0, 0.0, 0.0], "is_in_place": False},
        }

        analysis = build_direction_coverage_analysis(
            set_id="hero_locomotion_set",
            armature_name="HeroArmature",
            actions_by_direction=actions,
            mirror_similarity_threshold_m=0.05,
        )

        report = export_direction_coverage_to_agent_report(
            coverage=analysis,
            source_file="C:/test/hero.blend",
            rig_mapping=self.rig_map,
            reference_direction="N",
        )

        is_valid, errors = validate_agent_report(report, verify_files=False)
        self.assertTrue(is_valid, f"Erros no relatório: {errors}")

        target = report["target"]
        # Não pode ser nome sintético/fabricado como hero_locomotion_set_8way_set
        self.assertNotIn("8way_set", target["action_name"])
        self.assertNotIn("_set", target["action_name"])
        self.assertEqual(target["action_name"], "Run_Forward_Real")
        self.assertEqual(target["frame_range"], [0, 29])
        self.assertEqual(target["fps"], 30.0)

        # Medições devem conter os metadados individuais reais de cada direção presente
        meas_map = {m["metric"]: m["value"] for m in report["measurements"]}
        self.assertEqual(meas_map.get("direction_set_id"), "hero_locomotion_set")
        self.assertEqual(meas_map.get("action_metadata_N_name"), "Run_Forward_Real")
        self.assertEqual(meas_map.get("action_metadata_N_frame_count"), 30)
        self.assertEqual(meas_map.get("action_metadata_NE_name"), "Run_Diag_NE_Real")
        self.assertEqual(meas_map.get("action_metadata_NE_frame_count"), 32)
        self.assertEqual(meas_map.get("action_metadata_E_name"), "Run_Right_Real")
        self.assertEqual(meas_map.get("action_metadata_E_frame_count"), 28)

    def test_regression_f01_geometric_asymmetry_classification_without_authorial_speculation(self):
        """Regressão 2: F01 classifica discrepância pós-espelhamento estritamente como GEOMETRIC_ASYMMETRY,
        sem afirmações categóricas sobre autoria independente humana.
        """
        # Teste com discrepância pós-espelhamento medida de 0.12 m (> 0.05 m)
        actions = {
            "E": {
                "action_name": "Walk_E",
                "symmetry_with_opposite": 0.12,
                "displacement_vector": [2.0, 0.0, 0.0],
            },
            "W": {
                "action_name": "Walk_W",
                "displacement_vector": [-2.0, 0.0, 0.0],
            },
            "NE": {
                "action_name": "Walk_NE",
            },
            "NW": {
                "action_name": "Walk_NW",
            },
        }

        analysis = build_direction_coverage_analysis(
            set_id="walk_set",
            armature_name="HeroArmature",
            actions_by_direction=actions,
            mirror_similarity_threshold_m=0.05,
        )

        pairs = {f"{p['pair'][0]}_vs_{p['pair'][1]}": p for p in analysis["symmetry_pairs"]}

        # Par E/W teve discrepância de 0.12 m medida: deve ser GEOMETRIC_ASYMMETRY
        pair_ew = pairs["E_vs_W"]
        self.assertEqual(pair_ew["relation_type"], RELATION_GEOMETRIC_ASYMMETRY)
        self.assertAlmostEqual(pair_ew["mirror_discrepancy_m"], 0.12, places=3)
        # Rationale não pode fazer afirmações especulativas de psicologia de autoria
        self.assertIn("assimetria geométrica", pair_ew["rationale"].lower())
        self.assertNotIn("autoria humana", pair_ew["rationale"].lower())

        # Par NE/NW não teve medição pós-espelhamento: deve ser DISTINCT_ACTIONS_UNMEASURED
        pair_nenw = pairs["NE_vs_NW"]
        self.assertEqual(pair_nenw["relation_type"], RELATION_DISTINCT_UNMEASURED)
        self.assertIsNone(pair_nenw["mirror_discrepancy_m"])

    def test_regression_f04_provenance_preserves_action_b_metadata_separately(self):
        """Regressão 3: F04 preserva todos os metadados de Action B em measurements
        sem fabricar nomes combinados e sem distorcer o target de Action A.
        """
        comp = compare_cross_rig_actions(
            comparison_id="hero_vs_monster_test",
            rig_map_a=self.rig_map,
            rig_map_b=self.rig_map,
            action_a_meta={"action_name": "Hero_Attack_01", "armature_name": "HeroRig", "duration_seconds": 1.5, "fps": 30.0, "frame_count": 45},
            action_b_meta={"action_name": "Monster_Swipe_02", "armature_name": "MonsterRig", "duration_seconds": 2.0, "fps": 60.0, "frame_count": 120},
            height_a_m=1.80,
            height_b_m=2.50,
            samples_a_by_role={"pelvis": [[0, 0, 0]], "head": [[0, 0, 1.8]]},
            samples_b_by_role={"pelvis": [[0, 0, 0]], "head": [[0, 0, 2.5]]},
            sample_count=1,
            yaws_a_deg=[0.0],
            yaws_b_deg=[0.0],
        )

        report = export_cross_rig_to_agent_report(
            comparison=comp,
            source_file_a="C:/test/hero.blend",
            rig_mapping_a=self.rig_map,
        )

        is_valid, errors = validate_agent_report(report, verify_files=False)
        self.assertTrue(is_valid, f"Erros no relatório: {errors}")

        # O target do relatório deve referenciar estritamente Action A
        target = report["target"]
        self.assertEqual(target["action_name"], "Hero_Attack_01")
        self.assertEqual(target["armature_name"], "HeroRig")
        self.assertEqual(target["frame_range"], [0, 44])
        self.assertEqual(target["fps"], 30.0)

        # Os metadados de Action B devem estar preservados em measurements isoladamente
        meas = {m["metric"]: m["value"] for m in report["measurements"]}
        self.assertEqual(meas["cross_rig_target_b_action_name"], "Monster_Swipe_02")
        self.assertEqual(meas["cross_rig_target_b_armature"], "MonsterRig")
        self.assertEqual(meas["cross_rig_target_b_height_meters"], 2.50)
        self.assertEqual(meas["cross_rig_target_b_frame_count"], 120)
        self.assertEqual(meas["cross_rig_target_b_duration_seconds"], 2.0)
        self.assertEqual(meas["cross_rig_target_b_fps"], 60.0)

    def test_regression_real_assets_parameter_distinction_documented(self):
        """Regressão 4: Constantes de calibração manual e dados externos estão formalmente isoladas
        no módulo de assets reais, diferenciadas de dados extraídos de arquivos .blend.
        """
        # Verifica a presença e tipagem correta das constantes manuais
        self.assertTrue(hasattr(real_assets_mod, "PARAMETRO_MANUAL_ALTURA_EGGO_M"))
        self.assertTrue(hasattr(real_assets_mod, "PARAMETRO_MANUAL_ALTURA_GOLISOPOD_M"))
        self.assertTrue(hasattr(real_assets_mod, "PARAMETRO_MANUAL_NIVEL_SOLO_ALIENRIG_M"))
        self.assertTrue(hasattr(real_assets_mod, "PARAMETRO_MANUAL_TOLERANCIA_SOLO_M"))
        self.assertTrue(hasattr(real_assets_mod, "PARAMETRO_MANUAL_ROLES_PES_EGGO"))
        self.assertTrue(hasattr(real_assets_mod, "PARAMETRO_MANUAL_ROLES_AUSENTES"))

        self.assertAlmostEqual(real_assets_mod.PARAMETRO_MANUAL_ALTURA_EGGO_M, 1.20)
        self.assertAlmostEqual(real_assets_mod.PARAMETRO_MANUAL_ALTURA_GOLISOPOD_M, 1.442)
        self.assertAlmostEqual(real_assets_mod.PARAMETRO_MANUAL_NIVEL_SOLO_ALIENRIG_M, -0.52)
        self.assertEqual(real_assets_mod.PARAMETRO_MANUAL_ROLES_PES_EGGO["left_foot"], "LeftFoot")


if __name__ == "__main__":
    unittest.main()
