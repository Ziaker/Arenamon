"""Investida ombrada v2 ("Ombrada Explosiva"): salto-investida com deslocamento real, pose-to-pose, 12 principios, POUCAS chaves.
Importavel no Blender (live ou headless): build(arm, "Ombrada_v02"). NAO insere chave em todo frame.

Sequencia (frames de timeline t, 30 FPS, 48 frames):
  t1  idle                         t8  ANTECIPACAO (agacha e enrola para tras, squash)
  t12 retencao do enrolar (slow-in) t13 DISPARO (stretch, perna de tras empurra)
  t16 VOO em arco (ombro D na frente, braços/pernas para tras, stretch)
  t19 pre-impacto (alcanca com o ombro)   t20 IMPACTO (squash) ... t22 hold de 3 frames
  t26 REBOTE (follow-through: bracos e cauda passam)   t31 DERRAPAGEM/assenta   t40 recupera   t48 idle deslocado
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pose_lib as pl

GZ = 0.145
# F = avanco do quadril (m, para -Y); X de repouso dos pes: idle
POSES = {
    1:  None,
    8:  dict(F=-0.07, dz=-0.13, yaw=-20, lean=-10, tw=-28, sy=0.94, head=(0, 0.95, 0.30), tail=20,
             armR=(-0.40, -0.45, -0.80), armL=((0.35, -0.15, 0.92), (0.0, 0.85, 0.52), (0.0, 0.8, 0.6)),
             L=(0.29, 0.006, GZ), R=(-0.279, 0.011, GZ)),
    12: dict(F=-0.09, dz=-0.15, yaw=-26, lean=-12, tw=-34, sy=0.92, head=(0, 0.94, 0.33), tail=26,
             armR=(-0.45, -0.50, -0.74), armL=((0.35, -0.18, 0.92), (0.0, 0.85, 0.52), (0.0, 0.8, 0.6)),
             L=(0.29, 0.006, GZ), R=(-0.279, 0.011, GZ)),
    13: dict(F=0.18, dz=-0.10, yaw=16, lean=30, tw=18, sy=1.12, head=(0.05, 0.80, 0.60), tail=-6,
             armR=(-0.30, 0.00, -0.95), armL=((0.45, 0.10, 0.88), (0.2, 0.3, 0.93), (0.2, 0.3, 0.93)),
             L=(0.25, -0.12, 0.30), R=(-0.28, 0.20, GZ)),
    16: dict(F=0.85, dz=0.02, yaw=40, lean=62, tw=40, sy=1.16, head=(0.25, 0.45, 0.86), tail=-30,
             armR=(-0.25, 0.20, -0.94), armL=((0.30, 0.15, -0.94), (0.30, 0.15, -0.94), (0.30, 0.15, -0.94)),
             L=(0.20, "F+0.40", 0.55), R=(-0.22, "F+0.50", 0.62)),
    19: dict(F=1.38, dz=-0.07, yaw=50, lean=56, tw=46, sy=1.05, head=(0.30, 0.50, 0.81), tail=-34,
             armR=(-0.28, 0.25, -0.93), armL=((0.55, -0.10, 0.83), (0.4, 0.0, 0.92), (0.4, 0.0, 0.92)),
             L=(0.20, "F-0.10", 0.20), R=(-0.22, "F+0.45", 0.55)),
    20: dict(F=1.48, dz=-0.11, yaw=56, lean=50, tw=50, sy=0.86, head=(0.32, 0.55, 0.77), tail=-24,
             armR=(-0.28, 0.28, -0.92), armL=((0.60, -0.25, 0.76), (0.3, 0.1, 0.95), (0.3, 0.1, 0.95)),
             L=(0.20, "F-0.12", GZ), R=(-0.26, "F+0.40", 0.28)),
    22: dict(F=1.50, dz=-0.12, yaw=57, lean=51, tw=51, sy=0.85, head=(0.32, 0.55, 0.77), tail=-22,
             armR=(-0.28, 0.30, -0.91), armL=((0.62, -0.28, 0.73), (0.3, 0.1, 0.95), (0.3, 0.1, 0.95)),
             L=(0.20, "F-0.12", GZ), R=(-0.26, "F+0.40", 0.28)),
    26: dict(F=1.30, dz=-0.06, yaw=12, lean=14, tw=10, sy=1.06, head=(0.0, 0.92, 0.40), tail=16,
             armR=(0.10, 0.45, 0.89), armL=((0.30, 0.50, 0.81), (0.1, 0.6, 0.8), (0.1, 0.6, 0.8)),
             L=(0.20, "F-0.12", GZ), R=(-0.28, "F+0.30", GZ)),
    31: dict(F=1.30, dz=-0.04, yaw=0, lean=10, tw=3, sy=0.97, head=(0, 0.96, 0.25), tail=4,
             armR=(-0.30, -0.80, 0.52), armL=((0.30, -0.80, 0.52), (0.1, -0.5, 0.86), (0.1, -0.5, 0.86)),
             L=(0.27, "F-0.12", GZ), R=(-0.27, "F+0.06", GZ)),
    40: dict(F=1.33, dz=-0.03, yaw=0, lean=3, tw=0, sy=1.0, head=(0, 1.0, 0.12), tail=0,
             armR=(-0.40, -0.90, 0.10), armL=((0.40, -0.90, 0.10), (0.2, -0.8, 0.3), (0.2, -0.8, 0.3)),
             L=(0.29, "F+0.006", GZ), R=(-0.279, "F+0.011", GZ)),
    48: "IDLE_DESLOCADO",
}
KEYS = [1, 8, 12, 13, 16, 19, 20, 22, 26, 31, 40, 48]
# retempo: o disparo ganha 2 frames de aceleracao (o Motion Lens acusou 'pop' em t13-t14 com 1 frame) e o impacto fica mais ritmado
MAP = {13: 14, 16: 17, 19: 20, 20: 21, 22: 23, 26: 27, 31: 32, 40: 41, 48: 49}


def _y(v, F):
    if isinstance(v, str):
        return -(F) + (-1 if v.startswith("F-") else 1) * float(v[2:]) if v.startswith("F") and v[1] in "+-" else float(v)
    return v


def build(arm, name="Ombrada_v02", only=None):
    sc = bpy.context.scene
    idle = bpy.data.actions["idle"]
    pl.assign(arm, idle)
    sc.frame_set(1)
    IQ = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    IH = pl.pbone(arm, "Hips").location.copy()
    # CORRECAO: a idle tambem anima a LOCALIZACAO de ~34 ossos (Spine, coxas, ombros, cauda...). Sem copiar isso, a pelve ficava torta (coxas deslocadas 16 cm).
    ILOC = {b.name: b.location.copy() for b in arm.pose.bones}
    LOCBONES = sorted({fc.data_path.split('"')[1] for fc in pl.iter_fcurves(idle) if fc.data_path.endswith(".location")})
    FD = {s: pl.seg_dir_world(arm, s + "Foot").copy() for s in ("Left", "Right")}
    TD = {s: pl.seg_dir_world(arm, s + "ToeBase").copy() for s in ("Left", "Right")}
    IFOOT = {s: pl.world_head(arm, s + "Foot").copy() for s in ("Left", "Right")}
    POLE = {s: pl.leg_pole_body(arm, s) for s in ("Left", "Right")}
    if only is not None:                    # corrige UMA pose-chave existente: nao cria acao nem chaves novas
        act = bpy.data.actions[name]
    else:
        old = bpy.data.actions.get(name)
        if old:
            bpy.data.actions.remove(old)
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
    pl.assign(arm, act)
    tails = [n for n in ("Tail1", "Tail2", "Tail3", "Tail4") if pl.pbone(arm, n)]
    spines = ("Spine", "Spine1", "Spine2")

    def reset():
        for b in arm.pose.bones:
            b.rotation_quaternion = IQ[b.name]
            b.scale = (1, 1, 1)
            b.location = ILOC[b.name]
        pl.pbone(arm, "Hips").location = IH
        bpy.context.view_layer.update()

    def key_all(frame):
        for b in arm.pose.bones:
            b.keyframe_insert("rotation_quaternion", frame=frame)
        for nm in LOCBONES:
            arm.pose.bones[nm].keyframe_insert("location", frame=frame)
        pl.pbone(arm, "Hips").keyframe_insert("location", frame=frame)

    def pose(frame, s):
        sc.frame_set(frame)
        reset()
        if s == "IDLE_DESLOCADO":
            pl.set_hips_rel(arm, dz=0.0, dxy=(0.0, -1.35))
            for side in ("Left", "Right"):
                tgt = IFOOT[side] + Vector((0, -1.35, 0))
                pl.ik_leg(arm, side, tgt, POLE[side])
                pl.aim_world(arm, side + "Foot", FD[side]); pl.aim_world(arm, side + "ToeBase", TD[side])
        elif s:
            F = s["F"]
            pl.set_hips_rel(arm, dz=s["dz"], dxy=(0.0, -F), yaw=0.4 * s["yaw"], lean=0.15 * s["lean"])
            for n in ("Spine1", "Spine2"):
                pl.rotate_bone_world(arm, n, (0, 0, 1), 0.5 * s["tw"])
            for n, f in (("Spine", 0.25), ("Spine1", 0.3), ("Spine2", 0.3)):
                pl.rotate_bone_world(arm, n, (1, 0, 0), f * s["lean"])
            for n in ("RightArm", "RightForeArm", "RightHand"):
                pl.aim_fix(arm, n, s["armR"])
            a, f_, h = s["armL"]
            pl.aim_fix(arm, "LeftArm", a); pl.aim_fix(arm, "LeftForeArm", f_); pl.aim_fix(arm, "LeftHand", h)
            for n in ("Neck", "Head"):
                pl.aim_fix(arm, n, s["head"])
            for side, key in (("Left", "L"), ("Right", "R")):
                x, y, z = s[key]
                if isinstance(y, str):
                    y = -F + float(y[1:]) if y[0] == "F" else float(y)
                pl.ik_leg(arm, side, Vector((x, y, z)), POLE[side])
                pl.aim_world(arm, side + "Foot", FD[side]); pl.aim_world(arm, side + "ToeBase", TD[side])
            for n in tails:
                pl.rotate_bone_world(arm, n, (0, 0, 1), s["tail"] / max(1, len(tails)))
            # (sem escala nas vertebras: o Motion Lens mostrou que a escala da coluna era HERDADA por cabeca, bracos e maos; squash/stretch fica na POSE)
        key_all(frame)

    for fr in KEYS:
        if only is not None and MAP.get(fr, fr) != only:
            continue
        pose(MAP.get(fr, fr), POSES[fr])
    if only is not None:
        return act
    pl.set_interp(act, "BEZIER")
    sc.frame_start, sc.frame_end = 1, 49
    sc.frame_set(1)
    return act
