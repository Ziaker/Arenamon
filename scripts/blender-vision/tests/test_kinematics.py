"""Testes numericos INDEPENDENTES (casos analiticos) das funcoes de cinematica. Roda com o Python do sistema (numpy):
   python scripts/blender-vision/tests/test_kinematics.py
Nao usa Blender nem nenhum .blend."""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import vision_common as vc

R = []


def chk(nome, ok, det=""):
    R.append(bool(ok))
    print("%-62s %s %s" % (nome, "OK  " if ok else "FALHOU", det))


t = np.arange(40, dtype=float)
# 1. movimento uniformemente acelerado p = 0.5*g*t^2 em x: v = g t, a = g, jerk = 0 (exato, inclusive nas bordas com edge_order=2)
g = 0.01
k = vc.kinematics(np.stack([0.5 * g * t ** 2, 0 * t, 0 * t], axis=1))
chk("aceleracao vetorial constante (x = g)", np.allclose(k["acc"][:, 0], g, atol=1e-9) and np.allclose(k["acc"][:, 1:], 0, atol=1e-9), "acc[5]=%s" % k["acc"][5])
chk("jerk ~0 em aceleracao constante", np.allclose(k["jerk"], 0, atol=1e-9))
chk("velocidade = g*t no interior", np.allclose(k["vel"][2:-2, 0], g * t[2:-2], atol=1e-9))
# 2. cubica p = c t^3 em y: jerk = 6c (interior)
c = 0.001
k = vc.kinematics(np.stack([0 * t, c * t ** 3, 0 * t], axis=1))
chk("jerk vetorial constante = 6c em y (interior)", np.allclose(k["jerk"][4:-4, 1], 6 * c, rtol=1e-6) and np.allclose(k["jerk"][4:-4, [0, 2]], 0, atol=1e-9), "jerk=%s" % k["jerk"][10])
# 3. circulo raio r: curvatura 1/r, modulo da aceleracao = w^2 r, mudanca de direcao = w (graus)
r, w = 0.5, 0.1
k = vc.kinematics(np.stack([r * np.cos(w * t), r * np.sin(w * t), 0 * t], axis=1))
chk("curvatura do circulo = 1/r", np.allclose(k["curvature"][3:-3], 1 / r, rtol=0.01), "%.3f vs %.3f" % (k["curvature"][10], 1 / r))
chk("modulo da aceleracao centripeta = w^2 r", np.allclose(k["acc_mag"][3:-3], w * w * r, rtol=0.01))
chk("mudanca de direcao por frame = w em graus", np.allclose(k["turn_deg"][3:], math.degrees(w), rtol=0.01), "%.2f vs %.2f" % (k["turn_deg"][10], math.degrees(w)))
# 4. reta: curvatura 0, sem mudanca de direcao
k = vc.kinematics(np.stack([0.02 * t, 0.01 * t, 0 * t], axis=1))
chk("reta: curvatura 0 e direcao constante", np.allclose(k["curvature"], 0, atol=1e-9) and np.allclose(k["turn_deg"], 0, atol=1e-6))
# 5. parado: tudo zero (sem NaN)
k = vc.kinematics(np.zeros((30, 3)))
chk("parado: tudo zero e finito", all(np.isfinite(v).all() and np.allclose(v, 0) for v in k.values()))
# 6. velocidade angular: 5 graus/frame em torno de eixo arbitrario
ax = np.array([1.0, 2.0, 2.0]) / 3.0
th = math.radians(5.0)
q = np.array([[math.cos(th * i / 2), *(ax * math.sin(th * i / 2))] for i in range(30)])
av = vc.quat_angular_speed(q)
chk("velocidade angular = 5 graus/frame", np.allclose(av[1:], 5.0, atol=1e-6) and av[0] == 0, "%.4f" % av[5])
chk("velocidade angular ignora sinal do quaternion (q e -q)", np.allclose(vc.quat_angular_speed(np.concatenate([q[:10], -q[10:20]]))[1:], 5.0, atol=1e-6))
# 7. candidatos de fase: janela declarada e salto de borda (cenario tipo 'snap para idle' no ultimo frame)
tot = np.zeros(41)
tot[4:9] = 0.5
tot[9:14] = 0.8
tot[14:20] = 0.1
tot[40] = 2.0      # snap de borda: maior movimento do clip
ph = vc.phase_candidates(tot, list(range(41)), (9, 13))
chk("salto de borda e excluido (g40)", ph["saltos_de_borda_excluidos"] == [40], str(ph["saltos_de_borda_excluidos"]))
chk("com janela declarada: impacto = metrica na janela, frame de contato NAO escolhido", ph["impacto"]["selecionado_frame_de_contato"] is None and ph["impacto"]["frames_autorais"] == [9, 13])
chk("recuperacao nao e contaminada pelo snap de borda", ph["recuperacao"]["pico_m_frame"] < 0.5, str(ph["recuperacao"].get("pico_m_frame")))
ph2 = vc.phase_candidates(tot, list(range(41)))
chk("sem janela: pico fora da borda (nunca g40) e rotulado 'NAO e contato'", ph2["impacto"]["frame_autoral"] in range(9, 14) and "NAO e contato" in ph2["impacto"]["fase"], str(ph2["impacto"]["frame_autoral"]))
print("\n%d/%d" % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
