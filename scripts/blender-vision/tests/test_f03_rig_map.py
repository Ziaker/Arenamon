"""Testes unitários para o Mapeamento Anatômico Semântico (F03).

Valida:
1. Rigs humanoides padrão (Mixamo, Gigantic, AlienRig, Z-A, Rigify).
2. Anatomias incompletas e não-bípedes (sem braços, sem cauda, etc.).
3. Nomes de ossos desconhecidos e heurísticas de tokens.
4. Preservação estrita dos nomes originais de ossos.
5. Overrides explícitos com confiança 1.0 e detecção de colisões.
6. Validação contra o schema arenamon.rig-map/1.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from rig_map import (
    METHOD_KNOWN_TEMPLATE,
    METHOD_OVERRIDE,
    METHOD_TOKEN_HEURISTIC,
    STATUS_ABSENT,
    STATUS_AMBIGUOUS,
    STATUS_MAPPED,
    STATUS_UNMAPPED,
    RigMapError,
    build_rig_map,
    resolve_bone_role,
    validate_rig_map,
)


class TestF03RigMap(unittest.TestCase):

    def test_mixamo_rig(self):
        bones = [
            "mixamorig:Hips", "mixamorig:Spine", "mixamorig:Spine1", "mixamorig:Spine2",
            "mixamorig:Neck", "mixamorig:Head",
            "mixamorig:LeftShoulder", "mixamorig:LeftArm", "mixamorig:LeftForeArm", "mixamorig:LeftHand",
            "mixamorig:RightShoulder", "mixamorig:RightArm", "mixamorig:RightForeArm", "mixamorig:RightHand",
            "mixamorig:LeftUpLeg", "mixamorig:LeftLeg", "mixamorig:LeftFoot", "mixamorig:LeftToeBase",
            "mixamorig:RightUpLeg", "mixamorig:RightLeg", "mixamorig:RightFoot", "mixamorig:RightToeBase",
        ]
        res = build_rig_map(bones, rig_id="mixamo_test", armature_name="Armature_Mixamo")
        self.assertEqual(res["detected_template"], "MIXAMO")
        self.assertEqual(res["roles"]["pelvis"]["bone_name"], "mixamorig:Hips")
        self.assertEqual(res["roles"]["pelvis"]["status"], STATUS_MAPPED)
        self.assertEqual(res["roles"]["left_foot"]["bone_name"], "mixamorig:LeftFoot")
        self.assertIsNone(res["roles"]["root"]["bone_name"])
        self.assertEqual(res["roles"]["root"]["status"], STATUS_UNMAPPED)

    def test_gigantic_unreal_rig(self):
        bones = [
            "b_Root", "b_Pelvis", "b_Spine", "b_Spine1", "b_Spine2", "b_Neck", "b_Head",
            "b_LeftClavicle", "b_LeftUpperArm", "b_LeftForeArm", "b_LeftHand",
            "b_RightClavicle", "b_RightUpperArm", "b_RightForeArm", "b_RightHand",
            "b_LeftUpLeg", "b_LeftLeg", "b_LeftFoot", "b_LeftToeBase",
            "b_RightUpLeg", "b_RightLeg", "b_RightFoot", "b_RightToeBase",
            "b_Weapon_R", "b_Pack_01"
        ]
        res = build_rig_map(bones, rig_id="gigantic_wu", armature_name="Armature_Wu")
        self.assertEqual(res["detected_template"], "GIGANTIC_UNREAL")
        self.assertEqual(res["roles"]["root"]["bone_name"], "b_Root")
        self.assertEqual(res["roles"]["pelvis"]["bone_name"], "b_Pelvis")
        self.assertEqual(res["roles"]["left_hand"]["bone_name"], "b_LeftHand")
        self.assertIn("b_Weapon_R", res["unmapped_bones"])
        self.assertIn("b_Pack_01", res["unmapped_bones"])

    def test_alien_rig_eggo(self):
        bones = [
            "Root", "Hips", "Spine", "Spine1", "Head",
            "LeftArm", "LeftForeArm", "LeftHand",
            "RightArm", "RightForeArm", "RightHand",
            "LeftUpLeg", "LeftLeg", "LeftFoot",
            "RightUpLeg", "RightLeg", "RightFoot"
        ]
        res = build_rig_map(
            bones,
            rig_id="eggo_alien",
            armature_name="AlienRig",
            absent_roles=["tail_base", "tail_mid", "tail_tip", "left_wing", "right_wing"]
        )
        self.assertEqual(res["detected_template"], "ALIEN_RIG")
        self.assertEqual(res["roles"]["root"]["bone_name"], "Root")
        self.assertEqual(res["roles"]["pelvis"]["bone_name"], "Hips")
        self.assertEqual(res["roles"]["tail_base"]["status"], STATUS_ABSENT)
        self.assertIsNone(res["roles"]["tail_base"]["bone_name"])

    def test_incomplete_anatomy_mushroom(self):
        """Criatura estilo Cogumelo: tronco + pés, sem braços nem cauda."""
        bones = [
            "Root", "Pelvis", "Spine", "Head",
            "Leg_L", "Foot_L", "Leg_R", "Foot_R", "Hat_Rim"
        ]
        res = build_rig_map(
            bones,
            rig_id="cogumelo",
            absent_roles=["left_upper_arm", "left_forearm", "left_hand",
                         "right_upper_arm", "right_forearm", "right_hand",
                         "tail_base"]
        )
        self.assertEqual(res["roles"]["left_hand"]["status"], STATUS_ABSENT)
        self.assertEqual(res["roles"]["right_hand"]["status"], STATUS_ABSENT)
        self.assertIsNone(res["roles"]["left_hand"]["bone_name"])
        self.assertEqual(res["roles"]["left_foot"]["bone_name"], "Foot_L")

    def test_overrides_priority(self):
        bones = ["root_motion", "hip_master", "custom_head", "custom_foot_l"]
        overrides = {
            "root": "root_motion",
            "pelvis": "hip_master",
            "head": "custom_head"
        }
        res = build_rig_map(bones, rig_id="override_test", overrides=overrides)
        self.assertEqual(res["roles"]["root"]["bone_name"], "root_motion")
        self.assertEqual(res["roles"]["root"]["confidence"], 1.0)
        self.assertEqual(res["roles"]["root"]["method"], METHOD_OVERRIDE)
        self.assertEqual(res["roles"]["pelvis"]["bone_name"], "hip_master")
        self.assertEqual(res["roles"]["head"]["bone_name"], "custom_head")

    def test_bone_collision_rejection(self):
        """Um osso não pode ser atribuído a dois papéis diferentes."""
        doc = {
            "schema": "arenamon.rig-map/1",
            "rig_id": "bad_rig",
            "armature_name": "Arm",
            "detected_template": "CUSTOM",
            "total_bones": 1,
            "roles": {
                "pelvis": {"role": "pelvis", "bone_name": "BoneShared", "status": STATUS_MAPPED, "confidence": 1.0, "method": METHOD_OVERRIDE},
                "head": {"role": "head", "bone_name": "BoneShared", "status": STATUS_MAPPED, "confidence": 1.0, "method": METHOD_OVERRIDE},
            }
        }
        with self.assertRaises(RigMapError):
            validate_rig_map(doc)

    def test_original_names_preserved(self):
        """Garante que nenhum nome de osso seja alterado durante o mapeamento."""
        original = ["B_Root_Special.001", "Pelvis_Custom_X99", "Foot.L.Extra"]
        res = build_rig_map(original, rig_id="preserve_test", overrides={
            "root": "B_Root_Special.001",
            "pelvis": "Pelvis_Custom_X99",
            "left_foot": "Foot.L.Extra"
        })
        self.assertEqual(res["roles"]["root"]["bone_name"], "B_Root_Special.001")
        self.assertEqual(res["roles"]["pelvis"]["bone_name"], "Pelvis_Custom_X99")
        self.assertEqual(res["roles"]["left_foot"]["bone_name"], "Foot.L.Extra")

    def test_resolve_bone_role(self):
        bones = ["mixamorig:Hips", "mixamorig:LeftFoot", "mixamorig:Head"]
        self.assertEqual(resolve_bone_role(bones, "pelvis"), "mixamorig:Hips")
        self.assertEqual(resolve_bone_role(bones, "left_foot"), "mixamorig:LeftFoot")
        self.assertIsNone(resolve_bone_role(bones, "root"))
        self.assertIsNone(resolve_bone_role(bones, "tail_base"))


if __name__ == "__main__":
    unittest.main()
