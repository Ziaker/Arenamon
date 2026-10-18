"""Roda no Blender (somente leitura): blender -b X.blend --python pose_dump.py -- ACTION FRAMES_AUTORAIS OFFSET OUT.json

Descreve a pose de cada frame em termos de DIRECAO dos segmentos no espaco do corpo (esquerda, cima, frente), alturas e angulos. Serve para o agente
'ler' a pose em palavras/numeros alem das imagens. Nunca salva o .blend."""
import json
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pose_lib as pl

action, frames, offset, out = sys.argv[sys.argv.index("--") + 1:][:4]
offset = int(offset)
arm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
pl.assign(arm, bpy.data.actions[action])
sc = bpy.context.scene
res = {}
for g in [int(x) for x in frames.split(",")]:
    sc.frame_set(g + offset)
    d = pl.body_dirs(arm)
    foot = {s: round(pl.world_head(arm, s + "Foot").z, 3) for s in ("Left", "Right")}
    hips = pl.world_head(arm, "Hips")
    def ang(a, b, c):
        return round(math.degrees((pl.world_head(arm, a) - pl.world_head(arm, b)).angle(pl.world_head(arm, c) - pl.world_head(arm, b))), 0)
    res[str(g)] = {"dirs_corpo(esq,cima,frente)": d, "z_tornozelo": foot, "z_quadril": round(hips.z, 3),
                   "cotovelo_D": ang("RightArm", "RightForeArm", "RightHand"), "cotovelo_E": ang("LeftArm", "LeftForeArm", "LeftHand"),
                   "joelho_D": ang("RightUpLeg", "RightLeg", "RightFoot"), "joelho_E": ang("LeftUpLeg", "LeftLeg", "LeftFoot")}
json.dump(res, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("VISION_OK pose_dump")
