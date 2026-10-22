// @ts-check
// Moves como parte da estratégia central (Fase 7 do Roadmap da IA).
//
// Fornece contrato unificado para avaliação e uso tático de Movimentos Especiais:
//   1. Perfil tático declarativo por Move (alcance, tempo mínimo, custo, Power Levels, utilidade).
//   2. Comparação de valor na mesma decisão que tackle, esquiva e guarda.
//   3. Decisão dinâmica de carga: soltura antecipada defensiva vs manutenção até PL superior.
//   4. Avaliação de linha de tiro e interceptações por barreiras.
//   5. Teste de contrato para inclusão de novos Moves sem alterar a simulação central.

import {C} from './config.js';
import {getMove} from './moves.js';
import {chargePermission} from './controller.js';
import {length, sub} from './math.js';
import {segmentHitsVolume} from './geometry.js';
import {predictProjectileTrajectory} from './prediction.js';

/** Ticks de carga por Power Level */
export const LEVEL_TICKS = {1: 30, 2: 240, 3: 480};
export const REFLECT_TICKS = {1: 180, 2: 240, 3: 480};

const altOf = (/** @type {any} */ f) => (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0);

/**
 * Retorna o perfil tático do movimento com base em seus metadados.
 * @param {string} moveId
 * @returns {{id: string, role: string, optimalRange: [number, number], minChargeSec: number, staminaCost: number, interruptionRisk: number}}
 */
export function getMoveTacticalProfile(moveId) {
  const def = getMove(moveId);
  const cost = def?.cost ?? 1.0;

  if (moveId === 'psyshock') {
    return {
      id: 'psyshock',
      role: 'offensive_ranged',
      optimalRange: [3.2, 14.0],
      minChargeSec: 0.25,
      staminaCost: cost,
      interruptionRisk: 0.65,
    };
  }

  if (moveId === 'reflect') {
    return {
      id: 'reflect',
      role: 'defensive_shield',
      optimalRange: [0.0, 15.0],
      minChargeSec: 1.5,
      staminaCost: cost,
      interruptionRisk: 0.35,
    };
  }

  // Padrão genérico para novos movimentos registrados
  return {
    id: moveId,
    role: def?.category === 'special' ? 'offensive_ranged' : 'melee_strike',
    optimalRange: def?.category === 'special' ? [3.0, 8.0] : [0.5, 2.5],
    minChargeSec: def?.charge ? 0.3 : 0.0,
    staminaCost: cost,
    interruptionRisk: 0.5,
  };
}

/**
 * Avalia se o caminho direto entre os lutadores está obstruído por barreira hostil.
 * @param {any} world
 * @param {any} self
 * @param {any} target
 * @returns {any | null}
 */
export function findObstacleBetween(world, self, target) {
  if (!world?.entities) return null;
  const p0 = {x: self.position.x, z: self.position.z, y: altOf(self) + 0.65};
  const p1 = {x: target.position.x, z: target.position.z, y: altOf(target) + 0.65};
  return world.entities.find((/** @type {any} */ e) => e.reflect && !e.dead && e.owner !== self.id && segmentHitsVolume(e, e.y ?? 0, e.height ?? 2, p0, p1)) ?? null;
}

/**
 * Avalia oportunidade e pontuação de utilidade de um movimento específico.
 * @param {any} self
 * @param {any} target
 * @param {string} moveId
 * @param {number} slotIndex
 * @param {any} world
 * @param {any} [style]
 * @param {(() => number) | null} [rng]
 * @returns {{viable: boolean, utilityScore: number, goalTicks: number, reason: string, level?: number}}
 */
export function evaluateMoveOpportunity(self, target, moveId, slotIndex, world, context, style = null, rng = null) {
  const def = getMove(moveId);
  if (!def) return {viable: false, utilityScore: 0, goalTicks: 0, reason: 'unknown_move'};

  const perm = chargePermission(self, def, slotIndex);
  if (!perm.ok) return {viable: false, utilityScore: 0, goalTicks: 0, reason: perm.reason ?? 'not_allowed'};

  const profile = getMoveTacticalProfile(moveId);
  const distance = context.distance;
  const threat = context.threat;

  // 1. Avaliação do Reflect
  if (profile.role === 'defensive_shield') {
    if (threat) {
      const needTicks = Math.max(180, REFLECT_TICKS[Math.min(3, threat.pl)] ?? 480);
      const canMakeIt = threat.time * 120 >= needTicks + 15;
      if (canMakeIt) {
        return {
          viable: true,
          utilityScore: 9.0 + (threat.pl * 1.5),
          goalTicks: needTicks,
          reason: 'projectile_counter_shield',
        };
      }
    }
    return {viable: false, utilityScore: 0, goalTicks: 0, reason: 'no_incoming_threat'};
  }

  // 2. Avaliação do Psyshock (ofensivo à distância)
  if (profile.role === 'offensive_ranged') {
    const obstacle = findObstacleBetween(world, self, target);
    if (obstacle) {
      return {viable: false, utilityScore: 0, goalTicks: 0, reason: 'barrier_in_line_of_fire'};
    }
    if (distance >= profile.optimalRange[0] && distance <= profile.optimalRange[1] && !target.flight) {
      const far = distance > 6.5;
      const attackAffinity = style?.attack ?? 0.5;
      const patient = (style?.reserve ?? 0.5) > 0.6 || (style?.bait ?? 0.5) > 0.6;
      let level = 2;
      if (typeof rng === 'function') {
        const r = rng();
        level = r < (far && patient ? 0.2 : 0.45) ? 1 : r < (far ? 0.7 : 0.9) ? 2 : 3;
      } else {
        level = distance > 7.5 ? 3 : (far && attackAffinity > 0.4 ? 2 : 1);
      }
      const goalTicks = LEVEL_TICKS[level];
      const score = 2.0 + 3.0 * attackAffinity + (far ? 1.5 : 0);
      return {
        viable: true,
        utilityScore: +score.toFixed(2),
        goalTicks,
        level,
        reason: 'ranged_artillery_opening',
      };
    }
    return {viable: false, utilityScore: 0, goalTicks: 0, reason: 'out_of_optimal_range'};
  }

  return {viable: false, utilityScore: 0, goalTicks: 0, reason: 'default_no_action'};
}

/**
 * Decide se uma carga em andamento deve ser solta antecipadamente para evitar interrupção.
 * @param {any} self
 * @param {any} target
 * @param {{move: string, ticks: number}} charge
 * @param {number} distance
 * @param {any} [threat]
 * @returns {{shouldRelease: boolean, reason: string}}
 */
export function evaluateChargeContinuation(self, target, charge, distance, threat = null) {
  if (charge.move === 'psyshock') {
    // Se o rival está avançando rapidamente e já estamos no PL1 (ou PL2), solta para repelir
    if (distance < 3.0 && charge.ticks >= LEVEL_TICKS[1]) {
      return {shouldRelease: true, reason: 'early_release_close_proximity'};
    }
  }

  if (charge.move === 'reflect') {
    // Se a barreira atingiu o mínimo de 1.5s (180 ticks) e o projétil está colidindo, libera
    if (charge.ticks >= 180 && threat && threat.time < 0.25) {
      return {shouldRelease: true, reason: 'shield_ready_for_incoming_impact'};
    }
  }

  return {shouldRelease: false, reason: 'continue_charging'};
}

/**
 * Validação de contrato para garantir que qualquer movimento registrado suporta o pipeline de IA.
 * @param {any} moveDef
 * @returns {boolean}
 */
export function contractCheckMoveStrategy(moveDef) {
  if (!moveDef || typeof moveDef.id !== 'string') return false;
  const profile = getMoveTacticalProfile(moveDef.id);
  if (!profile.role || !Array.isArray(profile.optimalRange)) return false;
  if (profile.optimalRange.length !== 2 || profile.optimalRange[0] > profile.optimalRange[1]) return false;
  if (typeof profile.minChargeSec !== 'number' || typeof profile.staminaCost !== 'number') return false;
  return true;
}
