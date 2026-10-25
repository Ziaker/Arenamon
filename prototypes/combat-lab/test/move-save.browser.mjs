// @ts-check
// Navegador (Playwright): GRAVAR no disco pelo Editor de Moves, via servidor local — diferenças + confirmação, cancelar não grava, gravar grava,
// «nada para gravar», conflito (arquivo mudou no disco), visual aprovado, Reflect (selo «approved» preservado), e sem servidor (file://) os botões
// ficam desligados e explicam. Usa PASTAS TEMPORÁRIAS: os arquivos reais do projeto não são tocados.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdtempSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startDevServer} from '../dev-server.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const labFile = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

const tmp = mkdtempSync(join(tmpdir(), 'arenamon-save-ui-')), movesDir = join(tmp, 'moves'), approvedDir = join(tmp, 'approved');
mkdirSync(movesDir);mkdirSync(approvedDir);
for (const f of readdirSync(join(root, 'src/sim/moves')).filter(f => f.endsWith('.move.json'))) copyFileSync(join(root, 'src/sim/moves', f), join(movesDir, f));
for (const f of readdirSync(join(root, '../sand-stone-lab/approved')).filter(f => f.endsWith('.json'))) copyFileSync(join(root, '../sand-stone-lab/approved', f), join(approvedDir, f));
const realSand = readFileSync(join(root, 'src/sim/moves/sand-wave.move.json'), 'utf8');
const mv = id => JSON.parse(readFileSync(join(movesDir, id + '.move.json'), 'utf8'));
const row = (d, k) => d.params.rows.find((/** @type {any} */ r) => r.key === k);

console.log('\n--- NAVEGADOR: GRAVAR NO DISCO PELO EDITOR ---\n');
const srv = await startDevServer({port: 0, quiet: true, watchFiles: false, movesDir, approvedDir});
const browser = await chromium.launch({...BROWSER, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']});
try {
  // ---------- 1) sem servidor (file://) ----------
  {
    const page = await browser.newPage({viewport: {width: 1500, height: 900}});
    await page.context().setOffline(true);
    await page.goto(labFile + '?fabrica=1');
    await page.waitForFunction(() => window.__lab?.game && window.__lab.tuning, null, {timeout: 120000});
    await page.click('#editor-open');
    check('sem servidor: os botões de gravar ficam desligados e explicam por quê', await page.locator('#editor-save-move[aria-disabled="true"]').count() === 1 && /servidor local/i.test(await page.getAttribute('#editor-save-move', 'title') ?? ''));
    await page.click('#editor-save-move', {force: true});   // aria-disabled não bloqueia o clique de quem usa o mouse: o botão responde explicando
    check('sem servidor: clicar mostra como ligar o servidor e NÃO abre diálogo', /servidor local/i.test(await page.textContent('#editor-status') ?? '') && await page.locator('#editor-confirm').count() === 0);
    check('sem servidor: copiar o JSON continua funcionando', await page.locator('#editor-copy-move').count() === 1);
    await page.close();
  }

  // ---------- 2) com servidor local ----------
  const page = await browser.newPage({viewport: {width: 1500, height: 900}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error' && !/status of 409/.test(m.text())) errors.push(m.text());});   // o 409 do teste de conflito é esperado
  await page.goto(`http://127.0.0.1:${srv.port}/?fabrica=1`);
  await page.waitForFunction(() => window.__lab?.game && window.__lab.tuning, null, {timeout: 120000});
  check('a página servida sabe que pode gravar', await page.evaluate(() => !!window.__ARENAMON_DEV__?.save));
  const L = (fn, arg) => page.evaluate(fn, arg);
  const setSlider = (path, v) => L(([p, v]) => {const el = document.querySelector(`#editor-mechanics [data-path="${p}"]`);el.value = String(v);el.dispatchEvent(new Event('input', {bubbles: true}));el.dispatchEvent(new Event('change', {bubbles: true}));}, [path, v]);
  await page.click('#editor-open');
  await page.selectOption('#editor-move', 'sand-wave');
  check('com servidor: os botões de gravar ficam ligados', await page.locator('#editor-save-move[aria-disabled="true"]').count() === 0);

  // sem mudanças: nada para gravar
  await page.click('#editor-save-move');
  await page.waitForFunction(() => /Nada para gravar/.test(document.getElementById('editor-status').textContent), null, {timeout: 10000});
  check('sem mudanças: «Nada para gravar» (e nenhum diálogo)', await page.locator('#editor-confirm').count() === 0);

  // mudar o dano e CANCELAR
  await setSlider('world.sandWave.damage', 14);
  await page.click('#editor-save-move');
  await page.waitForSelector('#editor-confirm[open]', {timeout: 10000});
  const rows = await L(() => [...document.querySelectorAll('#editor-confirm tr')].map(r => r.textContent));
  check('o diálogo mostra o arquivo e a diferença «Dano fixo · valor 6 → 14»', /sand-wave\.move\.json/.test(await page.textContent('#editor-confirm') ?? '') && rows.some(r => /Dano fixo · valor614/.test(r)), rows.slice(1, 3).join(' | '));
  check('o diálogo vem com o foco em «Cancelar» (não grava por engano)', await L(() => document.activeElement?.id === 'editor-confirm-cancel'));
  if (!process.env.ARENAMON_SKIP_SCREENSHOTS) await page.screenshot({path: root + 'evidence/editor/gravar-confirmacao.png'});
  await page.click('#editor-confirm-cancel');
  await page.waitForFunction(() => /cancelada/i.test(document.getElementById('editor-status').textContent), null, {timeout: 10000});
  check('cancelar: nada é gravado e o editor avisa', await page.locator('#editor-confirm').count() === 0 && mv('sand-wave').params.rows.find((/** @type {any} */ r) => r.key === 'damage').value === 6);

  // gravar de verdade
  await page.click('#editor-save-move');
  await page.waitForSelector('#editor-confirm[open]');
  await page.click('#editor-confirm-ok');
  await page.waitForFunction(() => /Gravado em/.test(document.getElementById('editor-status').textContent), null, {timeout: 10000});
  check('confirmar grava o move.json no disco com o dano 14 (e só ele)', row(mv('sand-wave'), 'damage').value === 14 && row(mv('sand-wave'), 'cooldown').value === 10 && JSON.stringify(mv('sand-wave').def) === JSON.stringify(JSON.parse(realSand).def));
  check('o arquivo REAL do projeto não foi tocado (a gravação foi na pasta temporária)', readFileSync(join(root, 'src/sim/moves/sand-wave.move.json'), 'utf8') === realSand);
  check('o editor guarda em qual Move estava para reabrir depois do recarregamento', await L(() => sessionStorage.getItem('arenamon.editor.reopen')) === 'sand-wave');
  await page.click('#editor-save-move');
  await page.waitForFunction(() => /Nada para gravar/.test(document.getElementById('editor-status').textContent), null, {timeout: 10000});
  check('depois de gravar, gravar de novo diz que já está igual', true);

  // conflito: o arquivo muda no disco entre abrir o diálogo e confirmar
  await setSlider('world.sandWave.damage', 20);
  await page.click('#editor-save-move');
  await page.waitForSelector('#editor-confirm[open]');
  const ext = mv('sand-wave');row(ext, 'cooldown').value = 9;writeFileSync(join(movesDir, 'sand-wave.move.json'), JSON.stringify(ext, null, 2) + '\n');
  await page.click('#editor-confirm-ok');
  await page.waitForFunction(() => /mudou no disco/.test(document.getElementById('editor-status').textContent), null, {timeout: 10000});
  check('conflito: arquivo alterado por fora → recusa gravar (409) e mantém a alteração externa', row(mv('sand-wave'), 'damage').value === 14 && row(mv('sand-wave'), 'cooldown').value === 9);

  // visual aprovado
  await page.click('#editor-visual summary');
  await L(() => {const el = document.querySelector('#editor-visual [data-visual="density"]');el.value = String(Math.min(Number(el.max), 2.5));el.dispatchEvent(new Event('input', {bubbles: true}));});
  await page.click('#editor-save-visual');
  await page.waitForSelector('#editor-confirm[open]');
  const vrows = await L(() => [...document.querySelectorAll('#editor-confirm tr')].map(r => r.textContent));
  check('visual: o diálogo lista «Visual · density» e o arquivo approved/sand.json', vrows.some(r => /Visual · density/.test(r)) && /approved\/sand\.json/.test(await page.textContent('#editor-confirm') ?? ''), vrows.slice(1, 3).join(' | '));
  await page.click('#editor-confirm-ok');
  await page.waitForFunction(() => /Gravado em/.test(document.getElementById('editor-status').textContent), null, {timeout: 10000});
  check('visual: grava o parâmetro novo no approved/sand.json da pasta temporária', JSON.parse(readFileSync(join(approvedDir, 'sand.json'), 'utf8')).visualParameters.density === 2.5);

  // Reflect: o selo «approved» e as linhas explícitas de tremor são preservados
  await page.selectOption('#editor-move', 'reflect');
  await setSlider('world.reflect.widthMin', 2);
  await page.click('#editor-save-move');
  await page.waitForSelector('#editor-confirm[open]');
  const rrows = await L(() => [...document.querySelectorAll('#editor-confirm tr')].map(r => r.textContent));
  check('Reflect: o diálogo mostra só a mudança de «Largura mínima»', rrows.length === 2 && /Largura mínima · valor/.test(rrows[1] ?? ''), rrows.join(' | ').slice(0, 160));
  await page.click('#editor-confirm-ok');
  await page.waitForFunction(() => /Gravado em/.test(document.getElementById('editor-status').textContent), null, {timeout: 10000});
  const refl = mv('reflect');
  check('Reflect: gravou widthMin 2 e manteve «approved» e o tremor explícito', row(refl, 'widthMin').value === 2 && row(refl, 'widthMin').approved === true && refl.params.rows.some((/** @type {any} */ r) => r.key === 'hitShakeAmount') && !refl.params.rows.some((/** @type {any} */ r) => r.preset));

  // depois do recarregamento o editor reabre no Move em que estava
  await page.reload();
  await page.waitForFunction(() => window.__lab?.game && window.__lab.tuning, null, {timeout: 120000});
  check('depois de recarregar o jogo, o Editor reabre no Move que você estava editando', await L(() => !document.getElementById('move-editor').hidden && document.getElementById('editor-move').value === 'reflect'));
  check('sem erros de página/console', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
  await srv.close();
  rmSync(tmp, {recursive: true, force: true});
}
check('no fim, o arquivo real continua intacto', readFileSync(join(root, 'src/sim/moves/sand-wave.move.json'), 'utf8') === realSand);
console.log(`\n${passed} de ${passed + failed} verificações aprovadas.`);
if (failed) process.exit(1);
console.log('Tudo aprovado.');
