import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';

const html = fileURLToPath(new URL('../dist/arenamon-vfx-composer.html', import.meta.url));
const evidence = fileURLToPath(new URL('../evidence/f3/', import.meta.url));
await mkdir(evidence, {recursive: true});
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
try {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}}); await context.setOffline(true);
  const page = await context.newPage(), errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  page.on('request', request => {if (/^https?:/.test(request.url())) external.push(request.url());});
  await page.goto(pathToFileURL(html).href); await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__?.ready);
  await page.click('#new-empty-project');

  assert.equal(await page.locator('[data-workspace]').count(), 5, 'F3 habilita o workspace Partículas');
  await page.click('[data-workspace="particles"]');
  await page.click('#add-emitter');
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.particleTelemetry.active > 0);
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.project.particles.length), 1);
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.particleTelemetry.drawCalls), 1, 'um draw call por emissor');

  // Slider e campo numérico permanecem sincronizados (T28).
  await page.fill('#emitter-count', '12'); await page.dispatchEvent('#emitter-count', 'input');
  assert.equal(await page.inputValue('#emitter-count-range'), '12');
  await page.fill('#emitter-count-range', '40'); await page.dispatchEvent('#emitter-count-range', 'input');
  assert.equal(await page.inputValue('#emitter-count'), '40');
  await page.fill('#emitter-count', '36'); await page.dispatchEvent('#emitter-count', 'input');
  await page.click('#apply-emitter');

  // Determinismo: mesmo tempo, mesma seed, mesmas partículas; seed diferente muda.
  await page.click('[data-workspace="animation"]');
  await page.fill('#timeline-duration', '3'); await page.dispatchEvent('#timeline-duration', 'change');
  await page.click('[data-workspace="particles"]');
  const snapshotAt = async time => {
    await page.click('[data-workspace="animation"]');
    await page.fill('#timeline-scrub', String(time)); await page.dispatchEvent('#timeline-scrub', 'input');
    await page.click('[data-workspace="particles"]');
    await page.waitForTimeout(80);
    return page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.particleSnapshot());
  };
  const atFirst = await snapshotAt(0.4);
  assert.equal(atFirst.length > 0, true, 'scrub em 0,4 s precisa mostrar partículas');
  await snapshotAt(1.2);
  const atAgain = await snapshotAt(0.4);
  assert.deepEqual(atAgain, atFirst, 'voltar ao mesmo tempo reproduz as mesmas partículas');
  await page.fill('#emitter-seed', '4242'); await page.dispatchEvent('#emitter-seed', 'input'); await page.click('#apply-emitter');
  const reseeded = await snapshotAt(0.4);
  assert.notDeepEqual(reseeded, atFirst, 'outra seed altera o resultado');
  assert.equal(reseeded.every(particle => particle.every(Number.isFinite)), true);

  // Orçamento por perfil e bloqueio de publicação acima do limite.
  await page.selectOption('#emitter-mode', 'continuous');
  const setNumber = async (selector, value) => {await page.fill(selector, String(value)); await page.dispatchEvent(selector, 'input');};
  await setNumber('#emitter-rate', 400); await setNumber('#emitter-life-max', 5); await setNumber('#emitter-duration', 5); await setNumber('#emitter-maxParticles', 1400);
  await page.click('#apply-emitter');
  await page.selectOption('#quality-profile', 'low');
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.particleBudget.verdict.publishable === false);
  assert.deepEqual(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.particleBudget.verdict.over), ['particles']);
  assert.match(await page.locator('#particle-budget').innerText(), /excede particles/);
  await page.selectOption('#quality-profile', 'high');
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.particleBudget.verdict.publishable === true);
  assert.match(await page.locator('#particle-budget').innerText(), /publicável/);

  // Acessibilidade: reduce motion suprime e reporta; noFlash limita a opacidade.
  await page.check('#access-reduce-motion');
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.particleBudget.suppressed > 0);
  assert.match(await page.locator('#particle-budget').innerText(), /supressão visível/);
  await page.uncheck('#access-reduce-motion');
  await page.check('#access-no-flash');
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.particleSnapshot().every(particle => particle[4] <= 0.85001)), true);
  await page.uncheck('#access-no-flash');

  // Cleanup: criar/remover/retroceder não pode acumular geometria.
  const baseline = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.rendererGeometries);
  for (let index = 0; index < 5; index++) {await page.click('#remove-emitter'); await page.click('#add-emitter');}
  for (const time of [0, 1.5, 0.2, 0.9]) await snapshotAt(time);
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.rendererGeometries);
  assert.equal(after <= baseline + 1, true, `geometrias acumuladas: ${baseline} → ${after}`);

  await page.locator('#particle-budget').scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  await page.screenshot({path: `${evidence}/composer-f3.png`, fullPage: true});
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(external.length, 0, external.join('\n'));
  const result = {status: 'approved', phase: 'F3.1', offline: true, externalRequests: 0, coverage: ['contrato de partículas', 'determinismo por seed e tempo', 'rewind', 'orçamento low/high', 'reduce motion', 'noFlash', 'telemetria e draw calls', 'cleanup sem vazamento']};
  await writeFile(`${evidence}/resultado.json`, JSON.stringify(result, null, 2));
  console.log('✓ F3.1 browser: partículas determinísticas, orçamento, acessibilidade e cleanup offline.');
} finally {await browser.close();}
