// Doca inferior: transporte (pausa, passo a passo, câmera lenta, ao vivo), linha do tempo da telemetria,
// registro de golpes com vantagem de quadros e tabela de quadros nominais.
import {C} from '../sim/config.js';
import {frameTable, ms} from '../sim/telemetry.js';
import {STATE_NAMES, RESULT_NAMES} from './hud.js';
import {escape} from './tuning.js';

const $ = id => document.getElementById(id);
const STATE_COLORS = {neutral: '#3b5368', moving: '#4f7290', guard: '#c9a640', guardStun: '#d68a3a', dodge: '#3fb88f', tackle: '#e58a2e', recoil: '#9b6ad6', airborne: '#7d93d9', landing: '#5d6f92', pushed: '#8a5c5c', defeated: '#2c343b'};
const RESULT_COLORS = {impact: '#ffb361', clash: '#ffe58d', partial: '#73caff', perfect: '#9dffd2', perfectDodge: '#9dffd2', invulnerable: '#c3d7ff'};
const GUTTER = 84;

export function createDock({recorder, getCursorTick, onSeek, studioWindowsFor}) {
  const canvas = $('timeline'), ctx = canvas.getContext('2d');let view = 'timeline', dirty = true, lastKey = '';
  for (const b of document.querySelectorAll('[data-dock]')) b.onclick = () => {view = b.dataset.dock;for (const x of document.querySelectorAll('[data-dock]')) x.setAttribute('aria-pressed', String(x === b));
    canvas.hidden = view !== 'timeline';$('hit-log').hidden = view !== 'hits';$('frame-table').hidden = view !== 'frames';dirty = true;render(true);};
  function layout() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) {canvas.width = Math.round(r.width * dpr);canvas.height = Math.round(r.height * dpr);}
    return {w: r.width, h: r.height, dpr};
  }
  const window_ = () => {const s = recorder.samples;if (!s.length) return null;const end = s.at(-1).tick, start = Math.max(s[0].tick, end - Math.round(6 / C.test.step));return {start, end};};
  function timeline() {
    const {w, h, dpr} = layout();if (!w || !h) return;ctx.setTransform(dpr, 0, 0, dpr, 0, 0);ctx.clearRect(0, 0, w, h);ctx.fillStyle = '#0b131c';ctx.fillRect(0, 0, w, h);
    const win = window_();ctx.font = '11px system-ui, sans-serif';ctx.textBaseline = 'middle';
    if (!win) {ctx.fillStyle = '#9bb0c3';ctx.fillText('Inicie um combate ou um cenário para ver a linha do tempo.', 12, h / 2);return;}
    const span = Math.max(1, win.end - win.start), x = t => GUTTER + (t - win.start) / span * (w - GUTTER - 8);
    const studio = [0, 1].map(id => studioWindowsFor?.(id));
    const lanes = [];for (const id of [0, 1]) {lanes.push({id, kind: 'state', label: id ? 'Vermelho' : 'Azul'});lanes.push({id, kind: 'stamina', label: 'stamina'});if (studio[id]) lanes.push({id, kind: 'studio', label: 'Studio'});}
    const lh = Math.max(12, (h - 16) / lanes.length);let y = 4;
    for (const lane of lanes) {
      lane.y = y;lane.h = lane.kind === 'state' ? lh * 1.25 : lh * .85;y += lane.h + 2;
      ctx.fillStyle = '#9bb0c3';ctx.fillText(lane.label, 8, lane.y + lane.h / 2);ctx.fillStyle = '#ffffff08';ctx.fillRect(GUTTER, lane.y, w - GUTTER, lane.h);
    }
    const samples = recorder.samples.filter(s => s.tick >= win.start);
    for (const lane of lanes) {
      if (lane.kind === 'state') {
        for (let i = 0; i < samples.length; i++) {const s = samples[i], f = s.f[lane.id], x0 = x(s.tick - 1), x1 = x(s.tick);ctx.fillStyle = STATE_COLORS[f.state] || '#555';ctx.fillRect(x0, lane.y, Math.max(1, x1 - x0 + .5), lane.h);
          if (f.invulnerable) {ctx.fillStyle = '#58e6ffcc';ctx.fillRect(x0, lane.y, Math.max(1, x1 - x0 + .5), 4);}
          if (f.perfect) {ctx.fillStyle = '#9dffd2';ctx.fillRect(x0, lane.y + lane.h - 3, Math.max(1, x1 - x0 + .5), 3);}
          if (s.hitstop) {ctx.fillStyle = '#ffffff40';ctx.fillRect(x0, lane.y, Math.max(1, x1 - x0 + .5), lane.h);}}
      } else if (lane.kind === 'stamina') {
        ctx.strokeStyle = lane.id ? '#ff9b8f' : '#8fc4ff';ctx.lineWidth = 1.5;ctx.beginPath();
        samples.forEach((s, i) => {const v = s.f[lane.id].stamina / C.rules.staminaMax, px = x(s.tick), py = lane.y + lane.h - v * (lane.h - 2) - 1;i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);});ctx.stroke();
      } else if (lane.kind === 'studio') {
        // Janelas do Studio desenhadas sobre cada tackle/esquiva real, para comparar com a faixa do estado.
        for (const a of recorder.actions.filter(a => a.fighter === lane.id && a.kind !== 'recoil' && (a.end ?? win.end) >= win.start)) {
          const st = a.kind === 'tackle' ? studio[lane.id].tackle : studio[lane.id].dodge;if (!st) continue;
          const steps = s => a.start + s / C.test.step;
          if (st.hitbox) {ctx.fillStyle = '#ff5f6dcc';ctx.fillRect(x(steps(st.hitbox[0])), lane.y + 1, Math.max(2, x(steps(st.hitbox[1])) - x(steps(st.hitbox[0]))), lane.h / 2 - 1);}
          if (st.invulnerable) {ctx.fillStyle = '#58e6ffcc';ctx.fillRect(x(steps(st.invulnerable[0])), lane.y + lane.h / 2, Math.max(2, x(steps(st.invulnerable[1])) - x(steps(st.invulnerable[0]))), lane.h / 2 - 1);}
          if (st.impact != null) {ctx.fillStyle = '#fff06a';ctx.fillRect(x(steps(st.impact)) - 1, lane.y, 2, lane.h);}
        }
      }
    }
    for (const hit of recorder.hits.filter(hh => hh.tick >= win.start)) {
      const lane = lanes.find(l => l.id === hit.target && l.kind === 'state');if (!lane) continue;const px = x(hit.tick);
      ctx.fillStyle = RESULT_COLORS[hit.result] || '#fff';ctx.beginPath();ctx.moveTo(px, lane.y - 2);ctx.lineTo(px + 5, lane.y + 5);ctx.lineTo(px - 5, lane.y + 5);ctx.fill();
    }
    // Régua em segundos e cursor (posição do replay).
    ctx.fillStyle = '#ffffff30';for (let t = Math.ceil(win.start * C.test.step * 2) / 2; t <= win.end * C.test.step; t += .5) {const px = x(t / C.test.step);ctx.fillRect(px, h - 10, 1, 8);ctx.fillStyle = '#9bb0c399';ctx.fillText(`${t.toFixed(1)}s`, px + 3, h - 6);ctx.fillStyle = '#ffffff30';}
    const cur = getCursorTick();if (cur != null && cur >= win.start) {const px = x(cur);ctx.fillStyle = '#ffcf7d';ctx.fillRect(px - 1, 0, 2, h);}
    canvas.dataset.start = win.start;canvas.dataset.span = span;
  }
  function hitLog() {
    const rows = recorder.hits.slice(-60).reverse();
    $('hit-log').innerHTML = rows.length ? `<table><tr><th>Passo</th><th>Resultado</th><th>Atacante → alvo</th><th>Dano</th><th>Contato na ação</th><th>Livre p/ agir (atac./alvo)</th><th>Vantagem p/ agir</th><th>Livre p/ mover</th><th>Vantagem p/ mover</th><th>Lançamento</th></tr>${rows.map(h => {
      const who = id => id === 0 ? 'Azul' : 'Vermelho', adv = v => v == null ? '…' : `<b class="${v > 0 ? 'ok' : v < 0 ? 'bad' : ''}">${v > 0 ? '+' : ''}${v}</b> (${ms(v).toFixed(0)} ms)`;
      return `<tr><td>${h.tick}</td><td>${escape(RESULT_NAMES[h.result] || h.result)}</td><td>${who(h.attacker)} → ${who(h.target)}</td><td>${h.damage}</td><td>${h.actionTick == null ? '—' : `${h.actionTick + 1}º passo (${ms(h.actionTick + 1).toFixed(0)} ms)`}</td><td>${h.attackerFree ?? '…'} / ${h.targetFree ?? '…'}</td><td>${adv(h.advantage)}</td><td>${h.attackerMove ?? '…'} / ${h.targetMove ?? '…'}</td><td>${adv(h.moveAdvantage)}</td><td>${h.launch ? `${h.launch.horizontal.toFixed(2)} m/s · ↑${h.launch.vertical.toFixed(1)}` : '—'}</td></tr>`;
    }).join('')}</table><p class="hint">Vantagem = passos que o alvo leva para ficar livre menos os do atacante (positivo favorece o atacante). 1 passo = ${ms(1).toFixed(2)} ms. “Agir” segue a regra de cancelamento do jogo (recuo e guard stun são canceláveis); “mover” exige estar sem ação e sem guard stun.</p>` : '<p class="hint">Nenhum golpe registrado ainda.</p>';
  }
  function frames() {
    const rows = frameTable();
    $('frame-table').innerHTML = `<table><tr><th>Ação</th><th>Total (passos)</th><th>ms</th><th>Ativo</th><th>Invulnerável</th><th>Cancelável</th><th>Stamina</th></tr>${rows.map(r => `<tr><td>${escape(r.action)}</td><td>${r.total}</td><td>${ms(r.total).toFixed(0)}</td><td>${r.active}</td><td>${r.invulnerable}</td><td>${escape(r.cancel)}</td><td>${r.cost || '—'}</td></tr>`).join('')}</table><p class="hint">Valores nominais calculados a partir dos ajustes atuais (passo de ${ms(1).toFixed(2)} ms). Os tempos reais de cada golpe aparecem em “Golpes”.</p>`;
  }
  function render(force = false) {
    const key = `${view}:${recorder.samples.at(-1)?.tick}:${getCursorTick()}:${recorder.hits.length}:${recorder.hits.at(-1)?.advantage}:${recorder.hits.at(-1)?.moveAdvantage}`;
    if (!force && !dirty && key === lastKey) return;lastKey = key;dirty = false;
    if (view === 'timeline') timeline();else if (view === 'hits') hitLog();else frames();
  }
  canvas.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, start = Number(canvas.dataset.start), span = Number(canvas.dataset.span);
    if (px < GUTTER || !span) return;onSeek(Math.round(start + (px - GUTTER) / (r.width - GUTTER - 8) * span));
  });
  new ResizeObserver(() => {dirty = true;render(true);}).observe(canvas);
  return {render, invalidate() {dirty = true;}};
}
