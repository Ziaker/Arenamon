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
  check('Sand Wave mostra as seis fases na ordem do padrão', order.join() === 'start,launch,body,hold,finish,impact', order.join());
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
  check('disparo começa em Nenhum: só o seletor, o atraso e a camada Recoil & Flash aparecem', initial.join() === 'shotKind,shotDelay,shotRecoilFlash,shotRecoilHalo,shotRecoilKick,shotRecoilWaves,shotRecoilPlume', initial.join());
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
  for (const p of ['start', 'launch', 'body', 'hold', 'finish', 'impact']) await page.locator(`#phase-${p}-on`).uncheck();
  await page.waitForTimeout(250);
  const warn = await L(() => ({hidden: document.getElementById('phase-warning').hidden, text: document.getElementById('phase-warning').textContent, playing: document.getElementById('pause').textContent}));
  check('com todas as fases visuais desligadas o painel avisa', !warn.hidden && /nada para mostrar/.test(warn.text), warn.text);
  for (const p of ['start', 'launch', 'body', 'hold', 'finish', 'impact']) await page.locator(`#phase-${p}-on`).check();
  await page.waitForTimeout(250);
  check('religar tira o aviso', await L(() => document.getElementById('phase-warning').hidden));

  // ---------- Salvar automático, exportar datado, importar contando ----------
  await pickCategory('sand');
  await page.locator('#phase-start-on').uncheck();
  await page.locator('#sliders [data-key="shotKind"] select').selectOption('2');
  await L(() => {const r = document.querySelector('#sliders [data-key="length"] input[type=range]');r.value = '5.4';r.dispatchEvent(new Event('input', {bubbles: true}));});
  await page.waitForTimeout(700);
  check('o salvamento automático avisa onde guardou e o limite', /automaticamente neste navegador/.test(await page.locator('#save-status').textContent()) && /cópia segura/.test(await page.locator('#save-status').textContent()));
  await page.reload();await page.waitForFunction(() => window.__labDiagnostics);await openAll();
  const restored = await L(() => ({d: window.__labDiagnostics(), length: document.querySelector('#sliders [data-key="length"] input[type=range]').value, toggle: document.getElementById('phase-start-on').checked}));
  check('depois de recarregar, a página volta como estava (fase desligada, disparo escolhido, valor do slider)', restored.d.startOn === 0 && restored.d.shotKind === 2 && restored.length === '5.4' && restored.toggle === false, JSON.stringify({s: restored.d.startOn, k: restored.d.shotKind, l: restored.length}));
  const downloadFile = async sel => {const p = page.waitForEvent('download');await page.locator(sel).click();const d = await p;return {name: d.suggestedFilename(), data: JSON.parse(await (await import('node:fs/promises')).readFile(await d.path(), 'utf8'))};};
  const one = await downloadFile('#export-one'), all = await downloadFile('#export-all');
  check('os nomes dos arquivos exportados levam a data', /^arenamon-sand-[ABC]-\d{4}-\d{2}-\d{2}\.json$/.test(one.name) && /^arenamon-vfx-todas-\d{4}-\d{2}-\d{2}\.json$/.test(all.name), one.name + ' · ' + all.name);
  check('a exportação leva interruptores das fases e o disparo escolhido', one.data.visualParameters.startOn === 0 && one.data.visualParameters.shotKind === 2 && one.data.presentation.noFlash === false);
  const noisy = structuredClone(one.data);noisy.visualParameters.camponovo = 7;noisy.extra = true;delete noisy.visualParameters.holdTime;
  page.once('dialog', d => d.accept());
  await page.locator('#import-file').setInputFiles({name: 'novo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(noisy))});
  await page.waitForFunction(() => /Importado/.test(document.getElementById('save-status').textContent));
  const imp = await page.locator('#save-status').textContent();
  check('a importação ignora e CONTA o que não conhece e completa o que faltava', /2 campo\(s\) desconhecido\(s\) ignorado\(s\)/.test(imp) && /1 valor\(es\) ausente\(s\)/.test(imp), imp);
  page.once('dialog', d => d.accept());
  await page.locator('#import-file').setInputFiles({name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({...one.data, atelier: 'outro'}))});
  await page.waitForFunction(() => /recusada/.test(document.getElementById('save-status').textContent));
  check('arquivo que não é do atelier é recusado', true);

  // ---------- Acessibilidade ----------
  check('Sem flash e Movimento reduzido existem', await page.locator('#noflash').count() === 1 && await page.locator('#reduced').count() === 1);
  await L(() => {document.querySelector('aside details:not(.phase-group)').open = true;});   // «Luz, movimento e apresentação»
  await page.locator('#noflash').check();
  check('Sem flash liga o modo e ele é guardado na exportação', (await L(() => window.__labDiagnostics().noFlash)) === true && (await downloadFile('#export-one')).data.presentation.noFlash === true);
  await page.locator('#noflash').uncheck();
  const ctx2 = await browser.newContext({reducedMotion: 'reduce', viewport: {width: 1200, height: 800}});await ctx2.setOffline(true);
  const p2 = await ctx2.newPage();await p2.goto(html);await p2.waitForFunction(() => window.__labDiagnostics);
  check('a preferência do sistema «reduzir movimento» é o valor inicial', await p2.evaluate(() => window.__labDiagnostics().reduce === true && document.getElementById('reduced').checked));
  await ctx2.close();

  // ---------- As 8 categorias obedecem às fases ----------
  const NAMES = {sand: 'Sand Wave', stone: 'Emerging Stone', rock: 'Rocha', swift: 'Swift', psyshock: 'Psyshock', bulletpunch: 'Bullet Punch', quickattack: 'Quick Attack', riposte: 'Riposte'};
  for (const c of Object.keys(NAMES)) {
    await pickCategory(c);
    const st = await L(() => ({groups: document.querySelectorAll('#sliders .phase-group').length, note: !document.getElementById('phase-warning').hidden, disabled: [...document.querySelectorAll('#sliders [data-phase-toggle]')].filter(x => x.disabled).length, warn: document.getElementById('phase-warning').textContent}));
    check(`${NAMES[c]}: seis fases, e os interruptores obedecem (sem aviso de «ainda não obedece»)`, st.groups === 6 && !st.note && st.disabled === (c === 'rock' ? 5 : 0), JSON.stringify(st));
  }
  await pickCategory('rock');
  const rockWhy = await L(() => document.querySelector('#sliders [data-phase="launch"] .help')?.textContent ?? '');
  check('a Rocha explica que é inspeção de objeto e não um ataque', /não um ataque/.test(rockWhy), rockWhy);
  await pickCategory('stone');
  await L(() => {const r = document.querySelector('#sliders [data-key="flightTime"] input[type=range]');r.value = '0.8';r.dispatchEvent(new Event('input', {bubbles: true}));});
  const stoneLegend = new Set();
  for (let x = 0; x <= 4.2; x += .15) {await page.locator('#scrub').evaluate((el, v) => {el.value = String(v);el.dispatchEvent(new Event('input', {bubbles: true}));}, x);stoneLegend.add(await page.locator('#phase').textContent());}
  check('Emerging Stone com trajeto: a legenda passa por Corpo e trajeto', [...stoneLegend].includes('Corpo e trajeto'), [...stoneLegend].join(' | '));

  // ---------- Capturas (evidência) ----------
  const { mkdirSync } = await import('node:fs');
  const evidence = root + 'evidence/fases-24-10/';mkdirSync(evidence, {recursive: true});
  const snap = async (name, o = {}) => {for (let a = 1; ; a++) {try {return await page.screenshot({path: evidence + name, ...o});} catch (e) {if (a >= 5 || !/UNKNOWN|EBUSY|EPERM/.test(String(e))) throw e;await new Promise(r => setTimeout(r, 600 * a));}}};
  const scrubTo = x => page.locator('#scrub').evaluate((el, v) => {el.value = String(v);el.dispatchEvent(new Event('input', {bubbles: true}));}, x);
  await pickCategory('sand');await page.locator('#variants [data-variant="0"]').click();await openAll();await scrubTo(.9);await page.waitForTimeout(250);await snap('sand-padrao.png');
  await page.locator('#sliders [data-key="shotKind"] select').selectOption('1');await page.locator('#phase-start-on').uncheck();await scrubTo(.1);await page.waitForTimeout(250);await snap('sand-sem-surgimento-com-argola.png');
  await page.locator('#phase-start-on').check();await page.locator('#sliders [data-key="shotKind"] select').selectOption('0');
  await pickCategory('stone');await scrubTo(1.1);await page.waitForTimeout(250);await snap('stone-trajeto-subterraneo.png');
  await pickCategory('rock');await page.waitForTimeout(250);await snap('rocha-inspecao.png');
  check('capturas gravadas em evidence/fases-24-10/', true);

  check('sem erros de página/console e sem requisições externas', errors.length === 0 && network.length === 0, errors.concat(network).slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} falha(s)` : '\nTudo aprovado.');
process.exit(failures ? 1 : 0);
