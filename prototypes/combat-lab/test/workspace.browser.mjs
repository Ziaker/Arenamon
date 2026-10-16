// Teste de navegador do workspace persistente (Edge real, file://, perfil persistente como o do usuário):
//   1. importar GLB, importar animações adicionais, associá-las aos estados, ajustar velocidades/offsets/ajustes/UI;
//   2. fechar o navegador e reabrir: tudo restaurado (modelo, clipes, associações, ajustes, offsets, preferências);
//   3. exportar o pacote completo e restaurá-lo num perfil limpo: mesmo resultado;
//   4. falhas: IndexedDB indisponível (fallback), cota esgotada, arquivo corrompido, exclusão só explícita;
//   5. migração do formato antigo (localStorage por nome de arquivo) e GLB real grande (se existir localmente).
// Uso: node prototypes/combat-lab/test/workspace.browser.mjs   (ARENAMON_GLB=caminho.glb para o teste com modelo grande)
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'validation/workspace/';mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const report = [];let failures = 0;
const check = (group, label, ok, detail = '') => {report.push({group, label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${group} · ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
// ARENAMON_BROWSER=msedge (padrão), chrome ou chromium (Chromium do Playwright).
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const profiles = [];const profile = () => {const d = mkdtempSync(join(tmpdir(), 'arenamon-ws-'));profiles.push(d);return d;};

// ---------- Fixtures: personagem do Studio (mapa de ações) + arquivo só de animações (outros nomes, mesmo esqueleto) ----------
const fixtureGlb = root + 'validation/personagem-studio.glb';
async function ensureFixture() {
  if (existsSync(fixtureGlb)) return;
  const studioHtml = fileURLToPath(new URL('../../studio/dist/arenamon-animation-studio.html', import.meta.url)), src = readFileSync(new URL('../../studio/test/fixture.js', import.meta.url), 'utf8');
  const b = await chromium.launch({...BROWSER, headless: true}), p = await b.newPage();
  await p.goto(pathToFileURL(studioHtml).href);await p.waitForFunction(() => window.__studioEditor && window.__importer);
  const b64 = await p.evaluate(async src => {
    const {syntheticRig} = await import('data:text/javascript,' + encodeURIComponent(src));const E = window.__importer, r = syntheticRig(E.T);
    r.clips[0].name = 'idle';r.clips[1].name = 'run';r.clips[2].name = 'tackle';await E.install(r.root, r.clips, 'personagem-teste.glb');
    const set = (id, i) => {const s = document.getElementById('action-' + id);s.value = String(i);s.dispatchEvent(new Event('change', {bubbles: true}));};
    set('idle', 0);set('run', 1);set('walk', 1);set('tackle', 2);
    const bytes = new Uint8Array(await E.exportGLB({unlit: false, noTextures: true}));let s = '';for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));return btoa(s);
  }, src);
  writeFileSync(fixtureGlb, Buffer.from(b64, 'base64'));await b.close();
}
/** Copia um GLB trocando os nomes das animações (arquivo diferente, mesmo esqueleto). */
function renameAnimations(buf, rename) {
  const len = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8')), rest = buf.subarray(20 + len);
  json.animations.forEach((a, i) => {a.name = rename(a.name, i);});
  let text = Buffer.from(JSON.stringify(json), 'utf8');const pad = (4 - text.length % 4) % 4;text = Buffer.concat([text, Buffer.alloc(pad, 0x20)]);
  const head = Buffer.alloc(20);head.writeUInt32LE(0x46546c67, 0);head.writeUInt32LE(2, 4);head.writeUInt32LE(20 + text.length + rest.length, 8);head.writeUInt32LE(text.length, 12);head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, text, rest]);
}

async function open(dir, {init = null} = {}) {
  const ctx = await chromium.launchPersistentContext(dir, {...BROWSER, headless: true, viewport: {width: 1500, height: 920}, acceptDownloads: true});
  if (init) await ctx.addInitScript(init);
  const page = ctx.pages()[0] ?? await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('dialog', d => (page.__accept ? d.accept() : d.dismiss()));
  await ctx.setOffline(true);await page.goto(labUrl);await page.waitForFunction(() => window.__lab, null, {timeout: 30000});
  const L = (fn, arg) => page.evaluate(fn, arg);
  const tab = t => L(t => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== t) document.querySelector(`[data-tool="${t}"]`).click();}, t);
  return {ctx, page, L, tab, errors};
}
const settle = L => L(async () => {await window.__lab.ws.saveNow();return window.__lab.ws.status;});
/** Fotografia comparável do workspace: personagens (clipes, associações, velocidades, offsets), ajustes e preferências. */
const snapshot = L => L(() => {
  const lab = window.__lab, ch = lab.ui.characters, ui = lab.ws.doc;
  return {characters: ch.map(c => c && {name: c.source.name, assetId: c.source.assetId, clips: c.clips.map(x => x.name), state: c.stateData()}),
    tuning: Object.fromEntries(['rules.recoil', 'actions.tackle.duration', 'locomotion.acceleration', 'vfx.hit.variant'].map(p => [p, p.split('.').reduce((o, k) => o[k], lab.C)])),
    ui: {tool: document.getElementById('panel').dataset.tool, open: !document.getElementById('panel').hidden, hurtboxes: lab.view.overlays.hurtboxes, timeScale: document.getElementById('rp-speed').value, seed: document.getElementById('seed').value, seedFixed: document.getElementById('seed-fixed').checked, fade: document.getElementById('char-fade').value},
    calibrations: ui.calibrations.map(c => c.label), slots: ui.slots.map(s => ({modelId: s.modelId, autoRestore: s.autoRestore, active: s.active}))};
});

let browserInfo = '';
try {
  await ensureFixture();
  const animGlb = out + 'animacoes-extra.glb';writeFileSync(animGlb, renameAnimations(readFileSync(fixtureGlb), n => ({idle: 'guarda', run: 'freio', tackle: 'golpe'})[n] ?? n + '2'));

  // ================= 1. Sessão de trabalho =================
  const dirA = profile();let s = await open(dirA);
  browserInfo = await s.page.evaluate(() => navigator.userAgent);
  check('Armazenamento', 'IndexedDB funciona em file:// no Edge (gravação testada)', await s.L(() => window.__lab.store.kind) === 'indexeddb', await s.L(() => window.__lab.store.kind));
  await s.tab('characters');
  await s.page.locator('.char-slot').nth(0).locator('input[data-model]').setInputFiles(fixtureGlb);
  await s.page.waitForFunction(() => window.__lab.ui.characters[0]?.source.assetId);
  await s.page.waitForFunction(() => /salvo neste navegador/.test(document.querySelector('.ws-slot-msg')?.textContent || ''));
  check('Modelo', 'GLB salvo e identificado pelo SHA-256', /SHA-256/.test(await s.page.textContent('.char-slot .ws-slot-msg')));
  await s.page.locator('.char-slot').nth(0).locator('[data-import]').setInputFiles(animGlb);await s.page.waitForFunction(() => window.__lab.ui.lastImport);
  const imported = await s.L(() => window.__lab.ui.characters[0].clips.map(c => c.name).filter(n => n.includes('[animacoes-extra.glb]')));
  check('Animações', 'clipes do arquivo extra importados para a biblioteca', imported.length === 3, imported.join(', '));
  check('Animações', 'importação salva no workspace (vinculada ao modelo)', await s.L(() => {const id = window.__lab.ui.characters[0].source.assetId;return window.__lab.ws.doc.models[id].imports.length;}) === 1);
  // Mesmo arquivo de novo: nada duplicado.
  await s.L(() => {window.__lab.ui.lastImport = null;});await s.page.locator('.char-slot').nth(0).locator('[data-import]').setInputFiles(animGlb);
  await s.page.waitForFunction(() => /já foi importado/.test(document.querySelector('[data-import-result]')?.textContent || ''));
  check('Animações', 'reimportar o mesmo conteúdo não duplica clipes', (await s.L(() => window.__lab.ui.characters[0].clips.length)) === 6);
  // Associações pelos menus da interface: tackle → golpe importado; walk → freio importado + variante.
  const pick = async (action, text) => {const sel = s.page.locator(`.char-slot >> nth=0 >> .state-row[data-action="${action}"] select[data-primary]`);const v = await sel.evaluate((el, t) => [...el.options].find(o => o.textContent.includes(t)).value, text);await sel.selectOption(v);};
  await pick('tackle', 'golpe [animacoes-extra.glb]');await pick('walk', 'freio [animacoes-extra.glb]');
  await s.L(() => {const c = window.__lab.ui.characters[0];c.addVariant('walk', c.clips.findIndex(x => x.name === 'run'));c.speeds.tackle = 1.35;c.clipOffsets[c.clips.findIndex(x => x.name.startsWith('golpe'))] = -.07;c.save();});
  const off = s.page.locator('.char-slot >> nth=0 >> input[data-offset]');await off.fill('0.18');await off.dispatchEvent('change');
  await s.page.locator('.char-slot').nth(1).getByRole('button', {name: 'Usar o do azul'}).click();await s.page.waitForFunction(() => window.__lab.ui.characters[1]?.clips.length === 6);
  check('Modelo', 'vermelho com o mesmo modelo recebe as animações importadas', true);
  // Ajustes, preferências e partida.
  await s.L(() => window.__lab.tuning.commit([['rules.recoil', .42], ['actions.tackle.duration', .47], ['locomotion.acceleration', 31], ['vfx.hit.variant', 2]], 'teste workspace'));
  await s.tab('overlays');await s.page.locator('[data-overlay="hurtboxes"]').check();await s.page.selectOption('#rp-speed', '0.5');
  await s.tab('match');await s.page.fill('#seed', '4321');await s.page.locator('#seed').dispatchEvent('change');
  await s.tab('characters');await s.page.locator('#char-fade').fill('0.31');await s.page.locator('#char-fade').dispatchEvent('input');
  await s.tab('tuning');await s.page.fill('#calib-name', 'Antes do teste A×B');await s.page.click('#calib-save');
  await s.page.waitForTimeout(700);const st = await settle(s.L);
  check('Workspace', 'gravação confirmada pela transação (estado “saved”)', st.state === 'saved', JSON.stringify(st));
  check('Workspace', 'indicador na barra superior', /Workspace salvo/.test(await s.page.textContent('#ws-chip')));
  const before = await snapshot(s.L);
  await s.page.screenshot({path: out + '1-sessao.png'});
  await s.ctx.close();

  // ================= 2. Fechar e reabrir =================
  s = await open(dirA);
  const after = await snapshot(s.L);
  check('Reabrir', 'modelo azul e vermelho restaurados automaticamente', after.characters[0]?.assetId === before.characters[0].assetId && after.characters[1]?.assetId === before.characters[0].assetId);
  check('Reabrir', 'clipes importados presentes, na mesma ordem', JSON.stringify(after.characters[0]?.clips) === JSON.stringify(before.characters[0].clips), after.characters[0]?.clips.length);
  check('Reabrir', 'associações, variantes, velocidades e offsets idênticos', JSON.stringify(after.characters[0]?.state) === JSON.stringify(before.characters[0].state), JSON.stringify(after.characters[0]?.state.variants.tackle));
  check('Reabrir', 'ajustes físicos/combate/VFX restaurados', JSON.stringify(after.tuning) === JSON.stringify(before.tuning), JSON.stringify(after.tuning));
  check('Reabrir', 'preferências (aba, sobreposições, câmera lenta, semente, transição) restauradas', JSON.stringify(after.ui) === JSON.stringify(before.ui), JSON.stringify(after.ui));
  check('Reabrir', 'histórico de calibrações preservado', after.calibrations.includes('Antes do teste A×B'));
  check('Reabrir', 'aviso de sessão restaurada com desfazer', await s.page.locator('#session-banner #session-undo').count() === 1);
  check('Reabrir', 'sem erros no console', s.errors.length === 0, s.errors.join(' | '));
  await s.page.screenshot({path: out + '2-reaberto.png'});
  // Reabrir último modelo após remover; restauração automática desligada para o vermelho.
  await s.tab('characters');await s.page.locator('.char-slot').nth(1).getByRole('button', {name: 'Remover'}).click();
  check('Último modelo', 'botão “Reabrir último modelo utilizado” aparece após remover', await s.page.locator('.char-slot >> nth=1 >> [data-reopen]').count() === 1);
  await s.page.locator('.char-slot >> nth=1 >> [data-reopen]').click();await s.page.waitForFunction(() => window.__lab.ui.characters[1]?.clips.length === 6);
  check('Último modelo', 'reabre do armazenamento com as animações', true);
  await s.page.locator('.char-slot >> nth=1 >> [data-autorestore]').uncheck();await settle(s.L);await s.ctx.close();
  s = await open(dirA);
  check('Último modelo', 'restauração automática independente por slot (azul sim, vermelho não)', await s.L(() => !!window.__lab.ui.characters[0] && !window.__lab.ui.characters[1]));
  // Abre a aba só se ainda não estiver aberta (o seletor sem `button` também casava o painel aberto e clicar na aba aberta a recolhe; reprovava de forma intermitente).
  await s.page.evaluate(() => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== 'characters') document.querySelector('button[data-tool="characters"]').click();});
  check('Último modelo', 'vermelho oferece reabrir o último modelo', await s.page.locator('.char-slot >> nth=1 >> [data-reopen]').count() === 1);
  await s.page.locator('.char-slot >> nth=1 >> [data-autorestore]').check();await s.page.locator('.char-slot >> nth=1 >> [data-reopen]').click();await s.page.waitForFunction(() => window.__lab.ui.characters[1]);

  // ================= 3. Backup completo → perfil limpo =================
  await s.tab('export');const dl = s.page.waitForEvent('download');await s.page.click('#ws-export');const zipPath = out + 'workspace-backup.zip';await (await dl).saveAs(zipPath);
  check('Backup', 'ZIP exportado', existsSync(zipPath), `${(readFileSync(zipPath).length / 1024).toFixed(0)} KB`);
  const snapA = await snapshot(s.L);await s.ctx.close();
  const dirB = profile();s = await open(dirB);
  check('Backup', 'perfil limpo começa sem modelos', await s.L(() => !window.__lab.ui.characters[0]));
  await s.tab('export');await s.page.setInputFiles('#ws-import-file', zipPath);await s.page.waitForSelector('#ws-import-apply');
  const prev = await s.page.textContent('#ws-import-result');
  check('Backup', 'prévia antes de aplicar (nada muda sem confirmação)', /Ajustes/.test(prev) && await s.L(() => window.__lab.C.rules.recoil) === .3, prev.slice(0, 120).replace(/\s+/g, ' '));
  check('Backup', 'referências validadas na prévia', /Todas as referências/.test(prev));
  await s.page.click('#ws-import-apply');await s.page.waitForFunction(() => /Workspace importado/.test(document.getElementById('ws-import-result').textContent), null, {timeout: 20000});
  await s.page.waitForFunction(() => window.__lab.ui.characters[0] && window.__lab.ui.characters[1]);
  const snapB = await snapshot(s.L);
  check('Backup', 'modelos, clipes e associações idênticos após restaurar em sessão limpa', JSON.stringify(snapB.characters) === JSON.stringify(snapA.characters));
  check('Backup', 'ajustes e preferências idênticos', JSON.stringify(snapB.tuning) === JSON.stringify(snapA.tuning) && JSON.stringify({...snapB.ui, tool: 0, open: 0}) === JSON.stringify({...snapA.ui, tool: 0, open: 0}), JSON.stringify(snapB.ui));
  check('Backup', 'calibrações importadas + ponto automático “Antes da importação”', snapB.calibrations.includes('Antes do teste A×B') && snapB.calibrations.some(c => /Antes da importação/.test(c)));
  await settle(s.L);await s.ctx.close();
  s = await open(dirB);
  check('Backup', 'workspace importado sobrevive ao reabrir', JSON.stringify((await snapshot(s.L)).characters) === JSON.stringify(snapA.characters));
  // Pacote adulterado é recusado sem alterar nada.
  const zip = readFileSync(zipPath);const bad = Buffer.from(zip);bad[Math.floor(bad.length / 2)] ^= 0xff;writeFileSync(out + 'workspace-adulterado.zip', bad);
  await s.tab('export');await s.page.setInputFiles('#ws-import-file', out + 'workspace-adulterado.zip');await s.page.waitForFunction(() => /recusado/.test(document.getElementById('ws-import-result').textContent));
  check('Backup', 'pacote adulterado recusado com explicação', /integridade|CRC|corrompido/i.test(await s.page.textContent('#ws-import-result')));
  await s.ctx.close();

  // ================= 4. Integridade, exclusão explícita =================
  s = await open(dirA);
  const modelId = await s.L(() => window.__lab.ui.characters[0].source.assetId);
  await s.L(async id => {const db = await new Promise((ok, fail) => {const r = indexedDB.open('arenamon-lab-workspace');r.onsuccess = () => ok(r.result);r.onerror = () => fail(r.error);});await new Promise((ok, fail) => {const t = db.transaction('blobs', 'readwrite');t.objectStore('blobs').put(new Uint8Array(20932).fill(7).buffer, id);t.oncomplete = ok;t.onerror = () => fail(t.error);});db.close();}, modelId);
  await s.ctx.close();s = await open(dirA);
  await s.tab('characters');
  check('Integridade', 'GLB corrompido no armazenamento não é carregado', await s.L(() => !window.__lab.ui.characters[0]));
  const msg = await s.page.textContent('.char-slot .ws-slot-msg');
  check('Integridade', 'motivo claro e convite para selecionar de novo', /corrompido/.test(msg) && /Selecione o arquivo de novo/.test(msg), msg);
  await s.page.locator('.char-slot').nth(0).locator('input[data-model]').setInputFiles(fixtureGlb);await s.page.waitForFunction(() => /regravada/.test(document.querySelector('.ws-slot-msg')?.textContent || ''));
  check('Integridade', 'selecionar de novo regrava a cópia danificada e recupera animações e associações', await s.L(() => window.__lab.ui.characters[0].clips.length) === 6 && (await s.L(() => window.__lab.ws.doc.models[window.__lab.ui.characters[0].source.assetId].state.variants.tackle?.[0])) === 'golpe [animacoes-extra.glb]');
  await s.page.waitForFunction(() => document.querySelectorAll('#ws-storage tr[data-asset]').length >= 2);
  const count = () => s.L(() => window.__lab.store.listAssets().then(l => l.length));const n0 = await count();
  s.page.__accept = false;await s.page.locator('#ws-storage tr[data-asset] [data-del]').first().click();await s.page.waitForTimeout(200);
  check('Exclusão', 'cancelar a confirmação não exclui nada', await count() === n0);
  await s.ctx.close();

  // ================= 5. Falhas de armazenamento =================
  s = await open(profile(), {init: () => {Object.defineProperty(window, 'indexedDB', {get: () => ({open: () => {throw new DOMException('acesso negado em file://', 'SecurityError');}})});}});
  check('Fallback', 'sem IndexedDB: cai para localStorage e explica', await s.L(() => window.__lab.store.kind) === 'localstorage' && /IndexedDB indisponível/.test(await s.L(() => window.__lab.store.reason)));
  await s.tab('characters');await s.page.locator('.char-slot').nth(0).locator('input[data-model]').setInputFiles(fixtureGlb);await s.page.waitForFunction(() => window.__lab.ui.characters[0]);
  check('Fallback', 'modelo funciona e o aviso diz que vale só nesta aba', /só nesta aba/.test(await s.page.textContent('.char-slot .ws-slot-msg')));
  await s.ctx.close();
  s = await open(profile(), {init: () => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {if (this.name === 'blobs') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');return put.call(this, value, key);};
  }});
  await s.tab('characters');await s.page.locator('.char-slot').nth(0).locator('input[data-model]').setInputFiles(fixtureGlb);await s.page.waitForFunction(() => window.__lab.ui.characters[0]);
  const qmsg = await s.page.textContent('.char-slot .ws-slot-msg');
  check('Cota', 'cota esgotada: modelo usável, mas avisa que NÃO foi salvo', /NÃO salvo/.test(qmsg) && /esgotado/.test(qmsg), qmsg);
  check('Cota', 'nenhum arquivo registrado como salvo', await s.L(() => window.__lab.store.listAssets().then(l => l.length)) === 0);
  await s.ctx.close();
  s = await open(profile(), {init: () => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {if (this.name === 'kv' && key === 'workspace') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');return put.call(this, value, key);};
  }});
  await s.L(() => window.__lab.tuning.commit([['rules.recoil', .5]], 'x'));const fst = await settle(s.L);
  check('Cota', 'documento não gravado: estado “error”, indicador vermelho, sem “salvo”', fst.state === 'error' && await s.page.getAttribute('#ws-chip', 'data-state') === 'error', fst.error);
  await s.ctx.close();

  // ================= 6. Migração do formato antigo =================
  s = await open(profile(), {init: () => {if (!sessionStorage.getItem('seeded')) {sessionStorage.setItem('seeded', '1');localStorage.setItem('arenamon-lab-session-v7', JSON.stringify({'rules.recoil': .37, 'rules.dodge': .5}));localStorage.setItem('arenamon-lab-anim-v1:personagem-studio.glb', JSON.stringify({variants: {walk: ['tackle']}, speeds: {walk: 1.7}, clipOffsets: {}, visualOffset: .05, autoGround: true}));}}});
  check('Migração', 'ajustes da sessão v7 (incluindo campo v6) migrados e restaurados', await s.L(() => [window.__lab.C.rules.recoil, window.__lab.C.actions.dodge.duration]).then(v => v[0] === .37 && v[1] === .5));
  check('Migração', 'nota de migração visível', /formato antigo/.test(await s.L(() => window.__lab.ui.workspaceNotes.join(' '))));
  await s.tab('characters');await s.page.locator('.char-slot').nth(0).locator('input[data-model]').setInputFiles(fixtureGlb);await s.page.waitForFunction(() => window.__lab.ui.characters[0]);
  const mig = await s.L(() => {const c = window.__lab.ui.characters[0];return {walk: c.variantsOf('walk').map(i => c.clips[i].name), speed: c.speeds.walk, from: window.__lab.ws.doc.models[c.source.assetId].migratedFrom};});
  check('Migração', 'associações gravadas por nome de arquivo adotadas pelo SHA-256 do modelo', mig.walk[0] === 'tackle' && mig.speed === 1.7 && mig.from === 'personagem-studio.glb', JSON.stringify(mig));
  await s.ctx.close();

  // ================= 7. GLB real grande (local, não versionado) =================
  const big = process.env.ARENAMON_GLB || homedir() + '/Downloads/drowzee/arenamon-prototipo.glb';
  if (existsSync(big)) {
    const dirC = profile();s = await open(dirC);await s.tab('characters');
    const t0 = Date.now();await s.page.locator('.char-slot').nth(0).locator('input[data-model]').setInputFiles(big);await s.page.waitForFunction(() => /salvo neste navegador|já armazenado/.test(document.querySelector('.ws-slot-msg')?.textContent || ''), null, {timeout: 60000});
    const tLoad = Date.now() - t0, clips = await s.L(() => window.__lab.ui.characters[0].clips.length);await settle(s.L);await s.ctx.close();
    const t1 = Date.now();s = await open(dirC);const tRestore = Date.now() - t1;
    check('GLB real', 'modelo grande salvo e restaurado ao reabrir', await s.L(() => window.__lab.ui.characters[0]?.clips.length) === clips, `${(readFileSync(big).length / 1048576).toFixed(1)} MB, ${clips} clipes, carregar+salvar ${tLoad} ms, reabrir até pronto ${tRestore} ms`);
    const usage = await s.L(() => window.__lab.store.listAssets().then(l => l.reduce((n, a) => n + a.size, 0)));
    check('GLB real', 'espaço ocupado informado', usage === readFileSync(big).length, `${usage} bytes`);
    await s.ctx.close();
  } else check('GLB real', 'modelo grande ausente neste computador (teste pulado)', true, big);
} finally {
  writeFileSync(out + 'report.json', JSON.stringify({browser: browserInfo, date: new Date().toISOString(), failures, report}, null, 1));
  for (const d of profiles) try {rmSync(d, {recursive: true, force: true});} catch {/* perfil ainda em uso */}
}
console.log(`\n${report.length - failures} de ${report.length} verificações aprovadas · ${browserInfo}`);
if (failures) process.exit(1);
