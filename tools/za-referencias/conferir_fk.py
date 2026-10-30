"""Confere a cinemática direta do za_anim contra o Blender (pose importada pelo addon).

  blender.exe -b <pmXXXX_YY_ZZ.blend> --python conferir_fk.py -- <pasta_do_modelo> <clipe> [quadros...]

Compara a posição de todos os ossos (espaço da armature) e imprime o erro máximo em metros.
"""
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import za_anim  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
pasta, clipe = os.path.abspath(args[0]), args[1]
quadros = [int(a) for a in args[2:]] or [0, 10, 30]

esq = za_anim.Esqueleto(za_anim.esqueleto_do_modelo(pasta))
prefixo = os.path.basename(pasta) + "_"
c = za_anim.Clipe(os.path.join(pasta, prefixo + clipe + ".tranm"), esq)

arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
arm.animation_data.action = bpy.data.actions[clipe]
for tr in arm.animation_data.nla_tracks:
    tr.mute = True
pior = 0.0
for f in quadros:
    bpy.context.scene.frame_set(f)
    erros = []
    for pb in arm.pose.bones:
        i = esq.indice.get(pb.name)
        if i is None:
            continue
        erros.append((float(np.linalg.norm(np.array(pb.head) - c.posicoes[f, i])), pb.name))
    erros.sort(reverse=True)
    pior = max(pior, erros[0][0])
    print("[fk] quadro %d: %d ossos, erro máx %.5f m (%s), mediana %.5f m" % (
        f, len(erros), erros[0][0], erros[0][1], erros[len(erros) // 2][0]))
altura = float(np.ptp(esq.posicoes_repouso[:, 1]))
print("[fk] pior erro %.5f m = %.3f%% da altura do esqueleto (%.2f m)" % (pior, 100 * pior / altura, altura))
