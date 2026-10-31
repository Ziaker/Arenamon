# Motion Lens — parte «ui» (dividida de motion_lens.py; a API pública continua em motion_lens.py).
import bpy
from bpy.props import BoolProperty, FloatProperty, IntProperty, StringProperty
from .comparison import save_baseline
from .contract import load_profile, save_profile
from .operators import ML_OT_check_baseline, ML_OT_clear, ML_OT_contact_sheet, ML_OT_ghosts, ML_OT_graphs, ML_OT_html_report, ML_OT_load_profile, ML_OT_pose_diff, ML_OT_reference_overlay, ML_OT_report, ML_OT_save_baseline, ML_OT_save_profile, ML_OT_silhouette_sheet, ML_OT_skeleton_sheet, ML_OT_trails
from .version import VERSION_TEXT


class ML_PT_panel(bpy.types.Panel):
    bl_label = "Motion Lens " + VERSION_TEXT
    bl_idname = "ML_PT_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "Motion Lens"
    def draw(self, context):
        scene = context.scene
        col = self.layout.box().column(align=True)
        col.label(text="Gerar evidencias")
        col.prop(scene, "motion_lens_frames")
        col.prop(scene, "motion_lens_output_dir")
        col.prop(scene, "motion_lens_camera_names")
        col.prop(scene, "motion_lens_tick_step")
        col.operator("motionlens.contact_sheet")
        col.operator("motionlens.silhouette_sheet")
        col.operator("motionlens.skeleton_sheet")
        col.operator("motionlens.graphs")
        col.operator("motionlens.report")
        col.operator("motionlens.html_report")

        col = self.layout.box().column(align=True)
        col.label(text="Comparar animacoes")
        col.prop(scene, "motion_lens_reference_action")
        col.operator("motionlens.reference_overlay")
        col.operator("motionlens.pose_diff")
        col.prop(scene, "motion_lens_baseline_path")
        row = col.row(align=True)
        row.operator("motionlens.save_baseline")
        row.operator("motionlens.check_baseline")

        col = self.layout.box().column(align=True)
        col.label(text="Visualizar movimento")
        col.prop(scene, "motion_lens_bones")
        col.prop(scene, "motion_lens_use_tail")
        col.prop(scene, "motion_lens_alpha")
        col.operator("motionlens.trails")
        col.operator("motionlens.ghosts")

        col = self.layout.box().column(align=True)
        col.label(text="Diagnosticar movimento")
        col.prop(scene, "motion_lens_bone_map")
        col.prop(scene, "motion_lens_contract")
        col.prop(scene, "motion_lens_max_issues")
        col.prop(scene, "motion_lens_contact_margin")
        col.prop(scene, "motion_lens_locked_speed")
        col.prop(scene, "motion_lens_slide_threshold")
        col.prop(scene, "motion_lens_ground_z")
        col.prop(scene, "motion_lens_penetration_tolerance")
        col.prop(scene, "motion_lens_pop_min")
        col.prop(scene, "motion_lens_pop_mad")
        col.prop(scene, "motion_lens_direction_min")
        col.prop(scene, "motion_lens_direction_dot")
        col.prop(scene, "motion_lens_rotation_jump")
        col.prop(scene, "motion_lens_scale_tolerance")
        col.prop(scene, "motion_lens_support_margin")
        col.prop(scene, "motion_lens_capsule_radius")
        col.prop(scene, "motion_lens_hyperextension")
        col.prop(scene, "motion_lens_pause_speed")
        col.prop(scene, "motion_lens_pause_frames")
        col.prop(scene, "motion_lens_uniform_frames")
        col.prop(scene, "motion_lens_uniform_cv")
        col.prop(scene, "motion_lens_arc_break_angle")
        col.prop(scene, "motion_lens_arc_straight_angle")
        col.prop(scene, "motion_lens_arc_straight_frames")
        col.prop(scene, "motion_lens_tangent_break_ratio")
        col.prop(scene, "motion_lens_extra_motion_min")

        col = self.layout.box().column(align=True)
        col.label(text="Perfis")
        col.prop(scene, "motion_lens_profile_path")
        row = col.row(align=True)
        row.operator("motionlens.save_profile")
        row.operator("motionlens.load_profile")

        col = self.layout.box().column(align=True)
        col.label(text="Limpeza")
        col.operator("motionlens.clear")


classes = (
    ML_OT_ghosts, ML_OT_trails, ML_OT_report, ML_OT_graphs,
    ML_OT_contact_sheet, ML_OT_silhouette_sheet, ML_OT_skeleton_sheet,
    ML_OT_reference_overlay, ML_OT_pose_diff, ML_OT_html_report,
    ML_OT_save_profile, ML_OT_load_profile, ML_OT_save_baseline, ML_OT_check_baseline,
    ML_OT_clear, ML_PT_panel,
)


PROPERTIES = {
    "motion_lens_frames": StringProperty(name="Frames", default="1,5,9,13,17,21,25,29,33,37,41"),
    "motion_lens_alpha": FloatProperty(name="Opacidade", default=0.35, min=0.05, max=1.0),
    "motion_lens_bones": StringProperty(name="Ossos", default="RightHand,LeftHand,RightFoot,LeftFoot,Head,Hips"),
    "motion_lens_use_tail": BoolProperty(name="Usar ponta do osso", default=False),
    "motion_lens_bone_map": StringProperty(name="Mapa JSON", default="{}", description='Ex.: {"Hips":"root"}'),
    "motion_lens_output_dir": StringProperty(name="Saida", subtype='DIR_PATH', default="//motion_lens_output"),
    "motion_lens_max_issues": IntProperty(name="Max. alertas", default=12, min=1, max=100),
    "motion_lens_tick_step": IntProperty(name="Passo das marcas", default=5, min=1, max=100),
    "motion_lens_contact_margin": FloatProperty(name="Margem contato", default=0.035, min=0.001, max=1.0, unit='LENGTH'),
    "motion_lens_locked_speed": FloatProperty(name="Velocidade travado", default=0.015, min=0.0001, max=1.0),
    "motion_lens_slide_threshold": FloatProperty(name="Limiar slide", default=0.025, min=0.001, max=1.0, unit='LENGTH'),
    "motion_lens_ground_z": FloatProperty(name="Chao Z", default=0.0, unit='LENGTH'),
    "motion_lens_penetration_tolerance": FloatProperty(name="Tolerancia penetracao", default=0.02, min=0.001, max=1.0, unit='LENGTH'),
    "motion_lens_pop_min": FloatProperty(name="Pop minimo", default=0.08, min=0.001, max=10.0),
    "motion_lens_pop_mad": FloatProperty(name="Pop MAD", default=6.0, min=1.0, max=30.0),
    "motion_lens_direction_min": FloatProperty(name="Movimento minimo", default=0.015, min=0.001, max=1.0),
    "motion_lens_direction_dot": FloatProperty(name="Dot inversao", default=-0.75, min=-1.0, max=0.0),
    "motion_lens_rotation_jump": FloatProperty(name="Salto rotacao (graus)", default=75.0, min=1.0, max=180.0),
    "motion_lens_scale_tolerance": FloatProperty(name="Tolerancia escala", default=0.02, min=0.001, max=1.0),
    "motion_lens_contract": StringProperty(name="Contrato JSON", default="", subtype='FILE_PATH'),
    "motion_lens_profile_path": StringProperty(name="Perfil", default="", subtype='FILE_PATH'),
    "motion_lens_baseline_path": StringProperty(name="Baseline", default="", subtype='FILE_PATH'),
    "motion_lens_reference_action": StringProperty(name="Action referencia", default=""),
    "motion_lens_camera_names": StringProperty(name="Cameras", default="", description="Nomes separados por virgula; vazio usa frontal/lateral/topo"),
    "motion_lens_support_margin": FloatProperty(name="Margem apoio", default=0.12, min=0.001, max=2.0, unit='LENGTH'),
    "motion_lens_capsule_radius": FloatProperty(name="Raio capsula", default=0.07, min=0.001, max=1.0, unit='LENGTH'),
    "motion_lens_hyperextension": FloatProperty(name="Hiperextensao", default=175.0, min=90.0, max=180.0),
    "motion_lens_pause_speed": FloatProperty(name="Velocidade pausa", default=0.006, min=0.0001, max=1.0),
    "motion_lens_pause_frames": IntProperty(name="Frames pausa", default=3, min=2, max=30),
    "motion_lens_uniform_frames": IntProperty(name="Janela uniforme", default=5, min=3, max=60),
    "motion_lens_uniform_cv": FloatProperty(name="CV uniforme", default=0.08, min=0.001, max=1.0),
    "motion_lens_arc_break_angle": FloatProperty(name="Quebra de arco", default=65.0, min=1.0, max=180.0),
    "motion_lens_arc_straight_angle": FloatProperty(name="Arco quase reto", default=2.0, min=0.0, max=45.0),
    "motion_lens_arc_straight_frames": IntProperty(name="Frames arco reto", default=5, min=2, max=60),
    "motion_lens_tangent_break_ratio": FloatProperty(name="Quebra tangente", default=0.65, min=0.01, max=1.0),
    "motion_lens_extra_motion_min": FloatProperty(name="Movimento extra minimo", default=0.02, min=0.0001, max=2.0),
}
