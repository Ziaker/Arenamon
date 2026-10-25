// @ts-check
// Benchmark de RENDER com a GPU real da máquina (#15 do plano de 23/10/2026): roda o benchmark do painel Visualizar › Desempenho (laço real com renderização,
// IA × IA, semente fixa, aquecimento) N vezes e grava FPS, P95/pior quadro, CPU por quadro, render, GPU, draw calls, partículas e memória JS do navegador,
// com a máquina identificada (renderizador WebGL, navegador, núcleos). Metas por perfil são decisão do responsável: aqui só se mede.
// Uso: node prototypes/combat-lab/test/bench-render.browser.mjs [repetições=3] [medição_s=4]   (ARENAMON_GL=software força SwiftShader, só para comparar)
// Saída: docs/DESEMPENHO_RENDER_<data>.md e prototypes/combat-lab/evidence/bench-render/<data>.json
import {chromium} from '@playwright/test';
import {mkdirSync, writeFileSync} from 'node:fs';
import {cpus, totalmem} from 'node:os';
import {pathToFileURL, fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const repo = fileURLToPath(new URL('../../..', import.meta.url));
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const REPS = Number(process.argv[2] ?? 3), DURATION = Number(process.argv[3] ?? 4);
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : process.env.ARENAMON_BROWSER_PATH ? {executablePath: process.env.ARENAMON_BROWSER_PATH} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const software = process.env.ARENAMON_GL === 'software';
const GL = software ? ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] : ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'];
const date = new Date().toISOString().slice(0, 10);

console.log(`\n--- BENCHMARK DE RENDER (${software ? 'SOFTWARE' : 'GPU real'}) · ${REPS} repetição(ões) × ${DURATION} s por caso ---\n`);
const browser = await chromium.launch({...BROWSER, headless: true, args: [...GL, '--no-sandbox', '--enable-precise-memory-info', '--disable-gpu-vsync', '--disable-frame-rate-limit']});
/** @type {any[]} */ const runs = [];
let environment = null;
try {
  const page = await browser.newPage({viewport: {width: 1600, height: 900}});
  const errors = /** @type {string[]} */ ([]);
  page.on('pageerror', e => errors.push(e.message));
  await page.context().setOffline(true);
  await page.goto(labUrl + '?fabrica=1');
  await page.waitForFunction(() => window.__lab?.perf?.runBenchmark && window.__lab.game, null, {timeout: 120000});
  for (let r = 0; r < REPS; r++) {
    const rep = await page.evaluate(async d => {
      const mem0 = /** @type {any} */ (performance).memory?.usedJSHeapSize ?? null;
      const rep = await window.__lab.perf.runBenchmark({warmup: 1.5, duration: d, seed: 7});
      const mem1 = /** @type {any} */ (performance).memory?.usedJSHeapSize ?? null;
      return {rep, memory: {before: mem0, after: mem1, limit: /** @type {any} */ (performance).memory?.jsHeapSizeLimit ?? null}};
    }, DURATION);
    if (!rep.rep) throw new Error('benchmark não rodou (já havia um em andamento?)');
    environment ??= rep.rep.environment;
    runs.push({results: rep.rep.results, notes: rep.rep.notes, memory: rep.memory});
    console.log(`  repetição ${r + 1}: ${rep.rep.results.map((/** @type {any} */ x) => `${x.id} ${x.fpsAvg?.toFixed(0)} FPS P95 ${x.frameP95?.toFixed(1)} ms`).join(' · ')}`);
  }
  if (errors.length) console.error('  erros de página:', errors.join(' | ').slice(0, 300));
} finally {
  await browser.close();
}

// Agregado por caso: mediana das repetições (e faixa mín.–máx.) para não depender de uma rodada só.
const ids = runs[0].results.map((/** @type {any} */ x) => x.id);
const med = (/** @type {number[]} */ v) => {const s = [...v].sort((a, b) => a - b);return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;};
const pick = (/** @type {string} */ id, /** @type {string} */ k) => runs.map(r => r.results.find((/** @type {any} */ x) => x.id === id)?.[k]).filter(v => typeof v === 'number');
const f = (/** @type {number[]} */ v, d = 1) => v.length ? `${med(v).toFixed(d)} (${Math.min(...v).toFixed(d)}–${Math.max(...v).toFixed(d)})` : '—';
const machine = {cpu: cpus()[0]?.model ?? '?', cores: cpus().length, ramGB: +(totalmem() / 2 ** 30).toFixed(1), platform: process.platform};
const json = {schema: 'arenamon-bench-render', version: 1, date, software, reps: REPS, duration: DURATION, machine, environment, runs};
mkdirSync(root + 'evidence/bench-render', {recursive: true});
writeFileSync(root + `evidence/bench-render/${date}.json`, JSON.stringify(json, null, 2) + '\n');
const E = /** @type {any} */ (environment) ?? {};
const memMB = (/** @type {number | null} */ b) => b == null ? '—' : (b / 2 ** 20).toFixed(0) + ' MB';
const md = [
  `# Desempenho de render com GPU real (${date})`, '',
  '> **GERADO** por `npm run bench:render` (`prototypes/combat-lab/test/bench-render.browser.mjs`). Item #15 do plano de 15 melhorias: mede o laço REAL do jogo (simulação + animação + VFX + render) no navegador desta máquina. **Metas por perfil não estão definidas** (decisão do responsável); este documento só registra os números.', '',
  '## Máquina e condições', '',
  `- Renderizador WebGL: **${E.renderer ?? '?'}** (${E.vendor ?? '?'})${E.softwareRendering ? ' · ⚠ SOFTWARE (não representa GPU)' : ''} · WebGL${E.webgl2 ? '2' : '1'} · cronômetro de GPU ${E.gpuTimer ? 'disponível' : `indisponível (${E.gpuTimerReason ?? '—'})`}`,
  `- CPU: ${machine.cpu} · ${machine.cores} núcleos lógicos · ${machine.ramGB} GB de RAM · ${machine.platform}`,
  `- Navegador: ${E.userAgent ?? '?'} (sem interface, sem vsync)`,
  `- Tela de desenho: ${(E.drawingBuffer ?? []).join('×')} px (CSS ${(E.canvasCss ?? []).join('×')}, pixel ratio ${E.pixelRatio ?? '?'})`,
  `- Roteiro: IA × IA tática, semente 7, aquecimento 1,5 s, medição ${DURATION} s por caso, ${REPS} repetições; personagens = blocos (sem GLB carregado). Valores: **mediana (mín.–máx.)** das repetições.`, '',
  '## Resultados por caso', '',
  '| Caso | Pers. | FPS | Quadro médio (ms) | P95 (ms) | Pior quadro (ms) | CPU/quadro (ms) | Render CPU (ms) | GPU (ms) | Draw calls | Partículas (pico) |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
  ...ids.map((/** @type {string} */ id) => {
    const r0 = runs[0].results.find((/** @type {any} */ x) => x.id === id);
    return `| ${r0.label} | ${r0.characters} | ${f(pick(id, 'fpsAvg'))} | ${f(pick(id, 'frameAvg'), 2)} | ${f(pick(id, 'frameP95'), 2)} | ${f(pick(id, 'frameWorst'), 1)} | ${f(pick(id, 'workAvg'), 2)} | ${f(pick(id, 'renderAvg'), 2)} | ${f(pick(id, 'gpuAvg'), 2)} | ${f(pick(id, 'callsAvg'), 0)} | ${f(pick(id, 'activePeak'), 0)} |`;
  }), '',
  '## Memória JS do navegador (performance.memory)', '',
  ...runs.map((r, i) => `- Repetição ${i + 1}: ${memMB(r.memory.before)} antes → ${memMB(r.memory.after)} depois (limite ${memMB(r.memory.limit)})`), '',
  '## Limitações', '',
  '- Navegador sem interface e sem vsync: o FPS não está preso a 60 Hz; num monitor real o teto é a taxa da tela. P95 e CPU por quadro são os números comparáveis.',
  '- Sem GLB: as personagens são blocos. Com modelos animados o custo de animação e de draw calls sobe (rode o benchmark pelo painel com as personagens carregadas).',
  '- Memória: só o heap JS (Chromium); memória de GPU não é exposta pelo navegador.',
  ...(runs[0].notes ?? []).filter(Boolean).map((/** @type {string} */ n) => `- ${n}`), '',
  `Dados brutos: \`prototypes/combat-lab/evidence/bench-render/${date}.json\`. Pelo jogo: Visualizar › Desempenho › ▶ Executar benchmark.`, '',
].join('\n');
writeFileSync(repo + `docs/DESEMPENHO_RENDER_${date}.md`, md);
console.log(`\nGravado: docs/DESEMPENHO_RENDER_${date}.md e prototypes/combat-lab/evidence/bench-render/${date}.json`);
