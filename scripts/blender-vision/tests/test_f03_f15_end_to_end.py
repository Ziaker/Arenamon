"""Demonstração e teste do fluxo sintético completo de ponta a ponta (F03 + F15).

Fluxo verificado:
Rig de origem → Mapeamento F03 → Diagnóstico cinemático → Relatório F15 → Validação do relatório.
"""
import hashlib
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agent_report import (
    AgentReportError,
    build_agent_report,
    compute_file_sha256,
    validate_agent_report,
)
from rig_map import (
    STATUS_ABSENT,
    STATUS_MAPPED,
    build_rig_map,
    validate_rig_map,
)


class TestF03F15EndToEnd(unittest.TestCase):

    def test_complete_synthetic_pipeline(self):
        # 1. RIG DE ORIGEM (Simulando personagem bípede sintético com cauda opcional ausente)
        rig_source_bones = [
            "b_Root", "b_Pelvis", "b_Spine", "b_Spine1", "b_Head",
            "b_LeftUpperArm", "b_LeftForeArm", "b_LeftHand",
            "b_RightUpperArm", "b_RightForeArm", "b_RightHand",
            "b_LeftUpLeg", "b_LeftLeg", "b_LeftFoot",
            "b_RightUpLeg", "b_RightLeg", "b_RightFoot",
            "b_Sword_Slot"
        ]

        # 2. ETAPA F03: MAPEAMENTO ANATÔMICO SEMÂNTICO
        rig_map = build_rig_map(
            bone_names=rig_source_bones,
            rig_id="synth_warrior_01",
            armature_name="Armature_Synth",
            overrides={"prop": "b_Sword_Slot"},
            absent_roles=["tail_base", "tail_mid", "tail_tip", "left_wing", "right_wing"]
        )

        # Asserções de F03
        self.assertEqual(rig_map["schema"], "arenamon.rig-map/1")
        self.assertEqual(rig_map["detected_template"], "GIGANTIC_UNREAL")
        self.assertEqual(rig_map["roles"]["root"]["bone_name"], "b_Root")
        self.assertEqual(rig_map["roles"]["pelvis"]["bone_name"], "b_Pelvis")
        self.assertEqual(rig_map["roles"]["prop"]["bone_name"], "b_Sword_Slot")
        self.assertEqual(rig_map["roles"]["tail_base"]["status"], STATUS_ABSENT)

        # 3. ETAPA DE DIAGNÓSTICO (Simulando leitura de F-Curves da Action sintética 'Dodge_Backward')
        # Criação temporária de folha de evidência sintética para teste com hash real
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_img:
            tmp_img.write(b"SYNTHETIC_ORTHO_CONTACT_SHEET_DATA_VISTA_FRONTAL")
            tmp_img_path = tmp_img.name

        try:
            img_sha256 = compute_file_sha256(tmp_img_path)

            # Extração de medições usando os papéis anatômicos identificados por F03
            root_bone = rig_map["roles"]["root"]["bone_name"]
            pelvis_bone = rig_map["roles"]["pelvis"]["bone_name"]

            measurements = [
                {
                    "metric": "root_motion_y_displacement",
                    "value": -3.50,
                    "unit": "m",
                    "method": "fcurve_endpoints_eval",
                    "confidence": 0.99,
                    "target_role": "root",
                    "target_bone": root_bone
                },
                {
                    "metric": "pelvis_yaw_max_rotation",
                    "value": 12.4,
                    "unit": "degrees",
                    "method": "pose_quaternion_euler_z",
                    "confidence": 0.95,
                    "target_role": "pelvis",
                    "target_bone": pelvis_bone
                }
            ]

            visual_evidence = [
                {
                    "evidence_id": "EV-SYNTH-DODGE-01",
                    "file_path": tmp_img_path,
                    "sha256": img_sha256,
                    "view_type": "FRONT",
                    "frames_shown": [1, 6, 12, 18, 24],
                    "reading_token": "SNT01",
                    "verified_exists": True
                }
            ]

            findings = {
                "facts": [
                    f"O osso de raiz '{root_bone}' translada exatamente 3.50 m ao longo do eixo Y.",
                    f"O osso de pelve '{pelvis_bone}' apresenta variacao de guinada de 12.4 graus."
                ],
                "observations": [
                    "A silhueta frontal preserva alinhamento dos membros superiores durante a evasao."
                ],
                "inferences": [
                    "O recuo uniaxial de 3.50 m e consistente com a classe pesada de lutadores."
                ],
                "hypotheses": [
                    "A rotacao discreta de pelve pode atuar como amortecimento estetico de inercia."
                ]
            }

            limitations_and_risks = {
                "missing_data": ["Action Slot nao suportado pelo formato da fixture"],
                "assumptions": ["Massa corporal do guerreiro estimada em 80 kg"],
                "risks": ["Reduzir a distancia para menos de 3.0 m reduzira a seguranca do dodge"],
                "confidence_score": 0.94
            }

            proposed_corrections = [
                {
                    "proposal_id": "PROP-SYNTH-01",
                    "target_role": "pelvis",
                    "frame_range": [15, 24],
                    "suggested_action": "Suavizar desaceleracao angular na recuperacao",
                    "parameters": {"damping_factor": 0.15},
                    "rationale": "Evitar parada abrupta no frame final",
                    "applied": False  # NUNCA executada automaticamente
                }
            ]

            target_info = {
                "source_file": "synthetic_fixtures/warrior.blend",
                "action_name": "Dodge_Backward",
                "action_slot": None,  # Exemplo real de Action sem slot
                "armature_name": "Armature_Synth",
                "frame_range": [1, 24],
                "fps": 24.0,
                "unit_system": "METRIC_METERS"
            }

            # 4. ETAPA F15: CONSTRUÇÃO DO RELATÓRIO ESTRUTURADO PARA AGENTES
            report = build_agent_report(
                report_id="REP-SYNTH-END-TO-END-001",
                target=target_info,
                rig_mapping=rig_map,
                measurements=measurements,
                visual_evidence=visual_evidence,
                findings=findings,
                limitations_and_risks=limitations_and_risks,
                proposed_corrections=proposed_corrections
            )

            # 5. ETAPA DE VALIDAÇÃO DO RELATÓRIO (com verificação física de evidências)
            is_valid, errors = validate_agent_report(report, verify_files=True)
            self.assertTrue(is_valid)
            self.assertEqual(len(errors), 0)

            # Validação das propriedades estruturais do relatório final
            self.assertEqual(report["schema"], "arenamon.agent-report/1")
            self.assertEqual(report["target"]["duration_seconds"], 1.0)
            self.assertEqual(report["rig_mapping"]["detected_template"], "GIGANTIC_UNREAL")
            self.assertFalse(report["proposed_corrections"][0]["applied"])

            # 6. Serialização JSON garantida para consumo por Claude / Codex / Antigravity
            json_str = json.dumps(report, indent=2, ensure_ascii=False)
            self.assertIn("arenamon.agent-report/1", json_str)
            self.assertIn("arenamon.rig-map/1", json_str)
            self.assertIn(img_sha256, json_str)

        finally:
            if os.path.exists(tmp_img_path):
                os.remove(tmp_img_path)


if __name__ == "__main__":
    unittest.main()
