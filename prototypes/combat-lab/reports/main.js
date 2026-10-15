// Painel externo de relatórios do laboratório: lê relatórios exportados (schema “arenamon-lab-report”, versionado) e a
// telemetria de animação. Não depende do laboratório em execução: só dos arquivos.
import {renderCharts, MOVEMENT_PANELS, SERIES} from '../src/ui/charts.js';

export const SUPPORTED_VERSION = 1;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
const n = (v, d = 2) => v == null || !Number.isFinite(+v) ? '—' : (+v).toFixed(d);
const ms = v => v == null ? '—' : `${Math.round(v * 1000)} ms`;
const reports = [];let current = -1, charts = null;

/** Identifica o tipo do arquivo (relatório versionado ou telemetria de animação) e valida a versão. */
export function classify(data, name = '') {
  if (data?.schema === 'arenamon-lab-report') {
    const kinds = {'movement-comparison': 'Gravador de movimento (A × B)', 'command-diagnostics': 'Diagnóstico de comandos', 'perfect-training': 'Treino de defesa/esquiva perfeitas', 'performance-benchmark': 'Benchmark de desempenho', 'ai-evaluation': 'Avaliação da IA'};
    if ((data.version | 0) > SUPPORTED_VERSION) return {error: `Relatório v${data.version} (este painel lê até v${SUPPORTED_VERSION}). Atualize o painel.`};
    if (!kinds[data.kind]) return {error: `Tipo de relatório desconhecido: ${data.kind}`};
    return {kind: data.kind, label: kinds[data.kind]};
  }
  if (Array.isArray(data?.log) && 'transitions' in data) return {kind: 'animation-telemetry', label: 'Telemetria de animação'};
  return {error: `“${name}” não é um relatório do laboratório.`};
}
async function addFiles(files) {
  for (const f of files) {
    let data, info;
    try {data = JSON.parse(await f.text());info = classify(data, f.name);} catch (e) {info = {error: 'JSON inválido: ' + e.message};}
    reports.push({name: f.name, data, ...info});
  }
  renderList();select(reports.findIndex(r => !r.error) >= 0 ? reports.length - 1 - [...reports].reverse().findIndex(r => !r.error) : reports.length - 1);
}
function renderList() {
  $('list').innerHTML = reports.map((r, i) => `<li data-i="${i}" aria-current="${i === current}"><b>${esc(r.label ?? 'Inválido')}</b><small>${esc(r.name)}${r.data?.createdAt ? ' · ' + new Date(r.data.createdAt).toLocaleString('pt-BR') : ''}</small>${r.error ? `<small class="bad">${esc(r.error)}</small>` : ''}</li>`).join('');
  for (const li of $('list').querySelectorAll('li')) li.onclick = () => select(Number(li.dataset.i));
}
function select(i) {
  current = i;renderList();charts?.destroy?.();charts = null;const r = reports[i], main = $('main');if (!r) return;
  if (r.error) {main.innerHTML = `<h2>${esc(r.name)}</h2><p class="bad">${esc(r.error)}</p>`;return;}
  main.innerHTML = RENDER[r.kind](r.data, r);
  if (r.kind === 'movement-comparison') {
    const runs = r.data.runs.map(x => ({name: x.name, result: {samples: x.samples, markers: x.markers || []}}));
    charts = renderCharts($('charts'), runs, MOVEMENT_PANELS, {step: r.data.step});
  }
}
const bars = (rows, color = SERIES[0]) => {const max = Math.max(1e-9, ...rows.map(r => r[1]));return `<div class="bars">${rows.map(([k, v, label]) => `<div class="bar"><span>${esc(k)}</span><i style="width:${(100 * v / max).toFixed(1)}%;--c:${color}"></i><em>${esc(label ?? v)}</em></div>`).join('')}</div>`;};
const tiles = list => `<div class="tiles">${list.map(([k, v]) => `<div class="tile"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>`;
const LABELS = {duration: 'Duração da sequência (s)', distance: 'Distância percorrida (m)', displacement: 'Deslocamento final (m)', avgSpeed: 'Velocidade média (m/s)', maxSpeed: 'Velocidade máxima (m/s)', maxWalkSpeed: 'Velocidade máxima andando (m/s)', maxSprintSpeed: 'Velocidade máxima no sprint (m/s)', sprintBrakeTime: 'Fim do sprint até a caminhada (s)', timeToWalkSpeed: 'Tempo até 95% da caminhada (s)', brakingTime: 'Tempo de frenagem (s)', brakingDistance: 'Distância de frenagem (m)', reversalToZero: 'Inversão: até v = 0 (s)', reversalToSpeed: 'Inversão: até 95% no novo sentido (s)', dodgeDuration: 'Duração da esquiva (s)', dodgeDistance: 'Distância da esquiva (m)', tackleDuration: 'Duração do tackle (s)', tackleDistance: 'Distância do tackle (m)', sprints: 'Sprints', staminaUsed: 'Stamina consumida', collisions: 'Colisões', stateTransitions: 'Transições de estado', actions: 'Ações', interrupted: 'Ações interrompidas', animTransitions: 'Transições de animação'};

const RENDER = {
  'movement-comparison': d => {
    const keys = Object.keys(LABELS).filter(k => d.runs.some(r => r.metrics[k] != null));
    return `<h2>Gravador de movimento</h2><p class="meta">${esc(d.sequence.label)} · semente ${d.sequence.seed} · ${d.sequence.ticks} passos de ${(d.step * 1000).toFixed(2)} ms · ${d.deterministic ? '<span class="ok">reexecução determinística</span>' : '<span class="bad">reexecução divergiu</span>'}</p>
      ${d.comparable ? '<p class="ok">Condições equivalentes: só os parâmetros de A e B diferem.</p>' : `<p class="warn"><b>Não compare diretamente:</b> ${d.issues.map(esc).join(' ')}</p>`}
      <h3>Medidas</h3><table><tr><th>Medida</th>${d.runs.map((r, i) => `<th class="num"><span style="color:${SERIES[i]}">■</span> ${esc(r.name)}</th>`).join('')}</tr>${keys.map(k => `<tr><td>${LABELS[k]}</td>${d.runs.map(r => `<td class="num">${r.metrics[k] ?? '—'}</td>`).join('')}</tr>`).join('')}</table>
      <h3>Gráficos</h3><div id="charts"></div>
      ${d.runs.some(r => r.denied?.length) ? `<h3>Comandos negados durante a sequência</h3><table><tr><th>Execução</th><th>t (s)</th><th>Motivo</th></tr>${d.runs.flatMap(r => (r.denied || []).map(x => `<tr><td>${esc(r.name)}</td><td class="num">${n(x.t)}</td><td>${esc(x.text)}</td></tr>`)).join('')}</table>` : ''}`;
  },
  'command-diagnostics': d => {
    const by = {};for (const e of d.entries) if (e.result !== 'executed') by[e.text.split(':').slice(1).join(':').replace(/\(.*\)/, '').trim() || e.reason] = (by[e.text.split(':').slice(1).join(':').replace(/\(.*\)/, '').trim() || e.reason] ?? 0) + 1;
    const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
    return `<h2>Diagnóstico de comandos</h2><p class="meta">${d.entries.length} registro(s) · passo ${(d.step * 1000).toFixed(2)} ms</p>
      ${tiles([['negados', d.entries.filter(e => e.result === 'denied').length], ['guardados no buffer', d.entries.filter(e => e.result === 'buffered').length], ['buffer expirado', d.entries.filter(e => e.result === 'expired').length], ['executados (se registrados)', d.entries.filter(e => e.result === 'executed').length]])}
      <h3>Motivos mais frequentes</h3>${rows.length ? bars(rows.map(([k, v]) => [k, v])) : '<p class="meta">Nenhum comando negado.</p>'}
      <h3>Registro</h3><table><tr><th class="num">t (s)</th><th>Lutador</th><th>Mensagem</th><th>Estado</th><th class="num">Stamina</th></tr>${d.entries.slice(-300).reverse().map(e => `<tr><td class="num">${n(e.t)}</td><td>${e.fighter ? 'vermelho' : 'azul'}</td><td>${esc(e.text)}</td><td>${esc(e.action ? `${e.action} ${Math.round(e.actionElapsed * 1000)} ms` : e.state)}</td><td class="num">${n(e.stamina)}</td></tr>`).join('')}</table>`;
  },
  'perfect-training': d => {
    const W = d.window, a = d.attempts, timed = a.filter(x => x.offset != null), lo = Math.min(-.1, ...timed.map(x => -x.offset)), hi = Math.max(W + .05, ...timed.map(x => -x.offset + W)), span = hi - lo;
    // Faixa: posição do comando relativa ao impacto (0 = impacto; a janela válida vai de −janela a 0).
    const pos = v => `${(100 * (v - lo) / span).toFixed(2)}%`;
    return `<h2>Treino de ${d.mode === 'guard' ? 'defesa' : 'esquiva'} perfeita</h2><p class="meta">Ataque: ${esc(d.attack)} · intervalo ${d.interval} s · semente ${d.seed} · janela ${ms(W)}</p>
      ${tiles([['acertos', `${d.stats.hits} de ${d.stats.total}`], ['taxa', `${(100 * d.stats.rate).toFixed(0)}%`], ['erro médio até a janela', ms(d.stats.meanError)]])}
      <h3>Momento do comando em relação ao impacto</h3>
      <div class="strip"><div class="win" style="left:${pos(-W)};width:${(100 * W / span).toFixed(2)}%" title="janela válida"></div>${timed.map(x => `<span class="dot" style="left:${pos(-x.offset)};background:${x.success ? '#9fe58a' : x.timing === 'early' ? '#ffcf7d' : '#ff7a7a'}" title="#${x.n}: ${esc(x.text)}"></span>`).join('')}
      ${[lo, -W, 0, hi].map(v => `<span class="tick" style="left:${pos(v)}">${Math.round(v * 1000)} ms</span>`).join('')}</div>
      <p class="meta">Verde = perfeita; âmbar = cedo; vermelho = tarde ou sem janela. A faixa verde é a janela válida (termina no impacto).</p>
      <h3>Tentativas</h3><table><tr><th>#</th><th>Ataque</th><th>Resultado</th><th>Cronometragem</th></tr>${a.map(x => `<tr><td>${x.n}</td><td>${esc(x.kind)}</td><td class="${x.success ? 'ok' : 'warn'}">${esc(x.resultLabel)}</td><td>${esc(x.text)}</td></tr>`).join('')}</table>`;
  },
  'performance-benchmark': d => {
    const E = d.environment;
    return `<h2>Benchmark de desempenho</h2><p class="meta">${E.drawingBuffer?.join('×')} px · pixel ratio ${E.pixelRatio} · ${esc(E.renderer)} · GPU timer ${E.gpuTimer ? 'disponível' : 'indisponível'} · aquecimento ${d.config.warmup} s, medição ${d.config.duration} s, semente ${d.config.seed}</p>
      ${(d.notes || []).map(x => `<p class="warn">${esc(x)}</p>`).join('')}
      <h3>Trabalho de CPU por quadro (média)</h3>${bars(d.results.map(r => [`${r.label} · ${r.characters} pers.`, r.workAvg, `${n(r.workAvg)} ms`]))}
      <h3>Pico de partículas</h3>${bars(d.results.map(r => [`${r.label} · ${r.characters} pers.`, r.activePeak]), SERIES[1])}
      <h3>Tabela</h3><table><tr><th>Caso</th><th class="num">Pers.</th><th class="num">FPS</th><th class="num">Quadro méd.</th><th class="num">P95</th><th class="num">Pior</th><th class="num">CPU</th><th class="num">Sim.</th><th class="num">Anim.</th><th class="num">VFX</th><th class="num">Render CPU</th><th class="num">GPU</th><th class="num">Draw calls</th></tr>
      ${d.results.map(r => `<tr><td>${esc(r.label)}</td><td class="num">${r.characters}</td><td class="num">${n(r.fpsAvg, 1)}</td><td class="num">${n(r.frameAvg, 1)}</td><td class="num">${n(r.frameP95, 1)}</td><td class="num">${n(r.frameWorst, 1)}</td><td class="num">${n(r.workAvg)}</td><td class="num">${n(r.simAvg)}</td><td class="num">${n(r.animAvg)}</td><td class="num">${n(r.vfxAvg)}</td><td class="num">${n(r.renderAvg)}</td><td class="num">${r.gpuAvg == null ? '—' : n(r.gpuAvg)}</td><td class="num">${n(r.callsAvg, 0)}</td></tr>`).join('')}</table>`;
  },
  'ai-evaluation': d => {
    const rows = [['Vitórias', s => s.wins], ['Tackles (X)', s => s.tackles], ['X que acertaram', s => s.hits], ['X bloqueados', s => s.blocked], ['X sem contato', s => s.whiffs], ['Clashes', s => s.clashes], ['Esquivas (C)', s => s.dodges], ['C → X', s => s.cancels], ['Sprints', s => s.sprints], ['Esquivas perfeitas', s => s.perfectDodges], ['Stamina gasta', s => n(s.staminaSpent)], ['Stamina desperdiçada', s => n(s.staminaWasted)], ['Tempo exausto (s)', s => n(s.exhaustedTime)], ['Ações negadas', s => s.denied], ['Contra-ataques aproveitados', s => `${s.counterTaken} de ${s.counterOpen}`]];
    const b = d.before.sides[0], a = d.after.sides[0];
    return `<h2>Avaliação da IA</h2><p class="meta">${d.config.matches} lutas por versão · sementes a partir de ${d.config.seed} · estilo ${esc(d.config.style)} · adversário: ${esc(d.config.opponent)}</p>
      ${tiles([['vitórias (anterior)', `${(100 * b.wins / d.before.matches).toFixed(0)}%`], ['vitórias (revisada)', `${(100 * a.wins / d.after.matches).toFixed(0)}%`], ['ruído aproximado (±2σ)', `±${(200 * Math.sqrt(.25 / d.before.matches) * Math.SQRT2).toFixed(0)} pontos`]])}
      <table><tr><th>Azul contra a IA anterior</th><th class="num">Anterior</th><th class="num">Revisada</th></tr>${rows.map(([k, f]) => `<tr><td>${k}</td><td class="num">${f(b)}</td><td class="num">${f(a)}</td></tr>`).join('')}</table>`;
  },
  'animation-telemetry': d => {
    const by = {};for (const e of d.log) by[e.reason] = (by[e.reason] ?? 0) + 1;
    return `<h2>Telemetria de animação</h2><p class="meta">${esc(d.character)} · ${d.transitions} trocas · ${d.restartsAvoided} reinícios evitados · ${d.log.filter(e => e.interrupted).length} interrupções</p>
      <h3>Motivos das trocas</h3>${bars(Object.entries(by).sort((x, y) => y[1] - x[1]))}
      <h3>Trocas</h3><table><tr><th class="num">t</th><th>De → para</th><th>Clipe</th><th class="num">Tocou</th><th>Motivo</th><th>Origem</th></tr>${d.log.slice(-300).reverse().map(e => `<tr class="${e.interrupted ? 'warn' : ''}"><td class="num">${n(e.t)}</td><td>${esc(e.from ?? '—')} → ${esc(e.to)}</td><td>${esc(e.clipTo)}</td><td class="num">${e.from ? `${n(e.playedSeconds)} s (${e.playedPct}%)` : '—'}</td><td>${esc(e.reason)}</td><td>${esc(e.source)}</td></tr>`).join('')}</table>`;
  },
};

if (typeof document !== 'undefined') {
  $('files').onchange = e => {addFiles([...e.target.files]);e.target.value = '';};
  const drop = $('drop');
  drop.addEventListener('dragover', e => {e.preventDefault();drop.classList.add('over');});drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => {e.preventDefault();drop.classList.remove('over');addFiles([...e.dataTransfer.files]);});
  window.__reports = {reports, classify, addFiles, select};
}
