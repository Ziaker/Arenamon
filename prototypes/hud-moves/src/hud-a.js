// HUD A · "Impacto": urbano, angular, vermelho/preto/branco. Jogador embaixo à esquerda (placa grande),
// adversário no alto à direita, quatro cartas em cascata diagonal à direita. Direção original: sem assets de terceiros.
import {html, setText, setVar, setAttr, toggle, q, qa} from './dom.js';
import {iconSvg, esc} from './data.js';

const BLADES = (n) => Array.from({length: n}, () => '<b><i></i></b>').join('');
const slab = (side, label) => `
  <section class="a-slab a-${side}" data-side="${side}">
    <div class="a-name"><span>${label}</span><em class="a-tags"></em></div>
    <div class="a-hp"><i class="a-trail"></i><i class="a-fill"></i><div class="a-hpnum"><b>100</b><small>HP</small></div></div>
    <div class="a-st"><span class="a-stl">ST</span>${BLADES(3)}<span class="a-stnum">3.0</span></div>
  </section>`;
const card = (i) => `
  <div class="a-card" data-i="${i}" data-state="pronto">
    <div class="a-face">
      <div class="a-cfill"></div><div class="a-hatch"></div>
      <div class="a-key"><span></span></div>
      <div class="a-ico"></div>
      <div class="a-txt"><b class="a-mname"></b><small class="a-mcost"></small></div>
      <div class="a-badge"></div>
    </div>
  </div>`;

export class HudA {
  constructor() {
    this.el = html(`<div class="hud hA">${slab('me', '')}${slab('foe', '')}<div class="a-cards">${[0, 1, 2, 3].map(card).join('')}</div></div>`);
    this.sl = {me: q(this.el, '.a-me'), foe: q(this.el, '.a-foe')};
    this.cards = qa(this.el, '.a-card');
    this.icons = [];
  }
  fighter(sl, f) {
    setText(q(sl, '.a-name span'), f.name);
    setVar(sl, '--hp', f.hpFrac); setVar(sl, '--trail', f.trail);
    setText(q(sl, '.a-hpnum b'), String(Math.ceil(f.hp)));
    toggle(sl, 'low', f.low); toggle(sl, 'dead', f.hp <= 0);
    const bl = qa(sl, '.a-st b');
    bl.forEach((b, k) => { const fr = Math.max(0, Math.min(1, f.st - k)); setVar(b, '--f', fr); toggle(b, 'full', fr >= 0.999); });
    toggle(q(sl, '.a-st'), 'empty', f.exhausted);
    setText(q(sl, '.a-stnum'), f.st.toFixed(1));
    setText(q(sl, '.a-tags'), f.exhausted ? 'EXAUSTO' : f.low ? 'CRÍTICO' : '');
  }
  update(v) {
    this.fighter(this.sl.me, v.p); this.fighter(this.sl.foe, v.e);
    v.moves.forEach((m, i) => {
      const c = this.cards[i], face = q(c, '.a-face');
      setAttr(c, 'data-state', m.state); toggle(c, 'sel', m.selected);
      setText(q(c, '.a-key span'), m.key); setText(q(c, '.a-mname'), m.name);
      setText(q(c, '.a-mcost'), `ST ${m.cost}`);
      if (c._icon !== m.icon) { c._icon = m.icon; q(c, '.a-ico').innerHTML = iconSvg(m.icon); }
      setVar(face, '--cd', m.cd); setVar(face, '--ch', m.ch);
      const badge = m.state === 'recarga' ? `${m.secs.toFixed(1)}s` : m.state === 'carregando' ? `${m.pct}%` : m.state === 'bloqueado' ? 'BLOQUEADO' : m.state === 'semStamina' ? 'SEM ST' : 'PRONTO';
      setText(q(c, '.a-badge'), badge);
    });
  }
}
void esc;
