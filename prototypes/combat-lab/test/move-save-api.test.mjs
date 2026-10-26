// API de gravação do Editor de Moves (servidor local): lê e grava move.json e o visual aprovado SÓ em arquivos existentes, valida, exige confirmação,
// detecta arquivo alterado no disco (hash) e só aceita a própria origem. Usa pastas TEMPORÁRIAS (os arquivos reais não são tocados).
// Uso: node prototypes/combat-lab/test/move-save-api.test.mjs
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startDevServer} from '../dev-server.mjs';

const here = fileURLToPath(new URL('..', import.meta.url));
const real = {moves: join(here, 'src/sim/moves'), approved: join(here, '../sand-stone-lab/approved')};
const tmp = mkdtempSync(join(tmpdir(), 'arenamon-save-')), movesDir = join(tmp, 'moves'), approvedDir = join(tmp, 'approved');
mkdirSync(movesDir);mkdirSync(approvedDir);
const realSandWave = existsSync(join(real.moves, 'sand-wave/sand-wave.move.json')) ? join(real.moves, 'sand-wave/sand-wave.move.json') : join(real.moves, 'sand-wave.move.json');
copyFileSync(realSandWave, join(movesDir, 'sand-wave.move.json'));
copyFileSync(join(real.moves, 'harden.move.json'), join(movesDir, 'harden.move.json'));
for (const f of ['sand.json', 'psyshock.json']) copyFileSync(join(real.approved, f), join(approvedDir, f));
const realBefore = readFileSync(realSandWave, 'utf8');

const srv = await startDevServer({port: 0, quiet: true, watchFiles: false, movesDir, approvedDir}), base = `http://127.0.0.1:${srv.port}`;
let n = 0;const ok = l => {n++;console.log('✓', l);};
const get = async p => ({status: (await fetch(base + p)).status, json: await (await fetch(base + p)).json().catch(() => null)});
const put = (p, body, headers = {origin: base}) => fetch(base + p, {method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body), headers});
try {
  // ---- leitura ----
  assert.deepEqual((await get('/api/moves')).json.ids, ['harden', 'sand-wave']);
  assert.deepEqual((await get('/api/approved')).json.ids, ['psyshock', 'sand']);
  const sw = (await get('/api/moves/sand-wave')).json;
  assert.equal(sw.id, 'sand-wave');assert.equal(sw.doc.def.id, 'sand-wave');assert.match(sw.hash, /^[0-9a-f]{40}$/);
  assert.equal((await get('/api/moves/nao-existe')).status, 404);
  assert.equal((await get('/api/moves/..%2Fpackage')).status, 400);
  assert.equal((await get('/api/moves/Sand_Wave')).status, 400);
  assert.equal((await get('/api/tipo/x')).status, 404);
  ok('lista e lê move.json e visual aprovado (com hash); recusa nome inválido e arquivo que não existe');

  // ---- gravação feliz ----
  const edited = structuredClone(sw.doc);edited.params.rows.find(r => r.key === 'damage').value = 11;
  let r = await put('/api/moves/sand-wave', {doc: edited, expectHash: sw.hash, confirm: true});
  assert.equal(r.status, 200);const w = await r.json();assert.equal(w.ok, true);assert.equal(w.changed, true);assert.notEqual(w.hash, sw.hash);
  const onDisk = JSON.parse(readFileSync(join(movesDir, 'sand-wave.move.json'), 'utf8'));
  assert.equal(onDisk.params.rows.find(x => x.key === 'damage').value, 11);
  assert.equal(readFileSync(join(movesDir, 'sand-wave.move.json'), 'utf8'), JSON.stringify(edited, null, 2) + '\n', 'mesma formatação de sempre');
  assert.deepEqual(readdirSync(movesDir).filter(f => f.endsWith('.tmp')), [], 'sem arquivo temporário sobrando');
  assert.equal(readFileSync(realSandWave, 'utf8'), realBefore, 'o arquivo REAL não foi tocado');
  ok('grava o move.json (formatação idêntica, atômica, sem .tmp) só na pasta configurada');

  // ---- sem mudança ----
  const again = (await get('/api/moves/sand-wave')).json;
  r = await put('/api/moves/sand-wave', {doc: again.doc, expectHash: again.hash, confirm: true});
  assert.equal((await r.json()).changed, false);
  ok('gravar o mesmo conteúdo não altera nada (changed: false)');

  // ---- confirmação, hash e origem ----
  r = await put('/api/moves/sand-wave', {doc: edited, expectHash: again.hash});assert.equal(r.status, 400, 'sem confirm');
  r = await put('/api/moves/sand-wave', {doc: edited, expectHash: sw.hash, confirm: true});assert.equal(r.status, 409, 'hash velho = arquivo mudou');
  assert.ok((await r.json()).currentHash);
  r = await put('/api/moves/sand-wave', {doc: edited, expectHash: again.hash, confirm: true}, {origin: 'http://evil.example'});assert.equal(r.status, 403);
  r = await put('/api/moves/sand-wave', {doc: edited, expectHash: again.hash, confirm: true}, {});assert.equal(r.status, 403, 'sem origem');
  r = await put('/api/moves/sand-wave', 'não é json');assert.equal(r.status, 400);
  r = await fetch(base + '/api/moves/sand-wave', {method: 'DELETE', headers: {origin: base}});assert.equal(r.status, 405);
  ok('recusa gravar sem confirmação, com hash velho (409), de outra origem ou sem origem, JSON inválido e outros métodos');

  // ---- validação do conteúdo ----
  const cur = (await get('/api/moves/sand-wave')).json;
  const bad = (mut, status, re) => {const d = structuredClone(cur.doc);mut(d);return put('/api/moves/sand-wave', {doc: d, expectHash: cur.hash, confirm: true}).then(async x => {assert.equal(x.status, status);assert.match((await x.json()).error, re);});};
  await bad(d => {d.schemaVersion = 9;}, 422, /schemaVersion/);
  await bad(d => {d.def.id = 'outro';}, 422, /diferente do arquivo/);
  await bad(d => {d.params.rows[0].unit = undefined;delete d.params.rows[0].unit;}, 422, /falta unit/);
  await bad(d => {d.extra = 1;}, 422, /campo desconhecido/);
  const h = (await get('/api/moves/harden')).json;
  r = await put('/api/moves/harden', {doc: sw.doc, expectHash: h.hash, confirm: true});assert.equal(r.status, 422, 'conteúdo de outro Move no arquivo errado');
  ok('valida o esquema e o id antes de gravar (nada inválido chega ao disco)');
  assert.equal(JSON.parse(readFileSync(join(movesDir, 'harden.move.json'), 'utf8')).def.id, 'harden');

  // ---- visual aprovado ----
  const sand = (await get('/api/approved/sand')).json;
  const vis = structuredClone(sand.doc);vis.visualParameters.density = 2.5;
  r = await put('/api/approved/sand', {doc: vis, expectHash: sand.hash, confirm: true});assert.equal(r.status, 200);
  assert.equal(JSON.parse(readFileSync(join(approvedDir, 'sand.json'), 'utf8')).visualParameters.density, 2.5);
  const bad2 = structuredClone(sand.doc);bad2.visualParameters.density = 9999;
  const cur2 = (await get('/api/approved/sand')).json;
  r = await put('/api/approved/sand', {doc: bad2, expectHash: cur2.hash, confirm: true});assert.equal(r.status, 422, 'valor fora da faixa do atelier');
  const wrongCat = structuredClone(cur2.doc);
  r = await put('/api/approved/psyshock', {doc: wrongCat, expectHash: (await get('/api/approved/psyshock')).json.hash, confirm: true});assert.equal(r.status, 422, 'categoria diferente do arquivo');
  ok('grava o visual aprovado do atelier validando faixa e categoria');

  // ---- gravação híbrida e detecção de duplicatas (Doc 02) ----
  const subMoveDir = join(movesDir, 'sand-wave');
  mkdirSync(subMoveDir);
  // No momento temos sand-wave.move.json na raiz e a pasta vazia -> lê da raiz normalmente
  assert.equal((await get('/api/moves/sand-wave')).status, 200);

  // Criamos o arquivo duplicado dentro da subpasta:
  copyFileSync(join(movesDir, 'sand-wave.move.json'), join(subMoveDir, 'sand-wave.move.json'));
  // Agora existe duplicata: locate e list devem falhar com 409
  const dupRead = await get('/api/moves/sand-wave');
  assert.equal(dupRead.status, 409, 'recusa leitura quando há duplicata raiz e subpasta');
  assert.match(dupRead.json.error, /duplicado detectado/);

  const dupList = await get('/api/moves');
  assert.equal(dupList.status, 409, 'recusa listagem quando há duplicata');
  assert.match(dupList.json.error, /duplicação detectada/);

  // Removemos o arquivo da raiz: agora existe SOMENTE na subpasta (Move migrado)
  rmSync(join(movesDir, 'sand-wave.move.json'));
  const subRead = await get('/api/moves/sand-wave');
  assert.equal(subRead.status, 200, 'lê com sucesso a partir da subpasta');
  assert.equal(subRead.json.id, 'sand-wave');

  // Grava na subpasta
  const subEdit = structuredClone(subRead.json.doc);
  subEdit.params.rows.find(r => r.key === 'damage').value = 15;
  const subWrite = await put('/api/moves/sand-wave', {doc: subEdit, expectHash: subRead.json.hash, confirm: true});
  assert.equal(subWrite.status, 200, 'grava com sucesso na subpasta');
  assert.equal(JSON.parse(readFileSync(join(subMoveDir, 'sand-wave.move.json'), 'utf8')).params.rows.find(x => x.key === 'damage').value, 15);
  assert.ok(!existsSync(join(movesDir, 'sand-wave.move.json')), 'não recria o arquivo plano na raiz');
  ok('gravação híbrida: lê e grava em subpasta e recusa com 409 qualquer ambiguidade de duplicatas');

  // Restaura para a raiz para os testes seguintes
  copyFileSync(join(subMoveDir, 'sand-wave.move.json'), join(movesDir, 'sand-wave.move.json'));
  rmSync(subMoveDir, {recursive: true, force: true});

  // ---- a página injetada sabe que pode gravar ----
  assert.match(await (await fetch(base + '/')).text(), /save:true/);
  ok('o laboratório servido avisa à página que a gravação está disponível');
} finally {
  await srv.close();
  rmSync(tmp, {recursive: true, force: true});
}
assert.equal(readFileSync(realSandWave, 'utf8'), realBefore);
console.log(`\n${n} verificações da API de gravação.`);
