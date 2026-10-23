"""Aplica poses-chave de Parry no Mushroom a partir de um JSON ou definicao direta.
Roda dentro do Blender:
  blender Cogumelo_work.blend --python scripts/blender-vision/parry_mushroom.py -- poses.json
ou via MCP.
"""
import sys
import os
import json
import math
import bpy
from mathutils import Vector, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import pose_lib as pl

DEFAULT_PARRY_POSES = {
    "action_name": "parry_mosh_v1",
    "base_action": "idle",
    "total_frames": 24, # 0.2s a 120Hz = 24 passos de sim; a 30fps no Blender sao ~6-8 frames ativos ou 24 frames de coreografia completa
    "description": "Parry de combate estilo ZZZ: Recuo com tronco encurvado, bloqueio e impacto potente com braco direito, postura firme e ameacadora.",
    "keyframes": [
        {
            "frame": 1,
            "name": "Antecipação / Encolhimento",
            "desc": "Recuo rapido do tronco, centro de gravidade abaixa, braco direito engatilha para o golpe de defesa.",
            "hips_offset": [0.0, 0.08, -0.05],
            "hips_yaw": -5.0,
            "hips_lean": -10.0,
            "dirs": {
                "RightArm": [-0.3, 0.2, -0.9],
                "RightForeArm": [-0.5, 0.6, -0.6],
                "RightHand": [-0.2, 0.9, -0.4],
                "LeftArm": [0.7, -0.2, 0.6],
                "LeftForeArm": [0.5, 0.5, 0.7],
                "LeftHand": [0.2, 0.8, 0.5],
                "Spine": [0.0, 0.95, -0.3],
                "Neck": [0.0, 0.9, 0.4],
                "Head": [0.0, 0.8, 0.6]
            }
        },
        {
            "frame": 6,
            "name": "Impacto Brutal (Parry)",
            "desc": "Tronco avanca de repente, braco direito estocado a frente como escudo/choque, silhueta solida, punho cerrado.",
            "hips_offset": [0.0, -0.12, -0.02],
            "hips_yaw": 15.0,
            "hips_lean": 12.0,
            "dirs": {
                "RightArm": [-0.1, 0.3, 0.95],
                "RightForeArm": [0.2, 0.7, 0.68],
                "RightHand": [0.1, 0.8, 0.59],
                "LeftArm": [0.8, -0.4, -0.45],
                "LeftForeArm": [0.6, -0.6, -0.52],
                "LeftHand": [0.4, -0.7, -0.59],
                "Spine": [0.0, 0.98, 0.2],
                "Neck": [0.0, 0.95, 0.3],
                "Head": [0.0, 0.7, 0.7]
            }
        },
        {
            "frame": 14,
            "name": "Sustentação de Choque",
            "desc": "Tremor/resistencia na postura de parry absorvendo a forca do oponente.",
            "hips_offset": [0.0, -0.08, -0.03],
            "hips_yaw": 12.0,
            "hips_lean": 10.0,
            "dirs": {
                "RightArm": [-0.15, 0.35, 0.92],
                "RightForeArm": [0.15, 0.75, 0.64],
                "RightHand": [0.1, 0.8, 0.59],
                "LeftArm": [0.75, -0.35, -0.5],
                "LeftForeArm": [0.6, -0.55, -0.57],
                "LeftHand": [0.4, -0.7, -0.59],
                "Spine": [0.0, 0.97, 0.24],
                "Head": [0.0, 0.75, 0.66]
            }
        },
        {
            "frame": 24,
            "name": "Postura Ameaçadora (Pronto)",
            "desc": "Retorno rapido para base agressiva pronta para contra-ataque.",
            "hips_offset": [0.0, -0.02, 0.0],
            "hips_yaw": 5.0,
            "hips_lean": 2.0,
            "dirs": {
                "RightArm": [-0.4, -0.4, 0.82],
                "RightForeArm": [-0.2, 0.5, 0.84],
                "RightHand": [-0.1, 0.7, 0.7],
                "LeftArm": [0.5, -0.4, 0.77],
                "LeftForeArm": [0.3, 0.4, 0.86],
                "LeftHand": [0.1, 0.7, 0.7],
                "Spine": [0.0, 0.98, 0.17],
                "Head": [0.0, 0.7, 0.7]
            }
        }
    ]
}

def apply_parry(arm, spec):
    action_name = spec.get("action_name", "parry_mosh_v1")
    base_action = spec.get("base_action", "idle")
    
    # Se ja existe a action com esse nome, cria uma copia ou recria
    if action_name in bpy.data.actions:
        act = bpy.data.actions[action_name]
    else:
        act = pl.duplicate_action(base_action, action_name)
    
    pl.assign(arm, act)
    
    # Limpa fcurves para criar as poses limpas
    if hasattr(act, "layers"):
        for l in list(act.layers):
            act.layers.remove(l)
    elif hasattr(act, "fcurves"):
        for fc in list(act.fcurves):
            act.fcurves.remove(fc)
            
    sc = bpy.context.scene
    sc.frame_start = 1
    sc.frame_end = spec.get("total_frames", 24)
    
    # Pega base da idle
    idle = bpy.data.actions.get(base_action)
    pl.assign(arm, idle)
    sc.frame_set(1)
    q_idle = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    h_idle = pl.pbone(arm, "Hips").location.copy()
    pl.assign(arm, act)
    
    for kf in spec.get("keyframes", []):
        f = kf["frame"]
        sc.frame_set(f)
        
        # Hips
        hp = pl.pbone(arm, "Hips")
        dxyz = kf.get("hips_offset", [0, 0, 0])
        hp.location = h_idle + Vector(dxyz)
        
        yaw = kf.get("hips_yaw", 0.0)
        lean = kf.get("hips_lean", 0.0)
        R_yaw = Quaternion((0, 0, 1), math.radians(yaw))
        R_lean = Quaternion((1, 0, 0), math.radians(lean))
        hp.rotation_quaternion = R_yaw @ R_lean @ q_idle.get("mixamorig:Hips", hp.rotation_quaternion)
        
        # Dirs
        for bone_name, d in kf.get("dirs", {}).items():
            pl.aim(arm, bone_name, tuple(d))
            
        # Keyframe
        pl.key(arm, ["Hips"], f, props=("rotation_quaternion", "location"))
        bones_to_key = list(kf.get("dirs", {}).keys())
        pl.key(arm, bones_to_key, f)
        
    pl.set_interp(act, "BEZIER")
    print(f"Parry aplicado com sucesso: {action_name} ({len(spec.get('keyframes', []))} poses)")
    return act

if __name__ == "__main__":
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    spec = DEFAULT_PARRY_POSES
    if len(sys.argv) > 1 and sys.argv[-1].endswith(".json"):
        with open(sys.argv[-1], "r", encoding="utf-8") as fp:
            spec = json.load(fp)
    apply_parry(arm, spec)
