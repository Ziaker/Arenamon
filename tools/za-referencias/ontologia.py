"""Ontologia funcional do esqueleto e papéis de cada região numa ação (Task 3 / 1C).

regioes()   região de cada osso pelo nome (tokens) + herança do pai.
anatomia()  classe do corpo tirada do próprio esqueleto (não da PokeAPI).
papeis()    quem executa a ação (um ou mais), quem inicia o movimento e quem só acompanha.
            Regras em regras_papeis.json; ossos ocultos por escala (za_anim.ocultos) não contam.

Nada aqui é veredito: o status é CANDIDATO (ou INCONCLUSIVO) até uma revisão humana (REVISADO).
"""
import hashlib
import json
import os
import re

import numpy as np

import za_anim

AQUI = os.path.dirname(os.path.abspath(__file__))

REGIOES = ("nucleo", "pescoco", "cabeca", "mandibula", "lingua", "olho_palpebra",
           "braco_E", "braco_D", "braco_C", "perna_E", "perna_D", "perna_C", "cauda",
           "asa_E", "asa_D", "asa_C", "apendice_sensorial", "cabelo_pelagem", "acessorio", "auxiliar", "raiz", "outro")

_AUX = {"lod", "mesh", "vis", "sorting", "tex", "group", "mod", "particle", "particlea", "particleb", "eff", "raycast"}
_REGRAS_TOKEN = [
    ("olho_palpebra", {"eyelid", "eye", "eyebrow", "eyelash", "eyeball", "brow"}),
    ("lingua", {"tongue"}),
    ("mandibula", {"jaw", "mouth", "teeth", "tooth", "fang", "beak"}),
    ("apendice_sensorial", {"feeler", "ear", "antenna", "whisker", "hige"}),
    ("cabelo_pelagem", {"hair", "fur", "mane", "mustache"}),
    ("acessorio", {"cloth", "skirt", "belt", "cowl", "hat", "shield", "weapon", "scarf", "cape", "ribbon", "bag",
                   "coin", "lamp", "stick", "blaster", "cover", "mask", "firemask", "bodyarmor"}),
    # perna antes de braço: "foot_index"/"foot_claw" são dedos do pé, não da mão
    ("perna", {"leg", "foot", "toe", "thigh", "knee"}),
    ("braco", {"arm", "hand", "shoulder", "finger", "fingerbase", "index", "middle", "ring", "thumb", "pinky",
               "claw", "nail"}),
    ("pescoco", {"neck"}),
    ("nucleo", {"waist", "hips", "spine", "body", "crotch", "center", "chest", "pelvis"}),
]
_PREFIXOS = [("cauda", "tail"), ("asa", "wing"), ("cabeca", "head")]
_EXTRAS = {"sippo": "cauda", "fin": "asa", "horn": "cabeca", "nose": "cabeca", "face": "cabeca"}
_HERDAVEIS = ("braco", "perna", "asa", "cauda", "apendice_sensorial", "cabelo_pelagem", "acessorio", "mandibula",
              "lingua", "cabeca", "olho_palpebra")
# regiões que contam para "quem inicia o movimento" (mecânica do corpo; expressão e balanço secundário não)
_MOTORAS = ("nucleo", "pescoco", "cabeca", "braco", "perna", "cauda", "asa", "mandibula", "lingua")
_LADO = ("braco", "perna", "asa")


def _familia(regiao):
    return regiao.split("_")[0] if regiao.split("_")[0] in _LADO else regiao


def _regiao_por_nome(nome, eh_raiz):
    toks = [t for t in re.split(r"[_\d]+", nome.lower()) if t]
    if eh_raiz and (nome.lower().startswith("pm") or not toks):
        return "raiz"
    if any(t in ("origin", "root") for t in toks):
        return "raiz"
    if any(t in _AUX for t in toks):
        return "auxiliar"
    lado = "E" if "left" in toks else ("D" if "right" in toks else "C")
    achou = None
    for reg, conj in _REGRAS_TOKEN:
        if any(t in conj for t in toks):
            achou = reg
            break
    if achou is None:
        for reg, pref in _PREFIXOS:
            if any(t.startswith(pref) for t in toks):
                achou = reg
                break
    if achou is None:
        for t in toks:
            if t in _EXTRAS:
                achou = _EXTRAS[t]
                break
    if achou in _LADO:
        return "%s_%s" % (achou, lado)
    return achou


def regioes(esq):
    out = [None] * len(esq.nomes)
    for i in esq.ordem:
        p = esq.pais[i]
        tem_pai = 0 <= p < len(esq.nomes)
        r = _regiao_por_nome(esq.nomes[i], not tem_pai)
        if r is None:
            pr = out[p] if tem_pai else None
            r = pr if pr and _familia(pr) in _HERDAVEIS else "outro"
        out[i] = r
    return out


def assinatura_rig(esq):
    """Hash da estrutura (nomes + pais), sem a pose de repouso."""
    pares = sorted("%s|%s" % (n, esq.nomes[p] if 0 <= p < len(esq.nomes) else "") for n, p in zip(esq.nomes, esq.pais))
    return hashlib.sha256("\n".join(pares).encode()).hexdigest()[:16]


def _raizes_de_cadeia(esq, regs, familia):
    out = []
    for i, r in enumerate(regs):
        if _familia(r) != familia:
            continue
        p = esq.pais[i]
        if not (0 <= p < len(regs)) or _familia(regs[p]) != familia:
            out.append(i)
    return out


def _descendentes_na_regiao(esq, regs, i):
    filhos = {}
    for k, p in enumerate(esq.pais):
        filhos.setdefault(p, []).append(k)
    out, pilha = [], [i]
    while pilha:
        k = pilha.pop()
        out.append(k)
        pilha += [c for c in filhos.get(k, []) if regs[c] == regs[i]]
    return out


def anatomia(esq, regs):
    rep = esq.posicoes_repouso
    chao = rep[:, 1].min()
    altura = float(np.ptp(rep[:, 1])) or 1.0
    pernas = len(_raizes_de_cadeia(esq, regs, "perna"))
    bracos = len(_raizes_de_cadeia(esq, regs, "braco"))
    asas = len(_raizes_de_cadeia(esq, regs, "asa"))
    nucleo = sum(1 for r in regs if r == "nucleo")
    maos_no_chao = False
    if bracos >= 2:
        pontas = []
        for raiz in _raizes_de_cadeia(esq, regs, "braco"):
            cadeia = _descendentes_na_regiao(esq, regs, raiz)
            pontas.append(min(rep[k, 1] for k in cadeia))
        maos_no_chao = sum(1 for y in pontas if y - chao <= 0.15 * altura) >= 2
    if asas >= 2 and bracos == 0 and pernas <= 2:
        classe = "alado"
    elif pernas >= 4 or (pernas >= 2 and maos_no_chao):
        classe = "quadrupede"
    elif pernas >= 2:
        classe = "bipede"
    elif pernas == 0 and bracos == 0 and asas == 0:
        classe = "serpentino" if nucleo >= 4 or "cauda" in regs else "sem_membros"
    else:
        classe = "outro"
    return {"pernas": pernas, "bracos": bracos, "asas": asas, "cauda": "cauda" in regs,
            "mandibula": "mandibula" in regs, "lingua": "lingua" in regs, "apendices": "apendice_sensorial" in regs,
            "classe": classe}


def carregar_regras(caminho=None):
    with open(caminho or os.path.join(AQUI, "regras_papeis.json"), encoding="utf-8") as fh:
        return json.load(fh)


def _velocidades(clipe, esq, regs, ocultos):
    """Curvas por região (cinematica.curvas_regiao): ponta relativa à raiz do corpo; núcleo no espaço do modelo."""
    import cinematica
    import metricas
    return cinematica.curvas_regiao(clipe, esq, regs, metricas.raiz_do_corpo(esq), ocultos)


def _angulo_local(clipe, esq, k):
    q = clipe.rot[:, k] / np.linalg.norm(clipe.rot[:, k], axis=1, keepdims=True)
    q0 = esq.rot_repouso[k] / np.linalg.norm(esq.rot_repouso[k])
    d = np.abs(q @ q0)
    return np.degrees(2 * np.arccos(np.clip(d, 0, 1)))


def _percursos(clipe, esq, regs, ocultos):
    import metricas
    altura = float(np.ptp(esq.posicoes_repouso[:, 1])) or 1.0
    raiz = metricas.raiz_do_corpo(esq)
    rel = (clipe.posicoes - clipe.posicoes[:, raiz][:, None, :]) / altura
    passo = np.linalg.norm(np.diff(rel, axis=0), axis=2)
    vis = ~(ocultos[1:] | ocultos[:-1])
    caminho = (passo * vis).sum(axis=0)
    validos = [i for i in range(len(regs)) if regs[i] not in ("raiz", "auxiliar")]
    i = max(validos, key=lambda k: caminho[k]) if validos else 0
    return {"osso": esq.nomes[i], "regiao": regs[i], "caminho_H": round(float(caminho[i]), 4)}


def _flexao_regiao(clipe, esq, regs, reg, a, b):
    """Maior giro (graus) de um osso da região dentro da janela [a, b], medido contra o próprio osso no quadro a."""
    maior = 0.0
    for k in (i for i, r in enumerate(regs) if r == reg):
        q = clipe.rot[a:b + 1, k] / np.linalg.norm(clipe.rot[a:b + 1, k], axis=1, keepdims=True)
        d = np.abs(q @ q[0])
        maior = max(maior, float(np.degrees(2 * np.arccos(np.clip(d, 0, 1))).max()))
    return maior


def _pose_parada(clipe, esq, regs, vels, ocultos, R):
    """Loop de pose (carga, espera): raiz quase imóvel, pontas dos pés paradas no mundo e membros só oscilando.
    Devolve as medidas quando a regra se aplica; None caso contrário."""
    import contato
    import metricas
    P = R.get("pose_parada")
    if not P or not getattr(clipe, "eh_loop", False):
        return None
    altura = float(np.ptp(esq.posicoes_repouso[:, 1])) or 1.0
    raiz = metricas.raiz_do_corpo(esq)
    pos = clipe.posicoes
    exc_raiz = float(np.linalg.norm(pos[:, raiz] - pos[0, raiz], axis=1).max()) / altura
    pontas = [k for k in contato._pontas_de_apoio(esq, regs, ocultos) if _familia(regs[k]) in P["familias_pes"]]
    exc_pes = max((float(np.linalg.norm(pos[:, k] - pos[0, k], axis=1).max()) / altura for k in pontas), default=0.0)
    membros = max((float(v["vel"].max()) for r, v in vels.items() if _familia(r) in P["familias_membros"]), default=0.0)
    if exc_raiz > P["raiz_max_H"] or exc_pes > P["pes_max_H"] or membros > P["membros_max_H_s"]:
        return None
    return {"excursao_raiz_H": round(exc_raiz, 4), "excursao_pes_H": round(exc_pes, 4),
            "pico_membros_H_s": round(membros, 3), "pontas": pontas}


def _patas_dianteiras(esq, regs, ocultos, R):
    """Regiões de braço que são patas dianteiras (ponta toca o chão em repouso), para sair como perna do mesmo lado."""
    if not R.get("patas_no_chao_sao_pernas", {}).get("ativo"):
        return {}
    import contato
    return {regs[k]: "perna" + regs[k][len("braco"):] for k in contato._pontas_de_apoio(esq, regs, ocultos)
            if _familia(regs[k]) == "braco"}


def _renomear_patas(res, troca):
    """Aplica a troca braço → perna nos papéis, juntando duplicatas (fica a primeira ocorrência)."""
    if not troca:
        return res
    for chave in ("executores", "apoio_impulso", "iniciadores", "acompanhantes"):
        vistos, nova = set(), []
        for item in res.get(chave, []):
            item = dict(item, regiao=troca.get(item["regiao"], item["regiao"]))
            if item["regiao"] not in vistos:
                vistos.add(item["regiao"])
                nova.append(item)
        res[chave] = nova
    return res


def papeis(clipe, esq, regs, categoria, anat, regras=None, ocultos=None):
    R = regras or carregar_regras()
    if ocultos is None:
        ocultos = za_anim.ocultos(clipe, esq)
    return _renomear_patas(_papeis(clipe, esq, regs, categoria, anat, R, ocultos), _patas_dianteiras(esq, regs, ocultos, R))


def _papeis(clipe, esq, regs, categoria, anat, R, ocultos):
    vels = _velocidades(clipe, esq, regs, ocultos)
    parada = _pose_parada(clipe, esq, regs, vels, ocultos, R)
    if parada is not None:
        P = R["pose_parada"]
        apoio = [{"regiao": regs[k], "status": "CANDIDATO", "evidencia": {"excursao_pe_H": parada["excursao_pes_H"]}}
                 for k in sorted(parada["pontas"], key=lambda k: regs[k])]
        return {"executores": [], "apoio_impulso": apoio, "iniciadores": [], "acompanhantes": [],
                "maior_percurso": _percursos(clipe, esq, regs, ocultos), "status": "NAO_SE_APLICA",
                "motivo": "pose parada (loop): raiz %.3f H, pés %.3f H, membros até %.2f H/s" % (
                    parada["excursao_raiz_H"], parada["excursao_pes_H"], parada["pico_membros_H_s"]),
                "regra_aplicada": "pose parada: loop com raiz <= %.2f H, pés <= %.2f H e membros <= %.1f H/s fica sem executor" % (
                    P["raiz_max_H"], P["pes_max_H"], P["membros_max_H_s"])}
    if categoria in R.get("reacoes", {}).get("categorias", []):
        ap = R.get("apoio_impulso", {})
        apoio = []
        for r in sorted(set(vels)):
            if _familia(r) not in ap.get("familias", []):
                continue
            g = _flexao_regiao(clipe, esq, regs, r, 0, clipe.quadros - 1)
            if g >= ap["flexao_minima_graus"]:
                apoio.append({"regiao": r, "status": "CANDIDATO",
                              "evidencia": {"flexao_graus": round(g, 1), "janela": [0, clipe.quadros - 1]}})
        return {"executores": [], "apoio_impulso": apoio, "iniciadores": [], "acompanhantes": [],
                "maior_percurso": _percursos(clipe, esq, regs, ocultos), "status": "NAO_SE_APLICA",
                "motivo": "reação (%s): o corpo todo responde, nenhum membro executa" % categoria,
                "regra_aplicada": "reação: %s fica sem executor; pernas que dobram ficam como apoio" % categoria}
    fam_cand = R["candidatas"].get(categoria, R["candidatas"]["_padrao"])
    nunca = set(R["nunca_executa"])
    presentes = set(vels)

    def candidata_base(reg):
        return _familia(reg) in fam_cand and reg not in nunca

    cands = [r for r in presentes if candidata_base(r)]
    # condicionais
    unica = not any(_familia(r) in ("braco", "perna", "asa", "cauda", "cabeca") for r in set(regs))
    picos = {r: (float(v["vel_saida"].max()), int(v["vel_saida"].argmax())) for r, v in vels.items()}
    melhor = max((picos[r] for r in cands), default=(0.0, 0))
    for reg, cond in R["condicionais"].items():
        if reg not in presentes or reg in cands:
            continue
        if cond == "unica_cadeia" and unica:
            cands.append(reg)
        elif cond == "abre_no_pico" and categoria in ("attack", "rangeattack"):
            ang = _angulo_local(clipe, esq, vels[reg]["osso"])
            ref = melhor[1] if melhor[0] > 0 else picos[reg][1]
            a, b = max(0, ref - R["janela_mandibula_q"]), min(len(ang), ref + R["janela_mandibula_q"] + 1)
            if float(np.ptp(ang[a:b])) >= R["abertura_mandibula_graus"]:
                cands.append(reg)
    melhor = max((picos[r] for r in cands), default=(0.0, 0))
    regra = "%s: candidatas=%s; executor >= %.0f%% do maior pico a ±%d q, movendo para fora do corpo" % (
        categoria, "/".join(fam_cand), 100 * R["limiar_executor_frac"], R["janela_executor_q"])

    executores = []
    loco = R.get("locomocao", {})
    if categoria in loco.get("categorias", []):
        # membros alternam: todo membro que cicla conta, sem janela de tempo nem "para fora do corpo"
        membros = [r for r in presentes if _familia(r) in loco["candidatas"] and r not in nunca]
        pk = {r: (float(vels[r]["vel"].max()), int(vels[r]["vel"].argmax())) for r in membros}
        topo = max((v[0] for v in pk.values()), default=0.0)
        if topo >= R["pico_minimo_H_s"]:
            for r in sorted(membros):
                if pk[r][0] >= loco["limiar_frac"] * topo:
                    executores.append({"regiao": r, "osso_ponta": esq.nomes[vels[r]["osso"]], "status": "CANDIDATO",
                                       "evidencia": {"pico_H_s": round(pk[r][0], 3), "quadro_pico": pk[r][1],
                                                     "frac_do_maior": round(pk[r][0] / topo, 3)}})
        melhor = (topo, max(pk.values())[1] if pk else 0)
        regra = "%s (locomoção): membros que ciclam com pico >= %.0f%% do maior" % (categoria, 100 * loco["limiar_frac"])
    elif melhor[0] >= R["pico_minimo_H_s"]:
        for r in sorted(cands):
            pv, pf = picos[r]
            if pv >= R["limiar_executor_frac"] * melhor[0] and abs(pf - melhor[1]) <= R["janela_executor_q"]:
                executores.append({"regiao": r, "osso_ponta": esq.nomes[vels[r]["osso"]], "status": "CANDIDATO",
                                   "evidencia": {"pico_H_s": round(pv, 3), "quadro_pico": pf,
                                                 "frac_do_maior": round(pv / melhor[0], 3)}})
    secundarias = {}   # região -> motivo, para os acompanhantes
    motivo_dom = None
    if categoria not in loco.get("categorias", []):
        cs = R.get("cauda_secundaria")
        if cs and any(_familia(e["regiao"]) in cs["membros"] for e in executores):
            for e in [e for e in executores if _familia(e["regiao"]) == "cauda"]:
                executores.remove(e)
                secundarias[e["regiao"]] = "cauda acompanha o golpe do membro (giro do corpo), não executa"
        dom = R.get("dominancia_executor")
        if dom and executores:
            maior = max((float(v["vel"].max()) for r, v in vels.items() if r not in dom["ignorar"]), default=0.0)
            if maior > 0 and melhor[0] < dom["frac_minima"] * maior:
                executores = []
                motivo_dom = "nenhum membro domina o movimento (candidato mais forte = %.0f%% do maior movimento)" % (
                    100 * melhor[0] / maior)
    executores.sort(key=lambda e: (-e["evidencia"]["frac_do_maior"], e["regiao"]))
    status = "CANDIDATO" if executores else "INCONCLUSIVO"
    motivo = None if executores else (motivo_dom or
        "nenhuma região candidata com pico de avanço >= %.2f H/s" % R["pico_minimo_H_s"])

    # referência de movimento para iniciadores/acompanhantes: maior pico de qualquer região
    ref = max([float(v["vel"].max()) for v in vels.values()] + [0.0])
    movem = [r for r, v in vels.items() if ref > 0 and float(v["vel"].max()) >= R["limiar_movimento_frac"] * ref]
    # iniciador: só regiões motoras, na janela de preparação antes do pico do executor; o início de cada região
    # é onde a subida que leva ao pico dela (dentro da janela) cruza 20% desse pico (busca para trás)
    # sem membro dominante (dominância), a janela continua sendo a do candidato mais forte: o apoio ainda é medido
    t_ref = melhor[1] if (executores or motivo_dom) else (int(max(vels[r]["vel"].argmax() for r in movem)) if movem else 0)
    a_jan = max(0, t_ref - R.get("janela_preparacao_q", 30))
    inicio = {}
    for r in movem:
        if _familia(r) not in _MOTORAS:
            continue
        v = vels[r]["vel"][a_jan:t_ref + 1]
        if len(v) == 0 or v.max() <= 0:
            continue
        pk = int(np.argmax(v))
        lim = R["limiar_inicio_frac"] * float(v[pk])
        k = pk
        while k > 0 and v[k - 1] >= lim:
            k -= 1
        inicio[r] = a_jan + k
    iniciadores = [{"regiao": r, "quadro_inicio": inicio[r]} for r in sorted(inicio, key=lambda r: (inicio[r], r))]
    exec_regs = {e["regiao"] for e in executores}
    t_exec = min((e["evidencia"]["quadro_pico"] for e in executores), default=None)
    # apoio/impulso: pernas que não golpeiam mas dobram (sustentam o peso ou empurram) da preparação até o golpe.
    # Em locomoção as pernas que ciclam são executoras e também apoio (ver abaixo).
    apoio = []
    ap = R.get("apoio_impulso", {})
    if categoria in loco.get("categorias", []):
        # locomoção: a perna que cicla sustenta e empurra; é executora e também apoio/impulso
        for e in executores:
            if _familia(e["regiao"]) in ap.get("familias", []):
                apoio.append({"regiao": e["regiao"], "status": "CANDIDATO",
                              "evidencia": {"locomocao": True, "pico_H_s": e["evidencia"]["pico_H_s"]}})
    elif executores or motivo_dom:
        b_jan = min(clipe.quadros - 1, t_ref + R["janela_executor_q"])
        for r in sorted(presentes):
            if _familia(r) not in ap.get("familias", []) or r in exec_regs:
                continue
            g = _flexao_regiao(clipe, esq, regs, r, a_jan, b_jan)
            if g >= ap["flexao_minima_graus"]:
                apoio.append({"regiao": r, "status": "CANDIDATO",
                              "evidencia": {"flexao_graus": round(g, 1), "janela": [a_jan, b_jan]}})
    acompanhantes = []
    for r in sorted(movem):
        if r in exec_regs:
            continue
        if r in secundarias:
            m = secundarias[r]
        elif r == "olho_palpebra":
            m = "expressão (olho/pálpebra nunca executa golpe)"
        elif r in ("apendice_sensorial", "cabelo_pelagem", "acessorio"):
            m = "movimento secundário de apêndice/cabelo/acessório"
        elif t_exec is not None and int(vels[r]["vel"].argmax()) > t_exec:
            m = "pico %d q depois do executor" % (int(vels[r]["vel"].argmax()) - t_exec)
        else:
            m = "sem avanço próprio que cumpra a regra"
        acompanhantes.append({"regiao": r, "motivo": m})
    return {"executores": executores, "apoio_impulso": apoio, "iniciadores": iniciadores, "acompanhantes": acompanhantes,
            "maior_percurso": _percursos(clipe, esq, regs, ocultos), "status": status, "motivo": motivo,
            "regra_aplicada": regra}


def aplicar_revisoes(res, modelo, clipe, revisoes):
    rev = revisoes.get("%s/%s" % (modelo, clipe))
    if not rev:
        return res
    out = dict(res)
    out["executores"] = [{"regiao": r, "osso_ponta": None, "status": "REVISADO"} for r in rev.get("executores", [])]
    out["status"] = "REVISADO"
    out["revisado_por"] = rev.get("por")
    return out


def carregar_revisoes(caminho=None):
    try:
        with open(caminho or os.path.join(AQUI, "revisoes_efetor.json"), encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def fracao_outro(clipes_ossos_animados, regs):
    """Fração dos ossos animados (união dos clipes) que caem em 'outro'."""
    if not clipes_ossos_animados:
        return 0.0
    return sum(1 for i in clipes_ossos_animados if regs[i] == "outro") / len(clipes_ossos_animados)

