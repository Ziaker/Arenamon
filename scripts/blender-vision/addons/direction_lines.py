bl_info = {
    "name": "Direction Lines (Arenamon)",
    "author": "Arenamon",
    "version": (0, 1, 1),
    "blender": (4, 0, 0),
    "location": "View3D > Sidebar > Direction Lines",
    "description": "Linhas de acao e linhas de movimento editaveis, que a IA le e compara com a animacao",
    "category": "Animation",
}

import bpy
import json
import math
from mathutils import Vector, geometry
from bpy.props import StringProperty, IntProperty

COLL = "DL_Guides"
SPINE = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head"]


def _arm(context):
    ob = context.active_object
    if ob and ob.type == 'ARMATURE':
        return ob
    for o in context.scene.objects:
        if o.type == 'ARMATURE':
            return o
    return None


def _bone(arm, name):
    return arm.pose.bones.get(name) or arm.pose.bones.get("mixamorig:" + name)


def _coll(scene):
    c = bpy.data.collections.get(COLL)
    if c is None:
        c = bpy.data.collections.new(COLL)
        scene.collection.children.link(c)
    return c


def _make_curve(scene, name, pts, kind, color, **props):
    if len(pts) < 2:
        raise ValueError("Uma linha precisa de pelo menos dois pontos")
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 0.008
    cu.resolution_u = 12
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        bp = sp.bezier_points[i]
        bp.co = p
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    mat = bpy.data.materials.get("DL_" + kind)
    if mat is None:
        mat = bpy.data.materials.new("DL_" + kind)
        mat.use_nodes = True
    mat.diffuse_color = (color[0], color[1], color[2], 1.0)
    for n in mat.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            n.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    cu.materials.append(mat)
    ob = bpy.data.objects.new(name, cu)
    ob["dl_kind"] = kind
    for k, v in props.items():
        ob[k] = v
    ob.show_in_front = True
    _coll(scene).objects.link(ob)
    return ob


def sample_guide(ob, per_seg=32):
    """polilinha em coordenadas de mundo (lista de Vector)"""
    pts = []
    for sp in ob.data.splines:
        if sp.type == 'BEZIER':
            bps = sp.bezier_points
            for i in range(len(bps) - 1):
                a, b = bps[i], bps[i + 1]
                seg = geometry.interpolate_bezier(a.co, a.handle_right, b.handle_left, b.co, per_seg)
                if pts:
                    seg = seg[1:]
                pts += [ob.matrix_world @ v for v in seg]
        else:
            pts += [ob.matrix_world @ Vector(p.co[:3]) for p in sp.points]
    return pts


def _nearest(poly, p):
    best, bi, bt = 1e9, 0, 0.0
    for i in range(len(poly) - 1):
        a, b = poly[i], poly[i + 1]
        ab = b - a
        L2 = ab.length_squared
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, (p - a).dot(ab) / L2))
        d = (a + ab * t - p).length
        if d < best:
            best, bi, bt = d, i, t
    return best, bi + bt


def _length(poly):
    return sum((poly[i + 1] - poly[i]).length for i in range(len(poly) - 1))


class DL_OT_new_motion(bpy.types.Operator):
    bl_idname = "dirlines.new_motion"
    bl_label = "Linha de movimento (de um osso)"
    bl_description = "Cria uma curva editavel com a trajetoria atual do osso entre os frames indicados. Edite os pontos (Tab) para desenhar o movimento desejado"

    def execute(self, context):
        sc = context.scene
        arm = _arm(context)
        b = _bone(arm, sc.dl_bone) if arm else None
        if b is None:
            self.report({'ERROR'}, "Osso nao encontrado")
            return {'CANCELLED'}
        f0, f1 = sc.dl_f0, sc.dl_f1
        if f1 <= f0:
            self.report({'ERROR'}, "O frame final precisa ser maior que o inicial")
            return {'CANCELLED'}
        keep = sc.frame_current
        n = max(4, min(9, (f1 - f0) // 2 + 1))
        frames = [round(f0 + (f1 - f0) * i / (n - 1)) for i in range(n)]
        pts = []
        for f in frames:
            sc.frame_set(f)
            pts.append(arm.matrix_world @ b.head)
        sc.frame_set(keep)
        ob = _make_curve(sc, "DL_motion_" + b.name.replace("mixamorig:", ""), pts, "MOTION", (1.0, 0.55, 0.0), dl_bone=b.name, dl_f0=f0, dl_f1=f1)
        context.view_layer.objects.active = ob
        self.report({'INFO'}, "Linha de movimento criada: selecione-a e use Tab para mover os pontos")
        return {'FINISHED'}


class DL_OT_new_action(bpy.types.Operator):
    bl_idname = "dirlines.new_action"
    bl_label = "Linha de ação (do corpo)"
    bl_description = "Cria uma curva editavel ao longo da coluna (quadril a cabeca) no frame atual. Edite os pontos para desenhar a linha de acao desejada"

    def execute(self, context):
        sc = context.scene
        arm = _arm(context)
        if arm is None:
            self.report({'ERROR'}, "Selecione um armature")
            return {'CANCELLED'}
        pts = []
        for n in SPINE:
            b = _bone(arm, n)
            if b:
                pts.append(arm.matrix_world @ b.head)
        hd = _bone(arm, "Head")
        if hd:
            pts.append(arm.matrix_world @ hd.tail)
        if len(pts) < 2:
            self.report({'ERROR'}, "A coluna precisa ter pelo menos dois pontos reconhecidos")
            return {'CANCELLED'}
        ob = _make_curve(sc, "DL_action_f%d" % sc.frame_current, pts, "ACTION", (0.1, 0.9, 1.0), dl_frame=sc.frame_current)
        context.view_layer.objects.active = ob
        self.report({'INFO'}, "Linha de acao criada para o frame %d" % sc.frame_current)
        return {'FINISHED'}


class DL_OT_dump(bpy.types.Operator):
    bl_idname = "dirlines.dump"
    bl_label = "Exportar guias (texto)"
    bl_description = "Escreve no texto 'DL_Guides' as linhas, com pontos em coordenadas de mundo e metadados"

    def execute(self, context):
        out = dump_guides()
        t = bpy.data.texts.get("DL_Guides") or bpy.data.texts.new("DL_Guides")
        t.clear()
        t.write(json.dumps(out, indent=1))
        self.report({'INFO'}, "%d guias no texto DL_Guides" % len(out))
        return {'FINISHED'}


def dump_guides(n=24):
    c = bpy.data.collections.get(COLL)
    out = []
    if not c:
        return out
    for ob in c.objects:
        poly = sample_guide(ob)
        if len(poly) < 2:
            continue
        L = _length(poly)
        samp = []
        acc, i = 0.0, 0
        for k in range(n):
            target = L * k / (n - 1)
            while i < len(poly) - 2 and acc + (poly[i + 1] - poly[i]).length < target:
                acc += (poly[i + 1] - poly[i]).length
                i += 1
            seg = (poly[i + 1] - poly[i]).length or 1.0
            t = max(0.0, min(1.0, (target - acc) / seg))
            samp.append([round(v, 4) for v in (poly[i].lerp(poly[i + 1], t))])
        out.append({"name": ob.name, "kind": ob.get("dl_kind"), "bone": ob.get("dl_bone"), "f0": ob.get("dl_f0"), "f1": ob.get("dl_f1"),
                    "frame": ob.get("dl_frame"), "length_m": round(L, 3), "points": samp})
    return out


def compare(context):
    sc = context.scene
    arm = _arm(context)
    c = bpy.data.collections.get(COLL)
    L = ["DIRECTION LINES - comparacao entre guias e animacao"]
    if not c or not c.objects:
        return "Nenhuma guia."
    keep = sc.frame_current
    for ob in c.objects:
        kind = ob.get("dl_kind")
        poly = sample_guide(ob)
        if len(poly) < 2:
            L.append("")
            L.append("%s: ignorada; guia com menos de dois pontos" % ob.name)
            continue
        total = _length(poly)
        if kind == "MOTION":
            if arm is None:
                L.append("")
                L.append("%s: ignorada; nenhum armature selecionado ou unico na cena" % ob.name)
                continue
            bone_name = ob.get("dl_bone")
            b = _bone(arm, bone_name) if bone_name else None
            if b is None:
                L.append("")
                L.append("%s: ignorada; osso %s nao encontrado" % (ob.name, bone_name or "nao informado"))
                continue
            f0, f1 = int(ob["dl_f0"]), int(ob["dl_f1"])
            rows = []
            prog = []
            for f in range(f0, f1 + 1):
                sc.frame_set(f)
                p = arm.matrix_world @ b.head
                d, s = _nearest(poly, p)
                rows.append((f, d))
                prog.append(s)
            sc.frame_set(f1)
            end = (arm.matrix_world @ b.head - poly[-1]).length
            sc.frame_set(f0)
            start = (arm.matrix_world @ b.head - poly[0]).length
            ds = [d for _, d in rows]
            worst = sorted(rows, key=lambda r: -r[1])[:5]
            back = sum(1 for i in range(len(prog) - 1) if prog[i + 1] < prog[i] - 0.5)
            L.append("")
            L.append("%s (osso %s, frames %d a %d, comprimento da guia %.2f m)" % (ob.name, ob["dl_bone"].replace("mixamorig:", ""), f0, f1, total))
            L.append("  desvio da trajetoria ate a guia: medio %.3f m, maximo %.3f m" % (sum(ds) / len(ds), max(ds)))
            L.append("  distancia no inicio %.3f m, no fim %.3f m" % (start, end))
            L.append("  pior(es) frame(s): " + ", ".join("%d (%.2f m)" % (f, d) for f, d in worst))
            L.append("  retrocessos ao longo da guia: %d" % back)
        elif kind == "ACTION":
            if arm is None:
                L.append("")
                L.append("%s: ignorada; nenhum armature selecionado ou unico na cena" % ob.name)
                continue
            f = int(ob.get("dl_frame", keep))
            sc.frame_set(f)
            pts = []
            for n in SPINE:
                bb = _bone(arm, n)
                if bb:
                    pts.append(arm.matrix_world @ bb.head)
            hd = _bone(arm, "Head")
            if hd:
                pts.append(arm.matrix_world @ hd.tail)
            if len(pts) < 2:
                L.append("")
                L.append("%s: ignorada; coluna com menos de dois pontos reconhecidos" % ob.name)
                continue
            ds = [_nearest(poly, p)[0] for p in pts]
            body = (pts[-1] - pts[0]).normalized()
            gdir = (poly[-1] - poly[0]).normalized()
            ang = math.degrees(body.angle(gdir))
            # curvatura: quanto a coluna se desvia da corda em cada guia
            def bulge(P):
                a, b2 = P[0], P[-1]
                ab = (b2 - a)
                if ab.length == 0:
                    return 0.0
                return max(((p - a) - ab * ((p - a).dot(ab) / ab.length_squared)).length for p in P)
            L.append("")
            L.append("%s (frame %d, comprimento da guia %.2f m)" % (ob.name, f, total))
            L.append("  coluna do personagem ate a guia: media %.3f m, maximo %.3f m" % (sum(ds) / len(ds), max(ds)))
            L.append("  angulo entre corda da coluna e corda da guia: %.1f graus" % ang)
            L.append("  curvatura (desvio maximo da corda): personagem %.3f m, guia %.3f m" % (bulge(pts), bulge([Vector(p) for p in poly])))
    sc.frame_set(keep)
    return "\n".join(L)


class DL_OT_compare(bpy.types.Operator):
    bl_idname = "dirlines.compare"
    bl_label = "Comparar guias com a animação"

    def execute(self, context):
        txt = compare(context)
        t = bpy.data.texts.get("DL_Report") or bpy.data.texts.new("DL_Report")
        t.clear()
        t.write(txt)
        print(txt)
        self.report({'INFO'}, "Resultado no texto DL_Report e no console")
        return {'FINISHED'}


class DL_OT_clear(bpy.types.Operator):
    bl_idname = "dirlines.clear"
    bl_label = "Apagar todas as guias"

    def execute(self, context):
        c = bpy.data.collections.get(COLL)
        if c:
            for o in list(c.objects):
                d = o.data
                bpy.data.objects.remove(o)
                if d and d.users == 0:
                    bpy.data.curves.remove(d)
        return {'FINISHED'}


class DL_PT_panel(bpy.types.Panel):
    bl_label = "Direction Lines"
    bl_idname = "DL_PT_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "Direction Lines"

    def draw(self, context):
        sc = context.scene
        col = self.layout.column()
        col.label(text="Linha de movimento")
        col.prop(sc, "dl_bone")
        row = col.row()
        row.prop(sc, "dl_f0")
        row.prop(sc, "dl_f1")
        col.operator("dirlines.new_motion")
        col.separator()
        col.label(text="Linha de acao (frame atual)")
        col.operator("dirlines.new_action")
        col.separator()
        col.operator("dirlines.dump")
        col.operator("dirlines.compare")
        col.operator("dirlines.clear")
        col.label(text="Edite uma linha: selecione e Tab")


classes = (DL_OT_new_motion, DL_OT_new_action, DL_OT_dump, DL_OT_compare, DL_OT_clear, DL_PT_panel)


def register():
    bpy.types.Scene.dl_bone = StringProperty(name="Osso", default="RightHand")
    bpy.types.Scene.dl_f0 = IntProperty(name="De", default=5)
    bpy.types.Scene.dl_f1 = IntProperty(name="Ate", default=18)
    for c in classes:
        bpy.utils.register_class(c)


def unregister():
    for c in reversed(classes):
        bpy.utils.unregister_class(c)
    del bpy.types.Scene.dl_bone
    del bpy.types.Scene.dl_f0
    del bpy.types.Scene.dl_f1


if __name__ == "__main__":
    register()
