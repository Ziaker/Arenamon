// Gera prototypes/combat-lab/src/sim/calibration-base.js a partir de um export «arenamon-tuning» do laboratório (trilha de auditoria da base de calibração).
// Regra (3ª exportação, 28/10/2026): cada folha de `values` (número, texto, booleano, null ou array/objeto comparado por valor) é comparada com factoryDefaults():
//  (a) difere da fábrica → linha [caminho, valor do JSON, valor de fábrica]; (b) igual à fábrica → sem linha (a linha antiga do mesmo caminho cai: o export a
//  sobrescreve); (c) caminho do JSON que não existe na fábrica → NÃO é inventado, só listado («ignorado pelo código atual»); (d) linha antiga cujo caminho
//  não aparece no JSON → MANTIDA (o export não disse nada sobre ela).
// Uso: node scripts/gen-calibration-base.mjs [json] [--escrever] [--relatorio]
//   sem --escrever só imprime o resumo; --escrever regrava calibration-base.js; --relatorio imprime as listas completas em Markdown.
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {factoryDefaults, ROOT_KEYS} from '../prototypes/combat-lab/src/sim/config.js';
import {CALIBRATION_BASE} from '../prototypes/combat-lab/src/sim/calibration-base.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2), jsonPath = args.find(a => !a.startsWith('--')) ?? ROOT + 'docs/calibracao/arenamon-calibracao-v8-2026-10-28.json';
const OUT = ROOT + 'prototypes/combat-lab/src/sim/calibration-base.js';
const data = JSON.parse(readFileSync(jsonPath, 'utf8')), values = data.values ?? data, fac = factoryDefaults();

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
/** Folhas do JSON: tudo que não é objeto simples (arrays e null são folhas inteiras). */
function leaves(o, p = '', out = new Map()) {
  for (const [k, v] of Object.entries(o)) {const q = p ? p + '.' + k : k;if (isObj(v)) leaves(v, q, out);else out.set(q, v);}
  return out;
}
const lookup = (o, path) => {let a = o;for (const k of path.split('.')) {if (!isObj(a) && !Array.isArray(a)) return {found: false};if (!(k in a)) return {found: false};a = a[k];}return {found: true, value: a};};
// Números: tolerância relativa 1e-12 (só ruído de ponto flutuante, ex.: múltiplos de π); o valor gravado é sempre o do JSON, com precisão total.
const sameNum = (a, b) => a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b)));
const same = (a, b) => (typeof a === 'number' || typeof b === 'number') ? sameNum(a, b) : isDeepStrictEqual(a, b);

const L = leaves(values), oldByPath = new Map(CALIBRATION_BASE.map(r => [r[0], r]));
const rows = [], ignored = [], kept = [], dropped = [], changed = [], added = [], unchanged = [], shapeMismatch = [];
for (const [path, v] of L) {
  const f = lookup(fac, path);
  if (!f.found) {ignored.push([path, v]);continue;}
  if (isObj(f.value)) {shapeMismatch.push([path, v, 'fábrica é objeto']);ignored.push([path, v]);continue;}
  const old = oldByPath.get(path);
  if (same(v, f.value)) {if (old) dropped.push([path, old[1], f.value]);continue;}
  const row = [path, v, f.value];rows.push(row);
  if (!old) added.push(row);else if (same(old[1], v)) unchanged.push(row);else changed.push([path, old[1], v, f.value]);
}
// Linhas antigas cujo caminho o JSON não traz: mantidas (o export não disse nada sobre elas).
for (const old of CALIBRATION_BASE) if (!L.has(old[0]) && ![...L.keys()].some(k => old[0].startsWith(k + '.'))) {kept.push(old);rows.push([old[0], old[1], lookup(fac, old[0]).value]);}
// Caminhos da fábrica ausentes no JSON (criados depois do export): ficam no valor de fábrica — só contados.
const facLeaves = leaves(Object.fromEntries(ROOT_KEYS.map(k => [k, fac[k]]))), absentInJson = [...facLeaves.keys()].filter(k => !L.has(k));

// Agrupamento: ordem de ROOT_KEYS; `extras.*` agrupado por segundo nível (como antes); as mantidas vão no fim, num grupo próprio.
const keptSet = new Set(kept.map(r => r[0]));
const groupOf = p => {const s = p.split('.');return s[0] === 'extras' || s[0] === 'vfx' && s[1] === 'elemental' ? s.slice(0, 2).join('.') : s[0];};
const order = p => ROOT_KEYS.indexOf(p.split('.')[0]);
const main = rows.filter(r => !keptSet.has(r[0])).map((r, i) => ({r, i})).sort((a, b) => order(a.r[0]) - order(b.r[0]) || a.i - b.i).map(x => x.r);
const fmt = v => JSON.stringify(v);
function render() {
  const src = readFileSync(OUT, 'utf8'), eol = src.includes('\r\n') ? '\r\n' : '\n', out = [], header = src.split(/\r?\n/);
  let lines = [], g = null;
  for (const r of main) {const k = groupOf(r[0]);if (k !== g) {lines.push(`  // ${k}`);g = k;}lines.push(`  [${fmt(r[0])}, ${fmt(r[1])}, ${fmt(r[2])}],`);}
  if (kept.length) {lines.push('  // mantidas da base anterior: caminhos que o export de 28/10/2026 não traz (o export não disse nada sobre eles)');for (const r of kept) lines.push(`  [${fmt(r[0])}, ${fmt(r[1])}, ${fmt(lookup(fac, r[0]).value)}],`);}
  const start = header.findIndex(l => l.startsWith('export const CALIBRATION_BASE'));
  const end = header.findIndex((l, i) => i > start && l === '];');
  out.push(...header.slice(0, start + 1), ...lines, ...header.slice(end));
  return out.join(eol);
}

console.log(`JSON: ${jsonPath} (criado ${data.createdAt ?? '?'})`);
console.log(`folhas no JSON: ${L.size} · linhas na nova tabela: ${rows.length} (antes ${CALIBRATION_BASE.length})`);
console.log(`trocadas (valor diferente da base anterior): ${changed.length} · acrescentadas: ${added.length} · mesmas da base anterior: ${unchanged.length} · retiradas (JSON = fábrica): ${dropped.length} · mantidas (ausentes no JSON): ${kept.length} · ignoradas (caminho inexistente no código): ${ignored.length} · caminhos do código ausentes no JSON: ${absentInJson.length}`);
if (shapeMismatch.length) console.log('formato diferente (ignoradas):', shapeMismatch);
if (args.includes('--relatorio')) {
  const t = v => '`' + fmt(v) + '`';
  console.log('\n### Trocadas (caminho · base anterior → nova · fábrica)');for (const [p, o, n, f] of changed) console.log(`| \`${p}\` | ${t(o)} | ${t(n)} | ${t(f)} |`);
  console.log('\n### Acrescentadas (caminho · nova · fábrica)');for (const [p, n, f] of added) console.log(`| \`${p}\` | ${t(n)} | ${t(f)} |`);
  console.log('\n### Retiradas (caminho · base anterior · fábrica = JSON)');for (const [p, o, f] of dropped) console.log(`| \`${p}\` | ${t(o)} | ${t(f)} |`);
  console.log('\n### Mantidas (ausentes no JSON)');for (const [p, n, f] of kept) console.log(`| \`${p}\` | ${t(n)} | ${t(f)} |`);
  console.log('\n### Ignoradas pelo código atual');for (const [p, v] of ignored) console.log(`| \`${p}\` | ${t(v)} |`);
  console.log('\n### Não numéricas na tabela');for (const r of rows.filter(r => typeof r[1] !== 'number')) console.log(`| \`${r[0]}\` | ${t(r[1])} | ${t(r[2])} |`);
}
if (args.includes('--escrever')) {writeFileSync(OUT, render());console.log(`escrito: ${OUT}`);}
