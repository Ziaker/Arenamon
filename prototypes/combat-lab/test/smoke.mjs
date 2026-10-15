// Captura rápida: node test/smoke.mjs [nome] [largura] [altura] [ferramenta]
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
const root = fileURLToPath(new URL('..', import.meta.url));
const [name = 'smoke', width = 1500, height = 900, tool = 'match'] = process.argv.slice(2);
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: +width, height: +height}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href);await page.waitForFunction(() => window.__lab);
  await page.click('#start');await page.evaluate(() => {window.__lab.C.extras.toggles.enablePlayerAI = 1;});await page.waitForTimeout(2500);
  if (tool !== 'match') await page.click(`[data-tool="${tool}"]`);await page.waitForTimeout(300);
  await mkdir(root + 'validation', {recursive: true});await page.screenshot({path: root + `validation/${name}.png`});
  console.log(JSON.stringify({errors, tick: await page.evaluate(() => window.__lab.game.tick), hits: await page.evaluate(() => window.__lab.recorder.hits.length)}));
} finally {await browser.close();}
