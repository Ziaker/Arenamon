// F4 (Task 8): solver de sólidos estáticos com penetração residual MEDIDA e escape. Antes, sem posição válida (vão menor que o corpo), o
// settleStatics esgotava as rodadas, contava um conflito e aceitava a penetração em silêncio, passo após passo. Contrato agora:
// (1) a penetração que sobra é medida em metros (physicsProbe.staticResidualMax no passo, staticResidualPeak acumulado);
// (2) acima de `C.test.penetrationTolerance` (0,02 m) o lutador vai para a posição livre mais próxima (busca determinística em anéis,
//     só no plano horizontal: voo e altura intocados) e sai o evento pinEscape {target, from, to, depth};
// (3) quina/canto com espaço para o corpo converge sem escape (nenhum conflito).
// Também (carry-over da Task 7): destrutível preso sem posição de respawn registra a recusa UMA vez por ciclo morto, não a cada 1 s.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {spawn} from '../src/sim/world.js';
import {physicsProbe} from '../src/sim/physics.js';
import {staticPenetration} from '../src/sim/collision-probe.js';
import {stepMap} from '../src/sim/map.js';
import {validateCombatEvent} from '../src/sim/events/combat-event.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
const TOL = 0.02;
/** Partida parada, mapa vazio + os obstáculos dados; lutador 0 em `p0`, lutador 1 longe. */
function lab(obstacles, p0, cfg = () => {}) {
  resetConfig(defaults());cfg();
  const g = new Game();g.reset({positions: [p0, vec(-6, -6)]});g.mode = 'inactive';
  Object.assign(g.mapState, {platforms: [], destructibles: [], items: [], obstacles});
  return g;
}
const box = (id, x, z, hx, hz) => ({id, shape: 'box', pos: {x, y: 0, z}, hx, hz, radius: Math.max(hx, hz), height: 3, angle: 0});
const escapes = g => g.lastStepEvents.filter(e => e.result === 'pinEscape');

test('imprensado entre dois obstáculos (vão de 0,6 m): após 1 passo, pinEscape com profundidade medida e corpo fora dos sólidos', () => {
  const run = () => {
    const g = lab([box('a', -1.3, 0, 1, 2), box('b', 1.3, 0, 1, 2)], vec(0, 0)), A = g.fighters[0];
    const total0 = physicsProbe.staticConflictsTotal;
    g.step(emptyCommand(), emptyCommand());
    const ev = escapes(g);
    assert.equal(ev.length, 1, `${ev.length} pinEscape`);
    const e = ev[0];
    assert.equal(e.target, A.id);assert.ok(e.depth > TOL, `depth ${e.depth}`);
    assert.deepEqual(validateCombatEvent(e), []);assert.equal(e.sourceKind, 'system');
    assert.ok(physicsProbe.staticResidualMax > TOL, `staticResidualMax ${physicsProbe.staticResidualMax}`);
    assert.ok(physicsProbe.staticResidualPeak >= physicsProbe.staticResidualMax);
    assert.ok(physicsProbe.staticConflictsTotal > total0, 'o conflito continua contado');
    assert.ok(staticPenetration(A, g.world) <= 1e-6, `penetração ${staticPenetration(A, g.world)}`);
    assert.ok(Math.abs(e.to.x - A.position.x) < 1e-9 && Math.abs(e.to.z - A.position.z) < 1e-9, 'to = posição final');
    assert.ok(Math.hypot(e.to.x - e.from.x, e.to.z - e.from.z) <= 2.5 + 0.11, 'escape para a saída MAIS PRÓXIMA (fim do vão em z = ±2,5)');
    g.step(emptyCommand(), emptyCommand());
    assert.equal(escapes(g).length, 0, 'livre: não escapa de novo');assert.equal(physicsProbe.staticResidualMax, 0);
    return {x: A.position.x, z: A.position.z, e: {from: e.from, to: e.to, depth: e.depth}};
  };
  assert.deepEqual(run(), run(), 'determinístico');
});

test('imprensado entre obstáculo e a borda da arena: pinEscape e posição final dentro da arena e fora do obstáculo', () => {
  const g = lab([box('a', 8.4, 0, 1, 1)], vec(9.7, 0), () => {C.test.circleCap = 10;}), A = g.fighters[0];
  g.step(emptyCommand(), emptyCommand());
  const [e] = escapes(g);
  assert.ok(e, 'sem pinEscape');assert.ok(e.depth > TOL);
  assert.ok(staticPenetration(A, g.world) <= 1e-6, `penetração ${staticPenetration(A, g.world)}`);
  assert.ok(Math.hypot(A.position.x, A.position.z) <= 10 - C.test.halfExtent + 1e-9, 'fora da arena');
});

test('imprensado entre duas paredes de Move (vão 0,8 m): escape determinístico para a saída mais próxima, sem NaN', () => {
  const run = () => {
    const g = lab([], vec(.05, 0));
    for (const x of [-.55, .55]) spawn(g.world, {kind: 'wall', pos: vec(x, 0), hx: .15, hz: 4, y: 0, height: 2.2, blocksFighters: true}, []);
    const A = g.fighters[0], start = {...A.position};let n = 0;
    for (let t = 0; t < 60; t++) {g.step(emptyCommand(), emptyCommand());n += escapes(g).length;}
    assert.equal(n, 1, `${n} escapes`);
    assert.ok(staticPenetration(A, g.world) <= 1e-6);
    const moved = Math.hypot(A.position.x - start.x, A.position.z - start.z);
    assert.ok(Number.isFinite(moved) && moved <= 1.15 + 0.11, `deslocou ${moved.toFixed(3)} m (a saída mais próxima fica a 1,15 m)`);
    return {x: A.position.x, z: A.position.z};
  };
  assert.deepEqual(run(), run());
});

test('lutador NO AR imprensado: escape só horizontal (altura e velocidade vertical do voo iguais às de um voo livre)', () => {
  const fly = obstacles => {
    const g = lab(obstacles, vec(0, 0)), A = g.fighters[0];
    A.flight = {y: .5, vy: 1, horizontal: vec(), gravity: C.rules.launchGravity};A.state = 'airborne';
    g.step(emptyCommand(), emptyCommand());
    return {g, A, y: A.flight?.y, vy: A.flight?.vy};
  };
  const free = fly([]), pinned = fly([box('a', -1.3, 0, 1, 2), box('b', 1.3, 0, 1, 2)]);
  const [e] = escapes(pinned.g);
  assert.ok(e, 'sem pinEscape');assert.ok(pinned.A.flight, 'o voo acabou');
  assert.equal(pinned.y, free.y);assert.equal(pinned.vy, free.vy);
  assert.equal(e.from.y, e.to.y, 'escape mudou a altura');
  assert.ok(staticPenetration(pinned.A, pinned.g.world) <= 1e-6);
});

test('quina entre duas paredes: andar para o canto converge sem escape e sem conflito', () => {
  const g = lab([], vec(0, 0));
  spawn(g.world, {kind: 'wall', pos: vec(0, 3), hx: 6, hz: .15, y: 0, height: 3, blocksFighters: true}, []);
  spawn(g.world, {kind: 'wall', pos: vec(3, 0), hx: .15, hz: 6, y: 0, height: 3, blocksFighters: true}, []);
  const A = g.fighters[0], c0 = physicsProbe.staticConflictsTotal;let n = 0, worst = 0;
  for (let t = 0; t < 360; t++) {g.step({...emptyCommand(), move: vec(1, 1)}, emptyCommand());n += escapes(g).length;worst = Math.max(worst, staticPenetration(A, g.world));}
  assert.equal(n, 0);assert.equal(physicsProbe.staticConflictsTotal - c0, 0);assert.ok(worst <= 1e-6, `penetração ${worst}`);
  assert.ok(A.position.x > 2 && A.position.z > 2, 'chegou ao canto');
});

test('quina entre dois obstáculos do mapa encostados: converge sem escape', () => {
  const g = lab([box('a', 0, 4, 3, 1), box('b', 4, 0, 1, 3)], vec(0, 0)), A = g.fighters[0], c0 = physicsProbe.staticConflictsTotal;let n = 0;
  for (let t = 0; t < 360; t++) {g.step({...emptyCommand(), move: vec(1, 1)}, emptyCommand());n += escapes(g).length;}
  assert.equal(n, 0);assert.equal(physicsProbe.staticConflictsTotal - c0, 0);assert.ok(staticPenetration(A, g.world) <= 1e-6);
});

test('destrutível morto sem posição de respawn: UMA recusa (evento + spawnLog) por ciclo morto, não a cada 1 s', () => {
  resetConfig(defaults());C.test.circleCap = 3;   // arena minúscula: toda posição sorteada é «outsideArena»
  const g = new Game({seed: 5});g.start();const ms = g.mapState;
  Object.assign(ms, {platforms: [], obstacles: [], items: [], spawnLog: []});
  const d = {id: 'dX', hp: 0, maxHp: 30, pos: {x: 0, y: 0, z: 0}, size: {hx: .8, hz: .8, height: 1.6}, shape: 'box', angle: 0, state: 'dead', respawnTimer: 0, ghostTimer: 0, resistances: {}};
  ms.destructibles = [d];
  const dt = C.test.step;let events = [];
  for (let t = 0; t < 6 / dt; t++) stepMap(ms, dt, [], events, t);
  const rej = events.filter(e => e.result === 'spawnRejected');
  assert.equal(rej.length, 1, `${rej.length} eventos spawnRejected em 6 s`);
  assert.equal(ms.spawnLog.filter(e => e.kind === 'destructible').length, 1, 'spawnLog');
  // Sai do ciclo morto (arena volta ao normal → respawna) e morre de novo: nova recusa é registrada de novo.
  C.test.circleCap = null;events = [];
  for (let t = 0; t < 2 / dt && d.state === 'dead'; t++) stepMap(ms, dt, [], events, t);
  assert.notEqual(d.state, 'dead', 'deveria ter saído do estado morto');
  C.test.circleCap = 3;d.state = 'dead';d.respawnTimer = 0;events = [];
  for (let t = 0; t < 3 / dt; t++) stepMap(ms, dt, [], events, t);
  assert.equal(events.filter(e => e.result === 'spawnRejected').length, 1, 'novo ciclo morto: uma recusa');
});

test('F9: resetConfig desfaz override de C.test.penetrationTolerance (tolerância técnica fora de defaults(), sem slider)', () => {
  resetConfig(defaults());C.test.penetrationTolerance = .5;
  resetConfig(defaults());
  assert.equal(C.test.penetrationTolerance, undefined, 'o override de um teste não pode vazar para o próximo');
  assert.equal('penetrationTolerance' in defaults().test, false, 'continua fora de defaults() (não vira slider nem entra em presets)');
});
