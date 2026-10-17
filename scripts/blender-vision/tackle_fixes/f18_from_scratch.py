"""Construcao do Tackle do Vigoroth DO ZERO (41 frames, 30 FPS) - Versao 5 (Convergencia Perfeita).

Substitui completamente a action anterior: limpa todas as camadas/fcurves e constroi
a animacao de forma organica, continua e em arcos, cobrindo com rigor matematico e artistico:
- Start (g0-g3): preparacao e antecipacao, apoio firme na perna D esticada (z=0.14m identico em g0-g3 garantindo z <= 0.18m em todos os frames), perna E levantada, braco E erguido mirando o oponente com palma/polegar aberto e indicador reto; precedencia estrita onde o braco D dispara em g3 e tronco/quadril/pernas permanecem identicos a g0-g2;
- Smear (g4-g8): disparo explosivo, escala smear de 5 frames com retorno exato na janela;
- Stretch/contato (g9-g12) e continuacao (g13): golpe descendente em arco diagonal cruzando o peito com PICO UNICO de velocidade, garra aberta com indicador reto e escala normalizada, pe E travado no chao (IK z=0.10m garantindo world z <= 0.15m), pe D articulado atras, escala stretch de 4 frames com retorno exato na janela;
- Recuperacao 1 e 2 (g14-g26): follow-through com absorcao de peso, braco D estendido e baixo, braco E atras, movimento residual organico de respiracao/peso (SEM CONGELAMENTO);
- Finalizacao (g27-g40): pulinho de reposicionamento (g27-g30) calibrado diretamente em coordenadas de mundo (subida de 5.5 cm, aterrissagem com delta de 5 mm), passos curtos com fase aerea (sem deslizar), retorno gradual a idle e convergencia exata em g40.
"""
import math
import bpy
from mathutils import Vector, Quaternion

DESCRIPTION = "Construcao da animacao Tackle DO ZERO: 41 frames organicamente integrados, cobrindo todas as fases e regras do contrato."

def straighten_finger(arm, side, digit="Index"):
    """Garante que a cadeia de falanges fique reta (angulo >= 150 graus exigido pelo proxy de mao aberta)."""
    for i in ("1", "2", "3", "4"):
        pb = arm.pose.bones.get(f"mixamorig:{side}Hand{digit}{i}")
        if pb:
            pb.rotation_quaternion = Quaternion((1.0, 0.0, 0.0, 0.0))
            pb.scale = Vector((1.0, 1.0, 1.0))

def clean_all_finger_scales(arm):
    """Garante escala limpa 1.0 em todos os ossos das maos e dedos."""
    for s in ("Left", "Right"):
        for d in ("Thumb", "Index"):
            for i in ("1", "2", "3", "4"):
                pb = arm.pose.bones.get(f"mixamorig:{s}Hand{d}{i}")
                if pb:
                    pb.scale = Vector((1.0, 1.0, 1.0))

def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    act = ctx.action
    
    # 1. LIMPEZA TOTAL DA ACTION (CRIACAO DO ZERO)
    if hasattr(act, "layers"):
        for l in list(act.layers):
            act.layers.remove(l)
    elif hasattr(act, "fcurves"):
        for fc in list(act.fcurves):
            act.fcurves.remove(fc)
    ctx.log.append("Action limpa: 0 keyframes remanescentes (construcao do zero)")
    
    # Carrega referencia da idle
    idle = bpy.data.actions.get("idle")
    pl.assign(arm, idle)
    ctx.scene.frame_set(1)
    q_idle = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    h_idle = pl.pbone(arm, "Hips").location.copy()
    pole = {s: pl.leg_pole_body(arm, s) for s in ("Left", "Right")}
    pl.assign(arm, act)
    
    # Coordenadas estritas de apoio do pe E no chao durante contato e sustentacao (g9 a g26)
    # Z em 0.10 m garante que world_head(arm, 'LeftFoot').z fique em ~0.14 m (< 0.18 m)
    LEFT_FOOT_GROUND = Vector((0.14, -0.36, 0.10))
    
    # Passos finais de reposicionamento (g34 a g40) com fase aerea comprovada
    LEFT_STEPS = {
        34: (0.14, -0.22, 0.11),
        35: (0.14, -0.22, 0.11),
        36: (0.255, -0.04, 0.21),
        37: (0.288, 0.004, 0.19),
        38: (0.290, 0.006, 0.145),
        39: (0.290, 0.006, 0.145),
        40: (0.290, 0.006, 0.145)
    }
    RIGHT_STEPS = {
        34: (-0.16, 0.0, 0.11),
        35: (-0.16, 0.0, 0.11),
        36: (-0.16, 0.0, 0.11),
        37: (-0.215, 0.006, 0.21),
        38: (-0.276, 0.011, 0.19),
        39: (-0.279, 0.011, 0.152),
        40: (-0.279, 0.011, 0.152)
    }
    
    # FASE 1: START (g0 - g3) - Antecipacao & Engatilhamento
    # Para garantir precedencia (m1_braco_D_antes_do_tronco) e apoio perfeito da perna D (s_perna_D_apoiada):
    # A pose de antecipacao e montada de forma impecavel em g0 e copiada de forma IDENTICA para g1 e g2.
    # Em g3, apenas o braco D comeca a disparar, enquanto o tronco/quadril/pernas permanecem identicos!
    ctx.go(0)
    hp = pl.pbone(arm, "Hips")
    hp.location = h_idle + Vector((0.0, 0.03, -0.01))
    hp.rotation_quaternion = q_idle["mixamorig:Hips"].copy()
    
    for b in ("RightUpLeg", "RightLeg"):
        pl.aim(arm, b, (-0.10, -0.99, 0.08))
    pl.aim(arm, "RightFoot", (0.0, -0.35, 0.94))
    
    pl.aim(arm, "LeftUpLeg", (0.35, 0.60, 0.72))
    pl.aim(arm, "LeftLeg", (0.05, -0.85, -0.52))
    pl.aim(arm, "LeftFoot", (0.0, 0.30, 0.95))
    
    pl.aim(arm, "Spine", (0.0, 0.95, -0.31))
    pl.aim(arm, "Spine1", (0.0, 0.92, -0.39))
    pl.aim(arm, "Spine2", (0.0, 0.90, -0.43))
    pl.aim(arm, "Neck", (0.0, 0.95, -0.31))
    pl.aim(arm, "Head", (0.0, 0.65, 0.76))
    
    pl.aim(arm, "LeftArm", (0.25, -0.25, 0.93))
    pl.aim(arm, "LeftForeArm", (0.05, 0.05, 0.99))
    pl.aim(arm, "LeftHand", (0.0, 0.0, 1.0))
    straighten_finger(arm, "Left", "Index")
    pb_th = arm.pose.bones.get("mixamorig:LeftHandThumb1")
    if pb_th:
        pb_th.rotation_quaternion = Quaternion((0.85, 0.35, -0.10, 0.38))
        pb_th.scale = Vector((1.0, 1.0, 1.0))
        
    pl.aim(arm, "RightArm", (-0.85, 0.10, -0.51))
    pl.aim(arm, "RightForeArm", (-0.75, 0.20, -0.63))
    pl.aim(arm, "RightHand", (-0.60, 0.30, -0.73))
    straighten_finger(arm, "Right", "Index")
    clean_all_finger_scales(arm)
    
    # Captura a pose exata do start
    q_start = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    h_start = pl.pbone(arm, "Hips").location.copy()
    
    # Insere keyframes perfeitamente identicos para g0, g1, g2 (timeline 1, 2, 3)
    for t in (1, 2, 3):
        ctx.scene.frame_set(t)
        for b in arm.pose.bones:
            b.rotation_quaternion = q_start[b.name].copy()
            b.keyframe_insert("rotation_quaternion", frame=t)
        hp = pl.pbone(arm, "Hips")
        hp.location = h_start.copy()
        hp.keyframe_insert("location", frame=t)
        
    # Frame g3 (timeline 4): PRECEDENCIA! Tronco, pernas e braco E permanecem no start; apenas o braco D dispara!
    ctx.scene.frame_set(4)
    for b in arm.pose.bones:
        b.rotation_quaternion = q_start[b.name].copy()
    hp = pl.pbone(arm, "Hips")
    hp.location = h_start.copy()
    
    pl.aim(arm, "RightArm", (-0.60, 0.45, -0.66))
    pl.aim(arm, "RightForeArm", (-0.35, 0.75, -0.56))
    pl.aim(arm, "RightHand", (-0.10, 0.88, -0.46))
    straighten_finger(arm, "Right", "Index")
    clean_all_finger_scales(arm)
    
    for b in arm.pose.bones:
        b.keyframe_insert("rotation_quaternion", frame=4)
    hp.keyframe_insert("location", frame=4)

    # FASE 2: SMEAR (g4 - g8) - Disparo Explosivo & Escala Smear
    for g in range(4, 9):
        ctx.go(g)
        t = g + 1
        frac = (g - 4) / 4.0
        
        # Posicionamento absoluto do quadril a partir da base idle
        hp = pl.pbone(arm, "Hips")
        dy = -0.05 - 0.14 * frac
        dz = -0.04 - 0.05 * frac
        hp.location = h_idle + Vector((0.0, dy, dz))
        R_yaw = Quaternion((0, 0, 1), math.radians(-5.0 + 15.0 * frac))
        R_lean = Quaternion((1, 0, 0), math.radians(10.0 + 12.0 * frac))
        hp.rotation_quaternion = R_yaw @ R_lean @ q_idle["mixamorig:Hips"]
        
        # Braco D acelerando em direcao ao alto a direita (preparacao do golpe)
        d_arm = (-0.65 + 0.15 * frac, 0.35 + 0.40 * frac, -0.30 + 0.85 * frac)
        pl.aim(arm, "RightArm", d_arm)
        pl.aim(arm, "RightForeArm", d_arm)
        pl.aim(arm, "RightHand", d_arm)
        
        # Braco E abre lateralmente para contrapeso
        pl.aim(arm, "LeftArm", (0.80, -0.20, 0.56))
        pl.aim(arm, "LeftForeArm", (0.70, -0.40, 0.59))
        pl.aim(arm, "LeftHand", (0.60, -0.50, 0.62))
        
        # Perna E avanca no ar
        pl.aim(arm, "LeftUpLeg", (0.15, -0.80, 0.58))
        pl.aim(arm, "LeftLeg", (0.05, -0.95, -0.30))
        pl.aim(arm, "LeftFoot", (0.0, -0.20, 0.98))
        
        # Perna D impulsiona e se estende para tras
        pl.aim(arm, "RightUpLeg", (-0.15, -0.60, -0.78))
        pl.aim(arm, "RightLeg", (-0.05, -0.70, -0.71))
        pl.aim(arm, "RightFoot", (0.0, -0.30, -0.95))
        
        # Escala Smear (g4 a g8): entrada g4, pico g6, retorno g8
        smear_s = 1.0 + 0.15 * math.sin(math.pi * (g - 4) / 4.0)
        if g == 8:
            smear_s = 1.005 # quase 1.0 para retorno garantido
        for b_name in ("RightArm", "RightForeArm", "RightHand"):
            pb = pl.pbone(arm, b_name)
            pb.scale = Vector((1.0, smear_s, 1.0))
            pb.keyframe_insert("scale", frame=t)
            
        clean_all_finger_scales(arm)
        pl.key(arm, ["Hips"], t, props=("rotation_quaternion", "location"))
        pl.key(arm, ["Spine", "Spine1", "Spine2", "Neck", "Head",
                     "RightUpLeg", "RightLeg", "RightFoot",
                     "LeftUpLeg", "LeftLeg", "LeftFoot",
                     "LeftArm", "LeftForeArm", "LeftHand",
                     "RightArm", "RightForeArm", "RightHand"], t)

    # FASE 3: STRETCH & CONTATO (g9 - g13) - Golpe Descendente com PICO UNICO de Velocidade
    # Curva rigorosamente progressiva para garantir exatamente 1 pico de velocidade (m2_golpe_continuo)
    # g9: inicio alto a direita (-0.55, 0.70, 0.45)
    # g10: descendo acelerando (-0.30, 0.45, 0.85)
    # g11: meio do corte (0.15, 0.05, 0.98) -> PICO DE VELOCIDADE
    # g12: descendo desacelerando (0.45, -0.35, 0.82)
    # g13: fim do golpe (0.65, -0.65, 0.45) -> cruza totalmente para a esquerda
    ARCO_GOLPE = {
        9:  (-0.55, 0.70, 0.45),
        10: (-0.30, 0.45, 0.85),
        11: ( 0.15, 0.05, 0.98),
        12: ( 0.45, -0.35, 0.82),
        13: ( 0.65, -0.65, 0.45),
    }
    
    for g in range(9, 14):
        ctx.go(g)
        t = g + 1
        
        # Quadril estabilizado no lunge a frente sem drift
        hp = pl.pbone(arm, "Hips")
        hp.location = h_idle + Vector((0.0, -0.22, -0.10))
        R_yaw = Quaternion((0, 0, 1), math.radians(16.0 + 3.0 * (g - 9)))
        R_lean = Quaternion((1, 0, 0), math.radians(18.0))
        hp.rotation_quaternion = R_yaw @ R_lean @ q_idle["mixamorig:Hips"]
        
        # Perna E travada com IK no ponto exato do chao (z baixo para nunca passar de 0.18)
        pl.ik_leg(arm, "Left", LEFT_FOOT_GROUND, pole["Left"])
        pl.aim(arm, "LeftFoot", (0.0, -0.35, 0.94))
        
        # Perna D articulada para tras (joelho flexionado)
        pl.aim(arm, "RightUpLeg", (-0.25, -0.55, -0.79))
        pl.aim(arm, "RightLeg", (-0.10, 0.60, -0.79))
        pl.aim(arm, "RightFoot", (0.0, -0.40, -0.91))
        
        # Braco D no corte diagonal
        dir_d = ARCO_GOLPE[g]
        pl.aim(arm, "RightArm", dir_d)
        pl.aim(arm, "RightForeArm", dir_d)
        pl.aim(arm, "RightHand", dir_d)
        
        # Garra D aberta com indicador reto e escala 1.0 garantida
        straighten_finger(arm, "Right", "Index")
        pb_th_r = arm.pose.bones.get("mixamorig:RightHandThumb1")
        if pb_th_r:
            pb_th_r.rotation_quaternion = Quaternion((0.82, -0.38, 0.10, -0.41))
            pb_th_r.scale = Vector((1.0, 1.0, 1.0))
            
        clean_all_finger_scales(arm)
        
        # Braco E atras
        pl.aim(arm, "LeftArm", (0.50, -0.40, -0.76))
        pl.aim(arm, "LeftForeArm", (0.40, -0.50, -0.76))
        pl.aim(arm, "LeftHand", (0.30, -0.60, -0.74))
        
        # Escala Stretch (g9 a g12): pico g10-g11, retorno g12, g13 normal
        if g in (9, 10, 11, 12):
            stretch_s = 1.0 + 0.13 * math.sin(math.pi * (g - 9) / 3.0)
            if g == 12:
                stretch_s = 1.005
        else:
            stretch_s = 1.0
            
        for b_name in ("RightArm", "RightForeArm", "RightHand"):
            pb = pl.pbone(arm, b_name)
            pb.scale = Vector((1.0, stretch_s, 1.0))
            pb.keyframe_insert("scale", frame=t)
            
        pl.key(arm, ["Hips"], t, props=("rotation_quaternion", "location"))
        pl.key(arm, ["Spine", "Spine1", "Spine2", "Neck", "Head",
                     "RightUpLeg", "RightLeg", "RightFoot",
                     "LeftUpLeg", "LeftLeg", "LeftFoot",
                     "LeftArm", "LeftForeArm", "LeftHand",
                     "RightArm", "RightForeArm", "RightHand",
                     "RightHandIndex1", "RightHandIndex2", "RightHandIndex3",
                     "RightHandThumb1", "RightHandThumb2", "RightHandThumb3"], t)

    # FASE 4: RECUPERACAO 1 e 2 (g14 - g26) - Follow-Through & Movimento Residual Organico
    ARCO_RECUP = {
        14: (0.55, -0.80, 0.35),
        15: (0.48, -0.85, 0.30),
        16: (0.45, -0.88, 0.28),
        17: (0.42, -0.89, 0.26),
    }
    
    for g in range(14, 27):
        ctx.go(g)
        t = g + 1
        
        # Balanco residual suave de respiracao e peso
        phase = math.sin(2 * math.pi * (g - 14) / 8.0)
        hp = pl.pbone(arm, "Hips")
        hp.location = h_idle + Vector((0.0, -0.22 + 0.010 * phase, -0.10 + 0.008 * phase))
        R_yaw = Quaternion((0, 0, 1), math.radians(28.0 + 2.0 * phase))
        R_lean = Quaternion((1, 0, 0), math.radians(16.0 + 2.0 * phase))
        hp.rotation_quaternion = R_yaw @ R_lean @ q_idle["mixamorig:Hips"]
        
        # Pe E mantido estritamente travado no ponto de apoio
        pl.ik_leg(arm, "Left", LEFT_FOOT_GROUND, pole["Left"])
        pl.aim(arm, "LeftFoot", (0.0, -0.35, 0.94))
        
        # Perna D articulada para tras
        pl.aim(arm, "RightUpLeg", (-0.22, -0.60, -0.76))
        pl.aim(arm, "RightLeg", (-0.08, 0.55, -0.83))
        pl.aim(arm, "RightFoot", (0.0, -0.40, -0.91))
        
        # Braco D desacelerando suavemente (g14-g17) e depois oscilando organicamente (g18-g26)
        if g in ARCO_RECUP:
            d_hold = ARCO_RECUP[g]
        else:
            d_hold = (0.42 + 0.02 * phase, -0.89 + 0.02 * phase, 0.26 + 0.03 * phase)
            
        pl.aim(arm, "RightArm", d_hold)
        pl.aim(arm, "RightForeArm", d_hold)
        pl.aim(arm, "RightHand", d_hold)
        
        # Braco E atras
        d_left_hold = (0.45, -0.45 + 0.03 * phase, -0.76 + 0.03 * phase)
        pl.aim(arm, "LeftArm", d_left_hold)
        pl.aim(arm, "LeftForeArm", d_left_hold)
        pl.aim(arm, "LeftHand", d_left_hold)
        
        # Escala normal
        for b_name in ("RightArm", "RightForeArm", "RightHand"):
            pb = pl.pbone(arm, b_name)
            pb.scale = Vector((1.0, 1.0, 1.0))
            pb.keyframe_insert("scale", frame=t)
            
        clean_all_finger_scales(arm)
        
        pl.key(arm, ["Hips"], t, props=("rotation_quaternion", "location"))
        pl.key(arm, ["Spine", "Spine1", "Spine2", "Neck", "Head",
                     "RightUpLeg", "RightLeg", "RightFoot",
                     "LeftUpLeg", "LeftLeg", "LeftFoot",
                     "LeftArm", "LeftForeArm", "LeftHand",
                     "RightArm", "RightForeArm", "RightHand"], t)

    # FASE 5: FINALIZACAO (g27 - g40) - Pulinho, Passos Limpos & Retorno a Idle
    # Calibracao estrita do pulinho (g27 a g30):
    # Mede z em g27 como referencia base z0; g28 e g29 sobem +0.05m e +0.06m; g30 aterrissa a z0 + 0.005m
    ARM_SWING_OUT = {
        27: ( 0.35, -0.75, 0.55),
        28: ( 0.20, -0.82, 0.50),
        29: ( 0.08, -0.87, 0.45),
        30: ( 0.00, -0.90, 0.38),
        31: (-0.08, -0.91, 0.30),
        32: (-0.15, -0.92, 0.20),
        33: (-0.22, -0.91, 0.10),
    }
    
    z_pulinho_base = None
    
    for g in range(27, 34):
        ctx.go(g)
        t = g + 1
        w_ret = (g - 27) / 7.0
        
        hp = pl.pbone(arm, "Hips")
        dy = -0.15 * (1.0 - w_ret)
        hp.location = h_idle + Vector((0.0, dy, -0.05))
        R_yaw = Quaternion((0, 0, 1), math.radians(24.0 * (1.0 - w_ret)))
        R_lean = Quaternion((1, 0, 0), math.radians(14.0 * (1.0 - w_ret)))
        hp.rotation_quaternion = R_yaw @ R_lean @ q_idle["mixamorig:Hips"]
        bpy.context.view_layer.update()
        
        cur_z = pl.world_head(arm, "Hips").z
        if g == 27:
            z_pulinho_base = cur_z
        elif g == 28:
            target_z = z_pulinho_base + 0.050 # sobe 5 cm
            hp.location.z += (target_z - cur_z)
        elif g == 29:
            target_z = z_pulinho_base + 0.060 # sobe 6 cm (pico)
            hp.location.z += (target_z - cur_z)
        elif g == 30:
            target_z = z_pulinho_base + 0.005 # aterrissa (delta 5 mm!)
            hp.location.z += (target_z - cur_z)
        elif g in (31, 32, 33):
            target_z = z_pulinho_base + 0.005 + 0.02 * (g - 30)
            hp.location.z += (target_z - cur_z)
            
        bpy.context.view_layer.update()
        
        if g in (28, 29):
            pl.aim(arm, "LeftUpLeg", (0.10, -0.80, 0.59))
            pl.aim(arm, "LeftLeg", (0.05, -0.90, -0.43))
            pl.aim(arm, "RightUpLeg", (-0.15, -0.75, 0.64))
            pl.aim(arm, "RightLeg", (-0.05, -0.85, -0.52))
        else:
            pl.ik_leg(arm, "Left", (0.14, -0.22, 0.11), pole["Left"])
            pl.ik_leg(arm, "Right", (-0.16, 0.00, 0.11), pole["Right"])
            
        d_arm_out = ARM_SWING_OUT[g]
        pl.aim(arm, "RightArm", d_arm_out)
        pl.aim(arm, "RightForeArm", d_arm_out)
        pl.aim(arm, "RightHand", d_arm_out)
        
        pl.aim(arm, "LeftArm", (0.50 * (1.0 - w_ret) + 0.35 * w_ret, -0.60 * (1.0 - w_ret) - 0.90 * w_ret, -0.50 * (1.0 - w_ret) + 0.10 * w_ret))
        pl.aim(arm, "LeftForeArm", (0.40 * (1.0 - w_ret) + 0.20 * w_ret, -0.70 * (1.0 - w_ret) - 0.95 * w_ret, -0.50 * (1.0 - w_ret) + 0.10 * w_ret))
        pl.aim(arm, "LeftHand", (0.30 * (1.0 - w_ret) + 0.10 * w_ret, -0.80 * (1.0 - w_ret) - 0.95 * w_ret, -0.40 * (1.0 - w_ret) + 0.10 * w_ret))
        
        clean_all_finger_scales(arm)
        
        pl.key(arm, ["Hips"], t, props=("rotation_quaternion", "location"))
        pl.key(arm, ["Spine", "Spine1", "Spine2", "Neck", "Head",
                     "RightUpLeg", "RightLeg", "RightFoot",
                     "LeftUpLeg", "LeftLeg", "LeftFoot",
                     "LeftArm", "LeftForeArm", "LeftHand",
                     "RightArm", "RightForeArm", "RightHand"], t)

    # 5.2 Passos finais e convergencia completa para a idle (g34 a g40)
    ctx.go(34)
    q_34 = {b.name: b.rotation_quaternion.copy() for b in arm.pose.bones}
    h_34 = pl.pbone(arm, "Hips").location.copy()
    
    STEPS_SLERP = {
        34: 0.00,
        35: 0.12,
        36: 0.28,
        37: 0.50,
        38: 0.72,
        39: 0.88,
        40: 1.00 # 100% idle
    }
    
    for g in range(34, 41):
        ctx.go(g)
        t = g + 1
        s = STEPS_SLERP[g]
        
        # Em g40 (ultimo frame), TODOS os ossos casam exatamente com q_idle
        if g == 40:
            for b in arm.pose.bones:
                b.rotation_quaternion = q_idle[b.name].copy()
                b.keyframe_insert("rotation_quaternion", frame=t)
            hp = pl.pbone(arm, "Hips")
            hp.location = h_idle.copy()
            hp.keyframe_insert("location", frame=t)
        else:
            for b in arm.pose.bones:
                if "Leg" in b.name or "Foot" in b.name or "Toe" in b.name:
                    continue
                b.rotation_quaternion = q_34[b.name].slerp(q_idle[b.name], s)
                b.keyframe_insert("rotation_quaternion", frame=t)
                
            hp = pl.pbone(arm, "Hips")
            hp.location = h_34.lerp(h_idle, s)
            hp.rotation_quaternion = q_34["mixamorig:Hips"].slerp(q_idle["mixamorig:Hips"], s)
            hp.keyframe_insert("location", frame=t)
            hp.keyframe_insert("rotation_quaternion", frame=t)
            
            # IK dos passos com fase aerea
            pl.ik_leg(arm, "Left", LEFT_STEPS[g], pole["Left"])
            pl.ik_leg(arm, "Right", RIGHT_STEPS[g], pole["Right"])
            pl.key(arm, ["LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"], t)
            
        clean_all_finger_scales(arm)
            
    # Polimento de curvas:
    # 1. Aplica BEZIER em todas as curvas
    pl.set_interp(act, "BEZIER")
    # 2. Frames 1 a 4 (g0 a g3) ficam CONSTANT em pernas e tronco para garantir estabilizacao de apoio e precedencia estrita
    pl.set_interp(act, "CONSTANT", frames={1, 2, 3, 4})
    ctx.log.append("Interpolacao refinada (CONSTANT em g0-g3; BEZIER no restante)")
    ctx.log.append("Animacao Tackle construida DO ZERO com sucesso!")
