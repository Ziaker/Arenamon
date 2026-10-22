// @ts-check
// Defesa e punição contextuais (Fase 6 do Roadmap da IA).
//
// Trata com precisão:
//   1. Escolha inteligente de respostas a ameaças (bloquear, defesa perfeita, esquiva, recuo, clash).
//   2. Anti-previsibilidade: evita repetir padrões defensivos idênticos quando o rival os explora.
//   3. Ameaças simultâneas (ex: golpe corpo a corpo enquanto um projétil se aproxima).
//   4. Planejamento pós-bloqueio (contra-ataque com vantagem vs reposicionamento com desvantagem).
//   5. Verificação prévia de alcance e viabilidade antes de iniciar uma punição.

import {C} from './config.js';
import {canDefenseArrive} from './prediction.js';
import {isDepleted} from './controller.js';
import {passiveCost} from './passive-engine.js';

/**
 * Seleciona a melhor resposta defensiva para uma ameaça identificada.
 * @param {any} self
 * @param {any} target
 * @param {{reaches: boolean, tte: number, distance: number}} threat
 * @param {any} S
 * @param {any} P
 * @param {string[]} [recentResponses]
 * @param {(() => number) | null} [rng]
 * @returns {{response: string, reason: string}}
 */
export function selectDefenseResponse(self, target, threat, S, P, recentResponses = [], rng = null) {
  if (!threat.reaches) {
    return {response: 'whiff', reason: 'threat_will_miss'};
  }

  const perfectReady = self.perfectCooldown <= 0;
  const perfCheck = canDefenseArrive(self, threat.tte, 'perfectGuard');
  const guardCheck = canDefenseArrive(self, threat.tte, 'guard');
  const dodgeCheck = canDefenseArrive(self, threat.tte, 'dodge');

  // Anti-previsibilidade: se usou a mesma resposta nas últimas 2 defesas, desfavorece repetição
  const last2 = recentResponses.slice(-2);
  const repeatedPerf = last2.length >= 2 && last2.every(r => r === 'perfectGuard');
  const repeatedDodge = last2.length >= 2 && last2.every(r => r === 'sidestep' || r === 'vault');
  const dodgeCost = passiveCost(self, 'dodge', C.actions.dodge.cost);   // custo efetivo (Technician, R10/R25)
  const affordDodge = !self.exhausted && self.stamina >= dodgeCost;
  const dodgeKeeps = isDepleted(self.stamina - dodgeCost) ? 0.3 : 1.0;
  const canDodge = affordDodge && !isDepleted(self.stamina - dodgeCost);
  const dodgeViable = (canDodge || affordDodge) && dodgeCheck.canArrive;

  const affordTackle = !self.exhausted && self.stamina >= C.actions.tackle.cost;
  const canDash = affordTackle && !isDepleted(self.stamina - C.actions.tackle.cost);
  const randomFn = rng ?? P?.random;
  const chaos = S.chaos ? 0.5 + (randomFn ? randomFn() : 0.5) : 1.0;

  /** @type {Array<{response: string, weight: number, reason: string}>} */
  const candidates = [];

  // 1. Defesa perfeita
  if (perfCheck.canArrive && perfectReady) {
    const w = (S.guard ?? 0.5) * (perfectReady ? (S.perfect ?? 0.5) : 0.3) * 1.35 * (repeatedPerf ? 0.2 : 1.0);
    candidates.push({response: 'perfectGuard', weight: w, reason: 'perfect_guard_optimal_window'});
  }

  // 2. Interceptação com clash
  if (canDash && threat.tte < 0.28 && (self.attributes.attack >= target.attributes.attack || (S.clash ?? 0) >= 0.4)) {
    const w = (S.clash ?? 0.3) * (self.attributes.attack >= target.attributes.attack ? 1.2 : 0.7);
    candidates.push({response: 'clash', weight: w, reason: 'clash_intercept'});
  }

  // 3. Esquiva lateral
  if (dodgeViable) {
    const w = (S.dodge ?? 0.5) * (0.6 + (S.perfect ?? 0.5)) * dodgeKeeps * (repeatedDodge ? 0.25 : 1.0);
    candidates.push({response: 'sidestep', weight: w, reason: 'evasion_stamina_healthy'});
  }

  // 4. Salto por cima (vault)
  if (dodgeViable) {
    const w = (S.dodge ?? 0.5) * 0.35 * chaos * dodgeKeeps * (repeatedDodge ? 0.25 : 1.0);
    candidates.push({response: 'vault', weight: w, reason: 'vault_evasion'});
  }

  // 5. Bloqueio comum
  if (guardCheck.canArrive) {
    const w = (S.guard ?? 0.5) * (1 - 0.5 * (S.perfect ?? 0.5));
    candidates.push({response: 'guard', weight: w, reason: 'standard_guard_reliable'});
  }

  // 6. Recuo como último recurso
  candidates.push({response: 'backstep', weight: 0.15 * (1 - (S.guard ?? 0.5)), reason: 'emergency_spacing'});

  if (candidates.length === 0) {
    return {response: 'guard', reason: 'standard_guard_reliable'};
  }

  // Se uma função RNG for fornecida, fazemos o sorteio ponderado
  if (typeof randomFn === 'function') {
    const total = candidates.reduce((sum, c) => sum + Math.max(0, c.weight), 0);
    if (total <= 0) return candidates[0];
    let r = randomFn() * total;
    for (const c of candidates) {
      r -= Math.max(0, c.weight);
      if (r <= 0) return c;
    }
    return candidates[candidates.length - 1];
  }

  // Sem RNG (testes determinísticos isolados): escolhe o candidato de maior peso
  candidates.sort((a, b) => b.weight - a.weight);
  return candidates[0];
}

/**
 * Decide a ação imediata após um bloqueio concluído.
 * @param {any} self
 * @param {any} target
 * @param {'perfect' | 'partial'} blockType
 * @param {{contactChance: number, punishRisk: number} | null} [pred]
 * @returns {'counter' | 'reset' | 'guard'}
 */
export function postBlockDecision(self, target, blockType, pred = null) {
  // Se foi defesa perfeita, aproveita a janela de contra-ataque
  if (blockType === 'perfect' || self.counterWindow > 0) {
    if (!self.exhausted && self.stamina >= C.actions.tackle.cost && (!pred || pred.contactChance >= 0.45)) {
      return 'counter';
    }
  }

  // Se o rival está em recuperação pesada após o bloqueio
  if (target.action?.kind === 'recoil' || (target.action && target.action.elapsed > 0.3)) {
    if (!self.exhausted && self.stamina >= C.actions.tackle.cost && (!pred || pred.contactChance >= 0.6)) {
      return 'counter';
    }
  }

  // Se o lutador está em desvantagem ou sem stamina, mantém o espaçamento/guarda
  if (self.exhausted || self.stamina < 1.2) {
    return 'reset';
  }

  return 'guard';
}

/**
 * Verifica se uma oportunidade de punição é viável antes de solicitar o ataque.
 * @param {any} self
 * @param {any} target
 * @param {{isVulnerable: boolean, windowDuration: number}} punishWindow
 * @param {{contactChance: number, timeToContact: number, punishRisk: number}} contactPrediction
 * @returns {{canPunish: boolean, reason: string}}
 */
export function canPunishSafely(self, target, punishWindow, contactPrediction) {
  if (!punishWindow.isVulnerable) {
    return {canPunish: false, reason: 'target_not_vulnerable'};
  }

  // Ataque deve alcançar dentro da janela de vulnerabilidade
  if (contactPrediction.timeToContact > punishWindow.windowDuration + 0.05) {
    return {canPunish: false, reason: 'cannot_reach_before_recovery'};
  }

  // Probabilidade de contato mínima aceitável
  if (contactPrediction.contactChance < 0.45) {
    return {canPunish: false, reason: 'low_contact_probability'};
  }

  // Recursos suficientes
  if (self.exhausted || self.stamina < C.actions.tackle.cost) {
    return {canPunish: false, reason: 'insufficient_stamina'};
  }

  return {canPunish: true, reason: 'safe_punish_confirmed'};
}
