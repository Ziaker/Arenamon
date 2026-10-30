// Critério POR EXECUÇÃO (adendo, itens 9 e 10) com Wookada e Cogumelo reais: nenhuma execução cortada indevidamente, nenhuma aprovada
// com ≤ 4 quadros, velocidade da conclusão visual igual à configurada, e o empurrão («pushed», clipe «hit») concluindo depois do fim
// mecânico (antes era cortado com 34–70 % do clipe). Mesmos cenários da matriz (≈ 12 s, sem benchmark).
// Uso: node prototypes/combat-lab/test/animation-execution-report.test.mjs
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {runAll} from './animation-runtime-matrix.mjs';
import {loadConfiguredSource, setupRegistry} from './animation-runtime-harness.mjs';
import {executionRows, orphanClips} from './animation-execution-report.mjs';
import {Character} from '../src/view/characters.js';

setupRegistry();
const p = f => fileURLToPath(new URL('../../../chars/' + f, import.meta.url));
const w = await loadConfiguredSource(p('wookada/wookada.glb'), 'wookada.glb'), c = await loadConfiguredSource(p('mosh/Cogumelo.glb'), 'Cogumelo.glb');
let n = 0;const ok = l => {n++;console.log('✓', l);};
for (const [name, src, other] of [['Wookada', w, c], ['Cogumelo', c, w]]) {
  const ch = new Character(src, {persist: true}), rows = executionRows(name, ch, runAll([src, other]), 0).filter(r => r.classificacao !== 'SEM_CLIPE');
  const cut = rows.filter(r => r.classificacao === 'CORTADA_INDEVIDAMENTE');
  assert.equal(cut.length, 0, `${name}: execuções cortadas indevidamente: ${cut.map(r => `${r.acao}/${r.chave} ${r.tocado} (${r.motivo})`).join('; ')}`);
  ok(`${name}: ${rows.length} execuções, nenhuma cortada indevidamente`);
  const tiny = rows.filter(r => r.aprovada === 'sim' && r.frames <= 4);
  assert.equal(tiny.length, 0, `${name}: aprovadas com ≤ 4 quadros: ${tiny.map(r => r.acao).join(', ')}`);
  ok(`${name}: nenhuma execução aprovada com 4 quadros ou menos`);
  const slow = rows.filter(r => r.velocidade.startsWith('NÃO'));
  assert.equal(slow.length, 0, `${name}: velocidade na conclusão visual ≠ configurada: ${slow.map(r => `${r.acao} ${r.velocidade}`).join('; ')}`);
  ok(`${name}: velocidade medida na conclusão visual = velocidade configurada no Editor`);
  const pushed = rows.filter(r => r.chave === 'pushed');
  assert.ok(pushed.length && pushed.some(r => r.classificacao === 'CONCLUIDA_NATURALMENTE' && r.liberacao !== '—'), `${name}: empurrão conclui em conclusão visual`);
  ok(`${name}: empurrão («${pushed[0].clipe}») segue tocando depois do fim mecânico até o fim (${pushed.filter(r => r.classificacao === 'CONCLUIDA_NATURALMENTE').length}/${pushed.length} execuções)`);
  assert.ok(Array.isArray(orphanClips(ch)), 'lista de clipes sem associação');
}
console.log(`\n${n} verificações do relatório por execução aprovadas.`);
process.exit(0);
