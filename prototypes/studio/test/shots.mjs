// Capturas de comparação (rig sintético): node test/shots.mjs → validation/after-*.png
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'validation/';
const fixture = await readFile(new URL('fixture.js', import.meta.url), 'utf8');
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 900}});
  await page.goto(pathToFileURL(root + 'dist/arenamon-animation-studio.html').href);await page.waitForFunction(() => window.__studioEditor);
  await page.screenshot({path: out + 'after-first-run.png'});
  await page.evaluate(async src => {const {syntheticRig} = await import('data:text/javascript,' + encodeURIComponent(src));const E = window.__importer, r = syntheticRig(E.T);await E.install(r.root, r.clips, 'sintetico.glb');}, fixture);
  await page.waitForTimeout(300);await page.click('[data-panel="export"]');await page.screenshot({path: out + 'after-export.png'});
  await page.click('#st-panel-close');await page.click('#st-library-close');await page.waitForTimeout(200);await page.screenshot({path: out + 'after-focus.png'});
} finally {await browser.close();}
