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

// Esquiva: rastros direcionais atrás do personagem, na direção real da esquiva.
export function buildDodge(ctx, seed, intensity = 1) {
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

// Sprint: fluxo contínuo de linhas finas atrás do personagem.
export function buildSprint(ctx, seed, intensity = 1) {
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

// Pontos de extensão para tackle, vault, reversal, brake, skid (Movimentos — Claude).
export function buildTackle(ctx, seed, intensity = 1) {
  return []; // ponto de extensão: sem partículas até o movimento ser definido
}
export function buildVault(ctx, seed, intensity = 1) {
  return []; // ponto de extensão
}
export function buildReversal(ctx, seed, intensity = 1) {
  return []; // ponto de extensão
}
export function buildBrake(ctx, seed, intensity = 1) {
  return []; // ponto de extensão
}
export function buildSkid(ctx, seed, intensity = 1) {
  return []; // ponto de extensão
}

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
    build: buildDodge,
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
    build: buildSprint,
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
