"""Paridade da cinemática do za_anim × pose importada no Blender (addon PokemonSwitchV3), em TODOS os quadros.

  blender.exe -b --factory-startup --addons PokemonSwitchV3 --python paridade_fk.py -- <pasta_modelo> <saida.json> <clipe> [clipe ...]

Importa o modelo numa cena vazia (sem girar a armature), importa só os clipes pedidos e compara, osso a osso:
- posição: pose_bone.head (espaço da armature) × posicoes do za_anim;
- orientação: rotação de pose_bone.matrix (colunas normalizadas, tira a escala) × rot_mundo do za_anim.
Imprime e grava um JSON por clipe com erro máximo/mediana de posição (m e fração de H) e de ângulo (graus).

As chaves importadas são trocadas para interpolação LINEAR nesta cena derivada (o padrão do Blender é Bézier;
o za_anim usa linear/slerp entre chaves esparsas). Nenhum arquivo do usuário é aberto nem salvo.
"""
import json
import math
import os
import site
import sys

import bpy
import numpy as np

if site.getusersitepackages() not in sys.path:
    sys.path.append(site.getusersitepackages())
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import za_anim  # noqa: E402
from PokemonSwitchV3.PokemonSwitch import from_trmdlsv  # noqa: E402
from PokemonSwitchV3.gfbanm_importer import import_animation  # noqa: E402


def angulo_graus(a, b):
    """Ângulo entre duas rotações 3x3."""
    r = a.T @ b
    c = (np.trace(r) - 1.0) / 2.0
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))


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


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    pasta, saida, clipes = os.path.abspath(args[0]), os.path.abspath(args[1]), args[2:]
    base = os.path.basename(pasta)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    trmdl = next(f for f in sorted(os.listdir(pasta)) if f.endswith(".trmdl"))
    from_trmdlsv(pasta, trmdl, False, False, False, False, False, False)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    esq = za_anim.Esqueleto(za_anim.esqueleto_do_modelo(pasta))
    altura = float(np.ptp(esq.posicoes_repouso[:, 1])) or 1.0
    resultados = []
    for clipe in clipes:
        arq = os.path.join(pasta, "%s_%s.tranm" % (base, clipe))
        if not os.path.exists(arq):
            resultados.append({"modelo": base, "clipe": clipe, "erro": "arquivo ausente"})
            continue
        antes = set(bpy.data.actions)
        import_animation(bpy.context, arq, False, 0, False, False)
        act = next(a for a in bpy.data.actions if a not in antes)
        arm.animation_data.action = act
        for fc in _curvas(act):
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"
        c = za_anim.Clipe(arq, esq)
        pos_err, ang_err, pior = [], [], (0.0, "", 0)
        for f in range(c.quadros):
            bpy.context.scene.frame_set(f)
            for pb in arm.pose.bones:
                i = esq.indice.get(pb.name)
                if i is None:
                    continue
                e = float(np.linalg.norm(np.array(pb.head) - c.posicoes[f, i]))
                m = np.array(pb.matrix)[:3, :3]
                m = m / np.linalg.norm(m, axis=0, keepdims=True)
                a = angulo_graus(m, c.rot_mundo[f, i])
                pos_err.append(e)
                ang_err.append(a)
                if e > pior[0]:
                    pior = (e, pb.name, f)
        r = {"modelo": base, "clipe": clipe, "quadros": c.quadros, "ossos": len(esq.nomes),
             "altura_m": round(altura, 4), "interpolacao_blender": "LINEAR (forçada)", "escala_animada": c.escala_animada,
             "escala_max_desvio": round(c.escala_max_desvio, 4),
             "erro_max_m": round(max(pos_err), 6), "erro_max_rel_H": round(max(pos_err) / altura, 6),
             "erro_mediana_rel_H": round(float(np.median(pos_err)) / altura, 8),
             "erro_ang_max_graus": round(max(ang_err), 4), "erro_ang_mediana_graus": round(float(np.median(ang_err)), 6),
             "osso_pior": pior[1], "quadro_pior": pior[2]}
        print("[paridade] " + json.dumps(r, ensure_ascii=False))
        resultados.append(r)
    os.makedirs(os.path.dirname(saida), exist_ok=True)
    with open(saida, "w", encoding="utf-8") as fh:
        json.dump(resultados, fh, ensure_ascii=False, indent=1)


main()
