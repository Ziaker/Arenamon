// Família: ambiente (parede e ricochete).
// Efeito no ponto de contato, orientado pela normal da parede.

const CELL = {dot: 0, streak: 1, ring: 3, shard: 6};
const MODE = {billboard: 0, plane: 3};

const WALL_COLOR = 0xc3d7ff;
const easeOutCubic = k => 1 - Math.pow(1 - k, 3);

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

// buildWall(ctx, seed, intensity): contacto na parede, normal da parede orienta.
export function buildWall(ctx, seed, intensity = 1) {
  const {position, normal} = ctx;
  const rnd = lcg(seed);
  const parts = [];
  const y = position.y + 0.5;
  parts.push(particle({cell: CELL.shard, mode: MODE.billboard, x: position.x, y, z: position.z,
    life: 0.3, w: 0.9, color: WALL_COLOR, alpha: 0.9, grow: 0.6, fade: 1.4, additive: true}));
  const cnt = Math.round(12 * intensity);
  for (let k = 0; k < cnt; k++) {
    const a = rnd() * Math.PI * 2;
    const sp = 4 * (0.5 + rnd() * 0.6) * intensity;
    // Partículas rebatem na direção da normal (para fora da parede).
    parts.push(particle({cell: CELL.streak, mode: MODE.axis,
      x: position.x, y, z: position.z,
      vx: normal.x * sp * 0.5 + Math.cos(a) * sp * 0.5,
      vy: rnd() * 2,
      vz: normal.z * sp * 0.5 + Math.sin(a) * sp * 0.5,
      drag: 4, life: 0.3 * (0.6 + rnd() * 0.4), w: 0.07,
      ax: normal.x, ay: normal.y || 0.2, az: normal.z,
      color: WALL_COLOR, alpha: 0.9, fade: 1.4, additive: true}));
  }
  // Ring rente à parede (plano perpendicular à normal).
  parts.push(particle({cell: CELL.ring, mode: MODE.plane, x: position.x, y, z: position.z,
    life: 0.3, w: 0.8, h: 0.8,
    ax: normal.x, ay: normal.y || 0.2, az: normal.z,
    color: WALL_COLOR, alpha: 0.7, fade: 1.2,
    sizeCurve: k2 => 1 + easeOutCubic(k2) * 3.5 * intensity, additive: true}));
  return parts;
}

export const ENVIRONMENT_DEFS = [{
  id: 'environment:wall',
  version: '1.0',
  trigger: 'wall',
  conditions: [],
  priority: 50,
  anchor: 'contact',
  duration: 0.3,
  seed: true,
  variant: 0,
  quality: 'medium',
  limits: {particles: 24},
  aggregation: 'none',
  replay: 'full',
  family: 'environment',
  build: buildWall,
}];
