"""Faz tudo para um Pokémon do Z-A: extrai, converte texturas e monta um .blend por forma.

  python -I pokemon_za.py <numero_pokedex>      ex.: 768 (Golisopod)

Saídas (tudo dentro de "dumper test", ignorado pelo Git):
  dumper test/extraido/ik_pokemon/data/pmXXXX/...   arquivos crus + PNGs
  dumper test/blender/pmXXXX_YY_ZZ.blend            modelo + esqueleto + todas as animações
"""
import glob
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
DUMPER = os.path.join(RAIZ, "dumper test")
EXTRAIDO = os.path.join(DUMPER, "extraido")
BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"

sys.path.insert(0, AQUI)
import bntx_para_png  # noqa: E402
import extrair_za  # noqa: E402


def main():
    if len(sys.argv) != 2 or not sys.argv[1].isdigit():
        print(__doc__)
        sys.exit(1)
    numero = sys.argv[1]

    print("== 1/3 Extraindo arquivos do RomFS")
    sys.argv = ["extrair_za.py", DUMPER, numero, EXTRAIDO]
    extrair_za.main()

    pastas = sorted({os.path.dirname(p) for p in glob.glob(
        os.path.join(EXTRAIDO, "ik_pokemon", "data", "pm*", "*", "*.trmdl"))})

    print("== 2/3 Convertendo texturas BNTX -> PNG")
    # só as formas da espécie pedida (extrações anteriores de outras espécies ficam na mesma árvore)
    alvo =[p for p in pastas if os.path.basename(p) in _formas(numero)]
    for p in alvo:
        sys.argv = ["bntx_para_png.py", p]
        bntx_para_png.main()

    print("== 3/3 Montando .blend no Blender (em segundo plano)")
    for p in alvo:
        saida = os.path.join(DUMPER, "blender", os.path.basename(p) + ".blend")
        r = subprocess.run([BLENDER, "-b", "--factory-startup", "--python-exit-code", "1",
                            "--addons", "PokemonSwitchV3", "--python", os.path.join(AQUI, "montar_blend.py"),
                            "--", p, saida], capture_output=True, text=True, encoding="utf-8", errors="replace")
        for linha in r.stdout.splitlines():
            if linha.startswith("[montar]"):
                print("  " + linha)
        if r.returncode:
            print("  ERRO ao montar %s (veja o log abaixo)" % os.path.basename(p))
            print("\n".join(r.stdout.splitlines()[-20:] + r.stderr.splitlines()[-20:]))
    print("Pronto. Abra os .blend em: " + os.path.join(DUMPER, "blender"))


def _formas(numero):
    """Nomes das pastas de forma (pmXXXX_YY_ZZ) da espécie, segundo o catálogo do jogo."""
    arq = os.path.join(EXTRAIDO, *extrair_za.CATALOGO.split("/"))
    if not os.path.exists(arq):
        sys.argv = ["extrair_za.py", DUMPER, extrair_za.CATALOGO, EXTRAIDO]
        extrair_za.main()
    with open(arq, "rb") as fh:
        return {p.rstrip("/").rsplit("/", 1)[1] for p in extrair_za.pastas_da_especie(fh.read(), int(numero))}


if __name__ == "__main__":
    main()
