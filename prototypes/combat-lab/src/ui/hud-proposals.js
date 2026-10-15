// Três propostas de HUD para avaliação (A Arcade Vector, B Combat Halo, C Tactical Combat), alternáveis em tempo
// real e sempre com os mesmos dados reais (HP, stamina, exaustão, estados). Os quatro cooldowns são SÓ
// DEMONSTRAÇÃO: não existem movimentos, nomes ou tempos oficiais. A fonte de dados dos cooldowns é substituível
// (setCooldownSource) para receber dados reais no futuro. Nenhuma proposta interfere na câmera ou na física.
import {C} from '../sim/config.js';

const SLOTS = 4;
/** Estado demonstrativo dos 4 indicadores (tempo fictício configurável em Visualizar › HUD). */
export class DemoCooldowns {
  constructor() {this.left = Array(SLOTS).fill(0);this.clock = 0;this.next = 0;}
  trigger(i) {this.left[i] = C.display.hud.demoDuration;}
  update(dt) {
    this.clock += dt;for (let i = 0; i < SLOTS; i++) this.left[i] = Math.max(0, this.left[i] - dt);
    if (C.display.hud.demoAuto && this.clock >= this.next) {const i = Math.floor(this.clock / 1.3) % SLOTS;if (this.left[i] <= 0) this.trigger(i);this.next = this.clock + 1.3;}
  }
  /** Formato futuro dos dados reais: {label, remaining, total, ready, demo}. */
  read() {const total = C.display.hud.demoDuration;return this.left.map((r, i) => ({label: `Demo ${i + 1}`, key: String(i + 1), remaining: r, total, ready: r <= 0, demo: true}));}
}

const pct = v => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(2)}%`;
const status = f => [f.exhausted && ['EXAUSTO', 'exhaust'], f.regen && !f.exhausted && ['RECUPERANDO', 'regen'], f.sprint && ['SPRINT', 'sprint'], f.guard && ['DEFESA', 'guard'], f.counter && ['CONTRA-ATAQUE', 'counter'], f.air && ['NO AR', 'air'], f.stun && ['GUARD STUN', 'stun']].filter(Boolean);

export class HudProposals {
  constructor(root) {this.root = root;this.current = -1;this.trail = [1, 1];this.trailHold = [0, 0];this.lastHp = [null, null];this.demo = new DemoCooldowns();this.source = () => this.demo.read();this.refs = null;}
  setCooldownSource(fn) {this.source = fn || (() => this.demo.read());}
  /** Dados reais normalizados (os mesmos para as três propostas). */
  data(game) {
    return game.fighters.map(f => ({name: f.id ? 'ADVERSÁRIO' : 'JOGADOR', hp: f.hp / f.attributes.hp, hpRaw: f.hp, hpMax: f.attributes.hp, st: f.stamina / C.rules.staminaMax, stRaw: f.stamina, stMax: C.rules.staminaMax,
      exhausted: !!f.exhausted, regen: (f.staminaTrend ?? 0) > 1e-4 && f.stamina < C.rules.staminaMax - 1e-6, sprint: !!f.sprinting, guard: !!f.guard, counter: f.counterWindow > 0, air: !!f.flight, stun: f.stun > 1e-8}));
  }
  build(kind) {
    const r = this.root;r.className = `hudp hudp-${'xabc'[kind]}`;r.style.setProperty('--hudp-scale', C.display.hud.scale);
    const side = id => `<div class="hp-side side-${id}" data-side="${id}"><div class="hp-name"></div><div class="hp-bar"><i class="trail"></i><i class="fill"></i></div><div class="st-bar"></div><div class="tags"></div><div class="nums"></div></div>`;
    const cds = `<div class="cds">${Array.from({length: SLOTS}, (_, i) => `<div class="cd" data-cd="${i}"><div class="cd-disc"><span class="cd-time"></span></div><small class="cd-label"></small></div>`).join('')}<div class="cd-note">DEMONSTRAÇÃO · movimentos futuros sem regras definidas</div></div>`;
    if (kind === 1) r.innerHTML = `<div class="a-top">${side(0)}<div class="a-vs">VS</div>${side(1)}</div>${cds}`;
    else if (kind === 2) r.innerHTML = `<div class="b-player" data-side="0"><svg viewBox="0 0 200 200" class="halo"><circle class="ring-bg" cx="100" cy="100" r="82"/><circle class="ring-trail" cx="100" cy="100" r="82"/><circle class="ring-hp" cx="100" cy="100" r="82"/><circle class="ring-st-bg" cx="100" cy="100" r="66"/><circle class="ring-st" cx="100" cy="100" r="66"/></svg><div class="b-core"><b class="b-hp"></b><small class="b-st"></small><span class="tags"></span></div>${cds}</div>
      <div class="b-enemy" data-side="1"><svg viewBox="0 0 200 200" class="halo"><circle class="ring-bg" cx="100" cy="100" r="82"/><circle class="ring-trail" cx="100" cy="100" r="82"/><circle class="ring-hp" cx="100" cy="100" r="82"/><circle class="ring-st-bg" cx="100" cy="100" r="66"/><circle class="ring-st" cx="100" cy="100" r="66"/></svg><div class="b-core"><b class="b-hp"></b><small class="b-st"></small><span class="tags"></span></div></div>`;
    else if (kind === 3) r.innerHTML = `<div class="c-mod" data-side="0"><header><b>JOGADOR</b><span class="c-hpnum"></span></header><div class="c-seg c-hp"></div><div class="c-stmods"></div><div class="tags"></div></div>
      <div class="c-mod c-enemy" data-side="1"><header><b>ADVERSÁRIO</b><span class="c-hpnum"></span></header><div class="c-seg c-hp"></div><div class="c-stmods"></div><div class="tags"></div></div>
      <div class="c-actions"><header><b>PAINEL DE AÇÕES</b><small>DEMONSTRAÇÃO</small></header><div class="c-grid">${Array.from({length: SLOTS}, (_, i) => `<div class="c-slot" data-cd="${i}"><span class="c-key">${i + 1}</span><span class="cd-label"></span><span class="cd-time"></span><i class="c-cdbar"><b></b></i></div>`).join('')}</div><p class="c-note">Indicadores para movimentos futuros; sem nomes, tempos ou regras oficiais.</p></div>`;
    else r.innerHTML = '';
    this.current = kind;this.segments = null;
  }
  render(game, dt) {
    const kind = C.display.hud.proposal | 0;
    if (kind !== this.current) this.build(kind);
    this.root.hidden = kind === 0;if (kind === 0 || !game.fighters?.length) return;
    this.root.style.setProperty('--hudp-scale', C.display.hud.scale);
    this.demo.update(dt);const data = this.data(game), cds = C.display.hud.demoCooldowns ? this.source() : [];
    // Faixa de dano recente: segura `damageDelay` e depois alcança a vida atual.
    data.forEach((f, i) => {
      if (this.lastHp[i] !== null && f.hp < this.lastHp[i] - 1e-9) this.trailHold[i] = C.display.hud.damageDelay;
      if (f.hp > this.trail[i]) this.trail[i] = f.hp;
      this.trailHold[i] -= dt;if (this.trailHold[i] <= 0) this.trail[i] = Math.max(f.hp, this.trail[i] - dt * 1.4);
      this.lastHp[i] = f.hp;
    });
    const R = this.root;
    if (kind === 1) {
      for (const f of data) {
        const s = R.querySelector(`.side-${data.indexOf(f)}`);s.querySelector('.hp-name').textContent = f.name;
        s.querySelector('.fill').style.width = pct(f.hp);s.querySelector('.trail').style.width = pct(this.trail[data.indexOf(f)]);s.classList.toggle('low', f.hp < .3);
        const st = s.querySelector('.st-bar');if (st.childElementCount !== Math.ceil(f.stMax)) st.innerHTML = Array.from({length: Math.ceil(f.stMax)}, () => '<i><b></b></i>').join('');
        [...st.children].forEach((cell, k) => {cell.firstChild.style.width = pct(f.stRaw - k);});st.classList.toggle('exhausted', f.exhausted);st.classList.toggle('regen', f.regen);
        s.querySelector('.tags').innerHTML = status(f).map(([t, c]) => `<em class="${c}">${t}</em>`).join('');s.querySelector('.nums').textContent = `${Math.ceil(f.hpRaw)} / ${f.hpMax}`;
      }
    } else if (kind === 2) {
      const L = 2 * Math.PI * 82, Ls = 2 * Math.PI * 66, arc = .75;
      for (const [i, f] of data.entries()) {
        const s = R.querySelector(`[data-side="${i}"]`);
        const set = (sel, len, frac) => {const c = s.querySelector(sel);c.style.strokeDasharray = `${len * arc * frac} ${len}`;};
        set('.ring-bg', L, 1);set('.ring-trail', L, this.trail[i]);set('.ring-hp', L, f.hp);set('.ring-st-bg', Ls, 1);set('.ring-st', Ls, f.st);
        s.classList.toggle('low', f.hp < .3);s.classList.toggle('exhausted', f.exhausted);s.classList.toggle('regen', f.regen);
        s.querySelector('.b-hp').textContent = Math.ceil(f.hpRaw);s.querySelector('.b-st').textContent = `ST ${f.stRaw.toFixed(1)}/${f.stMax}`;s.querySelector('.tags').innerHTML = status(f).slice(0, 2).map(([t, c]) => `<em class="${c}">${t}</em>`).join('');
      }
    } else if (kind === 3) {
      for (const [i, f] of data.entries()) {
        const s = R.querySelector(`[data-side="${i}"]`), segs = Math.max(4, Math.round(f.hpMax / 5)), hp = s.querySelector('.c-hp');
        if (hp.childElementCount !== segs) hp.innerHTML = Array.from({length: segs}, () => '<i></i>').join('');
        [...hp.children].forEach((c, k) => {const lo = k / segs;c.className = f.hp > lo + 1e-9 ? (f.hp >= (k + 1) / segs - 1e-9 ? 'on' : 'part') : this.trail[i] > lo + 1e-9 ? 'trail' : '';});
        s.querySelector('.c-hpnum').textContent = `${Math.ceil(f.hpRaw).toString().padStart(3, ' ')} / ${f.hpMax}`;
        const st = s.querySelector('.c-stmods'), n = Math.ceil(f.stMax);if (st.childElementCount !== n) st.innerHTML = Array.from({length: n}, (_, k) => `<div class="c-st"><b></b><small>ST${k + 1}</small></div>`).join('');
        [...st.children].forEach((c, k) => {c.firstChild.style.height = pct(f.stRaw - k);c.classList.toggle('full', f.stRaw >= k + 1 - 1e-9);});
        st.classList.toggle('exhausted', f.exhausted);st.classList.toggle('regen', f.regen);
        s.querySelector('.tags').innerHTML = (status(f).length ? status(f) : [['PRONTO', 'ok']]).map(([t, c]) => `<em class="${c}">${t}</em>`).join('');
      }
    }
    for (let i = 0; i < SLOTS; i++) {
      const el = R.querySelector(`[data-cd="${i}"]`);if (!el) continue;const c = cds[i];el.hidden = !c;if (!c) continue;
      const frac = c.total > 0 ? c.remaining / c.total : 0;el.classList.toggle('ready', c.ready);
      el.style.setProperty('--cd', String(frac));el.querySelector('.cd-label').textContent = c.label;el.querySelector('.cd-time').textContent = c.ready ? 'OK' : c.remaining.toFixed(1);
      const bar = el.querySelector('.c-cdbar b');if (bar) bar.style.width = pct(1 - frac);
    }
    const note = R.querySelector('.cd-note');if (note) note.hidden = !cds.length;
  }
  triggerDemo(i) {this.demo.trigger(i);}
}
