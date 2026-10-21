// @ts-check
// Mede o uso e o efeito de cada um dos 13 Moves novos quando a IA os tem: IA com o Move × IA sem Moves (lados alternados, sementes fixas).
// Uso: node prototypes/combat-lab/test/ai-new-moves-eval.mjs [partidas por lado] [--write]. "uso/luta" = quantas vezes a IA aciona o Move; vitórias são as do lado equipado.
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {evalSeries} from '../src/sim/ai-eval.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {writeFileSync} from 'node:fs';

registerStandardMoves();
const N = Number(process.argv[2] ?? 30), WRITE = process.argv.includes('--write');
const IDS = ['harden', 'second-wind', 'swift', 'lunge', 'quick-attack', 'guard-break', 'feint', 'riposte', 'bounce', 'spikes', 'sand-wave', 'bullet-punch', 'emerging-stone'];
const rows = [];
for (const id of IDS) {
  resetConfig(defaults());C.map.arenaShape = 'square';
  const a = evalSeries({matches: N, seed: 1, loadouts: [[], [id]], maxSeconds: 60}), b = evalSeries({matches: N, seed: 1001, loadouts: [[id], []], maxSeconds: 60});
  const eq = [a.sides[1], b.sides[0]], opp = [a.sides[0], b.sides[1]], n = a.matches + b.matches;
  const uses = eq.reduce((s, x) => s + (x.moveUses[id] ?? 0), 0), wins = eq.reduce((s, x) => s + x.wins, 0), oppWins = opp.reduce((s, x) => s + x.wins, 0);
  const dmg = eq.reduce((s, x) => s + x.damage, 0) / n, dmgTaken = opp.reduce((s, x) => s + x.damage, 0) / n;
  rows.push({id, uses: uses / n, wins: wins / n, oppWins: oppWins / n, dmg, dmgTaken});
  console.log(`${id.padEnd(15)} uso/luta ${(uses / n).toFixed(2)} · vitórias ${(100 * wins / n).toFixed(0)}% × ${(100 * oppWins / n).toFixed(0)}% · dano causado ${dmg.toFixed(0)} × sofrido ${dmgTaken.toFixed(0)}`);
}
if (WRITE) {
  let md = `# IA com os Moves novos — medição\n\nIA com o Move × IA sem Moves, ${N * 2} partidas por Move (lados alternados, sementes fixas, \`newMovesRate\` = 1). "Uso/luta" = vezes que a IA aciona o Move; vitórias do lado equipado × do adversário (o resto são lutas sem desfecho). Gerado por \`test/ai-new-moves-eval.mjs --write\`.\n\n| Move | Uso/luta | Vitórias (com × sem) | Dano causado × sofrido |\n|---|---|---|---|\n`;
  for (const r of rows) md += `| ${r.id} | ${r.uses.toFixed(2)} | ${(100 * r.wins).toFixed(0)}% × ${(100 * r.oppWins).toFixed(0)}% | ${r.dmg.toFixed(0)} × ${r.dmgTaken.toFixed(0)} |\n`;
  writeFileSync(new URL('../../../docs/ia/NEW_MOVES_IA_MEDICAO.md', import.meta.url), md);
  console.log('escrito docs/ia/NEW_MOVES_IA_MEDICAO.md');
}
