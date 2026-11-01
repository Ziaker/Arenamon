# Sprint 1 v7: bracos em onda continua acompanhando o corpo, construida sobre a v5 (chars/Eggo/eggo sprint v5.blend)
# usando a mudanca que o responsavel fez no f5 (D1) e o espelho dela (D2, segunda pisada) como pico.
# Pose do braco = v5 * D1^a1(f) * D2^a2(f). Com a1(5)=1 e a2(5)=0 o f5 dele fica identico.
# + braco abre ~5 graus para o lado oposto ao tombo (contrapeso) e a mao atrasa ~2 frames (arrasto).
import bpy, math
from mathutils import Quaternion, Matrix, Vector

V5 = r"C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon\chars\Eggo\eggo sprint v5.blend"
USER = r"C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon\chars\Eggo\eggo sprint v5 com f5 do usuario.blend"
F = 32
ROLL = 5.0
COUNTER = 1.0       # contrapeso: fracao do tombo que o braco abre para o lado oposto
HAND_LAG = 12.0     # graus de dobra da mao por unidade de variacao da onda em 2 frames
# onda da 1a pisada nos frames-chave (2a pisada = mesma onda deslocada 16 frames, com o espelho)
A1 = {1: -0.25, 3: 0.2, 5: 1.0, 7: 0.9, 11: 0.4, 13: 0.05, 15: -0.15, 17: -0.25, 19: 0.0, 21: 0.0, 23: 0.0,
      27: 0.0, 29: -0.05, 31: -0.15, 33: -0.25}
EDIT = ['LeftArm', 'LeftForeArm', 'RightShoulder', 'RightArm', 'RightForeArm']
ARMB = ['LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm']
sw = lambda n: n.replace('Left', '#').replace('Right', 'Left').replace('#', 'Right')
mir = lambda d: Quaternion((d.w, d.x, -d.y, -d.z))


def fcs(a):
    return {(c.data_path, c.array_index): c for l in a.layers for st in l.strips for cb in st.channelbags for c in cb.fcurves}


def q(m, bn, f):
    return Quaternion([m[('pose.bones["%s"].rotation_quaternion' % bn, i)].evaluate(f) for i in range(4)])


def qpow(d, t):
    ax, an = d.to_axis_angle()
    return Quaternion(ax, an * t) if an > 1e-9 else Quaternion()


def lin(tab, f):
    ks = sorted(tab)
    f = (f - 1) % F + 1
    for a, b in zip(ks, ks[1:]):
        if a <= f <= b: return tab[a] + (tab[b] - tab[a]) * (f - a) / (b - a)
    return tab[ks[-1]]


def a1(f): return lin(A1, f)
def a2(f): return lin(A1, f - 16)


def load(path, tag):
    with bpy.data.libraries.load(path, link=True) as (src, dst): dst.actions = ['Sprint 1']
    return dst.actions[0]


cur = bpy.data.actions['Sprint 1']
ref = load(V5, 'v5'); usr = load(USER, 'usr')
A = fcs(cur); B = fcs(ref); U = fcs(usr)
D1 = {bn: q(B, bn, 5).inverted() @ q(U, bn, 5) for bn in EDIT}
D2 = {sw(bn): mir(d) for bn, d in D1.items()}
KEYS = sorted({int(k.co[0]) for k in A[('pose.bones["LeftArm"].rotation_quaternion', 0)].keyframe_points})


def write(bn, f, qn):
    pq = q(A, bn, f)
    if pq.dot(qn) < 0: qn = -qn
    for i in range(4):
        c = A[('pose.bones["%s"].rotation_quaternion' % bn, i)]
        k = [k for k in c.keyframe_points if abs(k.co[0] - f) < 1e-3][0]; k.co[1] = qn[i]


# 1) onda nos ombros/bracos/antebracos (local)
for f in KEYS:
    for bn in ARMB:
        qn = q(B, bn, f) @ qpow(D1.get(bn, Quaternion()), a1(f)) @ qpow(D2.get(bn, Quaternion()), a2(f))
        write(bn, f, qn)
for c in A.values(): c.update()

# 2) contrapeso do tombo (mundo) nos bracos e arrasto das maos; peso zero no pico (f5/f21 ficam como o responsavel fez)
rig = bpy.data.objects['AlienRig']; P = rig.pose.bones; s = bpy.context.scene; mw = rig.matrix_world
Wi = mw.to_3x3().inverted(); back = (Wi @ Vector((0, 1, 0))).normalized()
fc0 = s.frame_current; new = {}
for f in KEYS:
    s.frame_set(f)
    w = max(0.0, 1.0 - max(a1(f), a2(f)))
    roll = ROLL * math.cos(2 * math.pi * (f - 1) / F)
    for side in ('Left', 'Right'):
        pb = P[side + 'Arm']; M = pb.matrix.copy(); J = M.translation.copy()
        R = Quaternion(back, math.radians(COUNTER * roll * w)).to_matrix().to_4x4()
        pb.matrix = Matrix.Translation(J) @ R @ Matrix.Translation(-J) @ M
        new[(side + 'Arm', f)] = pb.rotation_quaternion.copy()
        dA = (a1(f) + a2(f)) - (a1(f - 2) + a2(f - 2))
        hq = q(B, side + 'Hand', f) @ Quaternion((1, 0, 0), math.radians(-HAND_LAG * dA))
        new[(side + 'Hand', f)] = hq
for (bn, f), qn in new.items(): write(bn, f, qn)
for c in A.values(): c.update()
s.frame_set(fc0)

# confere: f5 e f21 dos ossos editados iguais a pose dele / ao espelho
err5 = max(math.degrees(q(A, bn, 5).rotation_difference(q(U, bn, 5)).angle) for bn in EDIT)
print('chaves dos bracos', KEYS, '| f5 vs pose do responsavel: diferenca max', round(err5, 3), 'graus')
for lib_act in (ref, usr):
    lib = lib_act.library; bpy.data.actions.remove(lib_act); bpy.data.libraries.remove(lib)
