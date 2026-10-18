"""Testes do addon Motion Lens em Blender headless (NUNCA salva o .blend):

    blender -b Vigoroth_tackle_v1.blend --python scripts/blender-vision/tests/test_motion_lens_background.py -- ADDON.py WORK_DIR

Verifica: (1) Smear/Stretch parcial no Tackle real vira violacao; (2) janela de Smear numa action SEM escala (Walk fwd) vira violacao
(antes: zero violacoes = PASS falso); (3) contrato sem 'bones' vira nota NAO VERIFICADO; (4) analise usa o intervalo da action mesmo com cena 1-250;
(5) contact sheet funciona e o formato de imagem do render e restaurado; (6) silhueta e binaria.
Sai com codigo 1 se algo falhar; resultado em WORK_DIR/motion_lens_tests.json."""
import bpy
import importlib.util
import json
import os
import sys

args = sys.argv[sys.argv.index("--") + 1:]
ADDON, WORK = args[0], args[1]
os.makedirs(WORK, exist_ok=True)
spec = importlib.util.spec_from_file_location("motion_lens_t", ADDON)
ml = importlib.util.module_from_spec(spec)
sys.modules["motion_lens_t"] = ml
spec.loader.exec_module(ml)
ml.register()
sc = bpy.context.scene
arm = bpy.data.objects["Vigoroth_Armature"]
bpy.context.view_layer.objects.active = arm
sc.motion_lens_output_dir = WORK
R = []


def t(nome, ok, det=""):
    R.append({"teste": nome, "ok": bool(ok), "detalhe": str(det)[:300]})
    print("%-70s %s %s" % (nome, "OK  " if ok else "FALHOU", str(det)[:140]))


def use(name):
    a = bpy.data.actions[name]
    arm.animation_data.action = a
    try:
        arm.animation_data.action_slot = a.slots[0]
    except Exception:
        pass
    return a


def contract(path, d):
    json.dump(d, open(path, "w", encoding="utf-8"))
    sc.motion_lens_contract = path
    return ml.load_contract(sc)


fmt0 = sc.render.image_settings.file_format
# (4) cena 1-250, ataque de 41 frames
a = use("Tackle_blocking_v2")
sc.frame_start, sc.frame_end = 1, 250
data = ml.analyze_motion(bpy.context)
t("analise usa o intervalo da action (41), nao o da cena (250)", len(data["frames"]) == 41, "frames=%d" % len(data["frames"]))
# (1) Tackle real: contrato com janelas e ossos
c1 = contract(os.path.join(WORK, "c_tackle.json"), {"frame_start": 1, "frame_end": 41, "frame_count": 41, "windows": {
    "smear": {"duration": 5, "start": 5, "end": 9, "bones": ["RightForeArm", "RightHand"], "min_deviation": 0.05},
    "stretch": {"duration": 4, "start": 10, "end": 13, "bones": ["RightForeArm", "RightHand"], "min_deviation": 0.05}}})
chk = ml.check_contract(data, c1)
v = " | ".join(chk["violations"])
t("Tackle v2: Smear parcial (f9) e Stretch parcial (f13) viram violacao", "smear" in v and "f9" in v and "stretch" in v and "f13" in v, v)
# (2) action sem escala nenhuma: Smear inexistente nao pode passar
use("Walk fwd")
sc.frame_start, sc.frame_end = 1, 33
dw = ml.analyze_motion(bpy.context)
c2 = contract(os.path.join(WORK, "c_walk.json"), {"windows": {"smear": {"duration": 5, "start": 5, "end": 9, "bones": ["RightHand"], "min_deviation": 0.05}}})
ck2 = ml.check_contract(dw, c2)
t("Smear inexistente (escala 1,1,1 em tudo) NAO passa", any("sem deformacao" in x for x in ck2["violations"]), ck2["violations"])
# (3) sem 'bones'
c3 = contract(os.path.join(WORK, "c_nobones.json"), {"windows": {"smear": {"duration": 5, "start": 5, "end": 9}}})
ck3 = ml.check_contract(dw, c3)
t("Smear sem 'bones' vira nota NAO VERIFICADO", any("NAO VERIFICADO" in x for x in ck3["notes"]), ck3["notes"])
# (5) contact sheet + formato restaurado
sc.render.image_settings.file_format = 'BMP'
try:
    p = ml.render_contact_sheet(bpy.context, frames=[1, 10, 20, 30])
    t("contact sheet gerado", os.path.exists(p), p)
except Exception as e:
    t("contact sheet gerado", False, e)
t("formato de imagem do render restaurado (BMP)", sc.render.image_settings.file_format == 'BMP', sc.render.image_settings.file_format)
sc.render.image_settings.file_format = fmt0
# (6) silhueta binaria
try:
    ps = ml.render_contact_sheet(bpy.context, silhouette=True, frames=[1, 10])
    im = bpy.data.images.load(ps, check_existing=False)
    px = list(im.pixels[:])
    bpy.data.images.remove(im)
    mid = sum(1 for i in range(0, len(px), 4) if 0.02 < px[i] < 0.98) / (len(px) // 4)
    t("silhueta e binaria (0 pixels intermediarios; texto da legenda excluido por <1%)", mid < 0.01, "intermediarios=%.4f" % mid)
except Exception as e:
    t("silhueta e binaria", False, e)
json.dump(R, open(os.path.join(WORK, "motion_lens_tests.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("\n%d/%d" % (sum(x["ok"] for x in R), len(R)))
sys.exit(0 if all(x["ok"] for x in R) else 1)
