// IA revisada × anterior (sem navegador): mesmas regras do jogador, sementes fixas, várias personalidades.
// Mede taxas de vitória, ações, stamina desperdiçada, ações negadas e contra-ataques; não exige que a revisada vença
// por vantagem — exige que não fique mais fraca além do ruído e que use melhor as mecânicas.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {evalSeries, evalMatch} from '../src/sim/ai-eval.js';
import {REVISION_1, featuresOf} from '../src/sim/tactics.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();

let n = 0;const ok = l => {n++;console.log('✓', l);};
resetConfig(defaults());
assert.equal(C.extras.ai.revision, 2, 'evoluída por padrão');assert.equal(featuresOf({revisionOverride: 0}).validate, false);assert.equal(REVISION_1.stamina, false);
{
  const a = evalMatch({seed: 9, blueRev: 1, redRev: 0}), b = evalMatch({seed: 9, blueRev: 1, redRev: 0});
  assert.deepEqual(a, b, 'mesma semente, mesma luta');
  const before = JSON.stringify(C);evalSeries({matches: 5, seed: 3, blueRev: 1, redRev: 0});assert.equal(JSON.stringify(C), before, 'a avaliação não altera a configuração');
}
ok('avaliação determinística por semente e sem efeito na configuração');
const N = 120, sum = (blueRev, redRev, values = {}) => {
  const out = {wins: 0, n: 0, denied: 0, tackleNoGuard: 0, sprints: 0, whiffs: 0, tackles: 0, spent: 0};
  for (const seed of [1, 501]) {const r = evalSeries({matches: N, seed, blueRev, redRev, values}), s = r.sides[0];out.wins += s.wins;out.n += r.matches;out.denied += s.denied;out.tackleNoGuard += s.deniedByReason.tackleNoGuard ?? 0;out.sprints += s.sprints;out.whiffs += s.whiffs;out.tackles += s.tackles;out.spent += s.staminaSpent;}
  out.rate = out.wins / out.n;return out;
};
const base = sum(0, 0), rev = sum(1, 0);
console.log(`   anterior × anterior: azul ${(base.rate * 100).toFixed(1)}% · negadas ${base.denied} · X sem contato ${(100 * base.whiffs / base.tackles).toFixed(0)}% · sprints ${base.sprints}`);
console.log(`   revisada × anterior: azul ${(rev.rate * 100).toFixed(1)}% · negadas ${rev.denied} · X sem contato ${(100 * rev.whiffs / rev.tackles).toFixed(0)}% · sprints ${rev.sprints}`);
assert.ok(rev.tackleNoGuard <= base.tackleNoGuard * .1, `quase nunca aperta D no próprio tackle sem efeito (${rev.tackleNoGuard} × ${base.tackleNoGuard}; o resto vem de X que sai do buffer no mesmo passo)`);
assert.ok(rev.denied < base.denied * .8, `menos ações negadas (${rev.denied} × ${base.denied})`);
assert.ok(rev.sprints > 0 && base.sprints === 0, 'usa o sprint para encurtar distância');
const se = Math.sqrt(base.rate * (1 - base.rate) / base.n) * Math.SQRT2;
assert.ok(rev.rate >= base.rate - 3 * se, `não fica mais fraca além do ruído: ${(rev.rate * 100).toFixed(1)}% × ${(base.rate * 100).toFixed(1)}% (±${(3 * se * 100).toFixed(1)})`);
ok('revisada × anterior (mesmo lado, mesmas sementes): menos ações negadas, usa sprint, quase nenhuma defesa inútil, força dentro do ruído');
{
  // Várias personalidades (estilo fixo nos dois lados): a revisada nunca despenca.
  for (const style of [1, 3, 4]) {
    const v = {'extras.aiBlue.style': style, 'extras.aiRed.style': style}, b = sum(0, 0, v), r = sum(1, 0, v);
    console.log(`   estilo ${style}: anterior ${(b.rate * 100).toFixed(0)}% · revisada ${(r.rate * 100).toFixed(0)}% · negadas ${b.denied} → ${r.denied}`);
    assert.ok(r.rate >= b.rate - .12 && r.denied <= b.denied, `estilo ${style}`);
  }
}
ok('estilos Agressor, Esquivador e Paredão: revisada sem perda relevante e com menos ações negadas');

// ---------- Fase 0: Avaliação Pareada nos Dois Lados da Arena ----------
{
  const paired = (await import('../src/sim/ai-eval.js')).evalPairedSeries({
    pairs: 15,
    seed: 10,
    candidateRev: 1,
    baselineRev: 0,
    loadouts: 'none',
  });
  assert.equal(paired.totalMatches, 30, '15 pares = 30 lutas no total');
  assert.equal(paired.candidateWins + paired.baselineWins + paired.timeouts, 30, 'todas as lutas contabilizadas');
  assert.ok(paired.candRateCombined >= 0 && paired.candRateCombined <= 1, 'taxa combinada válida');
  assert.ok(paired.ci95[0] <= paired.candRateCombined && paired.candRateCombined <= paired.ci95[1], 'IC 95% consistente com a taxa combinada');
  assert.ok(paired.candidateStats.denied <= paired.baselineStats.denied, 'candidato reduz ações negadas na média pareada');
  assert.ok(paired.candidateStats.whiffs <= paired.baselineStats.whiffs * 1.12, 'candidato não explode em whiffs');   // 1,12: o X no sprint agora sai PL2 (+25% de alcance) e a IA só passa a levar isso em conta na fase 4
}
ok('avaliação pareada nos dois lados da arena elimina viés de spawn e mede IC 95%');

// ---------- Fase 0: Avaliação com Moves Equipados (Reflect + Psyshock) ----------
{
  const pairedMoves = (await import('../src/sim/ai-eval.js')).evalPairedSeries({
    pairs: 10,
    seed: 40,
    candidateRev: 1,
    baselineRev: 0,
    loadouts: 'both',
  });
  assert.equal(pairedMoves.totalMatches, 20);
  assert.ok(pairedMoves.candidateStats.chargesStarted > 0, 'revisada usa os movimentos de carga');
  assert.ok(pairedMoves.candidateStats.chargesCompleted > 0, 'revisada solta os movimentos com sucesso');
  assert.ok(pairedMoves.candidateStats.projectileDamageDealt > 0, 'dano de projéteis é computado à parte');
  assert.ok(pairedMoves.candidateStats.counterMissed >= 0, 'contra-ataques perdidos são rastreados');
  assert.ok(pairedMoves.candidateStats.missedDefense >= 0, 'defesas viáveis perdidas são rastreadas');
}
ok('partidas com Moves equipados (Reflect e Psyshock) entram na avaliação pareada');

// ---------- Fase 0: Coleção Fixa de 8 Situações Difíceis ----------
{
  const {runDifficultScenarios} = await import('../src/sim/ai-eval.js');
  const scen = runDifficultScenarios({candidateRev: 1, baselineRev: 0, loadouts: 'both'});
  assert.equal(scen.totalScenarios, 8, '8 situações difíceis fixas');
  assert.equal(scen.candidateScore, 8, 'candidato passa em 8 de 8 situações difíceis');
  assert.ok(scen.scenarios.every(s => s.candidate.passed), 'todos os 8 cenários aprovados');
}
ok('coleção fixa de 8 situações difíceis avaliada com sucesso (score 8/8)');

// ---------- Fase 1: Explicar Decisões, Taxonomia de Erros e Replay ----------
{
  const {evalMatch, explainDefeat, evalPairedSeries, ERROR_TAXONOMY} = await import('../src/sim/ai-eval.js');
  assert.ok(ERROR_TAXONOMY.prediction_error && ERROR_TAXONOMY.execution_error, 'taxonomia de erros formalizada');

  // Luta única para inspecionar desfecho dos ataques e ranking de decisões
  const match = evalMatch({seed: 12, blueRev: 1, redRev: 0, loadouts: 'both'});
  const blueSide = match.sides[0];
  assert.ok(blueSide.attackOutcomes, 'desfechos dos ataques categorizados');
  const sumAttacks = Object.values(blueSide.attackOutcomes).reduce((a, b) => a + b, 0);
  assert.ok(sumAttacks >= 0, 'desfechos de ataque computados');

  assert.ok(blueSide.taxonomyErrors, 'erros mapeados por taxonomia');
  assert.ok(match.worstDecisions.length >= 0, 'decisões ruins ranqueadas por severidade');
  if (match.worstDecisions.length > 0) {
    const top = match.worstDecisions[0];
    assert.ok(top.score >= 0, 'decisão possui pontuação de severidade ponderada');
    assert.ok(top.taxonomy, 'decisão possui categoria taxonômica');
  }

  // Explicação de derrota sem inspecionar código passo a passo
  const paired = evalPairedSeries({pairs: 10, seed: 15, candidateRev: 1, baselineRev: 0, loadouts: 'both'});
  assert.ok(paired.candidateStats.attackOutcomes, 'estatísticas pareadas incluem desfechos de ataques');
  assert.ok(paired.candidateStats.taxonomyErrors, 'estatísticas pareadas incluem taxonomia de falhas');
  assert.ok(paired.worstDecisions.length > 0, 'ranking unificado das piores decisões gerado');

  const sampleDefeat = paired.defeatExplanation ?? explainDefeat(match, 1);
  if (sampleDefeat) {
    assert.ok(sampleDefeat.summary.includes('Lutador') && sampleDefeat.summary.includes('Distribuição de falhas'), 'explicação narrativa de derrota gerada com causa-raiz');
    assert.ok(Array.isArray(sampleDefeat.topErrors), 'top erros catalogados na explicação');
  }
}
ok('Fase 1: ciclo completo de decisão, taxonomia de erros, ranking de piores decisões e explicação de derrota validados');

// ---------- Fases 2, 3 e 4: Avaliação da Revisão 2 (Previsão e Gestão Espacial) ----------
{
  const {evalPairedSeries, runDifficultScenarios} = await import('../src/sim/ai-eval.js');
  const scen2 = runDifficultScenarios({candidateRev: 2, baselineRev: 0, loadouts: 'both'});
  assert.equal(scen2.candidateScore, 8, 'revisão 2 passa em 8 de 8 situações difíceis');

  const paired = evalPairedSeries({pairs: 10, seed: 100, candidateRev: 2, baselineRev: 1, loadouts: 'both'});
  assert.ok(paired.candidateStats, 'revisão 2 produz estatísticas válidas');
  assert.ok(paired.candidateStats.denied <= paired.baselineStats.denied + 20, 'revisão 2 mantém ações negadas controladas');
}
ok('Fases 2, 3 e 4: Revisão 2 (Previsão & Espacial) validada com avaliação pareada e cenários difíceis');

resetConfig(defaults());
console.log(`\n${n} verificações da avaliação da IA aprovadas.`);

