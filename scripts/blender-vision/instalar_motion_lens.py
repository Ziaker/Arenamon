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
import tempfile
import tokenize

AQUI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "addons")


def destinos():
    base = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "Blender Foundation", "Blender")
    return sorted(glob.glob(os.path.join(base, "*", "scripts", "addons")))


def _validate_source(source):
    entry = os.path.join(source, "motion_lens.py")
    parts = os.path.join(source, "motion_lens_parts")
    init = os.path.join(parts, "__init__.py")
    if not os.path.isfile(entry) or not os.path.isfile(init):
        raise FileNotFoundError("Pacote incompleto: motion_lens.py e motion_lens_parts/__init__.py sao obrigatorios")
    for module in [entry, *glob.glob(os.path.join(parts, "*.py"))]:
        with tokenize.open(module) as handle:
            compile(handle.read(), module, "exec")


def install(dest, source=AQUI):
    """Instala entrada e módulos como uma unidade, restaurando ambos se a troca falhar."""
    dest = os.path.abspath(dest)
    source = os.path.abspath(source)
    if not os.path.isdir(dest):
        raise FileNotFoundError("Pasta de addons nao encontrada: " + dest)
    _validate_source(source)
    parent = os.path.dirname(dest)
    stage = tempfile.mkdtemp(prefix=".motion-lens-stage-", dir=parent)
    rollback = tempfile.mkdtemp(prefix=".motion-lens-rollback-", dir=parent)
    entry_target = os.path.join(dest, "motion_lens.py")
    parts_target = os.path.join(dest, "motion_lens_parts")
    old_entry = os.path.join(rollback, "motion_lens.py")
    old_parts = os.path.join(rollback, "motion_lens_parts")
    try:
        shutil.copy2(os.path.join(source, "motion_lens.py"), os.path.join(stage, "motion_lens.py"))
        shutil.copytree(
            os.path.join(source, "motion_lens_parts"),
            os.path.join(stage, "motion_lens_parts"),
            ignore=shutil.ignore_patterns("__pycache__"),
        )
        if os.path.isfile(entry_target):
            shutil.copy2(entry_target, old_entry)
        if os.path.isdir(parts_target):
            shutil.copytree(parts_target, old_parts, ignore=shutil.ignore_patterns("__pycache__"))

        try:
            if os.path.exists(entry_target):
                os.remove(entry_target)
            if os.path.isdir(parts_target):
                shutil.rmtree(parts_target)
            os.replace(os.path.join(stage, "motion_lens.py"), entry_target)
            os.replace(os.path.join(stage, "motion_lens_parts"), parts_target)
        except Exception:
            if os.path.exists(entry_target):
                os.remove(entry_target)
            if os.path.isdir(parts_target):
                shutil.rmtree(parts_target)
            if os.path.isfile(old_entry):
                shutil.copy2(old_entry, entry_target)
            if os.path.isdir(old_parts):
                shutil.copytree(old_parts, parts_target, ignore=shutil.ignore_patterns("__pycache__"))
            raise

        if os.path.isfile(old_entry):
            shutil.copy2(old_entry, entry_target + ".bak")
        if os.path.isdir(old_parts):
            backup_parts = parts_target + ".bak"
            if os.path.isdir(backup_parts):
                shutil.rmtree(backup_parts)
            shutil.copytree(old_parts, backup_parts, ignore=shutil.ignore_patterns("__pycache__"))
    finally:
        shutil.rmtree(stage, ignore_errors=True)
        shutil.rmtree(rollback, ignore_errors=True)


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
    install(dest)
    print("versao anterior completa guardada em motion_lens.py.bak e motion_lens_parts.bak (quando existia).")
    print("instalado. No Blender: Edit > Preferences > Add-ons > Motion Lens (reinicie o Blender se ele já estava ligado).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
