"""Testes unitários da troca transacional do instalador do Motion Lens."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
INSTALLER_PATH = ROOT / "instalar_motion_lens.py"
spec = importlib.util.spec_from_file_location("instalar_motion_lens_test", INSTALLER_PATH)
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="arenamon-motion-lens-", dir=Path(__file__).parent)
        self.base = Path(self.tmp.name)
        self.source = self.base / "source"
        self.dest = self.base / "addons"
        (self.source / "motion_lens_parts").mkdir(parents=True)
        self.dest.mkdir()
        (self.source / "motion_lens.py").write_text("NEW_ENTRY = True\n", encoding="utf-8")
        (self.source / "motion_lens_parts" / "__init__.py").write_text("NEW_PARTS = True\n", encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_instalacao_limpa_publica_entrada_e_modulos(self):
        self.assertTrue(hasattr(installer, "install"), "instalador precisa expor install(dest, source)")
        installer.install(str(self.dest), source=str(self.source))
        self.assertEqual((self.dest / "motion_lens.py").read_text(encoding="utf-8"), "NEW_ENTRY = True\n")
        self.assertEqual((self.dest / "motion_lens_parts" / "__init__.py").read_text(encoding="utf-8"), "NEW_PARTS = True\n")

    def test_falha_na_troca_restaura_entrada_e_modulos_anteriores(self):
        self.assertTrue(hasattr(installer, "install"), "instalador precisa expor install(dest, source)")
        (self.dest / "motion_lens.py").write_text("OLD_ENTRY = True\n", encoding="utf-8")
        (self.dest / "motion_lens_parts").mkdir()
        (self.dest / "motion_lens_parts" / "__init__.py").write_text("OLD_PARTS = True\n", encoding="utf-8")

        real_replace = os.replace

        def fail_new_parts(source, target):
            if Path(target).name == "motion_lens_parts" and ".motion-lens-stage-" in str(source):
                raise OSError("falha simulada durante a troca")
            return real_replace(source, target)

        with mock.patch.object(installer.os, "replace", side_effect=fail_new_parts):
            with self.assertRaises(OSError):
                installer.install(str(self.dest), source=str(self.source))

        self.assertEqual((self.dest / "motion_lens.py").read_text(encoding="utf-8"), "OLD_ENTRY = True\n")
        self.assertEqual((self.dest / "motion_lens_parts" / "__init__.py").read_text(encoding="utf-8"), "OLD_PARTS = True\n")


if __name__ == "__main__":
    unittest.main(verbosity=2)
