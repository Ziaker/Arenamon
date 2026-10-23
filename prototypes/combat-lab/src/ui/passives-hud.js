// HUD das passivas na arena (§17): até 2 por lutador com ESTADO real do motor — pronta/permanente, efeito ativo
// (tempo restante), em cooldown (restaurando) e Sturdy consumida. Reusa as classes .mvp-* do moves-hud e foi
// desenhado para permanecer legível em 720p (textos curtos, contraste alto, sem dependência de cor só).
import {PASSIVE_BY_ID} from '../sim/passives.js';

const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

/** Estado de exibição de uma passiva no HUD. */
export function passiveHudState(f, id) {
  const st = f.passiveState;
  if (!st?.loadout?.includes(id)) return null;
  const def = PASSIVE_BY_ID[id];
  const cd = st.cooldowns[id] ?? 0;
  const active = st.actives.find(a => a.id === id);
  if (def.categoria === 'permanente') return {state: 'permanente', text: 'sempre ativa', progress: 1};
  if (id === 'sturdy') return st.sturdyUsed || !st.sturdyAvailable ? {state: 'consumida', text: 'usada nesta rodada', progress: 0} : {state: 'pronta', text: '1 uso disponível', progress: 1};
  if (active) return {state: 'ativa', text: `${Math.max(0, active.remaining).toFixed(1)} s`, progress: active.duration > 0 ? active.remaining / active.duration : 0};
  if (cd > 1e-9) return {state: 'recarga', text: `${cd.toFixed(1)} s`, progress: 0};
  return {state: 'pronta', text: 'pronta', progress: 1};
}
const STATE_COLOR = {permanente: '#b8ef6c', ativa: '#59d6e6', pronta: '#b8ef6c', recarga: '#9bb0c3', consumida: '#ff9a8a'};

export class PassivesHud {
  constructor(root) {this.root = root;this.last = '';this.toastUntil = 0;this.toastText = '';}
  /** Toast branco curto ao ativar passiva (§16). */
  toast(text) {this.toastText = text;this.toastUntil = performance.now() + 1400;}
  render(game, visible = true) {
    const now = performance.now();
    const rows = [];
    for (const f of game.fighters) {
      const st = f.passiveState;
      if (!st?.loadout?.length) continue;
      const cells = st.loadout;
      const row = cells.map(id => {
        const def = PASSIVE_BY_ID[id];
        const s = passiveHudState(f, id);
        if (!def || !s) return '';
        return `<div class="mvp-slot pvh" data-state="${s.state}" style="--p:${Math.max(0, Math.min(1, s.progress)).toFixed(3)};--c:${STATE_COLOR[s.state]}"><b>${escape(def.nome)}</b><span>${escape(s.text)}</span><i></i></div>`;
      }).join('');
      rows.push(`<div class="mvp-row" data-fighter="${f.id}"><em>${f.id ? 'Vermelho' : 'Azul'}</em>${row}</div>`);
    }
    const toast = now < this.toastUntil ? `<div class="pvh-toast">${escape(this.toastText)}</div>` : '';
    const html = visible ? rows.join('') + toast : '';
    if (html !== this.last) {this.last = html;this.root.innerHTML = html;}
    this.root.hidden = !html;
  }
}
