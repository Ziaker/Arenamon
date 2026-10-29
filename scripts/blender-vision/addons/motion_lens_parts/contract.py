# Motion Lens — parte «contract» (dividida de motion_lens.py; a API pública continua em motion_lens.py).
import bpy
import json
import os
from .common import PROFILE_KEYS, _context, _ensure_output_dir


def _load_json_value(value):
    if not value:
        return {}
    if isinstance(value, dict):
        return value
    path = bpy.path.abspath(str(value))
    if os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    parsed = json.loads(str(value))
    if not isinstance(parsed, dict):
        raise ValueError("Esperado objeto JSON ou caminho para JSON")
    return parsed


def load_contract(scene, value=None):
    return _load_json_value(value if value is not None else scene.motion_lens_contract)


def check_contract(analysis, contract):
    """Verifica somente regras objetivas declaradas; não infere Smear/Stretch artisticamente."""
    if not contract:
        return {"violations": [], "notes": ["Nenhum contrato carregado."]}
    frames = analysis["frames"]
    violations, notes = [], []
    expected_start = contract.get("frame_start")
    expected_end = contract.get("frame_end")
    expected_count = contract.get("frame_count")
    if expected_start is not None and frames[0] != int(expected_start):
        violations.append("Inicio %d; esperado %d" % (frames[0], expected_start))
    if expected_end is not None and frames[-1] != int(expected_end):
        violations.append("Fim %d; esperado %d" % (frames[-1], expected_end))
    if expected_count is not None and len(frames) != int(expected_count):
        violations.append("Duracao %d frames; esperado %d" % (len(frames), expected_count))
    windows = contract.get("windows", {})
    for name, spec in windows.items():
        if isinstance(spec, (list, tuple)) and len(spec) == 2:
            start, end = int(spec[0]), int(spec[1])
            if start < frames[0] or end > frames[-1] or end < start:
                violations.append("Janela %s invalida: %s" % (name, spec))
            continue
        if not isinstance(spec, dict):
            notes.append("Janela %s nao possui formato verificavel" % name)
            continue
        start, end, duration = spec.get("start"), spec.get("end"), spec.get("duration")
        if start is not None and end is not None and duration is not None:
            actual = int(end) - int(start) + 1
            if actual != int(duration):
                violations.append("Janela %s tem %d frames; contrato pede %d" % (name, actual, duration))
        elif duration is not None:
            notes.append("%s pede %s frames, mas nao declara onde a janela comeca" % (name, duration))
    contact = windows.get("contact") or contract.get("contact_window")
    if isinstance(contact, dict):
        contact = [contact.get("start"), contact.get("end")]
    if isinstance(contact, (list, tuple)) and len(contact) == 2 and None not in contact:
        allowed = set(range(int(contact[0]), int(contact[1]) + 1))
        actual = set()
        for info in analysis["contacts"].values():
            actual.update(info["frames"])
        if actual and not (actual & allowed):
            violations.append("Nenhum contato de pe detectado na janela %d..%d" % (contact[0], contact[1]))
        notes.append("Contato narrativo/impacto de mao exige papel de osso explicito; contato dos pes foi verificado separadamente.")
    for name in ("smear", "stretch"):
        if name in windows:
            notes.append("A duracao de %s e verificavel; a intencao visual ainda exige aprovacao humana." % name)
            spec = windows[name]
            if isinstance(spec, dict) and spec.get("start") is not None and spec.get("end") is not None:
                allowed = set(range(int(spec["start"]), int(spec["end"]) + 1))
                scales = analysis.get("scales", {})
                tolerance = float(spec.get("scale_tolerance", 0.02))
                min_dev = float(spec.get("min_deviation", 0.05))
                if not spec.get("bones"):
                    notes.append("NAO VERIFICADO: %s nao declara 'bones'; a deformacao dentro/fora da janela nao foi checada" % name)
                for role in spec.get("bones", []):
                    # PATCH: todo frame da janela precisa ter desvio >= min_deviation em algum eixo (antes so se checava o FORA da janela)
                    _vals = scales.get(role, [])
                    _ex = int(spec.get("edge_exempt", 0))
                    _srt = sorted(allowed)
                    _isento = set(_srt[:_ex] + _srt[len(_srt) - _ex:]) if _ex else set()      # PATCH: bordas da janela (entrada/retorno) podem ficar abaixo do minimo
                    _sem = [frames[i] for i, s in enumerate(_vals) if frames[i] in allowed and frames[i] not in _isento and max(abs(s.x - 1.0), abs(s.y - 1.0), abs(s.z - 1.0)) < min_dev]
                    if not _vals:
                        violations.append("%s: sem dados de escala para %s (papel de osso ausente?)" % (name, role))
                    elif _sem:
                        violations.append("%s: %s sem deformacao (desvio < %s) dentro da janela em f%s" % (name, role, min_dev, ",".join(map(str, _sem))))
                    values = scales.get(role, [])
                    for index, scale in enumerate(values):
                        frame = frames[index]
                        deviation = max(abs(scale.x - 1.0), abs(scale.y - 1.0), abs(scale.z - 1.0))
                        # PATCH: janelas ADJACENTES no mesmo osso (smear e stretch no braco D) nao contam como "fora da janela" uma da outra
                        _outros = set()
                        for _n2 in ("smear", "stretch"):
                            _s2 = windows.get(_n2)
                            if _n2 != name and isinstance(_s2, dict) and _s2.get("start") is not None and role in (_s2.get("bones") or []):
                                _outros.update(range(int(_s2["start"]), int(_s2["end"]) + 1))
                        if frame not in allowed and frame not in _outros and deviation > tolerance:
                            violations.append("%s: %s permanece escalado fora da janela em f%d" % (name, role, frame))
                            break
    return {"violations": violations, "notes": notes}


def save_profile(context=None, path=None):
    context = _context(context)
    scene = context.scene
    path = bpy.path.abspath(path or scene.motion_lens_profile_path or os.path.join(_ensure_output_dir(scene), "motion_lens_profile.json"))
    payload = {key: getattr(scene, key) for key in PROFILE_KEYS if hasattr(scene, key)}
    payload["schema"] = 1
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    return path


def load_profile(context=None, path=None):
    context = _context(context)
    scene = context.scene
    path = bpy.path.abspath(path or scene.motion_lens_profile_path)
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    for key in PROFILE_KEYS:
        if key in payload and hasattr(scene, key):
            setattr(scene, key, payload[key])
    return path
