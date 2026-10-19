// Métricas de equilíbrio: várias lutas IA × IA, sem renderização, com os ajustes atuais. Mostra se um ajuste fez
// alguma mecânica dominar (vitórias, uso de X/C/C → X/buffer, contatos, clashes, exaustão e duração das lutas).
import {C} from './config.js';
import {Game} from './game.js';

const blank = () => ({styles: {}, wins: 0, tackle: 0, dodge: 0, cancel: 0, buffered: 0, vault: 0, impact: 0, partial: 0, perfect: 0, clash: 0, perfectDodge: 0, damage: 0, exhausted: 0, exhaustedTicks: 0});

/** Executa `matches` lutas IA × IA (modo combate, personalidades aiBlue/aiRed) e devolve totais por lutador. */
export function runBalance({matches = 20, seed = 1, profile = 'balanced', enemyProfile = 'balanced', maxSeconds = 90, mode = 'tactical', enemyMode = mode} = {}) {
  const sides = [blank(), blank()], durations = [];let timeouts = 0;
  const maxTicks = Math.round(maxSeconds / C.test.step);
  for (let m = 0; m < matches; m++) {
    const g = new Game({seed: seed + m * 7919});g.mode = enemyMode;g.profile = profile;g.enemyProfile = enemyProfile;g.reset();
    const last = [null, null], wasExhausted = [false, false];let t = 0;
    for (; t < maxTicks && g.phase !== 'result'; t++) {
      g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], mode, C.test.step));
      g.fighters.forEach((f, i) => {
        const s = sides[i];
        if (f.action && f.action !== last[i] && f.action.kind !== 'recoil') {s[f.action.kind]++;if (f.action.fromCancel) s.cancel++;if (f.action.buffered) s.buffered++;if (f.action.vault) s.vault++;}
        last[i] = f.action;
        if (f.exhausted) {s.exhaustedTicks++;if (!wasExhausted[i]) s.exhausted++;}wasExhausted[i] = f.exhausted;
      });
      for (const e of g.lastStepEvents) {
        const s = sides[e.attacker];
        if (s) {
          if (e.result in s) s[e.result]++;
          if (typeof e.damage === 'number') s.damage += e.damage;
        }
      }
    }
    if (g.phase === 'result' && g.winner !== null) sides[g.winner].wins++;else timeouts++;
    [g.playerBrain, g.brain].forEach((b, i) => {const s = b.t?.style?.label;if (s) sides[i].styles[s] = (sides[i].styles[s] || 0) + 1;});
    durations.push(t * C.test.step);
  }
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  return {matches, seed, profile, enemyProfile, mode, enemyMode, timeouts, avgSeconds: avg, minSeconds: Math.min(...durations), maxSeconds: Math.max(...durations), sides};
}

const styleList = s => Object.entries(s.styles).map(([k, n]) => `${k} ${n}`).join(', ') || '—';
/** Linhas da tabela de relatório: [rótulo, azul, vermelho]. */
export function balanceRows(r) {
  const [a, b] = r.sides, per = (s, k) => (s[k] / r.matches).toFixed(1), pct = (x, y) => y ? (100 * x / y).toFixed(0) + '%' : '—';
  return [
    ['Vitórias', `${a.wins} (${pct(a.wins, r.matches)})`, `${b.wins} (${pct(b.wins, r.matches)})`],
    ['X por luta', per(a, 'tackle'), per(b, 'tackle')], ['C por luta', per(a, 'dodge'), per(b, 'dodge')],
    ['C → X (% dos X)', `${a.cancel} (${pct(a.cancel, a.tackle)})`, `${b.cancel} (${pct(b.cancel, b.tackle)})`],
    ['Ações vindas do buffer', a.buffered, b.buffered], ['Esquivas com salto', a.vault, b.vault],
    ['Impactos limpos', a.impact, b.impact], ['Contatos bloqueados (parcial)', a.partial, b.partial], ['Defesas perfeitas sofridas', a.perfect, b.perfect],
    ['Clashes', a.clash, b.clash], ['Esquivas perfeitas', a.perfectDodge, b.perfectDodge], ['Dano causado', a.damage.toFixed(0), b.damage.toFixed(0)],
    ['Estilos sorteados (tático)', styleList(a), styleList(b)], ['Vezes exausto', a.exhausted, b.exhausted], ['Tempo exausto (s)', (a.exhaustedTicks * C.test.step).toFixed(1), (b.exhaustedTicks * C.test.step).toFixed(1)],
  ];
}
