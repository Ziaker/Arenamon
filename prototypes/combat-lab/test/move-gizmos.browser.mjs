// @ts-check
// Navegador: overlay «Hitbox das entidades dos Moves» (#05), linha do tempo do Move (#04), atalho Disparar e ausência de erros.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : process.env.ARENAMON_BROWSER_PATH ? {executablePath: process.env.ARENAMON_BROWSER_PATH} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: GIZMOS E LINHA DO TEMPO DOS MOVES ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox']});
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.context().setOffline(true);
  await page.goto(labUrl + '?fabrica=1');
  await page.waitForFunction(() => window.__lab?.moves && window.__lab.game, null, {timeout: 120000});
  await page.evaluate(() => {const {C} = window.__lab;C.extras.toggles.enableEnemyAI = 0;window.__lab.startMatch();});

  // #04 linha do tempo
  await page.evaluate(() => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== 'moves') (document.querySelector('button[data-tool="moves"]').click(), document.getElementById('moves-legacy').open = true);});
  await page.click('details.mv-move[data-move="swift"] > summary');
  await page.click('[data-mvtab="swift|time"]');
  check('a aba Linha do tempo mostra a barra e as marcas em ticks', await page.locator('details.mv-move[data-move="swift"] .mv-tl-bar .mv-tl-mark').count() >= 2 && /ticks de 120 Hz/i.test(await page.locator('details.mv-move[data-move="swift"] [data-pane="time"]').textContent() ?? ''));
  await page.click('[data-tl-measure="swift"]');
  await page.waitForFunction(() => /Medido: ação de/.test(document.querySelector('[data-tl-result="swift"]')?.textContent ?? ''), null, {timeout: 20000});
  const txt = await page.textContent('[data-tl-result="swift"]');
  check('Medir no motor compara a marca da ficha com o tick real do efeito', /Efeito: ficha tick \d+ × motor tick \d+ ✓/.test(txt ?? ''), (txt ?? '').slice(0, 160));

  // #07 comparador A/B de variantes
  await page.click('[data-mvtab="swift|mec"]');
  await page.evaluate(() => {document.querySelector('details[data-k="ab:swift"]').open = true;});
  await page.click('[data-ab-run="swift"]');
  await page.waitForSelector('[data-ab-result="swift"] table', {timeout: 30000});
  const ab = await page.textContent('[data-ab-result="swift"]');
  check('o A/B compara atual × padrão de fábrica com métricas e o aviso de que render não é medido', /Dano causado/.test(ab ?? '') && /Stamina gasta/.test(ab ?? '') && /FPS e P95/.test(ab ?? ''), (ab ?? '').slice(0, 120));

  // #05 overlay de hitbox das entidades
  const known = await page.evaluate(() => !!document.querySelector('[data-overlay="moveEntities"]'));
  check('o overlay «Hitbox das entidades dos Moves» está na lista de Visualizar', known);
  await page.evaluate(() => {window.__lab.view.overlays.moveEntities = true;});
  await page.evaluate(() => {const {game} = window.__lab;game.setLoadout(0, ['swift']);});
  await page.click('[data-fire="swift"]');
  await page.waitForTimeout(500);
  const lines = await page.evaluate(() => window.__lab.view.debug?.length ?? -1);
  check('com o overlay ligado e estrelas no ar, a visão desenha sem erro', lines >= 0 && errors.length === 0, `${lines} linhas de depuração`);
  check('sem erros de página', errors.length === 0, errors.join(' | ').slice(0, 200));
} finally {
  await browser.close();
}
console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
