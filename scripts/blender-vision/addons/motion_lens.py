bl_info = {
    "name": "Motion Lens (Arenamon)",
    "author": "Arenamon",
    "version": (0, 3, 1),
    "blender": (5, 0, 0),
    "location": "View3D > Sidebar > Motion Lens",
    "description": "Comprime movimento em contact sheets, graficos e diagnosticos priorizados",
    "category": "Animation",
}

# Motion Lens foi dividido por responsabilidade (limite de 2.000 linhas por arquivo, AGENTS.md): este arquivo continua sendo o ponto de
# entrada do addon e reexporta toda a API que existia (analyze_motion, check_contract, render_contact_sheet, register…).
# Instalação: copie ESTE arquivo e a pasta motion_lens_parts/ juntos para a pasta de addons do Blender
# (scripts/blender-vision/instalar_motion_lens.py faz isso). Uma cópia antiga de arquivo único no Blender continua funcionando até ser trocada.
import os
import sys

_AQUI = os.path.dirname(os.path.abspath(__file__))
if _AQUI not in sys.path:
    sys.path.insert(0, _AQUI)

import bpy  # noqa: E402,F401

from motion_lens_parts.common import (DEFAULT_ROLES, EXTRA_ROLES, GHOST_COLL, GRAPH_COLORS, PROFILE_KEYS, REPORT_TEXT, SKELETON_EDGES, TEMP_COLL, TRAIL_COLL, _action_keyed_frames, _armature, _clear_collection, _collection, _color, _context, _ensure_output_dir, _material, _median_mad, _mesh_min_z, _meshes_of, _parse_frames, _parse_mapping, _point_segment_distance_2d, _remove_object_and_data, _resolve_bone, _restore_frame, _safe_angle, _segment_distance, _severity, _world_point, clear_generated)
from motion_lens_parts.contract import (_load_json_value, check_contract, load_contract, load_profile, save_profile)
from motion_lens_parts.analysis import (analyze_motion, build_report)
from motion_lens_parts.graphs import (FONT, _draw_line, _draw_text, _set_pixel, render_graphs)
from motion_lens_parts.sheets import (_bounds_for_frames, _camera_for_view, _capture_skeleton_frames, _evaluated_bounds, render_contact_sheet, render_skeleton_sheet)
from motion_lens_parts.comparison import (_metrics_from_analysis, _sample_action, compare_actions, compare_actions_data, compare_baseline, render_pose_diff_heatmap, render_reference_overlay_sheet, save_baseline)
from motion_lens_parts.report import (_image_data_uri, build_html_report)
from motion_lens_parts.ghosts import (_octahedron_mesh, create_ghosts, create_trails, write_report)
from motion_lens_parts.operators import (ML_OT_apply_impact, ML_OT_check_baseline, ML_OT_clear, ML_OT_contact_sheet, ML_OT_ghosts, ML_OT_graphs, ML_OT_html_report, ML_OT_load_profile, ML_OT_pose_diff, ML_OT_reference_overlay, ML_OT_report, ML_OT_save_baseline, ML_OT_save_profile, ML_OT_silhouette_sheet, ML_OT_skeleton_sheet, ML_OT_strike, ML_OT_trails)
from motion_lens_parts.strikes import (STRIKE_TEXT, _action_fcurves, _strike_samples, analyze_strike, apply_impact)
from motion_lens_parts.ui import (ML_PT_panel, PROPERTIES, classes)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    for name, prop in PROPERTIES.items():
        setattr(bpy.types.Scene, name, prop)


def unregister():
    for name in PROPERTIES:
        if hasattr(bpy.types.Scene, name):
            delattr(bpy.types.Scene, name)
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
