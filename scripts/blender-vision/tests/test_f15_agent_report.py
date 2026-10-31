"""Testes unitários para o Relatório Estruturado para Agentes de IA (F15).

Valida:
1. Estrutura do schema arenamon.agent-report/1.
2. Validação epistêmica estrita (fatos, observações, inferências, hipóteses).
3. Rejeição de auto-aplicação (applied != False).
4. Rejeição de frases genéricas e vagas.
5. Consistência matemática de frames, FPS e duração.
6. Validação física de evidências em disco com SHA-256.
"""
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


class TestF15AgentReport(unittest.TestCase):

    def setUp(self):
        self.valid_target = {
            "source_file": "chars/Eggo/eggo dodge lateral v1.blend",
            "action_name": "Dodge_Right_1",
            "action_slot": "Slot_Body",
            "armature_name": "AlienRig",
            "frame_range": [1, 24],
            "fps": 24.0,
            "unit_system": "METRIC_METERS"
        }
        self.valid_rig_map = {
            "schema": "arenamon.rig-map/1",
            "rig_id": "eggo_alien",
            "detected_template": "ALIEN_RIG"
        }
        self.valid_measurements = [
            {
                "metric": "root_motion_x_meters",
                "value": 3.25,
                "unit": "m",
                "method": "fcurve_eval",
                "confidence": 0.98,
                "target_role": "root",
                "target_bone": "Root"
            }
        ]
        self.valid_findings = {
            "facts": ["A curva de translacao em X atinge exatamente 3.25 m."],
            "observations": ["Contato do pe direito ocorre entre os frames 10 e 15."],
            "inferences": ["A desaceleracao inicial indica dissipacao de inercia."],
            "hypotheses": ["O deslocamento pode ter sido calibrado para a arena padrao."]
        }
        self.valid_lims = {
            "missing_data": ["Action slot secundario nao identificado"],
            "assumptions": ["Massa estimada em 45 kg"],
            "risks": ["Ajustar duracao pode quebrar janelas de cancelamento"],
            "confidence_score": 0.90
        }

    def test_valid_report_creation(self):
        rep = build_agent_report(
            report_id="REP-TEST-001",
            target=self.valid_target,
            rig_mapping=self.valid_rig_map,
            measurements=self.valid_measurements,
            visual_evidence=[],
            findings=self.valid_findings,
            limitations_and_risks=self.valid_lims,
            proposed_corrections=[
                {
                    "proposal_id": "PROP-01",
                    "target_role": "pelvis",
                    "frame_range": [5, 10],
                    "suggested_action": "Rotacionar pelve em 5 graus no eixo Z",
                    "parameters": {"z_rot_deg": 5.0},
                    "rationale": "Compensar desvio angular",
                    "applied": False
                }
            ]
        )
        self.assertEqual(rep["schema"], "arenamon.agent-report/1")
        self.assertEqual(rep["target"]["frame_count"], 24)
        self.assertEqual(rep["target"]["duration_seconds"], 1.0)
        self.assertFalse(rep["proposed_corrections"][0]["applied"])

    def test_inconsistent_frame_count(self):
        bad_target = dict(self.valid_target)
        bad_target["frame_range"] = [1, 20]
        # target diz [1, 20], o que dá 20 frames, mas se build receber outro valor forçado
        rep = build_agent_report(
            report_id="REP-BAD-FRAMES",
            target=bad_target,
            rig_mapping=self.valid_rig_map,
            measurements=self.valid_measurements,
            visual_evidence=[],
            findings=self.valid_findings,
            limitations_and_risks=self.valid_lims
        )
        rep["target"]["frame_count"] = 999  # Corrompe contagem manualmente
        with self.assertRaises(AgentReportError):
            validate_agent_report(rep)

    def test_rejection_of_auto_application(self):
        """O contrato proíbe terminantemente marcar applied=True."""
        rep = build_agent_report(
            report_id="REP-AUTO-APPLY",
            target=self.valid_target,
            rig_mapping=self.valid_rig_map,
            measurements=self.valid_measurements,
            visual_evidence=[],
            findings=self.valid_findings,
            limitations_and_risks=self.valid_lims,
            proposed_corrections=[
                {
                    "proposal_id": "PROP-ILLEGAL",
                    "target_role": "pelvis",
                    "suggested_action": "Apliquei no arquivo",
                    "rationale": "Teste",
                    "applied": True  # Tenta injetar True
                }
            ]
        )
        # build_agent_report força applied=False, mas se for corrompido:
        rep["proposed_corrections"][0]["applied"] = True
        with self.assertRaises(AgentReportError):
            validate_agent_report(rep)

    def test_rejection_of_generic_banned_phrases(self):
        """Rejeita expressões vagas como 'está fluida' ou 'ficou excelente'."""
        bad_findings = dict(self.valid_findings)
        bad_findings["observations"] = ["A animacao esta fluida e sem problemas."]
        with self.assertRaises(AgentReportError):
            build_agent_report(
                report_id="REP-GENERIC",
                target=self.valid_target,
                rig_mapping=self.valid_rig_map,
                measurements=self.valid_measurements,
                visual_evidence=[],
                findings=bad_findings,
                limitations_and_risks=self.valid_lims
            )

    def test_visual_evidence_sha256_verification(self):
        """Cria um arquivo temporário com hash conhecido e testa verificação no disco."""
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(b"MOCK_PNG_IMAGE_DATA_123456")
            tmp_path = tmp.name

        try:
            actual_hash = compute_file_sha256(tmp_path)
            ev_item = {
                "evidence_id": "EV-01",
                "file_path": tmp_path,
                "sha256": actual_hash,
                "view_type": "FRONT",
                "frames_shown": [1, 5, 10],
                "verified_exists": True
            }

            rep = build_agent_report(
                report_id="REP-EVIDENCE",
                target=self.valid_target,
                rig_mapping=self.valid_rig_map,
                measurements=self.valid_measurements,
                visual_evidence=[ev_item],
                findings=self.valid_findings,
                limitations_and_risks=self.valid_lims
            )
            # Deve passar com o hash correto
            is_valid, _ = validate_agent_report(rep, verify_files=True)
            self.assertTrue(is_valid)

            # Se o hash for adulterado, deve falhar
            rep["visual_evidence"][0]["sha256"] = "deadbeef00000000000000000000000000000000000000000000000000000000"
            with self.assertRaises(AgentReportError):
                validate_agent_report(rep, verify_files=True)

            # Se o arquivo não existir, deve falhar
            rep["visual_evidence"][0]["file_path"] = "caminho/para/arquivo_fantasma.png"
            with self.assertRaises(AgentReportError):
                validate_agent_report(rep, verify_files=True)

        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


if __name__ == "__main__":
    unittest.main()
