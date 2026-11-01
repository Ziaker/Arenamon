"""Testes de regressão específicos para F06, F07 e F09.

Cobre com rigor factual:
1. F07: Pés ausentes retornam support_stability_ratio = None (não 1.0) e listam missing_data.
2. F06: Evento não autenticado recai para CANDIDATO com advertência formal.
3. F06: Evento autenticado com proveniência e verificação confirma CONFIRMADO_EVENTO.
4. F06: Alvos tipo BOX e detecção contínua (CCD / travessia rápida entre amostras para esfera e caixa).
5. F09: Seleção automática de marcos fundamentais (sem imposição manual) e nomenclatura esquelética explícita.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agent_report import validate_agent_report
from pose_silhouette import (
    KEYFRAME_ROLE_ANTICIPATION,
    KEYFRAME_ROLE_RECOVERY,
    KEYFRAME_ROLE_START,
    KEYFRAME_ROLE_STRIKE,
    auto_detect_keyframe_milestones,
    build_pose_silhouette_analysis,
    export_pose_silhouette_to_agent_report,
    validate_pose_silhouette,
)
from rig_map import build_rig_map
from strike_analysis import (
    CONFIRMATION_SOURCE_EVENT,
    CONFIRMATION_SOURCE_GEOMETRIC,
    CONFIRMATION_SOURCE_HEURISTIC,
    CONTACT_STATUS_CANDIDATE,
    CONTACT_STATUS_CONFIRMED_EVENT,
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


class TestF06F07F09Regression(unittest.TestCase):

    def setUp(self):
        self.rig_map = build_rig_map(
            bone_names=["Root", "Hips", "Spine", "Head", "RightArm", "RightHand", "LeftFoot", "RightFoot"],
            rig_id="test_biped_rig",
            armature_name="TestHeroRig",
        )

    # -----------------------------------------------------------------------
    # Regressão 1: F07 — Pés ausentes não geram estabilidade 1.0
    # -----------------------------------------------------------------------
    def test_regression_f07_missing_feet_returns_none_not_one(self):
        """Regressão 1: Se as posições dos pés não forem fornecidas, o suporte NÃO pode ser 1.0."""
        pelvis_traj = {
            0: [0.0, 0.0, 1.0],
            5: [0.0, -0.1, 0.9],
            10: [0.0, 0.5, 1.0],
        }

        # Não passa left_foot_positions nem right_foot_positions
        analysis = build_weight_momentum_analysis(
            action_name="Attack_No_Feet",
            armature_name="HeroRig",
            frame_range=(0, 10),
            fps=30.0,
            pelvis_positions=pelvis_traj,
            left_foot_positions=None,
            right_foot_positions=None,
        )

        is_valid, errs = validate_weight_momentum(analysis)
        self.assertTrue(is_valid, f"Erros na validação F07: {errs}")

        # O suporte deve ser estritamente None, NUNCA 1.0
        self.assertIsNone(analysis["metrics"]["support_stability_ratio"])

        # Deve registrar em fatos e limitações que os pés não foram avaliados
        facts_text = " ".join(analysis["facts"])
        self.assertIn("Trajetórias dos pés não fornecidas", facts_text)

        limitations_text = " ".join(analysis["limitations"])
        self.assertIn("Trajetórias dos pés ausentes", limitations_text)

        # Exportação para F15: a lista missing_data deve declarar a ausência dos pés
        report = export_weight_momentum_to_agent_report(
            analysis=analysis,
            source_file="C:/test/hero.blend",
            rig_mapping=self.rig_map,
        )
        is_rep_valid, rep_errs = validate_agent_report(report, verify_files=False)
        self.assertTrue(is_rep_valid, f"Erros no relatório F15: {rep_errs}")

        missing = report["limitations_and_risks"]["missing_data"]
        self.assertTrue(any("pés" in m.lower() for m in missing))

    # -----------------------------------------------------------------------
    # Regressão 2: F06 — Evento não autenticado recai para CANDIDATO
    # -----------------------------------------------------------------------
    def test_regression_f06_unauthenticated_event_falls_back_to_candidate(self):
        """Regressão 2: Passar um frame isolado sem autenticação ou evento com is_verified=False recai para CANDIDATO."""
        effector_traj = {
            0: [0.0, 0.0, 1.0],
            5: [0.0, 0.8, 1.0],
            10: [0.0, 1.0, 1.0],
        }

        # Caso A: número inteiro solto
        analysis_int = build_strike_analysis(
            action_name="Jab_Unauth_Int",
            armature_name="HeroRig",
            frame_range=(0, 10),
            fps=30.0,
            strike_effector_role="right_hand",
            effector_positions=effector_traj,
            authorized_event_frame=8,
        )
        self.assertEqual(analysis_int["metrics"]["contact_status"], CONTACT_STATUS_CANDIDATE)
        self.assertEqual(analysis_int["metrics"]["confirmation_source"], CONFIRMATION_SOURCE_HEURISTIC)
        self.assertTrue(any("authorized_event_frame" in f for f in analysis_int["facts"]))

        # Caso B: dict sem verificação formal (is_verified=False)
        unauth_event = {
            "event_name": "HITBOX_TRIGGER",
            "frame": 8,
            "source": "UNKNOWN_SCRIPT",
            "is_verified": False,
        }
        analysis_dict = build_strike_analysis(
            action_name="Jab_Unauth_Dict",
            armature_name="HeroRig",
            frame_range=(0, 10),
            fps=30.0,
            strike_effector_role="right_hand",
            effector_positions=effector_traj,
            authorized_event=unauth_event,
        )
        self.assertEqual(analysis_dict["metrics"]["contact_status"], CONTACT_STATUS_CANDIDATE)
        self.assertEqual(analysis_dict["metrics"]["confirmation_source"], CONFIRMATION_SOURCE_HEURISTIC)
        self.assertTrue(any("rejeitado por falta de autenticação" in f for f in analysis_dict["facts"]))

    # -----------------------------------------------------------------------
    # Regressão 3: F06 — Evento autenticado confirma CONFIRMADO_EVENTO
    # -----------------------------------------------------------------------
    def test_regression_f06_authenticated_event_confirms_with_provenance(self):
        """Regressão 3: Evento autenticado com identificador, origem e verificação gera CONFIRMADO_EVENTO."""
        effector_traj = {
            0: [0.0, 0.0, 1.0],
            4: [0.0, 0.5, 1.0],
            8: [0.0, 1.0, 1.0],
            12: [0.0, 1.1, 1.0],
        }

        auth_event = {
            "event_name": "MELEE_HITBOX_ACTIVE",
            "frame": 8,
            "source": "GAMEPLAY_TIMELINE_COLLISION_TABLE",
            "is_verified": True,
        }

        analysis = build_strike_analysis(
            action_name="Punch_Auth",
            armature_name="HeroRig",
            frame_range=(0, 12),
            fps=30.0,
            strike_effector_role="right_hand",
            effector_positions=effector_traj,
            authorized_event=auth_event,
        )

        self.assertEqual(analysis["metrics"]["contact_status"], CONTACT_STATUS_CONFIRMED_EVENT)
        self.assertEqual(analysis["metrics"]["confirmation_source"], CONFIRMATION_SOURCE_EVENT)
        self.assertEqual(analysis["metrics"]["contact_frame"], 8)
        self.assertIn("MELEE_HITBOX_ACTIVE", analysis["facts"][3])

    # -----------------------------------------------------------------------
    # Regressão 4: F06 — Alvo tipo BOX e detecção contínua (CCD / travessia)
    # -----------------------------------------------------------------------
    def test_regression_f06_continuous_collision_sphere_and_box_tunneling(self):
        """Regressão 4: Detecção contínua (CCD) intercepta alvos SPHERE e BOX mesmo quando o efetor
        salta através do colisor entre amostras (tunneling).
        """
        # O efetor salta de Y=0.0 (f=0) diretamente para Y=2.0 (f=2).
        # A esfera está em Y=1.0 com raio 0.2 m (nenhuma amostra cai exatamente dentro).
        tunneling_traj = {
            0: [0.0, 0.0, 1.0],
            2: [0.0, 2.0, 1.0],
            4: [0.0, 2.1, 1.0],
        }

        # Teste 4.1: Esfera com travessia
        target_sphere = {"type": "SPHERE", "center": [0.0, 1.0, 1.0], "radius_m": 0.20}
        analysis_sph = build_strike_analysis(
            action_name="Fast_Thrust_Sphere",
            armature_name="HeroRig",
            frame_range=(0, 4),
            fps=30.0,
            strike_effector_role="right_hand",
            effector_positions=tunneling_traj,
            target_geometry=target_sphere,
        )
        self.assertEqual(analysis_sph["metrics"]["contact_status"], CONTACT_STATUS_CONFIRMED_TARGET)
        self.assertEqual(analysis_sph["metrics"]["contact_frame"], 2)
        self.assertIn("CCD", analysis_sph["facts"][3])

        # Teste 4.2: Caixa AABB com travessia
        target_box = {
            "type": "BOX",
            "center": [0.0, 1.0, 1.0],
            "extents_m": [0.4, 0.4, 0.4],
        }
        analysis_box = build_strike_analysis(
            action_name="Fast_Thrust_Box",
            armature_name="HeroRig",
            frame_range=(0, 4),
            fps=30.0,
            strike_effector_role="right_hand",
            effector_positions=tunneling_traj,
            target_geometry=target_box,
        )
        self.assertEqual(analysis_box["metrics"]["contact_status"], CONTACT_STATUS_CONFIRMED_TARGET)
        self.assertEqual(analysis_box["metrics"]["contact_frame"], 2)
        self.assertIn("BOX", analysis_box["facts"][3])

    # -----------------------------------------------------------------------
    # Regressão 5: F09 — Detecção automática de marcos e nomenclatura esquelética
    # -----------------------------------------------------------------------
    def test_regression_f09_auto_detect_milestones_and_skeletal_bbox_naming(self):
        """Regressão 5: A detecção automática analítica identifica marcos sem intervenção manual
        e o contrato reporta Bounding Box Esquelética explicitamente.
        """
        # Cinemática de ataque completa:
        # f=0: repouso
        # f=5: recuo (antecipação: mão vai para Y=-0.2)
        # f=15: projeção balística máxima (strike: mão vai para Y=+1.4)
        # f=25: retorno / recuperação (mão volta para Y=+0.6)
        dense_poses = {
            0: {"Hips": [0, 0, 1.0], "RightHand": [0.3, 0.0, 1.2]},
            5: {"Hips": [0, -0.1, 0.95], "RightHand": [0.3, -0.2, 1.1]},
            15: {"Hips": [0, 0.4, 0.98], "RightHand": [0.3, 1.4, 1.3]},
            25: {"Hips": [0, 0.2, 1.0], "RightHand": [0.3, 0.6, 1.2]},
        }

        # Não passa keyframe_roles: aciona a detecção analítica automática
        analysis = build_pose_silhouette_analysis(
            action_name="Heavy_Slash_Auto",
            armature_name="HeroRig",
            frame_range=(0, 25),
            fps=30.0,
            keyframe_bone_poses=dense_poses,
            keyframe_roles=None,
        )

        is_valid, errs = validate_pose_silhouette(analysis)
        self.assertTrue(is_valid, f"Erros na validação F09: {errs}")

        kfs = {k["frame"]: k for k in analysis["keyframes"]}
        self.assertEqual(kfs[0]["structural_role"], KEYFRAME_ROLE_START)
        self.assertEqual(kfs[5]["structural_role"], KEYFRAME_ROLE_ANTICIPATION)
        self.assertEqual(kfs[15]["structural_role"], KEYFRAME_ROLE_STRIKE)
        self.assertEqual(kfs[25]["structural_role"], KEYFRAME_ROLE_RECOVERY)

        # Verifica nota taxonômica explícita em fatos e limitações
        facts_text = " ".join(analysis["facts"])
        self.assertIn("Bounding Box Esquelética Projetada", facts_text)
        self.assertIn("automática por cinemática", facts_text)

        # Exportação para F15
        report = export_pose_silhouette_to_agent_report(
            analysis=analysis,
            source_file="C:/test/hero.blend",
            rig_mapping=self.rig_map,
        )
        is_rep_valid, rep_errs = validate_agent_report(report, verify_files=False)
        self.assertTrue(is_rep_valid, f"Erros no relatório F15: {rep_errs}")

        # Métricas devem conter skeletal_projected
        metric_names = [m["metric"] for m in report["measurements"]]
        self.assertTrue(any("skeletal_projected" in m for m in metric_names))


if __name__ == "__main__":
    unittest.main()
