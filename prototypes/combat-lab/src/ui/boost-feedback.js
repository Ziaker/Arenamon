// Indicador da RECARGA ACELERADA (M2.3/M5.8/M16.8): apertar de novo o botão de um Move em recarga gasta stamina
// e encurta o cooldown. O motor já emitia `cooldownBoost` {attacker, move, slot, reduced, cost}, mas a tela não
// mostrava nada — o jogador pagava stamina sem ver o ganho. Este módulo lê só os eventos novos (identidade do
// objeto) e dispara três camadas: faixa no HUD, flash no slot do Move e anel no chão do lutador.
import {getMove} from '../sim/moves.js';
import {fighterColorHex, fighterTitle} from './fighter-identity.js';

const $ = id => document.getElementById(id);
const fmt = n => Math.max(0, Number.isFinite(n) ? n : 0).toFixed(2).replace('.', ',');
const HOLD_MS = 950;

export class BoostFeedback {
  constructor() {
    /** @type {WeakSet<object>} */
    this.seen = new WeakSet();
    this.el = null;
    this.timer = 0;
    this.movesHud = null;
  }
  /**
   * @param {any} game
   * @param {{live?: boolean, view?: any, movesHud?: any}} [o]
   */
  update(game, {live = false, view = null, movesHud = null} = {}) {
    if (movesHud) this.movesHud = movesHud;
    const events = game?.events;
    if (!events?.length) return;
    for (const e of events) {
      if (this.seen.has(e)) continue;
      this.seen.add(e);   // marca mesmo parado: um replay não deve "tocar" o que já aconteceu
      if (live && e.result === 'cooldownBoost') this.fire(e, game, view);
    }
  }
  fire(e, game, view) {
    const slot = Number(e.attacker ?? 0);
    const el = this.el ??= $('boost-flash');
    if (!el) return;
    const hex = fighterColorHex(slot) ?? '#ffd23f';
    el.dataset.fighter = String(slot);
    el.style.setProperty('--fc', hex);
    el.querySelector('.bf-kicker').textContent = 'RECARGA ACELERADA';
    el.querySelector('.bf-amount').textContent = `+${fmt(e.reduced)} s`;
    el.querySelector('.bf-cost').textContent = `−${fmt(e.cost)} ST`;
    const name = (e.move && getMove?.(e.move)?.name) || e.move || '';
    el.querySelector('.bf-move').textContent = name ? `${fighterTitle(slot)} · ${name}` : fighterTitle(slot);
    el.hidden = false;
    el.classList.remove('on');
    void el.offsetWidth;   // reinicia a animação mesmo em toques seguidos
    el.classList.add('on');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {el.hidden = true;el.classList.remove('on');}, HOLD_MS);
    this.movesHud?.flashBoost?.(slot, e.slot);
    const f = game?.fighters?.[slot];
    if (f) view?.boostBurst?.(f, hex);
  }
}
