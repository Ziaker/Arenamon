// @ts-check
// Detecção contínua (CCD) no plano XZ: primeiro contato de um disco que se move de `a` para `b` contra sólidos (círculo ou caixa).
// Funções PURAS: não movem nada, não emitem eventos, não dependem do estado do jogo. O chamador decide o que fazer com o contato.
//
// Por que existe: amostrar só a posição final de cada subpasso (test.contactStep = 0,1 m) deixa passar sólidos cuja espessura efetiva
// (2·(meia-espessura + raio)) é menor que o subpasso, e escolhe o bloqueador pela ORDEM DA LISTA, não pela ordem no caminho.
// Aqui o critério é geométrico: menor tempo de impacto t ∈ [0, 1] ao longo do segmento.
import {sweepBox, toWorld} from './geometry.js';

/**
 * @typedef {{x: number, z: number}} V2
 * @typedef {{shape?: string, pos: V2, radius?: number, hx?: number, hz?: number, angle?: number}} SweepSolid
 * @typedef {{t: number, point: V2, normal: V2}} Hit
 */

/**
 * Disco de raio `r` varrendo a→b contra um círculo sólido (centro `c`, raio `R`).
 * @returns {Hit | {inside: true} | null} `inside` quando o segmento já começa sobreposto (o chamador resolve por depenetração/overlap)
 */
export function sweepCircle(/** @type {V2} */ c, /** @type {number} */ R, /** @type {V2} */ a, /** @type {V2} */ b, /** @type {number} */ r) {
  const reach = R + r, dx = b.x - a.x, dz = b.z - a.z, fx = a.x - c.x, fz = a.z - c.z;
  const startGap = fx * fx + fz * fz - reach * reach;
  if (startGap <= 0) return {inside: true};
  const A = dx * dx + dz * dz;
  if (A < 1e-18) return null;
  const B = fx * dx + fz * dz, disc = B * B - A * startGap;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / A;
  if (t < 0 || t > 1) return null;
  const point = {x: a.x + dx * t, z: a.z + dz * t}, nx = point.x - c.x, nz = point.z - c.z, len = Math.hypot(nx, nz) || 1;
  return {t, point, normal: {x: nx / len, z: nz / len}};
}

/**
 * Disco de raio `r` varrendo a→b contra uma caixa orientada: soma de Minkowski EXATA (caixa com cantos arredondados), como união de
 * dois retângulos (expandidos em u e em v) e quatro círculos de raio r nos cantos. Antes só havia o retângulo expandido, que
 * antecipa o contato nas faixas de canto (|u|>hx e |v|>hz) e deixava o teste exato rejeitar o toque, reabrindo o tunelamento fino.
 * @param {{pos: V2, angle?: number, hx: number, hz: number}} rect @returns {Hit | {inside: true} | null}
 */
export function sweepRoundedBox(rect, a, b, r) {
  const pieces = /** @type {any[]} */ ([
    sweepBox({pos: rect.pos, angle: rect.angle ?? 0, hx: rect.hx + r, hz: rect.hz}, a, b, 0, 0),
    sweepBox({pos: rect.pos, angle: rect.angle ?? 0, hx: rect.hx, hz: rect.hz + r}, a, b, 0, 0),
  ]);
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pieces.push(sweepCircle(toWorld(rect, su * rect.hx, sv * rect.hz), 0, a, b, r));
  /** @type {Hit | null} */
  let best = null;
  for (const h of pieces) {
    if (!h) continue;
    if ('inside' in h) return {inside: true};
    if (!best || h.t < best.t - 1e-12) best = {t: h.t, point: h.point, normal: h.normal};
  }
  return best;
}

/**
 * Primeiro contato entre vários sólidos (menor `t`); empate (|Δt| ≤ 1e-12) fica com o menor índice, o que mantém o resultado
 * determinístico para uma lista na ordem do chamador. Sólidos que já começam sobrepostos são ignorados aqui.
 * Caixas usam a soma de Minkowski exata (`sweepRoundedBox`); o teste de sobreposição do chamador continua sendo a confirmação final.
 * @param {SweepSolid[]} solids @param {V2} a @param {V2} b @param {number} r
 * @returns {(Hit & {index: number, solid: SweepSolid}) | null}
 */
export function firstContact(solids, a, b, r) {
  /** @type {(Hit & {index: number, solid: SweepSolid}) | null} */
  let best = null;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    const h = s.shape === 'circle' ? sweepCircle(s.pos, s.radius ?? 0, a, b, r) : sweepRoundedBox({pos: s.pos, angle: s.angle ?? 0, hx: s.hx ?? 0, hz: s.hz ?? 0}, a, b, r);
    if (!h || 'inside' in h) continue;
    if (!best || h.t < best.t - 1e-12) best = {t: h.t, point: h.point, normal: h.normal, index: i, solid: s};
  }
  return best;
}
