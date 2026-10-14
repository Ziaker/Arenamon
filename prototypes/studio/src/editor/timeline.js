// Timeline em canvas: régua (segundos/quadros), trecho de corte, eventos, marcadores e chaves.
// Redesenha apenas quando algo muda (tempo, zoom, seleção, dados), não a cada quadro sem necessidade.
const LANES = [
  {id: 'ruler', label: '', h: 26},
  {id: 'range', label: 'Trecho', h: 24},
  {id: 'events', label: 'Eventos', h: 28},
  {id: 'markers', label: 'Marcadores', h: 20},
  {id: 'keys', label: 'Chaves', h: 18},
];
const GUTTER = 92;

export function createTimeline(canvas, api) {
  // api: duration(), time(), fps(), snap(), keyTimes(), events(), markers(), eventColor(type), selectedEvent(),
  //      onSeek(t, done), onRange(range), onEventPick(id), onEventMove(id, t, done), onEventAdd(t)
  const ctx = canvas.getContext('2d');
  const view = {pxPerSec: 200, offset: 0, range: null, dirty: true, width: 0, height: 0, lastTime: -1, hover: null, fitted: true};
  let drag = null;
  const lanes = () => {let y = 0;return LANES.map(l => {const r = {...l, y};y += l.h;return r;});};
  const laneAt = y => lanes().find(l => y >= l.y && y < l.y + l.h) || lanes().at(-1);
  const toX = t => GUTTER + (t - view.offset) * view.pxPerSec;
  const toT = x => view.offset + (x - GUTTER) / view.pxPerSec;
  const snap = t => {const f = api.fps();return api.snap() ? Math.round(t * f) / f : t;};
  const clampT = t => Math.max(0, Math.min(api.duration(), t));

  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {canvas.width = w;canvas.height = h;}
    view.width = r.width;view.height = r.height;view.dpr = dpr;view.dirty = true;
  }
  function fit() {
    const d = api.duration();if (!(d > 0) || !view.width) return;
    view.pxPerSec = Math.max(4, (view.width - GUTTER - 18) / d);view.offset = 0;view.dirty = true;view.fitted = true;
  }
  function zoom(factor, aroundX = GUTTER + (view.width - GUTTER) / 2) {
    view.fitted = false;const t = toT(aroundX);view.pxPerSec = Math.max(4, Math.min(6000, view.pxPerSec * factor));view.offset = t - (aroundX - GUTTER) / view.pxPerSec;clampOffset();view.dirty = true;
  }
  function clampOffset() {const visible = (view.width - GUTTER) / view.pxPerSec, d = api.duration();view.offset = Math.max(0, Math.min(view.offset, Math.max(0, d - visible * .9)));}
  function follow(t) {const visible = (view.width - GUTTER) / view.pxPerSec;if (t < view.offset || t > view.offset + visible) {view.offset = Math.max(0, t - visible * .1);clampOffset();view.dirty = true;}}

  function niceStep(minPx) {
    const fps = api.fps(), frame = 1 / fps, steps = [frame, 2 * frame, 5 * frame, .1, .25, .5, 1, 2, 5, 10, 30, 60];
    return steps.find(s => s * view.pxPerSec >= minPx) || 60;
  }
  function draw() {
    if (!view.width) resize();
    const W = view.width, H = view.height, dpr = view.dpr || 1, d = api.duration(), fps = api.fps(), now = api.time();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d1624';ctx.fillRect(0, 0, W, H);
    const L = lanes();
    ctx.font = '11px Inter, system-ui, sans-serif';ctx.textBaseline = 'middle';
    for (const l of L) {
      ctx.fillStyle = l.id === 'ruler' ? '#111d2f' : (L.indexOf(l) % 2 ? '#0f1a2a' : '#0d1726');ctx.fillRect(GUTTER, l.y, W - GUTTER, l.h);
      ctx.fillStyle = '#9fb3cc';if (l.label) ctx.fillText(l.label, 10, l.y + l.h / 2);
      ctx.fillStyle = '#ffffff10';ctx.fillRect(0, l.y + l.h - 1, W, 1);
    }
    ctx.fillStyle = '#ffffff14';ctx.fillRect(GUTTER - 1, 0, 1, H);
    if (!(d > 0)) {view.dirty = false;return;}
    // Área além do fim do clip.
    const endX = toX(d);if (endX < W) {ctx.fillStyle = '#05090f';ctx.fillRect(Math.max(GUTTER, endX), 0, W - Math.max(GUTTER, endX), H);}
    ctx.save();ctx.beginPath();ctx.rect(GUTTER, 0, W - GUTTER, H);ctx.clip();
    // Régua.
    const major = niceStep(70), minor = niceStep(9), ruler = L[0];
    ctx.fillStyle = '#ffffff22';
    for (let t = Math.floor(view.offset / minor) * minor; t <= Math.min(d, toT(W)) + 1e-9; t += minor) {const x = Math.round(toX(t)) + .5;ctx.fillRect(x, ruler.y + ruler.h - 6, 1, 6);}
    ctx.fillStyle = '#cfe0f5';
    for (let t = Math.floor(view.offset / major) * major; t <= Math.min(d, toT(W)) + 1e-9; t += major) {
      const x = Math.round(toX(t)) + .5;ctx.fillStyle = '#ffffff40';ctx.fillRect(x, ruler.y + 6, 1, ruler.h - 6);ctx.fillStyle = '#ffffff0d';ctx.fillRect(x, ruler.y + ruler.h, 1, H);
      ctx.fillStyle = '#cfe0f5';const frame = Math.round(t * fps);ctx.fillText(major < 1 / fps * 10 || major < .5 ? `${frame}` : `${t.toFixed(major < 1 ? 1 : 0)}s`, x + 4, ruler.y + 10);
    }
    // Trecho selecionado.
    const range = view.range;
    if (range) {
      const x0 = toX(range.start), x1 = toX(range.end);ctx.fillStyle = '#54d9ee1c';ctx.fillRect(x0, L[1].y, x1 - x0, H - L[1].y);
      ctx.fillStyle = '#54d9ee66';ctx.fillRect(x0, L[1].y + 3, x1 - x0, L[1].h - 6);
      ctx.fillStyle = '#54d9ee';for (const x of [x0, x1]) ctx.fillRect(x - 2, L[1].y, 4, H - L[1].y);
      ctx.fillStyle = '#04121a';ctx.fillText(`${(range.end - range.start).toFixed(3)} s · ${Math.round((range.end - range.start) * fps)} q`, x0 + 6, L[1].y + L[1].h / 2);
    }
    // Eventos.
    const ev = L[2], selected = api.selectedEvent(), list = api.events();
    for (let k = 0; k < list.length; k++) {const e = list[k], nextX = k + 1 < list.length ? toX(list[k + 1].time) : Infinity;
      const x = toX(e.time), y = ev.y + ev.h / 2, r = e.id === selected ? 8 : 6;
      ctx.fillStyle = api.eventColor(e.type);ctx.beginPath();ctx.moveTo(x, y - r);ctx.lineTo(x + r, y);ctx.lineTo(x, y + r);ctx.lineTo(x - r, y);ctx.closePath();ctx.fill();
      if (e.id === selected) {ctx.strokeStyle = '#ffffff';ctx.lineWidth = 2;ctx.stroke();}
      const label = e.label || '';if (label && ctx.measureText(label).width < nextX - x - r - 10) {ctx.fillStyle = '#d8e6f7';ctx.fillText(label, x + r + 3, y);}
    }
    // Marcadores (poses nomeadas da V4).
    const mk = L[3];for (const m of api.markers()) {const x = toX(m.time);ctx.fillStyle = '#bff36a';ctx.fillRect(x - 1, mk.y + 3, 2, mk.h - 6);if (view.pxPerSec > 160) {ctx.fillStyle = '#bff36abb';ctx.fillText(m.name, x + 4, mk.y + mk.h / 2);}}
    // Chaves.
    const kl = L[4];ctx.fillStyle = '#9b84ffaa';let lastX = -9;
    for (const t of api.keyTimes()) {const x = toX(t);if (x - lastX < 2) continue;lastX = x;ctx.fillRect(x - .5, kl.y + 4, 1.5, kl.h - 8);}
    // Cursor de tempo.
    const px = toX(now);ctx.fillStyle = '#ffd18c';ctx.fillRect(px - 1, 0, 2, H);ctx.beginPath();ctx.moveTo(px - 6, 0);ctx.lineTo(px + 6, 0);ctx.lineTo(px, 9);ctx.closePath();ctx.fill();
    if (view.hover != null) {ctx.fillStyle = '#ffffff30';ctx.fillRect(toX(view.hover), 0, 1, H);}
    ctx.restore();
    view.dirty = false;view.lastTime = now;
  }
  function update() {const t = api.time();if (t !== view.lastTime) {follow(t);view.dirty = true;}if (view.dirty) draw();}

  function eventAt(x) {let best = null, dist = 9;for (const e of api.events()) {const dx = Math.abs(toX(e.time) - x);if (dx < dist) {dist = dx;best = e;}}return best;}
  canvas.addEventListener('pointerdown', e => {
    if (!(api.duration() > 0)) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;if (x < GUTTER) return;
    const lane = laneAt(y), t = clampT(snap(toT(x)));canvas.setPointerCapture(e.pointerId);
    if (lane.id === 'range') {
      const rg = view.range;
      if (rg && Math.abs(toX(rg.start) - x) < 7) drag = {kind: 'range-start'};
      else if (rg && Math.abs(toX(rg.end) - x) < 7) drag = {kind: 'range-end'};
      else if (rg && t > rg.start && t < rg.end) drag = {kind: 'range-move', from: t, start: rg.start, end: rg.end};
      else {drag = {kind: 'range-new', anchor: t};view.range = null;}
    } else if (lane.id === 'events') {
      const hit = eventAt(x);if (hit) {api.onEventPick(hit.id);drag = {kind: 'event', id: hit.id, moved: false, origin: hit.time};} else drag = {kind: 'seek'};
    } else drag = {kind: 'seek'};
    if (drag.kind === 'seek') api.onSeek(t, false);
    view.dirty = true;draw();
  });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left;view.hover = x > GUTTER && api.duration() > 0 ? clampT(toT(x)) : null;
    if (!drag) {view.dirty = true;return;}
    const t = clampT(snap(toT(x))), rg = view.range;
    if (drag.kind === 'seek') api.onSeek(t, false);
    else if (drag.kind === 'range-new') {view.range = t === drag.anchor ? null : {start: Math.min(t, drag.anchor), end: Math.max(t, drag.anchor)};api.onRange(view.range);}
    else if (drag.kind === 'range-start' && rg) {view.range = {start: Math.min(t, rg.end - 1 / api.fps()), end: rg.end};api.onRange(view.range);}
    else if (drag.kind === 'range-end' && rg) {view.range = {start: rg.start, end: Math.max(t, rg.start + 1 / api.fps())};api.onRange(view.range);}
    else if (drag.kind === 'range-move') {const len = drag.end - drag.start;let s0 = snap(drag.start + t - drag.from);s0 = Math.max(0, Math.min(api.duration() - len, s0));view.range = {start: s0, end: s0 + len};api.onRange(view.range);}
    else if (drag.kind === 'event') {drag.moved = true;api.onEventMove(drag.id, t, false);}
    view.dirty = true;draw();
  });
  const end = e => {
    if (!drag) return;const r = canvas.getBoundingClientRect(), t = clampT(snap(toT(e.clientX - r.left)));
    if (drag.kind === 'event' && drag.moved) api.onEventMove(drag.id, t, true, drag.origin);
    if (drag.kind === 'seek') api.onSeek(t, true);
    drag = null;view.dirty = true;
  };
  canvas.addEventListener('pointerup', end);canvas.addEventListener('pointercancel', () => {drag = null;});
  canvas.addEventListener('pointerleave', () => {view.hover = null;view.dirty = true;});
  canvas.addEventListener('dblclick', e => {const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;if (laneAt(y).id === 'events' && x > GUTTER && !eventAt(x)) api.onEventAdd(clampT(snap(toT(x))));});
  canvas.addEventListener('wheel', e => {
    if (!(api.duration() > 0)) return;e.preventDefault();const r = canvas.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoom(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX - r.left);
    else {view.offset += (e.deltaX || e.deltaY) / view.pxPerSec;clampOffset();view.fitted = false;view.dirty = true;}
    draw();
  }, {passive: false});
  new ResizeObserver(() => {const fresh = !view.width;resize();if (fresh || view.fitted) fit();draw();}).observe(canvas);
  return {
    draw, update, fit, zoom, resize,
    get range() {return view.range;}, set range(r) {view.range = r;view.dirty = true;},
    invalidate() {view.dirty = true;},
  };
}
