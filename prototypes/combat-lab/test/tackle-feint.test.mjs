// Fase 3 do Tackle: finta (C ou D cancelam o startup ou a carga) e brake slide (derrapagem, custo parcial e volta rápida ao neutro). Sem navegador.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
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
const fwd = vec(0, 1);

// ---------- Finta no startup ----------
for (const [name, press] of [['C', {dodge: true}], ['D', {guardPressed: true, guard: true}]]) {
  const g = arena(), f = g.fighters[0];
  step(g, cmd({tackle: true, move: fwd, dodgeDirection: fwd}));for (let i = 0; i < 3; i++) step(g, cmd({move: fwd}));
  assert.equal(f.action?.kind, 'tackle');const s0 = f.stamina, z0 = f.position.z;
  step(g, cmd({move: fwd, ...press}));
  assert.ok(!f.action, `${name}: o startup é cancelado`);assert.equal(f.state, 'brake');assert.ok(f.landingSlide, 'derrapagem');
  const expected = Math.min(C.rules.staminaMax, s0 + C.actions.tackle.cost - C.rules.feintStaminaCost);
  assert.ok(Math.abs(f.stamina - expected) < 1e-6, `${name}: paga só a fração (${s0.toFixed(2)} → ${f.stamina.toFixed(2)})`);
  assert.ok(Math.abs(f.knockRecovery - C.rules.feintRecovery) < C.test.step * 2);
  for (let i = 0; i < 12; i++) step(g, cmd());
  assert.ok(!f.action || f.action.kind !== 'dodge', `${name}: nenhuma esquiva sai`);
  const slid = f.position.z - z0;assert.ok(slid > .1 && slid < 2, `deslizou ${slid.toFixed(2)} m`);
  for (let i = 0; i < 60; i++) step(g, cmd());assert.ok(f.state !== 'brake' && f.knockRecovery === 0, 'volta ao neutro');
}
ok('C ou D no startup cancelam o tackle: derrapa, paga só a fração da stamina e nenhuma esquiva sai');

{
  const g = arena(), f = g.fighters[0];step(g, cmd({tackle: true, move: fwd}));
  const k = Math.ceil(C.rules.feintWindow / C.test.step) + 3;for (let i = 0; i < k; i++) step(g, cmd({move: fwd}));
  step(g, cmd({move: fwd, dodge: true}));assert.equal(f.action?.kind, 'tackle', 'fora da janela o tackle segue');assert.ok(f.state !== 'brake');
  const g2 = arena({'extras.toggles.enableTackleFeint': 0});const f2 = g2.fighters[0];step(g2, cmd({tackle: true, move: fwd}));step(g2, cmd({move: fwd, dodge: true}));
  assert.equal(f2.action?.kind, 'tackle', 'toggle desligado: C no startup não cancela');
  ok('fora da janela (ou com o toggle desligado) a finta não acontece');
}

// ---------- Finta na carga ----------
for (const [name, press] of [['C', {dodge: true}], ['D', {guardPressed: true, guard: true}]]) {
  const g = arena(), f = g.fighters[0];
  for (let i = 0; i < 40; i++) step(g, cmd({tackle: i === 0, tackleHeld: true, move: fwd}));
  assert.ok(f.tackleCharge);const s0 = f.stamina;
  step(g, cmd({tackleHeld: true, move: fwd, ...press}));
  assert.ok(!f.tackleCharge && !f.action, `${name}: a carga é cancelada sem esquiva`);assert.equal(f.state, 'brake');
  const expected = Math.min(C.rules.staminaMax, s0 + C.actions.tackle.cost - C.rules.feintStaminaCost);assert.ok(Math.abs(f.stamina - expected) < 1e-6, `${name}: custo parcial (${s0.toFixed(2)} → ${f.stamina.toFixed(2)})`);
  for (let i = 0; i < 12; i++) step(g, cmd({tackleHeld: true}));assert.ok(!f.tackleCharge, 'segurar X não recomeça a carga durante o freio');
}
ok('C ou D durante a carga cancelam sem esquivar: derrapa e devolve parte da stamina');
{
  const g = arena({'extras.toggles.enableTackleFeint': 0}), f = g.fighters[0];
  for (let i = 0; i < 40; i++) step(g, cmd({tackle: i === 0, tackleHeld: true, move: fwd}));
  step(g, cmd({tackleHeld: true, move: vec(1, 0), dodge: true, dodgeDirection: vec(1, 0)}));
  assert.ok(!f.tackleCharge && f.action?.kind === 'dodge', 'toggle desligado: C cancela e esquiva (comportamento da fase 1)');
  ok('toggle desligado volta ao comportamento anterior (C esquiva)');
}

// ---------- Volta ao neutro mais rápida que um tackle ----------
{
  const g = arena(), f = g.fighters[0];step(g, cmd({tackle: true, move: fwd}));step(g, cmd({move: fwd, dodge: true}));
  let t = 0;while ((f.knockRecovery > 0 || f.action) && t < 400) {step(g);t++;}
  const featherSecs = t * C.test.step;assert.ok(featherSecs < C.actions.tackle.duration * .6, `finta volta ao neutro em ${featherSecs.toFixed(2)} s (< 60% da duração do tackle)`);
  ok('a finta devolve o controle bem antes do fim de um tackle');
}
// ---------- Meteor slam e tackle que já acertou não fintam ----------
{
  const g = arena(), f = g.fighters[0];step(g, cmd({tackle: true, move: fwd}));f.action.hits.add(1);step(g, cmd({move: fwd, dodge: true}));
  assert.equal(f.action?.kind, 'tackle', 'tackle que já acertou não cancela');
  ok('tackle que já acertou não pode ser fintado');
}
console.log(`\n${n} verificações da finta e do brake slide (fase 3) aprovadas.`);
