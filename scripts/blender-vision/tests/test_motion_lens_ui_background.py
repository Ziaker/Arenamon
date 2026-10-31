"""Inventário funcional do painel Motion Lens em Blender headless."""
import importlib.util
import os
from pathlib import Path
from types import SimpleNamespace
import sys
import tempfile
from unittest import mock

import bpy


args = sys.argv[sys.argv.index("--") + 1:]
ADDON = os.path.abspath(args[0])
spec = importlib.util.spec_from_file_location("motion_lens_ui_test", ADDON)
ml = importlib.util.module_from_spec(spec)
sys.modules["motion_lens_ui_test"] = ml
spec.loader.exec_module(ml)


class Recorder:
    def __init__(self):
        self.props = []
        self.operators = []
        self.labels = []

    def box(self):
        return self

    def column(self, **_kwargs):
        return self

    def row(self, **_kwargs):
        return self

    def prop(self, _owner, name, **_kwargs):
        self.props.append(name)

    def operator(self, name, **_kwargs):
        self.operators.append(name)

    def label(self, text="", **_kwargs):
        self.labels.append(text)

    def separator(self):
        return None


layout = Recorder()
ml.ML_PT_panel.draw(SimpleNamespace(layout=layout), bpy.context)

expected_operators = {
    "motionlens.contact_sheet", "motionlens.silhouette_sheet", "motionlens.skeleton_sheet",
    "motionlens.graphs", "motionlens.report", "motionlens.html_report",
    "motionlens.reference_overlay", "motionlens.pose_diff", "motionlens.trails",
    "motionlens.ghosts", "motionlens.save_profile", "motionlens.load_profile",
    "motionlens.save_baseline", "motionlens.check_baseline", "motionlens.clear",
    "motionlens.strike", "motionlens.apply_impact",
}
expected_sections = {
    "Gerar evidencias", "Comparar animacoes", "Visualizar movimento",
    "Diagnosticar movimento", "Analisar e derivar golpe", "Perfis", "Limpeza",
}

expected_strike_properties = {
    "motion_lens_strike_effectors", "motion_lens_hold_speed",
    "motion_lens_strike_frames", "motion_lens_hold_frames",
}

assert set(layout.props) == set(ml.PROPERTIES), (
    "propriedades ausentes=%s extras=%s" %
    (sorted(set(ml.PROPERTIES) - set(layout.props)), sorted(set(layout.props) - set(ml.PROPERTIES)))
)
assert set(layout.operators) == expected_operators, (
    "operadores ausentes=%s extras=%s" %
    (sorted(expected_operators - set(layout.operators)), sorted(set(layout.operators) - expected_operators))
)
assert expected_sections.issubset(set(layout.labels)), sorted(set(layout.labels))
assert expected_strike_properties.issubset(set(layout.props)), sorted(set(layout.props))

version_text = ".".join(str(part) for part in ml.bl_info["version"])
assert ml.ML_PT_panel.bl_label == "Motion Lens " + version_text, ml.ML_PT_panel.bl_label
assert hasattr(ml, "VERSION_TEXT") and ml.VERSION_TEXT == version_text

for _cycle in range(2):
    ml.register()
    assert all(hasattr(bpy.types.Scene, name) for name in ml.PROPERTIES)
    assert hasattr(bpy.ops.motionlens, "strike")
    assert hasattr(bpy.ops.motionlens, "apply_impact")
    ml.unregister()
    assert all(not hasattr(bpy.types.Scene, name) for name in ml.PROPERTIES)

from motion_lens_parts import report as report_module

with tempfile.TemporaryDirectory(prefix="motion-lens-report-", dir=Path(__file__).parent) as temp_dir:
    image_path = Path(temp_dir) / "placeholder.png"
    image_path.write_bytes(b"PNG")
    output_path = Path(temp_dir) / "report.html"
    with mock.patch.object(report_module, "analyze_motion", return_value={}), \
         mock.patch.object(report_module, "build_report", return_value="diagnostico"), \
         mock.patch.object(report_module, "render_graphs", return_value=str(image_path)), \
         mock.patch.object(report_module, "render_skeleton_sheet", return_value=str(image_path)):
        report_module.build_html_report(bpy.context, str(output_path), include_renders=False)
    report_html = output_path.read_text(encoding="utf-8")
    assert "<h1>Motion Lens " + version_text + "</h1>" in report_html

print("PASS: inventario Motion Lens (%d propriedades, %d operadores)" % (len(layout.props), len(layout.operators)))
