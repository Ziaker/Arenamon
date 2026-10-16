// Família: clash entre tackles.
// Composição simétrica no ponto médio dos combatentes, direção coerente com as trajetórias.

const CELL = {dot: 0, streak: 1, star4: 2, ring: 3, shard: 6, spark: 7, shock: 9};
const MODE = {billboard: 0, ground: 1};

const CLASH_COLOR = 0xffe58d;
const CLASH_COLOR2 = 0xff7a3c;
const easeOutCubic = k => 1 - Math.pow(1 - k, 3);
const easePop = k => k < 0.15 ? k / 0.15 : 1 - 0.25 * (k - 0.15) / 0.85;

function particle({cell = CELL.dot, mode = MODE.billboard, x = 0, y = 0, z = 0,
  vx = 0, vy = 0, vz = 0, life = 0.4, w = 0.3, h = 0.3, rot = 0, spin = 0,
  color = 0xffffff, alpha = 1, additive = true, fade = 1.6, grow = 0,
  gravity = 0, drag = 0, floor = null, sizeCurve = null, stretchCurve = null,
  alphaCurve = null, delay = 0, ax = 0, ay = 0, az = 0} = {}) {
  return {cell, mode, x, y, z, vx, vy, vz, life, w, h, rot, spin, color, alpha,
    additive, fade, grow, gravity, drag, floor, sizeCurve, stretchCurve, alphaCurve,
    delay, ax, ay, az, age: -delay};
}

function lcg(seed) {
  let s = ((seed * 1664525 + 1013904223) >>> 0) | 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 0) / 4294967296; };
}

// Direção perpendicular à normal no plano XZ (para clash simétrico).
function sideDir(normal) {
  return {x: normal.z, y: 0, z: -normal.x};
}

// --- Variant A: explosão central simétrica ---
export function buildClashA(ctx, seed, intensity = 1) {
  const {position, normal} = ctx;
  const y = 0.85;
  const S = 1.2, I = intensity;
  const rnd = lcg(seed);
  const parts = [];
  parts.push(particle({cell: CELL.dot, mode: MODE.billboard, x: position.x, y, z: position.z,
    life: 0.6 * 0.4, w: 1.44, color: 0xffffff, alpha: 1, grow: 1, fade: 1.5, additive: true}));
  parts.push(particle({cell: CELL.shock, mode: MODE.billboard, x: position.x, y, z: position.z,
    life: 0.6, w: 0.6, color: CLASH_COLOR, alpha: 1, fade: 1.3,
    sizeCurve: k => 1 + easeOutCubic(k) * 1.6 * 2.4, additive: true}));
  parts.push(particle({cell: CELL.ring, mode: MODE.ground, x: position.x, y: 0.03, z: position.z,
    life: 0.6, w: 0.6, color: CLASH_COLOR, alpha: 0.9, fade: 1.3,
    sizeCurve: k => 1 + easeOutCubic(k) * 1.6 * 2.6, additive: true}));
  const cnt = Math.round(30 * I);
  const side = sideDir(normal);
  for (let k = 0; k < cnt; k++) {
    const sgn = k % 2 ? 1 : -1;
    const a = -0.9 + rnd() * 1.8;
    const d = {x: sgn * (normal.x * Math.cos(a) - normal.z * Math.sin(a)),
               z: sgn * (normal.z * Math.cos(a) + normal.x * Math.sin(a))};
    const sp = 7 * (0.6 + rnd() * 0.6);
    parts.push(particle({cell: CELL.streak, mode: MODE.axis,
      x: position.x, y, z: position.z,
      vx: d.x * sp, vy: (-0.5 + rnd() * 3), vz: d.z * sp, drag: 3,
      life: 0.6 * (0.6 + rnd() * 0.4), w: 0.084, h: 0.6,
      ax: d.x, ay: 0.1, az: d.z,
      color: sgn > 0 ? CLASH_COLOR : CLASH_COLOR2, alpha: 1, fade: 1.3, additive: true}));
  }
  return parts;
}

// --- Variant B: cruzamento de energia em X ---
export function buildClashB(ctx, seed, intensity = 1) {
  const {position, normal} = ctx;
  const y = 0.85;
  const S = 1.2, I = intensity;
  const rnd = lcg(seed);
  const side = sideDir(normal);
  const parts = [];
  for (const sgn of [1, -1]) {
    const ax = {x: normal.x * 0.7 + side.x * 0.7 * sgn, y: 0.7 * sgn, z: normal.z * 0.7 + side.z * 0.7 * sgn};
    parts.push(particle({cell: CELL.streak, mode: MODE.axis, x: position.x, y, z: position.z,
      life: 0.6 * 0.7, w: 0.168, h: 1.6 * 2.2 * S,
      ax: ax.x, ay: ax.y, az: ax.z,
      color: sgn > 0 ? CLASH_COLOR : CLASH_COLOR2, alpha: 1, fade: 1.4,
      stretchCurve: k => 0.3 + easeOutCubic(Math.min(1, k * 3)) * 0.9, additive: true}));
  }
  parts.push(particle({cell: CELL.star4, mode: MODE.billboard, x: position.x, y, z: position.z,
    life: 0.6 * 0.4, w: 1.8, color: 0xffffff, alpha: 1, rot: Math.PI / 4,
    sizeCurve: easePop, fade: 1.2, additive: true}));
  const cnt = Math.round(30 * 0.7 * I);
  for (let k = 0; k < cnt; k++) {
    const a = rnd() * Math.PI * 2;
    const sp = 7 * (0.4 + rnd() * 0.6);
    parts.push(particle({cell: CELL.spark, mode: MODE.billboard, x: position.x, y, z: position.z,
      vx: Math.cos(a) * sp, vy: rnd() * 3, vz: Math.sin(a) * sp,
      gravity: 9, drag: 1.5, life: 0.6, w: 0.096,
      color: k % 2 ? CLASH_COLOR : CLASH_COLOR2, alpha: 1, fade: 1.6, additive: true}));
  }
  return parts;
}

// --- Variant C: compressão + liberação ---
export function buildClashC(ctx, seed, intensity = 1) {
  const {position} = ctx;
  const y = 0.85;
  const S = 1.2, I = intensity;
  const hold = 0.6 * 0.3;
  const rnd = lcg(seed);
  const parts = [];
  parts.push(particle({cell: CELL.dot, mode: MODE.billboard, x: position.x, y, z: position.z,
    life: hold, w: 1.56 * 1.6 * 0.6, color: CLASH_COLOR2, alpha: 1,
    alphaCurve: k => 0.5 + 0.5 * k,
    sizeCurve: k => 1 - 0.7 * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
    additive: true}));
  return {parts, hold, onRelease: (ctx2, seed2) => {
    const rnd2 = lcg(seed2);
    const out = [];
    for (let k = 0; k < 3; k++) {
      out.push(particle({cell: k === 0 ? CELL.shock : CELL.ring, mode: MODE.billboard,
        x: position.x, y, z: position.z, delay: k * 0.05, life: 0.6 * 0.7, w: 0.48,
        color: k % 2 ? CLASH_COLOR2 : CLASH_COLOR, alpha: 1, fade: 1.2,
        sizeCurve: k2 => 1 + easeOutCubic(k2) * 1.6 * 7 * 0.35, additive: true}));
    }
    const cnt = Math.round(30 * I);
    for (let k = 0; k < cnt; k++) {
      const a = rnd2() * Math.PI * 2;
      const sp = 7 * (0.6 + rnd2() * 0.8);
      out.push(particle({cell: k % 2 ? CELL.shard : CELL.diamond, mode: MODE.billboard,
        x: position.x, y, z: position.z,
        vx: Math.cos(a) * sp, vy: -1 + rnd2() * 5, vz: Math.sin(a) * sp,
        gravity: 8, drag: 2, life: 0.6 * (0.6 + rnd2() * 0.4),
        w: (0.08 + rnd2() * 0.08),
        color: k % 2 ? CLASH_COLOR : CLASH_COLOR2, alpha: 1, fade: 1.5,
        rot: rnd2() * Math.PI * 2, spin: -12 + rnd2() * 24, additive: true}));
    }
    return out;
  }};
}

export const CLASH_DEFS = [
  {
    id: 'clash:clash',
    version: '1.0',
    trigger: 'clash',
    conditions: [],
    priority: 90,
    anchor: 'midpoint',
    duration: 0.6,
    seed: true,
    variant: 0,
    quality: 'medium',
    limits: {particles: 48, rings: 2, lights: 1},
    aggregation: 'none',
    replay: 'full',
    family: 'clash',
    build: buildClashA,
  },
  {
    id: 'clash:clash',
    version: '1.1',
    trigger: 'clash',
    conditions: [],
    priority: 90,
    anchor: 'midpoint',
    duration: 0.6,
    seed: true,
    variant: 1,
    quality: 'medium',
    limits: {particles: 48, rings: 2, lights: 1},
    aggregation: 'none',
    replay: 'full',
    family: 'clash',
    build: buildClashB,
  },
  {
    id: 'clash:clash',
    version: '1.2',
    trigger: 'clash',
    conditions: [],
    priority: 90,
    anchor: 'midpoint',
    duration: 0.6,
    seed: true,
    variant: 2,
    quality: 'medium',
    limits: {particles: 48, rings: 2, lights: 1},
    aggregation: 'none',
    replay: 'full',
    family: 'clash',
    build: buildClashC,
    // buildClashC retorna {parts, hold, onRelease}; tratado pelo runtime como efeito com liberação diferida.
  },
];
