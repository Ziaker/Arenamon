import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';

// F3.2 — ferramentas que faltaram ao montar a explosão à mão: seleção múltipla,
// gerador radial, trilhas removíveis, duplicar/remover, rotação/escala, paleta e enquadrar.
const html = fileURLToPath(new URL('../dist/arenamon-vfx-composer.html', import.meta.url));
const evidence = fileURLToPath(new URL('../evidence/f3-authoring/', import.meta.url));
await mkdir(evidence, {recursive: true});
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
try {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}}); await context.setOffline(true);
  const page = await context.newPage(), errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  page.on('request', request => {if (/^https?:/.test(request.url())) external.push(request.url());});
  await page.goto(pathToFileURL(html).href); await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__?.ready);
  const state = () => page.evaluate(() => ({
    nodes: window.__ARENAMON_VFX_COMPOSER__.project.nodes.map(node => node.id),
    tracks: window.__ARENAMON_VFX_COMPOSER__.project.timeline.tracks.length,
    duration: window.__ARENAMON_VFX_COMPOSER__.project.timeline.duration,
    time: window.__ARENAMON_VFX_COMPOSER__.playback.time,
    selected: window.__ARENAMON_VFX_COMPOSER__.selectedIds,
  }));
  const setRange = (id, value) => page.evaluate(([id, value]) => {
    const input = document.getElementById(id);
    input.value = String(value);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  }, [id, value]);

  await page.click('#new-empty-project');
  assert.deepEqual((await state()).selected, [], 'projeto vazio começa sem seleção');
  assert.equal(await page.locator('#hierarchy .node-row').count(), 0);
  assert.equal(await page.locator('#node-color').isDisabled(), true, 'cor desabilitada sem seleção');
  assert.equal(await page.locator('#track-list .track-row').count(), 0);

  for (let index = 0; index < 4; index++) {await page.click('#add-box'); await page.click('[data-color="#ff2b2b"]');}
  for (let index = 0; index < 4; index++) {await page.click('#add-sphere'); await page.click('[data-color="#ffd400"]');}
  assert.equal((await state()).nodes.length, 8);
  await page.click('[data-node-id="box-1"]');
  const allIds = ['box-2', 'box-3', 'box-4', 'sphere-5', 'sphere-6', 'sphere-7', 'sphere-8'];
  for (const id of allIds) await page.click(`[data-node-id="${id}"]`, {modifiers: ['Control']});
  assert.deepEqual((await state()).selected.sort(), ['box-1', 'box-2', 'box-3', 'box-4', 'sphere-5', 'sphere-6', 'sphere-7', 'sphere-8'], 'Ctrl+clique seleciona vários objetos');
  assert.equal(await page.locator('#hierarchy .node-row.multi').count(), 8);
  await page.click('[data-workspace="animation"]');

  await setRange('radial-radius', 4); await setRange('radial-time', .9); await setRange('radial-lift', .5);
  await page.fill('#radial-seed', '7');
  assert.equal(await page.textContent('#radial-radius-value'), '4,0 m', 'rótulo do raio mostra unidade');
  assert.equal(await page.textContent('#radial-time-value'), '0,90 s', 'rótulo do tempo mostra unidade');
  await page.click('#radial-explode');
  const exploded = await state();
  assert.equal(exploded.tracks, 24, 'explosão radial cria 3 trilhas por objeto');
  assert.ok(exploded.duration >= .9, 'a explosão estende a timeline quando necessário');
  assert.equal(await page.locator('#track-list .track-row').count(), 3, 'lista mostra as trilhas do objeto selecionado');
  assert.match(await page.textContent('#track-hint'), /3 trilha\(s\) em sphere-8/);
  const seekTime = await page.locator('#track-list .track-time').nth(1).textContent();
  await page.locator('#track-list .track-time').nth(1).click();
  assert.ok(Math.abs((await state()).time - Number(seekTime.replace('s', ''))) <= 1 / 30 + 1e-9, 'clicar no tempo da trilha move o playhead (quantizado ao FPS)');

  await page.fill('#rotation-y', '45'); await page.dispatchEvent('#rotation-y', 'change');
  await page.fill('#scale-x', '2'); await page.dispatchEvent('#scale-x', 'change');
  const transformed = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.project.nodes.find(node => node.id === 'sphere-8').transform);
  assert.ok(Math.abs(transformed.rotation[1] - Math.PI / 4) < 1e-6, 'rotação em graus vira radianos');
  assert.equal(transformed.scale[0], 2, 'escala é aplicada');
  await page.click('[data-color="#46d7c7"]');
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.project.nodes.find(node => node.id === 'sphere-8').color), '#46d7c7', 'paleta pinta o objeto');
  assert.equal(await page.textContent('#node-color-hex'), '#46d7c7');
  await page.click('[data-color="#ffd400"]');
  assert.equal(await page.textContent('#node-color-hex'), '#ffd400');
  await page.locator('#frame-all').click();
  await page.evaluate(() => {const scrub = document.querySelector('#timeline-scrub'); scrub.value = '0.9'; scrub.dispatchEvent(new Event('input', {bubbles: true}));});
  await page.waitForTimeout(120);
  await page.screenshot({path: `${evidence}/explosao-ferramentas.png`, fullPage: true});
  await page.locator('#track-hint').scrollIntoViewIfNeeded();
  await page.waitForTimeout(80);
  await page.screenshot({path: `${evidence}/trilhas-radiais.png`, fullPage: true});

  await page.click('#duplicate-node');
  const duplicated = await state();
  assert.equal(duplicated.nodes.length, 9);
  assert.equal(duplicated.tracks, 27, 'duplicar copia as trilhas');
  assert.deepEqual(duplicated.selected, ['sphere-8-copia']);
  await page.click('#remove-node');
  const removed = await state();
  assert.equal(removed.nodes.length, 8);
  assert.equal(removed.tracks, 24, 'remover o objeto remove as trilhas dele');
  assert.deepEqual(removed.selected, []);

  await page.click('[data-node-id="box-2"]');
  await page.keyboard.press('Control+d');
  assert.equal((await state()).nodes.length, 9, 'Ctrl+D duplica pelo teclado mesmo com o botão da hierarquia focado');
  await page.keyboard.press('Delete');
  assert.equal((await state()).nodes.length, 8, 'Delete remove pelo teclado');

  await page.click('[data-node-id="box-1"]');
  await page.click('#clear-node-tracks');
  assert.equal((await state()).tracks, 21, 'limpar animação remove só as trilhas do objeto');
  await page.click('[data-node-id="box-2"]');
  assert.equal(await page.locator('#track-list .track-row').count(), 3);
  await page.locator('#track-list .track-remove').first().click();
  assert.equal((await state()).tracks, 20, 'remover trilha individual funciona');

  await page.locator('#frame-all').click();
  await page.click('#new-empty-project');
  const empty = await state();
  assert.deepEqual(empty.selected, []);
  assert.equal(empty.nodes.length, 0);
  assert.equal(await page.locator('#node-color').isDisabled(), true);
  assert.equal(await page.locator('#track-list .track-row').count(), 0, 'projeto vazio limpa a lista de trilhas');

  await page.click('[data-workspace="animation"]');
  await page.screenshot({path: `${evidence}/projeto-vazio.png`, fullPage: true});
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(external.length, 0, external.join('\n'));
  const result = {status: 'approved', offline: true, externalRequests: 0, coverage: ['seleção múltipla', 'explosão radial com unidade', 'seek por keyframe', 'rotação/escala', 'cor e paleta', 'duplicar', 'remover objeto', 'atalhos Ctrl+D/Delete', 'limpar animação', 'remover trilha', 'enquadrar', 'projeto vazio']};
  await writeFile(`${evidence}/resultado.json`, JSON.stringify(result, null, 2));
  console.log('✓ F3.2 autoria: explosão radial, trilhas, duplicar/remover, transformações e atalhos offline.');
} finally {await browser.close();}
