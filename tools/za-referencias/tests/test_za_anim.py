"""Decodificador .tranm/.trskl e cinemática direta (Task 2 / 1B). Usa .tranm sintéticos montados com flatbuffers."""
import math
import os
import shutil
import sys
import tempfile
import unittest

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.dirname(AQUI))

import za_anim  # noqa: E402
from sintetico import empacotar_quat, escrever_tranm  # noqa: E402


def rx(a):
    return np.array([[1, 0, 0], [0, math.cos(a), -math.sin(a)], [0, math.sin(a), math.cos(a)]])


def ry(a):
    return np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])


def rz(a):
    return np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]])


def esq_cadeia():
    """raiz -> braco -> mao, cada um a 1 m do pai no eixo X."""
    ident = np.array([1.0, 0, 0, 0])
    return za_anim.Esqueleto.de_arrays(["raiz", "braco", "mao"], [-1, 0, 1],
                                       np.array([[0, 0, 0], [1.0, 0, 0], [1.0, 0, 0]]), np.tile(ident, (3, 1)))


class TestQuaternions(unittest.TestCase):
    def test_quat_desempacotado_unitario(self):
        # Só quaternions válidos: triplas de 16 bits aleatórias codificam componentes até pi/4 (> 1/sqrt(2)),
        # que nenhum quaternion unitário produz. Por isso a amostra parte de quaternions unitários aleatórios.
        rng = np.random.default_rng(1025)
        for q in rng.normal(size=(50, 4)):
            q /= np.linalg.norm(q)
            self.assertAlmostEqual(float(np.linalg.norm(za_anim._desempacotar_quat(*empacotar_quat(q)))), 1.0, 4)

    def test_empacotar_desempacotar_ida_e_volta(self):
        q = np.array([0.8, 0.2, -0.5, 0.26])
        q /= np.linalg.norm(q)
        r = np.array(za_anim._desempacotar_quat(*empacotar_quat(q)))
        self.assertLess(min(np.abs(r - q).max(), np.abs(r + q).max()), 1e-4)

    def test_euler_igual_matriz_de_referencia(self):
        m = za_anim.quat_para_matriz(za_anim.euler_xyz_para_quat(0.3, -0.7, 1.1))
        np.testing.assert_allclose(m, rz(1.1) @ ry(-0.7) @ rx(0.3), atol=1e-9)


class TestEsqueleto(unittest.TestCase):
    def test_pai_depois_do_filho_na_lista(self):
        ident = np.array([1.0, 0, 0, 0])
        esq = za_anim.Esqueleto.de_arrays(["a", "b", "c"], [2, -1, 1], np.zeros((3, 3)), np.tile(ident, (3, 1)))
        self.assertEqual(sorted(esq.ordem), [0, 1, 2])
        self.assertLess(esq.ordem.index(1), esq.ordem.index(2))
        self.assertLess(esq.ordem.index(2), esq.ordem.index(0))

    def test_fk_completa_gira_filhos(self):
        esq = esq_cadeia()
        loc = esq.loc_repouso[None].copy()
        rot = esq.rot_repouso[None].copy()
        rot[0, 1] = [math.cos(math.pi / 4), 0, 0, math.sin(math.pi / 4)]  # braço gira 90° em Z
        pos, rmundo = esq.fk_completa(loc, rot)
        np.testing.assert_allclose(pos[0, 2], [1, 1, 0], atol=1e-9)
        np.testing.assert_allclose(rmundo[0, 2], rz(math.pi / 2), atol=1e-9)


class TestClipe(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_faixa_com_osso_inexistente_e_contada(self):
        esq = esq_cadeia()
        q90 = [math.cos(math.pi / 4), 0, 0, math.sin(math.pi / 4)]
        arq = escrever_tranm(os.path.join(self.tmp, "a.tranm"), 5, 60,
                             {"braco": {"rot_fixa": q90}, "nao_existe": {"rot_fixa": q90}})
        c = za_anim.Clipe(arq, esq)
        self.assertEqual(c.faixas_sem_osso, 1)
        np.testing.assert_allclose(c.posicoes[0, 2], [1, 1, 0], atol=1e-3)

    def test_interpolacao_esparsa_slerp(self):
        esq = esq_cadeia()
        q0 = np.array([1.0, 0, 0, 0])
        q1 = np.array([math.cos(math.pi / 4), 0, 0, math.sin(math.pi / 4)])
        arq = escrever_tranm(os.path.join(self.tmp, "b.tranm"), 11, 60,
                             {"braco": {"rot_quadros": ([0, 10], [q0, q1])}})
        c = za_anim.Clipe(arq, esq)
        meio = np.array([math.cos(math.pi / 8), 0, 0, math.sin(math.pi / 8)])
        self.assertLess(min(np.abs(c.rot[5, 1] - meio).max(), np.abs(c.rot[5, 1] + meio).max()), 1e-3)
        self.assertEqual(c.faixas["esparsa"], 1)

    def test_escala_animada_marcada(self):
        esq = esq_cadeia()
        escala = np.ones((10, 3, 3))
        escala[5, 2] = [1.3, 1.0, 1.0]
        c = za_anim.Clipe.de_arrays(esq, 60, np.repeat(esq.loc_repouso[None], 10, 0),
                                    np.repeat(esq.rot_repouso[None], 10, 0), escala=escala)
        self.assertTrue(c.escala_animada)
        self.assertAlmostEqual(c.escala_max_desvio, 0.3, 3)

    def test_escala_unitaria_nao_marca(self):
        esq = esq_cadeia()
        c = za_anim.Clipe.de_arrays(esq, 60, np.repeat(esq.loc_repouso[None], 4, 0),
                                    np.repeat(esq.rot_repouso[None], 4, 0))
        self.assertFalse(c.escala_animada)

    def test_escala_lida_do_arquivo(self):
        esq = esq_cadeia()
        arq = escrever_tranm(os.path.join(self.tmp, "c.tranm"), 4, 60, {"mao": {"escala_fixa": [1.5, 1.0, 1.0]}})
        c = za_anim.Clipe(arq, esq)
        self.assertTrue(c.escala_animada)
        self.assertAlmostEqual(c.escala_max_desvio, 0.5, 4)


class TestMetricasRegistramDecodificacao(unittest.TestCase):
    def test_medir_grava_escala_e_faixas_sem_osso(self):
        import metricas
        esq = esq_cadeia()
        escala = np.ones((10, 3, 3))
        escala[5, 2] = [1.3, 1.0, 1.0]
        c = za_anim.Clipe.de_arrays(esq, 60, np.repeat(esq.loc_repouso[None], 10, 0),
                                    np.repeat(esq.rot_repouso[None], 10, 0), escala=escala)
        c.faixas_sem_osso = 2
        m = metricas.medir(c, esq)
        self.assertEqual(m["faixas_sem_osso"], 2)
        self.assertTrue(m["escala_animada"])
        self.assertAlmostEqual(m["escala_max_desvio"], 0.3, 3)


class TestCompensacaoDeEscala(unittest.TestCase):
    """Rig do Z-A: com compensação (inherit_scale do trskl), a escala do pai move a posição do filho mas
    não escala os eixos dele; sem compensação, a escala se acumula na cadeia."""

    def _clipe(self, compensa):
        ident = np.array([1.0, 0, 0, 0])
        esq = za_anim.Esqueleto.de_arrays(["raiz", "braco", "mao", "dedo"], [-1, 0, 1, 2],
                                          np.array([[0, 0, 0], [1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0]]),
                                          np.tile(ident, (4, 1)), compensa_escala=compensa)
        escala = np.ones((1, 4, 3))
        escala[0, 1] = [2.0, 2.0, 2.0]   # braço com escala 2
        return esq, za_anim.Clipe.de_arrays(esq, 60, esq.loc_repouso[None], esq.rot_repouso[None], escala=escala)

    def test_escala_do_pai_move_filho_com_compensacao(self):
        esq, c = self._clipe([False, False, True, True])
        np.testing.assert_allclose(c.posicoes[0, 2], [3, 0, 0], atol=1e-9)   # 1 + 2*1
        np.testing.assert_allclose(c.posicoes[0, 3], [4, 0, 0], atol=1e-9)   # mão compensa: dedo a 1 m dela
        np.testing.assert_allclose(c.rot_mundo[0, 2], np.eye(3), atol=1e-9)

    def test_escala_se_acumula_sem_compensacao(self):
        esq, c = self._clipe([False, False, False, False])
        np.testing.assert_allclose(c.posicoes[0, 3], [5, 0, 0], atol=1e-9)   # 1 + 2 + 2

    def test_rot_mundo_e_rotacao_pura(self):
        esq, c = self._clipe([False, False, False, False])
        np.testing.assert_allclose(c.rot_mundo[0, 3] @ c.rot_mundo[0, 3].T, np.eye(3), atol=1e-9)


if __name__ == "__main__":
    unittest.main(verbosity=2)
