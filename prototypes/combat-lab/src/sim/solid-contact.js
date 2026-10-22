// @ts-check
// Contato disco × sólido do mundo (caixa orientada ou círculo) no plano XZ. Núcleo PURO: não move nada nem emite eventos.
// A altura e a legalidade do contato (dono da barreira, sólido morto, faixa vertical) são decididas pelo chamador.
//
// Contrato: `normal` aponta do sólido para FORA e `depth` é a menor translação que separa o disco do sólido;
// após p + normal · depth o disco está fora, inclusive quando o centro já começava DENTRO da forma
// (antes, o centro dentro da caixa era empurrado só `r` na direção do centro do sólido — parcial e pela ponta da parede).
// Empate exato entre duas faces: escolhe o eixo local v (determinístico). Não substitui CCD/sweep (Fase 3) nem o apoio vertical (Fase 4).
import {clamp} from './math.js';

/**
 * @typedef {{x: number, z: number}} Vec
 * @typedef {{shape?: string, pos: Vec, angle?: number, hx?: number, hz?: number, radius?: number}} Solid
 */

/**
 * Disco (centro p, raio `radius`) × círculo sólido. Sem alocar objeto intermediário (caminho quente a 120 Hz).
 * Centro exatamente coincidente: normal (0,1), a mesma escolha do código anterior (compatível com replays gravados).
 * @param {Vec} center @param {number} solidRadius @param {Vec} p @param {number} radius
 * @returns {{normal: Vec, depth: number, inside: boolean} | null}
 */
export function circleContact(center, solidRadius, p, radius) {
  if (!(solidRadius > 0) || !(radius >= 0) || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return null;
  const dx = p.x - center.x, dz = p.z - center.z, dist = Math.hypot(dx, dz), depth = solidRadius + radius - dist;
  if (!(depth > 1e-10)) return null;
  return {normal: dist > 1e-10 ? {x: dx / dist, z: dz / dist} : {x: 0, z: 1}, depth, inside: dist < solidRadius};
}

/**
 * @param {Solid} solid @param {Vec} p centro do disco @param {number} radius raio do disco
 * @returns {{normal: Vec, depth: number, inside: boolean} | null} null quando não há penetração (tangente também é null)
 */
export function solidContact(solid, p, radius) {
  if (!(radius >= 0) || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return null;
  if (solid.shape === 'circle') return circleContact(solid.pos, solid.radius ?? 0, p, radius);
  if (solid.shape !== 'box') return null;
  const hx = solid.hx ?? 0, hz = solid.hz ?? 0;
  if (!(hx > 0 && hz > 0)) return null;
  // Eixos locais como em closestOnShape: u = (cos, -sin), v = (sin, cos); rumo 0 = +Z.
  const c = Math.cos(solid.angle ?? 0), s = Math.sin(solid.angle ?? 0), dx = p.x - solid.pos.x, dz = p.z - solid.pos.z;
  const u = dx * c - dz * s, v = dx * s + dz * c, inside = Math.abs(u) <= hx && Math.abs(v) <= hz;
  let nu, nv, depth;
  if (inside) {
    const gapU = hx - Math.abs(u), gapV = hz - Math.abs(v);
    if (gapU < gapV) {nu = u < 0 ? -1 : 1;nv = 0;depth = gapU + radius;}
    else {nu = 0;nv = v < 0 ? -1 : 1;depth = gapV + radius;}
  } else {
    const su = u - clamp(u, -hx, hx), sv = v - clamp(v, -hz, hz), dist = Math.hypot(su, sv);
    depth = radius - dist;
    if (!(depth > 1e-10)) return null;
    nu = su / dist;nv = sv / dist;
  }
  if (!(depth > 1e-10)) return null;
  return {normal: {x: nu * c + nv * s, z: -nu * s + nv * c}, depth, inside};
}

/** Passos de envelhecimento que uma normal sobrevive sem novo toque (o controlador a lê com idades 0..4; deslizar pela tangente afasta o corpo do sólido por 1–2 passos). */
export const SURFACE_MEMORY_TICKS = 4;
/**
 * Registra, para o controlador do próximo tick, a normal (do sólido para fora) de um sólido estático que empurrou o lutador na
 * locomoção livre. Fica no estado do lutador (entra em save/load/replay). Normais quase iguais são atualizadas, não duplicadas.
 * @param {{surfaceNormals?: (Vec & {age?: number})[]}} f @param {Vec} n
 */
export function noteSurface(f, n) {
  const list = f.surfaceNormals ??= [], same = list.find(m => m.x * n.x + m.z * n.z > .9);
  if (same) {same.x = n.x;same.z = n.z;same.age = 0;}
  else if (list.length < 3) list.push({x: n.x, z: n.z, age: 0});
}
/** Envelhece as normais (uma vez por passo físico) e descarta as que passaram da memória (no lugar, sem alocar). */
export function ageSurfaces(/** @type {{surfaceNormals?: (Vec & {age?: number})[]}} */ f) {
  const list = f.surfaceNormals;
  if (!list?.length) {f.surfaceNormals = list ?? [];return;}
  let kept = 0;
  for (const n of list) {n.age = (n.age ?? 0) + 1;if (n.age <= SURFACE_MEMORY_TICKS) list[kept++] = n;}
  list.length = kept;
}

/**
 * Entrada de movimento descontada da parte que empurra para dentro das superfícies em contato: o lutador desliza pela tangente em
 * vez de ter o deslize amortecido como "velocidade lateral indesejada". Só reduz a entrada (|resultado| ≤ |move|): não cria
 * velocidade nem direção que o jogador não pediu.
 * @param {Vec} move @param {Vec[] | undefined} normals @returns {Vec}
 */
export function slideAlong(move, normals) {
  if (!normals?.length) return move;
  let m = move;
  for (const n of normals) {
    const d = m.x * n.x + m.z * n.z;
    if (d < 0) m = {x: m.x - n.x * d, z: m.z - n.z * d};
  }
  return m;
}
