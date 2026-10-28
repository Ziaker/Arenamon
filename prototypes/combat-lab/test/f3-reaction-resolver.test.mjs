// @ts-check
// F3.2 — ReactionResolver: autoridade única das reações do lutador (impulso, deslocamento coreografado, knockback legado, hitstun,
// stagger, guard stun, guard break, guarda perfeita, recoil). Cada tipo é comparado com uma cópia CONGELADA do código anterior
// (estado completo do lutador antes/depois), mais checagens explícitas de altitude, distância/duração e hitSerial.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {vec, scale, normalize} from '../src/sim/math.js';
import {applyReaction, REACTION_KINDS} from '../src/sim/resolvers/reaction-resolver.js';
import {launch, pushAway, knockbackReaction} from '../src/sim/combat.js';

registerStandardMoves();

// ---------- Oráculos: cópias CONGELADAS do código anterior à F3.2. Não edite. ----------
const L = {
  launch(f, away, horizontal, vertical) {
    const n = normalize(away);
    const startY = f.flight ? (f.flight.y ?? 0) : (f.groundY ?? 0) + (f.vaultHeight ?? 0);
    f.flight = {y: startY, vy: vertical, horizontal: scale(n, horizontal)};
    f.launchedByHit = true;
    f.action = null;f.push = null;f.blend = null;f.velocity = vec();f.locomotionVelocity = vec();
    f.guard = false;f.guardSuppressed = true;f.knockRecovery = 0;f.vaultHeight = 0;f.counterWindow = 0;f.landingSlide = null;f.state = 'airborne';
    f.tech = null;f.techDodge = null;f.wallSplat = null;
  },
  pushAway(f, away, distance, duration) {
    const n = normalize(away);
    f.push = {direction: n, distance, elapsed: 0, duration};
    f.action = null;f.flight = null;f.velocity = vec();f.locomotionVelocity = vec();f.blend = null;f.guard = false;f.guardSuppressed = true;
    const dur = duration ?? (distance / 12);
    f.push.duration = dur;
    f.vaultHeight = 0;f.counterWindow = 0;f.landingSlide = null;f.knockRecovery = dur;f.pushRecovery = dur;f.recoveryKind = 'pushed';f.recoveryFrom = null;f.tech = null;f.techDodge = null;f.state = 'pushed';
    f.hitSerial = (f.hitSerial ?? 0) + 1;
  },
  knockback(target, dir, hKb, vKb) {
    if (vKb > 1e-6 || target.flight) {L.launch(target, dir, hKb, vKb);return {direction: normalize(dir), horizontal: hKb, vertical: vKb};}
    if (hKb > 0) {
      target.action = null;target.flight = null;target.blend = null;target.guard = false;target.guardSuppressed = true;target.velocity = vec();target.locomotionVelocity = vec();
      const dur = C.test?.pushDuration ?? 0.3;
      target.push = {direction: dir, distance: Math.max(0.45, hKb * 1.5), elapsed: 0, duration: dur};target.knockRecovery = Math.max(target.knockRecovery, dur);target.pushRecovery = dur;target.recoveryKind = 'pushed';target.state = 'pushed';target.hitSerial = (target.hitSerial ?? 0) + 1;
      return {direction: normalize(dir), horizontal: hKb, vertical: 0};
    }
    return null;
  },
  hitstunResolveHit(defender, rec) {
    defender.action = null;
    defender.hitstun = Math.max(defender.hitstun ?? 0, rec);defender.hitstunMax = Math.max(defender.hitstunMax ?? 0, rec);
    defender.knockRecovery = Math.max(defender.knockRecovery, rec);defender.recoveryKind = 'hitstun';defender.state = 'hitstun';
  },
  hitstunFlinch(target, dur) {target.action = null;target.hitstun = Math.max(target.hitstun ?? 0, dur);target.hitstunMax = Math.max(target.hitstunMax ?? 0, dur);target.knockRecovery = Math.max(target.knockRecovery, dur);target.recoveryKind = 'hitstun';target.state = 'hitstun';target.hitSerial = (target.hitSerial ?? 0) + 1;},
  footstool(defender, stagger) {
    defender.stun = Math.max(defender.stun ?? 0, stagger);defender.stunMax = stagger;defender.state = 'stagger';
    defender.action = null;defender.push = null;defender.blend = null;
    defender.velocity = vec();defender.locomotionVelocity = vec();
    defender.vaultHeight = 0;defender.counterWindow = 0;defender.landingSlide = null;
    defender.guard = false;defender.guardSuppressed = true;
  },
  guardBreak(defender, gbStun) {defender.guard = false;defender.guardSuppressed = true;defender.state = 'stagger';defender.stun = Math.max(defender.stun, gbStun);defender.stunMax = defender.stun;},
  guardStunResolveHit(defender, d) {if (defender.stun <= 1e-8) {defender.stun = d;defender.stunMax = d;}},
  guardStunApplyHit(target, d) {if (target.stun <= 1e-8) {target.stun = d;target.state = 'guardStun';}},
  perfectResolveHit(defender, cw) {defender.perfectSucceeded = true;defender.stun = 0;if (C.extras.toggles.enableCounterBonus) defender.counterWindow = Math.max(defender.counterWindow, cw);},
  perfectApplyHit(target, cw) {target.perfectSucceeded = true;target.stun = 0;target.state = 'guard';if (C.extras.toggles.enableCounterBonus) target.counterWindow = Math.max(target.counterWindow, cw);},
  recoil(attacker, heading) {
    attacker.action = {kind: 'recoil', elapsed: 0, heading, startAngle: 0, offensive: false, hits: new Set(), from: null};
    attacker.velocity = vec();attacker.state = 'recoil';attacker.blend = null;attacker.vaultHeight = 0;
  },
};

// ---------- Lutadores de teste (estado real do jogo + variações) ----------
const base = () => {resetConfig(defaults());const g = new Game({seed: 3});g.reset();return g.fighters[0];};
const variants = {
  chao: f => {f.knockRecovery = 0.1;f.counterWindow = 0.2;f.stun = 0;},
  voo: f => {f.flight = {y: 1.7, vy: 2, horizontal: {x: 1, z: 0}};f.groundY = 0.5;f.state = 'airborne';},
  vault: f => {f.groundY = 0.4;f.vaultHeight = 0.6;f.knockRecovery = 0.9;f.hitstun = 0.5;f.hitstunMax = 0.5;},
  atordoado: f => {f.stun = 0.4;f.stunMax = 0.4;f.counterWindow = 0.5;f.guard = true;f.action = {kind: 'tackle', elapsed: 0.1, hits: new Set()};f.push = {direction: {x: 0, z: 1}, distance: 1, elapsed: 0, duration: 1};f.tech = {t: 1};f.recoveryFrom = 'x';f.landingSlide = {v: 1};},
};
/** Aplica `legacy` e `modern` em cópias idênticas e exige o MESMO estado final (e o mesmo retorno, quando pedido). */
function parity(name, legacy, modern, check) {
  for (const [vn, mut] of Object.entries(variants)) {
    const f0 = base();mut(f0);
    const a = structuredClone(f0), b = structuredClone(f0);
    const ra = legacy(a), rb = modern(b);
    assert.deepEqual(b, a, `${name}/${vn}: estado do lutador diverge do código anterior`);
    if (check) check(ra, rb, b, f0, vn);
  }
}
const dir = {x: 0.6, z: -0.8}, raw = {x: 3, z: 4};

test('os tipos de reação declarados', () => {
  assert.deepEqual([...REACTION_KINDS].sort(), ['displacement', 'guardBreak', 'guardStun', 'hitstun', 'impulse', 'knockback', 'perfectGuard', 'recoil', 'stagger']);
  assert.equal(applyReaction(base(), /** @type {any} */ ({kind: 'inexistente'})), null);
});

test('impulse = launch anterior: voo balístico preservando altitude (voo em curso ou vault)', () => {
  parity('impulse', f => L.launch(f, raw, 5, 3), f => applyReaction(f, {kind: 'impulse', direction: raw, horizontal: 5, vertical: 3}), (_, r, f, f0) => {
    assert.equal(r.policy, 'impulse');assert.deepEqual(r.direction, normalize(raw));assert.equal(r.horizontal, 5);assert.equal(r.vertical, 3);
    const expectedY = f0.flight ? f0.flight.y : (f0.groundY ?? 0) + (f0.vaultHeight ?? 0);
    assert.equal(f.flight.y, expectedY, 'altitude preservada');assert.equal(f.state, 'airborne');assert.equal(f.hitSerial, f0.hitSerial, 'impulse não conta acerto');
  });
  const r = applyReaction(base(), {kind: 'impulse', direction: dir, horizontal: 1, vertical: 9, bounce: true});
  assert.equal(r?.bounce, true);
  parity('launch adaptador', f => L.launch(f, raw, 5, 3), f => launch(f, raw, 5, 3));
});

test('displacement = pushAway anterior: distância e duração exatas, hitSerial +1', () => {
  parity('displacement', f => L.pushAway(f, raw, 1.25, 0.4), f => applyReaction(f, {kind: 'displacement', direction: raw, distance: 1.25, duration: 0.4}), (_, r, f, f0) => {
    assert.deepEqual(r, {policy: 'displacement', direction: normalize(raw), distance: 1.25, duration: 0.4});
    assert.equal(f.push.distance, 1.25);assert.equal(f.push.duration, 0.4);assert.equal(f.pushRecovery, 0.4);assert.equal(f.knockRecovery, 0.4);
    assert.equal(f.state, 'pushed');assert.equal(f.recoveryKind, 'pushed');assert.equal(f.hitSerial, (f0.hitSerial ?? 0) + 1);
  });
  parity('pushAway adaptador', f => L.pushAway(f, raw, 1.25, 0.4), f => pushAway(f, raw, 1.25, 0.4));
  parity('pushAway sem duração', f => L.pushAway(f, raw, 2.4, undefined), f => pushAway(f, raw, 2.4, undefined), (_, __, f) => assert.equal(f.push.duration, 2.4 / 12));
});

test('knockback = regra legada única (vertical ou no ar → impulse; só horizontal → displacement)', () => {
  for (const [h, v] of [[4, 2], [4, 0], [0.1, 0], [0, 0], [3, 1e-7]]) {
    parity(`knockback ${h}/${v}`, f => L.knockback(f, raw, h, v), f => applyReaction(f, {kind: 'knockback', direction: raw, horizontal: h, vertical: v}), (ra, rb, f, f0) => {
      if (!ra) {assert.equal(rb, null);return;}
      const exp = ra.vertical > 0 || f0.flight ? 'impulse' : 'displacement';
      assert.equal(rb.policy, exp);assert.deepEqual(rb.direction, ra.direction);assert.equal(rb.horizontal, ra.horizontal);assert.equal(rb.vertical, ra.vertical);
      if (exp === 'displacement') {assert.equal(rb.distance, Math.max(0.45, 1.5 * h));assert.equal(rb.duration, C.test.pushDuration ?? 0.3);assert.equal(f.push.distance, rb.distance);assert.equal(f.hitSerial, (f0.hitSerial ?? 0) + 1);}
    });
    parity(`knockbackReaction adaptador ${h}/${v}`, f => L.knockback(f, raw, h, v), f => knockbackReaction(f, raw, h, v), (ra, rb) => assert.deepEqual(rb, ra));
  }
});

test('hitstun: variante do resolveHit (sem contar acerto) e do flinch (conta acerto)', () => {
  parity('hitstun resolveHit', f => L.hitstunResolveHit(f, 0.35), f => applyReaction(f, {kind: 'hitstun', duration: 0.35, countHit: false}), (_, r) => assert.deepEqual(r, {policy: 'none', duration: 0.35}));
  parity('hitstun flinch', f => L.hitstunFlinch(f, 0.35), f => applyReaction(f, {kind: 'hitstun', duration: 0.35}), (_, __, f, f0) => assert.equal(f.hitSerial, (f0.hitSerial ?? 0) + 1));
});

test('stagger (footstool): stun, stunMax = duração e interrupção', () => {
  parity('stagger', f => L.footstool(f, 0.25), f => applyReaction(f, {kind: 'stagger', duration: 0.25}), (_, r, f) => {assert.deepEqual(r, {policy: 'none', duration: 0.25});assert.equal(f.state, 'stagger');});
});

test('guardBreak, guardStun (2 variantes), perfectGuard (2 variantes) e recoil', () => {
  parity('guardBreak', f => L.guardBreak(f, 0.6), f => applyReaction(f, {kind: 'guardBreak', duration: 0.6}));
  parity('guardStun resolveHit', f => L.guardStunResolveHit(f, 0.2), f => applyReaction(f, {kind: 'guardStun', duration: 0.2}));
  parity('guardStun applyHit', f => L.guardStunApplyHit(f, 0.3), f => applyReaction(f, {kind: 'guardStun', duration: 0.3, setState: true, trackMax: false}), (_, r, f, f0) => {
    if (f0.stun > 1e-8) assert.equal(r, null);else {assert.deepEqual(r, {policy: 'none', duration: 0.3});assert.equal(f.state, 'guardStun');}
  });
  for (const tog of [0, 1]) {
    C.extras.toggles.enableCounterBonus = tog;
    const withTog = fn => f => {C.extras.toggles.enableCounterBonus = tog;return fn(f);};
    parity('perfectGuard resolveHit', withTog(f => L.perfectResolveHit(f, 0.45)), withTog(f => applyReaction(f, {kind: 'perfectGuard', counterWindow: 0.45})));
    parity('perfectGuard applyHit', withTog(f => L.perfectApplyHit(f, 0.45)), withTog(f => applyReaction(f, {kind: 'perfectGuard', counterWindow: 0.45, setState: true})));
  }
  parity('recoil', f => L.recoil(f, 1.2), f => applyReaction(f, {kind: 'recoil', heading: 1.2}), (_, r, f) => {assert.deepEqual(r, {policy: 'none'});assert.equal(f.action.heading, 1.2);});
});

test('eventos dos consumidores carregam displacementPolicy (applyHit, Sand Wave = force, rockLaunch = impulse)', async () => {
  const {applyHit} = await import('../src/sim/world/world-hit.js');
  const fs = await import('node:fs');
  resetConfig(defaults());
  const g = new Game({seed: 3});g.reset();
  const t = g.fighters[1];t.guard = false;
  const evPush = applyHit(g, 0, t, {damage: 0, knockback: {horizontal: 2, vertical: 0}}, {x: 0, z: 1});
  assert.equal(evPush?.displacementPolicy, 'displacement');assert.equal(t.push.distance, 3);assert.deepEqual(evPush?.launch, {direction: {x: 0, z: 1}, horizontal: evPush?.launch?.horizontal, vertical: 0});
  g.reset();const t2 = g.fighters[1];t2.guard = false;
  const evAir = applyHit(g, 0, t2, {damage: 0, knockback: {horizontal: 2, vertical: 3}}, {x: 0, z: 1});
  assert.equal(evAir?.displacementPolicy, 'impulse');assert.equal(t2.state, 'airborne');
  g.reset();const t3 = g.fighters[1];t3.guard = false;
  const evFl = applyHit(g, 0, t3, {damage: 0, flinch: 0.4}, {x: 0, z: 1});
  assert.equal(evFl?.displacementPolicy, 'none');assert.equal(t3.state, 'hitstun');assert.equal(t3.hitstun, 0.4);
  const src = (/** @type {string} */ p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  assert.match(src('../src/sim/sand.js'), /displacementPolicy: 'force'/);
  assert.match(src('../src/sim/stone.js'), /result: 'rockLaunch'[^\n]*displacementPolicy: 'impulse'/);
  assert.doesNotMatch(src('../src/sim/world/world-hit.js'), /target\.push = \{/, 'applyHit não monta mais o empurrão à mão');
  assert.doesNotMatch(src('../src/sim/combat.js'), /\.state = 'stagger'|\.state = 'hitstun'|\.state = 'recoil'/, 'combat.js não grava reações à mão');
});
