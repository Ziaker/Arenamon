// Teste de navegador do Animation Studio (v8 Viewport-First): soberania do palco >=85%, 3 modos, inspetor contextual único,
// pílula/overlay de timeline, HUD de 4 botões, Modo Zen unificado, ajuda progressiva (?), salvar/sair, edição real → exportação GLB → reimportação.
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
  const ensureTimelineExpanded = async on => {
    const collapsed = await page.evaluate(() => window.__studioEditor.collapsed);
    if (on && collapsed) await page.click('#ed-collapse');
    if (!on && !collapsed) await page.click('#ed-collapse');
  };
  page.on('pageerror', e => report.errors.push(e.message));page.on('console', m => {if (m.type() === 'error') report.errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) report.network.push(r.url());});
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(root + 'dist/arenamon-animation-studio.html').href);
  await page.waitForFunction(() => window.__studioEditor && window.__importer && window.__studioLayout);

  // ---------- Projeto novo: sem alterações, sem aviso ao sair ----------
  assert.equal(await saveState(), 'clean');assert.equal(await page.textContent('#st-save-text'), 'Nenhum projeto');
  await page.click('#st-project-btn');assert.equal(await page.isVisible('#st-inspector'), true);
  await page.click('#st-inspector-close');assert.equal(await page.isVisible('#st-inspector'), false);
  assert.equal(await reloadAttempt(), false, 'sem aviso sem alterações');
  await page.waitForFunction(() => window.__studioEditor && window.__importer && window.__studioLayout);
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

  // ---------- [8.1 #3] Estado inicial limpo após importação ----------
  const cleanAfterImport = await page.evaluate(() => ({
    inspectorOpen: window.__studioLayout.inspector.open,
    timelineExpanded: window.__studioLayout.timeline.expanded,
  }));
  assert.equal(cleanAfterImport.inspectorOpen, false, 'inspetor fechado após importação');
  assert.equal(cleanAfterImport.timelineExpanded, false, 'timeline em pílula após importação');
  step('estado inicial limpo após importação: inspetor fechado e timeline recolhida em pílula', cleanAfterImport);

  // ---------- [8.1 #1 & #2] Soberania do Viewport (>= 85%) e altura das barras fixas ----------
  const canvasMatches = () => page.evaluate(() => {const v = document.getElementById('view'), c = v.querySelector('canvas');return Math.abs(c.getBoundingClientRect().width - v.clientWidth) < 2 && Math.abs(c.width / devicePixelRatio - v.clientWidth) < 2;});
  const sovereigntyMetrics = {};
  for (const vp of [{width: 1366, height: 768}, {width: 1920, height: 1080}]) {
    await page.setViewportSize(vp);await page.waitForTimeout(120);
    const m = await page.evaluate(() => {
      const v = document.getElementById('view').getBoundingClientRect();
      const top = document.querySelector('header.topbar').getBoundingClientRect();
      const status = document.getElementById('st-statusbar').getBoundingClientRect();
      const ratio = (v.width * v.height) / (window.innerWidth * window.innerHeight);
      return {ratio: Number(ratio.toFixed(4)), topH: top.height, statusH: status.height};
    });
    assert.ok(m.ratio >= 0.85, `viewport >= 85% em ${vp.width}x${vp.height}: ${m.ratio}`);
    assert.ok(m.topH >= 36 && m.topH <= 44, `topbar entre 36px e 44px em ${vp.width}x${vp.height}: ${m.topH}`);
    assert.ok(m.statusH >= 20 && m.statusH <= 24, `statusbar entre 20px e 24px em ${vp.width}x${vp.height}: ${m.statusH}`);
    assert.ok(await canvasMatches(), `canvas sincronizado em ${vp.width}x${vp.height}`);
    sovereigntyMetrics[`${vp.width}x${vp.height}`] = m;
  }
  await page.setViewportSize({width: 1500, height: 960});await page.waitForTimeout(100);
  step('soberania do viewport (>= 85% em 1366x768 e 1920x1080) e altura das barras fixas (topbar 40px, statusbar 22px)', sovereigntyMetrics);

  // ---------- [8.1 #4] Três modos de trabalho (Rigging, Animar, Preview & Entrega) ----------
  const modelId = await page.evaluate(() => window.__importer.model.uuid);
  for (const mode of ['rigging', 'animate', 'deliver']) {
    await page.click(`[data-mode="${mode}"]`);
    const st = await page.evaluate(() => ({
      mode: window.__studioLayout.mode,
      uuid: window.__importer.model.uuid,
      inspectorOpen: window.__studioLayout.inspector.open,
      rgToolbarVisible: !document.getElementById('rg-toolbar').hidden,
      edDockVisible: !document.getElementById('ed-dock').hidden,
      deliverBarVisible: !document.getElementById('st-deliver-bar').hidden,
    }));
    assert.equal(st.mode, mode);
    assert.equal(st.uuid, modelId, 'trocar de modo não recarrega o modelo');
    assert.equal(st.inspectorOpen, false, 'trocar de modo não abre o inspetor automaticamente');
    assert.equal(st.rgToolbarVisible, mode === 'rigging');
    assert.equal(st.edDockVisible, mode === 'animate');
    assert.equal(st.deliverBarVisible, mode === 'deliver');
  }
  await page.click('[data-mode="animate"]');
  step('três modos de trabalho (Rigging, Animar, Preview & Entrega) alternam sem recarregar modelo nem abrir inspetor');

  // ---------- [8.1 #5, #6, #7] Inspetor contextual único e #view nunca encolhe com overlays ----------
  const viewRectBase = await page.evaluate(() => {
    const r = document.getElementById('view').getBoundingClientRect();
    return {x: r.x, y: r.y, width: r.width, height: r.height};
  });
  const checkSingleSidebarAndFixedView = async label => {
    const info = await page.evaluate(() => {
      const r = document.getElementById('view').getBoundingClientRect();
      const visibleAsides = [...document.querySelectorAll('aside')].filter(a => !a.hidden && a.offsetParent && getComputedStyle(a).visibility !== 'hidden').map(a => a.id || a.className);
      return {rect: {x: r.x, y: r.y, width: r.width, height: r.height}, visibleAsides};
    });
    assert.ok(info.visibleAsides.length <= 1, `nunca duas barras laterais simultâneas (${label}): ${info.visibleAsides.join(',')}`);
    if (info.visibleAsides.length === 1) assert.equal(info.visibleAsides[0], 'st-inspector');
    assert.equal(info.rect.width, viewRectBase.width, `#view width constante em ${label}`);
    assert.equal(info.rect.height, viewRectBase.height, `#view height constante em ${label}`);
  };

  // Contexto 'clips' e seleção de clipe -> contexto 'clip'
  await page.click('#st-open-clips');
  assert.equal(await page.evaluate(() => window.__studioLayout.inspector.kind), 'clips');
  await checkSingleSidebarAndFixedView('clips');
  await page.click('.v6-clip[data-clip="0"]');
  assert.equal(await page.evaluate(() => window.__studioLayout.inspector.kind), 'clip');
  await checkSingleSidebarAndFixedView('clip');

  // Em 'rigging', selecionar um osso abre o contexto 'bone'
  await page.click('[data-mode="rigging"]');
  assert.equal(await page.evaluate(() => window.__studioLayout.inspector.open), false);
  await page.evaluate(() => window.__studioRig.select('mixamorigHead'));
  assert.deepEqual(await page.evaluate(() => window.__studioLayout.inspector), {open: true, kind: 'bone', targetId: 'mixamorigHead'});
  await checkSingleSidebarAndFixedView('bone');

  // De volta a 'animate', expandir timeline e clicar na ferramenta 'events' abre o contexto 'event'
  await page.click('[data-mode="animate"]');
  await ensureTimelineExpanded(true);
  await checkSingleSidebarAndFixedView('timeline-expanded');
  await page.click('[data-tool="events"]');
  assert.equal(await page.evaluate(() => window.__studioLayout.inspector.kind), 'event');
  await checkSingleSidebarAndFixedView('event');

  // Clicar no fundo vazio do #view fecha o inspetor quando aberto, e clicar novamente abre 'scene'
  await page.mouse.click(viewRectBase.x + 120, viewRectBase.y + 120);
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.__studioLayout.inspector.open), false, 'clique no palco fecha inspetor aberto');
  await page.mouse.click(viewRectBase.x + 120, viewRectBase.y + 120);
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.__studioLayout.inspector.kind), 'scene', 'clique no palco vazio abre contexto scene');
  await checkSingleSidebarAndFixedView('scene');
  await page.click('#st-inspector-close');
  await ensureTimelineExpanded(false);
  step('inspetor contextual único (clip, bone, event, scene), no máximo 1 aside visível e #view nunca encolhe com overlays');

  // ---------- [8.1 #8 & #9] Pílula e overlay da timeline + Auto-recolhimento e atenuação no Play ----------
  // Garantir que está pausado antes de testar a pílula
  if (await page.evaluate(() => window.__importer.playing)) await page.click('#play');
  const pillMetrics = await page.evaluate(() => {
    const pill = document.querySelector('#ed-dock .ed-pill').getBoundingClientRect();
    const canvasVisible = !document.querySelector('#ed-dock .ed-full').hidden && document.getElementById('ed-canvas').offsetParent !== null;
    return {pillH: pill.height, canvasVisible};
  });
  assert.ok(pillMetrics.pillH >= 36 && pillMetrics.pillH <= 44, `pílula da timeline <= 44px: ${pillMetrics.pillH}`);
  assert.equal(pillMetrics.canvasVisible, false, '#ed-canvas oculto na pílula');

  await ensureTimelineExpanded(true);
  const expandedMetrics = await page.evaluate(() => {
    const dock = document.getElementById('ed-dock').getBoundingClientRect();
    const stage = document.querySelector('.stage').getBoundingClientRect();
    const canvasVisible = document.getElementById('ed-canvas').offsetParent !== null;
    return {dockH: dock.height, stageH: stage.height, ratio: dock.height / stage.height, canvasVisible};
  });
  assert.equal(expandedMetrics.canvasVisible, true, '#ed-canvas visível na timeline expandida');
  assert.ok(expandedMetrics.ratio <= 0.38, `timeline expandida <= 38% do palco: ${expandedMetrics.ratio}`);

  // Auto-recolhimento no Play quando não fixada (pinned === false)
  await page.mouse.move(10, 10); // tira o mouse de cima da pílula
  await page.click('#play');
  await page.mouse.move(10, 10);
  await page.waitForTimeout(260); // aguarda transição de opacidade
  const playUnpinned = await page.evaluate(() => {
    const pill = document.querySelector('#ed-dock .ed-pill');
    return {
      playing: window.__importer.playing,
      expanded: window.__studioLayout.timeline.expanded,
      opacity: parseFloat(getComputedStyle(pill).opacity),
    };
  });
  assert.equal(playUnpinned.playing, true);
  assert.equal(playUnpinned.expanded, false, 'Play recolhe a timeline quando não fixada');
  assert.ok(playUnpinned.opacity < 0.7, `pílula atenuada durante Play (~0.55): ${playUnpinned.opacity}`);

  // Hover na pílula restaura opacidade 1.0
  const pillBox = await page.locator('#ed-dock .ed-pill').boundingBox();
  await page.mouse.move(pillBox.x + pillBox.width / 2, pillBox.y + pillBox.height / 2);
  await page.waitForTimeout(240);
  const hoverOpacity = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#ed-dock .ed-pill')).opacity));
  assert.ok(hoverOpacity > 0.95, `hover restaura opacidade 1.0: ${hoverOpacity}`);
  await page.click('#play'); // pausa

  // Com pinned === true (#ed-pin), clicar em Play mantém a timeline expandida
  await page.click('#ed-pin');
  await ensureTimelineExpanded(true);
  await page.click('#play');
  const playPinned = await page.evaluate(() => ({
    playing: window.__importer.playing,
    pinned: window.__studioLayout.timeline.pinned,
    expanded: window.__studioLayout.timeline.expanded,
  }));
  assert.equal(playPinned.playing, true);
  assert.equal(playPinned.pinned, true);
  assert.equal(playPinned.expanded, true, 'Play com pin ativo mantém a timeline expandida');
  await page.click('#play'); // pausa
  await page.click('#ed-pin'); // desativa pin
  step('pílula (<=44px) e overlay (<=38%) da timeline; auto-recolhimento e opacidade 0.55 no Play + override de pin');

  // ---------- [8.1 #12] HUD compacto (4 botões, popovers e sem sobreposição com inspetor) ----------
  const hudCount = await page.locator('#st-hud > .st-hud-item').count();
  assert.ok(hudCount <= 4, `HUD contém no máximo 4 botões de topo: ${hudCount}`);
  await page.click('#st-hud-camera-btn');
  assert.equal(await page.isVisible('#st-hud-camera-pop'), true);
  await page.click('#st-hud-scene-btn');
  assert.equal(await page.isVisible('#st-hud-camera-pop'), false);
  assert.equal(await page.isVisible('#st-hud-scene-pop'), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#st-hud-scene-pop'), false);
  // Abrir inspetor e verificar não sobreposição entre #st-hud e #st-inspector
  await page.click('#st-open-clips');
  await page.waitForTimeout(220);
  const hudNoOverlap = await page.evaluate(() => {
    const h = document.getElementById('st-hud').getBoundingClientRect();
    const i = document.getElementById('st-inspector').getBoundingClientRect();
    return {hudRight: h.right, inspectorLeft: i.left};
  });
  assert.ok(hudNoOverlap.hudRight <= hudNoOverlap.inspectorLeft, `HUD não sobrepõe o inspetor (${hudNoOverlap.hudRight} <= ${hudNoOverlap.inspectorLeft})`);
  step('HUD de 4 botões com popovers (Câmera, Luz/Grid, Raio-X, Zen) e deslocamento sem sobrepor o inspetor');

  // ---------- [8.1 #10 & #11] Modo Zen unificado (.st-zen) e ausência de .v4-focus legado ----------
  const hasLegacyFocus = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules || []) {
        if (rule.selectorText && rule.selectorText.includes('.v4-focus')) return true;
      }
    }
    return document.querySelector('.v4-focus') !== null;
  });
  assert.equal(hasLegacyFocus, false, 'ausência de modo foco legado (.v4-focus) concorrente');

  // Entrar em Modo Zen com inspetor 'clips' aberto e timeline expandida
  await ensureTimelineExpanded(true);
  await page.click('#v4-focus'); // botão Zen no HUD
  const zenState = await page.evaluate(() => {
    const v = document.getElementById('view').getBoundingClientRect();
    const top = document.querySelector('header.topbar');
    const status = document.getElementById('st-statusbar');
    const hud = document.getElementById('st-hud');
    return {
      zen: window.__studioLayout.zen,
      hasClass: document.body.classList.contains('st-zen'),
      viewRatio: (v.width * v.height) / (window.innerWidth * window.innerHeight),
      topHidden: getComputedStyle(top).display === 'none' || getComputedStyle(top).opacity === '0' || getComputedStyle(top).pointerEvents === 'none',
      statusHidden: getComputedStyle(status).display === 'none' || getComputedStyle(status).opacity === '0' || getComputedStyle(status).pointerEvents === 'none',
      hudHidden: getComputedStyle(hud).display === 'none' || getComputedStyle(hud).opacity === '0' || getComputedStyle(hud).pointerEvents === 'none',
      inspectorHidden: document.getElementById('st-inspector').hidden,
      dockHidden: document.getElementById('ed-dock').hidden,
    };
  });
  assert.equal(zenState.zen, true);assert.equal(zenState.hasClass, true);
  assert.ok(zenState.viewRatio >= 0.98, `#view >= 98% da janela em Modo Zen: ${zenState.viewRatio}`);
  assert.equal(zenState.topHidden, true);assert.equal(zenState.statusHidden, true);
  assert.equal(zenState.hudHidden, true);assert.equal(zenState.inspectorHidden, true);assert.equal(zenState.dockHidden, true);

  // Qualquer tecla sai do Modo Zen e restaura exatamente mode, inspector e timeline sem efeitos colaterais
  await page.keyboard.press('Space');
  const afterKeyExit = await page.evaluate(() => ({
    zen: window.__studioLayout.zen,
    playing: window.__importer.playing,
    mode: window.__studioLayout.mode,
    inspector: window.__studioLayout.inspector,
    timelineExpanded: window.__studioLayout.timeline.expanded,
  }));
  assert.equal(afterKeyExit.zen, false);
  assert.equal(afterKeyExit.playing, false, 'tecla usada para sair do Zen não dispara Play colateral');
  assert.equal(afterKeyExit.mode, 'animate');
  assert.equal(afterKeyExit.inspector.open, true);assert.equal(afterKeyExit.inspector.kind, 'clips');
  assert.equal(afterKeyExit.timelineExpanded, true);

  // Ativar Zen por tecla 'f' e sair com clique; ativar por 'Tab' e por duplo-clique em #view
  await page.keyboard.press('f');assert.equal(await page.evaluate(() => window.__studioLayout.zen), true);
  await page.mouse.click(200, 200);assert.equal(await page.evaluate(() => window.__studioLayout.zen), false);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(() => window.__studioLayout.zen), true);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(() => window.__studioLayout.zen), false);
  await page.dblclick('#view', {position: {x: 200, y: 200}});assert.equal(await page.evaluate(() => window.__studioLayout.zen), true);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(() => window.__studioLayout.zen), false);
  step('Modo Zen unificado (botão HUD, Tab, F, duplo-clique) com >=98% viewport e restauração exata sem efeitos colaterais');

  // ---------- [8.1 #13] Ajuda progressiva (?) e zero parágrafos instrutivos fixos (.st-hint) ----------
  assert.equal(await page.locator('.st-hint').count(), 0, 'zero .st-hint fixos no DOM');
  await page.click('#st-project-btn');
  const helpBtn = page.locator('#st-inspector [data-section="project"] .st-help-trigger[data-help]').first();
  await helpBtn.focus();
  assert.equal(await page.isVisible('#st-tooltip'), true, 'focar em ? exibe #st-tooltip');
  assert.match(await page.textContent('#st-tooltip'), /\.arenamon\.glb/);
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#st-tooltip'), false, 'Escape oculta #st-tooltip');
  step('ajuda progressiva (?) acessível por foco/hover/Escape e zero .st-hint fixos no DOM');

  // ---------- Renomear clipes pela interface ----------
  await page.click('#st-open-clips');
  await page.click('#v6-rename-options summary');
  for (const [i, name] of [[0, 'idle'], [1, 'run'], [2, 'tackle']]) {await page.selectOption('#clip', String(i));await page.fill('#clip-name', name);await page.click('#rename-clip');}
  await page.selectOption('#clip', '3');await page.fill('#clip-name', 'tackle');await page.click('#rename-clip');
  assert.equal(await page.evaluate(() => window.__importer.clips[3].name), 'dup.fbx', 'nome duplicado rejeitado');
  step('renomear clipes e rejeitar nome duplicado');

  // ---------- Timeline ----------
  await ensureTimelineExpanded(true);
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
  await page.evaluate(() => window.__importer.selectIndex(2));await page.evaluate(() => {const ed = window.__studioEditor;ed.addEvent('hitbox_on', 8 / 30);ed.addEvent('recovery_start', 22 / 30);});
  // Arrastar um evento na faixa Eventos da timeline (quadro 8 → 12) e desfazer.
  await page.click('#ed-fit');const cbox = await page.locator('#ed-canvas').boundingBox(), xAt = t => cbox.x + 92 + t * (cbox.width - 92 - 18) / 3, laneY = cbox.y + 26 + 24 + 14;
  await page.mouse.move(xAt(8 / 30), laneY);await page.mouse.down();await page.mouse.move(xAt(10 / 30), laneY, {steps: 4});await page.mouse.move(xAt(12 / 30), laneY, {steps: 4});await page.mouse.up();
  assert.deepEqual(await page.evaluate(() => window.__importer.selectedClip.userData.arenamon.events.map(e => Math.round(e.time * 30))), [12, 22], 'evento arrastado');
  await page.click('#ed-undo');assert.deepEqual(await page.evaluate(() => window.__importer.selectedClip.userData.arenamon.events.map(e => Math.round(e.time * 30))), [8, 22]);
  step('eventos: adicionar, editar quadro/nome, arrastar na timeline, excluir, desfazer', events);

  // ---------- Root motion ----------
  await page.evaluate(() => window.__importer.selectIndex(1));await page.click('[data-tool="root"]');await page.waitForTimeout(50);
  const metrics = await page.evaluate(() => window.__studioEditor.analysis().metrics);
  assert.ok(Math.abs(metrics.dz - 3) < 1e-3, 'deslocamento medido em metros do modelo (3 m)');assert.ok(Math.abs(metrics.yawDegrees - 90) < .1);
  assert.equal(await page.inputValue('#ed-root-h'), '0');await page.click('#ed-root-new');
  state = await page.evaluate(() => {const E = window.__importer, c = E.selectedClip, hips = E.model.getObjectByName('mixamorigHips'), p = c.tracks.find(t => t.name === hips.uuid + '.position').values;
    const xs = [], zs = [], ys = [];for (let i = 0; i < p.length; i += 3) {xs.push(p[i]);ys.push(p[i + 1]);zs.push(p[i + 2]);}return {name: c.name, x: [Math.min(...xs), Math.max(...xs)], z: [Math.min(...zs), Math.max(...zs)], y: [Math.min(...ys), Math.max(...ys)], rm: c.userData.arenamon.rootMotion, srcZ: E.clips[1].tracks.find(t => t.name === hips.uuid + '.position').values.at(-1)};});
  assert.equal(state.name, 'run · in-place');assert.ok(state.x[1] - state.x[0] < 1e-6 && state.z[1] - state.z[0] < 1e-6, 'sem deslocamento horizontal');assert.ok(state.y[1] - state.y[0] > 3, 'altura preservada');
  assert.equal(state.rm.inPlace, true);assert.ok(Math.abs(state.rm.original.metrics.dz - 3) < 1e-3, 'deslocamento original salvo separadamente');assert.ok(Math.abs(state.srcZ - 300) < 1e-3, 'clip original intacto');
  step('root motion: versão in-place exportável com dados de deslocamento separados', {x: state.x, z: state.z, y: state.y});

  // ---------- Tempo: velocidade, duração, loop, restaurar ----------
  await page.evaluate(() => window.__importer.selectIndex(0));await page.click('[data-tool="time"]');
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
  await page.evaluate(() => window.__studioLayout.selectContext('clips'));
  await page.selectOption('#v6-group-select', 'idle');
  await page.dragAndDrop('.v6-clip[data-clip="0"]', '.v6-slot[data-action="idle"]');
  assert.equal(await page.inputValue('#action-idle'), '0', 'arrastar clipe para ação');
  const trimmedIndex = await page.evaluate(() => window.__importer.clips.findIndex(c => c.name === 'tackle · 1.20–1.60s'));
  await page.click(`.v6-clip[data-clip="${trimmedIndex}"]`);await page.selectOption('#v6-action-select', 'tackle');
  await page.evaluate(() => window.__studioLayout.selectContext('clips'));
  const inplaceIndex = await page.evaluate(() => window.__importer.clips.findIndex(c => c.name === 'run · in-place'));
  await page.click(`.v6-clip[data-clip="${inplaceIndex}"]`);await page.selectOption('#v6-action-select', 'run');
  assert.equal(await page.inputValue('#action-tackle'), String(trimmedIndex));
  step('organização por drag & drop e associação de clipes editados a ações');

  // ---------- Comparação ----------
  await page.evaluate(i => window.__importer.selectIndex(i), inplaceIndex);
  await ensureTimelineExpanded(true);
  await page.click('[data-tool="compare"]');
  await page.selectOption('#lab-compare-type', 'original');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__studioV3.compare), true);await page.screenshot({path: out + 'compare-original.png'});
  await page.selectOption('#lab-compare-type', 'clips');await page.selectOption('#ed-cmp-b', '1');await page.selectOption('#ed-cmp-layout', 'overlay');await page.waitForTimeout(150);
  await page.screenshot({path: out + 'compare-overlay.png'});
  await page.selectOption('#ed-cmp-layout', 'side');await page.selectOption('#ed-cmp-sync', 'free');await page.click('#ed-cmp-play');await page.selectOption('#ed-cmp-speed', '0.5');
  await page.selectOption('#lab-compare-type', 'motion');await page.waitForTimeout(100);await page.uncheck('#ed-cmp-on');
  assert.equal(await page.evaluate(() => window.__studioV3.compare), false);
  step('comparação: original × editada, A × B (lado a lado, sobreposição, independente) e tipos da V3');

  // ---------- Regressão v6 (Aparência, Cenário, Câmera, Movimento, Inspeção) ----------
  await page.evaluate(() => window.__studioLayout.selectContext('appearance'));
  await page.click('#textures');assert.equal(await page.isChecked('#textures'), false);assert.equal(await page.textContent('#texturesLabel'), 'Texturas: OFF');await page.click('#textures');
  await page.click('#lighting');assert.equal(await page.isChecked('#lighting'), false);await page.click('#lighting');
  await page.locator('#color').evaluate(el => {el.value = '#ff0000';el.dispatchEvent(new Event('input', {bubbles: true}));});
  assert.equal(await page.inputValue('#palette'), 'global');assert.equal(await page.evaluate(() => window.__importer.model.getObjectByName('Body').material.color.getHexString()), 'ff0000');
  await page.selectOption('#palette', 'palette');
  // Atalhos no popover de Luz/Grid do HUD
  await page.click('#st-hud-scene-btn');
  await page.click('#lab-quick-grid');assert.equal(await page.isChecked('#lab-grid'), false);await page.click('#lab-quick-grid');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__studioLayout.selectContext('scene'));
  await page.check('#lab-dummy');assert.equal(await page.evaluate(() => window.__importer.scene.children.find(o => o.name === 'Arenamon Studio · Alvo técnico').visible), true);
  await page.evaluate(() => window.__studioLayout.selectContext('camera'));
  await page.selectOption('#lab-camera', 'lock');await page.click('#lab-preset');assert.equal(await page.inputValue('#lab-camera'), 'game');
  // Sincronização entre #lab-camera e #lab-quick-camera no popover do HUD
  await page.click('#st-hud-camera-btn');
  assert.equal(await page.inputValue('#lab-quick-camera'), 'game');
  await page.selectOption('#lab-quick-camera', 'free');assert.equal(await page.inputValue('#lab-camera'), 'free');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__studioLayout.selectContext('clip'));
  await page.selectOption('#lab-root-mode', 'original');
  await page.evaluate(() => window.__studioLayout.selectContext('inspect'));
  await page.check('#v4-skeleton');await page.uncheck('#v4-skeleton');
  await page.click('#play');assert.equal(await page.evaluate(() => window.__importer.playing), true);
  await page.click('#play');assert.equal(await page.evaluate(() => window.__importer.playing), false);
  step('regressão: texturas/luz, pintura global, grid, dummy, câmeras, root mode, inspeção, reprodução (no inspetor e HUD)');

  // ---------- Exportação ----------
  const tackleAt = await page.evaluate(() => window.__importer.clips[2].userData.arenamon.events.map(e => e.type));
  assert.deepEqual(tackleAt, ['hitbox_on', 'recovery_start']);
  await page.click('#st-top-export');assert.equal(await page.isVisible('#export'), true, 'Exportar abre o contexto export');
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
  await page.evaluate(() => {window.__picker.mode = 'ok';});
  // [8.1 #15] Configurar preferências para verificar persistência de layout v8 após reload
  await page.click('[data-mode="deliver"]');
  await page.click('#st-top-save');await page.waitForFunction(() => document.getElementById('st-save').dataset.state === 'saved');
  assert.match(await page.textContent('#st-save-text'), /Projeto salvo às/);const projectPath = await lastSaved(out + 'projeto.arenamon.glb');
  assert.match(await page.evaluate(() => window.__picker.files.at(-1).name), /\.arenamon\.glb$/);
  assert.equal(await reloadAttempt(), false, 'sem aviso depois de salvar');
  await page.waitForFunction(() => window.__importer && window.__studioEditor && window.__studioLayout);
  const persistedLayout = await page.evaluate(() => ({
    mode: window.__studioLayout.mode,
    raw: JSON.parse(localStorage.getItem('arenamon-studio-ui-v8') || 'null'),
  }));
  assert.equal(persistedLayout.mode, 'deliver', 'modo preservado em arenamon-studio-ui-v8 após reload');
  assert.ok(persistedLayout.raw && persistedLayout.raw.mode === 'deliver');
  await page.click('[data-mode="animate"]');
  step('salvar/sair e persistência v8: beforeunload, diálogo, salvar projeto e preservar arenamon-studio-ui-v8 após reload');

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
  await page.evaluate(i => window.__importer.selectIndex(i), trimmedIndex);
  await ensureTimelineExpanded(true);
  await page.click('[data-tool="events"]');assert.equal(await page.locator('.ed-event').count(), 2);
  step('reimportação: recorte, eventos, in-place, nomes, associações, hierarquia e skinning preservados', re);

  // ---------- Recuperação local após fechar sem salvar ----------
  await page.evaluate(() => {window.__importer.selectIndex(0);window.__studioEditor.setSpeed(200);});assert.equal(await saveState(), 'dirty');
  await page.waitForFunction(() => /cópia neste navegador/.test(document.getElementById('st-info-recovery').textContent), null, {timeout: 20000});
  page.__acceptUnload = true;await page.evaluate(() => location.reload());await page.waitForFunction(() => window.__importer && window.__studioEditor && window.__studioLayout);page.__acceptUnload = false;
  assert.ok(dialogs.includes('beforeunload'));
  // Caso o inspetor de projeto esteja fechado, clicar em Projeto para ver o cartão de recuperação
  if (!(await page.isVisible('#st-recovery'))) await page.click('#st-project-btn');
  await page.waitForSelector('#st-recovery:not([hidden])');assert.match(await page.textContent('#st-recovery-text'), /animações/);
  await page.click('#st-recovery-open');await page.waitForFunction(n => window.__importer.clips.length === n, expected.length);
  await page.waitForFunction(() => document.getElementById('st-save').dataset.state === 'dirty' && /recuperada/.test(document.getElementById('st-save').title + document.getElementById('st-info-state').textContent));
  assert.equal(await page.evaluate(() => window.__importer.clips[0].duration), 1, 'edição recuperada');assert.equal(await page.isVisible('#st-recovery'), false);
  assert.equal(await page.evaluate(n => window.__importer.clips[n].userData.arenamon.events.length, trimmedIndex), 2);
  await page.evaluate(() => window.__studioProject.clearRecovery());
  step('recuperação local: cópia gravada no IndexedDB, oferecida após recarregar e restaurada com as edições');

  // ---------- Preview visível e Capturas Obrigatórias (Seção 8.1 #14 & Seção 8.2) ----------
  await page.click('#st-hud-camera-btn');await page.selectOption('#lab-quick-camera', 'free');await page.click('#frame');await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const png = (await page.locator('#view canvas').screenshot()).toString('base64');
  const visible = await page.evaluate(async png => {const img = new Image();img.src = 'data:image/png;base64,' + png;await img.decode();const c = document.createElement('canvas');c.width = img.width;c.height = img.height;const g = c.getContext('2d');g.drawImage(img, 0, 0);const d = g.getImageData(0, 0, c.width, c.height).data;let n = 0;for (let i = 0; i < d.length; i += 4) if (d[i] > 120 && d[i + 1] < 140) n++;return n / (c.width * c.height);}, png);
  assert.ok(visible > .003, 'personagem visível no preview: ' + visible);
  await page.screenshot({path: out + 'studio.png'});

  // Capturas em 1920x1080 e 1366x768 nos modos exigidos na Seção 8.2
  for (const vp of [{width: 1920, height: 1080}, {width: 1366, height: 768}]) {
    const tag = `${vp.width}x${vp.height}`;
    await page.setViewportSize(vp);await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'sem rolagem horizontal em ' + tag);
    assert.ok(await canvasMatches(), 'canvas em ' + tag);

    // 1. Modo Rigging com gizmo/marcadores visíveis
    await page.click('[data-mode="rigging"]');await page.waitForTimeout(120);
    await page.screenshot({path: out + `${tag}-rigging.png`});

    // 2. Modo Animar padrão (pílula flutuante e viewport limpo)
    await page.click('[data-mode="animate"]');
    await ensureTimelineExpanded(false);
    await page.evaluate(() => window.__studioLayout.closeInspector());
    await page.waitForTimeout(120);
    await page.screenshot({path: out + `${tag}-animate-pill.png`});

    // 3. Modo Animar com timeline expandida + inspetor contextual de clipe aberto
    await ensureTimelineExpanded(true);
    await page.evaluate(() => window.__studioLayout.selectContext('clip', 0));
    await page.waitForTimeout(150);
    await page.screenshot({path: out + `${tag}-animate-expanded-clip.png`});

    // 4. Modo Preview & Entrega
    await page.click('[data-mode="deliver"]');await page.waitForTimeout(120);
    await page.screenshot({path: out + `${tag}-deliver.png`});

    // 5. Modo Zen (100% viewport)
    await page.evaluate(() => window.__studioLayout.enterZen());await page.waitForTimeout(120);
    await page.screenshot({path: out + `${tag}-zen.png`});
    await page.evaluate(() => window.__studioLayout.exitZen());
  }

  // Responsividade em Tablet (1024x768) e Mobile (390x844)
  await page.click('[data-mode="animate"]');
  await ensureTimelineExpanded(false);
  await page.evaluate(() => window.__studioLayout.closeInspector());
  for (const viewport of [{width: 1024, height: 768}, {width: 390, height: 844}]) {
    await page.setViewportSize(viewport);await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'sem rolagem horizontal em ' + viewport.width);
    const topH = await page.evaluate(() => document.querySelector('header.topbar').getBoundingClientRect().height);
    assert.ok(topH <= 48, `topbar <= 48px em ${viewport.width}: ${topH}`);
    assert.ok(await canvasMatches(), 'canvas em ' + viewport.width);
    await page.screenshot({path: out + `after-${viewport.width}.png`});
  }
  await page.setViewportSize({width: 1500, height: 960});
  step('preview visível, capturas obrigatórias (1920x1080, 1366x768, 1024x768, 390x844) e responsividade sem rolagem horizontal');

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
  await writeFile(out + 'report.json', JSON.stringify(report, null, 2));
  console.log(`\nAnimation Studio: ${report.steps.length} verificações de navegador aprovadas.`);
} finally {await browser.close();}
