// Família: movimento (aceleração, frenagem, inversão, sprint, tackle, esquiva, vault, derrapagem).
// build(ctx, seed) retorna descritores de partículas (dados declarativos).

const CELL = {dot: 0, streak: 1};
const MODE = {billboard: 0, axis: 2};

const DODGE_COLOR = 0x9dffd8;
const SPRINT_COLOR = 0xd8f4ff;

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

// --- Esquiva Var 0 (A): rastros direcionais longos atrás do lutador ---
export function buildDodgeA(ctx, seed, intensity = 1) {
  const {position, direction} = ctx;
  const dir = direction || {x: 0, y: 0, z: 1};
  const side = {x: dir.z, y: 0, z: -dir.x};
  const rnd = lcg(seed);
  const parts = [];
  const cnt = Math.max(1, Math.round(6 * 0.35));
  for (let k = 0; k < cnt; k++) {
    const off = (rnd() * 2 - 1) * 0.45;
    parts.push(particle({cell: CELL.streak, mode: MODE.axis,
      x: position.x - dir.x * 0.7 + side.x * off, y: 0.25 + rnd() * 1, z: position.z - dir.z * 0.7 + side.z * off,
      life: 0.22, w: 0.07, h: 1.4,
      ax: dir.x, ay: 0, az: dir.z,
      color: DODGE_COLOR, alpha: intensity, fade: 1.2,
      stretchCurve: k2 => 1 - 0.5 * k2, additive: true}));
  }
  return parts;
}

// --- Esquiva Var 1 (B): cortes angulares e linhas diagonais em V nas laterais ---
export function buildDodgeB(ctx, seed, intensity = 1) {
  const {position, direction} = ctx;
  const dir = direction || {x: 0, y: 0, z: 1};
  const side = {x: dir.z, y: 0, z: -dir.x};
  const rnd = lcg(seed);
  const parts = [];
  for (const sgn of [1, -1]) {
    const ax = {x: dir.x * 0.6 + side.x * 0.8 * sgn, y: 0.3 * sgn, z: dir.z * 0.6 + side.z * 0.8 * sgn};
    parts.push(particle({cell: CELL.streak, mode: MODE.axis,
      x: position.x - dir.x * 0.5 + side.x * 0.4 * sgn, y: 0.5 + rnd() * 0.6, z: position.z - dir.z * 0.5 + side.z * 0.4 * sgn,
      life: 0.25, w: 0.09, h: 1.6,
      ax: ax.x, ay: ax.y, az: ax.z,
      color: DODGE_COLOR, alpha: intensity * 0.9, fade: 1.5, additive: true}));
  }
  return parts;
}

// --- Esquiva Var 2 (C): fantasmas cinéticos (silhuetas / afterimages translúcidas) ---
export function buildDodgeC(ctx, seed, intensity = 1) {
  const {position, direction} = ctx;
  const dir = direction || {x: 0, y: 0, z: 1};
  const rnd = lcg(seed);
  const parts = [];
  // Afterimages / clones de silhueta no atlas
  for (let step = 1; step <= 2; step++) {
    const dist = step * 0.55;
    parts.push(particle({cell: CELL.dot, mode: MODE.billboard,
      x: position.x - dir.x * dist, y: 0.75, z: position.z - dir.z * dist,
      life: 0.28 - step * 0.05, w: 1.1, h: 1.6,
      color: DODGE_COLOR, alpha: intensity * (0.6 - step * 0.15), fade: 2.0, additive: true}));
    parts.push(particle({cell: CELL.spark, mode: MODE.billboard,
      x: position.x - dir.x * dist + (rnd() - 0.5) * 0.3, y: 0.4 + rnd() * 0.7, z: position.z - dir.z * dist + (rnd() - 0.5) * 0.3,
      life: 0.2, w: 0.08, color: 0xffffff, alpha: 0.9, fade: 1.8, additive: true}));
  }
  return parts;
}

// --- Sprint Var 0 (A): fluxo contínuo de linhas finas ---
export function buildSprintA(ctx, seed, intensity = 1) {
  const {position, direction, dx, dz} = ctx;
  const h = Math.hypot(dx || 0, dz || 0) > 1e-6 ? Math.atan2(dx || 0, dz || 0) : 0;
  const dir = {x: Math.sin(h), y: 0, z: Math.cos(h)};
  const side = {x: dir.z, y: 0, z: -dir.x};
  const rnd = lcg(seed);
  const off = (rnd() * 2 - 1) * 0.5;
  const parts = [];
  parts.push(particle({cell: CELL.streak, mode: MODE.axis,
    x: position.x - dir.x * 0.4 + side.x * off, y: 0.3 + rnd() * 0.8, z: position.z - dir.z * 0.4 + side.z * off,
    vx: -dir.x * 9 * 0.4, vz: -dir.z * 9 * 0.4, life: 0.25,
    w: 0.03 + 0.02 * intensity, h: 1.1,
    ax: dir.x, ay: 0, az: dir.z,
    color: SPRINT_COLOR, alpha: intensity, fade: 1.4, additive: true}));
  return parts;
}

// --- Sprint Var 1 (B): trilhas corporais nos pés rente ao chão ---
export function buildSprintB(ctx, seed, intensity = 1) {
  const {position, direction, dx, dz} = ctx;
  const h = Math.hypot(dx || 0, dz || 0) > 1e-6 ? Math.atan2(dx || 0, dz || 0) : 0;
  const dir = {x: Math.sin(h), y: 0, z: Math.cos(h)};
  const side = {x: dir.z, y: 0, z: -dir.x};
  const rnd = lcg(seed);
  const parts = [];
  for (const sgn of [1, -1]) {
    parts.push(particle({cell: CELL.dot, mode: MODE.ground,
      x: position.x - dir.x * 0.2 + side.x * 0.35 * sgn, y: 0.03, z: position.z - dir.z * 0.2 + side.z * 0.35 * sgn,
      life: 0.3, w: 0.35 * intensity,
      color: SPRINT_COLOR, alpha: 0.7, fade: 1.6, additive: true}));
  }
  return parts;
}

// --- Sprint Var 2 (C): túnel cinético localizado ---
export function buildSprintC(ctx, seed, intensity = 1) {
  const {position, direction, dx, dz} = ctx;
  const h = Math.hypot(dx || 0, dz || 0) > 1e-6 ? Math.atan2(dx || 0, dz || 0) : 0;
  const dir = {x: Math.sin(h), y: 0, z: Math.cos(h)};
  const rnd = lcg(seed);
  const parts = [];
  parts.push(particle({cell: CELL.streak, mode: MODE.axis,
    x: position.x - dir.x * 0.8, y: 0.6 + (rnd() - 0.5) * 0.5, z: position.z - dir.z * 0.8,
    life: 0.26, w: 0.06, h: 1.8,
    ax: dir.x, ay: 0, az: dir.z,
    color: SPRINT_COLOR, alpha: intensity * 0.85, fade: 1.5, additive: true}));
  return parts;
}

export const buildDodge = buildDodgeA;
export const buildSprint = buildSprintA;
export const BUILD_DODGE = [buildDodgeA, buildDodgeB, buildDodgeC];
export const BUILD_SPRINT = [buildSprintA, buildSprintB, buildSprintC];

// Pontos de extensão para tackle, vault, reversal, brake, skid (Movimentos — Claude).
export function buildTackle(ctx, seed, intensity = 1) { return []; }
export function buildVault(ctx, seed, intensity = 1) { return []; }
export function buildReversal(ctx, seed, intensity = 1) { return []; }
export function buildBrake(ctx, seed, intensity = 1) { return []; }
export function buildSkid(ctx, seed, intensity = 1) { return []; }

export const MOVEMENT_DEFS = [
  {
    id: 'movement:dodge',
    version: '1.0',
    trigger: 'dodge',
    conditions: [],
    priority: 30,
    anchor: 'contact',
    duration: 0.22,
    seed: true,
    variant: 0,
    quality: 'medium',
    limits: {particles: 12, trails: 4},
    aggregation: 'stack',
    maxStack: 4,
    replay: 'full',
    family: 'movement',
    build: buildDodgeA,
  },
  {
    id: 'movement:dodge',
    version: '1.1',
    trigger: 'dodge',
    conditions: [],
    priority: 30,
    anchor: 'contact',
    duration: 0.22,
    seed: true,
    variant: 1,
    quality: 'medium',
    limits: {particles: 12, trails: 4},
    aggregation: 'stack',
    maxStack: 4,
    replay: 'full',
    family: 'movement',
    build: buildDodgeB,
  },
  {
    id: 'movement:dodge',
    version: '1.2',
    trigger: 'dodge',
    conditions: [],
    priority: 30,
    anchor: 'contact',
    duration: 0.22,
    seed: true,
    variant: 2,
    quality: 'medium',
    limits: {particles: 16, trails: 4},
    aggregation: 'stack',
    maxStack: 4,
    replay: 'full',
    family: 'movement',
    build: buildDodgeC,
  },
  {
    id: 'movement:sprint',
    version: '1.0',
    trigger: 'sprint',
    conditions: [],
    priority: 30,
    anchor: 'contact',
    duration: 0.25,
    seed: true,
    variant: 0,
    quality: 'medium',
    limits: {particles: 8, trails: 4},
    aggregation: 'stack',
    maxStack: 8,
    replay: 'full',
    family: 'movement',
    build: buildSprintA,
  },
  {
    id: 'movement:sprint',
    version: '1.1',
    trigger: 'sprint',
    conditions: [],
    priority: 30,
    anchor: 'contact',
    duration: 0.25,
    seed: true,
    variant: 1,
    quality: 'medium',
    limits: {particles: 8, trails: 4},
    aggregation: 'stack',
    maxStack: 8,
    replay: 'full',
    family: 'movement',
    build: buildSprintB,
  },
  {
    id: 'movement:sprint',
    version: '1.2',
    trigger: 'sprint',
    conditions: [],
    priority: 30,
    anchor: 'contact',
    duration: 0.25,
    seed: true,
    variant: 2,
    quality: 'medium',
    limits: {particles: 8, trails: 4},
    aggregation: 'stack',
    maxStack: 8,
    replay: 'full',
    family: 'movement',
    build: buildSprintC,
  },
  // Pontos de extensão para movimentos (registrados sem build ativo — aguardam Claude).
  {
    id: 'movement:tackle', version: '1.0', trigger: 'tackle', conditions: [], priority: 30,
    anchor: 'contact', duration: 0.4, seed: true, variant: 0, quality: 'medium',
    limits: {particles: 16}, aggregation: 'none', replay: 'full', family: 'movement', build: buildTackle,
  },
  {
    id: 'movement:vault', version: '1.0', trigger: 'vault', conditions: [], priority: 30,
    anchor: 'contact', duration: 0.6, seed: true, variant: 0, quality: 'medium',
    limits: {particles: 12}, aggregation: 'none', replay: 'full', family: 'movement', build: buildVault,
  },
];
