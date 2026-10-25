"""Avaliação cega: divisão sem vazamento, placar, concordância e A/B (Task 9 / 1I)."""
import os
import sys
import unittest

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.dirname(AQUI))

import avaliacao  # noqa: E402


def item(i, cadeia, rig, sha=None, curva=None, cat="attack", fase="", quadros=60):
    return {"id": "c%d" % i, "modelo": "pm%04d_00_00" % i, "clipe": "00400_attack01", "categoria": cat, "fase": fase,
            "cadeia": cadeia, "assinatura_rig": rig, "fonte_sha256": sha or "h%d" % i, "quadros": quadros,
            "curva_energia": curva or [float(v) for v in np.random.RandomState(1000 + i).rand(24)]}


class TestDividir(unittest.TestCase):
    def test_mesma_cadeia_nunca_nos_dois_lados(self):
        cl = [item(i, cadeia=i // 2, rig="r%d" % i) for i in range(40)]
        d = avaliacao.dividir(cl)
        self.assertFalse({c["cadeia"] for c in d["dev"]} & {c["cadeia"] for c in d["teste"]})

    def test_mesmo_rig_de_cadeias_diferentes_fica_junto(self):
        cl = [item(i, cadeia=i, rig="comum" if i < 2 else "r%d" % i) for i in range(40)]
        d = avaliacao.dividir(cl)
        lados = {lado for lado in ("dev", "teste") for c in d[lado] if c["assinatura_rig"] == "comum"}
        self.assertEqual(len(lados), 1)

    def test_animacao_quase_identica_fica_junto(self):
        curva = [float(k % 5) for k in range(24)]
        quase = [v + 0.001 * k for k, v in enumerate(curva)]
        cl = [item(0, 0, "a", curva=curva), item(1, 1, "b", curva=quase)] + [item(i, i, "r%d" % i) for i in range(2, 40)]
        d = avaliacao.dividir(cl)
        lados = {lado for lado in ("dev", "teste") for c in d[lado] if c["id"] in ("c0", "c1")}
        self.assertEqual(len(lados), 1)

    def test_mesmo_arquivo_fica_junto(self):
        cl = [item(0, 0, "a", sha="X"), item(1, 1, "b", sha="X")] + [item(i, i, "r%d" % i) for i in range(2, 40)]
        d = avaliacao.dividir(cl)
        self.assertEqual(len({lado for lado in ("dev", "teste") for c in d[lado] if c["id"] in ("c0", "c1")}), 1)

    def test_relatorio_de_vazamento(self):
        d = avaliacao.dividir([item(i, cadeia=i // 2, rig="r%d" % i) for i in range(40)])
        self.assertIn("unioes_por_chave", d["relatorio_vazamento"])
        self.assertEqual(d["grupos"], 20)


class TestPlacar(unittest.TestCase):
    def test_placar_conta_inconclusivo_correto(self):
        p = avaliacao.placar([{"id": 1, "antecipacao": "INCONCLUSIVO"}], [{"id": 1, "antecipacao": "INCONCLUSIVO"}])
        self.assertEqual(p["antecipacao"]["inconclusivos_corretos"], 1)

    def test_placar_precisao_e_falso_positivo(self):
        prev = [{"id": 1, "x": "sim"}, {"id": 2, "x": "sim"}, {"id": 3, "x": "nao"}]
        gab = [{"id": 1, "x": "sim"}, {"id": 2, "x": "nao"}, {"id": 3, "x": "nao"}]
        p = avaliacao.placar(prev, gab)["x"]
        self.assertEqual(p["falsos_positivos"], 1)
        self.assertAlmostEqual(p["precisao"], 2 / 3, 3)

    def test_listas_comparadas_sem_ordem(self):
        p = avaliacao.placar([{"id": 1, "executores": ["braco_E", "braco_D"]}], [{"id": 1, "executores": ["braco_D", "braco_E"]}])
        self.assertEqual(p["executores"]["precisao"], 1.0)


class TestConcordancia(unittest.TestCase):
    def test_kappa_concordancia_perfeita_e_1(self):
        rot = [{"id": i, "antecipacao": "sim" if i % 2 else "nao"} for i in range(10)]
        self.assertAlmostEqual(avaliacao.concordancia({"r1": rot, "r2": rot})["antecipacao"]["kappa_cohen"], 1.0)

    def test_kappa_e_discordancias(self):
        a = [{"id": i, "x": "sim" if i < 5 else "nao"} for i in range(10)]
        b = [{"id": i, "x": "sim" if i < 4 else "nao"} for i in range(10)]
        c = avaliacao.concordancia({"r1": a, "r2": b})["x"]
        self.assertEqual(c["discordancias"], [4])
        self.assertLess(c["kappa_cohen"], 1.0)

    def test_fleiss_com_tres_revisores(self):
        rot = [{"id": i, "x": "sim" if i % 3 else "nao"} for i in range(9)]
        self.assertAlmostEqual(avaliacao.concordancia({"a": rot, "b": rot, "c": rot})["x"]["kappa_fleiss"], 1.0)


class TestAB(unittest.TestCase):
    def test_ab_sem_diferenca_quando_iguais(self):
        prev = [{"id": i, "x": "sim"} for i in range(20)]
        gab = [{"id": i, "x": "sim" if i % 2 else "nao"} for i in range(20)]
        self.assertEqual(avaliacao.ab(prev, prev, gab)["x"]["conclusao"], "SEM_DIFERENCA_DEMONSTRAVEL")

    def test_ab_melhorou_com_muitas_viradas(self):
        gab = [{"id": i, "x": "sim"} for i in range(20)]
        a = [{"id": i, "x": "nao"} for i in range(20)]
        b = [{"id": i, "x": "sim"} for i in range(20)]
        r = avaliacao.ab(a, b, gab)["x"]
        self.assertEqual(r["conclusao"], "MELHOROU")
        self.assertLess(r["p_mcnemar"], 0.05)


if __name__ == "__main__":
    unittest.main(verbosity=2)
