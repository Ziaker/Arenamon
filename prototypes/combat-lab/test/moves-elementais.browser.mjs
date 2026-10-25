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

  await page.locator('#moves-open').click();
  check('Ações conserva a aba Moves', await page.locator('#act-tabs [data-act="moves"]').isVisible());
  check('Ações › Moves conserva equipagem e botões', await page.locator('#act-moves [data-slot-move]').count() > 0 && await page.locator('#act-moves [data-slot-key]').count() > 0);
  check('Ações › Moves não contém sliders', await page.locator('#act-moves input[type="range"]').count() === 0);
  await page.locator('#moves-close').click();

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

  // Painel: a aba Moves é a vitrine; os sliders e os VFX dos 4 Moves vivem no Editor de Moves
  await L(() => {window.__lab.game.setLoadout(0, []);window.__lab.startMatch();});
  await L(() => document.querySelector('[data-tool="moves"]')?.click());
  const openMove = id => L(id => {document.querySelector('#moves-showcase .mvs-card[data-move="' + id + '"] .mvs-open').click();}, id);
  const groups = {'water-pulse': 'waterPulse', 'fire-spin': 'fireSpin', 'air-slash': 'airSlash', 'seed-bomb': 'seedBomb'};
  const missing = [];
  for (const [id, g] of Object.entries(groups)) {
    await openMove(id);
    if (!await L(g => !!document.querySelector('#editor-mechanics [data-path="world.' + g + '.cost"]') && document.querySelectorAll('#editor-mechanics [data-path^="world.' + g + '."]').length >= 6, g)) missing.push(id);
  }
  check('o Editor (aberto pela aba Moves) mostra os sliders dos 4 Moves', missing.length === 0, missing.join(','));
  await openMove('air-slash');
  check('o Editor tem as seções Palco, Análise, Mecânica, Visual/VFX e Salvar', await L(() => ['Palco', 'Análise', 'Mecânica', 'Efeitos do jogo (VFX)', 'Salvar'].every(t => [...document.querySelectorAll('#move-editor-body h4')].some(h => h.textContent === t))));
  check('Executar roda o Move no palco (cenário do editor)', await L(async () => {document.getElementById('editor-play').click();await new Promise(r => setTimeout(r, 300));return window.__lab.ui.scenario?.def?.id === 'editor-air-slash';}));
  await L(() => document.getElementById('editor-stop').click());
  check('atalho abre Ações no Move e Ações volta ao Editor', await L(async () => {document.getElementById('editor-open-actions').click();await new Promise(r => setTimeout(r, 150));const ok = !document.querySelector('#moves-drawer').hidden && document.querySelector('#move-editor').hidden && !!document.querySelector('#act-moves details[data-action-move="air-slash"][open]');document.querySelector('[data-goto-params="air-slash"]').click();await new Promise(r => setTimeout(r, 150));return ok && document.querySelector('#moves-drawer').hidden && !document.querySelector('#move-editor').hidden && document.getElementById('editor-move').value === 'air-slash';}));
  check('a mecânica do Editor traz só controles mecânicos (os visuais ficam em VFX)', await L(() => !document.querySelector('#editor-mechanics [data-visual]') && !document.querySelector('#editor-mechanics [data-path="world.airSlash.visualWidth"]') && !!document.querySelector('#editor-vfx [data-visual="world.airSlash.visualWidth"]')));
  check('os sliders de alcance incluem os padrões ampliados (limites efetivos, não os do JSON)', await L(async () => {
    const out = [];
    for (const [id, move, expected] of [['fire-spin', 'fireSpin', 20], ['seed-bomb', 'seedBomb', 32]]) {
      document.querySelector('#moves-showcase .mvs-card[data-move="' + id + '"] .mvs-open').click();
      const input = document.querySelector('#editor-mechanics [data-path="world.' + move + '.range"]');
      out.push(!!input && Number(input.value) === expected && Number(input.max) >= expected);
    }
    return out.every(Boolean);
  }));
  check('todos os Moves da vitrine abrem o Editor com a seção de VFX', await L(async () => {
    const ids = [...document.querySelectorAll('#moves-showcase .mvs-card[data-move] .mvs-open')].map(b => b.dataset.move);
    for (const id of ids) {document.querySelector('#moves-showcase .mvs-card[data-move="' + id + '"] .mvs-open').click();if (!document.querySelector('#editor-vfx') || document.getElementById('editor-move').value !== id) return false;}
    return ids.length > 15;
  }));
  await openMove('air-slash');
  check('VFX do Move tem os controles visuais elementais', await L(() => !!document.querySelector('#editor-vfx [data-visual="vfx.elemental.visual.airSlash0.shotFollowTime"]')));
  check('VFX compartilhados: a barreira (Reflect) e a rocha (Psyshock) têm os seus controles no Editor', await L(() => {const has = (id, key) => {document.querySelector('#moves-showcase .mvs-card[data-move="' + id + '"] .mvs-open').click();return !!document.querySelector('#editor-vfx [data-visual="' + key + '"]');};return has('reflect', 'vfx.barrier.opacity') && has('psyshock', 'vfx.rock.scale');}));
  check('ajustes visuais antes misturados aos Moves estão no VFX de cada Move', await L(async () => {
    const has = (id, key) => {document.querySelector('#moves-showcase .mvs-card[data-move="' + id + '"] .mvs-open').click();return !!document.querySelector('#editor-vfx [data-visual="' + key + '"]');};
    return has('air-slash', 'world.airSlash.visualWidth') && has('riposte', 'world.riposte.fxIntensity') && has('seed-bomb', 'world.seedBomb.blastLife');
  }));
  await openMove('air-slash');
  check('ajuste visual próprio atualiza a configuração e o JSON', await L(() => {const input = document.querySelector('#editor-vfx [data-visual="world.airSlash.visualWidth"]');input.value = '1.4';input.dispatchEvent(new Event('input', {bubbles: true}));input.dispatchEvent(new Event('change', {bubbles: true}));return window.__lab.C.world.airSlash.visualWidth === 1.4 && window.__lab.tuning.exportData().values.world.airSlash.visualWidth === 1.4;}));
  check('tempo de seguimento (por Move) ajusta e exporta 0,5 s', await L(() => {const input = document.querySelector('#editor-vfx [data-visual="vfx.elemental.visual.airSlash0.shotFollowTime"]');input.value = '0.5';input.dispatchEvent(new Event('input', {bubbles: true}));input.dispatchEvent(new Event('change', {bubbles: true}));return window.__lab.C.vfx.elemental.visual.airSlash0.shotFollowTime === .5 && window.__lab.tuning.exportData().values.vfx.elemental.visual.airSlash0.shotFollowTime === .5;}));
  check('nenhum erro de página nem de console', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
