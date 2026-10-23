// @ts-check
// Interpolação de render: o desenho usa a pose entre o passo anterior e o atual; a simulação nunca é alterada.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {poseOf, lerpPose, applyInterpolation} from '../src/sim/interpolation.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let passed = 0, failed = 0;
function test(name, fn) {try {fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}}
console.log('\n--- INTERPOLAÇÃO DE RENDER ---\n');

const f = (x, z, gy = 0, fy = null) => ({position: {x, z}, groundY: gy, flight: fy === null ? null : {y: fy}, vaultHeight: 0});

test('ponto médio entre os passos (x, z, altura de piso e voo)', () => {
  const p = lerpPose(poseOf(f(0, 0, 0, 1)), poseOf(f(1, 1, 1, 3)), .5);
  assert.deepEqual([p.x, p.z, p.gy, p.fy], [.5, .5, .5, 2]);
});
test('alpha 0 → passo anterior, alpha 1 → passo atual (sem interpolar)', () => {
  const a = poseOf(f(0, 0)), b = poseOf(f(1, 0));
  assert.equal(lerpPose(a, b, 1), b);assert.equal(lerpPose(a, b, .25).x, .25);assert.equal(lerpPose(a, b, 0).x, 0);
});
test('teletransporte (> maxJump) não é suavizado: reinício, esquiva sobre o rival, spawn', () => {
  const a = poseOf(f(0, 0)), b = poseOf(f(10, 0));
  assert.equal(lerpPose(a, b, .5, 1.5), b);
  assert.equal(lerpPose(poseOf(f(0, 0, 0)), poseOf(f(0, 0, 3)), .5, 1.5).gy, 3);   // degrau vertical enorme também
});
test('voo: só interpola a altura quando os dois passos estão em voo', () => {
  assert.equal(lerpPose(poseOf(f(0, 0)), poseOf(f(.1, 0, 0, 2)), .5).fy, 2);
  assert.equal(lerpPose(poseOf(f(0, 0, 0, 1)), poseOf(f(.1, 0, 0, 3)), .5).fy, 2);
});
test('applyInterpolation altera o desenho e o restore devolve EXATAMENTE o estado da simulação (mesmos objetos)', () => {
  const fs = [f(1, 1, 0, 2), f(5, 5)], pos0 = fs.map(x => x.position), flight0 = fs.map(x => x.flight);
  const prev = [poseOf(f(0, 0, 0, 1)), poseOf(f(4, 4))];
  const restore = applyInterpolation(fs, prev, .5);
  assert.ok(restore);assert.deepEqual(fs[0].position, {x: .5, z: .5});assert.equal(fs[0].flight.y, 1.5);assert.deepEqual(fs[1].position, {x: 4.5, z: 4.5});
  restore();
  assert.deepEqual(fs.map(x => x.position), [{x: 1, z: 1}, {x: 5, z: 5}]);
  fs.forEach((x, i) => {assert.equal(x.position, pos0[i]);assert.equal(x.flight, flight0[i]);});
  assert.equal(fs[0].flight.y, 2);
});
test('sem pose anterior ou com alpha ≥ 1 não faz nada (devolve null)', () => {
  assert.equal(applyInterpolation([f(0, 0)], null, .5), null);assert.equal(applyInterpolation([f(0, 0)], [poseOf(f(0, 0))], 1), null);
});
test('Game registra a pose do passo anterior, limpa no reinício e no load, e não a inclui no save', () => {
  resetConfig(defaults());C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed: 1});g.start();
  assert.equal(g.prevPose, null);
  g.step(emptyCommand());
  const x0 = g.fighters[0].position.x, z0 = g.fighters[0].position.z;
  g.step({...emptyCommand(), move: {x: 0, z: 1}});g.step({...emptyCommand(), move: {x: 0, z: 1}});
  assert.equal(g.prevPose.length, 2);assert.ok(g.prevPose[0].z > z0 - 1e-9 && g.prevPose[0].z < g.fighters[0].position.z + 1e-9);
  assert.ok(!('prevPose' in g.save()));
  const snap = g.save();g.step(emptyCommand());g.load(snap);assert.equal(g.prevPose, null);
  g.reset();assert.equal(g.prevPose, null);
  void x0;
});
test('a simulação é idêntica com a interpolação ligada ou desligada (só o desenho muda)', () => {
  const run = flag => {
    resetConfig(defaults());C.display.interpolation.enabled = flag;
    const g = new Game({seed: 4});g.start();g.mode = 'tactical';
    for (let i = 0; i < 1500; i++) {
      g.step(emptyCommand());
      const restore = flag ? applyInterpolation(g.fighters, g.prevPose, .37, C.display.interpolation.maxJump) : null;
      restore?.();
    }
    return JSON.stringify(g.fighters.map(x => [x.position, x.hp, x.groundY]));
  };
  assert.equal(run(1), run(0));
});
test('o padrão é ligado e tem controle (enabled, maxJump)', () => {resetConfig(defaults());assert.equal(C.display.interpolation.enabled, 1);assert.equal(C.display.interpolation.maxJump, 1.5);});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
