// Gráficos do gravador de movimento: pequenos múltiplos em canvas com o mesmo eixo de tempo (um eixo Y por gráfico,
// nunca dois), linhas de 2 px, legenda, marcadores de eventos e camada de hover (cruz + tooltip) em todos.
// Cores: paleta categórica de referência (modo escuro, slots 1–2 para A/B; validada para pares adjacentes).
export const SERIES = ['#3987e5', '#d95926', '#199e70'];
const INK = {primary: '#eef5fb', secondary: '#9bb0c3', grid: '#ffffff14', axis: '#ffffff33', marker: '#ffffff40', surface: '#0f1a26'};
/** Bandas de estado (categórico, slots 3–8 da referência escura; texto sempre em tinta neutra). */
const STATE_COLORS = {dodge: '#199e70', tackle: '#d95926', sprint: '#c98500', recoil: '#9085e9', guard: '#d55181', locomotion: '#3987e5', idle: '#ffffff22', other: '#ffffff44'};
const MARKER_SHORT = {reverse: 'inv', zero: 'v=0', dodgeStart: 'C▶', dodgeEnd: 'C■', tackleStart: 'X▶', tackleEnd: 'X■', sprintStart: 'S▶', sprintEnd: 'S■', collision: '✕', interrupt: '!', denied: '⊘', recoilStart: 'R▶', recoilEnd: 'R■'};
export const MARKER_TYPES = Object.keys(MARKER_SHORT);

/**
 * runs: [{name, result}] (result de runSequence). panels: [{id, label, unit, value(sample)}].
 * Desenha em `root` um canvas por painel + faixa de estados; devolve {destroy}.
 */
export function renderCharts(root, runs, panels, {markers = new Set(MARKER_TYPES), step = 1 / 120} = {}) {
  root.replaceChildren();
  const legend = document.createElement('div');legend.className = 'chart-legend';
  legend.innerHTML = runs.map((r, i) => `<span><i style="background:${SERIES[i]}"></i>${escapeHtml(r.name)}</span>`).join('') + '<span class="muted">Marcadores: inv = comando de inversão · v=0 = velocidade passa por zero · C/X/S ▶■ = início/fim de esquiva, tackle e sprint · ✕ colisão · ! interrupção · ⊘ comando negado</span>';
  root.append(legend);
  const tMax = Math.max(...runs.map(r => r.result.samples.length)) * step;
  const tip = document.createElement('div');tip.className = 'chart-tip';tip.hidden = true;root.append(tip);
  const charts = [];
  for (const panel of panels) {
    const box = document.createElement('figure');box.className = 'chart';box.dataset.panel = panel.id;
    const cap = document.createElement('figcaption');cap.textContent = `${panel.label}${panel.unit ? ` (${panel.unit})` : ''}`;
    const cv = document.createElement('canvas');cv.height = 150;box.append(cap, cv);root.append(box);
    const ys = runs.flatMap(r => r.result.samples.map(panel.value)).filter(Number.isFinite);
    let lo = Math.min(0, ...ys), hi = Math.max(...ys, 1e-6);if (hi - lo < 1e-6) hi = lo + 1;const pad = (hi - lo) * .08;lo -= lo < 0 ? pad : 0;hi += pad;
    charts.push({panel, cv, lo, hi});
  }
  // Faixa de estados (base das animações): uma linha por execução.
  const band = document.createElement('figure');band.className = 'chart band';const bcap = document.createElement('figcaption');bcap.textContent = 'Estados ao longo do tempo (ação, sprint, locomoção)';
  const bcv = document.createElement('canvas');bcv.height = 26 * runs.length + 18;band.append(bcap, bcv);root.append(band);
  const keys = document.createElement('div');keys.className = 'chart-legend';keys.innerHTML = Object.entries({dodge: 'esquiva (C)', tackle: 'tackle (X)', sprint: 'sprint', recoil: 'recuo', guard: 'defesa', locomotion: 'andando', idle: 'parado'}).map(([k, l]) => `<span><i style="background:${STATE_COLORS[k]}"></i>${l}</span>`).join('');band.append(keys);

  const L = 46, R = 10, T = 8, B = 20;
  const xOf = (t, w) => L + (w - L - R) * (t / Math.max(1e-6, tMax));
  let hoverT = null;
  function draw() {
    for (const c of charts) {
      const cv = c.cv, w = cv.width = cv.clientWidth * devicePixelRatio, h = cv.height = 150 * devicePixelRatio, g = cv.getContext('2d'), s = devicePixelRatio;g.clearRect(0, 0, w, h);
      const yOf = v => T * s + (h - (T + B) * s) * (1 - (v - c.lo) / (c.hi - c.lo));
      g.font = `${11 * s}px Inter, system-ui, sans-serif`;g.fillStyle = INK.secondary;g.strokeStyle = INK.grid;g.lineWidth = s;
      for (let i = 0; i <= 4; i++) {const v = c.lo + (c.hi - c.lo) * i / 4, y = yOf(v);g.beginPath();g.moveTo(L * s, y);g.lineTo(w - R * s, y);g.stroke();g.fillText(fmtNum(v), 4 * s, y + 4 * s);}
      for (let t = 0; t <= tMax + 1e-9; t += tMax > 8 ? 2 : tMax > 3 ? 1 : .5) {const x = xOf(t, w / s) * s;g.fillText(`${t.toFixed(t % 1 ? 1 : 0)} s`, x - 8 * s, h - 5 * s);}
      if (c.lo < 0 && c.hi > 0) {g.strokeStyle = INK.axis;g.beginPath();g.moveTo(L * s, yOf(0));g.lineTo(w - R * s, yOf(0));g.stroke();}
      // Marcadores (da primeira execução e das demais, se diferirem).
      // Rótulos só da primeira execução, em três linhas alternadas (marcadores próximos não se sobrepõem);
      // as demais execuções mostram só a linha tracejada na própria cor.
      runs.forEach((r, i) => {
        let k = 0;
        for (const m of r.result.markers) {
          if (!markers.has(m.type)) continue;const x = xOf(m.t, w / s) * s;
          g.strokeStyle = i ? SERIES[i] + '55' : INK.marker;g.setLineDash([3 * s, 3 * s]);g.beginPath();g.moveTo(x, T * s);g.lineTo(x, h - B * s);g.stroke();g.setLineDash([]);
          if (!i) {g.fillStyle = INK.secondary;g.fillText(MARKER_SHORT[m.type] ?? m.type, x + 2 * s, (T + 10 + 11 * (k++ % 3)) * s);}
        }
      });
      runs.forEach((r, i) => {
        g.strokeStyle = SERIES[i];g.lineWidth = 2 * s;g.beginPath();let first = true;
        for (const smp of r.result.samples) {const v = c.panel.value(smp);if (!Number.isFinite(v)) {first = true;continue;}const x = xOf(smp.t, w / s) * s, y = yOf(v);if (first) {g.moveTo(x, y);first = false;} else g.lineTo(x, y);}
        g.stroke();g.lineWidth = s;
      });
      if (hoverT !== null) {const x = xOf(hoverT, w / s) * s;g.strokeStyle = INK.axis;g.beginPath();g.moveTo(x, T * s);g.lineTo(x, h - B * s);g.stroke();
        runs.forEach((r, i) => {const smp = r.result.samples[Math.round(hoverT / step)];if (!smp) return;const v = c.panel.value(smp);if (!Number.isFinite(v)) return;g.fillStyle = INK.surface;g.beginPath();g.arc(x, yOf(v), 5 * s, 0, 7);g.fill();g.fillStyle = SERIES[i];g.beginPath();g.arc(x, yOf(v), 4 * s, 0, 7);g.fill();});}
    }
    // Faixa de estados.
    const w = bcv.width = bcv.clientWidth * devicePixelRatio, s = devicePixelRatio, h = bcv.height = (26 * runs.length + 18) * s, g = bcv.getContext('2d');g.clearRect(0, 0, w, h);g.font = `${11 * s}px Inter, system-ui, sans-serif`;
    runs.forEach((r, i) => {
      const y = (4 + 26 * i) * s;g.fillStyle = INK.secondary;g.fillText(r.name.slice(0, 6), 2 * s, y + 14 * s);
      for (const smp of r.result.samples) {const k = smp.action ?? (smp.sprint ? 'sprint' : smp.state === 'guard' || smp.state === 'guardStun' ? 'guard' : smp.speed > .15 ? 'locomotion' : 'idle');g.fillStyle = STATE_COLORS[k] ?? STATE_COLORS.other;const x0 = xOf(smp.t, w / s) * s, x1 = xOf(smp.t + step, w / s) * s;g.fillRect(x0, y, Math.max(1, x1 - x0 + .5), 18 * s);}
    });
    if (hoverT !== null) {const x = xOf(hoverT, w / s) * s;g.strokeStyle = INK.primary;g.beginPath();g.moveTo(x, 0);g.lineTo(x, h);g.stroke();}
  }
  function hover(e) {
    const cv = e.currentTarget, r = cv.getBoundingClientRect(), t = (e.clientX - r.left - L) / Math.max(1, r.width - L - R) * tMax;
    if (t < 0 || t > tMax) {leave();return;}hoverT = Math.round(t / step) * step;draw();
    const rows = runs.map((run, i) => {const smp = run.result.samples[Math.round(hoverT / step)];if (!smp) return '';return `<tr><td><i style="background:${SERIES[i]}"></i>${escapeHtml(run.name)}</td>${charts.map(c => `<td>${fmtNum(c.panel.value(smp))}</td>`).join('')}<td>${escapeHtml(smp.action ?? (smp.sprint ? 'sprint' : smp.state))}</td></tr>`;}).join('');
    tip.innerHTML = `<b>${hoverT.toFixed(3)} s</b><table><tr><th></th>${charts.map(c => `<th>${escapeHtml(c.panel.short ?? c.panel.label)}</th>`).join('')}<th>estado</th></tr>${rows}</table>`;
    tip.hidden = false;const rr = root.getBoundingClientRect();tip.style.left = Math.min(rr.width - 300, e.clientX - rr.left + 14) + 'px';tip.style.top = (e.clientY - rr.top + root.scrollTop + 14) + 'px';
  }
  function leave() {hoverT = null;tip.hidden = true;draw();}
  for (const c of [...charts.map(c => c.cv), bcv]) {c.addEventListener('pointermove', hover);c.addEventListener('pointerleave', leave);}
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => draw()) : null;ro?.observe(root);
  draw();
  return {draw, destroy: () => ro?.disconnect()};
}
const fmtNum = v => !Number.isFinite(v) ? '—' : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

/** Painéis padrão do gravador. */
export const MOVEMENT_PANELS = [
  {id: 'speed', label: 'Velocidade × tempo', short: 'v', unit: 'm/s', value: s => s.speed},
  {id: 'accel', label: 'Aceleração × tempo', short: 'a', unit: 'm/s²', value: s => s.accel},
  {id: 'x', label: 'Posição X × tempo', short: 'x', unit: 'm', value: s => s.x},
  {id: 'z', label: 'Posição Z × tempo', short: 'z', unit: 'm', value: s => s.z},
  {id: 'dist', label: 'Distância acumulada', short: 'dist', unit: 'm', value: s => s.dist},
  {id: 'stamina', label: 'Stamina', short: 'sta', unit: '', value: s => s.stamina},
];
