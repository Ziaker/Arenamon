"""Preparação determinística e validação; não interpreta imagens automaticamente.

CLI: python ia_pipeline.py HTML --saida DIRETORIO [--quadros selecao.json]
Seleção opcional: {"modelo/clipe": [0, 3, 9]} (índices zero-based).
O manifesto separa quadros extraídos de quadros realmente inspecionados pela IA.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess

VERSION = 'ia-pipeline-1'
REGIONS = ['braco_D', 'braco_E', 'braco_C', 'perna_D', 'perna_E', 'perna_C',
           'cabeca', 'pescoco', 'mandibula', 'lingua', 'cauda', 'asa_D', 'asa_E',
           'asa_C', 'nucleo', 'apendice_sensorial', 'outro']
REQUIRED = ['executores', 'iniciador', 'antecipacao', 'parte_some_aparece', 'apoio',
            'leitura_pose', 'massa_aparente', 'intencao', 'observacao']


def default_schema():
    return {'executores': REGIONS + ['INCONCLUSIVO'],
            'iniciador': REGIONS + ['INCONCLUSIVO'],
            'iniciadores': REGIONS + ['INCONCLUSIVO'],
            'apoio_impulso': ['perna_D', 'perna_E', 'perna_C'],
            **{k: ['sim', 'nao', 'INCONCLUSIVO'] for k in
               ['antecipacao', 'parte_some_aparece', 'apoio']},
            'leitura_pose': ['clara', 'confusa', 'INCONCLUSIVO'],
            'massa_aparente': ['leve', 'medio', 'pesado', 'INCONCLUSIVO'],
            'intencao': ['agressivo', 'brincalhao', 'cauteloso', 'neutro', 'INCONCLUSIVO']}


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b''): h.update(block)
    return h.hexdigest()


def read_lote(html):
    p = Path(html).resolve()
    text = p.read_text(encoding='utf-8-sig')
    match = re.search(r'const\s+LOTE\s*=\s*', text)
    if not match: raise ValueError('LOTE JSON não encontrado')
    try: lote, _ = json.JSONDecoder().raw_decode(text[match.end():])
    except json.JSONDecodeError as exc: raise ValueError('LOTE precisa ser JSON literal') from exc
    if not isinstance(lote, dict) or not isinstance(lote.get('itens'), list):
        raise ValueError('LOTE inválido ou template não instanciado')
    match = re.search(r'const\s+CHAVE\s*=\s*"rotulagem_za_"\s*\+\s*"([a-f0-9]+)"', text)
    if not match: raise ValueError('Identificador real do lote ausente')
    ignored = set(lote.get('ignorados', []))
    active = [x for x in lote['itens'] if x['n'] not in ignored]
    if len({x['id'] for x in active}) != len(active): raise ValueError('IDs duplicados')
    schema = default_schema()
    reg = re.search(r'const\s+REGIOES\s*=\s*(\[.*?\]);', text)
    if reg:
        regions = [r[0] for r in json.loads(reg.group(1))]
        for field in ('executores','iniciador','iniciadores'): schema[field] = regions + ['INCONCLUSIVO']
    for field in ('leitura_pose','massa_aparente','intencao'):
        opt = re.search(r'seg\(it.n,\s*"'+field+r'",\s*"[^"]*",\s*(\[\[.*?\]\])\)', text)
        if opt: schema[field] = [x[0] for x in json.loads(opt.group(1))]
    return {'html': str(p), 'hash': match.group(1), 'lote': lote, 'itens': active,
            'schema': schema, 'html_sha256': sha256(p)}


def cache_key(paths, interpretation=None):
    payload = {'version': VERSION, 'code_sha256': sha256(__file__),
               'inputs': [[str(Path(p).resolve()), sha256(p)] for p in paths],
               'interpretation': interpretation}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def write_new_json(path, value):
    """Exclusive creation: never overwrite a potentially human-authored file."""
    p = Path(path); p.parent.mkdir(parents=True, exist_ok=True)
    with p.open('x', encoding='utf-8') as fh:
        json.dump(value, fh, ensure_ascii=False, indent=2)


def snapshot_file(source, directory):
    """Immutable content-addressed copy, checking source before and after copy."""
    source=Path(source).resolve(); before=sha256(source)
    dest=Path(directory).resolve()/before/source.name
    dest.parent.mkdir(parents=True,exist_ok=True)
    if not dest.exists():
        with source.open('rb') as src, dest.open('xb') as dst:
            shutil.copyfileobj(src,dst,1024*1024)
    copied=sha256(dest); after=sha256(source)
    if copied != before or after != before:
        raise RuntimeError('Arquivo mudou durante snapshot: '+str(source))
    return {'original':str(source),'copia':str(dest),'sha256':before}


def _atomic_json(path, value):
    p = Path(path); p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + '.writing')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(tmp, p)


def active_recoil_duration(start, end, action_start):
    if not all(isinstance(x, int) and not isinstance(x, bool) for x in (start,end,action_start)):
        raise ValueError('Fases precisam ser quadros inteiros')
    if not 0 <= start <= end <= action_start: raise ValueError('Ordem temporal inválida')
    return end - start


def event_frames(events, total):
    return sorted({int(e[k]) for e in events for k in ('inicio','pico','fim')
                   if k in e and 0 <= int(e[k]) < total})


def evidence_gate(field, value, proof):
    """Validate declarations. This cannot certify truth of a visual observation."""
    errors = []
    inconclusive = value == 'INCONCLUSIVO' or value == ['INCONCLUSIVO'] or value is None
    if not proof.get('justificativa'): errors.append('justificativa ausente')
    level = proof.get('nivel')
    if level not in ('A','B','C','INCONCLUSIVO'): errors.append('nível inválido')
    if inconclusive: return errors
    if not proof.get('visual_inspecionado'): errors.append('observação visual não inspecionada')
    if not proof.get('quadros'): errors.append('quadros de evidência ausentes')
    if not proof.get('vistas'): errors.append('vista de evidência ausente')
    if level == 'A' and not proof.get('cinematica_confirmada'):
        errors.append('nível A exige confirmação cinemática')
    if level == 'INCONCLUSIVO': errors.append('resposta conclusiva com estado inconclusivo')
    if level == 'C' and not proof.get('hipotese_artistica'):
        errors.append('hipótese precisa ser explicitamente identificada')
    if field in ('executores','apoio_impulso') and value and not proof.get('funcao_confirmada'):
        errors.append('deslocamento não confirma função')
    vals = value if isinstance(value,list) else [value]
    if field in ('executores','apoio_impulso','iniciador','iniciadores'):
        if any(isinstance(x,str) and x.endswith(('_D','_E')) for x in vals) and not proof.get('lateralidade_confirmada'):
            errors.append('lateralidade anatômica não confirmada')
    if field == 'parte_some_aparece' and value == 'sim' and proof.get('causa') in ('oclusao','camera','rapidez'):
        errors.append('oclusão/câmera/rapidez não prova desaparecimento')
    if field == 'apoio' and value in ('sim','nao') and not proof.get('chao_observavel'):
        errors.append('sem referência de chão não há contato confirmado')
    if field == 'iniciador' and len(proof.get('simultaneos',[])) > 1:
        errors.append('campo legado deve ficar inconclusivo quando simultâneo')
    if field == 'antecipacao_q':
        try:
            start,end = proof['recuo_ativo']
            if int(value) != active_recoil_duration(start,end,proof['golpe_inicio']):
                errors.append('duração inclui hold ou diverge do recuo ativo')
        except (KeyError,ValueError,TypeError): errors.append('limites do recuo ausentes/inválidos')
    return errors


def validate_export(export, batch, evidences=None):
    errors = []
    if export.get('lote') != batch['hash']: errors.append('hash do lote diferente')
    reviewer = export.get('revisor','').lower()
    if 'ia' not in reviewer or not ('não validada' in reviewer or 'nao validada' in reviewer):
        errors.append('revisor deve identificar IA não validada por humano')
    rows = export.get('rotulos',[])
    ids = [x.get('id') for x in rows]
    expected = [x['id'] for x in batch['itens']]
    if len(ids) != len(set(ids)): errors.append('rótulos duplicados')
    if set(ids) != set(expected): errors.append('cobertura não corresponde aos itens ativos')
    schema = batch.get('schema') or default_schema()
    evid = {x['id']:x for x in evidences} if isinstance(evidences,list) else evidences
    for row in rows:
        prefix = str(row.get('id')) + ': '
        for f in REQUIRED:
            if f not in row: errors.append(prefix+'campo ausente '+f)
        for f, opts in schema.items():
            if f not in row: continue
            v = row[f]; vals = v if isinstance(v,list) else [v]
            if any(x not in opts for x in vals): errors.append(prefix+'opção inválida '+f)
            if f == 'apoio_impulso' and not isinstance(v,list): errors.append(prefix+'apoio_impulso precisa ser lista')
            if isinstance(v,list) and 'INCONCLUSIVO' in v and len(v)>1: errors.append(prefix+'inconclusivo misturado '+f)
        if not isinstance(row.get('observacao'),str) or not row.get('observacao','').strip():
            errors.append(prefix+'observação vazia')
        if evid is not None:
            ev = evid.get(row.get('id'),{})
            for f,v in row.items():
                if f in ('id','observacao') or f.startswith('conf_'): continue
                pr = ev.get('respostas',{}).get(f)
                if not pr: errors.append(prefix+'evidência ausente '+f); continue
                if pr.get('valor') != v: errors.append(prefix+'evidência diverge da resposta '+f)
                errors.extend(prefix+f+': '+e for e in evidence_gate(f,v,pr))
    return errors


def probe_video(path):
    cmd = ['ffprobe','-v','error','-select_streams','v:0','-show_entries',
           'stream=width,height,r_frame_rate,avg_frame_rate:frame=best_effort_timestamp_time',
           '-show_frames','-of','json',str(path)]
    raw = json.loads(subprocess.run(cmd, check=True, capture_output=True, text=True).stdout)
    stream = raw['streams'][0]
    rate = stream['r_frame_rate'].split('/')
    fps = float(rate[0])/float(rate[1])
    times = [float(x['best_effort_timestamp_time']) for x in raw['frames'] if 'best_effort_timestamp_time' in x]
    return {'fps':fps,'quadros':len(times),'tempos':times,'width':stream['width'],'height':stream['height']}


def compare_timelines(probes, expected_fps, expected_frames):
    issues = []
    tol = max(0.0011, 0.1 / expected_fps)
    for i,p in enumerate(probes):
        if p['quadros'] != expected_frames: issues.append(f'vista {i}: contagem diferente')
        if abs(p['fps']-expected_fps) > 0.01: issues.append(f'vista {i}: fps diferente')
        if any(abs(t-j/expected_fps)>tol for j,t in enumerate(p['tempos'])):
            issues.append(f'vista {i}: timeline divergente')
    if len(probes)<2: issues.append('menos de duas vistas')
    if probes and any(len(p['tempos']) != len(probes[0]['tempos']) or
                      any(abs(a-b)>tol for a,b in zip(p['tempos'],probes[0]['tempos'])) for p in probes[1:]):
        issues.append('vistas dessincronizadas')
    return {'compativeis':not issues,'problemas':issues,'tolerancia_s':tol,
            'limite':'Timeline compatível não prova identidade semântica; conferir código e poses.'}


def adaptive_frames(video, total, count=16):
    """Scan 48x48 grayscale sequentially; motion score only chooses inspection frames."""
    cmd = ['ffmpeg','-v','error','-i',str(video),'-vf','scale=48:48,format=gray','-f','rawvideo','-']
    process = subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
    previous = None; scores=[]; index=0
    try:
        while True:
            block = process.stdout.read(48*48)
            if not block: break
            if len(block) != 48*48: raise ValueError('frame parcial')
            if previous is not None: scores.append((sum(abs(a-b) for a,b in zip(block,previous))/len(block),index))
            previous=block; index+=1
    finally:
        process.stdout.close()
        rc=process.wait()
    if rc: raise RuntimeError('ffmpeg falhou ao medir mudanças visuais')
    selected={round(i*(total-1)/7) for i in range(8)} if total>1 else {0}
    for _,q in sorted(scores,reverse=True):
        if len(selected)>=count: break
        if all(abs(q-v)>1 for v in selected): selected.add(q)
    return sorted(selected), [{'quadro':q,'diferenca_media_pixel':round(s,5)} for s,q in scores]


def extract_sheet(video, frames, output):
    """Extract exact decoded indices; each tile is stamped with its source index."""
    output=Path(output); output.parent.mkdir(parents=True,exist_ok=True)
    expression='+'.join(f'eq(n\\,{q})' for q in frames)
    filters=f"select='{expression}',scale=320:-1,drawtext=text='q=%{{n}}':x=5:y=5:fontsize=20:fontcolor=white:box=1:boxcolor=black"
    # drawtext n after select would number tiles, so label via original frame time instead.
    # Individual images have exact q names, and sheets carry an accompanying mapping.
    filters=f"select='{expression}',scale=320:-1,tile=4x{math.ceil(len(frames)/4)}:padding=3:margin=3"
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(video),'-vf',filters,'-frames:v','1',str(output)],check=True,capture_output=True)
    return {'arquivo':str(output),'quadros':frames,'ordem':'esquerda para direita, cima para baixo'}


def prepare(html, output, frames_by_id=None):
    batch=read_lote(html); out=Path(output).resolve(); source=Path(batch['html']).parent
    if out == source or out in source.parents: raise ValueError('saída não pode ser pasta original ou ancestral')
    out.mkdir(parents=True,exist_ok=True)
    manifest={'versao':VERSION,'lote':batch['hash'],'html':batch['html'],'html_sha256':batch['html_sha256'],
              'itens':[],'falhas':[],'ignorados':batch['lote'].get('ignorados',[])}
    manifest['html_snapshot']=snapshot_file(batch['html'],out/'fontes')
    for item in batch['itens']:
        identity=item['id']; slug=identity.replace('/','__')
        if not re.fullmatch(r'[A-Za-z0-9_-]+',slug): raise ValueError('ID inseguro')
        record=out/'preparacao'/f'{slug}.json'
        try:
            paths=[source/p for p in item.get('videos',[])+item.get('folhas',[])]
            if any(source not in p.resolve().parents for p in paths): raise ValueError('mídia fora da pasta do lote')
            snapshots=[snapshot_file(p,out/'fontes') for p in paths]
            copies={s['original']:Path(s['copia']) for s in snapshots}
            key=cache_key([Path(manifest['html_snapshot']['copia']),*[Path(s['copia']) for s in snapshots]], {'quadros':(frames_by_id or {}).get(identity)})
            if record.exists():
                cached=json.loads(record.read_text(encoding='utf8'))
                if cached.get('cache_key')==key and all(Path(x['arquivo']).exists() for x in cached.get('folhas_extraidas',[])):
                    manifest['itens'].append({**cached,'cache_hit':True}); continue
            videos=[copies[str((source/v).resolve())] for v in item.get('videos',[])]
            probes=[probe_video(v) for v in videos]
            q=(frames_by_id or {}).get(identity)
            scores=[]
            if q is None: q,scores=adaptive_frames(videos[0],item['quadros_total'])
            q=sorted(set(q))
            if not q or any(not isinstance(f,int) or not 0<=f<item['quadros_total'] for f in q): raise ValueError('quadros inválidos')
            sheets=[extract_sheet(v,q,out/'quadros'/f'{slug}_vista{i}.png') for i,v in enumerate(videos)]
            result={'id':identity,'item':item,'cache_key':key,'cache_hit':False,
                    'fontes':snapshots,
                    'probes':probes,'sincronia':compare_timelines(probes,item['fps'],item['quadros_total']),
                    'folhas_extraidas':sheets,'selecao_adaptativa':scores,'inspecao_visual':'PENDENTE'}
            _atomic_json(record,result); manifest['itens'].append(result)
        except Exception as exc:
            failure={'id':identity,'erro':str(exc),'tipo':type(exc).__name__}
            _atomic_json(out/'falhas'/f'{slug}.json',failure); manifest['falhas'].append(failure)
        _atomic_json(out/'preparacao_manifesto.json',manifest)
    _atomic_json(out/'preparacao_manifesto.json',manifest)
    return manifest


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('html'); parser.add_argument('--saida',required=True)
    parser.add_argument('--quadros',help='JSON id -> índices de quadros')
    args=parser.parse_args()
    frames=json.loads(Path(args.quadros).read_text(encoding='utf8')) if args.quadros else None
    result=prepare(args.html,args.saida,frames)
    print(json.dumps({'itens':len(result['itens']),'falhas':result['falhas'],'manifesto':str(Path(args.saida)/'preparacao_manifesto.json')},ensure_ascii=False))
    raise SystemExit(bool(result['falhas']))
