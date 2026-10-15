// Teste de navegador do laboratório de combate (Etapa A) (Edge, sem rede).
// Uso: node prototypes/combat-lab/verify.mjs (requer `npm run build`: usa também o HTML do Animation Studio
// para gerar um GLB de personagem com mapa de ações e eventos de combate).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('.', import.meta.url)), out = root + 'validation/';
const studioHtml = fileURLToPath(new URL('../studio/dist/arenamon-animation-studio.html', import.meta.url));
const fixture = await readFile(new URL('../studio/test/fixture.js', import.meta.url), 'utf8');
const report = {steps: [], errors: [], network: []};
const step = (name, data = true) => {report.steps.push({name, result: data});console.log('✓', name);};
await mkdir(out, {recursive: true});
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  // ---------- 1. Personagem de teste criado no Animation Studio (integração real) ----------
  const studio = await browser.newPage();studio.on('pageerror', e => report.errors.push('studio: ' + e.message));
  await studio.goto(pathToFileURL(studioHtml).href);await studio.waitForFunction(() => window.__studioEditor && window.__importer);
  const glbBase64 = await studio.evaluate(async src => {
    const {syntheticRig} = await import('data:text/javascript,' + encodeURIComponent(src));const E = window.__importer, ed = window.__studioEditor, r = syntheticRig(E.T);
    r.clips[0].name = 'idle';r.clips[1].name = 'run';r.clips[2].name = 'tackle';await E.install(r.root, r.clips, 'personagem-teste.glb');
    const set = (id, i) => {const s = document.getElementById('action-' + id);s.value = String(i);s.dispatchEvent(new Event('change', {bubbles: true}));};
    set('idle', 0);set('run', 1);set('walk', 1);set('tackle', 2);set('dodge_forward', 1);set('knockback', 2);
    E.selectIndex(2);ed.addEvent('invulnerable_start', 0);ed.addEvent('invulnerable_end', 1.5);ed.addEvent('hitbox_on', .6);ed.addEvent('hitbox_off', 2.4);ed.addEvent('impact', .9);
    const bytes = new Uint8Array(await E.exportGLB({unlit: false, noTextures: true}));let s = '';for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));return btoa(s);
  }, fixture);
  await writeFile(out + 'personagem-studio.glb', Buffer.from(glbBase64, 'base64'));await studio.close();
  step('GLB de teste gerado pelo Animation Studio (mapa de ações + eventos de combate)');

  // ---------- Laboratório ----------
  const page = await browser.newPage({viewport: {width: 1500, height: 920}, acceptDownloads: true});
  await page.addInitScript(() => {
    // Gamepad simulado: o teste controla quais botões estão pressionados.
    window.__pad = {buttons: Array.from({length: 17}, () => ({pressed: false})), axes: [0, 0, 0, 0], id: 'Gamepad de teste'};
    navigator.getGamepads = () => window.__padOn ? [window.__pad] : [];
  });
  page.on('pageerror', e => report.errors.push(e.message));page.on('console', m => {if (m.type() === 'error') report.errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) report.network.push(r.url());});
  const dialogs = [];page.on('dialog', d => {dialogs.push(d.type());(d.type() === 'beforeunload' && page.__acceptUnload) || (d.type() === 'confirm' && page.__acceptConfirm) ? d.accept() : d.dismiss();});
  await page.context().setOffline(true);
  const url = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
  await page.goto(url);await page.waitForFunction(() => window.__lab);
  const L = fn => page.evaluate(fn);
  // Abre uma aba do painel sem alternar (clicar na aba já aberta a recolhe).
  const openTab = t => page.evaluate(t => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== t) document.querySelector(`[data-tool="${t}"]`).click();}, t);
  assert.equal(await L(() => window.__lab.game.phase), 'menu');assert.equal(await page.isVisible('#menu'), true);
  step('abre offline no menu, sem erros');
  // IA tática: padrão do adversário e da IA do jogador; estilo sorteado aparece nos dados ao vivo.
  assert.equal(await page.inputValue('#mode'), 'tactical');assert.equal(await page.inputValue('#player-mode'), 'tactical');
  await page.click('#start-center');await page.click('#arena-autoplay-toggle');await page.waitForTimeout(1500);
  const live = await L(() => ({style: window.__lab.game.brain.t?.style?.label, blue: window.__lab.game.playerBrain.t?.style?.label, ticks: window.__lab.game.tick}));
  assert.ok(live.style && live.blue && live.ticks > 100, JSON.stringify(live));
  await page.click('[data-tool="overlays"]');assert.match(await page.textContent('#live-data'), new RegExp(`Estilo da IA[\\s\\S]*${live.blue}[\\s\\S]*${live.style}`));
  await page.click('#arena-autoplay-toggle');await L(() => {window.__lab.togglePause(true);window.__lab.tuning.resetAll();window.__lab.tuning.markSaved('teste');});
  step(`IA tática por padrão: estilos sorteados “${live.blue}” (azul) × “${live.style}” (vermelho), visíveis nos dados ao vivo`);

  // ---------- 6/10. Ajustador ----------
  await page.click('[data-tool="tuning"]');
  assert.match(await page.textContent('#tune-counter'), /de \d+ · \d+ ≠ jogo/);
  // Aba “X e C”: parâmetros independentes da esquiva, do tackle e do cancelamento.
  assert.match(await page.locator('#tune-tabs [role=tab]').first().textContent(), /^X e C · \d+$/);
  for (const id of ['#tune-actions-dodge-duration', '#tune-actions-tackle-duration', '#tune-actions-cancel-windowStart', '#tune-actions-cancel-invulnerability', '#tune-actions-buffer-window']) assert.ok(await page.isVisible(id), id);
  assert.match(await page.textContent('#tune-list'), /Esquiva \(C\)[\s\S]*Tackle \(X\)[\s\S]*Cancelamento C → X/);
  await page.locator('#tune-actions-tackle-duration').fill('0.5');await page.locator('#tune-actions-tackle-duration').dispatchEvent('change');
  assert.deepEqual(await L(() => [window.__lab.C.actions.tackle.duration, window.__lab.C.actions.dodge.duration]), [.5, .4], 'slider de X não altera C');
  await L(() => window.__lab.tuning.undo());
  await page.fill('#tune-search', 'gravidade');assert.ok(await page.locator('.tune-control').count() >= 1);
  await page.fill('#tune-search', '');await page.click('[data-filter="experimental"]');const exp = await page.locator('#tune-list .tune-control').count();assert.ok(exp >= 1, `≠ jogo: ${exp}`);
  const arena = page.locator('#tune-test-arenaHalf');await arena.focus();await page.keyboard.press('ArrowLeft');
  assert.equal(await L(() => window.__lab.C.test.arenaHalf), 15);assert.equal(await page.getAttribute('#tune-state', 'data-state'), 'dirty');
  await page.click('#tune-undo');assert.equal(await L(() => window.__lab.C.test.arenaHalf), 16);await page.click('#tune-redo');assert.equal(await L(() => window.__lab.C.test.arenaHalf), 15);
  // “= jogo” usa o valor do config.ts.
  await page.locator('.tune-control', {has: page.locator('#tune-test-speed')}).getByRole('button', {name: '= jogo'}).click();
  assert.equal(await L(() => window.__lab.C.test.speed), 4);
  await page.click('[data-filter="changed"]');assert.equal(await page.locator('.tune-control.changed').count(), 2);
  await page.click('[data-filter="all"]');
  // Presets e comparação.
  await page.fill('#preset-name', 'Teste A');await page.click('#preset-save');assert.equal(await page.getAttribute('#tune-state', 'data-state'), 'saved');
  await page.selectOption('#preset-a', 'Teste A');await page.selectOption('#preset-b', '__lab');await page.click('#preset-compare');
  assert.equal(await page.locator('#preset-diff tr').count(), 3);
  await page.selectOption('#preset-b', '__game');await page.click('#preset-compare');assert.ok(await page.locator('#preset-diff tr').count() > 3);
  step('ajustador: busca, filtros (≠ jogo, alterados), desfazer/refazer, “= jogo”, presets e comparação');

  // ---------- 10. Exportação, importação e relatório ----------
  await page.click('[data-tool="export"]');
  assert.match(await page.textContent('#game-diff'), /Metade do lado da arena/);
  let pending = page.waitForEvent('download');await page.click('#export-json');const json = JSON.parse(await readFile(await (await pending).path(), 'utf8'));
  assert.equal(json.schema, 'arenamon-tuning');assert.equal(json.version, 9);assert.ok(json.values.vfx?.hit && json.values.display?.shadow && json.values.actions.sprint);assert.equal(json.homologation.summary.total, 17);assert.ok(json.values.actions.dodge && json.values.actions.tackle && json.values.actions.cancel);assert.equal(json.values.test.arenaHalf, 15);
  assert.ok(json.differencesFromGame.some(d => d.path === 'test.arenaHalf' && d.game === 10 && d.lab === 15));assert.ok(!json.differencesFromGame.some(d => d.path === 'test.speed'));
  // Importar um JSON v6 (formato antigo) com valor inválido: rejeitado sem aplicar nada.
  await page.fill('#import-text', JSON.stringify({schema: 'arenamon-tuning-v5', version: 6, values: {rules: {dodge: .5, launchUp: 999}}}));await page.click('#import-preview');
  assert.match(await page.textContent('#import-result'), /fora da faixa/);assert.equal(await L(() => window.__lab.C.actions.dodge.duration), .4);
  await page.fill('#import-text', JSON.stringify({schema: 'arenamon-tuning-v5', version: 6, values: {rules: {dodge: .5}, test: {arenaHalf: 16, speed: 4.8}}}));await page.click('#import-preview');
  // rules.dodge (v6) vira as durações de C e de X, com relatório de migração.
  const importText = await page.textContent('#import-result');
  assert.match(importText, /Migração de formato antigo/);assert.match(importText, /rules\.dodge/);assert.match(importText, /actions\.tackle\.duration/);assert.match(importText, /4 parâmetros mudariam/);
  await page.click('#import-apply');
  assert.deepEqual(await L(() => [window.__lab.C.actions.dodge.duration, window.__lab.C.actions.tackle.duration, window.__lab.C.test.arenaHalf, window.__lab.C.test.speed]), [.5, .5, 16, 4.8]);
  await L(() => window.__lab.tuning.undo());assert.equal(await L(() => window.__lab.C.actions.dodge.duration), .4);
  await page.click('[data-tool="tuning"]');await page.click('#reset-all');await page.click('[data-tool="export"]');assert.equal(await L(() => window.__lab.C.test.speed), 4.8);
  step('exportação v8 com diferenças do jogo, importação v6 migrada e validada (pré-visualizar, aplicar, desfazer) e restaurar padrões');

  // Aviso ao sair e sessão anterior.
  await L(() => window.__lab.tuning.commit([['rules.launchUp', 8]], 'teste'));assert.equal(await page.getAttribute('#tune-state', 'data-state'), 'dirty');
  page.__acceptUnload = true;await L(() => location.reload());await page.waitForFunction(() => window.__lab);page.__acceptUnload = false;
  assert.ok(dialogs.includes('beforeunload'), 'aviso nativo ao recarregar com ajustes não exportados');
  await page.click('[data-tool="tuning"]');await page.waitForSelector('#session-banner');await page.click('#session-restore');assert.equal(await L(() => window.__lab.C.rules.launchUp), 8);
  await L(() => {window.__lab.tuning.resetAll();window.__lab.tuning.markSaved('teste');});
  step('aviso de ajustes não exportados ao recarregar e restauração da sessão anterior');

  // ---------- 5. Cenários ----------
  await page.click('[data-tool="scenarios"]');await page.click('#scenario-all');
  assert.match(await page.textContent('#scenario-report'), /8 de 8 cenários aprovados/);
  await page.locator('.scenario[data-id="clash"] button').click();
  await page.waitForFunction(() => !window.__lab.ui.scenario && window.__lab.ui.lastResult?.id === 'clash', null, {timeout: 15000});
  assert.equal(await L(() => window.__lab.ui.lastResult.ok), true);assert.equal(await page.getAttribute('.scenario[data-id="clash"]', 'data-result'), 'ok');
  step('cenários: 8/8 aprovados (instantâneo) e clash executado ao vivo com relatório');

  // ---------- 4. Replay, passo a passo e câmera lenta ----------
  const ticks = await L(() => window.__lab.replay.length);assert.ok(ticks > 100);
  await page.click('#rp-back');await page.click('#rp-back');const t1 = await L(() => window.__lab.game.tick);
  const s1 = await L(() => JSON.stringify(window.__lab.game.fighters.map(f => [f.position, f.hp, f.state])));
  for (let i = 0; i < 20; i++) await page.click('#rp-back');assert.equal(await L(() => window.__lab.game.tick), t1 - 20);
  for (let i = 0; i < 20; i++) await page.click('#rp-fwd');assert.equal(await L(() => window.__lab.game.tick), t1);
  assert.equal(await L(() => JSON.stringify(window.__lab.game.fighters.map(f => [f.position, f.hp, f.state]))), s1, 'estado restaurado exatamente');
  const box = await page.locator('#timeline').boundingBox();await page.mouse.click(box.x + 84 + (box.width - 92) * .3, box.y + 20);
  assert.ok(await L(() => window.__lab.game.tick) < t1, 'clique na linha do tempo volta no tempo');assert.equal(await page.isVisible('#replay-badge'), true);
  await page.keyboard.press('Period');const t2 = await L(() => window.__lab.game.tick);await page.keyboard.press('Comma');assert.equal(await L(() => window.__lab.game.tick), t2 - 1);
  step('replay: voltar/avançar passo a passo com estado idêntico, busca pela linha do tempo e atalhos , e .');
  await openTab('match');await page.click('#start');
  await page.selectOption('#rp-speed', '0.25');let a = await L(() => window.__lab.game.tick);await page.waitForTimeout(1000);let b = await L(() => window.__lab.game.tick);
  await page.selectOption('#rp-speed', '1');const c0 = await L(() => window.__lab.game.tick);await page.waitForTimeout(1000);const c1 = await L(() => window.__lab.game.tick);
  assert.ok((b - a) < (c1 - c0) * .45, `câmera lenta: ${b - a} × ${c1 - c0} passos/s`);
  // Retomar a partir do passado descarta o futuro gravado (ramificação).
  await page.click('#pause');for (let i = 0; i < 30; i++) await page.click('#rp-back');const branch = await L(() => window.__lab.game.tick);await page.click('#rp-play');await page.waitForTimeout(200);
  assert.ok(await L(() => window.__lab.recorder.samples.every((s, i, all) => i === 0 || s.tick > all[i - 1].tick)), 'telemetria sem passos duplicados após ramificar');
  assert.ok(await L(() => window.__lab.replay.atEnd));void branch;
  step(`câmera lenta (0,25×: ${b - a} passos/s × ${c1 - c0} a 1×) e retomada a partir do passado`);

  // ---------- 9. Controles: IA, gamepad, histórico ----------
  await openTab('match');await page.selectOption('#player-mode', 'random');await page.fill('#seed', '7');await page.press('#seed', 'Tab');
  await page.click('[data-difficulty="hard"]');assert.equal(await L(() => window.__lab.C.extras.ai.attackRange), 3.8);await L(() => window.__lab.tuning.undo());assert.equal(await L(() => window.__lab.C.extras.ai.attackRange), 3.35);
  await openTab('match');await page.selectOption('#mode', 'inactive');await page.click('#start');await page.locator('canvas').first().focus();
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(300);await page.keyboard.up('ArrowUp');await page.keyboard.press('KeyX');await page.waitForTimeout(150);
  assert.match(await page.textContent('#input-history'), /X/);
  await page.waitForTimeout(500);await L(() => {window.__padOn = true;window.__pad.buttons[1].pressed = true;});await page.waitForTimeout(120);await L(() => {window.__pad.buttons[1].pressed = false;});await page.waitForTimeout(500);
  assert.ok(await L(() => window.__lab.recorder.actions.some(a => a.fighter === 0 && a.kind === 'dodge')), 'botão B do gamepad executa esquiva');
  assert.match(await page.textContent('#pad-status'), /Gamepad de teste/);await L(() => {window.__padOn = false;});
  step('controles: modos de IA/semente, dificuldade com desfazer, histórico de comandos e gamepad (simulado)');
  // Aleatoriedade: semente nova a cada combate (se não fixa); personalidade própria de cada IA nos Ajustes.
  await openTab('match');await page.uncheck('#seed-fixed');
  const seeds = [];for (let i = 0; i < 3; i++) {await openTab('match');await page.click('#start');seeds.push(await L(() => window.__lab.game.brain.seed));await openTab('match');}
  assert.equal(new Set(seeds).size, 3, 'cada combate sorteia uma semente');
  await page.check('#seed-fixed');await page.fill('#seed', '42');await page.press('#seed', 'Tab');await openTab('match');await page.click('#start');assert.equal(await L(() => window.__lab.game.brain.seed), 42);
  assert.notEqual(await L(() => window.__lab.game.playerBrain.seed), 42);
  await page.click('[data-tool="tuning"]');await page.fill('#tune-search', 'personalidade');
  assert.equal(await page.locator('#tune-list .tune-group').count(), 2);assert.equal(await page.locator('#tune-list .tune-control').count(), 18);await page.fill('#tune-search', '');
  step(`aleatoriedade: sementes ${seeds.join(', ')} em três combates, semente fixa e personalidade separada para azul e vermelho`);

  // ---------- 8. Sobreposições ----------
  await page.click('[data-tool="overlays"]');for (const box of await page.locator('[data-overlay]').all()) await box.check();
  await openTab('match');await page.selectOption('#mode', 'offensive');await page.click('#start');
  await page.waitForFunction(() => window.__lab.view.overlayGroup.children.length > 4, null, {timeout: 8000});
  await page.waitForFunction(() => window.__lab.recorder.hits.some(h => h.result === 'impact'), null, {timeout: 20000});
  await page.waitForTimeout(100);await page.screenshot({path: out + 'overlays.png'});
  step('sobreposições: colisores por estado, trajetória, arco de defesa, normais, lançamento previsto e alcance');

  // ---------- 7. Telemetria ----------
  await page.click('[data-dock="hits"]');assert.match(await page.textContent('#hit-log'), /Impacto/);
  await page.click('[data-dock="frames"]');assert.match(await page.textContent('#frame-table'), /Tackle \(X\)48/);await page.click('[data-dock="timeline"]');
  assert.match(await page.textContent('#frame-table'), /C → X/);
  step('telemetria: registro de golpes com vantagem de quadros e tabela de quadros (com linha C → X)');
  // C → X pelo teclado: C e, 100 ms depois, X; o tackle nasce do cancelamento e cobra o próprio custo.
  await openTab('controls');  await openTab('match');await page.selectOption('#mode', 'inactive');await page.click('#start');await page.locator('canvas').first().focus();
  await L(() => {window.__lab.cxTrace = [];const g = window.__lab.game, step = g.step.bind(g);g.step = (...a) => {const r = step(...a), f = g.fighters[0];window.__lab.cxTrace.push({kind: f.action?.kind ?? null, fromCancel: !!f.action?.fromCancel, stamina: f.stamina});return r;};});
  // Teclas disparadas dentro da página: C, e assim que a esquiva começa, ↑ + X (independe do tempo de quadro do GL por software).
  await L(() => new Promise(done => {const canvas = document.querySelector('.stage canvas'), key = (type, code) => canvas.dispatchEvent(new KeyboardEvent(type, {code, bubbles: true}));key('keydown', 'ArrowLeft');key('keydown', 'KeyC');key('keyup', 'KeyC');
    const wait = () => {const f0 = window.__lab.game.fighters[0], K = window.__lab.C.actions.cancel, D = window.__lab.C.actions.dodge;
    // A janela do C → X fica no fim da esquiva (regra de 15/10/2026): o X sai assim que ela abre.
    if (f0.action?.kind === 'dodge' && f0.action.elapsed >= (K.windowMode === 1 ? D.duration - K.fromEnd : K.windowStart) + .01) {key('keydown', 'ArrowUp');key('keyup', 'ArrowLeft');key('keydown', 'KeyX');key('keyup', 'KeyX');done();} else requestAnimationFrame(wait);};wait();}));
  await page.waitForTimeout(250);await L(() => document.querySelector('.stage canvas').dispatchEvent(new KeyboardEvent('keyup', {code: 'ArrowUp', bubbles: true})));
  const cx = await L(() => {const t = window.__lab.cxTrace, i = t.findIndex(s => s.kind === 'tackle');return {i, prev: t[i - 1], at: t[i]};});
  assert.ok(cx.i > 0 && cx.prev.kind === 'dodge' && cx.at.fromCancel, 'X começou a partir da esquiva ' + JSON.stringify({cx, kinds: [...new Set((await L(() => window.__lab.cxTrace)).map(s => s.kind))]}));
  assert.equal(await L(() => window.__lab.view.overlays.cancelWindow), true, 'indicador da janela C → X ligado por padrão');
  assert.ok(Math.abs(cx.at.stamina - 1) < 1e-6, `stamina 3 − C − X = 1 (obtido ${cx.at.stamina})`);
  await L(() => {delete window.__lab.game.step;});
  // Indicador: durante C o anel da janela é desenhado; com o buffer, um X antecipado aparece como ponto.
  const ring = await L(() => {const g = window.__lab.game, f = g.fighters[0];f.action = {kind: 'dodge', elapsed: .05, heading: 0, startAngle: 0, hits: new Set(), offensive: false, vault: false, from: null};f.inputBuffer = {kind: 'tackle', move: {x: 0, z: 1}, age: 0};
    window.__lab.view.drawOverlays(g.fighters, 0);const n = window.__lab.view.overlayGroup.children.length;f.action = null;f.inputBuffer = null;return n;});
  assert.ok(ring >= 2, `anel da janela C → X e ponto do buffer desenhados (${ring} objetos)`);
  step('cancelamento C → X pelo teclado (X nasce da esquiva e cobra C e X uma vez cada), indicador da janela e do buffer');
  // ---------- Homologação jogável ----------
  await page.click('[data-tool="homolog"]');assert.equal(await page.locator('#homolog-list li[data-item]').count(), 17);
  await page.locator('li[data-item="cxAir"] input[value="ok"]').check();await page.locator('li[data-item="clash"] input[value="fail"]').check();
  await page.locator('li[data-item="clash"] input[type=text]').fill('lançamento alto demais');await page.locator('li[data-item="clash"] input[type=text]').dispatchEvent('change');
  assert.match(await page.textContent('#homolog-summary'), /1 aprovados · 1 reprovados · 15 pendentes/);
  page.__acceptUnload = true;await L(() => location.reload());await page.waitForFunction(() => window.__lab);page.__acceptUnload = false;
  await page.click('[data-tool="homolog"]');assert.match(await page.textContent('#homolog-summary'), /1 aprovados · 1 reprovados/);
  assert.equal(await page.locator('li[data-item="clash"] input[type=text]').inputValue(), 'lançamento alto demais');
  await page.click('[data-tool="export"]');pending = page.waitForEvent('download');await page.click('#export-json');
  const withH = JSON.parse(await readFile(await (await pending).path(), 'utf8'));assert.deepEqual([withH.homologation.summary.ok, withH.homologation.summary.fail], [1, 1]);
  assert.equal(withH.homologation.items.find(i => i.id === 'clash').note, 'lançamento alto demais');
  await page.click('[data-tool="homolog"]');page.__acceptConfirm = true;await page.click('#homolog-clear');page.__acceptConfirm = false;assert.match(await page.textContent('#homolog-summary'), /0 aprovados · 0 reprovados · 17 pendentes/);
  step('homologação jogável: 17 itens, aprovado/reprovado com observação, salva ao recarregar e exportada no JSON');
  // ---------- Gravação e reprodução de partida ----------
  await openTab('controls');await openTab('match');await page.selectOption('#mode', 'combat');
  await page.click('#arena-autoplay-toggle');await page.click('#start');await page.waitForTimeout(2500);
  const recorded = await L(() => {window.__lab.togglePause(true);const g = window.__lab.game;return {ticks: window.__labRecording.matchRec.ticks, tick: g.tick, fighters: JSON.stringify(g.fighters)};});
  assert.ok(recorded.ticks > 100 && recorded.ticks === recorded.tick, `gravou ${recorded.ticks} passos`);
  pending = page.waitForEvent('download');await page.click('#rec-save');const recPath = await (await pending).path();
  const recJson = JSON.parse(await readFile(recPath, 'utf8'));assert.equal(recJson.schema, 'arenamon-match');assert.equal(recJson.ticks, recorded.ticks);assert.ok(recJson.commands.length < recorded.ticks, 'comandos comprimidos');
  await page.click('#arena-autoplay-toggle');await L(() => window.__lab.tuning.commit([['rules.launchUp', 9]], 'muda algo antes de reproduzir'));
  await page.selectOption('#rec-values', 'recorded');await page.setInputFiles('#rec-file', recPath);
  await page.waitForFunction(() => window.__labRecording.ui.playback?.ended, null, {timeout: 20000});
  const replayed = await L(() => ({tick: window.__lab.game.tick, fighters: JSON.stringify(window.__lab.game.fighters), launchUp: window.__lab.C.rules.launchUp}));
  assert.equal(replayed.launchUp, recJson.values['rules.launchUp'], 'ajustes da gravação restaurados');assert.equal(replayed.tick, recorded.tick);assert.equal(replayed.fighters, recorded.fighters, 'reprodução idêntica à partida gravada');
  assert.match(await page.textContent('#rec-result'), /Fim da gravação/);
  await L(() => {window.__lab.tuning.resetAll();});
  // Comparação A × B com a gravação e com os cenários.
  await page.click('[data-tool="scenarios"]');await page.selectOption('#comp-a', '__current');await page.selectOption('#comp-b', '__game');
  await page.selectOption('#comp-source', 'match');await page.click('#comp-run');assert.match(await page.textContent('#comp-report'), /passos gravados[\s\S]*Vencedor/);
  await page.selectOption('#comp-source', 'scenarios');await page.click('#comp-run');assert.equal(await page.locator('#comp-report tr').count(), 9);
  // Proposta de patch: X e C com durações diferentes = conflito; iguais = muda rules.dodge.
  await L(() => window.__lab.tuning.commit([['actions.dodge.duration', .5]], 'teste patch'));await page.click('[data-tool="export"]');await page.click('#patch-generate');
  assert.match(await page.textContent('#patch-result'), /Conflitos[\s\S]*rules\.dodge/);
  await L(() => window.__lab.tuning.commit([['actions.tackle.duration', .5]], 'teste patch'));await page.click('#patch-generate');
  assert.match(await page.textContent('#patch-result pre.diff'), /\+  dodge: \.5, invulnerable/);
  pending = page.waitForEvent('download');await page.click('#patch-download');assert.match(await readFile(await (await pending).path(), 'utf8'), /^diff --git a\/prototypes\/game\/src\/config\.ts/);
  await L(() => {window.__lab.tuning.resetAll();});
  step(`gravação de partida: ${recorded.ticks} passos IA × IA salvos (comprimidos em ${recJson.commands.length} trechos) e reproduzidos com estado final idêntico; comparação A × B (gravação e cenários) e proposta de patch do config.ts com conflito X/C`);

  // ---------- 2/3. Personagem do Studio e eventos ----------
  await page.click('[data-tool="characters"]');await page.locator('.char-slot').nth(0).locator('input[type=file]').setInputFiles(out + 'personagem-studio.glb');
  await page.waitForFunction(() => window.__lab.ui.characters[0]);await page.locator('.char-slot').nth(1).getByRole('button', {name: 'Usar o do azul'}).click();
  const ch = await L(() => {const c = window.__lab.ui.characters[0];return {mapping: c.mapping, inScene: !!c.root.parent, blockVisible: window.__lab.view.meshes[0].visible};});
  assert.equal(ch.inScene, true);assert.equal(ch.blockVisible, false);assert.equal(ch.mapping.tackle, 2);assert.equal(ch.mapping.idle, 0);
  const studioText = await page.textContent('#studio-events');assert.match(studioText, /Invulnerabilidade0–200 ms0–200 ms/);assert.match(studioText, /≠ Hitbox ativa80–320 ms0–400 ms/);
  await openTab('match');await page.selectOption('#mode', 'inactive');await page.click('#start');await page.locator('canvas').first().focus();
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(250);await page.keyboard.up('ArrowUp');await page.keyboard.press('KeyX');await page.waitForTimeout(60);
  const anim = await L(() => {const c = window.__lab.ui.characters[0], f = window.__lab.game.fighters[0];return {key: c.current?.key, clip: c.current?.action.getClip().name, time: c.current?.action.time, progress: f.action ? f.action.elapsed / window.__lab.C.actions.tackle.duration : null, d: c.current?.action.getClip().duration};});
  assert.equal(anim.key, 'tackle');assert.equal(anim.clip, 'tackle');assert.ok(Math.abs(anim.time - anim.progress * anim.d) < .2, 'animação sincronizada com a ação');
  await page.waitForTimeout(400);await page.screenshot({path: out + 'personagens.png'});
  step('personagens do Studio: mapa de ações, animação sincronizada com o tackle, cópia tingida no vermelho e eventos Studio × jogo');
  // Velocidade por animação e durações das animações como regras.
  await page.click('[data-tool="characters"]');
  // Velocidade por estado fica no painel “▸” de cada estado.
  for (const a of ['idle', 'tackle']) await page.evaluate(a => {const b = document.querySelectorAll('.char-slot')[0].querySelector(`[data-action="${a}"] [data-more]`);if (b.getAttribute('aria-expanded') !== 'true') b.click();}, a);
  const idleRange = page.locator('.char-slot').nth(0).locator('[data-action="idle"] input[type=range]');
  await idleRange.fill('2');assert.equal(await L(() => window.__lab.ui.characters[0].speedOf('idle')), 2);
  await page.locator('#char-speed').fill('1.5');assert.equal(await L(() => window.__lab.ui.characters[0].speedOf('idle')), 3);await page.locator('#char-speed').fill('1');
  await page.check('#char-sync');
  const synced = await L(() => [window.__lab.C.actions.tackle.duration, window.__lab.C.actions.dodge.duration, window.__lab.C.actions.dodge.invulnerable, window.__lab.C.actions.tackle.invulnerable]);
  assert.deepEqual(synced, [3, 1, .2, .2], 'tackle = clip de 3 s, esquiva = clip de 1 s; janelas de invulnerabilidade nunca vêm do GLB');
  const tackleRange = page.locator('.char-slot').nth(0).locator('[data-action="tackle"] input[type=range]');await tackleRange.fill('2');await tackleRange.dispatchEvent('change');
  assert.equal(await L(() => window.__lab.C.actions.tackle.duration), 1.5, 'velocidade 2× → tackle de 1,5 s');
  assert.ok((await page.textContent('#char-durations')).includes('Duração · Xtackle1.500 s'), 'tabela de durações');
  await openTab('match');await page.click('#start');await page.locator('canvas').first().focus();await page.keyboard.press('KeyX');await page.waitForTimeout(800);
  assert.equal(await L(() => window.__lab.game.fighters[0].action?.kind), 'tackle', 'o tackle agora dura 1,5 s no jogo');
  const sync = await L(() => {const c = window.__lab.ui.characters[0], f = window.__lab.game.fighters[0];return {t: c.current.action.time, expected: f.action.elapsed / window.__lab.C.actions.tackle.duration * c.current.action.getClip().duration};});
  assert.ok(Math.abs(sync.t - sync.expected) < .15, 'clip inteiro dentro da ação');
  await L(() => window.__lab.tuning.undo());assert.equal(await L(() => window.__lab.C.actions.tackle.duration), 3);
  await page.click('[data-tool="characters"]');await page.uncheck('#char-sync');await L(() => {window.__lab.tuning.resetAll();});
  step('animações: velocidade por ação e geral; durações das animações definem as durações de X e C (janelas nunca vêm do GLB) (com desfazer)');

  // Compatibilidade e layout.
  const snap = await L(() => window.__arenamon.snapshot());assert.equal(snap.fighters.length, 2);assert.ok(await L(() => window.__arenaLive.rules === window.__lab.C.rules));
  for (const vp of [{width: 1920, height: 1000}, {width: 1024, height: 768}, {width: 390, height: 844}]) {
    await page.setViewportSize(vp);await page.waitForTimeout(200);assert.ok(await L(() => document.documentElement.scrollWidth <= innerWidth + 1), 'sem rolagem horizontal em ' + vp.width);await page.screenshot({path: out + `lab-${vp.width}.png`});
  }
  step('compatibilidade __arenamon/__arenaLive e layout em 1920, 1024 e 390 px');
  assert.deepEqual(report.errors, []);assert.deepEqual(report.network, []);
  await writeFile(out + 'report.json', JSON.stringify(report, null, 2));console.log(`\nLaboratório de combate: ${report.steps.length} verificações de navegador aprovadas.`);
} finally {await browser.close();}
