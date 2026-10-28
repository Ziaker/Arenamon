// @ts-check
// Dividido de world.js (comportamento idêntico): world-hit.

import {C} from '../config.js';
import {isInvulnerable, riposteIntercept} from '../entity.js';
import {launch} from '../combat.js';
import {applyStatus, stat} from '../status.js';
import {resolveDamage, damageEventFields} from '../resolvers/damage-resolver.js';
import {knockbackFactor} from '../passive-engine.js';
import {vec, add, sub, scale, dot, length, normalize, direction} from '../math.js';

// ---------- Geometria ----------
/** Ponto do contorno da forma mais próximo de p (plano XZ) e distância. */
export function closestOnShape(e, p) {
  if (e.shape === 'box') {
    const c = Math.cos(e.angle ?? 0), s = Math.sin(e.angle ?? 0), d = sub(p, e.pos);
    // Eixos locais: x' = (cos, -sin), z' = (sin, cos) — rumo 0 = +Z, como o resto do motor.
    const lx = d.x * c - d.z * s, lz = d.x * s + d.z * c, qx = Math.max(-e.hx, Math.min(e.hx, lx)), qz = Math.max(-e.hz, Math.min(e.hz, lz));
    const inside = Math.abs(lx) <= e.hx && Math.abs(lz) <= e.hz;
    const q = vec(e.pos.x + qx * c + qz * s, e.pos.z - qx * s + qz * c);
    return {point: q, distance: inside ? -Math.min(e.hx - Math.abs(lx), e.hz - Math.abs(lz)) : length(sub(p, q)), inside};
  }
  const d = sub(p, e.pos), l = length(d);
  return {point: l > 1e-9 ? add(e.pos, scale(d, e.radius / l)) : add(e.pos, vec(e.radius, 0)), distance: l - e.radius, inside: l < e.radius};
}
// ---------- Acerto (função única, regras do tackle) ----------
/**
 * Resolve um acerto de entidade em `target`. hit: {damage, knockback: {horizontal, vertical}, guardable (padrão true),
 * ignoreInvulnerability, statuses: [def], hitstop}. normal: direção do empurrão (da fonte para o alvo).
 * Ordem: invulnerável → defesa frontal (perfeita: sem dano; comum: dano × guardDamageMultiplier e guard stun) → acerto
 * (dano com modificadores, lançamento ou recuperação, status). Devolve o evento.
 */
export function applyHit(game, ownerId, target, hit, normal, info = {}) {
  const R = C.rules, X = C.extras.combat, T = C.extras.toggles, owner = ownerId == null ? null : game.fighters[ownerId];
  const base = {attacker: ownerId, target: target.id, normal: {...normal}, entity: info.entity ?? null, source: info.source ?? 'world', pl: info.pl ?? null, move: info.move ?? null};   // move = id do Move que causou o acerto (null = Tackle/corpo): o VFX escolhe cor de hit e tremor por ele
  if (target.hp <= 0 || target.absent) return null;
  if (!hit.ignoreInvulnerability) {const rip = riposteIntercept(target, ownerId, normal, base);if (rip) return rip;}   // Riposte: janela aberta anula o acerto e dispara o contra-golpe
  if (!hit.ignoreInvulnerability && isInvulnerable(target)) return {...base, result: 'invulnerable', damage: 0};
  const atkStageMult = owner ? (1 + (owner.stages?.attack ?? 0) * (C.map?.stageAttackBonus ?? 0.10)) : 1;
  const attack = (owner ? stat(owner, 'attack', 1) : 1) * atkStageMult, scaleK = info.scale ?? 1;
  const guardable = hit.guardable !== false && T.enableDefense, from = info.origin ?? sub(target.position, scale(normal, 1));
  const protectedFront = guardable && target.guard && dot(direction(target.facing), normalize(sub(from, target.position))) >= X.guardFrontAlignment;
  const perfect = protectedFront && target.perfectLeft > 1e-8;
  const raw = (hit.damage ?? 0) * attack * scaleK * stat(target, 'damageTaken', 1);
  const contact = info.contact ?? hit.contact ?? 'area';
  const dmgResult = resolveDamage({target, attacker: owner, rawDamage: raw, sourceKind: 'direct', contact, guarded: protectedFront, perfect});
  const damage = dmgResult.hpDamage;
  /** @type {{direction: import("../types").Vec, horizontal: number, vertical: number} | null} */
  let launchInfo = null;
  if (protectedFront) {
    target.velocity = vec();target.locomotionVelocity = vec();
    if (perfect) {target.perfectSucceeded = true;target.stun = 0;target.state = 'guard';if (T.enableCounterBonus) target.counterWindow = Math.max(target.counterWindow, X.perfectGuardCounterWindow);}
    else if (target.stun <= 1e-8 && hit.guardStun !== 0) {target.stun = hit.guardStun ?? R.guardStun;target.state = 'guardStun';}
  } else {
    const kb = hit.knockback, k = stat(target, 'knockbackTaken', 1) * scaleK;
    if (kb && (kb.horizontal > 0 || kb.vertical > 0) && T.enableLaunch) {
      const dir = length(normal) > 1e-7 ? normalize(normal) : vec(0, 1);
      const hKb = (kb.horizontal ?? 0) * k * knockbackFactor(target), vKb = (kb.vertical ?? 0) * k;
      if (vKb > 1e-6 || target.flight) {
        launch(target, dir, hKb, vKb);
        launchInfo = {direction: dir, horizontal: hKb, vertical: vKb};
      } else if (hKb > 0) {
        target.action = null;
        target.flight = null;
        target.blend = null;
        target.guard = false;
        target.guardSuppressed = true;
        target.velocity = vec();
        target.locomotionVelocity = vec();
        target.push = {direction: dir, distance: Math.max(0.45, hKb * 1.5), elapsed: 0};
        const dur = C.test?.pushDuration ?? 0.3; target.push.duration = dur; target.knockRecovery = Math.max(target.knockRecovery, dur); target.pushRecovery = dur; target.recoveryKind = 'pushed'; target.hitSerial = (target.hitSerial ?? 0) + 1;
        target.state = 'pushed';
        launchInfo = {direction: dir, horizontal: hKb, vertical: 0};
      }
    }
    else if (hit.flinch) {target.action = null;const dur = typeof hit.flinch === 'number' ? hit.flinch : (R.hitstun ?? 0.2);target.hitstun = Math.max(target.hitstun ?? 0, dur);target.hitstunMax = Math.max(target.hitstunMax ?? 0, dur);target.knockRecovery = Math.max(target.knockRecovery, dur);target.recoveryKind = 'hitstun';target.state = 'hitstun';target.hitSerial = (target.hitSerial ?? 0) + 1;}
    if (damage > 0) target.hitSerial = (target.hitSerial ?? 0) + 1;
    for (const s of hit.statuses || []) applyStatus(target, s, {source: ownerId});
    target.counterWindow = 0;
  }
  if (target.hp === 0) {target.guard = false;target.guardSuppressed = true;target.state = 'defeated';target.recoveryKind = null;}
  return {...base, result: perfect ? 'perfect' : protectedFront ? 'partial' : 'impact', damage, ...damageEventFields(dmgResult), launch: launchInfo, contact, ...(dmgResult.sturdy ? {sturdy: true} : {})};
}
