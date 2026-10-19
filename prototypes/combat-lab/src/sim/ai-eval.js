// Avaliação da IA com sementes fixas (sem renderização): taxas de vitória, ações executadas, stamina gasta e
// desperdiçada, ações negadas, contra-ataques, dano de projéteis e decisões contextuais.
// Suporta comparação pareada nos dois lados da arena (azul e vermelho alternados com as mesmas sementes),
// matriz de loadouts (sem moves, reflect, psyshock, ambos), blocos de sementes e cenários difíceis.
// As duas IAs jogam com as MESMAS regras do jogador (mesmo controlador, mesmos custos); nada aqui dá vantagem.
import {C} from './config.js';
import {Game} from './game.js';
import {withAttemptSink} from './attempts.js';
import {withValues} from './compare.js';
import {vec, length, sub} from './math.js';
import {spawn} from './world.js';
import {emptyCommand} from './entity.js';

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

export const side = () => ({
  wins: 0,
  tackles: 0,
  dodges: 0,
  cancels: 0,
  sprints: 0,
  guards: 0,
  perfectGuards: 0,
  perfectDodges: 0,
  hits: 0,
  blocked: 0,
  clashes: 0,
  whiffs: 0,
  chargedTackles: 0,
  feints: 0,
  staminaSpent: 0,
  staminaWasted: 0,
  denied: 0,
  perfectUnavailable: 0,
  deniedByReason: {},
  counterOpen: 0,
  counterTaken: 0,
  counterMissed: 0,
  exhaustedTime: 0,
  damage: 0,
  projectileDamageDealt: 0,
  projectileDamageTaken: 0,
  movesUsed: 0,
  chargesStarted: 0,
  chargesCompleted: 0,
  chargesAborted: 0,
  missedPunish: 0,
  missedDefense: 0,
  missedMoves: 0,
  decisionTimeMs: 0,
  decisionsCount: 0,
  attackOutcomes: {
    hit: 0,
    blocked: 0,
    clash: 0,
    dodged: 0,
    interrupted: 0,
    whiff: 0,
  },
  taxonomyErrors: {
    prediction_error: 0,
    execution_error: 0,
    strategy_error: 0,
    perception_error: 0,
    rule_limitation: 0,
  },
});

/**
 * Uma luta: blue/red = {mode, values?} (values = ajustes aplicados à IA daquele lado não são possíveis — os dois lados
 * compartilham a configuração; use `values` global para A/B de parâmetros). Devolve estatísticas por lado.
 */
export function evalMatch({
  seed,
  blueMode = 'tactical',
  redMode = 'tactical',
  maxSeconds = 90,
  blueRev = null,
  redRev = null,
  blueFeatures = null,
  redFeatures = null,
  loadouts = [[], []],
  initialPositions = null,
  measureDecisionTime = false,
  scenarioSetup = null,
}) {
  const g = new Game({seed});
  g.loadouts = structuredClone(resolveLoadout(loadouts));
  g.brain.seed = seed;
  g.playerBrain.seed = seed + 7919;
  g.brain.reset();
  g.playerBrain.reset();
  g.mode = redMode;
  g.reset(initialPositions ? {positions: initialPositions} : undefined);

  // Revisão da IA por lado (comparação anterior × revisada na mesma luta); null = ajuste global.
  g.playerBrain.revisionOverride = blueRev;
  g.brain.revisionOverride = redRev;
  if (blueFeatures) g.playerBrain.revFeatures = blueFeatures;
  if (redFeatures) g.brain.revFeatures = redFeatures;
  if (scenarioSetup) scenarioSetup(g);

  const S = [side(), side()], step = C.test.step, last = [null, null], counterSeen = [false, false];
  const brains = [g.playerBrain, g.brain];
  const worstDecisions = [];
  let tick = 0;

  withAttemptSink((f, e) => {
    if (!g.fighters.includes(f)) return;
    const s = S[f.id];
    // A defesa perfeita em recarga não é uma ação negada (a defesa sai normalmente): contada à parte.
    if (e.result === 'denied' && e.kind === 'perfectGuard') s.perfectUnavailable++;
    else if (e.result === 'denied') {
      s.denied++;
      s.deniedByReason[e.reason] = (s.deniedByReason[e.reason] ?? 0) + 1;
      s.taxonomyErrors.execution_error++;
      const dec = brains[f.id]?.lastDecision;
      worstDecisions.push({
        tick,
        time: +(tick * step).toFixed(2),
        fighter: f.id,
        taxonomy: 'execution_error',
        reason: `Ação ${e.kind} negada: ${e.reason}`,
        detail: e.detail ? (typeof e.detail === 'object' ? JSON.stringify(e.detail) : String(e.detail)) : (e.reason ?? ''),
        damage: 0,
        hpCost: 0,
        staminaCost: 0,
        score: 6,
        decision: dec ? structuredClone(dec) : null,
      });
    }
    if (e.result === 'executed' && e.kind === 'guard') s.guards++;
    if (e.result === 'executed' && e.kind === 'perfectGuard') s.perfectGuards++;
    if (e.result === 'executed' && e.kind === 'sprint') s.sprints++;
  }, () => {
    for (; tick < maxSeconds / step && g.phase !== 'result'; tick++) {
      const before = g.fighters.map(f => f.stamina);

      let t0 = 0, dt0 = 0;
      if (measureDecisionTime && typeof performance !== 'undefined') t0 = performance.now();
      const cmd0 = g.playerBrain.command(g.fighters[0], g.fighters[1], blueMode, step);
      if (measureDecisionTime && typeof performance !== 'undefined') {
        dt0 = performance.now() - t0;
        S[0].decisionTimeMs += dt0;
      }
      S[0].decisionsCount++;

      let t1 = 0, dt1 = 0, cmd1 = emptyCommand();
      if (C.extras.toggles.enableEnemyAI) {
        if (measureDecisionTime && typeof performance !== 'undefined') t1 = performance.now();
        cmd1 = g.brain.command(g.fighters[1], g.fighters[0], redMode, step);
        if (measureDecisionTime && typeof performance !== 'undefined') {
          dt1 = performance.now() - t1;
          S[1].decisionTimeMs += dt1;
        }
        S[1].decisionsCount++;
      }

      g.step(cmd0, cmd1);

      for (const e of g.lastStepEvents) {
        if (e.attacker != null && S[e.attacker]) {
          const a = S[e.attacker];
          a.damage += e.damage;
          if (e.result === 'impact') {
            a.hits++;
            if (last[e.attacker]?.__eval) {
              last[e.attacker].__eval.outcome = 'hit';
              last[e.attacker].__eval.damage = e.damage;
            }
          } else if (e.result === 'partial') {
            a.blocked++;
            if (last[e.attacker]?.__eval) {
              last[e.attacker].__eval.outcome = 'blocked';
              last[e.attacker].__eval.damage = e.damage;
            }
          } else if (e.result === 'clash') {
            a.clashes++;
            if (last[e.attacker]) {
              last[e.attacker].__clash = true;
              if (last[e.attacker].__eval) last[e.attacker].__eval.outcome = 'clash';
            }
          }
          if (e.source === 'projectile' || e.source === 'beam' || e.source === 'world' || e.entity != null) {
            a.projectileDamageDealt += e.damage;
          }
          if (e.result === 'chargeStart') a.chargesStarted++;
          else if (e.result === 'chargeRelease') { a.chargesCompleted++; a.movesUsed++; }
          else if (e.result === 'chargeCancel' || e.result === 'chargeInterrupt') a.chargesAborted++;
        }
        if (e.target != null && S[e.target]) {
          const tgt = S[e.target];
          if (e.result === 'perfectDodge') tgt.perfectDodges++;
          if (e.source === 'projectile' || e.source === 'beam' || e.source === 'world' || e.entity != null) {
            tgt.projectileDamageTaken += e.damage;
          }
          // Se o atacante foi interrompido por dano sofrido enquanto executava o tackle
          if (last[e.target]?.kind === 'tackle' && last[e.target].__eval && last[e.target].__eval.outcome === 'whiff') {
            last[e.target].__eval.outcome = 'interrupted';
          }
          // Dano direto recebido
          if (e.result === 'impact' && e.damage > 0) {
            const tgtFighter = g.fighters[e.target];
            const tgtBrain = brains[e.target];
            const hadStamina = tgtFighter.stamina >= 0.5 && !tgtFighter.exhausted && (tgtFighter.stun ?? 0) <= 0;
            const wasMisread = tgtBrain?.lastDecision?.perception?.threat?.misread;
            const taxonomy = wasMisread ? 'perception_error' : (hadStamina ? 'strategy_error' : 'rule_limitation');
            tgt.taxonomyErrors[taxonomy]++;
            if (hadStamina) tgt.missedDefense++;
            worstDecisions.push({
              tick,
              time: +(tick * step).toFixed(2),
              fighter: e.target,
              taxonomy,
              reason: wasMisread
                ? 'Leitura errada da ameaça adversária'
                : (hadStamina ? 'Dano direto sofrido com stamina disponível (defesa viável não levantada)' : 'Dano sofrido sem recursos para defesa'),
              detail: `Recebeu ${e.damage.toFixed(1)} de dano direto`,
              damage: +e.damage.toFixed(2),
              hpCost: +e.damage.toFixed(2),
              staminaCost: 0,
              score: +e.damage.toFixed(2) * 2.5,
              decision: tgtBrain?.lastDecision ? structuredClone(tgtBrain.lastDecision) : null,
            });
            // Oportunidade perdida de Reflect contra projéteis
            if ((e.source === 'projectile' || e.source === 'beam') && tgtFighter.loadout?.includes('reflect') && !tgtFighter.exhausted && tgtFighter.stamina >= 1.0) {
              tgt.missedMoves++;
              tgt.taxonomyErrors.strategy_error++;
              worstDecisions.push({
                tick,
                time: +(tick * step).toFixed(2),
                fighter: e.target,
                taxonomy: 'strategy_error',
                reason: 'Projétil hostil recebido com Reflect disponível para refletir',
                detail: 'Poderia ter erguido a barreira refletora',
                damage: +e.damage.toFixed(2),
                hpCost: +e.damage.toFixed(2),
                staminaCost: 0,
                score: +e.damage.toFixed(2) * 3,
                decision: tgtBrain?.lastDecision ? structuredClone(tgtBrain.lastDecision) : null,
              });
            }
          }
        }
      }

      g.fighters.forEach((f, i) => {
        const s = S[i];
        const opp = g.fighters[1 - i];

        // Ações novas (o objeto da ação muda) — X do C → X conta como cancelamento.
        if (f.action && f.action !== last[i]) {
          if (f.action.kind === 'tackle') {
            s.tackles++;
            if (f.action.fromCancel) s.cancels++;
            if ((f.action.pl ?? 1) > 1) s.chargedTackles = (s.chargedTackles ?? 0) + 1;
            if ((f.action.speedMultiplier ?? 1) > 1) s.counterTaken++;
            const dec = brains[i]?.lastDecision;
            f.action.__eval = {
              attacker: i,
              startTick: tick,
              startTime: +(tick * step).toFixed(2),
              decision: dec ? structuredClone(dec) : null,
              outcome: 'whiff',
              damage: 0,
            };
          }
          if (f.action.kind === 'dodge') s.dodges++;
        }

        // Fim de um X: computa o desfecho definitivo do ataque
        if (last[i]?.kind === 'tackle' && f.action !== last[i]) {
          const ev = last[i].__eval;
          if (ev) {
            if (ev.outcome === 'whiff' && (f.state === 'brake' || f.action?.feint)) {ev.outcome = 'feint';s.feints = (s.feints ?? 0) + 1;}   // tackle cancelado por finta: não é erro de alcance
            s.attackOutcomes[ev.outcome] = (s.attackOutcomes[ev.outcome] ?? 0) + 1;
            if (ev.outcome === 'whiff') {
              s.whiffs++;
              s.staminaWasted += C.actions.tackle.cost;
              s.taxonomyErrors.prediction_error++;
              worstDecisions.push({
                tick,
                time: +(tick * step).toFixed(2),
                fighter: i,
                taxonomy: 'prediction_error',
                reason: 'Tackle sem contato (erro de previsão de alcance)',
                detail: `Distância inicial: ${ev.decision?.perception?.distance ?? '—'}m · intenção: ${ev.decision?.plan?.intent ?? '—'}`,
                staminaCost: C.actions.tackle.cost,
                damage: 0,
                hpCost: 0,
                score: C.actions.tackle.cost * 5,
                decision: ev.decision,
              });
            }
          }
        }
        last[i] = f.action;

        // Se o oponente esquivar enquanto o tackle está em curso e ainda não acertou: desfecho = dodged
        if (opp.action?.kind === 'dodge' && last[i]?.kind === 'tackle' && last[i].__eval && last[i].__eval.outcome === 'whiff') {
          last[i].__eval.outcome = 'dodged';
        }

        if (f.sprinting && !S[i].__sprinting) s.sprints++;
        S[i].__sprinting = f.sprinting;

        // Janela de contra-ataque
        if (f.counterWindow > 0 && !counterSeen[i]) s.counterOpen++;
        if (counterSeen[i] && f.counterWindow <= 0 && (!f.action || (f.action.speedMultiplier ?? 1) <= 1)) {
          s.counterMissed++;
          s.taxonomyErrors.strategy_error++;
          worstDecisions.push({
            tick,
            time: +(tick * step).toFixed(2),
            fighter: i,
            taxonomy: 'strategy_error',
            reason: 'Janela de contra-ataque fortalecido expirou sem aproveitamento',
            detail: 'Janela de contra-ataque após esquiva/defesa perfeita expirou',
            damage: 0,
            hpCost: 0,
            staminaCost: 0,
            score: 5,
            decision: brains[i]?.lastDecision ? structuredClone(brains[i].lastDecision) : null,
          });
        }
        counterSeen[i] = f.counterWindow > 0;

        // Oportunidade de punição perdida (adversário vulnerável em recoil ou aterrissagem a curta distância sem ataque)
        const oppVulnerable = opp && (opp.action?.kind === 'recoil' || opp.knockRecovery > 0.1 || opp.exhausted);
        const distToOpp = opp ? length(sub(opp.position, f.position)) : 99;
        if (oppVulnerable && distToOpp <= 2.2 && !f.action && !f.flight && f.stamina >= C.actions.tackle.cost) {
          if (!s.__punishWindow) s.__punishWindow = 1;
          else s.__punishWindow++;
          if (s.__punishWindow === 18) { // 0.15s sem punir
            s.missedPunish++;
            s.taxonomyErrors.strategy_error++;
            worstDecisions.push({
              tick,
              time: +(tick * step).toFixed(2),
              fighter: i,
              taxonomy: 'strategy_error',
              reason: 'Oportunidade de punição perdida (rival vulnerável a curta distância)',
              detail: `Adversário estava vulnerável a ${distToOpp.toFixed(1)}m`,
              damage: 0,
              hpCost: 0,
              staminaCost: 0,
              score: 4,
              decision: brains[i]?.lastDecision ? structuredClone(brains[i].lastDecision) : null,
            });
          }
        } else {
          s.__punishWindow = 0;
        }

        const spent = before[i] - f.stamina;
        if (spent > 1e-9) s.staminaSpent += spent;
        if (f.exhausted) s.exhaustedTime += step;
      });
    }
  });

  if (g.winner !== null && g.winner !== undefined) S[g.winner].wins++;
  for (const s of S) {
    delete s.__sprinting;
    delete s.__punishWindow;
  }
  worstDecisions.sort((a, b) => (b.score ?? b.damage ?? 0) - (a.score ?? a.damage ?? 0));
  const explanation = (g.winner !== null && g.winner !== undefined && g.winner >= 0)
    ? explainDefeat({sides: S, seconds: tick * step, finalHp: g.fighters.map(f => +f.hp.toFixed(1)), worstDecisions}, 1 - g.winner)
    : null;

  return {
    seed,
    winner: g.winner,
    seconds: tick * step,
    sides: S,
    timeout: g.phase !== 'result',
    loadouts: g.loadouts,
    finalHp: g.fighters.map(f => +f.hp.toFixed(1)),
    worstDecisions: worstDecisions.slice(0, 15),
    explanation,
  };
}

/** Várias lutas com sementes consecutivas; `values` muda a configuração (ex.: revisão da IA) só durante a avaliação. */
export function evalSeries({
  matches = 20,
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

/**
 * Coleção Fixa de Situações Difíceis para Teste da IA:
 * 1. wall_pressure: encurralado na parede com oponente avançando.
 * 2. low_stamina: stamina crítica sem tentar tackle suicida.
 * 3. opponent_guarding: oponente com defesa perfeita armada (evita atacar direto).
 * 4. aggressive_tackle: oponente em tackle frontal (esquiva ou defesa reativa).
 * 5. projectile_incoming: projétil vindo em alta velocidade (reflect ou defesa).
 * 6. charge_in_progress: cancelamento com evasão emergencial quando o rival ataca.
 * 7. rival_recovery: aproveitamento da janela de punição (rival em recoil/landing).
 * 8. rival_airborne: não desperdiça tackle contra rival no ar.
 */
export const DIFFICULT_SCENARIOS = [
  {
    id: 'wall_pressure',
    name: 'Pressão na parede',
    description: 'Lutador encurralado próximo à parede da arena com adversário avançando diretamente.',
    run: (candidateRev) => {
      let wallHit = false;
      const res = evalMatch({
        seed: 42,
        blueRev: candidateRev,
        redRev: 0,
        maxSeconds: 1.5,
        initialPositions: [vec(C.test.arenaHalf - 0.5, 0), vec(C.test.arenaHalf - 2.2, 0)],
        scenarioSetup: g => {
          g.fighters[0].facing = Math.PI;
          g.fighters[1].facing = 0;
        },
      });
      // A IA não deve registrar ações negadas por colisão direta ou tentar passar a parede
      const deniedWall = res.sides[0].deniedByReason['arenaBounds'] ?? 0;
      const passed = deniedWall === 0 && res.sides[0].whiffs === 0;
      return {
        id: 'wall_pressure',
        name: 'Pressão na parede',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Manebrou sem tentar atravessar limites da arena' : `Ações negadas na parede: ${deniedWall}`,
      };
    },
  },
  {
    id: 'low_stamina',
    name: 'Pouca stamina',
    description: 'Lutador com stamina crítica (0.4) e adversário a 1.6m de distância.',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 77,
        blueRev: candidateRev,
        redRev: 0,
        maxSeconds: 0.8,
        initialPositions: [vec(0, -0.8), vec(0, 0.8)],
        scenarioSetup: g => {
          g.fighters[0].stamina = 0.4;
          g.fighters[1].stamina = 2.0;
        },
      });
      // Não deve pedir tackle com custo 1.0 (não se exaure voluntariamente)
      const passed = res.sides[0].tackles === 0 && res.sides[0].exhaustedTime === 0;
      return {
        id: 'low_stamina',
        name: 'Pouca stamina',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Preservou stamina e evitou exaustão não forçada' : `Tentou ${res.sides[0].tackles} tackle(s) sem stamina`,
      };
    },
  },
  {
    id: 'opponent_guarding',
    name: 'Adversário defendendo',
    description: 'Adversário com guarda frontal ativa esperando golpe a 1.8m.',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 101,
        blueRev: candidateRev,
        redRev: 0,
        maxSeconds: 0.6,
        initialPositions: [vec(0, -0.9), vec(0, 0.9)],
        scenarioSetup: g => {
          g.fighters[1].guard = true;
          g.fighters[1].perfectLeft = 0.2;
        },
      });
      // A IA não deve se chocar precipitadamente no primeiro passo
      const passed = res.sides[0].blocked === 0;
      return {
        id: 'opponent_guarding',
        name: 'Adversário defendendo',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Respeitou a guarda do adversário sem atacar cegamente' : 'Atacou diretamente a defesa armada',
      };
    },
  },
  {
    id: 'aggressive_tackle',
    name: 'Investida agressiva',
    description: 'Adversário em pleno tackle frontal direcionado a 2.8m.',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 133,
        blueRev: candidateRev,
        redRev: 0,
        maxSeconds: 0.8,
        initialPositions: [vec(0, -1.4), vec(0, 1.4)],
        scenarioSetup: g => {
          g.fighters[1].action = {kind: 'tackle', heading: -Math.PI / 2, elapsed: C.rules.feintWindow + 0.03, duration: 0.35, speedMultiplier: 1, hits: new Set()};   // já fora da janela da finta: o rival não cancela o ataque
          g.fighters[1].velocity = vec(0, -7.5);
        },
      });
      // Deve defender, esquivar ou amortecer o golpe
      const defended = res.sides[0].guards > 0 || res.sides[0].dodges > 0 || res.sides[0].perfectGuards > 0;
      const passed = defended || res.sides[1].blocked > 0 || res.sides[0].perfectDodges > 0;
      return {
        id: 'aggressive_tackle',
        name: 'Investida agressiva',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Respondeu reativamente à investida com defesa/esquiva' : 'Apanhou limpo sem reagir',
      };
    },
  },
  {
    id: 'projectile_incoming',
    name: 'Projétil hostil a caminho',
    description: 'Projétil hostil de PL1 a 12 m/s a 0.25 s de impacto com Reflect equipado.',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 155,
        blueRev: candidateRev,
        redRev: 0,
        loadouts: 'both',
        maxSeconds: 0.7,
        initialPositions: [vec(0, -1.2), vec(0, 1.2)],
        scenarioSetup: g => {
          spawn(g.world, {
            kind: 'projectile',
            owner: 1,
            pos: vec(0, 1.5),
            y: 0.6,
            vel: vec(0, -12),
            radius: 0.3,
            pl: 1,
            life: 1.5,
            hit: {damage: 0.25},
          });
        },
      });
      // Tomou menos do que o dano total ou ativou reflect/guarda
      const passed = res.sides[0].projectileDamageTaken < 0.25 || res.sides[0].chargesStarted > 0 || res.sides[0].guards > 0;
      return {
        id: 'projectile_incoming',
        name: 'Projétil hostil a caminho',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Detectou projétil e preparou contra-medida defensiva' : 'Atingido pelo projétil sem contra-medida',
      };
    },
  },
  {
    id: 'charge_in_progress',
    name: 'Carga em andamento vs investida',
    description: 'Lutador no meio de uma carga de Psyshock quando adversário inicia tackle a 3.5m.',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 202,
        blueRev: candidateRev,
        redRev: 0,
        loadouts: 'both',
        maxSeconds: 0.6,
        initialPositions: [vec(0, -1.6), vec(0, 1.6)],
        scenarioSetup: g => {
          g.fighters[0].charge = {move: 'psyshock', ticks: 40, slot: 1, params: {dodgeLockTicks: 25}};
          g.fighters[1].action = {kind: 'tackle', heading: -Math.PI / 2, elapsed: C.rules.feintWindow + 0.03, duration: 0.35, speedMultiplier: 1, hits: new Set()};   // já fora da janela da finta: o rival não cancela o ataque
          g.fighters[1].velocity = vec(0, -7.5);
        },
      });
      // Deve esquivar em emergência cancelando a carga
      const passed = res.sides[0].dodges > 0 || res.sides[0].chargesAborted > 0 || res.sides[0].chargesCompleted > 0;
      return {
        id: 'charge_in_progress',
        name: 'Carga em andamento vs investida',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Realizou evasão de emergência / soltura durante charge sob ataque' : 'Permaneceu congelado carregando durante o ataque',
      };
    },
  },
  {
    id: 'rival_recovery',
    name: 'Adversário em recuperação',
    description: 'Adversário em recoil após whiff ou bloqueio a 1.2m (janela de punição aberta).',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 244,
        blueRev: candidateRev,
        redRev: 0,
        maxSeconds: 0.8,
        initialPositions: [vec(0, -0.6), vec(0, 0.6)],
        scenarioSetup: g => {
          g.playerBrain.cooldown = 0;
          g.fighters[1].action = {kind: 'recoil', elapsed: 0.05, duration: 0.5};
          g.fighters[0].stamina = 2.0;
        },
      });
      const passed = res.sides[0].tackles > 0 || res.sides[0].hits > 0;
      return {
        id: 'rival_recovery',
        name: 'Adversário em recuperação',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Aproveitou a janela de recuperação para punir o adversário' : 'Não converteu a oportunidade de punição imediata',
      };
    },
  },
  {
    id: 'rival_airborne',
    name: 'Adversário no ar',
    description: 'Adversário lançado ao ar em voo balístico (y = 1.6m, vy > 0).',
    run: (candidateRev) => {
      const res = evalMatch({
        seed: 310,
        blueRev: candidateRev,
        redRev: 0,
        maxSeconds: 0.4,
        initialPositions: [vec(0, -1.8), vec(0, 0)],
        scenarioSetup: g => {
          g.fighters[1].flight = {y: 1.6, vy: 3.0, horizontal: vec(0, 0)};
        },
      });
      // Não deve gastar tackle no vazio contra o alvo no ar
      const passed = res.sides[0].whiffs === 0;
      return {
        id: 'rival_airborne',
        name: 'Adversário no ar',
        passed,
        score: passed ? 1 : 0,
        detail: passed ? 'Aguardou aterrissagem sem desperdiçar tackle no ar' : 'Desperdiçou tackle contra oponente no ar',
      };
    },
  },
];

/** Executa a bateria de cenários difíceis para as duas IAs e compara o aproveitamento. */
export function runDifficultScenarios({candidateRev = 1, baselineRev = 0, loadouts = 'both'} = {}) {
  const candidateResults = DIFFICULT_SCENARIOS.map(s => s.run(candidateRev));
  const baselineResults = DIFFICULT_SCENARIOS.map(s => s.run(baselineRev));

  const candScore = candidateResults.reduce((a, b) => a + b.score, 0);
  const baseScore = baselineResults.reduce((a, b) => a + b.score, 0);

  return {
    totalScenarios: DIFFICULT_SCENARIOS.length,
    candidateScore: candScore,
    baselineScore: baseScore,
    candidatePassRate: +(candScore / DIFFICULT_SCENARIOS.length).toFixed(3),
    baselinePassRate: +(baseScore / DIFFICULT_SCENARIOS.length).toFixed(3),
    scenarios: DIFFICULT_SCENARIOS.map((s, i) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      candidate: candidateResults[i],
      baseline: baselineResults[i],
    })),
  };
}

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
