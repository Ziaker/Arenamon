// Gerenciador dos três HUDs: converte o modelo demonstrativo em "visões" iguais para as três propostas,
// anima a faixa de dano recente (ghost) e alterna entre A/B/C sem recriar o modelo nem reiniciar nada.
import {HP_MAX, ST_MAX, STATE_LABEL, effectiveState, keyText, clamp} from './data.js';
import {HudA} from './hud-a.js';
import {HudB} from './hud-b.js';
import {HudC} from './hud-c.js';

/** Duração fictícia de recarga usada só para mostrar segundos no HUD (fração restante × este valor). */
export const DEMO_CD_SECONDS = 6;

function fighterView(f, trail) {
  const hp = clamp(f.hp, 0, HP_MAX), st = clamp(f.st, 0, ST_MAX);
  return {name: f.name, hp, hpFrac: hp / HP_MAX, trail, hpMax: HP_MAX, st, stMax: ST_MAX, stFrac: st / ST_MAX, low: hp / HP_MAX < 0.3, exhausted: st < 0.05};
}
function moveView(m, i, st) {
  const state = effectiveState(m, st);
  const cd = clamp(m.cd, 0, 1), ch = clamp(m.charge, 0, 1);
  return {i, name: m.name || `Move ${i + 1}`, key: keyText(m.key), icon: m.icon, cost: m.cost, state, label: STATE_LABEL[state],
    cd, ch, secs: cd * DEMO_CD_SECONDS, pct: Math.round(ch * 100), selected: !!m.selected, short: st + 1e-9 < m.cost};
}

export class HudManager {
  constructor(root) {
    this.root = root;
    this.visible = true; this.scale = 1; this.current = null;
    this.huds = {A: new HudA(), B: new HudB(), C: new HudC()};
    for (const [id, h] of Object.entries(this.huds)) { h.el.dataset.hud = id; h.el.hidden = true; root.appendChild(h.el); }
    this.trail = [1, 1]; this.hold = [0, 0]; this.lastHp = [null, null];
    this.view = null;
  }
  show(id) {
    this.current = id;
    for (const [k, h] of Object.entries(this.huds)) h.el.hidden = k !== id;
  }
  setScale(s) { this.scale = s; this.root.style.setProperty('--hud-scale', String(s)); }
  setVisible(v) { this.visible = v; this.root.hidden = !v; }
  /** Atualiza com o modelo; `dt` em segundos (anima o rastro de dano). */
  update(model, dt) {
    const fs = [model.p, model.e];
    fs.forEach((f, i) => {
      const hp = clamp(f.hp, 0, HP_MAX) / HP_MAX;
      if (this.lastHp[i] !== null && hp < this.lastHp[i] - 1e-9) this.hold[i] = 0.55;
      if (hp > this.trail[i]) this.trail[i] = hp;
      this.hold[i] -= dt; if (this.hold[i] <= 0) this.trail[i] = Math.max(hp, this.trail[i] - dt * 0.9);
      this.lastHp[i] = hp;
    });
    const stP = clamp(model.p.st, 0, ST_MAX);
    this.view = {p: fighterView(model.p, this.trail[0]), e: fighterView(model.e, this.trail[1]), moves: model.moves.map((m, i) => moveView(m, i, stP))};
    if (this.visible && this.current) this.huds[this.current].update(this.view);
  }
}
