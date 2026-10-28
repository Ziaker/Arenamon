// Wookada embutido no HTML do laboratório: aparece no seletor do Azul, carrega e vira lutador (IA × IA).
// Uso: node test/wookada-embedded.browser.mjs (com dist/ recompilado por npm run build:combat-lab).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('..', import.meta.url));
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href);
  await page.waitForFunction(() => window.__lab, null, {timeout: 60000});
  await page.waitForFunction(() => [...document.querySelectorAll('#quick-char-0 option')].some(o => /wookada/i.test(o.textContent)), null, {timeout: 30000});
  const listed = await page.evaluate(() => [...document.querySelectorAll('#quick-char-0 option')].map(o => o.textContent));
  assert.ok(listed.some(t => /wookada\.glb/.test(t)), 'Wookada no seletor do Azul');
  await page.evaluate(() => {const s = document.querySelector('#quick-char-0');s.value = [...s.options].find(o => /wookada/i.test(o.textContent)).value;s.dispatchEvent(new Event('change'));});
  await page.waitForFunction(() => window.__lab.ui.sources[0]?.name === 'wookada.glb', null, {timeout: 60000});
  const species = await page.evaluate(() => window.__lab.quickMenu.speciesOf(0));
  assert.equal(species, 'wookada', 'Espécie reconhecida');
  assert.deepEqual(errors, [], 'Sem erros de página');
  console.log('ok: Wookada listado, carregado no Azul, espécie', species);
} finally {
  await browser.close();
}
