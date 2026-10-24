// Dividido de ai-eval.js (comportamento idêntico): eval-loadout.

import {length} from '../math.js';

export const LOADOUT_PRESETS = {
  none: {id: 'none', label: 'Sem Moves', slots: [[], []]},
  reflect: {id: 'reflect', label: 'Reflect', slots: [['reflect'], ['reflect']]},
  psyshock: {id: 'psyshock', label: 'Psyshock', slots: [['psyshock'], ['psyshock']]},
  both: {id: 'both', label: 'Reflect + Psyshock', slots: [['reflect', 'psyshock'], ['reflect', 'psyshock']]},
};
export function resolveLoadout(l) {
  if (typeof l === 'string') return LOADOUT_PRESETS[l]?.slots ?? [[], []];
  if (Array.isArray(l)) {
    if (l.length === 2 && Array.isArray(l[0]) && Array.isArray(l[1])) return l;
    if (l.length === 1 && Array.isArray(l[0])) return [l[0], l[0]];
    return [l, l];
  }
  return [[], []];
}
export const ERROR_TAXONOMY = {
  prediction_error: {id: 'prediction_error', label: 'Erro de previsão', description: 'Ataque que errou o alvo por cálculo incorreto de alcance ou deslocamento.'},
  execution_error: {id: 'execution_error', label: 'Erro de execução', description: 'Tentativa de comando rejeitada pelo controlador por falta de recursos ou recarga.'},
  strategy_error: {id: 'strategy_error', label: 'Erro de estratégia', description: 'Escolha inadequada para o contexto (ex: sofrer dano tendo recursos de guarda, não punir).'},
  perception_error: {id: 'perception_error', label: 'Erro de percepção', description: 'Reação atrasada ou leitura errada de ameaça iminente.'},
  rule_limitation: {id: 'rule_limitation', label: 'Limitação de regras', description: 'Dano ou desvantagem inevitável devido às regras físicas (ex: stun, sem stamina restante).'},
};
export function explainDefeat(match, loserId) {
  if (loserId == null || loserId < 0 || !match?.sides?.[loserId]) return null;
  const s = match.sides[loserId];
  const opp = match.sides[1 - loserId];
  const myWorst = (match.worstDecisions || []).filter(d => d.fighter === loserId);
  const tax = s.taxonomyErrors ?? {};
  
  const topCauses = Object.entries(tax).sort((a, b) => b[1] - a[1]);
  const worst3 = myWorst.slice(0, 3);
  
  const narrative = [
    `Lutador ${loserId === 0 ? 'Azul' : 'Vermelho'} foi derrotado em ${match.seconds?.toFixed ? match.seconds.toFixed(1) : match.seconds}s.`,
    `Dano sofrido: ${(100 - (match.finalHp?.[loserId] ?? 0)).toFixed(1)} HP · Stamina desperdiçada: ${s.staminaWasted?.toFixed(1) ?? 0} · Ações negadas: ${s.denied}.`,
    `Distribuição de falhas: Previsão (${tax.prediction_error ?? 0}), Execução (${tax.execution_error ?? 0}), Estratégia (${tax.strategy_error ?? 0}), Percepção (${tax.perception_error ?? 0}), Regras (${tax.rule_limitation ?? 0}).`,
  ];
  if (worst3.length > 0) {
    narrative.push('Decisões mais custosas:');
    worst3.forEach((w, i) => {
      narrative.push(`  ${i + 1}. [${w.time}s | ${w.taxonomy}] ${w.reason} (${w.hpCost ? w.hpCost + ' HP' : ''}${w.staminaCost ? ' ' + w.staminaCost + ' Stamina' : ''}) - ${w.detail ?? ''}`);
    });
  }
  return {
    loser: loserId,
    duration: match.seconds,
    summary: narrative.join('\n'),
    topErrors: topCauses,
    worstDecisions: worst3,
  };
}
