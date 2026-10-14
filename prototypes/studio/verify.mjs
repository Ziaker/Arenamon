// Teste de navegador do Animation Studio: layout por ferramentas, salvar/sair, edição real → exportação GLB → reimportação.
// Uso: node prototypes/studio/verify.mjs   (requer `npm run build` antes)
// Opcional: ARENAMON_LOCAL_MODEL=caminho.glb verifica também um modelo local (nunca versionado).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('.', import.meta.url)), out = root + 'validation/';
const fixture = await readFile(new URL('test/fixture.js', import.meta.url), 'utf8');
const glbJson = bytes => JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const report = {steps: [], errors: [], network: [], perf: {renderer: null, steps: [], longTasks: []}};
// Desempenho: tempo de cada etapa e tarefas longas da página (> 50 ms). Em executores sem GPU (CI), o WebGL roda em
// software e a página pode bloquear a thread principal; isso aparece aqui em vez de virar um timeout sem explicação.
let stepStart = Date.now(), onStep = null;
const step = (name, data = true) => {const ms = Date.now() - stepStart;stepStart = Date.now();report.steps.push({name, result: data});report.perf.steps.push({name, ms, end: stepStart});console.log('✓', name, `(${(ms / 1000).toFixed(1)} s)`);onStep?.();if (process.env.STUDIO_VERIFY_UNTIL && name.startsWith(process.env.STUDIO_VERIFY_UNTIL)) {console.log('Encerrado após a etapa pedida (STUDIO_VERIFY_UNTIL).');process.exit(0);}};
const withTimeout = (promise, ms) => Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(null), ms))]);
await mkdir(out, {recursive: true});
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 960}, acceptDownloads: true});
  // Diagnóstico de CI (opcional): STUDIO_VERIFY_CSS injeta CSS em todas as páginas; STUDIO_VERIFY_UNTIL encerra após a etapa indicada.
  if (process.env.STUDIO_VERIFY_CSS) await page.addInitScript(css => {document.addEventListener('DOMContentLoaded', () => {const st = document.createElement('style');st.textContent = css;document.head.append(st);});}, process.env.STUDIO_VERIFY_CSS);
  await page.addInitScript(() => {
    window.__perfLongTasks = [];
    try {new PerformanceObserver(list => {for (const e of list.getEntries()) window.__perfLongTasks.push([Math.round(performance.timeOrigin + e.startTime), Math.round(e.duration)]);}).observe({type: 'longtask', buffered: true});} catch {/* sem suporte */}
  });
  // Coleta as tarefas longas (com limite de tempo: se a página estiver bloqueada, a coleta não pode travar o teste).
  const collectPerf = async () => {const lt = await withTimeout(page.evaluate(() => window.__perfLongTasks.splice(0)).catch(() => null), 5000);if (lt) report.perf.longTasks.push(...lt);};
  onStep = () => {collectPerf();}; // coleta a cada etapa (recarregar a página zera o registro dela)
  const perfSummary = () => {
    const tasks = report.perf.longTasks, top = [...tasks].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const where = t => report.perf.steps.find(st => st.end >= t)?.name ?? '(etapa em andamento)';
    return {renderer: report.perf.renderer, longTasks: tasks.length, totalMs: tasks.reduce((a, t) => a + t[1], 0), top: top.map(([t, d]) => `${d} ms em “${where(t)}”`)};
  };
  await page.addInitScript(() => {
    window.__picker = {mode: 'ok', files: []};
    window.showSaveFilePicker = async opts => {
      const mode = window.__picker.mode;if (mode === 'cancel') throw new DOMException('Cancelado pelo usuário', 'AbortError');
      return {name: opts.suggestedName, async createWritable() {
        if (mode === 'fail') throw new Error('disco cheio (simulado)');const chunks = [];
        return {write: async b => {chunks.push(b);}, close: async () => {window.__picker.files.push({name: opts.suggestedName, blob: new Blob(chunks)});}};
      }};
    };
  });
  const dialogs = [];page.on('dialog', d => {dialogs.push(d.type());d.type() === 'beforeunload' ? (page.__acceptUnload ? d.accept() : d.dismiss()) : d.dismiss();});
  // Copia para o disco o último arquivo “gravado” pelo seletor simulado.
  const lastSaved = async path => {const b64 = await page.evaluate(async () => {const f = window.__picker.files.at(-1);const u = new Uint8Array(await f.blob.arrayBuffer());let s = '';for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768));return btoa(s);});await writeFile(path, Buffer.from(b64, 'base64'));return path;};
  const saveState = () => page.getAttribute('#st-save', 'data-state');
  const reloadAttempt = async () => {const n = dialogs.length;await page.evaluate(() => location.reload()).catch(() => {});await page.waitForTimeout(600);return dialogs.length > n;};
  page.on('pageerror', e => report.errors.push(e.message));page.on('console', m => {if (m.type() === 'error') report.errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) report.network.push(r.url());});
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(root + 'dist/arenamon-animation-studio.html').href);await page.waitForFunction(() => window.__studioEditor && window.__importer);
  report.perf.renderer = await page.evaluate(() => {const gl = window.__importer.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);});
  console.log('WebGL:', report.perf.renderer);stepStart = Date.now();

  // ---------- Projeto novo: sem alterações, sem aviso ao sair ----------
  assert.equal(await saveState(), 'clean');assert.equal(await page.textContent('#st-save-text'), 'Nenhum projeto');
  await page.click('[data-panel="appearance"]');await page.click('[data-panel="project"]'); // gesto do usuário (exigido pelo beforeunload)
  assert.equal(await reloadAttempt(), false, 'sem aviso sem alterações');await page.waitForFunction(() => window.__studioEditor && window.__importer);
  assert.equal(await page.isVisible('#st-panel'), true);
  step('projeto novo: estado “Nenhum projeto” e recarregar sem aviso');

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
  assert.equal(await saveState(), 'dirty', 'importar marca alterações');
  assert.match(await page.textContent('#st-clip-chip'), /sintetico\.glb · 1|dup\.fbx/);

  // ---------- Layout: ferramentas, painéis e redimensionamento ----------
  const width = sel => page.evaluate(s => document.querySelector(s).getBoundingClientRect().width, sel);
  const canvasMatches = () => page.evaluate(() => {const v = document.getElementById('view'), c = v.querySelector('canvas');return Math.abs(c.getBoundingClientRect().width - v.clientWidth) < 2 && Math.abs(c.width / devicePixelRatio - v.clientWidth) < 2;});
  const SECTIONS = {project: '#model-drop', appearance: '#color', scene: '#lab-grid', camera: '#lab-camera', motion: '#lab-root-mode', inspect: '#v4-skeleton', export: '#export'};
  const modelId = await page.evaluate(() => window.__importer.model.uuid);
  for (const [panel, control] of Object.entries(SECTIONS)) {
    await page.click(`[data-panel="${panel}"]`);
    if (!(await page.isVisible('#st-panel'))) await page.click(`[data-panel="${panel}"]`);
    const visible = await page.evaluate(() => [...document.querySelectorAll('[data-section]')].filter(s => !s.hidden && s.offsetParent).map(s => s.dataset.section));
    assert.deepEqual(visible, [panel], 'somente a aba ativa: ' + panel);assert.equal(await page.isVisible(control), true, control + ' visível em ' + panel);
    for (const [other, c] of Object.entries(SECTIONS)) if (other !== panel) assert.equal(await page.isVisible(c), false, c + ' oculto em ' + panel);
  }
  assert.equal(await page.evaluate(() => window.__importer.model.uuid), modelId, 'trocar de aba não recarrega o modelo');
  // Aparência e câmera sincronizadas entre o painel e os atalhos do visualizador.
  await page.click('[data-panel="camera"]');await page.selectOption('#lab-camera', 'game');assert.equal(await page.inputValue('#lab-quick-camera'), 'game');
  await page.selectOption('#lab-quick-camera', 'free');assert.equal(await page.inputValue('#lab-camera'), 'free');
  assert.equal(await saveState(), 'dirty');
  // Recolher/reabrir e redimensionar a esquerda.
  const stageOpen = await width('.stage');await page.click('#st-panel-close');await page.waitForTimeout(80);
  assert.equal(await page.isVisible('#st-panel'), false);const stageClosed = await width('.stage');assert.ok(stageClosed > stageOpen + 200, 'visualizador ganha o espaço');
  await page.waitForTimeout(80);assert.ok(await canvasMatches(), 'canvas acompanha o novo tamanho');
  assert.equal(await page.evaluate(() => window.__importer.playing), true, 'a animação continua ao recolher');
  await page.click('[data-panel="project"]');assert.equal(await page.isVisible('#model-drop'), true, 'reabre pela barra');
  const left0 = await width('#st-panel'), grip = await page.locator('#st-left-grip').boundingBox();
  await page.mouse.move(grip.x + 3, grip.y + grip.height / 2);await page.mouse.down();await page.mouse.move(grip.x + 83, grip.y + grip.height / 2, {steps: 5});await page.mouse.up();
  assert.ok(Math.abs(await width('#st-panel') - (left0 + 80)) < 3, 'arrastar ajusta a largura esquerda');
  await page.focus('#st-left-grip');await page.keyboard.press('ArrowLeft');assert.ok(Math.abs(await width('#st-panel') - (left0 + 56)) < 3);
  // Direita: redimensionar, recolher e reabrir; ambos fechados.
  const right0 = await width('.organizer');await page.focus('.v6-resize');await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');
  assert.ok(Math.abs(await width('.organizer') - (right0 - 60)) < 3, 'redimensionar direita');
  await page.click('#st-library-close');assert.equal(await page.isVisible('.organizer'), false);
  await page.click('#st-panel-close');const both = await width('.stage');assert.ok(both > 1500 - 74 - 2, 'ambos fechados: quase toda a tela para o visualizador (' + both + ')');
  await page.waitForTimeout(80);assert.ok(await canvasMatches());
  await page.click('#st-toggle-library');assert.equal(await page.isVisible('.organizer'), true);
  // Timeline: recolher e abrir pela barra.
  await page.click('#st-toggle-timeline');assert.equal(await page.isVisible('#ed-canvas'), false);await page.click('#st-toggle-timeline');assert.equal(await page.isVisible('#ed-canvas'), true);
  // Modo foco recolhe as duas laterais e restaura.
  const focus = async () => {if (!(await page.evaluate(() => document.querySelector('.view-more').open))) await page.click('.view-more summary');await page.click('#v4-focus');};
  await focus();assert.equal(await page.isVisible('.organizer'), false);
  await focus();assert.equal(await page.isVisible('.organizer'), true);
  // Estado preservado na sessão.
  await page.click('[data-panel="inspect"]');
  assert.deepEqual(await page.evaluate(() => [sessionStorage.getItem('st-panel'), sessionStorage.getItem('st-left-open'), sessionStorage.getItem('st-right-open')]), ['inspect', '1', '1']);
  await page.click('[data-panel="project"]');
  step('layout: abas exclusivas, painéis recolhíveis e redimensionáveis, foco, timeline, canvas e estado da sessão');
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
  await page.click('[data-panel="appearance"]');
  await page.click('#textures');assert.equal(await page.isChecked('#textures'), false);assert.equal(await page.textContent('#texturesLabel'), 'Texturas: OFF');await page.click('#textures');
  await page.click('#lighting');assert.equal(await page.isChecked('#lighting'), false);await page.click('#lighting');
  await page.locator('#color').evaluate(el => {el.value = '#ff0000';el.dispatchEvent(new Event('input', {bubbles: true}));});
  assert.equal(await page.inputValue('#palette'), 'global');assert.equal(await page.evaluate(() => window.__importer.model.getObjectByName('Body').material.color.getHexString()), 'ff0000');
  await page.selectOption('#palette', 'palette');
  await page.click('#lab-quick-grid');assert.equal(await page.isChecked('#lab-grid'), false);await page.click('#lab-quick-grid');
  await page.click('[data-panel="scene"]');await page.check('#lab-dummy');assert.equal(await page.evaluate(() => window.__importer.scene.children.find(o => o.name === 'Arenamon Studio · Alvo técnico').visible), true);
  await page.click('[data-panel="camera"]');await page.selectOption('#lab-camera', 'lock');await page.click('#lab-preset');assert.equal(await page.inputValue('#lab-camera'), 'game');
  await page.click('[data-panel="motion"]');await page.selectOption('#lab-root-mode', 'original');
  await page.click('[data-panel="inspect"]');await page.check('#v4-skeleton');await page.uncheck('#v4-skeleton');
  await page.selectOption('#lab-quick-camera', 'free');await page.click('#play');assert.equal(await page.evaluate(() => window.__importer.playing), true);
  await page.click('#play');assert.equal(await page.evaluate(() => window.__importer.playing), false);
  step('regressão: texturas/luz, pintura global, grid, dummy, câmeras, root mode, inspeção, reprodução (nas abas)');

  // ---------- Exportação ----------
  const tackleAt = await page.evaluate(() => window.__importer.clips[2].userData.arenamon.events.map(e => e.type));
  assert.deepEqual(tackleAt, ['hitbox_on', 'recovery_start']);
  await page.click('#st-top-export');assert.equal(await page.isVisible('#export'), true, 'Exportar abre a aba');
  await page.evaluate(() => {window.__picker.mode = 'ok';});await page.click('#export-json');await page.waitForFunction(() => document.getElementById('st-export-result').dataset.state === 'ok');
  const jsonPath = await lastSaved(out + 'actions.json');
  const manifest = JSON.parse(await readFile(jsonPath, 'utf8'));assert.equal(manifest.animationEditor.schemaVersion, 1);
  assert.deepEqual(manifest.animationEditor.clips[2].events.map(e => [e.type, e.frame]), [['hitbox_on', 8], ['recovery_start', 22]]);
  // GLB final: cancelar, falhar e gravar. Nenhum deles marca o projeto como salvo.
  for (const [mode, expected] of [['cancel', 'canceled'], ['fail', 'error'], ['ok', 'ok']]) {
    await page.evaluate(m => {window.__picker.mode = m;document.getElementById('st-export-result').dataset.state = '';}, mode);await page.click('#export');
    await page.waitForFunction(x => document.getElementById('st-export-result').dataset.state === x, expected);assert.equal(await saveState(), 'dirty', 'exportar o GLB final não equivale a salvar o projeto');
  }
  assert.match(await page.textContent('#st-export-result'), /gravado.*continua com alterações não salvas/);
  const glbPath = await lastSaved(out + 'studio-roundtrip.glb');
  // Sem a File System Access API: download comum, indicado como não verificado.
  await page.evaluate(() => {window.__keepPicker = window.showSaveFilePicker;delete window.showSaveFilePicker;});
  let pending = page.waitForEvent('download');await page.click('#export-json');await (await pending).saveAs(out + 'actions-download.json');
  await page.waitForFunction(() => /não verificado/.test(document.getElementById('st-export-result').textContent));
  await page.evaluate(() => {window.showSaveFilePicker = window.__keepPicker;});
  step('exportação: GLB final e JSON gravados, cancelados, com falha e por download; estado do projeto preservado');
  const doc = glbJson(await readFile(glbPath));
  const exportedNames = doc.animations.map(a => a.name);const expected = await page.evaluate(() => window.__importer.clips.map(c => c.name));
  assert.deepEqual(exportedNames, expected);assert.ok(doc.skins?.length, 'skin exportado');
  const trimmedDoc = doc.animations[trimmedIndex];assert.deepEqual(trimmedDoc.extras.arenamon.events.map(e => [e.type, e.frame]), [['hitbox_on', 8], ['hitbox_off', 10]]);
  assert.equal(doc.animations[inplaceIndex].extras.arenamon.rootMotion.inPlace, true);
  const rootExtras = doc.nodes[doc.scenes[0].nodes[0]].extras?.arenamonActions;assert.equal(rootExtras.actions.tackle.clipName, 'tackle · 1.20–1.60s');
  step('exportação GLB: nomes, skin, eventos por clipe, root motion e mapa de ações', {animations: exportedNames.length});

  // ---------- Reimportação ----------
  const originalSkin = await page.evaluate(() => {const m = window.__importer.model.getObjectByName('Body');return {bones: m.skeleton.bones.map(b => b.name), parents: m.skeleton.bones.map(b => b.parent?.name), vertices: m.geometry.attributes.position.count};});
  // Aviso ao sair: recarregar mostra o aviso nativo; cancelar mantém o trabalho.
  assert.equal(await reloadAttempt(), true, 'beforeunload com alterações');assert.equal(await page.evaluate(() => window.__importer?.clips.length), expected.length, 'cancelar a saída mantém o trabalho');
  // Substituir o modelo: diálogo interno. Cancelar mantém tudo.
  const uuidBefore = await page.evaluate(() => window.__importer.model.uuid);
  await page.setInputFiles('#model', glbPath);await page.waitForSelector('#st-confirm:not([hidden])');
  assert.equal(await page.textContent('#st-confirm-title'), 'Alterações não salvas');await page.click('[data-answer="cancel"]');await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__importer.model.uuid), uuidBefore, 'cancelar mantém o projeto');assert.equal(await saveState(), 'dirty');
  // Salvar projeto pelo diálogo: falha → continua; depois grava e substitui.
  await page.evaluate(() => {window.__picker.mode = 'fail';});await page.setInputFiles('#model', glbPath);await page.waitForSelector('#st-confirm:not([hidden])');await page.click('[data-answer="save"]');
  await page.waitForFunction(() => document.getElementById('st-save').dataset.state === 'error');assert.equal(await page.evaluate(() => window.__importer.model.uuid), uuidBefore, 'falha ao salvar não descarta');
  await page.evaluate(() => {window.__picker.mode = 'cancel';});await page.click('#st-top-save');await page.waitForTimeout(150);assert.equal(await saveState(), 'dirty', 'cancelar o salvamento mantém “não salvo”');
  await page.evaluate(() => {window.__picker.mode = 'ok';});await page.click('#st-top-save');await page.waitForFunction(() => document.getElementById('st-save').dataset.state === 'saved');
  assert.match(await page.textContent('#st-save-text'), /Projeto salvo às/);const projectPath = await lastSaved(out + 'projeto.arenamon.glb');
  assert.match(await page.evaluate(() => window.__picker.files.at(-1).name), /\.arenamon\.glb$/);
  assert.equal(await reloadAttempt(), false, 'sem aviso depois de salvar');await page.waitForFunction(() => window.__importer && window.__studioEditor);
  step('salvar/sair: beforeunload, diálogo (cancelar, salvar com falha), salvar cancelado, salvo e recarregar sem aviso');
  // Projeto reaberto do arquivo: começa sem alterações. Depois, Sair sem salvar substitui pelo GLB final.
  await page.setInputFiles('#model', projectPath);await page.waitForFunction(n => window.__importer.clips.length === n && document.getElementById('status').textContent.startsWith('Modelo carregado'), expected.length);
  assert.equal(await saveState(), 'clean', 'projeto aberto de arquivo');
  await page.evaluate(() => window.__studioEditor.setSpeed(150));assert.equal(await saveState(), 'dirty');
  await page.setInputFiles('#model', glbPath);await page.waitForSelector('#st-confirm:not([hidden])');await page.click('[data-answer="discard"]');
  await page.waitForFunction(n => window.__importer.clips.length === n && document.getElementById('status').textContent.startsWith('Modelo carregado') && window.__importer.clips[0].duration === 2, expected.length);
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

  // ---------- Recuperação local após fechar sem salvar ----------
  await page.evaluate(() => {window.__importer.selectIndex(0);window.__studioEditor.setSpeed(200);});assert.equal(await saveState(), 'dirty');
  await page.waitForFunction(() => /cópia neste navegador/.test(document.getElementById('st-info-recovery').textContent), null, {timeout: 20000});
  page.__acceptUnload = true;await page.evaluate(() => location.reload());await page.waitForFunction(() => window.__importer && window.__studioEditor);page.__acceptUnload = false;
  assert.ok(dialogs.includes('beforeunload'));
  await page.waitForSelector('#st-recovery:not([hidden])');assert.match(await page.textContent('#st-recovery-text'), /animações/);
  await page.click('#st-recovery-open');await page.waitForFunction(n => window.__importer.clips.length === n, expected.length);
  await page.waitForFunction(() => document.getElementById('st-save').dataset.state === 'dirty' && /recuperada/.test(document.getElementById('st-save').title + document.getElementById('st-info-state').textContent));
  assert.equal(await page.evaluate(() => window.__importer.clips[0].duration), 1, 'edição recuperada');assert.equal(await page.isVisible('#st-recovery'), false);
  assert.equal(await page.evaluate(n => window.__importer.clips[n].userData.arenamon.events.length, trimmedIndex), 2);
  await page.evaluate(() => window.__studioProject.clearRecovery());
  step('recuperação local: cópia gravada no IndexedDB, oferecida após recarregar e restaurada com as edições');

  // Preview visível (pixels diferentes do fundo).
  await page.click('[data-tool="events"]');await page.selectOption('#lab-quick-camera', 'free');await page.click('#frame');await page.waitForTimeout(200);
  const png = (await page.locator('#view canvas').screenshot()).toString('base64');
  const visible = await page.evaluate(async png => {const img = new Image();img.src = 'data:image/png;base64,' + png;await img.decode();const c = document.createElement('canvas');c.width = img.width;c.height = img.height;const g = c.getContext('2d');g.drawImage(img, 0, 0);const d = g.getImageData(0, 0, c.width, c.height).data;let n = 0;for (let i = 0; i < d.length; i += 4) if (d[i] > 120 && d[i + 1] < 140) n++;return n / (c.width * c.height);}, png);
  assert.ok(visible > .003, 'personagem visível no preview: ' + visible);
  await page.screenshot({path: out + 'studio.png'});
  for (const viewport of [{width: 1920, height: 1000}, {width: 1024, height: 768}, {width: 390, height: 844}]) {
    await page.setViewportSize(viewport);await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'sem rolagem horizontal em ' + viewport.width);
    assert.equal(await page.isVisible('#st-rail'), true, 'barra de ferramentas em ' + viewport.width);
    if (viewport.width < 1100) {
      // Painéis sobrepostos: um de cada vez; tocar no visualizador fecha.
      await page.click('[data-panel="appearance"]');assert.equal(await page.isVisible('#color'), true);assert.equal(await page.isVisible('.organizer'), false);
      await page.screenshot({path: out + `after-${viewport.width}-panel.png`});
      await page.click('#st-toggle-library');assert.equal(await page.isVisible('#st-panel'), false);assert.equal(await page.isVisible('.organizer'), true);
      await page.screenshot({path: out + `after-${viewport.width}-library.png`});
      await page.click('#st-library-close');
    }
    await page.waitForTimeout(80);assert.ok(await canvasMatches(), 'canvas em ' + viewport.width);
    await page.screenshot({path: out + `after-${viewport.width}.png`});
  }
  await page.setViewportSize({width: 1500, height: 960});
  step('preview visível; desktop, tablet e celular sem rolagem horizontal, com painéis sobrepostos no tablet/celular');

  if (process.env.ARENAMON_LOCAL_MODEL) {
    await page.setViewportSize({width: 1500, height: 960});
    const prevModel = await page.evaluate(() => window.__importer.model?.uuid);await page.setInputFiles('#model', process.env.ARENAMON_LOCAL_MODEL);
    await page.waitForSelector('#st-confirm:not([hidden])', {timeout: 5000}).then(() => page.click('[data-answer="discard"]')).catch(() => {});
    await page.waitForFunction(id => window.__importer.model?.uuid !== id && document.getElementById('status').textContent.startsWith('Modelo carregado'), prevModel, {timeout: 60000});
    const local = await page.evaluate(async () => {
      const E = window.__importer, ed = window.__studioEditor, n = E.clips.length;if (!n) return {clips: 0};
      E.selectIndex(0);const d = E.selectedClip.duration;ed.setRange({start: d * .25, end: d * .5});ed.trimToNew();
      const root = ed.analysis();if (root) {E.selectIndex(0);ed.applyRoot({horizontal: 0, method: 'full', vertical: 'keep', rotation: 'keep'}, true);}
      return {clips: n, after: E.clips.length, trimmed: E.clips[n].duration, root: !!root};
    });
    if (!local.clips) step('modelo local sem animações: importado; edição não aplicável', local);else {
    await page.click('#st-top-export');await page.evaluate(() => {window.__picker.mode = 'ok';document.getElementById('st-export-result').dataset.state = '';});await page.click('#export');
    await page.waitForFunction(() => document.getElementById('st-export-result').dataset.state === 'ok', null, {timeout: 60000});await lastSaved(out + 'local-roundtrip.glb');
    await page.setInputFiles('#model', out + 'local-roundtrip.glb');await page.waitForSelector('#st-confirm:not([hidden])');await page.click('[data-answer="discard"]');await page.waitForFunction(n => window.__importer.clips.length === n, local.after, {timeout: 60000});
    step('modelo local: recorte, root motion, exportação e reimportação', local);}
  }
  assert.deepEqual(report.errors, []);assert.deepEqual(report.network, []);
  await collectPerf();report.perf.summary = perfSummary();
  await writeFile(out + 'report.json', JSON.stringify(report, null, 2));
  console.log(`Tarefas longas: ${report.perf.summary.longTasks} (${(report.perf.summary.totalMs / 1000).toFixed(1)} s no total); maiores: ${report.perf.summary.top.slice(0, 3).join('; ') || 'nenhuma'}`);
  console.log(`\nAnimation Studio: ${report.steps.length} verificações de navegador aprovadas.`);
} catch (e) {
  // Falha: registra onde a página gastou tempo antes de encerrar (útil para timeouts no CI).
  try {const pages = browser.contexts().flatMap(c => c.pages());if (pages[0]) {const lt = await withTimeout(pages[0].evaluate(() => window.__perfLongTasks.splice(0)).catch(() => null), 5000);if (lt) report.perf.longTasks.push(...lt);else report.perf.blocked = 'a página não respondeu em 5 s (thread principal bloqueada)';}} catch {/* página fechada */}
  report.perf.steps.push({name: '(falhou aqui)', ms: Date.now() - stepStart, end: Date.now()});
  const tasks = report.perf.longTasks, top = [...tasks].sort((a, b) => b[1] - a[1]).slice(0, 8);
  report.perf.failure = {error: String(e.message || e).split('\n')[0], blocked: report.perf.blocked ?? null, longTasks: tasks.length, totalMs: tasks.reduce((a, t) => a + t[1], 0), top};
  await writeFile(out + 'report.json', JSON.stringify(report, null, 2)).catch(() => {});
  console.error('Desempenho na falha:', JSON.stringify({renderer: report.perf.renderer, ...report.perf.failure}));
  throw e;
} finally {await browser.close();}
