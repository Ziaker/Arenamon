// Ferramentas visuais de colisão no navegador (Edge real): as 5 sobreposições em «Visualizar», o grupo «Colisões e ambiente» na lista de cenários
// (um clique roda os 15), «Dados ao vivo» com apoio/último contato, sem erros no console. Gera capturas em evidence/collision-tools/.
// Uso: node prototypes/combat-lab/test/collision-tools.browser.mjs
import {chromium} from '@playwright/test';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';
import {startDevServer} from '../dev-server.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'evidence/collision-tools/';mkdirSync(out, {recursive: true});
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const report = [];let failures = 0;
const check = (label, ok, detail = '') => {report.push({label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const srv = await startDevServer({port: 0, quiet: true, watchFiles: false}), base = `http://127.0.0.1:${srv.port}`;
const browser = await chromium.launch({...BROWSER, headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.goto(base + '/');await page.waitForFunction(() => window.__lab);
  const tab = t => page.evaluate(t => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== t) document.querySelector(`[data-tool="${t}"]`).click();}, t);
  await tab('overlays');
  const keys = ['mapSolids', 'support', 'envContacts', 'sweeps', 'overlaps'];
  check('Visualizar: as 5 sobreposições de colisão existem', (await Promise.all(keys.map(k => page.locator(`#overlay-list input[data-overlay="${k}"]`).count()))).every(n => n === 1));
  for (const k of keys) await page.locator(`#overlay-list input[data-overlay="${k}"]`).check();
  await tab('scenarios');
  check('Cenários: grupo «Colisões e ambiente (15)» no topo da lista', (await page.textContent('#scenario-collisions-group')).includes('(15)') && (await page.locator('#scenario-list > *').first().getAttribute('id')) === 'scenario-collisions-group');
  check('Cenários: 15 cenários de colisão listados', await page.locator('#scenario-list .scenario[data-id^="col-"]').count() === 15);
  await page.click('#scenario-collisions');
  const rep = await page.textContent('#scenario-report');
  check('Um clique roda os 15 e todos passam', /15 de 15 cenários de colisão aprovados/.test(rep), rep.slice(0, 80));
  // Cenário individual com as sobreposições ligadas: arremesso contra pilar.
  await page.locator('#scenario-list .scenario[data-id="col-throw-pillar"] button').click();
  await page.waitForTimeout(350);
  await page.evaluate(() => {document.getElementById('panel').hidden = true;});   // só o palco 3D na captura
  await page.screenshot({path: out + 'arremesso-contra-pilar.png'});
  await page.evaluate(() => {document.getElementById('panel').hidden = false;});
  await tab('data').catch(() => {});
  const live = await page.evaluate(() => document.getElementById('live-data')?.textContent ?? '');
  check('Dados ao vivo: linhas de apoio, último contato e objetos do cenário', /Azul · apoio/.test(live) && /Azul · último contato/.test(live) && /Objetos do cenário/.test(live) && /Penetração em sólidos/.test(live), live.slice(0, 120));
  await page.locator('#scenario-list .scenario[data-id="col-land-platform-top"] button').click();
  await page.waitForTimeout(1800);
  await page.evaluate(() => {document.getElementById('panel').hidden = true;});
  await page.screenshot({path: out + 'pouso-no-topo-da-plataforma.png'});
  // Modelo REAL de chars/ no azul (mesmo carregamento do painel «Exportar»), com os cenários e as sobreposições ligadas.
  await page.evaluate(() => {document.getElementById('panel').hidden = false;});
  await tab('export');await page.waitForFunction(() => document.querySelectorAll('.pf-area').length === 5);
  const models = await page.evaluate(() => [...document.querySelectorAll('.pf-area[data-area="characters"] tr[data-file]')].map(r => r.dataset.file));
  let loaded = '';
  for (const m of models.slice(0, 4)) {
    await page.evaluate(() => {document.getElementById('pf-msg').textContent = '';});
    await page.locator(`.pf-area[data-area="characters"] tr[data-file="${m}"] button[data-act="blue"]`).click();
    await page.waitForFunction(() => (document.getElementById('pf-msg')?.textContent || '').trim().length > 0, null, {timeout: 30000}).catch(() => {});
    if (/carregado no azul/.test(await page.textContent('#pf-msg'))) {loaded = m;break;}
  }
  check('Modelo real de chars/ carregado no azul', models.length === 0 || loaded !== '', loaded || `sem modelo servível entre ${models.length}`);
  if (loaded) {
    await tab('scenarios');
    await page.locator('#scenario-list .scenario[data-id="col-land-platform-top"] button').click();
    await page.waitForTimeout(2200);
    await page.evaluate(() => {document.getElementById('panel').hidden = true;});
    await page.screenshot({path: out + 'modelo-real-pouso-na-plataforma.png'});
  }
  check('Sem erros no console durante os cenários e as sobreposições', errors.length === 0, errors.slice(0, 2).join(' | '));
  // HTML jogável CONSTRUÍDO (file://, sem servidor): as 5 sobreposições, o grupo de cenários e os 15/15 num clique.
  const built = await browser.newPage({viewport: {width: 1500, height: 920}}), berr = [];
  built.on('pageerror', e => berr.push(e.message));built.on('console', m => {if (m.type() === 'error') berr.push(m.text());});
  await built.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href);await built.waitForFunction(() => window.__lab);
  await built.evaluate(() => document.querySelector('[data-tool="scenarios"]').click());
  check('HTML construído (file://): grupo «Colisões e ambiente (15)» e 15/15 num clique', await built.locator('#scenario-list .scenario[data-id^="col-"]').count() === 15 && await (async () => {await built.click('#scenario-collisions');return /15 de 15 cenários de colisão aprovados/.test(await built.textContent('#scenario-report'));})());
  await built.evaluate(() => document.querySelector('[data-tool="overlays"]').click());
  check('HTML construído (file://): as 5 sobreposições de colisão existem', (await Promise.all(keys.map(k => built.locator(`#overlay-list input[data-overlay="${k}"]`).count()))).every(n => n === 1));
  check('HTML construído (file://): sem erros no console', berr.length === 0, berr.slice(0, 2).join(' | '));
} finally {
  await browser.close();srv.close?.();
  writeFileSync(out + 'resultado.json', JSON.stringify({when: new Date().toISOString(), failures, report}, null, 1));
}
console.log(failures ? `${failures} falha(s)` : 'Ferramentas visuais de colisão (navegador): tudo aprovado');
process.exit(failures ? 1 : 0);
