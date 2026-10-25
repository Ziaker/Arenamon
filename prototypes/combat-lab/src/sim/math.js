// @ts-check
// Vetores no plano XZ e funções escalares (idênticas às do v6).
export const vec = (x = 0, z = 0) => ({x, z});
export const add = (a, b) => vec(a.x + b.x, a.z + b.z);
export const scale = (a, s) => vec(a.x * s, a.z * s);
export const sub = (a, b) => vec(a.x - b.x, a.z - b.z);
export const dot = (a, b) => a.x * b.x + a.z * b.z;
export const length = a => Math.hypot(a.x, a.z);
export const normalize = a => length(a) > 1e-8 ? scale(a, 1 / length(a)) : vec();
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Ângulo (rumo) de um vetor: 0 = +Z. */
export const angleOf = a => Math.atan2(a.x, a.z);
/** Vetor unitário de um rumo. */
export const direction = angle => vec(Math.sin(angle), Math.cos(angle));
/** Menor diferença angular de a até b. */
export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const smoothstep = t => (t = clamp(t, 0, 1), t * t * (3 - 2 * t));
/** Curva nominal do v6: p(u) = 1,6u − 0,2u² − 0,4u³. */
export const dodgeCurve = t => (t = clamp(t, 0, 1), 1.6 * t - .2 * t * t - .4 * t * t * t);
/**
 * Curva de deslocamento de uma ação, definida pela velocidade inicial relativa a (1 a 3):
 * p(u) = a·u + (3 − 2a)·u² + (a − 2)·u³, com p(0) = 0, p(1) = 1 e velocidade zero no fim (sem impulso residual).
 * a = 1,6 é a curva do v6 (70% da distância na primeira metade, GDD 7.2) e usa os coeficientes literais.
 */
export const actionCurve = (t, a) => a === 1.6 ? dodgeCurve(t) : (t = clamp(t, 0, 1), a * t + (3 - 2 * a) * t * t + (a - 2) * t * t * t);
