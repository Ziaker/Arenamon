# Sprint 1 do Eggo (AlienRig), v9: 4 pulinhos em 32 f (8 f por pisada, ciclo de 16 f repetido 2x), cada pisada com
# IMPACTO (toque -> amassa forte em 1 frame -> impulso com a perna reta). Base v5: v4 com ciclo de 32 f (16 f por pisada, tempos escalados), bracos fixos atras do
# corpo (sem balanco nem compensacao) e o personagem inteiro tombando 5 graus no Root para o lado da perna de apoio.
# (v4: chaves BEZIER, volta das pernas em arco mais redondo.)
# Base v3: 0,8 m por pisada, arco de 20 graus (~7 cm), bracos +-12, tronco 20 graus.
# Pernas montadas pela extensao: no impulso a perna de apoio estica 100% (o quadril sobe ate esticar), no ar a de tras
# fica esticada para tras e a da frente se estende antes de tocar. Executado dentro do Blender (exec). Nao salva o .blend.
import bpy, math
from mathutils import Quaternion, Vector, Matrix

NAME = 'Sprint 1'
STEP = 8
F = 2 * STEP               # ciclo; frame F+1 = frame 1 + 1,6 m
STRIDE = 0.8
V = STRIDE / STEP          # m por frame
H = STRIDE / 4 * math.tan(math.radians(20))   # arco de 20 graus sobre a pisada
LEAN = 20.0                # tronco para a frente (graus)
CONTACT = {'Left': 1, 'Right': 1 + STEP}
# trajetoria do pe por fase p (frames desde o toque): (p, frente rel. ao pe neutro em m, altura acima do corpo-no-chao em m, ponta do pe em graus)
# alvos de tras/frente ficam alem do alcance de proposito: o IK deixa a perna reta apontando para eles
# fases simetricas (p e p+20 caem nos mesmos frames -> poucas chaves). Chute para tras espalhado em 6 frames (sem tranco)
# e volta da perna em arco largo: o pe passa a ~0,15 m do quadril, a dobra para em ~45%.
# p0 toque, p1 impacto (amassa), p2 impulso (perna reta); voo p2->p8
# p8-p10 mais baixos: no impacto do outro pe o quadril amassa e a coxa entrava na barriga
PATH = [(0, 0.10, 0.0, 0), (1, 0.0, 0.0, 0), (2, -0.10, 0.0, 0), (3, -0.36, 0.06, -30), (5, -0.40, 0.13, -45),
        (8, -0.12, 0.11, -15), (9, 0.0, 0.10, -10), (10, 0.14, 0.14, -5), (11, 0.24, 0.16, 0), (13, 0.36, 0.08, 10),
        (16, 0.10, 0.0, 0)]
IMPACT_DROP = 0.07         # quadril amassa no frame do impacto (m)
IMPACT_LEAN = 6.0          # tronco cai para a frente no impacto (graus)
FLIGHTS = [(3, 1 + STEP), (3 + STEP, 1 + 2 * STEP)]   # voo p2 -> proximo toque
PUSH = 2                   # fase em que a perna de apoio estica 100% (o quadril sobe)
ARM_SWING = 12.0           # graus, oposto as pernas
ARM_REF = 0.28             # deslocamento do pe que da o balanco maximo
FOREARM = -25.0            # cotovelo mais dobrado (X negativo dobra; X positivo estica)
DEL = {'Chest': 1, 'Neck': 1, 'Head': 1, 'LeftShoulder': 2, 'RightShoulder': 2, 'LeftArm': 2, 'RightArm': 2,
       'LeftForeArm': 2, 'RightForeArm': 2, 'LeftHand': 3, 'RightHand': 3}
ROLL = 5.0                 # tombo do personagem inteiro no Root (graus), para o lado da perna de apoio
ARM_BACK = 10.0            # bracos fixos atras do corpo: giro constante (graus) que os deixa ~25 graus abaixo da horizontal
LIFT = 0.06                # quadril mais alto logo depois do impulso (m), some em LIFT_FRAMES
LIFT_FRAMES = 4
ARM_LAG = 3.0              # atraso leve dos bracos no sobe/desce do pulinho (graus)
RATIO = {}
LEGS = ('LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot')
STRAIGHT = 0.995


def E(ax, deg):
    return Quaternion({'X': (1, 0, 0), 'Y': (0, 1, 0), 'Z': (0, 0, 1)}[ax], math.radians(deg))


def lin(pts, t):
    for (a, va), (b, vb) in zip(pts, pts[1:]):
        if a <= t <= b:
            return va + (vb - va) * ((t - a) / (b - a) if b > a else 0)
    return pts[-1][1]


def phase(side, f):
    return (f - CONTACT[side]) % F


def foot(side, f):
    p = phase(side, f)
    return tuple(lin([(q[0], q[i]) for q in PATH], p) for i in (1, 2, 3))


def up(f):
    for a, b in FLIGHTS:
        if a <= f <= b:
            t = (f - a) / (b - a); return H * 4 * t * (1 - t)
    return 0.0


def fcurves(a):
    return [fc for l in a.layers for st in l.strips for cb in st.channelbags for fc in cb.fcurves]


def neutral_pose():
    out = {}
    for fc in fcurves(bpy.data.actions['Idle 5 Organica']):
        bn = fc.data_path.split('"')[1]; pr = fc.data_path.split('.')[-1]
        out.setdefault(bn, {'location': [0, 0, 0], 'rotation_quaternion': [1, 0, 0, 0], 'scale': [1, 1, 1]})[pr][fc.array_index] = fc.evaluate(1)
    return out


def generate():
    rig = bpy.data.objects['AlienRig']; P = rig.pose.bones; mw = rig.matrix_world
    N = neutral_pose(); prev = rig.animation_data.action; prev_slot = rig.animation_data.action_slot
    upd = bpy.context.view_layer.update

    def setN(bn):
        P[bn].location = Vector(N[bn]['location']); P[bn].rotation_quaternion = Quaternion(N[bn]['rotation_quaternion']); P[bn].scale = Vector(N[bn]['scale'])

    def aim(pb, ydir, xhint):
        y = ydir.normalized(); x = (xhint - y * xhint.dot(y)).normalized(); z = x.cross(y)
        pb.matrix = Matrix.Translation(pb.matrix.translation.copy()) @ Matrix((x, y, z)).transposed().to_4x4(); upd()

    def twobone(side, T, hinge_ref, fwd):
        upb = P[side + 'UpLeg']; lo = P[side + 'Leg']
        J = upb.matrix.translation.copy(); a = upb.length; b = lo.length
        d = (T - J).length; dmax = (a + b) * STRAIGHT; dd = min(d, dmax); dirv = (T - J).normalized()
        RATIO[side] = d / (a + b)
        # joelho no plano do eixo lateral fixo (sem polo): perp = perna x lateral aponta sempre para a frente do corpo,
        # entao o eixo do joelho nunca vira (o polo frente/cima ficava quase oposto a perna esticada para tras)
        lat = hinge_ref if hinge_ref.x > 0 else -hinge_ref
        perp = dirv.cross(lat); perp = perp - dirv * perp.dot(dirv); perp.normalize()
        cosA = max(-1, min(1, (a * a + dd * dd - b * b) / (2 * a * dd))); sinA = math.sqrt(1 - cosA * cosA)
        K = J + dirv * a * cosA + perp * a * sinA
        aim(upb, K - J, hinge_ref); aim(lo, (J + dirv * dd) - lo.matrix.translation, hinge_ref)
        return max(0.0, d - dmax)

    rig.animation_data.action = None
    frames = {}; drops = {}
    try:
        for bn in N: setN(bn)
        upd()
        footM = {s: P[s + 'Foot'].matrix.copy() for s in ('Left', 'Right')}
        hingeRef = {s: (P[s + 'UpLeg'].matrix.to_3x3() @ Vector((1, 0, 0))).normalized() for s in ('Left', 'Right')}
        Wi = mw.to_3x3().inverted()
        ax_lat = (Wi @ Vector((1, 0, 0))).normalized()       # eixo lateral (mundo X) no espaco da armature
        fwd = (Wi @ Vector((0, -1, 0.8))).normalized()        # joelho para a frente e um pouco para cima

        def pose_at(f, extra):
            for bn in N: setN(bn)
            R = V * (f - 1); u = up(f)
            P['Root'].location = Vector(N['Root']['location']) + Vector((0, u, R))
            roll = ROLL * math.cos(2 * math.pi * (f - 1) / F)   # +5 (esquerda) no toque esquerdo f1, -5 no direito
            P['Root'].rotation_quaternion = Quaternion(N['Root']['rotation_quaternion']) @ E('Z', -roll)   # Z do Root = frente; -Z tomba para +X (esquerda)
            contact = any(phase(s, f) <= PUSH for s in ('Left', 'Right'))
            stanceL = phase('Left', f) <= PUSH
            # depois do impulso o corpo continua esticado (quadril alto) e desce aos poucos: a perna de tras fica reta sem arrastar o pe
            lift = max([LIFT * max(0.0, 1 - (phase(sd, f) - PUSH) / LIFT_FRAMES) for sd in ('Left', 'Right') if phase(sd, f) > PUSH] or [0])
            ph = min(phase(sd, f) for sd in ('Left', 'Right'))
            squash = {0: -0.03, 1: -IMPACT_DROP}.get(ph, 0.0) if contact else 0.01
            P['Hips'].location = Vector(N['Hips']['location']) + Vector(((0.02 if stanceL else -0.02) if contact else 0, squash + lift - extra, 0))
            lean = LEAN + ({0: 3, 1: IMPACT_LEAN}.get(min(phase(sd, f) for sd in ('Left', 'Right')), 0) if contact else 0)
            P['Spine'].rotation_quaternion = Quaternion(N['Spine']['rotation_quaternion']) @ E('X', 0.4 * lean)
            P['Chest'].rotation_quaternion = Quaternion(N['Chest']['rotation_quaternion']) @ E('X', 0.6 * lean)
            P['Neck'].rotation_quaternion = Quaternion(N['Neck']['rotation_quaternion']) @ E('X', -0.3 * lean)
            P['Head'].rotation_quaternion = Quaternion(N['Head']['rotation_quaternion']) @ E('X', -0.5 * lean)
            upd()
            relL = foot('Left', f)[0]; relR = foot('Right', f)[0]
            # o braco do Eggo aponta para tras: inclinar o tronco levanta o braco; compensa girando para a frente o mesmo angulo
            sw_all = ARM_BACK - ARM_LAG * (u / H if H > 0 else 0)   # fixo atras; sobe um pouco para tras no alto do pulinho
            for side, sw in (('Left', sw_all), ('Right', sw_all)):
                P[side + 'ForeArm'].rotation_quaternion = P[side + 'ForeArm'].rotation_quaternion @ E('X', FOREARM)
                P[side + 'Hand'].rotation_quaternion = P[side + 'Hand'].rotation_quaternion @ E('X', -0.4 * FOREARM)
                upd()
                M = P[side + 'Arm'].matrix.copy(); J = M.translation.copy()
                P[side + 'Arm'].matrix = Matrix.Translation(J) @ Quaternion(ax_lat, math.radians(-sw)).to_matrix().to_4x4() @ Matrix.Translation(-J) @ M
                upd()
            short = []
            for side in ('Left', 'Right'):
                rel, z, toe = foot(side, f); M0 = footM[side + 'Foot'] if False else footM[side]
                T = M0.translation + Wi @ Vector((0, -(R + rel), u + z if z > 0 else 0))
                d = twobone(side, T, hingeRef[side], fwd)
                if z <= 0: short.append(d)
                rot = Quaternion(ax_lat, math.radians(-toe)).to_matrix().to_4x4()   # toe < 0: ponta do pe para baixo
                P[side + 'Foot'].matrix = Matrix.Translation(T) @ rot @ Matrix.Translation(-M0.translation) @ M0
                upd()
            return max(short or [0])

        for f in range(1, F + 2):
            drop = 0.0
            if pose_at(f, 0.0) > 1e-5:
                lo_, hi = 0.0, 0.25
                for _ in range(16):
                    mid = (lo_ + hi) / 2
                    if pose_at(f, mid) <= 1e-5: hi = mid
                    else: lo_ = mid
                drop = hi; pose_at(f, drop)
            push = [sd for sd in ('Left', 'Right') if phase(sd, f) == PUSH]
            if push:
                sd = push[0]; lo_, hi = -0.25, drop
                for _ in range(18):
                    mid = (lo_ + hi) / 2; pose_at(f, mid)
                    if RATIO[sd] < STRAIGHT: hi = mid
                    else: lo_ = mid
                drop = lo_; pose_at(f, drop)
            drops[f] = round(drop * 1000, 1)
            frames[f] = {pb.name: (tuple(pb.location), tuple(pb.rotation_quaternion), tuple(pb.scale)) for pb in P}
        for bn in N: setN(bn)
    finally:
        rig.animation_data.action = prev
        if prev is not None: rig.animation_data.action_slot = prev_slot
    for n in frames[1]:
        pq = None
        for f in range(1, F + 2):
            l, q, sc = frames[f][n]
            if pq is not None and sum(x * y for x, y in zip(pq, q)) < 0: q = tuple(-x for x in q); frames[f][n] = (l, q, sc)
            pq = q
        # fecha o ciclo: frame 27 = frame 1 (o Root anda 8 m)
        l1, q1, s1 = frames[1][n]
        qp = frames[F][n][1]
        if sum(x * y for x, y in zip(qp, q1)) < 0: q1 = tuple(-x for x in q1)   # mesmo giro, sinal continuo com o f26
        frames[F + 1][n] = ((l1[0], l1[1], l1[2] + (V * F if n == 'Root' else 0)), q1, s1)
    return frames, drops


KEYS = sorted({(CONTACT[s] + p[0] - 1) % F + 1 for s in CONTACT for p in PATH} | {1, F + 1})


def write(frames):
    act = bpy.data.actions.get(NAME)
    if act is None:
        act = bpy.data.actions['Walk Forward 5 Organica'].copy(); act.name = NAME
    act.use_fake_user = True
    prop = {'location': 0, 'rotation_quaternion': 1, 'scale': 2}
    for fc in fcurves(act):
        for m in list(fc.modifiers): fc.modifiers.remove(m)
        bn = fc.data_path.split('"')[1]; pr = fc.data_path.split('.')[-1]; d = DEL.get(bn, 0)
        fc.keyframe_points.clear(); fc.keyframe_points.add(len(KEYS))
        for i, f in enumerate(KEYS):
            src = (f - 1 - d) % F + 1 if f <= F else F + 1 - d   # no fechamento usa o quadro com sinal continuo
            v = frames[src][bn][prop[pr]][fc.array_index]
            if bn == 'Root' and pr == 'location' and fc.array_index == 2: v = frames[f][bn][0][2]   # Root anda sem atraso
            k = fc.keyframe_points[i]; k.co = (f, v)
            if bn == 'Root' and pr == 'location' and fc.array_index == 2: k.interpolation = 'LINEAR'   # velocidade constante
            elif (bn in LEGS or bn == 'Hips' or bn == 'Root') and any(phase(sd, f) in (0, 1) for sd in CONTACT): k.interpolation = 'LINEAR'   # toque e impacto secos, pe nao escorrega
            else: k.interpolation = 'BEZIER'; k.handle_left_type = k.handle_right_type = 'AUTO_CLAMPED'
        if f == F + 1 and bn != 'Root' and pr != 'rotation_quaternion':
            fc.keyframe_points[-1].co = (F + 1, fc.keyframe_points[0].co[1])
        m = fc.modifiers.new('CYCLES'); m.mode_before = m.mode_after = ('REPEAT_OFFSET' if bn == 'Root' and pr == 'location' else 'REPEAT')
        fc.update()
    # 32 frames = o ciclo de 16 f duas vezes (4 pisadas): copia as chaves 2..17 para 18..33 (Root anda mais 1,6 m)
    for fc in fcurves(act):
        bn = fc.data_path.split('"')[1]; pr = fc.data_path.split('.')[-1]
        src = [(k.co[0], k.co[1], k.interpolation) for k in fc.keyframe_points if k.co[0] > 1.5]
        for f0, v0, it in src:
            v = v0 + (V * F if (bn == 'Root' and pr == 'location' and fc.array_index == 2) else 0)
            k = fc.keyframe_points.insert(f0 + F, v); k.interpolation = it
            if it == 'BEZIER': k.handle_left_type = k.handle_right_type = 'AUTO_CLAMPED'
        fc.update()
    act.use_frame_range = True; act.frame_start = 1; act.frame_end = 2 * F + 1; act.use_cyclic = True
    return act, {fc.data_path.split('"')[1]: len(fc.keyframe_points) for fc in fcurves(act) if fc.data_path.endswith('rotation_quaternion') and fc.array_index == 0}


frames, drops = generate()
act, cnt = write(frames)
rig = bpy.data.objects['AlienRig']
rig.animation_data.action = act; rig.animation_data.action_slot = act.slots[0]
s = bpy.context.scene; s.frame_start, s.frame_end = 1, 2 * F
print('chaves', KEYS, 'max/osso', max(cnt.values()))
print('quadril abaixado p/ alcancar (mm):', {k: v for k, v in drops.items() if v > 0})
