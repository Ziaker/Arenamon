"""Câmera adaptativa focada na mão e garras para o Animation Witness.

Calcula enquadramentos otimizados em torno do plano da mão:
- Posiciona o centro visual entre o final da palma e as pontas das garras;
- Gera candidatos normais ao plano da mão e ângulos oblíquos;
- Rejeita vistas colineares ao antebraço (visão 'cano de espingarda' onde o braço oclui a mão);
- Rejeita câmeras com Z < 0.05 (abaixo do chão);
- Garante independência geométrica (>= 35 graus) entre as vistas selecionadas.
"""
from __future__ import annotations

import math
from typing import Any, Sequence

from witness_utility import (
    MIN_INDEPENDENT_ANGLE_DEG,
    angle_between_vectors_deg,
    are_views_independent,
)


def _norm(v: Sequence[float]) -> list[float]:
    l = math.sqrt(sum(float(x) ** 2 for x in v))
    if l < 1e-9:
        return [0.0, 0.0, 1.0]
    return [float(x) / l for x in v]


def _cross(a: Sequence[float], b: Sequence[float]) -> list[float]:
    return [
        float(a[1]) * float(b[2]) - float(a[2]) * float(b[1]),
        float(a[2]) * float(b[0]) - float(a[0]) * float(b[2]),
        float(a[0]) * float(b[1]) - float(a[1]) * float(b[0]),
    ]


def _dot(a: Sequence[float], b: Sequence[float]) -> float:
    return sum(float(x) * float(y) for x, y in zip(a, b))


def _dist(a: Sequence[float], b: Sequence[float]) -> float:
    return math.sqrt(sum((float(x) - float(y)) ** 2 for x, y in zip(a, b)))


def _sub(a: Sequence[float], b: Sequence[float]) -> list[float]:
    return [float(x) - float(y) for x, y in zip(a, b)]


def _add(a: Sequence[float], b: Sequence[float]) -> list[float]:
    return [float(x) + float(y) for x, y in zip(a, b)]


def _scale(v: Sequence[float], s: float) -> list[float]:
    return [float(x) * s for x in v]


class AdaptiveHandCamera:
    """Calculador de câmeras adaptativas focado no complexo mão/garras."""

    def __init__(
        self,
        wrist_pos: Sequence[float],
        palm_end_pos: Sequence[float],
        forearm_start_pos: Sequence[float],
        claw_tips: Sequence[Sequence[float]],
    ) -> None:
        self.wrist = [float(x) for x in wrist_pos]
        self.palm_end = [float(x) for x in palm_end_pos]
        self.forearm_start = [float(x) for x in forearm_start_pos]
        self.claw_tips = [[float(x) for x in pt] for pt in claw_tips]

    def compute_center_and_span(self) -> tuple[list[float], float]:
        """Calcula o centro ótimo e o span (raio/extensão) necessário."""
        all_pts = [self.palm_end] + self.claw_tips
        if not self.claw_tips:
            center = self.palm_end
            span = 0.35
            return center, span

        # Centro ponderado: 40% fim da palma, 60% centroide das pontas
        tips_centroid = [
            sum(p[i] for p in self.claw_tips) / len(self.claw_tips) for i in range(3)
        ]
        center = _add(_scale(self.palm_end, 0.35), _scale(tips_centroid, 0.65))

        # Raio máximo a partir do centro para conter todos os pontos com margem de 25%
        max_d = max(_dist(center, pt) for pt in all_pts + [self.wrist])
        span = max(max_d * 2.5, 0.28)
        return center, round(span, 4)

    def generate_candidates(self) -> list[dict[str, Any]]:
        """Gera e filtra os candidatos de câmera."""
        center, span = self.compute_center_and_span()

        # Vetor do antebraço para a mão
        forearm_vec = _norm(_sub(self.wrist, self.forearm_start))

        # Vetor comprimento da mão (palma para pontas)
        if self.claw_tips:
            tips_centroid = [
                sum(p[i] for p in self.claw_tips) / len(self.claw_tips) for i in range(3)
            ]
            hand_long_vec = _norm(_sub(tips_centroid, self.palm_end))
        else:
            hand_long_vec = forearm_vec

        # Vetor abertura entre garras (se houver >= 2 garras)
        if len(self.claw_tips) >= 2:
            claw_spread_vec = _norm(_sub(self.claw_tips[1], self.claw_tips[0]))
        else:
            # Vetor ortogonal qualquer ao comprimento da mão
            ref = [0.0, 0.0, 1.0] if abs(hand_long_vec[2]) < 0.85 else [1.0, 0.0, 0.0]
            claw_spread_vec = _norm(_cross(hand_long_vec, ref))

        # Normal ao plano da mão
        hand_normal = _norm(_cross(hand_long_vec, claw_spread_vec))

        # Conjunto de vetores de direção da câmera (do alvo para a câmera)
        directions: list[tuple[str, list[float]]] = [
            ("palma_normal_pos", hand_normal),
            ("palma_normal_neg", _scale(hand_normal, -1.0)),
            ("palma_obliqua_pos", _norm(_add(hand_normal, claw_spread_vec))),
            ("palma_obliqua_neg", _norm(_sub(hand_normal, claw_spread_vec))),
            ("garra_perfil_pos", claw_spread_vec),
            ("garra_perfil_neg", _scale(claw_spread_vec, -1.0)),
            ("superior_45", _norm(_add(hand_normal, [0.0, 0.0, 0.7]))),
        ]

        cam_dist = span * 1.6
        candidates: list[dict[str, Any]] = []

        for name, dir_vec in directions:
            cam_pos = _add(center, _scale(dir_vec, cam_dist))

            # 1. Filtro de colinearidade com o antebraço
            # Se o ângulo entre o vetor de visada (-dir_vec) e o antebraço for pequeno (< 25 deg ou > 155 deg)
            forearm_ang = angle_between_vectors_deg(dir_vec, forearm_vec)
            is_forearm_collinear = forearm_ang < 25.0 or forearm_ang > 155.0

            # 2. Filtro de chão (Z < 0.05m)
            is_underground = cam_pos[2] < 0.05

            reasons: list[str] = []
            if is_forearm_collinear:
                reasons.append("colinear com o eixo do antebraço (visão ocluída)")
            if is_underground:
                reasons.append(f"câmera abaixo do solo (Z={cam_pos[2]:.3f}m)")

            # Up vector padrão (Z para cima, a menos que dir_vec seja muito vertical)
            up = [0.0, 0.0, 1.0] if abs(dir_vec[2]) < 0.9 else [0.0, 1.0, 0.0]

            score = 1.0
            if is_forearm_collinear:
                score -= 0.6
            if is_underground:
                score -= 0.8
            # Vistas normais e oblíquas recebem bônus de legibilidade
            if "normal" in name:
                score += 0.3
            elif "obliqua" in name:
                score += 0.2

            candidates.append({
                "name": name,
                "direction": dir_vec,
                "target": center,
                "location": cam_pos,
                "up": up,
                "span": span,
                "is_forearm_collinear": is_forearm_collinear,
                "is_underground": is_underground,
                "rejection_reasons": reasons,
                "score": round(score, 3),
            })

        return candidates

    def select_best_independent_views(
        self, count: int = 3, min_angle_deg: float = MIN_INDEPENDENT_ANGLE_DEG
    ) -> list[dict[str, Any]]:
        """Seleciona as melhores câmeras que sejam mutuamente independentes (>= 35 graus)."""
        candidates = self.generate_candidates()
        # Filtra candidatos inviáveis (chão ou colinear)
        valid = [c for c in candidates if not c["is_underground"] and not c["is_forearm_collinear"]]
        valid.sort(key=lambda x: -x["score"])

        selected: list[dict[str, Any]] = []
        for cand in valid:
            if not selected:
                selected.append(cand)
            else:
                # Verifica se é independente de todas as já selecionadas
                all_independent = True
                for s in selected:
                    indep, ang = are_views_independent(
                        cand["location"], cand["target"], s["location"], s["target"], min_angle_deg
                    )
                    if not indep:
                        all_independent = False
                        break
                if all_independent:
                    selected.append(cand)
            if len(selected) >= count:
                break

        return selected
