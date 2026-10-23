// Visualizar › Desempenho: medidor ao vivo (e caixa compacta na arena), perfis gráficos e benchmark reproduzível.
// O benchmark roda o laço REAL (renderização inclusa) em IA × IA com semente fixa, com aquecimento antes de medir, e
// registra resolução, pixel ratio, navegador, renderizador e a configuração do teste.
import {C} from '../sim/config.js';
import {GRAPHICS_PROFILES, detectProfile} from '../sim/graphics.js';
import {VFX_TYPES} from '../view/vfx.js';
import {PerfMeter, rendererInfo, createGpuTimer, fmtMs} from './perf.js';
import {escape, pathGet} from './tuning.js';

export const BENCH_CASES = [
  {id: 'none', label: 'Sem VFX', vfx: 'none'}, {id: 'low', label: 'VFX leves (perfil Baixo)', vfx: 'low'}, {id: 'mid', label: 'VFX médios (perfil Médio)', vfx: 'mid'}, {id: 'all', label: 'Todos os efeitos (Alto + todos ligados)', vfx: 'all'},
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function createPerfPanel({$, view, game, tuning, ui, download, startBench, endBench, getWs, onWarmup}) {
  const meter = new PerfMeter(), info = rendererInfo(view.renderer), gpu = createGpuTimer(view.renderer);
  view.gpuTimer = gpu.available ? gpu : null;
  let bench = null, lastBench = null;
  /** Chamado a cada quadro pelo laço principal. */
  function frame({frameMs, simMs, steps}) {
    const t = view.timings || {}, r = view.renderer.info.render, st = view.vfx.stats;
    meter.push({frameMs, simMs, steps, animMs: t.anim ?? 0, vfxMs: t.vfx ?? 0, renderMs: t.render ?? 0, overlayMs: t.overlays ?? 0, calls: r.calls, triangles: r.triangles, active: st.active ?? 0, spawned: st.spawned ?? 0});
    if (gpu.available) meter.pushGpu(gpu.poll());
  }
  const env = () => {
    const c = view.canvas;return {canvasCss: [c.clientWidth, c.clientHeight], drawingBuffer: [view.renderer.domElement.width, view.renderer.domElement.height], devicePixelRatio, pixelRatio: view.renderer.getPixelRatio(), renderPixelRatioSetting: C.extras.visual.renderPixelRatio,
      userAgent: navigator.userAgent, renderer: info.renderer, vendor: info.vendor, softwareRendering: info.software, webgl2: info.webgl2, gpuTimer: gpu.available, gpuTimerReason: gpu.reason, hardwareConcurrency: navigator.hardwareConcurrency ?? null};};
  // ---------- Medidor ao vivo ----------
  function rows(s) {
    return [['FPS (suavizado)', s.fps.toFixed(1)], ['Tempo de quadro médio', fmtMs(s.frameAvg)], ['P95 do tempo de quadro', fmtMs(s.frameP95)], ['Pior quadro do período', fmtMs(s.frameWorst)],
      ['Trabalho de CPU por quadro (média / P95)', `${fmtMs(s.workAvg)} / ${fmtMs(s.workP95)}`], ['Simulação (passos/quadro)', `${fmtMs(s.simAvg)} (${s.stepsAvg.toFixed(2)})`], ['Animação dos modelos', fmtMs(s.animAvg)], ['Atualização dos VFX', fmtMs(s.vfxAvg)],
      ['Sobreposições técnicas', fmtMs(s.overlayAvg)], ['Renderização (CPU, envio ao WebGL)', fmtMs(s.renderAvg)], [info.software ? 'Tempo de “GPU” (software: CPU emulando a GPU)' : 'Tempo de GPU', gpu.available ? fmtMs(s.gpuAvg) : 'indisponível'],
      ['Shaders WebGL / Warm-up', view.isWarmedUp ? '✓ Pré-compilados (GPU pronta)' : '⚠ Pendente (compilação sob demanda)'],
      ['Draw calls (média / máx.)', `${s.callsAvg.toFixed(0)} / ${s.callsMax}`], ['Triângulos renderizados', s.trianglesAvg.toFixed(0)], ['Partículas ativas (média / pico)', `${s.activeAvg.toFixed(0)} / ${s.activePeak}`], ['Partículas geradas no período', s.spawned]];
  }
  function live() {
    const s = meter.summary();
    const box = $('perf-live');if (box && !box.closest('[hidden]') && s) box.innerHTML = rows(s).map(([k, v]) => `<dt>${k}</dt><dd>${escape(v)}</dd>`).join('');
    const o = $('perf-overlay');o.hidden = !C.display.perf.overlay;
    if (!o.hidden && s) o.innerHTML = `<b>${s.fps.toFixed(0)} FPS</b> · ${fmtMs(s.frameAvg)} (P95 ${fmtMs(s.frameP95)})<br>CPU ${fmtMs(s.workAvg)} · sim ${fmtMs(s.simAvg)} · VFX ${fmtMs(s.vfxAvg)} · render ${fmtMs(s.renderAvg)}<br>${info.software ? 'GPU (software)' : 'GPU'} ${gpu.available ? fmtMs(s.gpuAvg) : 'indisponível'} · ${s.callsAvg.toFixed(0)} draw calls · ${s.activeAvg.toFixed(0)} partículas${info.software ? '<br><span class="warn">renderização por software (CPU)</span>' : ''}`;
    renderProfiles();
  }
  // ---------- Perfis gráficos ----------
  function renderProfiles() {
    const cur = detectProfile();
    for (const b of document.querySelectorAll('[data-gprofile]')) b.setAttribute('aria-pressed', String(b.dataset.gprofile === cur));
    const out = $('gprofile-info');if (out) {const p = GRAPHICS_PROFILES.find(x => x.id === cur);out.textContent = p ? p.description : 'Personalizado: algum parâmetro gráfico foi ajustado à mão (Ajustes › avançado ou VFX).';}
  }
  function applyProfile(id) {
    const p = GRAPHICS_PROFILES.find(x => x.id === id);if (!p) return 0;
    const n = tuning.commit(Object.entries(p.values).map(([k, v]) => {const m = tuning.byPath.get(k);return [k, Math.max(m.min, Math.min(m.max, v))];}), 'Perfil gráfico ' + p.label);
    renderProfiles();return n;
  }
  tuning.onChange(() => renderProfiles());
  // ---------- Benchmark ----------
  function caseValues(c) {
    const out = {'vfx.master.enabled': c.vfx === 'none' ? 0 : 1};
    if (c.vfx !== 'none') Object.assign(out, GRAPHICS_PROFILES.find(p => p.id === (c.vfx === 'all' ? 'high' : c.vfx)).values);
    if (c.vfx === 'all') {for (const [t] of VFX_TYPES) out[`vfx.${t}.enabled`] = 1;out['vfx.master.legacy'] = 1;out['vfx.shakeMaster.enabled'] = 1;}
    return out;
  }
  async function runBenchmark({warmup = 1.5, duration = 4, seed = 7, cases = BENCH_CASES.map(c => c.id), characters = [1, 2], onProgress = () => {}} = {}) {
    if (bench) return null;bench = {abort: false};
    const plan = [];for (const id of cases) for (const n of characters) plan.push({...BENCH_CASES.find(c => c.id === id), characters: n});
    const touched = [...new Set(plan.flatMap(c => Object.keys(caseValues(c))))], saved = touched.map(p => [p, pathGet(C, p)]), results = [], environment = env();
    const hasModels = !!ui.characters[0];
    try {
      for (const [i, c] of plan.entries()) {
        if (bench.abort) break;
        onProgress(`${i + 1}/${plan.length} · ${c.label} · ${c.characters} personagem(ns): aquecendo…`);
        tuning.setTransient(Object.entries(caseValues(c)));startBench({seed, characters: c.characters});
        await sleep(warmup * 1000);meter.reset();const t0 = performance.now(), tick0 = game.tick;
        onProgress(`${i + 1}/${plan.length} · ${c.label} · ${c.characters} personagem(ns): medindo…`);
        await sleep(duration * 1000);
        const s = meter.summary(), wall = (performance.now() - t0) / 1000;
        results.push({id: `${c.id}-${c.characters}`, label: c.label, vfx: c.vfx, characters: c.characters, models: hasModels ? (c.characters === 2 && ui.characters[1] ? 'GLB × 2' : 'GLB × 1 + bloco') : 'blocos', wallSeconds: +wall.toFixed(3), simSeconds: +((game.tick - tick0) * C.test.step).toFixed(3), ...roundAll(s)});
        endBench();
      }
    } finally {tuning.setTransient(saved);endBench();bench = null;}
    lastBench = {schema: 'arenamon-lab-report', version: 1, kind: 'performance-benchmark', createdAt: new Date().toISOString(), environment, config: {warmup, duration, seed, cases, characters, step: C.test.step, combat: 'IA × IA (tático), semente fixa'}, results,
      notes: [environment.softwareRendering ? 'Renderização por SOFTWARE: os números (inclusive o “tempo de GPU”) medem a CPU emulando a GPU; não representam uma GPU dedicada.' : null, !gpu.available ? 'Tempo de GPU indisponível neste navegador; os tempos de renderização são de CPU.' : null, 'FPS é limitado pela taxa de atualização da tela (requestAnimationFrame); compare o trabalho de CPU por quadro.'].filter(Boolean)};
    const ws = getWs();if (ws) {ws.doc.benchmarks = [...(ws.doc.benchmarks || []), {createdAt: lastBench.createdAt, environment, config: lastBench.config, results}].slice(-10);ws.touch();}
    renderBench();return lastBench;
  }
  const roundAll = s => Object.fromEntries(Object.entries(s || {}).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(3) : v]));
  /** Condições que impedem comparar dois benchmarks diretamente. */
  function differences(a, b) {
    const out = [], e = a.environment, f = b.environment;
    for (const k of ['canvasCss', 'drawingBuffer', 'pixelRatio', 'renderer', 'userAgent', 'softwareRendering']) if (JSON.stringify(e[k]) !== JSON.stringify(f[k])) out.push(`${k}: ${JSON.stringify(f[k])} → ${JSON.stringify(e[k])}`);
    for (const k of ['warmup', 'duration', 'seed']) if (a.config[k] !== b.config[k]) out.push(`${k}: ${b.config[k]} → ${a.config[k]}`);
    return out;
  }
  function renderBench() {
    const box = $('bench-report');if (!box || !lastBench) return;const prev = (getWs()?.doc.benchmarks || []).slice(-2, -1)[0];
    const diff = prev ? differences(lastBench, prev) : null, E = lastBench.environment;
    box.innerHTML = `<p class="muted">${E.drawingBuffer.join('×')} px (CSS ${E.canvasCss.join('×')}, pixel ratio ${E.pixelRatio}) · ${escape(E.renderer)}${E.softwareRendering ? ' · <span class="warn">software</span>' : ''} · GPU timer ${E.gpuTimer ? 'disponível' : 'indisponível'}</p>
      ${lastBench.notes.map(n => `<p class="warn">${escape(n)}</p>`).join('')}
      <table><tr><th>Caso</th><th>Pers.</th><th>FPS</th><th>Quadro méd./P95/pior</th><th>CPU/quadro</th><th>VFX</th><th>Render CPU</th><th>GPU</th><th>Draw calls</th><th>Partículas pico</th></tr>
      ${lastBench.results.map(r => `<tr><td>${escape(r.label)}</td><td>${r.characters}</td><td>${r.fpsAvg?.toFixed(1)}</td><td>${r.frameAvg?.toFixed(1)}/${r.frameP95?.toFixed(1)}/${r.frameWorst?.toFixed(1)}</td><td>${r.workAvg?.toFixed(2)}</td><td>${r.vfxAvg?.toFixed(2)}</td><td>${r.renderAvg?.toFixed(2)}</td><td>${r.gpuAvg == null ? '—' : r.gpuAvg.toFixed(2)}</td><td>${r.callsAvg?.toFixed(0)}</td><td>${r.activePeak}</td></tr>`).join('')}</table>
      ${prev ? (diff.length ? `<p class="warn"><b>Não compare com o benchmark anterior</b> (${new Date(prev.createdAt).toLocaleString('pt-BR')}): condições diferentes — ${diff.map(escape).join('; ')}.</p>` : `<p class="ok">Mesmas condições do benchmark anterior (${new Date(prev.createdAt).toLocaleString('pt-BR')}): os números são comparáveis.</p>`) : ''}`;
  }
  function render() {
    const root = $('perf-panel');if (!root) return;
    root.innerHTML = `<div id="perf-controls"></div><p class="muted">${escape(info.renderer)}${info.software ? ' · <span class="warn">renderização por software (CPU) — não representa GPU dedicada</span>' : ''} · WebGL${info.webgl2 ? '2' : '1'} · GPU timer: ${gpu.available ? 'disponível' : 'indisponível'}</p>
      <dl class="live" id="perf-live"></dl><div class="row"><button type="button" id="perf-reset">Zerar período</button><button type="button" id="perf-warmup" title="Pré-compila shaders WebGL e aquece dados de solo dos lutadores">⚡ Pré-compilar Shaders</button></div>
      <h4>Perfis gráficos</h4><div class="seg wide" role="group" aria-label="Perfil gráfico">${GRAPHICS_PROFILES.map(p => `<button type="button" data-gprofile="${p.id}" title="${escape(p.description)}">${p.label}</button>`).join('')}<button type="button" data-gprofile="custom" disabled title="Ajuste manual">Personalizado</button></div>
      <p class="hint" id="gprofile-info"></p><p class="hint">Só resolução, partículas e sombra: nunca física, dano, stamina, IA ou tempos das ações.</p>
      <h4>Benchmark comparativo</h4><p class="hint">IA × IA com semente fixa, aquecimento antes de medir; casos: sem VFX, leves, médios e todos os efeitos, com uma e duas personagens. A partida atual é encerrada.</p>
      <div class="row"><label class="field">Aquecimento (s)<input type="number" id="bench-warmup" min="0.5" max="10" step="0.5" value="1.5"></label><label class="field">Medição (s)<input type="number" id="bench-duration" min="1" max="30" step="0.5" value="4"></label><label class="field">Semente<input type="number" id="bench-seed" min="1" value="7"></label></div>
      <div class="row"><button type="button" class="primary" id="bench-run">▶ Executar benchmark</button><button type="button" id="bench-abort" disabled>Interromper</button><button type="button" id="bench-export" disabled>↓ Resultado (JSON)</button></div>
      <p class="hint" id="bench-progress"></p><div id="bench-report" class="report"></div>`;
    $('perf-controls').append(...tuning.sectionControls('Medidor de desempenho'));
    $('perf-reset').onclick = () => meter.reset();
    if ($('perf-warmup')) $('perf-warmup').onclick = () => onWarmup?.();
    for (const b of root.querySelectorAll('[data-gprofile]')) if (b.dataset.gprofile !== 'custom') b.onclick = () => applyProfile(b.dataset.gprofile);
    $('bench-run').onclick = async () => {
      $('bench-run').disabled = true;$('bench-abort').disabled = false;
      await runBenchmark({warmup: Number($('bench-warmup').value) || 1.5, duration: Number($('bench-duration').value) || 4, seed: Number($('bench-seed').value) || 7, onProgress: t => {$('bench-progress').textContent = t;}});
      $('bench-progress').textContent = lastBench ? `Concluído: ${lastBench.results.length} caso(s).` : '';$('bench-run').disabled = false;$('bench-abort').disabled = true;$('bench-export').disabled = !lastBench;
    };
    $('bench-abort').onclick = () => {if (bench) bench.abort = true;};
    $('bench-export').onclick = () => {if (lastBench) download(JSON.stringify(lastBench, null, 1), 'arenamon-benchmark.json');};
    renderProfiles();
  }
  render();
  return {frame, live, meter, info, gpu, render, applyProfile, runBenchmark, differences, get lastBench() {return lastBench;}, environment: env};
}
