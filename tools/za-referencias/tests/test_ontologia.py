"""Ontologia funcional, papéis na ação e máscara de visibilidade (Task 3 / 1C)."""
import os
import sys
import unittest

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.dirname(AQUI))

import config  # noqa: E402
import ontologia  # noqa: E402
import sintetico as S  # noqa: E402
import za_anim  # noqa: E402


def papeis(par, categoria="attack"):
    esq, c = par
    regs = ontologia.regioes(esq)
    return ontologia.papeis(c, esq, regs, categoria, ontologia.anatomia(esq, regs))


def regs_exec(r):
    return sorted(e["regiao"] for e in r["executores"])


class TestRegioes(unittest.TestCase):
    def test_tokens_basicos(self):
        esq = S.humanoide()
        r = dict(zip(esq.nomes, ontologia.regioes(esq)))
        self.assertEqual(r["waist"], "nucleo")
        self.assertEqual(r["right_hand"], "braco_D")
        self.assertEqual(r["left_foot"], "perna_E")
        self.assertEqual(r["jaw"], "mandibula")
        self.assertEqual(r["left_eyelid"], "olho_palpebra")
        self.assertEqual(r["left_feeler_b"], "apendice_sensorial")
        self.assertEqual(r["tail_02"], "cauda")
        self.assertEqual(r["origin"], "raiz")

    def test_dedos_herdam_braco_e_cabelo_e_regiao_propria(self):
        nomes = ["origin", "waist", "right_arm", "right_index_01", "right_thumb", "hair_a", "left_wing_a", "lod_mesh_01"]
        pais = [-1, 0, 1, 2, 2, 1, 1, 0]
        esq = za_anim.Esqueleto.de_arrays(nomes, pais, np.zeros((8, 3)), np.tile([1.0, 0, 0, 0], (8, 1)))
        r = dict(zip(nomes, ontologia.regioes(esq)))
        self.assertEqual(r["right_index_01"], "braco_D")
        self.assertEqual(r["right_thumb"], "braco_D")
        self.assertEqual(r["hair_a"], "cabelo_pelagem")
        self.assertEqual(r["left_wing_a"], "asa_E")
        self.assertEqual(r["lod_mesh_01"], "auxiliar")


class TestAnatomia(unittest.TestCase):
    def test_anatomia_quadrupede(self):
        esq = S.quadrupede()
        self.assertEqual(ontologia.anatomia(esq, ontologia.regioes(esq))["classe"], "quadrupede")

    def test_anatomia_bipede(self):
        esq = S.humanoide()
        a = ontologia.anatomia(esq, ontologia.regioes(esq))
        self.assertEqual(a["classe"], "bipede")
        self.assertTrue(a["mandibula"])
        self.assertTrue(a["cauda"])

    def test_anatomia_serpentino(self):
        esq = S.serpente()
        self.assertEqual(ontologia.anatomia(esq, ontologia.regioes(esq))["classe"], "serpentino")

    def test_assinatura_ignora_pose_de_repouso(self):
        a = S.humanoide()
        b = za_anim.Esqueleto.de_arrays(a.nomes, a.pais, a.loc_repouso * 2, a.rot_repouso)
        self.assertEqual(ontologia.assinatura_rig(a), ontologia.assinatura_rig(b))
        self.assertNotEqual(ontologia.assinatura_rig(a), ontologia.assinatura_rig(S.quadrupede()))


class TestOcultos(unittest.TestCase):
    def test_osso_com_escala_zero_fica_oculto(self):
        esq, c = S.cauda_escondida()
        o = za_anim.ocultos(c, esq)
        self.assertTrue(o[0, esq.indice["tail_01"]])
        self.assertFalse(o[20, esq.indice["tail_01"]])

    def test_filho_de_osso_oculto_fica_oculto(self):
        esq, c = S.cauda_escondida()
        o = za_anim.ocultos(c, esq)
        self.assertTrue(o[5, esq.indice["tail_02"]])
        self.assertFalse(o[5, esq.indice["right_hand"]])


class TestPapeis(unittest.TestCase):
    def test_soco_com_antena_executor_e_a_mao(self):
        r = papeis(S.golpe_com_antena())
        self.assertEqual(regs_exec(r), ["braco_D"])
        self.assertEqual(r["maior_percurso"]["regiao"], "apendice_sensorial")
        self.assertIn("apendice_sensorial", [a["regiao"] for a in r["acompanhantes"]])
        self.assertEqual(r["status"], "CANDIDATO")

    def test_golpe_com_dois_bracos_tem_dois_executores(self):
        self.assertEqual(regs_exec(papeis(S.golpe_dois_bracos(defasagem=2))), ["braco_D", "braco_E"])

    def test_cabecada_executor_e_a_cabeca(self):
        self.assertEqual(regs_exec(papeis(S.cabecada())), ["cabeca"])

    def test_mordida_inclui_mandibula(self):
        self.assertIn("mandibula", regs_exec(papeis(S.mordida(abertura_graus=30))))

    def test_mandibula_parada_nao_vira_executor(self):
        self.assertNotIn("mandibula", regs_exec(papeis(S.cabecada())))

    def test_palpebra_nunca_executa(self):
        r = papeis(S.so_palpebra())
        self.assertEqual(r["status"], "INCONCLUSIVO")
        self.assertIn("olho_palpebra", [a["regiao"] for a in r["acompanhantes"]])

    def test_nucleo_inicia_antes_do_braco(self):
        r = papeis(S.cadeia_quadril_braco(atraso=3))
        self.assertEqual(r["iniciadores"][0]["regiao"], "nucleo")

    def test_serpente_bote_executor_cabeca(self):
        r = papeis(S.serpente_bote())
        self.assertEqual(r["executores"][0]["regiao"], "cabeca")

    def test_cauda_escondida_nao_vira_executor(self):
        r = papeis(S.cauda_escondida())
        self.assertEqual(regs_exec(r), ["braco_D"])

    def test_revisao_humana_substitui(self):
        r0 = papeis(S.cabecada())
        r = ontologia.aplicar_revisoes(r0, "pm0001_00_00", "00400_attack01",
                                       {"pm0001_00_00/00400_attack01": {"executores": ["cabeca"], "por": "Rafael"}})
        self.assertEqual(r["status"], "REVISADO")
        self.assertEqual(r["revisado_por"], "Rafael")
        self.assertEqual(regs_exec(r), ["cabeca"])

    def test_regra_aplicada_e_citada(self):
        self.assertTrue(papeis(S.cabecada())["regra_aplicada"].startswith("attack"))


class TestCacheVersao(unittest.TestCase):
    def test_mudar_versao_das_metricas_invalida_cache(self):
        a = config.hash_config()
        antiga = config.METRICAS_VERSAO
        try:
            config.METRICAS_VERSAO = antiga + "-x"
            self.assertNotEqual(a, config.hash_config())
        finally:
            config.METRICAS_VERSAO = antiga


if __name__ == "__main__":
    unittest.main(verbosity=2)
