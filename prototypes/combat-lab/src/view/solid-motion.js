// VFX sólidos de movimento: poeira e vento de dash/esquiva e da corrida. Linguagem visual: fumaça e poeira de desenho animado — massas
// macias que incham, faixas curvas em camadas, caudas em S que varrem e somem, redemoinhos, anéis de nuvem. Tudo é malha 3D com volume
// (sem sprites, billboards nem planos com textura); o aspecto de "efeito" vem do material (tons chapados + dissolução por ruído) e da
// animação (varredura ao longo da curva, crescimento, erosão). Os construtores rodam com `this` = SolidFx e só chamam this.spawn().
import * as T from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shade = (hex, k) => { const c = new T.Color(hex); c.multiplyScalar(k); return c.getHex(); };
const mixc = (a, b, k) => new T.Color(a).lerp(new T.Color(b), k).getHex();
const yawOf = d => Math.atan2(d.x, d.z);

export const MOTION_SHAPES = {
  // Volume macio (nuvem de poeira): icosaedro subdividido e deformado, normais suaves.
  lump: () => { let g = new T.IcosahedronGeometry(.5, 3); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), s = 1 + .06 * Math.sin(x * 9.1 + z * 5.3) * Math.cos(y * 7.7 + x * 3.1); p.setXYZ(i, x * s, y * (.9 + .1 * s), z * s); } g.computeVertexNormals(); return g; },
};

// ---------------------------------------------------------------------------------------------------------------------
// Poeira de dash/esquiva — estilos novos (índices 4–7 de solidDust), no material de fumaça. ctx: {c, f, s, phase, dir, side, feet, I, S, D, qk, t, col, col2}
const centre = (f, dir, back) => ({x: f.position.x - dir.x * back, z: f.position.z - dir.z * back});
/**
 * Cauda de fumaça: cadeia de volumes macios ao longo de uma curva em S (opcionalmente terminando num caracol). A cabeça é grossa e a ponta
 * afina; os volumes nascem em sequência (varredura da cabeça para a ponta) e se dissolvem por ruído. Como as caudas das nuvens de referência.
 * o: {x, z, dir, y, len, amp, waves, rise, lat, curl, size, col, life, n, speed, sweep, delay}
 */
function smokeTrail(self, o) {
  const d = o.dir, side = {x: d.z, z: -d.x}, n = o.n ?? 9;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); let back = o.len * t, up = (o.amp ?? .15) * Math.sin(2 * Math.PI * t * (o.waves ?? 1)) + (o.rise ?? 0) * t, lat = (o.lat ?? 0) * Math.sin(Math.PI * 2 * t + (o.phase ?? 0));
    if (o.curl && t > .6) { const u = (t - .6) / .4, th = u * 1.7 * Math.PI, r = o.size * 1.7 * (1 - .45 * u); up += r * Math.sin(th); back -= r * (1 - Math.cos(th)) * .8; }
    const size = o.size * (1.05 - .72 * Math.pow(t, .8)) * self.r(.8, 1.25), jx = self.r(-.3, .3) * size, jy = self.r(-.25, .25) * size;
    self.spawn({shape: 'lump', mat: 'smoke', color: shade(o.col, self.r(.95, 1.05)), x: o.x - d.x * (back + jx) + side.x * (lat + jx), y: Math.max(size * .45, o.y + up + jy), z: o.z - d.z * (back + jx) + side.z * (lat + jx), s: size, sy: size * .92, vx: -d.x * (o.speed ?? 1), vz: -d.z * (o.speed ?? 1), drag: 1.4,
      grow: .55, wx: self.r(-1.5, 1.5), life: o.life, delay: (o.delay ?? 0) + t * (o.sweep ?? .16), pop: .08, hold: .35});
  }
}
/** Fileira curva de nuvens no chão (meia-lua em planta, convexa para trás): faixa de poeira em camadas, feita de volumes. */
function smokeRow(self, o) {
  const d = o.dir, side = {x: d.z, z: -d.x}, m = Math.round((o.m ?? 7) * 1.6);
  for (let i = 0; i < m; i++) {
    const ph = (i / (m - 1) - .5) * (o.span ?? 2.2), lat = Math.sin(ph) * o.r, back = (o.back ?? .2) + Math.cos(ph) * o.r * .8 - o.r * .4, size = o.size * self.r(.6, 1.35) * (1 - .25 * Math.abs(ph)), jx = self.r(-.4, .4) * size, jy = self.r(0, .35) * size;
    self.spawn({shape: 'lump', mat: 'smoke', color: shade(o.col, self.r(.96, 1.04)), x: o.x - d.x * (back + jx) + side.x * (lat + jx), y: Math.max(size * .45, (o.y ?? .05) + jy), z: o.z - d.z * (back + jx) + side.z * (lat + jx), s: size, sy: size * .85,
      vx: -d.x * (o.speed ?? 1.8) + side.x * Math.sin(ph) * (o.out ?? .8), vz: -d.z * (o.speed ?? 1.8) + side.z * Math.sin(ph) * (o.out ?? .8), vy: o.rise ?? .4, drag: 2, grow: o.grow ?? 1.1, life: o.life, delay: (o.delay ?? 0) + Math.abs(ph) * .02, pop: .1, hold: .35, floor: size * .35, bounce: 0});
  }
}
/** Arco de nuvens: meia coroa de volumes em pé (plano perpendicular ao movimento) que se abre e escorre para trás. */
function smokeArch(self, o) {
  const d = o.dir, side = {x: d.z, z: -d.x}, m = Math.round((o.m ?? 8) * 1.4);
  for (let i = 0; i < m; i++) {
    const ph = Math.PI * (i + .5) / m, lat = Math.cos(ph) * o.r, h = Math.sin(ph) * o.r * (o.tall ?? 1.1), size = o.size * self.r(.7, 1.3), jx = self.r(-.3, .3) * size;
    self.spawn({shape: 'lump', mat: 'smoke', color: shade(o.col, self.r(.95, 1.05)), x: o.x - d.x * ((o.back ?? .4) + jx) + side.x * (lat + jx), y: Math.max(size * .45, o.y + h + jx), z: o.z - d.z * ((o.back ?? .4) + jx) + side.z * (lat + jx), s: size,
      vx: -d.x * (o.speed ?? 1.6) + side.x * Math.cos(ph) * (o.out ?? 1.3), vz: -d.z * (o.speed ?? 1.6) + side.z * Math.cos(ph) * (o.out ?? 1.3), vy: Math.sin(ph) * (o.out ?? 1.3) * .6, drag: 1.5, grow: .7, wx: self.r(-1.5, 1.5), life: o.life, delay: (o.delay ?? 0) + i * .008, pop: .08, hold: .35});
  }
}
export const DUST_NEW = [
  // E · Ondas em camadas: fileiras curvas de nuvens empilhadas (cada camada maior e mais alta) que se abrem para trás.
  function ({phase, f, dir, I, S, D, qk, t, col}) {
    col = mixc(col, 0xffffff, .55);
    const tiers = phase === 'dash' ? (Math.round(t * 34) % 5 === 0 ? 2 : 0) : phase === 'start' ? 3 : 3;
    for (let k = 0; k < tiers; k++)
      smokeRow(this, {x: f.position.x, z: f.position.z, dir: phase === 'stop' ? {x: -dir.x, z: -dir.z} : dir, y: .05 + k * .13 * S, r: (.4 + k * .22) * S, span: 2.3, size: (.12 + k * .025) * S, m: Math.max(5, Math.round((7 + k) * qk)), col: shade(col, 1.04 - k * .05), life: (.6 + k * .1) * D, back: .1 + k * .28, speed: (2.4 - .5 * k) * I, delay: k * .07});
  },
  // F · Nuvem rolante: volumes grandes e macios que rolam rente ao chão, inchando devagar, com uma cauda em S por cima.
  function ({phase, f, dir, side, I, S, D, qk, t, col}) {
    col = mixc(col, 0xffffff, .55);
    const n = Math.max(1, Math.round((phase === 'dash' ? (Math.round(t * 34) % 3 === 0 ? 2 : 0) : phase === 'start' ? 14 : 10) * I * qk));
    for (let k = 0; k < n; k++) { const p = centre(f, dir, this.r(0, .35)), sz = this.r(.1, .2) * S, sd = this.r(-.55, .55);
      this.spawn({shape: 'lump', mat: 'smoke', color: shade(col, this.r(.92, 1.12)), x: p.x + side.x * sd, y: sz * .5, z: p.z + side.z * sd, s: sz, sy: sz * .85, vx: -dir.x * this.r(.9, 2.3) * I * (phase === 'stop' ? -.6 : 1) + side.x * sd, vz: -dir.z * this.r(.9, 2.3) * I * (phase === 'stop' ? -.6 : 1) + side.z * sd,
        vy: this.r(0, .35), drag: 1.3, wx: this.r(-3, 3) * 2, wz: this.r(-3, 3), grow: .85, life: this.r(.9, 1.35) * D, pop: .16, hold: .3, floor: sz * .35, bounce: 0}); }
    if (phase !== 'dash') smokeTrail(this, {x: f.position.x, z: f.position.z, dir, y: .2, len: 1.5 * S, amp: .1 * S, rise: .35 * S, curl: true, size: .1 * S, col: shade(col, 1.15), life: .6 * D, n: Math.round(9 * qk), speed: 1.2});
  },
  // G · Anel de nuvem: duas coroas de volumes (uma dentro da outra) que se abrem em círculo ao redor dos pés e escorrem para trás.
  function ({phase, f, dir, I, S, D, qk, t, col}) {
    col = mixc(col, 0xffffff, .55);
    if (phase === 'dash' && Math.round(t * 34) % 6 !== 0) return;
    const N = Math.max(6, Math.round((phase === 'dash' ? 8 : 11) * qk)), R0 = phase === 'dash' ? .1 : .16;
    for (let ring = 0; ring < 2; ring++) for (let k = 0; k < N; k++) { const a = (k + ring * .5) / N * Math.PI * 2 + this.r(-.08, .08), sz = this.r(.14, .2) * S * (phase === 'dash' ? .8 : 1.15) * (ring ? .75 : 1);
      this.spawn({shape: 'lump', mat: 'smoke', color: shade(col, this.r(.96, 1.04) - ring * .05), x: f.position.x + Math.cos(a) * R0, y: sz * .5 + ring * .1, z: f.position.z + Math.sin(a) * R0, s: sz, vx: Math.cos(a) * this.r(1.2, 2.2) * I * (ring ? .6 : 1) - dir.x * .9, vz: Math.sin(a) * this.r(1.2, 2.2) * I * (ring ? .6 : 1) - dir.z * .9,
        vy: this.r(.3, .9) + ring * .4, gy: 1.2, drag: 2.1, grow: .9, life: this.r(.6, .9) * D, delay: ring * .05, pop: .1, hold: .3, floor: sz * .3, bounce: 0}); }
  },
  // H · Coluna em espiral: volumes sobem girando em hélice e a ponta se enrola; a coluna acompanha o deslocamento.
  function ({phase, f, dir, I, S, D, qk, t, col}) {
    col = mixc(col, 0xffffff, .55);
    if (phase === 'dash' && Math.round(t * 34) % 4 !== 0) return;
    const N = Math.max(4, Math.round((phase === 'dash' ? 5 : 9) * qk)), c = centre(f, dir, .25);
    for (let k = 0; k < N; k++) { const sz = this.r(.1, .17) * S;
      this.spawn({shape: 'lump', mat: 'smoke', color: shade(col, 1.05 + k * .015), x: c.x, y: .05, z: c.z, s: sz, orb: {cx: c.x, cz: c.z, vx: -dir.x * 1.2 * I, vz: -dir.z * 1.2 * I, a0: k * .85, w: 6 + 3 * I, r0: .12, r1: .34 + k * .035, y0: .05 + k * .04, rise: 1.2 + k * .1},
        grow: .7, life: (.75 + k * .02) * D, pop: .08, hold: .45}); }
  },
];

// ---------------------------------------------------------------------------------------------------------------------
// Vento de dash/esquiva (solidWind, 4 estilos): fumaça de vento em volumes — caudas em S, redemoinho, caracóis no chão, arcos de nuvem.
const rev = ph => ph === 'stop' ? -1 : 1;
export const WIND = [
  // A · Rajada em S: caudas de fumaça que varrem curvas em S atrás do corpo e se dissolvem.
  function ({phase, f, dir, side, I, S, D, qk, t, col}) {
    if (phase === 'dash' && Math.round(t * 34) % 3 !== 0) return;
    const k = phase === 'dash' ? 1 : phase === 'start' ? 3 : 2, d = rev(phase) < 0 ? {x: -dir.x, z: -dir.z} : dir;
    for (let i = 0; i < k; i++) { const sd = this.r(-.45, .45);
      smokeTrail(this, {x: f.position.x + side.x * sd, z: f.position.z + side.z * sd, dir: d, y: this.r(.35, 1), len: this.r(1.2, 1.7) * S, amp: this.r(.12, .22) * S, lat: this.r(-.12, .12) * S, phase: this.r(0, 6), size: .21 * S, col: mixc(col, 0xffffff, this.r(.1, .5)), life: this.r(.5, .65) * D, n: Math.max(8, Math.round(15 * qk)), speed: 1.2 * I, delay: i * .03}); }
  },
  // B · Redemoinho: coluna alta de fumaça de vento girando e subindo atrás dos pés, mais larga no topo.
  function ({phase, f, dir, I, S, D, qk, t, col}) {
    if (phase === 'dash' && Math.round(t * 34) % 5 !== 0) return;
    const N = Math.max(5, Math.round((phase === 'dash' ? 6 : 11) * qk)), c = centre(f, dir, .3);
    for (let k = 0; k < N; k++) { const sz = this.r(.15, .24) * S;
      this.spawn({shape: 'lump', mat: 'smoke', color: mixc(col, 0xffffff, .2 + k * .02), x: c.x, y: .05, z: c.z, s: sz, orb: {cx: c.x, cz: c.z, vx: -dir.x * 1.4 * I * rev(phase), vz: -dir.z * 1.4 * I * rev(phase), a0: k * .9, w: 7 + 3 * I, r0: .1, r1: .45 + k * .05, y0: .05, rise: 1.5 + k * .12},
        grow: 1, life: (.8 + k * .02) * D, delay: k * .015, pop: .08, hold: .45}); }
  },
  // C · Caracol rasteiro: um caracol de fumaça deitado junto a cada pé, abrindo para fora e para trás.
  function ({phase, f, dir, side, feet, I, S, D, qk, t, col}) {
    if (phase === 'dash' && Math.round(t * 34) % 3 !== 0) return;
    const n = Math.max(8, Math.round(14 * qk));
    feet.forEach((ft, fi) => { const out = fi ? 1 : -1;
      for (let i = 0; i < n; i++) { const u = i / (n - 1), th = u * 2.3 * Math.PI, r = (.12 + .7 * u) * S, a = th * out, lx = Math.sin(a) * r, lz = (1 - Math.cos(a)) * r * .8, size = (.15 + .13 * u) * S;
        this.spawn({shape: 'lump', mat: 'smoke', color: shade(mixc(col, 0xffffff, .2), this.r(.95, 1.05)), x: ft.x + side.x * lx * out - dir.x * (lz + .1), y: Math.max(size * .5, .05 + u * .08), z: ft.z + side.z * lx * out - dir.z * (lz + .1), s: size, vx: -dir.x * 1.1 * I * rev(phase), vz: -dir.z * 1.1 * I * rev(phase),
          drag: 1.5, grow: .6, life: .5 * D, delay: u * .14, pop: .08, hold: .35, floor: size * .4, bounce: 0}); } });
  },
  // D · Onda de pressão: arcos de nuvens que se abrem atrás do corpo, em duas camadas.
  function ({phase, f, dir, I, S, D, qk, t, col}) {
    if (phase === 'dash' && Math.round(t * 34) % 4 !== 0) return;
    const k = phase === 'dash' ? 1 : 2, d = rev(phase) < 0 ? {x: -dir.x, z: -dir.z} : dir;
    for (let i = 0; i < k; i++) smokeArch(this, {x: f.position.x, z: f.position.z, dir: d, y: .08, r: (.55 + i * .3) * S, size: (.3 - i * .04) * S, m: Math.max(8, Math.round(15 * qk)), col: mixc(col, 0xffffff, .3), life: (.5 + i * .08) * D, back: .35 + i * .3, speed: 1.8 * I, out: 1.5, delay: i * .06});
  },
];

// ---------------------------------------------------------------------------------------------------------------------
// Corrida contínua (sprint): chamados a cada tick de emissão enquanto corre/desacelera. ctx: {f, s, dir, side, feet, foot, sp, turn, taper, n, I, S, D, qk, col}
// `sp` = velocidade normalizada (~0.4–1.8); `turn` = taxa de giro (rad/s, + vira para o lado direito); `taper` = 0..1 durante a desaceleração.
export const RUN_DUST = [
  // A · Pegadas de poeira: cada passada levanta volumes de fumaça e grãos, mais forte no pé de fora da curva.
  function ({f, dir, side, feet, foot, sp, turn, taper, n, I, S, D, qk, col}) {
    col = mixc(col, 0xffffff, .45);
    const ft = feet[foot], out = -Math.sign(turn) * clamp(Math.abs(turn) * .5, 0, 1.6), k = Math.max(1, Math.round((2 + sp) * qk * taper));
    for (let i = 0; i < k; i++) { const sz = this.r(.06, .12) * S * (i ? .6 : 1.2);
      this.spawn({shape: i ? 'grain' : 'lump', mat: i ? 'lit' : 'smoke', color: shade(col, this.r(.85, 1.1)), x: ft.x, y: .03, z: ft.z, s: sz, vx: -dir.x * (1 + 2.2 * sp) * this.r(.6, 1) + side.x * (out + this.r(-.5, .5)), vz: -dir.z * (1 + 2.2 * sp) * this.r(.6, 1) + side.z * (out + this.r(-.5, .5)),
        vy: this.r(.5, 1.5 + sp), gy: 12, drag: 1.4, grow: i ? 0 : .8, wx: this.r(-10, 10), wz: this.r(-10, 10), life: this.r(.4, .75) * D, floor: .03, bounce: .15, hold: .5}); }
  },
  // B · Nuvem contínua: um fio de volumes largos e baixos que incham e se arrastam — o comprimento da cauda cresce com a velocidade.
  function ({f, dir, side, sp, turn, taper, n, I, S, D, qk, col}) {
    col = mixc(col, 0xffffff, .45);
    const c = {x: f.position.x - dir.x * .35, z: f.position.z - dir.z * .35}, sz = this.r(.2, .32) * S * (.55 + .5 * sp) * (.4 + .6 * taper), lat = clamp(turn * .35, -1, 1) * -1;
    this.spawn({shape: 'lump', mat: 'smoke', color: shade(col, this.r(.92, 1.1)), x: c.x + side.x * this.r(-.15, .15), y: sz * .5, z: c.z + side.z * this.r(-.15, .15), s: sz, sy: sz * .8, vx: -dir.x * (.8 + 1.2 * sp) + side.x * lat, vz: -dir.z * (.8 + 1.2 * sp) + side.z * lat, vy: .25,
      drag: 1.1, grow: 1.5, wx: this.r(-2, 2), life: (.8 + .3 * sp) * D, pop: .2, hold: .25, floor: sz * .3, bounce: 0});
  },
  // C · Sulcos rolantes: pequenas fileiras curvas de nuvens se abrem no chão a cada passada, inclinadas pela curva.
  function ({f, dir, side, feet, foot, sp, turn, taper, n, I, S, D, qk, col}) {
    col = mixc(col, 0xffffff, .45);
    const ft = feet[foot], sz = (.1 + .07 * sp) * S * (.5 + .5 * taper), d = {x: dir.x * Math.cos(clamp(turn * .25, -.5, .5)) - dir.z * Math.sin(clamp(turn * .25, -.5, .5)), z: dir.z * Math.cos(clamp(turn * .25, -.5, .5)) + dir.x * Math.sin(clamp(turn * .25, -.5, .5))};
    smokeRow(this, {x: ft.x, z: ft.z, dir: d, y: .04, r: .3 * S * (.6 + .4 * sp), span: 2, size: sz, m: Math.max(4, Math.round(6 * qk)), col, life: this.r(.5, .7) * D, back: .1, speed: 1.2 + 1.4 * sp, out: .8 + Math.abs(turn) * .5, rise: .3});
  },
];
export const RUN_WIND = [
  // A · Fitas contínuas: caudas de fumaça em S saem dos ombros e varrem para trás; a curvatura segue o giro.
  function ({f, dir, side, sp, turn, taper, n, I, S, D, qk, col}) {
    for (const sg of [-1, 1]) smokeTrail(this, {x: f.position.x + side.x * sg * .38, z: f.position.z + side.z * sg * .38, dir, y: this.r(.55, 1.05), len: (1 + 1.1 * sp) * S * (.4 + .6 * taper), amp: .08 * S, lat: clamp(turn * .22, -.6, .6) * -sg * S + .08 * sg, phase: n, size: .2 * S * (.7 + .4 * sp), col: mixc(col, 0xffffff, .35), life: (.4 + .1 * sp) * D, n: Math.max(6, Math.round(10 * qk)), speed: 1 + sp, sweep: .1});
  },
  // B · Esteira helicoidal: corda de fumaça em hélice atrás do corredor, girando enquanto varre.
  function ({f, dir, side, sp, turn, taper, n, I, S, D, qk, col}) {
    if (n % 2) return;
    const m = Math.max(8, Math.round(13 * qk)), len = (1.2 + 1.3 * sp) * S * (.4 + .6 * taper);
    for (let i = 0; i < m; i++) { const u = i / (m - 1), a = u * 3 * Math.PI + n * 1.3, r = .22 * S * (.4 + .6 * Math.sin(Math.PI * u)), size = .16 * S * (1.05 - .55 * u), bend = clamp(turn * .2, -.5, .5) * u;
      this.spawn({shape: 'lump', mat: 'smoke', color: mixc(col, 0xffffff, .3), x: f.position.x - dir.x * (.3 + len * u) + side.x * (Math.cos(a) * r + bend), y: .85 + Math.sin(a) * r, z: f.position.z - dir.z * (.3 + len * u) + side.z * (Math.cos(a) * r + bend),
        s: size, vx: -dir.x * (1 + sp), vz: -dir.z * (1 + sp), drag: 1.4, grow: .5, life: (.45 + .12 * sp) * D, delay: u * .12, pop: .08, hold: .35}); }
  },
  // C · Arcos de pressão: arcos de nuvens em pé nascem atrás do tronco e se alargam como ondas de ar.
  function ({f, dir, sp, turn, taper, n, I, S, D, qk, col}) {
    if (n % 3) return;
    smokeArch(this, {x: f.position.x, z: f.position.z, dir, y: .1, r: .45 * S * (.7 + .4 * sp), size: .2 * S * (.7 + .4 * sp), m: Math.max(7, Math.round(11 * qk)), col: mixc(col, 0xffffff, .3), life: (.4 + .1 * sp) * D * (.5 + .5 * taper), back: .5, speed: 1.6 + 1.4 * sp, out: 1.2});
  },
];
