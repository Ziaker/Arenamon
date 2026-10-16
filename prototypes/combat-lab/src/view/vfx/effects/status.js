// Família: estados (invulnerabilidade, stamina baixa, exaustão, regeneração,
// guard stun, contra-ataque disponível, buffs e debuffs).
// build(ctx, seed) retorna descritores de partículas.

const CELL = {dot: 0, streak: 1, arrowDown: 4, diamond: 5, arrowUp: 11, ring: 3};
const MODE = {billboard: 0, axis: 2, ground: 1};

const EXHAUST_COLOR = 0x4fa3ff;
const REGEN_COLOR = 0xffd34d;
const INVULN_COLOR = 0xc3d7ff;

function particle({cell = CELL.dot, mode = MODE.billboard, x = 0, y = 0, z = 0,
  vx = 0, vy = 0, vz = 0, life = 0.4, w = 0.3, h = 0.3, rot = 0, spin = 0,
  color = 0xffffff, alpha = 1, additive = false, fade = 1.6, grow = 0,
  gravity = 0, drag = 0, floor = null, sizeCurve = null, stretchCurve = null,
  alphaCurve = null, delay = 0, ax = 0, ay = 0, az = 0, follow = null} = {}) {
  return {cell, mode, x, y, z, vx, vy, vz, life, w, h, rot, spin, color, alpha,
    additive, fade, grow, gravity, drag, floor, sizeCurve, stretchCurve, alphaCurve,
    delay, ax, ay, az, follow, age: -delay};
}

function lcg(seed) {
  let s = ((seed * 1664525 + 1013904223) >>> 0) | 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 0) / 4294967296; };
}

// Semente estável por lutador (usa attacker/target como base).
function fighterSeed(ctx, base) {
  return ctx.seed * 31 + (base || 0);
}

// --- Exaustão (indicadores azuis) ---
export function buildExhaust(ctx, seed, intensity = 1) {
  const {position} = ctx;
  const rnd = lcg(seed);
  const parts = [];
  const cnt = Math.max(1, Math.round(5 * 0.4));
  const startHeight = 2.1, fallSpeed = 1.1, spread = 0.55, size = 0.26;
  for (let k = 0; k < cnt; k++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.15 + rnd() * spread;
    parts.push(particle({cell: CELL.arrowDown, mode: MODE.billboard, additive: false,
      x: position.x + Math.cos(a) * r, y: altOf(ctx) + startHeight + (rnd() - 0.5) * 0.3,
      z: position.z + Math.sin(a) * r, vy: -fallSpeed,
      life: startHeight / Math.max(0.2, fallSpeed) * 0.8, w: size,
      color: EXHAUST_COLOR, alpha: 0.85, glow: 1,
      alphaCurve: k2 => Math.min(1, k2 * 6) * (1 - k2),
      follow: {dx: 0, dz: 0}}));
  }
  return parts;
}

// --- Regeneração de stamina (amarelo) ---
export function buildRegen(ctx, seed, rate = 1, intensity = 1) {
  const {position} = ctx;
  const rnd = lcg(seed);
  const k = Math.max(0.3, Math.min(2, rate / Math.max(1e-6, 3 / 5)));
  const parts = [];
  const cnt = Math.max(1, Math.round(3 * 0.4 * k));
  const speed = 1.2, height = 1.8, size = 0.28, spread = 0.5;
  for (let j = 0; j < cnt; j++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.2 + rnd() * spread;
    parts.push(particle({cell: CELL.arrowUp, mode: MODE.billboard, additive: false,
      x: position.x + Math.cos(a) * r, y: altOf(ctx) + 0.1 + rnd() * 0.4,
      z: position.z + Math.sin(a) * r, vy: speed,
      life: height / Math.max(0.2, speed), w: size,
      color: REGEN_COLOR, alpha: 0.8,
      alphaCurve: q => Math.min(1, q * 5) * (1 - q),
      follow: {dx: 0, dz: 0}}));
  }
  return parts;
}

function altOf(ctx) {
  // altura visual (voo/salto) do lutador alvo; fallback 0.
  return 0;
}

// --- Invulnerabilidade (círculo azul leve, não ofusca) ---
export function buildInvuln(ctx, seed, intensity = 1) {
  const {position} = ctx;
  const rnd = lcg(seed);
  const parts = [];
  parts.push(particle({cell: CELL.ring, mode: MODE.ground, x: position.x, y: 0.05, z: position.z,
    life: 0.6, w: 1.2, color: INVULN_COLOR, alpha: 0.4, fade: 1.5,
    sizeCurve: k2 => 1 + k2 * 0.4, additive: false}));
  return parts;
}

export const STATUS_DEFS = [
  {
    id: 'status:exhaust',
    version: '1.0',
    trigger: 'status',
    conditions: [{state: 'exhausted'}],
    priority: 20,
    anchor: 'contact',
    duration: 1.1,
    seed: true,
    variant: 0,
    quality: 'medium',
    limits: {particles: 20},
    aggregation: 'stack',
    maxStack: 1,
    replay: 'full',
    family: 'status',
    build: buildExhaust,
  },
  {
    id: 'status:regen',
    version: '1.0',
    trigger: 'status',
    conditions: [{state: 'regen'}],
    priority: 20,
    anchor: 'contact',
    duration: 1.0,
    seed: true,
    variant: 0,
    quality: 'medium',
    limits: {particles: 16},
    aggregation: 'stack',
    maxStack: 1,
    replay: 'full',
    family: 'status',
    build: buildRegen,
  },
  {
    id: 'status:invulnerable',
    version: '1.0',
    trigger: 'invulnerable',
    conditions: [],
    priority: 25,
    anchor: 'contact',
    duration: 0.6,
    seed: true,
    variant: 0,
    quality: 'medium',
    limits: {particles: 8},
    aggregation: 'refresh',
    maxStack: 1,
    replay: 'full',
    family: 'status',
    build: buildInvuln,
  },
];
