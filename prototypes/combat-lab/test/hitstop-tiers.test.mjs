// @ts-check
// Hitstop por faixa de importância (skill game-feel): golpe forte congela mais que golpe fraco; padrão = hitstop fixo de antes.
import assert from 'node:assert/strict';
import {C, factoryDefaults as defaults, resetConfig} from '../src/sim/config.js';   // caracteriza a mecânica nos valores de FÁBRICA; a base de calibração v8 é coberta por calibration-base.test.mjs
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let passed = 0, failed = 0;
function test(name, fn) {try {fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}}
console.log('\n--- HITSTOP POR DANO ---\n');

/** Tackle do azul contra o vermelho parado, com o ataque do azul em `attack`; devolve {hitstop, damage} no passo do impacto. */
function impact(attack, tweak = null) {
  resetConfig(defaults());C.extras.toggles.enableEnemyAI = 0;tweak?.(C);
  const g = new Game({seed: 3});g.start();
  g.mapState.obstacles = [];g.mapState.platforms = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
  const [a, b] = g.fighters;
  a.attributes.attack = attack;
  a.position = vec(0, 0);a.velocity = vec();a.groundY = 0;b.position = vec(0, 3);b.velocity = vec();b.groundY = 0;
  for (let t = 0; t < 120; t++) {
    g.step({...emptyCommand(), tackle: t === 0, move: vec(0, 1)}, emptyCommand());
    const ev = g.lastStepEvents.find(e => e.result === 'impact');
    if (ev) return {hitstop: g.hitstop, damage: ev.damage};
  }
  return null;
}

test('padrão: hitstop fixo (impactHitstop) independente do dano, como antes', () => {
  resetConfig(defaults());assert.equal(C.extras.combat.hitstopDamageBoost, 0);
  const weak = impact(10), strong = impact(60);
  assert.ok(weak && strong && strong.damage > weak.damage);
  assert.equal(weak.hitstop, C.extras.combat.impactHitstop);assert.equal(strong.hitstop, C.extras.combat.impactHitstop);
});
test('com acréscimo: golpe forte congela mais que golpe fraco, limitado a (1 + boost)×', () => {
  const on = c => {c.extras.combat.hitstopDamageBoost = 1;};
  const weak = impact(5, on), strong = impact(80, on), base = C.extras.combat.impactHitstop;
  assert.ok(weak.hitstop >= base && weak.hitstop < strong.hitstop, `${weak.hitstop} < ${strong.hitstop}`);
  assert.ok(Math.abs(strong.hitstop - base * 2) < 1e-9, `golpe acima da referência = 2× (${strong.hitstop})`);
});
test('o dano de referência desloca a faixa (referência maior → golpe médio congela menos)', () => {
  const mid = c => {c.extras.combat.hitstopDamageBoost = 1;c.extras.combat.hitstopDamageRef = 30;}, high = c => {c.extras.combat.hitstopDamageBoost = 1;c.extras.combat.hitstopDamageRef = 90;};
  assert.ok(impact(30, mid).hitstop > impact(30, high).hitstop);
});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
