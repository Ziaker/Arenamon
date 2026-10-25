"""Extrai arquivos internos (TRPFS/TRPAK) do Pokémon Legends: Z-A a partir do RomFS dumpado.

Reimplementa em Python a leitura do Trinity File Explorer (GFTool), sem interface:
  data.trpfd  -> FileDescriptor (hash do arquivo -> pack)
  data.trpfs  -> cabeçalho ONEPACK + FileSystem (hash do pack -> offset)
  pack TRPAK  -> PackedArchive (hash -> bytes, comprimidos com Oodle Kraken)

Uso:
  python -I extrair_za.py <pasta-dumper> <filtro> <saida>
  ex.: python -I extrair_za.py "dumper test" pm0768/ "dumper test/extraido"

<pasta-dumper> precisa ter romfs/arc/, oo2core_8_win64.dll e PokeDocs-main/ZA/Hashlists/.
<filtro> é um trecho do caminho interno (ex.: "ik_pokemon/data/pm0867/") ou o número
da Pokédex Nacional (ex.: "768" = Golisopod). Atenção: no Z-A a pasta pmXXXX NÃO é o número
da Pokédex (Golisopod #768 fica em pm0867; pm0768 é o Xerneas). O número é resolvido pelo
catálogo do jogo (ik_pokemon/catalog/catalog/poke_resource_table.trpmcatalog).
"""
import ctypes
import os
import struct
import sys

FNV_BASIS = 0xCBF29CE484222645
FNV_PRIME = 0x00000100000001B3


def fnv1a64(text):
    h = FNV_BASIS
    for b in text.encode("utf-8"):
        h ^= b
        h = (h * FNV_PRIME) & 0xFFFFFFFFFFFFFFFF
    return h


class Table:
    """Leitor mínimo de tabela FlatBuffers (só o que os formatos Trinity usam)."""

    def __init__(self, buf, pos):
        self.buf = buf
        self.pos = pos
        vt = pos - struct.unpack_from("<i", buf, pos)[0]
        vt_size = struct.unpack_from("<H", buf, vt)[0]
        self.fields = [struct.unpack_from("<H", buf, vt + 4 + 2 * i)[0] for i in range((vt_size - 4) // 2)]

    @classmethod
    def root(cls, buf, base=0):
        return cls(buf, base + struct.unpack_from("<I", buf, base)[0])

    def _field(self, i):
        return self.pos + self.fields[i] if i < len(self.fields) and self.fields[i] else None

    def scalar(self, i, fmt, default=0):
        p = self._field(i)
        return default if p is None else struct.unpack_from("<" + fmt, self.buf, p)[0]

    def _vector(self, i):
        p = self._field(i)
        if p is None:
            return None, 0
        v = p + struct.unpack_from("<I", self.buf, p)[0]
        return v + 4, struct.unpack_from("<I", self.buf, v)[0]

    def u64s(self, i):
        start, n = self._vector(i)
        return list(struct.unpack_from("<%dQ" % n, self.buf, start)) if n else []

    def bytes_(self, i):
        start, n = self._vector(i)
        return bytes(self.buf[start:start + n]) if n else b""

    def tables(self, i):
        start, n = self._vector(i)
        out = []
        for k in range(n):
            e = start + 4 * k
            out.append(Table(self.buf, e + struct.unpack_from("<I", self.buf, e)[0]))
        return out

    def strings(self, i):
        start, n = self._vector(i)
        out = []
        for k in range(n):
            e = start + 4 * k
            s = e + struct.unpack_from("<I", self.buf, e)[0]
            ln = struct.unpack_from("<I", self.buf, s)[0]
            out.append(bytes(self.buf[s + 4:s + 4 + ln]).decode("utf-8"))
        return out


class Oodle:
    def __init__(self, dll_path):
        self.lib = ctypes.CDLL(dll_path)
        f = self.lib.OodleLZ_Decompress
        f.restype = ctypes.c_int64
        f.argtypes = [ctypes.c_char_p, ctypes.c_int64, ctypes.c_char_p, ctypes.c_int64] + [ctypes.c_int64] * 10

    def decompress(self, data, size):
        out = ctypes.create_string_buffer(size)
        # fuzz=1, crc=0, verbosity=0, ..., threadPhase=3 (igual ao GFTool/PkNX)
        n = self.lib.OodleLZ_Decompress(data, len(data), out, size, 1, 0, 0, 0, 0, 0, 0, 0, 0, 3)
        if n != size:
            raise RuntimeError("Oodle falhou (%d de %d bytes)" % (n, size))
        return out.raw


CATALOGO = "ik_pokemon/catalog/catalog/poke_resource_table.trpmcatalog"


def _string(t, i):
    p = t._field(i)
    if p is None:
        return ""
    q = p + struct.unpack_from("<I", t.buf, p)[0]
    n = struct.unpack_from("<I", t.buf, q)[0]
    return bytes(t.buf[q + 4:q + 4 + n]).decode("utf-8")


def _subtable(t, i):
    p = t._field(i)
    return None if p is None else Table(t.buf, p + struct.unpack_from("<I", t.buf, p)[0])


def pastas_da_especie(catalogo, numero):
    """Catalog.table[] -> CatalogEntry(species_info{species, form}, model_path, ...)."""
    cat = Table.root(catalogo)
    pastas = []
    for e in cat.tables(1):
        info = _subtable(e, 0)
        if info and info.scalar(0, "H") == numero:
            pasta = "ik_pokemon/data/" + _string(e, 1).rsplit("/", 1)[0] + "/"
            if pasta not in pastas:
                pastas.append(pasta)
    return pastas


def carregar_lista(hashlist, filtros):
    wanted = {}
    with open(hashlist, encoding="utf-8") as fh:
        for line in fh:
            parts = line.split(" ", 1)
            if len(parts) == 2 and any(f in parts[1] for f in filtros):
                wanted[int(parts[0], 16)] = parts[1].strip()
    return wanted


def main():
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    root, filtro, saida = sys.argv[1:]
    arc = os.path.join(root, "romfs", "arc")
    hashlist = os.path.join(root, "PokeDocs-main", "ZA", "Hashlists", "FileSystem", "hashes_inside_fd.txt")

    with open(os.path.join(arc, "data.trpfd"), "rb") as fh:
        fd = Table.root(fh.read())
    fd_hashes = fd.u64s(0)
    pack_names = fd.strings(1)
    file_pack = [t.scalar(0, "Q") for t in fd.tables(2)]
    pack_sizes = [t.scalar(0, "Q") for t in fd.tables(3)]
    fd_index = {h: i for i, h in enumerate(fd_hashes)}

    trpfs_path = os.path.join(arc, "data.trpfs")
    trpfs = open(trpfs_path, "rb")
    magic, fs_off = struct.unpack("<8sQ", trpfs.read(16))
    trpfs.seek(fs_off)
    fs = Table.root(trpfs.read())
    fs_offsets = dict(zip(fs.u64s(0), fs.u64s(1)))
    print("TRPFS %r: %d packs, TRPFD: %d arquivos" % (magic, len(fs_offsets), len(fd_hashes)))

    oodle = Oodle(os.path.abspath(os.path.join(root, "oo2core_8_win64.dll")))

    def ler(h):
        i = fd_index[h]
        trpfs.seek(fs_offsets[fnv1a64(pack_names[file_pack[i]])])
        pack = Table.root(trpfs.read(pack_sizes[file_pack[i]]))
        e = dict(zip(pack.u64s(0), pack.tables(1)))[h]
        data = e.bytes_(4)
        return data if e.scalar(1, "b") == -1 else oodle.decompress(data, e.scalar(3, "Q"))

    filtros = [filtro]
    if filtro.isdigit():
        filtros = pastas_da_especie(ler(fnv1a64(CATALOGO)), int(filtro))
        print("Pokédex #%s -> %s" % (filtro, ", ".join(filtros) or "nenhuma pasta no catálogo"))
    wanted = carregar_lista(hashlist, filtros)
    print("%d arquivos na lista" % len(wanted))

    by_pack = {}
    missing = []
    for h, path in wanted.items():
        i = fd_index.get(h)
        if i is None:
            missing.append(path)
        else:
            by_pack.setdefault(file_pack[i], []).append((h, path))

    ok = 0
    for pidx, items in by_pack.items():
        name = pack_names[pidx]
        trpfs.seek(fs_offsets[fnv1a64(name)])
        pack = Table.root(trpfs.read(pack_sizes[pidx]))
        entries = dict(zip(pack.u64s(0), pack.tables(1)))
        for h, path in items:
            e = entries.get(h)
            if e is None:
                missing.append(path)
                continue
            data = e.bytes_(4)
            if e.scalar(1, "b") != -1:
                data = oodle.decompress(data, e.scalar(3, "Q"))
            dest = os.path.join(saida, *path.split("/"))
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as out:
                out.write(data)
            ok += 1
    print("%d extraídos em %s" % (ok, saida))
    if missing:
        print("%d não encontrados no TRPFD/pack (ex.: %s)" % (len(missing), missing[0]))


if __name__ == "__main__":
    main()
