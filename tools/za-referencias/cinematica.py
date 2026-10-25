"""Cinemática por região: curvas, eventos (vários picos), ordem de ativação, follow-through e escala (Task 4).

Velocidade de uma região = velocidade da ponta da região relativa à raiz do corpo, em H/s (o núcleo, no
espaço do modelo, para enxergar o quadril/tronco avançando). Ossos ocultos por escala valem zero nos quadros
ocultos e na troca de visibilidade, para que reaparecer não pareça movimento.
"""
import numpy as np

from config import TOL_ESCALA

PROEMINENCIA = 0.25   # pico vira evento se >= 25% do maior pico da curva
VALE_SEPARA = 0.5     # dois picos são eventos diferentes se o vale entre eles cai abaixo de 50% do menor
LIMIAR_BORDA = 0.10   # início/fim do evento: velocidade < 10% do pico do evento


def _ponta(esq, regs, regiao):
    prof = {}
    for i in esq.ordem:
        p = esq.pais[i]
        prof[i] = prof[p] + 1 if 0 <= p < len(regs) else 0
    cand = [i for i, r in enumerate(regs) if r == regiao]
    return max(cand, key=lambda i: (prof[i], float(np.linalg.norm(esq.posicoes_repouso[i])))) if cand else None


def curvas_regiao(clipe, esq, regs, raiz, ocultos):
    altura = float(np.ptp(esq.posicoes_repouso[:, 1])) or 1.0
    pos = clipe.posicoes / altura
    rel = pos - pos[:, raiz][:, None, :]
    fps = max(clipe.fps, 1)
    n = clipe.quadros
    out = {}
    for reg in sorted(set(regs)):
        if reg in ("raiz", "auxiliar"):
            continue
        k = _ponta(esq, regs, reg)
        serie = pos[:, k] if reg == "nucleo" else rel[:, k]
        v = np.gradient(serie, axis=0) * fps if n >= 2 else np.zeros_like(serie)
        o = ocultos[:, k].copy()
        troca = np.zeros(n, bool)
        troca[1:] = o[1:] != o[:-1]
        troca[:-1] |= troca[1:]
        mascara = (~(o | troca)).astype(float)
        vel = np.linalg.norm(v, axis=1) * mascara
        acel = np.abs(np.gradient(vel) * fps) if n >= 2 else np.zeros(n)
        jerk = np.abs(np.gradient(acel) * fps) if n >= 2 else np.zeros(n)
        sai = (np.einsum("fi,fi->f", v, rel[:, k]) > 0).astype(float)
        out[reg] = {"osso": k, "vel": vel, "acel": acel * mascara, "jerk": jerk * mascara, "vel_saida": vel * sai}
    return out


def _maximos(v):
    n = len(v)
    return [i for i in range(n) if v[i] > 0 and (i == 0 or v[i] >= v[i - 1]) and (i == n - 1 or v[i] > v[i + 1])]


def eventos(vel, fps, proeminencia=PROEMINENCIA):
    vel = np.asarray(vel, dtype=float)
    if len(vel) == 0 or vel.max() <= 0:
        return []
    topo = vel.max()
    picos = [i for i in _maximos(vel) if vel[i] >= proeminencia * topo]
    unidos = []
    for p in picos:
        if unidos:
            q = unidos[-1]
            vale = vel[q:p + 1].min()
            if vale > VALE_SEPARA * min(vel[q], vel[p]):
                if vel[p] > vel[q]:
                    unidos[-1] = p
                continue
        unidos.append(p)
    out = []
    for j, p in enumerate(unidos):
        lim = LIMIAR_BORDA * vel[p]
        a_min = unidos[j - 1] if j else 0
        b_max = unidos[j + 1] if j + 1 < len(unidos) else len(vel) - 1
        a = p
        while a > a_min and vel[a - 1] >= lim:
            a -= 1
        b = p
        while b < b_max and vel[b + 1] >= lim:
            b += 1
        out.append({"inicio": int(a), "pico": int(p), "fim": int(b), "pico_H_s": round(float(vel[p]), 4)})
    return out


def ordem_ativacao(curvas, janela, alfa=0.2, limiar_movimento=0.1):
    a, b = janela
    topo = max([float(c["vel"][a:b + 1].max()) for c in curvas.values()] + [0.0])
    out = []
    for reg, c in curvas.items():
        v = c["vel"][a:b + 1]
        m = float(v.max()) if len(v) else 0.0
        if topo <= 0 or m < limiar_movimento * topo:
            continue
        out.append({"regiao": reg, "quadro_inicio": int(a + np.argmax(v >= alfa * m))})
    return sorted(out, key=lambda x: (x["quadro_inicio"], x["regiao"]))


def follow_through(curvas, regiao_ref, regioes_apendice):
    ref = curvas[regiao_ref]["vel"]
    t0 = int(np.argmax(ref))
    out = []
    for reg in regioes_apendice:
        if reg not in curvas:
            continue
        v = curvas[reg]["vel"]
        if v.max() <= 0:
            continue
        picos = [i for i in _maximos(v) if i >= t0 and v[i] >= 0.1 * v.max()]
        if not picos:
            continue
        amort = round(float(v[picos[1]] / v[picos[0]]), 3) if len(picos) > 1 and v[picos[0]] > 0 else None
        out.append({"regiao": reg, "atraso_q": int(picos[0] - t0), "amortecimento": amort, "status": "CANDIDATO"})
    return out


def trocas_de_visibilidade(ocultos, esq):
    out = []
    for f in range(1, len(ocultos)):
        mud = np.where(ocultos[f] != ocultos[f - 1])[0]
        if len(mud) == 0:
            continue
        aparecem = [esq.nomes[i] for i in mud if not ocultos[f, i]]
        somem = [esq.nomes[i] for i in mud if ocultos[f, i]]
        if aparecem:
            out.append({"quadro": f, "para": "visivel", "ossos": aparecem})
        if somem:
            out.append({"quadro": f, "para": "oculto", "ossos": somem})
    return out


def escala_regiao(clipe, esq, regs, ocultos, quadro_evento=None):
    out = {}
    desvio = np.abs(clipe.escala - 1.0).max(axis=2)  # [F, B]
    for reg in sorted(set(regs)):
        if reg in ("raiz", "auxiliar"):
            continue
        ossos = [i for i, r in enumerate(regs) if r == reg]
        oc = ocultos[:, ossos]
        dv = np.where(oc, 0.0, desvio[:, ossos])
        tem_oculto = bool(oc.any() and (clipe.escala[:, ossos].min(axis=2) < 0.1).any())
        if dv.max() <= TOL_ESCALA and not tem_oculto:
            continue
        f, j = np.unravel_index(int(np.argmax(dv)), dv.shape)
        osso = ossos[j]
        if tem_oculto:
            tipo = "oculto"
        elif abs(clipe.escala[-1, osso] - 1.0).max() > TOL_ESCALA:
            tipo = "crescimento"
        else:
            tipo = "squash_stretch"
        rel = None
        if quadro_evento is not None:
            rel = "no" if abs(int(f) - quadro_evento) <= 2 else ("antes" if f < quadro_evento else "depois")
        out[reg] = {"amplitude": round(float(dv.max()), 4), "quadro_pico": int(f), "osso": esq.nomes[osso],
                    "relacao_com_evento": rel, "tipo": tipo, "status": "CANDIDATO"}
    return out
