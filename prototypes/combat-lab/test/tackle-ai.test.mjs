// Fase 4 do Tackle: a IA usa o tackle carregado, a finta e foge do wall-splat. Sem navegador.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
function arena(blue, red, over = {}) {
  resetConfig(defaults());for (const [p, v] of Object.entries(over)) {const k = p.split('.'), last = k.pop();k.reduce((a, x) => a[x], C)[last] = v;}
  const g = new Game({seed: 3});g.mode = 'inactive';g.reset({positions: [blue, red]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;g.playerBrain.cooldown = 0;return g;
}
const ai = g => g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step);

// ---------- Carga à distância ----------
{
  let charged = false, firedPL = 0, g;
  for (const d of [6.5, 8, 7, 6.8]) {
    g = arena(vec(0, -d / 2), vec(0, d / 2), {'extras.ai.chargeChance': 1, 'extras.toggles.enableSprint': 0});charged = false;firedPL = 0;
    for (let i = 0; i < 900 && !firedPL; i++) {g.step(ai(g), cmd());if (g.fighters[0].tackleCharge) charged = true;if (g.fighters[0].action?.kind === 'tackle' && (g.fighters[0].action.pl ?? 1) > 1) firedPL = g.fighters[0].action.pl;}
    if (firedPL) break;
  }
  assert.ok(charged && firedPL >= 2, `a IA carrega e dispara PL2+ contra um alvo parado fora do alcance normal (PL${firedPL})`);
  ok('a IA carrega o tackle (PL2/PL3) a uma distância segura');
  const off = arena(vec(0, -3.5), vec(0, 3.5), {'extras.ai.useCharge': 0});let any = false;
  for (let i = 0; i < 500; i++) {off.step(ai(off), cmd());if (off.fighters[0].tackleCharge) any = true;}
  assert.ok(!any, 'com o toggle da IA desligado ela não carrega');
  ok('o toggle "IA usa o tackle carregado" desliga o comportamento');
}

// ---------- Finta ----------
{
  const g = arena(vec(0, -2), vec(0, 2), {'extras.ai.feintChance': 1}), f = g.fighters[0], r = g.fighters[1];
  g.step(cmd({tackle: true, move: vec(0, 1)}), cmd());
  r.guard = true;r.perfectLeft = .15;
  const c = ai(g);assert.ok(f.action?.kind === 'tackle' && f.action.elapsed < C.rules.feintWindow);
  assert.ok(c.dodge, 'a IA finta quando o rival abre a defesa perfeita durante o seu startup');
  const g2 = arena(vec(0, -2), vec(0, 2), {'extras.ai.feintChance': 1, 'extras.ai.useFeint': 0});g2.step(cmd({tackle: true, move: vec(0, 1)}), cmd());g2.fighters[1].guard = true;g2.fighters[1].perfectLeft = .15;
  assert.ok(!ai(g2).dodge, 'com o toggle da IA desligado ela não finta');
  ok('a IA finta o próprio tackle quando o rival abre a defesa perfeita (e respeita o toggle)');
}

// ---------- Fuga do wall-splat ----------
{
  const wall = (C.map?.arenaShape === 'square' ? C.test.arenaHalf : (C.map?.arenaRadius ?? 50));
  const g = arena(vec(wall - 1.5, 0), vec(-6, 0));C.extras.toggles.enableFlightSlam = 1;const f = g.fighters[0];
  f.flight = {y: 1.2, vy: -3, horizontal: vec(11, 0)};f.state = 'airborne';
  const c = ai(g);assert.ok(c.tackle, 'caindo em direção à parede: a IA mergulha (X) para escapar do splat');
  g.step(c, cmd());assert.ok(!f.flight && f.action?.slam, 'o mergulho tirou do voo');
  const g2 = arena(vec(0, 0), vec(-6, 0));g2.fighters[0].flight = {y: 1.2, vy: -3, horizontal: vec(11, 0)};g2.fighters[0].state = 'airborne';
  assert.ok(!ai(g2).tackle, 'longe da parede ela não gasta stamina mergulhando');
  const g3 = arena(vec(wall - 1.5, 0), vec(-6, 0), {'extras.ai.wallEscape': 0});g3.fighters[0].flight = {y: 1.2, vy: -3, horizontal: vec(11, 0)};g3.fighters[0].state = 'airborne';
  assert.ok(!ai(g3).tackle, 'toggle desligado: sem fuga');
  ok('a IA escapa do wall-splat mergulhando só quando o voo vai bater na parede caindo');
}
console.log(`\n${n} verificações da IA com carga, finta e fuga da parede (fase 4) aprovadas.`);
