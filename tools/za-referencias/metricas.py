"""Medidas de animação por clipe (timing, antecipação, holds, overshoot, espaçamento, loop).

Unidade de distância: H = altura do esqueleto em repouso (para comparar Pokémon de tamanhos
diferentes). Velocidades em H/s. Tudo em espaço do modelo, Y para cima.

Definições (as mesmas que o relatório mostra):
  raiz do corpo   osso filho da origem com mais descendentes (ex.: waist); dá o deslocamento.
  energia E(f)    velocidade média dos ossos animados, medida em relação à raiz do corpo.
  início/fim      primeiro/último quadro com E >= 10% do pico.
  efetor          osso com maior caminho percorrido (relativo à raiz) entre os ossos animados.
  direção do golpe  direção da velocidade do efetor no pico de velocidade dele.
  antecipação     o efetor recua contra a direção do golpe antes do pico: quanto (H) e por
                  quantos quadros (do início do movimento até o ponto de maior recuo).
  hold            trecho de >= 3 quadros, depois do início, com E < 10% do pico.
  overshoot       quanto o efetor passa da posição final, na direção do golpe, relativo ao
                  tamanho do golpe (0 = para direto na pose final).
  facilidade (ease) fração dos quadros ativos com E < 30% do pico (alto = muito ease in/out).
  snap            pico de E dividido pela mediana de E nos quadros ativos.
  erro de loop    maior diferença de posição (H) entre o último e o primeiro quadro.
"""
import re

import numpy as np

LIMIAR_ATIVO = 0.10
LIMIAR_LENTO = 0.30
HOLD_MIN = 3
AMOSTRAS_CURVA = 24

PADRAO_NOME = re.compile(r"^(\d{5})_([a-z]+?)(\d*)(?:_(.+))?$")
FASES = {"start", "loop", "end"}


def classificar(nome_clipe):
    """'00420_attack03_start' -> codigo, conjunto, categoria, variante, fase, extra."""
    m = PADRAO_NOME.match(nome_clipe)
    if not m:
        return {"codigo": None, "conjunto": None, "categoria": nome_clipe, "variante": "", "fase": "", "extra": ""}
    codigo, cat, var, resto = m.group(1), m.group(2), m.group(3), m.group(4) or ""
    partes = resto.split("_") if resto else []
    fase = partes[-1] if partes and partes[-1] in FASES else ""
    extra = "_".join(p for p in partes if p != fase)
    return {"codigo": codigo, "conjunto": int(codigo[0]), "categoria": cat, "variante": var,
            "fase": fase, "extra": extra}


def raiz_do_corpo(esq):
    filhos = {i: [] for i in range(len(esq.nomes))}
    for i, p in enumerate(esq.pais):
        if 0 <= p < len(esq.nomes):
            filhos[p].append(i)

    def desc(i):
        return sum(1 + desc(c) for c in filhos[i])

    raizes = [i for i, p in enumerate(esq.pais) if p < 0 or p >= len(esq.nomes)]
    candidatos = []
    for r in raizes:
        candidatos += [r] + filhos[r]
        for c in filhos[r]:
            candidatos += filhos[c]
    # prefere nomes de quadril/cintura; senão o de mais descendentes
    for nome in ("waist", "hips", "hip", "pelvis", "spine_01"):
        for i in candidatos:
            if esq.nomes[i].lower() == nome:
                return i
    return max(candidatos, key=desc)


def descendentes(esq, raiz):
    filhos = {}
    for i, p in enumerate(esq.pais):
        filhos.setdefault(p, []).append(i)
    out, pilha = set(), [raiz]
    while pilha:
        i = pilha.pop()
        out.add(i)
        pilha += filhos.get(i, [])
    return out


def _segmentos(mask):
    segs, ini = [], None
    for i, v in enumerate(mask):
        if v and ini is None:
            ini = i
        elif not v and ini is not None:
            segs.append((ini, i - 1))
            ini = None
    if ini is not None:
        segs.append((ini, len(mask) - 1))
    return segs


def _reamostrar(curva, n=AMOSTRAS_CURVA):
    if len(curva) < 2:
        return [float(curva[0]) if len(curva) else 0.0] * n
    x = np.linspace(0, len(curva) - 1, n)
    return [round(float(v), 4) for v in np.interp(x, np.arange(len(curva)), curva)]


def medir(clipe, esq, raiz=None):
    n, fps = clipe.quadros, max(clipe.fps, 1)
    rep = esq.posicoes_repouso
    altura = float(np.ptp(rep[:, 1])) or 1.0
    raiz = raiz_do_corpo(esq) if raiz is None else raiz
    pos = clipe.posicoes / altura
    traj = pos[:, raiz]
    rel = pos - traj[:, None, :]
    # só ossos do corpo (descendentes da raiz); origem e nós soltos carregam o deslocamento
    corpo = descendentes(esq, raiz)
    animados = sorted((clipe.ossos_animados & corpo) - {raiz})

    out = {
        "fps": fps, "quadros": n, "duracao_s": round(n / fps, 3), "altura_m": round(altura, 3),
        "raiz": esq.nomes[raiz],
        "ossos": len(esq.nomes), "ossos_animados": len(clipe.ossos_animados),
        "faixas_densas": clipe.faixas["densa"], "faixas_esparsas": clipe.faixas["esparsa"],
        "faixas_fixas": clipe.faixas["fixa"],
        "chaves_por_faixa_esparsa": round(float(np.mean(clipe.chaves_esparsas)), 2) if clipe.chaves_esparsas else None,
        "desloc_horizontal_H": round(float(np.linalg.norm((traj[-1] - traj[0])[[0, 2]])), 4),
        "subida_max_H": round(float(traj[:, 1].max() - traj[0, 1]), 4),
        "descida_max_H": round(float(traj[0, 1] - traj[:, 1].min()), 4),
    }
    if n < 3 or not animados:
        out["parado"] = True
        return out

    vel = np.gradient(rel[:, animados], axis=0) * fps  # [F, A, 3]
    vel_raiz = np.gradient(traj, axis=0) * fps
    e = np.linalg.norm(vel, axis=2).mean(axis=1)
    pico = int(np.argmax(e))
    e_pico = float(e[pico])
    out["energia_pico_H_s"] = round(e_pico, 4)
    out["vel_raiz_max_H_s"] = round(float(np.linalg.norm(vel_raiz, axis=1).max()), 4)
    out["curva_energia"] = _reamostrar(e / e_pico if e_pico > 0 else e)
    if e_pico < 1e-4:
        out["parado"] = True
        return out

    ativo = e >= LIMIAR_ATIVO * e_pico
    ini = int(np.argmax(ativo))
    fim = int(n - 1 - np.argmax(ativo[::-1]))
    out.update({
        "quadro_pico": pico, "pico_rel": round(pico / (n - 1), 3),
        "inicio_mov": ini, "fim_mov": fim,
        "ate_pico_q": pico - ini, "ate_pico_s": round((pico - ini) / fps, 3),
        "recuperacao_q": fim - pico, "recuperacao_s": round((fim - pico) / fps, 3),
    })

    janela = e[ini:fim + 1]
    out["ease"] = round(float(np.mean(janela < LIMIAR_LENTO * e_pico)), 3)
    out["snap"] = round(float(e_pico / max(np.median(janela), 1e-6)), 3)

    holds = [(a, b) for a, b in _segmentos(e[ini:] < LIMIAR_ATIVO * e_pico) if b - a + 1 >= HOLD_MIN]
    holds = [(a + ini, b + ini) for a, b in holds if b + ini < fim]  # só holds no meio do movimento
    out["holds"] = len(holds)
    out["hold_total_q"] = int(sum(b - a + 1 for a, b in holds))
    out["hold_maior_q"] = int(max((b - a + 1 for a, b in holds), default=0))

    # efetor principal
    caminho = np.linalg.norm(np.diff(rel[:, animados], axis=0), axis=2).sum(axis=0)
    k = int(np.argmax(caminho))
    ef = animados[k]
    p = rel[:, ef]
    v = np.linalg.norm(vel[:, k], axis=1)
    fp = int(np.argmax(v))
    d = vel[fp, k] / max(v[fp], 1e-9)
    s = (p - p[0]) @ d
    out.update({
        "efetor": esq.nomes[ef], "efetor_caminho_H": round(float(caminho[k]), 4),
        "efetor_vel_max_H_s": round(float(v[fp]), 4), "efetor_quadro_pico": fp,
    })
    antes = s[:fp + 1]
    j = int(np.argmin(antes))
    recuo = float(-antes[j])
    golpe = float(s.max() - s.min()) or 1e-9
    tem_antec = recuo > 0.01 and recuo > 0.05 * golpe and j < fp
    out["antecipacao"] = bool(tem_antec)
    out["antecipacao_H"] = round(recuo, 4) if tem_antec else 0.0
    out["antecipacao_q"] = int(max(j - ini, 0)) if tem_antec else 0
    out["antecipacao_rel_golpe"] = round(recuo / golpe, 3) if tem_antec else 0.0
    out["antecipacao_ate_golpe_q"] = int(fp - j) if tem_antec else 0
    alem = float(s[fp:].max() - s[-1])
    out["overshoot_rel"] = round(max(alem, 0.0) / golpe, 3)

    if classificar_fase_loop(clipe):
        dif = np.linalg.norm(rel[-1, sorted(corpo)] - rel[0, sorted(corpo)], axis=1).max()
        out["erro_loop_H"] = round(float(dif), 4)
    return out


def classificar_fase_loop(clipe):
    return getattr(clipe, "eh_loop", False)
