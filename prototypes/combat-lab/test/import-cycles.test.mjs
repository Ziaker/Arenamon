// Orçamento de ciclos de importação da simulação: o número só pode CAIR. Se este teste falhar por ter AUMENTADO, o último import criou um ciclo
// (veja com: node scripts/ciclos.mjs prototypes/combat-lab/src/sim/game.js). Se caiu, abaixe CYCLE_BUDGET.
// Uso: node prototypes/combat-lab/test/import-cycles.test.mjs
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

const CYCLE_BUDGET = 24;
const entry = fileURLToPath(new URL('../src/sim/game.js', import.meta.url));
const r = await build({entryPoints: [entry], bundle: true, write: false, metafile: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent', outdir: 'out'});
const g = new Map(Object.entries(r.metafile.inputs).map(([k, v]) => [k, v.imports.filter(i => !i.external).map(i => i.path)]));
const state = new Map(), stack = [], seen = new Set();
function dfs(n) {
  state.set(n, 1);stack.push(n);
  for (const m of g.get(n) ?? []) {
    if (state.get(m) === 1) seen.add(stack.slice(stack.indexOf(m)).sort().join('|'));
    else if (!state.has(m)) dfs(m);
  }
  stack.pop();state.set(n, 2);
}
for (const n of g.keys()) if (!state.has(n)) dfs(n);
console.log(`ciclos de importação na simulação: ${seen.size} (orçamento ${CYCLE_BUDGET})`);
assert.ok(seen.size <= CYCLE_BUDGET, `a simulação ganhou ciclos de importação: ${seen.size} > ${CYCLE_BUDGET}`);
if (seen.size < CYCLE_BUDGET) console.log('  (abaixo do orçamento: reduza CYCLE_BUDGET para travar o ganho)');
