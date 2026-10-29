# Motion Lens — parte «graphs» (dividida de motion_lens.py; a API pública continua em motion_lens.py).
import bpy
import os
from .analysis import analyze_motion
from .common import GRAPH_COLORS, _context, _ensure_output_dir


def _set_pixel(buf, width, height, x, y, rgb, alpha=1.0):
    if 0 <= x < width and 0 <= y < height:
        i = (y * width + x) * 4
        buf[i:i + 4] = [rgb[0], rgb[1], rgb[2], alpha]


def _draw_line(buf, width, height, x0, y0, x1, y1, rgb, thickness=1):
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    dx, sx = abs(x1 - x0), 1 if x0 < x1 else -1
    dy, sy = -abs(y1 - y0), 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        for ox in range(-thickness + 1, thickness):
            for oy in range(-thickness + 1, thickness):
                _set_pixel(buf, width, height, x0 + ox, y0 + oy, rgb)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


FONT = {
    "0": ("111", "101", "101", "101", "111"), "1": ("010", "110", "010", "010", "111"),
    "2": ("111", "001", "111", "100", "111"), "3": ("111", "001", "111", "001", "111"),
    "4": ("101", "101", "111", "001", "001"), "5": ("111", "100", "111", "001", "111"),
    "6": ("111", "100", "111", "101", "111"), "7": ("111", "001", "010", "010", "010"),
    "8": ("111", "101", "111", "101", "111"), "9": ("111", "101", "111", "001", "111"),
    "F": ("111", "100", "110", "100", "100"), "S": ("111", "100", "111", "001", "111"),
    "T": ("111", "010", "010", "010", "010"), "C": ("111", "100", "100", "100", "111"),
    "A": ("010", "101", "111", "101", "101"), "B": ("110", "101", "110", "101", "110"),
    "R": ("110", "101", "110", "101", "101"), "-": ("000", "000", "111", "000", "000"),
    "D": ("110", "101", "101", "101", "110"), "E": ("111", "100", "110", "100", "111"),
    "G": ("111", "100", "101", "101", "111"), "H": ("101", "101", "111", "101", "101"),
    "I": ("111", "010", "010", "010", "111"), "J": ("001", "001", "001", "101", "111"),
    "K": ("101", "101", "110", "101", "101"), "L": ("100", "100", "100", "100", "111"),
    "M": ("101", "111", "111", "101", "101"), "N": ("101", "111", "111", "111", "101"),
    "O": ("111", "101", "101", "101", "111"), "P": ("110", "101", "110", "100", "100"),
    "Q": ("111", "101", "101", "111", "001"), "U": ("101", "101", "101", "101", "111"),
    "V": ("101", "101", "101", "101", "010"), "W": ("101", "101", "111", "111", "101"),
    "X": ("101", "101", "010", "101", "101"), "Y": ("101", "101", "010", "010", "010"),
    "Z": ("111", "001", "010", "100", "111"), ".": ("000", "000", "000", "000", "010"),
    "/": ("001", "001", "010", "100", "100"), ":": ("000", "010", "000", "010", "000"),
    "=": ("000", "111", "000", "111", "000"),
    " ": ("000", "000", "000", "000", "000"),
}


def _draw_text(buf, width, height, x, y, text, rgb=(1, 1, 1), scale=2):
    x, y, scale = int(round(x)), int(round(y)), max(1, int(scale))   # PATCH: coordenadas float quebravam o fatiamento
    cursor = x
    for char in str(text).upper():
        glyph = FONT.get(char, FONT[" "])
        for row, bits in enumerate(reversed(glyph)):
            for col, bit in enumerate(bits):
                if bit == "1":
                    for oy in range(scale):
                        for ox in range(scale):
                            _set_pixel(buf, width, height, cursor + col * scale + ox, y + row * scale + oy, rgb)
        cursor += 4 * scale


def render_graphs(context=None, output_path=None, analysis=None):
    """Salva PNG autocontido: nomes, eixos, frames, unidades e picos."""
    context = _context(context)
    scene = context.scene
    data = analysis or analyze_motion(context)
    frames = data["frames"]
    width, height = 1500, 1050
    buf = [0.035, 0.035, 0.045, 1.0] * (width * height)
    left, right, info_x = 175, 1120, 1160
    roles = [r for r in ("Hips", "Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot") if r in data["speed"]]
    panels = [
        {"title": "VELOCIDADE", "unit": "M/FRAME", "bottom": 720, "top": 970,
         "series": {r: data["speed"][r] for r in roles}, "zero": True},
        {"title": "ALTURA", "unit": "M", "bottom": 390, "top": 640,
         "series": {r: data["height"][r] for r in roles}, "zero": False},
        {"title": "ENERGIA", "unit": "MEDIA PONDERADA", "bottom": 60, "top": 310,
         "series": {"Energy": data["energy"]}, "zero": True},
    ]
    frame_indices = sorted(set(round(i * (len(frames) - 1) / 4) for i in range(5)))
    for panel in panels:
        bottom, top, selected = panel["bottom"], panel["top"], panel["series"]
        flat = [value for values in selected.values() for value in values]
        if panel["zero"]:
            lo, hi = 0.0, max(flat, default=1.0)
        else:
            lo, hi = (min(flat), max(flat)) if flat else (0.0, 1.0)
        if abs(hi - lo) < 1e-9:
            hi = lo + 1.0
        pad = (hi - lo) * 0.06
        if panel["zero"]:
            hi += pad
        else:
            lo -= pad; hi += pad
        _draw_text(buf, width, height, 20, top + 14, panel["title"], (0.92, 0.92, 0.95), 2)   # PATCH: acima do primeiro rotulo do eixo
        _draw_text(buf, width, height, 20, top - 28, panel["unit"], (0.65, 0.67, 0.72), 1)
        for tick in range(6):
            ratio = tick / 5.0
            y = bottom + (top - bottom) * ratio
            value = lo + (hi - lo) * ratio
            _draw_line(buf, width, height, left, y, right, y, (0.16, 0.16, 0.19))
            _draw_text(buf, width, height, 92, y - 4, "%.2f" % value, (0.68, 0.70, 0.74), 1)
        for index in frame_indices:
            x = left + (right - left) * index / max(1, len(frames) - 1)
            _draw_line(buf, width, height, x, bottom, x, top, (0.11, 0.11, 0.14))
            _draw_text(buf, width, height, x - 10, bottom - 20, str(frames[index]), (0.72, 0.74, 0.78), 1)
        _draw_text(buf, width, height, right - 55, bottom - 35, "FRAME", (0.62, 0.64, 0.69), 1)
        for role, values in selected.items():
            color = GRAPH_COLORS[role]
            for i in range(1, len(values)):
                x0 = left + (right - left) * (i - 1) / max(1, len(values) - 1)
                x1 = left + (right - left) * i / max(1, len(values) - 1)
                y0 = bottom + (top - bottom) * (values[i - 1] - lo) / (hi - lo)
                y1 = bottom + (top - bottom) * (values[i] - lo) / (hi - lo)
                _draw_line(buf, width, height, x0, y0, x1, y1, color, 2)
            peak_i = max(range(len(values)), key=values.__getitem__)
            px = left + (right - left) * peak_i / max(1, len(values) - 1)
            py = bottom + (top - bottom) * (values[peak_i] - lo) / (hi - lo)
            _draw_line(buf, width, height, px - 4, py, px + 4, py, color, 2)
            _draw_line(buf, width, height, px, py - 4, px, py + 4, color, 2)
        _draw_line(buf, width, height, left, bottom, right, bottom, (0.7, 0.7, 0.75))
        _draw_line(buf, width, height, left, bottom, left, top, (0.7, 0.7, 0.75))
    _draw_text(buf, width, height, info_x, 985, "LEGENDA", (1, 1, 1), 2)
    for row, role in enumerate(roles):
        y = 945 - row * 36
        _draw_line(buf, width, height, info_x, y, info_x + 32, y, GRAPH_COLORS[role], 3)
        _draw_text(buf, width, height, info_x + 45, y - 5, role.upper(), (0.88, 0.89, 0.92), 1)
    _draw_text(buf, width, height, info_x, 675, "PICOS", (1, 1, 1), 2)
    for row, role in enumerate(roles):
        values = data["speed"][role]
        peak_i = max(range(len(values)), key=values.__getitem__)
        text = "%s F%d %.3f" % (role.upper(), frames[peak_i], values[peak_i])
        _draw_text(buf, width, height, info_x, 640 - row * 34, text, GRAPH_COLORS[role], 1)
    _draw_text(buf, width, height, info_x, 365, "CORES IGUAIS", (0.8, 0.81, 0.84), 1)
    _draw_text(buf, width, height, info_x, 345, "NOS 3 GRAFICOS", (0.8, 0.81, 0.84), 1)
    image = bpy.data.images.get("ML_Graphs") or bpy.data.images.new("ML_Graphs", width, height)
    if image.size[0] != width or image.size[1] != height:
        bpy.data.images.remove(image)
        image = bpy.data.images.new("ML_Graphs", width, height)
    image.pixels.foreach_set(buf)
    image.update()
    output_path = output_path or os.path.join(_ensure_output_dir(scene), "motion_lens_graphs.png")
    image.filepath_raw = output_path
    image.file_format = 'PNG'
    image.save()
    return output_path
