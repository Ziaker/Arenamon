# Depois do gerador: aplica o que o responsavel definiu no f5 da v5.
# - bracos/antebracos/ombros/maos: pose do f5 dele em todas as chaves (semi-estaticos)
# - coluna, coxa esquerda e canela direita: a diferenca dele (f5 dele - f5 da v5) na fase equivalente (1o frame de voo,
#   f4/f20) e espelhada nas pisadas do outro pe (f12/f28)
import bpy
from mathutils import Quaternion
V5 = r"C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon\chars\Eggo\eggo sprint v5.blend"
USER = r"C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon\chars\Eggo\eggo sprint v5 com f5 do usuario.blend"
ARMS = ['LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand']
BODY = ['Spine', 'LeftUpLeg', 'RightLeg']
sw = lambda n: n.replace('Left', '#').replace('Right', 'Left').replace('#', 'Right')
mir = lambda d: Quaternion((d.w, d.x, -d.y, -d.z))


def fcs(a):
    return {(c.data_path, c.array_index): c for l in a.layers for st in l.strips for cb in st.channelbags for c in cb.fcurves}


def load(p):
    with bpy.data.libraries.load(p, link=True) as (src, dst): dst.actions = ['Sprint 1']
    return dst.actions[0]


def q(m, bn, f):
    return Quaternion([m[('pose.bones["%s"].rotation_quaternion' % bn, i)].evaluate(f) for i in range(4)])


ref = load(V5); usr = load(USER)
A = fcs(bpy.data.actions['Sprint 1']); B = fcs(ref); U = fcs(usr)


def setkey(bn, f, qn):
    if q(A, bn, f).dot(qn) < 0: qn = -qn
    for i in range(4):
        c = A[('pose.bones["%s"].rotation_quaternion' % bn, i)]
        k = [k for k in c.keyframe_points if abs(k.co[0] - f) < 1e-3]
        assert k, (bn, f)
        k[0].co[1] = qn[i]


for bn in ARMS:
    qu = q(U, bn, 5)
    for k in A[('pose.bones["%s"].rotation_quaternion' % bn, 0)].keyframe_points:
        setkey(bn, k.co[0], Quaternion(qu))
for bn in BODY:
    d = q(B, bn, 5).inverted() @ q(U, bn, 5)
    for f in (4, 20): setkey(bn, f, q(A, bn, f) @ d)
    for f in (12, 28): setkey(sw(bn), f, q(A, sw(bn), f) @ mir(d))
for c in A.values(): c.update()
for a in (ref, usr):
    lib = a.library; bpy.data.actions.remove(a); bpy.data.libraries.remove(lib)
bpy.context.scene.frame_set(bpy.context.scene.frame_current)
print('pose do responsavel aplicada')
