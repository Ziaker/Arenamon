// Varredura de balanceamento: vitórias da IA equipada com Second Wind ou Swift (contra IA sem Moves, 80 lutas por linha) ao mudar um slider. Só mede e imprime; resultado em docs/ia/BALANCEAMENTO_SECOND_WIND_SWIFT.md.
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {evalSeries} from '../src/sim/ai-eval.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
registerStandardMoves();
const N = 40;
const run = (id, values) => {
  resetConfig(defaults());C.map.arenaShape = 'square';
  const a = evalSeries({matches: N, seed: 1, loadouts: [[], [id]], maxSeconds: 60, values}), b = evalSeries({matches: N, seed: 1001, loadouts: [[id], []], maxSeconds: 60, values});
  const w = a.sides[1].wins + b.sides[0].wins, o = a.sides[0].wins + b.sides[1].wins, n = a.matches + b.matches;
  return `${(100 * w / n).toFixed(0)}% × ${(100 * o / n).toFixed(0)}%`;
};
const rows = [];
for (const r of [.4, .3, .2, .1]) rows.push(['second-wind', `regenPctPerSecond ${r}`, run('second-wind', {'world.secondWind.regenPctPerSecond': r})]);
for (const m of [.25, .5]) rows.push(['second-wind', `mobilityCostPct ${m} (regen .2)`, run('second-wind', {'world.secondWind.regenPctPerSecond': .2, 'world.secondWind.mobilityCostPct': m})]);
for (const [k, v] of [['damage', 3], ['damage', 2], ['damage', 1.5], ['count', 2], ['cooldown', 10]]) rows.push(['swift', `${k} ${v}`, run('swift', {[`world.swift.${k}`]: v})]);
for (const r of rows) console.log(r.join(' | '));
