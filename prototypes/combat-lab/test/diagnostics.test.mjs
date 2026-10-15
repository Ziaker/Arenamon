// Diagnóstico de comandos negados (sem navegador): cada motivo vem da própria decisão do controlador, corresponde a
// uma condição verdadeira no momento e o relato não altera a simulação.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {setAttemptSink, describe, REASONS} from '../src/sim/attempts.js';
import {cancelWindow} from '../src/sim/controller.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
function setup(pos = [vec(0, -4), vec(0, 6)]) {
  resetConfig(defaults());const g = new Game();g.mode = 'inactive';g.reset({positions: pos});const log = [];
  setAttemptSink((f, e) => log.push({...e, tick: g.tick, text: describe(e)}));
  const step = (c = cmd()) => {const before = log.length;g.step(c, emptyCommand());return log.slice(before).filter(e => e.fighter === 0);};
  return {g, f: g.fighters[0], step, log};
}
const seen = new Set();const expect = (entries, kind, result, reason) => {const e = entries.find(x => x.kind === kind && x.result === result && (reason === undefined || x.reason === reason));assert.ok(e, `esperado ${kind}/${result}/${reason}; obtido ${JSON.stringify(entries.map(x => [x.kind, x.result, x.reason]))}`);if (reason) seen.add(reason);return e;};

{
  const {f, step} = setup();f.stamina = .6;f.regenBase = .6;f.regenAge = 0;
  const e = expect(step(cmd({tackle: true, move: vec(0, 1)})), 'tackle', 'buffered', 'stamina');
  assert.ok(e.detail.value < e.detail.required && !f.action, 'sem stamina: nenhuma ação começa');
  assert.match(e.text, /^X guardado no buffer: stamina insuficiente \(0,60 \/ 1,00\)/);
  for (let i = 0; i < 14; i++) step();
  const exp = setup.last = null;void exp;
}
{
  const {f, step, log} = setup();C.actions.buffer.window = 0;f.stamina = .6;f.regenBase = .6;
  const e = expect(step(cmd({tackle: true})), 'tackle', 'denied', 'stamina');assert.equal(e.text, 'X ignorado: stamina insuficiente (0,60 / 1,00)');void log;
  f.exhausted = true;f.stamina = 2;f.regenBase = 2;expect(step(cmd({dodge: true, move: vec(1, 0)})), 'dodge', 'denied', 'exhausted');assert.ok(!f.action);
}
ok('X/C sem stamina e exausto: “X ignorado: stamina insuficiente (0,60 / 1,00)”, valor atual × exigido, nenhuma ação');
{
  const {f, step} = setup();expect(step(cmd({tackle: true, move: vec(0, 1)})), 'tackle', 'executed');
  for (let i = 0; i < 6; i++) step();const el = f.action.elapsed;
  expect(step(cmd({tackle: true})), 'tackle', 'buffered', 'selfCancelX');assert.ok(f.action.kind === 'tackle' && f.action.elapsed > el, 'o tackle original continua');
}
{
  const {f, step, log} = setup();expect(step(cmd({dodge: true, move: vec(1, 0)})), 'dodge', 'executed');for (let i = 0; i < 3; i++) step();
  const e = expect(step(cmd({tackle: true})), 'tackle', 'buffered', 'cancelWindow');assert.ok(e.viaCancel);
  const [w0] = cancelWindow();assert.ok(e.detail.elapsed < w0 - 1e-9, 'antes da abertura da janela');assert.match(e.text, /abre em \d+ ms/);
  for (let i = 0; i < 14; i++) step();assert.ok(log.some(x => x.result === 'expired' && x.reason === 'cancelWindow'), 'buffer expira com o mesmo motivo');
  while (f.action?.kind === 'dodge' && f.action.elapsed < w0 + .01) step();
  if (f.action?.kind === 'dodge') {const ex = expect(step(cmd({tackle: true})), 'tackle', 'executed');assert.ok(ex.viaCancel && f.action.kind === 'tackle' && f.action.fromCancel);}
  C.actions.buffer.window = 0;expect(step(cmd({dodge: true})), 'dodge', 'denied');
}
{
  const {f, step} = setup();C.actions.buffer.window = 0;step(cmd({dodge: true, move: vec(1, 0)}));for (let i = 0; i < 3; i++) step();
  const e = expect(step(cmd({dodge: true, move: vec(-1, 0)})), 'dodge', 'denied', 'selfCancelC');assert.ok(e.detail.elapsed < e.detail.from);
  for (let i = 0; i < 3; i++) step();const c = expect(step(cmd({tackle: true})), 'tackle', 'denied', 'cancelWindow');assert.match(c.text, /^C → X negado: fora da janela de cancelamento/);void f;
}
ok('X durante X, C durante C, C → X fora da janela (com o tempo que falta) e expiração do buffer pelo mesmo motivo');
{
  const {f, step} = setup();C.actions.buffer.window = 0;f.action = {kind: 'recoil', elapsed: .05, heading: 0, startAngle: 0, hits: new Set(), offensive: false, from: null};
  const e = expect(step(cmd({tackle: true})), 'tackle', 'denied', 'recoil');assert.ok(e.detail.left > 0 && f.action?.kind === 'recoil');
  f.action = null;f.stun = .15;const b = expect(step(cmd({tackle: true})), 'tackle', 'buffered', 'guardStun');assert.ok(b.detail.left > 0 && f.bufferedTackle);
  let exec = null;for (let i = 0; i < 30 && !exec; i++) exec = step().find(x => x.kind === 'tackle' && x.result === 'executed');assert.ok(exec && /guard stun/.test(exec.note), 'X guardado sai quando o stun acaba');
}
{
  const {f, step} = setup();C.actions.buffer.window = 0;f.flight = {y: 1, vy: 0, horizontal: vec()};
  expect(step(cmd({tackle: true})), 'tackle', 'denied', 'airborne');f.flight = null;f.knockRecovery = .1;
  const e = expect(step(cmd({dodge: true})), 'dodge', 'denied', 'recovery');assert.ok(e.detail.left > 0);assert.match(e.text, /recuperação ativa/);
}
ok('recuo, guard stun (X guardado e liberado), no ar e em recuperação');
{
  const {f, step} = setup();f.perfectCooldown = 1;
  const r = step(cmd({guard: true, guardPressed: true}));expect(r, 'guard', 'executed');const p = expect(r, 'perfectGuard', 'denied', 'perfectCooldown');assert.ok(p.detail.left > 0 && f.perfectLeft === 0);
  step();step(cmd());for (let i = 0; i < 5; i++) step();
  step(cmd({tackle: true, move: vec(0, 1)}));for (let i = 0; i < 30; i++) step();f.perfectCooldown = 1;
  const t = expect(step(cmd({guard: true, guardPressed: true})), 'guard', 'denied', 'tackleNoGuard');assert.ok(f.action?.kind === 'tackle' && !f.guard, 'o tackle continua');void t;
  C.extras.toggles.enableTackle = 0;expect(step(cmd({tackle: true})), 'tackle', 'denied', 'disabled');
}
ok('defesa perfeita em recarga, defesa que não cancela o tackle e sistema desligado');
{
  const {f, step} = setup();f.stamina = 1.1;f.regenBase = 1.1;f.regenAge = 0;C.actions.buffer.window = 0;
  step(cmd({dodge: true, dodgeHeld: true, move: vec(1, 0)}));let e = null;
  for (let i = 0; i < 60 && !e; i++) e = step(cmd({dodgeHeld: true, move: vec(1, 0)})).find(x => x.kind === 'sprint');
  assert.ok(e && e.result === 'denied' && (e.reason === 'sprintStamina' || e.reason === 'exhausted') && !f.sprinting, JSON.stringify(e));seen.add(e.reason);
}
ok('sprint recusado por stamina abaixo do mínimo (uma vez por esquiva)');
{
  // Propriedade: em lutas IA × IA, todo motivo relatado é verdadeiro no estado do momento; executado ⇔ ação começou.
  resetConfig(defaults());let checked = 0;
  for (const seed of [1, 7, 42]) {
    const g = new Game({seed});g.brain.seed = seed;g.playerBrain.seed = seed + 1;g.mode = 'tactical';g.reset();const log = [];
    setAttemptSink((f, e) => log.push({e, f, before: {action: f.action, stamina: f.stamina}}));
    for (let t = 0; t < 2400 && g.phase === 'playing'; t++) {
      const k = log.length;g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step));
      for (const {e, f} of log.slice(k)) {
        checked++;const d = e.detail || {};
        if (e.reason === 'stamina' || e.reason === 'sprintStamina') assert.ok(d.value < d.required - 1e-9, JSON.stringify(e));
        if (['chain', 'recoil', 'guardStun', 'recovery', 'perfectCooldown'].includes(e.reason)) assert.ok(d.left > 0, JSON.stringify(e));
        if (e.reason === 'cancelWindow') assert.ok(d.elapsed < d.open[0] - 1e-9 || d.elapsed > d.open[1] + 1e-9, JSON.stringify(e));
        if (e.reason) assert.ok(REASONS[e.reason], 'motivo sem descrição: ' + e.reason);
        if (e.result === 'executed' && (e.kind === 'tackle' || e.kind === 'dodge')) assert.equal(f.action?.kind === e.kind || f.sprinting || !!f.flight || f.knockRecovery > 0 || f.action?.kind === 'recoil', true, JSON.stringify(e));
        if (e.result === 'denied' && (e.kind === 'tackle' || e.kind === 'dodge') && e.state !== undefined) assert.ok(!(f.action?.kind === e.kind && f.action.elapsed < 1e-9), 'negado não pode iniciar a ação');
      }
    }
  }
  console.log(`   ${checked} tentativas verificadas em 3 lutas IA × IA`);
}
ok('em lutas IA × IA, cada motivo relatado é uma condição verdadeira no momento da decisão');
{
  // O relato não altera a simulação: mesma luta com e sem ouvinte → estados idênticos a cada passo.
  for (const seed of [3, 11]) {
    const run = withSink => {resetConfig(defaults());setAttemptSink(withSink ? () => {} : null);const g = new Game({seed});g.brain.seed = seed;g.playerBrain.seed = seed + 9;g.mode = 'tactical';g.reset();const states = [];
      for (let t = 0; t < 1800 && g.phase === 'playing'; t++) {g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step));if (t % 60 === 0) states.push(JSON.stringify(g.fighters));}return states.join('|') + JSON.stringify(g.fighters);};
    assert.equal(run(true), run(false));
  }
  setAttemptSink(null);
}
ok('diagnóstico ligado ou desligado: simulação idêntica');
const covered = ['stamina', 'exhausted', 'selfCancelX', 'cancelWindow', 'selfCancelC', 'recoil', 'guardStun', 'airborne', 'recovery', 'perfectCooldown', 'tackleNoGuard', 'disabled'].filter(r => seen.has(r));
console.log(`   motivos exercitados: ${[...seen].join(', ')} (${covered.length})`);
resetConfig(defaults());
console.log(`\n${n} verificações do diagnóstico aprovadas.`);
