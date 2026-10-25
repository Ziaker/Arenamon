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

from config import AMOSTRAS_CURVA, HOLD_MIN, LIMIAR_ATIVO, LIMIAR_LENTO

PADRAO_NOME = re.compile(r"^(\d{5})_([a-z]+?)(\d*)(?:_(.+))?$")
FASES = {"start", "loop", "end"}


def classificar(nome_clipe):
    """'00420_attack03_start' -> codigo, conjunto, categoria, variante, fase, extra."""
    m = PADRAO_NOME.match(nome_clipe)
    if not m:
        return {"codigo": None, "conjunto": None, "categoria": nome_clipe, "variante": "", "fase": "", "extra": "",
                "nome_fora_do_padrao": True}
    codigo, cat, var, resto = m.group(1), m.group(2), m.group(3), m.group(4) or ""
    partes = resto.split("_") if resto else []
    fase = partes[-1] if partes and partes[-1] in FASES else ""
    extra = "_".join(p for p in partes if p != fase)
    return {"codigo": codigo, "conjunto": int(codigo[0]), "categoria": cat, "variante": var,
            "fase": fase, "extra": extra, "nome_fora_do_padrao": False}


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


def medir(clipe, esq, raiz=None, categoria=None, regs=None, anat=None):
    import cinematica
    import ontologia
    import za_anim
    n, fps = clipe.quadros, max(clipe.fps, 1)
    rep = esq.posicoes_repouso
    altura = float(np.ptp(rep[:, 1])) or 1.0
    raiz = raiz_do_corpo(esq) if raiz is None else raiz
    regs = regs or ontologia.regioes(esq)
    anat = anat or ontologia.anatomia(esq, regs)
    oc = za_anim.ocultos(clipe, esq)
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
        "faixas_sem_osso": getattr(clipe, "faixas_sem_osso", 0),
        "escala_animada": bool(getattr(clipe, "escala_animada", False)),
        "escala_max_desvio": round(float(getattr(clipe, "escala_max_desvio", 0.0)), 4),
        "chaves_por_faixa_esparsa": round(float(np.mean(clipe.chaves_esparsas)), 2) if clipe.chaves_esparsas else None,
        "desloc_horizontal_H": round(float(np.linalg.norm((traj[-1] - traj[0])[[0, 2]])), 4),
        "subida_max_H": round(float(traj[:, 1].max() - traj[0, 1]), 4),
        "descida_max_H": round(float(traj[0, 1] - traj[:, 1].min()), 4),
    }
    out.update(_camada_papeis(clipe, esq, categoria, regs, anat, oc))
    if n < 3 or not animados:
        out.update({"parado": True, "status": "INCONCLUSIVO"})
        return out

    # velocidade com máscara de visibilidade: osso oculto (ou na troca) não conta como movimento
    vis = ~oc
    troca = np.zeros_like(oc)
    troca[1:] = oc[1:] != oc[:-1]
    troca[:-1] |= troca[1:]
    mask = (vis & ~troca).astype(float)
    vel_todos = np.gradient(rel, axis=0) * fps  # [F, B, 3]
    vel = vel_todos[:, animados] * mask[:, animados][:, :, None]
    vel_raiz = np.gradient(traj, axis=0) * fps
    e = np.linalg.norm(vel, axis=2).mean(axis=1)
    pico = int(np.argmax(e))
    e_pico = float(e[pico])
    out["energia_pico_H_s"] = round(e_pico, 4)
    out["vel_raiz_max_H_s"] = round(float(np.linalg.norm(vel_raiz, axis=1).max()), 4)
    out["curva_energia"] = _reamostrar(e / e_pico if e_pico > 0 else e)
    if e_pico < 1e-4:
        out.update({"parado": True, "status": "INCONCLUSIVO"})
        return out
    out["status"] = "MEDIDO"

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

    # antecipação/overshoot: pelo executor (Task 3) e, para comparação, pelo osso de maior percurso
    caminho = np.linalg.norm(np.diff(rel[:, animados], axis=0), axis=2) * mask[1:, animados]
    caminho = caminho.sum(axis=0)
    k_mp = animados[int(np.argmax(caminho))]
    mp = _antecipacao(rel, vel_todos, mask, k_mp, ini)
    out.update({"efetor_maior_percurso": esq.nomes[k_mp],
                "efetor_caminho_H": round(float(caminho.max()), 4)})
    out.update({k + "_maior_percurso": v for k, v in mp.items() if k != "efetor"})
    exec_ossos = [esq.indice[o] for o in out.get("executores_ossos", []) if o in esq.indice]
    k_ex = exec_ossos[0] if exec_ossos else k_mp
    out["antecipacao_base"] = "executor" if exec_ossos else "maior_percurso"
    out["antecipacao_osso"] = esq.nomes[k_ex]
    out.update(_antecipacao(rel, vel_todos, mask, k_ex, ini))
    out["efetor"] = esq.nomes[k_ex]

    # camada cinemática (Task 4)
    curvas = cinematica.curvas_regiao(clipe, esq, regs, raiz, oc)
    reg_ex = out["executores"][0] if out.get("executores") else None
    base_ev = curvas[reg_ex]["vel"] if reg_ex in curvas else e
    ev = cinematica.eventos(base_ev, fps)
    out["eventos"] = ev[:6]
    out["n_eventos"] = len(ev)
    out["ordem_ativacao"] = [x["regiao"] for x in cinematica.ordem_ativacao(curvas, (0, n - 1))]
    if reg_ex in curvas:
        apend = [r for r in curvas if r in ("cauda", "apendice_sensorial", "cabelo_pelagem") or
                 (r.startswith("asa") and r not in out["executores"])]
        out["follow_through"] = cinematica.follow_through(curvas, reg_ex, apend)
    esc = cinematica.escala_regiao(clipe, esq, regs, oc, quadro_evento=ev[0]["pico"] if ev else None)
    out["escala_regioes"] = esc
    out["squash_stretch_regioes"] = sorted(r for r, d in esc.items() if d["tipo"] == "squash_stretch")
    out["trocas_visibilidade_n"] = len(cinematica.trocas_de_visibilidade(oc, esq))

    # poses-chave (Task 7): aproximação controlada por erro; eventos do executor são obrigatórios
    import poses_chave
    obrig = sorted({q for e_ in ev for q in (e_["inicio"], e_["pico"], e_["fim"])})
    pc = poses_chave.simplificar(clipe, esq, obrigatorios=obrig, regs=regs, ocultos=oc)
    out.update({"poses_chave_status": pc["status"], "poses_chave_n": len(pc["quadros"]),
                "poses_chave_frac": round(len(pc["quadros"]) / n, 4), "poses_chave_quadros": pc["quadros"][:80],
                "poses_chave_por_motivo": {k: len(v) for k, v in pc["obrigatorios_por_motivo"].items()},
                "poses_chave_erro_max_H": pc["erro_max_H"], "poses_chave_erro_max_graus": pc["erro_max_graus"],
                "arquivo_quadros_fortes_n": pc["chaves_do_arquivo_n"],
                "arquivo_densidade_chaves": pc["densidade_chaves_arquivo"],
                "poses_chave_concordancia_arquivo": pc["concordancia_com_arquivo"],
                "poses_chave_cobertura_arquivo": pc["cobertura_do_arquivo"]})

    if categoria in CATEGORIAS_LOCOMOCAO:
        out.update(_camada_locomocao(clipe, esq, regs, oc))

    if classificar_fase_loop(clipe):
        dif = np.linalg.norm(rel[-1, sorted(corpo)] - rel[0, sorted(corpo)], axis=1).max()
        out["erro_loop_H"] = round(float(dif), 4)
    return out


CATEGORIAS_LOCOMOCAO = ("walk", "run", "backwalk", "turnmove", "dash", "fly")


def _camada_locomocao(clipe, esq, regs, oc):
    """Apoio e locomoção (Task 5): três níveis de contato; escorregão só com plano estável."""
    import contato
    ch = contato.plano_chao(clipe, esq, regs, oc)
    ap = contato.apoio_por_pe(clipe, esq, regs, ch, ocultos=oc)
    lo = contato.locomocao(ap, clipe, esq, ch)
    ms = contato.massa_sobre_base(clipe, esq, ap)
    return {"chao_estavel": ch["estavel"], "apoio_status": ap["status"], "locomocao_modo": lo["modo"],
            "cadencia_passos_s": lo["cadencia_passos_s"], "simetria_apoio": lo["simetria"],
            "escorregoes_n": len(lo["escorregoes"]), "escorregoes": lo["escorregoes"][:6],
            "locomocao_motivos": (ap["motivos"] or []) + (lo.get("motivos") or []),
            "massa_dentro_da_base_frac": ms["dentro_da_base_frac"]}


def _antecipacao(rel, vel_todos, mask, k, ini):
    """Recuo do osso k contra a direção do golpe antes do pico de velocidade dele (e overshoot depois)."""
    p = rel[:, k]
    vv = vel_todos[:, k] * mask[:, k][:, None]
    v = np.linalg.norm(vv, axis=1)
    fp = int(np.argmax(v))
    d = vv[fp] / max(v[fp], 1e-9)
    s = (p - p[0]) @ d
    antes = s[:fp + 1]
    j = int(np.argmin(antes))
    recuo = float(-antes[j])
    golpe = float(s.max() - s.min()) or 1e-9
    tem = recuo > 0.01 and recuo > 0.05 * golpe and j < fp
    alem = float(s[fp:].max() - s[-1])
    return {"efetor": None, "efetor_vel_max_H_s": round(float(v[fp]), 4), "efetor_quadro_pico": fp,
            "antecipacao": bool(tem), "antecipacao_H": round(recuo, 4) if tem else 0.0,
            "antecipacao_q": int(max(j - ini, 0)) if tem else 0,
            "antecipacao_rel_golpe": round(recuo / golpe, 3) if tem else 0.0,
            "antecipacao_ate_golpe_q": int(fp - j) if tem else 0,
            "overshoot_rel": round(max(alem, 0.0) / golpe, 3)}


def _camada_papeis(clipe, esq, categoria, regs=None, anat=None, oc=None):
    """Papéis na ação (Task 3): executores, iniciador, maior percurso, anatomia, partes ocultas."""
    import ontologia
    import za_anim
    regs = regs or ontologia.regioes(esq)
    anat = anat or ontologia.anatomia(esq, regs)
    oc = za_anim.ocultos(clipe, esq) if oc is None else oc
    if clipe.quadros < 3:
        return {"papeis_status": "INCONCLUSIVO", "executores": [], "iniciador": None,
                "maior_percurso_regiao": None, "anatomia_classe": anat["classe"], "partes_ocultas": bool(oc.any())}
    p = ontologia.papeis(clipe, esq, regs, categoria or "_padrao", anat, ocultos=oc)
    return {"papeis_status": p["status"], "executores": [e["regiao"] for e in p["executores"]],
            "executores_ossos": [e["osso_ponta"] for e in p["executores"]],
            "iniciador": p["iniciadores"][0]["regiao"] if p["iniciadores"] else None,
            "acompanhantes": [a["regiao"] for a in p["acompanhantes"]],
            "maior_percurso_regiao": p["maior_percurso"]["regiao"], "maior_percurso_osso": p["maior_percurso"]["osso"],
            "anatomia_classe": anat["classe"], "partes_ocultas": bool(oc.any()),
            "partes_ocultas_ossos": int(oc.any(axis=0).sum())}


def classificar_fase_loop(clipe):
    return getattr(clipe, "eh_loop", False)
