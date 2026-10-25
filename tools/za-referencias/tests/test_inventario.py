"""Inventário do dump e reconciliação banco × busca (Task 1 / 1A)."""
import hashlib
import os
import shutil
import sys
import tempfile
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.dirname(AQUI))

import inventario  # noqa: E402
import metricas  # noqa: E402
from sintetico import c  # noqa: E402


class TestReconciliar(unittest.TestCase):
    def test_reconciliar_soma_exata(self):
        clipes = [c("pm0001_00_00", "00400_attack01"), c("pm0001_00_00", "08000_eye01"),
                  c("pm0002_00_00", "20000_defaultwait01_loop", parado=True)]
        r = inventario.reconciliar(clipes)
        self.assertEqual(r["total"], 3)
        self.assertEqual(r["na_busca"], 1)
        self.assertEqual(r["excluidos"], {"rosto": 1, "parado": 1, "fora_do_padrao": 0})
        self.assertEqual(r["por_grupo"]["2"]["parado"], 1)
        self.assertEqual(r["por_grupo"]["0"]["rosto"], 1)
        self.assertEqual(r["modelos_fora_da_busca"], ["pm0002_00_00"])

    def test_rotulos_tecnicos_sao_os_sem_nome(self):
        clipes = [c("pm0001_00_00", "00400_attack01", nome="bulbasaur"),
                  c("pm9999_00_00", "00400_attack01", especie=9999, nome="pm9999_00_00")]
        self.assertEqual(inventario.reconciliar(clipes)["rotulos_tecnicos"], ["pm9999_00_00"])

    def test_fora_do_padrao_conta_como_excluido_da_norma_mas_fica_na_busca(self):
        r = inventario.reconciliar([c("pm0001_00_00", "categoryin")])
        self.assertEqual(r["excluidos"]["fora_do_padrao"], 1)
        self.assertEqual(r["na_busca"], 1)


class TestClassificar(unittest.TestCase):
    def test_nome_fora_do_padrao_mantem_categoria(self):
        k = metricas.classificar("categoryin")
        self.assertTrue(k["nome_fora_do_padrao"])
        self.assertEqual(k["categoria"], "categoryin")

    def test_nome_no_padrao(self):
        k = metricas.classificar("00420_attack03_start")
        self.assertFalse(k["nome_fora_do_padrao"])
        self.assertEqual((k["categoria"], k["fase"], k["conjunto"]), ("attack", "start", 0))


class TestManifesto(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        d = os.path.join(self.tmp, "pm0001", "pm0001_00_00")
        os.makedirs(d)
        with open(os.path.join(d, "pm0001_00_00_00400_attack01.tranm"), "wb") as fh:
            fh.write(b"abc")
        with open(os.path.join(d, "pm0001_00_00_20000_defaultwait01_loop.tranm"), "wb") as fh:
            fh.write(b"defg")

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_manifesto_tem_hash(self):
        m = {x["clipe"]: x for x in inventario.manifesto(self.tmp)}
        self.assertEqual(m["00400_attack01"]["sha256"], hashlib.sha256(b"abc").hexdigest())
        self.assertEqual(m["00400_attack01"]["bytes"], 3)
        self.assertEqual(m["00400_attack01"]["modelo"], "pm0001_00_00")
        self.assertEqual(m["20000_defaultwait01_loop"]["grupo"], "2")

    def test_manifesto_recusa_caminho_fora_da_raiz(self):
        self.assertFalse(inventario.dentro_da_raiz(self.tmp, os.path.join(self.tmp, "..", "x.tranm")))
        self.assertTrue(inventario.dentro_da_raiz(self.tmp, os.path.join(self.tmp, "pm0001", "a.tranm")))


if __name__ == "__main__":
    unittest.main(verbosity=2)


class TestCacheVeArquivosEditaveis(unittest.TestCase):
    def test_hash_muda_quando_regras_mudam(self):
        import config
        a = config.hash_config()
        p = os.path.join(os.path.dirname(AQUI), "regras_papeis.json")
        orig = open(p, encoding="utf-8").read()
        try:
            open(p, "w", encoding="utf-8").write(orig.replace('"limiar_executor_frac": 0.6', '"limiar_executor_frac": 0.61'))
            self.assertNotEqual(a, config.hash_config())
        finally:
            open(p, "w", encoding="utf-8").write(orig)
