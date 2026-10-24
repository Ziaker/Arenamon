// Fonte única dos parâmetros aprovados: cada prototypes/sand-stone-lab/approved/<move>.json precisa ser uma exportação VÁLIDA do atelier
// (mesmo validador do botão Importar, sem campo ignorado nem preenchido por padrão) e é o que o jogo usa. Uso: node prototypes/combat-lab/test/atelier-approved.test.mjs
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {defaults} from '../../sand-stone-lab/src/config.ts';
import {parsePreset} from '../../sand-stone-lab/src/presets.ts';
import {ATELIER_GAME_PARAMS, ATELIER_GAME_VARIANT} from '../src/view/quarks/atelier-game-params.js';

const dir = new URL('../../sand-stone-lab/approved/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.json'));
assert.ok(files.length >= 4, 'esperava sand, stone, psyshock e swift');
for (const f of files) {
  const move = f.replace('.json', ''), raw = readFileSync(new URL(f, dir), 'utf8'), r = parsePreset(raw);
  assert.equal(r.scope, 'single', `${f}: precisa ser exportação de uma alternativa`);
  assert.equal(r.category, move, `${f}: categoria diferente do nome do arquivo`);
  assert.equal(r.ignored, 0, `${f}: tem campos que o atelier ignora (versão antiga?)`);
  // o jogo funde com os padrões do atelier (atelier-game.js paramsOf), igual ao que o Importar faz com campos ausentes
  assert.deepEqual({...defaults[move], ...ATELIER_GAME_PARAMS[move]}, r.values, `${f}: o jogo não está usando exatamente os valores validados`);
  assert.equal(ATELIER_GAME_VARIANT[move], 'ABC'.indexOf(r.variant), `${f}: alternativa errada no jogo`);
  console.log(`  ✓ ${move} ${r.variant}: ${Object.keys(r.values).length} parâmetros válidos e idênticos no jogo${r.filled ? ` (${r.filled} usam o padrão do atelier: exportação anterior a controles novos)` : ''}`);
}
console.log(`${files.length} Moves aprovados, fonte única atelier = jogo.`);
