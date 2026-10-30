// Viewport 3D própria do Editor de animações (animation-preview.js) no navegador: abre o dist/, carrega o Wookada,
// abre o editor, seleciona o idle e confere que
//   1. o canvas da viewport existe e tem contexto WebGL real;
//   2. ela RENDERIZA (contador de frames no dataset + amostra de pixels com várias cores: modelo, grade e fundo);
//   3. «Tocar» toca na viewport — o lutador da arena NUNCA é tocado (ui.characters[0].preview continua null);
//   4. o transporte da viewport funciona (seek pausado no instante exato, relógio visível);
//   5. a prévia da arena continua disponível como fallback explícito (botão «Arena»).
// Uso: node test/animation-editor-viewport.browser.mjs (com dist/ recompilado por npm run build:combat-lab).
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

  await page.evaluate(() => document.getElementById('anim-open').click());
  await page.waitForSelector('#anim-editor:not([hidden]) [data-list] .ae-item');
  await page.click('[data-act="idle"]');

  // 1. canvas da viewport com contexto WebGL.
  const canvas = page.locator('#anim-editor [data-vp-mount] canvas');
  await canvas.waitFor({timeout: 10000});
  const glOk = await page.evaluate(() => {
    const c = document.querySelector('#anim-editor [data-vp-mount] canvas');
    return !!(c && (c.getContext('webgl2') || c.getContext('webgl')));
  });
  assert.ok(glOk, 'canvas da viewport tem contexto WebGL');

  // 2. renderização real: frames avançando + pixels não triviais.
  await page.waitForFunction(() => Number(document.querySelector('#anim-editor [data-vp-mount] canvas')?.dataset.vpFrames) > 10, null, {timeout: 15000});
  const sample = await page.evaluate(() => window.__aePreview.sample());
  assert.ok(sample && sample.width > 100 && sample.height > 100, `viewport com tamanho (${sample?.width}×${sample?.height})`);
  assert.ok(sample.distinctColors >= 3, `pixels não triviais: ${sample.distinctColors} cores distintas (modelo+grade+fundo)`);

  // 3. «Tocar» toca na viewport; o lutador da arena NÃO é tocado.
  await page.click('#anim-editor [data-play]');
  await page.waitForTimeout(300);
  const arena = await page.evaluate(() => ({preview: window.__lab.ui.characters[0].preview, clock: window.__lab.ui.characters[0].clock}));
  assert.equal(arena.preview, null, 'lutador da arena nunca entra em prévia');
  const t0 = await page.evaluate(() => window.__aePreview.time());
  await page.waitForTimeout(400);
  const t1 = await page.evaluate(() => window.__aePreview.time());
  assert.ok(t1 > t0, `viewport tocando (${t0.toFixed(3)} → ${t1.toFixed(3)} s)`);

  // 4. transporte: pausar, seek na régua e relógio visível.
  await page.click('#anim-editor [data-play]');   // pausa
  await page.evaluate(() => {const s = document.querySelector('#anim-editor [data-vpseek]');s.value = String(Math.min(Number(s.max), .3));s.dispatchEvent(new Event('input'));});
  const tSeek = await page.evaluate(() => window.__aePreview.time());
  assert.ok(Math.abs(tSeek - .3) < 1 / 30, `seek pausado em .3 s (lido ${tSeek.toFixed(3)})`);
  const clock = await page.textContent('#anim-editor [data-vptime]');
  assert.match(clock, /\/ \d+\.\d+ s/, `relógio da viewport visível: «${clock}»`);
  const paused = await page.evaluate(() => window.__aePreview.playing());
  assert.equal(paused, false, 'pausado após seek');

  // 5. fallback explícito: modo arena alterna e toca no lutador real.
  await page.click('#anim-editor [data-pmode="arena"]');
  await page.click('#anim-editor [data-play]');
  const arena2 = await page.evaluate(() => !!window.__lab.ui.characters[0].preview);
  assert.ok(arena2, 'modo arena toca no lutador real (fallback)');
  await page.click('#anim-editor [data-stop]');
  await page.click('#anim-editor [data-pmode="viewport"]');

  await page.screenshot({path: root + 'evidence/animation-editor/viewport.png'});
  assert.deepEqual(errors, [], 'sem erros de página: ' + errors.join(' | '));
  console.log('animation-editor viewport browser: ok');
} finally {await browser.close();}
