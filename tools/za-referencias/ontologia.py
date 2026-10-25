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
           "asa_E", "asa_D", "asa_C", "apendice_sensorial", "cabelo_pelagem", "auxiliar", "raiz", "outro")

_AUX = {"lod", "mesh", "vis", "sorting", "tex", "group", "mod", "particle", "particlea", "particleb", "eff"}
_REGRAS_TOKEN = [
    ("olho_palpebra", {"eyelid", "eye", "eyebrow", "eyelash", "eyeball", "brow"}),
    ("lingua", {"tongue"}),
    ("mandibula", {"jaw", "mouth", "teeth", "tooth", "fang", "beak"}),
    ("apendice_sensorial", {"feeler", "ear", "antenna", "whisker", "hige"}),
    ("cabelo_pelagem", {"hair", "fur", "mane", "mustache"}),
    # perna antes de braço: "foot_index"/"foot_claw" são dedos do pé, não da mão
    ("perna", {"leg", "foot", "toe", "thigh", "knee"}),
    ("braco", {"arm", "hand", "shoulder", "finger", "fingerbase", "index", "middle", "ring", "thumb", "pinky",
               "claw", "nail"}),
    ("pescoco", {"neck"}),
    ("nucleo", {"waist", "hips", "spine", "body", "crotch", "center", "chest", "pelvis"}),
]
_PREFIXOS = [("cauda", "tail"), ("asa", "wing"), ("cabeca", "head")]
_EXTRAS = {"sippo": "cauda", "fin": "asa", "horn": "cabeca", "nose": "cabeca", "face": "cabeca"}
_HERDAVEIS = ("braco", "perna", "asa", "cauda", "apendice_sensorial", "cabelo_pelagem", "mandibula", "lingua",
              "cabeca", "olho_palpebra")
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


def papeis(clipe, esq, regs, categoria, anat, regras=None, ocultos=None):
    R = regras or carregar_regras()
    if ocultos is None:
        ocultos = za_anim.ocultos(clipe, esq)
    vels = _velocidades(clipe, esq, regs, ocultos)
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
    if melhor[0] >= R["pico_minimo_H_s"]:
        for r in sorted(cands):
            pv, pf = picos[r]
            if pv >= R["limiar_executor_frac"] * melhor[0] and abs(pf - melhor[1]) <= R["janela_executor_q"]:
                executores.append({"regiao": r, "osso_ponta": esq.nomes[vels[r]["osso"]], "status": "CANDIDATO",
                                   "evidencia": {"pico_H_s": round(pv, 3), "quadro_pico": pf,
                                                 "frac_do_maior": round(pv / melhor[0], 3)}})
    status = "CANDIDATO" if executores else "INCONCLUSIVO"
    motivo = None if executores else (
        "nenhuma região candidata com pico de avanço >= %.2f H/s" % R["pico_minimo_H_s"])

    # referência de movimento para iniciadores/acompanhantes: maior pico de qualquer região
    ref = max([float(v["vel"].max()) for v in vels.values()] + [0.0])
    movem = [r for r, v in vels.items() if ref > 0 and float(v["vel"].max()) >= R["limiar_movimento_frac"] * ref]
    inicio = {}
    for r in movem:
        v = vels[r]["vel"]
        lim = R["limiar_inicio_frac"] * float(v.max())
        inicio[r] = int(np.argmax(v >= lim))
    iniciadores = [{"regiao": r, "quadro_inicio": inicio[r]} for r in sorted(movem, key=lambda r: (inicio[r], r))]
    exec_regs = {e["regiao"] for e in executores}
    t_exec = min((e["evidencia"]["quadro_pico"] for e in executores), default=None)
    acompanhantes = []
    for r in sorted(movem):
        if r in exec_regs:
            continue
        if r == "olho_palpebra":
            m = "expressão (olho/pálpebra nunca executa golpe)"
        elif r in ("apendice_sensorial", "cabelo_pelagem"):
            m = "movimento secundário de apêndice/cabelo"
        elif t_exec is not None and int(vels[r]["vel"].argmax()) > t_exec:
            m = "pico %d q depois do executor" % (int(vels[r]["vel"].argmax()) - t_exec)
        else:
            m = "sem avanço próprio que cumpra a regra"
        acompanhantes.append({"regiao": r, "motivo": m})
    return {"executores": executores, "iniciadores": iniciadores, "acompanhantes": acompanhantes,
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

