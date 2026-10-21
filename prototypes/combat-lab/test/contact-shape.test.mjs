// @ts-check
// Pegada do contato lutador × lutador (test.contactShape): o legado quadrado dá ao tackle mais alcance nas diagonais e normais
// alinhadas aos eixos; a pegada circular iguala o alcance em todos os ângulos e põe a normal na linha dos centros.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {overlap} from '../src/sim/physics.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let passed = 0, failed = 0;
function test(name, fn) {try {fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}}
console.log('\n--- PEGADA DO CONTATO (quadrada × circular) ---\n');

/** Tackle do azul em (0,0) contra o vermelho parado a distância d e ângulo th; devolve o impacto (ou null). */
function trial(shape, th, d) {
  resetConfig(defaults());C.extras.toggles.enableEnemyAI = 0;C.test.contactShape = shape;
  const g = new Game({seed: 3});g.start();
  g.mapState.obstacles = [];g.mapState.platforms = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
  const [a, b] = g.fighters, mv = vec(Math.sin(th), Math.cos(th));
  a.position = vec(0, 0);a.velocity = vec();a.groundY = 0;b.position = vec(Math.sin(th) * d, Math.cos(th) * d);b.velocity = vec();b.groundY = 0;
  for (let t = 0; t < 240; t++) {
    g.step({...emptyCommand(), tackle: t === 0, move: mv}, emptyCommand());
    const ev = g.lastStepEvents.find(e => e.result === 'impact');
    if (ev) return {normal: ev.normal, dist: Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z)};
  }
  return null;
}
const reach = (shape, deg) => {let max = 0, info = null;for (let d = 1.2; d <= 9; d += .1) {const h = trial(shape, deg * Math.PI / 180, d);if (h) {max = d;info = h;}}return {max, info};};
const r0 = [0, 22.5, 45].map(a => reach(0, a)), r1 = [0, 22.5, 45].map(a => reach(1, a));
console.log(`      alcance do tackle (m) — quadrado: ${r0.map(r => r.max.toFixed(1)).join(' / ')} · circular: ${r1.map(r => r.max.toFixed(1)).join(' / ')} (0° / 22,5° / 45°)`);

test('legado quadrado: o alcance cresce nas diagonais (≥ 0,4 m a 45°) — o problema medido', () => assert.ok(r0[2].max - r0[0].max >= .4, `${r0.map(r => r.max)}`));
test('circular: o alcance é o mesmo em 0°, 22,5° e 45° (± 0,15 m)', () => assert.ok(Math.max(...r1.map(r => r.max)) - Math.min(...r1.map(r => r.max)) <= .15, `${r1.map(r => r.max)}`));
test('circular: o contato acontece com os centros a ~1 m em qualquer ângulo', () => {for (const r of r1) assert.ok(Math.abs(r.info.dist - 1) < .12, `${r.info.dist}`);});
test('circular: a normal do golpe a 45° é a linha dos centros (0,71; 0,71), não o eixo', () => {
  assert.ok(Math.abs(r1[2].info.normal.x - Math.SQRT1_2) < .02 && Math.abs(r1[2].info.normal.z - Math.SQRT1_2) < .02, JSON.stringify(r1[2].info.normal));
  assert.ok(r0[2].info.normal.x === 0 || r0[2].info.normal.z === 0, 'o legado quantiza a normal');
});
test('alinhado a um eixo os dois modelos são idênticos (alcance e normal)', () => assert.ok(Math.abs(r0[0].max - r1[0].max) < 1e-9 && JSON.stringify(r0[0].info.normal) === JSON.stringify(r1[0].info.normal)));
test('overlap(): profundidade e normal coerentes (círculo) e simetria a ↔ b', () => {
  resetConfig(defaults());C.test.contactShape = 1;
  const A = {position: {x: 0, z: 0}}, B = {position: {x: .6, z: .6}}, ab = overlap(A, B), ba = overlap(B, A);
  assert.ok(Math.abs(ab.depth - (1 - Math.hypot(.6, .6))) < 1e-9);assert.ok(Math.abs(ab.normal.x + ba.normal.x) < 1e-9);
  assert.equal(overlap(A, {position: {x: 1.2, z: 0}}), null);
  assert.deepEqual(overlap(A, {position: {x: 0, z: 0}}).normal, {x: 1, z: 0});   // sobreposição exata: normal determinística
});
test('o padrão do jogo é a pegada circular e o interruptor volta ao legado', () => {resetConfig(defaults());assert.equal(C.test.contactShape, 1);C.test.contactShape = 0;assert.equal(C.test.contactShape, 0);});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
