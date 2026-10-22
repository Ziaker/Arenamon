// @ts-check
// Navegação (Yuka) na IA, medida IA × IA com sementes fixas (ver docs/ia/NAV_IA_MEDICAO.md): (1) com paredes entre os lutadores a IA comum quase nunca chega ao rival e
// a navegação faz as lutas acontecerem; (2) o custo de salto/queda (padrão 6×) evita que a IA suba em tudo e despenque; (3) desligada, nada muda.
// Este teste caracteriza a mecânica nos valores de FÁBRICA do laboratório (factoryDefaults); a base de calibração v8 é coberta por calibration-base.test.mjs e pelos testes de colisão/ambiente.
import assert from 'node:assert/strict';
import {C, factoryDefaults, resetConfig} from '../src/sim/config.js';
import {evalSeries, evalMatch} from '../src/sim/ai-eval.js';
import {NAV_SCENARIOS} from '../src/nav/nav-scenarios.js';
import {clearNavCache} from '../src/nav/nav-graph.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let passed = 0, failed = 0;
function test(name, fn) {try {fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}}
const fresh = () => {resetConfig(factoryDefaults());C.map.arenaShape = 'square';clearNavCache();};
const mapOf = id => {
  const S = NAV_SCENARIOS[id];
  return {
    initialPositions: [{x: S.target.x, z: S.target.z}, {x: S.chaser.x, z: S.chaser.z}],
    scenarioSetup: g => {const m = g.mapState;m.obstacles = structuredClone(S.obstacles);m.platforms = structuredClone(S.platforms);m.destructibles = [];m.navBlocked = structuredClone(S.blocked ?? []);m.items = [];m.regularSpawnTimer = 1e9;},
  };
};

console.log('\n--- NAVEGAÇÃO NA IA (IA × IA) ---\n');
test('desligada por padrão: avaliar sem pedir navegação é idêntico a pedir "nenhum lado"', () => {
  fresh();assert.equal(C.extras.nav.enableNav, 0);
  const a = evalMatch({seed: 5, maxSeconds: 20}), b = evalMatch({seed: 5, maxSeconds: 20, nav: [false, false]});
  assert.deepEqual(a.sides.map(s => [s.wins, s.hits, s.damage]), b.sides.map(s => [s.wins, s.hits, s.damage]));
});
test('padrão do custo de salto e queda é 6× (menos quedas, mesma força)', () => {
  fresh();assert.equal(C.extras.nav.jumpPenalty, 6);assert.equal(C.extras.nav.dropPenalty, 6);
});
test('com paredes (muro e rotas) a IA comum quase nunca encontra o rival; com navegação as lutas acontecem', () => {
  for (const id of ['muro', 'rotas']) {
    fresh();const m = mapOf(id);
    const plain = evalSeries({matches: 20, seed: 1, nav: [false, false], maxSeconds: 60, ...m}), nav = evalSeries({matches: 20, seed: 1, nav: [true, true], maxSeconds: 60, ...m});
    assert.ok(plain.timeouts >= 14, `${id}: sem navegação ${plain.timeouts}/20 sem desfecho`);
    assert.ok(nav.timeouts <= 8, `${id}: com navegação ${nav.timeouts}/20 sem desfecho`);
  }
});
test('o custo de salto/queda reduz as quedas do lado que navega (mapa padrão e plataformas)', () => {
  for (const id of ['plataforma']) {
    fresh();const m = mapOf(id);
    const falls = pen => evalSeries({matches: 30, seed: 1, nav: [true, false], maxSeconds: 60, ...m, values: {'extras.nav.jumpPenalty': pen, 'extras.nav.dropPenalty': pen}}).sides[0].edgeFalls;
    const loose = falls(1), tight = falls(6);
    assert.ok(tight < loose * .5, `${id}: quedas ${tight} (6×) contra ${loose} (1×)`);
  }
});
test('a navegação não deixa o lado que navega pior que o adversário no mapa padrão (dentro do ruído)', () => {
  fresh();
  const run = nav => evalSeries({matches: 60, seed: 1, nav, maxSeconds: 60});
  const a = run([true, false]), b = run([false, true]);
  const wins = a.sides[0].wins + b.sides[1].wins, losses = a.sides[1].wins + b.sides[0].wins, n = a.matches + b.matches;
  assert.ok(wins >= losses - 3 * Math.sqrt(n * .25) , `com navegação ${wins} vitórias × sem ${losses} em ${n}`);
});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
