// @ts-check
// Gestão inteligente de distância e arena (Fase 4 do Roadmap da IA).
//
// Responsável por:
//   1. Definição de zonas de combate contextuais (segura, ameaça, ideal/sweet spot, punição) por estilo e loadout.
//   2. Navegação com desvio proativo de paredes e cantos (anti-encurralamento).
//   3. Planos de encurralamento com controle de rotas de fuga.
//   4. Histerese de distância para eliminar oscilação (flicker de aproximação/recuo).
//   5. Posicionamento de perseguição após lançamento e aterrissagem (okizeme).
//   6. Gestão disciplinada de sprint com interrupção oportuna para conservar reservas.

import {C} from './config.js';
import {vec, add, scale, sub, dot, length, normalize, clamp, direction} from './math.js';
import {nominalDistance} from './entity.js';

const contactDistance = () => 2 * C.test.halfExtent;

/**
 * Zonas de combate calculadas para o matchup atual.
 * @param {any} self
 * @param {any} target
 * @param {any} style
 * @returns {{safeZone: number, threatZone: number, sweetSpot: number, punishZone: number}}
 */
export function getCombatZones(self, target, style = null) {
  const myReach = contactDistance() + nominalDistance(self, 'tackle') * 0.9;
  const oppReach = contactDistance() + nominalDistance(target, 'tackle') * 0.9;
  const hasRanged = self.loadout?.includes?.('psyshock');

  // Alcance de ameaça do rival
  const threatZone = oppReach + 0.45;

  // Sweet spot baseado em estilo e loadout
  let sweetSpot = myReach * 0.85;
  const styleRange = style?.range ?? 0.9;

  if (hasRanged) {
    sweetSpot = Math.max(4.5, 3.5 + 2.0 * styleRange);
  } else if (style?.id === 'rushdown') {
    sweetSpot = myReach * 0.75;
  } else if (style?.id === 'counter') {
    sweetSpot = threatZone + 0.15;
  } else if (style?.id === 'evasive') {
    sweetSpot = threatZone + 0.45;
  } else if (style?.id === 'turtle') {
    sweetSpot = myReach * 0.95;
  } else {
    sweetSpot = myReach * (0.8 + 0.2 * styleRange);
  }

  // Zona segura: além da qual nenhum dos dois alcança com um dash simples
  const safeZone = Math.max(threatZone + 1.8, 5.0);

  // Zona de punição: espaço ótimo para acertar o rival vulnerável
  const punishZone = myReach * 0.8;

  return {
    safeZone: +safeZone.toFixed(2),
    threatZone: +threatZone.toFixed(2),
    sweetSpot: +sweetSpot.toFixed(2),
    punishZone: +punishZone.toFixed(2),
  };
}

/**
 * Ajusta o vetor de movimento para afastar o lutador das paredes e cantos da arena.
 * @param {{x: number, z: number}} pos
 * @param {{x: number, z: number}} desiredDir
 * @param {number} [arenaHalf]
 * @param {number} [margin]
 * @returns {{x: number, z: number}}
 */
export function safeArenaDirection(pos, desiredDir, arenaHalf = C.test.arenaHalf, margin = 1.6) {
  const lim = arenaHalf - margin;
  let steer = {...desiredDir};
  let pushX = 0;
  let pushZ = 0;

  if (pos.x > lim) pushX = -((pos.x - lim) / margin);
  else if (pos.x < -lim) pushX = (-pos.x - lim) / margin;

  if (pos.z > lim) pushZ = -((pos.z - lim) / margin);
  else if (pos.z < -lim) pushZ = (-pos.z - lim) / margin;

  if (pushX !== 0 || pushZ !== 0) {
    const wallNormal = normalize({x: pushX, z: pushZ});
    const headingIntoWall = dot(desiredDir, wallNormal) < 0;
    if (headingIntoWall) {
      const penetration = Math.hypot(pushX, pushZ);
      const repulsion = 1.2 + penetration * 1.5;
      steer = add(steer, scale(wallNormal, repulsion));
    }
  }

  return length(steer) > 1e-6 ? normalize(steer) : vec();
}

/**
 * Calcula a direção para encurralar o rival contra a borda da arena, cortando a saída para o centro.
 * @param {{x: number, z: number}} selfPos
 * @param {{x: number, z: number}} targetPos
 * @param {number} [arenaHalf]
 * @returns {{x: number, z: number}}
 */
export function cornerPressureDirection(selfPos, targetPos, arenaHalf = C.test.arenaHalf) {
  const center = vec(0, 0);
  const targetFromCenter = sub(targetPos, center);
  const toTarget = sub(targetPos, selfPos);
  const dist = length(toTarget);

  // Se o alvo está próximo da parede, nos posicionamos entre ele e o centro da arena
  const targetWallDist = Math.min(arenaHalf - Math.abs(targetPos.x), arenaHalf - Math.abs(targetPos.z));

  if (targetWallDist < 3.0) {
    const cutoffPoint = add(targetPos, scale(normalize(sub(center, targetPos)), 1.8));
    const toCutoff = sub(cutoffPoint, selfPos);
    if (length(toCutoff) > 0.4) {
      return normalize(toCutoff);
    }
  }

  // Padrão: avança fechando o arco
  return dist > 1e-6 ? normalize(toTarget) : vec(0, 1);
}

/**
 * Aplica histerese para evitar que a IA fique oscilando rapidamente entre avançar e recuar.
 * @param {number} currentDist
 * @param {number} targetDist
 * @param {'approach' | 'retreat' | 'hold'} currentMode
 * @param {number} [deadband]
 * @returns {'approach' | 'retreat' | 'hold'}
 */
export function hysteresisDistance(currentDist, targetDist, currentMode, deadband = 0.35) {
  const diff = currentDist - targetDist;
  if (currentMode === 'approach') {
    if (diff <= -deadband) return 'retreat';
    if (diff <= 0) return 'hold';
    return 'approach';
  }
  if (currentMode === 'retreat') {
    if (diff >= deadband) return 'approach';
    if (diff >= 0) return 'hold';
    return 'retreat';
  }
  // hold
  if (diff > deadband) return 'approach';
  if (diff < -deadband) return 'retreat';
  return 'hold';
}

/**
 * Vetor e timing de perseguição no okizeme (queda e recuperação do adversário).
 * @param {any} self
 * @param {any} target
 * @param {number} [arenaHalf]
 * @returns {{targetPosition: {x: number, z: number}, moveDir: {x: number, z: number}, arriveTime: number}}
 */
export function okizemePlan(self, target, arenaHalf = C.test.arenaHalf) {
  let landPos = {x: target.position.x, z: target.position.z};
  let timeLeft = 0;

  if (target.flight) {
    const flightTime = Math.max(0, 2 * (target.flight.vy ?? 0) / (C.rules.launchGravity ?? 30));
    const horiz = target.flight.horizontal ?? vec();
    landPos = add(landPos, scale(horiz, flightTime * 0.7));
    timeLeft = flightTime;
  } else if (target.knockRecovery > 0) {
    timeLeft = target.knockRecovery;
  }

  const r = C.test.halfExtent;
  const lim = arenaHalf - r;
  landPos.x = clamp(landPos.x, -lim, lim);
  landPos.z = clamp(landPos.z, -lim, lim);

  const myReach = contactDistance() + nominalDistance(self, 'tackle') * 0.8;
  const desiredPos = add(landPos, scale(normalize(sub(self.position, landPos)), myReach * 0.75));
  const toDesired = sub(desiredPos, self.position);

  return {
    targetPosition: landPos,
    moveDir: length(toDesired) > 0.3 ? normalize(toDesired) : vec(),
    arriveTime: +timeLeft.toFixed(3),
  };
}

/**
 * Decisão disciplinada sobre iniciar ou interromper sprint para evitar exaustão desnecessária.
 * @param {any} self
 * @param {number} distance
 * @param {number} threatZone
 * @param {number} budget
 * @returns {boolean}
 */
export function shouldSprintManaged(self, distance, threatZone, budget) {
  if (self.exhausted) return false;
  if (self.stamina < budget) return false;
  // Corre para encurtar distâncias até a borda de engajamento da zona de ameaça (com margem de desaceleração)
  return distance > threatZone + (C.extras.ai.sprintMargin ?? 0.5);
}
