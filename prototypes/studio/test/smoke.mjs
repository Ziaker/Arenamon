// Diagnóstico rápido: abre o HTML, instala o rig sintético e salva uma captura. Uso: node test/smoke.mjs
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {readFile, mkdir} from 'node:fs/promises';
const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = await readFile(new URL('fixture.js', import.meta.url), 'utf8');
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 900}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.goto(pathToFileURL(root + 'dist/arenamon-animation-studio.html').href);await page.waitForFunction(() => window.__studioEditor);
  await page.evaluate(async src => {const {syntheticRig} = await import('data:text/javascript,' + encodeURIComponent(src));const {T, install} = window.__importer;const r = syntheticRig(T);await install(r.root, r.clips, 'sintetico.glb');}, fixture);
  await page.waitForTimeout(400);await mkdir(root + 'validation', {recursive: true});
  await page.screenshot({path: root + 'validation/smoke.png'});
  console.log(JSON.stringify({errors, clips: await page.evaluate(() => window.__importer.clips.map(c => [c.name, c.duration, c.tracks[0].name]))}, null, 1));
} finally {await browser.close();}
