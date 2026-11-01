"""Testes unitários rigorosos para F06, F07 e F09 (Golpe, Peso e Silhueta).

Cobre:
- F06: Contato candidato cinemático vs confirmado por alvo vs confirmado por evento.
- F07: Métricas explicáveis de impulso, transferência da pelve e suporte de pés.
- F09: Identificação de poses-chave, silhueta 2D e vínculo com evidências visuais.
- Exportadores e validadores canônicos para 'arenamon.agent-report/1' (F15).
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agent_report import validate_agent_report
from pose_silhouette import (
    KEYFRAME_ROLE_ANTICIPATION,
    KEYFRAME_ROLE_START,
    KEYFRAME_ROLE_STRIKE,
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


class TestF06F07F09(unittest.TestCase):

    def setUp(self):
        self.rig_map = build_rig_map(
            bone_names=["Root", "Hips", "Spine", "Head", "RightArm", "RightHand", "LeftFoot", "RightFoot"],
            rig_id="test_biped_rig",
            armature_name="TestHeroRig",
        )

    # -----------------------------------------------------------------------
    # F06 — Testes de Golpe e Contato
    # -----------------------------------------------------------------------
    def test_f06_strike_heuristic_candidate_detection(self):
        """F06: Detecção cinemática de contato candidato quando não há alvo explícito."""
        # Trajetória sintética: efetor acelera até frame 8 e desacelera bruscamente no frame 10
        effector_traj = {
            0: [0.0, 0.0, 1.0],
            2: [0.0, 0.1, 1.0],
            4: [0.0, 0.3, 1.0],
            6: [0.0, 0.7, 1.0],
            8: [0.0, 1.3, 1.0],  # pico de velocidade entre 6 e 8
            10: [0.0, 1.4, 1.0], # desaceleração acentuada pós-pico
            12: [0.0, 1.42, 1.0],
            14: [0.0, 1.43, 1.0],
        }

        analysis = build_strike_analysis(
            action_name="Jab_01",
            armature_name="TestHeroRig",
            frame_range=(0, 14),
            fps=30.0,
            strike_effector_role="right_hand",
            effector_positions=effector_traj,
            target_strike_frames=6,
            target_hold_frames=3,
        )

        is_valid, errs = validate_strike_analysis(analysis)
        self.assertTrue(is_valid, f"Erros na validação F06: {errs}")

        metrics = analysis["metrics"]
        self.assertEqual(metrics["contact_status"], CONTACT_STATUS_CANDIDATE)
        self.assertEqual(metrics["confirmation_source"], CONFIRMATION_SOURCE_HEURISTIC)
        self.assertEqual(metrics["contact_frame"], 10)
        self.assertGreater(metrics["peak_speed_mps"], metrics["contact_speed_mps"])

        # Exportação para F15
        report = export_strike_to_agent_report(
            analysis=analysis,
            source_file="C:/test/hero.blend",
            rig_mapping=self.rig_map,
        )
        rep_valid, rep_errs = validate_agent_report(report, verify_files=False)
        self.assertTrue(rep_valid, f"Erros no relatório F15: {rep_errs}")

    def test_f06_strike_confirmed_geometric_target(self):
        """F06: Confirmação de contato por alvo geométrico explícito (colisão)."""
        effector_traj = {
            0: [0.0, 0.0, 1.0],
            3: [0.0, 0.4, 1.0],
            6: [0.0, 0.9, 1.0],
            9: [0.0, 1.2, 1.0], # entra no raio da esfera
            12: [0.0, 1.25, 1.0],
        }

        # Alvo centrado em [0, 1.2, 1.0] com raio de 0.10 m
        target_sphere = {"type": "SPHERE", "center": [0.0, 1.2, 1.0], "radius_m": 0.10}

        analysis = build_strike_analysis(
            action_name="Hook_Target",
            armature_name="TestHeroRig",
            frame_range=(0, 12),
            fps=30.0,
            strike_effector_role="right_hand",
            effector_positions=effector_traj,
            target_geometry=target_sphere,
        )

        metrics = analysis["metrics"]
        self.assertEqual(metrics["contact_status"], CONTACT_STATUS_CONFIRMED_TARGET)
        self.assertEqual(metrics["confirmation_source"], CONFIRMATION_SOURCE_GEOMETRIC)
        self.assertEqual(metrics["contact_frame"], 9)

    def test_f06_strike_confirmed_authorized_event(self):
        """F06: Confirmação de contato por evento autorizado de combate na timeline com proveniência."""
        effector_traj = {i: [0.0, i * 0.1, 1.0] for i in range(0, 16, 2)}

        auth_event = {
            "event_name": "MELEE_STRIKE_HITBOX",
            "frame": 8,
            "source": "COMBAT_TIMELINE_TABLE",
            "is_verified": True,
        }

        analysis = build_strike_analysis(
            action_name="Kick_Event",
            armature_name="TestHeroRig",
            frame_range=(0, 14),
            fps=30.0,
            strike_effector_role="right_foot",
            effector_positions=effector_traj,
            authorized_event=auth_event,
        )

        metrics = analysis["metrics"]
        self.assertEqual(metrics["contact_status"], CONTACT_STATUS_CONFIRMED_EVENT)
        self.assertEqual(metrics["confirmation_source"], CONFIRMATION_SOURCE_EVENT)
        self.assertEqual(metrics["contact_frame"], 8)

    # -----------------------------------------------------------------------
    # F07 — Testes de Peso e Momento
    # -----------------------------------------------------------------------
    def test_f07_weight_momentum_physics_metrics(self):
        """F07: Medição explicável de recuo, impulso, compressão vertical e aceleração da pelve."""
        # Pelve inicia em [0, 0, 1.0], recua para Y=-0.10 e desce para Z=0.92,
        # depois avança bruscamente para Y=+0.60 e retorna para Y=+0.50
        pelvis_traj = {
            0: [0.0, 0.0, 1.0],
            5: [0.0, -0.10, 0.92],  # recoil + compressão vertical
            10: [0.0, 0.25, 0.96],
            15: [0.0, 0.60, 1.0],   # avanço máximo (thrust)
            20: [0.0, 0.50, 1.0],   # recuperação
        }

        # Pés no solo (Z=0.0)
        l_foot = {f: [-0.2, 0.0, 0.0] for f in pelvis_traj}
        r_foot = {f: [0.2, 0.0, 0.0] for f in pelvis_traj}

        analysis = build_weight_momentum_analysis(
            action_name="Heavy_Punch_Momentum",
            armature_name="TestHeroRig",
            frame_range=(0, 20),
            fps=30.0,
            pelvis_positions=pelvis_traj,
            left_foot_positions=l_foot,
            right_foot_positions=r_foot,
            ground_z_reference_m=0.0,
            ground_tolerance_m=0.05,
        )

        is_valid, errs = validate_weight_momentum(analysis)
        self.assertTrue(is_valid, f"Erros na validação F07: {errs}")

        metrics = analysis["metrics"]
        self.assertAlmostEqual(metrics["anticipation_recoil_m"], 0.10, places=2)
        self.assertAlmostEqual(metrics["thrust_advance_m"], 0.70, places=2)  # -0.10 até +0.60 = 0.70 m
        self.assertAlmostEqual(metrics["vertical_compression_drop_m"], 0.08, places=2)  # 1.0 - 0.92 = 0.08 m
        self.assertGreater(metrics["peak_pelvis_velocity_mps"], 0.5)
        self.assertEqual(metrics["support_stability_ratio"], 1.0)

        # Exportação para F15
        report = export_weight_momentum_to_agent_report(
            analysis=analysis,
            source_file="C:/test/hero.blend",
            rig_mapping=self.rig_map,
        )
        rep_valid, rep_errs = validate_agent_report(report, verify_files=False)
        self.assertTrue(rep_valid, f"Erros no relatório F15: {rep_errs}")

    # -----------------------------------------------------------------------
    # F09 — Testes de Silhueta e Poses-Chave
    # -----------------------------------------------------------------------
    def test_f09_pose_silhouette_projections_and_evidence(self):
        """F09: Extração de silhueta 2D (bounding boxes), inclinação e amarração com evidências visuais."""
        poses_by_frame = {
            0: {
                "Hips": [0.0, 0.0, 1.0],
                "Chest": [0.0, 0.0, 1.4],
                "Head": [0.0, 0.0, 1.7],
                "LeftArm": [-0.3, 0.0, 1.3],
                "RightArm": [0.3, 0.0, 1.3],
            },
            10: {
                "Hips": [0.0, 0.2, 0.9],
                "Chest": [0.0, 0.4, 1.3],
                "Head": [0.0, 0.5, 1.6],  # inclinado para frente
                "LeftArm": [-0.2, 0.1, 1.2],
                "RightArm": [0.2, 0.8, 1.4], # braço esticado à frente (+Y)
            },
        }

        roles = {0: KEYFRAME_ROLE_START, 10: KEYFRAME_ROLE_STRIKE}
        evidences = [
            {
                "evidence_id": "EV-HERO-STRIKE-F10",
                "file_path": "C:/ev/hero_strike_f10.png",
                "sha256": "abcdef1234567890",
                "view_type": "FRONT",
                "frames_shown": [10],
            }
        ]

        analysis = build_pose_silhouette_analysis(
            action_name="Hero_Slash_Poses",
            armature_name="TestHeroRig",
            frame_range=(0, 20),
            fps=30.0,
            keyframe_bone_poses=poses_by_frame,
            keyframe_roles=roles,
            visual_evidences=evidences,
        )

        is_valid, errs = validate_pose_silhouette(analysis)
        self.assertTrue(is_valid, f"Erros na validação F09: {errs}")

        kfs = {k["frame"]: k for k in analysis["keyframes"]}
        self.assertEqual(kfs[0]["structural_role"], KEYFRAME_ROLE_START)
        self.assertEqual(kfs[10]["structural_role"], KEYFRAME_ROLE_STRIKE)
        self.assertEqual(kfs[10]["evidence_ref"]["evidence_id"], "EV-HERO-STRIKE-F10")

        # Frame 10 tem inclinação sagital para frente (> 0 graus)
        self.assertGreater(kfs[10]["sagittal_tilt_deg"], 10.0)

        # Exportação para F15
        report = export_pose_silhouette_to_agent_report(
            analysis=analysis,
            source_file="C:/test/hero.blend",
            rig_mapping=self.rig_map,
        )
        rep_valid, rep_errs = validate_agent_report(report, verify_files=False)
        self.assertTrue(rep_valid, f"Erros no relatório F15: {rep_errs}")


if __name__ == "__main__":
    unittest.main()
