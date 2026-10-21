// @ts-check
// Hitbox espacial do golpe (extras.hitbox): esfera à frente do atacante; por padrão desligada (comportamento anterior).
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {hitShapeOf, hitShapeAllows} from '../src/sim/combat.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let passed = 0, failed = 0;
function test(name, fn) {try {fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}}
console.log('\n--- HITBOX ESPACIAL DO GOLPE ---\n');

/** O atacante corre em +z; o defensor parado em (lateral, 3): o golpe passa raspando e conecta? */
function hits(lateral, setup) {
  resetConfig(defaults());C.extras.toggles.enableEnemyAI = 0;setup?.(C);
  const g = new Game({seed: 3});g.start();
  g.mapState.obstacles = [];g.mapState.platforms = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
  setup?.(C, g);
  const [a, b] = g.fighters;
  a.position = vec(0, 0);a.velocity = vec();a.groundY = 0;b.position = vec(lateral, 3);b.velocity = vec();b.groundY = 0;
  for (let t = 0; t < 120; t++) {
    g.step({...emptyCommand(), tackle: t === 0, move: vec(0, 1)}, emptyCommand());
    if (g.lastStepEvents.some(e => e.result === 'impact')) return true;
  }
  return false;
}
const on = (extra = null) => (c, g) => {c.extras.hitbox.enableShapes = 1;extra?.(c, g);};

test('desligado por padrão: o golpe conecta até raspar (lateral 0,95) como antes', () => {
  resetConfig(defaults());assert.equal(C.extras.hitbox.enableShapes, 0);
  for (const L of [0, .5, .9, .95]) assert.ok(hits(L), `lateral ${L}`);
  assert.ok(!hits(1.05));
});
test('ligado: o golpe frontal e o quase frontal conectam', () => {for (const L of [0, .4, .8]) assert.ok(hits(L, on()), `lateral ${L}`);});
test('ligado: o raspão lateral (arco além de ≈ ±63°) deixa de conectar — a esfera é mais estreita que o alinhamento antigo', () => {
  for (const L of [.92, .95]) {assert.ok(hits(L), `legado ${L}`);assert.ok(!hits(L, on()), `com esfera ${L}`);}
});
test('um raio maior devolve o raspão (o parâmetro tem efeito)', () => assert.ok(hits(.95, on(c => {c.extras.hitbox.shapeRadius = .8;}))));
test('forma própria da janela da animação vence o padrão (contract.shapes)', () => {
  const wide = on((c, g) => {c.extras.toggles.enableAnimationCombatWindows = 1;g?.setCombatWindows(0, {tackle: {activeWindows: [[0, 400]], shapes: [{forward: .6, radius: .9}]}});});
  assert.ok(hits(.95, wide), 'janela larga conecta o raspão');
  const narrow = on((c, g) => {c.extras.toggles.enableAnimationCombatWindows = 1;g?.setCombatWindows(0, {tackle: {activeWindows: [[0, 400]], shapes: [{forward: .6, radius: .2}]}});});
  assert.ok(!hits(.8, narrow), 'janela estreita não conecta nem 0,8');
});
test('hitShapeOf: null com as formas desligadas e para o meteor slam; geometria à frente do atacante', () => {
  resetConfig(defaults());
  const a = {position: {x: 1, z: 2}, action: {kind: 'tackle', heading: 0, elapsed: 0}};
  assert.equal(hitShapeOf(a), null);
  C.extras.hitbox.enableShapes = 1;
  const sh = hitShapeOf(a);assert.ok(Math.abs(sh.x - 1) < 1e-9 && Math.abs(sh.z - 2.6) < 1e-9 && sh.radius === .4);
  assert.equal(hitShapeOf({...a, action: {...a.action, slam: true}}), null);
  assert.ok(hitShapeAllows(a, {position: {x: 1, z: 3.4}}, 0));
  assert.ok(!hitShapeAllows(a, {position: {x: 2.5, z: 2}}, 0));
});
test('com as formas desligadas a partida de IA é determinística (mesma sequência de eventos em duas execuções)', () => {
  const run = flag => {resetConfig(defaults());C.extras.toggles.enableEnemyAI = 1;C.extras.hitbox.enableShapes = flag;const g = new Game({seed: 9});g.start();g.mode = 'tactical';const ev = [];for (let i = 0; i < 2400; i++) {g.step(emptyCommand());for (const e of g.lastStepEvents) ev.push(e.result + e.damage);}return ev.join(',');};
  assert.equal(run(0), run(0));
});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
