// Fase 5 (plano de Reflect/Psyshock) — IA tática com Moves, sem navegador. Cobre M15.7–M15.8, M27.6 e a regra “a IA obedece às mesmas
// restrições do jogador”. Sem Moves equipados a IA é idêntica à anterior (os testes `ai` e `ai-eval` e a impressão digital cobrem isso).
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {clearMoves} from '../src/sim/moves.js';
import {clearEffects} from '../src/sim/move-effects.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {spawn} from '../src/sim/world.js';
import {setAttemptSink} from '../src/sim/attempts.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const cmd = o => ({...emptyCommand(), ...o});
registerStandardMoves();
const events = [], denied = [];
/** Duelo: o azul é a IA tática do jogador (equipada); o vermelho, parado ou também com a IA. */
function duel({seed = 3, blue = vec(0, -6), red = vec(0, 6), redAI = false, equipBlue = true, equipRed = false} = {}) {
  resetConfig(defaults());events.length = 0;denied.length = 0;
  const g = new Game({seed});g.brain.seed = seed;g.playerBrain.seed = seed + 11;g.mode = redAI ? 'tactical' : 'inactive';g.reset({positions: [blue, red]});
  if (equipBlue) g.setLoadout(0, ['reflect', 'psyshock']);if (equipRed) g.setLoadout(1, ['reflect', 'psyshock']);return g;
}
const stepAI = (g, red = null) => {g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step), red ?? undefined);events.push(...g.lastStepEvents);};

// ---------- Ofensiva: Psyshock à distância, com as mesmas restrições do jogador ----------
{
  const g = duel();setAttemptSink((f, e) => {if (e.kind === 'skill' && e.result === 'denied') denied.push(`${e.reason}`);});
  let minStamina = 9, fired = 0;
  for (let i = 0; i < 2400; i++) {stepAI(g);minStamina = Math.min(minStamina, g.fighters[0].stamina);if (events.at(-1)?.result === 'chargeRelease') fired++;}
  setAttemptSink(null);
  assert.ok(events.some(e => e.result === 'chargeStart' && e.attacker === 0 && e.move === 'psyshock'), 'a IA carrega o Psyshock');
  assert.ok(events.some(e => e.result === 'chargeRelease' && e.attacker === 0) && events.some(e => e.result === 'spawn' && e.attacker === 0 && e.kind === 'projectile'), 'e dispara as pedras');
  assert.ok(g.fighters[1].hp < 100, 'que atingem o adversário parado');
  assert.ok(minStamina >= 0, 'nunca stamina negativa');
  const bad = denied.filter(r => ['cooldown', 'stamina', 'exhausted', 'noGround', 'moveRecovery', 'chain', 'charging'].includes(r));
  assert.equal(bad.length, 0, `a IA não pede o que o motor negaria (${[...new Set(denied)]})`);
  const mv = g.playerBrain.t.mv;assert.ok(mv.log.length > 0 && mv.log.every(e => typeof e.why === 'string'), 'decisões em telemetria opcional');
  assert.ok(mv.log.some(e => e.move === 'psyshock' && e.pl >= 1), 'com o Power Level escolhido');
}
ok('a IA carrega e dispara o Psyshock de longe, sem negações do motor (stamina, recarga, recuperação, apoio) e com decisões registradas na telemetria');
{
  const lv = (() => {const set = new Set();for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {const g = duel({seed});for (let i = 0; i < 1800; i++) stepAI(g);g.playerBrain.t.mv.log.filter(e => e.move === 'psyshock').forEach(e => set.add(e.pl));}return [...set].sort();})();
  assert.ok(lv.length >= 2, `a IA varia o Power Level conforme a situação e a semente (${lv})`);
}
ok('a IA escolhe PL1, PL2 ou PL3 de forma contextual (varia com a semente e a situação)');

// ---------- Defesa: Reflect reativo, só quando dá tempo de chegar ao PL do projétil ----------
{
  const g = duel({blue: vec(0, 6), red: vec(0, -6)});g.fighters[0].facing = Math.PI;g.fighters[1].facing = 0;                       // azul (IA) defende contra pedras vindas do vermelho
  // pedra PL1 hostil a ~2,0 s do impacto (permite carga mínima de 1,5 s do Reflect)
  spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: -14}, dir: {x: 0, z: 1}, speed: 10, y: .65, radius: .2, life: 5, pierce: 1, pl: 1, clashable: true, hit: {damage: 5}}, []);
  for (let i = 0; i < 40; i++) stepAI(g);
  assert.ok(events.some(e => e.result === 'chargeStart' && e.attacker === 0 && e.move === 'reflect'), 'a IA começa o Reflect ao ver um projétil hostil');
  const log = g.playerBrain.t.mv.log.find(e => e.move === 'reflect');assert.ok(log && log.pl === 1);
  for (let i = 0; i < 220; i++) stepAI(g);
  assert.ok(g.world.entities.some(e => e.reflect && e.owner === 0) || events.some(e => e.result === 'reflected'), 'a barreira aparece antes do impacto ou o projétil é refletido');
  assert.equal(g.fighters[0].hp, 100, 'sem dano');
}
ok('projétil hostil a caminho: a IA carrega o Reflect a tempo e não leva o dano');
{
  const g = duel({blue: vec(0, 6), red: vec(0, -6)});g.fighters[0].facing = Math.PI;
  spawn(g.world, {kind: 'projectile', owner: 1, pos: {x: 0, z: 2.6}, dir: {x: 0, z: 1}, speed: 14, y: .65, radius: .2, life: 3, pierce: 1, pl: 3, clashable: true, hit: {damage: 5}}, []);   // PL3 chega em ~0,2 s
  for (let i = 0; i < 40; i++) stepAI(g);
  assert.ok(!events.some(e => e.result === 'chargeStart' && e.move === 'reflect'), 'sem tempo para chegar ao PL3: não gasta stamina com um Reflect que seria destruído');
}
ok('projétil de PL alto e sem tempo: a IA não carrega um Reflect inútil (uma barreira de PL menor seria destruída)');

// ---------- Barreira do adversário no caminho ----------
{
  const g = duel({blue: vec(0, -3), red: vec(0, 4)});
  const bar = spawn(g.world, {kind: 'barrier', owner: 1, shape: 'box', pos: {x: 0, z: -.2}, angle: Math.PI, hx: 3, hz: .05, y: 0, height: 3, life: 30, hp: Infinity, blocksProjectiles: true, blocksFighters: true, blocksOwner: true, reflect: true, shields: true, breakableByTackle: true, pl: 3,
    captured: {tackleRecoil: .15, tackleStagger: .25, tieTolerance: .001, maxReflections: 16}}, []);
  for (let i = 0; i < 1500 && !bar.dead; i++) stepAI(g);
  assert.ok(g.playerBrain.t.mv.log.some(e => e.why === 'destruir barreira do adversário'), 'decide destruir a barreira');
  assert.ok(events.some(e => e.result === 'barrierBroken' && e.by === 'tackle'), 'e a destrói com Tackle');
}
ok('com a barreira do adversário no caminho, a IA a destrói com Tackle em vez de atirar contra ela');

// ---------- Duelo completo e determinismo ----------
{
  const run = () => {
    const g = duel({seed: 5, blue: vec(0, -5), red: vec(0, 5), redAI: true, equipRed: true});let min = 9, max = 0;
    for (let i = 0; i < 2400 && g.phase === 'playing'; i++) {stepAI(g);for (const f of g.fighters) {min = Math.min(min, f.stamina);max = Math.max(max, f.stamina);}}
    const casts = [0, 1].map(id => events.filter(e => e.result === 'chargeRelease' && e.attacker === id).length);
    return {min, max, casts, hp: g.fighters.map(f => f.hp), phase: g.phase, tick: g.tick};
  };
  const a = run(), b = run();
  assert.deepEqual(a, b, 'determinismo: mesma semente, mesmo duelo');
  assert.ok(a.min >= 0 && a.max <= C.rules.staminaMax + 1e-9, 'stamina sempre dentro dos limites');
  assert.ok(a.casts[0] > 0 && a.casts[1] > 0, `as duas IAs usam os Moves (${a.casts})`);
}
ok('duelo IA × IA com Moves: determinístico, stamina nos limites e as duas IAs usam os Moves');
{
  const g = duel({seed: 7});for (let i = 0; i < 700; i++) stepAI(g);
  const h = new Game();h.mode = 'inactive';h.load(g.save());
  const run = x => {for (let i = 0; i < 600; i++) {x.step(x.playerBrain.command(x.fighters[0], x.fighters[1], 'tactical', C.test.step));}return JSON.stringify({f: x.fighters, w: x.world, t: x.playerBrain.t?.mv});};
  assert.equal(run(g), run(h), 'save/load no meio de uma decisão da IA reproduz o mesmo duelo');
}
ok('save/load preserva o estado da IA com Moves (decisões e carga em curso)');
{
  const g = duel({equipBlue: false});for (let i = 0; i < 600; i++) stepAI(g);
  assert.ok(!g.playerBrain.t.mv, 'sem Moves equipados a IA não cria estado de Moves nem consome sorteios');
}
ok('sem Moves equipados a IA não muda');

clearMoves();clearEffects();resetConfig(defaults());
console.log(`\n${n} verificações da IA com Moves (Fase 5) aprovadas.`);
