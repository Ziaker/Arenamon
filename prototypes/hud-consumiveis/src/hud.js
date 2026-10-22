// Três propostas de HUD para os CINCO atributos evolutivos (estágios 0–4). Somente leitura de um estado
// demonstrativo: não há HP, stamina atual, cooldown de golpe nem qualquer regra de combate aqui.
import {ATTRS, MAX_STAGE, symbolSvg} from './data.js';

const STAGES = [1, 2, 3, 4];
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs = {}) => {
  const el = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
const pentagon = (cx, cy, r) => ATTRS.map((_, i) => {
  const a = (-90 + 72 * i) * Math.PI / 180;
  return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
}).join(' ');

export class HudManager {
  /** root: contêiner da sobreposição; cada proposta fica em seu próprio elemento (troca instantânea). */
  constructor(root) {
    this.root = root;
    this.stages = Object.fromEntries(ATTRS.map(a => [a.key, 0]));
    this.current = 'A';
    this.visible = true;
    this.scale = 1;
    this.shown = {}; // para animar apenas ganhos
    this.radar = {disp: ATTRS.map(() => 0)};
    this.huds = {A: this._buildA(), B: this._buildB(), C: this._buildC()};
    for (const id of Object.keys(this.huds)) root.appendChild(this.huds[id].el);
    this.show('A');
    this.renderAll(true);
  }

  // ---------- A · Banco de Células ----------
  _buildA() {
    const el = document.createElement('div');
    el.className = 'hud hud-a';
    el.dataset.hud = 'A';
    el.innerHTML = ATTRS.map(a => `
      <div class="ha-cell" data-attr="${a.key}" style="--c:${a.color}">
        <div class="ha-icon">${symbolSvg(a.key, {size: 26, stroke: 2.2})}</div>
        <div class="ha-tube">${[...STAGES].reverse().map(n => `<i class="seg" data-n="${n}"></i>`).join('')}</div>
        <div class="ha-val">+0%</div>
        <div class="ha-name">${a.short}<small>0/4</small></div>
      </div>`).join('');
    return {el};
  }

  // ---------- B · Radar Pentagonal ----------
  _buildB() {
    const W = 372, H = 262, cx = 186, cy = 138, R = 92, Rb = R + 30;
    const el = document.createElement('div');
    el.className = 'hud hud-b';
    el.dataset.hud = 'B';
    el.style.width = W + 'px'; el.style.height = H + 'px';
    const svg = svgEl('svg', {viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'hb-svg'});
    for (let k = 1; k <= MAX_STAGE; k++) svg.appendChild(svgEl('polygon', {points: pentagon(cx, cy, R * k / MAX_STAGE), class: 'hb-ring' + (k === MAX_STAGE ? ' outer' : '')}));
    ATTRS.forEach((a, i) => {
      const ang = (-90 + 72 * i) * Math.PI / 180;
      svg.appendChild(svgEl('line', {x1: cx, y1: cy, x2: cx + R * Math.cos(ang), y2: cy + R * Math.sin(ang), class: 'hb-spoke'}));
    });
    const area = svgEl('polygon', {class: 'hb-area', points: pentagon(cx, cy, 0.001)});
    const outline = svgEl('polygon', {class: 'hb-outline', points: pentagon(cx, cy, 0.001)});
    svg.appendChild(area); svg.appendChild(outline);
    const dots = [];
    ATTRS.forEach((a, i) => {
      const ang = (-90 + 72 * i) * Math.PI / 180;
      dots.push(STAGES.map(n => {
        const x = cx + R * n / MAX_STAGE * Math.cos(ang), y = cy + R * n / MAX_STAGE * Math.sin(ang);
        const d = svgEl(n === MAX_STAGE ? 'rect' : 'circle', n === MAX_STAGE
          ? {x: x - 4.6, y: y - 4.6, width: 9.2, height: 9.2, class: 'hb-dot diamond'}
          : {cx: x, cy: y, r: 3.6, class: 'hb-dot'});
        d.style.setProperty('--c', a.color);
        svg.appendChild(d);
        return {el: d, x, y};
      }));
    });
    svg.appendChild(svgEl('circle', {cx, cy, r: 2.2, class: 'hb-center'}));
    el.appendChild(svg);
    const chips = ATTRS.map((a, i) => {
      const ang = (-90 + 72 * i) * Math.PI / 180;
      const chip = document.createElement('div');
      chip.className = 'hb-chip';
      chip.dataset.attr = a.key;
      chip.style.setProperty('--c', a.color);
      chip.style.left = (cx + Rb * Math.cos(ang)) + 'px';
      chip.style.top = (cy + Rb * Math.sin(ang) * (i === 0 ? 0.92 : 0.98) - (i === 0 ? 4 : 0)) + 'px';
      chip.innerHTML = `<span class="hb-ico">${symbolSvg(a.key, {size: 19, stroke: 2.3})}</span><span class="hb-txt"><b>${a.short}</b><em>+0%</em><small>0/4</small></span><span class="hb-ripple"></span>`;
      el.appendChild(chip);
      return chip;
    });
    return {el, svg, area, outline, dots, chips, cx, cy, R};
  }

  // ---------- C · Faixa de Gemas ----------
  _buildC() {
    const el = document.createElement('div');
    el.className = 'hud hud-c';
    el.dataset.hud = 'C';
    el.innerHTML = ATTRS.map(a => `
      <div class="hc-card" data-attr="${a.key}" style="--c:${a.color}">
        <div class="hc-head"><span class="hc-ico">${symbolSvg(a.key, {size: 18, stroke: 2.4})}</span><span class="hc-label">${a.short}</span><span class="hc-count">0/4</span></div>
        <div class="hc-val">+0%</div>
        <div class="hc-gems">${STAGES.map(n => `<i class="gem" data-n="${n}"></i>`).join('')}</div>
      </div>`).join('');
    return {el};
  }

  // ---------- API ----------
  show(id) {
    this.current = id;
    for (const [k, h] of Object.entries(this.huds)) h.el.hidden = k !== id;
    this.root.dataset.hud = id;
  }
  setVisible(v) { this.visible = !!v; this.root.hidden = !this.visible; }
  setScale(s) { this.scale = s; this.root.style.setProperty('--hud-scale', s); }
  setStage(key, n) { this.stages[key] = Math.max(0, Math.min(MAX_STAGE, Math.round(n))); this.renderAll(); }
  setAll(n) { for (const a of ATTRS) this.stages[a.key] = n; this.renderAll(); }

  renderAll(first = false) {
    const gained = [];
    ATTRS.forEach((a, i) => {
      const s = this.stages[a.key], prev = this.shown[a.key] ?? 0;
      if (!first && s > prev) gained.push({key: a.key, i, s});
      this.shown[a.key] = s;
      this._renderA(a, s); this._renderC(a, s); this._renderB(a, i, s);
    });
    for (const g of gained) this._pulse(g);
  }

  _renderA(a, s) {
    const cell = this.huds.A.el.querySelector(`[data-attr="${a.key}"]`);
    cell.dataset.stage = s;
    cell.classList.toggle('max', s === MAX_STAGE);
    cell.classList.toggle('zero', s === 0);
    cell.querySelectorAll('.seg').forEach(seg => seg.classList.toggle('on', +seg.dataset.n <= s));
    cell.querySelector('.ha-val').textContent = a.fmt(s);
    cell.querySelector('small').textContent = s === MAX_STAGE ? 'MAX' : `${s}/${MAX_STAGE}`;
  }
  _renderC(a, s) {
    const card = this.huds.C.el.querySelector(`[data-attr="${a.key}"]`);
    card.dataset.stage = s;
    card.classList.toggle('max', s === MAX_STAGE);
    card.classList.toggle('zero', s === 0);
    card.querySelectorAll('.gem').forEach(g => g.classList.toggle('on', +g.dataset.n <= s));
    card.querySelector('.hc-val').textContent = a.fmt(s);
    card.querySelector('.hc-count').textContent = s === MAX_STAGE ? 'MAX' : `${s}/${MAX_STAGE}`;
  }
  _renderB(a, i, s) {
    const b = this.huds.B;
    const chip = b.chips[i];
    chip.dataset.stage = s;
    chip.classList.toggle('max', s === MAX_STAGE);
    chip.classList.toggle('zero', s === 0);
    chip.querySelector('em').textContent = a.fmt(s);
    chip.querySelector('small').textContent = s === MAX_STAGE ? 'MAX' : `${s}/${MAX_STAGE}`;
    b.dots[i].forEach((d, n) => {
      d.el.classList.toggle('on', n + 1 <= s);
      if (n + 1 > s) d.el.classList.remove('pop');
    });
  }
  _pulse({key, i, s}) {
    const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    const a = this.huds.A.el.querySelector(`[data-attr="${key}"]`);
    restart(a, 'gain');
    a.querySelectorAll('.seg.new').forEach(e => e.classList.remove('new'));
    restart(a.querySelector(`.seg[data-n="${s}"]`), 'new');
    const c = this.huds.C.el.querySelector(`[data-attr="${key}"]`);
    restart(c, 'gain');
    restart(c.querySelector(`.gem[data-n="${s}"]`), 'new');
    const chip = this.huds.B.chips[i];
    restart(chip, 'gain');
    restart(chip.querySelector('.hb-ripple'), 'go');
    const dot = this.huds.B.dots[i][s - 1].el;
    dot.classList.remove('pop'); void dot.getBoundingClientRect(); dot.classList.add('pop');
  }

  /** Interpola o polígono do radar (chamado a cada quadro). */
  tick(dt) {
    const b = this.huds.B;
    const k = 1 - Math.exp(-dt * 9);
    let moving = false;
    ATTRS.forEach((a, i) => {
      const target = this.stages[a.key] / MAX_STAGE;
      const d = this.radar.disp[i];
      const nd = Math.abs(target - d) < 0.002 ? target : d + (target - d) * k;
      if (nd !== d) moving = true;
      this.radar.disp[i] = nd;
    });
    if (!moving && b.drawn) return;
    const pts = ATTRS.map((_, i) => {
      const ang = (-90 + 72 * i) * Math.PI / 180, r = b.R * this.radar.disp[i];
      return `${(b.cx + r * Math.cos(ang)).toFixed(2)},${(b.cy + r * Math.sin(ang)).toFixed(2)}`;
    }).join(' ');
    b.area.setAttribute('points', pts); b.outline.setAttribute('points', pts);
    b.drawn = true;
  }
}
