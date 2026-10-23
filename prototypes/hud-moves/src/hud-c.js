// HUD C · "Clássico": limpo e profissional. Barras espelhadas no alto, centradas (jogador à esquerda, adversário à direita),
// stamina em segmentos finos logo abaixo e uma barra de quatro slots quadrados com recarga radial embaixo ao centro.
import {html, setText, setVar, setAttr, toggle, q, qa} from './dom.js';
import {iconSvg} from './data.js';

const side = (s) => `
  <div class="c-fighter c-${s}" data-side="${s}">
    <div class="c-head"><b class="c-nm"></b><span class="c-tag"></span><span class="c-hpn"></span></div>
    <div class="c-hp"><i class="c-trail"></i><i class="c-fill"></i></div>
    <div class="c-st"><i><b></b></i><i><b></b></i><i><b></b></i><span class="c-stn"></span></div>
  </div>`;
const slot = (i) => `
  <div class="c-slot" data-i="${i}" data-state="pronto">
    <div class="c-sq">
      <div class="c-ring"></div>
      <div class="c-sweep"></div>
      <div class="c-ico"></div>
      <div class="c-time"></div>
      <div class="c-lock"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V8a5 5 0 0 1 10 0v2h1.500A1.500 1.500 0 0 1 20 11.500v9a1.500 1.500 0 0 1-1.500 1.500h-13A1.500 1.500 0 0 1 4 20.500v-9A1.500 1.500 0 0 1 5.500 10zm2 0h6V8a3 3 0 0 0-6 0z"/></svg></div>
      <div class="c-key"></div>
    </div>
    <div class="c-lbl"><b class="c-mn"></b><small class="c-mc"></small></div>
  </div>`;

export class HudC {
  constructor() {
    this.el = html(`<div class="hud hC"><div class="c-top">${side('me')}<div class="c-mid"><b>VS</b></div>${side('foe')}</div><div class="c-bar">${[0, 1, 2, 3].map(slot).join('')}</div></div>`);
    this.sl = {me: q(this.el, '.c-me'), foe: q(this.el, '.c-foe')};
    this.slots = qa(this.el, '.c-slot');
  }
  fighter(sl, f) {
    setText(q(sl, '.c-nm'), f.name);
    setText(q(sl, '.c-hpn'), `${Math.ceil(f.hp)} / ${f.hpMax}`);
    setVar(sl, '--hp', f.hpFrac); setVar(sl, '--trail', f.trail);
    toggle(sl, 'low', f.low); toggle(sl, 'mid', !f.low && f.hpFrac < 0.6); toggle(sl, 'dead', f.hp <= 0);
    qa(sl, '.c-st i').forEach((s, k) => { const fr = Math.max(0, Math.min(1, f.st - k)); setVar(s, '--f', fr); toggle(s, 'full', fr >= 0.999); });
    setText(q(sl, '.c-stn'), f.st.toFixed(1));
    toggle(q(sl, '.c-st'), 'empty', f.exhausted);
    setText(q(sl, '.c-tag'), f.exhausted ? 'EXAUSTO' : f.low ? 'CRÍTICO' : '');
  }
  update(v) {
    this.fighter(this.sl.me, v.p); this.fighter(this.sl.foe, v.e);
    v.moves.forEach((m, i) => {
      const c = this.slots[i];
      setAttr(c, 'data-state', m.state); toggle(c, 'sel', m.selected);
      setText(q(c, '.c-key'), m.key); setText(q(c, '.c-mn'), m.name);
      setText(q(c, '.c-mc'), m.state === 'recarga' ? 'Recarga' : m.state === 'carregando' ? 'Carregando' : m.state === 'bloqueado' ? 'Indisponível' : m.state === 'semStamina' ? `Precisa ${m.cost} ST` : `${m.cost} ST`);
      if (c._icon !== m.icon) { c._icon = m.icon; q(c, '.c-ico').innerHTML = iconSvg(m.icon); }
      setVar(c, '--cd', m.cd); setVar(c, '--ch', m.ch);
      setText(q(c, '.c-time'), m.state === 'recarga' ? m.secs.toFixed(1) : m.state === 'carregando' ? `${m.pct}%` : '');
    });
  }
}
