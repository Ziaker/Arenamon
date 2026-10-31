"""Homologação prática de F03 + F15 com assets reais do Arenamon, Gigantic e Pokémon Z-A.

Critério de aceitação e conformidade estrita:
1. Extração da lista real de ossos diretamente dos arquivos (.blend via Blender headless).
2. Nomenclatura 100% autêntica sem listas sintéticas (ex: b_Bicep_L de Gigantic, origin/waist/left_arm_a de Z-A, Root de AlienRig).
3. Mapeamento de papéis anatômicos funcionais reais via F03 (build_rig_map).
4. Medição de parâmetros reais de Actions verdadeiras (deslocamento real de raiz, tempo e FPS).
5. Geração de relatórios F15 completos (arenamon.agent-report/1) com taxonomia epistêmica e validação profunda.
6. Validação estrita dos relatórios contra evidências físicas reais existentes no disco (hashes SHA-256 e verify_files=True).
"""
import json
import os
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agent_report import (
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

BLENDER_BIN = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
GIGAS_DIR = r"C:\Users\zerke\Downloads\gigas"
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


class TestF03F15RealAssets(unittest.TestCase):

    def setUp(self):
        self.has_blender = os.path.isfile(BLENDER_BIN)
        self.pakko_blend = os.path.join(GIGAS_DIR, "pakko", "Pakko_Animations.blend")
        self.eggo_dodge_blend = os.path.join(REPO_ROOT, "chars", "Eggo", "eggo dodge lateral v1.blend")
        self.za_blend = os.path.join(REPO_ROOT, "dumper test", "blender", "pm0867_00_00.blend")
        self.za_data_path = os.path.join(REPO_ROOT, "docs", "za-referencias", "paridade_fk_2026-10-25.json")

    def test_real_gigantic_pakko_action_and_evidence(self):
        """Homologação real: Pakko (Gigantic) - extração de ossos, Skill_RushAttack e folha PNG real."""
        if not self.has_blender or not os.path.isfile(self.pakko_blend):
            self.skipTest("Blender ou Pakko_Animations.blend não disponível localmente.")

        # Script inline para extrair dados reais da Action Skill_RushAttack de Pakko via Blender 5.2.2 (Channelbags)
        py_extract = (
            "import bpy, json\n"
            "arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]\n"
            "bone_names = [b.name for b in arm.data.bones]\n"
            "action = bpy.data.actions.get('Skill_RushAttack')\n"
            "fps = float(bpy.context.scene.render.fps)\n"
            "f_start, f_end = int(action.frame_range[0]), int(action.frame_range[1])\n"
            "# Acessa fcurves via Channelbag do Blender 5.2 Slotted Action System\n"
            "slot = action.slots[0] if action.slots else None\n"
            "cb = action.layers[0].strips[0].channelbag(slot) if slot else None\n"
            "fcurves = cb.fcurves if cb else getattr(action, 'fcurves', [])\n"
            "root_fc = [fc for fc in fcurves if 'pose.bones[\"b_Root\"].location' in fc.data_path and fc.array_index == 2]\n"
            "disp_cm = 0.0\n"
            "if root_fc:\n"
            "    kps = root_fc[0].keyframe_points\n"
            "    disp_cm = kps[-1].co[1] - kps[0].co[1]\n"
            "res = {\n"
            "    'armature': arm.name,\n"
            "    'bones': bone_names,\n"
            "    'action_name': action.name,\n"
            "    'frame_range': [f_start, f_end],\n"
            "    'fps': fps,\n"
            "    'root_disp_cm': round(float(disp_cm), 2)\n"
            "}\n"
            "print('__EXTRACTION_JSON__' + json.dumps(res))\n"
        )

        cmd = [BLENDER_BIN, "-b", self.pakko_blend, "--python-expr", py_extract]
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)

        token = "__EXTRACTION_JSON__"
        self.assertIn(token, proc.stdout)
        json_line = [l for l in proc.stdout.splitlines() if token in l][0].replace(token, "")
        real_data = json.loads(json_line)

        # 1. F03: Mapeamento semântico real dos ossos de Pakko com nomenclatura autêntica da Unreal
        rig_map = build_rig_map(
            bone_names=real_data["bones"],
            rig_id="pakko_real",
            armature_name=real_data["armature"],
            absent_roles=["left_wing", "right_wing"]
        )
        self.assertEqual(rig_map["detected_template"], "GIGANTIC_UNREAL")
        self.assertEqual(rig_map["roles"]["root"]["bone_name"], "b_Root")
        self.assertEqual(rig_map["roles"]["pelvis"]["bone_name"], "b_Pelvis")
        self.assertEqual(rig_map["roles"]["left_upper_arm"]["bone_name"], "b_Bicep_L")
        self.assertEqual(rig_map["roles"]["left_forearm"]["bone_name"], "b_Elbow_L")
        self.assertEqual(rig_map["roles"]["left_hand"]["bone_name"], "b_Wrist_L")
        self.assertEqual(rig_map["roles"]["left_foot"]["bone_name"], "b_Ankle_L")

        # 2. Medição real: deslocamento de raiz em Skill_RushAttack (na Unreal escala é cm)
        disp_m = round(real_data["root_disp_cm"] / 100.0, 3)
        self.assertAlmostEqual(disp_m, 4.00, places=1)  # Skill_RushAttack de Pakko = 400.0 cm

        # 3. Evidência real existente no repositório
        real_png_path = os.path.join(REPO_ROOT, "prototypes", "combat-lab", "evidence", "gigantic", "p2", "GIG-P1-PAKKO-Skill_RushAttack-FRONT.png")
        self.assertTrue(os.path.isfile(real_png_path))
        real_sha256 = compute_file_sha256(real_png_path)

        # 4. F15: Construção e validação estrita do relatório com verify_files=True
        f_start, f_end = real_data["frame_range"]
        report = build_agent_report(
            report_id="REP-REAL-GIGANTIC-PAKKO-RUSH",
            target={
                "source_file": self.pakko_blend,
                "action_name": real_data["action_name"],
                "action_slot": None,
                "armature_name": real_data["armature"],
                "frame_range": [f_start, f_end],
                "fps": real_data["fps"],
                "unit_system": "UNREAL_CENTIMETERS"
            },
            rig_mapping=rig_map,
            measurements=[
                {
                    "metric": "root_displacement_meters",
                    "value": disp_m,
                    "unit": "m",
                    "method": "fcurve_endpoints_evaluation",
                    "confidence": 1.0,
                    "target_role": "root",
                    "target_bone": "b_Root"
                }
            ],
            visual_evidence=[
                {
                    "evidence_id": "GIG-P1-PAKKO-Skill_RushAttack-FRONT",
                    "file_path": real_png_path,
                    "sha256": real_sha256,
                    "view_type": "FRONT",
                    "frames_shown": [0, 5, 10, 15, 20],
                    "reading_token": "GIGP1",
                    "verified_exists": True
                }
            ],
            findings={
                "facts": [
                    f"O osso de raiz 'b_Root' translada exatamente {disp_m} m ao longo do percurso.",
                    f"A Action possui {f_end - f_start + 1} frames executados a {real_data['fps']} FPS."
                ],
                "observations": [
                    "A folha frontal confirma que a investida projeta o tronco para a frente em velocidade maxima."
                ],
                "inferences": [
                    "O deslocamento de 4.0 m cobre a distancia padrao de investida ofensiva no combate."
                ],
                "hypotheses": [
                    "O avanco frontal substitui a necessidade de esquiva evasiva direta para a frente."
                ]
            },
            limitations_and_risks={
                "missing_data": ["Action Slot nao existente no formato .blend 2.8x herdado"],
                "assumptions": ["Massa corporal do Pakko considerada como pesada (>100 kg)"],
                "risks": ["Reduzir o deslocamento prejudicara o alcance de engajamento do golpe"],
                "confidence_score": 0.98
            }
        )

        is_valid, errors = validate_agent_report(report, verify_files=True)
        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)

    def test_real_arenamon_eggo_dodge(self):
        """Homologação real: Eggo (Arenamon) - extração de ossos de AlienRig, medição de Dodge Right 1 e folha real."""
        if not self.has_blender or not os.path.isfile(self.eggo_dodge_blend):
            self.skipTest("Blender ou eggo dodge lateral v1.blend não disponível localmente.")

        py_extract = (
            "import bpy, json\n"
            "arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]\n"
            "bone_names = [b.name for b in arm.data.bones]\n"
            "action = bpy.data.actions.get('Dodge Right 1')\n"
            "fps = float(bpy.context.scene.render.fps)\n"
            "f_start, f_end = int(action.frame_range[0]), int(action.frame_range[1])\n"
            "slot = action.slots[0] if action.slots else None\n"
            "cb = action.layers[0].strips[0].channelbag(slot) if slot else None\n"
            "fcs = cb.fcurves if cb else getattr(action, 'fcurves', [])\n"
            "fc_x = [fc for fc in fcs if 'pose.bones[\"Root\"].location' in fc.data_path and fc.array_index == 0][0]\n"
            "disp_x = abs(fc_x.keyframe_points[-1].co[1] - fc_x.keyframe_points[0].co[1])\n"
            "res = {\n"
            "    'armature': arm.name,\n"
            "    'bones': bone_names,\n"
            "    'action_name': action.name,\n"
            "    'frame_range': [f_start, f_end],\n"
            "    'fps': fps,\n"
            "    'root_disp_m': round(float(disp_x), 3)\n"
            "}\n"
            "print('__EXTRACTION_JSON__' + json.dumps(res))\n"
        )

        cmd = [BLENDER_BIN, "-b", self.eggo_dodge_blend, "--python-expr", py_extract]
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)

        token = "__EXTRACTION_JSON__"
        self.assertIn(token, proc.stdout)
        json_line = [l for l in proc.stdout.splitlines() if token in l][0].replace(token, "")
        real_data = json.loads(json_line)

        # Mapeamento com F03 dos ossos reais de AlienRig
        rig_map = build_rig_map(
            bone_names=real_data["bones"],
            rig_id="eggo_alien_rig_real",
            armature_name=real_data["armature"],
            absent_roles=["tail_base", "left_wing", "right_wing"]
        )
        self.assertEqual(rig_map["detected_template"], "ALIEN_RIG")
        self.assertEqual(rig_map["roles"]["root"]["bone_name"], "Root")
        self.assertEqual(rig_map["roles"]["pelvis"]["bone_name"], "Hips")
        self.assertEqual(rig_map["roles"]["left_upper_arm"]["bone_name"], "LeftArm")
        self.assertEqual(rig_map["roles"]["left_foot"]["bone_name"], "LeftFoot")

        # Medição de esquiva lateral real
        disp_m = real_data["root_disp_m"]
        self.assertAlmostEqual(disp_m, 2.30, places=2)

        # Evidência PNG real existente no repositório
        real_png_path = os.path.join(REPO_ROOT, "scripts", "blender-vision", "evidence", "eggo_dodge_lateral", "shot_Dodge_Left_1", "front_contact_t001_g001.png")
        self.assertTrue(os.path.isfile(real_png_path))
        real_sha256 = compute_file_sha256(real_png_path)

        # Relatório F15 com validação estrita de arquivos
        f_start, f_end = real_data["frame_range"]
        report = build_agent_report(
            report_id="REP-REAL-ARENAMON-EGGO-DODGE",
            target={
                "source_file": self.eggo_dodge_blend,
                "action_name": real_data["action_name"],
                "action_slot": None,
                "armature_name": real_data["armature"],
                "frame_range": [f_start, f_end],
                "fps": real_data["fps"],
                "unit_system": "METRIC_METERS"
            },
            rig_mapping=rig_map,
            measurements=[
                {
                    "metric": "root_motion_displacement_x",
                    "value": disp_m,
                    "unit": "m",
                    "method": "fcurve_endpoints_evaluation",
                    "confidence": 1.0,
                    "target_role": "root",
                    "target_bone": "Root"
                }
            ],
            visual_evidence=[
                {
                    "evidence_id": "EGGO-DODGE-CONTACT-SHEET",
                    "file_path": real_png_path,
                    "sha256": real_sha256,
                    "view_type": "FRONT",
                    "frames_shown": [1, 10, 20, 30],
                    "reading_token": "EGGO_DODGE",
                    "verified_exists": True
                }
            ],
            findings={
                "facts": [
                    f"O armature '{real_data['armature']}' possui {len(real_data['bones'])} ossos reais.",
                    f"A esquiva 'Dodge Right 1' translada o osso Root lateralmente por {disp_m} m em {f_end - f_start + 1} frames."
                ],
                "observations": ["A postura base do Eggo mantem a inclinacao corporal acompanhando a esquiva."],
                "inferences": ["O deslocamento de 2.30 m fornece janela evasiva limpa contra ataques frontais."],
                "hypotheses": ["Aceleracao maxima ocorre entre os frames 6 e 14 da animacao."]
            },
            limitations_and_risks={
                "missing_data": ["Dedos das maos ausentes na malha basica"],
                "assumptions": ["Massa corporal do Eggo considerada leve"],
                "risks": ["Interrupcao precoce pode encurtar o deslocamento evasivo"],
                "confidence_score": 0.95
            }
        )

        is_valid, errors = validate_agent_report(report, verify_files=True)
        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)

    def test_real_pokemon_za_corpus_and_blend_data(self):
        """Homologação real: Pokémon Z-A - extração de ossos reais de pm0867_00_00.blend via Blender headless e dados do benchmark."""
        if not self.has_blender or not os.path.isfile(self.za_blend) or not os.path.isfile(self.za_data_path):
            self.skipTest("Blender, pm0867_00_00.blend ou paridade_fk_2026-10-25.json indisponível localmente.")

        # 1. Extração direta dos ossos reais de Golisopod via Blender headless
        py_extract = (
            "import bpy, json\n"
            "arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]\n"
            "bone_names = [b.name for b in arm.data.bones]\n"
            "res = {'armature': arm.name, 'bones': bone_names}\n"
            "print('__EXTRACTION_JSON__' + json.dumps(res))\n"
        )
        cmd = [BLENDER_BIN, "-b", self.za_blend, "--python-expr", py_extract]
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)

        token = "__EXTRACTION_JSON__"
        self.assertIn(token, proc.stdout)
        json_line = [l for l in proc.stdout.splitlines() if token in l][0].replace(token, "")
        real_data = json.loads(json_line)

        # Confirma contagem de 75 ossos reais do arquivo de dump oficial
        self.assertEqual(len(real_data["bones"]), 75)
        self.assertIn("origin", real_data["bones"])
        self.assertIn("waist", real_data["bones"])
        self.assertIn("spine_01", real_data["bones"])
        self.assertIn("left_arm_a", real_data["bones"])
        self.assertIn("head", real_data["bones"])

        # 2. Mapeamento F03 com template POKEMON_ZA
        rig_map = build_rig_map(
            bone_names=real_data["bones"],
            rig_id="golisopod_pm0867_real",
            armature_name=real_data["armature"],
            absent_roles=["left_wing", "right_wing"]
        )
        self.assertEqual(rig_map["detected_template"], "POKEMON_ZA")
        self.assertEqual(rig_map["roles"]["root"]["bone_name"], "origin")
        self.assertEqual(rig_map["roles"]["pelvis"]["bone_name"], "waist")
        self.assertEqual(rig_map["roles"]["spine_lower"]["bone_name"], "spine_01")
        self.assertEqual(rig_map["roles"]["head"]["bone_name"], "head")
        self.assertEqual(rig_map["roles"]["jaw"]["bone_name"], "jaw")
        self.assertEqual(rig_map["roles"]["left_upper_arm"]["bone_name"], "left_arm_a")
        self.assertEqual(rig_map["roles"]["right_upper_arm"]["bone_name"], "right_arm_a")
        self.assertEqual(rig_map["roles"]["left_foot"]["bone_name"], "left_foot")
        self.assertEqual(rig_map["roles"]["right_foot"]["bone_name"], "right_foot")

        # 3. Leitura dos dados reais do benchmark de cinemática FK oficial
        with open(self.za_data_path, "r", encoding="utf-8") as f:
            za_doc = json.load(f)
        goli_res = [r for r in za_doc["resultados"] if "pm0867" in r["modelo"]][0]

        # Altura e erro factual do benchmark oficial
        self.assertAlmostEqual(goli_res["altura_m"], 1.442, places=3)
        self.assertAlmostEqual(goli_res["erro_max_rel_H"], 0.000005, places=6)

        # 4. Evidência PNG real do repositório
        real_png_path = os.path.join(REPO_ROOT, "dumper test", "za-referencias", "folhas", "folha_pm0867_00_00_00400_attack01_q3_frente_D_e12.png")
        self.assertTrue(os.path.isfile(real_png_path))
        real_sha256 = compute_file_sha256(real_png_path)

        # 5. Montagem e validação do relatório F15 completo com verify_files=True
        report = build_agent_report(
            report_id=f"REP-REAL-ZA-{goli_res['modelo']}",
            target={
                "source_file": self.za_blend,
                "action_name": goli_res["clipe"],
                "action_slot": None,
                "armature_name": real_data["armature"],
                "frame_range": [0, goli_res["quadros"] - 1],
                "fps": 30.0,
                "unit_system": "METRIC_METERS"
            },
            rig_mapping=rig_map,
            measurements=[
                {
                    "metric": "erro_maximo_fk_relativo_altura",
                    "value": goli_res["erro_max_rel_H"],
                    "unit": "%H",
                    "method": "fk_blender_vs_decoder_parity",
                    "confidence": 1.0,
                    "target_role": "pelvis",
                    "target_bone": "waist"
                },
                {
                    "metric": "altura_modelo_metros",
                    "value": goli_res["altura_m"],
                    "unit": "m",
                    "method": "bounding_box_height",
                    "confidence": 1.0,
                    "target_role": "root",
                    "target_bone": "origin"
                }
            ],
            visual_evidence=[
                {
                    "evidence_id": "ZA-FOLHA-GOLISOPOD-ATTACK01",
                    "file_path": real_png_path,
                    "sha256": real_sha256,
                    "view_type": "FRONT",
                    "frames_shown": [0, 20, 40, 60, 80, 100, 120],
                    "reading_token": "ZA_GOLI",
                    "verified_exists": True
                }
            ],
            findings={
                "facts": [
                    f"O armature extraido de pm0867_00_00.blend possui {len(real_data['bones'])} ossos reais.",
                    f"O erro maximo de cinemática direta FK e de apenas {goli_res['erro_max_rel_H']}% da altura H.",
                    f"A altura factual medida do espécime e de exatamente {goli_res['altura_m']} m."
                ],
                "observations": ["A paridade de cinemática direta atende plenamente as tolerâncias sub-milimetricas."],
                "inferences": ["A compensacao de escala de pais em trskl explica a precisao sub-milimetrica na malha de 75 ossos."],
                "hypotheses": ["Rigs com multiplicidade de apêndices como Golisopod mantêm estabilidade angular via raiz 'origin'."]
            },
            limitations_and_risks={
                "missing_data": ["Sem canais faciais no trskl basico"],
                "assumptions": ["Modelo em escala 1.0"],
                "risks": ["Interpolar linearmente afasta ate 0.6% de Bezier"],
                "confidence_score": 0.99
            }
        )

        is_valid, errors = validate_agent_report(report, verify_files=True)
        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)


if __name__ == "__main__":
    unittest.main()
