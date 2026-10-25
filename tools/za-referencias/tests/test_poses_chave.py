"""Poses-chave por erro de posição e de orientação (Task 7 / 1G + L10)."""
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

import ontologia  # noqa: E402
import poses_chave  # noqa: E402
import sintetico as S  # noqa: E402
import za_anim  # noqa: E402


def simp(par, **kw):
    esq, c = par
    return poses_chave.simplificar(c, esq, **kw)


def angulo_max(a, b):
    r = np.einsum("fbji,fbjk->fbik", a, b)
    c = np.clip((np.trace(r, axis1=2, axis2=3) - 1) / 2, -1, 1)
    return float(np.degrees(np.arccos(c)).max())


class TestPosesChave(unittest.TestCase):
    def test_movimento_linear_precisa_de_duas_chaves(self):
        self.assertEqual(simp(S.linear())["quadros"], [0, 59])

    def test_uma_dobra_vira_tres_chaves(self):
        q = simp(S.dobra_no_q30())["quadros"]
        self.assertEqual(len(q), 3)
        self.assertIn(30, q)

    def test_torcao_sem_mudar_posicao_exige_chave(self):
        r = simp(S.torcao_de_mao())
        self.assertIn(30, r["quadros"])
        self.assertLessEqual(r["erro_max_graus"], 3.0 + 1e-6)

    def test_extremo_de_rotacao_da_cabeca_e_obrigatorio(self):
        esq, c = S.cabeca_inclina(pico_q=25, graus=20)
        r = poses_chave.simplificar(c, esq, regs=ontologia.regioes(esq))
        self.assertIn(25, r["obrigatorios_por_motivo"]["extremo_rotacao"])

    def test_eventos_obrigatorios_preservados(self):
        esq, c = S.linear()
        self.assertIn(17, poses_chave.simplificar(c, esq, obrigatorios=(17,))["quadros"])

    def test_erro_reconstruido_dentro_das_duas_tolerancias(self):
        esq, c = S.golpe_com_antena()
        r = poses_chave.simplificar(c, esq, tol_H=0.01, tol_graus=3.0)
        pos, rot = poses_chave.reconstruir(c, esq, r["quadros"])
        H = float(np.ptp(esq.posicoes_repouso[:, 1]))
        self.assertLessEqual(np.abs(pos - c.posicoes).max() / H, 0.01 * math.sqrt(3) + 1e-9)
        self.assertLessEqual(np.linalg.norm(pos - c.posicoes, axis=2).max() / H, 0.01 + 1e-9)
        self.assertLessEqual(angulo_max(rot, c.rot_mundo), 3.0 + 1e-6)

    def test_nunca_afirma_chave_autoral(self):
        self.assertEqual(simp(S.linear())["status"], "APROXIMACAO")

    def test_troca_de_visibilidade_e_chave_obrigatoria(self):
        esq, c = S.cauda_escondida()
        r = poses_chave.simplificar(c, esq)
        self.assertIn(15, r["quadros"])
        self.assertIn(15, r["obrigatorios_por_motivo"]["troca_visibilidade"])


class TestChavesDoArquivo(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_concordancia_com_chaves_do_arquivo(self):
        esq = S.humanoide()
        q0 = np.array([1.0, 0, 0, 0])
        q60 = np.array([math.cos(math.radians(30)), math.sin(math.radians(30)), 0, 0])
        arq = S.escrever_tranm(os.path.join(self.tmp, "k.tranm"), 41, 60,
                               {"right_arm": {"rot_quadros": ([0, 20, 40], [q0, q60, q0])}})
        c = za_anim.Clipe(arq, esq)
        self.assertEqual(c.quadros_chave["right_arm"], [0, 20, 40])
        r = poses_chave.simplificar(c, esq)
        self.assertEqual(r["quadros"], [0, 20, 40])
        self.assertEqual(r["concordancia_com_arquivo"], 1.0)
        self.assertEqual(r["cobertura_do_arquivo"], 1.0)


class TestNoBanco(unittest.TestCase):
    def test_medir_grava_poses_chave(self):
        import metricas
        esq, c = S.dobra_no_q30()
        m = metricas.medir(c, esq, categoria="attack")
        self.assertEqual(m["poses_chave_status"], "APROXIMACAO")
        self.assertGreaterEqual(m["poses_chave_n"], 3)
        self.assertAlmostEqual(m["poses_chave_frac"], m["poses_chave_n"] / 60, 3)
        self.assertIn("poses_chave_por_motivo", m)


if __name__ == "__main__":
    unittest.main(verbosity=2)
