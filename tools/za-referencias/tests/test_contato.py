"""Chão estimado, apoio por pé em três níveis e locomoção (Task 5 / 1E)."""
import os
import sys
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.dirname(AQUI))

import contato  # noqa: E402
import ontologia  # noqa: E402
import sintetico as S  # noqa: E402


def analisar(par):
    esq, c = par
    regs = ontologia.regioes(esq)
    ch = contato.plano_chao(c, esq, regs)
    ap = contato.apoio_por_pe(c, esq, regs, ch)
    return esq, c, regs, ch, ap, contato.locomocao(ap, c, esq, ch)


class TestLocomocao(unittest.TestCase):
    def test_andar_com_deslocamento_sem_escorregao(self):
        r = analisar(S.andar())[5]
        self.assertEqual(r["modo"], "real")
        self.assertEqual(r["escorregoes"], [])

    def test_andar_parado_e_esteira_sem_escorregao(self):
        r = analisar(S.andar(esteira=True))[5]
        self.assertEqual(r["modo"], "esteira")
        self.assertEqual(r["escorregoes"], [])

    def test_pe_deslizando_e_escorregao_inferido(self):
        e = analisar(S.andar(deslize_pe="left_foot"))[5]["escorregoes"]
        self.assertTrue(e)
        self.assertTrue(all(x["osso"] == "left_foot" for x in e))
        self.assertEqual(e[0]["nivel"], "INFERIDO")

    def test_cadencia_de_dois_passos_por_ciclo(self):
        r = analisar(S.andar())[5]
        self.assertAlmostEqual(r["cadencia_passos_s"], 4.0, delta=1.1)   # 2 pés x 1 apoio a cada 0,5 s

    def test_pulo_deixa_chao_instavel_e_sem_informacao(self):
        _, _, _, ch, _, loc = analisar(S.pulo())
        self.assertFalse(ch["estavel"])
        self.assertEqual(loc["modo"], "SEM_INFORMACAO")

    def test_balanco_normal_do_corpo_nao_vira_pulo(self):
        _, _, _, ch, _, loc = analisar(S.andar(balanco=0.25))
        self.assertTrue(ch["estavel"])
        self.assertEqual(loc["modo"], "real")

    def test_mergulho_do_pe_no_ar_nao_desestabiliza_o_chao(self):
        _, _, _, ch, _, _ = analisar(S.andar(mergulho_no_ar=0.06))
        self.assertTrue(ch["estavel"])

    def test_pe_que_nunca_levanta_nao_vira_escorregao(self):
        r = analisar(S.deslizar_sem_levantar())[5]
        self.assertEqual(r["escorregoes"], [])
        self.assertTrue(any("não levanta" in m for m in r["motivos"]))

    def test_passo_rasante_rapido_nao_e_escorregao(self):
        r = analisar(S.andar(rasante_frac=0.3))[5]   # o fim do balanço avança rente ao chão, rápido
        self.assertEqual(r["escorregoes"], [])

    def test_patinacao_com_o_corpo_e_escorregao(self):
        e = analisar(S.patinar_com_o_corpo())[5]["escorregoes"]
        self.assertTrue(any(x["osso"] == "left_foot" and x.get("tipo") == "patinacao" for x in e))

    def test_serpente_sem_informacao(self):
        self.assertEqual(analisar(S.serpente_bote())[4]["status"], "SEM_INFORMACAO")

    def test_nunca_contato_confirmado_sozinho(self):
        ap = analisar(S.andar())[4]
        self.assertNotIn("CONTATO_CONFIRMADO", {s for v in ap["por_pe"].values() for s in v})
        self.assertIn("CONTATO_INFERIDO", {s for v in ap["por_pe"].values() for s in v})

    def test_pico_de_velocidade_nao_cria_contato(self):
        ap = analisar(S.golpe_no_ar())[4]
        self.assertNotIn("right_hand", ap["por_pe"])

    def test_perna_oculta_sem_informacao(self):
        ap = analisar(S.andar(perna_oculta=("left_leg", 10, 20)))[4]
        self.assertTrue(all(s == "SEM_INFORMACAO" for s in ap["por_pe"]["left_foot"][10:20]))


class TestPapeisNaLocomocao(unittest.TestCase):
    def test_locomocao_conta_as_duas_pernas(self):
        esq, c = S.andar()
        regs = ontologia.regioes(esq)
        r = ontologia.papeis(c, esq, regs, "walk", ontologia.anatomia(esq, regs))
        self.assertEqual(sorted(e["regiao"] for e in r["executores"]), ["perna_D", "perna_E"])

    def test_charge_nao_e_locomocao(self):
        # charge01_loop = pose de carga parada (revisão IA do lote 02, decisão do revisor em 25/10/2026)
        self.assertNotIn("charge", ontologia.carregar_regras()["locomocao"]["categorias"])
        esq, c = S.andar_com_bracos()
        regs = ontologia.regioes(esq)
        r = ontologia.papeis(c, esq, regs, "charge", ontologia.anatomia(esq, regs))
        self.assertNotEqual(sorted(e["regiao"] for e in r["executores"]), ["braco_D", "braco_E", "perna_D", "perna_E"])

    def test_locomocao_inclui_bracos_que_balancam(self):
        esq, c = S.andar_com_bracos()
        regs = ontologia.regioes(esq)
        r = ontologia.papeis(c, esq, regs, "walk", ontologia.anatomia(esq, regs))
        self.assertEqual(sorted(e["regiao"] for e in r["executores"]), ["braco_D", "braco_E", "perna_D", "perna_E"])


class TestApoioImpulso(unittest.TestCase):
    def _p(self, esq, c, cat="attack"):
        regs = ontologia.regioes(esq)
        return ontologia.papeis(c, esq, regs, cat, ontologia.anatomia(esq, regs))

    def test_perna_que_dobra_no_golpe_e_apoio_nao_executor(self):
        esq, c = S.soco_com_apoio()
        r = self._p(esq, c)
        self.assertEqual([e["regiao"] for e in r["executores"]], ["braco_D"])
        self.assertEqual([a["regiao"] for a in r["apoio_impulso"]], ["perna_E"])

    def test_perna_quase_parada_nao_e_apoio(self):
        esq, c = S.soco_com_apoio(graus_perna=3.0)
        self.assertEqual(self._p(esq, c)["apoio_impulso"], [])

    def test_locomocao_tem_as_pernas_como_apoio_e_impulso(self):
        # decisão do revisor (30/10/2026, gabarito aceito dos lotes 02/03): em caminhada/corrida as pernas
        # que ciclam são executoras E apoio/impulso. Antes (25/10) a locomoção não tinha apoio separado.
        esq, c = S.andar()
        r = self._p(esq, c, "walk")
        self.assertEqual(sorted(a["regiao"] for a in r["apoio_impulso"]), ["perna_D", "perna_E"])
        self.assertEqual(sorted(e["regiao"] for e in r["executores"]), ["perna_D", "perna_E"])

    def test_locomocao_nao_poe_braco_balancando_como_apoio(self):
        esq, c = S.andar_com_bracos()
        r = self._p(esq, c, "walk")
        self.assertEqual(sorted(a["regiao"] for a in r["apoio_impulso"]), ["perna_D", "perna_E"])

    def test_medir_expoe_apoio_impulso(self):
        import metricas
        esq, c = S.soco_com_apoio()
        self.assertEqual(metricas.medir(c, esq, categoria="attack")["apoio_impulso"], ["perna_E"])


class TestPoseParada(unittest.TestCase):
    def _p(self, esq, c, cat="charge"):
        regs = ontologia.regioes(esq)
        return ontologia.papeis(c, esq, regs, cat, ontologia.anatomia(esq, regs))

    def test_loop_com_raiz_e_pes_parados_nao_tem_executor(self):
        esq, c = S.pose_parada()
        r = self._p(esq, c)
        self.assertEqual(r["executores"], [])
        self.assertEqual(r["status"], "NAO_SE_APLICA")
        self.assertEqual(r["iniciadores"], [])
        self.assertEqual(sorted(a["regiao"] for a in r["apoio_impulso"]), ["perna_D", "perna_E"])
        self.assertIn("pose parada", r["motivo"])

    def test_mesmo_movimento_fora_de_loop_segue_regra_normal(self):
        esq, c = S.pose_parada()
        c.eh_loop = False
        self.assertNotEqual(self._p(esq, c)["status"], "NAO_SE_APLICA")

    def test_andar_na_esteira_nao_e_pose_parada(self):
        esq, c = S.andar(esteira=True)
        c.eh_loop = True
        r = self._p(esq, c, "walk")
        self.assertEqual(sorted(e["regiao"] for e in r["executores"]), ["perna_D", "perna_E"])

    def test_loop_com_raiz_se_deslocando_nao_e_pose_parada(self):
        esq, c = S.pose_parada(raiz=0.4)
        self.assertNotEqual(self._p(esq, c)["status"], "NAO_SE_APLICA")

    def test_membro_balancando_forte_nao_e_pose_parada(self):
        esq, c = S.pose_parada(amp=0.5, periodo=20)
        self.assertNotEqual(self._p(esq, c)["status"], "NAO_SE_APLICA")


class TestExecutoresCorrigidosPeloGabarito(unittest.TestCase):
    """Erros de executor restantes nos gabaritos aceitos dos lotes 02 e 03 (30/10/2026)."""

    def _p(self, esq, c, cat="attack"):
        regs = ontologia.regioes(esq)
        return ontologia.papeis(c, esq, regs, cat, ontologia.anatomia(esq, regs))

    def test_cauda_acompanha_quando_um_membro_golpeia(self):   # Lucario
        r = self._p(*S.golpe_com_cauda())
        self.assertEqual([e["regiao"] for e in r["executores"]], ["braco_D"])
        self.assertIn("cauda", [a["regiao"] for a in r["acompanhantes"]])

    def test_cauda_sozinha_continua_executora(self):
        r = self._p(*S.golpe_com_cauda(amp_braco=0.0))
        self.assertEqual([e["regiao"] for e in r["executores"]], ["cauda"])

    def test_pose_parada_com_cauda_balancando(self):   # Pyroar
        r = self._p(*S.pose_parada(cauda_amp=0.5), cat="charge")
        self.assertEqual(r["status"], "NAO_SE_APLICA")
        self.assertEqual(r["executores"], [])

    def test_nenhum_membro_domina_fica_inconclusivo(self):   # Swalot, fim de ataque
        r = self._p(*S.golpe_fraco_boca_forte())
        self.assertEqual(r["executores"], [])
        self.assertEqual(r["status"], "INCONCLUSIVO")
        self.assertIn("domina", r["motivo"])

    def test_membro_que_domina_continua_executor(self):
        r = self._p(*S.golpe_com_antena())
        self.assertEqual([e["regiao"] for e in r["executores"]], ["braco_D"])

    def test_patas_dianteiras_de_quadrupede_sao_pernas(self):   # Aurorus
        r = self._p(*S.quadrupede_andando(), cat="walk")
        self.assertEqual(sorted(e["regiao"] for e in r["executores"]), ["perna_D", "perna_E"])
        self.assertEqual(sorted(a["regiao"] for a in r["apoio_impulso"]), ["perna_D", "perna_E"])

    def test_bipede_mantem_os_bracos_na_locomocao(self):
        r = self._p(*S.andar_com_bracos(), cat="walk")
        self.assertEqual(sorted(e["regiao"] for e in r["executores"]), ["braco_D", "braco_E", "perna_D", "perna_E"])


class TestAntecipacaoEmLoop(unittest.TestCase):
    def test_loop_antecipacao_nao_se_aplica(self):
        import metricas
        esq, c = S.andar()
        c.eh_loop = True
        m = metricas.medir(c, esq, categoria="walk")
        self.assertEqual(m["antecipacao_status"], "NAO_SE_APLICA")
        self.assertFalse(m["antecipacao"])
        self.assertEqual(m["antecipacao_q"], 0)

    def test_golpe_mantem_antecipacao_medida(self):
        import metricas
        esq, c = S.golpe_com_antena()
        self.assertEqual(metricas.medir(c, esq, categoria="attack")["antecipacao_status"], "MEDIDO")


class TestMassa(unittest.TestCase):
    def test_massa_proxy_rotulada(self):
        esq, c, regs, ch, ap, _ = analisar(S.andar())
        m = contato.massa_sobre_base(c, esq, ap)
        self.assertEqual(m["proxy"], "centroide_ossos")


class TestNoBanco(unittest.TestCase):
    def test_medir_grava_locomocao_em_andar(self):
        import metricas
        esq, c = S.andar()
        m = metricas.medir(c, esq, categoria="walk")
        self.assertEqual(m["locomocao_modo"], "real")
        self.assertEqual(m["escorregoes_n"], 0)
        self.assertIn("cadencia_passos_s", m)

    def test_ataque_nao_calcula_locomocao(self):
        import metricas
        esq, c = S.golpe_no_ar()
        self.assertNotIn("locomocao_modo", metricas.medir(c, esq, categoria="attack"))


if __name__ == "__main__":
    unittest.main(verbosity=2)


class TestReacoes(unittest.TestCase):
    """damage/land: o corpo todo reage; nenhum membro executa (gabarito aceito dos lotes 02/03, 30/10/2026)."""

    def _p(self, esq, c, cat):
        regs = ontologia.regioes(esq)
        return ontologia.papeis(c, esq, regs, cat, ontologia.anatomia(esq, regs))

    def test_dano_nao_tem_executor(self):
        esq, c = S.soco_com_apoio()
        r = self._p(esq, c, "damage")
        self.assertEqual(r["executores"], [])
        self.assertEqual(r["status"], "NAO_SE_APLICA")

    def test_aterrissagem_nao_tem_executor_mas_mantem_as_pernas_como_apoio(self):
        esq, c = S.soco_com_apoio()
        r = self._p(esq, c, "land")
        self.assertEqual(r["executores"], [])
        self.assertEqual(r["status"], "NAO_SE_APLICA")
        self.assertIn("perna_E", [a["regiao"] for a in r["apoio_impulso"]])

    def test_categorias_de_reacao_ficam_na_regra_editavel(self):
        self.assertEqual(sorted(ontologia.carregar_regras()["reacoes"]["categorias"]), ["damage", "land"])

    def test_ataque_continua_com_executor(self):
        esq, c = S.soco_com_apoio()
        self.assertEqual([e["regiao"] for e in self._p(esq, c, "attack")["executores"]], ["braco_D"])
