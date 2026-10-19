// Regras pedidas em 15/10/2026: cancelamentos do tackle e da esquiva, exaustão, tackle guiado pelo lock-on,
// orientação estrita com lock-on, rebote vertical na parede e salto físico sobre o rival.
// Uso: node prototypes/combat-lab/test/rules.test.mjs
import assert from 'node:assert/strict';
import {Game} from '../src/sim/game.js';
import {C, resetConfig} from '../src/sim/config.js';
import {cancelWindow} from '../src/sim/controller.js';
import {SCENARIOS, runScenario} from '../src/sim/scenarios.js';
import {vec, angleOf, sub} from '../src/sim/math.js';

let passed = 0, checks = 0;
const check = (label, ok, detail = '') => {checks++;assert.ok(ok, `${label} ${detail}`);};
function test(name, fn) {resetConfig();fn();passed++;console.log('✓', name);}
const cmd = (o = {}) => ({move: vec(), dodge: false, dodgeHeld: false, tackle: false, guard: false, guardPressed: false, target: null, locked: false, ...o});
const STEP = () => C.test.step, ticks = s => Math.round(s / STEP());
function setup(p0 = vec(0, -8), p1 = vec(6, 8)) {
  const g = new Game();g.mode = 'inactive';g.reset({positions: [p0, p1]});for (const f of g.fighters) {f.facing = 0;f.visualFacing = 0;}return g;
}
const run = (g, n, script) => {for (let t = 0; t < n; t++) {const [a, b] = script(t, g);g.step(a ?? cmd(), b ?? cmd());}};

test('X não cancela o próprio X; com o toggle, cancela', () => {
  let g = setup(), starts = 0, prev = null;
  run(g, 140, (t, g) => {const a = g.fighters[0].action;if (a && a !== prev && a.kind === 'tackle') starts++;prev = a;return [cmd({move: vec(0, 1), tackle: t === 2 || t === 25})];});
  check('um único tackle', starts === 1, `${starts}`);
  resetConfig();C.actions.tackle.selfCancel = 1;g = setup();starts = 0;prev = null;
  run(g, 140, (t, g) => {const a = g.fighters[0].action;if (a && a !== prev && a.kind === 'tackle') starts++;prev = a;return [cmd({move: vec(0, 1), tackle: t === 2 || t === 25})];});
  check('com o toggle: dois tackles', starts === 2, `${starts}`);
});
test('defesa não cancela o tackle (padrão); toque de defesa perfeita cancela; toggle liga o cancelamento', () => {
  const mid = ticks(C.actions.tackle.chainAfter) + 10;
  let g = setup();run(g, mid, (t) => [cmd({move: vec(0, 1), tackle: t === 2, guard: t > 20})]);
  check('segurar D: tackle continua', g.fighters[0].action?.kind === 'tackle' && !g.fighters[0].guard);
  g = setup();run(g, mid, (t) => [cmd({move: vec(0, 1), tackle: t === 2, guard: t >= mid - 2, guardPressed: t === mid - 2})]);
  check('toque com defesa perfeita disponível: cancela e abre a janela perfeita', !g.fighters[0].action && g.fighters[0].guard && g.fighters[0].perfectLeft > 0);
  resetConfig();C.actions.tackle.perfectGuardCancel = 0;g = setup();run(g, mid, (t) => [cmd({move: vec(0, 1), tackle: t === 2, guard: t >= mid - 2, guardPressed: t === mid - 2})]);
  check('sem a opção de defesa perfeita: toque não cancela', g.fighters[0].action?.kind === 'tackle');
  resetConfig();C.actions.tackle.guardCancel = 1;g = setup();run(g, mid, (t) => [cmd({move: vec(0, 1), tackle: t === 2, guard: t > 20})]);
  check('toggle “Defesa cancela o tackle” ligado: segurar D cancela', !g.fighters[0].action && g.fighters[0].guard);
});
test('C → X só nos últimos segundos da esquiva; depois de esquiva perfeita, a qualquer momento', () => {
  const [w0, w1] = cancelWindow();check('janela no fim da esquiva', Math.abs(w1 - C.actions.dodge.duration) < 1e-9 && Math.abs(w1 - w0 - C.actions.cancel.fromEnd) < 1e-9, `${w0}–${w1}`);
  let g = setup();run(g, 12, (t) => [cmd({move: vec(1, 0), dodge: t === 2, dodgeDirection: vec(1, 0), tackle: t === 10})]);
  check('X no início da esquiva é ignorado', g.fighters[0].action?.kind === 'dodge');
  g = setup();const late = 2 + ticks(w0) + 2;run(g, late + 2, (t) => [cmd({move: vec(1, 0), dodge: t === 2, dodgeDirection: vec(1, 0), tackle: t === late})]);
  check('X no fim da esquiva sai como cancelamento', g.fighters[0].action?.kind === 'tackle' && g.fighters[0].action.fromCancel);
  g = setup();run(g, 8, (t, g) => {if (t === 6) g.fighters[0].counterWindow = .5;return [cmd({move: vec(1, 0), dodge: t === 2, dodgeDirection: vec(1, 0), tackle: t === 7})];});
  check('após esquiva perfeita (janela de contra-ataque aberta): X sai já no início', g.fighters[0].action?.kind === 'tackle' && g.fighters[0].action.fromCancel);
});
test('C só cancela C nos últimos segundos', () => {
  let g = setup();const early = 2 + ticks(C.actions.dodge.chainAfter) + 2;let starts = 0, prev = null;
  run(g, early + 4, (t, g) => {const a = g.fighters[0].action;if (a && a !== prev) starts++;prev = a;return [cmd({move: vec(1, 0), dodge: t === 2 || t === early, dodgeDirection: vec(1, 0)})];});
  check('C no meio da esquiva é ignorado', starts === 1, `${starts}`);
  g = setup();const late = 2 + ticks(C.actions.dodge.duration - C.actions.dodge.selfCancelFromEnd) + 1;starts = 0;prev = null;
  run(g, late + 4, (t, g) => {const a = g.fighters[0].action;if (a && a !== prev) starts++;prev = a;return [cmd({move: vec(1, 0), dodge: t === 2 || t === late, dodgeDirection: vec(1, 0)})];});
  check('C nos últimos segundos encadeia', starts === 2, `${starts}`);
});
test('exaustão: ao sobrar menos que o menor custo (ex.: máximo 5,1 e custo 1)', () => {
  C.rules.staminaMax = 5.1;const g = setup();g.fighters[0].stamina = 5.1;g.fighters[0].regenBase = 5.1;C.rules.regenDelay = 99;
  const at = [2, 60, 118, 176, 234];run(g, 300, (t) => [cmd({move: vec(1, 0), dodge: at.includes(t), dodgeDirection: vec(1, 0)})]);
  const f = g.fighters[0];check('cinco esquivas deixam 0,1 e o lutador exausto', Math.abs(f.stamina - .1) < .02 && f.exhausted, `${f.stamina.toFixed(2)} exausto=${f.exhausted}`);
  resetConfig();C.rules.staminaMax = 5.1;C.rules.exhaustMode = 0;const g2 = setup();g2.fighters[0].stamina = 5.1;g2.fighters[0].regenBase = 5.1;C.rules.regenDelay = 99;
  run(g2, 300, (t) => [cmd({move: vec(1, 0), dodge: at.includes(t), dodgeDirection: vec(1, 0)})]);
  check('modo Etapa A: não fica exausto com 0,1', !g2.fighters[0].exhausted);
});
test('lock-on: tackle segurando ↓ (ou C → X) vai rumo ao oponente', () => {
  const g = setup(vec(0, 0), vec(4, 4));let heading = null;
  run(g, 4, (t, g) => {if (g.fighters[0].action && heading === null) heading = g.fighters[0].action.heading;return [cmd({move: vec(0, -1), tackle: t === 1, target: 1, locked: true})];});
  const want = angleOf(sub(vec(4, 4), vec(0, 0)));check('rumo ao oponente', Math.abs(Math.atan2(Math.sin(heading - want), Math.cos(heading - want))) < .02, `${heading} × ${want}`);
  const g2 = setup(vec(0, 0), vec(4, 4));let h2 = null;run(g2, 4, (t, g) => {if (g.fighters[0].action && h2 === null) h2 = g.fighters[0].action.heading;return [cmd({move: vec(0, -1), tackle: t === 1})];});
  check('sem lock-on: direção pedida (para trás)', Math.abs(Math.abs(h2) - Math.PI) < .02, `${h2}`);
});
test('lock-on “sempre para o alvo”: corpo virado para o oponente também no sprint', () => {
  C.locomotion.lockFacing = 1;const g = setup(vec(0, -6), vec(0, 6));
  run(g, 200, (t) => [cmd({move: vec(1, 0), dodge: t === 2, dodgeDirection: vec(1, 0), dodgeHeld: true, target: 1, locked: true})]);
  const f = g.fighters[0], want = angleOf(sub(g.fighters[1].position, f.position));
  check('sprint ativo e corpo para o alvo', f.sprinting && Math.abs(Math.atan2(Math.sin(f.facing - want), Math.cos(f.facing - want))) < .1, `sprint=${f.sprinting} Δ=${(f.facing - want).toFixed(2)}`);
});
test('rebote na parede: horizontal e vertical configuráveis', () => {
  C.extras.toggles.enableWallSplat = 0;   // regra antiga do ricochete; o wall-splat (caindo) tem teste próprio
  C.rules.wallBounceUp = 6;C.rules.wallBounceVertical = 0;const g = setup(vec(0, 0), vec(6, 0));const f = g.fighters[0];
  const bound = (C.map?.arenaShape === 'square' ? C.test.arenaHalf : (C.map?.arenaRadius ?? 50)) - C.test.halfExtent;
  f.position = vec(bound - .05, 0);f.flight = {y: 1, vy: -2, horizontal: vec(10, 0)};
  g.step(cmd(), cmd());
  check('vertical = impulso (velocidade vertical zerada × 0 + 6)', Math.abs(f.flight.vy - (6 - C.rules.launchGravity * STEP())) < .3, `${f.flight?.vy}`);
  check('horizontal invertida pela restituição', f.flight.horizontal.x < 0);
});
test('salto sobre o rival: pulo físico (impulso, gravidade, horizontal) que termina ao tocar o chão', () => {
  const D = C.actions.dodge, g = setup(vec(0, 0), vec(0, 2));let peak = 0, airTicks = 0, end = null, x0 = 0;
  run(g, 120, (t, g) => {const f = g.fighters[0];if (f.action?.jump) {peak = Math.max(peak, f.vaultHeight);airTicks++;} else if (airTicks && end === null) end = {z: f.position.z, t};return [cmd({move: vec(0, 1), dodge: t === 1, dodgeDirection: vec(0, 1)})];});
  const tFlight = 2 * D.vaultUp / D.vaultGravity, hPeak = D.vaultUp ** 2 / (2 * D.vaultGravity);
  check('altura máxima = impulso² ÷ 2g', Math.abs(peak - hPeak) < .03, `${peak.toFixed(3)} × ${hPeak.toFixed(3)}`);
  check('tempo de voo = 2·impulso ÷ g (termina ao pousar, não pela duração)', Math.abs(airTicks * STEP() - tFlight) < 3 * STEP(), `${(airTicks * STEP()).toFixed(3)} × ${tFlight.toFixed(3)}`);
  check('passa por cima do rival e segue em frente', end && end.z > 2 + 2 * C.test.halfExtent, `${end?.z.toFixed(2)}`);void x0;
});
test('cenários adaptativos: os 8 passam no padrão e com uma calibração de durações longas e stamina fracionária', () => {
  const runAll = () => SCENARIOS.slice(0, 8).map(d => runScenario(d)).filter(r => !r.ok).map(r => r.id + ': ' + r.checks.filter(c => !c.ok).map(c => c.label).join(', '));
  let bad = runAll();check('padrão', !bad.length, bad.join(' | '));
  // Calibração parecida com a do usuário (15/10/2026): X e C longos, recuperações, stamina 5,1, regeneração rápida, lançamento forte.
  Object.assign(C.actions.dodge, {duration: .69, distance: 2.2, recovery: .13});Object.assign(C.actions.tackle, {duration: .96, invulnerable: 0, distance: 1.65, recovery: .24, fromGuard: 0});
  Object.assign(C.rules, {recoil: .818, guardStun: .818, staminaMax: 5.1, regenDelay: .35, regenTime: 2.5, launchGravity: 24.6, launchUp: 5.5, launchHorizontal: 26, launchDrag: 3.05, landingRecovery: 1, wallRestitution: .87});
  bad = runAll();check('calibração longa', !bad.length, bad.join(' | '));
});
console.log(`\n${passed} testes de regras aprovados · ${checks} verificações.`);
