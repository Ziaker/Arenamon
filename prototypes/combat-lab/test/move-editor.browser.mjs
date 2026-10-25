// @ts-check
// Navegador (Playwright, file:// offline): o Editor de Moves no jogo real — abrir pelo botão, executar o Sand Wave na arena, ler o resultado,
// mudar um slider de mecânica e de visual e ver o efeito, copiar o move.json, e conferir que nada de rede/erro apareceu.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: EDITOR DE MOVES ---\n');
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

  check('o botão «Editor» existe e a gaveta começa fechada', await L(() => !!document.getElementById('editor-open') && document.getElementById('move-editor').hidden));
  await page.click('#editor-open');
  check('clicar abre o Editor de Moves', await L(() => !document.getElementById('move-editor').hidden));
  check('lista o Sand Wave', await page.locator('#editor-move option[value="sand-wave"]').count() === 1);
  const nMech = await page.locator('#editor-mechanics [data-path]').count();
  check('mostra os sliders de mecânica do Sand Wave (custo, alcance, dano…)', nMech >= 15, `${nMech} controles`);
  check('tem o slider de dano e o de alcance', await page.locator('#editor-mechanics [data-path="world.sandWave.damage"]').count() === 1 && await page.locator('#editor-mechanics [data-path="world.sandWave.length"]').count() === 1);
  await page.click('#editor-visual summary');
  const nVis = await page.locator('#editor-visual [data-visual]').count();
  check('mostra os sliders de visual do atelier (aprovado)', nVis >= 60, `${nVis} controles`);

  // Executar: o alvo a 3 m recebe o Sand Wave
  await page.click('#editor-play');
  await page.waitForFunction(() => window.__lab.ui.lastResult?.id?.startsWith('editor-'), null, {timeout: 120000});
  await page.waitForFunction(() => document.querySelector('#editor-result table'), null, {timeout: 10000});
  const rows = await L(() => [...document.querySelectorAll('#editor-result tr')].map(r => r.textContent));
  check('o play mostra o resultado em tabela', rows.length >= 5, rows.slice(1, 4).join(' | '));
  check('a 3 m o Sand Wave acerta e cega', rows.some(r => /Acertou o alvo.*sim/.test(r)) && rows.some(r => /Cegueira aplicada.*sim/.test(r)));
  const dmg1 = await L(() => window.__lab.C.world.sandWave.damage);
  check('o dano mostrado é o do slider', rows.some(r => r.includes(`${dmg1.toFixed(1)} HP`)), `${dmg1} HP`);

  // Mexe no slider de dano pela interface e executa de novo
  await L(() => {const el = document.querySelector('#editor-mechanics [data-path="world.sandWave.damage"]');el.value = '14';el.dispatchEvent(new Event('input', {bubbles: true}));el.dispatchEvent(new Event('change', {bubbles: true}));});
  check('o slider de dano altera o parâmetro do jogo', await L(() => window.__lab.C.world.sandWave.damage) === 14);
  await L(() => {window.__lab.ui.lastResult = null;});
  await page.click('#editor-play');
  await page.waitForFunction(() => window.__lab.ui.lastResult?.id?.startsWith('editor-'), null, {timeout: 120000});
  await page.waitForFunction(() => /14\.0 HP/.test(document.getElementById('editor-result').textContent), null, {timeout: 10000});
  check('a nova execução causa 14 HP', true);

  // Alvo fora do alcance
  await L(() => {const d = document.getElementById('editor-distance');d.value = '12';d.dispatchEvent(new Event('input', {bubbles: true}));window.__lab.ui.lastResult = null;});
  await page.click('#editor-play');
  await page.waitForFunction(() => window.__lab.ui.lastResult?.id?.startsWith('editor-'), null, {timeout: 120000});
  await page.waitForFunction(() => /Acertou o alvo[^A-Z]*não/.test(document.getElementById('editor-result').textContent), null, {timeout: 10000});
  check('a 12 m o Sand Wave não acerta', true);

  // Visual: o slider altera o parâmetro aprovado usado no próximo disparo
  const before = await L(() => document.querySelector('#editor-visual [data-visual="density"]')?.value);
  await L(() => {const el = document.querySelector('#editor-visual [data-visual="density"]');el.value = String(Number(el.max));el.dispatchEvent(new Event('input', {bubbles: true}));});
  check('o slider de visual existe e muda de valor', before !== undefined && before !== await L(() => document.querySelector('#editor-visual [data-visual="density"]').value));

  // Copiar move.json
  await L(() => {window.__copied = null;navigator.clipboard.writeText = async t => {window.__copied = t;};});
  await page.click('#editor-copy-move');
  await page.waitForFunction(() => window.__copied, null, {timeout: 5000});
  const json = JSON.parse(await L(() => window.__copied));
  check('«Copiar move.json» gera um arquivo válido com o dano editado', json.schemaVersion === 1 && json.params.rows.find(r => r.key === 'damage')?.value === 14 && json.def.id === 'sand-wave');

  mkdirSync(root + 'evidence/editor', {recursive: true});
  if (!process.env.ARENAMON_SKIP_SCREENSHOTS) await page.screenshot({path: root + 'evidence/editor/editor-sand-wave.png'});

  check('sem erros de página/console', errors.length === 0, errors.slice(0, 2).join(' | '));
  check('sem requisições externas', requests.length === 0, requests.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${passed} de ${passed + failed} verificações aprovadas.`);
if (failed) process.exit(1);
console.log('Tudo aprovado.');
