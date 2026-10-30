"""Monta um .blend de estudo com modelo, esqueleto e todas as animações de um Pokémon extraído.

Roda num Blender separado, em segundo plano (não toca na cena aberta do usuário):
  blender.exe -b --factory-startup --addons PokemonSwitchV3 --python montar_blend.py -- <pasta_do_modelo> <saida.blend>

Cada .tranm vira uma Action com o nome do clipe (ex.: 00500_damage01), marcada com fake user,
e também uma faixa no NLA (mutada) para navegar pelos clipes.
"""
import glob
import math
import os
import site
import sys
import traceback

import bpy

# O addon instala o flatbuffers no site do usuário, que o Blender não põe no path em segundo plano.
if site.getusersitepackages() not in sys.path:
    sys.path.append(site.getusersitepackages())

args = sys.argv[sys.argv.index("--") + 1:]
pasta, saida = os.path.abspath(args[0]), os.path.abspath(args[1])

from PokemonSwitchV3.PokemonSwitch import from_trmdlsv
from PokemonSwitchV3.gfbanm_importer import import_animation

for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

trmdl = sorted(glob.glob(os.path.join(pasta, "*.trmdl")))[0]
print("[montar] modelo:", trmdl)
from_trmdlsv(pasta, os.path.basename(trmdl), False, False, False, True, True, False)

arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
print("[montar] armature:", arm.name, len(arm.data.bones), "ossos")
# O addon só gira modelos sem esqueleto; o Trinity é Y-up, então o Pokémon chega deitado.
arm.rotation_euler.x += math.radians(90)

prefixo = os.path.basename(pasta) + "_"
ok, falhas = 0, []
for f in sorted(glob.glob(os.path.join(pasta, "*.tranm"))):
    clipe = os.path.splitext(os.path.basename(f))[0].replace(prefixo, "")
    antes = set(bpy.data.actions)
    try:
        import_animation(bpy.context, f, False, 0, False, False)
    except Exception as e:
        falhas.append((clipe, repr(e)))
        traceback.print_exc()
        continue
    novas = [a for a in bpy.data.actions if a not in antes]
    for a in novas:
        a.name = clipe
        a.use_fake_user = True
    ok += 1

# Um NLA com todos os clipes (mutados) para navegar; a Action ativa fica como idle se existir.
ad = arm.animation_data or arm.animation_data_create()
ad.action = None
for a in sorted(bpy.data.actions, key=lambda a: a.name):
    tr = ad.nla_tracks.new()
    tr.name = a.name
    tr.strips.new(a.name, 0, a)
    tr.mute = True
idle = next((a for a in bpy.data.actions if "wait01_loop" in a.name or "idle" in a.name), None)
if idle:
    ad.action = idle
    bpy.context.scene.frame_start = int(idle.frame_range[0])
    bpy.context.scene.frame_end = int(idle.frame_range[1])

os.makedirs(os.path.dirname(saida), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=saida)
print("[montar] animações importadas: %d, falhas: %d" % (ok, len(falhas)))
for c, e in falhas[:10]:
    print("[montar] falha", c, e)
print("[montar] salvo em", saida)
