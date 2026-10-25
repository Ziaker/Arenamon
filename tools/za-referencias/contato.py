"""Chão estimado, apoio por pé e locomoção (Task 5 / 1E + L04/L06).

O Z-A não traz a geometria do chão: o plano é ESTIMADO pelas pontas das pernas. Por isso:
  CONTATO_INFERIDO   pé perto do plano estimado e quase parado na vertical;
  CONTATO_CONFIRMADO só por revisão visual ou chão de outra fonte (nunca sai daqui);
  SEM_INFORMACAO     sem pernas, plano instável (pulo/queda), osso oculto por escala, ou modo indefinido.
Escorregão só é afirmado com plano estável e modo decidido; na esteira, o pé de apoio escorregar para trás
junto com o "chão" não é escorregão.
"""
import numpy as np

import za_anim

TOL_ALTURA = 0.02      # fração de H acima do plano que ainda conta como apoio
TOL_VEL_VERT = 0.15    # H/s: velocidade vertical máxima do pé apoiado
TOL_DESLIZE = 0.03     # fração de H de deslize horizontal num apoio (modo real) para virar escorregão
INSTAVEL_RAIZ = 0.25   # a raiz sobe/desce mais que isto (fração de H): pulo/queda, plano instável
INSTAVEL_MINIMOS = 0.02  # faixas de apoio dos pés (percentil 5 da altura de cada pé) diferem mais que isto
DESLOC_REAL = 0.10     # deslocamento horizontal da raiz (fração de H) para o modo "real"


def _pontas_de_apoio(esq, regs):
    """Ponta de cada cadeia de perna (e de braço que toca o chão em repouso, nos quadrúpedes)."""
    import ontologia
    rep = esq.posicoes_repouso
    altura = float(np.ptp(rep[:, 1])) or 1.0
    chao = rep[:, 1].min()
    out = []
    for fam in ("perna", "braco"):
        for raiz in ontologia._raizes_de_cadeia(esq, regs, fam):
            cadeia = ontologia._descendentes_na_regiao(esq, regs, raiz)
            ponta = min(cadeia, key=lambda k: rep[k, 1])
            if fam == "perna" or rep[ponta, 1] - chao <= 0.15 * altura:
                out.append(ponta)
    return out


def plano_chao(clipe, esq, regs, ocultos=None):
    rep = esq.posicoes_repouso
    altura = float(np.ptp(rep[:, 1])) or 1.0
    pontas = _pontas_de_apoio(esq, regs)
    if not pontas:
        return {"y": None, "fonte": None, "estavel": False, "dispersao_H": None, "pontas": [],
                "motivo": "sem pernas"}
    oc = za_anim.ocultos(clipe, esq) if ocultos is None else ocultos
    alt = clipe.posicoes[:, pontas, 1]
    vis = ~oc[:, pontas]
    valores = alt[vis]
    y = float(np.percentile(valores, 5)) if valores.size else float(rep[pontas, 1].min())
    import metricas
    raiz = metricas.raiz_do_corpo(esq)
    sobe_desce = float(np.ptp(clipe.posicoes[:, raiz, 1])) / altura
    # faixa de apoio de cada pé = percentil 5 da altura dele (mínimos no ar, durante o balanço, não contam)
    faixas = [float(np.percentile(alt[vis[:, j], j], 5)) for j in range(len(pontas)) if vis[:, j].any()]
    disp = float(np.ptp(faixas)) / altura if len(faixas) > 1 else 0.0
    estavel = sobe_desce <= INSTAVEL_RAIZ and disp <= INSTAVEL_MINIMOS
    return {"y": y, "fonte": "minimos_do_clipe", "estavel": bool(estavel), "dispersao_H": round(disp, 4),
            "sobe_desce_raiz_H": round(sobe_desce, 4), "pontas": [esq.nomes[k] for k in pontas],
            "motivo": None if estavel else ("pulo/queda: a raiz sobe/desce %.0f%% da altura" % (100 * sobe_desce)
                                            if sobe_desce > INSTAVEL_RAIZ else
                                            "pés apoiam em alturas diferentes (%.1f%% da altura)" % (100 * disp))}


def apoio_por_pe(clipe, esq, regs, chao, tol_altura=TOL_ALTURA, tol_vel=TOL_VEL_VERT, ocultos=None):
    n = clipe.quadros
    if not chao["pontas"]:
        return {"por_pe": {}, "pos_H": {}, "status": "SEM_INFORMACAO", "motivos": ["sem pernas"]}
    altura = float(np.ptp(esq.posicoes_repouso[:, 1])) or 1.0
    oc = za_anim.ocultos(clipe, esq) if ocultos is None else ocultos
    por_pe, pos = {}, {}
    for nome in chao["pontas"]:
        k = esq.indice[nome]
        p = clipe.posicoes[:, k] / altura
        pos[nome] = p
        if not chao["estavel"]:
            por_pe[nome] = ["SEM_INFORMACAO"] * n
            continue
        vy = np.abs(np.gradient(p[:, 1]) * max(clipe.fps, 1)) if n > 1 else np.zeros(n)
        perto = (p[:, 1] - chao["y"] / altura) <= tol_altura
        estados = np.where(perto & (vy <= tol_vel), "CONTATO_INFERIDO", "BALANCO").astype(object)
        estados[oc[:, k]] = "SEM_INFORMACAO"
        por_pe[nome] = list(estados)
    status = "MEDIDO" if chao["estavel"] else "SEM_INFORMACAO"
    return {"por_pe": por_pe, "pos_H": pos, "status": status,
            "motivos": [] if chao["estavel"] else [chao["motivo"]]}


def _trechos(lista, valor):
    out, ini = [], None
    for i, v in enumerate(lista):
        if v == valor and ini is None:
            ini = i
        elif v != valor and ini is not None:
            out.append((ini, i - 1))
            ini = None
    if ini is not None:
        out.append((ini, len(lista) - 1))
    return out


def locomocao(apoios, clipe, esq, chao):
    import metricas
    altura = float(np.ptp(esq.posicoes_repouso[:, 1])) or 1.0
    vazio = {"modo": "SEM_INFORMACAO", "cadencia_passos_s": None, "simetria": None, "escorregoes": []}
    if apoios["status"] != "MEDIDO":
        return dict(vazio, motivos=apoios["motivos"])
    raiz = metricas.raiz_do_corpo(esq)
    traj = clipe.posicoes[:, raiz] / altura
    desloc = float(np.linalg.norm((traj[-1] - traj[0])[[0, 2]]))
    ciclam = [nome for nome, est in apoios["por_pe"].items()
              if "CONTATO_INFERIDO" in est and "BALANCO" in est]
    if desloc >= DESLOC_REAL:
        modo = "real"
    elif len(ciclam) >= 2:
        modo = "esteira"
    else:
        return dict(vazio, motivos=["sem deslocamento e sem pés alternando"])
    dur = clipe.quadros / max(clipe.fps, 1)
    passos = 0
    fracs = []
    escorregoes = []
    for nome, est in apoios["por_pe"].items():
        trechos = _trechos(est, "CONTATO_INFERIDO")
        passos += sum(1 for a, _ in trechos if a > 0 and est[a - 1] == "BALANCO")
        fracs.append(sum(1 for s in est if s == "CONTATO_INFERIDO") / len(est))
        if modo == "real":
            p = apoios["pos_H"][nome]
            for a, b in trechos:
                deslize = float(np.linalg.norm((p[b] - p[a])[[0, 2]]))
                if b > a and deslize > TOL_DESLIZE:
                    escorregoes.append({"osso": nome, "quadros": [a, b], "deslize_H": round(deslize, 4),
                                        "nivel": "INFERIDO"})
    simetria = round(min(fracs) / max(fracs), 3) if fracs and max(fracs) > 0 else None
    return {"modo": modo, "cadencia_passos_s": round(passos / dur, 3) if dur else None, "simetria": simetria,
            "escorregoes": escorregoes, "motivos": []}


def massa_sobre_base(clipe, esq, apoios, margem=0.05):
    """Proxy: centróide dos ossos visíveis (não é centro de massa físico) dentro da base dos pés apoiados (XZ)."""
    altura = float(np.ptp(esq.posicoes_repouso[:, 1])) or 1.0
    if apoios["status"] != "MEDIDO":
        return {"proxy": "centroide_ossos", "dentro_da_base_frac": None}
    oc = za_anim.ocultos(clipe, esq)
    dentro, total = 0, 0
    for f in range(clipe.quadros):
        pes = [apoios["pos_H"][n][f][[0, 2]] for n, est in apoios["por_pe"].items() if est[f] == "CONTATO_INFERIDO"]
        if len(pes) < 2:
            continue
        vis = ~oc[f]
        cm = (clipe.posicoes[f, vis] / altura).mean(axis=0)[[0, 2]]
        a, b = pes[0], pes[1]
        ab = b - a
        t = float(np.clip(np.dot(cm - a, ab) / max(np.dot(ab, ab), 1e-12), 0, 1))
        dist = float(np.linalg.norm(cm - (a + t * ab)))
        total += 1
        dentro += dist <= margem  # distância ao segmento entre os dois apoios
    return {"proxy": "centroide_ossos", "dentro_da_base_frac": round(dentro / total, 3) if total else None}
