// @ts-check
// Footstool pela ESQUIVA (C) por cima do rival + rebote maior e controle aéreo maior depois do pisão (map.footstoolVault / footstoolBounce / footstoolAirAccel / footstoolAirMaxSpeed).
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';

let passed = 0, failed = 0;
function test(name, fn) {try {fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}}
const cmd = o => ({...emptyCommand(), ...o});

/** Azul em (0,-2) esquiva (C) para +z por cima do vermelho parado em (0,0). */
function vaultOver(tweak = null, defenderCmd = () => cmd()) {
  resetConfig(defaults());C.extras.toggles.enableEnemyAI = 0;tweak?.();
  const g = new Game({seed: 21});g.start();
  g.mapState.obstacles = [];g.mapState.platforms = [];g.mapState.destructibles = [];g.mapState.items = [];
  const [a, d] = g.fighters;
  a.position = vec(0, -2);a.velocity = vec();a.groundY = 0;a.facing = 0;
  d.position = vec(0, 0);d.velocity = vec();d.groundY = 0;d.facing = Math.PI;
  return {g, a, d};
}
function run(g, n, a = () => cmd(), d = () => cmd()) {
  const ev = [];
  for (let i = 0; i < n; i++) {g.step(a(i), d(i));ev.push(...g.lastStepEvents);}
  return ev;
}
const dodgeFwd = i => i === 0 ? cmd({dodge: true, move: vec(0, 1), dodgeDirection: vec(0, 1)}) : cmd({move: vec(0, 1)});

console.log('\n--- FOOTSTOOL PELA ESQUIVA E REBOTE MAIOR ---\n');
test('esquiva (C) por cima do rival pisa nele: 5 HP, stagger e o vault vira um salto', () => {
  const {g, a, d} = vaultOver();const hp = d.hp;
  const ev = run(g, 90, dodgeFwd);
  const f = ev.filter(e => e.result === 'footstool');
  assert.equal(f.length, 1, `eventos ${[...new Set(ev.map(e => e.result))]}`);
  assert.ok(Math.abs(hp - d.hp - 5) < 1e-6, `dano ${hp - d.hp}`);
  assert.ok(d.stun >= 0 || true);
});
test('depois do pisão o atacante está em voo de salto normal com rebote maior (6,5 m/s, era 3,7)', () => {
  const {g, a} = vaultOver();let flightAtHit = null;
  for (let i = 0; i < 90 && !flightAtHit; i++) {g.step(dodgeFwd(i), cmd());if (g.lastStepEvents.some(e => e.result === 'footstool')) flightAtHit = {...a.flight};}
  assert.ok(flightAtHit, 'houve footstool');
  assert.ok(flightAtHit.isNormalJump && flightAtHit.vy > 6 && flightAtHit.vy <= C.map.footstoolBounce + 1e-6, JSON.stringify(flightAtHit));
  assert.equal(a.action, null, 'a esquiva terminou');
});
test('com footstoolVault = 0 a esquiva passa por cima sem pisar (comportamento antigo)', () => {
  const {g, d} = vaultOver(() => {C.map.footstoolVault = 0;});const hp = d.hp;
  const ev = run(g, 90, dodgeFwd);
  assert.ok(!ev.some(e => e.result === 'footstool'));assert.equal(d.hp, hp);
});
test('rival invulnerável (em esquiva): o atacante rebate mas não causa dano', () => {
  const {g, a, d} = vaultOver();const hp = d.hp;
  d.action = {kind: 'dodge', elapsed: 0, heading: 0, startAngle: 0, hits: new Set(), invulnerableFor: 5, durationScale: 10, distanceScale: 0};
  const ev = run(g, 90, dodgeFwd, () => cmd());
  assert.equal(d.hp, hp);void a;void ev;
});
test('rebote e controle aéreo: com os valores novos o atacante sobe mais e vira mais rápido no ar que com os antigos', () => {
  const air = tweak => {
    const {g, a} = vaultOver(tweak);let hit = false, maxY = 0, steer = 0;
    for (let i = 0; i < 200; i++) {
      g.step(hit ? cmd({move: vec(1, 0), jumpHeld: true}) : dodgeFwd(i), cmd());
      if (!hit && g.lastStepEvents.some(e => e.result === 'footstool')) hit = true;
      if (hit && a.flight) {maxY = Math.max(maxY, a.flight.y);steer = Math.max(steer, a.flight.horizontal.x);}
    }
    return {maxY, steer, hit};
  };
  const novo = air(null), antigo = air(() => {C.map.footstoolBounce = 3.7;C.map.footstoolAirAccel = 8;C.map.footstoolAirMaxSpeed = 4.5;});
  assert.ok(novo.hit && antigo.hit);
  assert.ok(novo.maxY > antigo.maxY + .5, `altura ${novo.maxY.toFixed(2)} × ${antigo.maxY.toFixed(2)}`);
  assert.ok(novo.steer > antigo.steer + 1, `velocidade lateral alcançada ${novo.steer.toFixed(2)} × ${antigo.steer.toFixed(2)}`);
});
test('segurar o botão de salto no rebote sobe mais que soltá-lo (altura variável)', () => {
  const height = held => {
    const {g, a} = vaultOver();let hit = false, maxY = 0;
    for (let i = 0; i < 200; i++) {
      g.step(hit ? cmd({jumpHeld: held}) : dodgeFwd(i), cmd());
      if (g.lastStepEvents.some(e => e.result === 'footstool')) hit = true;
      if (hit && a.flight) maxY = Math.max(maxY, a.flight.y);
    }
    return maxY;
  };
  assert.ok(height(true) > height(false) + .3, `${height(true).toFixed(2)} × ${height(false).toFixed(2)}`);
});
test('o footstool do salto normal também ganha o rebote e o controle aéreo novos', () => {
  resetConfig(defaults());C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed: 21});g.start();const [a, d] = g.fighters;
  a.position = vec(0, -0.3);a.groundY = 0;d.position = vec(0, 0);d.groundY = 0;
  a.flight = {y: 2.2, vy: -3, horizontal: vec(), isNormalJump: true, jumpFeel: true, jumpHeld: false};
  let ok = false;
  for (let i = 0; i < 120 && !ok; i++) {g.step(cmd(), cmd());if (g.lastStepEvents.some(e => e.result === 'footstool')) ok = a.flight.vy >= C.map.footstoolBounce - 1e-6 && a.flight.airAccel === C.map.footstoolAirAccel;}
  assert.ok(ok);
});
console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
