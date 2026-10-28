import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const browser = await chromium.launch({headless: true, channel: 'msedge'});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
await page.goto(`file:///${fileURLToPath(new URL('../dist/arenamon-vfx-composer.html', import.meta.url)).replaceAll('\\', '/')}`);
for (const id of ['global-header', 'domain-rail', 'project-hierarchy', 'authoring-viewport', 'context-inspector', 'authoring-timeline', 'composer-status', 'academy-vfx']) {
  assert.equal(await page.locator(`#${id}`).count(), 1, `região semântica ausente: ${id}`);
}
assert.equal(await page.locator('#academy-vfx').getAttribute('open'), null, 'Academia inicia recolhida');
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth), true, 'sem rolagem horizontal global');
await page.locator('#maximize-viewport').click();
assert.equal(await page.locator('.app.viewport-maximized').count(), 1);
await page.locator('#maximize-viewport').click();
assert.equal(await page.locator('.app.viewport-maximized').count(), 0);
await page.keyboard.press('Control+K');
assert.equal(await page.locator('#command-palette:not([hidden])').count(), 1, 'Ctrl+K abre busca de comandos');
await page.locator('#command-search').fill('enquadrar');
assert.ok(await page.locator('#command-results button').count() >= 1, 'busca encontra comando contextual');
await page.keyboard.press('Escape');
assert.equal(await page.locator('#command-palette[hidden]').count(), 1, 'Escape fecha busca');
assert.equal(await page.locator('#authoring-timeline .timeline-head').count(), 1, 'timeline visual montada');
assert.equal(await page.locator('#composer-status .status-budget').count(), 1, 'orçamento visual montado');
assert.match(await page.locator('#composer-status').getAttribute('aria-label'), /partículas/i, 'estado tem equivalente acessível');
await browser.close();
console.log('✓ Visual overhaul: shell, timeline visual, orçamento e comandos verificados.');
