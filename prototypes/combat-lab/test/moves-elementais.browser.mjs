// @ts-check
// Navegador (Playwright, file:// offline): os 4 Moves elementais no jogo real — equipar, acionar pelo teclado como o jogador, ver entidades/VFX e
// capturar imagens em evidence/moves-elementais/. Água/Fogo/Voador/Grama ocupam os slots A, S, 3 e 4.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const out = root + 'evidence/moves-elementais/';
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : process.env.ARENAMON_BROWSER_PATH ? {executablePath: process.env.ARENAMON_BROWSER_PATH} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: MOVES ELEMENTAIS ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox']});
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.context().setOffline(true);
  await page.goto(labUrl + '?fabrica=1');
  await page.waitForFunction(() => window.__lab?.moves && window.__lab.game, null, {timeout: 120000});
  const L = (fn, arg) => page.evaluate(fn, arg);
  const hold = async (code, ms) => {await page.locator('canvas').first().focus();await page.keyboard.down(code);await page.waitForTimeout(ms);await page.keyboard.up(code);};
  const reset = () => L(() => {const {game, C} = window.__lab;C.extras.toggles.enableEnemyAI = 0;game.setLoadout(0, ['water-pulse', 'fire-spin', 'air-slash', 'seed-bomb']);window.__lab.startMatch();});
  const shot = name => page.screenshot({path: `${out}${name}.png`});

  await reset();
  check('os 4 Moves equipam nos slots 1–4', JSON.stringify(await L(() => window.__lab.game.fighters[0].loadout)) === JSON.stringify(['water-pulse', 'fire-spin', 'air-slash', 'seed-bomb']));

  // Water Pulse (A): segurar carrega, soltar emite a esfera
  await hold('KeyA', 900);
  const water = await page.waitForFunction(() => window.__lab.game.world.entities.some(e => e.visual === 'waterorb'), null, {timeout: 30000}).then(() => true, () => false);
  await shot('water-pulse');
  check('A (Water Pulse) emite a esfera de água', water);

  // Air Slash (3): toque emite a lâmina
  await reset();
  await hold('Digit3', 80);
  const slash = await page.waitForFunction(() => window.__lab.game.world.entities.some(e => e.visual === 'airslash'), null, {timeout: 30000}).then(() => true, () => false);
  await shot('air-slash');
  check('3 (Air Slash) emite a lâmina de ar', slash);

  // Fire Spin (S): segurar abre o marcador; soltar planta a zona
  await reset();
  await page.locator('canvas').first().focus();await page.keyboard.down('KeyS');
  await page.waitForFunction(() => !!window.__lab.game.fighters[0].aim, null, {timeout: 30000});
  await page.waitForTimeout(300);
  await shot('fire-spin-marcador');
  await page.keyboard.up('KeyS');
  const fire = await page.waitForFunction(() => window.__lab.game.world.entities.some(e => e.visual === 'firespin'), null, {timeout: 30000}).then(() => true, () => false);
  await page.waitForTimeout(300);
  await shot('fire-spin');
  check('S (Fire Spin) planta a zona de fogo', fire);

  // Seed Bomb (4): segurar abre o marcador; soltar lança a semente
  await reset();
  await page.locator('canvas').first().focus();await page.keyboard.down('Digit4');
  await page.waitForFunction(() => !!window.__lab.game.fighters[0].aim, null, {timeout: 30000});
  await page.waitForTimeout(300);
  await page.keyboard.up('Digit4');
  await page.waitForFunction(() => window.__lab.game.world.entities.some(e => e.visual === 'seed' || e.visual === 'seedblast'), null, {timeout: 30000});
  await shot('seed-bomb');
  check('4 (Seed Bomb) lança a semente', await L(() => window.__lab.game.world.entities.some(e => e.visual === 'seed' || e.visual === 'seedblast')));

  // Painel: sliders dos 4 Moves
  await L(() => {window.__lab.game.setLoadout(0, []);window.__lab.startMatch();});
  await L(() => {if (document.getElementById('moves-drawer').hidden) document.getElementById('moves-open').click();});
  const groups = {'water-pulse': 'waterPulse', 'fire-spin': 'fireSpin', 'air-slash': 'airSlash', 'seed-bomb': 'seedBomb'};
  const missing = [];
  for (const [id, g] of Object.entries(groups)) {
    await page.selectOption('[data-slot-move="0.0"]', id);
    if (!await L(g => !!document.querySelector(`#moves-panel [data-p="${g}.cost"]`) && document.querySelectorAll(`#moves-panel [data-p^="${g}."]`).length >= 6, g)) missing.push(id);
  }
  check('a aba Moves mostra os sliders dos 4 Moves', missing.length === 0, missing.join(','));
  check('nenhum erro de página nem de console', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
