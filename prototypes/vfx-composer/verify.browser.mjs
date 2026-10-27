import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('./', import.meta.url));
const reportPath = root + 'dist/vfx-composer-f0.html';
assert.equal(existsSync(reportPath), true, 'O relatório compilado precisa existir antes do smoke test');

const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  const errors = [];
  const external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(reportPath).href);

  assert.equal(await page.title(), 'VFX Composer — contratos F0');
  assert.match(await page.locator('main').innerText(), /23 testes de contrato passaram/);
  assert.equal(await page.locator('li').count(), 23);
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(external.length, 0, `Requisições externas inesperadas: ${external.join(', ')}`);

  for (const link of await page.locator('a').evaluateAll(nodes => nodes.map(node => node.href))) {
    if (link.startsWith('file:')) assert.equal(existsSync(fileURLToPath(link)), true, `Link local ausente: ${link}`);
  }
  console.log('✓ Relatório F0 abre offline no navegador, lista 23 contratos e não contém links locais quebrados.');
} finally {
  await browser.close();
}
