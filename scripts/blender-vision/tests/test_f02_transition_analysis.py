"""Testes unitários para F02 — Análise de Transições (arenamon.transition-analysis/1)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from rig_map import build_rig_map
from transition_analysis import (
    CANDIDATE_STATUS_CANDIDATE,
    CANDIDATE_STATUS_CONFIRMED,
    CANDIDATE_STATUS_NOT_IN_CONTACT,
    analyze_transition_continuity,
    export_transition_to_agent_report,
    validate_transition_analysis,
)


class TestF02TransitionAnalysis(unittest.TestCase):

    def setUp(self):
        self.rig_map = build_rig_map(
            bone_names=["Root", "Hips", "Chest", "LeftFoot", "RightFoot"],
            rig_id="test_rig",
            armature_name="AlienRig",
        )

    def test_smooth_transition_continuity(self):
        bone_poses_a = {
            "Hips": (0.0, 1.0, 0.9),
            "Chest": (0.0, 1.0, 1.2),
            "LeftFoot": (-0.15, 0.95, 0.02),
            "RightFoot": (0.15, 1.05, 0.02),
        }
        bone_poses_b = {
            "Hips": (0.0, 1.02, 0.9),
            "Chest": (0.0, 1.02, 1.2),
            "LeftFoot": (-0.15, 0.96, 0.02),
            "RightFoot": (0.15, 1.06, 0.02),
        }

        analysis = analyze_transition_continuity(
            action_a_name="Walk_Loop",
            action_b_name="Idle_Ready",
            armature_name="AlienRig",
            end_frame_a=30,
            start_frame_b=1,
            end_frame_b=24,
            root_pose_a={"position": (0.0, 1.0, 0.0), "yaw_deg": 15.0, "velocity_mps": 1.2},
            root_pose_b={"position": (0.0, 1.03, 0.0), "yaw_deg": 17.0, "velocity_mps": 1.0},
            bone_poses_a=bone_poses_a,
            bone_poses_b=bone_poses_b,
            fps_a=24.0,
            fps_b=24.0,
            ground_z_reference_m=0.0,
            ground_tolerance_m=0.05,
            foot_bones={"left_foot": "LeftFoot", "right_foot": "RightFoot"},
            visual_evidence_confirmed=False,
        )

        is_valid, errors = validate_transition_analysis(analysis)
        self.assertTrue(is_valid, f"Erros: {errors}")

        # Descontinuidade de raiz e yaw
        rc = analysis["root_continuity"]
        self.assertAlmostEqual(rc["spatial_delta_m"], 0.03, places=2)
        self.assertAlmostEqual(rc["orientation_delta_deg"], 2.0, places=1)
        self.assertAlmostEqual(rc["velocity_delta_mps"], 0.2, places=1)

        # Continuidade articular
        pc = analysis["pose_continuity"]
        self.assertTrue(pc["acceptable_transition"])
        self.assertLess(pc["mean_discrepancy_m"], 0.05)

        # Pés no solo sem evidência visual são estritamente CANDIDATE
        feet = analysis["foot_continuity"]
        self.assertEqual(len(feet), 2)
        for f in feet:
            self.assertEqual(f["contact_status_a"], CANDIDATE_STATUS_CANDIDATE)
            self.assertEqual(f["contact_status_b"], CANDIDATE_STATUS_CANDIDATE)
            self.assertFalse(f["is_sliding_candidate"])

    def test_discontinuous_transition_with_foot_sliding(self):
        bone_poses_a = {
            "Hips": (0.0, 1.0, 0.9),
            "LeftFoot": (-0.2, 0.5, 0.02),
            "RightFoot": (0.2, 1.5, 0.20),
        }
        bone_poses_b = {
            "Hips": (0.4, 1.0, 0.9),
            "LeftFoot": (-0.05, 0.5, 0.02),
            "RightFoot": (0.2, 1.5, 0.02),
        }

        analysis = analyze_transition_continuity(
            action_a_name="Dodge_Left",
            action_b_name="Attack_Heavy",
            armature_name="AlienRig",
            end_frame_a=20,
            start_frame_b=1,
            end_frame_b=35,
            root_pose_a={"position": (0.0, 0.0, 0.0), "yaw_deg": 0.0},
            root_pose_b={"position": (0.4, 0.0, 0.0), "yaw_deg": 45.0},
            bone_poses_a=bone_poses_a,
            bone_poses_b=bone_poses_b,
            fps_a=30.0,
            fps_b=30.0,
            foot_bones={"left_foot": "LeftFoot", "right_foot": "RightFoot"},
        )

        rc = analysis["root_continuity"]
        self.assertAlmostEqual(rc["spatial_delta_m"], 0.40, places=2)
        self.assertAlmostEqual(rc["orientation_delta_deg"], 45.0, places=1)
        self.assertEqual(rc["blend_recommendation_seconds"], 0.25)

        feet = {f["role"]: f for f in analysis["foot_continuity"]}
        self.assertTrue(feet["left_foot"]["is_sliding_candidate"])
        self.assertAlmostEqual(feet["left_foot"]["horizontal_sliding_m"], 0.15, places=2)
        self.assertEqual(feet["right_foot"]["contact_status_a"], CANDIDATE_STATUS_NOT_IN_CONTACT)
        self.assertEqual(feet["right_foot"]["contact_status_b"], CANDIDATE_STATUS_CANDIDATE)

    def test_export_transition_to_agent_report_f15(self):
        bone_poses_a = {"Hips": (0.0, 0.0, 1.0), "LeftFoot": (0.0, 0.0, 0.0), "RightFoot": (0.0, 0.0, 0.0)}
        bone_poses_b = {"Hips": (0.0, 0.0, 1.0), "LeftFoot": (0.0, 0.0, 0.0), "RightFoot": (0.0, 0.0, 0.0)}
        analysis = analyze_transition_continuity(
            "ActA", "ActB", "AlienRig", 10, 1,
            {"position": (0.0, 0.0, 0.0), "yaw_deg": 0.0},
            {"position": (0.0, 0.0, 0.0), "yaw_deg": 0.0},
            bone_poses_a, bone_poses_b,
            end_frame_b=20,
        )
        rep = export_transition_to_agent_report(analysis, source_file="model.blend", rig_mapping=self.rig_map)

        from agent_report import validate_agent_report
        is_valid, errors = validate_agent_report(rep, verify_files=False)
        self.assertTrue(is_valid, f"Erros: {errors}")
        self.assertEqual(rep["schema"], "arenamon.agent-report/1")
        # Target deve ser a Action B com faixa real
        self.assertEqual(rep["target"]["action_name"], "ActB")
        self.assertEqual(rep["target"]["frame_range"], [1, 20])


if __name__ == "__main__":
    unittest.main()
