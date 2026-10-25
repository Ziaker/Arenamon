// Dividido de ai-eval.js (comportamento idêntico): eval-match.

import {C} from '../config.js';
import {Game} from '../game.js';
import {withAttemptSink} from '../attempts.js';
import {length, sub} from '../math.js';
import {emptyCommand} from '../entity.js';
import {navAssist} from '../../nav/nav-assist.js';
import {explainDefeat, resolveLoadout} from './eval-loadout.js';

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
  moveUses: {},        // usos de cada Move de slot (toque, carga iniciada ou marcador confirmado)
  stuckTime: 0,        // s empurrando obstáculo sem sair do lugar (navegação)
  edgeFalls: 0,        // quedas de borda/plataforma
  airTime: 0,          // s em voo por salto/queda (uso de plataformas)
  closeTime: 0,        // s a ≤ 3 m do rival (pressão efetiva)
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
  nav = [false, false],   // navegação do Yuka por lado [azul, vermelho] (liga extras.nav.enableNav só durante a chamada daquele lado)
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
    if (e.result === 'executed' && e.kind === 'skill' && e.move && e.note !== 'marcador aberto' && e.note !== 'cast iniciado no ar') s.moveUses[e.move] = (s.moveUses[e.move] ?? 0) + 1;
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

      if (nav[0] || nav[1]) {
        const prevNav = C.extras.nav.enableNav;C.extras.nav.enableNav = 1;
        if (nav[0]) navAssist(g, g.playerBrain, g.fighters[0], g.fighters[1], cmd0);
        if (nav[1] && C.extras.toggles.enableEnemyAI) navAssist(g, g.brain, g.fighters[1], g.fighters[0], cmd1);
        C.extras.nav.enableNav = prevNav;
      }
      const cmds = [cmd0, cmd1], posBefore = g.fighters.map(f => ({x: f.position.x, z: f.position.z})), flightBefore = g.fighters.map(f => !!f.flight);

      g.step(cmd0, cmd1);
      g.fighters.forEach((f, i) => {
        const moved = Math.hypot(f.position.x - posBefore[i].x, f.position.z - posBefore[i].z) / step, wants = Math.hypot(cmds[i].move.x, cmds[i].move.z) > .5;
        if (wants && moved < 1 && !f.flight && !f.action && f.hp > 0) S[i].stuckTime += step;
        if (f.flight && !flightBefore[i] && f.flight.isEdgeFall) S[i].edgeFalls++;
        if (f.flight) S[i].airTime += step;
        if (Math.hypot(f.position.x - g.fighters[1 - i].position.x, f.position.z - g.fighters[1 - i].position.z) <= 3 && f.hp > 0) S[i].closeTime += step;
      });

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
    timeout: g.phase !== 'result' || g.winner == null,   // sem vencedor (tempo esgotado ou double KO) não pontua para nenhum lado
    loadouts: g.loadouts,
    finalHp: g.fighters.map(f => +f.hp.toFixed(1)),
    worstDecisions: worstDecisions.slice(0, 15),
    explanation,
  };
}
