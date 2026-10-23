// @ts-check
// Tunelamento de entidades finas (skill physics-tuning: "distância por passo < colisor mais fino"). A 120 Hz, 40 m/s = 0,33 m por passo;
// os subpassos de contato (test.contactStep = 0,1 m) devem impedir que lutadores, projéteis e barreiras se atravessem.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {spawn} from '../src/sim/world.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let passed = 0, failed = 0;
function test(name, fn) {try {fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}}
console.log('\n--- TUNELAMENTO DE ENTIDADES FINAS ---\n');

const fresh = (seed = 5, tweak = null) => {
  resetConfig(defaults());C.extras.toggles.enableEnemyAI = 0;tweak?.(C);
  const g = new Game({seed});g.start();
  g.mapState.obstacles = [];g.mapState.platforms = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
  const [a, b] = g.fighters;
  a.position = vec(0, 0);a.velocity = vec();a.groundY = 0;b.position = vec(-20, -20);b.velocity = vec();b.groundY = 0;
  return {g, a, b};
};

/** Lançado a `speed` m/s (+z) contra uma parede de espessura `thick` em z = 6. */
function launchAtWall(speed, thick, tweak = null) {
  const {g, a} = fresh(5, tweak);
  spawn(g.world, {kind: 'wall', pos: {x: 0, z: 6}, hx: 3, hz: thick / 2, angle: 0, y: 0, height: 3});
  a.flight = {y: .01, vy: 4, horizontal: vec(0, speed)};
  let maxZ = 0;
  for (let t = 0; t < 240; t++) {g.step(emptyCommand(), emptyCommand());maxZ = Math.max(maxZ, a.position.z);}
  return maxZ;
}
test('lançado a 40 m/s contra parede de 0,2 m: não atravessa (z ≤ parede − meia largura)', () => assert.ok(launchAtWall(40, .2) <= 6 - .1 - C.test.halfExtent + .01, `z=${launchAtWall(40, .2)}`));
test('lançado a 90 m/s (extremo) contra parede de 0,1 m: ainda não atravessa', () => assert.ok(launchAtWall(90, .1) <= 6 - .05 - C.test.halfExtent + .01));
test('a 200 m/s (1,67 m por passo, mais que a parede efetiva de 1,2 m) só os subpassos de contato seguram: padrão 0,1 m segura', () => assert.ok(launchAtWall(200, .2) <= 5.45));
test('…e com contactStep absurdo (3 m) o tunelamento REAPARECE — documenta o limite do parâmetro', () => {
  const z = launchAtWall(200, .2, c => {c.test.contactStep = 3;});
  assert.ok(z > 6, `esperava atravessar, z=${z}`);
});

/** Projétil a `speed` m/s em +z contra o alvo (box 1 × 1) parado em z = 6. */
function projectileAtFighter(speed, radius) {
  const {g, a, b} = fresh();
  b.position = vec(0, 6);b.groundY = 0;a.position = vec(10, 0);
  spawn(g.world, {kind: 'projectile', owner: 0, pos: {x: 0, z: 0}, angle: 0, speed, radius, y: .65, life: 3, hit: {damage: 10}});
  const hp0 = b.hp;
  for (let t = 0; t < 120; t++) g.step(emptyCommand(), emptyCommand());
  return b.hp < hp0;
}
test('projétil a 60 m/s (0,5 m por passo) atinge o lutador', () => assert.ok(projectileAtFighter(60, .25)));
test('projétil fino (raio 0,05 m) a 120 m/s ainda atinge o lutador', () => assert.ok(projectileAtFighter(120, .05)));

/** Projétil contra uma barreira fina (hz = 0,15) em z = 4 com um alvo atrás: a barreira deve barrar. */
function projectileAtBarrier(speed) {
  const {g, b} = fresh();
  b.position = vec(0, 8);b.groundY = 0;
  spawn(g.world, {kind: 'barrier', owner: 1, pos: {x: 0, z: 4}, angle: 0, hx: 1.5, hz: .1, y: 0, height: 2, life: 5});
  spawn(g.world, {kind: 'projectile', owner: 0, pos: {x: 0, z: 0}, angle: 0, speed, radius: .1, y: .65, life: 3, hit: {damage: 10}});
  const hp0 = b.hp;
  for (let t = 0; t < 120; t++) g.step(emptyCommand(), emptyCommand());
  return b.hp === hp0;
}
test('projétil a 80 m/s contra barreira de 0,2 m: a barreira barra (o alvo atrás não é atingido)', () => assert.ok(projectileAtBarrier(80)));
test('projétil a 150 m/s contra barreira de 0,2 m: a barreira barra', () => assert.ok(projectileAtBarrier(150)));

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
