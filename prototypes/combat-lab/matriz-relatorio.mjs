// Gera docs/MATRIZ_MOVES_<data>.md: a matriz de cenários (move-matrix.js) de todos os Moves registrados, com semente, tick, esperado e obtido
// de cada falha e a razão de cada N/A. Regenerável: `npm run matriz` (use `-- --seed 21` para outra semente; `-- --data AAAA-MM-DD` para fixar a data).
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resetConfig, factoryDefaults} from './src/sim/config.js';
import {registerStandardMoves} from './src/sim/moves/standard.js';
import {clearMoves, listMoves} from './src/sim/moves.js';
import {clearEffects} from './src/sim/move-effects.js';
import {runAllMatrices, renderMatrixReport} from './src/sim/move-matrix.js';

const arg = (nome, padrao) => {const i = process.argv.indexOf('--' + nome);return i > 0 ? process.argv[i + 1] : padrao;};
const seed = Number(arg('seed', 7)), date = arg('data', new Date().toISOString().slice(0, 10));
resetConfig(factoryDefaults());clearMoves();clearEffects();registerStandardMoves();
const r = runAllMatrices(listMoves().map(m => m.id), seed);
const out = fileURLToPath(new URL(`../../docs/MATRIZ_MOVES_${date}.md`, import.meta.url));
writeFileSync(out, renderMatrixReport(r, {seed, date}));
console.log(`${out}\n${r.results.length} resultados: ${r.ok} ok · ${r.fail} falhas · ${r.na} N/A`);
process.exit(r.fail ? 1 : 0);
