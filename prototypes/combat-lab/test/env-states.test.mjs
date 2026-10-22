// Fase 6 (complemento) — transições de estado afetadas por contato ambiental que faltavam: Tech Recovery, Meteor Slam, defesa (guard stun) comprimida,
// save/load no meio do contato e independência da taxa de quadros de renderização. Sem alterar custos, danos, recoveries ou janelas.
// Uso: node prototypes/combat-lab/test/env-states.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game, FixedClock} from '../src/sim/game.js';
import {emptyCommand, altitudeOf} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {collectSolids} from '../src/nav/nav-graph.js';
import {bodyPenetration} from '../src/sim/collision-probe.js';
import {physicsProbe, groundSurface} from '../src/sim/physics.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let tests = 0;const failures = [];
const check = (name, fn) => {try {resetConfig(defaults());fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};
const cmd = o => ({...emptyCommand(), ...o});
const PILLAR = {id: 'pi', shape: 'pillar', pos: {x: 0, y: 0, z: 4}, hx: .9, hz: .9, radius: .9, height: 4.5, angle: 0};
const lab = (map = {}, positions = [vec(0, 0), vec(-20, -20)]) => {
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game();g.reset({positions});g.mode = 'inactive';g.fighters[0].facing = 0;
  Object.assign(g.mapState, {platforms: [], obstacles: [], destructibles: [], items: [], regularSpawnTimer: 1e9, ...map});
  return g;
};
const pen = (g, f) => {let m = 0;for (const s of collectSolids(g.mapState)) m = Math.max(m, bodyPenetration({x: f.position.x, y: altitudeOf(f), z: f.position.z}, s));return m;};

check('Tech Recovery junto a um pilar: o pouso com C vira esquiva, custa a stamina da regra UMA vez e o corpo nunca penetra o pilar', () => {
  const g = lab({obstacles: [PILLAR]}, [vec(0, 1.2), vec(-20, -20)]), f = g.fighters[0];
  f.flight = {y: .01, vy: 6, horizontal: vec(0, 3)};f.launchedByHit = true;f.state = 'airborne';
  const s0 = f.stamina;let worst = 0, dodged = false;
  for (let t = 0; t < 360; t++) {
    g.step(cmd({dodge: t === 20, dodgeHeld: t === 20, move: vec(0, 1)}), emptyCommand());
    worst = Math.max(worst, pen(g, f));if (f.action?.kind === 'dodge') dodged = true;
  }
  assert.ok(worst <= 1e-3, `penetrou ${worst.toFixed(4)} m`);
  if (dodged) assert.ok(s0 - f.stamina <= C.actions.dodge.cost + 1e-6 || f.stamina >= s0 - C.rules.techCost - 1e-6, `stamina ${s0} → ${f.stamina}`);
  assert.ok(f.action === null && !f.flight && ['neutral', 'landing', 'moving'].includes(f.state), `estado final ${f.state}`);
});
check('Meteor Slam ao lado de uma caixa: o mergulho aterrissa sem penetrar a caixa e o estado termina normalmente', () => {
  const g = lab({obstacles: [{id: 'b', shape: 'box', pos: {x: 0, y: 0, z: 3}, hx: 1.5, hz: 1.5, radius: 1.5, height: 2.2, angle: 0}]}, [vec(0, 0), vec(-20, -20)]), f = g.fighters[0];
  let worst = 0, slammed = false;
  for (let t = 0; t < 420; t++) {
    g.step(cmd({jump: t === 10, jumpHeld: t >= 10 && t < 40, move: vec(0, 1), tackle: t === 45}), emptyCommand());
    if (altitudeOf(f) < 2.2 - C.map.mountTolerance - 1e-3) worst = Math.max(worst, pen(g, f));if (f.action?.slam) slammed = true;
  }
  assert.ok(slammed, 'o Meteor Slam não foi acionado');
  assert.ok(worst <= 1e-3, `penetrou ${worst.toFixed(3)} m abaixo da faixa de montagem`);
  assert.ok(pen(g, f) <= 1e-3, 'terminou dentro da caixa');
  assert.ok(f.action === null && !f.flight, `estado final ${f.state}`);
});
check('Meteor Slam que sai da borda de uma plataforma: o mergulho acompanha o piso real (nunca fica «flutuando» na altura da plataforma em meteorGround)', () => {
  // Origem (Fase 6): o vault do slam é relativo a groundY; ao mergulhar para além da borda, groundY continuava na altura da plataforma e o lutador
  // ficava suspenso até o fim da ação (flutuando ~1 m acima do piso).
  const g = lab({platforms: [{id: 'p', pos: {x: 0, y: 0, z: 0}, width: 3, depth: 3, height: 1}]}, [vec(0, -.5), vec(0, .7)]), f = g.fighters[0];
  f.groundY = 1;g.fighters[1].groundY = 1;
  let slammed = false, float = 0;
  for (let t = 0; t < 420; t++) {
    g.step(cmd({jump: t === 10, jumpHeld: t >= 10 && t < 40, tackle: t === 45, move: vec(0, .01)}), emptyCommand());
    if (f.action?.slam) slammed = true;
    if (!f.flight && (f.vaultHeight ?? 0) <= 0.05) float = Math.max(float, f.groundY - groundSurface(f.position, g, f.groundY).y);
  }
  assert.ok(slammed, 'o Meteor Slam não foi acionado');
  assert.ok(float <= 0.1, `flutuou ${float.toFixed(2)} m acima do piso real`);
});
check('Defesa (guard) comprimida entre o Tackle do adversário e um objeto: sem penetração, sem conflito de espaço, termina o guard stun', () => {
  for (const mk of [() => ({obstacles: [PILLAR]}), () => ({obstacles: [{id: 'b', shape: 'box', pos: {x: 0, y: 0, z: 4}, hx: 1.5, hz: 1.5, radius: 1.5, height: 2.2, angle: 0}]})]) {
    const g = lab(mk(), [vec(0, 2.1), vec(0, -.5)]), a = g.fighters[0], b = g.fighters[1];
    a.facing = Math.PI;b.facing = 0;const c0 = physicsProbe.staticConflictsTotal;let worst = 0;
    for (let t = 0; t < 480; t++) {g.step(cmd({guard: true, guardPressed: t === 0}), t === 0 ? cmd({tackle: true, move: vec(0, 1)}) : cmd({move: vec(0, 1)}));if (!a.flight) worst = Math.max(worst, pen(g, a));}
    assert.ok(worst <= 1e-3, `penetrou ${worst.toFixed(4)} m`);
    assert.equal(physicsProbe.staticConflictsTotal - c0, 0);
    assert.ok(!a.stun || a.stun <= 0, `guard stun não terminou (${a.stun})`);
  }
});
check('save/load no meio do contato com pilar e plataforma: continuar do save dá o MESMO estado que continuar direto (estado físico preservado)', () => {
  const play = () => {
    const g = lab({obstacles: [PILLAR], platforms: [{id: 'p', pos: {x: 8, y: 0, z: 0}, width: 3, depth: 3, height: 1}]}, [vec(.6, 0), vec(-20, -20)]);
    g.fighters[0].flight = null;return g;
  };
  const script = t => cmd({move: vec(.3, 1)});
  const a = play();for (let t = 0; t < 150; t++) a.step(script(t), emptyCommand());
  const snap = a.save();
  for (let t = 150; t < 420; t++) a.step(script(t), emptyCommand());
  const b = play();b.load(snap);for (let t = 150; t < 420; t++) b.step(script(t), emptyCommand());
  const fp = g => JSON.stringify(g.fighters.map(f => [f.position, f.velocity, f.groundY, f.state, f.surfaceNormals, f.support, f.contacts]));
  assert.equal(fp(b), fp(a));
});
check('taxa de quadros de renderização (30/60/144 Hz): a simulação a 120 Hz termina no MESMO estado (mesmo número de passos)', () => {
  const run = fps => {
    const g = lab({obstacles: [PILLAR]}, [vec(.6, 0), vec(-20, -20)]), clock = new FixedClock();
    let steps = 0;
    while (steps < 360) clock.advance(1 / fps, () => {if (steps < 360) {g.step(cmd({move: vec(.3, 1)}), emptyCommand());steps++;}});
    return JSON.stringify(g.fighters.map(f => [f.position, f.velocity, f.state]));
  };
  const ref = run(144);
  assert.equal(run(30), ref);assert.equal(run(60), ref);assert.equal(run(240), ref);
});

console.log(`Estados × ambiente (Fase 6, complemento): ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
