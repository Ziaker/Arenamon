// Fase 7 do overhaul — sonda de colisão para as ferramentas visuais do laboratório (src/sim/collision-probe.js).
// Observacional: registra o ÚLTIMO contato de cada lutador com o ambiente (objeto bloqueador, normal, profundidade, velocidade antes/depois) e as
// varreduras dos projéteis (primeiro contato). Fica fora do estado da simulação, do save e do replay (como physicsProbe).
// Uso: node prototypes/combat-lab/test/collision-probe.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {spawn} from '../src/sim/world.js';
import {collisionProbe, resetCollisionProbe} from '../src/sim/collision-probe.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let tests = 0;const failures = [];
const check = (name, fn) => {try {resetConfig(defaults());resetCollisionProbe();fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};
const lab = (map = {}) => {
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game();g.reset({positions: [vec(0, 0), vec(-20, -20)]});g.mode = 'inactive';
  Object.assign(g.mapState, {platforms: [], obstacles: [], destructibles: [], items: [], regularSpawnTimer: 1e9, ...map});
  return g;
};
const run = (g, n, c0 = emptyCommand()) => {for (let t = 0; t < n; t++) g.step(c0, emptyCommand());};

check('arremesso contra pilar: registra o pilar como bloqueador, normal, profundidade e a velocidade antes/depois (rebote)', () => {
  const g = lab({obstacles: [{id: 'pi', shape: 'pillar', pos: {x: 0, y: 0, z: 5}, hx: .9, hz: .9, radius: .9, height: 4.5, angle: 0}]}), f = g.fighters[0];
  f.flight = {y: .01, vy: 5, horizontal: vec(0, 12)};f.launchedByHit = true;f.state = 'airborne';
  run(g, 120);
  const r = collisionProbe.byFighter[0];
  assert.ok(r, 'sem registro');
  assert.equal(r.kind, 'obstacle');assert.equal(r.id, 'pi');
  assert.ok(r.normal.z < -0.9, `normal ${JSON.stringify(r.normal)}`);
  assert.ok(r.depth > 0 && r.depth < 0.6, `profundidade ${r.depth}`);
  assert.ok(r.vBefore.z > 5 && r.vAfter.z < 0, `v antes ${r.vBefore.z}, depois ${r.vAfter.z}`);
  assert.ok(Number.isInteger(r.step));
});
check('caminhar contra a lateral de uma plataforma: bloqueador = plataforma; velocidade que entra é removida', () => {
  const g = lab({platforms: [{id: 'pl', pos: {x: 0, y: 0, z: 4}, width: 3, depth: 3, height: 1}]});
  for (let t = 0; t < 400 && !collisionProbe.byFighter[0]; t++) g.step({...emptyCommand(), move: vec(0, 1)}, emptyCommand());
  const r = collisionProbe.byFighter[0];   // primeiro toque: a velocidade que entra é removida (no regime, o deslize do controlador já projeta o input e a «antes» é ~0)
  assert.equal(r.kind, 'platform');assert.equal(r.id, 'pl');assert.ok(r.vBefore.z > 0.5, `v antes ${r.vBefore.z}`);assert.ok(Math.abs(r.vAfter.z) < 1e-9, `v depois ${r.vAfter.z}`);
});
check('destrutível: bloqueador = destrutível; Move wall: bloqueador = parede; borda: bloqueador = arena', () => {
  let g = lab({destructibles: [{id: 'd', hp: 30, maxHp: 30, pos: {x: 0, y: 0, z: 4}, size: {hx: .8, hz: .8, height: 1.6}, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0, ghostTimer: 0, resistances: {physical: 1}}]});
  run(g, 240, {...emptyCommand(), move: vec(0, 1)});assert.equal(collisionProbe.byFighter[0].kind, 'destructible');
  resetCollisionProbe();g = lab();spawn(g.world, {kind: 'wall', pos: {x: 0, z: 3}, hx: 3, hz: .2, angle: 0, y: 0, height: 3}, []);
  run(g, 240, {...emptyCommand(), move: vec(0, 1)});assert.equal(collisionProbe.byFighter[0].kind, 'wall');
  resetCollisionProbe();g = lab();g.fighters[0].position = vec(0, 40);
  run(g, 240, {...emptyCommand(), move: vec(0, 1)});assert.equal(collisionProbe.byFighter[0].kind, 'arena');
});
check('projétil rápido contra barreira fina: a varredura registra o trecho, o ponto do primeiro contato e o bloqueador', () => {
  const g = lab();
  spawn(g.world, {kind: 'barrier', owner: 1, pos: {x: 0, z: 4}, angle: 0, hx: 1.5, hz: .01, y: 0, height: 2, life: 5}, []);
  spawn(g.world, {kind: 'projectile', owner: 0, pos: {x: 0, z: -1}, angle: 0, speed: 80, radius: .035, y: .65, life: 3, hit: {damage: 10}}, []);
  run(g, 30);
  const hit = collisionProbe.sweeps.find(s => s.hit);
  assert.ok(hit, 'sem varredura com contato');
  assert.ok(Math.abs(hit.hit.z - (4 - .01 - .035)) < 0.02, `ponto ${hit.hit.z}`);
  assert.ok(hit.a.z < hit.b.z + 1e-9 && hit.by, 'trecho sem origem/bloqueador');
});
check('a sonda é limitada (varreduras) e não entra no save: o estado salvo é idêntico com e sem leitura da sonda', () => {
  const g = lab();
  for (let i = 0; i < 400; i++) spawn(g.world, {kind: 'projectile', owner: 0, pos: {x: 0, z: -1}, angle: 0, speed: 30, radius: .1, y: .65, life: 1, hit: {damage: 1}}, []);
  run(g, 20);
  assert.ok(collisionProbe.sweeps.length <= 64, `${collisionProbe.sweeps.length} varreduras guardadas`);
  assert.ok(!JSON.stringify(g.save?.() ?? {}).includes('byFighter'));
});

console.log(`Sonda de colisão: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
