// Gera docs/MATRIZ_SLIDERS_F7.md (F7, Task 15): enumera todo slider das definições reais, acha o consumidor e roda o A/B (mín × máx) completo
// nos cenários de cada um. Uso: node scripts/gen-matriz-sliders.mjs   (o teste prototypes/combat-lab/test/f7-sliders-coverage.test.mjs exige o arquivo em dia
// e reexecuta o cenário A/B registrado em cada linha «muda»). Leva ~1–2 min (os pendentes percorrem todos os cenários).
import {writeFileSync} from 'node:fs';
import {buildMatrix, searchAb, DOC_PATH} from '../prototypes/combat-lab/test/f7-sliders-coverage-lib.mjs';

const t0 = Date.now(), text = await buildMatrix(searchAb), fails = text.split('\n').filter(l => /\| FALHA: /.test(l));
writeFileSync(DOC_PATH, text);
console.log(`matriz escrita em ${DOC_PATH} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (fails.length) {console.error(`${fails.length} slider(es) de gameplay SEM diferença A/B e fora de SENSITIVITY_PENDING:\n${fails.slice(0, 20).join('\n')}`);process.exitCode = 1;}
