import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const browser = await chromium.launch({headless: true, channel: 'msedge'});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
const evidence = fileURLToPath(new URL('../evidence/visual-overhaul/', import.meta.url));
await mkdir(evidence, {recursive: true});
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
await page.locator('#load-explosion').click();
const laneBefore = await page.locator('.timeline-lane').first().evaluate(element => element.getBoundingClientRect().width);
await page.locator('[data-timeline-zoom]').fill('4');
const laneAfter = await page.locator('.timeline-lane').first().evaluate(element => element.getBoundingClientRect().width);
assert.ok(laneAfter > laneBefore * 2, 'zoom temporal amplia a régua e as trilhas');
for (const width of [1800, 1440, 980]) {
  await page.setViewportSize({width, height: 900});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth), true, `sem overflow global em ${width}px`);
}
await page.setViewportSize({width: 720, height: 800});
assert.equal(await page.locator('.small-screen-notice').evaluate(element => getComputedStyle(element).display !== 'none'), true, 'tela pequena explica como continuar');
await page.setViewportSize({width: 1440, height: 900});
assert.equal(await page.locator('#domain-rail button[aria-label="Criar"] svg title').textContent(), 'Criar', 'ícones têm nome acessível');
await page.locator('#domain-rail button').first().focus();
assert.match(await page.locator('#domain-rail button').first().evaluate(element => getComputedStyle(element).outlineStyle), /solid|auto/, 'foco de teclado visível');
await page.screenshot({path: `${evidence}/composer-overview.png`, fullPage: true});
await writeFile(`${evidence}/resultado.json`, `${JSON.stringify({schema: 'arenamon.vfx.visual-overhaul.evidence', passed: true, checks: ['semantic-regions', 'academy-collapsed', 'no-global-overflow', 'viewport-maximize', 'command-palette', 'visual-timeline', 'visual-budget', 'accessible-icons', 'keyboard-focus', 'narrow-message'], viewports: [1800, 1440, 980, 720]}, null, 2)}\n`);
await browser.close();
console.log('✓ Visual overhaul: shell, timeline visual, orçamento e comandos verificados.');
