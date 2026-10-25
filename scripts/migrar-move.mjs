// Migra UM Move para «Move como dado»: gera src/sim/moves/<id>.move.json a partir da definição e dos parâmetros atuais, religa <id>.js e <id>.params.js
// ao JSON e PROVA a equivalência (retrato antes × depois: definição, fichas de parâmetros, padrões de C.world, Move efetivo, chaves da ficha).
//   node scripts/migrar-move.mjs <id> [--seco]
// Se algo não for serializável em JSON (função, Infinity, undefined) ou o retrato divergir, desfaz tudo (git checkout) e explica o motivo.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, existsSync, unlinkSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parse} from 'acorn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2], dry = process.argv.includes('--seco');
if (!id) { console.error('uso: node scripts/migrar-move.mjs <id>'); process.exit(2); }
const dir = path.join(root, 'prototypes/combat-lab/src/sim/moves');
const fJs = path.join(dir, `${id}.js`), fParams = path.join(dir, `${id}.params.js`), fJson = path.join(dir, `${id}.move.json`);
if (!existsSync(fJs) || !existsSync(fParams)) { console.error(`não achei ${id}.js / ${id}.params.js`); process.exit(2); }
if (existsSync(fJson)) { console.log(`${id}: já migrado (${path.basename(fJson)})`); process.exit(0); }

// Retrato em processo separado (cada chamada carrega os módulos do zero, sem cache).
function snapshot() {
  const code = `
    const base = ${JSON.stringify(pathToFileURL(path.join(root, 'prototypes/combat-lab/src/sim') + '/').href)};
    const {ficha} = await import(base + 'moves/${id}.js');
    const {params} = await import(base + 'moves/${id}.params.js');
    const {factoryDefaults} = await import(base + 'config.js');
    const {registerStandardMoves} = await import(base + 'moves/standard.js');
    const Moves = await import(base + 'moves.js');
    registerStandardMoves();
    const def = ficha.def;
    const snap = {def, frozen: Object.isFrozen(def), params, fichaKeys: Object.keys(ficha).sort(), effects: ['effect','tackle'].filter(k => ficha[k]).map(k => [k, ficha[k][0]]).concat((ficha.hooks ?? []).map(h => ['hook', h[0]]), (ficha.steps ?? []).map(h => ['step', h[0]]), (ficha.effects ?? []).map(h => ['effects', h[0]])), world: factoryDefaults().world[params.group], effective: Moves.getMove(def.id), ai: ficha.ai ?? null};
    const text = JSON.stringify(snap, (k, v) => typeof v === 'function' ? '[fn:' + (v.name || 'anon') + ']' : v === Infinity ? '[Infinity]' : v === -Infinity ? '[-Infinity]' : (typeof v === 'number' && Number.isNaN(v)) ? '[NaN]' : v, 1);
    process.stdout.write(text);`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], {encoding: 'utf8', cwd: root, maxBuffer: 64 * 1024 * 1024});
  if (r.status !== 0) throw new Error('retrato falhou: ' + (r.stderr || '').split('\n').filter(Boolean).slice(-3).join(' | '));
  return r.stdout;
}
const hash = t => createHash('sha1').update(t).digest('hex').slice(0, 10);
const revert = () => spawnSync('git', ['checkout', '--', path.relative(root, fJs), path.relative(root, fParams)], {cwd: root});
const fail = msg => { if (process.env.DEBUG_MIGRA) { console.log('DEBUG: ' + msg); process.exit(1); } revert(); try { if (existsSync(fJson)) unlinkSync(fJson); } catch {} console.log(`✗ ${id}: ${msg}`); process.exit(1); };

const before = snapshot();
const snapB = JSON.parse(before);
if (/\[fn:|\[Infinity\]|\[NaN\]/.test(JSON.stringify({def: snapB.def, params: snapB.params}))) fail('a definição ou os parâmetros têm função/Infinity/NaN (não cabem em JSON); fica em código');

// Dados
const def = snapB.def;
const rows = snapB.params.rows.map(({approved, ...r}) => approved ? {...r, approved: true} : r);
// linhas do tremor de câmera (preset hitShake) quando as 3 últimas são exatamente as do preset
const hsKeys = ['hitShakeOn', 'hitShakeAmount', 'hitShakeDuration'];
const tail = rows.slice(-3).map(r => r.key);
let outRows = rows;
if (hsKeys.every((k, i) => tail[i] === k)) outRows = [...rows.slice(0, -3), {preset: 'hitShake'}];
const doc = {schemaVersion: 1, def, params: {group: snapB.params.group, title: snapB.params.title, ...(snapB.params.hint !== undefined ? {hint: snapB.params.hint} : {}), ...(snapB.params.meta ? {meta: snapB.params.meta} : {}), rows: outRows}};
const visualGuess = {'sand-wave': {atelier: 'sand', variant: 'C'}, 'emerging-stone': {atelier: 'stone', variant: 'A'}, swift: {atelier: 'swift', variant: 'A'}}[id];
if (visualGuess) doc.visual = visualGuess;

// Reescreve params.js e <id>.js
const srcParams = readFileSync(fParams, 'utf8').replace(/\r\n/g, '\n');
const astP = parse(srcParams, {ecmaVersion: 'latest', sourceType: 'module'});
const firstImp = astP.body.find(s => s.type === 'ImportDeclaration');
let head = srcParams.slice(0, firstImp ? firstImp.start : 0).trimEnd();
head += `\n// (Move como dado) Os parâmetros e a definição vêm de ${id}.move.json: edite lá ou no Editor de Moves.\n`;
const newParams = head + `import {loadMoveData} from './move-data.js';\nimport data from './${id}.move.json' with {type: 'json'};\n\nconst loaded = loadMoveData(data);\nexport const params = loaded.params;\n/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */\nexport const def = loaded.def;\n/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */\nexport const visual = loaded.visual;\n`;

const srcJs = readFileSync(fJs, 'utf8'), crlf = srcJs.includes('\r\n'), js = srcJs.replace(/\r\n/g, '\n');
const astJ = parse(js, {ecmaVersion: 'latest', sourceType: 'module'});
// a declaração `export const <name> = Object.freeze({...})` cujo valor é a definição (ficha.def aponta para ela)
const fichaDecl = astJ.body.find(s => s.type === 'ExportNamedDeclaration' && s.declaration?.type === 'VariableDeclaration' && s.declaration.declarations.some(d => d.id.name === 'ficha'));
const defRef = fichaDecl && fichaDecl.declaration.declarations[0].init.arguments?.[0]?.properties?.find(p => p.key?.name === 'def')?.value;
if (!defRef || defRef.type !== 'Identifier') fail('não achei `def: <identificador>` na ficha');
const defDecl = astJ.body.find(s => (s.type === 'ExportNamedDeclaration' ? s.declaration : s)?.type === 'VariableDeclaration' && (s.type === 'ExportNamedDeclaration' ? s.declaration : s).declarations.some(d => d.id.name === defRef.name));
if (!defDecl) fail(`não achei a declaração de ${defRef.name}`);
const exported = defDecl.type === 'ExportNamedDeclaration';
// comentário imediatamente anterior fica no lugar; só o statement é trocado
let newJs = js.slice(0, defDecl.start) + (exported ? `export {${defRef.name}};   // definição (id, fases, custo…) vem de ${id}.move.json\n` : `const ${defRef.name} = ${defRef.name}Data;\n`) + js.slice(defDecl.end).replace(/^\n/, '');
const impP = astJ.body.find(s => s.type === 'ImportDeclaration' && /\.params\.js$/.test(s.source.value));
if (!impP) fail('não achei o import de ./<id>.params.js');
const impText = js.slice(impP.start, impP.end);
const names = impP.specifiers.map(s => s.local.name);
if (!names.includes('params')) fail('o import de params.js não traz `params`');
newJs = newJs.replace(impText, exported ? `import {params, def as ${defRef.name}} from './${id}.params.js';` : `import {params, def as ${defRef.name}Data} from './${id}.params.js';`);
const uses = () => (exported ? true : true);
if (dry) { console.log(`[seco] ${id}: ${rows.length} linhas (${outRows.length} no JSON), def ${Object.keys(def).length} chaves`); process.exit(0); }

writeFileSync(fJson, JSON.stringify(doc, null, 2) + '\n');
writeFileSync(fParams, newParams);
writeFileSync(fJs, crlf ? newJs.replace(/\n/g, '\r\n') : newJs);
let after;
try { after = snapshot(); } catch (e) { fail(String(e.message)); }
if (after !== before) {
  const a = JSON.parse(before), b = JSON.parse(after);
  const diffs = Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  fail(`o retrato mudou em: ${diffs.join(', ')}`);
}
console.log(`✓ ${id}: migrado (${rows.length} linhas, retrato ${hash(before)} idêntico)`);
