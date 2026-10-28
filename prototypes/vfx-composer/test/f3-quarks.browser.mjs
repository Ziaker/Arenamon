import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';

const html = fileURLToPath(new URL('../dist/arenamon-vfx-composer.html', import.meta.url));
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
try {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
  await context.setOffline(true);
  const page = await context.newPage(), errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  page.on('request', request => {if (/^https?:/.test(request.url())) external.push(request.url());});
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__?.ready);
  await page.click('[data-workspace="particles"]');
  await page.click('#add-emitter');
  assert.deepEqual(await page.locator('#particle-preview-backend option').allTextContents(), ['Autoral', 'Quarks', 'Comparar A/B']);

  await page.selectOption('#particle-preview-backend', 'quarks');
  await page.click('[data-workspace="animation"]');
  await page.fill('#timeline-scrub', '0.4'); await page.dispatchEvent('#timeline-scrub', 'input');
  await page.click('[data-workspace="particles"]');
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.quarksTelemetry.systems === 1);
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.previewBackend), 'quarks');
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.quarksTelemetry.drawCalls), 1);
  assert.match(await page.locator('#particle-telemetry').innerText(), /Quarks/);

  const projectBefore = await page.evaluate(() => JSON.stringify(window.__ARENAMON_VFX_COMPOSER__.project));
  await page.selectOption('#particle-preview-backend', 'compare');
  assert.deepEqual(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.previewVisibility), {authoring: true, quarks: true});
  await page.selectOption('#particle-preview-backend', 'authoring');
  assert.deepEqual(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.previewVisibility), {authoring: true, quarks: false});
  assert.equal(await page.evaluate(() => JSON.stringify(window.__ARENAMON_VFX_COMPOSER__.project)), projectBefore, 'backend de preview não pode alterar o VfxProject');

  const baseline = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.rendererGeometries);
  for (let index = 0; index < 6; index++) {
    await page.selectOption('#particle-preview-backend', 'quarks');
    await page.selectOption('#particle-preview-backend', 'authoring');
  }
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.rendererGeometries);
  assert.equal(after <= baseline + 2, true, `troca de backend acumulou geometrias: ${baseline} → ${after}`);
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(external.length, 0, external.join('\n'));
  console.log('✓ F3.2 browser: Quarks real, A/B, preferência não persistida e cleanup offline.');
} finally {await browser.close();}

