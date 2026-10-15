// Rigging guiado (Proposta B) no Studio real (Edge, offline), fluxo completo pelos controles da interface:
// importar modelo (arquivo GLB pelo campo de importação) → Auto-Rig → ajustar articulações → simetria → skinning →
// animações → exportar GLB → reimportar e conferir. Também: quadrúpede, criatura assimétrica, rig existente
// preservado e Modo avançado. Personagens sintéticos (sem recursos proprietários).
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
const root = fileURLToPath(new URL('../', import.meta.url)), out = root + 'validation/', tmp = out + 'guided-tmp/';
await mkdir(tmp, {recursive: true});
let count = 0, t0 = Date.now();const mark = s => {count++;console.log(`✓ ${s} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);t0 = Date.now();};
const browser = await chromium.launch({channel: 'msedge', headless: true, args: ['--use-angle=swiftshader']});
const errors = [], requests = [];
const BOXES = {
  humanoide: [['Tronco', .9, 1, .5, 0, 1.45, 0], ['Cabeca', .45, .45, .45, 0, 2.2, 0], ['BracoE', .9, .22, .22, .9, 1.8, 0], ['BracoD', .9, .22, .22, -.9, 1.8, 0], ['PernaE', .28, .95, .28, .22, .5, 0], ['PernaD', .28, .95, .28, -.22, .5, 0]],
  quadrupede: [['Tronco', .6, .5, 1.6, 0, 1.0, 0], ['Cabeca', .4, .4, .5, 0, 1.35, 1.0], ['PataDF', .18, .8, .18, .2, .4, .6], ['PataEF', .18, .8, .18, -.2, .4, .6], ['PataDT', .18, .8, .18, .2, .4, -.6], ['PataET', .18, .8, .18, -.2, .4, -.6], ['Cauda', .1, .1, .6, 0, 1.1, -1.1]],
  // Criatura assimétrica: garra enorme só de um lado.
  assimetrica: [['Tronco', .9, 1, .5, 0, 1.45, 0], ['Cabeca', .45, .45, .45, 0, 2.2, 0], ['BracoE', .9, .22, .22, .9, 1.8, 0], ['GarraD', 1.6, .7, .7, -1.3, 1.6, 0], ['PernaE', .28, .95, .28, .22, .5, 0], ['PernaD', .28, .95, .28, -.22, .5, 0]],
};
try {
  const context = await browser.newContext({viewport: {width: 1600, height: 960}, acceptDownloads: true});
  const page = await context.newPage();
  page.on('dialog', d => d.accept());page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});page.on('request', r => {if (/^https?:/i.test(r.url())) requests.push(r.url());});
  await context.setOffline(true);
  const open = async () => {await page.goto(pathToFileURL(root + 'dist/arenamon-animation-studio.html').href);await page.waitForFunction(() => window.__studioGuided && window.__studioLibrary, null, {timeout: 60000});};
  const W = (fn, arg) => page.evaluate(fn, arg), G = () => W(() => window.__studioGuided.state), st = () => W(() => window.__studioWorkbench.engine.state());
  const tel = () => W(() => window.__studioWorkbench.engine.telemetry());
  const label = () => W(() => window.__studioEditor.history.state().undoLabel);
  /** Gera um GLB sintético com o exportador do próprio Studio (modelo de entrada para o fluxo de importação real). */
  async function makeGLB(kind) {
    await open();
    const bytes = await W(async boxes => {const E = window.__importer, T = E.T, g = new T.Group();g.name = 'Sintetico';
      for (const [n, w, h, d, x, y, z] of boxes) {const m = new T.Mesh(new T.BoxGeometry(w, h, d, 4, 6, 4), new T.MeshStandardMaterial({color: 0x8fb3e8}));m.name = n;m.position.set(x, y, z);g.add(m);}
      await E.install(g, [], 'sintetico.glb');return [...new Uint8Array(await E.exportGLB({unlit: false, noTextures: false}))];}, BOXES[kind]);
    const file = tmp + kind + '.glb';await writeFile(file, Buffer.from(bytes));return file;
  }
  const importFile = async file => {await open();await page.setInputFiles('#model', file);await page.waitForFunction(() => window.__importer.model, null, {timeout: 30000});await W(() => window.__studioLayout.open('rigging'));await page.waitForFunction(() => window.__studioRig.active && !/Importe um personagem/.test(document.getElementById('gr-root').textContent));};

  // ================= Humanoide: fluxo completo =================
  const humanFile = await makeGLB('humanoide');
  await importFile(humanFile);
  assert.equal((await G()).mode, 'guided', 'Assistente é o padrão');assert.equal(await page.isVisible('#gr-advanced'), false);
  assert.match(await page.textContent('#gr-root'), /Bípede|bípede/);assert.equal(await page.isChecked('[name=gr-profile][value="humanoid-20"]'), true, 'perfil sugerido pela análise');
  await page.click('#gr-autorig');await page.waitForFunction(() => window.__studioWorkbench.engine.state() === 'proposta');
  assert.equal((await tel()).summary.bones, 20);assert.match(await label(), /Auto-rig: Humanoide/);
  await page.screenshot({path: out + 'guiado-1-anatomia.png'});
  mark('Importar GLB pelo campo real → etapa 1 sugere humanoide e gera o Auto-Rig com um clique (20 ossos, sem pedir ajuste manual)');

  await page.click('#gr-next');let g = await G();assert.equal(g.step, 2);
  assert.ok(g.problems.length >= 1 && g.problems.every(p => p.reasons.length), 'problemas da telemetria listados primeiro: ' + JSON.stringify(g.problems.map(p => p.name)));
  const allCount = await page.locator('#gr-all .gr-item').count();assert.ok(allCount >= 18, 'demais ossos acessíveis numa lista opcional');
  assert.equal(await page.isChecked('#gr-reviewed'), false);
  await page.click('.gr-list .gr-item >> nth=0');g = await G();assert.equal(g.selected, g.problems[0].id);
  assert.equal(await W(() => !!window.__studioGuided.gizmo.object), true, 'gizmo no osso selecionado');
  if (await page.$('#gr-inside-all')) {await page.click('#gr-inside-all');await page.waitForFunction(() => !window.__studioGuided.state.problems.some(p => /fora da malha/.test(p.reasons.join())));}
  mark('Etapa 2: ossos problemáticos da telemetria primeiro; os demais ficam opcionais; correção em lote “trazer para dentro da malha”');
  // Ajuste por coordenada, desfazer e travar.
  const ids = Object.fromEntries((await tel()).joints.map(j => [j.name, j.id]));
  await page.click(`[data-joint="${ids.RightElbow}"]`, {force: true}).catch(() => W(id => window.__studioGuided.select(id), ids.RightElbow));
  await W(id => window.__studioGuided.select(id), ids.RightElbow);
  const elbow0 = (await tel()).joints.find(j => j.name === 'RightElbow').p;
  await page.fill('[data-axis="1"]', String(elbow0[1] + .15));await page.press('[data-axis="1"]', 'Enter');
  await page.waitForFunction(y => Math.abs(window.__studioWorkbench.engine.telemetry().joints.find(j => j.name === 'RightElbow').p[1] - y) < 1e-6, elbow0[1] + .15);
  assert.match(await label(), /Coordenada de RightElbow/);
  // Arrastar pelo gizmo: o proxy é movido como o TransformControls faria e o fim do arraste confirma.
  await W(id => window.__studioGuided.select(id), ids.LeftWrist);
  const wrist0 = (await tel()).joints.find(j => j.name === 'LeftWrist').p;
  await W(() => {const g = window.__studioGuided;g.proxy.position.x += .05;g.commitDrag();});
  assert.ok(Math.abs((await tel()).joints.find(j => j.name === 'LeftWrist').p[0] - (wrist0[0] + .05)) < 1e-6, 'arraste aplicado');
  await W(() => window.__studioEditor.history.undo());assert.deepEqual((await tel()).joints.find(j => j.name === 'LeftWrist').p, wrist0, 'Ctrl+Z desfaz o arraste');
  await page.click('#gr-lock');assert.equal(await page.isDisabled('[data-axis="0"]'), true, 'osso travado não aceita edição');
  await page.screenshot({path: out + 'guiado-2-articulacoes.png'});
  await page.check('#gr-reviewed');
  mark('Ajuste por coordenada e por arraste do gizmo pelo motor oficial; Undo exato; travar bloqueia a edição');

  await page.click('#gr-next');g = await G();assert.equal(g.step, 3);
  assert.match(await page.textContent('#gr-root'), /bilateral/);
  const pairs = await page.locator('[data-mirror]').count();assert.ok(pairs >= 2, 'o cotovelo desalinhado aparece como par assimétrico');
  await page.click(`[data-mirror="${ids.LeftElbow}|${ids.RightElbow}"]`);
  let pair = (await tel()).symmetry.pairs.find(p => p.leftName === 'LeftElbow');assert.ok(pair.asymmetryDelta < 1e-4, 'Esq → Dir corrige o par');
  // Trava respeitada: o punho esquerdo (travado) não é movido pelo “Corrigir todos (Dir → Esq)”.
  // Dois pares desalinhados (punho e joelho); o punho esquerdo está travado.
  await W(([w, k]) => window.__studioWorkbench.engine.apply({schema: 'arenamon-rig-patch', version: 1, operations: [{op: 'moveBone', jointId: w, delta: [-.04, 0, 0], space: 'model-root'}, {op: 'moveBone', jointId: k, delta: [0, .05, 0], space: 'model-root'}]}), [ids.RightWrist, ids.RightKnee]);
  await W(() => window.__studioGuided.refresh());
  assert.equal(await page.isDisabled(`[data-mirror="${ids.RightWrist}|${ids.LeftWrist}"]`), true, 'Dir → Esq bloqueado no par cujo destino está travado');
  assert.equal(await page.isDisabled(`[data-mirror="${ids.LeftWrist}|${ids.RightWrist}"]`), false);
  const lockedWrist = (await tel()).joints.find(j => j.name === 'LeftWrist').p;
  await page.click('#gr-sym-all-rl');
  assert.deepEqual((await tel()).joints.find(j => j.name === 'LeftWrist').p, lockedWrist, 'ponto travado não é espelhado em lote');
  assert.ok((await tel()).symmetry.pairs.find(p => p.leftName === 'LeftKnee').asymmetryDelta < 1e-4, 'o par livre foi corrigido no mesmo lote');
  assert.match(await page.textContent('#gr-root'), /Travados e mantidos: LeftWrist/);
  await page.screenshot({path: out + 'guiado-3-simetria.png'});
  mark('Etapa 3: malha bilateral permite correção em conjunto; Esq → Dir corrige o par; pontos travados nunca são espelhados');

  await page.click('#gr-next');assert.equal((await G()).step, 4);
  const plain = await W(() => {let s = 0;window.__importer.model.traverse(o => {if (o.isSkinnedMesh) s++;});return s;});assert.equal(plain, 0);
  for (const algo of ['segment-proximity', 'capsule-falloff']) {
    await page.check(`[name=gr-weights][value="${algo}"]`);if (!(await G()).preview) await page.click('#gr-preview');
    await page.waitForFunction(a => window.__studioGuided.state.preview?.weights === a, algo);
    const pv = (await G()).preview;assert.equal(pv.zero, 0, algo + ': prévia sem vértices sem peso');
    assert.equal(await W(() => {let s = 0;window.__importer.model.traverse(o => {if (o.isSkinnedMesh) s++;});return s;}), 0, 'a prévia não altera o modelo');
  }
  await page.waitForTimeout(400);await page.screenshot({path: out + 'guiado-4-previa.png'});
  await page.click('#gr-preview');assert.equal((await G()).preview, null);
  await page.click('#gr-bind');await page.waitForFunction(() => window.__studioWorkbench.engine.state() === 'vinculado');
  assert.match(await label(), /capsule-falloff/);assert.equal((await tel()).summary.verticesWithoutInfluence, 0);
  await W(() => window.__studioEditor.history.undo());assert.equal(await st(), 'proposta', 'Undo do skin devolve a proposta');
  await W(() => window.__studioEditor.history.redo());assert.equal(await st(), 'vinculado', 'Redo refaz o skin');
  mark('Etapa 4: dois algoritmos de pesos com prévia de deformação numa cópia (modelo intacto); skin aplicado; Undo/Redo');

  await page.click('#gr-next');assert.equal((await G()).step, 5);
  const bend = await W(async () => {const hip = window.__importer.model.getObjectByName('LeftElbow'), q = hip.quaternion.clone();document.querySelector('[data-flex="elbows"]').click();await new Promise(r => setTimeout(r, 500));return q.angleTo(hip.quaternion) * 180 / Math.PI;});
  assert.ok(bend > 5, 'teste de flexão dobra o cotovelo: ' + bend);
  await page.click('#gr-rest');assert.equal((await G()).flex, null);
  await page.click('[data-anim="Walking"]');await page.waitForTimeout(500);
  assert.deepEqual(await W(() => [window.__importer.playing, window.__importer.selectedClip?.name]), [true, 'Walking · RobotExpressive (CC0)']);
  await page.screenshot({path: out + 'guiado-5-animacao.png'});
  await page.click('#gr-check');await page.waitForFunction(() => window.__studioGuided.state.validation, null, {timeout: 30000});
  const val = (await G()).validation;assert.equal(val.ok, true, JSON.stringify(val.items));
  await page.screenshot({path: out + 'guiado-5-validacao.png'});
  const dl = page.waitForEvent('download');await page.click('#gr-download');const exported = tmp + 'humanoide-rig.glb';await (await dl).saveAs(exported);
  const before = await tel();
  mark('Etapa 5: flexão real, animação CC0 tocando, exportação conferida (IDs, hierarquia, posições, skin, animações)');

  // Reimportar o GLB baixado: rig e pesos preservados; o assistente reconhece o rig existente.
  await importFile(exported);
  const after = await tel();
  assert.equal(await st(), 'vinculado');assert.deepEqual(after.joints.map(j => [j.id, j.name, j.parentId]), before.joints.map(j => [j.id, j.name, j.parentId]));
  assert.ok(Math.max(...after.joints.map(j => Math.hypot(...j.p.map((v, k) => v - before.joints.find(b => b.id === j.id).p[k])))) < 1e-4);
  assert.equal(after.summary.verticesWithoutInfluence, 0);assert.equal(await W(() => window.__importer.clips.length), 1);
  assert.match(await page.textContent('#gr-root'), /Rig existente detectado[\s\S]*Nada será recriado/);
  await page.click('[data-step="4"]');assert.match(await page.textContent('#gr-root'), /Skin existente preservado/);assert.equal(await page.$('#gr-bind'), null, 'sem botão de refazer skin num rig válido');
  mark('Reimportar o GLB exportado: IDs, hierarquia, posições, skin e animação preservados; rig existente reconhecido e não recriado');

  // ================= Quadrúpede =================
  await importFile(await makeGLB('quadrupede'));
  assert.equal(await page.isChecked('[name=gr-profile][value="quadruped-24"]'), true, 'análise sugere quadrúpede');
  await page.click('#gr-autorig');await page.waitForFunction(() => window.__studioWorkbench.engine.state() === 'proposta');
  assert.equal((await tel()).summary.bones, 24);
  await page.click('[data-step="4"]');await page.click('#gr-bind');await page.waitForFunction(() => window.__studioWorkbench.engine.state() === 'vinculado');
  await page.click('[data-step="5"]');const qText = await page.textContent('#gr-root');
  assert.match(qText, /quadrúpede: as animações da biblioteca são humanoides e não se aplicam/);assert.equal(await page.$('[data-anim]'), null, 'nenhuma animação humanoide oferecida');
  assert.equal(await page.isVisible('[data-flex="tail"]'), true, 'teste de cauda');
  await page.click('[data-flex="knees"]');await page.waitForTimeout(400);await page.screenshot({path: out + 'guiado-quadrupede.png'});await page.click('#gr-rest');
  mark('Quadrúpede: perfil sugerido automaticamente, 24 ossos, skin; animações humanoides recusadas; flexão de joelhos e cauda');

  // ================= Criatura assimétrica =================
  await importFile(await makeGLB('assimetrica'));
  await page.click('#gr-autorig');await page.waitForFunction(() => window.__studioWorkbench.engine.state() === 'proposta');
  await page.click('[data-step="3"]');const aText = await page.textContent('#gr-root');
  assert.match(aText, /não[\s\S]*é simétrica[\s\S]*espelhamento em massa está desativado/);
  assert.equal(await page.$('#gr-sym-all-lr'), null);assert.equal(await page.$('#gr-sym-all-rl'), null);
  mark('Criatura assimétrica: espelhamento em massa desativado; só correção par a par');

  // ================= Modo avançado =================
  await page.click('[data-mode="advanced"]');assert.equal(await page.isVisible('#gr-advanced'), true);assert.equal(await page.isVisible('#rg-template'), true, 'painel completo da aba Rigging');
  assert.equal(await page.isChecked('#rg-markers'), true, 'marcadores do painel avançado de volta');
  await page.click('#gr-open-telemetry');assert.equal(await W(() => window.__studioLayout.panel), 'workbench');
  await W(() => window.__studioLayout.open('rigging'));await page.click('[data-mode="guided"]');assert.equal(await page.isVisible('#gr-advanced'), false);
  mark('Modo avançado: painel completo do Rigging, marcadores e Telemetria/Rig Patch acessíveis; volta ao Assistente');
  assert.deepEqual(errors, []);assert.deepEqual(requests, []);
  await writeFile(out + 'guided-browser.json', JSON.stringify({tests: count, errors, requests, validation: val}, null, 2));
  console.log(`\nRigging guiado: ${count} verificações de navegador aprovadas.`);
} finally {await browser.close();}
