// Família: aterrissagem.
// Intensidade pela velocidade vertical real; poeira e ring no chão; suporte futuro a materiais de superfície.

const CELL = {dot: 0, streak: 1, ring: 3, smoke: 8, chunk: 14, crack: 12};
const MODE = {billboard: 0, ground: 1};

const LANDING_COLOR = 0xb4c1cb;
const easeOutCubic = k => 1 - Math.pow(1 - k, 3);

function particle({cell = CELL.dot, mode = MODE.billboard, x = 0, y = 0, z = 0,
  vx = 0, vy = 0, vz = 0, life = 0.4, w = 0.3, h = 0.3, rot = 0, spin = 0,
  color = 0xffffff, alpha = 1, additive = false, fade = 1.6, grow = 0,
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

// --- Variante A: poeira e fumaça volumosa ---
export function buildLandingA(ctx, seed, power = 1) {
  const {position} = ctx;
  const rnd = lcg(seed);
  const I = Math.max(0, Math.min(2, power));
  const parts = [];
  const cnt = Math.round(14 * I * (0.6 + 0.4 * I));
  for (let k = 0; k < cnt; k++) {
    const a = (k / cnt) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
    const sp = 4.0 * (0.6 + rnd() * 0.6) * (0.6 + 0.4 * I);
    parts.push(particle({cell: CELL.smoke, mode: MODE.billboard, additive: false,
      x: position.x, y: 0.15, z: position.z,
      vx: Math.cos(a) * sp, vy: (0.3 + rnd() * 0.7) * 0.6, vz: Math.sin(a) * sp,
      drag: 3.0, life: 0.55 * (0.9 + rnd() * 0.5),
      w: 0.8 * 3 * 1.2 * I, color: LANDING_COLOR, alpha: 0.85, grow: 1.6, fade: 1.3,
      rot: rnd() * Math.PI * 2, spin: -1.5 + rnd() * 3}));
  }
  return parts;
}

// --- Variante B: anel rente ao solo com ondas de choque e decalque ---
export function buildLandingB(ctx, seed, power = 1) {
  const {position} = ctx;
  const rnd = lcg(seed);
  const I = Math.max(0, Math.min(2, power));
  const parts = [];
  for (let k = 0; k < 2; k++) {
    parts.push(particle({cell: k ? CELL.shock : CELL.ring, mode: MODE.ground,
      x: position.x, y: 0.025 + k * 0.005, z: position.z, delay: k * 0.07, life: 0.55,
      w: 0.5 * 1.4, color: LANDING_COLOR, alpha: 0.9, fade: 1.2,
      sizeCurve: k2 => 1 + easeOutCubic(k2) * 4.2 * (0.6 + 0.4 * I), additive: false}));
  }
  parts.push(particle({cell: CELL.crack, mode: MODE.ground, x: position.x, y: 0.02, z: position.z,
    life: 0.55 * 3.5, w: 1.8 * (0.7 + 0.3 * I),
    color: 0x1a2028, alpha: 0.75, additive: false, fade: 2.2, rot: rnd() * Math.PI * 2}));
  return parts;
}

// --- Variante C: fragmentos e estilhaços geométricos ricocheteando ---
export function buildLandingC(ctx, seed, power = 1) {
  const {position} = ctx;
  const rnd = lcg(seed);
  const I = Math.max(0, Math.min(2, power));
  const parts = [];
  const cnt = Math.round(18 * I * (0.6 + 0.4 * I));
  for (let k = 0; k < cnt; k++) {
    const a = rnd() * Math.PI * 2;
    const sp = 4.5 * (0.5 + rnd() * 0.8);
    parts.push(particle({cell: k % 2 ? CELL.chunk : CELL.shard, mode: MODE.billboard, additive: false,
      x: position.x, y: 0.1, z: position.z,
      vx: Math.cos(a) * sp, vy: (1.5 + rnd() * 3.5) * 0.6 * I, vz: Math.sin(a) * sp,
      gravity: 16, floor: 0.03,
      life: 0.55 * 1.5, w: 0.18 + rnd() * 0.12,
      color: LANDING_COLOR, alpha: 0.9, fade: 1.8,
      rot: rnd() * Math.PI * 2, spin: -10 + rnd() * 20}));
  }
  return parts;
}

export const buildLanding = buildLandingA;
export const BUILD_LANDING = [buildLandingA, buildLandingB, buildLandingC];

export const LANDING_DEFS = [
  {
    id: 'landing:ground',
    version: '1.0',
    trigger: 'ground',
    conditions: [],
    priority: 40,
    anchor: 'ground',
    duration: 0.55,
    seed: true,
    variant: 0,
    quality: 'medium',
    limits: {particles: 32, rings: 2, decals: 2},
    aggregation: 'stack',
    maxStack: 3,
    replay: 'full',
    family: 'landing',
    build: buildLandingA,
  },
  {
    id: 'landing:ground',
    version: '1.1',
    trigger: 'ground',
    conditions: [],
    priority: 40,
    anchor: 'ground',
    duration: 0.55,
    seed: true,
    variant: 1,
    quality: 'medium',
    limits: {particles: 16, rings: 3, decals: 2},
    aggregation: 'stack',
    maxStack: 3,
    replay: 'full',
    family: 'landing',
    build: buildLandingB,
  },
  {
    id: 'landing:ground',
    version: '1.2',
    trigger: 'ground',
    conditions: [],
    priority: 40,
    anchor: 'ground',
    duration: 0.55,
    seed: true,
    variant: 2,
    quality: 'medium',
    limits: {particles: 36, rings: 1, decals: 1},
    aggregation: 'stack',
    maxStack: 3,
    replay: 'full',
    family: 'landing',
    build: buildLandingC,
  },
];
