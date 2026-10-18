// @ts-check
// Percepção justa e memória da IA (Fase 2 do Roadmap).
// Garante que a IA perceba apenas o que um jogador humano veria na tela:
//   1. Posição e velocidade aparente estimadas por amostragem temporal (sem telepatia de vetores internos).
//   2. Atraso de reação humano e incerteza (jitter / misread) unificados para ataques (Tackle) e projéteis/Moves.
//   3. Memória de última posição observada quando fora de foco ou atrás de barreiras.
//   4. Conhecimento do loadout adversário restrito ao que foi revelado (utilizado/visto) durante o combate.
//   5. Estado oculto ainda não percebido não altera os comandos da IA (determinismo e jogo justo).

import {C} from './config.js';
import {vec, add, scale, sub, length, normalize, dot} from './math.js';

/**
 * Inicializa o estado de percepção sensorial da IA.
 * @param {any} brain
 * @param {any} P Personalidade da IA
 */
export function initPerception(brain, P) {
  return {
    lastSeenPos: null,
    apparentVel: vec(),
    lastSeenTime: 0,
    // Ação do oponente percebida com atraso
    observedAction: null,
    pendingAction: null,
    actionPerceivedAt: 0,
    actionMisread: false,
    // Carga do oponente percebida com atraso
    observedCharge: null,
    pendingCharge: null,
    chargePerceivedAt: 0,
    // Projéteis rastreados com atraso de reação e incerteza
    trackedProjectiles: new Map(), // id -> { perceivedAt, misread, apparentPl }
    // Loadout revelado
    revealedMoves: new Set(),
    // Hipóteses táticas
    confidence: 1.0,
  };
}

/**
 * Atualiza o rastreamento sensorial do oponente no passo atual.
 * @param {any} perc Estado de percepção
 * @param {any} brain Brain da IA
 * @param {any} self Lutador controlado
 * @param {any} target Lutador oponente
 * @param {number} dt Delta time do passo
 * @param {any} P Personalidade
 * @param {number} currentTime Tempo atual da luta
 */
export function updatePerception(perc, brain, self, target, dt, P, currentTime) {
  if (!target) return perc;

  // 1. Atualização de velocidade aparente (sem ler diretamente vetores ocultos de física)
  if (perc.lastSeenPos && dt > 1e-6) {
    const rawVel = scale(sub(target.position, perc.lastSeenPos), 1 / dt);
    // Filtro responsivo para acompanhar investidas e paradas rapidamente
    perc.apparentVel = add(scale(perc.apparentVel, 0.25), scale(rawVel, 0.75));
  } else {
    perc.apparentVel = vec();
  }
  perc.lastSeenPos = {...target.position};
  perc.lastSeenTime = currentTime;

  // 2. Percepção da ação do rival com atraso de reação e erro plausível
  const actualAction = target.action?.kind ?? (target.guard ? 'guard' : null);
  const actionRestarted = actualAction && actualAction === perc.pendingAction && (target.action?.elapsed ?? 0) < (perc.lastTargetElapsed ?? 0) - 1e-9;
  perc.lastTargetElapsed = target.action?.elapsed ?? 0;

  if (currentTime >= perc.actionPerceivedAt && perc.pendingAction !== perc.observedAction) {
    perc.observedAction = perc.pendingAction;
    perc.observedActionDistance = perc.pendingActionDistance;
  }

  if (actualAction !== perc.pendingAction || actionRestarted) {
    // Se a ação anterior terminou antes de ser percebida (ex: golpe rápido conectou antes do tempo de reação),
    // confirma a observação da ação que ocorreu para que o histórico e adaptação registrem o ataque.
    if (perc.pendingAction && perc.observedAction !== perc.pendingAction) {
      perc.observedAction = perc.pendingAction;
      perc.observedActionDistance = perc.pendingActionDistance;
    }
    perc.pendingAction = actualAction;
    perc.pendingActionDistance = length(sub(target.position, self.position));
    // Início de ação requer tempo de reação humano (~0.12 - 0.16s).
    // Término de ação / volta ao neutro / recoil são percebidos quase imediatamente (0.02s) para permitir punições.
    const isEnding = !actualAction || actualAction === 'recoil';
    const baseDelay = isEnding ? 0.02 : (P.reaction ?? 0.15);
    const jitter = isEnding ? 0.01 : (P.reactionJitter ?? 0.05);
    const reactionDelay = baseDelay + brain.random() * jitter;
    perc.actionPerceivedAt = currentTime + reactionDelay;
    perc.actionMisread = !isEnding && brain.random() < (P.mistake ?? 0.06);
  }

  // 3. Percepção justa do carregamento do rival com atraso de reação
  const actualCharge = target.charge?.move ?? null;
  if (actualCharge !== perc.pendingCharge) {
    perc.pendingCharge = actualCharge;
    const isEnding = !actualCharge;
    const baseDelay = isEnding ? 0.02 : (P.reaction ?? 0.15);
    const jitter = isEnding ? 0.01 : (P.reactionJitter ?? 0.05);
    const reactionDelay = baseDelay + brain.random() * jitter;
    perc.chargePerceivedAt = currentTime + reactionDelay;
  }
  if (currentTime >= perc.chargePerceivedAt) {
    perc.observedCharge = perc.pendingCharge;
  }
  if (perc.observedCharge) {
    perc.revealedMoves.add(perc.observedCharge);
  }

  return perc;
}

/**
 * Percepção de projéteis hostis com atraso de reação e incerteza unificados.
 * @param {any} perc Estado de percepção
 * @param {any} brain Brain da IA
 * @param {any} world Mundo físico da simulação
 * @param {any} self Lutador controlado
 * @param {number} currentTime Tempo atual
 * @param {any} P Personalidade
 */
export function perceiveIncomingProjectile(perc, brain, world, self, currentTime, P) {
  if (!world?.entities) return null;

  let best = /** @type {{time: number, pl: number, id: number, misread?: boolean} | null} */ (null);
  const activeIds = new Set();

  for (const p of world.entities) {
    if (p.kind !== 'projectile' || p.dead || p.owner === self.id) continue;
    activeIds.add(p.id);

    // Registra quando o projétil surgiu e quando ele é percebido
    let tracking = perc.trackedProjectiles.get(p.id);
    if (!tracking) {
      const delay = (P.reaction ?? 0.15) + brain.random() * (P.reactionJitter ?? 0.08);
      const misread = brain.random() < (P.mistake ?? 0.1);
      tracking = {
        perceivedAt: currentTime + delay,
        misread,
        apparentPl: misread ? Math.max(1, (p.pl ?? 1) + (brain.random() < 0.5 ? 1 : -1)) : (p.pl ?? 1),
      };
      perc.trackedProjectiles.set(p.id, tracking);
    }

    // Se o projétil ainda não atingiu o limiar de reação, a IA ainda não percebeu a ameaça
    if (currentTime < tracking.perceivedAt) continue;

    // Revela que o oponente possui projétil no loadout
    if (p.move) perc.revealedMoves.add(p.move);

    const speed = length(p.vel);
    if (speed < 1e-6) continue;
    const dir = {x: p.vel.x / speed, z: p.vel.z / speed};
    const d = sub(self.position, p.pos);
    const along = dot(d, dir);
    if (along <= 0 || along > 26) continue;

    const lateral = Math.hypot(d.x - dir.x * along, d.z - dir.z * along);
    if (lateral > C.test.halfExtent + (p.radius ?? 0.2) + 0.35) continue;

    const time = along / speed;
    if (!best || time < best.time) {
      best = {
        time,
        pl: tracking.apparentPl,
        id: p.id,
        misread: tracking.misread,
      };
    }
  }

  // Limpa projéteis que já desapareceram
  for (const id of perc.trackedProjectiles.keys()) {
    if (!activeIds.has(id)) perc.trackedProjectiles.delete(id);
  }

  return best;
}

/** Verifica se um move do adversário já foi revelado durante o combate. */
export function isMoveRevealed(perc, moveId) {
  return perc?.revealedMoves?.has(moveId) ?? false;
}
