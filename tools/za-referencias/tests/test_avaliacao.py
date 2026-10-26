"""Avaliação cega: divisão sem vazamento, placar, concordância e A/B (Task 9 / 1I)."""
import os
import sys
import unittest

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.dirname(AQUI))

import avaliacao  # noqa: E402


def item(i, cadeia, rig, sha=None, curva=None, cat="attack", fase="", quadros=60):
    return {"id": "c%d" % i, "modelo": "pm%04d_00_00" % i, "clipe": "00400_attack01", "categoria": cat, "fase": fase,
            "cadeia": cadeia, "assinatura_rig": rig, "fonte_sha256": sha or "h%d" % i, "quadros": quadros,
            "curva_energia": curva or [float(v) for v in np.random.RandomState(1000 + i).rand(24)]}


class TestDividir(unittest.TestCase):
    def test_mesma_cadeia_nunca_nos_dois_lados(self):
        cl = [item(i, cadeia=i // 2, rig="r%d" % i) for i in range(40)]
        d = avaliacao.dividir(cl)
        self.assertFalse({c["cadeia"] for c in d["dev"]} & {c["cadeia"] for c in d["teste"]})

    def test_mesmo_rig_de_cadeias_diferentes_fica_junto(self):
        cl = [item(i, cadeia=i, rig="comum" if i < 2 else "r%d" % i) for i in range(40)]
        d = avaliacao.dividir(cl)
        lados = {lado for lado in ("dev", "teste") for c in d[lado] if c["assinatura_rig"] == "comum"}
        self.assertEqual(len(lados), 1)

    def test_animacao_quase_identica_fica_junto(self):
        curva = [float(k % 5) for k in range(24)]
        quase = [v + 0.001 * k for k, v in enumerate(curva)]
        cl = [item(0, 0, "a", curva=curva), item(1, 1, "b", curva=quase)] + [item(i, i, "r%d" % i) for i in range(2, 40)]
        d = avaliacao.dividir(cl)
        lados = {lado for lado in ("dev", "teste") for c in d[lado] if c["id"] in ("c0", "c1")}
        self.assertEqual(len(lados), 1)

    def test_curvas_suaves_parecidas_nao_unem_especies(self):
        # dois golpes "suaves" de espécies diferentes: curva quase igual, mas picos de energia diferentes
        base = [float(np.exp(-0.5 * ((k - 12) / 4) ** 2)) for k in range(24)]
        a = item(0, 0, "a", curva=base); a["energia_pico_H_s"] = 3.0
        b = item(1, 1, "b", curva=[v * 1.001 for v in base]); b["energia_pico_H_s"] = 5.0
        d = avaliacao.dividir([a, b] + [item(i, i, "r%d" % i) for i in range(2, 40)])
        self.assertEqual(d["relatorio_vazamento"]["unioes_por_chave"].get("origem_quase_duplicata", 0), 0)

    def test_mesmo_arquivo_fica_junto(self):
        cl = [item(0, 0, "a", sha="X"), item(1, 1, "b", sha="X")] + [item(i, i, "r%d" % i) for i in range(2, 40)]
        d = avaliacao.dividir(cl)
        self.assertEqual(len({lado for lado in ("dev", "teste") for c in d[lado] if c["id"] in ("c0", "c1")}), 1)

    def test_relatorio_de_vazamento(self):
        d = avaliacao.dividir([item(i, cadeia=i // 2, rig="r%d" % i) for i in range(40)])
        self.assertIn("unioes_por_chave", d["relatorio_vazamento"])
        self.assertEqual(d["grupos"], 20)


class TestPlacar(unittest.TestCase):
    def test_placar_conta_inconclusivo_correto(self):
        p = avaliacao.placar([{"id": 1, "antecipacao": "INCONCLUSIVO"}], [{"id": 1, "antecipacao": "INCONCLUSIVO"}])
        self.assertEqual(p["antecipacao"]["inconclusivos_corretos"], 1)

    def test_placar_precisao_e_falso_positivo(self):
        prev = [{"id": 1, "x": "sim"}, {"id": 2, "x": "sim"}, {"id": 3, "x": "nao"}]
        gab = [{"id": 1, "x": "sim"}, {"id": 2, "x": "nao"}, {"id": 3, "x": "nao"}]
        p = avaliacao.placar(prev, gab)["x"]
        self.assertEqual(p["falsos_positivos"], 1)
        self.assertAlmostEqual(p["precisao"], 2 / 3, 3)

    def test_listas_comparadas_sem_ordem(self):
        p = avaliacao.placar([{"id": 1, "executores": ["braco_E", "braco_D"]}], [{"id": 1, "executores": ["braco_D", "braco_E"]}])
        self.assertEqual(p["executores"]["precisao"], 1.0)


class TestRespostasVazias(unittest.TestCase):
    def test_resposta_vazia_nao_conta(self):
        p = avaliacao.placar([{"id": 1, "x": "sim"}], [{"id": 1, "x": ""}])
        self.assertEqual(p["x"]["n"], 0)

    def test_previsao_ignora_revisado_e_mapeia_lado(self):
        import gerar_lote
        p = gerar_lote.previsao({"id": "a", "papeis_status": "REVISADO", "executores": ["cabeca"], "status": "MEDIDO"})
        self.assertNotIn("executores", p)
        q = gerar_lote.previsao({"id": "b", "papeis_status": "CANDIDATO", "executores": ["braco_C", "lingua"], "status": "MEDIDO"})
        self.assertEqual(q["executores"], ["braco_C", "lingua"])


class TestPrevisaoLoop(unittest.TestCase):
    def test_loop_previsto_como_nao(self):
        import gerar_lote
        p = gerar_lote.previsao({"id": "a", "papeis_status": "CANDIDATO", "executores": ["perna_D"], "status": "MEDIDO",
                                 "antecipacao": False, "antecipacao_status": "NAO_SE_APLICA"})
        self.assertEqual(p["antecipacao"], "nao")


class TestPrevisaoPoseParada(unittest.TestCase):
    def test_pose_parada_vira_inconclusivo_na_previsao(self):
        import gerar_lote
        p = gerar_lote.previsao({"id": "a", "papeis_status": "NAO_SE_APLICA", "executores": [], "status": "MEDIDO",
                                 "antecipacao": False, "antecipacao_status": "NAO_SE_APLICA"})
        self.assertEqual(p["executores"], "INCONCLUSIVO")


class TestPrevisaoApoio(unittest.TestCase):
    def test_previsao_leva_apoio_impulso(self):
        import gerar_lote
        p = gerar_lote.previsao({"id": "a", "papeis_status": "CANDIDATO", "executores": ["braco_D"], "status": "MEDIDO",
                                 "antecipacao": True, "apoio_impulso": ["perna_E"]})
        self.assertEqual(p["apoio_impulso"], ["perna_E"])


class TestEscolherDiverso(unittest.TestCase):
    def _banco(self):
        from sintetico import c
        out = []
        classes = ["bipede", "quadrupede", "serpentino", "alado", "outro", "sem_membros"]
        clipes = ["00400_attack01", "00030_walk01_loop", "10100_run01_loop", "00490_charge01_loop",
                  "00500_damage01", "00450_rangeattack01", "00155_land02"]
        for i in range(1, 121):
            for cl in clipes:
                out.append(c("pm%04d_00_00" % i, cl, especie=i, status="MEDIDO", conjunto=0,
                             anatomia_classe=classes[i % len(classes)], cadeia=(i + 1) // 2,
                             executores=["perna_D"] if i % 3 else [], id="pm%04d_00_00/%s" % (i, cl)))
        return out

    def test_quinze_itens_variados_sem_redundancia(self):
        import gerar_lote
        lote = gerar_lote.escolher_diverso(self._banco(), excluir_especies={1, 2, 3})
        self.assertEqual(len(lote), 15)
        esp = [l["especie"] for l in lote]
        self.assertEqual(len(set(esp)), 15, "uma espécie por item")
        self.assertEqual(len({l["cadeia"] for l in lote}), 15, "uma linha evolutiva por item")
        self.assertFalse({1, 2, 3} & set(esp))
        ataques = [l for l in lote if l["categoria"] == "attack"]
        self.assertEqual(len({l["anatomia_classe"] for l in ataques}), 6)
        cats = {l["categoria"] for l in lote}
        self.assertTrue({"attack", "walk", "run", "charge", "damage", "rangeattack", "land"} <= cats)
        charge = [l for l in lote if l["categoria"] == "charge"]
        self.assertTrue(any(l["executores"] for l in charge) and any(not l["executores"] for l in charge))

    def test_classe_rara_ausente_completa_com_reserva(self):
        import gerar_lote
        b = [l for l in self._banco() if not (l["categoria"] == "attack" and l["anatomia_classe"] == "alado")]
        b += [dict(l, clipe="00300_roar01", categoria="roar", id=l["id"].replace("00400_attack01", "00300_roar01"))
              for l in b if l["categoria"] == "attack"]
        self.assertEqual(len(gerar_lote.escolher_diverso(b, set())), 15)

    def test_linha_evolutiva_de_lote_anterior_fica_de_fora(self):
        import gerar_lote
        lote = gerar_lote.escolher_diverso(self._banco(), set(), excluir_cadeias={5, 6, 7})
        self.assertFalse({5, 6, 7} & {l["cadeia"] for l in lote})

    def test_classe_rara_so_em_outro_conjunto_entra(self):
        import gerar_lote
        b = [l for l in self._banco() if l["anatomia_classe"] != "alado"]
        b.append(dict(b[0], modelo="pm0999_00_00", especie=999, cadeia=999, anatomia_classe="alado", conjunto=1,
                      clipe="10030_walk01_loop", categoria="walk", id="pm0999_00_00/10030_walk01_loop"))
        lote = gerar_lote.escolher_diverso(b, set())
        self.assertIn(999, {l["especie"] for l in lote})

    def test_deterministico(self):
        import gerar_lote
        b = self._banco()
        self.assertEqual([l["id"] for l in gerar_lote.escolher_diverso(b, set())],
                         [l["id"] for l in gerar_lote.escolher_diverso(b, set())])


class TestRefazerPagina(unittest.TestCase):
    def test_mesmo_hash_e_ignorados(self):
        import json, os, tempfile
        import gerar_lote
        d = tempfile.mkdtemp()
        lote = os.path.join(d, "lote_x")
        os.makedirs(lote)
        json.dump({"itens": [{"id": "a/b", "n": 1}, {"id": "c/d", "n": 2}]}, open(os.path.join(lote, "lote.json"), "w"))
        open(os.path.join(lote, "lote.sha256"), "w").write("abcdef1234567890\n")
        json.dump({"ignorados": [2]}, open(os.path.join(d, "lote_x_ignorados.json"), "w"))
        self.assertEqual(gerar_lote.refazer_pagina(lote), ("abcdef123456", 1))
        pag = open(os.path.join(lote, "rotulagem.html"), encoding="utf-8").read()
        self.assertIn('rotulagem_za_" + "abcdef123456"', pag)
        self.assertIn('"ignorados": [', pag)
        self.assertNotIn("/*LOTE*/null", pag)


class TestRefazerPrevisoes(unittest.TestCase):
    def test_regrava_so_previsoes_sem_tocar_no_lote(self):
        import json, os, tempfile
        import gerar_lote
        d = tempfile.mkdtemp()
        lote = os.path.join(d, "lote_x")
        os.makedirs(lote)
        texto = json.dumps({"itens": [{"id": "pm1_00_00/a"}, {"id": "pm2_00_00/b"}]})
        open(os.path.join(lote, "lote.json"), "w", encoding="utf-8").write(texto)
        banco = os.path.join(d, "b.jsonl")
        with open(banco, "w", encoding="utf-8") as fh:
            for m, c in (("pm1_00_00", "a"), ("pm2_00_00", "b"), ("pm3_00_00", "c")):
                fh.write(json.dumps({"modelo": m, "clipe": c, "status": "MEDIDO", "antecipacao": True,
                                     "executores": ["braco_D"]}) + "\n")
        self.assertEqual(gerar_lote.refazer_previsoes(banco, lote), (2, 2))
        self.assertEqual(open(os.path.join(lote, "lote.json"), encoding="utf-8").read(), texto)
        prev = json.load(open(os.path.join(d, "lote_x_sistema", "previsoes_b.json"), encoding="utf-8"))
        self.assertEqual([p["id"] for p in prev], ["pm1_00_00/a", "pm2_00_00/b"])


class TestConcordancia(unittest.TestCase):
    def test_kappa_concordancia_perfeita_e_1(self):
        rot = [{"id": i, "antecipacao": "sim" if i % 2 else "nao"} for i in range(10)]
        self.assertAlmostEqual(avaliacao.concordancia({"r1": rot, "r2": rot})["antecipacao"]["kappa_cohen"], 1.0)

    def test_kappa_e_discordancias(self):
        a = [{"id": i, "x": "sim" if i < 5 else "nao"} for i in range(10)]
        b = [{"id": i, "x": "sim" if i < 4 else "nao"} for i in range(10)]
        c = avaliacao.concordancia({"r1": a, "r2": b})["x"]
        self.assertEqual(c["discordancias"], [4])
        self.assertLess(c["kappa_cohen"], 1.0)

    def test_fleiss_com_tres_revisores(self):
        rot = [{"id": i, "x": "sim" if i % 3 else "nao"} for i in range(9)]
        self.assertAlmostEqual(avaliacao.concordancia({"a": rot, "b": rot, "c": rot})["x"]["kappa_fleiss"], 1.0)


class TestAB(unittest.TestCase):
    def test_ab_sem_diferenca_quando_iguais(self):
        prev = [{"id": i, "x": "sim"} for i in range(20)]
        gab = [{"id": i, "x": "sim" if i % 2 else "nao"} for i in range(20)]
        self.assertEqual(avaliacao.ab(prev, prev, gab)["x"]["conclusao"], "SEM_DIFERENCA_DEMONSTRAVEL")

    def test_ab_melhorou_com_muitas_viradas(self):
        gab = [{"id": i, "x": "sim"} for i in range(20)]
        a = [{"id": i, "x": "nao"} for i in range(20)]
        b = [{"id": i, "x": "sim"} for i in range(20)]
        r = avaliacao.ab(a, b, gab)["x"]
        self.assertEqual(r["conclusao"], "MELHOROU")
        self.assertLess(r["p_mcnemar"], 0.05)


if __name__ == "__main__":
    unittest.main(verbosity=2)
