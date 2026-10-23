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
  const shot = name => process.env.ARENAMON_SKIP_SCREENSHOTS === '1' ? Promise.resolve() : page.screenshot({path: `${out}${name}.png`});

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
  await L(() => document.querySelector('[data-tool="moves"]')?.click());
  const groups = {'water-pulse': 'waterPulse', 'fire-spin': 'fireSpin', 'air-slash': 'airSlash', 'seed-bomb': 'seedBomb'};
  const missing = [];
  for (const [id, g] of Object.entries(groups)) {
    await page.selectOption('[data-slot-move="0.0"]', id);
    if (!await L(g => !!document.querySelector(`#moves-panel [data-p="${g}.cost"]`) && document.querySelectorAll(`#moves-panel [data-p^="${g}."]`).length >= 6, g)) missing.push(id);
  }
  check('a aba Moves mostra os sliders dos 4 Moves', missing.length === 0, missing.join(','));
  check('a aba Moves contém só controles mecânicos', await L(() => !document.querySelector('#moves-panel [data-visual]') && !document.querySelector('#moves-panel [data-p="airSlash.visualWidth"]') && !document.querySelector('#moves-panel [data-p="riposte.fxIntensity"]')));
  check('os sliders de alcance incluem os padrões ampliados', await L(() => [['fireSpin',20],['seedBomb',32]].every(([move,expected]) => {const input=document.querySelector(`#moves-panel [data-p="${move}.range"]`);return input && Number(input.value)===expected && Number(input.max)>=expected;})));
  await L(() => document.querySelector('[data-tool="moves-vfx"]')?.click());
  check('todos os Moves listados na mecânica aparecem na aba VFX', await L(() => {const ids=[...document.querySelectorAll('#moves-panel details.mv-move[data-move]')].map(x=>x.dataset.move);return ids.length>10 && ids.every(id=>document.querySelector(`#moves-vfx-panel details.mv-move[data-move="${id}"]`));}));
  check('VFX dos Moves tem os controles visuais elementais e compartilhados', await L(() => !!document.querySelector('#moves-vfx-panel [data-visual="vfx.elemental.visual.airSlash0.opacity"]') && !!document.querySelector('#moves-vfx-panel [data-visual="vfx.elemental.shotFollowTime"]') && !!document.querySelector('#moves-vfx-panel [data-visual="vfx.barrier.opacity"]') && !!document.querySelector('#moves-vfx-panel [data-visual="vfx.rock.scale"]')));
  check('ajustes visuais antes misturados aos Moves foram movidos', await L(() => !!document.querySelector('#moves-vfx-panel [data-visual="world.airSlash.visualWidth"]') && !!document.querySelector('#moves-vfx-panel [data-visual="world.riposte.fxIntensity"]') && !!document.querySelector('#moves-vfx-panel [data-visual="world.seedBomb.blastLife"]')));
  check('ajuste visual próprio atualiza a configuração e o JSON', await L(() => {const input=document.querySelector('#moves-vfx-panel [data-visual="world.airSlash.visualWidth"]');input.value='1.4';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return window.__lab.C.world.airSlash.visualWidth===1.4&&window.__lab.tuning.exportData().values.world.airSlash.visualWidth===1.4;}));
  check('tempo de seguimento ajusta e exporta 0,5 s', await L(() => {const input = document.querySelector('#moves-vfx-panel [data-visual="vfx.elemental.shotFollowTime"]');input.value = '0.5';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return window.__lab.C.vfx.elemental.shotFollowTime === .5 && window.__lab.tuning.exportData().values.vfx.elemental.shotFollowTime === .5;}));
  check('nenhum erro de página nem de console', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
