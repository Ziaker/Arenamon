"""Poses-chave por erro de posição E de orientação (Task 7 / 1G + L10).

simplificar() escolhe o menor conjunto de quadros que, interpolado (linear na translação/escala, slerp na
rotação, como o decodificador), reconstrói o clipe dentro de tol_H (posição, fração da altura) e tol_graus
(ângulo da rotação no mundo). Começa pelos obrigatórios (início, fim, eventos, extremos de rotação expressiva,
trocas de visibilidade) e, a cada rodada, adiciona o quadro que mais viola qualquer dos dois limites em cada
trecho entre chaves (menos rodadas que um por vez; o resultado pode ter algumas chaves a mais que o mínimo).

É uma APROXIMAÇÃO: não recupera o blocking do animador. A comparação com as chaves que o próprio arquivo
guarda (faixas esparsas) é só descritiva.
"""
import numpy as np

import za_anim

REGIOES_EXPRESSIVAS = ("cabeca", "braco", "perna", "cauda")
MAX_CHAVES_FRAC = 1.0


def _slerp_vet(q0, q1, t):
    """q0, q1 [B, 4]; t escalar -> [B, 4]."""
    d = np.einsum("bi,bi->b", q0, q1)
    q1 = np.where(d[:, None] < 0, -q1, q1)
    d = np.abs(d)
    perto = d > 0.9995
    th = np.arccos(np.clip(d, -1, 1))
    s = np.sin(th)
    s = np.where(perto, 1.0, s)
    a = np.where(perto, 1 - t, np.sin((1 - t) * th) / s)
    b = np.where(perto, t, np.sin(t * th) / s)
    r = a[:, None] * q0 + b[:, None] * q1
    return r / np.linalg.norm(r, axis=1, keepdims=True)


def reconstruir(clipe, esq, quadros):
    quadros = sorted(set(int(q) for q in quadros))
    n = clipe.quadros
    loc = np.empty_like(clipe.loc)
    rot = np.empty_like(clipe.rot)
    esc = np.empty_like(clipe.escala)
    for a, b in zip(quadros[:-1], quadros[1:]):
        for f in range(a, b + 1):
            t = (f - a) / (b - a) if b > a else 0.0
            loc[f] = clipe.loc[a] + t * (clipe.loc[b] - clipe.loc[a])
            esc[f] = clipe.escala[a] + t * (clipe.escala[b] - clipe.escala[a])
            rot[f] = _slerp_vet(clipe.rot[a], clipe.rot[b], t)
    for f in range(0, quadros[0]):
        loc[f], rot[f], esc[f] = clipe.loc[quadros[0]], clipe.rot[quadros[0]], clipe.escala[quadros[0]]
    for f in range(quadros[-1] + 1, n):
        loc[f], rot[f], esc[f] = clipe.loc[quadros[-1]], clipe.rot[quadros[-1]], clipe.escala[quadros[-1]]
    return esq.fk_completa(loc, rot, esc)


def _erros(clipe, esq, pos, rot, vis, altura):
    dpos = np.linalg.norm(pos - clipe.posicoes, axis=2) / altura  # [F, B]
    r = np.einsum("fbji,fbjk->fbik", rot, clipe.rot_mundo)
    ang = np.degrees(np.arccos(np.clip((np.trace(r, axis1=2, axis2=3) - 1) / 2, -1, 1)))
    return dpos * vis, ang * vis


def extremos_de_rotacao(clipe, esq, regs, limiar_graus=10.0, juntar_q=2):
    """Quadros de virada (máximo/mínimo local do ângulo de rotação local em relação ao quadro 0), com amplitude
    >= limiar em relação à virada anterior, só no primeiro osso de cada cadeia de cabeça, braço, perna e cauda
    (dedos e pontas soltas ficam de fora). Viradas a até `juntar_q` quadros uma da outra viram uma só."""
    raizes = []
    for i, r in enumerate(regs):
        if r.split("_")[0] not in REGIOES_EXPRESSIVAS or i not in clipe.ossos_animados:
            continue
        p = esq.pais[i]
        if not (0 <= p < len(regs)) or regs[p] != r:
            raizes.append(i)
    viradas = set()
    for i in raizes:
        q = clipe.rot[:, i]
        d = np.abs(q @ q[0])
        a = np.degrees(2 * np.arccos(np.clip(d, 0, 1)))
        ultimo = a[0]
        for f in range(1, len(a) - 1):
            if (a[f] >= a[f - 1] and a[f] > a[f + 1]) or (a[f] <= a[f - 1] and a[f] < a[f + 1]):
                if abs(a[f] - ultimo) >= limiar_graus:
                    viradas.add(f)
                    ultimo = a[f]
    out = []
    for f in sorted(viradas):
        if not out or f - out[-1] > juntar_q:
            out.append(f)
    return out


def quadros_fortes_do_arquivo(clipe, frac=0.5):
    """Quadros em que >= frac das faixas esparsas do arquivo têm chave ao mesmo tempo."""
    qk = getattr(clipe, "quadros_chave", {})
    if not qk:
        return []
    cont = np.zeros(clipe.quadros)
    for qs in qk.values():
        for q in qs:
            if 0 <= q < clipe.quadros:
                cont[q] += 1
    return [int(f) for f in np.where(cont / len(qk) >= frac)[0]]


def _concordancia(escolhidos, chaves_arquivo, tol=1):
    if not chaves_arquivo:
        return None, None
    ch = np.array(sorted(chaves_arquivo))
    es = np.array(sorted(escolhidos))
    conc = float(np.mean([np.abs(ch - q).min() <= tol for q in es]))
    cob = float(np.mean([np.abs(es - k).min() <= tol for k in ch]))
    return round(conc, 3), round(cob, 3)


def simplificar(clipe, esq, tol_H=0.01, tol_graus=3.0, obrigatorios=(), regs=None, ocultos=None, max_iter=200):
    n = clipe.quadros
    altura = float(np.ptp(esq.posicoes_repouso[:, 1])) or 1.0
    oc = za_anim.ocultos(clipe, esq) if ocultos is None else ocultos
    vis = (~oc).astype(float)
    trocas = set()
    for f in range(1, n):
        if (oc[f] != oc[f - 1]).any():
            trocas |= {f - 1, f}
    extremos = extremos_de_rotacao(clipe, esq, regs) if regs is not None else []
    obrig = {"inicio_fim": [0, n - 1], "evento": sorted(int(q) for q in obrigatorios if 0 <= q < n),
             "extremo_rotacao": extremos, "troca_visibilidade": sorted(trocas)}
    quadros = set()
    for v in obrig.values():
        quadros |= set(v)
    por_erro = []
    epos = eang = None
    for _ in range(max_iter):
        pos, rot = reconstruir(clipe, esq, quadros)
        epos, eang = _erros(clipe, esq, pos, rot, vis, altura)
        viol = np.maximum(epos.max(axis=1) / tol_H, eang.max(axis=1) / tol_graus)
        if viol.max() <= 1.0:
            break
        # o pior quadro de CADA trecho entre chaves que viola algum limite entra nesta rodada
        ks = sorted(quadros)
        novos = []
        for a, b in zip(ks[:-1], ks[1:]):
            if b - a < 2:
                continue
            f = a + 1 + int(np.argmax(viol[a + 1:b]))
            if viol[f] > 1.0:
                novos.append(f)
        if not novos:
            break
        quadros |= set(novos)
        por_erro += novos
    escolhidos = sorted(quadros)
    fortes = quadros_fortes_do_arquivo(clipe)
    conc, cob = _concordancia(escolhidos, fortes)
    qk = getattr(clipe, "quadros_chave", {})
    densidade = round(float(np.mean([len(v) for v in qk.values()])) / n, 3) if qk and n else None
    por_osso = {esq.nomes[i]: {"pos_H": round(float(epos[:, i].max()), 5), "graus": round(float(eang[:, i].max()), 3)}
                for i in range(len(esq.nomes)) if epos[:, i].max() > 0 or eang[:, i].max() > 0}
    return {"quadros": escolhidos, "erro_max_H": round(float(epos.max()), 6), "erro_max_graus": round(float(eang.max()), 4),
            "erro_por_osso": por_osso, "obrigatorios_por_motivo": dict(obrig, erro=sorted(por_erro)),
            "chaves_do_arquivo_n": len(fortes), "densidade_chaves_arquivo": densidade,
            "concordancia_com_arquivo": conc, "cobertura_do_arquivo": cob,
            "status": "APROXIMACAO"}
