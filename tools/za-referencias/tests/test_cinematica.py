"""Cinemática por região, eventos, ordem de ativação, follow-through e escala (Task 4 / 1D + L08)."""
import json
import os
import sys
import unittest

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.dirname(AQUI))

import cinematica  # noqa: E402
import metricas  # noqa: E402
import ontologia  # noqa: E402
import sintetico as S  # noqa: E402
import za_anim  # noqa: E402


def curvas(par):
    esq, c = par
    regs = ontologia.regioes(esq)
    return cinematica.curvas_regiao(c, esq, regs, metricas.raiz_do_corpo(esq), za_anim.ocultos(c, esq)), esq, c, regs


class TestEventos(unittest.TestCase):
    def test_golpe_com_dois_picos_vira_dois_eventos(self):
        ev = cinematica.eventos(S.vel_dois_picos(), 60)
        self.assertEqual(len(ev), 2)
        self.assertEqual([e["pico"] for e in ev], [20, 50])

    def test_um_pico_um_evento(self):
        self.assertEqual(len(cinematica.eventos(S.pulso(60, 30, 3, 2.0), 60)), 1)


class TestOrdem(unittest.TestCase):
    def test_nucleo_antes_do_braco(self):
        cv, *_ = curvas(S.cadeia_defasada(atraso=3))
        o = cinematica.ordem_ativacao(cv, (0, 59))
        self.assertEqual([x["regiao"] for x in o][:2], ["nucleo", "braco_D"])
        self.assertEqual(o[1]["quadro_inicio"] - o[0]["quadro_inicio"], 3)


class TestFollowThrough(unittest.TestCase):
    def test_cauda_atrasada_e_amortecida(self):
        f = cinematica.follow_through(*S.curvas_cauda_amortecida(atraso=4, razao=0.5))
        self.assertEqual(f[0]["regiao"], "cauda")
        self.assertEqual(f[0]["atraso_q"], 4)
        self.assertAlmostEqual(f[0]["amortecimento"], 0.5, 1)


class TestOcultosNaCinematica(unittest.TestCase):
    def test_reaparecimento_nao_cria_pico(self):
        cv, *_ = curvas(S.cauda_escondida())
        self.assertEqual(cinematica.eventos(cv["cauda"]["vel"], 60), [])

    def test_escala_zero_vira_troca_de_visibilidade(self):
        esq, c = S.cauda_escondida()
        t = cinematica.trocas_de_visibilidade(za_anim.ocultos(c, esq), esq)
        self.assertEqual(t[0]["quadro"], 15)
        self.assertEqual(t[0]["para"], "visivel")
        self.assertIn("tail_01", t[0]["ossos"])


class TestEscala(unittest.TestCase):
    def test_squash_antes_do_pico_e_detectado(self):
        esq, c = S.squash_antes_do_golpe()
        regs = ontologia.regioes(esq)
        e = cinematica.escala_regiao(c, esq, regs, za_anim.ocultos(c, esq), quadro_evento=30)
        self.assertEqual(e["cauda"]["tipo"], "squash_stretch")
        self.assertEqual(e["cauda"]["relacao_com_evento"], "antes")
        self.assertAlmostEqual(e["cauda"]["amplitude"], 0.3, 2)
        self.assertEqual(e["cauda"]["status"], "CANDIDATO")

    def test_parte_escondida_tem_tipo_oculto(self):
        esq, c = S.cauda_escondida()
        e = cinematica.escala_regiao(c, esq, ontologia.regioes(esq), za_anim.ocultos(c, esq), quadro_evento=40)
        self.assertEqual(e["cauda"]["tipo"], "oculto")


class TestMedir(unittest.TestCase):
    def test_clipe_de_um_quadro_inconclusivo(self):
        esq, c = S.um_quadro()
        self.assertEqual(metricas.medir(c, esq, categoria="attack")["status"], "INCONCLUSIVO")

    def test_reprocessamento_deterministico(self):
        esq, c = S.golpe_com_antena()
        a = json.dumps(metricas.medir(c, esq, categoria="attack"), sort_keys=True)
        b = json.dumps(metricas.medir(c, esq, categoria="attack"), sort_keys=True)
        self.assertEqual(a, b)

    def test_antecipacao_usa_o_executor(self):
        esq, c = S.golpe_com_antena()
        m = metricas.medir(c, esq, categoria="attack")
        self.assertEqual(m["antecipacao_osso"], "right_hand")
        self.assertIn("antecipacao_q_maior_percurso", m)

    def test_ordem_no_banco_ignora_antena_em_balanco(self):
        esq, c = S.antena_balanca_nucleo_prepara()
        m = metricas.medir(c, esq, categoria="attack")
        self.assertEqual(m["ordem_ativacao"][0], "nucleo")
        self.assertNotIn("apendice_sensorial", m["ordem_ativacao"])

    def test_revisao_humana_entra_antes_das_medidas(self):
        esq, c = S.golpe_com_antena()
        m = metricas.medir(c, esq, categoria="attack", revisao={"executores": ["cabeca"], "por": "Rafael"})
        self.assertEqual(m["executores"], ["cabeca"])
        self.assertEqual(m["papeis_status"], "REVISADO")
        self.assertEqual(m["antecipacao_osso"], "head")

    def test_mede_antecipacao_de_cada_executor(self):
        esq, c = S.golpe_dois_bracos()
        m = metricas.medir(c, esq, categoria="attack")
        self.assertEqual(len(m["antecipacao_por_executor"]), 2)

    def test_clipe_sem_quadros_inconclusivo(self):
        esq = S.humanoide()
        c = S.clipe(esq, 1)
        c.quadros = 0
        c.posicoes = c.posicoes[:0]; c.loc = c.loc[:0]; c.rot = c.rot[:0]; c.escala = c.escala[:0]; c.rot_mundo = c.rot_mundo[:0]
        self.assertEqual(metricas.medir(c, esq, categoria="attack")["status"], "INCONCLUSIVO")

    def test_medir_grava_eventos_e_ordem(self):
        esq, c = S.cadeia_defasada(atraso=3)
        m = metricas.medir(c, esq, categoria="attack")
        self.assertEqual(m["ordem_ativacao"][:2], ["nucleo", "braco_D"])
        self.assertGreaterEqual(m["n_eventos"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
