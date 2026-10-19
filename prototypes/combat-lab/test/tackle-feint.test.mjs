// Finta do Tackle: C com direção para os lados ou para trás (no startup ou na carga) cancela o ataque e vira uma esquiva rápida
// (mais curta, um pouco mais veloz e mais cara que a normal). Para a frente, ou sem direção, não há finta. Sem navegador.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig, feintColor} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
function arena(over = {}) {
  resetConfig(defaults());
  for (const [p, v] of Object.entries(over)) {const k = p.split('.'), last = k.pop();k.reduce((a, x) => a[x], C)[last] = v;}
  const g = new Game();g.mode = 'inactive';g.reset({positions: [vec(0, -6), vec(0, 6)]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;return g;
}
const step = (g, a = cmd()) => {g.step(a, cmd());return g.lastStepEvents;};
const fwd = vec(0, 1), left = vec(-1, 0), right = vec(1, 0), back = vec(0, -1);

// ---------- Finta no startup: lados e trás viram esquiva rápida; frente e sem direção não ----------
for (const [name, dir] of [['esquerda', left], ['direita', right], ['trás', back]]) {
  const g = arena(), f = g.fighters[0];
  step(g, cmd({tackle: true, move: fwd, dodgeDirection: fwd}));for (let i = 0; i < 3; i++) step(g, cmd({move: fwd}));
  assert.equal(f.action?.kind, 'tackle');const s0 = f.stamina;
  step(g, cmd({move: dir, dodge: true, dodgeDirection: dir}));
  assert.equal(f.action?.kind, 'dodge', `${name}: vira esquiva`);assert.ok(f.action.feint, `${name}: marcada como finta`);
  assert.equal(f.feints, 1);
  assert.ok(near(f.action.durationScale, C.rules.feintDuration), 'duração menor');
  const refund = s0 + C.actions.tackle.cost - C.rules.feintCost;assert.ok(Math.abs(f.stamina - refund) < .15, `${name}: custo da finta (${f.stamina.toFixed(2)} ≈ ${refund.toFixed(2)})`);
  ok(`finta no startup para ${name}: o Tackle vira uma esquiva rápida`);
}
function near(a, b) {return Math.abs(a - b) < 1e-9;}
for (const [name, press] of [['frente', {move: fwd, dodge: true, dodgeDirection: fwd}], ['sem direção', {dodge: true}], ['D (defesa)', {guardPressed: true, guard: true}]]) {
  const g = arena(), f = g.fighters[0];
  step(g, cmd({tackle: true, move: fwd, dodgeDirection: fwd}));for (let i = 0; i < 3; i++) step(g, cmd({move: fwd}));
  step(g, cmd(press));
  assert.ok(!f.action?.feint, `${name}: não é finta`);assert.equal(f.feints ?? 0, 0);
  ok(`${name}: não faz finta`);
}

// ---------- A esquiva da finta é mais rápida, mais curta e mais cara que a normal ----------
{
  const dist = a => {const g = arena(), f = g.fighters[0];step(g, cmd({tackle: true, move: fwd, dodgeDirection: fwd}));step(g, cmd({move: fwd}));
    const z0 = f.position.x, ticks0 = g.tick;let maxV = 0;step(g, a);while (f.action?.kind === 'dodge') {maxV = Math.max(maxV, Math.hypot(f.velocity.x, f.velocity.z));step(g, cmd({move: left}));}
    return {x: Math.abs(f.position.x - z0), ticks: g.tick - ticks0, maxV, stamina: f.stamina};};
  const feint = dist(cmd({dodge: true, move: left, dodgeDirection: left}));
  const g2 = arena(), f2 = g2.fighters[0];step(g2, cmd({move: left, dodge: true, dodgeDirection: left}));let maxN = 0, t2 = 0, x0 = f2.position.x;while (f2.action?.kind === 'dodge') {maxN = Math.max(maxN, Math.hypot(f2.velocity.x, f2.velocity.z));step(g2, cmd({move: left}));t2++;}
  assert.ok(feint.ticks < t2, `duração menor (${feint.ticks} < ${t2} passos)`);
  assert.ok(feint.maxV > maxN, `mais rápida (${feint.maxV.toFixed(1)} > ${maxN.toFixed(1)} m/s)`);
  assert.ok(C.rules.feintCost > C.actions.dodge.cost, 'a finta custa mais que a esquiva normal');
  ok('a esquiva da finta é mais curta, mais rápida e mais cara que a normal');
}

// ---------- Sliders: duração, distância, custo, ângulo mínimo e stamina insuficiente ----------
{
  const run = over => {const g = arena(over), f = g.fighters[0];step(g, cmd({tackle: true, move: fwd, dodgeDirection: fwd}));step(g, cmd({move: fwd}));const x0 = f.position.x;
    step(g, cmd({dodge: true, move: left, dodgeDirection: left}));const fe = !!f.action?.feint;while (f.action?.kind === 'dodge') step(g, cmd({move: left}));return {fe, d: Math.abs(f.position.x - x0)};};
  const base = run({}), far = run({'rules.feintDistance': 2});
  assert.ok(base.fe && far.d > base.d * 1.5, `distância dobra (${base.d.toFixed(2)} → ${far.d.toFixed(2)} m)`);
  assert.ok(!run({'rules.feintMinAngle': 120}).fe, 'ângulo mínimo de 120° bloqueia o lado');
  const g = arena({'rules.feintCost': 99}), f = g.fighters[0];step(g, cmd({tackle: true, move: fwd, dodgeDirection: fwd}));step(g, cmd({move: fwd}));step(g, cmd({dodge: true, move: left, dodgeDirection: left}));
  assert.ok(!f.action?.feint, 'sem stamina para o custo, não faz finta');
  ok('os sliders da finta (distância, ângulo mínimo e custo) valem');
}

// ---------- Finta na carga ----------
{
  const g = arena(), f = g.fighters[0];
  step(g, cmd({tackle: true, tackleHeld: true, move: fwd, dodgeDirection: fwd}));for (let i = 0; i < 40; i++) step(g, cmd({tackleHeld: true, move: fwd}));
  assert.ok(f.tackleCharge, 'carregando');step(g, cmd({tackleHeld: true, dodge: true, move: right, dodgeDirection: right}));
  assert.ok(!f.tackleCharge && f.action?.feint, 'a carga vira esquiva rápida para o lado');
  const h = arena();const f2 = h.fighters[0];step(h, cmd({tackle: true, tackleHeld: true, move: fwd}));for (let i = 0; i < 40; i++) step(h, cmd({tackleHeld: true, move: fwd}));
  step(h, cmd({tackleHeld: true, dodge: true, move: fwd, dodgeDirection: fwd}));assert.ok(!f2.action?.feint, 'para a frente a carga não vira finta');
  ok('finta durante a carga: lados e trás sim, frente não');
}

// ---------- Tackle que já acertou não finta; cor dos efeitos ----------
{
  const g = arena(), f = g.fighters[0];step(g, cmd({tackle: true, move: fwd}));f.action.hits.add(1);step(g, cmd({move: left, dodge: true, dodgeDirection: left}));
  assert.equal(f.action?.kind, 'tackle', 'tackle que já acertou não cancela');
  assert.equal(feintColor(.5), 0xffd23c);assert.equal(feintColor(0), 0xf5ee50);assert.equal(feintColor(1), 0xff9a2e);
  ok('tackle que já acertou não pode ser fintado; cor amarela padrão dos efeitos');
}
console.log(`\n${n} verificações da finta (esquiva rápida) aprovadas.`);
