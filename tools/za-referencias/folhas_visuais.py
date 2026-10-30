"""Folhas visuais multivista nos quadros dos eventos (Task 6 / 1F + L07).

Parte pura (testada sem Blender): quadros_para_folha, vistas_independentes, par_de_vistas, estado_regiao.
Parte Blender (CLI):
  blender.exe -b --factory-startup --addons PokemonSwitchV3 --python folhas_visuais.py -- <pasta_modelo> <clipe> <saida> [cego]

"video": como "cego", mas renderiza o clipe inteiro animado (WebM) nas duas vistas, para a página de rotulagem.
"cego": para a rotulagem humana — nada pintado, 10 quadros espaçados pelo clipe (não os eventos calculados) e a
estampa só traz código, vista e quadro (não revela o que o sistema calculou).

Monta uma cena DERIVADA (nada do usuário é aberto ou salvo): importa o modelo com o addon, força chaves LINEAR
(igual ao banco), gira a armature para Z-up só nesta cena, pinta de laranja a região que executa a ação e
renderiza, em 2 vistas independentes (>= 35°), os quadros de início/pico/fim dos eventos. Cada folha tem um
código de leitura estampado; o indice.json diz, por vista e quadro, se o executor estava OBSERVAVEL,
NAO_OBSERVAVEL (escondido pela câmera/corpo) ou OCULTO_POR_ESCALA (o próprio jogo escondeu a parte).
"""
import json
import math
import os
import site
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(AQUI)), "scripts", "blender-vision"))

import perception_geom as G  # noqa: E402

# referencial do personagem na cena derivada (armature girada +90° em X): frente Trinity +Z -> Blender -Y
QUADRO_PERSONAGEM = {"forward": [0.0, -1.0, 0.0], "right": [-1.0, 0.0, 0.0], "up": [0.0, 0.0, 1.0]}
VISTAS_PADRAO = ("q3_frente_D_e12", "q3_frente_E_e35")


def quadros_para_folha(eventos, n_quadros, limite=8):
    if not eventos:
        k = max(2, limite)
        return sorted({round(i * (n_quadros - 1) / (k - 1)) for i in range(k)})
    picos = [e["pico"] for e in eventos]
    bordas = [q for e in eventos for q in (e["inicio"], e["fim"])]
    out = []
    for q in picos + bordas:
        if q not in out and 0 <= q < n_quadros:
            out.append(q)
        if len(out) >= limite:
            break
    return sorted(out)


def vistas_independentes(direcoes, min_graus=G.MIN_INDEPENDENT_ANGLE_DEG):
    out = []
    for d in direcoes:
        if G.independent_of(d, out, min_graus):
            out.append(list(d))
    return out


def par_de_vistas(nomes=VISTAS_PADRAO):
    cands = {v["name"]: v for v in G.candidate_views(QUADRO_PERSONAGEM)}
    return [cands[n] for n in nomes]


def estado_regiao(oculto, visivel_na_camera):
    if oculto:
        return "OCULTO_POR_ESCALA"
    return "OBSERVAVEL" if visivel_na_camera else "NAO_OBSERVAVEL"


# ---------------------------------------------------------------------------------------------- Blender
def _curvas(act):
    try:
        return list(act.fcurves)
    except Exception:
        out = []
        for camada in act.layers:
            for faixa in camada.strips:
                for cb in faixa.channelbags:
                    out += list(cb.fcurves)
        return out


def _pintar_regiao(bpy, malhas, ossos_destacados):
    """Atributo de cor 'papel': laranja onde o peso dos ossos destacados passa de 0,5; cinza no resto."""
    for ob in malhas:
        me = ob.data
        if "papel" in me.color_attributes:
            me.color_attributes.remove(me.color_attributes["papel"])
        attr = me.color_attributes.new("papel", "FLOAT_COLOR", "POINT")
        idx = {vg.index for vg in ob.vertex_groups if vg.name in ossos_destacados}
        for v in me.vertices:
            w = sum(g.weight for g in v.groups if g.group in idx)
            attr.data[v.index].color = (1.0, 0.45, 0.05, 1.0) if w > 0.5 else (0.72, 0.72, 0.74, 1.0)
        me.color_attributes.active_color = attr


def _face_da_regiao(obj, face, deps):
    if obj is None or obj.type != "MESH" or face < 0:
        return False
    me = obj.evaluated_get(deps).data
    if "papel" not in me.color_attributes or face >= len(me.polygons):
        return False
    attr = me.color_attributes["papel"]
    vs = me.polygons[face].vertices
    laranja = sum(1 for v in vs if attr.data[v].color[2] < 0.3)
    return laranja * 2 >= len(vs)


def osso_da_marca_esquerda(esq, regs):
    """Raiz da cadeia do braço esquerdo (senão perna, senão asa): onde fica a marca de orientação."""
    import ontologia
    for fam in ("braco", "perna", "asa"):
        raizes = [i for i in ontologia._raizes_de_cadeia(esq, regs, fam) if regs[i] == fam + "_E"]
        if raizes:
            return min(raizes, key=lambda i: esq.ordem.index(i))
    return None


def _marca_lado_esquerdo(bpy, sc, arm, esq, regs, c, altura):
    """Bolinha azul que acompanha o lado ESQUERDO do Pokémon (só orientação; não diz nada do que foi calculado).
    O esquerdo do Pokémon é +X no Trinity e continua +X na cena girada."""
    from mathutils import Vector
    k = osso_da_marca_esquerda(esq, regs)
    lateral = k is None   # sem braço/perna/asa (peixe, bola): bolinha ao lado do corpo, no esquerdo dele
    if lateral:
        import metricas
        k = metricas.raiz_do_corpo(esq)
    import bmesh
    me = bpy.data.meshes.new("marca_lado_esquerdo")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=0.035 * altura)
    bm.to_mesh(me)
    bm.free()
    # ligada direto à cena (o operador de primitiva cai na coleção ativa do importador, fora do render)
    marca = bpy.data.objects.new("marca_lado_esquerdo", me)
    sc.collection.objects.link(marca)
    marca.color = (0.15, 0.5, 1.0, 1.0)
    marca.show_in_front = True   # o ombro fica dentro da malha: a bolinha aparece por cima do corpo
    nome = esq.nomes[k]
    for f in range(c.quadros):
        sc.frame_set(f)
        pb = arm.pose.bones[nome]
        if lateral:
            # +X do modelo girado junto com o corpo (pose atual × repouso⁻¹), longe o bastante para sair da malha
            giro = arm.matrix_world.to_3x3() @ pb.matrix.to_3x3() @ pb.bone.matrix_local.to_3x3().inverted() @ arm.matrix_world.to_3x3().inverted()
            marca.location = (arm.matrix_world @ pb.head) + (giro @ Vector((1, 0, 0))).normalized() * (0.35 * altura)
        else:
            marca.location = (arm.matrix_world @ pb.head) + Vector((0.08 * altura, 0, 0))
        marca.keyframe_insert("location", frame=f)
    print("[marca] osso=%s raio=%.4f%s" % (nome, 0.035 * altura, " (ao lado do corpo)" if lateral else ""))
    return nome


def _chao_estimado(bpy, sc, arm, esq, regs, c, oc, altura, centro):
    """Chão discreto (placa + grade) na altura estimada pela mesma regra de contato.plano_chao: percentil 5 da altura
    das pontas dos pés visíveis no clipe, medido na própria cena. Sem pernas: não desenha (devolve None)."""
    import bmesh
    import contato
    import numpy as np
    from mathutils import Vector
    pontas = contato._pontas_de_apoio(esq, regs, oc)
    if not pontas:
        return None
    zs = []
    for f in range(c.quadros):
        sc.frame_set(f)
        zs += [(arm.matrix_world @ arm.pose.bones[esq.nomes[k]].head).z for k in pontas if not oc[f, k]]
    if not zs:
        return None
    z = float(np.percentile(zs, 5))
    me = bpy.data.meshes.new("chao_estimado")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=8, y_segments=8, size=0.7 * altura)
    bm.to_mesh(me)
    bm.free()
    placa = bpy.data.objects.new("chao_estimado", me)
    sc.collection.objects.link(placa)
    placa.location = Vector((centro.x, centro.y, z))
    placa.color = (0.13, 0.14, 0.16, 1.0)
    grade = bpy.data.objects.new("chao_grade", me)
    sc.collection.objects.link(grade)
    grade.location = Vector((centro.x, centro.y, z + 0.002 * altura))
    mod = grade.modifiers.new("linhas", "WIREFRAME")
    mod.thickness = 0.004 * altura
    mod.use_replace = True
    grade.color = (0.24, 0.25, 0.29, 1.0)
    return z


def _render_video(bpy, sc, saida, base, clipe_nome, vista, codigo, c):
    """Anima o clipe inteiro numa vista: WebM (VP9), todo quadro é chave (permite avançar quadro a quadro na página)."""
    im = sc.render.image_settings
    if hasattr(im, "media_type"):
        im.media_type = "VIDEO"
    im.file_format = "FFMPEG"
    ff = sc.render.ffmpeg
    ff.format, ff.codec = "WEBM", "WEBM"
    ff.gopsize = 1
    if hasattr(ff, "constant_rate_factor"):
        ff.constant_rate_factor = "HIGH"
    sc.render.fps, sc.render.fps_base = max(c.fps, 1), 1.0
    sc.frame_start, sc.frame_end = 0, c.quadros - 1
    sc.render.stamp_note_text = "%s  %s" % (codigo, vista)
    prefixo = "video_%s_%s_%s_" % (base, clipe_nome, vista)
    for f in os.listdir(saida):
        if f.startswith(prefixo):
            os.remove(os.path.join(saida, f))
    sc.render.filepath = os.path.join(saida, prefixo)
    bpy.ops.render.render(animation=True)
    gerado = next(f for f in os.listdir(saida) if f.startswith(prefixo))
    final = "video_%s_%s_%s.webm" % (base, clipe_nome, vista)
    os.replace(os.path.join(saida, gerado), os.path.join(saida, final))
    return final


def main():
    import secrets

    import bpy
    import numpy as np
    from mathutils import Vector

    if site.getusersitepackages() not in sys.path:
        sys.path.append(site.getusersitepackages())
    import metricas
    import ontologia
    import za_anim
    from PokemonSwitchV3.PokemonSwitch import from_trmdlsv
    from PokemonSwitchV3.gfbanm_importer import import_animation

    args = sys.argv[sys.argv.index("--") + 1:]
    pasta, clipe_nome, saida = os.path.abspath(args[0]), args[1], os.path.abspath(args[2])
    video = len(args) > 3 and args[3] == "video"   # vídeo para a rotulagem: sempre cego
    cego = video or (len(args) > 3 and args[3] == "cego")
    os.makedirs(saida, exist_ok=True)
    base = os.path.basename(pasta)
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    trmdl = next(f for f in sorted(os.listdir(pasta)) if f.endswith(".trmdl"))
    from_trmdlsv(pasta, trmdl, False, False, False, False, False, False)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    arq = os.path.join(pasta, "%s_%s.tranm" % (base, clipe_nome))
    antes = set(bpy.data.actions)
    import_animation(bpy.context, arq, False, 0, False, False)
    act = next(a for a in bpy.data.actions if a not in antes)
    arm.animation_data.action = act
    for fc in _curvas(act):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    arm.rotation_euler.x += math.radians(90)

    esq = za_anim.Esqueleto(za_anim.esqueleto_do_modelo(pasta))
    c = za_anim.Clipe(arq, esq)
    regs = ontologia.regioes(esq)
    cls = metricas.classificar(clipe_nome)
    m = metricas.medir(c, esq, categoria=cls["categoria"], regs=regs)
    oc = za_anim.ocultos(c, esq)
    executores = m.get("executores") or []
    ossos_exec = {esq.nomes[i] for i, r in enumerate(regs) if r in executores}
    ponta = esq.indice.get((m.get("executores_ossos") or [None])[0]) if m.get("executores_ossos") else None
    # cego: quadros espaçados pelo clipe todo (os eventos calculados também dariam pista ao revisor)
    quadros = quadros_para_folha([], c.quadros, limite=10) if cego else quadros_para_folha(m.get("eventos") or [], c.quadros)

    malhas = [o for o in bpy.data.objects if o.type == "MESH"]
    _pintar_regiao(bpy, malhas, set() if cego else ossos_exec)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "VERTEX"
    sc.render.resolution_x = sc.render.resolution_y = 360
    sc.render.film_transparent = False
    codigo = secrets.token_hex(3).upper()
    sc.render.use_stamp = True
    sc.render.use_stamp_note = True
    sc.render.use_stamp_frame = True
    for k in ("use_stamp_date", "use_stamp_time", "use_stamp_render_time", "use_stamp_camera", "use_stamp_lens",
              "use_stamp_scene", "use_stamp_filename", "use_stamp_memory", "use_stamp_hostname", "use_stamp_marker",
              "use_stamp_frame_range", "use_stamp_sequencer_strip"):
        if hasattr(sc.render, k):
            setattr(sc.render, k, False)
    cam = bpy.data.objects.new("folha_cam", bpy.data.cameras.new("folha_cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"

    # enquadramento: todos os quadros escolhidos (no vídeo, o clipe todo) cabem nas duas vistas
    pts = []
    quadros_enq = list(range(0, c.quadros, max(1, c.quadros // 40))) + [c.quadros - 1] if video else quadros
    for f in quadros_enq:
        sc.frame_set(f)
        pts += [arm.matrix_world @ pb.head for pb in arm.pose.bones]
    centro = sum(pts, Vector()) / len(pts)
    altura = float(np.ptp(esq.posicoes_repouso[:, 1])) or 1.0
    deps = bpy.context.evaluated_depsgraph_get()
    if video:
        # cores por objeto: corpo cinza, marca azul do lado esquerdo do Pokémon
        sc.display.shading.color_type = "OBJECT"
        for ob in malhas:
            ob.color = (0.72, 0.72, 0.74, 1.0)
        # tamanho pela altura NA CENA (o importador muda a escala em relação às unidades do Trinity)
        altura_cena = (max(p.z for p in pts) - min(p.z for p in pts)) or 1.0
        marca = _marca_lado_esquerdo(bpy, sc, arm, esq, regs, c, altura_cena)
        chao = _chao_estimado(bpy, sc, arm, esq, regs, c, oc, altura_cena, centro)
        print("[chao] %s" % ("z=%.4f" % chao if chao is not None else "sem pernas: não desenhado"))
    vistas = par_de_vistas()
    indice = {"modelo": base, "clipe": clipe_nome, "codigo_leitura": codigo, "quadros": quadros,
              "executores": executores, "interpolacao": "LINEAR (forçada)", "vistas": [], "estados": {}}
    for v in vistas:
        d = Vector(v["direction"])
        basis = G.camera_basis(v["direction"])
        rel = [[p[i] - centro[i] for i in range(3)] for p in pts]
        cam.data.ortho_scale = G.fit_span(rel, basis)
        cam.location = centro + d * (altura * 6)
        cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        if video:
            arquivo = _render_video(bpy, sc, saida, base, clipe_nome, v["name"], codigo, c)
            indice["vistas"].append({"nome": v["name"], "direcao": v["direction"], "arquivo": arquivo})
            continue
        tiles, estados = [], {}
        for f in quadros:
            sc.frame_set(f)
            deps = bpy.context.evaluated_depsgraph_get()
            if ponta is not None:
                alvo = arm.matrix_world @ arm.pose.bones[esq.nomes[ponta]].head
                hit, loc_hit, _n, face, obj, _m = sc.ray_cast(deps, cam.location, (alvo - cam.location).normalized())
                # o osso fica DENTRO da malha: o raio bate primeiro na superfície da própria região; conta como
                # visível se a face atingida é da região pintada (laranja) ou se chega perto do osso
                visivel = (not hit) or (loc_hit - alvo).length <= 0.05 * altura or _face_da_regiao(obj, face, deps)
                estados[f] = estado_regiao(bool(oc[f, ponta]), visivel)
            else:
                estados[f] = "SEM_EXECUTOR"
            sc.render.stamp_note_text = ("%s  %s  q%d" % (codigo, v["name"], f) if cego else
                                         "%s  %s  q%d  %s" % (codigo, v["name"], f, estados[f]))
            caminho = os.path.join(saida, "_q%03d_%s.png" % (f, v["name"]))
            sc.render.filepath = caminho
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(caminho)
            a = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)
            tiles.append(a)
            bpy.data.images.remove(img)
            os.remove(caminho)
        folha = np.concatenate(tiles, axis=1)
        h, w = folha.shape[:2]
        im = bpy.data.images.new("folha", w, h, alpha=True)
        im.pixels = folha.ravel()
        nome = "folha_%s_%s_%s.png" % (base, clipe_nome, v["name"])
        im.filepath_raw = os.path.join(saida, nome)
        im.file_format = "PNG"
        im.save()
        indice["vistas"].append({"nome": v["name"], "direcao": v["direction"], "arquivo": nome})
        indice["estados"][v["name"]] = {str(k): s for k, s in estados.items()}
    with open(os.path.join(saida, "indice_%s_%s.json" % (base, clipe_nome)), "w", encoding="utf-8") as fh:
        json.dump(indice, fh, ensure_ascii=False, indent=1)
    if video:
        os.remove(os.path.join(saida, "indice_%s_%s.json" % (base, clipe_nome)))  # nada calculado junto do vídeo
        print("[videos] " + json.dumps({"codigo": codigo, "quadros": c.quadros, "fps": c.fps,
                                        "arquivos": [x["arquivo"] for x in indice["vistas"]]}, ensure_ascii=False))
        return
    print("[folhas] " + json.dumps({"codigo": codigo, "quadros": quadros, "executores": executores,
                                    "arquivos": [x["arquivo"] for x in indice["vistas"]]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
