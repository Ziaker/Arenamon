// Teste de navegador do Animation Studio (Fase 1): edição real → exportação GLB → reimportação.
// Uso: node prototypes/studio/verify.mjs   (requer `npm run build` antes)
// Opcional: ARENAMON_LOCAL_MODEL=caminho.glb verifica também um modelo local (nunca versionado).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('.', import.meta.url)), out = root + 'validation/';
const fixture = await readFile(new URL('test/fixture.js', import.meta.url), 'utf8');
const glbJson = bytes => JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const report = {steps: [], errors: [], network: []};
const step = (name, data = true) => {report.steps.push({name, result: data});console.log('✓', name);};
await mkdir(out, {recursive: true});
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 960}, acceptDownloads: true});
  page.on('pageerror', e => report.errors.push(e.message));page.on('console', m => {if (m.type() === 'error') report.errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) report.network.push(r.url());});
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(root + 'dist/arenamon-animation-studio.html').href);await page.waitForFunction(() => window.__studioEditor && window.__importer);

  // ---------- Regressão: estado inicial da v6 ----------
  assert.equal(await page.isChecked('#textures'), true, 'Texturas ON inicialmente');assert.equal(await page.isChecked('#lighting'), true, 'Iluminação ON inicialmente');
  step('texturas e iluminação ON inicialmente');

  // ---------- Importação ----------
  await page.evaluate(async src => {
    const {syntheticRig} = await import('data:text/javascript,' + encodeURIComponent(src));const E = window.__importer, r = syntheticRig(E.T);
    await E.install(r.root, r.clips, 'sintetico.glb');
    // Anexação de vários arquivos de animação, inclusive com nomes duplicados e durações diferentes.
    const T = E.T, extra = (name, d) => new T.AnimationClip(name, d, [new T.QuaternionKeyframeTrack('Spine.quaternion', [0, d], [0, 0, 0, 1, 0, 0, .3826834, .9238795])]);
    E.append([extra('Take 001', 1.25)], 'dup.fbx');E.append([extra('Take 001', .5), extra('Take 001', 4)], 'dup.fbx');
  }, fixture);
  let names = await page.evaluate(() => window.__importer.clips.map(c => c.name));
  assert.deepEqual(names, ['sintetico.glb · 1', 'sintetico.glb · 2', 'sintetico.glb · 3', 'dup.fbx', 'dup.fbx · 1', 'dup.fbx · 2']);
  step('importação: modelo + 3 arquivos de animação (nomes duplicados, durações 0,5–4 s)', names);
  // Renomeia pela interface da v6.
  await page.click('#v6-rename-options summary');
  for (const [i, name] of [[0, 'idle'], [1, 'run'], [2, 'tackle']]) {await page.selectOption('#clip', String(i));await page.fill('#clip-name', name);await page.click('#rename-clip');}
  await page.selectOption('#clip', '3');await page.fill('#clip-name', 'tackle');await page.click('#rename-clip');
  assert.equal(await page.evaluate(() => window.__importer.clips[3].name), 'dup.fbx', 'nome duplicado rejeitado');
  step('renomear clipes e rejeitar nome duplicado');

  // ---------- Timeline ----------
  await page.selectOption('#clip', '2');await page.waitForTimeout(100);
  const box = await page.locator('#ed-canvas').boundingBox();assert.ok(box.height > 80 && box.width > 300, 'timeline visível');
  await page.mouse.click(box.x + 92 + (box.width - 92) * .5, box.y + 12);await page.waitForTimeout(50);
  const t1 = await page.evaluate(() => window.__importer.selectedAction.time);assert.ok(t1 > 1 && t1 < 2, 'clicar na régua posiciona o cursor: ' + t1);
  assert.equal(await page.evaluate(() => window.__importer.playing), false);
  await page.click('#ed-start');await page.click('#ed-next');await page.click('#ed-next');
  assert.ok(Math.abs(await page.evaluate(() => window.__importer.selectedAction.time) - 2 / 30) < 1e-6, 'avanço quadro a quadro');
  await page.selectOption('#ed-fps', '60');await page.click('#ed-next');assert.ok(Math.abs(await page.evaluate(() => window.__importer.selectedAction.time) - (2 / 30 + 1 / 60)) < 1e-6);
  await page.selectOption('#ed-fps', '30');
  await page.waitForFunction(() => /quadro \d+ \/ 90$/.test(document.getElementById('ed-frame').textContent));
  await page.click('#ed-zoom-in');await page.click('#ed-fit');await page.click('#ed-collapse');assert.equal(await page.isVisible('#ed-canvas'), false);await page.click('#ed-collapse');
  step('timeline: régua, quadros, FPS, zoom e recolher');

  // ---------- Recorte (exemplo: 0,4 s de um ataque de 3 s) ----------
  await page.click('[data-tool="trim"]');await page.fill('#ed-in', '1.2');await page.press('#ed-in', 'Tab');await page.fill('#ed-out', '');await page.type('#ed-out', '1.6');await page.press('#ed-out', 'Tab');
  assert.match(await page.textContent('#ed-range-info'), /0,400 s · 12 quadros/);
  // Arrastar na faixa Trecho também cria seleção.
  await page.click('#ed-trim-new');
  let state = await page.evaluate(() => {const E = window.__importer, c = E.selectedClip, head = E.model.getObjectByName('mixamorigHead');const tr = c.tracks.find(t => t.name.startsWith(head.uuid));return {name: c.name, duration: c.duration, count: E.clips.length, first: Array.from(tr.values.slice(0, 4)), times: Array.from(tr.times), src: E.clips[2].duration};});
  assert.equal(state.count, 7);assert.equal(state.name, 'tackle · 1.20–1.60s');assert.ok(Math.abs(state.duration - .4) < 1e-6);assert.equal(state.src, 3, 'original preservado');
  const angle = (q, deg) => 2 * Math.acos(Math.min(1, Math.abs(q[3]))) * 180 / Math.PI - deg;
  assert.ok(Math.abs(angle(state.first, 36)) < .05, 'fronteira interpolada (36°)');assert.ok(Math.abs(state.times.at(-1) - .4) < 1e-6);
  step('recorte de 0,4 s com interpolação nas fronteiras; original preservado', state);
  // Undo/redo da criação do clipe derivado.
  await page.click('#ed-undo');assert.equal(await page.evaluate(() => window.__importer.clips.length), 6);
  await page.keyboard.press('Control+y');assert.equal(await page.evaluate(() => window.__importer.clips.length), 7);
  assert.equal(await page.evaluate(() => window.__importer.selectedClip.name), 'tackle · 1.20–1.60s');
  step('desfazer/refazer criação de clipe');

  // ---------- Eventos de combate ----------
  await page.click('[data-tool="events"]');
  await page.evaluate(() => window.__importer.seek(8 / 30));await page.selectOption('#ed-event-type', 'hitbox_on');await page.click('#ed-event-add');
  await page.evaluate(() => window.__importer.seek(11 / 30));await page.selectOption('#ed-event-type', 'hitbox_off');await page.click('#ed-event-add');
  assert.equal(await page.locator('.ed-event').count(), 2);assert.equal(await page.textContent('#ed-event-warnings'), '');
  // Editar o quadro e o nome pela lista.
  await page.locator('.ed-event').nth(1).locator('input[type=number]').fill('10');await page.locator('.ed-event').nth(1).locator('input[type=number]').press('Enter');
  await page.locator('.ed-event').nth(0).locator('input[type=text]').first().fill('Hitbox do tackle');await page.locator('.ed-event').nth(0).locator('input[type=text]').first().press('Enter');
  let events = await page.evaluate(() => window.__importer.selectedClip.userData.arenamon.events.map(e => [e.type, Math.round(e.time * 30), e.label]));
  assert.deepEqual(events, [['hitbox_on', 8, 'Hitbox do tackle'], ['hitbox_off', 10, 'Desativar hitbox']]);
  // Excluir e desfazer.
  await page.locator('.ed-event').nth(1).locator('button', {hasText: '×'}).click();assert.equal(await page.locator('.ed-event').count(), 1);
  await page.click('#ed-undo');assert.equal(await page.locator('.ed-event').count(), 2);
  // Exemplo do pedido: no tackle original, hitbox no quadro 8 e recuperação no quadro 22.
  await page.selectOption('#clip', '2');await page.evaluate(() => {const ed = window.__studioEditor;ed.addEvent('hitbox_on', 8 / 30);ed.addEvent('recovery_start', 22 / 30);});
  // Arrastar um evento na faixa Eventos da timeline (quadro 8 → 12) e desfazer.
  await page.click('#ed-fit');const cbox = await page.locator('#ed-canvas').boundingBox(), xAt = t => cbox.x + 92 + t * (cbox.width - 92 - 18) / 3, laneY = cbox.y + 26 + 24 + 14;
  await page.mouse.move(xAt(8 / 30), laneY);await page.mouse.down();await page.mouse.move(xAt(10 / 30), laneY, {steps: 4});await page.mouse.move(xAt(12 / 30), laneY, {steps: 4});await page.mouse.up();
  assert.deepEqual(await page.evaluate(() => window.__importer.selectedClip.userData.arenamon.events.map(e => Math.round(e.time * 30))), [12, 22], 'evento arrastado');
  await page.click('#ed-undo');assert.deepEqual(await page.evaluate(() => window.__importer.selectedClip.userData.arenamon.events.map(e => Math.round(e.time * 30))), [8, 22]);
  step('eventos: adicionar, editar quadro/nome, arrastar na timeline, excluir, desfazer', events);

  // ---------- Root motion ----------
  await page.selectOption('#clip', '1');await page.click('[data-tool="root"]');await page.waitForTimeout(50);
  const metrics = await page.evaluate(() => window.__studioEditor.analysis().metrics);
  assert.ok(Math.abs(metrics.dz - 3) < 1e-3, 'deslocamento medido em metros do modelo (3 m)');assert.ok(Math.abs(metrics.yawDegrees - 90) < .1);
  assert.equal(await page.inputValue('#ed-root-h'), '0');await page.click('#ed-root-new');
  state = await page.evaluate(() => {const E = window.__importer, c = E.selectedClip, hips = E.model.getObjectByName('mixamorigHips'), p = c.tracks.find(t => t.name === hips.uuid + '.position').values;
    const xs = [], zs = [], ys = [];for (let i = 0; i < p.length; i += 3) {xs.push(p[i]);ys.push(p[i + 1]);zs.push(p[i + 2]);}return {name: c.name, x: [Math.min(...xs), Math.max(...xs)], z: [Math.min(...zs), Math.max(...zs)], y: [Math.min(...ys), Math.max(...ys)], rm: c.userData.arenamon.rootMotion, srcZ: E.clips[1].tracks.find(t => t.name === hips.uuid + '.position').values.at(-1)};});
  assert.equal(state.name, 'run · in-place');assert.ok(state.x[1] - state.x[0] < 1e-6 && state.z[1] - state.z[0] < 1e-6, 'sem deslocamento horizontal');assert.ok(state.y[1] - state.y[0] > 3, 'altura preservada');
  assert.equal(state.rm.inPlace, true);assert.ok(Math.abs(state.rm.original.metrics.dz - 3) < 1e-3, 'deslocamento original salvo separadamente');assert.ok(Math.abs(state.srcZ - 300) < 1e-3, 'clip original intacto');
  step('root motion: versão in-place exportável com dados de deslocamento separados', {x: state.x, z: state.z, y: state.y});

  // ---------- Tempo: velocidade, duração, loop, restaurar ----------
  await page.selectOption('#clip', '0');await page.click('[data-tool="time"]');
  await page.fill('#ed-speed', '200');await page.click('#ed-apply-speed');assert.equal(await page.evaluate(() => window.__importer.selectedClip.duration), 1);
  await page.keyboard.press('Control+z');assert.equal(await page.evaluate(() => window.__importer.selectedClip.duration), 2);
  await page.keyboard.press('Control+Shift+z');assert.equal(await page.evaluate(() => window.__importer.selectedClip.duration), 1);
  await page.fill('#ed-duration', '3');await page.click('#ed-apply-duration');assert.equal(await page.evaluate(() => window.__importer.selectedClip.duration), 3);
  await page.click('#ed-restore');assert.equal(await page.evaluate(() => window.__importer.selectedClip.duration), 2);
  await page.click('#ed-undo');assert.equal(await page.evaluate(() => window.__importer.selectedClip.duration), 3);await page.click('#ed-restore');
  await page.click('#ed-duplicate');assert.equal(await page.evaluate(() => window.__importer.selectedClip.name), 'idle · cópia');
  await page.click('#ed-close-loop');await page.click('#ed-delete');assert.equal(await page.evaluate(() => window.__importer.clips.some(c => c.name === 'idle · cópia')), false);
  await page.click('#ed-undo');assert.equal(await page.evaluate(() => window.__importer.clips.at(-1).name), 'idle · cópia');
  await page.click('#ed-delete');
  step('velocidade, duração, fechar loop, duplicar, restaurar e excluir derivado (com undo/redo)');

  // ---------- Organização (drag & drop da v6) e associações ----------
  await page.selectOption('#v6-group-select', 'idle');
  await page.dragAndDrop('.v6-clip[data-clip="0"]', '.v6-slot[data-action="idle"]');
  assert.equal(await page.inputValue('#action-idle'), '0', 'arrastar clipe para ação');
  const trimmedIndex = await page.evaluate(() => window.__importer.clips.findIndex(c => c.name === 'tackle · 1.20–1.60s'));
  await page.click(`.v6-clip[data-clip="${trimmedIndex}"]`);await page.selectOption('#v6-action-select', 'tackle');
  const inplaceIndex = await page.evaluate(() => window.__importer.clips.findIndex(c => c.name === 'run · in-place'));
  await page.click(`.v6-clip[data-clip="${inplaceIndex}"]`);await page.selectOption('#v6-action-select', 'run');
  assert.equal(await page.inputValue('#action-tackle'), String(trimmedIndex));
  step('organização por drag & drop e associação de clipes editados a ações');

  // ---------- Comparação ----------
  await page.selectOption('#clip', String(inplaceIndex));await page.click('[data-tool="compare"]');
  await page.selectOption('#lab-compare-type', 'original');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__studioV3.compare), true);await page.screenshot({path: out + 'compare-original.png'});
  await page.selectOption('#lab-compare-type', 'clips');await page.selectOption('#ed-cmp-b', '1');await page.selectOption('#ed-cmp-layout', 'overlay');await page.waitForTimeout(150);
  await page.screenshot({path: out + 'compare-overlay.png'});
  await page.selectOption('#ed-cmp-layout', 'side');await page.selectOption('#ed-cmp-sync', 'free');await page.click('#ed-cmp-play');await page.selectOption('#ed-cmp-speed', '0.5');
  await page.selectOption('#lab-compare-type', 'motion');await page.waitForTimeout(100);await page.uncheck('#ed-cmp-on');
  assert.equal(await page.evaluate(() => window.__studioV3.compare), false);
  step('comparação: original × editada, A × B (lado a lado, sobreposição, independente) e tipos da V3');

  // ---------- Regressão v6 ----------
  await page.click('#quick-textures');assert.equal(await page.isChecked('#textures'), false);await page.click('#quick-textures');
  await page.click('#quick-lighting');assert.equal(await page.isChecked('#lighting'), false);await page.click('#quick-lighting');
  await page.locator('#color').evaluate(el => {el.value = '#ff0000';el.dispatchEvent(new Event('input', {bubbles: true}));});
  assert.equal(await page.inputValue('#palette'), 'global');assert.equal(await page.evaluate(() => window.__importer.model.getObjectByName('Body').material.color.getHexString()), 'ff0000');
  await page.selectOption('#palette', 'palette');await page.dispatchEvent('#palette', 'change');
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--v6-organizer'));
  await page.focus('.v6-resize');await page.keyboard.press('ArrowLeft');
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--v6-organizer')), before, 'painel redimensionável');
  await page.click('#lab-quick-grid');await page.click('#lab-quick-grid');
  await page.click('#open-tools');await page.click('[data-tool-panel="camera"]');await page.check('#lab-dummy');await page.selectOption('#lab-camera', 'game');
  await page.click('[data-tool-panel="scene"]');await page.selectOption('#lab-root-mode', 'original');await page.click('#tools-done');
  await page.selectOption('#lab-quick-camera', 'free');await page.click('#play');assert.equal(await page.evaluate(() => window.__importer.playing), true);
  await page.click('#play');assert.equal(await page.evaluate(() => window.__importer.playing), false);
  step('regressão: texturas/luz, pintura global, painel, grid, dummy, câmeras, root mode, reprodução');

  // ---------- Exportação ----------
  const tackleAt = await page.evaluate(() => window.__importer.clips[2].userData.arenamon.events.map(e => e.type));
  assert.deepEqual(tackleAt, ['hitbox_on', 'recovery_start']);
  await page.click('#open-export');
  let pending = page.waitForEvent('download');await page.click('#export-json');const jsonPath = out + 'actions.json';await (await pending).saveAs(jsonPath);
  const manifest = JSON.parse(await readFile(jsonPath, 'utf8'));assert.equal(manifest.animationEditor.schemaVersion, 1);
  assert.deepEqual(manifest.animationEditor.clips[2].events.map(e => [e.type, e.frame]), [['hitbox_on', 8], ['recovery_start', 22]]);
  pending = page.waitForEvent('download');await page.click('#export');const glbPath = out + 'studio-roundtrip.glb';await (await pending).saveAs(glbPath);
  await page.click('#close-export');
  const doc = glbJson(await readFile(glbPath));
  const exportedNames = doc.animations.map(a => a.name);const expected = await page.evaluate(() => window.__importer.clips.map(c => c.name));
  assert.deepEqual(exportedNames, expected);assert.ok(doc.skins?.length, 'skin exportado');
  const trimmedDoc = doc.animations[trimmedIndex];assert.deepEqual(trimmedDoc.extras.arenamon.events.map(e => [e.type, e.frame]), [['hitbox_on', 8], ['hitbox_off', 10]]);
  assert.equal(doc.animations[inplaceIndex].extras.arenamon.rootMotion.inPlace, true);
  const rootExtras = doc.nodes[doc.scenes[0].nodes[0]].extras?.arenamonActions;assert.equal(rootExtras.actions.tackle.clipName, 'tackle · 1.20–1.60s');
  step('exportação GLB: nomes, skin, eventos por clipe, root motion e mapa de ações', {animations: exportedNames.length});

  // ---------- Reimportação ----------
  const originalSkin = await page.evaluate(() => {const m = window.__importer.model.getObjectByName('Body');return {bones: m.skeleton.bones.map(b => b.name), parents: m.skeleton.bones.map(b => b.parent?.name), vertices: m.geometry.attributes.position.count};});
  await page.setInputFiles('#model', glbPath);
  await page.waitForFunction(n => window.__importer.clips.length === n && document.getElementById('status').textContent.startsWith('Modelo carregado'), expected.length);
  const re = await page.evaluate(({trimmedIndex, inplaceIndex}) => {
    const E = window.__importer, T = E.T, clips = E.clips, body = E.model.getObjectByName('Body'), hips = E.model.getObjectByName('mixamorigHips'), head = E.model.getObjectByName('mixamorigHead');
    const tr = clips[trimmedIndex], ip = clips[inplaceIndex], hp = ip.tracks.find(t => t.name === hips.uuid + '.position').values;let spreadX = 0, spreadZ = 0;
    for (let i = 3; i < hp.length; i += 3) {spreadX = Math.max(spreadX, Math.abs(hp[i] - hp[0]));spreadZ = Math.max(spreadZ, Math.abs(hp[i + 2] - hp[2]));}
    const mixer = new T.AnimationMixer(E.model), action = mixer.clipAction(clips[2]);action.play();mixer.setTime(0);E.model.updateMatrixWorld(true);body.skeleton.update();
    const a = body.getVertexPosition(body.geometry.attributes.position.count - 1, new T.Vector3()).toArray();mixer.setTime(2.9);E.model.updateMatrixWorld(true);body.skeleton.update();
    const b = body.getVertexPosition(body.geometry.attributes.position.count - 1, new T.Vector3()).toArray();mixer.stopAllAction();mixer.uncacheRoot(E.model);
    return {names: clips.map(c => c.name), trimmedDuration: tr.duration, headFirst: Array.from(tr.tracks.find(t => t.name.startsWith(head.uuid + '.quaternion')).values.slice(0, 4)),
      events: tr.userData.arenamon.events.map(e => [e.type, Math.round(e.time * 30), e.label]), tackleEvents: clips[2].userData.arenamon.events.map(e => [e.type, Math.round(e.time * 30)]),
      spreadX, spreadZ, rootMotion: ip.userData.arenamon.rootMotion?.inPlace, derived: tr.userData.arenamon.derivedFrom?.clipName,
      bones: body.skeleton.bones.map(b => b.name), parents: body.skeleton.bones.map(b => b.parent?.name), vertices: body.geometry.attributes.position.count, deform: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
      actionTackle: document.getElementById('action-tackle').value, actionIdle: document.getElementById('action-idle').value, actionRun: document.getElementById('action-run').value};
  }, {trimmedIndex, inplaceIndex});
  assert.deepEqual(re.names, expected, 'nomes preservados');assert.ok(Math.abs(re.trimmedDuration - .4) < 1e-5, 'recorte sobrevive');
  assert.ok(Math.abs(angle(re.headFirst, 36)) < .05, 'pose da fronteira sobrevive');
  assert.deepEqual(re.events, [['hitbox_on', 8, 'Hitbox do tackle'], ['hitbox_off', 10, 'Desativar hitbox']], 'eventos no clipe correto');
  assert.deepEqual(re.tackleEvents, [['hitbox_on', 8], ['recovery_start', 22]]);
  assert.ok(re.spreadX < 1e-4 && re.spreadZ < 1e-4, 'in-place sobrevive');assert.equal(re.rootMotion, true);assert.equal(re.derived, 'tackle');
  assert.deepEqual(re.bones, originalSkin.bones);assert.deepEqual(re.parents, originalSkin.parents);assert.equal(re.vertices, originalSkin.vertices);assert.ok(re.deform > .01, 'skinning deforma após reimportar');
  assert.equal(re.actionTackle, String(trimmedIndex));assert.equal(re.actionIdle, '0');assert.equal(re.actionRun, String(inplaceIndex));
  // A interface do editor exibe os eventos reimportados.
  await page.selectOption('#clip', String(trimmedIndex));await page.click('[data-tool="events"]');assert.equal(await page.locator('.ed-event').count(), 2);
  step('reimportação: recorte, eventos, in-place, nomes, associações, hierarquia e skinning preservados', re);

  // Preview visível (pixels diferentes do fundo).
  await page.click('[data-tool="events"]');await page.selectOption('#lab-quick-camera', 'free');await page.click('#frame');await page.waitForTimeout(200);
  const png = (await page.locator('#view canvas').screenshot()).toString('base64');
  const visible = await page.evaluate(async png => {const img = new Image();img.src = 'data:image/png;base64,' + png;await img.decode();const c = document.createElement('canvas');c.width = img.width;c.height = img.height;const g = c.getContext('2d');g.drawImage(img, 0, 0);const d = g.getImageData(0, 0, c.width, c.height).data;let n = 0;for (let i = 0; i < d.length; i += 4) if (d[i] > 120 && d[i + 1] < 140) n++;return n / (c.width * c.height);}, png);
  assert.ok(visible > .003, 'personagem visível no preview: ' + visible);
  await page.screenshot({path: out + 'studio.png'});
  for (const viewport of [{width: 1920, height: 1000}, {width: 1100, height: 800}, {width: 390, height: 844}]) {
    await page.setViewportSize(viewport);await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'sem rolagem horizontal em ' + viewport.width);
    await page.screenshot({path: out + `studio-${viewport.width}.png`});await page.locator('.stage').screenshot({path: out + `stage-${viewport.width}.png`});
  }
  step('preview visível e layout sem rolagem horizontal (1920, 1100, 390 px)');

  if (process.env.ARENAMON_LOCAL_MODEL) {
    await page.setViewportSize({width: 1500, height: 960});
    await page.setInputFiles('#model', process.env.ARENAMON_LOCAL_MODEL);await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Modelo carregado'), null, {timeout: 60000});
    const local = await page.evaluate(async () => {
      const E = window.__importer, ed = window.__studioEditor, n = E.clips.length;if (!n) return {clips: 0};
      E.selectIndex(0);const d = E.selectedClip.duration;ed.setRange({start: d * .25, end: d * .5});ed.trimToNew();
      const root = ed.analysis();if (root) {E.selectIndex(0);ed.applyRoot({horizontal: 0, method: 'full', vertical: 'keep', rotation: 'keep'}, true);}
      return {clips: n, after: E.clips.length, trimmed: E.clips[n].duration, root: !!root};
    });
    if (!local.clips) step('modelo local sem animações: importado; edição não aplicável', local);else {
    pending = page.waitForEvent('download');await page.click('#open-export');await page.click('#export');await (await pending).saveAs(out + 'local-roundtrip.glb');await page.click('#close-export');
    await page.setInputFiles('#model', out + 'local-roundtrip.glb');await page.waitForFunction(n => window.__importer.clips.length === n, local.after, {timeout: 60000});
    step('modelo local: recorte, root motion, exportação e reimportação', local);}
  }
  assert.deepEqual(report.errors, []);assert.deepEqual(report.network, []);
  await writeFile(out + 'report.json', JSON.stringify(report, null, 2));
  console.log(`\nAnimation Studio: ${report.steps.length} verificações de navegador aprovadas.`);
} finally {await browser.close();}
