# Exporta o Eggo para o jogo: chars/Eggo/eggo.glb com SO as animacoes aprovadas, renomeadas para os nomes que o
# laboratorio de combate reconhece sozinho (ALIASES em prototypes/combat-lab/src/view/characters.js).
# Roda num Blender em segundo plano sobre uma COPIA (nunca salva o .blend):
#   blender -b "chars/Eggo/eggo sprint v9.blend" --python scripts/blender-vision/exportar_eggo_glb.py
import bpy, os

OUT = os.path.join(os.path.dirname(bpy.data.filepath), 'eggo.glb')
# Action aprovada -> nome no GLB (estado do jogo)
MAPA = {
    'Idle 5 Organica': 'idle',
    'Walk Forward 5 Organica': 'walk',
    'Sprint 1': 'sprint',
    'Dash 1': 'dodge forward',
    'Dash Back 1': 'dodge back',
    'Dodge Left 2': 'dodge left',
    'Dodge Right 2': 'dodge right',
    'Jump 1': 'jump',
    'Jump Start 1': 'jump start',
    'Jump Rise 1': 'jump rise',
    'Jump Apex 1': 'jump apex',
    'Jump Fall 1': 'jump fall',
    'Land 1': 'land',
}
LOOPS = {'idle', 'walk', 'sprint', 'jump rise', 'jump fall'}
rig = bpy.data.objects['AlienRig']
mesh = next(o for o in bpy.data.objects if o.type == 'MESH' and o.find_armature() == rig)
falta = [a for a in MAPA if a not in bpy.data.actions]
assert not falta, 'actions ausentes: %s' % falta
for a in list(bpy.data.actions):
    if a.name not in MAPA:
        bpy.data.actions.remove(a)
for velho, novo in MAPA.items():
    a = bpy.data.actions[velho]; a.name = novo; a.use_fake_user = True
    if novo in LOOPS:   # o ultimo quadro do loop repete o primeiro: sem ele o jogo nao segura o mesmo quadro duas vezes a cada volta
        a.use_frame_range = True; a.frame_end = a.frame_end - 1
    print('ACTION', velho, '->', novo, 'frames', tuple(a.frame_range))
# Personagem na origem (x, y = 0); a altura fica como no Blender (pe no chao)
rig.location.x = rig.location.y = 0.0
idle = bpy.data.actions['idle']
rig.animation_data.action = idle; rig.animation_data.action_slot = idle.slots[0]
bpy.context.scene.frame_set(1)
for o in bpy.data.objects: o.select_set(o in (rig, mesh))
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True,
                          export_animation_mode='ACTIONS', export_frame_range=False, export_force_sampling=True,
                          export_anim_single_armature=True,
                          export_anim_slide_to_zero=True)   # tempos comecam em 0 (sem segurar o quadro 1 por 1/24 s)
print('GLB', OUT, os.path.getsize(OUT))
