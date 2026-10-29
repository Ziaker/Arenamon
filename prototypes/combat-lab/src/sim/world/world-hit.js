// @ts-check
// Dividido de world.js (comportamento idêntico): world-hit.

import {C} from '../config.js';
import {isInvulnerable, riposteIntercept} from '../entity.js';
import {applyStatus, stat} from '../status.js';
import {resolveDamage, damageEventFields} from '../resolvers/damage-resolver.js';
import {applyReaction} from '../resolvers/reaction-resolver.js';
import {knockbackFactor} from '../passive-engine.js';
import {vec, add, sub, scale, dot, length, normalize, direction} from '../math.js';
import {closestOnShape} from '../collision/queries.js';

// ---------- Geometria ----------
// Ponto mais próximo do contorno: consulta geométrica única em collision/queries.js (F4); reexportada para os chamadores de sempre.
export {closestOnShape};
// ---------- Acerto (função única, regras do tackle) ----------
/**
 * Resolve um acerto de entidade em `target`. hit: {damage, knockback: {horizontal, vertical}, guardable (padrão true),
 * ignoreInvulnerability, statuses: [def], hitstop}. normal: direção do empurrão (da fonte para o alvo).
 * Ordem: invulnerável → defesa frontal (perfeita: sem dano; comum: dano × guardDamageMultiplier e guard stun) → acerto
 * (dano com modificadores, lançamento ou recuperação, status). Devolve o evento.
 * @param {any} game @param {number | null} ownerId @param {any} target @param {any} hit @param {any} normal
 * @param {{entity?: any, source?: string, pl?: any, move?: string | null, scale?: number, origin?: any, contact?: string}} [info]
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
  let launchInfo = null, displacementPolicy = 'none';
  if (protectedFront) {
    target.velocity = vec();target.locomotionVelocity = vec();
    if (perfect) applyReaction(target, {kind: 'perfectGuard', counterWindow: X.perfectGuardCounterWindow, setState: true});
    else if (hit.guardStun !== 0) applyReaction(target, {kind: 'guardStun', duration: hit.guardStun ?? R.guardStun, setState: true, trackMax: false});   // só sem stun ativo; entra em 'guardStun' sem gravar stunMax
  } else {
    const kb = hit.knockback, k = stat(target, 'knockbackTaken', 1) * scaleK;
    if (kb && (kb.horizontal > 0 || kb.vertical > 0) && T.enableLaunch) {
      const dir = length(normal) > 1e-7 ? normalize(normal) : vec(0, 1);
      const hKb = (kb.horizontal ?? 0) * k * knockbackFactor(target), vKb = (kb.vertical ?? 0) * k;
      const r = applyReaction(target, {kind: 'knockback', direction: dir, horizontal: hKb, vertical: vKb});   // vertical ou no ar → voo; só horizontal → empurrão
      if (r) {launchInfo = {direction: dir, horizontal: hKb, vertical: r.vertical ?? 0};displacementPolicy = r.policy;}
    }
    else if (hit.flinch) applyReaction(target, {kind: 'hitstun', duration: typeof hit.flinch === 'number' ? hit.flinch : (R.hitstun ?? 0.2)});
    if (damage > 0) target.hitSerial = (target.hitSerial ?? 0) + 1;
    for (const s of hit.statuses || []) applyStatus(target, s, {source: ownerId});
    target.counterWindow = 0;
  }
  if (target.hp === 0) {target.guard = false;target.guardSuppressed = true;target.state = 'defeated';target.recoveryKind = null;}
  return {...base, result: perfect ? 'perfect' : protectedFront ? 'partial' : 'impact', damage, ...damageEventFields(dmgResult), launch: launchInfo, displacementPolicy, contact, ...(dmgResult.sturdy ? {sturdy: true} : {})};
}
