"""Contrato e implementação F06: Análise de Golpe e Contato (arenamon.strike-analysis/1).

Analisa o timing, aceleração dos efetores, bote e retenção (hit-stop) de uma Action de ataque.
Diferencia com rigor factual:
- Contato CANDIDATO: inferido cinematicamente por desaceleração ou extensão máxima do efetor.
- Contato CONFIRMADO_ALVO: verificado por colisão com volume/alvo geométrico explícito.
- Contato CONFIRMADO_EVENTO: verificado por frame de colisão/hitbox autorizado de gameplay.

Integração com o contrato 'arenamon.agent-report/1' (F15).
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Tuple

SCHEMA_NAME = "arenamon.strike-analysis/1"

CONFIRMATION_SOURCE_HEURISTIC = "KINEMATIC_HEURISTIC"
CONFIRMATION_SOURCE_GEOMETRIC = "GEOMETRIC_TARGET"
CONFIRMATION_SOURCE_EVENT = "AUTHORIZED_EVENT"

CONTACT_STATUS_CANDIDATE = "CANDIDATO"
CONTACT_STATUS_CONFIRMED_TARGET = "CONFIRMADO_ALVO"
CONTACT_STATUS_CONFIRMED_EVENT = "CONFIRMADO_EVENTO"

# Tipologia formal de eventos de combate
EVENT_TYPE_RUNTIME_RESOLVED_HIT = "RUNTIME_RESOLVED_HIT"  # Impacto contra oponente comprovado pelo runtime
EVENT_TYPE_HITBOX_WINDOW = "HITBOX_ACTIVATION_WINDOW"      # Apenas abertura de janela de dano (não é acerto)
EVENT_TYPE_ANIMATION_NOTIFY = "ANIMATION_KEY_NOTIFY"      # Marcador genérico de animação

# Origens autorizadas do subsistema de combate para eventos autenticados
AUTHORIZED_RUNTIME_SOURCES = {
    "RUNTIME_COMBAT_ENGINE",
    "SIMULATOR_RESOLVED_IMPACT",
    "COMBAT_COLLISION_PIPELINE",
    "GAMEPLAY_HURTBOX_INTERSECTION",
}

VERDICT_STATUS_OK = "OK"
VERDICT_STATUS_WARNING = "AVISO"
VERDICT_STATUS_ALERT = "ALERTA"


class StrikeAnalysisError(Exception):
    """Exceção específica para erros de dados ou validação da análise de golpe."""
    pass


@dataclass
class StrikeMetrics:
    windup_frame: int
    contact_frame: int
    strike_duration_frames: int
    strike_duration_seconds: float
    peak_speed_mps: float
    contact_speed_mps: float
    mean_strike_speed_mps: float
    acceleration_ratio: float
    hold_duration_frames: int
    hold_duration_seconds: float
    turns_count: int
    contact_status: str
    confirmation_source: str
    target_role: str


def _distance_3d(p1: List[float], p2: List[float]) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(p1, p2)))


def _dist_segment_to_point(p1: List[float], p2: List[float], center: List[float]) -> float:
    """Calcula a menor distância euclidiana entre um segmento de reta [p1, p2] e um ponto center (para CCD)."""
    v = [b - a for a, b in zip(p1, p2)]
    w = [c - a for a, c in zip(p1, center)]
    c1 = sum(a * b for a, b in zip(w, v))
    if c1 <= 0:
        return _distance_3d(p1, center)
    c2 = sum(a * b for a, b in zip(v, v))
    if c2 <= c1:
        return _distance_3d(p2, center)
    t = c1 / c2
    proj = [p1[i] + t * v[i] for i in range(3)]
    return _distance_3d(proj, center)


def _segment_intersects_aabb(p1: List[float], p2: List[float], min_b: List[float], max_b: List[float]) -> bool:
    """Verifica se o segmento [p1, p2] intercepta um volume AABB (Continuous Collision Detection / Slab Method)."""
    t_min = 0.0
    t_max = 1.0
    for i in range(3):
        d = p2[i] - p1[i]
        if abs(d) < 1e-12:
            if p1[i] < min_b[i] or p1[i] > max_b[i]:
                return False
        else:
            t1 = (min_b[i] - p1[i]) / d
            t2 = (max_b[i] - p1[i]) / d
            if t1 > t2:
                t1, t2 = t2, t1
            t_min = max(t_min, t1)
            t_max = min(t_max, t2)
            if t_min > t_max:
                return False
    return t_max >= 0.0 and t_min <= 1.0


def _point_in_aabb(p: List[float], min_b: List[float], max_b: List[float]) -> bool:
    return all(min_b[i] <= p[i] <= max_b[i] for i in range(3))


def build_strike_analysis(
    action_name: str,
    armature_name: str,
    frame_range: Tuple[int, int],
    fps: float,
    strike_effector_role: str,
    effector_positions: Dict[int, List[float]],
    pelvis_positions: Optional[Dict[int, List[float]]] = None,
    head_positions: Optional[Dict[int, List[float]]] = None,
    target_geometry: Optional[Dict[str, Any]] = None,
    authorized_event: Optional[Dict[str, Any]] = None,
    authorized_event_frame: Optional[int] = None,
    target_strike_frames: int = 5,
    target_hold_frames: int = 3,
    hold_speed_threshold_mps: float = 0.5,
) -> Dict[str, Any]:
    """Constrói a análise cinemática de golpe em conformidade com 'arenamon.strike-analysis/1'.

    Args:
        action_name: Nome da Action de ataque.
        armature_name: Nome do esqueleto.
        frame_range: Intervalo de frames real (start, end).
        fps: Taxa de quadros por segundo real.
        strike_effector_role: Papel semântico do efetor do golpe (ex: 'right_hand', 'head').
        effector_positions: Mapeamento de frame para coordenadas 3D [X, Y, Z] do efetor.
        pelvis_positions: Opcional, posições da pelve para medir antecipação do tronco.
        head_positions: Opcional, posições da cabeça para medir antecipação sagital.
        target_geometry: Opcional, alvo geométrico SPHERE ou BOX com suporte a detecção contínua (CCD / travessia).
        authorized_event: Opcional, evento autenticado com 'event_name', 'frame', 'source' e 'is_verified'.
        authorized_event_frame: Opcional (legado não autenticado; gera CANDIDATO caso não acompanhado de proveniência).
        target_strike_frames: Meta de quadros para a fase de bote rápido.
        target_hold_frames: Meta de quadros para a fase de retenção/impacto.
        hold_speed_threshold_mps: Limiar de velocidade em m/s considerado sustentação/pausa pós-contato.
    """
    if fps <= 0.0:
        raise StrikeAnalysisError(f"FPS deve ser positivo. Recebido: {fps}")

    start_frame, end_frame = frame_range
    sorted_frames = sorted(effector_positions.keys())
    if len(sorted_frames) < 3:
        raise StrikeAnalysisError(f"Amostragem insuficiente de frames ({len(sorted_frames)}). Mínimo 3.")

    # 1. Cálculo de velocidades do efetor (m/frame e m/s)
    speeds_mps: Dict[int, float] = {}
    speeds_mpf: Dict[int, float] = {}
    speeds_mps[sorted_frames[0]] = 0.0
    speeds_mpf[sorted_frames[0]] = 0.0

    for i in range(1, len(sorted_frames)):
        f_prev = sorted_frames[i - 1]
        f_curr = sorted_frames[i]
        dt = (f_curr - f_prev) / fps
        dist = _distance_3d(effector_positions[f_curr], effector_positions[f_prev])
        sp_mpf = dist / max(1, (f_curr - f_prev))
        sp_mps = dist / dt if dt > 1e-6 else 0.0
        speeds_mpf[f_curr] = round(sp_mpf, 4)
        speeds_mps[f_curr] = round(sp_mps, 4)

    # 2. Determinação do frame de contato e sua fonte epistêmica
    contact_frame: int
    contact_status: str
    confirmation_source: str
    detection_method: str
    unauthenticated_event_warning: Optional[str] = None

    # Verificação de Evento Autorizado de Gameplay
    valid_event = False
    if authorized_event is not None and isinstance(authorized_event, dict):
        ev_frame = authorized_event.get("frame")
        ev_name = str(authorized_event.get("event_name") or authorized_event.get("event_id") or "")
        ev_source = str(authorized_event.get("source") or "")
        raw_ev_type = authorized_event.get("event_type") or authorized_event.get("type")
        ev_type = str(raw_ev_type).upper() if raw_ev_type is not None else ""
        # Verificação booleana estrita: DEVE ser exatamente True (evita que 'false' vire True via bool())
        is_verified_strict = (authorized_event.get("is_verified") is True)
        hit_record = authorized_event.get("runtime_hit_record")

        # 1. Exigência categórica do tipo RUNTIME_RESOLVED_HIT
        if ev_type != EVENT_TYPE_RUNTIME_RESOLVED_HIT:
            unauthenticated_event_warning = (
                f"Evento '{ev_name}' rejeitado: possui tipo '{ev_type or 'NÃO_ESPECIFICADO'}' (diferente de {EVENT_TYPE_RUNTIME_RESOLVED_HIT}). "
                "Apenas impactos comprovados contra hurtbox de oponente confirmam evento de golpe; classificado como CANDIDATO."
            )
        # 2. Verificação estrita de booleano
        elif not is_verified_strict:
            unauthenticated_event_warning = (
                f"Evento '{ev_name}' no frame {ev_frame} rejeitado: 'is_verified' deve ser estritamente o booleano True "
                f"(recebido: {repr(authorized_event.get('is_verified'))}); revertido para candidato cinemático."
            )
        # 3. Fonte do runtime de combate
        elif ev_source not in AUTHORIZED_RUNTIME_SOURCES:
            unauthenticated_event_warning = (
                f"Evento '{ev_name}' rejeitado: origem '{ev_source}' não pertence às fontes autorizadas do runtime de combate "
                f"({sorted(AUTHORIZED_RUNTIME_SOURCES)}); revertido para candidato cinemático."
            )
        # 4. Verificação de integridade não-declarativa (runtime_hit_record)
        elif not isinstance(hit_record, dict) or not hit_record.get("target_id") or hit_record.get("resolution") not in ("HIT_RESOLVED", "DAMAGE_APPLIED"):
            unauthenticated_event_warning = (
                f"Evento '{ev_name}' rejeitado: falta registro de impacto auditável do engine "
                "(runtime_hit_record com 'target_id' e resolution='HIT_RESOLVED'/'DAMAGE_APPLIED'); "
                "declarações isoladas do chamador não comprovam acerto no runtime; classificado como CANDIDATO."
            )
        # 5. Coerência do frame
        elif not (isinstance(ev_frame, int) and ev_frame in effector_positions):
            unauthenticated_event_warning = (
                f"Evento '{ev_name}' no frame {ev_frame} inválido: frame fora das posições amostradas do efetor."
            )
        else:
            valid_event = True
            contact_frame = int(ev_frame)
            contact_status = CONTACT_STATUS_CONFIRMED_EVENT
            confirmation_source = CONFIRMATION_SOURCE_EVENT
            tgt = hit_record.get("target_id")
            res = hit_record.get("resolution")
            detection_method = (
                f"Acerto comprovado no runtime do evento '{ev_name}' contra '{tgt}' ({res}) via {ev_source} no frame {contact_frame}"
            )
    elif authorized_event_frame is not None:
        unauthenticated_event_warning = (
            f"Parâmetro numérico authorized_event_frame ({authorized_event_frame}) recebido sem proveniência ou "
            "verificação formal de gameplay; classificado estritamente como CANDIDATO cinemático."
        )

    # Verificação de Alvo Geométrico (com Continuous Collision Detection / travessia entre amostras)
    geometric_hit_frame: Optional[int] = None
    geom_details: str = ""

    if not valid_event and target_geometry is not None:
        geom_type = str(target_geometry.get("type", "")).upper()

        if geom_type == "SPHERE":
            center = target_geometry["center"]
            radius = float(target_geometry.get("radius_m", 0.15))

            for i, f in enumerate(sorted_frames):
                p_curr = effector_positions[f]
                # Ponto dentro da esfera
                if _distance_3d(p_curr, center) <= radius:
                    geometric_hit_frame = f
                    geom_details = f"Colisão pontual com alvo esférico (raio {radius:.2f} m) no frame {f}"
                    break
                # Travessia contínua (CCD): segmento entre f_prev e f_curr intercepta a esfera
                if i > 0:
                    p_prev = effector_positions[sorted_frames[i - 1]]
                    if _dist_segment_to_point(p_prev, p_curr, center) <= radius:
                        geometric_hit_frame = f
                        geom_details = f"Travessia contínua (CCD) interceptando alvo esférico (raio {radius:.2f} m) entre f{sorted_frames[i-1]} e f{f}"
                        break

        elif geom_type == "BOX":
            if "min_bounds" in target_geometry and "max_bounds" in target_geometry:
                min_b = target_geometry["min_bounds"]
                max_b = target_geometry["max_bounds"]
            elif "center" in target_geometry:
                c = target_geometry["center"]
                ext = target_geometry.get("extents_m") or target_geometry.get("size_m", [0.3, 0.3, 0.3])
                min_b = [c[k] - ext[k] / 2.0 for k in range(3)]
                max_b = [c[k] + ext[k] / 2.0 for k in range(3)]
            else:
                raise StrikeAnalysisError("Alvo tipo BOX deve conter 'min_bounds' e 'max_bounds' ou 'center' e 'extents_m'.")

            for i, f in enumerate(sorted_frames):
                p_curr = effector_positions[f]
                # Ponto dentro da caixa AABB
                if _point_in_aabb(p_curr, min_b, max_b):
                    geometric_hit_frame = f
                    geom_details = f"Colisão pontual com volume BOX no frame {f}"
                    break
                # Travessia contínua (CCD) do segmento com o AABB
                if i > 0:
                    p_prev = effector_positions[sorted_frames[i - 1]]
                    if _segment_intersects_aabb(p_prev, p_curr, min_b, max_b):
                        geometric_hit_frame = f
                        geom_details = f"Travessia contínua (CCD) interceptando volume BOX entre f{sorted_frames[i-1]} e f{f}"
                        break

    if valid_event:
        pass  # Já preenchido acima
    elif geometric_hit_frame is not None:
        contact_frame = geometric_hit_frame
        contact_status = CONTACT_STATUS_CONFIRMED_TARGET
        confirmation_source = CONFIRMATION_SOURCE_GEOMETRIC
        detection_method = geom_details
    else:
        # Inferência puramente cinemática (queda de velocidade após pico)
        peak_f = max(sorted_frames, key=lambda f: speeds_mps[f])
        after_peak = [f for f in sorted_frames if f >= peak_f]
        contact_frame = next((f for f in after_peak if speeds_mps[f] < speeds_mps[peak_f] * 0.40), sorted_frames[-1])
        contact_status = CONTACT_STATUS_CANDIDATE
        confirmation_source = CONFIRMATION_SOURCE_HEURISTIC
        if target_geometry is not None:
            detection_method = "Alvo geométrico fornecido não atingido nem atravessado; candidato inferido por desaceleração"
        else:
            detection_method = "Candidato cinemático: queda de velocidade para menos de 40% do pico após a aceleração máxima"

    # 3. Determinação da antecipação (windup)
    frames_before_contact = [f for f in sorted_frames if f < contact_frame]
    if frames_before_contact:
        peak_speed_before = max([speeds_mps[f] for f in frames_before_contact] or [0.0])
        # Ponto de menor velocidade ou pose mais recolhida antes da aceleração
        slow_frames = [f for f in frames_before_contact if speeds_mps[f] <= peak_speed_before * 0.20]
        windup_frame = max(slow_frames) if slow_frames else frames_before_contact[0]
    else:
        windup_frame = sorted_frames[0]

    strike_duration_frames = max(1, contact_frame - windup_frame)
    strike_duration_sec = round(strike_duration_frames / fps, 3)

    # 4. Velocidades e Aceleração do bote
    strike_frames = [f for f in sorted_frames if windup_frame <= f <= contact_frame]
    peak_speed = max([speeds_mps[f] for f in strike_frames] or [0.0])
    contact_speed = speeds_mps[contact_frame]
    mean_speed = sum(speeds_mps[f] for f in strike_frames) / max(1, len(strike_frames))
    accel_ratio = round(contact_speed / mean_speed, 2) if mean_speed > 1e-4 else 0.0

    # 5. Duração da retenção / impacto (hold)
    hold_frames_count = 0
    frames_after = [f for f in sorted_frames if f > contact_frame]
    for f in frames_after:
        if speeds_mps[f] > hold_speed_threshold_mps:
            break
        hold_frames_count += 1
    hold_duration_sec = round(hold_frames_count / fps, 3)

    # 6. Antecipações sagitais / inversoes de sentido
    turns = 0
    if pelvis_positions and head_positions:
        common_f = [f for f in sorted_frames if f <= windup_frame and f in pelvis_positions and f in head_positions]
        if len(common_f) >= 3:
            fwd = [(head_positions[f][1] - pelvis_positions[f][1]) for f in common_f]
            prev = 0
            for i in range(1, len(fwd)):
                d = fwd[i] - fwd[i - 1]
                s = 1 if d > 0.004 else (-1 if d < -0.004 else 0)
                if s and prev and s != prev:
                    turns += 1
                if s:
                    prev = s

    # 7. Diagnósticos e pareceres analíticos
    verdicts = []
    if strike_duration_frames > target_strike_frames:
        verdicts.append({
            "code": "STRIKE_SLOW",
            "status": VERDICT_STATUS_WARNING,
            "message": f"Bote dura {strike_duration_frames} frames ({strike_duration_sec:.2f} s); meta recomendada até {target_strike_frames} frames.",
        })
    else:
        verdicts.append({
            "code": "STRIKE_TIMING_FAST",
            "status": VERDICT_STATUS_OK,
            "message": f"Bote ágil em {strike_duration_frames} frames ({strike_duration_sec:.2f} s; dentro da meta de {target_strike_frames}).",
        })

    if accel_ratio < 1.0:
        verdicts.append({
            "code": "STRIKE_DECELERATING",
            "status": VERDICT_STATUS_WARNING,
            "message": f"Efetor chega ao impacto desacelerando ({accel_ratio:.2f}x da média). Em golpes contundentes a mão/pé deve manter ou acelerar até o contato.",
        })
    else:
        verdicts.append({
            "code": "STRIKE_ACCELERATING",
            "status": VERDICT_STATUS_OK,
            "message": f"Efetor acelera até o contato ({accel_ratio:.2f}x da média).",
        })

    if hold_frames_count < target_hold_frames:
        verdicts.append({
            "code": "HOLD_INSUFFICIENT",
            "status": VERDICT_STATUS_ALERT,
            "message": f"Retenção de {hold_frames_count} frames ({hold_duration_sec:.2f} s); meta recomendada de pelo menos {target_hold_frames} frames de leitura do impacto.",
        })
    else:
        verdicts.append({
            "code": "HOLD_OK",
            "status": VERDICT_STATUS_OK,
            "message": f"Retenção pós-contato de {hold_frames_count} frames ({hold_duration_sec:.2f} s).",
        })

    if turns > 1:
        verdicts.append({
            "code": "WINDUP_DOUBLE_PUMP",
            "status": VERDICT_STATUS_WARNING,
            "message": f"Tronco inverte sentido {turns} vezes antes do bote (antecipação dupla/diluída).",
        })

    facts = [
        f"Ação analisada: '{action_name}' no armature '{armature_name}' ({start_frame}..{end_frame} a {fps:.1f} FPS).",
        f"Efetor de ataque: '{strike_effector_role}'.",
        f"Marco de contato: Frame {contact_frame} (status: {contact_status}, fonte: {confirmation_source}).",
        f"Método de detecção: {detection_method}.",
        f"Marco de antecipação (windup): Frame {windup_frame}.",
        f"Duração do bote: {strike_duration_frames} frames ({strike_duration_sec:.3f} s).",
        f"Velocidade do efetor: pico {peak_speed:.3f} m/s, no contato {contact_speed:.3f} m/s (razão de aceleração: {accel_ratio:.2f}x).",
        f"Retenção pós-contato: {hold_frames_count} frames ({hold_duration_sec:.3f} s abaixo de {hold_speed_threshold_mps} m/s).",
    ]
    if unauthenticated_event_warning:
        facts.append(f"Aviso de autenticação: {unauthenticated_event_warning}")

    metrics = StrikeMetrics(
        windup_frame=windup_frame,
        contact_frame=contact_frame,
        strike_duration_frames=strike_duration_frames,
        strike_duration_seconds=strike_duration_sec,
        peak_speed_mps=peak_speed,
        contact_speed_mps=contact_speed,
        mean_strike_speed_mps=round(mean_speed, 3),
        acceleration_ratio=accel_ratio,
        hold_duration_frames=hold_frames_count,
        hold_duration_seconds=hold_duration_sec,
        turns_count=turns,
        contact_status=contact_status,
        confirmation_source=confirmation_source,
        target_role=strike_effector_role,
    )

    limitations = [
        "A análise cinemática avalia timing e trajetórias nos eixos físicos, sem emitir notas subjetivas de estética.",
        "Se o status for CANDIDATO, o ponto de impacto é uma inferência cinemática baseada no perfil de desaceleração e não substitui hitbox autorizada.",
    ]
    if unauthenticated_event_warning:
        limitations.append(unauthenticated_event_warning)

    return {
        "schema": SCHEMA_NAME,
        "action_name": action_name,
        "armature_name": armature_name,
        "frame_range": list(frame_range),
        "fps": fps,
        "effector_role": strike_effector_role,
        "metrics": asdict(metrics),
        "verdicts": verdicts,
        "facts": facts,
        "limitations": limitations,
    }


def validate_strike_analysis(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Valida se um documento cumpre as restrições de 'arenamon.strike-analysis/1'."""
    errors = []
    if not isinstance(data, dict):
        return False, ["O documento deve ser um dicionário"]

    if data.get("schema") != SCHEMA_NAME:
        errors.append(f"Schema inválido: esperado '{SCHEMA_NAME}', recebido '{data.get('schema')}'")

    for field in ("action_name", "armature_name", "frame_range", "fps", "effector_role", "metrics", "verdicts", "facts"):
        if field not in data:
            errors.append(f"Campo obrigatório ausente: '{field}'")

    metrics = data.get("metrics", {})
    for mfield in (
        "windup_frame", "contact_frame", "strike_duration_frames",
        "strike_duration_seconds", "peak_speed_mps", "contact_speed_mps",
        "acceleration_ratio", "hold_duration_frames", "contact_status", "confirmation_source"
    ):
        if mfield not in metrics:
            errors.append(f"Métrica obrigatória ausente em metrics: '{mfield}'")

    valid_sources = {CONFIRMATION_SOURCE_HEURISTIC, CONFIRMATION_SOURCE_GEOMETRIC, CONFIRMATION_SOURCE_EVENT}
    if metrics.get("confirmation_source") not in valid_sources:
        errors.append(f"Fonte de confirmação inválida: {metrics.get('confirmation_source')}")

    valid_statuses = {CONTACT_STATUS_CANDIDATE, CONTACT_STATUS_CONFIRMED_TARGET, CONTACT_STATUS_CONFIRMED_EVENT}
    if metrics.get("contact_status") not in valid_statuses:
        errors.append(f"Status de contato inválido: {metrics.get('contact_status')}")

    return len(errors) == 0, errors


def export_strike_to_agent_report(
    analysis: Dict[str, Any],
    source_file: str,
    rig_mapping: Dict[str, Any],
    visual_evidence: Optional[List[Dict[str, Any]]] = None,
    report_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Exporta a análise de golpe para o contrato canônico 'arenamon.agent-report/1' (F15)."""
    is_valid, errs = validate_strike_analysis(analysis)
    if not is_valid:
        raise StrikeAnalysisError(f"Não é possível exportar documento inválido: {errs}")

    from agent_report import build_agent_report

    act_name = analysis["action_name"]
    rep_id = report_id or f"REP-F06-STRIKE-{act_name.upper().replace(' ', '_')}"
    metrics = analysis["metrics"]
    f_range = tuple(analysis["frame_range"])

    measurements: List[Dict[str, Any]] = [
        {
            "metric": "strike_effector_role",
            "value": analysis["effector_role"],
            "unit": "role",
            "method": "anatomical_role_declaration",
            "confidence": 1.0,
            "target_role": analysis["effector_role"],
        },
        {
            "metric": "strike_contact_frame",
            "value": metrics["contact_frame"],
            "unit": "frames",
            "method": "strike_kinematic_point_detection",
            "confidence": 1.0 if metrics["contact_status"] != CONTACT_STATUS_CANDIDATE else 0.85,
        },
        {
            "metric": "strike_windup_frame",
            "value": metrics["windup_frame"],
            "unit": "frames",
            "method": "strike_kinematic_point_detection",
            "confidence": 0.90,
        },
        {
            "metric": "strike_duration_frames",
            "value": metrics["strike_duration_frames"],
            "unit": "frames",
            "method": "frame_interval_difference",
            "confidence": 1.0,
        },
        {
            "metric": "strike_duration_seconds",
            "value": metrics["strike_duration_seconds"],
            "unit": "s",
            "method": "frame_interval_to_seconds",
            "confidence": 1.0,
        },
        {
            "metric": "strike_peak_speed",
            "value": metrics["peak_speed_mps"],
            "unit": "m/s",
            "method": "effector_finite_differences_speed",
            "confidence": 0.95,
        },
        {
            "metric": "strike_contact_speed",
            "value": metrics["contact_speed_mps"],
            "unit": "m/s",
            "method": "effector_finite_differences_speed",
            "confidence": 0.95,
        },
        {
            "metric": "strike_acceleration_ratio",
            "value": metrics["acceleration_ratio"],
            "unit": "ratio",
            "method": "contact_speed_over_mean_speed",
            "confidence": 0.95,
        },
        {
            "metric": "strike_hold_duration_frames",
            "value": metrics["hold_duration_frames"],
            "unit": "frames",
            "method": "post_contact_low_speed_hold_count",
            "confidence": 0.90,
        },
        {
            "metric": "strike_contact_status",
            "value": metrics["contact_status"],
            "unit": "enum",
            "method": "epistemic_contact_classification",
            "confidence": 1.0,
        },
        {
            "metric": "strike_confirmation_source",
            "value": metrics["confirmation_source"],
            "unit": "enum",
            "method": "provenance_source_identification",
            "confidence": 1.0,
        },
    ]

    limitations = {
        "missing_data": [],
        "assumptions": [
            f"Taxa de amostragem limitada a {analysis['fps']:.1f} FPS.",
            f"Fonte de confirmação: {metrics['confirmation_source']}.",
        ],
        "risks": analysis["limitations"],
        "confidence_score": 0.95 if metrics["contact_status"] != CONTACT_STATUS_CANDIDATE else 0.85,
    }

    findings = {
        "facts": analysis["facts"],
        "inferences": [v["message"] for v in analysis["verdicts"]],
        "actionable": [v["message"] for v in analysis["verdicts"] if v["status"] != VERDICT_STATUS_OK],
        "uncertainties": ["Ponto de contato inferido por cinemática"] if metrics["contact_status"] == CONTACT_STATUS_CANDIDATE else [],
    }

    report = build_agent_report(
        report_id=rep_id,
        target={
            "source_file": source_file,
            "action_name": act_name,
            "action_slot": None,
            "armature_name": analysis["armature_name"],
            "frame_range": f_range,
            "fps": float(analysis["fps"]),
            "unit_system": "METRIC_METERS",
        },
        rig_mapping=rig_mapping,
        measurements=measurements,
        visual_evidence=visual_evidence or [],
        findings=findings,
        limitations_and_risks=limitations,
    )
    return report
