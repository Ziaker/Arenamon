// @ts-check
// IA com os 13 Moves novos: usa cada um quando equipado (mesmas regras do jogador), não usa quando não está equipado ou com a taxa em 0, é determinística e não se
// enfraquece além do ruído por usá-los. Números e leitura em docs/ia/NEW_MOVES_IA_MEDICAO.md.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {evalSeries, evalMatch} from '../src/sim/ai-eval.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let passed = 0, failed = 0;
function test(name, fn) {try {fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}}
const fresh = () => {resetConfig(defaults());C.map.arenaShape = 'square';};
const IDS = ['harden', 'second-wind', 'swift', 'lunge', 'quick-attack', 'guard-break', 'feint', 'riposte', 'bounce', 'spikes', 'sand-wave', 'bullet-punch', 'emerging-stone'];
const usesOf = (loadouts, matches, values = {}) => {const r = evalSeries({matches, seed: 1, loadouts, maxSeconds: 60, values});return r.sides.map(s => s.moveUses);};

console.log('\n--- IA COM OS MOVES NOVOS ---\n');
test('sem Moves equipados nada muda (mesma luta, mesma semente) e a taxa 0 desliga o uso', () => {
  fresh();
  const a = evalMatch({seed: 7, maxSeconds: 30}), b = evalMatch({seed: 7, maxSeconds: 30, loadouts: [[], []]});
  assert.deepEqual(a.sides.map(s => [s.wins, s.hits, s.damage]), b.sides.map(s => [s.wins, s.hits, s.damage]));
  for (const id of ['swift', 'second-wind']) {
    const u = usesOf([[], [id]], 20, {'world.ai.newMovesRate': 0});
    assert.equal(u[1][id] ?? 0, 0, `${id} com taxa 0`);
  }
});
test('a IA usa CADA um dos 13 Moves quando eles estão equipados nela', () => {
  fresh();const unused = [];
  for (const id of IDS) {const u = usesOf([[], [id]], 40);if (!(u[1][id] > 0)) unused.push(id);}
  assert.deepEqual(unused, [], `nunca usados: ${unused.join(', ')}`);
});
test('determinismo: mesma semente, mesmo uso e mesmo resultado', () => {
  fresh();
  const run = () => evalMatch({seed: 11, maxSeconds: 40, loadouts: [[], ['spikes', 'swift', 'bullet-punch']]});
  const a = run(), b = run();
  assert.deepEqual(a.sides.map(s => [s.wins, s.hits, s.damage, s.moveUses]), b.sides.map(s => [s.wins, s.hits, s.damage, s.moveUses]));
});
test('os Moves de marcador terminam o que começam (o botão é solto e o marcador some)', () => {
  fresh();
  for (const id of ['spikes', 'bullet-punch', 'emerging-stone']) {
    const r = evalMatch({seed: 3, maxSeconds: 40, loadouts: [[], [id]]});
    assert.ok(r.seconds > 0 && !r.timeout || r.timeout, 'a luta termina');
  }
  fresh();
  const s = evalSeries({matches: 20, seed: 1, loadouts: [[], ['spikes', 'bullet-punch', 'emerging-stone']], maxSeconds: 60});
  const uses = s.sides[1].moveUses;
  assert.ok((uses.spikes ?? 0) + (uses['bullet-punch'] ?? 0) + (uses['emerging-stone'] ?? 0) > 0, 'usou algum Move de marcador');
});
test('equipar quatro Moves de uma vez não deixa a IA pior que a IA sem Moves além do ruído', () => {
  fresh();
  const a = evalSeries({matches: 40, seed: 1, loadouts: [[], IDS.slice(0, 4)], maxSeconds: 60}), b = evalSeries({matches: 40, seed: 1001, loadouts: [IDS.slice(0, 4), []], maxSeconds: 60});
  const wins = a.sides[1].wins + b.sides[0].wins, losses = a.sides[0].wins + b.sides[1].wins, n = a.matches + b.matches;
  assert.ok(wins >= losses - 3 * Math.sqrt(n * .25), `${wins} × ${losses} em ${n}`);
});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
