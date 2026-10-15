// Captura de diagnóstico: node test/smoke.mjs [nome] [largura] [altura]. Instala o rig sintético e salva validation/<nome>.png.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {readFile, mkdir} from 'node:fs/promises';
const root = fileURLToPath(new URL('..', import.meta.url));
const [name = 'smoke', width = 1500, height = 900] = process.argv.slice(2);
const fixture = await readFile(new URL('fixture.js', import.meta.url), 'utf8');
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: +width, height: +height}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.goto(pathToFileURL(root + 'dist/arenamon-animation-studio.html').href);await page.waitForFunction(() => window.__studioEditor);
  await page.evaluate(async src => {const {syntheticRig} = await import('data:text/javascript,' + encodeURIComponent(src));const {T, install} = window.__importer;const r = syntheticRig(T);await install(r.root, r.clips, 'sintetico.glb');}, fixture);
  await page.waitForTimeout(400);await mkdir(root + 'validation', {recursive: true});
  await page.screenshot({path: root + `validation/${name}.png`});
  console.log(JSON.stringify({errors}));
} finally {await browser.close();}
