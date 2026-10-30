"""Montagem das propostas IA a partir da interpretação declarada (sem inventar respostas)."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def prova(valor, nivel="B", **extra):
    p = {"valor": valor, "nivel": nivel, "quadros": [[0, 10]], "vistas": ["D_e12", "E_e35"],
         "visual_inspecionado": True, "justificativa": "Visto nas duas vistas.", "funcao_confirmada": True,
         "lateralidade_confirmada": True}
    p.update(extra)
    return p


def inconclusivo(motivo="Sem base."):
    return {"valor": "INCONCLUSIVO", "nivel": "INCONCLUSIVO", "justificativa": motivo}


def interpretacao():
    return {"versao_analise": "teste-1", "analista": "IA (teste)", "itens": {
        "a/b": {"respostas": {
            "executores": prova(["braco_D"], "A", cinematica_confirmada=True),
            "apoio_impulso": prova(["perna_E"]),
            "iniciador": inconclusivo("Regiões começam juntas."),
            "iniciadores": prova(["braco_D", "perna_E"]),
            "antecipacao": prova("sim"),
            "antecipacao_q": prova(7, recuo_ativo=[2, 9], golpe_inicio=36),
            "fase_golpe_inicio": prova(36),
            "parte_some_aparece": prova("nao"),
            "apoio": inconclusivo("Chão estimado, não observado."),
            "leitura_pose": prova("clara"),
            "massa_aparente": prova("medio", "C", hipotese_artistica=True),
            "intencao": inconclusivo()},
            "observacao": "Descrição específica.", "eventos": [{"tipo": "golpe", "quadros": [36, 41]}],
            "limitacoes": ["Chão estimado."], "imagens": ["inspecao/x.png"]}}}


class TestMontar(unittest.TestCase):
    def setUp(self):
        import ia_pipeline
        import ia_propostas
        self.api = ia_propostas
        self.batch = {"hash": "abc", "itens": [{"id": "a/b", "n": 1}], "schema": ia_pipeline.default_schema()}

    def test_rotulo_usa_so_os_valores_declarados(self):
        exp, ev = self.api.montar(self.batch, interpretacao())
        r = exp["rotulos"][0]
        self.assertEqual(r["executores"], ["braco_D"])
        self.assertEqual(r["iniciador"], "INCONCLUSIVO")
        self.assertEqual(r["antecipacao_q"], 7)
        self.assertEqual(r["observacao"], "Descrição específica.")
        self.assertIn("não validada", exp["revisor"])
        self.assertEqual(exp["lote"], "abc")

    def test_confianca_qualitativa_por_nivel(self):
        exp, ev = self.api.montar(self.batch, interpretacao())
        c = ev["a/b"]["confianca_por_campo"]
        self.assertEqual((c["executores"], c["apoio_impulso"], c["massa_aparente"], c["apoio"]),
                         ("alta", "media", "baixa", "sem base"))
        r = exp["rotulos"][0]
        self.assertEqual((r["conf_executa"], r["conf_apoio"], r["conf_fases"]), ("alta", "media", "media"))

    def test_evidencia_tem_formato_do_pedido_e_passa_na_validacao(self):
        import ia_pipeline
        exp, ev = self.api.montar(self.batch, interpretacao())
        e = ev["a/b"]
        for k in ("id", "versao_analise", "fontes", "eventos", "respostas", "confianca_por_campo", "limitacoes"):
            self.assertIn(k, e)
        self.assertEqual(e["revisao_humana"], "PENDENTE")
        self.assertEqual(e["fontes"]["imagens"], ["inspecao/x.png"])
        self.assertEqual(ia_pipeline.validate_export(exp, self.batch, ev), [])

    def test_item_sem_interpretacao_falha_em_vez_de_inventar(self):
        b = dict(self.batch, itens=[{"id": "a/b", "n": 1}, {"id": "c/d", "n": 2}])
        with self.assertRaises(ValueError):
            self.api.montar(b, interpretacao())

    def test_contagem_de_inconclusivos_por_campo(self):
        exp, _ = self.api.montar(self.batch, interpretacao())
        cont = self.api.inconclusivos_por_campo(exp)
        self.assertEqual(cont["iniciador"], 1)
        self.assertEqual(cont["apoio"], 1)
        self.assertEqual(cont["intencao"], 1)
        self.assertEqual(cont["executores"], 0)

    def test_nao_grava_dentro_da_pasta_do_lote_humano(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as td:
            lote = Path(td) / "lote_x"
            lote.mkdir()
            (lote / "rotulagem.html").write_text("x", encoding="utf-8")
            with self.assertRaises(ValueError):
                self.api.saida_segura(lote / "rotulagem.html", lote)
            self.assertEqual(self.api.saida_segura(lote / "rotulagem.html", Path(td) / "lote_x_ia"),
                             (Path(td) / "lote_x_ia").resolve())


if __name__ == "__main__":
    unittest.main()
