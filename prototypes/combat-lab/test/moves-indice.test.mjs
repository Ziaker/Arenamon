// @ts-check
// Índice vivo dos Moves (#13): em dia com o código real e sem arquivo fantasma.
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {assert, suite} from './moves-new-helpers.mjs';
import {buildIndex, INDEX_PATH} from '../gen-indice.mjs';

const {test, done} = suite('ÍNDICE VIVO DOS MOVES');
const repo = fileURLToPath(new URL('../../..', import.meta.url));

const built = await buildIndex();   // o helper de teste é síncrono: monta o índice antes
test('docs/INDICE_VIVO_MOVES.md está em dia (rode npm run indice se falhar)', () => {
  assert.equal(readFileSync(INDEX_PATH, 'utf8'), built);
});
test('todo caminho citado no índice existe (nenhum arquivo fantasma)', () => {
  const paths = [...readFileSync(INDEX_PATH, 'utf8').matchAll(/`((?:prototypes|docs)\/[^`\s]+\.[a-z]+)`/g)].map(m => m[1]);
  assert.ok(paths.length > 100, 'o índice precisa citar arquivos');
  assert.deepEqual(paths.filter(p => !existsSync(repo + p)), []);
});
test('todo Move registrado tem seção própria e pelo menos um teste citado', () => {
  const md = readFileSync(INDEX_PATH, 'utf8');
  const sections = md.split(/^### /m).slice(1);
  assert.ok(sections.length >= 19);
  for (const s of sections) assert.ok(/\*\*testes:\*\*/.test(s), 'sem teste citado: ' + s.split('\n')[0]);
});

done();
