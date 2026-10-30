"""Quantificação por clipe para revisão IA; não infere papéis nem contato.

Python do Blender: ia_cinematica.py HTML_LOTE DUMP SAIDA [--id modelo/clipe]
As séries são amostradas no quadro inteiro original, com interpolação linear/slerp
do decodificador existente. Cada velocidade q mede a transição q-1 -> q.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re

import numpy as np

VERSION = 'ia-cinematica-1'


def segment_signal(values, absolute_threshold=0.01, relative_threshold=0.1, min_run=2):
    """Trechos quantitativos, NÃO fases semânticas; dois quadros suprimem ruído isolado."""
    s = np.asarray(values, dtype=float)
    threshold = max(absolute_threshold, float(s.max()) * relative_threshold) if len(s) else absolute_threshold
    intervals, start = [], None
    for q, active in enumerate(list(s > threshold) + [False]):
        if active and start is None:
            start = q
        if not active and start is not None:
            if q - start >= min_run:
                intervals.append([start, q-1])
            start = None
    peaks = [a + int(np.argmax(s[a:b+1])) for a, b in intervals]
    return {'limiar': threshold, 'intervalos': intervals, 'picos': peaks,
            'inicio': intervals[0][0] if intervals else None}


def linear_speed(positions, fps, hidden=None):
    p = np.asarray(positions, dtype=float)
    out = np.zeros(p.shape[:-1])
    out[1:] = np.linalg.norm(np.diff(p, axis=0), axis=-1) * fps
    if hidden is not None:
        out[1:][hidden[1:] | hidden[:-1]] = 0
    return out


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1024*1024), b''):
            h.update(block)
    return h.hexdigest()


def _rounded(x):
    return np.round(x, 7).tolist()


def measure(item, dump, lote_dir):
    import za_anim
    import ontologia
    model, clip = item['id'].split('/')
    folder = Path(dump) / model[:6] / model
    anim = folder / (model + '_' + clip + '.tranm')
    skeleton = za_anim.esqueleto_do_modelo(str(folder))
    if not skeleton or not anim.is_file():
        raise FileNotFoundError('Original exato ou esqueleto ausente: ' + item['id'])
    esq = za_anim.Esqueleto(skeleton)
    c = za_anim.Clipe(str(anim), esq)
    regs = ontologia.regioes(esq)  # nomenclatura/cadeia, nunca papeis()
    height = float(np.ptp(esq.posicoes_repouso[:, 1])) or 1.0
    hidden = za_anim.ocultos(c, esq)
    speed = linear_speed(c.posicoes, c.fps, hidden) / height
    dot = np.abs(np.sum(c.rot[1:] * c.rot[:-1], axis=-1)).clip(0, 1)
    angular = np.zeros_like(speed)
    angular[1:] = np.degrees(2*np.arccos(dot)) * c.fps
    angular[1:][hidden[1:] | hidden[:-1]] = 0
    regions = {}
    for r in sorted(set(regs)):
        ids = [i for i, x in enumerate(regs) if x == r]
        curve = speed[:, ids].max(axis=1)
        rotation = angular[:, ids].max(axis=1)
        regions[r] = {'ossos': [esq.nomes[i] for i in ids],
                      'velocidade_max_H_s': _rounded(curve),
                      'rotacao_local_max_graus_s': _rounded(rotation),
                      'atividade_translacao': segment_signal(curve),
                      'atividade_rotacao': segment_signal(rotation, absolute_threshold=5),
                      'pico_H_s': float(curve.max())}
    roots = [i for i, p in enumerate(esq.pais) if p < 0 or p >= len(esq.nomes)]
    root_data = {esq.nomes[i]: {'deslocamento_final': _rounded(c.posicoes[-1, i]-c.posicoes[0, i]),
                  'excursao_max_H': float(np.linalg.norm(c.posicoes[:, i]-c.posicoes[0, i], axis=1).max()/height)}
                 for i in roots}
    sources = {'animacao': {'path': str(anim), 'sha256': digest(anim)},
               'esqueleto': {'path': str(skeleton), 'sha256': digest(skeleton)},
               'videos': [{'path': str(Path(lote_dir)/v), 'sha256': digest(Path(lote_dir)/v)} for v in item.get('videos', [])],
               'implementacao': {name: digest(Path(__file__).parent/name) for name in ('ia_cinematica.py','za_anim.py','ontologia.py','config.py')}}
    bones = []
    for i, name in enumerate(esq.nomes):
        bones.append({'i': i, 'nome': name, 'pai': int(esq.pais[i]), 'regiao_candidata': regs[i],
                      'posicao_repouso': _rounded(esq.posicoes_repouso[i]),
                      'pico_velocidade_H_s': float(speed[:, i].max()),
                      'quadro_pico_velocidade': int(np.argmax(speed[:, i])),
                      'atividade': segment_signal(speed[:, i]),
                      'quadros_ocultos_escala': np.flatnonzero(hidden[:, i]).tolist()})
    return {'id': item['id'], 'versao': VERSION, 'fontes': sources,
            'fps': c.fps, 'quadros': c.quadros, 'duracao_amostrada_s': (c.quadros-1)/c.fps,
            'correspondencia': {'id_arquivo_exato': True,
                'fps_e_quadros_iguais_LOTE': c.fps == item.get('fps') and c.quadros == item.get('quadros_total'),
                'codigo_LOTE': item.get('codigo_leitura'), 'codigo_e_hash': False,
                'status': 'ASSOCIACAO_POR_ID_E_TIMELINE_REQUER_CONFIRMACAO_VISUAL'},
            'referencial': {'up': '+Y Trinity', 'esquerda_anatomica': '+X em repouso; confirmar hierarquia e marcador azul',
                            'altura_esqueleto_repouso_H': height, 'unidade_distancia': 'unidade original; velocidades normalizadas por H'},
            'limiares': {'velocidade_H_s': 0.01, 'fracao_pico_por_regiao': 0.1, 'duracao_minima_quadros': 2,
                         'rotacao_graus_s': 5, 'escala_oculta': 0.1,
                         'filtro': 'rejeição de trechos com menos de 2 quadros; nenhuma suavização; diferenças entre quadros consecutivos'},
            'ossos': bones, 'regioes': regions, 'raizes': root_data,
            'series': {'posicoes_globais': _rounded(c.posicoes), 'rotacoes_globais_matrizes': _rounded(c.rot_mundo),
                       'translacoes_locais': _rounded(c.loc), 'rotacoes_locais_wxyz': _rounded(c.rot),
                       'escalas_locais': _rounded(c.escala), 'velocidades_H_s': _rounded(speed)},
            'limitacoes': ['Não determina executor, antecipação, apoio ou contato; picos não são impactos.',
                'Regiões são candidatas por nomes e cadeia; conferir anatomia visualmente.',
                'Código de leitura é aleatório por execução do render, não hash da animação.',
                'Não há manifesto original que vincule criptograficamente bytes do vídeo aos bytes tranm.',
                'Root imóvel não impede locomoção em esteira; mundo original não inclui plano de chão.',
                'Decodificação linear/slerp; escala compensada pelo esqueleto; deformação da malha não medida.']}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('html', type=Path)
    ap.add_argument('dump', type=Path)
    ap.add_argument('saida', type=Path)
    ap.add_argument('--id')
    args = ap.parse_args()
    source = args.html.read_text(encoding='utf-8')
    match = re.search(r'const\s+LOTE\s*=\s*', source)
    if not match:
        raise ValueError('LOTE ausente')
    lote = json.JSONDecoder().raw_decode(source[match.end():])[0]
    active = [i for i in lote['itens'] if i['n'] not in lote.get('ignorados', [])]
    if args.id and args.id not in {i['id'] for i in active}:
        raise ValueError('ID não pertence aos itens ativos')
    args.saida.mkdir(parents=True, exist_ok=True)
    failures = []
    for item in active:
        if args.id and args.id != item['id']:
            continue
        try:
            result = measure(item, args.dump, args.html.parent)
            output = args.saida/(item['id'].replace('/', '__') + '.json')
            tmp = output.with_suffix('.tmp')
            tmp.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            tmp.replace(output)
            print(json.dumps({'id': item['id'], 'arquivo': str(output), 'fps': result['fps'], 'quadros': result['quadros'],
                  'regioes': {r: x['atividade_translacao'] for r,x in result['regioes'].items()
                              if r in ('braco_D','braco_E','nucleo','cabeca','perna_D','perna_E','mandibula','asa_D','asa_E')},
                  'raizes': result['raizes']}, ensure_ascii=True))
        except Exception as exc:
            failures.append({'id': item['id'], 'erro': str(exc)})
    (args.saida/'falhas.json').write_text(json.dumps(failures, ensure_ascii=False, indent=2), encoding='utf-8')
    if failures:
        raise SystemExit(json.dumps(failures, ensure_ascii=True))


if __name__ == '__main__':
    main()
