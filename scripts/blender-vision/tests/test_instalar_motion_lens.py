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

    def test_falha_ao_remover_modulos_depois_do_backup_restaura_tudo(self):
        self.assertTrue(hasattr(installer, "install"), "instalador precisa expor install(dest, source)")
        old_entry = self.dest / "motion_lens.py"
        old_parts = self.dest / "motion_lens_parts"
        old_entry.write_text("OLD_ENTRY = True\n", encoding="utf-8")
        old_parts.mkdir()
        (old_parts / "__init__.py").write_text("OLD_PARTS = True\n", encoding="utf-8")
        real_rmtree = installer.shutil.rmtree

        def fail_target_once(path, *args, **kwargs):
            if Path(path) == old_parts and not getattr(fail_target_once, "failed", False):
                fail_target_once.failed = True
                raise OSError("falha simulada depois do backup")
            return real_rmtree(path, *args, **kwargs)

        with mock.patch.object(installer.shutil, "rmtree", side_effect=fail_target_once):
            with self.assertRaises(OSError):
                installer.install(str(self.dest), source=str(self.source))

        self.assertTrue(old_entry.exists(), "entrada anterior desapareceu durante rollback")
        self.assertEqual(old_entry.read_text(encoding="utf-8"), "OLD_ENTRY = True\n")
        self.assertEqual((old_parts / "__init__.py").read_text(encoding="utf-8"), "OLD_PARTS = True\n")

    def test_falha_no_staging_nao_toca_na_instalacao_anterior(self):
        old_entry = self.dest / "motion_lens.py"
        old_parts = self.dest / "motion_lens_parts"
        old_entry.write_text("OLD_ENTRY = True\n", encoding="utf-8")
        old_parts.mkdir()
        (old_parts / "__init__.py").write_text("OLD_PARTS = True\n", encoding="utf-8")
        real_copytree = installer.shutil.copytree

        def fail_source_parts(source, target, *args, **kwargs):
            if Path(source) == self.source / "motion_lens_parts":
                raise OSError("falha simulada no staging")
            return real_copytree(source, target, *args, **kwargs)

        with mock.patch.object(installer.shutil, "copytree", side_effect=fail_source_parts):
            with self.assertRaises(OSError):
                installer.install(str(self.dest), source=str(self.source))

        self.assertEqual(old_entry.read_text(encoding="utf-8"), "OLD_ENTRY = True\n")
        self.assertEqual((old_parts / "__init__.py").read_text(encoding="utf-8"), "OLD_PARTS = True\n")

    def test_falha_no_backup_nao_toca_na_instalacao_anterior(self):
        old_entry = self.dest / "motion_lens.py"
        old_parts = self.dest / "motion_lens_parts"
        old_entry.write_text("OLD_ENTRY = True\n", encoding="utf-8")
        old_parts.mkdir()
        (old_parts / "__init__.py").write_text("OLD_PARTS = True\n", encoding="utf-8")
        real_copytree = installer.shutil.copytree

        def fail_backup(source, target, *args, **kwargs):
            if Path(source) == old_parts:
                raise OSError("falha simulada no backup")
            return real_copytree(source, target, *args, **kwargs)

        with mock.patch.object(installer.shutil, "copytree", side_effect=fail_backup):
            with self.assertRaises(OSError):
                installer.install(str(self.dest), source=str(self.source))

        self.assertEqual(old_entry.read_text(encoding="utf-8"), "OLD_ENTRY = True\n")
        self.assertEqual((old_parts / "__init__.py").read_text(encoding="utf-8"), "OLD_PARTS = True\n")


if __name__ == "__main__":
    unittest.main(verbosity=2)
