// @ts-check
// Dividido de ai-eval.js (comportamento idêntico): eval-matrix.

import {evalPairedSeries} from './eval-series.js';

/** Executa avaliação em toda a matriz de loadouts (sem moves, reflect, psyshock, ambos). */
export function evalLoadoutMatrix({
  pairs = 15,
  seed = 1,
  candidateRev = 1,
  baselineRev = 0,
  values = {},
} = {}) {
  const loadoutKeys = ['none', 'reflect', 'psyshock', 'both'];
  const matrix = {};
  for (const lk of loadoutKeys) {
    matrix[lk] = evalPairedSeries({
      pairs,
      seed,
      candidateRev,
      baselineRev,
      loadouts: lk,
      values,
    });
  }
  return {
    pairs,
    seed,
    candidateRev,
    baselineRev,
    matrix,
  };
}
/** Executa avaliação em toda a matriz de estilos (1 a 6). */
export function evalStyleMatrix({
  pairs = 15,
  seed = 1,
  candidateRev = 1,
  baselineRev = 0,
  styles = [1, 2, 3, 4, 5, 6],
} = {}) {
  const matrix = {};
  for (const st of styles) {
    const values = {'extras.aiBlue.style': st, 'extras.aiRed.style': st};
    matrix[st] = evalPairedSeries({
      pairs,
      seed,
      candidateRev,
      baselineRev,
      loadouts: 'none',
      values,
    });
  }
  return {
    pairs,
    seed,
    candidateRev,
    baselineRev,
    styles,
    matrix,
  };
}
/** Linhas de relatório formatadas (suporta tanto série simples quanto pareada). */
export function evalRows(r) {
  const pct = (a, b) => b ? `${(100 * a / b).toFixed(0)}%` : '—';
  const f = v => typeof v === 'number' ? +v.toFixed(2) : '—';

  // Se for resultado de evalPairedSeries
  if (r.candidateStats && r.baselineStats) {
    const c = r.candidateStats, b = r.baselineStats;
    const candWinsStr = `${c.wins}/${r.totalMatches} (${(r.candRateCombined * 100).toFixed(1)}% · Azul ${(r.candRateBlue * 100).toFixed(0)}% / Vermelho ${(r.candRateRed * 100).toFixed(0)}%)`;
    const baseWinsStr = `${b.wins}/${r.totalMatches} (${(r.baseRateCombined * 100).toFixed(1)}% · Azul ${(r.baseWinsBlue / r.pairs * 100).toFixed(0)}% / Vermelho ${(r.baseWinsRed / r.pairs * 100).toFixed(0)}%)`;

    return [
      ['Vitórias pareadas (Total · Azul / Vermelho)', candWinsStr, baseWinsStr],
      ['Intervalo de Confiança 95%', `[${(r.ci95[0] * 100).toFixed(1)}%, ${(r.ci95[1] * 100).toFixed(1)}%] (±${(r.se * 1.96 * 100).toFixed(1)}%)`, '—'],
      ['Dano total causado', f(c.damage), f(b.damage)],
      ['Dano de projéteis (causado / sofrido)', `${f(c.projectileDamageDealt)} / ${f(c.projectileDamageTaken)}`, `${f(b.projectileDamageDealt)} / ${f(b.projectileDamageTaken)}`],
      ['Tackles (X)', c.tackles, b.tackles],
      ['X que acertaram (sem defesa)', c.hits, b.hits],
      ['X bloqueados', c.blocked, b.blocked],
      ['X sem contato (whiffs)', `${c.whiffs} (${pct(c.whiffs, c.tackles)})`, `${b.whiffs} (${pct(b.whiffs, b.tackles)})`],
      ['Clashes', c.clashes, b.clashes],
      ['Esquivas (C)', c.dodges, b.dodges],
      ['C → X', c.cancels, b.cancels],
      ['Sprints', c.sprints, b.sprints],
      ['Defesas', c.guards, b.guards],
      ['Esquivas perfeitas', c.perfectDodges, b.perfectDodges],
      ['Stamina gasta', f(c.staminaSpent), f(b.staminaSpent)],
      ['Stamina desperdiçada (whiffs)', f(c.staminaWasted), f(b.staminaWasted)],
      ['Tempo exausto (s)', f(c.exhaustedTime), f(b.exhaustedTime)],
      ['Ações negadas pelo motor', c.denied, b.denied],
      ['Contra-ataques aproveitados', `${c.counterTaken} de ${c.counterOpen} (${pct(c.counterTaken, c.counterOpen)})`, `${b.counterTaken} de ${b.counterOpen} (${pct(b.counterTaken, b.counterOpen)})`],
      ['Contra-ataques perdidos', c.counterMissed, b.counterMissed],
      ['Oportunidades de punição perdidas', c.missedPunish, b.missedPunish],
      ['Danos limpos sofridos com stamina (defesa perdida)', c.missedDefense, b.missedDefense],
      ['Oportunidades de Move perdidas (ex: Reflect)', c.missedMoves ?? 0, b.missedMoves ?? 0],
      ['Desfechos do Tackle (Acerto / Block / Clash / Esquivado / Interrompido / Whiff)', `${c.attackOutcomes?.hit ?? 0} / ${c.attackOutcomes?.blocked ?? 0} / ${c.attackOutcomes?.clash ?? 0} / ${c.attackOutcomes?.dodged ?? 0} / ${c.attackOutcomes?.interrupted ?? 0} / ${c.attackOutcomes?.whiff ?? 0}`, `${b.attackOutcomes?.hit ?? 0} / ${b.attackOutcomes?.blocked ?? 0} / ${b.attackOutcomes?.clash ?? 0} / ${b.attackOutcomes?.dodged ?? 0} / ${b.attackOutcomes?.interrupted ?? 0} / ${b.attackOutcomes?.whiff ?? 0}`],
      ['Falhas por taxonomia (Previsão / Execução / Estratégia / Percepção / Regras)', `${c.taxonomyErrors?.prediction_error ?? 0} / ${c.taxonomyErrors?.execution_error ?? 0} / ${c.taxonomyErrors?.strategy_error ?? 0} / ${c.taxonomyErrors?.perception_error ?? 0} / ${c.taxonomyErrors?.rule_limitation ?? 0}`, `${b.taxonomyErrors?.prediction_error ?? 0} / ${b.taxonomyErrors?.execution_error ?? 0} / ${b.taxonomyErrors?.strategy_error ?? 0} / ${b.taxonomyErrors?.perception_error ?? 0} / ${b.taxonomyErrors?.rule_limitation ?? 0}`],
      ['Moves (cargas iniciadas / concluídas / canceladas)', `${c.chargesStarted} / ${c.chargesCompleted} / ${c.chargesAborted}`, `${b.chargesStarted} / ${b.chargesCompleted} / ${b.chargesAborted}`],
      ['Tempo médio de decisão da IA (µs)', c.decisionsCount ? f(c.decisionTimeMs * 1000 / c.decisionsCount) : '—', b.decisionsCount ? f(b.decisionTimeMs * 1000 / b.decisionsCount) : '—'],
    ];
  }

  // Formato legado de evalSeries
  const s = r.sides;
  return [
    ['Vitórias', s[0].wins, s[1].wins],
    ['Tackles (X)', s[0].tackles, s[1].tackles],
    ['X que acertaram (sem defesa)', s[0].hits, s[1].hits],
    ['X bloqueados', s[0].blocked, s[1].blocked],
    ['X que não tocaram ninguém', s[0].whiffs, s[1].whiffs],
    ['Clashes', s[0].clashes, s[1].clashes],
    ['Esquivas (C)', s[0].dodges, s[1].dodges],
    ['C → X', s[0].cancels, s[1].cancels],
    ['Sprints', s[0].sprints, s[1].sprints],
    ['Defesas', s[0].guards, s[1].guards],
    ['Esquivas perfeitas', s[0].perfectDodges, s[1].perfectDodges],
    ['Stamina gasta', f(s[0].staminaSpent), f(s[1].staminaSpent)],
    ['Stamina desperdiçada (X sem contato)', f(s[0].staminaWasted), f(s[1].staminaWasted)],
    ['Tempo exausto (s)', f(s[0].exhaustedTime), f(s[1].exhaustedTime)],
    ['Ações negadas pelo motor', s[0].denied, s[1].denied],
    ['Toques de D com a defesa perfeita em recarga', s[0].perfectUnavailable, s[1].perfectUnavailable],
    ['Contra-ataques aproveitados', `${s[0].counterTaken} de ${s[0].counterOpen} (${pct(s[0].counterTaken, s[0].counterOpen)})`, `${s[1].counterTaken} de ${s[1].counterOpen} (${pct(s[1].counterTaken, s[1].counterOpen)})`],
  ];
}
