"""Investida ombrada do Vigoroth (pose-to-pose, 12 principios). Roda no Blender SEM salvar a origem:
   blender -b chars/vigor/Vigoroth_tackle_v1.blend --python make_ombrada.py -- SAIDA.blend
POUCAS chaves (so nas poses-chave), Bezier entre elas. Rig, malha e rest pose intactos."""
import bpy, sys, os, math, json
from mathutils import Vector, Quaternion

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pose_lib as pl

OUT = sys.argv[-1]
if os.path.exists(OUT):
    raise SystemExit("destino ja existe: " + OUT)
arm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
sc = bpy.context.scene
sc.render.fps = 30
idle = bpy.data.actions["idle"]
pl.assign(arm, idle)
sc.frame_set(1)
IQ = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
IH = pl.pbone(arm, "Hips").location.copy()
FDIR = {s: pl.seg_dir_world(arm, s + "Foot").copy() for s in ("Left", "Right")}
TDIR = {s: pl.seg_dir_world(arm, s + "ToeBase").copy() for s in ("Left", "Right")}
IFOOT = {s: pl.world_head(arm, s + "Foot").copy() for s in ("Left", "Right")}
POLE = {s: pl.leg_pole_body(arm, s) for s in ("Left", "Right")}
act = bpy.data.actions.new("Ombrada_v01")
act.use_fake_user = True
pl.assign(arm, act)
TAILS = [n for n in ("Tail1", "Tail2", "Tail3", "Tail4") if pl.pbone(arm, n)]
SPINES = ("Spine", "Spine1", "Spine2")
GZ = 0.145

# ---------------------------------------------------------------- poses-chave (principios entre parenteses)
# dz/dy: quadril (m; dy>0 = para a FRENTE); yaw>0 gira para a ESQUERDA (ombro D avanca); lean>0 inclina a frente; tw = torcao da coluna
POSES = {
    1:  dict(),   # idle de partida
    6:  dict(dz=-0.12, dy=-0.08, yaw=-18, lean=-9, tw=-26, sy=0.95, head=(0, 0.96, 0.28), tail=18,        # ANTECIPACAO + squash: agacha e enrola para tras
             armR=(-0.38, -0.45, -0.81), armL=((0.35, -0.15, 0.92), (0.0, 0.85, 0.52), (0.0, 0.8, 0.6)), fL=(0.29, 0.006), fR=(-0.279, 0.011)),
    9:  dict(dz=-0.14, dy=-0.10, yaw=-24, lean=-11, tw=-32, sy=0.93, head=(0, 0.95, 0.31), tail=24,       # pico do enrolar (slow-in: quase parado)
             armR=(-0.42, -0.50, -0.76), armL=((0.35, -0.18, 0.92), (0.0, 0.85, 0.52), (0.0, 0.8, 0.6)), fL=(0.29, 0.006), fR=(-0.279, 0.011)),
    10: dict(dz=-0.15, dy=0.08, yaw=2, lean=18, tw=4, sy=1.06, head=(0.0, 0.88, 0.47), tail=4, air=0.03,
             armR=(-0.35, -0.10, -0.93), armL=((0.45, 0.10, 0.88), (0.2, 0.3, 0.93), (0.2, 0.3, 0.93)), fL=(0.26, -0.10), fR=(-0.28, 0.10)),
    11: dict(dz=-0.12, dy=0.16, yaw=20, lean=32, tw=24, sy=1.12, head=(0.05, 0.75, 0.66), tail=-8,       # DISPARO + stretch: o corpo se estica para a frente
             armR=(-0.30, 0.05, -0.95), armL=((0.50, 0.25, 0.83), (0.2, 0.3, 0.93), (0.2, 0.3, 0.93)), fL=(0.22, -0.20), fR=(-0.30, 0.20)),
    14: dict(dz=-0.13, dy=0.30, yaw=52, lean=44, tw=46, sy=0.92, head=(0.30, 0.55, 0.78), tail=-26,      # IMPACTO: ombro D a frente, cabeca baixa, squash
             armR=(-0.28, 0.25, -0.93), armL=((0.60, -0.25, 0.76), (0.3, 0.1, 0.95), (0.3, 0.1, 0.95)), fL=(0.22, -0.28), fR=(-0.30, 0.25)),
    16: dict(dz=-0.14, dy=0.34, yaw=54, lean=47, tw=48, sy=0.90, head=(0.30, 0.52, 0.80), tail=-22,      # HOLD de impacto (2 frames) com leve overshoot
             armR=(-0.25, 0.30, -0.92), armL=((0.62, -0.28, 0.74), (0.3, 0.1, 0.95), (0.3, 0.1, 0.95)), fL=(0.22, -0.28), fR=(-0.30, 0.25)),
    20: dict(dz=-0.12, dy=0.16, yaw=16, lean=28, tw=14, sy=1.04, head=(0.05, 0.85, 0.50), tail=12,       # REBOTE / follow-through (braco D passa pela frente, cauda ao contrario)
             armR=(0.15, 0.05, 0.99), armL=((0.40, -0.40, 0.82), (0.1, 0.5, 0.86), (0.1, 0.5, 0.86)), fL=(0.22, -0.28), fR=(-0.30, 0.25)),
    23: dict(dz=-0.07, dy=0.08, yaw=8, lean=15, tw=6, sy=1.0, head=(0.0, 0.95, 0.30), tail=6, air=0.07,     # PULINHO de recuperacao (ambos os pes no ar)
             armR=(-0.20, -0.30, 0.93), armL=((0.30, -0.45, 0.84), (0.1, 0.4, 0.9), (0.1, 0.4, 0.9)), fL=(0.26, -0.12), fR=(-0.29, 0.12)),
    26: dict(dz=-0.05, dy=0.03, yaw=3, lean=8, tw=2, sy=0.98, head=(0.0, 0.97, 0.2), tail=0,           # re-apoio, respiro
             armR=(-0.30, -0.80, 0.52), armL=((0.30, -0.80, 0.52), (0.1, -0.5, 0.86), (0.1, -0.5, 0.86)), fL=(0.29, 0.006), fR=(-0.279, 0.011)),
    34: dict(dz=-0.01, dy=0.0, yaw=0, lean=2, tw=0, sy=1.0, head=(0, 1.0, 0.1), tail=0,                 # quase idle
             armR=(-0.40, -0.90, 0.10), armL=((0.40, -0.90, 0.10), (0.2, -0.8, 0.3), (0.2, -0.8, 0.3)), fL=(0.29, 0.006), fR=(-0.279, 0.011)),
    40: dict(),   # idle
}


def reset_to_idle():
    for b in arm.pose.bones:
        b.rotation_quaternion = IQ[b.name]
        b.scale = (1, 1, 1)
    pl.pbone(arm, "Hips").location = IH
    bpy.context.view_layer.update()


def build(frame, s):
    sc.frame_set(frame)
    reset_to_idle()
    if s:
        pl.set_hips_rel(arm, dz=s["dz"], dxy=(0.0, -s["dy"]), yaw=0.4 * s["yaw"], lean=0.15 * s["lean"])
        for n in ("Spine1", "Spine2"):
            pl.rotate_bone_world(arm, n, (0, 0, 1), 0.5 * s["tw"] + (0.0))
        for n, f in (("Spine", 0.25), ("Spine1", 0.3), ("Spine2", 0.3)):
            pl.rotate_bone_world(arm, n, (1, 0, 0), f * s["lean"])
        rd = s["armR"]
        for n in ("RightArm", "RightForeArm", "RightHand"):
            pl.aim_fix(arm, n, rd)
        a, f_, h = s["armL"]
        pl.aim_fix(arm, "LeftArm", a); pl.aim_fix(arm, "LeftForeArm", f_); pl.aim_fix(arm, "LeftHand", h)
        hd = s["head"]
        pl.aim_fix(arm, "Neck", hd); pl.aim_fix(arm, "Head", hd)
        air = s.get("air", 0.0)
        for side, (x, y) in (("Left", s["fL"]), ("Right", s["fR"])):
            pl.ik_leg(arm, side, Vector((x, y, GZ + air)), POLE[side])
        for side in ("Left", "Right"):
            pl.aim_world(arm, side + "Foot", FDIR[side]); pl.aim_world(arm, side + "ToeBase", TDIR[side])
        for n in TAILS:
            pl.rotate_bone_world(arm, n, (0, 0, 1), s["tail"] / max(1, len(TAILS)))
        for n in SPINES:
            pl.pbone(arm, n).scale = (1.0 / math.sqrt(s["sy"]), s["sy"], 1.0 / math.sqrt(s["sy"]))     # squash & stretch (volume ~constante)
    for b in arm.pose.bones:
        b.keyframe_insert("rotation_quaternion", frame=frame)
    pl.pbone(arm, "Hips").keyframe_insert("location", frame=frame)
    for n in SPINES:
        pl.pbone(arm, n).keyframe_insert("scale", frame=frame)


for fr, spec in POSES.items():
    build(fr, spec)
pl.set_interp(act, "BEZIER")
# o impacto (14 -> 16) e UM HOLD: chaves quase iguais; mantem Bezier mas os valores mal mudam
sc.frame_start, sc.frame_end = 1, 40
sc.frame_set(1)
nkeys = {}
for fc in pl.iter_fcurves(act):
    nkeys[len(fc.keyframe_points)] = nkeys.get(len(fc.keyframe_points), 0) + 1
print("CHAVES por canal:", nkeys, "| frames-chave:", sorted(POSES))
bpy.ops.wm.save_as_mainfile(filepath=OUT, copy=True)
print("VISION_OK ombrada")
