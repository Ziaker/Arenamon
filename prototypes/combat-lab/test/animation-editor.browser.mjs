// Aba Animações: abre, lista tudo (inclusive fases do salto e ausentes), edita, desfaz, redimensiona e recolhe divisores.
// Uso: node test/animation-editor.browser.mjs (com dist/ recompilado por npm run build:combat-lab).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('..', import.meta.url));
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1600, height: 950}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href);
  await page.waitForFunction(() => window.__lab?.quickMenu, null, {timeout: 60000});
  await page.waitForFunction(() => [...document.querySelectorAll('#quick-char-0 option')].some(o => /wookada/i.test(o.textContent)), null, {timeout: 30000});
  const id = await page.evaluate(() => [...document.querySelectorAll('#quick-char-0 option')].find(o => /wookada/i.test(o.textContent)).value);
  await page.evaluate(async id => {await window.__lab.quickMenu.selectCharacter(0, id);}, id);
  await page.waitForFunction(() => window.__lab.ui.characters[0]?.clips?.length > 40, null, {timeout: 60000});
  await page.evaluate(() => {document.getElementById('anim-open').click();});
  await page.waitForSelector('#anim-editor:not([hidden]) [data-list] .ae-item');

  const list = await page.evaluate(() => [...document.querySelectorAll('#anim-editor .ae-item')].map(b => b.dataset.act));
  for (const a of ['idle', 'jump', 'jump_start', 'jump_rise', 'jump_apex', 'jump_fall', 'land', 'tackle', 'move_4', 'death']) assert.ok(list.includes(a), 'lista tem ' + a);
  const missing = await page.evaluate(() => [...document.querySelectorAll('#anim-editor .ae-item.miss')].map(b => b.dataset.act));
  assert.ok(['jump_start', 'jump_rise', 'jump_apex', 'jump_fall'].every(a => missing.includes(a)), 'fases do salto aparecem como ausentes');

  // Edita velocidade do idle pelo número, confere no personagem, desfaz.
  await page.click('[data-act="idle"]');
  const before = await page.evaluate(() => window.__lab.ui.characters[0].speeds.idle ?? 1);
  await page.fill('[data-n="speed"]', '1.5');await page.dispatchEvent('[data-n="speed"]', 'change');
  assert.equal(await page.evaluate(() => window.__lab.ui.characters[0].speeds.idle), 1.5);
  await page.click('[data-undo]');
  assert.equal(await page.evaluate(() => window.__lab.ui.characters[0].speeds.idle ?? 1), before, 'desfazer restaura');
  await page.click('[data-redo]');
  assert.equal(await page.evaluate(() => window.__lab.ui.characters[0].speeds.idle), 1.5, 'refazer reaplica');

  // Perfil persistido e timeline desenhada.
  await page.click('[data-tab="fases"]');
  await page.fill('[data-n="activeStart"]', '20');await page.dispatchEvent('[data-n="activeStart"]', 'change');
  assert.equal(await page.evaluate(() => window.__lab.ui.characters[0].animProfile.entries.idle.activeStart), 20);
  assert.ok(await page.locator('#anim-editor .ae-track').count() >= 2, 'timeline com faixas');

  // Hitbox: adicionar, remover; ausência é válida.
  await page.click('[data-tab="hit"]');
  assert.match(await page.textContent('#anim-editor .ae-diag'), /Sem conflitos/);
  await page.click('[data-hb-add]');
  assert.equal(await page.evaluate(() => window.__lab.ui.characters[0].animProfile.hitboxes.idle.length), 1);
  await page.click('[data-hb-add]');
  assert.equal(await page.evaluate(() => window.__lab.ui.characters[0].animProfile.hitboxes.idle.length), 2, 'múltiplas hitboxes');
  await page.click('[data-hb-del]');await page.click('[data-hb-del]');
  assert.equal(await page.evaluate(() => window.__lab.ui.characters[0].animProfile.hitboxes.idle.length), 0);

  // Divisores: arrastar redimensiona, clicar recolhe e reabre.
  const w0 = await page.evaluate(() => document.querySelector('.ae-left').getBoundingClientRect().width);
  const d = await page.locator('[data-div="left"]').boundingBox();
  await page.mouse.move(d.x + 4, d.y + 100);await page.mouse.down();await page.mouse.move(d.x + 84, d.y + 100, {steps: 5});await page.mouse.up();
  assert.ok(await page.evaluate(() => document.querySelector('.ae-left').getBoundingClientRect().width) > w0 + 40, 'arraste alarga a lista');
  for (const which of ['left', 'right', 'bottom']) {
    await page.click(`[data-div="${which}"]`);
    assert.ok(await page.evaluate(() => document.querySelector('.anim-editor').classList.contains('cl') || document.querySelector('.anim-editor').classList.contains('cr') || document.querySelector('.anim-editor').classList.contains('cb')), 'recolheu ' + which);
    assert.ok(await page.locator(`[data-div="${which}"]`).isVisible(), 'alça visível ' + which);
    await page.click(`[data-div="${which}"]`);
  }

  // Salto sem fases continua usando o clipe «jump»; com fase associada, o runtime escolhe a fase.
  const jumpMode = await page.evaluate(() => {
    const c = window.__lab.ui.characters[0], before = c.hasJumpPhases();
    c.addVariant('jump_fall', c.variantsOf('fall')[0] ?? 0);
    const after = c.hasJumpPhases();
    const f = {flight: {isNormalJump: true, vy: -5}};c.flightStartClock = c.clock - 1;
    const key = c.stateKey({hp: 10, flight: f.flight, ledge: null});
    c.removeVariant('jump_fall', c.variantsOf('fall')[0] ?? 0);
    return {before, after, key, restored: c.hasJumpPhases()};
  });
  assert.deepEqual(jumpMode, {before: false, after: true, key: 'jump_fall', restored: false});
  await page.evaluate(() => document.getElementById('anim-open').click());
  assert.deepEqual(errors, [], 'sem erros de página: ' + errors.join(' | '));
  console.log('animation-editor browser: ok');
} finally {await browser.close();}
