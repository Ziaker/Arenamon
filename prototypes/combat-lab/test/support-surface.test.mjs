// Fase 4 do overhaul — contrato de SUPORTE físico: qual superfície segura o lutador (tipo, id, altura real, normal) e por quanto tempo.
// Observacional: `groundSurface` é a mesma consulta de `getGroundHeight` (a altura nunca diverge) e `f.support` só registra o resultado
// (nada na simulação lê esse campo). Também fixa, como guarda de regressão, as invariantes 3D medidas no 4634ca2 (cenários + fuzz de 1200
// lançamentos aleatórios: 0 flutuando, 0 afundado, 0 NaN, todos pousam).
// Uso: node prototypes/combat-lab/test/support-surface.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {getGroundHeight, groundSurface} from '../src/sim/physics.js';
import {collectSolids} from '../src/nav/nav-graph.js';
import {penetration} from '../src/physics-poc/poc-metrics.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let tests = 0;const failures = [];
const check = (name, fn) => {try {resetConfig(defaults());fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};
const lab = (opts = {}) => {
  const g = new Game();g.reset({positions: [opts.a ?? vec(0, 0), opts.b ?? vec(-30, -30)]});g.mode = 'inactive';
  Object.assign(g.mapState, {platforms: [], destructibles: [], items: [], obstacles: [], ...(opts.map ?? {})});
  return g;
};
const run = (g, n, cmd = emptyCommand()) => {for (let t = 0; t < n; t++) g.step(cmd, emptyCommand());};

check('groundSurface: altura idêntica a getGroundHeight e tipo/id da superfície mais alta que apoia', () => {
  const g = lab({map: {
    platforms: [{id: 'pl', pos: {x: 0, z: 0}, width: 3, depth: 3, height: 1}],
    obstacles: [{id: 'ob', shape: 'box', pos: {x: 10, y: 0, z: 0}, hx: 1, hz: 1, height: 2}, {id: 'pi', shape: 'cylinder', pos: {x: 0, y: 0, z: 10}, radius: 1, height: 1.5}],
    destructibles: [{id: 'de', hp: 30, maxHp: 30, pos: {x: -10, y: 0, z: 0}, size: {hx: 1, hz: 1, height: 1.2}, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0}],
  }});
  for (const [p, kind, id, y] of [[vec(0, 0), 'platform', 'pl', 1], [vec(10, 0), 'obstacle', 'ob', 2], [vec(0, 10), 'obstacle', 'pi', 1.5], [vec(-10, 0), 'destructible', 'de', 1.2], [vec(30, 30), 'ground', null, 0]]) {
    const s = groundSurface(p, g, null);
    assert.equal(s.kind, kind);assert.equal(s.id, id);assert.ok(Math.abs(s.y - y) < 1e-9);
    assert.equal(s.y, getGroundHeight(p, g, null), 'a altura tem de ser exatamente a de getGroundHeight');
    assert.deepEqual(s.normal, {x: 0, y: 1, z: 0});
  }
});
check('destrutível destruído deixa de ser superfície de apoio', () => {
  const g = lab({map: {destructibles: [{id: 'de', hp: 30, maxHp: 30, pos: {x: 0, y: 0, z: 0}, size: {hx: 1, hz: 1, height: 1.2}, shape: 'box', angle: 0, state: 'dead', respawnTimer: 5}]}});
  assert.equal(groundSurface(vec(0, 0), g, null).kind, 'ground');
});
check('f.support acompanha o lutador: chão → plataforma → chão (cai pela borda), com idade crescente', () => {
  const g = lab({a: vec(-2.5, 0), map: {platforms: [{id: 'pl', pos: {x: 0, z: 0}, width: 3, depth: 3, height: 1}]}});
  const f = g.fighters[0];
  run(g, 3);
  assert.equal(f.support.kind, 'ground');assert.ok(f.support.age >= 1);
  f.position = vec(0, 0);f.groundY = 1;run(g, 3);
  assert.equal(f.support.kind, 'platform');assert.equal(f.support.id, 'pl');assert.equal(f.support.y, 1);
  const age = f.support.age;run(g, 2);assert.equal(f.support.age, age + 2, 'a idade cresce enquanto a superfície é a mesma');
  run(g, 240, {...emptyCommand(), move: vec(1, 0)});
  assert.equal(f.support.kind, 'ground');assert.equal(f.support.y, 0);assert.ok(f.support.age < 240, 'a idade reinicia ao trocar de superfície');
});
check('em voo não há apoio (support = null) e o pouso o adquire na altura exata do topo', () => {
  const g = lab({a: vec(-2.5, 0), map: {platforms: [{id: 'pl', pos: {x: 0, z: 0}, width: 3, depth: 3, height: 1.5}]}});
  const f = g.fighters[0];f.flight = {y: 0, vy: 14, horizontal: vec(4, 0)};f.launchedByHit = true;
  run(g, 3);assert.equal(f.support, null);
  run(g, 240);
  assert.equal(f.flight, null);assert.equal(f.support.kind, 'platform');assert.equal(f.groundY, f.support.y);
});
check('cenários 3D: plataforma é sólida na lateral; destrutível destruído sob os pés faz cair até o chão', () => {
  const g = lab({a: vec(-3, 0), map: {platforms: [{id: 'p', pos: {x: 0, z: 0}, width: 3, depth: 3, height: 1}]}});
  run(g, 300, {...emptyCommand(), move: vec(1, 0)});
  assert.ok(g.fighters[0].position.x <= -1.5 - C.test.halfExtent + 1e-6, 'não atravessa a lateral');
  const d = {id: 'd', hp: 30, maxHp: 30, pos: {x: 0, y: 0, z: 0}, size: {hx: 1, hz: 1, height: 1.2}, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0};
  const h = lab({a: vec(0, 0), map: {destructibles: [d]}});h.fighters[0].groundY = 1.2;run(h, 5);
  assert.equal(h.fighters[0].support.kind, 'destructible');
  d.state = 'dead';run(h, 120);
  assert.equal(h.fighters[0].groundY, 0);assert.equal(h.fighters[0].flight, null);assert.equal(h.fighters[0].support.kind, 'ground');
});
check('fuzz determinístico: 400 lançamentos aleatórios em mapas aleatórios terminam apoiados, sem flutuar, afundar nem NaN', () => {
  const rng = seed => () => {seed |= 0;seed = seed + 0x6D2B79F5 | 0;let t = Math.imul(seed ^ seed >>> 15, 1 | seed);t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;return ((t ^ t >>> 14) >>> 0) / 4294967296;};
  const bad = [];
  for (let seed = 1; seed <= 400; seed++) {
    const r = rng(seed * 7919), u = (a, b) => a + (b - a) * r();
    resetConfig(defaults());C.extras.toggles.enableEnemyAI = 0;
    const g = new Game({seed});g.start();g.mode = 'inactive';
    const f = g.fighters[0];g.fighters[1].position = vec(-45, -45);
    const ang = u(0, 6.283), rad = u(0, 18), dir = u(0, 6.283), spd = u(0, 14);
    f.position = vec(Math.cos(ang) * rad, Math.sin(ang) * rad);f.groundY = getGroundHeight(f.position, g, null);
    f.flight = {y: f.groundY, vy: u(2, 14), horizontal: vec(Math.cos(dir) * spd, Math.sin(dir) * spd)};f.launchedByHit = true;
    for (let t = 0; t < 600; t++) g.step(emptyCommand(), emptyCommand());
    const sup = getGroundHeight(f.position, g, f.groundY);
    let pen = 0;for (const s of collectSolids(g.mapState)) pen = Math.max(pen, penetration({x: f.position.x, y: f.groundY, z: f.position.z}, s, 'box'));
    if (![f.position.x, f.position.z, f.groundY].every(Number.isFinite)) bad.push(`${seed}: NaN`);
    else if (f.flight) bad.push(`${seed}: ainda em voo`);
    else if (f.groundY - sup > 1e-6) bad.push(`${seed}: flutua ${(f.groundY - sup).toFixed(3)} m`);
    else if (pen > .02) bad.push(`${seed}: afundado ${pen.toFixed(3)} m`);
    else if (!f.support || Math.abs(f.support.y - f.groundY) > 1e-9) bad.push(`${seed}: support inconsistente`);
  }
  assert.equal(bad.length, 0, bad.slice(0, 5).join('; '));
});

console.log(`Superfície de apoio e invariantes 3D: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
