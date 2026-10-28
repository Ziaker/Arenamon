// @ts-check
// F3.4 — CombatEvent normalizado: todo evento que sai de Game.step leva os campos canônicos (eventId, outcome, attackerId, targetId,
// indirectAttackerId, sourceKind, position, normal, rawDamage, hpDamage, shieldAbsorbed) e passa no validador. Os campos legados ficam.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {C, defaults, factoryDefaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {SCENARIOS, runScenario} from '../src/sim/scenarios.js';
import {runMoveScenarios} from '../src/sim/scenarios-moves.js';
import {applyStatus} from '../src/sim/status.js';
import {applyReaction} from '../src/sim/resolvers/reaction-resolver.js';
import {sandDisplacementPolicy} from '../src/sim/sand.js';
import {collideMapFighter} from '../src/sim/map.js';
import {normalizeCombatEvent, validateCombatEvent, SOURCE_KINDS} from '../src/sim/events/combat-event.js';

registerStandardMoves();

test('normalização: deriva os campos canônicos sem apagar os legados; idempotente', () => {
  const e = normalizeCombatEvent({id: 7, eventId: 70, tick: 3, result: 'impact', attacker: 0, target: 1, damage: 12, rawDamage: 15, hpDamage: 12, shieldAbsorbed: 3, sourceKind: 'direct', normal: {x: 0, z: 1}});
  assert.equal(e.eventId, 70, 'eventId não é o id legado');assert.equal(e.id, 7);assert.equal(e.outcome, 'impact');assert.equal(e.attackerId, 0);assert.equal(e.targetId, 1);assert.equal(e.indirectAttackerId, null);
  assert.equal(e.sourceKind, 'direct');assert.equal(e.position, null);assert.deepEqual(e.normal, {x: 0, z: 1});assert.equal(e.hpDamage, 12);assert.equal(e.rawDamage, 15);
  assert.equal(e.attacker, 0, 'legado intacto');assert.equal(e.result, 'impact');
  const snap = JSON.stringify(e);normalizeCombatEvent(e);assert.equal(JSON.stringify(e), snap, 'idempotente');
  assert.deepEqual(validateCombatEvent(e), []);
  const w = normalizeCombatEvent({id: 8, eventId: 80, tick: 3, result: 'wallSplat', category: 'environmental', attacker: null, indirectAttacker: 0, target: 1, damage: 0, normal: {x: 1, z: 0}});
  assert.equal(w.sourceKind, 'environmental');assert.equal(w.attackerId, null);assert.equal(w.indirectAttackerId, 0);assert.equal(w.hpDamage, 0);assert.equal(w.shieldAbsorbed, 0);
  const pos = {x: 2, z: -1}, d = normalizeCombatEvent({id: 'rock-1', eventId: 81, tick: 4, result: 'destructibleDestroyed', pos});
  assert.equal(d.sourceKind, 'system');assert.deepEqual(d.position, {x: 2, y: 0, z: -1});assert.notEqual(d.position, d.pos, 'cópia, sem alias');assert.deepEqual(pos, {x: 2, z: -1}, 'pos legado intacto');
  const legacyPos = {x: 1, y: 0.5, z: 2}, f = normalizeCombatEvent({id: 11, eventId: 82, tick: 4, result: 'footstool', attacker: 0, target: 1, damage: 0, position: legacyPos, x: 9, y: 9, z: 9});
  assert.equal(f.position, legacyPos, 'position legada nunca reescrita');assert.deepEqual(legacyPos, {x: 1, y: 0.5, z: 2});assert.equal(d.targetId, null);assert.equal(d.hpDamage, 0);
  const s = normalizeCombatEvent({id: 9, eventId: 83, tick: 5, result: 'statusApplied', attacker: 1, target: 0, damage: 0, status: 'poison'});
  assert.equal(s.sourceKind, 'status');
  const b = normalizeCombatEvent({id: 10, eventId: 84, tick: 5, result: 'bounceLand', attacker: 1, target: null, damage: 0, x: 1, z: 2});
  assert.deepEqual(b.position, {x: 1, y: 0, z: 2});assert.equal(b.sourceKind, 'system');
});

test('validador acusa violações', () => {
  const ok = () => normalizeCombatEvent({id: 1, eventId: 1, tick: 0, result: 'impact', attacker: 0, target: 1, damage: 5});
  assert.deepEqual(validateCombatEvent(ok()), []);
  const bad = (/** @type {(e: any) => void} */ mut, /** @type {RegExp} */ re) => {const e = ok();mut(e);const v = validateCombatEvent(e);assert.ok(v.some(m => re.test(m)), `${re}: ${JSON.stringify(v)}`);};
  bad(e => {e.eventId = null;}, /eventId/);
  bad(e => {e.eventId = 'dest_1';}, /eventId/);
  bad(e => {e.outcome = 'partial';}, /outcome/);
  bad(e => {e.attackerId = 1;}, /attackerId/);
  bad(e => {e.sourceKind = 'magic';}, /sourceKind/);
  bad(e => {e.sourceKind = 'environmental';}, /ambiental/);
  bad(e => {e.hpDamage = 4;}, /hpDamage/);
  bad(e => {e.position = {x: 0, y: NaN, z: 0};}, /position/);
  bad(e => {e.rawDamage = -1;}, /rawDamage/);
  bad(e => {e.tick = 1.5;}, /tick/);
  assert.ok(SOURCE_KINDS.includes('reflected'));
});

/** Instala uma sonda em Game.prototype.step que valida cada evento que sai do passo. */
function withProbe(/** @type {(seen: Map<string, number>) => void} */ fn) {
  const orig = Game.prototype.step, seen = new Map(), errors = /** @type {string[]} */ ([]), last = new WeakMap();
  Game.prototype.step = function (...a) {
    const tick0 = this.tick;orig.apply(this, a);
    // eventId: único no passo e estritamente crescente entre passos do mesmo Game (reset/load reinicia a conta)
    const ids = this.lastStepEvents.map(e => e.eventId), prev = last.get(this);
    if (new Set(ids).size !== ids.length && errors.length < 20) errors.push(`eventId repetido no passo ${this.tick}: ${ids}`);
    if (ids.length) {
      if (prev && prev.tick === tick0 && Math.min(...ids) <= prev.max && errors.length < 20) errors.push(`eventId não crescente no passo ${this.tick}: ${Math.min(...ids)} ≤ ${prev.max}`);
      last.set(this, {tick: this.tick, max: Math.max(...ids)});
    } else if (prev && prev.tick === tick0) last.set(this, {tick: this.tick, max: prev.max});
    for (const e of this.lastStepEvents) {
      seen.set(e.result, (seen.get(e.result) ?? 0) + 1);
      const v = validateCombatEvent(e);
      if (e.sourceKind === 'environmental' && typeof e.attackerId === 'number') v.push('ambiental com attackerId numérico');
      if (e.hpDamage !== (e.damage ?? 0)) v.push(`hpDamage ${e.hpDamage} ≠ damage ${e.damage}`);
      if (v.length && errors.length < 20) errors.push(`${e.result} (passo ${e.tick}): ${v.join('; ')} — ${JSON.stringify(e)}`);
    }
  };
  try {fn(seen);} finally {Game.prototype.step = orig;}
  assert.deepEqual(errors, []);
}

test('todos os cenários (scenarios*.js) + 4 seeds IA×IA: cada evento passa no validador', () => withProbe(seen => {
  for (const def of SCENARIOS) {resetConfig(defaults());runScenario(def);}
  resetConfig(defaults());runMoveScenarios();
  for (const seed of [1, 2, 3, 4]) {
    resetConfig(defaults());
    const g = new Game({seed});g.start();g.mode = 'tactical';C.extras.toggles.enablePlayerAI = 1;
    for (let t = 0; t < 3000 && g.phase === 'playing'; t++) g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step));
  }
  resetConfig(defaults());
  for (const r of ['impact', 'clash', 'statusTick', 'wallSplat', 'destructibleDestroyed', 'spawn']) assert.ok(seen.has(r), `cobertura: ${r} (vistos: ${[...seen.keys()]})`);
}));

test('eventId: sequência própria por Game (dois Games alternados independentes), reset reinicia, save/load preserva', () => {
  resetConfig(defaults());
  const mk = () => {const g = new Game({seed: 5});g.start();g.mode = 'tactical';return g;};
  C.extras.toggles.enablePlayerAI = 1;
  const A = mk(), B = mk(), solo = mk(), idsA = [], idsB = [], idsSolo = [];
  const run = (/** @type {Game} */ g, /** @type {number[]} */ out) => {g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step));out.push(...g.lastStepEvents.map(e => e.eventId));};
  for (let t = 0; t < 2000; t++) {run(A, idsA);run(B, idsB);run(solo, idsSolo);}
  assert.ok(idsA.length > 3, `houve eventos (${idsA.length}, fase ${A.phase})`);
  assert.deepEqual(idsA, idsSolo, 'alternar com outro Game não afeta a sequência');assert.deepEqual(idsA, idsB);
  assert.deepEqual(idsA, idsA.map((_, i) => i + 1), 'contíguo a partir de 1');
  const saved = A.save();assert.equal(saved.eventIdSeq, idsA.length);
  const after = /** @type {number[]} */ ([]);let k = 0;while (!after.length && k < 5000) {run(A, after);k++;}
  assert.ok(after.length && after[0] === saved.eventIdSeq + 1, 'continua a sequência');
  A.load(saved);const again = /** @type {number[]} */ ([]);for (let i = 0; i < k; i++) run(A, again);assert.deepEqual(again, after, 'load restaura eventIdSeq');
  const old = {...saved};delete old.eventIdSeq;A.load(old);assert.equal(A.eventIdSeq, saved.eventSeq, 'save antigo: parte de eventSeq');
  A.reset();assert.equal(A.eventIdSeq, 0);
  resetConfig(defaults());
});

// Os três caminhos de dano que nenhuma partida IA×IA produziu: tique periódico de status, wall splat com dano e destructibleSplat.
const cmd = () => emptyCommand();
function arena() {
  resetConfig(factoryDefaults());C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed: 3});g.start();g.reset({positions: [vec(0, -3), vec(0, 3)]});
  Object.assign(g.mapState, {platforms: [], obstacles: [], destructibles: [], items: [], regularSpawnTimer: 1e9});
  return g;
}
/** Passa até achar o evento `result`; confere validador e conservação de HP (perda de HP do alvo = hpDamage) no passo dele. */
function stepUntil(/** @type {Game} */ g, /** @type {string} */ result, /** @type {() => void} */ before = () => {}, max = 600) {
  for (let t = 0; t < max; t++) {
    before();
    const hp = g.fighters.map(f => f.hp);g.step(cmd(), cmd());
    const ev = g.lastStepEvents.find(e => e.result === result);
    if (!ev) continue;
    for (const e of g.lastStepEvents) assert.deepEqual(validateCombatEvent(e), [], `${e.result}: ${JSON.stringify(e)}`);
    const dmg = g.lastStepEvents.filter(e => e.target === ev.target).reduce((s, e) => s + (e.hpDamage ?? 0), 0);
    assert.equal(hp[ev.target] - g.fighters[ev.target].hp, dmg, `conservação de HP em ${result}`);
    return ev;
  }
  throw new Error(`sem evento ${result}`);
}

test('caminho periódico: tique de status com dano → sourceKind status, conservação de HP', () => {
  const g = arena(), f = g.fighters[1];
  applyStatus(f, {id: 'poison', duration: 3, stacking: 'refresh', tick: {interval: 0.5, damage: 4}, tags: ['debuff']}, {source: 0});
  const ev = stepUntil(g, 'statusTick');
  assert.equal(ev.sourceKind, 'status');assert.equal(ev.hpDamage, 4);assert.equal(ev.attackerId, 0);assert.equal(ev.targetId, 1);
});

test('wall splat com dano (wallSplatDamage > 0): ambiental, sem attackerId, indirectAttackerId = último atacante', () => {
  const g = arena(), b = g.fighters[1];
  const prev = C.rules.wallSplatDamage;C.rules.wallSplatDamage = 5;
  try {
    b.lastAttacker = 0;
    let once = false;
    const ev = stepUntil(g, 'wallSplat', () => {if (once) return;once = true;b.position = vec(0, 49.6);b.wallSplat = null;b.flight = {y: 3, vy: -5, horizontal: vec(0, 9)};b.state = 'airborne';});
    assert.equal(ev.sourceKind, 'environmental');assert.equal(ev.attackerId, null);assert.equal(ev.indirectAttackerId, 0);assert.equal(ev.hpDamage, 5);
  } finally {C.rules.wallSplatDamage = prev;}
});

test('destructibleSplat: ambiental, indirectAttackerId = indirectAttacker, lastAttacker intocado', () => {
  const g = arena(), f = g.fighters[0];
  g.mapState.destructibles = [{id: 'd', hp: 300, maxHp: 300, pos: {x: 0, y: 0, z: 0}, size: {hx: 1, hz: 1, height: 1.6}, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0, ghostTimer: 0, resistances: {physical: 1, projectile: 1, area: 1, environment: 1}}];
  g.fighters[1].position = vec(20, 20);
  f.lastAttacker = 1;const tick0 = f.lastDamagedTick;
  let once = false;
  const ev = stepUntil(g, 'destructibleSplat', () => {if (once) return;once = true;f.position = vec(1.3, 0);f.flight = {y: 0.2, vy: -1, horizontal: vec(-8, 0)};f.launchedByHit = true;f.state = 'airborne';});
  assert.equal(ev.sourceKind, 'environmental');assert.equal(ev.attackerId, null);assert.equal(ev.indirectAttacker, 1);assert.equal(ev.indirectAttackerId, 1);
  assert.ok(ev.hpDamage > 0);assert.equal(f.lastAttacker, 1);assert.equal(f.lastDamagedTick, tick0, 'trackAttacker: false');
  // Na origem (antes da normalização): o DamageResult já traz o autor indireto
  g.mapState.destructibles[0].hp = 300;f.position = vec(1.3, 0);f.flight = {y: 0.2, vy: -1, horizontal: vec(-8, 0)};
  const raw = /** @type {any[]} */ ([]);collideMapFighter(g.mapState, f, raw, g.fighters);
  const splat = raw.find(e => e.result === 'destructibleSplat');
  assert.equal(splat?.indirectAttackerId, 1, 'indirectAttackerId do DamageResult');assert.equal(f.lastAttacker, 1);assert.equal(f.lastDamagedTick, tick0);
});

test('Sand Wave: force só quando o applyHit não deslocou; perfeito/riposte sem empurrão → none', () => {
  assert.equal(sandDisplacementPolicy({result: 'impact', displacementPolicy: 'none'}), 'force');
  assert.equal(sandDisplacementPolicy({result: 'partial'}), 'force');
  assert.equal(sandDisplacementPolicy({result: 'impact', displacementPolicy: 'impulse'}), 'impulse');
  assert.equal(sandDisplacementPolicy({result: 'impact', displacementPolicy: 'displacement'}), 'displacement');
  assert.equal(sandDisplacementPolicy({result: 'perfect', displacementPolicy: 'none'}), 'none');
  assert.equal(sandDisplacementPolicy({result: 'riposte'}), 'none');
});

test('guardStun: stun indefinido/NaN não recebe guard stun (semântica antiga `stun <= 1e-8`)', () => {
  for (const stun of [undefined, NaN]) {
    const f = {stun, state: 'idle'};
    assert.equal(applyReaction(f, {kind: 'guardStun', duration: 0.3, setState: true}), null);assert.equal(f.state, 'idle');
  }
  const f = {stun: 0, state: 'idle'};
  assert.deepEqual(applyReaction(f, {kind: 'guardStun', duration: 0.3, setState: true}), {policy: 'none', duration: 0.3});
});
