// Captura local (não versionar resultados): node test/local-shot.mjs caminho.glb
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1600, height: 960}});
  await page.goto(pathToFileURL(root + 'dist/arenamon-animation-studio.html').href);await page.waitForFunction(() => window.__studioEditor);
  await page.setInputFiles('#model', process.argv[2]);await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Modelo carregado'), null, {timeout: 60000});
  const names = await page.evaluate(() => window.__importer.clips.map((c, i) => `${i}:${c.name}:${c.duration.toFixed(2)}`));console.log(names.join('\n'));
  const idx = Number(process.argv[3] || 0);await page.evaluate(i => {window.__importer.selectIndex(i);window.__studioEditor.setExpanded(true);}, idx);await page.click('[data-tool="root"]');await page.waitForTimeout(300);
  await page.screenshot({path: root + 'validation/local-root.png'});
  await page.click('[data-tool="compare"]');await page.selectOption('#lab-compare-type', 'clips');await page.selectOption('#ed-cmp-b', String((idx + 1) % names.length));await page.waitForTimeout(400);
  await page.screenshot({path: root + 'validation/local-compare.png'});
} finally {await browser.close();}
