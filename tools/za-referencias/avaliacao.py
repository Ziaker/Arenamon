"""Avaliação cega (Task 9 / 1I): divisão dev/teste sem vazamento, placar, concordância entre revisores e A/B.

Divisão: union-find por TRÊS chaves — cadeia evolutiva, família de rig (ontologia.assinatura_rig) e origem
da animação (mesmo .tranm, ou curva de energia quase idêntica na mesma categoria/fase). Cada componente vai
inteiro para um lado. Os limiares das camadas nunca são ajustados com o conjunto de teste.

A/B: mesmas animações, mesmo gabarito; teste de McNemar exato nos acertos. Sem significância (alfa 0,05),
a conclusão é SEM_DIFERENCA_DEMONSTRAVEL.
"""
import math
import random
from collections import Counter, defaultdict

import numpy as np

CORR_QUASE_IDENTICA = 0.9999
PICO_TOL = 0.01   # energia de pico a até 1% (a curva reamostrada sozinha não separa animações suaves)
ALFA = 0.05
INCONCLUSIVO = "INCONCLUSIVO"


class _UF:
    def __init__(self, n):
        self.p = list(range(n))

    def achar(self, a):
        while self.p[a] != a:
            self.p[a] = self.p[self.p[a]]
            a = self.p[a]
        return a

    def unir(self, a, b):
        ra, rb = self.achar(a), self.achar(b)
        if ra != rb:
            self.p[ra] = rb
            return True
        return False


def origem_de_animacao(clipes):
    """id -> grupo de origem (mesmo arquivo ou quase duplicata). Devolve também as uniões por quase duplicata."""
    uf = _UF(len(clipes))
    por_sha = defaultdict(list)
    for i, c in enumerate(clipes):
        por_sha[c.get("fonte_sha256")].append(i)
    for idx in por_sha.values():
        for j in idx[1:]:
            uf.unir(idx[0], j)
    por_cat = defaultdict(list)
    for i, c in enumerate(clipes):
        if c.get("curva_energia"):
            por_cat[(c.get("categoria"), c.get("fase"))].append(i)
    quase = 0
    for idx in por_cat.values():
        if len(idx) < 2:
            continue
        m = np.array([clipes[i]["curva_energia"] for i in idx], dtype=float)
        m = m - m.mean(axis=1, keepdims=True)
        nrm = np.linalg.norm(m, axis=1)
        ok = nrm > 1e-9
        m[ok] /= nrm[ok][:, None]
        corr = m @ m.T
        quadros = np.array([clipes[i].get("quadros", 0) for i in idx])
        pico = np.array([clipes[i].get("energia_pico_H_s") or 0.0 for i in idx], dtype=float)
        a, b = np.where(np.triu(corr, 1) >= CORR_QUASE_IDENTICA)
        for x, y in zip(a, b):
            mesmo_pico = abs(pico[x] - pico[y]) <= PICO_TOL * max(pico[x], pico[y], 1e-9)
            if ok[x] and ok[y] and quadros[x] == quadros[y] and mesmo_pico and uf.unir(idx[x], idx[y]):
                quase += 1
    return {clipes[i]["id"]: uf.achar(i) for i in range(len(clipes))}, quase


def dividir(clipes, frac_teste=0.3, semente=1025):
    n = len(clipes)
    uf = _UF(n)
    unioes = Counter()
    origem, quase = origem_de_animacao(clipes)
    unioes["origem_quase_duplicata"] = quase
    for chave, valor in (("cadeia", lambda c: c.get("cadeia")), ("familia_rig", lambda c: c.get("assinatura_rig")),
                         ("origem", lambda c: origem[c["id"]])):
        primeiro = {}
        for i, c in enumerate(clipes):
            v = valor(c)
            if v is None:
                continue
            if v in primeiro:
                if uf.unir(primeiro[v], i):
                    unioes[chave] += 1
            else:
                primeiro[v] = i
    comp = defaultdict(list)
    for i in range(n):
        comp[uf.achar(i)].append(i)
    grupos = list(comp.values())
    rnd = random.Random(semente)
    rnd.shuffle(grupos)
    alvo = frac_teste * n
    teste, dev = [], []
    for g in grupos:
        (teste if len(teste) < alvo and len(teste) + len(g) <= alvo * 1.5 + 1 else dev).extend(g)
    maiores = sorted((len(g) for g in grupos), reverse=True)[:5]
    return {"dev": [clipes[i] for i in sorted(dev)], "teste": [clipes[i] for i in sorted(teste)], "grupos": len(grupos),
            "relatorio_vazamento": {"unioes_por_chave": dict(unioes), "maiores_componentes": maiores,
                                    "frac_teste_real": round(len(teste) / n, 3) if n else None}}


def _vazio(v):
    return v is None or v == "" or v == []


def _norm(v):
    return tuple(sorted(v)) if isinstance(v, (list, tuple)) else v


def placar(previsoes, rotulos):
    gab = {r["id"]: r for r in rotulos}
    probs = sorted({k for r in rotulos for k in r if k != "id"})
    out = {}
    for pr in probs:
        acertos = fp = inc_ok = inc_err = com_resposta = n = 0
        for p in previsoes:
            r = gab.get(p["id"])
            if r is None or pr not in r or pr not in p or _vazio(r[pr]) or _vazio(p[pr]):
                continue
            n += 1
            pv, rv = _norm(p[pr]), _norm(r[pr])
            if rv != INCONCLUSIVO:
                com_resposta += 1
            if pv == INCONCLUSIVO:
                if rv == INCONCLUSIVO:
                    inc_ok += 1
                else:
                    inc_err += 1
            elif pv == rv:
                acertos += 1
            else:
                fp += 1
        out[pr] = {"n": n, "precisao": round(acertos / (acertos + fp), 4) if acertos + fp else None,
                   "revocacao": round(acertos / com_resposta, 4) if com_resposta else None,
                   "falsos_positivos": fp, "inconclusivos_corretos": inc_ok, "inconclusivos_errados": inc_err}
    return out


def _cohen(a, b):
    cats = sorted(set(a) | set(b), key=str)
    n = len(a)
    po = sum(x == y for x, y in zip(a, b)) / n
    pe = sum((a.count(c) / n) * (b.count(c) / n) for c in cats)
    return 1.0 if pe == 1 else (po - pe) / (1 - pe)


def _fleiss(matriz):
    """matriz: lista de itens, cada um com os rótulos dos k revisores."""
    k = len(matriz[0])
    cats = sorted({v for linha in matriz for v in linha}, key=str)
    n = len(matriz)
    pj = [sum(linha.count(c) for linha in matriz) / (n * k) for c in cats]
    pi = [(sum(linha.count(c) ** 2 for c in cats) - k) / (k * (k - 1)) for linha in matriz]
    pbar, pe = sum(pi) / n, sum(p * p for p in pj)
    return 1.0 if pe == 1 else (pbar - pe) / (1 - pe)


def concordancia(rotulos_por_revisor):
    revs = sorted(rotulos_por_revisor)
    por_rev = {r: {x["id"]: x for x in rotulos_por_revisor[r]} for r in revs}
    ids = sorted(set.intersection(*(set(v) for v in por_rev.values())), key=str)
    probs = sorted({k for r in revs for x in rotulos_por_revisor[r] for k in x if k != "id"})
    out = {}
    for pr in probs:
        itens = [i for i in ids if all(pr in por_rev[r][i] and not _vazio(por_rev[r][i][pr]) for r in revs)]
        if not itens:
            continue
        mat = [[_norm(por_rev[r][i][pr]) for r in revs] for i in itens]
        res = {"n_itens": len(itens), "discordancias": [i for i, linha in zip(itens, mat) if len(set(linha)) > 1]}
        if len(revs) == 2:
            res["kappa_cohen"] = round(_cohen([l[0] for l in mat], [l[1] for l in mat]), 4)
        else:
            res["kappa_fleiss"] = round(_fleiss(mat), 4)
        out[pr] = res
    return out


def _mcnemar_exato(b, c):
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    p = sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n
    return min(1.0, 2 * p)


def ab(previsoes_a, previsoes_b, gabarito):
    gab = {r["id"]: r for r in gabarito}
    pa = {p["id"]: p for p in previsoes_a}
    pb = {p["id"]: p for p in previsoes_b}
    probs = sorted({k for r in gabarito for k in r if k != "id"})
    out = {}
    for pr in probs:
        b = c = 0
        for i, r in gab.items():
            if i not in pa or i not in pb or pr not in pa[i] or pr not in pb[i] or _vazio(r.get(pr)):
                continue
            ca = _norm(pa[i][pr]) == _norm(r[pr])
            cb = _norm(pb[i][pr]) == _norm(r[pr])
            b += (not ca) and cb
            c += ca and not cb
        p = _mcnemar_exato(b, c)
        concl = ("MELHOROU" if b > c else "PIOROU") if p < ALFA else "SEM_DIFERENCA_DEMONSTRAVEL"
        out[pr] = {"a": placar(previsoes_a, gabarito).get(pr), "b": placar(previsoes_b, gabarito).get(pr),
                   "so_b_acertou": int(b), "so_a_acertou": int(c), "p_mcnemar": round(p, 5), "conclusao": concl}
    return out
