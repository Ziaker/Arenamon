// Testes de propriedade: milhares de situações aleatórias (comandos, perfis e ajustes de X/C sorteados) verificando
// regras que nunca podem falhar, passo a passo. Uma falha mostra a semente e o passo para reproduzir.
// Uso: node prototypes/combat-lab/test/properties.test.mjs [execuções] [passos]
import assert from 'node:assert/strict';
import {Game} from '../src/sim/game.js';
import {C, resetConfig} from '../src/sim/config.js';
import {isInvulnerable} from '../src/sim/entity.js';

const RUNS = Number(process.argv[2]) || 200, TICKS = Number(process.argv[3]) || 2400;
const DAMAGE = new Set(['impact', 'partial', 'clash']);

function rng(seed) {let s = seed >>> 0;return () => {s = (s * 1664525 + 1013904223) >>> 0;return s / 4294967296;};}
/** Ajustes sorteados dentro das faixas do ajustador (X e C independentes, cancelamento e buffer). */
function perturb(rand) {
  const A = C.actions, pick = (lo, hi) => lo + (hi - lo) * rand();
  for (const k of ['dodge', 'tackle']) Object.assign(A[k], {duration: pick(.2, .7), cost: pick(.5, 1.5), invulnerable: pick(0, .35), distance: pick(1.5, 3.5), curveStart: pick(1, 2.5), chainAfter: pick(.05, .4), recovery: rand() < .3 ? pick(0, .2) : 0});
  Object.assign(A.cancel, {dodgeToTackle: rand() < .85 ? 1 : 0, windowStart: pick(0, .2), windowEnd: pick(.2, .6), transition: pick(0, .15), velocityInfluence: pick(0, 1), airDescent: pick(0, .3), invulnerability: Math.floor(rand() * 3)});
  A.buffer.window = rand() < .2 ? 0 : pick(0, .2);A.tackle.fromRecoil = rand() < .2 ? 1 : 0;A.tackle.fromGuardStun = rand() < .2 ? 1 : 0;
}
function commands(rand, game, id, hold) {
  const me = game.fighters[id], other = game.fighters[1 - id];
  const dx = other.position.x - me.position.x, dz = other.position.z - me.position.z, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d;
  if (!hold[id] || rand() < .08) {const k = rand();hold[id] = {kind: k < .5 ? 'toward' : k < .7 ? 'side' : k < .9 ? 'free' : 'stop', a: rand() * Math.PI * 2, guard: rand() < .15, sign: rand() < .5 ? -1 : 1};}
  const h = hold[id], near = d < 4, r = rand();
  const move = h.kind === 'toward' ? {x: fx, z: fz} : h.kind === 'side' ? {x: fz * h.sign, z: -fx * h.sign} : h.kind === 'free' ? {x: Math.sin(h.a), z: Math.cos(h.a)} : {x: 0, z: 0};
  const c = {move, dodge: near ? r < .04 : r < .006, tackle: near ? r > .92 : r > .996, guard: h.guard, guardPressed: false, target: rand() < .8 ? 1 - id : null};
  if (c.tackle && rand() < .7) c.move = {x: fx, z: fz};
  if (c.dodge && rand() < .5) {const a = rand() * Math.PI * 2;c.dodgeDirection = {x: Math.sin(a), z: Math.cos(a)};}
  c.guardPressed = c.guard && rand() < .3;return c;
}

const stats = {runs: 0, tactical: 0, ticks: 0, events: {}, cancels: 0, buffered: 0, vaults: 0};
function run(seed) {
  resetConfig();const rand = rng(seed);perturb(rand);
  const tactical = Math.floor(seed / 104729) % 3 === 0;stats.tactical += tactical ? 1 : 0;
  const g = new Game({seed});g.mode = tactical ? 'tactical' : 'inactive';g.profile = ['balanced', 'agile', 'resistant'][seed % 3];g.enemyProfile = ['agile', 'resistant', 'balanced'][seed % 3];g.reset();
  const hold = [null, null], hitsPerAction = new Map(), bound = C.test.arenaHalf - C.test.halfExtent + 1e-6;
  const fail = (t, msg, extra = '') => assert.fail(`semente ${seed}, passo ${t}: ${msg} ${extra}`);
  for (let t = 0; t < TICKS; t++) {
    const before = g.fighters.map(f => ({kind: f.action?.kind ?? null, action: f.action, invulnerable: isInvulnerable(f), hp: f.hp, feints: f.feints ?? 0}));
    // Um terço das execuções usa a IA tática nos dois lados (comandos “inteligentes” em vez de aleatórios).
    if (tactical) g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step));
    else g.step(commands(rand, g, 0, hold), commands(rand, g, 1, hold));
    const after = g.fighters.map(f => ({kind: f.action?.kind ?? null, action: f.action}));
    for (const f of g.fighters) {
      for (const v of [f.position.x, f.position.z, f.velocity.x, f.velocity.z, f.stamina, f.hp, f.vaultHeight, f.flight?.y ?? 0]) if (!Number.isFinite(v)) fail(t, 'valor não finito', JSON.stringify(f.position));
      if (Math.abs(f.position.x) > bound || Math.abs(f.position.z) > bound) fail(t, `lutador ${f.id} fora da arena`, JSON.stringify(f.position));
      if (f.stamina < -1e-9 || f.stamina > C.rules.staminaMax + 1e-9) fail(t, `stamina fora de [0, máx]: ${f.stamina}`);
      if (f.hp < 0 || f.hp > f.attributes.hp) fail(t, `HP fora da faixa: ${f.hp}`);
      // Limite proporcional à configuração sorteada: a distância nominal é fixa (tempo de referência), então ações
      // curtas são mais rápidas; o pico da curva em fases fica abaixo de ~3× a velocidade média.
      const vmax = Math.max(80, ...['dodge', 'tackle'].map(k => 3.2 * C.actions[k].distance * (C.actions[k].distanceReference || C.actions[k].duration) * 6 * C.actions.tackle.counterSpeed / C.actions[k].duration));
      if (Math.hypot(f.velocity.x, f.velocity.z) > vmax) fail(t, `velocidade absurda: ${Math.hypot(f.velocity.x, f.velocity.z)} (limite ${vmax.toFixed(1)})`);
      if (f.vaultHeight < -1e-9 || f.vaultHeight > C.actions.dodge.vaultHeight + 1e-6) fail(t, `altura de salto fora da faixa: ${f.vaultHeight}`);
      if (f.action?.fromCancel && f.action.kind === 'tackle' && f.action.elapsed <= C.test.step + 1e-9) stats.cancels++;
      if (f.action?.buffered && f.action.elapsed <= C.test.step + 1e-9) stats.buffered++;
      if (f.action?.vault && f.action.elapsed <= C.test.step + 1e-9) stats.vaults++;
    }
    for (const e of g.lastStepEvents) {
      stats.events[e.result] = (stats.events[e.result] || 0) + 1;
      const a = e.attacker, b = e.target;
      // C nunca causa dano: todo contato com dano vem de um X (antes ou depois do passo) ou de um X que virou recuo.
      if (e.damage > 0 && ![before[a].kind, after[a].kind].includes('tackle') && after[a].kind !== 'recoil' && e.result !== 'clash') fail(t, `dano sem X: ${e.result}`, `${before[a].kind}→${after[a].kind}`);
      if (e.damage > 0 && e.result !== 'clash' && (before[a].kind === 'dodge' && after[a].kind === 'dodge')) fail(t, 'esquiva causou dano');
      // Invulnerável não recebe dano de impacto.
      // Exceção legítima: no mesmo passo o alvo trocou C por X com “Invulnerabilidade no cancelamento” = nenhuma.
      const cancelledVulnerable = g.lastCommands?.[b]?.tackle && before[b].kind === 'dodge' && C.actions.cancel.invulnerability === 1;
      // Exceção legítima (tackle carregado): tackle de PL maior contra tackle de PL menor neutraliza o menor e tira a invulnerabilidade de início dele.
      const lostToPL = before[b].kind === 'tackle' && g.fighters[b].plDefeated === true;
      const feinted = (g.fighters[b].feints ?? 0) > before[b].feints;   // finta: cancelar o tackle tira a invulnerabilidade do startup no mesmo passo
      if (e.damage > 0 && e.result === 'impact' && before[b].invulnerable && !cancelledVulnerable && !lostToPL && !feinted) fail(t, 'dano em lutador invulnerável');
      // Um impacto por alvo por ação.
      if (DAMAGE.has(e.result) || e.result === 'perfect') {
        const act = after[a].kind === 'tackle' ? after[a].action : before[a].action;if (!act) continue;
        const key = `${b}`;let m = hitsPerAction.get(act);if (!m) hitsPerAction.set(act, m = new Set());
        if (m.has(key) && e.result !== 'clash') fail(t, `segundo contato da mesma ação no alvo ${b}`, e.result);m.add(key);
      }
      // Clash: os dois recebem a fração configurada do ataque do outro.
      if (e.result === 'clash' && Math.abs(e.damage - g.fighters[a].attributes.attack * C.rules.clashFraction) > 1e-9) fail(t, `dano de clash ${e.damage} ≠ 30% do ataque de ${a}`);
    }
    if (g.phase === 'result') g.reset();
  }
  stats.runs++;stats.ticks += TICKS;
  return JSON.stringify(g.save());
}

const t0 = Date.now();
for (let i = 1; i <= RUNS; i++) run(i * 104729);
// Determinismo: a mesma semente (com os mesmos ajustes sorteados) reproduz o mesmo estado final.
assert.equal(run(31337), run(31337), 'mesma semente, mesmo estado');
resetConfig();
console.log(`✓ ${stats.runs} execuções aleatórias (${stats.tactical} com a IA tática nos dois lados) · ${stats.ticks.toLocaleString('pt-BR')} passos · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`   eventos ${JSON.stringify(stats.events)} · C → X ${stats.cancels} · ações do buffer ${stats.buffered} · saltos ${stats.vaults}`);
assert.ok(stats.cancels > 20 && stats.buffered > 20 && stats.vaults > 5 && stats.events.clash > 5, 'cobertura mínima: cancelamentos, buffer, saltos e clashes exercitados');
console.log('Propriedades: sem NaN, dentro da arena, stamina/HP/altura na faixa, C sem dano, invulnerável sem dano, um contato por ação, clash = 30%, determinismo.');
