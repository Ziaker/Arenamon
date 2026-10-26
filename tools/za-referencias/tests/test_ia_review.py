"""Contrato da revisão local: isolamento humano e integridade do JSON inline."""
import json
import pathlib
import re
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))


class ReviewTests(unittest.TestCase):
    def test_snapshot_media_base_does_not_point_at_mutable_originals(self):
        import ia_review
        with tempfile.TemporaryDirectory(dir=pathlib.Path(__file__).parent) as td:
            path = pathlib.Path(td) / "rotulagem_ia_review.html"
            ia_review.render_review({"hash": "abc", "media_base": "fontes", "itens": [{"id": "x", "videos": ["a.webm"]}]}, {"lote": "abc", "rotulos": []}, {}, path)
            raw = re.search(r'<script id="dados" type="application/json">(.*?)</script>', path.read_text(encoding="utf-8"), re.S).group(1)
            self.assertEqual(json.loads(raw)["batch"]["itens"][0]["videos"], ["fontes/a.webm"])

    def test_generated_data_preserves_text_without_script_injection(self):
        import ia_review
        batch = {"hash": "abc", "itens": [{"id": "model/clip", "videos": ["a.webm"], "folhas": []}]}
        proposal = {"lote": "abc", "revisor": "IA não validada por humano", "rotulos": [{"id": "model/clip", "observacao": "</script><script>alert(1)</script>"}]}
        with tempfile.TemporaryDirectory(dir=pathlib.Path(__file__).parent) as td:
            path = pathlib.Path(td) / "rotulagem_ia_review.html"
            ia_review.render_review(batch, proposal, {}, path)
            html = path.read_text(encoding="utf-8")
            raw = re.search(r'<script id="dados" type="application/json">(.*?)</script>', html, re.S).group(1)
            data = json.loads(raw)
            self.assertEqual(data["export"]["rotulos"][0]["observacao"], "</script><script>alert(1)</script>")
            self.assertNotIn("<script>", raw)
            self.assertEqual(data["batch"]["itens"][0]["videos"], ["../lote_02/a.webm"])

    def test_rejects_mismatching_lote_and_never_overwrites_original(self):
        import ia_review
        with tempfile.TemporaryDirectory(dir=pathlib.Path(__file__).parent) as td:
            path = pathlib.Path(td) / "rotulagem.html"
            path.write_text("humano", encoding="utf-8")
            with self.assertRaises(ValueError):
                ia_review.render_review({"hash": "abc", "itens": []}, {"lote": "xyz", "rotulos": []}, {}, path)
            self.assertEqual(path.read_text(), "humano")
            with self.assertRaises(ValueError):
                ia_review.render_review({"hash": "abc", "itens": []}, {"lote": "abc", "rotulos": []}, {}, path)


if __name__ == "__main__":
    unittest.main()
