"""Acrescenta vídeos (as duas vistas animadas, modo cego) a um lote de rotulagem já congelado (Task 9).

  python.exe (do Blender) gerar_videos_lote.py <pasta_dump> <pasta_lote>

Mantém os MESMOS itens do lote.json (nenhuma animação entra ou sai); só acrescenta "videos", "fps" e
"quadros_total" a cada item, regrava o hash e refaz rotulagem.html a partir do modelo. Retomável: um item que já
tem os dois vídeos na pasta não é renderizado de novo.
"""
import hashlib
import json
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"


def main():
    dump, pasta = sys.argv[1:3]
    caminho = os.path.join(pasta, "lote.json")
    with open(caminho, encoding="utf-8") as fh:
        lote = json.load(fh)
    for it in lote["itens"]:
        modelo, clipe = it["id"].split("/")
        prefixo = "video_%s_%s_" % (modelo, clipe)
        prontos = sorted(f for f in os.listdir(pasta) if f.startswith(prefixo) and f.endswith(".webm"))
        if len(prontos) >= 2 and it.get("fps"):
            print("  %d já tem vídeo" % it["n"], flush=True)
            continue
        r = subprocess.run([BLENDER, "-b", "--factory-startup", "--addons", "PokemonSwitchV3", "--python",
                            os.path.join(AQUI, "folhas_visuais.py"), "--", os.path.join(dump, modelo[:6], modelo), clipe,
                            pasta, "video"], capture_output=True, text=True, encoding="utf-8", errors="replace")
        linha = next((x for x in r.stdout.splitlines() if x.startswith("[videos]")), None)
        if not linha:
            print("  %d %s SEM VÍDEO" % (it["n"], it["id"]), flush=True)
            continue
        info = json.loads(linha[9:])
        it["videos"], it["fps"], it["quadros_total"] = info["arquivos"], info["fps"], info["quadros"]
        print("  %d/%d %s ok" % (it["n"], len(lote["itens"]), it["id"]), flush=True)
    texto = json.dumps(lote, ensure_ascii=False, indent=1)
    h = hashlib.sha256(texto.encode()).hexdigest()
    with open(caminho, "w", encoding="utf-8") as fh:
        fh.write(texto)
    with open(os.path.join(pasta, "lote.sha256"), "w") as fh:
        fh.write(h + "\n")
    with open(os.path.join(AQUI, "rotulagem.html"), encoding="utf-8") as fh:
        pagina = fh.read().replace("/*LOTE*/null", texto).replace("{{HASH}}", h[:12])
    with open(os.path.join(pasta, "rotulagem.html"), "w", encoding="utf-8") as fh:
        fh.write(pagina)
    print("lote com vídeos: sha256 %s" % h)


if __name__ == "__main__":
    main()
