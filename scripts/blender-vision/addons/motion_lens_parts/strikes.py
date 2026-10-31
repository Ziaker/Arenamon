# Motion Lens — parte «strikes» (dividida de motion_lens.py; a API pública continua em motion_lens.py).
import bpy
import math
import os
from .common import _action_keyed_frames, _armature, _context, _parse_mapping, _resolve_bone, _restore_frame, _world_point


STRIKE_TEXT = "ML_Golpe"


def _action_fcurves(action):
    for layer in getattr(action, "layers", ()):
        for strip in getattr(layer, "strips", ()):
            for bag in getattr(strip, "channelbags", ()):
                for curve in getattr(bag, "fcurves", ()):
                    yield curve


def _strike_samples(context, arm, roles):
    scene = context.scene
    if arm is None:
        raise RuntimeError("Selecione um armature")
    action = arm.animation_data.action if arm.animation_data else None
    if action is None:
        raise RuntimeError("Armature sem Action ativa")
    mapping = _parse_mapping(scene.motion_lens_bone_map)
    bones = {r: _resolve_bone(arm, r, mapping) for r in roles}
    missing = [r for r, b in bones.items() if b is None]
    if missing:
        raise RuntimeError("Ossos nao encontrados: " + ", ".join(missing))
    start, end = action.frame_range
    frames = list(range(math.floor(start), math.ceil(end) + 1))
    data = {r: [] for r in roles}
    with _restore_frame(scene):
        for f in frames:
            scene.frame_set(f)
            for r, b in bones.items():
                data[r].append(_world_point(arm, b).copy())
    return frames, data


def analyze_strike(context=None):
    """Mede o golpe: onde e o contato, quantos frames dura o bote, se acelera ate o contato, se segura o impacto."""
    context = _context(context)
    scene = context.scene
    arm = _armature(context)
    eff = [s.strip() for s in scene.motion_lens_strike_effectors.split(",") if s.strip()]
    if not eff:
        raise RuntimeError("Informe ao menos um efetor do golpe")
    roles = list(dict.fromkeys(eff + ["Hips", "Head"]))
    frames, data = _strike_samples(context, arm, roles)
    n = len(frames)
    if n < 4:
        raise RuntimeError("Intervalo da cena curto demais")
    speed = [0.0] + [sum((data[r][i] - data[r][i - 1]).length for r in eff) / len(eff) for i in range(1, n)]
    if len(eff) >= 2:
        gap = [(data[eff[0]][i] - data[eff[1]][i]).length for i in range(n)]
        # contato = menor distancia entre os efetores depois do maior afastamento
        open_i = max(range(n), key=lambda i: gap[i])
        after = range(open_i, n)
        contact_i = min(after, key=lambda i: gap[i]) if open_i < n - 1 else min(range(n), key=lambda i: gap[i])
        windup_i = max(range(0, contact_i + 1), key=lambda i: gap[i])
        how = "menor distancia entre %s e %s (%.3f m)" % (eff[0], eff[1], gap[contact_i])
    else:
        peak_i = max(range(n), key=lambda i: speed[i])
        contact_i = next((i for i in range(peak_i, n) if speed[i] < speed[peak_i] * 0.35), n - 1)
        windup_i = max((i for i in range(0, peak_i) if speed[i] < speed[peak_i] * 0.15), default=0)
        how = "queda de velocidade de %s depois do pico" % eff[0]
    strike = max(1, contact_i - windup_i)
    peak = max(speed[windup_i:contact_i + 1] or [0.0])
    mean = sum(speed[windup_i + 1:contact_i + 1]) / max(1, contact_i - windup_i)
    last = speed[contact_i]
    accel = last / mean if mean > 1e-6 else 0.0
    hold_speed = scene.motion_lens_hold_speed
    hold = 0
    for i in range(contact_i + 1, n):
        if speed[i] > hold_speed:
            break
        hold += 1
    # antecipacoes: inversoes do quadril/cabeca ao longo do eixo frente-tras antes do bote
    fwd = [(data["Head"][i] - data["Hips"][i]).y for i in range(n)]
    turns = 0
    prev = 0
    for i in range(1, windup_i + 1):
        d = fwd[i] - fwd[i - 1]
        s = 1 if d > 0.004 else (-1 if d < -0.004 else 0)
        if s and prev and s != prev:
            turns += 1
        if s:
            prev = s
    t_strike, t_hold = scene.motion_lens_strike_frames, scene.motion_lens_hold_frames
    fps = scene.render.fps / scene.render.fps_base
    verdicts = []
    if strike > t_strike:
        verdicts.append(("LENTO", "o bote dura %d frames (%.2f s); alvo ate %d. Encurte o trecho f%d-f%d." % (strike, strike / fps, t_strike, frames[windup_i], frames[contact_i])))
    else:
        verdicts.append(("OK", "bote em %d frames (%.2f s; alvo ate %d)." % (strike, strike / fps, t_strike)))
    if accel < 1.0:
        verdicts.append(("SEM ACELERACAO", "a mao chega ao contato mais devagar que a media do bote (%.2fx). Golpe forte acelera ate o contato." % accel))
    else:
        verdicts.append(("OK", "acelera ate o contato (%.2fx a media)." % accel))
    if hold < t_hold:
        verdicts.append(("SEM PAUSA", "%d frame(s) (%.2f s) abaixo do limiar depois do candidato; alvo %d. Nao equivale a hit-stop do jogo." % (hold, hold / fps, t_hold)))
    else:
        verdicts.append(("OK", "pausa %d frames (%.2f s) depois do candidato." % (hold, hold / fps)))
    if turns > 1:
        verdicts.append(("ANTECIPACAO DUPLA", "o tronco muda de sentido %d vezes antes do bote; a preparacao fica diluida." % turns))
    lines = ["MOTION LENS - GOLPE", "Action: %s | frames %d..%d | %.0f FPS" % (arm.animation_data.action.name if arm.animation_data and arm.animation_data.action else "-", frames[0], frames[-1], fps),
             "CANDIDATO de contato: f%d (%s)" % (frames[contact_i], how),
             "Inicio do bote (pose mais aberta/carregada): f%d" % frames[windup_i],
             "Velocidade dos efetores: pico %.3f m/frame (%.3f m/s), media %.3f m/frame (%.3f m/s), no candidato %.3f m/frame (%.3f m/s)" % (peak, peak * fps, mean, mean * fps, last, last * fps), ""]
    lines += ["[%s] %s" % v for v in verdicts]
    lines += ["", "LIMITES: CANDIDATO inferido, nao contato confirmado. Sem alvo geometrico ou evento autorizado, mede apenas tempo e velocidade. Nao julga pose, silhueta nem estilo."]
    text = "\n".join(lines)
    block = bpy.data.texts.get(STRIKE_TEXT) or bpy.data.texts.new(STRIKE_TEXT)
    block.clear()
    block.write(text)
    print(text)
    return {"contact": frames[contact_i], "contact_status": "CANDIDATO", "windup": frames[windup_i], "strike": strike, "accel": accel, "hold": hold, "turns": turns, "frames": frames, "fps": fps, "text": text}


def apply_impact(context=None):
    """Cria '<action>_impacto' com o bote reduzido ao alvo, aceleracao ate o contato e segurada (hit-stop). Nunca altera a action original."""
    context = _context(context)
    scene = context.scene
    arm = _armature(context)
    src = arm.animation_data.action if arm.animation_data else None
    if src is None:
        raise RuntimeError("Armature sem action")
    original_action = src
    original_slot = getattr(arm.animation_data, "action_slot", None)
    original_frame = scene.frame_current
    original_subframe = scene.frame_subframe
    original_range = (scene.frame_start, scene.frame_end)
    info = analyze_strike(context)
    keys = sorted(_action_keyed_frames(src))
    if len(keys) < 2:
        raise RuntimeError("A action precisa de pelo menos 2 keyframes")
    contact = min(keys, key=lambda k: abs(k - info["contact"]))
    before = [k for k in keys if k < contact]
    if not before:
        raise RuntimeError("Nao ha keyframe antes do contato f%d" % contact)
    windup = max(before)
    strike, hold = scene.motion_lens_strike_frames, scene.motion_lens_hold_frames
    new_contact = windup + strike
    delta = new_contact - contact
    dst = None

    def remap(x):
        if x <= windup + 1e-6:
            return x
        if x <= contact + 1e-6:
            return windup + (x - windup) * strike / float(contact - windup)
        return x + delta + hold

    try:
        dst = src.copy()
        base = src.name + "_impacto"
        suffix = 1
        name = base
        while bpy.data.actions.get(name) not in (None, dst):
            name = "%s_%02d" % (base, suffix)
            suffix += 1
        dst.name = name
        dst.use_fake_user = True
        for fc in _action_fcurves(dst):
            hold_val = fc.evaluate(contact)
            for k in fc.keyframe_points:
                nx = remap(k.co.x)
                dx = nx - k.co.x
                k.co.x = nx
                k.handle_left.x += dx
                k.handle_right.x += dx
            for k in fc.keyframe_points:
                f = int(round(k.co.x))
                if f == windup:
                    k.interpolation = 'EXPO'
                    k.easing = 'EASE_IN'
                elif f == new_contact:
                    k.interpolation = 'CONSTANT'
            if hold:
                kp = fc.keyframe_points.insert(new_contact + hold, hold_val)
                kp.interpolation = 'BEZIER'
            fc.update()
        arm.animation_data.action = dst
        slots = list(getattr(dst, "slots", ()))
        slot = next((candidate for candidate in slots if original_slot and candidate.identifier == original_slot.identifier), None)
        if slot is None and slots:
            slot = slots[0]
        if slot is not None:
            arm.animation_data.action_slot = slot
        return {"action": dst.name, "windup": windup, "contact": new_contact, "hold_end": new_contact + hold, "old_contact": contact, "contact_status": "CANDIDATO"}
    except Exception:
        arm.animation_data.action = original_action
        if original_slot is not None:
            arm.animation_data.action_slot = original_slot
        if dst is not None:
            bpy.data.actions.remove(dst)
        raise
    finally:
        scene.frame_start, scene.frame_end = original_range
        scene.frame_set(original_frame, subframe=original_subframe)
