# Motion Lens — parte «analysis» (dividida de motion_lens.py; a API pública continua em motion_lens.py).
import bpy
import math
import statistics
from mathutils import Vector
from .common import DEFAULT_ROLES, EXTRA_ROLES, _action_keyed_frames, _armature, _context, _median_mad, _mesh_min_z, _meshes_of, _parse_mapping, _point_segment_distance_2d, _resolve_bone, _restore_frame, _safe_angle, _segment_distance, _severity, _world_point
from .contract import check_contract, load_contract


def analyze_motion(context=None, armature_name=None, bone_map=None, max_issues=None):
    """Analisa a action ativa sem editar rig, malha, pesos ou keyframes.

    Retorna um dicionario Python. `issues` vem ordenado por relevancia.
    """
    context = _context(context)
    scene = context.scene
    arm = _armature(context, armature_name)
    if arm is None:
        raise RuntimeError("Selecione um armature ou informe armature_name")
    mapping = bone_map if isinstance(bone_map, dict) else _parse_mapping(
        bone_map if isinstance(bone_map, str) else scene.motion_lens_bone_map
    )
    _act = arm.animation_data.action if arm.animation_data else None
    if _act is not None:
        # PATCH: analisa o intervalo REAL da action (cena 1-250 com ataque de 41 frames extrapolaria frames inexistentes)
        frames = list(range(int(round(_act.frame_range[0])), int(round(_act.frame_range[1])) + 1))
    else:
        frames = list(range(scene.frame_start, scene.frame_end + 1))
    if len(frames) < 2:
        raise RuntimeError("O intervalo precisa ter pelo menos 2 frames")
    roles = {}
    missing = []
    for role in DEFAULT_ROLES:
        pb = _resolve_bone(arm, role, mapping)
        if pb:
            roles[role] = pb.name
        else:
            missing.append(role)
    extra_present = []
    for role in EXTRA_ROLES:
        pb = _resolve_bone(arm, role, mapping)
        if pb:
            roles[role] = pb.name
            extra_present.append(role)
    meshes = _meshes_of(arm)
    positions = {role: [] for role in roles}
    rotations = {role: [] for role in roles}
    scales = {role: [] for role in roles}
    angles = {"LeftElbow": [], "RightElbow": [], "LeftKnee": [], "RightKnee": []}
    mesh_min_z = []
    with _restore_frame(scene):
        for frame in frames:
            scene.frame_set(frame)
            depsgraph = context.evaluated_depsgraph_get()
            world_q = arm.matrix_world.to_quaternion()
            for role, bone_name in roles.items():
                pb = arm.pose.bones[bone_name]
                positions[role].append(_world_point(arm, pb))
                rotations[role].append((world_q @ pb.matrix.to_quaternion()).normalized())
                scales[role].append(pb.matrix.to_scale())
            for side in ("Left", "Right"):
                arm_role, fore_role, hand_role = side + "Arm", side + "ForeArm", side + "Hand"
                up_role, leg_role, foot_role = side + "UpLeg", side + "Leg", side + "Foot"
                if all(r in positions for r in (arm_role, fore_role, hand_role)):
                    angles[side + "Elbow"].append(_safe_angle(
                        positions[arm_role][-1], positions[fore_role][-1], positions[hand_role][-1]
                    ))
                else:
                    angles[side + "Elbow"].append(None)
                if all(r in positions for r in (up_role, leg_role, foot_role)):
                    angles[side + "Knee"].append(_safe_angle(
                        positions[up_role][-1], positions[leg_role][-1], positions[foot_role][-1]
                    ))
                else:
                    angles[side + "Knee"].append(None)
            mesh_min_z.append(_mesh_min_z(meshes, depsgraph))

    speed = {}
    height = {}
    issues = []
    for role, points in positions.items():
        speed[role] = [0.0] + [(points[i] - points[i - 1]).length for i in range(1, len(points))]
        height[role] = [p.z for p in points]
        nonzero = speed[role][1:]
        med, mad = _median_mad(nonzero)
        pop_threshold = max(scene.motion_lens_pop_min, med + scene.motion_lens_pop_mad * max(mad, 1e-6))
        for i in range(1, len(points)):
            value = speed[role][i]
            if value > pop_threshold:
                score = value / max(pop_threshold, 1e-6)
                issues.append({
                    "frame": frames[i], "kind": "pop", "bone": role, "score": score,
                    "detail": "velocidade %.3f m/frame (limiar adaptativo %.3f)" % (value, pop_threshold),
                })
        for i in range(2, len(points)):
            v0, v1 = points[i - 1] - points[i - 2], points[i] - points[i - 1]
            if v0.length > scene.motion_lens_direction_min and v1.length > scene.motion_lens_direction_min:
                dot = v0.normalized().dot(v1.normalized())
                if dot < scene.motion_lens_direction_dot:
                    score = (-dot) * (v0.length + v1.length) / max(scene.motion_lens_direction_min * 2.0, 1e-6)
                    issues.append({
                        "frame": frames[i], "kind": "reversao", "bone": role, "score": score,
                        "detail": "inversao brusca de direcao (dot %.2f)" % dot,
                    })
        quats = rotations[role]
        for i in range(1, len(quats)):
            raw_dot = quats[i - 1].dot(quats[i])
            degrees = math.degrees(2.0 * math.acos(min(1.0, abs(raw_dot))))
            if degrees > scene.motion_lens_rotation_jump:
                issues.append({
                    "frame": frames[i], "kind": "rotacao", "bone": role,
                    "score": degrees / scene.motion_lens_rotation_jump,
                    "detail": "salto angular %.1f graus/frame" % degrees,
                })
            if raw_dot < -0.5:
                issues.append({
                    "frame": frames[i], "kind": "quat_sign", "bone": role, "score": 0.6,
                    "detail": "troca de sinal do quaternion; pode ser inocua, mas merece inspecao",
                })
        for i, scale in enumerate(scales[role]):
            dev = max(abs(scale.x - 1.0), abs(scale.y - 1.0), abs(scale.z - 1.0))
            if dev > scene.motion_lens_scale_tolerance:
                issues.append({
                    "frame": frames[i], "kind": "escala", "bone": role,
                    "score": dev / scene.motion_lens_scale_tolerance,
                    "detail": "escala desvia %.3f de 1" % dev,
                })

    contacts = {}
    for foot in ("LeftFoot", "RightFoot"):
        points = positions.get(foot)
        if not points:
            continue
        threshold = min(p.z for p in points) + scene.motion_lens_contact_margin
        flags = [p.z <= threshold for p in points]
        locked = [flags[i] and speed[foot][i] <= scene.motion_lens_locked_speed for i in range(len(points))]
        slides = []
        for i in range(1, len(points)):
            if flags[i - 1] and flags[i]:
                dxy = Vector((points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)).length
                if dxy > scene.motion_lens_slide_threshold:
                    slides.append((frames[i], dxy))
                    issues.append({
                        "frame": frames[i], "kind": "deslizamento", "bone": foot,
                        "score": dxy / scene.motion_lens_slide_threshold,
                        "detail": "%.3f m entre frames baixos consecutivos" % dxy,
                    })
        contacts[foot] = {
            "height_threshold": threshold,
            "frames": [frames[i] for i, flag in enumerate(flags) if flag],
            "locked_frames": [frames[i] for i, flag in enumerate(locked) if flag],
            "max_step_slide": max((d for _, d in slides), default=0.0),
        }

    for i, z in enumerate(mesh_min_z):
        if z is not None and z < scene.motion_lens_ground_z - scene.motion_lens_penetration_tolerance:
            depth = scene.motion_lens_ground_z - z
            issues.append({
                "frame": frames[i], "kind": "penetracao", "bone": "Mesh",
                "score": depth / scene.motion_lens_penetration_tolerance,
                "detail": "malha %.3f m abaixo do plano de chao" % depth,
            })

    # Energia corporal aproximada: soma ponderada das velocidades das juntas.
    energy_weights = {
        "Hips": 0.42, "Head": 0.14, "LeftHand": 0.07, "RightHand": 0.07,
        "LeftFoot": 0.15, "RightFoot": 0.15,
    }
    energy = []
    for i in range(len(frames)):
        weighted = [(speed[r][i], w) for r, w in energy_weights.items() if r in speed]
        energy.append(sum(v * w for v, w in weighted) / max(sum(w for _, w in weighted), 1e-8))

    # Pausas involuntarias e trechos mecanicamente uniformes são indícios, não erros artísticos.
    run_start = None
    for i, value in enumerate(energy):
        if value <= scene.motion_lens_pause_speed:
            run_start = i if run_start is None else run_start
        else:
            if run_start is not None and i - run_start >= scene.motion_lens_pause_frames:
                issues.append({
                    "frame": frames[run_start], "kind": "pausa", "bone": "Body", "score": 1.2,
                    "detail": "energia quase zero por %d frames" % (i - run_start),
                })
            run_start = None
    if run_start is not None and len(frames) - run_start >= scene.motion_lens_pause_frames:
        issues.append({
            "frame": frames[run_start], "kind": "pausa", "bone": "Body", "score": 1.2,
            "detail": "energia quase zero por %d frames" % (len(frames) - run_start),
        })
    window = max(3, scene.motion_lens_uniform_frames)
    for start in range(1, max(1, len(energy) - window + 1)):
        values = energy[start:start + window]
        mean = sum(values) / len(values)
        if mean > scene.motion_lens_pause_speed * 2.0:
            spread = statistics.pstdev(values) / max(mean, 1e-8)
            if spread < scene.motion_lens_uniform_cv:
                issues.append({
                    "frame": frames[start], "kind": "uniforme", "bone": "Body", "score": 1.0,
                    "detail": "%d frames com energia quase constante (CV %.3f)" % (window, spread),
                })
                break

    # Centro de massa aproximado e estabilidade em relação aos apoios detectados.
    com_weights = {
        "Hips": 0.48, "Head": 0.16, "LeftHand": 0.05, "RightHand": 0.05,
        "LeftFoot": 0.13, "RightFoot": 0.13,
    }
    com = []
    support_distance = []
    for i in range(len(frames)):
        samples = [(positions[r][i], w) for r, w in com_weights.items() if r in positions]
        total = sum(w for _, w in samples)
        center = sum((p * w for p, w in samples), Vector((0.0, 0.0, 0.0))) / max(total, 1e-8)
        com.append(center)
        feet = [foot for foot in ("LeftFoot", "RightFoot") if foot in contacts and frames[i] in contacts[foot]["frames"]]
        if len(feet) == 2:
            distance = _point_segment_distance_2d(center, positions[feet[0]][i], positions[feet[1]][i])
        elif len(feet) == 1:
            foot_point = positions[feet[0]][i]
            distance = Vector((center.x - foot_point.x, center.y - foot_point.y)).length
        else:
            distance = None
        support_distance.append(distance)
        if distance is not None and distance > scene.motion_lens_support_margin:
            issues.append({
                "frame": frames[i], "kind": "equilibrio", "bone": "COM",
                "score": distance / scene.motion_lens_support_margin,
                "detail": "centro aproximado %.3f m fora do apoio simplificado" % distance,
            })

    # Colisão aproximada por cápsulas nos principais segmentos.
    collision_distance = []
    collision_pairs = (
        (("LeftArm", "LeftHand"), ("Hips", "Head"), "braco L/torso"),
        (("RightArm", "RightHand"), ("Hips", "Head"), "braco R/torso"),
        (("LeftUpLeg", "LeftFoot"), ("RightUpLeg", "RightFoot"), "pernas"),
    )
    for i in range(len(frames)):
        closest = None
        for (a0, a1), (b0, b1), label in collision_pairs:
            if not all(r in positions for r in (a0, a1, b0, b1)):
                continue
            distance = _segment_distance(positions[a0][i], positions[a1][i], positions[b0][i], positions[b1][i])
            closest = distance if closest is None else min(closest, distance)
            threshold = scene.motion_lens_capsule_radius * 2.0
            if distance < threshold:
                issues.append({
                    "frame": frames[i], "kind": "intersecao", "bone": label,
                    "score": (threshold - distance) / max(threshold, 1e-8) + 1.0,
                    "detail": "capsulas a %.3f m; confirmar na malha" % distance,
                })
        collision_distance.append(closest)

    # Hiperextensão e ângulos extremos.
    for joint, values in angles.items():
        for i, value in enumerate(values):
            if value is None:
                continue
            if value >= scene.motion_lens_hyperextension:
                issues.append({
                    "frame": frames[i], "kind": "hiperextensao", "bone": joint,
                    "score": 1.0 + (value - scene.motion_lens_hyperextension) / 10.0,
                    "detail": "angulo %.1f graus" % value,
                })

    # Curvatura dos arcos e quebras de tangente em frames chave.
    keyed_frames = _action_keyed_frames(arm.animation_data.action if arm.animation_data else None)
    arc_curvature = {}
    for role in ("Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot"):
        points = positions.get(role)
        if not points:
            continue
        values = [0.0] * len(points)
        straight_run = 0
        for i in range(2, len(points)):
            v0, v1 = points[i - 1] - points[i - 2], points[i] - points[i - 1]
            if v0.length < 1e-7 or v1.length < 1e-7:
                continue
            angle = math.degrees(v0.angle(v1))
            values[i] = angle
            if angle > scene.motion_lens_arc_break_angle:
                issues.append({
                    "frame": frames[i], "kind": "arco", "bone": role,
                    "score": angle / scene.motion_lens_arc_break_angle,
                    "detail": "quebra de curvatura %.1f graus" % angle,
                })
            straight_run = straight_run + 1 if angle < scene.motion_lens_arc_straight_angle else 0
            if straight_run == scene.motion_lens_arc_straight_frames:
                issues.append({
                    "frame": frames[i - straight_run + 1], "kind": "arco_reto", "bone": role,
                    "score": 0.8, "detail": "%d frames quase retilineos" % straight_run,
                })
            if frames[i - 1] in keyed_frames:
                before, after = v0.length, v1.length
                ratio = abs(after - before) / max(before, after, 1e-8)
                if ratio > scene.motion_lens_tangent_break_ratio:
                    issues.append({
                        "frame": frames[i - 1], "kind": "tangente", "bone": role,
                        "score": ratio / scene.motion_lens_tangent_break_ratio,
                        "detail": "mudanca de velocidade %.0f%% junto a chave" % (ratio * 100.0),
                    })
        arc_curvature[role] = values

    # Ossos extras do Vigoroth: presença, imobilidade e resposta relativa ao corpo.
    extra_status = {}
    hips_motion = sum(speed.get("Hips", []))
    for role in EXTRA_ROLES:
        if role not in positions:
            extra_status[role] = "ausente"
            continue
        travel = sum(speed[role])
        extra_status[role] = "movimento_total=%.4f" % travel
        if hips_motion > scene.motion_lens_extra_motion_min and travel < scene.motion_lens_extra_motion_min:
            issues.append({
                "frame": frames[0], "kind": "osso_extra_estatico", "bone": role, "score": 1.0,
                "detail": "corpo se move, mas o osso quase nao responde",
            })

    pre_contract = {
        "frames": frames, "contacts": contacts, "positions": positions, "scales": scales,
    }
    contract_result = check_contract(pre_contract, load_contract(scene))
    for message in contract_result["violations"]:
        issues.append({
            "frame": frames[0], "kind": "contrato", "bone": "Action", "score": 3.0,
            "detail": message,
        })

    issues.sort(key=lambda item: (-item["score"], item["frame"], item["bone"]))
    limit = max_issues if max_issues is not None else scene.motion_lens_max_issues
    return {
        "armature": arm.name,
        "frames": frames,
        "fps": scene.render.fps / max(scene.render.fps_base, 1e-8),
        "roles": roles,
        "missing_roles": missing,
        "extra_bones": extra_status,
        "positions": positions,
        "rotations": rotations,
        "scales": scales,
        "speed": speed,
        "height": height,
        "energy": energy,
        "center_of_mass": com,
        "support_distance": support_distance,
        "collision_distance": collision_distance,
        "arc_curvature": arc_curvature,
        "angles": angles,
        "mesh_min_z": mesh_min_z,
        "contacts": contacts,
        "contract": contract_result,
        "issues": issues[:limit],
        "issue_count_total": len(issues),
    }


def build_report(context=None, armature_name=None, bone_map=None, max_issues=None):
    data = analyze_motion(context, armature_name, bone_map, max_issues)
    frames = data["frames"]
    lines = [
        "MOTION LENS 0.3 - diagnostico priorizado",
        "Armature: %s" % data["armature"],
        "Frames: %d..%d (%d) | %.3f FPS | %.3f s" % (
            frames[0], frames[-1], len(frames), data["fps"], len(frames) / data["fps"]
        ),
    ]
    if data["missing_roles"]:
        lines.append("Ossos nao resolvidos: " + ", ".join(data["missing_roles"]))
    if data["extra_bones"]:
        lines.append("Ossos extras: " + ", ".join("%s=%s" % item for item in data["extra_bones"].items()))
    lines.append("")
    lines.append("FRAMES SUSPEITOS (ordenados por relevancia; sao alertas, nao julgamento artistico)")
    if not data["issues"]:
        lines.append("  Nenhum alerta pelos limiares atuais.")
    for issue in data["issues"]:
        lines.append("  [%s] f%-4d %-13s %-10s %s" % (
            _severity(issue["score"]), issue["frame"], issue["kind"], issue["bone"], issue["detail"]
        ))
    omitted = data["issue_count_total"] - len(data["issues"])
    if omitted > 0:
        lines.append("  ... %d alertas de menor prioridade omitidos" % omitted)
    lines.extend(["", "RESUMO POR JUNTA"])
    for role in ("Hips", "Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot"):
        values = data["speed"].get(role)
        if not values:
            continue
        peak_i = max(range(len(values)), key=values.__getitem__)
        lines.append("  %-10s pico %.3f m/frame em f%d | media %.3f" % (
            role, values[peak_i], frames[peak_i], sum(values[1:]) / max(1, len(values) - 1)
        ))
    lines.extend(["", "CONTATO (limiar relativo ao minimo de cada pe)"])
    for foot, info in data["contacts"].items():
        lines.append("  %s: %d baixos, %d quase travados, slide max %.3f m/frame, z<=%.3f" % (
            foot, len(info["frames"]), len(info["locked_frames"]),
            info["max_step_slide"], info["height_threshold"]
        ))
    valid_z = [z for z in data["mesh_min_z"] if z is not None]
    if valid_z:
        lines.append("  Malha: z minimo %.4f m" % min(valid_z))
    lines.extend(["", "CONTRATO"])
    if data["contract"]["violations"]:
        lines.extend("  VIOLACAO: " + item for item in data["contract"]["violations"])
    else:
        lines.append("  Nenhuma violacao objetiva detectada.")
    lines.extend("  Nota: " + item for item in data["contract"]["notes"])
    lines.extend([
        "",
        "LIMITES: estes dados detectam descontinuidades e riscos mensuraveis; nao avaliam peso percebido, ritmo, intencao, silhueta ou gosto.",
    ])
    return "\n".join(lines)
