// HUD dos slots de movimento na arena (M16.7, M28.5): para cada lutador com movimentos equipados mostra tecla, nome e o ESTADO real —
// pronto, carregando (com % e PL), em recarga, em recuperação ou bloqueado, com o motivo do próprio motor. O estado vem de
// sim/move-state.js (as mesmas permissões do controlador), então a tela nunca promete o que o motor negaria.
import {C, keyFor} from '../sim/config.js';
import {slotStatuses} from '../sim/move-state.js';
import {fighterColorHex, fighterColorLabel} from './fighter-identity.js';
/** Escapa texto para HTML (local: importar o ajustador arrastaria o config.ts do jogo, que só o esbuild lê). */
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export const PL_COLORS = ['#7d8ea0', '#59d6e6', '#ffcf6a', '#ff6adf'];
const SKILL_NAMES = ['skill1', 'skill2', 'skill3', 'skill4'];
const keyLabel = code => String(code ?? '?').replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
/** Tecla do slot do lutador (jogador: bindings; vermelho manual: bindings2). */
const keyOf = (id, slot) => {const b = id ? C.extras.bindings2 : C.extras.bindings;return keyLabel(C.extras.keyCodes[b[SKILL_NAMES[slot]]]);};

export class MovesHud {
  constructor(root) {this.root = root;this.last = '';this.boost = null;void keyFor;}
  /** Flash de "recarga acelerada" no slot do Move que recebeu o novo toque (evento cooldownBoost). */
  flashBoost(fighter, slot) {
    if (slot == null) return;
    this.boost = {fighter: Number(fighter ?? 0), slot: Number(slot), until: performance.now() + 760};
    this.last = '';   // força redesenho: o atributo data-boost precisa entrar agora
  }
  render(game, visible = true) {
    const rows = [];
    const boost = this.boost && performance.now() < this.boost.until ? this.boost : (this.boost = null);
    const fc = id => fighterColorHex(id) ?? (id ? '#ff4d47' : '#3f7cff');
    for (const f of game.fighters) {
      const slots = slotStatuses(f), tc = f.tackleCharge;if (!slots.length && !tc) continue;
      // Tackle carregado: barra com a % da carga e o PL alcançado (mesmas cores dos Moves).
      const frac = tc ? Math.min(1, tc.t / Math.max(1e-6, C.rules.chargeTackleMaxTime)) : 0;
      const tcell = tc ? `<div class="mvp-slot" data-state="carregando" style="--p:${frac.toFixed(3)};--c:${PL_COLORS[tc.level]}"><kbd>${escape(keyLabel(C.extras.keyCodes[(f.id ? C.extras.bindings2 : C.extras.bindings).tackle]))}</kbd><b>Tackle</b><span>${Math.round(frac * 100)}% · PL${tc.level}</span><i></i></div>` : '';
      const cells = slots.map(s => {
        const color = s.state === 'carregando' ? PL_COLORS[s.level] : s.state === 'pronto' ? '#b8ef6c' : s.state === 'bloqueado' ? '#ff9a8a' : '#9bb0c3';
        const p = s.state === 'carregando' ? s.progress : s.state === 'recarga' ? s.progress : s.state === 'recuperacao' ? 1 - Math.min(1, s.left / .25) : 1;
        const on = boost && boost.fighter === f.id && boost.slot === s.slot;
        const feedback = s.feedback?.text || '';
        return `<div class="mvp-slot" data-slot="${s.slot}"${on ? ' data-boost="1"' : ''}${feedback ? ` data-feedback="${escape(s.feedback.kind)}"` : ''} data-state="${s.state}" style="--p:${p.toFixed(3)};--c:${color}"><kbd>${escape(keyOf(f.id, s.slot))}</kbd><b>${escape(s.name)}</b><span>${escape(feedback || s.text)}</span><i></i></div>`;
      }).join('');
      rows.push(`<div class="mvp-row" data-fighter="${f.id}" style="--fc:${fc(f.id)}"><em>${escape(fighterColorLabel(f.id) ?? (f.id ? 'Adversário' : 'Jogador'))}</em>${tcell}${cells}</div>`);
    }
    const html = visible ? rows.join('') : '';
    if (html !== this.last) {this.last = html;this.root.innerHTML = html;}
    this.root.hidden = !html;
  }
}
