// Família: defesa (bloqueio parcial e defesa perfeita).
// build(ctx, seed) retorna descritores de partículas (dados declarativos).

const CELL = {dot: 0, streak: 1, star4: 2, ring: 3, hex: 13, arc: 15, spark: 7};
const MODE = {billboard: 0, ground: 1, plane: 3};

const PARTIAL_COLOR = 0x73caff;
const PERFECT_COLOR = 0x9dffd2;
const PERFECT_COLOR2 = 0xffffff;
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

// Ponto à frente do defensor (oposto à normal do golpe).
function frontOf(pos, n, d = 0.55) {
  return {x: pos.x - n.x * d, y: pos.y, z: pos.z - n.z * d};
}

// Eixo do escudo voltado para a câmera (fallback: direção oposta à normal).
function shieldAxis(p, n, camera) {
  let ax = -n.x, az = -n.z;
  if (camera) {
    const cx = camera.position.x - p.x, cz = camera.position.z - p.z, dm = Math.hypot(cx, cz) || 1;
    ax = ax * 0.5 + cx / dm * 0.5; az = az * 0.5 + cz / dm * 0.5;
    const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
  }
  return {ax, ay: 0, az};
}

// --- Bloqueio parcial (variant 0): faíscas defensivas no ponto de contato ---
export function buildBlockA(ctx, seed, intensity = 1) {
  const {position, normal, camera} = ctx;
  const p = frontOf(position, normal, 0.55);
  const y = 0.8;
  const rnd = lcg(seed);
  const cnt = Math.round(10 * intensity);
  const parts = [];
  parts.push(particle({cell: CELL.spark, mode: MODE.billboard, x: p.x, y, z: p.z,
    life: 0.15, w: 0.5, color: PARTIAL_COLOR, alpha: 0.75, grow: 1, additive: true}));
  for (let k = 0; k < cnt; k++) {
    const spread = rnd() * 2 - 1;
    const sp = (3 + rnd() * 3) * intensity;
    parts.push(particle({cell: CELL.streak, mode: MODE.axis,
      x: p.x, y, z: p.z,
      vx: (-normal.x + spread * normal.z * 0.9) * sp,
      vy: (0.5 + rnd() * 2.5),
      vz: (-normal.z - spread * normal.x * 0.9) * sp,
      gravity: 14, drag: 3,
      life: 0.3 * (0.8 + rnd() * 0.6), w: 0.05, h: 0.22,
      ax: -normal.x, ay: 0.3, az: -normal.z,
      color: PARTIAL_COLOR, alpha: 0.75, fade: 1.5, additive: true}));
  }
  return parts;
}

// --- Bloqueio parcial (variant 1): escudo translúcido curvo ---
export function buildBlockB(ctx, seed, intensity = 1) {
  const {position, normal, camera} = ctx;
  const p = frontOf(position, normal, 0.5);
  const sa = shieldAxis(p, normal, camera);
  const parts = [];
  parts.push(particle({cell: CELL.arc, mode: MODE.plane, x: p.x, y: 0.75, z: p.z,
    life: 0.3, w: 1.5, h: 1.3, rot: 0,
    ax: sa.ax, ay: sa.ay, az: sa.az,
    color: PARTIAL_COLOR, alpha: 0.75,
    alphaCurve: k => k < 0.15 ? k / 0.15 : Math.pow(1 - (k - 0.15) / 0.85, 1.5),
    sizeCurve: k => 1 + 0.15 * intensity * k, additive: true}));
  parts.push(particle({cell: CELL.hex, mode: MODE.plane, x: p.x, y: 0.75, z: p.z,
    life: 0.18, w: 1.1, h: 1,
    ax: sa.ax, ay: sa.ay, az: sa.az,
    color: 0xffffff, alpha: 0.75 * 0.45, fade: 2, additive: true}));
  const cnt = Math.round(10 * 0.4);
  for (let k = 0; k < cnt; k++) {
    parts.push(particle({cell: CELL.dot, mode: MODE.billboard,
      x: p.x + (rnd() * 2 - 1) * 0.4 * normal.z, y: 0.3 + rnd() * 0.9, z: p.z - (rnd() * 2 - 1) * 0.4 * normal.x,
      vx: -normal.x * 1.5, vz: -normal.z * 1.5, drag: 4,
      life: 0.3 * 0.8, w: 0.06,
      color: PARTIAL_COLOR, alpha: 0.75, fade: 1.5, additive: true}));
  }
  return parts;
}

// --- Defesa perfeita (variant 0): flash intenso + anel de choque + partículas ---
export function buildPerfectA(ctx, seed, intensity = 1) {
  const {position, normal, camera} = ctx;
  const p = frontOf(position, normal, 0.45);
  const y = 0.8;
  const S = 1.2, I = intensity;
  const rnd = lcg(seed);
  const parts = [];
  parts.push(particle({cell: CELL.star4, mode: MODE.billboard, x: p.x, y, z: p.z,
    life: 0.55 * 0.35, w: 1.68, color: PERFECT_COLOR2, alpha: 1, grow: 1.5, fade: 1.4, rot: rnd(), additive: true}));
  parts.push(particle({cell: CELL.shock, mode: MODE.billboard, x: p.x, y, z: p.z,
    life: 0.55, w: 0.6, color: PERFECT_COLOR, alpha: 1, fade: 1.4,
    sizeCurve: k => 1 + easeOutCubic(k) * 2.4 * 2, additive: true}));
  parts.push(particle({cell: CELL.ring, mode: MODE.ground, x: position.x, y: 0.03, z: position.z,
    life: 0.55 * 1.2, w: 0.72, color: PERFECT_COLOR, alpha: 0.9, fade: 1.4,
    sizeCurve: k => 1 + easeOutCubic(k) * 2.4 * 2.4, additive: true}));
  const cnt = Math.round(26 * I);
  for (let k = 0; k < cnt; k++) {
    const a = rnd() * Math.PI * 2, e = -0.4 + rnd() * 1.3, sp = (4 + rnd() * 5) * I;
    parts.push(particle({cell: CELL.streak, mode: MODE.axis,
      x: p.x, y, z: p.z,
      vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp, vz: Math.sin(a) * Math.cos(e) * sp,
      drag: 3.5, life: 0.55 * (0.7 + rnd() * 0.5), w: 0.091, h: 0.48,
      ax: Math.cos(a), ay: Math.sin(e), az: Math.sin(a),
      color: k % 3 ? PERFECT_COLOR : PERFECT_COLOR2, alpha: 1, fade: 1.4, additive: true}));
  }
  return parts;
}

export const BUILD_BLOCK = [buildBlockA, buildBlockB];
export const BUILD_PERFECT = [buildPerfectA];

export const DEFENSE_DEFS = [
  {
    id: 'defense:block',
    version: '1.0',
    trigger: 'partial',
    conditions: [],
    priority: 60,
    anchor: 'contact',
    duration: 0.3,
    seed: true,
    variant: 0,
    quality: 'medium',
    limits: {particles: 24},
    aggregation: 'none',
    replay: 'full',
    family: 'defense',
    build: buildBlockA,
  },
  {
    id: 'defense:block',
    version: '1.1',
    trigger: 'partial',
    conditions: [],
    priority: 60,
    anchor: 'contact',
    duration: 0.3,
    seed: true,
    variant: 1,
    quality: 'medium',
    limits: {particles: 24},
    aggregation: 'none',
    replay: 'full',
    family: 'defense',
    build: buildBlockB,
  },
  {
    id: 'defense:perfect',
    version: '1.0',
    trigger: 'perfect',
    conditions: [],
    priority: 80,
    anchor: 'contact',
    duration: 0.55,
    seed: true,
    variant: 0,
    quality: 'medium',
    limits: {particles: 40, lights: 1},
    aggregation: 'none',
    replay: 'full',
    family: 'defense',
    build: buildPerfectA,
  },
];
