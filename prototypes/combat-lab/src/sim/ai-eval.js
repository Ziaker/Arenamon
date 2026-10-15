// Avaliação da IA com sementes fixas (sem renderização): taxas de vitória, ações executadas, stamina gasta e
// desperdiçada, ações negadas (pelo diagnóstico do próprio controlador) e oportunidades de contra-ataque aproveitadas.
// As duas IAs jogam com as MESMAS regras do jogador (mesmo controlador, mesmos custos); nada aqui dá vantagem.
import {C} from './config.js';
import {Game} from './game.js';
import {withAttemptSink} from './attempts.js';
import {withValues} from './compare.js';

const side = () => ({wins: 0, tackles: 0, dodges: 0, cancels: 0, sprints: 0, guards: 0, perfectGuards: 0, perfectDodges: 0, hits: 0, blocked: 0, clashes: 0, whiffs: 0,
  staminaSpent: 0, staminaWasted: 0, denied: 0, perfectUnavailable: 0, deniedByReason: {}, counterOpen: 0, counterTaken: 0, exhaustedTime: 0, damage: 0});

/**
 * Uma luta: blue/red = {mode, values?} (values = ajustes aplicados à IA daquele lado não são possíveis — os dois lados
 * compartilham a configuração; use `values` global para A/B de parâmetros). Devolve estatísticas por lado.
 */
export function evalMatch({seed, blueMode = 'tactical', redMode = 'tactical', maxSeconds = 90, blueRev = null, redRev = null, blueFeatures = null}) {
  const g = new Game({seed});g.brain.seed = seed;g.playerBrain.seed = seed + 7919;g.brain.reset();g.playerBrain.reset();g.mode = redMode;g.reset();
  // Revisão da IA por lado (comparação anterior × revisada na mesma luta); null = ajuste global.
  g.playerBrain.revisionOverride = blueRev;g.brain.revisionOverride = redRev;if (blueFeatures) g.playerBrain.revFeatures = blueFeatures;
  const S = [side(), side()], step = C.test.step, last = [null, null], counterSeen = [false, false];let tick = 0;
  withAttemptSink((f, e) => {
    if (!g.fighters.includes(f)) return;const s = S[f.id];
    // A defesa perfeita em recarga não é uma ação negada (a defesa sai normalmente): contada à parte.
    if (e.result === 'denied' && e.kind === 'perfectGuard') s.perfectUnavailable++;
    else if (e.result === 'denied') {s.denied++;s.deniedByReason[e.reason] = (s.deniedByReason[e.reason] ?? 0) + 1;}
    if (e.result === 'executed' && e.kind === 'guard') s.guards++;
    if (e.result === 'executed' && e.kind === 'perfectGuard') s.perfectGuards++;
    if (e.result === 'executed' && e.kind === 'sprint') s.sprints++;
  }, () => {
    for (; tick < maxSeconds / step && g.phase !== 'result'; tick++) {
      const before = g.fighters.map(f => f.stamina);
      g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], blueMode, step));
      g.fighters.forEach((f, i) => {
        const s = S[i];
        // Ações novas (o objeto da ação muda) — X do C → X conta como cancelamento.
        if (f.action && f.action !== last[i]) {
          if (f.action.kind === 'tackle') {s.tackles++;if (f.action.fromCancel) s.cancels++;if ((f.action.speedMultiplier ?? 1) > 1) s.counterTaken++;f.action.__eval = {hit: false};}
          if (f.action.kind === 'dodge') s.dodges++;
        }
        // Fim de um X sem contato: stamina desperdiçada (o custo do tackle não rendeu nada).
        if (last[i]?.kind === 'tackle' && f.action !== last[i] && !last[i].hits?.size && !last[i].__clash) {s.whiffs++;s.staminaWasted += C.actions.tackle.cost;}
        last[i] = f.action;
        if (f.sprinting && !S[i].__sprinting) s.sprints++;S[i].__sprinting = f.sprinting;
        if (f.counterWindow > 0 && !counterSeen[i]) s.counterOpen++;counterSeen[i] = f.counterWindow > 0;
        const spent = before[i] - f.stamina;if (spent > 1e-9) s.staminaSpent += spent;
        if (f.exhausted) s.exhaustedTime += step;
      });
      for (const e of g.lastStepEvents) {
        const a = S[e.attacker];a.damage += e.damage;
        if (e.result === 'impact') a.hits++;else if (e.result === 'partial') a.blocked++;else if (e.result === 'clash') {a.clashes++;if (last[e.attacker]) last[e.attacker].__clash = true;}
        else if (e.result === 'perfectDodge') S[e.target].perfectDodges++;
      }
    }
  });
  if (g.winner !== null && g.winner !== undefined) S[g.winner].wins++;
  for (const s of S) delete s.__sprinting;
  return {seed, winner: g.winner, seconds: tick * step, sides: S, timeout: g.phase !== 'result'};
}
/** Várias lutas com sementes consecutivas; `values` muda a configuração (ex.: revisão da IA) só durante a avaliação. */
export function evalSeries({matches = 20, seed = 1, blueMode = 'tactical', redMode = 'tactical', values = {}, maxSeconds = 90, blueRev = null, redRev = null, blueFeatures = null} = {}) {
  return withValues(values, () => {
    const runs = [];for (let i = 0; i < matches; i++) runs.push(evalMatch({seed: seed + i, blueMode, redMode, maxSeconds, blueRev, redRev, blueFeatures}));
    const total = [side(), side()];
    for (const r of runs) r.sides.forEach((s, i) => {for (const [k, v] of Object.entries(s)) if (typeof v === 'number') total[i][k] += v;else for (const [rk, rv] of Object.entries(v)) total[i][k][rk] = (total[i][k][rk] ?? 0) + rv;});
    return {matches, seed, blueMode, redMode, values, blueRev, redRev, timeouts: runs.filter(r => r.timeout).length, avgSeconds: runs.reduce((a, r) => a + r.seconds, 0) / matches, sides: total, runs: runs.map(r => ({seed: r.seed, winner: r.winner, seconds: +r.seconds.toFixed(2)}))};
  });
}
/** Linhas de relatório (por lado). */
export function evalRows(r) {
  const s = r.sides, pct = (a, b) => b ? `${(100 * a / b).toFixed(0)}%` : '—', f = v => +v.toFixed(2);
  return [['Vitórias', s[0].wins, s[1].wins], ['Tackles (X)', s[0].tackles, s[1].tackles], ['X que acertaram (sem defesa)', s[0].hits, s[1].hits], ['X bloqueados', s[0].blocked, s[1].blocked], ['X que não tocaram ninguém', s[0].whiffs, s[1].whiffs], ['Clashes', s[0].clashes, s[1].clashes],
    ['Esquivas (C)', s[0].dodges, s[1].dodges], ['C → X', s[0].cancels, s[1].cancels], ['Sprints', s[0].sprints, s[1].sprints], ['Defesas', s[0].guards, s[1].guards], ['Esquivas perfeitas', s[0].perfectDodges, s[1].perfectDodges],
    ['Stamina gasta', f(s[0].staminaSpent), f(s[1].staminaSpent)], ['Stamina desperdiçada (X sem contato)', f(s[0].staminaWasted), f(s[1].staminaWasted)], ['Tempo exausto (s)', f(s[0].exhaustedTime), f(s[1].exhaustedTime)],
    ['Ações negadas pelo motor', s[0].denied, s[1].denied], ['Toques de D com a defesa perfeita em recarga', s[0].perfectUnavailable, s[1].perfectUnavailable], ['Contra-ataques aproveitados', `${s[0].counterTaken} de ${s[0].counterOpen} (${pct(s[0].counterTaken, s[0].counterOpen)})`, `${s[1].counterTaken} de ${s[1].counterOpen} (${pct(s[1].counterTaken, s[1].counterOpen)})`]];
}
