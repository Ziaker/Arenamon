// Fase 5 no navegador (Edge real): laboratório pelo servidor local opcional (pastas do projeto: presets, modelos de
// chars/, relatórios), avaliação da IA pela interface e o painel externo de relatórios (file://, offline) lendo
// os relatórios gravados — sem acesso à partida. Também verifica o modo offline sem servidor (explicação + fallback).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {startDevServer, AREAS} from '../dev-server.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'validation/tools/';mkdirSync(out, {recursive: true});
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const report = [];let failures = 0;
const check = (group, label, ok, detail = '') => {report.push({group, label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${group} · ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const srv = await startDevServer({port: 0, quiet: true, watchFiles: false}), base = `http://127.0.0.1:${srv.port}`;
const browser = await chromium.launch({...BROWSER, headless: true});
const created = [];
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}, acceptDownloads: true}), errors = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});page.on('dialog', d => d.accept());
  await page.goto(base + '/');await page.waitForFunction(() => window.__lab);
  const L = (fn, arg) => page.evaluate(fn, arg), tab = t => L(t => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== t) document.querySelector(`[data-tool="${t}"]`).click();}, t);
  await tab('export');await page.waitForFunction(() => document.querySelectorAll('.pf-area').length === 5);
  check('Servidor local', 'pastas do projeto disponíveis (5 áreas)', /Servidor local/.test(await page.textContent('#pf-panel')));
  check('Servidor local', 'link do painel de relatórios aponta para o servidor', await page.getAttribute('#reports-link', 'href') === '/relatorios');
  // Preset do usuário → arquivo JSON em presets/.
  await L(() => {const p = window.__lab.presets;p.api.saveAll([...p.api.list(), {id: 'user:teste-pastas', name: 'Teste pastas', version: 1, description: 'gerado pelo teste', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), scope: 'partial', categories: ['locomotion'], values: {'locomotion.acceleration': 33}}]);});
  await page.click('#pf-save-presets');await page.waitForFunction(() => /gravado/.test(document.getElementById('pf-msg').textContent));
  const presetFile = AREAS.presets.dir + '/teste-pastas.json';created.push(presetFile);
  check('Pastas', 'presets do usuário gravados como JSON na pasta do projeto', existsSync(presetFile) && JSON.parse(readFileSync(presetFile, 'utf8')).preset.values['locomotion.acceleration'] === 33);
  await L(() => window.__lab.presets.api.saveAll(window.__lab.presets.api.list().filter(p => p.name !== 'Teste pastas')));await page.click('#pf-refresh');await page.waitForTimeout(400);
  await page.locator('.pf-area[data-area="presets"] tr[data-file="teste-pastas.json"] button').click();await page.waitForTimeout(200);
  check('Pastas', 'preset carregado de volta da pasta', await L(() => window.__lab.presets.api.list().some(p => p.name === 'Teste pastas')));
  // Modelo organizado em pasta (chars/, fora do Git).
  const models = await L(() => [...document.querySelectorAll('.pf-area[data-area="characters"] tr[data-file]')].map(r => r.dataset.file));
  // Os GLBs de chars/ são do usuário: abrir cada um passa pelo mesmo carregamento/validação do seletor de arquivo.
  const outcome = [];
  for (const m of models.slice(0, 4)) {
    await L(() => {document.getElementById('pf-msg').textContent = '';});
    await page.locator(`.pf-area[data-area="characters"] tr[data-file="${m}"] button[data-act="blue"]`).click();
    await page.waitForFunction(() => (document.getElementById('pf-msg')?.textContent || '').trim().length > 0, null, {timeout: 30000}).catch(() => {});
    outcome.push(`${m}: ${(await page.textContent('#pf-msg')).trim()}`);
  }
  check('Pastas', 'modelos de chars/ abertos pelo mesmo carregamento (com motivo claro quando não servem)', models.length === 0 || outcome.every(o => /carregado no azul|não contém|Formato|Arquivo/.test(o)), outcome.join(' | '));
  // Relatórios gerados nesta sessão → gravados em validation/reports e validation/benchmarks.
  await tab('scenarios');await page.fill('#aieval-matches', '8');await page.click('#aieval-run');await page.waitForSelector('#aieval-report table');
  check('IA', 'avaliação anterior × revisada pela interface', /Revisada/.test(await page.textContent('#aieval-report')) && /Ações negadas/.test(await page.textContent('#aieval-report')));
  await page.click('#mv-run');await page.waitForSelector('#mv-report table');
  await L(() => {window.__lab.diagnostics.log.push({tick: 1, t: .01, fighter: 0, kind: 'tackle', result: 'denied', reason: 'stamina', detail: {value: .5, required: 1}, text: 'X ignorado: stamina insuficiente (0,50 / 1,00)', state: 'neutral', action: null, actionElapsed: null, stamina: .5});});
  await tab('export');await page.click('#pf-save-reports');await page.waitForFunction(() => /relatório\(s\) gravado/.test(document.getElementById('pf-msg').textContent));
  const saved = readdirSync(AREAS.reports.dir).filter(f => /^(movimento|diagnostico-comandos|avaliacao-ia)-/.test(f)).map(f => AREAS.reports.dir + '/' + f);created.push(...saved);
  check('Pastas', 'relatórios persistentes gravados em validation/reports', saved.length >= 3, saved.map(f => f.split('/').at(-1)).join(', '));
  await page.goto(base + '/relatorios');check('Servidor local', 'painel de relatórios servido em /relatorios', await page.title() === 'Arenamon · Painel de Relatórios');
  check('Geral', 'sem erros no console (servidor local)', errors.length === 0, errors.join(' | '));

  // ================= Painel externo (file://, offline) =================
  const p2 = await browser.newPage({viewport: {width: 1400, height: 900}}), err2 = [];p2.on('pageerror', e => err2.push(e.message));
  await p2.context().setOffline(true);await p2.goto(pathToFileURL(root + 'dist/arenamon-painel-relatorios.html').href);await p2.waitForFunction(() => window.__reports);
  const extra = [root + 'validation/perf/benchmark.json', root + 'validation/calib/relatorio-movimento.json'].filter(existsSync);
  writeFileSync(out + 'invalido.json', '{"x":1}');writeFileSync(out + 'futuro.json', JSON.stringify({schema: 'arenamon-lab-report', version: 99, kind: 'ai-evaluation'}));
  await p2.setInputFiles('#files', [...saved, ...extra, out + 'invalido.json', out + 'futuro.json']);await p2.waitForTimeout(300);
  const items = await p2.evaluate(() => window.__reports.reports.map(r => ({name: r.name, kind: r.kind, error: r.error})));
  check('Painel', 'reconhece cada tipo de relatório e recusa inválidos/versões futuras', items.filter(i => i.kind).length === saved.length + extra.length && items.find(i => i.name === 'invalido.json').error && /v99/.test(items.find(i => i.name === 'futuro.json').error), JSON.stringify(items.map(i => i.kind ?? i.error)));
  for (const [i, it] of items.entries()) {
    if (!it.kind) continue;await p2.evaluate(i => window.__reports.select(i), i);await p2.waitForTimeout(150);
    const h2 = await p2.textContent('#main h2');
    if (it.kind === 'movement-comparison') check('Painel', 'movimento: medidas e gráficos (sem acessar a partida)', await p2.locator('#charts figure.chart').count() === 7 && /Gravador/.test(h2));
    else check('Painel', `${it.kind}: renderizado`, h2.length > 3 && await p2.locator('#main table').count() >= 1, h2);
    await p2.screenshot({path: out + `painel-${it.kind}.png`});
  }
  check('Geral', 'sem erros no console (painel offline)', err2.length === 0, err2.join(' | '));

  // ================= HTML offline sem servidor =================
  const p3 = await browser.newPage();await p3.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href);await p3.waitForFunction(() => window.__lab);
  await p3.evaluate(() => document.querySelector('[data-tool="export"]').click());await p3.waitForTimeout(200);
  const offline = await p3.textContent('#pf-panel');
  check('Offline', 'sem servidor: explica o modo, oferece escolher pasta e mantém o workspace', /Indispon/.test(offline) && /npm run dev:combat-lab/.test(offline) && await p3.locator('#pf-pick').count() === 1, offline.slice(0, 120));
  check('Offline', 'link do painel de relatórios relativo ao HTML', await p3.getAttribute('#reports-link', 'href') === 'arenamon-painel-relatorios.html');
} finally {
  writeFileSync(out + 'report.json', JSON.stringify({date: new Date().toISOString(), failures, report}, null, 1));
  for (const f of created) rmSync(f, {force: true});
  await browser.close();await srv.close();
}
console.log(`\n${report.length - failures} de ${report.length} verificações aprovadas.`);
if (failures) process.exit(1);
