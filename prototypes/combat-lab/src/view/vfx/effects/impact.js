// Família: impacto comum (hit).
// Nasce no ponto real de contato, orientado pela normal, variantes leve/média/forte.
// build(ctx, seed) retorna descritores de partículas (dados declarativos, sem efeitos colaterais).

import {jitterAround} from '../anchors.js';

const CELL = {dot: 0, streak: 1, star4: 2, ring: 3, shard: 6, spark: 7, shock: 9};
const MODE = {billboard: 0, ground: 1, axis: 2};

const IMPACT_COLOR = 0xffb361;
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

// Determinístico: mesma seed → mesma sequência de "aleatórios" em [0,1).
function lcg(seed) {
  let s = ((seed * 1664525 + 1013904223) >>> 0) | 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 0) / 4294967296; };
}

// --- Variante A (leve): impacto radial ---
export function buildImpactA(ctx, seed, intensity = 1) {
  const {position} = ctx;
  const y = position.y + 0.75;
  const rnd = lcg(seed);
  const count = Math.round(18 * intensity);
  const parts = [];
  parts.push(particle({cell: CELL.dot, mode: MODE.billboard, x: position.x, y, z: position.z,
    life: 0.19, w: 1.17, color: 0xffffff, alpha: 0.95, fade: 1.6, grow: 0.6, additive: true}));
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
    const up = -0.25 + rnd() * 0.8;
    const sp = 6 * (0.7 + rnd() * 0.6) * intensity;
    parts.push(particle({cell: CELL.streak, mode: MODE.axis,
      x: position.x, y, z: position.z,
      vx: Math.cos(a) * sp, vy: up * sp, vz: Math.sin(a) * sp, drag: 5,
      life: 0.38 * (0.6 + rnd() * 0.4), w: 0.091, h: 0.3575,
      ax: Math.cos(a), ay: up, az: Math.sin(a),
      color: IMPACT_COLOR, alpha: 0.95, fade: 1.6,
      stretchCurve: k2 => 1.4 - k2, additive: true}));
    if (k % 2 === 0) {
      parts.push(particle({cell: CELL.spark, mode: MODE.billboard,
        x: position.x, y, z: position.z,
        vx: Math.cos(a) * sp * 0.5, vy: up * sp * 0.5 + 1, vz: Math.sin(a) * sp * 0.5,
        gravity: 9, life: 0.38 * 1.3, w: 0.104,
        color: IMPACT_COLOR, alpha: 0.95, fade: 1.6, additive: true}));
    }
  }
  return parts;
}

// --- Variante B (média): estrela + fragmentos ---
export function buildImpactB(ctx, seed, intensity = 1) {
  const {position} = ctx;
  const y = position.y + 0.8;
  const rnd = lcg(seed);
  const parts = [];
  parts.push(particle({cell: CELL.star, mode: MODE.billboard, x: position.x, y, z: position.z,
    life: 0.209, w: 2.08, color: IMPACT_COLOR, alpha: 0.95, fade: 1.6,
    rot: rnd() * Math.PI * 2,
    sizeCurve: k => k < 0.15 ? k / 0.15 : 1 - 0.25 * (k - 0.15) / 0.85, additive: true}));
  parts.push(particle({cell: CELL.star4, mode: MODE.billboard, x: position.x, y, z: position.z,
    life: 0.114, w: 1.17, color: 0xffffff, alpha: 0.95, fade: 1.6,
    rot: rnd() * Math.PI * 2, grow: 1.2, additive: true}));
  const cnt = Math.round(18 * 0.6 * intensity);
  for (let k = 0; k < cnt; k++) {
    const a = rnd() * Math.PI * 2;
    const sp = 6 * (0.5 + rnd() * 0.5) * intensity;
    parts.push(particle({cell: k % 2 ? CELL.shard : CELL.diamond, mode: MODE.billboard,
      x: position.x, y, z: position.z,
      vx: Math.cos(a) * sp, vy: (1 + rnd() * 3) * intensity, vz: Math.sin(a) * sp,
      gravity: 12, drag: 2,
      life: 0.38 * (1 + rnd() * 0.6),
      w: (0.08 + rnd() * 0.08) * 1.3,
      color: IMPACT_COLOR, alpha: 0.95, fade: 1.6,
      rot: rnd() * Math.PI * 2, spin: -14 + rnd() * 28, additive: true}));
  }
  return parts;
}

// --- Variante C (forte): ondas de choque ---
export function buildImpactC(ctx, seed, intensity = 1) {
  const {position} = ctx;
  const y = position.y + 0.75;
  const rnd = lcg(seed);
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const cell = k === 1 ? CELL.shock : CELL.ring;
    parts.push(particle({cell, mode: MODE.billboard, x: position.x, y, z: position.z,
      delay: k * 0.38 * 0.12, life: 0.38 * 0.7, w: 0.52,
      color: IMPACT_COLOR, alpha: 0.95 * (1 - k * 0.2), fade: 1.6,
      sizeCurve: k2 => 1 + easeOutCubic(k2) * 6 * 0.6 * intensity, additive: true}));
  }
  parts.push(particle({cell: CELL.ring, mode: MODE.ground, x: position.x, y: 0.03, z: position.z,
    life: 0.38, w: 0.65, color: IMPACT_COLOR, alpha: 0.76, fade: 1.6,
    sizeCurve: k2 => 1 + easeOutCubic(k2) * 6 * 0.8 * intensity, additive: true}));
  const cnt = Math.round(18 * 0.5 * intensity);
  for (let k = 0; k < cnt; k++) {
    const a = (k / cnt) * Math.PI * 2;
    parts.push(particle({cell: CELL.dot, mode: MODE.billboard, x: position.x, y, z: position.z,
      vx: Math.cos(a) * 4.8, vy: Math.sin(a) * 1.8, vz: Math.sin(a) * 4.8,
      drag: 6, life: 0.304, w: 0.091,
      color: 0xffffff, alpha: 0.95, fade: 1.6, additive: true}));
  }
  return parts;
}

export const BUILDERS = [buildImpactA, buildImpactB, buildImpactC];

// Metadados declarativos das variantes de impacto.
export const IMPACT_DEFS = BUILDERS.map((build, v) => ({
  id: `impact:hit`,
  version: `1.${v}`,
  trigger: 'hit',
  conditions: [],
  priority: 50,
  anchor: 'contact',
  duration: 0.38,
  seed: true,
  variant: v,
  quality: 'medium',
  limits: {particles: 40},
  aggregation: 'none',
  replay: 'full',
  family: 'impact',
  build,
}));
