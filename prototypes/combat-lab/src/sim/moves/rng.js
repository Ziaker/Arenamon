// @ts-check
// Aleatoriedade determinística dos Moves (sorteios de posições, velocidades e pontos de mira, M30.8/D4). Um fluxo PRÓPRIO por
// execução, derivado do passo, do lutador e do id da execução: não consome nem perturba a IA, e save/load e replay reproduzem
// os mesmos sorteios (tudo isso vem do estado salvo). Provisório: distribuição uniforme (P15).
/** Mistura três inteiros em uma semente de 32 bits. */
export function hash32(/** @type {number} */ a, /** @type {number} */ b = 0, /** @type {number} */ c = 0) {
  let h = 0x811c9dc5;
  for (const v of [a, b, c]) {h ^= v >>> 0;h = Math.imul(h, 0x01000193);h ^= h >>> 15;h = Math.imul(h, 0x2c1b3c6d);h ^= h >>> 12;}
  return h >>> 0;
}
/** mulberry32: devolve uma função que produz números em [0, 1). */
export function rng(/** @type {number} */ seed) {
  let s = seed >>> 0;
  return () => {s = (s + 0x6d2b79f5) >>> 0;let t = s;t = Math.imul(t ^ (t >>> 15), t | 1);t ^= t + Math.imul(t ^ (t >>> 7), t | 61);return ((t ^ (t >>> 14)) >>> 0) / 4294967296;};
}
export const uniform = (/** @type {() => number} */ r, /** @type {number} */ lo, /** @type {number} */ hi) => lo + (hi - lo) * r();
