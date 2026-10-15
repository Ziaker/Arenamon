// Aba Cenários › Gravador de movimento: grava uma sequência curta jogando (ou usa a sequência padrão), reproduz na
// arena e mede A × B com o mesmo estado inicial, a mesma semente e os mesmos comandos. Gráficos com marcadores e
// exportação CSV/JSON (relatório versionado, lido também pelo painel externo de relatórios).
import {C} from '../sim/config.js';
import {Character} from '../view/characters.js';
import {standardSequence, startSequenceRecording, recordSequenceStep, serializeSequence, parseSequence, runSequence, samplesCsv, METRIC_LABELS} from '../sim/movement.js';
import {renderCharts, MOVEMENT_PANELS, MARKER_TYPES, SERIES} from './charts.js';
import {escape} from './tuning.js';

export const REPORT_SCHEMA = 'arenamon-lab-report', REPORT_VERSION = 1;
const MAX_SEQ = 24, MAX_REC_SECONDS = 30;

export function createMovementPanel({$, game, ui, presets, tuning, download, playSequence, getWs}) {
  let rec = null, last = null, charts = null;
  const stored = () => getWs()?.doc.sequences ?? (ui.sequences ??= []);
  function list() {const out = [standardSequence()];for (const s of stored()) {const p = parseSequence(s);if (p.seq) out.push(p.seq);}return out;}
  const current = () => list().find(s => s.id === $('mv-seq').value) ?? list()[0];
  function save(seq) {
    const ws = getWs(), packed = serializeSequence(seq);
    if (ws) {ws.doc.sequences = [...(ws.doc.sequences || []).filter(s => s.id !== seq.id), packed].slice(-MAX_SEQ);ws.touch();} else stored().push(packed);
  }
  function render() {
    const sel = $('mv-seq'), prev = sel.value, all = list();
    sel.replaceChildren(...all.map(s => new Option(`${s.label} · ${(s.ticks * (s.step || C.test.step)).toFixed(1)} s`, s.id)));sel.value = all.some(s => s.id === prev) ? prev : all[0].id;
    for (const id of ['mv-a', 'mv-b']) {const s = $(id), p = s.value;s.innerHTML = $('preset-a').innerHTML;s.insertBefore(new Option('— nenhum —', '__none'), s.firstChild);s.value = [...s.options].some(o => o.value === p) ? p : id === 'mv-a' ? '__current' : (presets.all().find(x => x.builtin)?.id ?? '__lab');}
    $('mv-del').disabled = current().id === 'padrao';status();
  }
  function status(msg) {
    const seq = current();
    $('mv-status').innerHTML = msg ?? (rec ? `<span class="warn">● Gravando: ${rec.ticks} passos (${(rec.ticks * C.test.step).toFixed(2)} s). Clique em ■ para parar.</span>` : `${escape(seq.label)} · ${seq.ticks} passos · semente ${seq.seed}${seq.enemy === 'still' ? ' · adversário parado' : ' · comandos do adversário gravados'}${seq.recordedAt ? ` · gravada ${new Date(seq.recordedAt).toLocaleString('pt-BR')}` : ' · roteirizada'}`);
    $('mv-rec').textContent = rec ? '■ Parar gravação' : '● Gravar da partida';
  }
  // ---------- Gravação (chamada pelo laço ao vivo depois de cada passo) ----------
  function toggleRecording() {
    if (rec) return stopRecording();
    if (game.phase !== 'playing') {status('<span class="warn">Inicie uma partida (aba Partida) e clique em Gravar: a gravação começa do estado atual.</span>');return null;}
    rec = startSequenceRecording(game, {label: `Gravação ${new Date().toLocaleTimeString('pt-BR')}`, profile: game.profile, enemyProfile: game.enemyProfile, seed: Number($('seed').value) || 1, mode: game.mode});
    status();return rec;
  }
  function onStep(c0, c1) {if (!rec) return;recordSequenceStep(rec, c0, c1);if (rec.ticks * C.test.step >= MAX_REC_SECONDS) stopRecording();else if (rec.ticks % 30 === 0) status();}
  function stopRecording() {
    const seq = rec;rec = null;if (!seq || !seq.ticks) {status();return null;}
    save(seq);render();$('mv-seq').value = seq.id;status(`<span class="ok">Sequência gravada: ${seq.ticks} passos (${(seq.ticks * C.test.step).toFixed(2)} s). Use “Medir e comparar” ou reproduza na arena.</span>`);return seq;
  }
  // ---------- Medição ----------
  /** Sonda de animação: uma cópia sem cena do personagem do azul, com as mesmas associações (se houver modelo). */
  function animProbe() {
    const live = ui.characters[0];if (!live) return null;
    const probe = new Character(live.source, {persist: false, slot: 0});probe.clips = live.clips.slice();probe.clipInfo = live.clipInfo.slice();probe.variants = structuredClone(live.variants);probe.speeds = {...live.speeds};probe.groundCache = live.groundCache;
    return {probe, fn: (f, g, t) => {probe.update(f, C.test.step, (f.flight?.y ?? 0) + (f.vaultHeight ?? 0), g.lastStepEvents, {tick: t, source: 'jogador'});return probe.current?.key ?? null;}};
  }
  function measure() {
    const seq = current(), ia = $('mv-a').value, ib = $('mv-b').value, runs = [];
    const named = id => ({name: id === '__none' ? null : presets.nameOf(id), values: id === '__none' ? null : presets.valuesOf(id)});
    const A = named(ia), B = named(ib);if (!A.values && !B.values) {status('<span class="warn">Escolha ao menos A.</span>');return null;}
    const t0 = performance.now();const extra = [];
    for (const [side, def] of [['A', A], ['B', B]]) {
      if (!def.values) continue;const probe = animProbe();
      const result = runSequence(seq, {values: def.values, animProbe: probe?.fn});
      if (probe) {result.metrics.animTransitions = probe.probe.transitions;probe.probe.dispose();}
      runs.push({side, name: `${side} · ${def.name}`, preset: side === 'A' ? ia : ib, values: def.values, result});
    }
    const issues = runs.length === 2 ? comparabilityOf(seq, runs) : [];
    last = {seq, runs, issues, ms: performance.now() - t0};
    // Reprodutibilidade: a mesma execução repetida precisa dar o mesmo estado final.
    last.deterministic = runSequence(seq, {values: runs[0].values}).finalState === runs[0].result.finalState;
    renderReport();return last;
  }
  function comparabilityOf(seq, runs) {
    const out = [];for (const p of new Set([...Object.keys(runs[0].values), ...Object.keys(runs[1].values)])) if (p.startsWith('test.') && runs[0].values[p] !== runs[1].values[p]) out.push(`${p} difere entre A e B: o mesmo comando por passo não representa o mesmo tempo.`);
    if (seq.step && Math.abs(seq.step - C.test.step) > 1e-12) out.push(`A sequência foi gravada com passo ${(seq.step * 1000).toFixed(2)} ms; o atual é ${(C.test.step * 1000).toFixed(2)} ms.`);
    return out;
  }
  function renderReport() {
    if (!last) return;const {runs, issues} = last, keys = Object.keys(METRIC_LABELS).concat(runs.some(r => r.result.metrics.animTransitions != null) ? ['animTransitions'] : []);
    const lab = k => k === 'animTransitions' ? ['Transições de animação (modelo do azul)', ''] : METRIC_LABELS[k];
    const cell = (r, k) => {const v = r.result.metrics[k];return v == null ? '—' : `${v}${lab(k)[1] ? ' ' + lab(k)[1] : ''}`;};
    $('mv-report').innerHTML = `<p>${escape(last.seq.label)} · mesmo estado inicial, semente ${last.seq.seed} e ${last.seq.ticks} comandos · ${last.ms.toFixed(0)} ms · ${last.deterministic ? '<span class="ok">reexecução idêntica (determinística)</span>' : '<span class="bad">reexecução divergiu</span>'}</p>`
      + (issues.length ? `<p class="warn"><b>Condições diferentes — não compare diretamente:</b> ${issues.map(escape).join(' ')}</p>` : runs.length === 2 ? '<p class="ok">Condições equivalentes: só os parâmetros de A e B diferem.</p>' : '')
      + `<table><tr><th>Medida</th>${runs.map((r, i) => `<th><i class="dot" style="background:${SERIES[i]}"></i>${escape(r.name)}</th>`).join('')}</tr>${keys.map(k => `<tr><td>${escape(lab(k)[0])}</td>${runs.map((r, i) => `<td class="${i && cell(r, k) !== cell(runs[0], k) ? 'warn' : ''}">${cell(r, k)}</td>`).join('')}</tr>`).join('')}</table>`;
    $('mv-graphs').disabled = $('mv-csv').disabled = $('mv-json').disabled = false;
  }
  function openGraphs() {
    if (!last) measure();if (!last) return;
    $('graphs').hidden = false;const active = new Set([...document.querySelectorAll('#graphs-markers input:checked')].map(i => i.value));
    charts?.destroy();charts = renderCharts($('graphs-body'), last.runs.map(r => ({name: r.name, result: r.result})), MOVEMENT_PANELS, {markers: active, step: C.test.step});
  }
  function report() {
    const {seq, runs, issues} = last;
    return {schema: REPORT_SCHEMA, version: REPORT_VERSION, kind: 'movement-comparison', createdAt: new Date().toISOString(), step: C.test.step,
      sequence: {id: seq.id, label: seq.label, seed: seq.seed, ticks: seq.ticks, enemy: seq.enemy, profile: seq.profile}, comparable: !issues.length, issues, deterministic: last.deterministic,
      runs: runs.map(r => ({side: r.side, name: r.name, preset: r.preset, values: r.values, metrics: r.result.metrics, markers: r.result.markers, actions: r.result.actions.map(({from, ...a}) => a), denied: r.result.denied, samples: r.result.samples}))};
  }
  function bind() {
    $('mv-seq').onchange = () => render();
    $('mv-rec').onclick = toggleRecording;
    $('mv-play').onclick = () => {const id = $('mv-a').value;playSequence(current(), id === '__none' ? null : {name: presets.nameOf(id), values: presets.valuesOf(id)});};
    $('mv-del').onclick = () => {const s = current();if (s.id === 'padrao' || !confirm(`Excluir a sequência “${s.label}”?`)) return;const ws = getWs();if (ws) {ws.doc.sequences = ws.doc.sequences.filter(x => x.id !== s.id);ws.touch();}render();};
    $('mv-export-seq').onclick = () => download(JSON.stringify(serializeSequence(current()), null, 1), `arenamon-sequencia-${current().id}.json`);
    $('mv-import').onchange = async e => {const f = e.target.files[0];e.target.value = '';if (!f) return;const p = parseSequence(await f.text());if (p.error) {status(`<span class="bad">${escape(p.error)}</span>`);return;}save(p.seq);render();$('mv-seq').value = p.seq.id;status(`<span class="ok">Sequência importada: ${escape(p.seq.label)}.</span>`);};
    $('mv-run').onclick = measure;$('mv-graphs').onclick = openGraphs;
    $('mv-csv').onclick = () => {if (last) download(samplesCsv(last.runs.map(r => ({name: r.side, result: r.result}))), `arenamon-movimento-${last.seq.id}.csv`, 'text/csv');};
    $('mv-json').onclick = () => {if (last) download(JSON.stringify(report()), `arenamon-relatorio-movimento-${last.seq.id}.json`);};
    $('graphs-close').onclick = () => {$('graphs').hidden = true;};
    $('graphs-markers').innerHTML = MARKER_TYPES.map(t => `<label class="pill"><input type="checkbox" value="${t}" checked> ${t}</label>`).join('');
    $('graphs-markers').onchange = () => {if (!$('graphs').hidden) openGraphs();};
    $('mv-graphs').disabled = $('mv-csv').disabled = $('mv-json').disabled = true;
  }
  bind();render();
  return {render, toggleRecording, stopRecording, onStep, measure, openGraphs, report, get recording() {return rec;}, get last() {return last;}, list};
}
