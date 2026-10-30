// Servidor local opcional (sem navegador): serve o laboratório e o painel, recompila sob demanda, avisa a página
// (SSE) e só lê/grava dentro das áreas permitidas, com extensões permitidas e da própria origem.
import assert from 'node:assert/strict';
import {existsSync, readFileSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {startDevServer, safePath, AREAS} from '../dev-server.mjs';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const here = fileURLToPath(new URL('..', import.meta.url)), srv = await startDevServer({port: 0, quiet: true, watchFiles: false}), base = `http://127.0.0.1:${srv.port}`;
const testFile = 'teste-servidor-local.json';
try {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /__ARENAMON_DEV__/);assert.match(html, /Laborat[óo]rio de Combate/);assert.match(await (await fetch(base + '/relatorios')).text(), /Painel de Relat[óo]rios/);
  const health = await (await fetch(base + '/api/health')).json();assert.ok(health.ok);assert.deepEqual(Object.keys(health.areas).sort(), ['animations', 'benchmarks', 'characters', 'presets', 'reports']);
  assert.equal(health.areas.characters.dir, 'chars', 'modelos na pasta que o projeto já usa (chars/)');
  ok('serve o laboratório e o painel de relatórios com o recarregamento injetado; áreas reaproveitam as pastas existentes');
  const body = JSON.stringify({schema: 'arenamon-lab-preset', version: 1, preset: {name: 'x', values: {}}});
  let r = await fetch(`${base}/api/files/presets/${testFile}`, {method: 'PUT', body, headers: {origin: base}});assert.equal(r.status, 200);
  assert.equal(readFileSync(AREAS.presets.dir + '/' + testFile, 'utf8'), body);
  assert.ok((await (await fetch(base + '/api/files/presets')).json()).files.some(f => f.name === testFile));
  assert.equal(await (await fetch(`${base}/api/files/presets/${testFile}`)).text(), body);
  ok('grava, lista e lê um preset na área de presets');
  r = await fetch(`${base}/api/files/presets/${testFile}`, {method: 'PUT', body, headers: {origin: 'http://evil.example'}});assert.equal(r.status, 403);
  r = await fetch(`${base}/api/files/presets/${testFile}`, {method: 'PUT', body});assert.equal(r.status, 403, 'sem origem: recusado');
  r = await fetch(`${base}/api/files/presets/..%2F..%2Fpackage.json`, {method: 'PUT', body, headers: {origin: base}});assert.equal(r.status, 400);
  r = await fetch(`${base}/api/files/presets/x.exe`, {method: 'PUT', body, headers: {origin: base}});assert.equal(r.status, 400);
  r = await fetch(`${base}/api/files/sistema/x.json`);assert.equal(r.status, 404);
  for (const bad of ['../x.json', '/etc/x.json', 'a/b/c.glb', 'C:\\x.glb', 'x.txt']) assert.ok(safePath('characters', bad).error, bad);
  assert.ok(!safePath('characters', 'drowzee/modelo.glb').error, 'uma subpasta permitida em modelos');
  assert.ok(!existsSync(here + '../../package.json.bak'));
  ok('segurança: outra origem e pedido sem origem recusados; “..”, absolutos, subpastas demais e extensões fora da lista recusados');
  const events = [];const ctl = new AbortController();
  const sse = fetch(base + '/__dev/events', {signal: ctl.signal}).then(async res => {const rd = res.body.getReader();for (;;) {const {value, done} = await rd.read();if (done) break;events.push(new TextDecoder().decode(value));}}).catch(() => {});
  await new Promise(r => setTimeout(r, 150));const semOrigem = await fetch(base + '/__dev/rebuild', {method: 'POST'}), outraOrigem = await fetch(base + '/__dev/rebuild', {method: 'POST', headers: {origin: 'http://evil.example'}});assert.equal(semOrigem.status, 403);assert.equal(outraOrigem.status, 403);const rb = await (await fetch(base + '/__dev/rebuild', {method: 'POST', headers: {origin: base}})).json();assert.equal(rb.error, null);
  await new Promise(r => setTimeout(r, 200));ctl.abort();await sse;
  assert.ok(events.join('').includes(`data: ${rb.version}`), 'a página aberta recebe o aviso de recompilação');
  ok('recompila e avisa a página aberta (recarregamento ao modificar o código)');
} finally {
  rmSync(AREAS.presets.dir + '/' + testFile, {force: true});await srv.close();
}
console.log(`\n${n} verificações do servidor local aprovadas.`);
