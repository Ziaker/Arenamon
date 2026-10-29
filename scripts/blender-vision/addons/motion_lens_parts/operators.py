# Motion Lens — parte «operators» (dividida de motion_lens.py; a API pública continua em motion_lens.py).
import bpy
from .common import clear_generated
from .comparison import compare_baseline, render_pose_diff_heatmap, render_reference_overlay_sheet, save_baseline
from .contract import load_profile, save_profile
from .ghosts import create_ghosts, create_trails, write_report
from .graphs import render_graphs
from .report import build_html_report
from .sheets import render_contact_sheet, render_skeleton_sheet
from .strikes import analyze_strike, apply_impact


class ML_OT_ghosts(bpy.types.Operator):
    bl_idname = "motionlens.ghosts"
    bl_label = "Fantasmas de pose"
    def execute(self, context):
        try:
            count = create_ghosts(context)
            self.report({'INFO'}, "%d fantasmas criados" % count)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_trails(bpy.types.Operator):
    bl_idname = "motionlens.trails"
    bl_label = "Trilhas das juntas"
    def execute(self, context):
        try:
            count = create_trails(context)
            self.report({'INFO'}, "%d trilhas criadas" % count)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_report(bpy.types.Operator):
    bl_idname = "motionlens.report"
    bl_label = "Diagnostico priorizado"
    def execute(self, context):
        try:
            write_report(context)
            self.report({'INFO'}, "Relatorio em ML_Report")
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_graphs(bpy.types.Operator):
    bl_idname = "motionlens.graphs"
    bl_label = "Graficos PNG"
    def execute(self, context):
        try:
            path = render_graphs(context)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_contact_sheet(bpy.types.Operator):
    bl_idname = "motionlens.contact_sheet"
    bl_label = "Contact sheet PNG"
    def execute(self, context):
        try:
            path = render_contact_sheet(context)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_silhouette_sheet(bpy.types.Operator):
    bl_idname = "motionlens.silhouette_sheet"
    bl_label = "Silhuetas PNG"
    def execute(self, context):
        try:
            path = render_contact_sheet(context, silhouette=True)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_skeleton_sheet(bpy.types.Operator):
    bl_idname = "motionlens.skeleton_sheet"
    bl_label = "Esqueleto PNG"
    def execute(self, context):
        try:
            path = render_skeleton_sheet(context)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_reference_overlay(bpy.types.Operator):
    bl_idname = "motionlens.reference_overlay"
    bl_label = "Sobrepor referencia"
    def execute(self, context):
        try:
            path = render_reference_overlay_sheet(context, context.scene.motion_lens_reference_action)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_pose_diff(bpy.types.Operator):
    bl_idname = "motionlens.pose_diff"
    bl_label = "Mapa de diferencas"
    def execute(self, context):
        try:
            current = context.active_object.animation_data.action if context.active_object and context.active_object.animation_data else None
            path = render_pose_diff_heatmap(context, current, context.scene.motion_lens_reference_action)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_html_report(bpy.types.Operator):
    bl_idname = "motionlens.html_report"
    bl_label = "Relatorio HTML completo"
    def execute(self, context):
        try:
            path = build_html_report(context)
            self.report({'INFO'}, "Salvo: " + path)
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_save_profile(bpy.types.Operator):
    bl_idname = "motionlens.save_profile"
    bl_label = "Salvar perfil"
    def execute(self, context):
        try:
            self.report({'INFO'}, "Salvo: " + save_profile(context))
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_load_profile(bpy.types.Operator):
    bl_idname = "motionlens.load_profile"
    bl_label = "Carregar perfil"
    def execute(self, context):
        try:
            self.report({'INFO'}, "Carregado: " + load_profile(context))
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_save_baseline(bpy.types.Operator):
    bl_idname = "motionlens.save_baseline"
    bl_label = "Salvar baseline"
    def execute(self, context):
        try:
            self.report({'INFO'}, "Salvo: " + save_baseline(context))
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_check_baseline(bpy.types.Operator):
    bl_idname = "motionlens.check_baseline"
    bl_label = "Comparar baseline"
    def execute(self, context):
        try:
            result = compare_baseline(context)
            text = "BASELINE: PASSOU" if result["passed"] else "BASELINE: FALHOU\n" + "\n".join(result["regressions"])
            block = bpy.data.texts.get("ML_Regression") or bpy.data.texts.new("ML_Regression")
            block.clear(); block.write(text)
            self.report({'INFO'} if result["passed"] else {'WARNING'}, text.splitlines()[0])
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_clear(bpy.types.Operator):
    bl_idname = "motionlens.clear"
    bl_label = "Limpar auxiliares"
    def execute(self, context):
        clear_generated()
        return {'FINISHED'}




class ML_OT_strike(bpy.types.Operator):
    bl_idname = "motionlens.strike"
    bl_label = "Analisar golpe"
    bl_description = "Acha o contato, mede a duracao do bote, a aceleracao ate o contato e a segurada do impacto"
    def execute(self, context):
        try:
            info = analyze_strike(context)
            self.report({'INFO'}, "Contato f%d, bote %d frames, segurada %d. Detalhes em ML_Golpe" % (info["contact"], info["strike"], info["hold"]))
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}


class ML_OT_apply_impact(bpy.types.Operator):
    bl_idname = "motionlens.apply_impact"
    bl_label = "Aplicar impacto (versao derivada)"
    bl_description = "Cria uma copia da action com o bote no numero de frames alvo, acelerando ate o contato e segurando o impacto. A original nao muda"
    def execute(self, context):
        try:
            r = apply_impact(context)
            self.report({'INFO'}, "%s: bote f%d-f%d, segura ate f%d" % (r["action"], r["windup"], r["contact"], r["hold_end"]))
            return {'FINISHED'}
        except Exception as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}
