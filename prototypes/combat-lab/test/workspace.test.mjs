// Workspace persistente (sem navegador): SHA-256, ZIP, armazenamento com fallback, deduplicação, integridade,
// migração do formato antigo, falha de gravação/cota e pacote portátil (exportar → importar → comparar).
import assert from 'node:assert/strict';
import {createHash, randomBytes} from 'node:crypto';
import {sha256, sha256Sync, crc32} from '../src/workspace/hash.js';
import {writeZip, readZip, zipText} from '../src/workspace/zip.js';
import {openStore, storeAsset, loadAsset} from '../src/workspace/store.js';
import {Workspace, migrateDoc, emptyDoc, buildPackage, readPackage, unresolvedRefs, installPackageAssets, LEGACY, WS_VERSION} from '../src/workspace/workspace.js';

let n = 0;const ok = (label) => {n++;console.log('✓', label);};
const mem = () => openStore({indexedDB: null, localStorage: null});
const fakeLS = (init = {}) => {const m = new Map(Object.entries(init));return {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() {return m.size;}, _m: m};};

// ---------- SHA-256 e CRC ----------
for (const data of [new Uint8Array(0), new TextEncoder().encode('abc'), randomBytes(1000), randomBytes(64), randomBytes(55), randomBytes(56), randomBytes(200003)]) {
  const ref = createHash('sha256').update(data).digest('hex');
  assert.equal(sha256Sync(data), ref);assert.equal(await sha256(data), ref);
}
ok('SHA-256 próprio idêntico ao do Node (inclusive bordas de bloco 55/56/64 bytes e 200 KB)');
assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);ok('CRC-32 com o vetor de referência');

// ---------- ZIP ----------
const big = randomBytes(300000), zip = writeZip([{path: 'manifest.json', data: '{"a":1}'}, {path: 'assets/ção.glb', data: big}, {path: 'vazio.txt', data: ''}]);
const files = await readZip(zip);
assert.equal(zipText(files.get('manifest.json')), '{"a":1}');assert.deepEqual(Buffer.from(files.get('assets/ção.glb')), Buffer.from(big));assert.equal(files.get('vazio.txt').length, 0);
ok('ZIP: escreve e lê (UTF-8 no nome, binário de 300 KB, arquivo vazio)');
const broken = zip.slice();broken[2000] ^= 0xff;
await assert.rejects(readZip(broken), /integridade|CRC|corrompido/);await assert.rejects(readZip(new Uint8Array([1, 2, 3])), /Não é um arquivo ZIP/);
ok('ZIP: byte alterado é detectado (CRC-32) e arquivo não-ZIP é recusado');
// ZIP com DEFLATE gerado pelo Node (zlib) — leitura via DecompressionStream.
const {deflateRawSync} = await import('node:zlib');
{
  const raw = new TextEncoder().encode('texto '.repeat(500)), comp = deflateRawSync(raw), name = new TextEncoder().encode('a.txt');
  const local = Buffer.alloc(30);local.writeUInt32LE(0x04034b50, 0);local.writeUInt16LE(20, 4);local.writeUInt16LE(8, 8);local.writeUInt32LE(crc32(raw), 14);local.writeUInt32LE(comp.length, 18);local.writeUInt32LE(raw.length, 22);local.writeUInt16LE(name.length, 26);
  const cd = Buffer.alloc(46);cd.writeUInt32LE(0x02014b50, 0);cd.writeUInt16LE(20, 4);cd.writeUInt16LE(20, 6);cd.writeUInt16LE(8, 10);cd.writeUInt32LE(crc32(raw), 16);cd.writeUInt32LE(comp.length, 20);cd.writeUInt32LE(raw.length, 24);cd.writeUInt16LE(name.length, 28);cd.writeUInt32LE(0, 42);
  const body = Buffer.concat([local, name, comp]), end = Buffer.alloc(22);end.writeUInt32LE(0x06054b50, 0);end.writeUInt16LE(1, 8);end.writeUInt16LE(1, 10);end.writeUInt32LE(46 + name.length, 12);end.writeUInt32LE(body.length, 16);
  const z = await readZip(Buffer.concat([body, cd, name, end]));assert.equal(zipText(z.get('a.txt')), 'texto '.repeat(500));
}
ok('ZIP: lê arquivos comprimidos com DEFLATE (pacotes recompactados por outro programa)');

// ---------- Armazenamento: fallback, deduplicação e integridade ----------
{
  const s = await mem();assert.equal(s.kind, 'memory');assert.equal(s.persistent, false);assert.match(s.reason, /Nada persiste/);
  const ls = fakeLS(), s2 = await openStore({indexedDB: null, localStorage: ls});assert.equal(s2.kind, 'localstorage');assert.equal(s2.binary, false);assert.match(s2.reason, /não persistem/);
  await s2.setKV('x', {a: 1});assert.deepEqual(await s2.getKV('x'), {a: 1});
  const throwing = {getItem: () => null, setItem: () => {throw Object.assign(new Error('cheio'), {name: 'QuotaExceededError'});}, removeItem() {}, key: () => null, length: 0};
  const s3 = await openStore({indexedDB: null, localStorage: throwing});assert.equal(s3.kind, 'memory', 'localStorage que recusa gravar não é usado');
  const brokenIdb = {open: () => {throw new Error('SecurityError: file:// sem permissão');}};
  const s4 = await openStore({indexedDB: brokenIdb, localStorage: ls});assert.equal(s4.kind, 'localstorage');assert.match(s4.reason, /IndexedDB indisponível \(SecurityError/);
  const hanging = {open: () => ({})};// nunca responde
  const t0 = Date.now(), s5 = await openStore({indexedDB: hanging, localStorage: null, timeout: 150});assert.equal(s5.kind, 'memory');assert.ok(Date.now() - t0 < 2000);assert.match(s5.reason, /sem resposta/);
}
ok('fallback testado por gravação real: IndexedDB → localStorage → memória (IndexedDB que lança, que trava e localStorage cheio)');
{
  const s = await mem(), bytes = randomBytes(5000);
  const a = await storeAsset(s, {name: 'modelo.glb', kind: 'model', bytes}), b = await storeAsset(s, {name: 'copia-renomeada.glb', kind: 'model', bytes: bytes.slice()});
  assert.equal(a.id, createHash('sha256').update(bytes).digest('hex'));assert.equal(a.duplicate, false);assert.equal(b.duplicate, true);assert.equal(b.id, a.id);
  assert.deepEqual((await s.getAssetMeta(a.id)).names, ['modelo.glb', 'copia-renomeada.glb']);assert.equal((await s.listAssets()).length, 1);
  const c = await storeAsset(s, {name: 'modelo.glb', kind: 'model', bytes: randomBytes(5000)});assert.notEqual(c.id, a.id, 'mesmo nome, conteúdo diferente = outro asset');
  const r = await loadAsset(s, a.id);assert.deepEqual(Buffer.from(r.bytes), Buffer.from(bytes));
  // Corrupção: bytes trocados no armazenamento.
  s.blobs.set(a.id, randomBytes(5000).buffer);const bad = await loadAsset(s, a.id);assert.equal(bad.error, 'corrupt');assert.match(bad.message, /corrompido/);
  assert.equal((await loadAsset(s, 'f'.repeat(64))).error, 'missing');
}
ok('assets: identidade pelo SHA-256 (não pelo nome), duplicatas detectadas, integridade verificada na leitura');
{
  // Falha de gravação: o asset não é dado como salvo e o erro chega ao chamador com mensagem de cota.
  const s = await mem();s.putAsset = async () => {throw Object.assign(new Error('The quota has been exceeded.'), {name: 'QuotaExceededError'});};
  const {putAsset} = s;
  await assert.rejects(storeAsset(s, {name: 'grande.glb', kind: 'model', bytes: randomBytes(100)}), e => e.name === 'QuotaExceededError' || /quota/i.test(e.message));
  assert.equal((await s.listAssets()).length, 0);void putAsset;
}
ok('cota esgotada: gravação recusada não deixa registro');

// ---------- Documento: autosave, falha, versões e migração ----------
{
  const s = await mem(), ws = await Workspace.open(s, {debounce: 5});assert.equal(ws.fresh, true);
  ws.set('tuning', {values: {'rules.recoil': .4}});assert.equal(ws.status.pending, true);
  await new Promise(r => setTimeout(r, 40));assert.equal(ws.status.state, 'memory');assert.equal((await s.getKV('workspace')).tuning.values['rules.recoil'], .4);
  // Falha na gravação: o estado vira “error”, nunca “saved”.
  s.setKV = async () => {throw Object.assign(new Error('Espaço de armazenamento do navegador esgotado'), {code: 'quota'});};
  ws.set('tuning', {values: {'rules.recoil': .5}});const r = await ws.saveNow();
  assert.equal(r.ok, false);assert.equal(ws.status.state, 'error');assert.match(ws.status.error, /esgotado/);
}
ok('autosave grava o documento; falha de gravação é reportada como erro (nunca como salvo)');
{
  const future = migrateDoc({schema: 'arenamon-lab-workspace', version: WS_VERSION + 1});assert.equal(future.error, 'future');assert.match(future.notes[0], /mais nova/);
  const partial = migrateDoc({schema: 'arenamon-lab-workspace', version: 1, slots: [{modelId: 'x'}]});assert.equal(partial.doc.slots[1].autoRestore, 1);assert.equal(partial.doc.slots[0].modelId, 'x');assert.deepEqual(partial.doc.calibrations, []);
}
ok('documento versionado: versão futura recusada sem perda; campos ausentes recebem padrões');
{
  const ls = fakeLS({[LEGACY.session]: JSON.stringify({'rules.recoil': .55}), [LEGACY.anim + 'drowzee.glb']: JSON.stringify({variants: {idle: ['Idle']}, speeds: {walk: 1.2}, clipOffsets: {}, visualOffset: .1, autoGround: true})});
  const s = await mem(), ws = await Workspace.open(s, {ls});
  assert.equal(ws.doc.tuning.values['rules.recoil'], .55);assert.ok(ws.migratedLegacy);assert.match(ws.notes[0], /formato antigo/);
  const st = ws.modelState('a'.repeat(64), 'drowzee.glb');assert.equal(st.migrated, true);assert.deepEqual(st.state.variants, {idle: ['Idle']});
  assert.equal(ws.doc.models['a'.repeat(64)].migratedFrom, 'drowzee.glb');assert.equal(ws.modelState('b'.repeat(64), 'outro.glb').state, null);
  assert.ok(ls._m.has(LEGACY.session), 'migração não apaga os dados antigos');
}
ok('migração do formato antigo: ajustes da sessão v7 e associações por nome de arquivo viram estado por SHA-256');

// ---------- Pacote: exportar → importar numa sessão limpa → comparar ----------
{
  const s = await mem(), ws = await Workspace.open(s, {debounce: 1});
  const model = randomBytes(20000), anim1 = randomBytes(3000), anim2 = randomBytes(4000);
  const m = await storeAsset(s, {name: 'drowzee.glb', kind: 'model', bytes: model}), a1 = await storeAsset(s, {name: 'socos.glb', kind: 'animation', bytes: anim1}), a2 = await storeAsset(s, {name: 'esquivas.glb', kind: 'animation', bytes: anim2});
  await storeAsset(s, {name: 'sobra.glb', kind: 'model', bytes: randomBytes(100)});
  ws.setSlot(0, {modelId: m.id, name: 'drowzee.glb', active: 1});ws.setSlot(1, {modelId: m.id, name: 'drowzee.glb', active: 1, autoRestore: 0});
  ws.setModelState(m.id, 'drowzee.glb', {variants: {idle: ['Idle'], tackle: ['Soco [socos.glb]', 'Soco2 [socos.glb]']}, speeds: {tackle: 1.3}, clipOffsets: {'Soco [socos.glb]': -.05}, visualOffset: .12, autoGround: false});
  ws.addImport(m.id, {id: a1.id, name: 'socos.glb'});ws.addImport(m.id, {id: a2.id, name: 'esquivas.glb'});assert.equal(ws.addImport(m.id, {id: a1.id, name: 'socos-copia.glb'}), false);
  ws.set('tuning', {values: {'rules.recoil': .42, 'actions.tackle.duration': .5}});ws.set('ui', {tool: 'tuning', overlays: {hurtboxes: true}});ws.set('match', {seed: '77', seedFixed: true});
  ws.addCalibration({label: 'base', values: {'rules.recoil': .3}});
  const pkgOut = await buildPackage(ws, {presets: [{name: 'Pesado', values: {'locomotion.acceleration': 12}}], homologation: {items: [{id: 'clash', status: 'fail', note: 'alto'}]}});
  assert.equal(pkgOut.manifest.assets.length, 3, 'só os arquivos referenciados (sem o que sobrou)');assert.equal(pkgOut.missing.length, 0);
  const all = await buildPackage(ws, {includeAll: true});assert.equal(all.manifest.assets.length, 4);

  const clean = await mem(), ws2 = await Workspace.open(clean, {debounce: 1}), pkg = await readPackage(pkgOut.bytes);
  assert.equal(pkg.error, undefined, pkg.error);assert.equal((await unresolvedRefs(pkg, clean)).length, 0);
  await installPackageAssets(pkg, clean);ws2.doc = structuredClone(pkg.doc);
  for (const id of [m.id, a1.id, a2.id]) {const r = await loadAsset(clean, id);assert.ok(!r.error, r.message);}
  assert.deepEqual(Buffer.from((await loadAsset(clean, m.id)).bytes), Buffer.from(model));
  const strip = d => {const c = structuredClone(d);delete c.savedAt;return c;};
  assert.deepEqual(strip(ws2.doc), strip(ws.doc), 'documento restaurado idêntico ao exportado');
  assert.deepEqual(pkg.presets, [{name: 'Pesado', values: {'locomotion.acceleration': 12}}]);assert.equal(pkg.homologation.items[0].note, 'alto');
  assert.deepEqual(ws2.doc.models[m.id].imports.map(i => i.name), ['socos.glb', 'esquivas.glb'], 'ordem das importações preservada');
  // Pacote com um arquivo adulterado: recusado inteiro, antes de qualquer mudança.
  const files = await readZip(pkgOut.bytes), tampered = [...files].map(([path, data]) => ({path, data: path.includes(a1.id) ? randomBytes(data.length) : data}));
  const bad = await readPackage(writeZip(tampered));assert.match(bad.error, /integridade/);
  // Referência quebrada: pacote sem o arquivo do modelo.
  const noModel = await readPackage(writeZip([...files].filter(([p]) => !p.includes(m.id)).map(([path, data]) => ({path, data}))));
  assert.ok(noModel.warnings.some(w => /ausente/.test(w)));assert.ok((await unresolvedRefs(noModel, await mem())).some(u => /modelo do slot azul/.test(u.why)));
  // Versão futura do pacote.
  const man = JSON.parse(zipText(files.get('manifest.json')));man.version = 99;
  const fut = await readPackage(writeZip([...files].map(([path, data]) => ({path, data: path === 'manifest.json' ? JSON.stringify(man) : data}))));assert.match(fut.error, /mais nova/);
  assert.match((await readPackage(writeZip([{path: 'x.txt', data: 'oi'}]))).error, /manifest\.json/);
}
ok('pacote ZIP: exporta, valida (integridade, referências, versão) e restaura numa sessão limpa com resultado idêntico');
console.log(`\n${n} verificações do workspace aprovadas.`);
