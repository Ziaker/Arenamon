// Clash por empurrão (sem lançamento) e recovery rápido (C no ar, esquiva imediata ao pousar): sem navegador.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {launch} from '../src/sim/combat.js';
import {timeToLand} from '../src/sim/controller.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
function arena(positions = [vec(0, -1.6), vec(0, 1.6)], over = {}) {
  resetConfig(defaults());for (const [p, v] of Object.entries(over)) {const k = p.split('.'), last = k.pop();k.reduce((a, x) => a[x], C)[last] = v;}
  const g = new Game();g.mode = 'inactive';g.reset({positions});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;return g;
}
const stepAll = (g, k, a = () => cmd(), b = () => cmd()) => {const ev = [];for (let i = 0; i < k; i++) {g.step(a(i), b(i));ev.push(...g.lastStepEvents);}return ev;};
const clashRun = over => {
  const g = arena(undefined, over);
  const ev = stepAll(g, 120, i => cmd({move: vec(0, 1), tackle: i === 5, target: 1}), i => cmd({move: vec(0, -1), tackle: i === 5, target: 0}));
  return {g, ev, clashes: ev.filter(e => e.result === 'clash')};
};

// ---------- Clash ----------
{
  const a = clashRun({});
  assert.equal(a.clashes.length, 2);assert.ok(a.clashes.every(e => !e.push), 'padrão: lançamento');
  const b = clashRun({'extras.toggles.enableClashPush': 1});
  assert.equal(b.clashes.length, 2, 'o choque acontece igual');assert.ok(b.clashes.every(e => e.push));
  assert.deepEqual(a.clashes.map(e => e.damage), b.clashes.map(e => e.damage), 'mesmo dano');
  const tick = e => e.tick; void tick;
  // Empurrão: ninguém voa; cada um recua ≈ clashPushDistance a partir do contato.
  const g = arena(undefined, {'extras.toggles.enableClashPush': 1});
  let flew = false, before = null;
  for (let i = 0; i < 160; i++) {
    g.step(cmd({move: i < 16 ? vec(0, 1) : vec(), tackle: i === 5, target: 1}), cmd({move: i < 16 ? vec(0, -1) : vec(), tackle: i === 5, target: 0}));
    if (g.fighters.some(f => f.flight)) flew = true;
    if (!before && g.lastStepEvents.some(e => e.result === 'clash')) before = g.fighters.map(f => f.position.z);
  }
  assert.ok(!flew, 'sem voo no clash por empurrão');
  const moved = g.fighters.map((f, i) => Math.abs(f.position.z - before[i]));
  assert.ok(moved.every(d => d > C.rules.clashPushDistance * .7 && d < C.rules.clashPushDistance * 1.4), `recuo ≈ distância (${moved.map(d => d.toFixed(2))})`);
  assert.ok(g.fighters[0].position.z < before[0] && g.fighters[1].position.z > before[1], 'recuam para lados opostos');
  // Slider: distância maior = recuo maior.
  const g2 = arena(undefined, {'extras.toggles.enableClashPush': 1, 'rules.clashPushDistance': 4.5});
  let b2 = null;for (let i = 0; i < 200; i++) {g2.step(cmd({move: i < 16 ? vec(0, 1) : vec(), tackle: i === 5, target: 1}), cmd({move: i < 16 ? vec(0, -1) : vec(), tackle: i === 5, target: 0}));if (!b2 && g2.lastStepEvents.some(e => e.result === 'clash')) b2 = g2.fighters.map(f => f.position.z);}
  assert.ok(Math.abs(g2.fighters[0].position.z - b2[0]) > Math.abs(g.fighters[0].position.z - before[0]) + 1, 'a distância do slider vale');
  ok('clash por empurrão: mesmo choque e dano, sem voo, recuo pela distância do slider');
}

// ---------- Recovery rápido ----------
const flying = (over = {}, hold = vec(1, 0)) => {
  const g = arena([vec(-4, 0), vec(4, 0)], over);const f = g.fighters[0];launch(f, vec(0, 1), 6, 7.3);return {g, f, hold};
};
{
  const {g, f} = flying();const s0 = f.stamina;
  assert.ok(timeToLand(f) > C.rules.techWindow, 'começa fora da janela');
  // Aperta cedo demais: ignorado.
  g.step(cmd({dodge: true, move: vec(1, 0)}), cmd());assert.ok(!f.tech, 'fora da janela não arma');
  let armed = false, step = 0;
  while (f.flight && step < 600) {
    const inWin = timeToLand(f) <= C.rules.techWindow;
    g.step(cmd({dodge: inWin && !armed, move: vec(1, 0)}), cmd());if (f.tech) armed = true;step++;
  }
  assert.ok(armed && !f.flight, 'armou na janela e pousou');
  assert.ok(f.techDodge, 'o pouso marcou o recovery');g.step(cmd({move: vec(1, 0)}), cmd());
  assert.equal(f.action?.kind, 'dodge', 'esquiva imediata ao pousar');assert.ok(f.action.techRecovery);
  assert.ok(Math.abs((s0 - f.stamina) - C.rules.techCost) < .05, `custo do recovery (${(s0 - f.stamina).toFixed(2)})`);
  const x0 = f.position.x;stepAll(g, 30, () => cmd({move: vec(1, 0)}));assert.ok(f.position.x > x0 + .5, 'esquiva na direção segurada (+x)');
  ok('recovery rápido: arma na janela, esquiva ao pousar, direção e custo corretos');
}
{
  // Sem stamina, desligado ou sem apertar: cai normalmente (recuperação de pouso).
  const land = ({press = true, over = {}, stamina = null, at = null}) => {
    const {g, f} = flying(over);if (stamina != null) {f.stamina = stamina;f.exhausted = stamina < 1;}
    let pressed = false;
    while (f.flight) {const go = press && !pressed && timeToLand(f) <= (at ?? C.rules.techWindow);if (go) pressed = true;g.step(cmd({dodge: go, move: vec(1, 0)}), cmd());}
    g.step(cmd({move: vec(1, 0)}), cmd());
    return f;
  };
  assert.notEqual(land({}).action?.kind, undefined);
  assert.notEqual(land({press: false}).action?.kind, 'dodge');assert.ok(land({press: false}).knockRecovery > 0, 'sem apertar: recuperação normal');
  assert.notEqual(land({over: {'extras.toggles.enableTechRecovery': 0}}).action?.kind, 'dodge');
  const poor = land({stamina: .3});assert.notEqual(poor.action?.kind, 'dodge');assert.ok(poor.knockRecovery > 0, 'sem stamina: cai normalmente');
  const free = land({over: {'rules.techCost': 0}, stamina: .3});assert.equal(free.action?.kind, 'dodge', 'custo 0 não exige stamina');assert.ok(Math.abs(free.stamina - .3) < 1e-6 || free.stamina <= .3);
  const late = land({over: {'rules.techWindow': .05}, at: .2});assert.notEqual(late.action?.kind, 'dodge', 'janela de 0,05 s é curta demais para este aperto');
  const minAir = land({over: {'rules.techMinAir': 5}, at: .2});assert.notEqual(minAir.action?.kind, 'dodge', 'tempo mínimo de voo maior que o voo');
  ok('recovery rápido: respeita toggle, apertar o C, stamina, custo 0, janela e tempo mínimo');
}
console.log(`\n${n} verificações de clash por empurrão e recovery rápido aprovadas.`);
