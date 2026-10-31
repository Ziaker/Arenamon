"""Diagnóstico de coexistência de duas cópias do Motion Lens; não altera instalação."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile


args = sys.argv[sys.argv.index("--") + 1:]
SOURCE = Path(args[0]).resolve().parent


def load(name, entry):
    spec = importlib.util.spec_from_file_location(name, entry)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


with tempfile.TemporaryDirectory(prefix="motion-lens-cache-", dir=Path(__file__).parent) as temp_dir:
    root = Path(temp_dir)
    copies = []
    for suffix in ("1", "2"):
        target = root / ("copy_" + suffix)
        shutil.copytree(SOURCE, target, ignore=shutil.ignore_patterns("__pycache__"))
        (target / "motion_lens_parts" / "version.py").write_text(
            "VERSION = (9, 9, %s)\nVERSION_TEXT = '9.9.%s'\n" % (suffix, suffix), encoding="utf-8"
        )
        copies.append(target)
    first = load("motion_lens_probe_a", copies[0] / "motion_lens.py")
    second = load("motion_lens_probe_b", copies[1] / "motion_lens.py")
    result = {
        "first_expected": "9.9.1",
        "first_loaded": first.VERSION_TEXT,
        "second_expected": "9.9.2",
        "second_loaded": second.VERSION_TEXT,
        "cache_collision": second.VERSION_TEXT != "9.9.2",
        "parts_file": os.path.abspath(sys.modules["motion_lens_parts"].__file__),
    }
    print("MOTION_LENS_IMPORT_CACHE " + json.dumps(result, ensure_ascii=False))
