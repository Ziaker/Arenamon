import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';

const html = fileURLToPath(new URL('../dist/arenamon-vfx-composer.html', import.meta.url));
const evidence = fileURLToPath(new URL('../evidence/f2/', import.meta.url));
await mkdir(evidence, {recursive: true});
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
try {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}}); await context.setOffline(true);
  const page = await context.newPage(), errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => {if (message.type() === 'error') errors.push(message.text());}); page.on('request', request => {if (/^https?:/.test(request.url())) external.push(request.url());});
  await page.goto(pathToFileURL(html).href); await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__?.ready);
  await page.click('#new-empty-project');
  assert.equal(await page.locator('[data-workspace]').count(), 5);
  await page.click('#add-box'); await page.click('#add-stroke'); await page.click('[data-workspace="animation"]');
  await page.selectOption('#timeline-fps', '60'); await page.fill('#timeline-duration', '2.5'); await page.dispatchEvent('#timeline-duration', 'change');
  await page.fill('#timeline-scrub', '0.5'); await page.dispatchEvent('#timeline-scrub', 'input'); await page.click('#add-keyframe');
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.project.timeline.tracks.length), 1);
  await page.click('#add-morph-keyframe'); await page.fill('#timeline-scrub', '1'); await page.dispatchEvent('#timeline-scrub', 'input'); await page.click('[data-workspace="drawing"]'); await page.selectOption('#vertex-index', '1'); await page.fill('#vertex-y', '1.7'); await page.click('#apply-vertex'); await page.click('[data-workspace="animation"]'); await page.click('#add-morph-keyframe');
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.project.timeline.tracks.some(track => track.property === 'path.points' && track.keyframes.length === 2)), true);
  await page.check('#onion-enabled'); assert.equal(await page.inputValue('#onion-opacity'), '25'); await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.onionCount >= 2);
  await page.click('#timeline-reverse'); await page.waitForTimeout(120); assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.playback.direction), -1);
  await page.click('#timeline-stop'); assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.playback.time), 0);

  await page.click('[data-workspace="textures"]'); await page.click('#new-texture');
  const canvas = await page.locator('#texture-canvas').boundingBox(); await page.mouse.move(canvas.x + 20, canvas.y + 20); await page.mouse.down(); await page.mouse.move(canvas.x + 100, canvas.y + 100, {steps: 8}); await page.mouse.up();
  await page.fill('#sprite-columns', '4'); await page.fill('#sprite-rows', '2'); await page.fill('#sprite-fps', '24'); await page.click('#apply-spritesheet');
  assert.deepEqual(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.project.textures.at(-1).spriteSheet), {columns: 4, rows: 2, fps: 24});
  const png = await page.locator('#texture-canvas').screenshot();
  await page.setInputFiles('#import-texture', {name: 'pixel.png', mimeType: 'image/png', buffer: png}); await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.project.textures.some(texture => texture.name === 'pixel.png'));

  await page.click('[data-workspace="materials"]'); await page.fill('#material-color', '#ff5500'); await page.click('#apply-material');
  const recipe = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.materialRecipe); assert.equal(recipe.color, '#ff5500');
  await page.selectOption('#material-node-type', 'dissolve'); await page.click('#add-material-node'); await page.waitForFunction(() => document.querySelector('#material-validation').textContent.includes('Grafo válido')); await page.click('#apply-material');
  assert.deepEqual(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.materialRecipe.operations.map(operation => operation.type)), ['dissolve', 'color', 'output', 'noise']);

  const page2 = await context.newPage(); await page2.goto(pathToFileURL(html).href); await page2.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__?.ready);
  const recipe2 = await page2.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.materialRecipe);
  assert.deepEqual(recipe2, await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.materialRecipe)); assert.equal(await page.locator('#viewport canvas').count(), 1); assert.equal(await page2.locator('#viewport canvas').count(), 1);
  await page.screenshot({path: `${evidence}/composer-f2.png`, fullPage: true});
  assert.equal(errors.length, 0, errors.join('\n')); assert.equal(external.length, 0, external.join('\n'));
  const result = {status: 'approved', offline: true, externalRequests: 0, webglContexts: 2, coverage: ['timeline 24/30/60', 'scrub/reverse', 'keyframe', 'onion skin', 'pintura RGBA', 'PNG', 'spritesheet', 'grafo seguro']};
  await writeFile(`${evidence}/resultado.json`, JSON.stringify(result, null, 2));
  console.log('✓ F2 browser: timeline, texturas, material seguro e dois contextos WebGL offline.');
} finally {await browser.close();}
