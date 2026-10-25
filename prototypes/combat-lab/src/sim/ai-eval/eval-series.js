// Dividido de ai-eval.js (comportamento idêntico): eval-series.

import {withValues} from '../compare.js';
import {length} from '../math.js';
import {evalMatch, side} from './eval-match.js';
import {resolveLoadout} from './eval-loadout.js';

/** Várias lutas com sementes consecutivas; `values` muda a configuração (ex.: revisão da IA) só durante a avaliação. */
export function evalSeries({
  matches = 20,
  nav = [false, false],
  scenarioSetup = null,
  initialPositions = null,
  seed = 1,
  blueMode = 'tactical',
  redMode = 'tactical',
  values = {},
  maxSeconds = 90,
  blueRev = null,
  redRev = null,
  blueFeatures = null,
  redFeatures = null,
  loadouts = [[], []],
  measureDecisionTime = false,
} = {}) {
  return withValues(values, () => {
    const runs = [];
    for (let i = 0; i < matches; i++) {
      runs.push(evalMatch({
        seed: seed + i,
        blueMode,
        redMode,
        maxSeconds,
        blueRev,
        redRev,
        blueFeatures,
        redFeatures,
        loadouts,
        measureDecisionTime,
        nav,
        scenarioSetup,
        initialPositions,
      }));
    }
    const total = [side(), side()];
    for (const r of runs) {
      r.sides.forEach((s, i) => {
        for (const [k, v] of Object.entries(s)) {
          if (typeof v === 'number') total[i][k] += v;
          else for (const [rk, rv] of Object.entries(v)) total[i][k][rk] = (total[i][k][rk] ?? 0) + rv;
        }
      });
    }
    return {
      matches,
      seed,
      blueMode,
      redMode,
      values,
      blueRev,
      redRev,
      loadouts: resolveLoadout(loadouts),
      timeouts: runs.filter(r => r.timeout).length,
      avgSeconds: runs.reduce((a, r) => a + r.seconds, 0) / matches,
      sides: total,
      runs: runs.map(r => ({seed: r.seed, winner: r.winner, seconds: +r.seconds.toFixed(2), worstDecisions: r.worstDecisions})),
    };
  });
}
function mergeSideStats(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === 'number') target[k] = (target[k] ?? 0) + v;
    else if (typeof v === 'object' && v !== null) {
      target[k] = target[k] ?? {};
      for (const [subk, subv] of Object.entries(v)) {
        target[k][subk] = (target[k][subk] ?? 0) + subv;
      }
    }
  }
}
/**
 * Avaliação Pareada nos Dois Lados da Arena (Azul e Vermelho alternados com as mesmas sementes).
 * Elimina totalmente viés de lado, ordem de subpassos e posição inicial.
 */
export function evalPairedSeries({
  pairs = 30, // 30 pares = 60 lutas
  seed = 1,
  blueMode = 'tactical',
  redMode = 'tactical',
  candidateRev = 1,
  baselineRev = 0,
  loadouts = 'none',
  values = {},
  maxSeconds = 90,
  blockSize = 10,
  measureDecisionTime = false,
  candidateFeatures = null,
  baselineFeatures = null,
} = {}) {
  return withValues(values, () => {
    const resolvedLoadout = resolveLoadout(loadouts);
    const candidateStats = side();
    const baselineStats = side();
    const matchPairs = [];
    const blocks = [];

    let candWinsBlue = 0, candWinsRed = 0;
    let baseWinsBlue = 0, baseWinsRed = 0;
    let timeouts = 0;
    let totalSeconds = 0;
    const allWorstDecisions = [];

    const numBlocks = Math.max(1, Math.ceil(pairs / blockSize));
    for (let b = 0; b < numBlocks; b++) {
      blocks.push({
        blockIndex: b + 1,
        pairsCount: 0,
        candidateWins: 0,
        baselineWins: 0,
        timeouts: 0,
        whiffsCandidate: 0,
        deniedCandidate: 0,
      });
    }

    const candidateDefeats = [];

    for (let p = 0; p < pairs; p++) {
      const matchSeed = seed + p;
      const blockIdx = Math.min(numBlocks - 1, Math.floor(p / blockSize));
      const curBlock = blocks[blockIdx];
      curBlock.pairsCount++;

      // Partida A: Candidato é Azul (0), Linha de Base é Vermelho (1)
      const matchA = evalMatch({
        seed: matchSeed,
        blueMode,
        redMode,
        blueRev: candidateRev,
        redRev: baselineRev,
        blueFeatures: candidateFeatures,
        redFeatures: baselineFeatures,
        loadouts: resolvedLoadout,
        maxSeconds,
        measureDecisionTime,
      });

      // Partida B: Candidato é Vermelho (1), Linha de Base é Azul (0)
      const matchB = evalMatch({
        seed: matchSeed,
        blueMode,
        redMode,
        blueRev: baselineRev,
        redRev: candidateRev,
        blueFeatures: baselineFeatures,
        redFeatures: candidateFeatures,
        loadouts: resolvedLoadout,
        maxSeconds,
        measureDecisionTime,
      });

      totalSeconds += matchA.seconds + matchB.seconds;
      if (matchA.timeout) timeouts++;
      if (matchB.timeout) timeouts++;

      // Acumula estatísticas do Candidato
      mergeSideStats(candidateStats, matchA.sides[0]); // Azul no A
      mergeSideStats(candidateStats, matchB.sides[1]); // Vermelho no B

      // Acumula estatísticas da Linha de Base
      mergeSideStats(baselineStats, matchA.sides[1]); // Vermelho no A
      mergeSideStats(baselineStats, matchB.sides[0]); // Azul no B

      // Contagem de vitórias
      if (matchA.winner === 0) {
        candWinsBlue++;
        curBlock.candidateWins++;
      } else if (matchA.winner === 1) {
        baseWinsRed++;
        curBlock.baselineWins++;
        if (matchA.explanation) candidateDefeats.push(matchA.explanation);
      } else if (matchA.timeout) curBlock.timeouts++;

      if (matchB.winner === 1) {
        candWinsRed++;
        curBlock.candidateWins++;
      } else if (matchB.winner === 0) {
        baseWinsBlue++;
        curBlock.baselineWins++;
        if (matchB.explanation) candidateDefeats.push(matchB.explanation);
      } else if (matchB.timeout) curBlock.timeouts++;

      curBlock.whiffsCandidate += matchA.sides[0].whiffs + matchB.sides[1].whiffs;
      curBlock.deniedCandidate += matchA.sides[0].denied + matchB.sides[1].denied;

      if (matchA.worstDecisions?.length) allWorstDecisions.push(...matchA.worstDecisions.map(d => ({...d, seed: matchSeed, match: 'A'})));
      if (matchB.worstDecisions?.length) allWorstDecisions.push(...matchB.worstDecisions.map(d => ({...d, seed: matchSeed, match: 'B'})));

      matchPairs.push({
        pairIndex: p + 1,
        seed: matchSeed,
        matchA: {winner: matchA.winner, seconds: +matchA.seconds.toFixed(2), timeout: matchA.timeout},
        matchB: {winner: matchB.winner, seconds: +matchB.seconds.toFixed(2), timeout: matchB.timeout},
      });
    }

    const totalMatches = pairs * 2;
    const candTotalWins = candWinsBlue + candWinsRed;
    const baseTotalWins = baseWinsBlue + baseWinsRed;

    candidateStats.wins = candTotalWins;
    baselineStats.wins = baseTotalWins;

    const candRateBlue = candWinsBlue / pairs;
    const candRateRed = candWinsRed / pairs;
    const candRateCombined = candTotalWins / totalMatches;
    const baseRateCombined = baseTotalWins / totalMatches;

    // Erro padrão e intervalo de confiança de 95%
    const se = Math.sqrt((candRateCombined * (1 - candRateCombined)) / totalMatches);
    const ci95 = [
      Math.max(0, +(candRateCombined - 1.96 * se).toFixed(4)),
      Math.min(1, +(candRateCombined + 1.96 * se).toFixed(4)),
    ];

    // Finaliza blocos
    blocks.forEach(b => {
      const bMatches = b.pairsCount * 2;
      b.candidateWinRate = +(b.candidateWins / bMatches).toFixed(4);
      b.baselineWinRate = +(b.baselineWins / bMatches).toFixed(4);
    });

    return {
      pairs,
      totalMatches,
      seed,
      candidateRev,
      baselineRev,
      loadoutId: typeof loadouts === 'string' ? loadouts : 'custom',
      loadouts: resolvedLoadout,
      candRateBlue: +candRateBlue.toFixed(4),
      candRateRed: +candRateRed.toFixed(4),
      candRateCombined: +candRateCombined.toFixed(4),
      baseRateCombined: +baseRateCombined.toFixed(4),
      se: +se.toFixed(4),
      ci95,
      candidateWins: candTotalWins,
      baselineWins: baseTotalWins,
      candWinsBlue,
      candWinsRed,
      baseWinsBlue,
      baseWinsRed,
      timeouts,
      avgSeconds: +(totalSeconds / totalMatches).toFixed(2),
      candidateStats,
      baselineStats,
      blocks,
      worstDecisions: allWorstDecisions.sort((a, b) => (b.score ?? b.damage ?? 0) - (a.score ?? a.damage ?? 0)).slice(0, 20),
      defeatExplanation: candidateDefeats[0] ?? null,
      matchPairs,
    };
  });
}
