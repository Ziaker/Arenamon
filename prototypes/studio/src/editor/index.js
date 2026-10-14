// Controlador do editor (Fase 1): timeline, recorte, tempo/loop, eventos, root motion, comparação e histórico.
import {createHistory} from './history.js';
import {createStore, meta, EVENT_TYPES, eventType, eventWarnings, newId} from './store.js';
import {trimClip, scaleClipTime, closeLoop, keyTimes, trimEvents, scaleEvents} from './clip-ops.js';
import {basisFor, analyzeRoot, editRoot, rootMotionData} from './root-ops.js';
import {createTimeline} from './timeline.js';
import {createCompare} from './compare.js';

const $ = id => document.getElementById(id);
const E = window.__importer;
const fmt = (x, d = 3) => x.toLocaleString('pt-BR', {minimumFractionDigits: d, maximumFractionDigits: d});
const toast = msg => {const n = $('toast');if (!n) return;n.textContent = msg;n.classList.add('show');clearTimeout(toast.timer);toast.timer = setTimeout(() => n.classList.remove('show'), 2600);};

const history = createHistory({onChange: s => {
  $('ed-undo').disabled = !s.canUndo;$('ed-redo').disabled = !s.canRedo;
  $('ed-undo').title = s.canUndo ? `Desfazer: ${s.undoLabel} (Ctrl+Z)` : 'Nada para desfazer';
  $('ed-redo').title = s.canRedo ? `Refazer: ${s.redoLabel} (Ctrl+Y)` : 'Nada para refazer';
}});
const store = createStore({engine: E, history});
const compare = createCompare({engine: E, store});
window.__studioCompare = compare;

const ui = {tool: null, fps: 30, ranges: new WeakMap(), selectedEvent: null, keyCache: new WeakMap(), rootCache: new WeakMap(), rootChoice: null, height: 210, collapsed: false};
try {const h = Number(localStorage.getItem('arenamon-studio-timeline-h'));if (h > 0) ui.height = h;ui.collapsed = localStorage.getItem('arenamon-studio-timeline-collapsed') === '1';} catch {}
const clip = () => E.selectedClip;
const time = () => {const a = E.selectedAction, d = clip()?.duration || 0;return Math.max(0, Math.min(d, a?.time || 0));};
const frameStep = () => 1 / ui.fps;
const snapT = t => $('ed-snap').checked ? Math.round(t * ui.fps) / ui.fps : t;
function seek(t) {E.setPlaying(false);E.seek(t);timeline.invalidate();}

// ---------- Timeline ----------
const timeline = createTimeline($('ed-canvas'), {
  duration: () => clip()?.duration || 0, time, fps: () => ui.fps, snap: () => $('ed-snap').checked,
  keyTimes: () => {const c = clip();if (!c) return [];const hit = ui.keyCache.get(c);if (hit?.tracks === c.tracks) return hit.times;const times = keyTimes(c);ui.keyCache.set(c, {tracks: c.tracks, times});return times;},
  events: () => clip() ? meta(clip()).events : [],
  markers: () => (window.__studioV4?.markers?.()[E.selectedIndex]) || [],
  eventColor: type => eventType(type).color, selectedEvent: () => ui.selectedEvent,
  onSeek: t => seek(t),
  onRange: r => {if (clip()) ui.ranges.set(clip(), r);renderTrim();},
  onEventPick: id => {ui.selectedEvent = id;openTool('events', {keep: true});renderEvents();},
  onEventMove: (id, t, done, origin) => {
    const c = clip(), e = meta(c).events.find(x => x.id === id);if (!e) return;
    if (!done) {e.time = t;return;}
    e.time = origin;if (Math.abs(origin - t) < 1e-6) return;
    store.edit(c, 'Mover evento', x => {meta(x).events.find(y => y.id === id).time = t;});renderEvents();
  },
  onEventAdd: t => addEvent($('ed-event-type').value, t),
});
let readout = '';
E.on('tick', () => {
  const c = clip();
  // Repetir somente o trecho na prévia.
  const range = c && ui.ranges.get(c);
  if (range && $('ed-loop-range').checked && E.playing) {const t = time();if (t >= range.end - 1e-4 || t < range.start - 1e-4) E.seek(range.start);}
  timeline.update();
  const t = time(), d = c?.duration || 0, text = `${fmt(t)} s|quadro ${Math.round(t * ui.fps)} / ${Math.round(d * ui.fps)}`;
  if (text !== readout) {readout = text;const [a, b] = text.split('|');$('ed-time').textContent = a;$('ed-frame').textContent = b;}
});

// ---------- Dock: altura, recolher e ferramentas ----------
const stage = document.querySelector('.stage'), dock = $('ed-dock');
function applyHeight() {
  const bar = dock.querySelector('.ed-bar').offsetHeight || 46;
  // Garante espaço para todas as faixas da timeline (116 px) e, com ferramenta aberta, para o painel.
  const h = ui.collapsed ? bar + 6 : Math.max(ui.height, bar + 130, ui.tool ? bar + 250 : 0);
  stage.style.setProperty('--ed-dock-h', Math.min(h, Math.max(bar + 6, stage.clientHeight - 140)) + 'px');
  dock.classList.toggle('ed-collapsed', ui.collapsed);$('ed-collapse').setAttribute('aria-expanded', String(!ui.collapsed));$('ed-collapse').textContent = ui.collapsed ? '▴' : '▾';
  try {localStorage.setItem('arenamon-studio-timeline-h', String(ui.height));localStorage.setItem('arenamon-studio-timeline-collapsed', ui.collapsed ? '1' : '0');} catch {}
  timeline.invalidate();
}
{
  const grip = $('ed-grip');let start = null;
  grip.addEventListener('pointerdown', e => {e.preventDefault();start = {y: e.clientY, h: dock.offsetHeight};grip.setPointerCapture(e.pointerId);document.body.classList.add('ed-resizing');});
  grip.addEventListener('pointermove', e => {if (!start) return;ui.collapsed = false;ui.height = Math.max(110, start.h + start.y - e.clientY);applyHeight();});
  const end = () => {start = null;document.body.classList.remove('ed-resizing');};grip.addEventListener('pointerup', end);grip.addEventListener('pointercancel', end);
  grip.addEventListener('dblclick', () => {ui.collapsed = !ui.collapsed;applyHeight();});
  grip.addEventListener('keydown', e => {if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {e.preventDefault();ui.collapsed = false;ui.height = Math.max(110, ui.height + (e.key === 'ArrowUp' ? 20 : -20));applyHeight();}});
  $('ed-collapse').onclick = () => {ui.collapsed = !ui.collapsed;applyHeight();};
  new ResizeObserver(() => applyHeight()).observe(stage);
}
function openTool(name, {keep = false} = {}) {
  if (ui.tool === name && !keep) name = null;
  ui.tool = name;if (name) ui.collapsed = false;
  for (const b of dock.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === name));
  for (const s of dock.querySelectorAll('[data-panel]')) s.hidden = s.dataset.panel !== name;
  $('ed-panel').hidden = !name;dock.classList.toggle('has-panel', !!name);
  document.querySelector('[data-workflow="edit"]')?.classList.toggle('current', !!name && name !== 'compare');
  applyHeight();renderAll();
}
for (const b of dock.querySelectorAll('[data-tool]')) b.onclick = () => openTool(b.dataset.tool);
for (const b of dock.querySelectorAll('.ed-close')) b.onclick = () => openTool(null);
$('ed-zoom-in').onclick = () => {timeline.zoom(1.5);timeline.draw();};
$('ed-zoom-out').onclick = () => {timeline.zoom(1 / 1.5);timeline.draw();};
$('ed-fit').onclick = () => {timeline.fit();timeline.draw();};
$('ed-fps').onchange = () => {ui.fps = Number($('ed-fps').value) || 30;timeline.invalidate();renderAll();};
$('ed-start').onclick = () => seek(0);
$('ed-end').onclick = () => seek(clip()?.duration || 0);
$('ed-prev').onclick = () => seek(snapT(time()) - frameStep());
$('ed-next').onclick = () => seek(snapT(time()) + frameStep());
$('ed-undo').onclick = () => {const c = history.undo();if (c) toast('Desfeito: ' + c.label);};
$('ed-redo').onclick = () => {const c = history.redo();if (c) toast('Refeito: ' + c.label);};

// ---------- Recorte ----------
function range() {return clip() ? ui.ranges.get(clip()) || null : null;}
function setRange(r) {const c = clip();if (!c) return;if (r) {r = {start: Math.max(0, Math.min(r.start, c.duration)), end: Math.max(0, Math.min(r.end, c.duration))};if (r.end < r.start) r = {start: r.end, end: r.start};if (r.end - r.start < 1e-4) r = null;}ui.ranges.set(c, r);timeline.range = r;renderTrim();}
function markIn() {const c = clip();if (!c) return;const r = range(), t = snapT(time());setRange({start: t, end: r && r.end > t ? r.end : c.duration});}
function markOut() {const c = clip();if (!c) return;const r = range(), t = snapT(time());setRange({start: r && r.start < t ? r.start : 0, end: t});}
function renderTrim() {
  const r = range(), c = clip();timeline.range = r;
  if (document.activeElement !== $('ed-in')) $('ed-in').value = r ? r.start.toFixed(3) : '';
  if (document.activeElement !== $('ed-out')) $('ed-out').value = r ? r.end.toFixed(3) : '';
  $('ed-in').max = $('ed-out').max = c?.duration || 0;
  $('ed-range-info').textContent = r ? `Trecho: ${fmt(r.end - r.start)} s · ${Math.round((r.end - r.start) * ui.fps)} quadros (de ${Math.round(r.start * ui.fps)} a ${Math.round(r.end * ui.fps)})` : 'Nenhum trecho selecionado.';
  $('ed-trim-new').disabled = $('ed-trim-here').disabled = !r;
}
function trimmed(c, r) {
  return x => {
    const out = trimClip(x, r.start, r.end);x.tracks = out.tracks;x.duration = out.duration;
    const d = meta(x);d.events = trimEvents(d.events, r.start, r.end);
    if (d.rootMotion?.original) d.rootMotion.original = trimRootData(d.rootMotion.original, r.start, r.end);
  };
}
function trimRootData(data, start, end) {
  const rows = data.samples.filter(s => s[0] >= start - 1e-6 && s[0] <= end + 1e-6);if (!rows.length) return data;const b = rows[0];
  return {...data, samples: rows.map(s => [+(s[0] - start).toFixed(4), +(s[1] - b[1]).toFixed(4), +(s[2] - b[2]).toFixed(4), +(s[3] - b[3]).toFixed(4), +(s[4] - b[4]).toFixed(2)])};
}
function trimToNew(r = range()) {
  const c = clip();if (!c || !r) return null;
  store.derive(c, `${c.name} · ${r.start.toFixed(2)}–${r.end.toFixed(2)}s`, trimmed(c, r), {op: 'trim', params: {start: r.start, end: r.end}});
  toast('Clipe criado com o trecho selecionado. O original foi preservado.');return E.selectedClip;
}
function trimHere(r = range()) {
  const c = clip();if (!c || !r) return;
  store.edit(c, `Recortar “${c.name}”`, trimmed(c, r), {op: 'trim', params: {start: r.start, end: r.end}});ui.ranges.set(c, null);toast('Clipe recortado. Use Ctrl+Z para desfazer.');
}
$('ed-mark-in').onclick = markIn;$('ed-mark-out').onclick = markOut;
$('ed-select-all').onclick = () => clip() && setRange({start: 0, end: clip().duration});
$('ed-clear-range').onclick = () => setRange(null);
// Cada campo move somente o seu lado; sem seleção, o outro lado vai ao início/fim do clipe.
for (const [id, side] of [['ed-in', 'start'], ['ed-out', 'end']]) $(id).onchange = () => {
  const c = clip(), raw = $(id).value.trim();if (!c || raw === '') return;const v = snapT(Number(raw.replace(',', '.')));if (!Number.isFinite(v)) return;
  const r = range() || {start: 0, end: c.duration};setRange({...r, [side]: v});
};
$('ed-trim-new').onclick = () => trimToNew();
$('ed-trim-here').onclick = () => trimHere();

// ---------- Tempo, loop e versões ----------
function scaled(factor) {
  return x => {
    const out = scaleClipTime(x, factor);x.tracks = out.tracks;x.duration = out.duration;const d = meta(x);d.events = scaleEvents(d.events, factor);
    if (d.rootMotion?.original) d.rootMotion.original = {...d.rootMotion.original, samples: d.rootMotion.original.samples.map(s => [+(s[0] * factor).toFixed(4), ...s.slice(1)])};
  };
}
function setSpeed(percent) {const c = clip();if (!c || !(percent > 0)) return;const factor = 100 / percent;store.edit(c, `Velocidade ${percent}%`, scaled(factor), {op: 'speed', params: {percent}});ui.ranges.set(c, null);}
function setDuration(seconds) {const c = clip();if (!c || !(seconds > 0)) return;const factor = seconds / c.duration;store.edit(c, `Duração ${fmt(seconds, 2)} s`, scaled(factor), {op: 'duration', params: {seconds}});ui.ranges.set(c, null);}
function rootPositionTrack(c) {const info = rootInfo(c);return info?.position?.name;}
function loopClose(blend, keepTravel = true) {
  const c = clip();if (!c) return;const keep = keepTravel ? [rootPositionTrack(c)].filter(Boolean) : [];
  store.edit(c, 'Fechar loop', x => {const out = closeLoop(x, blend, {fps: ui.fps, keepTravel: keep});x.tracks = out.tracks;}, {op: 'close-loop', params: {blend, keepTravel}});
}
$('ed-apply-speed').onclick = () => setSpeed(Number($('ed-speed').value));
$('ed-apply-duration').onclick = () => setDuration(Number($('ed-duration').value));
$('ed-close-loop').onclick = () => loopClose(Number($('ed-loop-blend').value) || .2, $('ed-loop-keep-travel').checked);
$('ed-duplicate').onclick = () => {const c = clip();if (c) {store.derive(c, `${c.name} · cópia`, null, {op: 'duplicate'});toast('Clipe duplicado.');}};
$('ed-restore').onclick = () => {const c = clip();if (c && store.restore(c)) toast('Original restaurado. Ctrl+Z desfaz.');};
$('ed-delete').onclick = () => {const c = clip();if (!c) return;try {store.remove(c);toast('Clipe derivado excluído. Ctrl+Z desfaz.');} catch (e) {toast(e.message);}};
function renderTime() {
  const c = clip();if (!c) {$('ed-clip-origin').textContent = '';return;}
  const d = meta(c);if (document.activeElement !== $('ed-duration')) $('ed-duration').value = c.duration.toFixed(3);
  $('ed-delete').disabled = !d.derivedFrom;
  const origin = d.derivedFrom ? `Derivado de “${d.derivedFrom.clipName}”.` : `Importado${c.sourceFile ? ` de ${c.sourceFile}` : ''}.`;
  const edits = d.edits.length ? `${d.edits.length} edição(ões): ${d.edits.slice(-4).map(e => e.op).join(', ')}.` : 'Sem edições.';
  $('ed-clip-origin').textContent = `${origin} ${edits} A fonte original fica preservada para restauração.`;
}

// ---------- Eventos ----------
$('ed-event-type').replaceChildren(...EVENT_TYPES.map(t => new Option(t.label, t.id)));
function addEvent(type, t = time(), label) {
  const c = clip();if (!c) return null;const id = newId('ev');t = Math.max(0, Math.min(c.duration, snapT(t)));
  store.edit(c, `Evento: ${eventType(type).label}`, x => {meta(x).events.push({id, type, time: t, label: label || eventType(type).label, payload: ''});meta(x).events.sort((a, b) => a.time - b.time);}, {op: 'event-add', params: {type}});
  ui.selectedEvent = id;renderEvents();return id;
}
function updateEvent(id, patch, label = 'Editar evento') {const c = clip();if (!c) return;store.edit(c, label, x => {Object.assign(meta(x).events.find(e => e.id === id), patch);meta(x).events.sort((a, b) => a.time - b.time);});renderEvents();}
function removeEvent(id) {const c = clip();if (!c) return;store.edit(c, 'Excluir evento', x => {meta(x).events = meta(x).events.filter(e => e.id !== id);}, {op: 'event-remove'});if (ui.selectedEvent === id) ui.selectedEvent = null;renderEvents();}
function renderEvents() {
  const c = clip(), list = $('ed-event-list');timeline.invalidate();if (ui.tool !== 'events') return;list.replaceChildren();
  if (!c) return;const events = meta(c).events;
  if (!events.length) {const p = document.createElement('p');p.className = 'ed-empty-list';p.textContent = 'Nenhum evento neste clipe. Escolha um tipo e clique em “No quadro atual”.';list.append(p);}
  for (const e of events) {
    const row = document.createElement('div');row.className = 'ed-event' + (e.id === ui.selectedEvent ? ' selected' : '');row.style.setProperty('--c', eventType(e.type).color);
    const type = document.createElement('select');type.setAttribute('aria-label', 'Tipo');type.append(...EVENT_TYPES.map(t => new Option(t.label, t.id)));type.value = e.type;type.onchange = () => updateEvent(e.id, {type: type.value}, 'Alterar tipo de evento');
    const name = document.createElement('input');name.type = 'text';name.value = e.label || '';name.maxLength = 80;name.setAttribute('aria-label', 'Nome do evento');name.onchange = () => updateEvent(e.id, {label: name.value.trim() || eventType(e.type).label}, 'Renomear evento');
    const frame = document.createElement('input');frame.type = 'number';frame.min = 0;frame.step = 1;frame.max = Math.round(c.duration * ui.fps);frame.value = Math.round(e.time * ui.fps);frame.title = `${fmt(e.time)} s`;frame.setAttribute('aria-label', 'Quadro');
    frame.onchange = () => {const f = Math.max(0, Math.min(Number(frame.value) || 0, Math.round(c.duration * ui.fps)));updateEvent(e.id, {time: Math.min(c.duration, f / ui.fps)}, 'Mover evento');};
    const payload = document.createElement('input');payload.type = 'text';payload.placeholder = 'parâmetro (opcional)';payload.value = e.payload || '';payload.maxLength = 120;payload.title = 'Dado livre para o jogo: nome do efeito, som, hitbox…';payload.onchange = () => updateEvent(e.id, {payload: payload.value.trim()}, 'Editar parâmetro');
    const go = document.createElement('button');go.type = 'button';go.textContent = '▶';go.title = 'Ir para o evento';go.onclick = () => {ui.selectedEvent = e.id;seek(e.time);renderEvents();};
    const del = document.createElement('button');del.type = 'button';del.textContent = '×';del.title = 'Excluir evento';del.onclick = () => removeEvent(e.id);
    const f = document.createElement('span');f.className = 'ed-frame-label';f.textContent = 'q';
    row.append(type, frame, f, go, del, name, payload);row.onclick = ev => {if (ev.target === row) {ui.selectedEvent = e.id;renderEvents();}};list.append(row);
  }
  $('ed-event-warnings').textContent = eventWarnings(events, c.duration).join('\n');
}
$('ed-event-add').onclick = () => addEvent($('ed-event-type').value);

// ---------- Root motion ----------
function rootCandidates(c) {
  if (!c || !E.model) return [];const lookup = new Map();E.model.traverse(o => lookup.set(o.uuid, o));
  return c.tracks.filter(t => t.name.endsWith('.position')).map(t => {const node = lookup.get(t.name.slice(0, -9));return node && {node, track: t, score: (node.isBone ? 50 : 0) + (/hip|pelvis|root/i.test(node.name) ? 70 : 0) + (!node.parent?.isBone ? 10 : 0)};}).filter(Boolean).sort((a, b) => b.score - a.score);
}
function rootInfo(c) {
  const list = rootCandidates(c);if (!list.length) return null;const pick = list.find(x => x.node.uuid === ui.rootChoice) || list[0];
  return {node: pick.node, position: pick.track, quaternion: c.tracks.find(t => t.name === pick.node.uuid + '.quaternion') || null, duration: c.duration, basis: basisFor(pick.node, E.model)};
}
function analysis(c) {
  const info = rootInfo(c);if (!info) return null;const hit = ui.rootCache.get(c);if (hit && hit.tracks === c.tracks && hit.node === info.node && hit.fps === ui.fps) return hit.result;
  const result = {info, ...analyzeRoot({...info, fps: ui.fps})};ui.rootCache.set(c, {tracks: c.tracks, node: info.node, fps: ui.fps, result});return result;
}
function rootOptions() {return {horizontal: Number($('ed-root-h').value) / 100, method: $('ed-root-method').value, vertical: $('ed-root-v').value, rotation: $('ed-root-rot').value};}
function rootEdit(opts) {
  return x => {
    const a = analysis(x);if (!a) throw Error('Nenhum osso raiz com trilha de posição foi encontrado neste clipe.');
    const out = editRoot(a.info, opts);
    x.tracks = x.tracks.map(t => t === a.info.position && out.position ? out.position : t === a.info.quaternion && out.quaternion ? out.quaternion : t);
    const d = meta(x), previous = d.rootMotion;
    d.rootMotion = {
      rootNode: a.info.node.name, options: opts, inPlace: opts.horizontal === 0,
      horizontalRemoved: opts.horizontal < 1, verticalRemoved: opts.vertical === 'lock', yawRemoved: opts.rotation === 'remove-yaw',
      // Guarda o deslocamento da primeira versão (antes de qualquer redução) como dado separado.
      original: previous?.original || rootMotionData(a, ui.fps),
      note: 'Deslocamento extraído da animação visual. No Arenamon a física move o personagem; não reaplique este deslocamento sobre um clip in-place.',
    };
  };
}
function applyRoot(opts = rootOptions(), asNew = true) {
  const c = clip();if (!c) return null;if (!analysis(c)) {toast('Nenhum osso raiz com trilha de posição neste clipe.');return null;}
  const pct = Math.round(opts.horizontal * 100), suffix = pct === 0 ? 'in-place' : `root ${pct}%`;
  if (asNew) store.derive(c, `${c.name} · ${suffix}`, rootEdit(opts), {op: 'root-motion', params: opts});
  else store.edit(c, `Root motion: ${suffix}`, rootEdit(opts), {op: 'root-motion', params: opts});
  toast(pct === 0 ? 'Versão in-place criada. O deslocamento original foi salvo como dado separado.' : 'Root motion ajustado.');return E.selectedClip;
}
$('ed-root-h').oninput = () => {$('ed-root-h-out').textContent = $('ed-root-h').value + '%';};
$('ed-root-node').onchange = () => {ui.rootChoice = $('ed-root-node').value;renderRoot();};
$('ed-root-new').onclick = () => applyRoot(rootOptions(), true);
$('ed-root-apply').onclick = () => applyRoot(rootOptions(), false);
function renderRoot() {
  if (ui.tool !== 'root') return;const c = clip(), list = rootCandidates(c), a = c && analysis(c);
  $('ed-root-node').replaceChildren(...list.map(x => new Option(x.node.name || x.node.type, x.node.uuid)));if (a) $('ed-root-node').value = a.info.node.uuid;
  $('ed-root-new').disabled = $('ed-root-apply').disabled = !a;
  const chips = $('ed-root-metrics');chips.replaceChildren();
  if (!a) {chips.innerHTML = '<span class="ed-chip">Sem trilha de posição na raiz</span>';drawRootGraph(null);$('ed-root-state').textContent = '';return;}
  const m = a.metrics;
  for (const [k, v] of [['Horizontal', fmt(m.horizontal, 2)], ['Percurso', fmt(m.path, 2)], ['ΔX', fmt(m.dx, 2)], ['ΔZ', fmt(m.dz, 2)], ['Altura', `${fmt(m.minY, 2)} a ${fmt(m.maxY, 2)}`], ['Giro', `${fmt(m.yawDegrees, 0)}°`]]) {const s = document.createElement('span');s.className = 'ed-chip';s.textContent = `${k} ${v}`;chips.append(s);}
  drawRootGraph(a);
  const d = meta(c).rootMotion, mode = window.__studioV3?.rootMode;
  const preview = mode && mode !== 'original' ? ' A prévia está travando o deslocamento (Ajustes › Chão e movimento); escolha “Original” lá para ver o movimento real.' : '';
  $('ed-root-state').textContent = (d ? `Editado: horizontal ${Math.round(d.options.horizontal * 100)}% · altura ${d.verticalRemoved ? 'neutralizada' : 'preservada'} · giro ${d.yawRemoved ? 'neutralizado' : 'preservado'}. Deslocamento original salvo (${d.original.samples.length} amostras).` : `Original: desloca ${fmt(m.horizontal, 2)} unidades na horizontal.`) + preview;
}
function drawRootGraph(a) {
  const cv = $('ed-root-graph'), r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);cv.width = Math.max(1, r.width * dpr);cv.height = Math.max(1, r.height * dpr);
  const g = cv.getContext('2d');g.setTransform(dpr, 0, 0, dpr, 0, 0);g.fillStyle = '#0b1320';g.fillRect(0, 0, r.width, r.height);if (!a?.samples.length) return;
  const S = a.samples, d = S.at(-1).t || 1, series = [[s => Math.hypot(s.x, s.z), '#54d9ee'], [s => s.y, '#bff36a'], [s => s.yaw, '#ffb35c']];
  for (const [f, color] of series) {
    let lo = Infinity, hi = -Infinity;for (const s of S) {const v = f(s);lo = Math.min(lo, v);hi = Math.max(hi, v);}const span = hi - lo || 1;
    g.strokeStyle = color;g.lineWidth = 1.5;g.beginPath();S.forEach((s, i) => {const x = 4 + (s.t / d) * (r.width - 8), y = r.height - 6 - ((f(s) - lo) / span) * (r.height - 12);i ? g.lineTo(x, y) : g.moveTo(x, y);});g.stroke();
  }
  const x = 4 + time() / d * (r.width - 8);g.fillStyle = '#ffd18c';g.fillRect(x, 0, 1, r.height);
}

// ---------- Comparação ----------
function renderCompare() {
  if (ui.tool !== 'compare') return;const type = $('lab-compare-type').value, mine = compare.handles(type);
  $('ed-cmp-on').checked = !!window.__studioV3?.compare;$('ed-cmp-clips').hidden = !mine;
  $('ed-cmp-b-field').hidden = type !== 'clips';$('ed-cmp-sync-field').hidden = type !== 'clips';$('ed-cmp-free').hidden = type !== 'clips' || $('ed-cmp-sync').value !== 'free';
  compare.refreshOptions();
  $('ed-cmp-info').textContent = type === 'original' ? 'Esquerda: clipe atual (com edições). Direita: a fonte original preservada, no mesmo tempo.' : type === 'clips' ? 'A usa a reprodução principal (play, velocidade e loop). O enquadramento é o mesmo nas duas vistas.' : 'Tipos da V3: mesma animação com diferentes prévias.';
}
$('ed-cmp-on').onchange = () => {window.__studioV3?.setCompare($('ed-cmp-on').checked);};
$('lab-compare-type').addEventListener('change', () => {if (!window.__studioV3?.compare) window.__studioV3?.setCompare(true);renderCompare();});
$('ed-cmp-b').onchange = () => compare.restartB();
$('ed-cmp-layout').onchange = () => {compare.layout = $('ed-cmp-layout').value;};
$('ed-cmp-sync').onchange = () => {compare.sync = $('ed-cmp-sync').value;renderCompare();};
$('ed-cmp-speed').onchange = () => {compare.speed = Number($('ed-cmp-speed').value) || 1;};
$('ed-cmp-play').onclick = () => {compare.playing = !compare.playing;$('ed-cmp-play').textContent = compare.playing ? '❚❚ Pausar B' : '▶ Reproduzir B';};
$('ed-cmp-restart').onclick = () => compare.restartB();
$('lab-compare-button').addEventListener('click', () => queueMicrotask(renderCompare));

// ---------- Teclado ----------
window.addEventListener('keydown', e => {
  const a = document.activeElement, typing = a && (['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName) && a.type !== 'checkbox' && a.type !== 'range');
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    const k = e.key.toLowerCase();if (typing) return;
    if (k === 'z' && !e.shiftKey) {e.preventDefault();$('ed-undo').click();}
    else if (k === 'y' || (k === 'z' && e.shiftKey)) {e.preventDefault();$('ed-redo').click();}
    return;
  }
  if (typing || e.altKey || !E.model) return;
  if (e.key === 'i' || e.key === 'I') {e.preventDefault();markIn();if (ui.tool !== 'trim') openTool('trim');}
  else if (e.key === 'o' || e.key === 'O') {e.preventDefault();markOut();if (ui.tool !== 'trim') openTool('trim');}
  else if (e.key === 'Home') {e.preventDefault();seek(0);}
  else if (e.key === 'End') {e.preventDefault();seek(clip()?.duration || 0);}
  else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selectedEvent && ui.tool === 'events') {e.preventDefault();removeEvent(ui.selectedEvent);}
});

// ---------- Sincronização com o motor ----------
function renderAll() {
  const c = clip();$('ed-empty').hidden = !!c;timeline.range = range();
  renderTrim();renderTime();renderEvents();renderRoot();renderCompare();timeline.invalidate();
}
E.on('modelInstalled', () => {history.clear();ui.selectedEvent = null;ui.rootChoice = null;});
E.on('clipsChanged', () => {for (const c of E.clips) store.register(c);renderAll();});
E.on('selected', () => {ui.selectedEvent = null;const c = clip();if (c) store.register(c);requestAnimationFrame(() => {timeline.fit();renderAll();});});
E.on('clipEdited', c => {if (c === clip()) {timeline.fit();renderAll();}});
applyHeight();renderAll();

// ---------- API pública (exportação, testes e integração) ----------
function manifest() {
  return {
    schemaVersion: 1, fps: ui.fps,
    eventTypes: EVENT_TYPES.map(({id, label}) => ({id, label})),
    clips: E.clips.map((c, clipIndex) => {
      const d = meta(c);
      return {clipIndex, clipName: c.name, id: d.id, duration: c.duration, derivedFrom: d.derivedFrom, edited: d.edits.length > 0, edits: d.edits,
        events: d.events.map(e => ({...e, frame: Math.round(e.time * ui.fps)})), rootMotion: d.rootMotion};
    }),
  };
}
// Antes de exportar, grava o quadro de cada evento (no fps de trabalho) nos metadados do próprio clip.
function beforeExport() {for (const c of E.clips) {const d = meta(c);d.fps = ui.fps;for (const e of d.events) e.frame = Math.round(e.time * ui.fps);}}
window.__studioEditor = {
  manifest, beforeExport, frameStep, openTool, history, store, timeline,
  setRange, trimToNew, trimHere, setSpeed, setDuration, loopClose, addEvent, updateEvent, removeEvent, applyRoot, analysis: () => clip() && analysis(clip()),
  undo: () => history.undo(), redo: () => history.redo(), get fps() {return ui.fps;}, set fps(v) {$('ed-fps').value = String(v);$('ed-fps').onchange();},
};
