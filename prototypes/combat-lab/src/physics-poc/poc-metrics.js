// @ts-check
// Fase 5: métricas independentes (oráculo geométrico) aplicadas às trilhas das duas físicas.
// O oráculo usa SÓ a geometria declarada do cenário — não a física de nenhum dos lados — para medir penetração.
import {HALF, BODY_H} from './poc-scenarios.js';

/**
 * Profundidade de penetração (m) do corpo no sólido: menor deslocamento que o tiraria de dentro; 0 se só encosta.
 * shape 'box' = pegada quadrada (como o Arenamon); 'capsule' = pegada circular (Rapier com cápsula).
 */
export function penetration(p, s, shape = 'box') {
  const feet = p.y, head = p.y + BODY_H;
  if (feet >= s.top - 1e-9 || head <= s.base + 1e-9) return 0;
  let lateral;
  if (s.shape === 'cyl') {
    const d = Math.hypot(p.x - s.x, p.z - s.z), pen = s.r + HALF - d;
    if (pen <= 0) return 0;
    lateral = pen;
  } else if (shape === 'capsule') {
    const ax = Math.abs(p.x - s.x), az = Math.abs(p.z - s.z), dx = Math.max(ax - s.hx, 0), dz = Math.max(az - s.hz, 0);
    if (dx === 0 && dz === 0) lateral = HALF + Math.min(s.hx - ax, s.hz - az);
    else {const d = Math.hypot(dx, dz);if (d >= HALF) return 0;lateral = HALF - d;}
  } else {
    const ox = s.hx + HALF - Math.abs(p.x - s.x), oz = s.hz + HALF - Math.abs(p.z - s.z);
    if (ox <= 0 || oz <= 0) return 0;
    lateral = Math.min(ox, oz);
  }
  return Math.min(lateral, s.top - feet, head - s.base);
}
export const maxPenetration = (trace, solids, shape = 'box') => trace.reduce((m, p) => Math.max(m, ...solids.map(s => penetration(p, s, shape)), 0), 0);

const std = a => {const m = a.reduce((x, y) => x + y, 0) / (a.length || 1);return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length || 1));};
/** Tremor em repouso: desvio-padrão (mm) de y e do plano na última meia segundo. */
export function restJitter(trace, ticks = 60) {
  const t = trace.slice(-ticks);
  return {y: +(std(t.map(p => p.y)) * 1000).toFixed(3), xz: +(Math.hypot(std(t.map(p => p.x)), std(t.map(p => p.z))) * 1000).toFixed(3)};
}
/** Hash determinístico da trilha (FNV-1a sobre posições em micrômetros). */
export function traceHash(trace) {
  let h = 2166136261 >>> 0;
  for (const p of trace) for (const v of [p.x, p.y, p.z]) {
    const n = Math.round(v * 1e6);
    for (const b of [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]) h = Math.imul(h ^ b, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
export function summarize(trace, solids, shape = 'box') {
  const last = trace[trace.length - 1];
  return {
    final: {x: +last.x.toFixed(3), y: +last.y.toFixed(3), z: +last.z.toFixed(3)},
    maxY: +Math.max(...trace.map(p => p.y)).toFixed(3),
    maxZ: +Math.max(...trace.map(p => p.z)).toFixed(3),
    penetration: +maxPenetration(trace, solids, shape).toFixed(4),
    jitter: restJitter(trace),
    hash: traceHash(trace),
  };
}
