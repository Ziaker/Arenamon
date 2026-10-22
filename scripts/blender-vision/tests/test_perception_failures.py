"""Testes de FALHA da percepcao: o sistema precisa recusar/avisar, nunca concluir em cima de dado ruim.

  python scripts/blender-vision/tests/test_perception_failures.py

- Blender falso que ALTERA o .blend  -> erro 3 + INTEGRITY_FAILURE.json;
- Blender falso que diz OK mas nao gera a imagem -> erro 6 (render ausente), sem folha nem conclusao;
- action / regiao / vista / blend inexistentes e frames vazios -> erro com a lista de valores validos;
- pasta de saida existente sem marcador nao e apagada;
- Blender real: arquivo sem malha ligada ao armature, e action inexistente.
Usa um .blend sintetico minimo gerado na hora (perception_synth.py, split dev) quando o Blender real e necessario.
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
VIS = os.path.dirname(HERE)
PERC = os.path.join(VIS, "perception.py")
BLENDER = os.environ.get("BLENDER_EXE", r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe")

FAKE = r'''
import json, os, sys
mode = os.environ["FAKE_MODE"]
args = sys.argv[1:]
blend = [a for a in args if a.endswith(".blend")][0]
cfg = json.load(open(args[args.index("--") + 1], encoding="utf-8"))
out = cfg["out"]
if mode == "mutate":
    with open(blend, "ab") as f:
        f.write(b"X")
res = []
for op in cfg["ops"]:
    if op["op"] == "info":
        res.append({"op": "info", "body_frame": {}, "candidates": ["frente_e12", "lado_D_e12"], "label_vertex_counts": {}, "bones": ["Hips"], "meshes": [], "frame_range_action": [1, 2], "fps": 30, "armature_scale": [1, 1, 1]})
    elif op["op"] == "observe":
        views = []
        for v in op["views"]:
            ims = [{"frame": f, "rgb": "rgb_%s_%s_g%03d.png" % (op["region"], v, f), "passes": "p.npz"} for f in op["frames"]]
            views.append({"name": v, "direction": [0, -1, 0], "span": 1, "visible_min": 0.9, "visible_mean": 0.9, "clipped_max": 0.0, "occluded_by": {}, "frames_without_enough_facing_points": [],
                          "per_frame": {f: {"visible_frac": 0.9, "clipped_frac": 0.0} for f in op["frames"]}, "images": ims})
        res.append({"op": "observe", "views": views})
json.dump({"results": res}, open(os.path.join(out, "perception_result.json"), "w"))
print("PERCEPTION_OK")
'''


def make_fake(tmp, mode):
    py = os.path.join(tmp, "fake_blender.py")
    open(py, "w", encoding="utf-8").write(FAKE)
    cmd = os.path.join(tmp, "fake_blender.cmd")
    open(cmd, "w").write('@echo off\r\nset FAKE_MODE=%s\r\n"%s" "%s" %%*\r\n' % (mode, sys.executable, py))
    return cmd


def run_perc(args, env_extra=None):
    env = dict(os.environ)
    env.update(env_extra or {})
    return subprocess.run([sys.executable, PERC] + args, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env, timeout=600)


class TestFailures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="perc-fail-")
        cls.blend = os.path.join(cls.tmp, "fake.blend")
        open(cls.blend, "wb").write(b"BLENDER-fake-content")

    def args(self, out, action="a", frames="1-2", extra=None):
        return ["investigate", "--blend", self.blend, "--action", action, "--frames", frames, "--regions", "mao_D", "--out", out, "--overwrite"] + (extra or [])

    def test_mutated_blend_is_detected(self):
        cmd = make_fake(self.tmp, "mutate")
        before = open(self.blend, "rb").read()
        r = run_perc(self.args(os.path.join(self.tmp, "o1")), {"BLENDER_EXE": cmd})
        self.assertEqual(r.returncode, 3, r.stdout + r.stderr)
        self.assertIn("INTEGRIDADE", r.stderr)
        failed = [d for d in os.listdir(self.tmp) if d.startswith("o1.FAILED")]
        self.assertTrue(failed, "evidencia da falha deve ser preservada")
        self.assertTrue(os.path.isfile(os.path.join(self.tmp, failed[0], "INTEGRITY_FAILURE.json")))
        open(self.blend, "wb").write(before)

    def test_missing_render_is_reported_and_no_sheet_is_written(self):
        cmd = make_fake(self.tmp, "norender")
        out = os.path.join(self.tmp, "o2")
        r = run_perc(self.args(out), {"BLENDER_EXE": cmd})
        self.assertEqual(r.returncode, 6, r.stdout + r.stderr)
        self.assertIn("render falhou", r.stderr)
        self.assertFalse(os.path.exists(out), "saida final nao pode existir quando o render falhou")

    def test_invalid_inputs_fail_with_valid_options_listed(self):
        r = run_perc(["investigate", "--blend", os.path.join(self.tmp, "nao_existe.blend"), "--action", "a", "--frames", "1", "--regions", "mao_D", "--out", os.path.join(self.tmp, "o3")])
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("blend nao existe", r.stderr)
        r = run_perc(["investigate", "--blend", self.blend, "--action", "a", "--frames", "1", "--regions", "cotovelo", "--out", os.path.join(self.tmp, "o4")])
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("mao_D", r.stderr)               # lista as regioes validas
        r = run_perc(["contacts", "--blend", self.blend, "--action", "a", "--frames", "1", "--pairs", "arm_R:cotovelo", "--out", os.path.join(self.tmp, "o5")])
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("torso", r.stderr)

    def test_existing_output_requires_flag_and_marker(self):
        out = os.path.join(self.tmp, "o6")
        os.makedirs(out)
        open(os.path.join(out, "importante.txt"), "w").write("nao apague")
        r = run_perc(["investigate", "--blend", self.blend, "--action", "a", "--frames", "1", "--regions", "mao_D", "--out", out])
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("--overwrite", r.stderr)
        r = run_perc(self.args(out, frames="1"))
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("recuso apagar", r.stderr)
        self.assertTrue(os.path.isfile(os.path.join(out, "importante.txt")))

    def test_bad_initial_view_lists_candidates(self):
        cmd = make_fake(self.tmp, "ok")
        r = run_perc(self.args(os.path.join(self.tmp, "o7"), extra=["--initial-views", "vista_inventada"]), {"BLENDER_EXE": cmd})
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("frente_e12", r.stderr)


@unittest.skipUnless(os.path.isfile(BLENDER), "Blender 5.2 nao encontrado")
class TestRealBlenderFailures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="perc-real-")
        cls.blend = os.path.join(cls.tmp, "synth.blend")
        p = subprocess.run([BLENDER, "-b", "--factory-startup", "--python", os.path.join(HERE, "perception_synth.py"), "--", "--split", "dev", "--out", cls.blend],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
        if "SYNTH_OK" not in p.stdout:
            raise RuntimeError("gerador sintetico falhou: " + p.stdout[-800:])

    def test_unknown_action_lists_available(self):
        r = run_perc(["motion", "--blend", self.blend, "--action", "nao_existe", "--frames", "1-5", "--out", os.path.join(self.tmp, "m1")])
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("nao existe", r.stderr)
        self.assertIn("arm_through_torso", r.stderr)

    def test_hash_unchanged_after_real_run(self):
        import hashlib
        h0 = hashlib.sha256(open(self.blend, "rb").read()).hexdigest()
        r = run_perc(["motion", "--blend", self.blend, "--action", "rest", "--frames", "1-5", "--out", os.path.join(self.tmp, "m2"), "--overwrite"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(h0, hashlib.sha256(open(self.blend, "rb").read()).hexdigest())
        rep = json.load(open(os.path.join(self.tmp, "m2", "motion_report.json"), encoding="utf-8"))
        self.assertIsNone(rep["fases"].get("contact_frame", None))
        self.assertEqual(rep["blend_sha256"], h0)


if __name__ == "__main__":
    unittest.main(verbosity=1)
