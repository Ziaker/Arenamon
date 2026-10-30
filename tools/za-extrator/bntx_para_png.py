"""Converte texturas BNTX (Switch) em PNG, ao lado do original, para o addon do Blender achar.

  python -I bntx_para_png.py <pasta>   (converte todos os .bntx da pasta, recursivo)

Lê só o mip 0: desfaz o swizzle "block linear" do Tegra X1 e decodifica BCn com o Pillow.
"""
import glob
import os
import struct
import sys

import numpy as np
from PIL import Image

# tipo do formato (byte alto) -> (bytes por bloco, tamanho do bloco, modo Pillow, n do decodificador BCn)
FORMATOS = {
    0x1A: (8, 4, "RGBA", 1),
    0x1B: (16, 4, "RGBA", 2),
    0x1C: (16, 4, "RGBA", 3),
    0x1D: (8, 4, "L", 4),
    0x1E: (16, 4, "RGB", 5),
    0x20: (16, 4, "RGBA", 7),
    0x0B: (4, 1, "RGBA", None),
    0x0C: (4, 1, "BGRA", None),
    0x02: (1, 1, "L", None),
}


def deswizzle(data, largura, altura, bpp, block_height):
    """Endereço block linear (GOB de 64x8 bytes), igual ao swizzle.py do AboodXD, vetorizado."""
    gobs_na_largura = -(-largura * bpp // 64)
    y, x = np.mgrid[0:altura, 0:largura]
    xb = x * bpp
    base = ((y // (8 * block_height)) * 512 * block_height * gobs_na_largura
            + (xb // 64) * 512 * block_height
            + (y % (8 * block_height) // 8) * 512)
    end = (base + ((xb % 64) // 32) * 256 + ((y % 8) // 2) * 64
           + ((xb % 32) // 16) * 32 + (y % 2) * 16 + (xb % 16))
    src = np.frombuffer(data, dtype=np.uint8)
    idx = end.reshape(-1, 1) + np.arange(bpp)
    idx = np.minimum(idx, len(src) - 1)
    return src[idx].tobytes()


def converter(caminho):
    d = open(caminho, "rb").read()
    if d[:4] != b"BNTX":
        raise ValueError("não é BNTX")
    info = struct.unpack_from("<Q", d, struct.unpack_from("<Q", d, 0x28)[0])[0]
    if d[info:info + 4] != b"BRTI":
        raise ValueError("BRTI não encontrado")
    tile_mode = struct.unpack_from("<H", d, info + 0x12)[0]
    fmt, _, largura, altura = struct.unpack_from("<IIii", d, info + 0x1C)
    block_height = 1 << (struct.unpack_from("<i", d, info + 0x34)[0] & 7)
    mip0 = struct.unpack_from("<Q", d, struct.unpack_from("<Q", d, info + 0x70)[0])[0]
    tipo = fmt >> 8
    if tipo not in FORMATOS:
        raise ValueError("formato 0x%04X não suportado" % fmt)
    bpp, bloco, modo, bcn = FORMATOS[tipo]
    lb, ab = -(-largura // bloco), -(-altura // bloco)
    bruto = d[mip0:]
    if tile_mode == 1:
        linear = bruto[:lb * ab * bpp]
    else:
        linear = deswizzle(bruto, lb, ab, bpp, block_height)
    if bcn:
        img = Image.frombytes(modo, (lb * 4, ab * 4), linear, "bcn", bcn)
    elif modo == "BGRA":
        img = Image.frombytes("RGBA", (lb, ab), linear, "raw", "BGRA")
    else:
        img = Image.frombytes(modo, (lb, ab), linear)
    img = img.crop((0, 0, largura, altura))
    destino = caminho[:-5] + ".png"
    img.save(destino)
    return destino, largura, altura, fmt


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    ok, falhas = 0, []
    for f in sorted(glob.glob(os.path.join(sys.argv[1], "**", "*.bntx"), recursive=True)):
        try:
            converter(f)
            ok += 1
        except Exception as e:
            falhas.append("%s: %s" % (os.path.basename(f), e))
    print("%d PNG gerados, %d falhas" % (ok, len(falhas)))
    for f in falhas[:10]:
        print("  falha", f)


if __name__ == "__main__":
    main()
