// @ts-check
// Comparação A × B: executa a MESMA situação (todos os cenários roteirizados ou a mesma gravação de partida) com dois
// conjuntos de ajustes, sem renderização, e devolve os resultados lado a lado. A configuração é restaurada no fim.
import {C} from './config.js';
import {Game} from './game.js';
import {SCENARIOS, runScenario} from './scenarios.js';

const get = (path) => path.split('.').reduce((o, k) => o?.[k], C);
const set = (path, v) => {const k = path.split('.'), last = k.pop(), o = k.reduce((a, x) => a?.[x], C);if (o && last in o) o[last] = v;};

/** Aplica `values` (caminho → valor) só durante `fn`, restaurando exatamente os valores anteriores. */
export function withValues(values, fn) {
  const saved = Object.keys(values).map(p => [p, structuredClone(get(p))]);
  try {for (const [p, v] of Object.entries(values)) set(p, v);return fn();} finally {for (const [p, v] of saved) set(p, v);}
}

/** Reexecuta uma gravação (mesma semente, perfis e entradas do azul) e mede o resultado. */
export function replayMatch(meta, commands) {
  const g = new Game();g.brain.seed = meta.seed;g.playerBrain.seed = meta.seed + 7919;g.brain.reset();g.playerBrain.reset();
  g.profile = meta.profile;g.enemyProfile = meta.enemyProfile;g.mode = meta.mode;g.reset();
  const sides = [0, 1].map(() => ({damage: 0, impact: 0, partial: 0, perfect: 0, clash: 0, perfectDodge: 0, cancel: 0, buffered: 0})), last = [null, null];
  for (let t = 0; t < commands.length && g.phase !== 'result'; t++) {
    g.step(commands[t] ?? undefined);
    g.fighters.forEach((f, i) => {if (f.action && f.action !== last[i]) {if (f.action.fromCancel) sides[i].cancel++;if (f.action.buffered) sides[i].buffered++;}last[i] = f.action;});
    for (const e of g.lastStepEvents) {
      const s = sides[e.attacker];
      if (s) {
        if (e.result in s) s[e.result]++;
        if (typeof e.damage === 'number') s.damage += e.damage;
      }
    }
  }
  return {ticks: g.tick, winner: g.winner, phase: g.phase, hp: g.fighters.map(f => f.hp), stamina: g.fighters.map(f => f.stamina), sides, fighters: JSON.stringify(g.fighters)};
}

/** Linhas [rótulo, A, B] da comparação de uma gravação. */
export function matchRows(a, b) {
  const who = w => w === 0 ? 'azul' : w === 1 ? 'vermelho' : '—', f = n => +n.toFixed(2);
  const rows = [['Vencedor', who(a.winner), who(b.winner)], ['Passos simulados', a.ticks, b.ticks], ['HP final (azul / vermelho)', a.hp.map(f).join(' / '), b.hp.map(f).join(' / ')],
    ['Stamina final (azul / vermelho)', a.stamina.map(f).join(' / '), b.stamina.map(f).join(' / ')]];
  for (const [k, label] of [['damage', 'Dano causado'], ['impact', 'Impactos'], ['partial', 'Bloqueados'], ['perfect', 'Defesas perfeitas sofridas'], ['clash', 'Clashes'], ['perfectDodge', 'Esquivas perfeitas'], ['cancel', 'C → X'], ['buffered', 'Ações do buffer']])
    rows.push([`${label} (azul / vermelho)`, a.sides.map(s => f(s[k])).join(' / '), b.sides.map(s => f(s[k])).join(' / ')]);
  return rows;
}

/** Executa todos os cenários com A e com B. */
export function compareScenarios(valuesA, valuesB) {
  return SCENARIOS.map(def => {
    const ra = withValues(valuesA, () => runScenario(def)), rb = withValues(valuesB, () => runScenario(def));
    const diffs = ra.checks.map((c, i) => ({label: c.label, a: c.actual, b: rb.checks[i]?.actual, okA: c.ok, okB: rb.checks[i]?.ok})).filter(d => String(d.a) !== String(d.b) || d.okA !== d.okB);
    return {id: def.id, name: def.name, okA: ra.ok, okB: rb.ok, diffs};
  });
}

/** Compara uma gravação com A e com B. */
export function compareMatch(valuesA, valuesB, meta, commands) {
  const a = withValues(valuesA, () => replayMatch(meta, commands)), b = withValues(valuesB, () => replayMatch(meta, commands));
  return {a, b, rows: matchRows(a, b)};
}
