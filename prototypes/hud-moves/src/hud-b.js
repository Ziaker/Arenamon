// HUD B · "Quadrinhos": painéis com contorno grosso, halftone, balões e onomatopeias. Jogador no alto à esquerda,
// adversário no alto à direita (mais compacto), explosão "VS" no centro e uma página 2×2 de moves embaixo à esquerda.
import {html, setText, setVar, setAttr, toggle, q, qa} from './dom.js';
import {iconSvg} from './data.js';

const BURST = '<svg class="b-burst" viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,2 61,22 83,10 79,35 99,40 82,55 94,77 70,74 66,97 50,82 34,97 30,74 6,77 18,55 1,40 21,35 17,10 39,22"/></svg>';
const dot = () => '<span class="b-dot"><i></i></span>';
const panel = (side) => `
  <section class="b-panel b-${side}" data-side="${side}">
    <div class="b-balloon"><span class="b-nm"></span></div>
    <div class="b-hpwrap">
      <div class="b-num">${BURST}<b>100</b></div>
      <div class="b-hp"><i class="b-trail"></i><i class="b-fill"></i><u class="b-ticks"></u></div>
    </div>
    <div class="b-st"><em>FÔLEGO</em>${dot()}${dot()}${dot()}<small>3.0</small></div>
    <div class="b-sfx"></div>
  </section>`;
const move = (i) => `
  <div class="b-mv" data-i="${i}" data-state="pronto">
    <div class="b-box">
      <div class="b-bg"></div><div class="b-lines"></div><div class="b-fillbar"></div>
      <div class="b-ico"></div>
      <div class="b-mname"></div>
      <div class="b-cost"></div>
      <div class="b-over"></div>
    </div>
    <div class="b-key"></div>
    <div class="b-tag"></div>
  </div>`;

export class HudB {
  constructor() {
    this.el = html(`<div class="hud hB">${panel('me')}${panel('foe')}<div class="b-vs">${BURST}<b>VS</b></div><div class="b-page">${[0, 1, 2, 3].map(move).join('')}</div></div>`);
    this.sl = {me: q(this.el, '.b-me'), foe: q(this.el, '.b-foe')};
    this.mv = qa(this.el, '.b-mv');
  }
  fighter(sl, f, labels) {
    setText(q(sl, '.b-nm'), f.name);
    setVar(sl, '--hp', f.hpFrac); setVar(sl, '--trail', f.trail);
    setText(q(sl, '.b-num b'), String(Math.ceil(f.hp)));
    toggle(sl, 'low', f.low); toggle(sl, 'dead', f.hp <= 0);
    qa(sl, '.b-dot').forEach((d, k) => { const fr = Math.max(0, Math.min(1, f.st - k)); setVar(d, '--f', fr); toggle(d, 'full', fr >= 0.999); });
    setText(q(sl, '.b-st small'), f.st.toFixed(1));
    toggle(sl, 'tired', f.exhausted);
    setText(q(sl, '.b-sfx'), f.hp <= 0 ? 'K.O.!' : f.low ? labels.low : f.exhausted ? 'ZZZ…' : '');
  }
  update(v) {
    this.fighter(this.sl.me, v.p, {low: 'CRASH!'}); this.fighter(this.sl.foe, v.e, {low: 'CRACK!'});
    v.moves.forEach((m, i) => {
      const c = this.mv[i];
      setAttr(c, 'data-state', m.state); toggle(c, 'sel', m.selected);
      setText(q(c, '.b-key'), m.key); setText(q(c, '.b-mname'), m.name); setText(q(c, '.b-cost'), `FÔLEGO ${m.cost}`);
      if (c._icon !== m.icon) { c._icon = m.icon; q(c, '.b-ico').innerHTML = iconSvg(m.icon); }
      setVar(c, '--cd', m.cd); setVar(c, '--ch', m.ch);
      const over = m.state === 'recarga' ? `${m.secs.toFixed(1)}s` : m.state === 'carregando' ? 'CARREGA!!' : m.state === 'bloqueado' ? 'NÃO!' : m.state === 'semStamina' ? 'ZZZ' : '';
      setText(q(c, '.b-over'), over);
      setText(q(c, '.b-tag'), m.state === 'recarga' ? 'RECARGA' : m.state === 'carregando' ? `${m.pct}%` : m.state === 'bloqueado' ? 'BLOQUEADO' : m.state === 'semStamina' ? 'SEM FÔLEGO' : m.selected ? 'ZAP!' : 'PRONTO!');
    });
  }
}
