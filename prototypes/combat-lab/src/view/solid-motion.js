// VFX sólidos de movimento: geometrias procedurais (nuvens em volumes, cunhas curvas, tubos afilados de vento) e os estilos de
// poeira e vento para dash/esquiva e para a corrida contínua (sprint). Formas originais: nada de sprites, planos ou texturas.
// Os construtores rodam com `this` = SolidFx e só criam objetos 3D instanciados via this.spawn().
import * as T from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shade = (hex, k) => { const c = new T.Color(hex); c.multiplyScalar(k); return c.getHex(); };
const mixc = (a, b, k) => new T.Color(a).lerp(new T.Color(b), k).getHex();
const yawOf = d => Math.atan2(d.x, d.z);

/** Tubo afilado ao longo de uma curva (eixo local +Z): sólido fechado, fino nas duas pontas. */
function taperedTube(path, N = 20, ring = 6, R = .05, taper = .7) {
  const pts = [], pos = [], idx = [];
  for (let i = 0; i <= N; i++) pts.push(path(i / N));
  for (let i = 0; i <= N; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)], t = new T.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
    const up = Math.abs(t.y) > .9 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0), n1 = new T.Vector3().crossVectors(up, t).normalize(), n2 = new T.Vector3().crossVectors(t, n1);
    const r = R * Math.pow(Math.sin(Math.PI * clamp(i / N, .03, .97)), taper);
    for (let j = 0; j < ring; j++) { const an = j / ring * Math.PI * 2; pos.push(pts[i].x + (n1.x * Math.cos(an) + n2.x * Math.sin(an)) * r, pts[i].y + (n1.y * Math.cos(an) + n2.y * Math.sin(an)) * r, pts[i].z + (n1.z * Math.cos(an) + n2.z * Math.sin(an)) * r); }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < ring; j++) { const a = i * ring + j, b = i * ring + (j + 1) % ring, c = (i + 1) * ring + j, d = (i + 1) * ring + (j + 1) % ring; idx.push(a, c, b, b, c, d); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // Normais para fora? Confere num vértice do meio e inverte a orientação das faces se preciso.
  const m = Math.floor(N / 2) * ring, p = new T.Vector3().fromArray(pos, m * 3), c0 = new T.Vector3(pts[Math.floor(N / 2)].x, pts[Math.floor(N / 2)].y, pts[Math.floor(N / 2)].z), nn = new T.Vector3().fromBufferAttribute(g.attributes.normal, m);
  if (nn.dot(p.sub(c0)) < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  g.computeBoundingBox(); return g;
}

export const MOTION_SHAPES = {
  // Volume macio (nuvem de poeira): icosaedro subdividido e deformado, normais suaves.
  lump: () => { let g = new T.IcosahedronGeometry(.5, 2); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), s = 1 + .14 * Math.sin(x * 9.1 + z * 5.3) * Math.cos(y * 7.7 + x * 3.1); p.setXYZ(i, x * s, y * (.9 + .1 * s), z * s); } g.computeVertexNormals(); return g; },
  // Meia-lua extrudada (faixa curva com espessura): convexa para trás (-Z), ocupa a largura em X; a altura vem da extrusão.
  crescent: () => {
    const sh = new T.Shape(), N = 14, deg = a => a * Math.PI / 180; sh.moveTo(Math.cos(deg(-80)), Math.sin(deg(-80)));
    for (let k = 1; k <= N; k++) { const a = deg(-80 + 160 * k / N); sh.lineTo(Math.cos(a), Math.sin(a)); }
    for (let k = N; k >= 0; k--) { const a = deg(-80 + 160 * k / N); sh.lineTo(-.25 + .9 * Math.cos(a), .9 * Math.sin(a)); }
    const g = new T.ExtrudeGeometry(sh, {depth: .3, bevelEnabled: true, bevelThickness: .04, bevelSize: .035, bevelSegments: 2, curveSegments: 6});
    g.rotateX(-Math.PI / 2); g.rotateY(Math.PI / 2); g.translate(0, -.15, .35); g.computeVertexNormals(); return g;
  },
  // Meio toro em pé (arco volumétrico), plano XY, normal +Z.
  arch: () => new T.TorusGeometry(1, .1, 7, 22, Math.PI),
  // Fita de vento em S (eixo +Z, comprimento 1).
  windArc: () => taperedTube(t => ({x: .2 * Math.sin(2 * Math.PI * t), y: .05 * Math.sin(Math.PI * t), z: t}), 22, 6, .045, .65),
  // Hélice de vento em torno do eixo +Z.
  windSpiral: () => taperedTube(t => { const a = 2 * Math.PI * 1.8 * t, r = .24 * (.45 + .55 * Math.sin(Math.PI * t)); return {x: r * Math.cos(a), y: r * Math.sin(a), z: t}; }, 30, 6, .04, .6),
  // Gancho de vento: reto e termina num caracol no plano XZ.
  windCurl: () => taperedTube(t => { if (t < .55) return {x: .03 * Math.sin(Math.PI * t / .55), y: 0, z: t * .8}; const u = (t - .55) / .45, th = u * 1.5 * Math.PI, rad = .24 * (1 - .6 * u); return {x: rad * (1 - Math.cos(th)), y: 0, z: .44 + rad * Math.sin(th)}; }, 30, 6, .045, .6),
};

// ---------------------------------------------------------------------------------------------------------------------
// Poeira de dash/esquiva — estilos novos (índices 4–7 de solidDust). ctx: {c, f, s, phase, dir, side, feet, I, S, D, qk, t, col, col2}
const centre = (f, dir, back) => ({x: f.position.x - dir.x * back, z: f.position.z - dir.z * back});
export const DUST_NEW = [
  // E · Ondas em camadas: faixas curvas empilhadas que sobem e se abrem para trás, com bolsas de poeira na base.
  function ({phase, f, dir, I, S, D, qk, t, col}) {
    const tiers = phase === 'dash' ? (Math.round(t * 34) % 5 === 0 ? 2 : 0) : phase === 'start' ? 4 : 3;
    for (let k = 0; k < tiers; k++) {
      const p = centre(f, dir, .18 + .2 * k);
      this.spawn({shape: 'crescent', mat: 'puff', color: shade(col, 1.18 - .13 * k), x: p.x, y: .02, z: p.z, sx: (.26 + .08 * k) * S, sy: (.8 + .3 * k) * S, sz: (.26 + .08 * k) * S, ry: yawOf(dir) + this.r(-.12, .12),
        vx: -dir.x * (2.6 - .5 * k) * I * (phase === 'stop' ? -.5 : 1), vz: -dir.z * (2.6 - .5 * k) * I * (phase === 'stop' ? -.5 : 1), vy: .4 + .25 * k, gy: -.6, drag: 2.3, grow: 1.7, growY: .6, life: (.62 + .1 * k) * D, pop: .09, hold: .35, delay: k * .045});
    }
    for (let k = 0; k < Math.round((phase === 'dash' ? 1 : 3) * qk); k++) { const p = centre(f, dir, .1), sz = this.r(.1, .17) * S;
      this.spawn({shape: 'lump', mat: 'puff', color: shade(col, this.r(.9, 1.1)), x: p.x + this.r(-.15, .15), y: sz * .4, z: p.z + this.r(-.15, .15), s: sz, vx: -dir.x * this.r(.6, 1.6), vz: -dir.z * this.r(.6, 1.6), vy: .3, drag: 2, grow: 1.1, life: .6 * D, floor: sz * .3, bounce: 0}); }
  },
  // F · Nuvem rolante: volumes grandes e macios que rolam rente ao chão, inchando devagar.
  function ({phase, f, dir, side, I, S, D, qk, t, col}) {
    const n = Math.max(1, Math.round((phase === 'dash' ? (Math.round(t * 34) % 3 === 0 ? 2 : 0) : phase === 'start' ? 8 : 6) * I * qk));
    for (let k = 0; k < n; k++) { const p = centre(f, dir, this.r(0, .3)), sz = this.r(.17, .32) * S, sd = this.r(-.5, .5);
      this.spawn({shape: 'lump', mat: 'puff', color: shade(col, this.r(.85, 1.15)), x: p.x + side.x * sd, y: sz * .5, z: p.z + side.z * sd, s: sz, sy: sz * .85, vx: -dir.x * this.r(.9, 2.3) * I * (phase === 'stop' ? -.6 : 1) + side.x * sd, vz: -dir.z * this.r(.9, 2.3) * I * (phase === 'stop' ? -.6 : 1) + side.z * sd,
        vy: this.r(0, .35), drag: 1.3, wx: this.r(-3, 3) * 2, wz: this.r(-3, 3), grow: .85, life: this.r(.9, 1.35) * D, pop: .16, hold: .3, floor: sz * .35, bounce: 0}); }
  },
  // G · Anel de nuvem: coroa de volumes que se abre em círculo ao redor dos pés e escorre para trás.
  function ({phase, f, dir, I, S, D, qk, t, col}) {
    if (phase === 'dash' && Math.round(t * 34) % 6 !== 0) return;
    const N = Math.max(5, Math.round((phase === 'dash' ? 7 : 10) * qk)), R0 = phase === 'dash' ? .1 : .16;
    this.spawn({shape: 'wave', mat: 'puff', color: shade(col, 1.1), x: f.position.x, y: .045, z: f.position.z, sx: R0 * 1.6 * S, sy: 1.4, sz: R0 * 1.6 * S, grow: 4.4 * I, growY: -.4, life: .5 * D, pop: .06, hold: .25});
    for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2 + this.r(-.1, .1), sz = this.r(.12, .2) * S * (phase === 'dash' ? .8 : 1.15);
      this.spawn({shape: 'lump', mat: 'puff', color: shade(col, this.r(.9, 1.15)), x: f.position.x + Math.cos(a) * R0, y: sz * .5, z: f.position.z + Math.sin(a) * R0, s: sz, vx: Math.cos(a) * this.r(1.2, 2.2) * I - dir.x * .9, vz: Math.sin(a) * this.r(1.2, 2.2) * I - dir.z * .9,
        vy: this.r(.3, .9), gy: 1.2, drag: 2.1, grow: .9, life: this.r(.6, .9) * D, pop: .1, hold: .3, floor: sz * .3, bounce: 0}); }
  },
  // H · Coluna em espiral: volumes sobem girando em hélice e a ponta se enrola; a coluna acompanha o deslocamento.
  function ({phase, f, dir, I, S, D, qk, t, col}) {
    if (phase === 'dash' && Math.round(t * 34) % 4 !== 0) return;
    const N = Math.max(4, Math.round((phase === 'dash' ? 5 : 9) * qk)), c = centre(f, dir, .25);
    for (let k = 0; k < N; k++) { const sz = this.r(.1, .17) * S;
      this.spawn({shape: 'lump', mat: 'puff', color: shade(col, 1.05 + k * .02), x: c.x, y: .05, z: c.z, s: sz, orb: {cx: c.x, cz: c.z, vx: -dir.x * 1.2 * I, vz: -dir.z * 1.2 * I, a0: k * .85, w: 6 + 3 * I, r0: .12, r1: .34 + k * .035, y0: .05 + k * .04, rise: 1.2 + k * .1},
        grow: .7, life: (.75 + k * .02) * D, pop: .08, hold: .45}); }
  },
];

// ---------------------------------------------------------------------------------------------------------------------
// Vento de dash/esquiva (solidWind, 4 estilos). Posições na altura do corpo; direção real do deslocamento.
const rev = ph => ph === 'stop' ? -1 : 1;
export const WIND = [
  // A · Fitas em S: tiras longas e curvas que escorrem para trás ao lado do corpo.
  function ({phase, f, dir, side, I, S, D, qk, t, col}) {
    if (phase === 'dash' && Math.round(t * 34) % 3 !== 0) return;
    const n = Math.max(2, Math.round((phase === 'dash' ? 2 : phase === 'start' ? 6 : 4) * qk));
    for (let k = 0; k < n; k++) { const sd = (k % 2 ? 1 : -1) * this.r(.3, .65), len = this.r(1.1, 2) * S;
      this.spawn({shape: 'windArc', mat: 'wind', color: mixc(col, 0xffffff, this.r(0, .4)), x: f.position.x + side.x * sd - dir.x * .2, y: this.r(.2, 1.25), z: f.position.z + side.z * sd - dir.z * .2, sx: (.9 + .5 * S) * 1, sy: 1, sz: len,
        ry: yawOf(dir) + (rev(phase) < 0 ? Math.PI : 0), rz: this.r(-.5, .5), vx: -dir.x * rev(phase) * this.r(4, 8) * I, vz: -dir.z * rev(phase) * this.r(4, 8) * I, drag: 2.6, growL: .5, life: this.r(.3, .46) * D, pop: .05, hold: .3, delay: k * .012}); }
  },
  // B · Espirais: hélices que giram em torno do próprio eixo e se alargam enquanto ficam para trás.
  function ({phase, f, dir, I, S, D, qk, t, col}) {
    if (phase === 'dash' && Math.round(t * 34) % 4 !== 0) return;
    const n = Math.max(1, Math.round((phase === 'dash' ? 1 : phase === 'start' ? 3 : 2) * qk));
    for (let k = 0; k < n; k++)
      this.spawn({shape: 'windSpiral', mat: 'wind', color: mixc(col, 0xffffff, this.r(0, .35)), x: f.position.x - dir.x * (.3 + k * .3), y: this.r(.4, 1.1), z: f.position.z - dir.z * (.3 + k * .3), sx: (1 + .3 * k) * S, sy: (1 + .3 * k) * S, sz: this.r(1.1, 1.8) * S,
        ry: yawOf(dir) + (rev(phase) < 0 ? Math.PI : 0), wz: (k % 2 ? 1 : -1) * this.r(6, 11), vx: -dir.x * rev(phase) * this.r(3, 6) * I, vz: -dir.z * rev(phase) * this.r(3, 6) * I, drag: 2.2, grow: .9, growL: .35, life: this.r(.42, .6) * D, pop: .06, hold: .3, delay: k * .03});
  },
  // C · Ganchos rentes ao chão: caracóis de vento junto a cada pé, abrindo para fora.
  function ({phase, dir, side, feet, I, S, D, qk, t, col}) {
    if (phase === 'dash' && Math.round(t * 34) % 3 !== 0) return;
    feet.forEach((ft, i) => { const out = i ? 1 : -1;
      this.spawn({shape: 'windCurl', mat: 'wind', color: mixc(col, 0xffffff, .25), x: ft.x, y: this.r(.06, .22), z: ft.z, sx: S * 1.6, sy: S * 1.6, sz: this.r(1.2, 1.9) * S, ry: yawOf(dir) + (rev(phase) < 0 ? Math.PI : 0), rz: out > 0 ? Math.PI : 0,
        vx: -dir.x * rev(phase) * this.r(3, 6) * I + side.x * out * .6, vz: -dir.z * rev(phase) * this.r(3, 6) * I + side.z * out * .6, drag: 2.4, growL: .6, life: this.r(.34, .5) * D, pop: .05, hold: .3}); });
    if (phase !== 'dash') for (let k = 0; k < Math.round(3 * qk); k++) this.spawn({shape: 'windCurl', mat: 'wind', color: col, x: feet[0].x, y: .1 + .1 * k, z: feet[0].z, s: S * 1.3, sz: 1.2 * S, ry: yawOf(dir) + k * 2, vx: -dir.x * 4 * I, vz: -dir.z * 4 * I, drag: 2.4, life: .42 * D, delay: k * .03});
  },
  // D · Cunha de rajadas: leque em V de cones longos que partem do corpo para trás.
  function ({phase, f, dir, I, S, D, qk, t, col}) {
    if (phase === 'dash' && Math.round(t * 34) % 4 !== 0) return;
    const n = Math.max(2, Math.round((phase === 'dash' ? 4 : 8) * qk));
    for (let k = 0; k < n; k++) { const ang = (k % 2 ? 1 : -1) * (.12 + Math.floor(k / 2) * .13), sp = this.r(6, 10) * I * rev(phase), ca = Math.cos(ang), sa = Math.sin(ang), bx = -dir.x * ca - dir.z * sa, bz = -dir.z * ca + dir.x * sa;
      this.spawn({shape: 'spike', mat: 'wind', color: mixc(col, 0xffffff, this.r(0, .5)), x: f.position.x + bx * .3, y: this.r(.35, 1.1), z: f.position.z + bz * .3, sx: .06 * S, sy: this.r(.9, 1.5) * S, sz: .06 * S, vx: bx * sp, vz: bz * sp, align: true, drag: 3, life: this.r(.28, .42) * D, pop: .04, hold: .3, delay: k * .008}); }
  },
];

// ---------------------------------------------------------------------------------------------------------------------
// Corrida contínua (sprint): chamados a cada tick de emissão enquanto corre/desacelera. ctx: {f, s, dir, side, feet, foot, sp, turn, taper, n, I, S, D, qk, col}
// `sp` = velocidade normalizada (~0.4–1.8); `turn` = taxa de giro (rad/s, + vira para o lado direito); `taper` = 0..1 durante a desaceleração.
export const RUN_DUST = [
  // A · Pegadas de poeira: cada passada levanta volumes pequenos e grãos, mais forte no pé de fora da curva.
  function ({f, dir, side, feet, foot, sp, turn, taper, n, I, S, D, qk, col}) {
    const ft = feet[foot], out = -Math.sign(turn) * clamp(Math.abs(turn) * .5, 0, 1.6), k = Math.max(1, Math.round((2 + sp) * qk * taper));
    for (let i = 0; i < k; i++) { const sz = this.r(.06, .12) * S * (i ? .6 : 1);
      this.spawn({shape: i ? 'grain' : 'lump', mat: i ? 'lit' : 'puff', color: shade(col, this.r(.8, 1.15)), x: ft.x, y: .03, z: ft.z, s: sz, vx: -dir.x * (1 + 2.2 * sp) * this.r(.6, 1) + side.x * (out + this.r(-.5, .5)), vz: -dir.z * (1 + 2.2 * sp) * this.r(.6, 1) + side.z * (out + this.r(-.5, .5)),
        vy: this.r(.5, 1.5 + sp), gy: 12, drag: 1.4, grow: i ? 0 : .8, wx: this.r(-10, 10), wz: this.r(-10, 10), life: this.r(.4, .75) * D, floor: .03, bounce: .15, hold: .5}); }
  },
  // B · Nuvem contínua: um fio de volumes largos e baixos que incham e se arrastam atrás — o comprimento da cauda cresce com a velocidade.
  function ({f, dir, side, sp, turn, taper, n, I, S, D, qk, col}) {
    const c = {x: f.position.x - dir.x * .35, z: f.position.z - dir.z * .35}, sz = this.r(.2, .32) * S * (.55 + .5 * sp) * (.4 + .6 * taper), lat = clamp(turn * .35, -1, 1) * -1;
    this.spawn({shape: 'lump', mat: 'puff', color: shade(col, this.r(.9, 1.12)), x: c.x + side.x * this.r(-.15, .15), y: sz * .5, z: c.z + side.z * this.r(-.15, .15), s: sz, sy: sz * .8, vx: -dir.x * (.8 + 1.2 * sp) + side.x * lat, vz: -dir.z * (.8 + 1.2 * sp) + side.z * lat, vy: .25,
      drag: 1.1, grow: 1.5, wx: this.r(-2, 2), life: (.8 + .3 * sp) * D, pop: .2, hold: .25, floor: sz * .3, bounce: 0});
  },
  // C · Sulcos rolantes: pequenas ondas curvas se abrem no chão a cada passada, inclinadas pela curva.
  function ({f, dir, side, feet, foot, sp, turn, taper, n, I, S, D, qk, col}) {
    const ft = feet[foot], sz = (.16 + .12 * sp) * S * (.4 + .6 * taper);
    this.spawn({shape: 'crescent', mat: 'puff', color: shade(col, this.r(.95, 1.2)), x: ft.x - dir.x * .15, y: .02, z: ft.z - dir.z * .15, sx: sz, sy: .9 * S, sz, ry: yawOf(dir) + clamp(turn * .25, -.5, .5), vx: -dir.x * (1.2 + 1.4 * sp) - side.x * clamp(turn * .4, -1, 1), vz: -dir.z * (1.2 + 1.4 * sp) - side.z * clamp(turn * .4, -1, 1),
      vy: .3, drag: 2.4, grow: 1.9, growY: .5, life: this.r(.5, .75) * D, pop: .07, hold: .3});
  },
];
export const RUN_WIND = [
  // A · Fitas laterais: tiras curvas saem dos ombros e se esticam atrás; a curvatura segue o giro.
  function ({f, dir, side, sp, turn, taper, n, I, S, D, qk, col}) {
    if (n % 2) return;
    for (const sg of [-1, 1]) this.spawn({shape: 'windArc', mat: 'wind', color: mixc(col, 0xffffff, this.r(.1, .4)), x: f.position.x + side.x * sg * .45, y: this.r(.65, 1.05), z: f.position.z + side.z * sg * .45, sx: S * (.8 + .3 * sp), sy: 1, sz: (1.2 + 1.1 * sp) * S * (.4 + .6 * taper),
      ry: yawOf(dir), rz: clamp(turn * .3, -.6, .6) + (sg < 0 ? Math.PI : 0), vx: -dir.x * (2 + 2 * sp), vz: -dir.z * (2 + 2 * sp), drag: 1.8, growL: .35, life: (.34 + .1 * sp) * D, pop: .05, hold: .3});
  },
  // B · Espirais de esteira: hélices que ficam girando atrás do corredor, maiores quanto mais rápido.
  function ({f, dir, sp, turn, taper, n, I, S, D, qk, col}) {
    if (n % 4) return;
    this.spawn({shape: 'windSpiral', mat: 'wind', color: mixc(col, 0xffffff, .3), x: f.position.x - dir.x * .4, y: this.r(.5, 1), z: f.position.z - dir.z * .4, sx: S * (.7 + .5 * sp), sy: S * (.7 + .5 * sp), sz: (1 + 1.2 * sp) * S * (.4 + .6 * taper), ry: yawOf(dir) + clamp(turn * .2, -.5, .5), wz: this.r(6, 11) * (n % 8 ? 1 : -1),
      vx: -dir.x * (2 + 2 * sp), vz: -dir.z * (2 + 2 * sp), drag: 1.6, grow: .8, life: (.45 + .15 * sp) * D, pop: .06, hold: .3});
  },
  // C · Arcos de corrente: meios-toros em pé nascem atrás do tronco e se alargam como ondas de pressão.
  function ({f, dir, sp, turn, taper, n, I, S, D, qk, col}) {
    if (n % 3) return;
    this.spawn({shape: 'arch', mat: 'wind', color: mixc(col, 0xffffff, .2), x: f.position.x - dir.x * .5, y: .02, z: f.position.z - dir.z * .5, sx: .5 * S * (.7 + .4 * sp), sy: .75 * S * (.7 + .4 * sp), sz: .5 * S, ry: yawOf(dir) + clamp(turn * .25, -.6, .6),
      vx: -dir.x * (2 + 1.6 * sp), vz: -dir.z * (2 + 1.6 * sp), drag: 1.8, grow: 1.2, growY: 1, life: (.4 + .1 * sp) * D * (.5 + .5 * taper), pop: .05, hold: .3});
  },
];
