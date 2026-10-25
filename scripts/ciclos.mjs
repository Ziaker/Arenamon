// Acha ciclos de importação a partir de um ponto de entrada (usa o grafo do esbuild).
//   node scripts/ciclos.mjs <entrada.js> [--max N]
import {build} from 'esbuild';
import path from 'node:path';
const entry = process.argv[2], max = Number(process.argv[process.argv.indexOf('--max') + 1]) || 15;
const r = await build({entryPoints: [entry], bundle: true, write: false, metafile: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent', outdir: 'out'});
const g = new Map(Object.entries(r.metafile.inputs).map(([k, v]) => [k, v.imports.filter(i => !i.external).map(i => i.path)]));
const state = new Map(), stack = [], cycles = [], seen = new Set();
function dfs(n) {
  state.set(n, 1); stack.push(n);
  for (const m of g.get(n) ?? []) {
    if (state.get(m) === 1) { const c = stack.slice(stack.indexOf(m)).concat(m); const key = [...c].sort().join('|'); if (!seen.has(key)) {seen.add(key); cycles.push(c);} }
    else if (!state.has(m)) dfs(m);
  }
  stack.pop(); state.set(n, 2);
}
for (const n of g.keys()) if (!state.has(n)) dfs(n);
const short = p => p.replace(/^.*?combat-lab\/src\//, '');
cycles.sort((a, b) => a.length - b.length);
console.log(`${cycles.length} ciclo(s) de importação`);
for (const c of cycles.slice(0, max)) console.log('  ' + c.map(short).join(' → '));
process.exit(0);
