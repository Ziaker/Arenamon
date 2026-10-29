"""Instala o addon Motion Lens (motion_lens.py + pasta motion_lens_parts/) na pasta de addons do Blender.

O addon foi dividido por responsabilidade (limite de 2.000 linhas por arquivo, AGENTS.md): o ponto de entrada continua sendo motion_lens.py e
as partes ficam em motion_lens_parts/ ao lado dele. Copie os DOIS juntos. Uma cópia antiga de arquivo único segue funcionando até ser trocada.

Uso:
    python scripts/blender-vision/instalar_motion_lens.py                 # só MOSTRA o que faria (nada é copiado)
    python scripts/blender-vision/instalar_motion_lens.py --instalar      # copia, guardando a versão antiga como motion_lens.py.bak
    python scripts/blender-vision/instalar_motion_lens.py --destino PASTA # outra pasta de addons
Nunca salva nem abre .blend; não mexe em preferências do Blender (ligar/desligar o addon continua sendo escolha sua)."""
import argparse
import glob
import os
import shutil
import sys

AQUI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "addons")


def destinos():
    base = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "Blender Foundation", "Blender")
    return sorted(glob.glob(os.path.join(base, "*", "scripts", "addons")))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--instalar", action="store_true", help="copia de verdade (sem isso, só mostra)")
    ap.add_argument("--destino", help="pasta de addons do Blender (padrão: a mais recente em %%APPDATA%%)")
    a = ap.parse_args()
    dest = a.destino or (destinos() or [None])[-1]
    if not dest or not os.path.isdir(dest):
        print("Pasta de addons do Blender não encontrada; passe --destino PASTA.")
        return 1
    print("origem :", AQUI)
    print("destino:", dest)
    print("copiaria: motion_lens.py + motion_lens_parts/ (%d arquivos)" % len(glob.glob(os.path.join(AQUI, "motion_lens_parts", "*.py"))))
    if not a.instalar:
        print("(simulação) rode de novo com --instalar para copiar.")
        return 0
    alvo = os.path.join(dest, "motion_lens.py")
    if os.path.exists(alvo):
        shutil.copy2(alvo, alvo + ".bak")
        print("versão anterior guardada em", alvo + ".bak")
    shutil.copy2(os.path.join(AQUI, "motion_lens.py"), alvo)
    pasta = os.path.join(dest, "motion_lens_parts")
    if os.path.isdir(pasta):
        shutil.rmtree(pasta)
    shutil.copytree(os.path.join(AQUI, "motion_lens_parts"), pasta, ignore=shutil.ignore_patterns("__pycache__"))
    print("instalado. No Blender: Edit > Preferences > Add-ons > Motion Lens (reinicie o Blender se ele já estava ligado).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
