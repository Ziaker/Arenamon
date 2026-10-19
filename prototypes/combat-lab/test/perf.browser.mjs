// Fase 4 no navegador (Edge real, file://): medidor ao vivo (FPS, tempos por etapa, draw calls, triângulos,
// partículas, GPU só se disponível), perfis gráficos, benchmark reproduzível (aquecimento, 4 casos × 1 e 2 personagens,
// ambiente registrado, comparação só em condições iguais) e a interface simples/avançada de VFX com filtros.
// Os números reais ficam em validation/perf/report.json (limitações do hardware de teste registradas).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {existsSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'validation/perf/';mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const glb = process.env.ARENAMON_GLB || (existsSync(homedir() + '/Downloads/drowzee/arenamon-prototipo.glb') ? homedir() + '/Downloads/drowzee/arenamon-prototipo.glb' : root + 'validation/personagem-studio.glb');
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const HEADED = process.env.ARENAMON_HEADED === '1';
const report = [];let failures = 0, bench1 = null;
const check = (group, label, ok, detail = '') => {report.push({group, label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${group} · ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const browser = await chromium.launch({...BROWSER, headless: !HEADED});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}, acceptDownloads: true}), errors = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.context().setOffline(true);await page.goto(labUrl);await page.waitForFunction(() => window.__lab);
  const L = (fn, arg) => page.evaluate(fn, arg), tab = t => L(t => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== t) document.querySelector(`[data-tool="${t}"]`).click();}, t);
  await tab('characters');await page.locator('.char-slot').nth(0).locator('input[data-model]').setInputFiles(glb);await page.waitForFunction(() => window.__lab.ui.characters[0]);
  await page.evaluate(() => window.__lab.charPanel.selectFighter(1));await page.locator('.char-slot').nth(1).getByRole('button', {name: 'Usar o do azul'}).click();await page.waitForFunction(() => window.__lab.ui.characters[1]);

  // ================= Medidor ao vivo =================
  await L(() => window.__lab.tuning.commit([['extras.toggles.enablePlayerAI', 1], ['display.perf.overlay', 1]], 'IA × IA'));await tab('match');await page.selectOption('#mode', 'tactical');await page.click('#start');
  await page.waitForTimeout(2500);await tab('overlays');await page.waitForTimeout(300);
  const s = await L(() => window.__lab.perf.meter.summary()), envi = await L(() => window.__lab.perf.environment());
  check('Medidor', 'FPS, tempo médio, P95 e pior quadro', s.fps > 1 && s.frameAvg > 0 && s.frameP95 >= s.frameAvg * .5 && s.frameWorst >= s.frameP95, `${s.fps.toFixed(1)} FPS · ${s.frameAvg.toFixed(2)}/${s.frameP95.toFixed(2)}/${s.frameWorst.toFixed(2)} ms`);
  check('Medidor', 'tempos de CPU por etapa (simulação, animação, VFX, renderização)', s.simAvg > 0 && s.animAvg > 0 && s.vfxAvg >= 0 && s.renderAvg > 0, `sim ${s.simAvg.toFixed(3)} · anim ${s.animAvg.toFixed(3)} · vfx ${s.vfxAvg.toFixed(3)} · render ${s.renderAvg.toFixed(3)} ms`);
  check('Medidor', 'draw calls, triângulos e partículas', s.callsAvg > 0 && s.trianglesAvg > 0 && s.spawned >= 0, `${s.callsAvg.toFixed(0)} draw calls · ${s.trianglesAvg.toFixed(0)} triângulos · pico ${s.activePeak} partículas`);
  const gpuText = await page.textContent('#perf-live');
  check('Medidor', 'GPU só com consulta de tempo confiável; senão “indisponível”', envi.gpuTimer ? /GPU[^]*ms/.test(gpuText) : /GPU[^:]*indispon/.test(gpuText), `GPU timer ${envi.gpuTimer ? 'disponível' : 'indisponível'} · ${envi.renderer}`);
  check('Medidor', 'renderização por software identificada (não apresentada como GPU dedicada)', envi.softwareRendering === /swiftshader|llvmpipe|basic render|software/i.test(envi.renderer) && (!envi.softwareRendering || /software/.test(await page.textContent('#perf-panel'))), `software: ${envi.softwareRendering}`);
  check('Medidor', 'caixa compacta na arena', await page.isVisible('#perf-overlay') && /FPS/.test(await page.textContent('#perf-overlay')));
  await page.screenshot({path: out + 'medidor.png'});

  // ================= Perfis gráficos =================
  const before = await L(() => window.__lab.tuning.snapshotValues());
  await page.click('[data-gprofile="low"]');const after = await L(() => window.__lab.tuning.snapshotValues());
  const changed = Object.keys(after).filter(k => after[k] !== before[k]);
  check('Perfis', 'Baixo: só resolução, partículas e sombra mudam', changed.length > 5 && changed.every(k => /^(vfx\.|extras\.visual\.renderPixelRatio|display\.shadow\.style)/.test(k)) && await page.getAttribute('[data-gprofile="low"]', 'aria-pressed') === 'true', changed.join(', '));
  check('Perfis', 'resolução aplicada ao renderizador', await L(() => window.__lab.view.renderer.getPixelRatio()) <= 1);
  await L(() => window.__lab.tuning.commit([['vfx.hit.count', 5]], 'manual'));await page.waitForTimeout(250);
  check('Perfis', 'ajuste manual vira “Personalizado”', await page.getAttribute('[data-gprofile="custom"]', 'aria-pressed') === 'true');
  await page.click('[data-gprofile="high"]');

  // ================= Interface de VFX =================
  check('VFX', 'lista mestre-detalhe: 9 efeitos de combate, cada um com ligado, variante e prévia', await L(() => ['hit', 'dodge', 'sprint', 'block', 'perfect', 'ground', 'clash', 'exhaust', 'regen'].every(t => document.querySelector(`[data-vx-item="vfx-${t}"]`) && document.querySelectorAll(`[data-group="vfx-${t}"] [data-path="vfx.${t}.enabled"], [data-group="vfx-${t}"] [data-path="vfx.${t}.variant"]`).length === 2 && document.querySelector(`[data-group="vfx-${t}"] [data-preview]`))));
  await L(() => window.__lab.tuning.commit([['vfx.regen.enabled', 0], ['vfx.exhaust.enabled', 0]], 'off'));
  check('VFX', 'indicador de ligado/desligado na lista', await L(() => document.querySelector('[data-vx-item="vfx-regen"] .dot').classList.contains('off') && document.querySelector('[data-vx-item="vfx-hit"] .dot').classList.contains('on')));
  check('VFX', 'efeito alterado ganha marca na lista', await L(() => !document.querySelector('[data-vx-item="vfx-regen"] em').hidden));
  await page.fill('[data-vx-search]', 'esquiva');check('VFX', 'busca filtra a lista', await L(() => [...document.querySelectorAll('[data-vx-item]')].filter(b => !b.hidden).length >= 1 && document.querySelector('[data-vx-item="vfx-hit"]').hidden));
  await page.fill('[data-vx-search]', '');
  check('VFX', 'todos os parâmetros continuam disponíveis (um efeito por vez)', await L(() => document.querySelectorAll('#visual-panel [data-path^="vfx."]').length) > 90);
  for (const w of [280, 360, 760]) {await L(w => {document.getElementById('panel').style.width = w + 'px';}, w);await page.waitForTimeout(250);
    check('VFX', `painel de ${w}px: lista não cobre o conteúdo nem cria rolagem lateral`, await L(() => {const a = document.querySelector('.vx-list').getBoundingClientRect(), d = document.querySelector('.vx-detail').getBoundingClientRect(), pb = document.querySelector('.panel-body');return (a.bottom <= d.top + 1 || a.right <= d.left + 1 || d.right <= a.left + 1) && pb.scrollWidth <= pb.clientWidth + 2;}));}
  await L(() => {document.getElementById('panel').style.width = '';});
  await L(() => window.__lab.tuning.commit([['vfx.regen.enabled', 1], ['vfx.exhaust.enabled', 1]], 'on'));
  await page.screenshot({path: out + 'vfx-simples.png'});

  // ================= Benchmark =================
  await page.fill('#bench-warmup', '1');await page.fill('#bench-duration', '2.5');
  const t0 = Date.now();await page.click('#bench-run');await page.waitForFunction(() => /Concluído/.test(document.getElementById('bench-progress').textContent), null, {timeout: 180000});
  bench1 = await L(() => window.__lab.perf.lastBench);const R = id => bench1.results.find(r => r.id === id);
  check('Benchmark', '4 casos × 1 e 2 personagens, com aquecimento', bench1.results.length === 8 && bench1.config.warmup === 1, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
  check('Benchmark', 'ambiente registrado (resolução, pixel ratio, navegador, renderizador, GPU timer)', ['canvasCss', 'drawingBuffer', 'pixelRatio', 'userAgent', 'renderer', 'gpuTimer', 'softwareRendering'].every(k => k in bench1.environment));
  check('Benchmark', 'sem VFX: nenhuma partícula; todos os efeitos: mais partículas que os leves', R('none-2').activePeak === 0 && R('all-2').activePeak > R('low-2').activePeak, `pico ${R('none-2').activePeak} / ${R('low-2').activePeak} / ${R('mid-2').activePeak} / ${R('all-2').activePeak}`);
  check('Benchmark', 'uma × duas personagens medidas', R('mid-1').models !== R('mid-2').models, `${R('mid-1').models} × ${R('mid-2').models}`);
  check('Benchmark', 'configuração restaurada depois do benchmark', await L(() => window.__lab.C.vfx.master.enabled === 1 && window.__lab.C.extras.visual.renderPixelRatio === 2 && window.__lab.game.phase === 'menu'));
  const dl = page.waitForEvent('download');await page.click('#bench-export');const bj = JSON.parse(readFileSync(await (await dl).path(), 'utf8'));
  check('Benchmark', 'resultado exportável (relatório versionado com notas de limitação)', bj.kind === 'performance-benchmark' && bj.version === 1 && Array.isArray(bj.notes));
  writeFileSync(out + 'benchmark.json', JSON.stringify(bj, null, 1));
  await page.click('#bench-run');await page.waitForFunction(() => /Concluído/.test(document.getElementById('bench-progress').textContent) && window.__lab.perf.lastBench?.createdAt !== undefined, null, {timeout: 180000});
  await page.waitForFunction(() => /benchmark anterior/.test(document.getElementById('bench-report').textContent), null, {timeout: 180000});
  check('Benchmark', 'segunda execução nas mesmas condições é declarada comparável', /Mesmas condições/.test(await page.textContent('#bench-report')));
  await page.setViewportSize({width: 1200, height: 800});await page.waitForTimeout(300);
  const diff = await L(() => {const b = window.__lab.perf.lastBench, e = window.__lab.perf.environment();return window.__lab.perf.differences({...b, environment: e}, b);});
  check('Benchmark', 'outra resolução: condições diferentes, não comparar', diff.some(d => /canvasCss|drawingBuffer/.test(d)), diff.join('; '));
  await page.setViewportSize({width: 1500, height: 920});
  await tab('overlays');await page.locator('#bench-report').scrollIntoViewIfNeeded();await page.screenshot({path: out + 'benchmark.png'});
  check('Geral', 'sem erros no console', errors.length === 0, errors.join(' | '));
} finally {
  writeFileSync(out + 'report.json', JSON.stringify({date: new Date().toISOString(), headless: !HEADED, failures, report, benchmark: bench1}, null, 1));
  await browser.close();
}
console.log(`\n${report.length - failures} de ${report.length} verificações aprovadas.`);
if (failures) process.exit(1);
