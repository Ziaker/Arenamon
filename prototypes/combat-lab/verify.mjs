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
  const dialogs = [];page.on('dialog', d => {dialogs.push(d.type());d.type() === 'beforeunload' && page.__acceptUnload ? d.accept() : d.dismiss();});
  await page.context().setOffline(true);
  const url = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
  await page.goto(url);await page.waitForFunction(() => window.__lab);
  const L = fn => page.evaluate(fn);
  assert.equal(await L(() => window.__lab.game.phase), 'menu');assert.equal(await page.isVisible('#menu'), true);
  step('abre offline no menu, sem erros');

  // ---------- 6/10. Ajustador ----------
  await page.click('[data-tool="tuning"]');
  assert.match(await page.textContent('#tune-counter'), /de 337 · \d+ ≠ jogo/);
  // Aba “X e C”: parâmetros independentes da esquiva, do tackle e do cancelamento.
  assert.equal(await page.locator('#tune-tabs [role=tab]').first().textContent(), 'X e C · 40');
  for (const id of ['#tune-actions-dodge-duration', '#tune-actions-tackle-duration', '#tune-actions-cancel-windowStart', '#tune-actions-cancel-invulnerability']) assert.ok(await page.isVisible(id), id);
  assert.match(await page.textContent('#tune-list'), /Esquiva \(C\)[\s\S]*Tackle \(X\)[\s\S]*Cancelamento C → X/);
  await page.locator('#tune-actions-tackle-duration').fill('0.5');await page.locator('#tune-actions-tackle-duration').dispatchEvent('change');
  assert.deepEqual(await L(() => [window.__lab.C.actions.tackle.duration, window.__lab.C.actions.dodge.duration]), [.5, .4], 'slider de X não altera C');
  await L(() => window.__lab.tuning.undo());
  await page.fill('#tune-search', 'gravidade');assert.ok(await page.locator('.tune-control').count() >= 1);
  await page.fill('#tune-search', '');await page.click('[data-filter="experimental"]');const exp = await page.locator('.tune-control').count();assert.equal(exp, 10);
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
  assert.equal(json.schema, 'arenamon-tuning');assert.equal(json.version, 8);assert.ok(json.values.actions.dodge && json.values.actions.tackle && json.values.actions.cancel);assert.equal(json.values.test.arenaHalf, 15);
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
  await page.click('#reset-all');assert.equal(await L(() => window.__lab.C.test.speed), 4.8);
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
  await page.click('[data-tool="match"]');await page.click('#start');
  await page.selectOption('#rp-speed', '0.25');let a = await L(() => window.__lab.game.tick);await page.waitForTimeout(1000);let b = await L(() => window.__lab.game.tick);
  await page.selectOption('#rp-speed', '1');const c0 = await L(() => window.__lab.game.tick);await page.waitForTimeout(1000);const c1 = await L(() => window.__lab.game.tick);
  assert.ok((b - a) < (c1 - c0) * .45, `câmera lenta: ${b - a} × ${c1 - c0} passos/s`);
  // Retomar a partir do passado descarta o futuro gravado (ramificação).
  await page.click('#pause');for (let i = 0; i < 30; i++) await page.click('#rp-back');const branch = await L(() => window.__lab.game.tick);await page.click('#rp-play');await page.waitForTimeout(200);
  assert.ok(await L(() => window.__lab.recorder.samples.every((s, i, all) => i === 0 || s.tick > all[i - 1].tick)), 'telemetria sem passos duplicados após ramificar');
  assert.ok(await L(() => window.__lab.replay.atEnd));void branch;
  step(`câmera lenta (0,25×: ${b - a} passos/s × ${c1 - c0} a 1×) e retomada a partir do passado`);

  // ---------- 9. Controles: IA, gamepad, histórico ----------
  await page.click('[data-tool="controls"]');await page.selectOption('#player-mode', 'random');await page.fill('#seed', '7');await page.press('#seed', 'Tab');
  await page.click('[data-difficulty="hard"]');assert.equal(await L(() => window.__lab.C.extras.ai.attackRange), 3.8);await L(() => window.__lab.tuning.undo());assert.equal(await L(() => window.__lab.C.extras.ai.attackRange), 3.35);
  await page.click('[data-tool="match"]');await page.selectOption('#mode', 'inactive');await page.click('#start');await page.locator('canvas').first().focus();
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(300);await page.keyboard.up('ArrowUp');await page.keyboard.press('KeyX');await page.waitForTimeout(150);
  assert.match(await page.textContent('#input-history'), /X/);
  await page.waitForTimeout(500);await L(() => {window.__padOn = true;window.__pad.buttons[1].pressed = true;});await page.waitForTimeout(120);await L(() => {window.__pad.buttons[1].pressed = false;});await page.waitForTimeout(500);
  assert.ok(await L(() => window.__lab.recorder.actions.some(a => a.fighter === 0 && a.kind === 'dodge')), 'botão B do gamepad executa esquiva');
  assert.match(await page.textContent('#pad-status'), /Gamepad de teste/);await L(() => {window.__padOn = false;});
  step('controles: modos de IA/semente, dificuldade com desfazer, histórico de comandos e gamepad (simulado)');
  // Aleatoriedade: semente nova a cada combate (se não fixa); personalidade própria de cada IA nos Ajustes.
  await page.click('[data-tool="controls"]');await page.uncheck('#seed-fixed');
  const seeds = [];for (let i = 0; i < 3; i++) {await page.click('[data-tool="match"]');await page.click('#start');seeds.push(await L(() => window.__lab.game.brain.seed));await page.click('[data-tool="controls"]');}
  assert.equal(new Set(seeds).size, 3, 'cada combate sorteia uma semente');
  await page.check('#seed-fixed');await page.fill('#seed', '42');await page.press('#seed', 'Tab');await page.click('[data-tool="match"]');await page.click('#start');assert.equal(await L(() => window.__lab.game.brain.seed), 42);
  assert.notEqual(await L(() => window.__lab.game.playerBrain.seed), 42);
  await page.click('[data-tool="tuning"]');await page.fill('#tune-search', 'personalidade');
  assert.equal(await page.locator('#tune-list .tune-group').count(), 2);assert.equal(await page.locator('#tune-list .tune-control').count(), 14);await page.fill('#tune-search', '');
  step(`aleatoriedade: sementes ${seeds.join(', ')} em três combates, semente fixa e personalidade separada para azul e vermelho`);

  // ---------- 8. Sobreposições ----------
  await page.click('[data-tool="overlays"]');for (const box of await page.locator('[data-overlay]').all()) await box.check();
  await page.click('[data-tool="match"]');await page.selectOption('#mode', 'offensive');await page.click('#start');
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
  await page.click('[data-tool="controls"]');  await page.click('[data-tool="match"]');await page.selectOption('#mode', 'inactive');await page.click('#start');await page.locator('canvas').first().focus();
  await L(() => {window.__lab.cxTrace = [];const g = window.__lab.game, step = g.step.bind(g);g.step = (...a) => {const r = step(...a), f = g.fighters[0];window.__lab.cxTrace.push({kind: f.action?.kind ?? null, fromCancel: !!f.action?.fromCancel, stamina: f.stamina});return r;};});
  await page.keyboard.down('ArrowLeft');await page.keyboard.press('KeyC');await page.waitForTimeout(100);await page.keyboard.down('ArrowUp');await page.keyboard.up('ArrowLeft');await page.keyboard.press('KeyX');
  await page.waitForTimeout(250);await page.keyboard.up('ArrowUp');
  const cx = await L(() => {const t = window.__lab.cxTrace, i = t.findIndex(s => s.kind === 'tackle');return {i, prev: t[i - 1], at: t[i]};});
  assert.ok(cx.i > 0 && cx.prev.kind === 'dodge' && cx.at.fromCancel, 'X começou a partir da esquiva');
  assert.ok(Math.abs(cx.at.stamina - 1) < 1e-6, `stamina 3 − C − X = 1 (obtido ${cx.at.stamina})`);
  await L(() => {delete window.__lab.game.step;});
  step('cancelamento C → X pelo teclado: X nasce da esquiva e cobra C e X uma vez cada');

  // ---------- 2/3. Personagem do Studio e eventos ----------
  await page.click('[data-tool="characters"]');await page.locator('.char-slot').nth(0).locator('input[type=file]').setInputFiles(out + 'personagem-studio.glb');
  await page.waitForFunction(() => window.__lab.ui.characters[0]);await page.locator('.char-slot').nth(1).getByRole('button', {name: 'Usar o do azul'}).click();
  const ch = await L(() => {const c = window.__lab.ui.characters[0];return {mapping: c.mapping, inScene: !!c.root.parent, blockVisible: window.__lab.view.meshes[0].visible};});
  assert.equal(ch.inScene, true);assert.equal(ch.blockVisible, false);assert.equal(ch.mapping.tackle, 2);assert.equal(ch.mapping.idle, 0);
  const studioText = await page.textContent('#studio-events');assert.match(studioText, /Invulnerabilidade0–200 ms0–200 ms/);assert.match(studioText, /≠ Hitbox ativa80–320 ms0–400 ms/);
  await page.click('[data-tool="match"]');await page.selectOption('#mode', 'inactive');await page.click('#start');await page.locator('canvas').first().focus();
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(250);await page.keyboard.up('ArrowUp');await page.keyboard.press('KeyX');await page.waitForTimeout(60);
  const anim = await L(() => {const c = window.__lab.ui.characters[0], f = window.__lab.game.fighters[0];return {key: c.current?.key, clip: c.current?.action.getClip().name, time: c.current?.action.time, progress: f.action ? f.action.elapsed / window.__lab.C.actions.tackle.duration : null, d: c.current?.action.getClip().duration};});
  assert.equal(anim.key, 'tackle');assert.equal(anim.clip, 'tackle');assert.ok(Math.abs(anim.time - anim.progress * anim.d) < .2, 'animação sincronizada com a ação');
  await page.waitForTimeout(400);await page.screenshot({path: out + 'personagens.png'});
  step('personagens do Studio: mapa de ações, animação sincronizada com o tackle, cópia tingida no vermelho e eventos Studio × jogo');
  // Velocidade por animação e durações das animações como regras.
  await page.click('[data-tool="characters"]');
  const idleRange = page.locator('.char-slot').nth(0).locator('tr[data-action="idle"] input[type=range]');
  await idleRange.fill('2');assert.equal(await L(() => window.__lab.ui.characters[0].speedOf('idle')), 2);
  await page.locator('#char-speed').fill('1.5');assert.equal(await L(() => window.__lab.ui.characters[0].speedOf('idle')), 3);await page.locator('#char-speed').fill('1');
  await page.check('#char-sync');
  const synced = await L(() => [window.__lab.C.actions.tackle.duration, window.__lab.C.actions.dodge.duration, window.__lab.C.actions.dodge.invulnerable, window.__lab.C.actions.tackle.invulnerable]);
  assert.deepEqual(synced, [3, 1, .2, .2], 'tackle = clip de 3 s, esquiva = clip de 1 s; janelas de invulnerabilidade nunca vêm do GLB');
  const tackleRange = page.locator('.char-slot').nth(0).locator('tr[data-action="tackle"] input[type=range]');await tackleRange.fill('2');await tackleRange.dispatchEvent('change');
  assert.equal(await L(() => window.__lab.C.actions.tackle.duration), 1.5, 'velocidade 2× → tackle de 1,5 s');
  assert.ok((await page.textContent('#char-durations')).includes('Duração · Xtackle1.500 s'), 'tabela de durações');
  await page.click('[data-tool="match"]');await page.click('#start');await page.locator('canvas').first().focus();await page.keyboard.press('KeyX');await page.waitForTimeout(800);
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
