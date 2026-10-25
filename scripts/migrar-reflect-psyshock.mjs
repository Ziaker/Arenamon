// Migra Reflect e Psyshock para «Move como dado» (move.json), com prova de equivalência. Diferente dos Moves em ficha, eles tinham:
//   - a definição em reflect.js/psyshock.js (sem ficha), os padrões em C.world.reflect/psyshock (config.js) e os rótulos/faixas dos sliders numa
//     tabela fixa (PARAMS em ui/moves-panel.js). Este script junta tudo num <id>.move.json e apaga as duplicatas.
//   node scripts/migrar-reflect-psyshock.mjs          -> migra os dois
// Retrato antes × depois (definição, padrões de C.world, linhas de sliders, texto de apoio, Move efetivo e ordem do registro) tem de ser IDÊNTICO.
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, unlinkSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parse} from 'acorn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = p => path.join(root, 'prototypes/combat-lab/src', p);
const IDS = [{id: 'reflect', title: 'Reflect', group: 'reflect'}, {id: 'psyshock', title: 'Psyshock', group: 'psyshock'}];
const read = p => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const write = (p, s, like) => writeFileSync(p, /\r\n/.test(readFileSync(like ?? p, 'utf8')) ? s.replace(/\n/g, '\r\n') : s);

function snapshot() {
  const base = pathToFileURL(src('')).href.replace(/\/?$/, '/');
  const code = `
    const base = ${JSON.stringify(base)};
    const {factoryDefaults} = await import(base + 'sim/config.js');
    const {registerStandardMoves} = await import(base + 'sim/moves/standard.js');
    const Moves = await import(base + 'sim/moves.js');
    const panel = await import(base + 'ui/moves-panel.js');
    registerStandardMoves();
    const out = {order: Moves.listMoves().map(m => m.id), info: {}, rows: {}, world: {}, def: {}, eff: {}};
    for (const id of ['reflect', 'psyshock']) {
      out.def[id] = Moves.listMoves().find(m => m.id === id);
      out.eff[id] = Moves.getMove(id);
      out.world[id] = Object.fromEntries(Object.entries(factoryDefaults().world[id]).sort());
      out.info[id] = {group: panel.MOVE_INFO[id]?.group, hint: panel.MOVE_INFO[id]?.hint};
      out.rows[id] = (panel.MOVES_PARAMS.find(([t]) => t.toLowerCase() === id)?.[1] ?? []).map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]?.name ?? String(r[7]), !!r[8]]);
    }
    process.stdout.write(JSON.stringify(out, (k, v) => typeof v === 'function' ? '[fn]' : v === Infinity ? '[Inf]' : v, 1));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], {encoding: 'utf8', cwd: root, maxBuffer: 64 * 1024 * 1024});
  if (r.status !== 0) throw new Error('retrato falhou: ' + (r.stderr || '').split('\n').filter(l => /rror/.test(l)).slice(0, 2).join(' | '));
  return r.stdout;
}
const before = snapshot();
const B = JSON.parse(before);

// 1) tabela original (antes da duplicação de limites): lê PARAMS do código-fonte de moves-panel.js
const panelSrc = read(src('ui/moves-panel.js'));
const astPanel = parse(panelSrc, {ecmaVersion: 'latest', sourceType: 'module'});
const paramsDecl = astPanel.body.find(s => s.type === 'VariableDeclaration' && s.declarations[0].id.name === 'PARAMS');
const arrText = panelSrc.slice(paramsDecl.declarations[0].init.start, paramsDecl.declarations[0].init.end);
const UNITS = ['ms2', 'num', 'int', 'sec', 'pct', 'm', 'ms', 'deg', 'x', 'yesno'];
const PARAMS = new Function(...UNITS, 'return ' + arrText)(...UNITS);   // as «funções de formato» viram o próprio nome da unidade

// Tremor de câmera: em Reflect/Psyshock as 3 linhas eram acrescentadas DEPOIS da duplicação de limites (por isso intensidade 0–6 e duração 0,1–5), enquanto o
// preset hitShake das fichas passa pela duplicação (0–12 e 0,1–10). Para a equivalência ser exata, entram como linhas explícitas com a metade do limite.
const HIT_SHAKE_COMO_ERA = [
  {key: 'hitShakeOn', label: 'Tremor de câmera ao acertar', tip: 'Desligado (padrão): este Move não treme a câmera ao acertar. Ligado: libera a intensidade e a duração do tremor. Só aparência.', min: 0, max: 1, step: 1, unit: 'yesno', value: 0},
  {key: 'hitShakeAmount', label: 'Tremor ao acertar: intensidade', tip: 'Multiplica o tremor de hit padrão (1 = igual ao do Tackle). Só aparência.', min: 0, max: 3, step: 0.05, unit: 'x', value: 1},
  {key: 'hitShakeDuration', label: 'Tremor ao acertar: duração', tip: 'Multiplica a duração do tremor de hit padrão (1 = igual ao do Tackle). Só aparência.', min: 0.1, max: 2.5, step: 0.05, unit: 'x', value: 1},
];

// 2) monta os dois move.json
const docs = {};
for (const {id, title, group} of IDS) {
  const table = PARAMS.find(([t]) => t === title)?.[1];
  if (!table) throw new Error(`tabela de ${title} não achada em moves-panel.js`);
  const defs = B.world[group];
  const rows = [];
  for (const [g, key, label, tip, min, max, step, unit, approved] of table) {
    if (g !== group) throw new Error(`${title}: linha de outro grupo (${g})`);
    if (!(key in defs)) throw new Error(`${title}: ${key} não existe em C.world.${group}`);
    rows.push({key, label, tip, min, max, step, unit, value: defs[key], ...(approved ? {approved: true} : {})});
  }
  const missing = Object.keys(defs).filter(k => !rows.some(r => r.key === k) && !k.startsWith('hitShake'));
  if (missing.length) throw new Error(`${title}: chaves de C.world sem slider: ${missing.join(', ')}`);
  const def = {...B.def[id]};
  docs[id] = {schemaVersion: 1, def, params: {group, title, hint: B.info[id].hint, rows: [...rows, ...HIT_SHAKE_COMO_ERA]}};
}

// 3) escreve arquivos
const files = [];
for (const {id} of IDS) {
  const moveJson = src(`sim/moves/${id}.move.json`), paramsJs = src(`sim/moves/${id}.params.js`), js = src(`sim/moves/${id}.js`);
  if (existsSync(moveJson)) { console.log(`${id}: já migrado`); continue; }
  writeFileSync(moveJson, JSON.stringify(docs[id], null, 2) + '\n');
  writeFileSync(paramsJs, `// @ts-check
// Parâmetros e definição do Move "${id}" — LIDOS DE ${id}.move.json (Move como dado). Antes: padrões em C.world.${id} (config.js), rótulos e faixas numa tabela
// de ui/moves-panel.js e a definição em ${id}.js. Agora tudo mora no JSON: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './${id}.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga, carga): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier, quando houver. */
export const visual = loaded.visual;
`);
  // <id>.js: troca a definição literal pela do JSON e declara a ficha (índice automático)
  let s = read(js);
  const ast = parse(s, {ecmaVersion: 'latest', sourceType: 'module'});
  const decl = ast.body.find(n => n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'VariableDeclaration' && n.declaration.declarations[0].id.name === `${id}Def`);
  if (!decl) throw new Error(`${id}.js: não achei ${id}Def`);
  s = s.slice(0, decl.start) + `export {${id}Def};   // definição (id, carga, custo…) vem de ${id}.move.json` + s.slice(decl.end);
  const firstImport = ast.body.find(n => n.type === 'ImportDeclaration');
  const importBlockEnd = ast.body.filter(n => n.type === 'ImportDeclaration').at(-1).end;
  s = s.slice(0, importBlockEnd) + `\nimport {defineFicha} from './params-registry.js';\nimport {params, def as ${id}Def} from './${id}.params.js';` + s.slice(importBlockEnd);
  s = s.trimEnd() + `

/** FICHA do Move (índice automático): definição e parâmetros vêm do ${id}.move.json. O registro continua em standard.js (Moves padrão, não «novos»). */
export const ficha = defineFicha({def: ${id}Def, effect: ['${id}', ${id}Effect], params});
`;
  write(js, s, js);
  files.push(js);
}

// 4) config.js: tira os literais de C.world.reflect/psyshock (agora vêm da ficha)
let cfg = read(src('sim/config.js'));
for (const {group} of IDS) {
  const re = new RegExp(`\\n    // ${group}: [^\\n]*\\n    ${group}: \\{[^\\n]*\\},`);
  if (!re.test(cfg)) throw new Error(`config.js: literal de ${group} não achado`);
  cfg = cfg.replace(re, `\n    // ${group}: padrões vêm de moves/${group}.move.json (Move como dado; syncMoveParams)`);
}
write(src('sim/config.js'), cfg);

// 5) moves-panel.js: tira as linhas fixas de Reflect/Psyshock (a ficha traz as mesmas)
let mp = read(src('ui/moves-panel.js'));
for (const {title} of IDS) {
  const start = mp.indexOf(`  ['${title}', [\n`);
  if (start < 0) throw new Error(`moves-panel.js: grupo ${title} não achado`);
  const end = mp.indexOf('\n  ]],\n', start) + '\n  ]],\n'.length;
  mp = mp.slice(0, start) + mp.slice(end);
}
write(src('ui/moves-panel.js'), mp);

// 6) NEW_MOVES não inclui Reflect/Psyshock (têm tratamento próprio na IA e no registro)
let nm = read(src('sim/moves/new-moves.js'));
nm = nm.replace('  ...FICHAS,\n', "  // Reflect e Psyshock também são fichas (Move como dado), mas NÃO são «novos»: standard.js os registra e a IA os trata à parte.\n  ...FICHAS.filter(f => !['reflect', 'psyshock'].includes(f.def.id)),\n");
write(src('sim/moves/new-moves.js'), nm);

// 7) índice de fichas e retrato depois
spawnSync(process.execPath, [path.join(root, 'prototypes/combat-lab/gen-fichas.mjs')], {cwd: root});
const after = snapshot();
const A = JSON.parse(after);
const diff = [];
if (JSON.stringify(A.order) !== JSON.stringify(B.order)) diff.push('ordem do registro');
for (const {id} of IDS) {
  for (const k of ['def', 'eff', 'world', 'info']) if (JSON.stringify(A[k][id]) !== JSON.stringify(B[k][id])) diff.push(`${k}:${id}`);
  // linhas de sliders: mesma lista, em qualquer ordem de chaves dentro do grupo? exige a mesma ordem e conteúdo
  const norm = rows => rows.map(r => JSON.stringify(r)).join('\n');
  if (norm(A.rows[id]) !== norm(B.rows[id])) { diff.push(`rows:${id}`); const n = Math.max(A.rows[id].length, B.rows[id].length); for (let i = 0; i < n; i++) if (JSON.stringify(A.rows[id][i]) !== JSON.stringify(B.rows[id][i])) { console.log(`  ${id}[${i}] antes:  ${JSON.stringify(B.rows[id][i])}
  ${id}[${i}] depois: ${JSON.stringify(A.rows[id][i])}`); break; } console.log(`  ${id}: ${B.rows[id].length} linhas antes, ${A.rows[id].length} depois`); }
}
if (diff.length) { console.log('✗ o retrato mudou em: ' + diff.join(', ')); console.log('  (nada foi desfeito automaticamente: use git checkout/restore)'); process.exit(1); }
console.log(`✓ reflect e psyshock migrados; retrato idêntico (${createHash(before)})`);
function createHash(t) { let h = 0; for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h >>> 0).toString(16); }
