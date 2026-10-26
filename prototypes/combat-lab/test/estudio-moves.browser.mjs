// @ts-check
// Navegador: Estúdio de Moves em janela própria (fase 6 do plano do Editor de Moves). Abre o jogo e o Estúdio (?moves=1&move=...) lado a lado,
// confere o layout (só arena + Editor), os atalhos de teclado e a sincronia ao vivo dos ajustes (mecânica e visual) entre as duas janelas.
// Uso: node prototypes/combat-lab/test/estudio-moves.browser.mjs
import {chromium} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {pathToFileURL, fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + 'evidence/editor/';
mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : process.env.ARENAMON_BROWSER_PATH ? {executablePath: process.env.ARENAMON_BROWSER_PATH} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: ESTÚDIO DE MOVES EM JANELA PRÓPRIA ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox']});
try {
  const ctx = await browser.newContext({viewport: {width: 1400, height: 900}});
  const errors = /** @type {string[]} */ ([]);
  ctx.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  const game = await ctx.newPage();game.on('pageerror', e => errors.push(e.message));
  await game.goto(labUrl);
  await game.waitForFunction(() => window.__lab?.game, null, {timeout: 120000});

  // O botão «↗ Janela própria» do Editor abre o Estúdio no Move aberto
  await game.evaluate(() => {document.getElementById('editor-open').click();});
  await game.selectOption('#editor-move', 'swift');
  const [studio] = await Promise.all([ctx.waitForEvent('page'), game.click('#editor-popout')]);
  await studio.waitForFunction(() => window.__lab?.game && document.body.classList.contains('modo-moves'), null, {timeout: 120000});
  const lay = await studio.evaluate(() => {
    const vis = (/** @type {string} */ s) => {const e = document.querySelector(s);return !!e && getComputedStyle(e).display !== 'none' && !(/** @type {any} */ (e)).hidden;};
    return {url: location.search, editor: vis('#move-editor'), rail: vis('.rail'), dock: vis('.dock'), menu: vis('#menu'), move: /** @type {HTMLSelectElement} */ (document.getElementById('editor-move'))?.value, canvas: vis('.stage canvas'), title: document.title};
  });
  check('o botão «Janela própria» abre o Estúdio no Move aberto (swift)', /moves=1/.test(lay.url) && lay.move === 'swift', JSON.stringify(lay));
  check('Estúdio: só o visualizador (arena) e o Editor; trilho, dock e tela inicial escondidos', lay.editor && lay.canvas && !lay.rail && !lay.dock && !lay.menu, JSON.stringify(lay));
  await studio.waitForTimeout(600);
  await studio.screenshot({path: out + 'estudio-de-moves.png'});

  // Atalhos: ] troca de Move, Enter executa, ? mostra a ajuda
  await studio.evaluate(() => /** @type {HTMLElement} */ (document.activeElement)?.blur?.());
  await studio.keyboard.press(']');
  const next = await studio.evaluate(() => /** @type {HTMLSelectElement} */ (document.getElementById('editor-move')).value);
  check('atalho ] passa para o próximo Move', next !== 'swift', next);
  await studio.keyboard.press('[');
  check('atalho [ volta ao Move anterior', await studio.evaluate(() => /** @type {HTMLSelectElement} */ (document.getElementById('editor-move')).value) === 'swift');
  await studio.keyboard.press('Enter');
  const ran = await studio.waitForFunction(() => /** @type {any} */ (window).__lab.ui.scenario?.def?.id?.startsWith('editor-'), null, {timeout: 5000}).then(() => true, () => false);
  check('atalho Enter executa o Move no visualizador', ran);
  await studio.keyboard.press('?');
  check('atalho ? mostra a ajuda dos atalhos', await studio.evaluate(() => !document.getElementById('editor-keys-help').hidden));

  // Sincronia: mudar a mecânica no Estúdio muda no jogo, e o contrário; visual também
  const before = await game.evaluate(() => window.__lab.C.world.swift.damage);
  await studio.evaluate(v => window.__lab.tuning.commit([['world.swift.damage', v]], 'teste'), before + 3);
  const synced = await game.waitForFunction(v => window.__lab.C.world.swift.damage === v, before + 3, {timeout: 3000}).then(() => true, () => false);
  check('mecânica: mudar no Estúdio vale no jogo na hora', synced, `dano ${before} → ${await game.evaluate(() => window.__lab.C.world.swift.damage)}`);
  await studio.evaluate(() => window.__lab.tuning.undo());
  const back = await game.waitForFunction(v => window.__lab.C.world.swift.damage === v, before, {timeout: 3000}).then(() => true, () => false);
  check('mecânica: desfazer no Estúdio volta no jogo', back);
  // A IA parada do Estúdio é só dele: o jogo continua com a IA do rival como estava
  check('a IA parada do Estúdio não desliga a IA do jogo', await game.evaluate(() => window.__lab.C.extras.toggles.enableEnemyAI) !== 0);
  // Visual: o Editor do jogo está aberto no Swift; mudar um parâmetro visual no Estúdio aparece no slider do jogo
  await game.evaluate(() => {const d = document.getElementById('editor-visual');if (d) d.open = true;});
  const v = await studio.evaluate(() => {
    document.getElementById('editor-visual')?.setAttribute('open', '');
    const input = /** @type {HTMLInputElement} */ (document.querySelector('#move-editor-body input[data-visual="starScale"]'));
    const nv = String(+(Number(input.min) + (Number(input.max) - Number(input.min)) * .5).toFixed(2));input.value = nv;input.dispatchEvent(new Event('input'));return Number(input.value);
  });
  const vok = await game.waitForFunction(v => Number(/** @type {HTMLInputElement} */ (document.querySelector('#move-editor-body input[data-visual="starScale"]'))?.value) === v, v, {timeout: 3000}).then(() => true, () => false);
  check('visual: mudar a escala da estrela no Estúdio aparece no Editor do jogo', vok, `starScale ${v}`);
  check('sem erros de página', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
