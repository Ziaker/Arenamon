// Gera docs/MATRIZ_MIGRACAO_MOVES_F6.md (F6, Task 14) rodando os cenários reais de cada Move do registro.
// Uso: node scripts/gen-matriz-moves-f6.mjs   (o teste prototypes/combat-lab/test/f6-moves-contract.test.mjs exige o arquivo em dia)
import {writeFileSync} from 'node:fs';
import {buildMatrix, MATRIX_PATH} from '../prototypes/combat-lab/test/f6-moves-contract-lib.mjs';

writeFileSync(MATRIX_PATH, buildMatrix());
console.log(`matriz escrita em ${MATRIX_PATH}`);
