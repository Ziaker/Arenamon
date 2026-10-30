"""Folhas visuais multivista: escolha de quadros e de vistas independentes (Task 6 / 1F)."""
import os
import sys
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.dirname(AQUI))

import folhas_visuais  # noqa: E402


class TestQuadros(unittest.TestCase):
    def test_quadros_incluem_inicio_pico_fim_de_cada_evento(self):
        q = folhas_visuais.quadros_para_folha([{"inicio": 5, "pico": 20, "fim": 40}, {"inicio": 50, "pico": 60, "fim": 80}], 100)
        self.assertTrue({5, 20, 40, 50, 60, 80} <= set(q))
        self.assertEqual(q, sorted(q))

    def test_limite_prioriza_os_picos(self):
        ev = [{"inicio": 10 * i, "pico": 10 * i + 4, "fim": 10 * i + 8} for i in range(5)]
        q = folhas_visuais.quadros_para_folha(ev, 60, limite=6)
        self.assertEqual(len(q), 6)
        self.assertTrue({4, 14, 24, 34, 44} <= set(q))

    def test_sem_eventos_amostra_o_clipe(self):
        q = folhas_visuais.quadros_para_folha([], 61, limite=5)
        self.assertEqual(q, [0, 15, 30, 45, 60])


class TestVistas(unittest.TestCase):
    def test_vistas_com_menos_de_35_graus_nao_contam_como_duas(self):
        self.assertEqual(len(folhas_visuais.vistas_independentes([(1, 0, 0), (0.95, 0.31, 0)])), 1)

    def test_vistas_perpendiculares_contam(self):
        self.assertEqual(len(folhas_visuais.vistas_independentes([(1, 0, 0), (0, 1, 0), (0.9, 0.1, 0)])), 2)

    def test_par_padrao_tem_duas_vistas_independentes(self):
        par = folhas_visuais.par_de_vistas()
        self.assertEqual(len(par), 2)
        self.assertEqual(len(folhas_visuais.vistas_independentes([v["direction"] for v in par])), 2)


class TestEstados(unittest.TestCase):
    def test_oculto_por_escala_separado_de_nao_observavel(self):
        self.assertEqual(folhas_visuais.estado_regiao(oculto=True, visivel_na_camera=False), "OCULTO_POR_ESCALA")
        self.assertEqual(folhas_visuais.estado_regiao(oculto=False, visivel_na_camera=False), "NAO_OBSERVAVEL")
        self.assertEqual(folhas_visuais.estado_regiao(oculto=False, visivel_na_camera=True), "OBSERVAVEL")


if __name__ == "__main__":
    unittest.main(verbosity=2)
