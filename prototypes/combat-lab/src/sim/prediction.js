// @ts-check
// Previsão de combate de curto prazo (Fase 3 do Roadmap da IA).
//
// Fornece estimativas unificadas para:
//   1. Posição provável de lutadores considerando velocidade, ações em curso e limites de arena (paredes).
//   2. Chance de contato, tempo até o impacto e risco de punição para ataques.
//   3. Trajetória de projéteis considerando barreiras e reflexões.
//   4. Viabilidade temporal de defesas e esquivas antes do impacto.
//   5. Janelas reais de vulnerabilidade e punição.
//   6. Rastreamento de acurácia das previsões para calibração sem viés.

import {C} from './config.js';
import {vec, add, scale, sub, dot, length, normalize, clamp, direction} from './math.js';
import {nominalDistance, actionSpec, isInvulnerable} from './entity.js';
import {segmentHitsVolume} from './geometry.js';

const contactDistance = () => 2 * C.test.halfExtent;

/**
 * Prevê a posição futura de um lutador após `duration` segundos, respeitando paredes e estado atual.
 * @param {any} fighter
 * @param {number} duration
 * @param {number} [arenaHalf]
 * @param {any} [perception]
 * @returns {{x: number, z: number}}
 */
export function predictFighterPosition(fighter, duration, arenaHalf = C.test.arenaHalf, perception = null) {
  if (!fighter) return vec();
  const r = C.test.halfExtent;
  const lim = Math.max(0, arenaHalf - r);
  let pos = {x: fighter.position.x, z: fighter.position.z};

  if (duration <= 0) {
    return {x: clamp(pos.x, -lim, lim), z: clamp(pos.z, -lim, lim)};
  }

  const act = fighter.action;
  if (act && (act.kind === 'tackle' || act.kind === 'dodge')) {
    const spec = actionSpec(act);
    const timeLeft = Math.max(0, spec.duration - act.elapsed);
    const simTime = Math.min(duration, timeLeft);
    const heading = act.heading ?? (act.direction ? Math.atan2(act.direction.x, act.direction.z) : fighter.facing);
    const dir = direction(heading);
    const totalDist = nominalDistance(fighter, act.kind);
    const speed = spec.duration > 0 ? totalDist / spec.duration : 0;
    pos = add(pos, scale(dir, speed * simTime));
  } else if (fighter.flight) {
    const horiz = fighter.flight.horizontal ?? vec();
    pos = add(pos, scale(horiz, duration));
  } else {
    // Locomoção livre ou inércia
    const vel = perception?.apparentVel ?? fighter.velocity;
    pos = add(pos, scale(vel, duration));
  }

  return {x: clamp(pos.x, -lim, lim), z: clamp(pos.z, -lim, lim)};
}

/**
 * Avalia de forma unificada a chance de contato de um ataque, tempo até contato e risco de punição.
 * @param {any} self
 * @param {any} target
 * @param {string} [actionKind]
 * @param {any} [perception]
 * @param {number} [arenaHalf]
 * @returns {{contactChance: number, timeToContact: number, punishRisk: number, confidence: number, predictedSelfPos: {x: number, z: number}, predictedTargetPos: {x: number, z: number}}}
 */
export function predictContact(self, target, actionKind = 'tackle', perception = null, arenaHalf = C.test.arenaHalf) {
  const pSelf = self.position;
  const pTarget = target.position;
  const diff = sub(pTarget, pSelf);
  const currentDist = length(diff);
  const toTarget = currentDist > 1e-6 ? normalize(diff) : direction(self.facing);

  const actParams = C.actions[actionKind] ?? C.actions.tackle;
  const duration = actParams.duration;
  const counterMult = self.counterWindow > 0 ? (actParams.counterSpeed ?? 1.25) : 1;
  const totalReach = contactDistance() + nominalDistance(self, actionKind) * counterMult;

  const oa = target.action;
  const mid = duration * 0.5;
  const horizon = oa && oa.kind !== 'recoil' ? Math.min(mid, Math.max(0, (actionSpec(oa)?.duration ?? mid) - (oa.elapsed ?? 0)) * 0.5) : mid;
  const targetVel = perception?.apparentVel ?? target.velocity;
  const maxSpd = (target.attributes?.speed ?? 4.0) * 1.8;
  const clampedVel = length(targetVel) > maxSpd ? scale(normalize(targetVel), maxSpd) : targetVel;
  const predictedTarget = add(target.position, scale(clampedVel, horizon));
  const predictedSelf = predictFighterPosition(self, horizon, arenaHalf, null);
  const contactDist = contactDistance();

  // Velocidade de fechamento relativa
  const selfVel = self.velocity;
  const relVel = sub(selfVel, clampedVel);
  const closingSpeed = dot(relVel, toTarget);

  // Alinhamento do ataque
  const attackDir = toTarget;
  const alignment = dot(attackDir, toTarget);

  let contactChance = 0;
  let timeToContact = 999;

  const distToIntercept = length(sub(predictedTarget, self.position));

  if (distToIntercept <= contactDist + 0.1) {
    contactChance = 0.95;
    timeToContact = horizon * 0.4;
  } else if (distToIntercept <= totalReach * 0.98) {
    const fraction = (totalReach * 0.98 - distToIntercept) / Math.max(0.1, totalReach * 0.98 - contactDist);
    contactChance = clamp(0.50 + 0.45 * fraction, 0.45, 0.95);
    const speed = Math.max(4, closingSpeed + (totalReach / duration));
    timeToContact = Math.max(0.04, (distToIntercept - contactDist) / speed);
  } else if (distToIntercept <= totalReach * 1.1) {
    contactChance = 0.25;
    timeToContact = duration * 0.8;
  } else {
    contactChance = 0.05;
    timeToContact = 999;
  }

  // Penalidades para alvos invulneráveis ou no ar
  if (target.flight) {
    contactChance *= 0.2;
  } else if (isInvulnerable(target)) {
    contactChance *= 0.3;
  } else if (target.action?.kind === 'dodge') {
    const invulnEnd = C.actions.dodge?.invulnerable ?? 0.2;
    if ((target.action.elapsed ?? 0) < invulnEnd) {
      contactChance *= 0.4;
    }
  }

  // Risco de punição: se errar ou for bloqueado, qual a exposição da IA?
  const recoveryTime = actParams.recovery ?? (duration * 0.4);
  const targetCanPunish = !target.exhausted && target.stamina >= (C.actions.tackle?.cost ?? 1);
  let punishRisk = 0.2;
  if (!targetCanPunish) {
    punishRisk = 0.05;
  } else {
    punishRisk = clamp(recoveryTime * 1.8 + (1 - contactChance) * 0.6, 0.1, 0.95);
    if (target.guard) punishRisk += 0.15;
  }
  punishRisk = clamp(punishRisk, 0, 1);

  // Nível de confiança na previsão
  let confidence = 0.85;
  if (perception?.actionMisread) confidence *= 0.5;
  if (!target.action) confidence *= 0.75; // Alvo livre pode reagir a qualquer instante

  return {
    contactChance: +contactChance.toFixed(3),
    timeToContact: +timeToContact.toFixed(3),
    punishRisk: +punishRisk.toFixed(3),
    confidence: +confidence.toFixed(3),
    predictedSelfPos: predictedSelf,
    predictedTargetPos: predictedTarget,
  };
}

/**
 * Previsão da trajetória de um projétil contra barreiras, lutadores e reflexões.
 * @param {any} proj
 * @param {any} world
 * @param {any} target
 * @param {number} [arenaHalf]
 * @returns {{timeToHit: number, willHitTarget: boolean, willHitBarrier: boolean, willReflect: boolean, barrier: any | null}}
 */
export function predictProjectileTrajectory(proj, world, target, arenaHalf = C.test.arenaHalf) {
  const speed = length(proj.vel);
  if (speed < 1e-5) {
    return {timeToHit: 999, willHitTarget: false, willHitBarrier: false, willReflect: false, barrier: null};
  }

  const dir = {x: proj.vel.x / speed, z: proj.vel.z / speed};
  const toTarget = sub(target.position, proj.pos);
  const along = dot(toTarget, dir);
  const lateral = Math.hypot(toTarget.x - dir.x * along, toTarget.z - dir.z * along);
  const hitRadius = C.test.halfExtent + (proj.radius ?? 0.25) + 0.3;

  const willHitTarget = along > 0 && lateral <= hitRadius;
  const timeToHit = along > 0 ? along / speed : 999;

  // Checa barreiras intermediárias
  let willHitBarrier = false;
  let willReflect = false;
  let hitBarrier = null;

  if (world?.entities) {
    const pStart = {x: proj.pos.x, y: (proj.y ?? 0.8), z: proj.pos.z};
    const pEnd = along > 0 ? {x: proj.pos.x + dir.x * along, y: pStart.y, z: proj.pos.z + dir.z * along}
                           : {x: proj.pos.x + dir.x * 15, y: pStart.y, z: proj.pos.z + dir.z * 15};

    for (const ent of world.entities) {
      if (ent.dead || !ent.reflect || ent.id === proj.owner) continue;
      if (segmentHitsVolume(ent, ent.y ?? 0, ent.height ?? 2, pStart, pEnd)) {
        willHitBarrier = true;
        hitBarrier = ent;
        willReflect = (ent.pl ?? 1) >= (proj.pl ?? 1);
        break;
      }
    }
  }

  return {
    timeToHit: +timeToHit.toFixed(3),
    willHitTarget,
    willHitBarrier,
    willReflect,
    barrier: hitBarrier,
  };
}

/**
 * Avalia se uma ação defensiva (guard ou dodge) ficará pronta antes da ameaça colidir.
 * @param {any} self
 * @param {number} timeToContact
 * @param {'guard' | 'perfectGuard' | 'dodge'} defenseType
 * @returns {{canArrive: boolean, margin: number}}
 */
export function canDefenseArrive(self, timeToContact, defenseType = 'guard') {
  const stepTime = 1 / 120;
  if (defenseType === 'guard') {
    // Guarda ativa praticamente imediata no próximo tick
    const readyIn = stepTime;
    const margin = timeToContact - readyIn;
    return {canArrive: margin >= 0, margin: +margin.toFixed(3)};
  }
  if (defenseType === 'perfectGuard') {
    // Exige cooldown zerado e que o impacto caia dentro da janela perfeita
    if (self.perfectCooldown > 0) return {canArrive: false, margin: -self.perfectCooldown};
    const perfectWindow = C.rules.perfect;
    const margin = timeToContact - perfectWindow;
    return {canArrive: timeToContact <= perfectWindow && timeToContact >= stepTime, margin: +margin.toFixed(3)};
  }
  if (defenseType === 'dodge') {
    // Esquiva exige stamina e cooldown de ação livre
    const afford = !self.exhausted && self.stamina >= C.actions.dodge.cost;
    const free = !self.action && self.knockRecovery <= 0 && !self.flight;
    if (!afford || !free) return {canArrive: false, margin: -1};
    const invulnStart = (/** @type {any} */ (C.actions.dodge)).invulnerableFrom ?? 0;
    const margin = timeToContact - invulnStart;
    return {canArrive: margin >= stepTime, margin: +margin.toFixed(3)};
  }
  return {canArrive: false, margin: -999};
}

/**
 * Identifica se o adversário está em janela de punição garantida e qual a duração restante.
 * @param {any} target
 * @returns {{isVulnerable: boolean, windowDuration: number, reason: string}}
 */
export function calculatePunishWindow(target) {
  if (!target) return {isVulnerable: false, windowDuration: 0, reason: 'none'};

  if (target.knockRecovery > 0) {
    return {isVulnerable: true, windowDuration: +target.knockRecovery.toFixed(3), reason: 'knockRecovery'};
  }
  if (target.exhausted) {
    return {isVulnerable: true, windowDuration: 1.5, reason: 'exhausted'};
  }
  if (target.action) {
    const act = target.action;
    const spec = actionSpec(act);
    const timeLeft = Math.max(0, spec.duration - act.elapsed);

    if (act.kind === 'recoil') {
      return {isVulnerable: true, windowDuration: +timeLeft.toFixed(3), reason: 'recoil'};
    }
    if (act.kind === 'tackle' && act.elapsed >= spec.duration * 0.5) {
      return {isVulnerable: true, windowDuration: +timeLeft.toFixed(3), reason: 'tackleWhiff'};
    }
    if (act.kind === 'dodge' && act.elapsed >= (C.actions.dodge?.invulnerable ?? 0.2)) {
      return {isVulnerable: true, windowDuration: +timeLeft.toFixed(3), reason: 'dodgeRecovery'};
    }
    // Whiff ou recuperação final da ação
    if (spec.recovery > 0 && act.elapsed >= (spec.duration - spec.recovery)) {
      return {isVulnerable: true, windowDuration: +timeLeft.toFixed(3), reason: 'actionRecovery'};
    }
  }

  return {isVulnerable: false, windowDuration: 0, reason: 'none'};
}

/**
 * Registra a previsão e o desfecho real de um ataque para detecção de vieses sistemáticos.
 * @param {any} brain
 * @param {{contactChance: number, timeToContact: number}} prediction
 * @param {string} outcome 'hit' | 'blocked' | 'clash' | 'dodged' | 'whiff' | 'interrupted'
 */
export function trackPredictionAccuracy(brain, prediction, outcome) {
  if (!brain.t) return;
  const t = brain.t;
  const pt = (t.predictionTelemetry ??= {samples: 0, sumPredicted: 0, hitsActual: 0, bias: 0});
  pt.samples++;
  pt.sumPredicted += prediction.contactChance;
  const isActualHit = outcome === 'hit' || outcome === 'blocked' || outcome === 'clash';
  if (isActualHit) pt.hitsActual++;
  const meanPred = pt.sumPredicted / pt.samples;
  const actualRate = pt.hitsActual / pt.samples;
  pt.bias = +(actualRate - meanPred).toFixed(3);
}
