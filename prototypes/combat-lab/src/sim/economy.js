// @ts-check
// Economia de stamina baseada em valor (Fase 5 do Roadmap da IA).
//
// Substitui a restrição rígida de stamina (que tornava a IA passiva) por uma avaliação
// contextual de valor esperado:
//   1. Valor esperado de atacar agora vs risco de sofrer punição e ficar exausto.
//   2. Aceitação deliberada de exaustão em oportunidades de alto retorno (finalização,
//      punição a rival já exausto, contra-ataque de alta chance).
//   3. Rejeição de exaustão em ataques com baixa probabilidade de contato.
//   4. Planejamento de combinações completas (esquiva + cancelamento + tackle).
//   5. Métricas de eficiência: dano por unidade de stamina e taxa de conversão.

import {C} from './config.js';
import {isDepleted} from './controller.js';

/**
 * Avalia se o gasto de stamina para uma ação é justificado pelo valor esperado.
 * @param {any} self
 * @param {any} target
 * @param {string} actionKind
 * @param {{contactChance: number, punishRisk: number}} prediction
 * @param {any} style
 * @returns {{allowed: boolean, expectedValue: number, reason: string}}
 */
export function valueBasedStamina(self, target, actionKind, prediction, style = null) {
  const act = C.actions[actionKind] ?? C.actions.tackle;
  const cost = act.cost ?? 1.0;
  const staminaAfter = self.stamina - cost;
  const willExhaust = isDepleted(staminaAfter);

  // 1. Se não causa exaustão, custo direto é aceitável desde que haja alguma chance
  if (!willExhaust) {
    return {
      allowed: true,
      expectedValue: +(prediction.contactChance * 1.5).toFixed(2),
      reason: 'stamina_healthy',
    };
  }

  // 2. Avaliação de oportunidades críticas onde a exaustão é compensatória:
  const attackDamage = self.attributes.attack * 1.05;

  // Finalização garantida: se o dano mata o rival, exaurir-se é a escolha correta
  if (target.hp <= attackDamage && prediction.contactChance >= 0.40) {
    return {
      allowed: true,
      expectedValue: 10.0,
      reason: 'finishing_blow',
    };
  }

  // Contra-ataque fortalecido: bônus de dano/velocidade compensa o risco
  if (self.counterWindow > 0 && prediction.contactChance >= 0.55) {
    return {
      allowed: true,
      expectedValue: 5.0,
      reason: 'counter_window_priority',
    };
  }

  // Adversário vulnerável: rival exausto, em aterrissagem ou em recuperação longa
  const targetHelpless = target.exhausted || target.knockRecovery > 0.2;
  if (targetHelpless && prediction.contactChance >= 0.65) {
    return {
      allowed: true,
      expectedValue: 4.0,
      reason: 'punish_helpless_target',
    };
  }

  // 3. Avaliação de valor esperado regular contra custo de exaustão
  // Valor = probabilidade de acertar * impacto potencial
  const potentialImpact = attackDamage / Math.max(10, target.hp);
  const expectedGain = prediction.contactChance * potentialImpact * 3.0;

  // Custo de risco = probabilidade de punição * perigo do adversário
  const targetPunishPotential = !target.exhausted ? (target.attributes.attack / Math.max(10, self.hp)) : 0.1;
  const reserveDiscipline = style?.reserve ?? 0.5;
  const riskPenalty = prediction.punishRisk * targetPunishPotential * (1.5 + reserveDiscipline);

  const netValue = expectedGain - riskPenalty;

  if (netValue >= 0.65 && prediction.contactChance >= 0.75 && (target.exhausted || target.hp <= attackDamage * 1.35)) {
    return {
      allowed: true,
      expectedValue: +netValue.toFixed(2),
      reason: 'high_value_gamble',
    };
  }

  // Rejeita ação que causaria exaustão sem retorno proporcional
  return {
    allowed: false,
    expectedValue: +netValue.toFixed(2),
    reason: 'prevent_unfavorable_exhaustion',
  };
}

/**
 * Verifica se a reserva atual comporta uma sequência de ações encadeadas (ex: esquiva + tackle).
 * @param {any} self
 * @param {string[]} actions
 * @param {number} [reserveMargin]
 * @returns {{canAfford: boolean, totalCost: number, remaining: number}}
 */
export function staminaComboBudget(self, actions, reserveMargin = 0) {
  let totalCost = 0;
  for (const act of actions) {
    totalCost += (C.actions[act]?.cost ?? 1.0);
  }
  const remaining = self.stamina - totalCost;
  const canAfford = !self.exhausted && remaining >= reserveMargin && !isDepleted(remaining);
  return {
    canAfford,
    totalCost: +totalCost.toFixed(2),
    remaining: +remaining.toFixed(2),
  };
}

/**
 * Telemetria de eficiência de stamina para calibração.
 * @param {any} brain
 * @param {number} staminaSpent
 * @param {number} damageDealt
 * @param {boolean} voluntaryExhaustion
 */
export function trackStaminaEfficiency(brain, staminaSpent, damageDealt, voluntaryExhaustion) {
  if (!brain.t) return;
  const st = (brain.t.staminaTelemetry ??= {
    spentTotal: 0,
    damageTotal: 0,
    voluntaryExhaustions: 0,
    damagePerStamina: 0,
  });
  st.spentTotal += staminaSpent;
  st.damageTotal += damageDealt;
  if (voluntaryExhaustion) st.voluntaryExhaustions++;
  st.damagePerStamina = st.spentTotal > 0 ? +(st.damageTotal / st.spentTotal).toFixed(3) : 0;
}
