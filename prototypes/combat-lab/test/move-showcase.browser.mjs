// @ts-check
// Navegador (Playwright, file:// offline): a aba Moves como VITRINE — equipados em destaque, não equipados abaixo, clicar abre o Editor de Moves
// naquele Move (inclusive Reflect e Psyshock, agora em move.json), equipar/tirar, ajustes compartilhados recolhidos. Sem erros de console nem rede.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: VITRINE DE MOVES ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 900}});
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url());});
  await page.context().setOffline(true);
  await page.goto(labUrl + '?fabrica=1');
  await page.waitForFunction(() => window.__lab?.game && window.__lab.tuning, null, {timeout: 120000});
  const L = (fn, arg) => page.evaluate(fn, arg);
  await L(() => window.__lab.game.setLoadout(0, ['sand-wave', 'harden', null, null]));
  await page.click('button[data-tool="moves"]');

  check('a aba Moves mostra a vitrine', await page.locator('#moves-showcase').isVisible());
  check('os ajustes compartilhados e ferramentas vêm recolhidos e não há mais cartões de sliders por Move na aba', await L(() => !document.getElementById('moves-tools').open) && await page.locator('#moves-panel .mv-move[data-move]:not([data-move="_charge"])').count() === 0);
  check('Equipados em destaque: sand-wave no slot 1 e harden no slot 2, com o botão do jogo', await L(() => {
    const c = [...document.querySelectorAll('#mvs-equipped .mvs-card')];
    return c.length >= 2 && c[0].dataset.move === 'sand-wave' && c[1].dataset.move === 'harden' && c[0].querySelector('.mvs-key').textContent.length > 0;
  }));
  const nEq = await page.locator('#mvs-equipped .mvs-card').count(), nEmpty = await page.locator('#mvs-equipped .mvs-empty').count();
  check('os slots vazios aparecem com «Equipar um Move…»', nEmpty === nEq - 2 && nEmpty >= 1, `${nEq} slots, ${nEmpty} vazios`);
  const others = await L(() => [...document.querySelectorAll('#mvs-others .mvs-other')].map(c => c.dataset.move));
  check('Não equipados: os outros Moves, sem repetir os equipados', others.length >= 15 && !others.includes('sand-wave') && !others.includes('harden') && others.includes('water-pulse') && others.includes('reflect'), `${others.length} Moves`);
  check('os cartões mostram categoria, selo, custo e recarga', await L(() => /custo 2\.00/.test(document.querySelector('#mvs-equipped [data-move="sand-wave"] .mvs-num').textContent) && !!document.querySelector('#mvs-others [data-move="air-slash"] .mvs-cat-burst')));

  // clicar num equipado abre o editor naquele Move
  check('o Editor começa fechado', await L(() => document.getElementById('move-editor').hidden));
  await page.click('#mvs-equipped [data-move="harden"] .mvs-open');
  check('clicar em Harden (equipado) abre o Editor de Moves em Harden', await L(() => !document.getElementById('move-editor').hidden && document.getElementById('editor-move').value === 'harden'));
  // clicar num não equipado abre o editor naquele Move
  await page.click('#mvs-others [data-move="water-pulse"] .mvs-open');
  check('clicar em Water Pulse (não equipado) troca o Editor para Water Pulse', await L(() => document.getElementById('editor-move').value === 'water-pulse' && !!document.getElementById('editor-hold')));
  check('os sliders do editor são os do Move clicado', await page.locator('#editor-mechanics [data-path^="world.waterPulse."]').count() >= 10);

  // equipar a partir da vitrine
  await page.selectOption('#mvs-others [data-move="air-slash"] select.mvs-equip', '2');
  check('Equipar no slot 3: o loadout do jogo muda e o cartão sobe para Equipados', await L(() => window.__lab.game.fighters[0].loadout[2] === 'air-slash') && await page.locator('#mvs-equipped .mvs-card[data-move="air-slash"]').count() === 1 && await page.locator('#mvs-others .mvs-card[data-move="air-slash"]').count() === 0);
  // trocar (mover) um já equipado para outro slot
  await page.selectOption('#mvs-others [data-move="bounce"] select.mvs-equip', '0');
  check('Equipar num slot ocupado troca o Move (sand-wave sai para os não equipados)', await L(() => window.__lab.game.fighters[0].loadout[0] === 'bounce') && await page.locator('#mvs-others .mvs-card[data-move="sand-wave"]').count() === 1);
  // tirar
  await page.click('#mvs-equipped [data-move="harden"] .mvs-off');
  check('«✕» tira o Move do slot e ele volta aos não equipados', await L(() => !window.__lab.game.fighters[0].loadout.includes('harden')) && await page.locator('#mvs-others .mvs-card[data-move="harden"]').count() === 1);
  // vermelho
  await page.click('#moves-showcase [data-fighter="1"]');
  check('o seletor Vermelho mostra o loadout do vermelho (sem os Moves do azul)', await L(() => document.querySelector('#moves-showcase [data-fighter="1"]').getAttribute('aria-pressed') === 'true') && await page.locator('#mvs-equipped .mvs-card[data-move]').count() === 0);
  await page.click('#moves-showcase [data-fighter="0"]');
  // mudança por outro caminho (API / gaveta Ações) aparece sozinha
  await L(() => window.__lab.game.setLoadout(0, ['swift', null, null, null]));
  await page.waitForFunction(() => document.querySelector('#mvs-equipped [data-move="swift"]'), null, {timeout: 5000});
  check('a vitrine acompanha mudanças de loadout feitas por outro caminho', true);

  // Reflect e Psyshock (agora em dado) abrem o Editor como os demais
  await page.click('#mvs-others [data-move="reflect"] .mvs-open');
  check('Reflect (agora em dado) abre o Editor em Reflect, com os sliders de mecânica e a dica de carga', await L(() => document.getElementById('editor-move').value === 'reflect' && !!document.getElementById('editor-hold')) && await page.locator('#editor-mechanics [data-path^="world.reflect."]').count() >= 15);
  check('nenhum Move fica «em código»: o selo sumiu da vitrine', await page.locator('#moves-showcase .mvs-code').count() === 0);

  mkdirSync(root + 'evidence/editor', {recursive: true});
  if (!process.env.ARENAMON_SKIP_SCREENSHOTS) {
    await page.click('#mvs-others .mvs-card[data-move="reflect"] .mvs-open');
    await page.waitForTimeout(300);
    await L(() => {const b = document.querySelector('#panel .panel-body');if (b) b.scrollTop = 0;});
    await page.screenshot({path: root + 'evidence/editor/vitrine-moves.png'});
  }
  check('sem erros de página/console', errors.length === 0, errors.slice(0, 2).join(' | '));
  check('sem requisições externas', requests.length === 0, requests.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${passed} de ${passed + failed} verificações aprovadas.`);
if (failed) process.exit(1);
console.log('Tudo aprovado.');
