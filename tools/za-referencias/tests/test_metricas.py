"""Campos que metricas.medir grava por clipe (integração das camadas)."""
import os
import sys
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.dirname(AQUI))

import metricas  # noqa: E402
import sintetico as S  # noqa: E402


class TestPapeisNoBanco(unittest.TestCase):
    def test_medir_grava_papeis(self):
        esq, c = S.golpe_dois_bracos()
        m = metricas.medir(c, esq, categoria="attack")
        self.assertEqual(m["papeis_status"], "CANDIDATO")
        self.assertEqual(sorted(m["executores"]), ["braco_D", "braco_E"])
        self.assertIn("iniciador", m)
        self.assertIn(m["maior_percurso_regiao"], ("braco_D", "braco_E"))  # os dois braços percorrem o mesmo caminho
        self.assertEqual(m["anatomia_classe"], "bipede")

    def test_medir_conta_ocultos(self):
        esq, c = S.cauda_escondida()
        m = metricas.medir(c, esq, categoria="attack")
        self.assertTrue(m["partes_ocultas"])
        self.assertEqual(m["executores"], ["braco_D"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
