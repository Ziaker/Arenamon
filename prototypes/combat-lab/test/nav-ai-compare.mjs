// @ts-check
// Mede se a navegação (Yuka) melhora a IA: IA × IA em mapas com muros, corredores e plataformas, com e sem navegação em UM dos lados (alternando azul/vermelho para anular viés de lado).
// Uso: node prototypes/combat-lab/test/nav-ai-compare.mjs [partidas por configuração] — só mede e imprime; não altera nada. Resultado vai para docs/ia/NAV_IA_MEDICAO.md quando --write.
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {evalSeries} from '../src/sim/ai-eval.js';
import {NAV_SCENARIOS} from '../src/nav/nav-scenarios.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {writeFileSync} from 'node:fs';

registerStandardMoves();
const N = Number(process.argv[2] ?? 40), WRITE = process.argv.includes('--write');
const SET = Object.fromEntries((process.argv.find(a => a.startsWith('--set='))?.slice(6) ?? '').split(',').filter(Boolean).map(kv => {const [k, v] = kv.split('=');return [`extras.nav.${k}`, Number(v)];}));   // ex.: --set=jumpPenalty=4,dropPenalty=4
const ONLY = process.argv.find(a => a.startsWith('--maps='))?.slice(7).split(',');
resetConfig(defaults());
C.map.arenaShape = 'square';

/** Instala o mapa do cenário na partida (sem itens) e devolve as posições iniciais [azul, vermelho]. */
const mapOf = id => {
  if (id === 'padrão') return {setup: null, positions: null};
  const S = NAV_SCENARIOS[id];
  return {
    positions: [{x: S.target.x, z: S.target.z}, {x: S.chaser.x, z: S.chaser.z}],
    setup: g => {const m = g.mapState;m.obstacles = structuredClone(S.obstacles);m.platforms = structuredClone(S.platforms);m.destructibles = [];m.navBlocked = structuredClone(S.blocked ?? []);m.items = [];m.regularSpawnTimer = 1e9;},
  };
};
const MAPS = (ONLY ?? ['padrão', 'muro', 'corredor', 'rotas', 'plataforma', 'completo']);
const rows = [];
for (const id of MAPS) {
  const {setup, positions} = mapOf(id);
  const run = (nav, seed) => evalSeries({matches: N, seed, nav, scenarioSetup: setup, initialPositions: positions, maxSeconds: 60, values: SET});
  const acc = (r, i) => ({wins: r.sides[i].wins, stuck: r.sides[i].stuckTime, falls: r.sides[i].edgeFalls, air: r.sides[i].airTime, close: r.sides[i].closeTime, hits: r.sides[i].hits, dmg: r.sides[i].damage, n: r.matches});
  const add = (a, b) => Object.fromEntries(Object.keys(a).map(k => [k, a[k] + b[k]]));
  const base = [run([false, false], 1), run([false, false], 1001)];
  const nb = [run([true, false], 1), run([true, false], 1001)];      // nav no azul
  const nr = [run([false, true], 1), run([false, true], 1001)];      // nav no vermelho
  const plain = add(add(acc(base[0], 0), acc(base[1], 0)), add(acc(base[0], 1), acc(base[1], 1)));
  const withNav = add(add(acc(nb[0], 0), acc(nb[1], 0)), add(acc(nr[0], 1), acc(nr[1], 1)));   // lado COM navegação
  const without = add(add(acc(nb[0], 1), acc(nb[1], 1)), add(acc(nr[0], 0), acc(nr[1], 0)));   // lado SEM navegação (adversário dele)
  rows.push({id, plain, withNav, without});
  const pct = (a, b) => (100 * a / b).toFixed(0) + '%', per = (a, b) => (a / b).toFixed(2);
  console.log(`${id.padEnd(11)} vitórias com nav ${pct(withNav.wins, withNav.n)} · sem nav ${pct(without.wins, without.n)} (sem navegação nos dois: ${pct(plain.wins, plain.n)}) · parado/luta ${per(withNav.stuck, withNav.n)} s × ${per(without.stuck, without.n)} s · quedas ${per(withNav.falls, withNav.n)} × ${per(without.falls, without.n)} · pressão (≤3 m) ${per(withNav.close, withNav.n)} s × ${per(without.close, without.n)} s · em voo ${per(withNav.air, withNav.n)} s × ${per(without.air, without.n)} s`);
}
if (WRITE) {
  const f = (a, k) => (a[k] / a.n).toFixed(2);
  let md = `# Navegação (Yuka) na IA — medição\n\nIA × IA, ${N * 2} partidas por lado e por mapa (sementes fixas, azul/vermelho alternados). "Com nav" = a IA daquele lado usa o planejador; "sem nav" = o adversário dela. Gerado por \`test/nav-ai-compare.mjs --write\`.\n\n| Mapa | Vitórias com nav | Vitórias sem nav | Parado/luta (s) com × sem | Quedas/luta com × sem | Pressão ≤3 m (s) com × sem | Em voo (s) com × sem |\n|---|---|---|---|---|---|---|\n`;
  for (const r of rows) md += `| ${r.id} | ${(100 * r.withNav.wins / r.withNav.n).toFixed(0)}% | ${(100 * r.without.wins / r.without.n).toFixed(0)}% | ${f(r.withNav, 'stuck')} × ${f(r.without, 'stuck')} | ${f(r.withNav, 'falls')} × ${f(r.without, 'falls')} | ${f(r.withNav, 'close')} × ${f(r.without, 'close')} | ${f(r.withNav, 'air')} × ${f(r.without, 'air')} |\n`;
  writeFileSync(new URL('../../../docs/ia/NAV_IA_MEDICAO.md', import.meta.url), md);
  console.log('escrito docs/ia/NAV_IA_MEDICAO.md');
}
