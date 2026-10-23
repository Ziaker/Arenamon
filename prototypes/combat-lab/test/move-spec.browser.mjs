// @ts-check
// Navegador: assistente de ficha de Move na aba Moves (#02) — preencher, ver lacunas, exportar JSON/Markdown e reabrir.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : process.env.ARENAMON_BROWSER_PATH ? {executablePath: process.env.ARENAMON_BROWSER_PATH} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: ASSISTENTE DE FICHA DE MOVE ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox']});
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}, acceptDownloads: true});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.context().setOffline(true);
  await page.goto(labUrl + '?fabrica=1');
  await page.waitForFunction(() => window.__lab?.moves && window.__lab.game, null, {timeout: 120000});
  await page.evaluate(() => {try {localStorage.removeItem('arenamon-move-spec-draft');} catch {}});
  await page.evaluate(() => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== 'moves') document.querySelector('button[data-tool="moves"]').click();});
  await page.evaluate(() => {const w = document.querySelector('details.mv-wizard');w.open = true;w.querySelector('details[data-k="spec:identidade"]').open = true;w.querySelector('details[data-k="spec:categoria"]').open = true;});
  const pend0 = await page.textContent('[data-spec-summary] b');
  check('a ficha nova começa com todas as decisões obrigatórias pendentes', Number(pend0) >= 20, `${pend0} pendentes`);
  await page.fill('[data-spec-value="id"]', 'meu-move');
  await page.fill('[data-spec-value="name"]', 'Meu Move');
  await page.selectOption('[data-spec-value="category"]', 'Burst');
  const pend1 = await page.textContent('[data-spec-summary] b');
  check('responder campos reduz as pendências e o status vira "proposto" (nunca aprovado sozinho)', Number(pend1) === Number(pend0) - 3 && await page.isChecked('[data-spec-flag="name|proposto"]') && !(await page.isChecked('[data-spec-flag="name|aprovado"]')), `${pend0} → ${pend1}`);
  await page.check('[data-spec-flag="name|implementado"]');   // os status são independentes: implementado sem aprovado
  await page.fill('[data-spec-source="name"]', 'M18.1');
  const [dlJson] = await Promise.all([page.waitForEvent('download'), page.click('[data-spec-json]')]);
  const spec = JSON.parse(readFileSync(await dlJson.path(), 'utf8'));
  check('o JSON exportado guarda valor, os quatro status independentes e a fonte', spec.schema === 'arenamon-move-spec' && spec.fields.name.value === 'Meu Move' && spec.version === 2 && spec.fields.name.flags.proposto === true && spec.fields.name.flags.implementado === true && spec.fields.name.flags.aprovado === false && spec.fields.name.source === 'M18.1');
  const [dlMd] = await Promise.all([page.waitForEvent('download'), page.click('[data-spec-md]')]);
  const md = readFileSync(await dlMd.path(), 'utf8');
  check('o Markdown lista o que está pendente e o comando para criar o Move', /PENDENTE/.test(md) && /npm run novo-move -- "Meu Move"/.test(md));
  await page.click('[data-spec-clear]');
  const pend2 = await page.textContent('[data-spec-summary] b');
  check('Limpar volta tudo a pendente', Number(pend2) === Number(pend0));
  await page.setInputFiles('[data-spec-file]', await dlJson.path());
  await page.waitForFunction(() => /Ficha aberta/.test(document.querySelector('[data-spec-result]')?.textContent ?? ''), null, {timeout: 15000});
  const pend3 = await page.textContent('[data-spec-summary] b');
  check('abrir a ficha exportada restaura as respostas', Number(pend3) === Number(pend1), `${pend3} pendentes`);
  check('sem erros de página', errors.length === 0, errors.join(' | ').slice(0, 200));
} finally {
  await browser.close();
}
console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
