// @ts-check
// Game feel 5 — feedback visual de golpe no vazio. SÓ APRESENTAÇÃO: lê o estado/eventos da simulação, nunca move colisor nem inventa acerto.
// Um «whiff» confirmado é um tackle que terminou sozinho (duração completa) sem registrar NENHUM alvo em action.hits — como o combate
// grava no mesmo conjunto o bloqueio, a defesa perfeita, o reflexo, a absorção e a invulnerabilidade, esses casos já ficam de fora.
// Feint fora da janela de cancelamento chega como o evento `feintWhiff` (a simulação já o emite) e ganha tratamento próprio.
// Nada aqui produz número de dano, clarão de acerto, hit stop, tremor de impacto nem som de acerto (o dono desses canais é o evento de impacto).
// Controles em C.extras.gameFeel: whiffOn, whiffTrail, whiffDust, whiffOvershoot (°, só rotação visual), whiffMinDistance (m).
import {C} from '../sim/config.js';
import {actionSpec} from '../sim/entity.js';

const AIR = 0xdfeeff, DUST = 0xd8c9ad, FEINT = 0x9bb7ff, LIFE_TRAIL = .3, LIFE_DUST = .5, LIFE_FEINT = .28, OVERSHOOT_TIME = .38;
const STUN_STATES = new Set(['hitstun', 'stagger', 'pushed', 'airborne', 'guardStun', 'recoil', 'defeated', 'wallSplat', 'landing']);

/**
 * Decisão pura (testável): o tackle que acabou foi um golpe no vazio?
 * @param {{kind: string, slam?: boolean, hitCount: number, elapsed: number, duration: number}} a último estado visto da ação
 * @param {{state?: string, hp: number}} f lutador depois do fim da ação
 * @param {{step: number, nearestGap: number, minDistance: number, slack?: number}} o
 */
export function isWhiff(a, f, o) {
  if (!a || a.kind !== 'tackle' || a.slam || a.hitCount > 0) return false;
  if (f.hp <= 0 || STUN_STATES.has(f.state ?? '')) return false;                       // interrompido por golpe sofrido: não é «erro» do atacante
  if (a.elapsed + (o.slack ?? o.step * 1.5) < a.duration - 1e-6) return false;          // cancelado (finta, esquiva, defesa) antes do fim: não confirmou (slack: o último quadro visto pode estar até um quadro de tela antes do fim)
  if (o.nearestGap < o.minDistance) return false;                                       // rival colado: pode ser contato válido logo ao lado
  return true;
}

export class WhiffFx {
  /** @param {any} T three @param {any} scene */
  constructor(T, scene) {
    this.T = T;this.scene = scene;this.group = new T.Group();this.group.renderOrder = 805;scene.add(this.group);
    /** @type {Map<number, any>} */ this.track = new Map();
    /** @type {any[]} */ this.fx = [];
    /** @type {Map<number, {t: number, dir: number, amp: number}>} */ this.overshoot = new Map();
    this.stats = {whiffs: 0, feintWhiffs: 0, suppressed: 0};
    this.seen = new WeakSet();
    this.quad = new T.PlaneGeometry(1, 1);
    this.tex = {};   // texturas suaves (nada de quadrados duros): halo redondo para a poeira e risco com pontas que somem para o rastro
  }
  texture(/** @type {'soft'|'streak'} */ kind) {
    if (this.tex[kind]) return this.tex[kind];
    const T = this.T, cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!cv) return null;
    const w = kind === 'soft' ? 64 : 128, h = kind === 'soft' ? 64 : 16;cv.width = w;cv.height = h;
    const g = cv.getContext('2d');
    if (kind === 'soft') {const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);r.addColorStop(0, 'rgba(255,255,255,.9)');r.addColorStop(.5, 'rgba(255,255,255,.35)');r.addColorStop(1, 'rgba(255,255,255,0)');g.fillStyle = r;g.fillRect(0, 0, w, h);}
    else {const l = g.createLinearGradient(0, 0, w, 0);l.addColorStop(0, 'rgba(255,255,255,0)');l.addColorStop(.7, 'rgba(255,255,255,.9)');l.addColorStop(1, 'rgba(255,255,255,0)');g.fillStyle = l;g.fillRect(0, 0, w, h);const v = g.createLinearGradient(0, 0, 0, h);v.addColorStop(0, 'rgba(0,0,0,1)');v.addColorStop(.5, 'rgba(0,0,0,0)');v.addColorStop(1, 'rgba(0,0,0,1)');g.globalCompositeOperation = 'destination-out';g.fillStyle = v;g.fillRect(0, 0, w, h);}
    const tx = new T.CanvasTexture(cv);tx.colorSpace = T.SRGBColorSpace;return this.tex[kind] = tx;
  }
  get active() {return this.fx.length > 0 || this.overshoot.size > 0;}
  /** Giro visual extra (rad) do lutador na recuperação do golpe errado. 0 fora disso. */
  yawOf(/** @type {number} */ id) {
    const o = this.overshoot.get(id);if (!o) return 0;
    const u = Math.min(1, o.t / OVERSHOOT_TIME);
    return o.dir * o.amp * Math.sin(u * Math.PI) * (1 - u * .5);   // vai e volta, amortecido; termina em 0
  }
  /**
   * @param {any[]} fighters @param {any[]} fresh eventos novos do despachante @param {number} dt
   * @param {{bodyHeight: number, halfExtent: number, reduceMotion?: boolean, noFlash?: boolean, visible?: boolean, sizeOf?: (id: number) => {w: number, h: number}}} o
   */
  update(fighters, fresh, dt, o) {
    const G = C.extras.gameFeel, T = this.T;
    if (dt > 0) this.lastDt = dt;
    const slack = Math.max(this.lastDt ?? 0, C.test.step * 2) * 1.1 + C.test.step;
    for (const f of fighters) {
      const a = f.action, tr = this.track.get(f.id);
      let ended = null;
      if (tr) {
        const same = a && a.kind === tr.kind && a.elapsed >= tr.elapsed - 1e-9 && (a === tr.ref || tr.hitCount <= (a.hits?.size ?? 0));   // robusto a load/replay que clonam o objeto
        if (!same) ended = tr;
      }
      if (a && a.kind === 'tackle') this.track.set(f.id, {ref: a, kind: a.kind, slam: !!a.slam, hitCount: a.hits?.size ?? 0, elapsed: a.elapsed, duration: actionSpec(a).duration, heading: a.heading ?? f.facing, y: f.groundY ?? 0, flying: !!f.flight});
      else this.track.delete(f.id);
      if (!ended || !G.whiffOn || ended.ref && this.seen.has(ended.ref)) continue;
      this.seen.add(ended.ref);
      let gap = Infinity;
      for (const r of fighters) if (r !== f && r.hp > 0 && !r.absent) gap = Math.min(gap, Math.hypot(r.position.x - f.position.x, r.position.z - f.position.z) - 2 * o.halfExtent);
      if (!isWhiff(ended, f, {step: C.test.step, nearestGap: gap, minDistance: G.whiffMinDistance, slack})) {if (ended.hitCount === 0) this.stats.suppressed++;continue;}
      this.stats.whiffs++;
      this.spawn(f, ended, o, false);
    }
    for (const e of fresh) {
      if (e.result !== 'feintWhiff' || !G.whiffOn) continue;
      const f = fighters[e.attacker];if (!f) continue;
      this.stats.feintWhiffs++;
      this.spawn(f, {heading: f.action?.heading ?? f.facing, y: f.groundY ?? 0, flying: !!f.flight}, o, true);
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const x = this.fx[i];x.age += dt;
      const u = Math.min(1, x.age / x.life), cap = o.noFlash ? .6 : 1;
      for (const p of x.parts) {
        const grow = o.reduceMotion ? 1 : p.grow;
        p.mesh.scale.set(p.w * (1 + (grow - 1) * u), p.h * (1 + (p.hGrow ?? 0) * u), 1);
        p.mesh.position.set(p.x + p.vx * u, p.y + p.vy * u, p.z + p.vz * u);
        p.mesh.material.opacity = p.alpha * (1 - u) * (1 - u) * cap * x.k;
      }
      if (u >= 1) {this.group.remove(x.root);for (const p of x.parts) p.mesh.material.dispose();this.fx.splice(i, 1);}
    }
    for (const [id, s] of [...this.overshoot]) {s.t += dt;if (s.t >= OVERSHOOT_TIME) this.overshoot.delete(id);}
    this.group.visible = o.visible !== false;
  }
  /** @param {any} f @param {{heading:number,y:number,flying?:boolean}} at @param {any} o @param {boolean} feint */
  spawn(f, at, o, feint) {
    const T = this.T, G = C.extras.gameFeel, root = new T.Group(), parts = [];
    // Modelos grandes (Wookada 1,85×): o rastro, a poeira e as alturas acompanham o tamanho VISUAL, senão nascem dentro do corpo.
    const sz = o.sizeOf?.(f.id) ?? {w: 1, h: 1}, dx = Math.sin(at.heading), dz = Math.cos(at.heading), h = o.bodyHeight * sz.h, he = o.halfExtent * sz.w;
    const mat = (/** @type {number} */ c, /** @type {any} */ map) => new T.MeshBasicMaterial({color: c, map: map ?? null, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending});
    const add = (/** @type {any} */ p) => {const mesh = new T.Mesh(this.quad, mat(p.color, this.texture(p.tex)));mesh.rotation.order = 'YXZ';mesh.rotation.set(p.rx ?? 0, p.ry ?? 0, 0);root.add(mesh);parts.push({mesh, ...p});};
    const k = 1, trail = G.whiffTrail;
    if (trail > 0) {
      // Linhas de ar paralelas ao golpe (chapas verticais finas esticando para a frente); a finta recebe um arco curto para trás.
      for (let i = 0; i < 3; i++) {
        const side = (i - 1) * he * .9, len = (feint ? 1.0 : 1.7) * trail * sz.w;
        const cx = at.heading, sx = Math.cos(cx) * side, sperp = -Math.sin(cx) * side, sgn = feint ? -1 : 1;
        add({color: feint ? FEINT : AIR, x: f.position.x + dx * sgn * (.55 + len * .25) + sx, y: (at.y ?? 0) + h * (.45 + i * .14), z: f.position.z + dz * sgn * (.55 + len * .25) + sperp, w: len, h: (.09 + .05 * (1 - Math.abs(i - 1))) * Math.max(.8, sz.h), grow: 1.5, vx: dx * sgn * .5 * trail, vy: 0, vz: dz * sgn * .5 * trail, alpha: .7, tex: 'streak', ry: at.heading - Math.PI / 2, rx: 0});
      }
    }
    if (!feint && G.whiffDust > 0 && !at.flying) {
      // Poeira rente ao chão: pequenas chapas que sobem e se abrem, deixadas para trás da linha do golpe.
      const n = Math.max(1, Math.round(6 * G.whiffDust));
      for (let i = 0; i < n; i++) {
        const a = at.heading + Math.PI + (i / Math.max(1, n - 1) - .5) * 1.6, r = he * (.8 + (i % 3) * .35);
        add({color: DUST, x: f.position.x + Math.sin(a) * r, y: (at.y ?? 0) + .05, z: f.position.z + Math.cos(a) * r, w: .45 * G.whiffDust * sz.w, h: .45 * G.whiffDust * sz.w, grow: 2.2, hGrow: 1.2, vx: Math.sin(a) * .25, vy: .18, vz: Math.cos(a) * .25, alpha: .6, tex: 'soft', rx: -Math.PI / 2, ry: a});
      }
    }
    if (!parts.length && !(G.whiffOvershoot > 0)) return;
    this.group.add(root);
    this.fx.push({root, parts, age: 0, life: feint ? LIFE_FEINT : Math.max(LIFE_TRAIL, LIFE_DUST), k});
    if (!feint && G.whiffOvershoot > 0 && !o.reduceMotion) this.overshoot.set(f.id, {t: 0, dir: ((f.id ?? 0) % 2 ? -1 : 1), amp: G.whiffOvershoot * Math.PI / 180});
  }
  reset() {for (const x of this.fx) {this.group.remove(x.root);for (const p of x.parts) p.mesh.material.dispose();}this.fx.length = 0;this.track.clear();this.overshoot.clear();}
  dispose() {this.reset();this.scene.remove(this.group);this.quad.dispose();for (const t of Object.values(this.tex)) t.dispose();}
}
