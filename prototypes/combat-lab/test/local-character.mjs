// Diagnóstico local com um GLB do usuário (não versionado): node test/local-character.mjs caminho.glb
// Mostra o mapa de animações, os estados sem animação própria e quais animações tocam numa luta IA × IA.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)), file = process.argv[2];
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}}), errors = [];page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href);await page.waitForFunction(() => window.__lab);
  await page.click('[data-tool="characters"]');await page.locator('.char-slot').nth(0).locator('input[type=file]').setInputFiles(file);
  await page.waitForFunction(() => window.__lab.ui.characters[0]);await page.locator('.char-slot').nth(1).getByRole('button', {name: 'Usar o do azul'}).click();
  await page.evaluate(() => {window.__lab.C.extras.toggles.enablePlayerAI = 1;});await page.click('[data-tool="match"]');await page.click('#start');
  const seen = new Map();
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(100);
    for (const [k, v] of await page.evaluate(() => window.__lab.ui.characters.map(c => c?.current ? `${c.current.key} → ${c.current.id}` : null).filter(Boolean).map(x => [x, 1]))) seen.set(k, (seen.get(k) || 0) + v);
  }
  await page.click('[data-tool="characters"]');await page.screenshot({path: root + 'validation/local-character.png'});
  const info = await page.evaluate(() => {const c = window.__lab.ui.characters[0];return {clips: c.clips.map(x => `${x.name} (${x.duration.toFixed(2)} s)`), mapping: Object.fromEntries(Object.entries(c.mapping).map(([k, i]) => [k, c.clips[i].name])), missing: c.missingStates()};});
  console.log(JSON.stringify({...info, played: Object.fromEntries([...seen].sort((a, b) => b[1] - a[1])), errors}, null, 1));
} finally {await browser.close();}
