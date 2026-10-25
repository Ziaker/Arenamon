"""Normas por subgrupo com n de clipes/espécies/rigs e aprovações por aspecto (Task 8 / 1H)."""
import os
import shutil
import sys
import tempfile
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.dirname(AQUI))

import normas  # noqa: E402
from sintetico import c  # noqa: E402


def linha(esp, mod, dur=2.0, rig="r1", pose=None, **kw):
    base = dict(duracao_s=dur, ate_pico_s=0.5, antecipacao=True, antecipacao_q=20, assinatura_rig=rig,
                pose_repouso_hash=pose or mod, anatomia_classe="bipede", escala_animada=False, partes_ocultas=False)
    base.update(kw)
    return c(mod, "00400_attack01", especie=esp, nome="esp%d" % esp, **base)


class TestGrupo(unittest.TestCase):
    def test_formas_da_mesma_especie_contam_uma_vez(self):
        g = normas.grupo([linha(6, "pm0006_00_00"), linha(6, "pm0006_51_00")], "attack", "", n_min=1)
        self.assertEqual(g["n_especies"], 1)
        self.assertEqual(g["n_clipes"], 1)

    def test_grupo_pequeno_sem_base(self):
        g = normas.grupo([linha(i, "pm%04d_00_00" % i) for i in range(1, 8)], "attack", "")
        self.assertEqual(g["status"], "SEM_BASE_COMPARAVEL")
        self.assertIn("n_especies=7 < 8", g["motivos"])

    def test_grupo_suficiente_e_medido_com_percentis(self):
        g = normas.grupo([linha(i, "pm%04d_00_00" % i, dur=1.0 + i / 10) for i in range(1, 11)], "attack", "")
        self.assertEqual(g["status"], "MEDIDO")
        m = g["medidas"]["duracao_s"]
        for k in ("p10", "p25", "mediana", "p75", "p90", "mad", "iqr", "faltantes_frac"):
            self.assertIn(k, m)
        self.assertAlmostEqual(m["mediana"], 1.55, 2)

    def test_rigs_estruturais_e_poses_de_repouso(self):
        ls = [linha(1, "pm0001_00_00", rig="a", pose="p1"), linha(2, "pm0002_00_00", rig="a", pose="p2"),
              linha(3, "pm0003_00_00", rig="b", pose="p3")]
        g = normas.grupo(ls, "attack", "", n_min=1)
        self.assertEqual(g["n_rigs_estruturais"], 2)
        self.assertEqual(g["n_poses_repouso"], 3)

    def test_filtra_classe_anatomica(self):
        ls = [linha(i, "pm%04d_00_00" % i) for i in range(1, 9)] + [linha(20, "pm0020_00_00", anatomia_classe="quadrupede")]
        self.assertEqual(normas.grupo(ls, "attack", "", classe_anatomica="quadrupede", n_min=1)["n_especies"], 1)

    def test_fracao_com_escala_e_partes_ocultas(self):
        ls = [linha(1, "pm0001_00_00", escala_animada=True, partes_ocultas=True), linha(2, "pm0002_00_00")]
        g = normas.grupo(ls, "attack", "", n_min=1)
        self.assertEqual(g["com_escala_animada_frac"], 0.5)
        self.assertEqual(g["com_partes_ocultas_frac"], 0.5)

    def test_nada_aprovado_por_padrao(self):
        g = normas.grupo([linha(i, "pm%04d_00_00" % i) for i in range(1, 11)], "attack", "")
        self.assertIsNone(g["aprovacao"]["art_approved_by"])
        self.assertEqual(g["aprovacao"]["aspectos_aprovados"], [])
        self.assertEqual(g["adequacao_artistica"], "NAO_AVALIADA")


class TestNormasNoRelatorio(unittest.TestCase):
    def test_grupo_tem_fracao_com_hold(self):
        g = normas.grupo([linha(i, "pm%04d_00_00" % i, holds=1 if i < 5 else 0) for i in range(1, 11)], "attack", "")
        self.assertEqual(g["com_hold_frac"], 0.4)


class TestAntecipacaoNaoSeAplica(unittest.TestCase):
    def test_loop_sai_sem_fracao_de_antecipacao(self):
        ls = [linha(i, "pm%04d_00_00" % i, antecipacao=False, antecipacao_status="NAO_SE_APLICA") for i in range(1, 11)]
        g = normas.grupo(ls, "attack", "")
        self.assertIsNone(g["com_antecipacao_frac"])
        self.assertEqual(g["antecipacao_status"], "NAO_SE_APLICA")

    def test_golpe_continua_medido(self):
        g = normas.grupo([linha(i, "pm%04d_00_00" % i) for i in range(1, 11)], "attack", "")
        self.assertEqual(g["com_antecipacao_frac"], 1.0)
        self.assertEqual(g["antecipacao_status"], "MEDIDO")

    def test_relatorio_mostra_nao_se_aplica(self):
        import gerar_relatorio
        ls = [linha(i, "pm%04d_00_00" % i, antecipacao=False, antecipacao_status="NAO_SE_APLICA") for i in range(1, 11)]
        self.assertIsNone(gerar_relatorio.normas(ls)["attack|"]["com_antecipacao"])


class TestSecaoApoio(unittest.TestCase):
    def test_secao_de_papeis_mostra_apoio_e_locomocao(self):
        import gerar_relatorio
        ataques = [linha(i, "pm%04d_00_00" % i, status="MEDIDO", fase="", executores=["braco_D"],
                         apoio_impulso=["perna_D", "perna_E"] if i < 6 else []) for i in range(1, 11)]
        loops = [c("pm%04d_00_00" % i, "00030_walk01_loop", especie=i, status="MEDIDO", fase="loop",
                   executores=["perna_D", "perna_E"] if i < 4 else []) for i in range(1, 6)]
        h = gerar_relatorio.secoes_fase1(ataques + loops, ataques + loops)
        self.assertIn("Pernas de apoio/impulso", h)
        self.assertIn("50%", h)
        self.assertIn("Papéis na locomoção", h)


class TestGruposDoRelatorio(unittest.TestCase):
    def test_grupo_com_5_especies_sai_sem_base(self):
        import gerar_relatorio
        g = gerar_relatorio.grupos_normas([linha(i, "pm%04d_00_00" % i) for i in range(1, 6)], aprovacoes={"aprovacoes": []})
        self.assertEqual(g[("attack", "")]["status"], "SEM_BASE_COMPARAVEL")
        self.assertIn("n_clipes", g[("attack", "")])


class TestAprovar(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.arq = os.path.join(self.tmp, "aprovacoes_za.json")

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_aprovar_sem_pessoa_falha(self):
        with self.assertRaises(normas.RefError):
            normas.aprovar("timing", "attack||bipede|0", None, ["timing"], caminho=self.arq)

    def test_aspecto_desconhecido_falha(self):
        with self.assertRaises(normas.RefError):
            normas.aprovar("bonito", "attack||bipede|0", "Rafael", ["bonito"], caminho=self.arq)

    def test_aprovacao_aparece_no_grupo(self):
        normas.aprovar("timing", "attack||bipede|0", "Rafael", ["timing"], caminho=self.arq)
        g = normas.grupo([linha(i, "pm%04d_00_00" % i) for i in range(1, 11)], "attack", "", classe_anatomica="bipede",
                         aprovacoes=normas.carregar_aprovacoes(self.arq))
        self.assertEqual(g["aprovacao"]["aspectos_aprovados"], ["timing"])
        self.assertEqual(g["aprovacao"]["art_approved_by"], "Rafael")
        self.assertEqual(g["adequacao_artistica"], "NAO_AVALIADA")  # aprovar o grupo não avalia nenhuma animação


if __name__ == "__main__":
    unittest.main(verbosity=2)
