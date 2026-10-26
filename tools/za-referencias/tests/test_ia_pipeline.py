"""Policy tests use declared observations, not a pretend visual classifier."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.find_spec('ia_pipeline')
        cls.api = __import__('ia_pipeline') if spec else None

    def setUp(self):
        self.assertIsNotNone(self.api, 'ia_pipeline must implement evidence policy')

    def proof(self, **changes):
        p = dict(nivel='B', quadros=[[0, 10]], vistas=[0, 1],
                 visual_inspecionado=True, justificativa='Observação específica nos dois ângulos.',
                 funcao_confirmada=True, lateralidade_confirmada=True)
        p.update(changes)
        return p

    def gate(self, field, value, **changes):
        return self.api.evidence_gate(field, value, self.proof(**changes))

    def test_01_antenna_distance_is_not_attack_function(self):
        self.assertTrue(self.gate('executores', ['apendice_sensorial'], funcao_confirmada=False))
        self.assertEqual(self.gate('executores', ['braco_D']), [])

    def test_02_jaw_is_valid_executor(self):
        self.assertEqual(self.gate('executores', ['mandibula']), [])

    def test_03_two_executors_are_allowed(self):
        self.assertEqual(self.gate('executores', ['braco_D', 'braco_E']), [])

    def test_04_occlusion_does_not_prove_disappearance(self):
        self.assertTrue(self.gate('parte_some_aparece', 'sim', causa='oclusao'))
        self.assertEqual(self.gate('parte_some_aparece', 'nao', causa='oclusao'), [])

    def test_05_multiple_peaks_preserved(self):
        self.assertEqual(self.api.event_frames([{'inicio': 3, 'pico': 7, 'fim': 9}, {'inicio': 12, 'pico': 14, 'fim': 18}], 20), [3, 7, 9, 12, 14, 18])

    def test_06_short_recoil_long_hold(self):
        self.assertEqual(self.api.active_recoil_duration(2, 7, 32), 5)
        self.assertTrue(self.gate('antecipacao_q', 30, recuo_ativo=[2, 7], golpe_inicio=32))
        self.assertEqual(self.gate('antecipacao_q', 5, recuo_ativo=[2, 7], golpe_inicio=32), [])

    def test_07_walk_without_root_motion_does_not_confirm_floor(self):
        self.assertTrue(self.gate('apoio', 'sim', root_motion=False, chao_observavel=False))

    def test_08_run_with_root_motion_does_not_confirm_floor(self):
        self.assertTrue(self.gate('apoio', 'sim', root_motion=True, chao_observavel=False))

    def test_09_stationary_foot_without_floor_is_inconclusive(self):
        self.assertEqual(self.gate('apoio', 'INCONCLUSIVO', nivel='INCONCLUSIVO', visual_inspecionado=False, quadros=[]), [])

    def test_10_screen_side_cannot_establish_laterality(self):
        self.assertTrue(self.gate('executores', ['braco_D'], lateralidade_confirmada=False))

    def test_11_simultaneous_initiators_legacy_field_inconclusive(self):
        self.assertTrue(self.gate('iniciador', 'braco_D', simultaneos=['braco_D', 'nucleo']))
        self.assertEqual(self.gate('iniciadores', ['braco_D', 'nucleo']), [])

    def test_12_missing_3d_prevents_level_a(self):
        self.assertTrue(self.gate('executores', ['braco_D'], nivel='A', cinematica_confirmada=False))
        self.assertEqual(self.gate('executores', ['braco_D'], nivel='B'), [])

    def test_13_desynchronized_videos_fail_timeline(self):
        a = dict(fps=60, quadros=3, tempos=[0, 1/60, 2/60])
        b = dict(fps=60, quadros=3, tempos=[0.1, 0.1+1/60, 0.1+2/60])
        self.assertFalse(self.api.compare_timelines([a, b], 60, 3)['compativeis'])
        self.assertTrue(self.api.compare_timelines([a, a], 60, 3)['compativeis'])

    def test_14_nonhumanoid_tail_and_tongue_allowed(self):
        self.assertEqual(self.gate('executores', ['cauda', 'lingua']), [])

    def test_15_no_evidence_cannot_confirm_answer(self):
        self.assertTrue(self.gate('leitura_pose', 'clara', visual_inspecionado=False))
        self.assertTrue(self.gate('leitura_pose', 'clara', quadros=[]))

    def test_16_existing_human_file_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as td:
            p = Path(td)/'human.json'; p.write_text('{"revisor":"humano"}')
            with self.assertRaises(FileExistsError):
                self.api.write_new_json(p, {'revisor':'IA'})
            self.assertEqual(json.loads(p.read_text())['revisor'], 'humano')

    def test_parse_active_items_without_executing_javascript(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as td:
            p = Path(td)/'rotulagem.html'
            p.write_text('const LOTE = '+json.dumps({'itens':[{'n':1,'id':'a/b'},{'n':2,'id':'c/d'}], 'ignorados':[2]})+';\nconst CHAVE = "rotulagem_za_" + "abcdef123456";', encoding='utf8')
            b = self.api.read_lote(p)
            self.assertEqual([x['id'] for x in b['itens']], ['a/b'])
            self.assertEqual(b['hash'], 'abcdef123456')
            p.write_text('const LOTE = alert("unsafe");', encoding='utf8')
            with self.assertRaises(ValueError): self.api.read_lote(p)

    def test_hash_includes_content_and_interpretation(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as td:
            p = Path(td)/'input'; p.write_bytes(b'a')
            a = self.api.cache_key([p], {'notes':'first'})
            self.assertNotEqual(a, self.api.cache_key([p], {'notes':'second'}))
            p.write_bytes(b'b')
            self.assertNotEqual(a, self.api.cache_key([p], {'notes':'first'}))

    def test_real_batch_exact_scope(self):
        b = self.api.read_lote(ROOT.parents[1]/'dumper test/za-referencias/avaliacao/lote_02/rotulagem.html')
        self.assertEqual([x['n'] for x in b['itens']], [1,7,9,14])
        self.assertEqual(b['hash'], '477115ec150e')
        self.assertIn('pesado', b['schema']['massa_aparente'])

    def test_export_rejects_missing_duplicate_foreign_and_invalid(self):
        b = {'hash':'abc','itens':[{'id':'a/b'}], 'schema':self.api.default_schema()}
        r = dict(id='a/b', executores='INCONCLUSIVO', iniciador='INCONCLUSIVO', antecipacao='INCONCLUSIVO', parte_some_aparece='INCONCLUSIVO', apoio='INCONCLUSIVO', leitura_pose='INCONCLUSIVO', massa_aparente='INCONCLUSIVO', intencao='INCONCLUSIVO', observacao='Não observável por ausência de quadro.')
        e = {'lote':'abc','revisor':'IA — não validada por humano','rotulos':[r]}
        self.assertEqual(self.api.validate_export(e,b), [])
        self.assertTrue(self.api.validate_export({**e,'rotulos':[]},b))
        self.assertTrue(self.api.validate_export({**e,'rotulos':[r,r]},b))
        self.assertTrue(self.api.validate_export({**e,'rotulos':[{**r,'id':'foreign'}]},b))
        self.assertTrue(self.api.validate_export({**e,'rotulos':[{**r,'intencao':'furioso'}]},b))

    def test_snapshot_is_content_addressed_and_preserves_previous_copy(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as td:
            d=Path(td); source=d/'input.txt'; source.write_text('first')
            a=self.api.snapshot_file(source,d/'copies')
            source.write_text('second')
            b=self.api.snapshot_file(source,d/'copies')
            self.assertNotEqual(a['copia'],b['copia'])
            self.assertEqual(Path(a['copia']).read_text(),'first')
            self.assertEqual(Path(b['copia']).read_text(),'second')


if __name__ == '__main__': unittest.main()
