"""Lote retomável: cache por chave, retomada, falha por arquivo (Task 1 / 1A)."""
import os
import shutil
import sys
import tempfile
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

import lote  # noqa: E402


class Medir:
    """Função de medida falsa: conta chamadas; pode falhar ou interromper num índice."""

    def __init__(self, falha_em=None, interrompe_em=None):
        self.chamadas = 0
        self.falha_em = falha_em
        self.interrompe_em = interrompe_em

    def __call__(self, args):
        self.chamadas += 1
        if args["i"] == self.interrompe_em:
            raise KeyboardInterrupt
        if args["i"] == self.falha_em:
            raise ValueError("faixa corrompida")
        return [{"i": args["i"], "dobro": 2 * args["i"]}]


def tarefas(n=5):
    return [{"chave": "k%d" % i, "args": {"i": i}, "arquivo": "f%d.tranm" % i} for i in range(n)]


class TestLote(unittest.TestCase):
    def setUp(self):
        self.cache = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.cache)

    def test_segunda_rodada_usa_cache(self):
        m = Medir()
        lote.rodar(tarefas(), m, self.cache)
        r = lote.rodar(tarefas(), m, self.cache)
        self.assertEqual(m.chamadas, 5)
        self.assertEqual(r["do_cache"], 5)

    def test_retoma_depois_de_interrupcao(self):
        with self.assertRaises(KeyboardInterrupt):
            lote.rodar(tarefas(), Medir(interrompe_em=2), self.cache)
        m = Medir()
        r = lote.rodar(tarefas(), m, self.cache)
        self.assertEqual(m.chamadas, 3)  # 0 e 1 já estavam em cache
        self.assertEqual(r["medidos"] + r["do_cache"], 5)

    def test_falha_num_clipe_nao_para_o_lote(self):
        r = lote.rodar(tarefas(), Medir(falha_em=1), self.cache)
        self.assertEqual(r["falhas"], 1)
        self.assertEqual(r["medidos"], 4)
        self.assertEqual(r["lista_falhas"][0]["arquivo"], "f1.tranm")
        self.assertIn("faixa corrompida", r["lista_falhas"][0]["erro"])

    def test_falha_nao_vai_para_o_cache(self):
        lote.rodar(tarefas(), Medir(falha_em=1), self.cache)
        m = Medir()
        lote.rodar(tarefas(), m, self.cache)
        self.assertEqual(m.chamadas, 1)  # só a que falhou é refeita

    def test_mudar_config_invalida_cache(self):
        m = Medir()
        lote.rodar(tarefas(), m, self.cache, config_hash="a")
        lote.rodar(tarefas(), m, self.cache, config_hash="b")
        self.assertEqual(m.chamadas, 10)

    def test_resultados_na_ordem_das_tarefas(self):
        r = lote.rodar(tarefas(), Medir(), self.cache)
        self.assertEqual([x["i"] for x in r["linhas"]], [0, 1, 2, 3, 4])


if __name__ == "__main__":
    unittest.main(verbosity=2)
