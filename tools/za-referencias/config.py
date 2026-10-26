"""Limiares e constantes do banco de referências Z-A (um lugar só; copiados em cada medida)."""
import hashlib
import json
import os

LIMIAR_ATIVO = 0.10       # fração do pico de energia que marca início/fim do movimento
LIMIAR_LENTO = 0.30       # abaixo disto o quadro conta como "lento" (ease)
HOLD_MIN = 3              # quadros mínimos para um hold
AMOSTRAS_CURVA = 24       # pontos da curva de energia reamostrada
N_ESPECIES_MIN = 8        # abaixo disto um grupo é SEM_BASE_COMPARAVEL
TOL_ESCALA = 0.02         # |escala - 1| acima disto marca escala_animada
DECODER_VERSAO = "za_anim-2"  # 2: escala com compensação por osso (trskl)
METRICAS_VERSAO = "metricas-13"  # subir a cada mudança no código das medidas (entra no hash do cache)

ESPACO = "modelo_Y_up_relativo_raiz"
INTERPOLACAO = "linear+slerp"


def limiares():
    return {"ativo": LIMIAR_ATIVO, "lento": LIMIAR_LENTO, "hold_min": HOLD_MIN,
            "amostras_curva": AMOSTRAS_CURVA, "tol_escala": TOL_ESCALA}


ARQUIVOS_NO_HASH = ("regras_papeis.json", "za_anim.py", "metricas.py", "ontologia.py", "cinematica.py", "contato.py",
                    "poses_chave.py", "config.py")


def hash_config():
    """Chave do cache: limiares, versões E o conteúdo das regras editáveis e do código das medidas (mudar qualquer
    um invalida o cache sem depender de alguém lembrar de subir METRICAS_VERSAO)."""
    aqui = os.path.dirname(os.path.abspath(__file__))
    conteudo = {}
    for nome in ARQUIVOS_NO_HASH:
        try:
            with open(os.path.join(aqui, nome), "rb") as fh:
                conteudo[nome] = hashlib.sha256(fh.read()).hexdigest()
        except OSError:
            conteudo[nome] = None
    dados = {"limiares": limiares(), "decoder": DECODER_VERSAO, "metricas": METRICAS_VERSAO, "espaco": ESPACO,
             "interp": INTERPOLACAO, "arquivos": conteudo}
    return hashlib.sha256(json.dumps(dados, sort_keys=True).encode()).hexdigest()[:16]


def pasta_dumper(inicio=None):
    """'dumper test' do checkout oficial: env ARENAMON_DUMPER ou o primeiro ancestral que o contém.

    Num worktree (.worktrees/<nome>) o dump continua na pasta oficial, dois níveis acima."""
    env = os.environ.get("ARENAMON_DUMPER")
    if env:
        return os.path.abspath(env)
    d = os.path.abspath(inicio or os.path.dirname(__file__))
    while True:
        cand = os.path.join(d, "dumper test")
        if os.path.isdir(cand):
            return cand
        pai = os.path.dirname(d)
        if pai == d:
            return None
        d = pai
