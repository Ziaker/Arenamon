// Atelier Areia/Pedra no navegador (Edge real, offline): fases desligáveis, sliders por fase, seletor de disparo, aviso, legenda, persistência e
// acessibilidade (plano docs/plans/2026-10-24-vfx-por-fase-atelier.md). Verificação técnica; o visual é aprovado pelo responsável.
// Padrão: GPU real. ARENAMON_GL=software força SwiftShader (lento, instável nesta máquina).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const html = pathToFileURL(root + 'dist/arenamon-areia-pedra.html').href;
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true, args: process.env.ARENAMON_GL === 'software' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []});
let failures = 0;
const check = (label, ok, detail = '') => {console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
try {
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, acceptDownloads: true});
  await context.setOffline(true);
  const page = await context.newPage(), errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) network.push(r.url());});
  await page.goto(html);await page.waitForFunction(() => window.__labDiagnostics);
  const L = fn => page.evaluate(fn);
  const openAll = () => L(() => document.querySelectorAll('#sliders .phase-group').forEach(g => {g.open = true;}));
  const pickCategory = async c => {await page.locator(`#categories [data-category="${c}"]`).click();await page.waitForTimeout(150);await openAll();};

  // ---------- Fases na interface ----------
  await pickCategory('sand');
  const order = await L(() => [...document.querySelectorAll('#sliders .phase-group')].map(g => g.dataset.phase));
  check('Sand Wave mostra as seis fases na ordem do padrão', order.join() === 'start,launch,body,sustain,finish,impact', order.join());
  const toggles = await L(() => [...document.querySelectorAll('#sliders [data-phase-toggle]')].map(c => c.checked));
  check('cada fase tem «Ligar esta fase», ligada por padrão', toggles.length === 6 && toggles.every(Boolean));
  const explained = await L(() => [...document.querySelectorAll('#sliders .phase-field')].every(f => f.querySelector('.help')?.textContent.length > 5));
  check('todo controle tem explicação curta', explained);
  const synced = await L(() => {
    const f = document.querySelector('#sliders [data-key="length"]'), r = f.querySelector('input[type=range]'), n = f.querySelector('input[type=number]');
    n.value = '5.5';n.dispatchEvent(new Event('change', {bubbles: true}));
    const a = r.value === '5.5';r.value = '3.2';r.dispatchEvent(new Event('input', {bubbles: true}));
    return a && n.value === '3.2';
  });
  check('slider e campo numérico andam juntos nos dois sentidos', synced);

  // ---------- Interruptor: esmaece, guarda o valor, some da legenda ----------
  await L(() => {const r = document.querySelector('#sliders [data-key="warningRadius"]');return r;});
  const before = await L(() => document.querySelector('#sliders [data-key="length"] input[type=range]').value);
  await page.locator('#phase-start-on').uncheck();
  await page.waitForTimeout(200);
  const off = await L(() => ({cls: document.querySelector('#sliders [data-phase="start"]').classList.contains('off'), value: document.querySelector('#sliders [data-key="length"] input[type=range]').value, flag: window.__labDiagnostics().values?.startOn}));
  check('desligar o surgimento esmaece o grupo e guarda os valores', off.cls && off.value === before, JSON.stringify(off));
  const legend = new Set();
  for (let t = 0; t <= 2.4; t += .2) {
    await L(() => {});
    await page.locator('#scrub').evaluate((el, v) => {el.value = String(v);el.dispatchEvent(new Event('input', {bubbles: true}));}, t);
    legend.add(await page.locator('#phase').textContent());
  }
  check('a legenda nunca mostra a fase desligada', ![...legend].includes('Surgimento / preparação'), [...legend].join(' | '));
  await page.locator('#phase-start-on').check();
  await page.waitForTimeout(150);
  const back = await L(() => document.querySelector('#sliders [data-key="length"] input[type=range]').value);
  check('religar devolve os valores como estavam', back === before);

  // ---------- Seletor de disparo ----------
  const shot = async () => L(() => [...document.querySelectorAll('#sliders .phase-field[data-key^="shot"]')].filter(f => !f.hidden).map(f => f.dataset.key));
  const initial = await shot();
  check('disparo começa em Nenhum: só o seletor aparece', initial.join() === 'shotKind', initial.join());
  await page.locator('#sliders [data-key="shotKind"] select').selectOption('1');
  const ring = await shot();
  check('Argola mostra os sliders da argola e esconde os do cone', ring.includes('shotThickness') && ring.includes('shotSquash') && !ring.includes('shotCount'), ring.join());
  await L(() => {const r = document.querySelector('#sliders [data-key="shotRadius"] input[type=range]');r.value = '0.9';r.dispatchEvent(new Event('input', {bubbles: true}));});
  await page.locator('#sliders [data-key="shotKind"] select').selectOption('2');
  const cone = await shot();
  check('Tiro em cone mostra os sliders do cone e esconde os da argola', cone.includes('shotCount') && cone.includes('shotAngleH') && !cone.includes('shotThickness'), cone.join());
  await page.locator('#sliders [data-key="shotKind"] select').selectOption('1');
  check('trocar de volta preserva o valor do outro tipo', await L(() => document.querySelector('#sliders [data-key="shotRadius"] input[type=range]').value) === '0.9');
  await page.locator('#sliders [data-key="shotKind"] select').selectOption('0');

  // ---------- Nada para mostrar ----------
  for (const p of ['start', 'launch', 'body', 'sustain', 'finish', 'impact']) await page.locator(`#phase-${p}-on`).uncheck();
  await page.waitForTimeout(250);
  const warn = await L(() => ({hidden: document.getElementById('phase-warning').hidden, text: document.getElementById('phase-warning').textContent, playing: document.getElementById('pause').textContent}));
  check('com todas as fases visuais desligadas o painel avisa', !warn.hidden && /nada para mostrar/.test(warn.text), warn.text);
  for (const p of ['start', 'launch', 'body', 'sustain', 'finish', 'impact']) await page.locator(`#phase-${p}-on`).check();
  await page.waitForTimeout(250);
  check('religar tira o aviso', await L(() => document.getElementById('phase-warning').hidden));

  check('sem erros de página/console e sem requisições externas', errors.length === 0 && network.length === 0, errors.concat(network).slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} falha(s)` : '\nTudo aprovado.');
process.exit(failures ? 1 : 0);
