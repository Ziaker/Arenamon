// Animações de INVOCAÇÃO do Reflect (VFX sólidos): três jeitos bem diferentes de a barreira surgir. Só apresentação; nascem no instante
// em que a barreira materializa (evento chargeRelease do Reflect) e usam a posição, a largura, a altura, a direção e o PL reais da barreira.
// Os construtores rodam com `this` = SolidFx. Fumaça (esferas fundidas por raymarching), cacos luminosos e ondas: nada de sprites.
import * as T from 'three';

const shade = (hex, k) => { const c = new T.Color(hex); c.multiplyScalar(k); return c.getHex(); };
const mixc = (a, b, k) => new T.Color(a).lerp(new T.Color(b), k).getHex();
const PL_TINT = [0x59d6e6, 0xffcf6a, 0xff6adf];

/** Barreira a animar: {x, z, dir (normal, para onde o personagem olha), side (ao longo da largura), hw (meia largura), y (base), h (altura), pl}. */
export function barrierOf(o) {
  const b = o.bar ?? {}, d = b.dir ?? o.dir ?? o.n ?? {x: 0, z: 1}, m = Math.hypot(d.x, d.z) || 1, dir = {x: d.x / m, z: d.z / m};
  return {x: b.x ?? o.pos?.x ?? 0, z: b.z ?? o.pos?.z ?? 0, dir, side: {x: dir.z, z: -dir.x}, hw: b.hw ?? 1.5, y: b.y ?? 0, h: b.h ?? 2, pl: b.pl ?? 1};
}

export const REFLECT_FX = [
  // A · Muralha de cristal: colunas de cristal irrompem do chão ao longo da barreira em onda (da esquerda para a direita), levantando
  // poeira na base; ao terminar, uma onda baixa de choque se abre pelo chão.
  function (o) {
    const {S, D, I, qk, c} = o, b = barrierOf(o), col = mixc(c.color, PL_TINT[(b.pl - 1) | 0] ?? c.color, .4), N = Math.max(7, Math.round(b.hw * 2 / .3 * qk));
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1) * 2 - 1, x = b.x + b.side.x * t * b.hw, z = b.z + b.side.z * t * b.hw, hgt = b.h * this.r(.55, 1.05) * (1 - .25 * Math.abs(t)), w = this.r(.1, .17) * S, dl = i * .022;
      this.spawn({shape: 'spike', mat: 'glow', color: mixc(col, 0xffffff, this.r(0, .45)), x, y: b.y, z, sx: w, sy: hgt * S, sz: w, rx: this.r(-.08, .08), rz: this.r(-.08, .08), life: (.75 + .15 * this.rnd()) * D, delay: dl, pop: .09, hold: .55});
      if (i % 2 === 0) this.spawn({shape: 'lump', mat: 'smoke', color: 0xe9eef5, x: x - b.dir.x * .1, y: .1, z: z - b.dir.z * .1, s: this.r(.22, .32) * S, vx: b.dir.x * this.r(.2, .6), vz: b.dir.z * this.r(.2, .6), vy: this.r(.4, .9), drag: 1.5, grow: 1.2, life: .6 * D, delay: dl, pop: .1, hold: .3, floor: .08, bounce: 0});
      if (i % 3 === 0) for (let k = 0; k < 2; k++) this.spawn({shape: 'grain', mat: 'glow', color: col, x, y: b.y + .1, z, s: this.r(.03, .06) * S, vx: this.r(-.5, .5), vz: this.r(-.5, .5), vy: this.r(1.5, 3.2) * I, gy: 6, life: .6 * D, delay: dl, wx: this.r(-10, 10), wz: this.r(-10, 10)});
    }
    this.spawn({shape: 'wave', mat: 'glow', color: mixc(col, 0xffffff, .3), x: b.x, y: b.y + .04, z: b.z, sx: .5 * S, sy: .7, sz: .5 * S, grow: Math.max(2, b.hw * 2.6) * I, growY: -.5, life: .7 * D, delay: N * .022 * .6, pop: .05, hold: .25});
  },
  // B · Montagem de prismas: placas hexagonais luminosas voam de todos os lados (do personagem e do ar) e encaixam num painel de colmeia,
  // cada uma com um clarão ao encaixar; um anel de energia vertical varre a barreira no fim.
  function (o) {
    const {S, D, I, qk, c} = o, b = barrierOf(o), col = mixc(c.color, PL_TINT[(b.pl - 1) | 0] ?? c.color, .45), cols = Math.max(5, Math.round(b.hw * 2 / .34)), rows = Math.max(4, Math.round(b.h / .34));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (qk < 1 && this.rnd() > qk) continue;
      const tx = (i + .5) / cols * 2 - 1 + (j % 2 ? .5 / cols : 0), px = b.x + b.side.x * tx * b.hw, pz = b.z + b.side.z * tx * b.hw, py = b.y + (j + .5) / rows * b.h;
      const ang = this.r(0, Math.PI * 2), rad = this.r(2.2, 4.2), sx0 = b.x - b.dir.x * this.r(1, 3) + Math.cos(ang) * rad * .5, sz0 = b.z - b.dir.z * this.r(1, 3) + Math.sin(ang) * rad * .5, sy0 = py + this.r(-1.2, 1.8), dl = (i * rows + j) * .006 + this.r(0, .12);
      const sz = .2 * S * this.r(.9, 1.1);
      this.spawn({shape: 'prism', mat: 'glow', color: mixc(col, 0xffffff, this.r(0, .5)), x: sx0, y: Math.max(.1, sy0), z: sz0, sx: sz, sy: .035 * S, sz, rx: Math.PI / 2, ry: Math.atan2(b.dir.x, b.dir.z), wz: this.r(-8, 8), to: {x: px, y: py, z: pz}, tt: .42 * D, life: (1 + .1 * this.rnd()) * D, delay: dl, pop: .06, hold: .72});
      // clarão no encaixe
      this.spawn({shape: 'grain', mat: 'glow', color: 0xffffff, x: px, y: py, z: pz, s: .07 * S, grow: 2.2, vx: b.dir.x * .6, vz: b.dir.z * .6, life: .22 * D, delay: dl + .4 * D, pop: .03, hold: .1});
    }
    this.spawn({shape: 'wave', mat: 'glow', color: mixc(col, 0xffffff, .4), x: b.x, y: b.y + b.h / 2, z: b.z, sx: b.hw * .4 * S, sy: b.h * .45 * S, sz: .5 * S, rx: Math.PI / 2, ry: Math.atan2(b.dir.x, b.dir.z), grow: 1.25 * I, growY: 1.1 * I, life: .5 * D, delay: .45 * D, pop: .05, hold: .3});
  },
  // C · Véu de névoa: uma cortina de névoa se tece de uma ponta à outra, sobe até a altura da barreira e ondula; faíscas sobem dela e uma onda
  // rente ao chão se abre. A névoa é uma massa contínua (esferas fundidas) que se dissolve ao fim.
  function (o) {
    const {S, D, I, qk, c} = o, b = barrierOf(o), col = mixc(0xf0f6ff, PL_TINT[(b.pl - 1) | 0] ?? c.color, .18), cols = Math.max(7, Math.round(b.hw * 2 / .28 * qk)), rows = Math.max(4, Math.round(b.h / .34 * qk));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const t = i / (cols - 1) * 2 - 1, x = b.x + b.side.x * t * b.hw, z = b.z + b.side.z * t * b.hw, y = b.y + (j + .5) / rows * b.h, sz = this.r(.28, .4) * S;
      this.spawn({shape: 'lump', mat: 'smoke', color: shade(col, this.r(.96, 1.04)), x, y: Math.max(sz * .5, y - .5), z, s: sz, vx: b.dir.x * this.r(-.15, .35) + b.side.x * this.r(-.2, .2), vz: b.dir.z * this.r(-.15, .35) + b.side.z * this.r(-.2, .2), vy: .5 + j * .12, drag: 2.2, grow: .7, wx: this.r(-1, 1),
        life: (.95 + j * .05) * D, delay: (i * .03) + j * .02, pop: .16, hold: .5, floor: sz * .4, bounce: 0});
    }
    for (let k = 0; k < Math.round(16 * qk); k++) { const t = this.r(-1, 1);
      this.spawn({shape: 'grain', mat: 'glow', color: mixc(c.color, 0xffffff, .5), x: b.x + b.side.x * t * b.hw, y: b.y + this.r(.1, b.h * .8), z: b.z + b.side.z * t * b.hw, s: this.r(.03, .06) * S, vy: this.r(.8, 2) * I, vx: this.r(-.3, .3), vz: this.r(-.3, .3), gy: -.3, life: this.r(.5, .9) * D, delay: (t + 1) * .3, wx: this.r(-6, 6), wz: this.r(-6, 6)}); }
    this.spawn({shape: 'wave', mat: 'glow', color: mixc(col, c.color, .5), x: b.x, y: b.y + .04, z: b.z, sx: .6 * S, sy: .6, sz: .6 * S, grow: Math.max(2, b.hw * 2.2) * I, growY: -.5, life: .6 * D, delay: .15, pop: .05, hold: .25});
  },
];
