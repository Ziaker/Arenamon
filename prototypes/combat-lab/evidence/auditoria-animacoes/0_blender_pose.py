import bpy, json, sys
MAPA = {'idle': 'Idle 5 Organica', 'walk': 'Walk Forward 5 Organica', 'sprint': 'Sprint 1', 'dodge left': 'Dodge Left 2', 'jump': 'Jump 1'}
rig = bpy.data.objects['AlienRig']; rig.location.x = rig.location.y = 0
s = bpy.context.scene; out = {}
for clip, act in MAPA.items():
    a = bpy.data.actions[act]; rig.animation_data.action = a; rig.animation_data.action_slot = a.slots[0]
    out[clip] = {}
    for f in (1, 5, 9):
        s.frame_set(f); mw = rig.matrix_world
        out[clip][f] = {pb.name: list((mw @ pb.head)[:]) for pb in rig.pose.bones}
open(sys.argv[-1], 'w').write(json.dumps(out))
print('ok')
