// @ts-check
// Colisão geométrica disco × sólido do mundo, no plano XZ.
// É um núcleo PURO: nenhum deslocamento, evento, estado ou efeito colateral ocorre aqui.
// O eixo vertical e a legalidade do contato são verificados pelo chamador.
//
// Contrato: normal aponta do obstáculo para FORA (sentido de depenetração),
// depth é a distância mínima que o centro do disco precisa percorrer para separar
// os volumes. Mesmo quando o centro já começa DENTRO da forma, o resultado deve
// situar o disco fora do sólido após p += normal * depth.
//
// Não usar como substituto de sweep/CCD 3D nem da detecção de suporte do solo.
import {clamp} from './math.js';

/**
 * @typedef {{x: number, z: number}} Vec
 * @typedef {{shape?: string, pos: Vec, angle?: number, hx?: number, hz?: number, radius?: number}} Solid
 */

/** @param {Solid} solid @param {Vec} p @param {number} radius
 * @returns {{normal: Vec, depth: number, inside: boolean} | null}
 */
export function solidContact(solid, p, radius) {
  if (!(radius >= 0) || !Number.isFinite(radius) || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return null;
  if (solid.shape !== 'box') {
    if (solid.shape !== 'circle' || !(solid.radius > 0)) return null;
    const dx = p.x - solid.pos.x, dz = p.z - solid.pos.z, dist = Math.hypot(dx, dz);
    const depth = solid.radius + radius - dist;
    if (!(depth > 1e-10)) return null;
    const inv = dist > 1e-10 ? 1 / dist : 0;
    return {normal: inv ? {x: dx * inv, z: dz * inv} : {x: 1, z: 0}, depth, inside: dist < solid.radius};
  }

  const hx = solid.hx ?? 0, hz = solid.hz ?? 0;
  if (!(hx > 0 && hz > 0)) return null;
  const c = Math.cos(solid.angle ?? 0), s = Math.sin(solid.angle ?? 0);
  const dx = p.x - solid.pos.x, dz = p.z - solid.pos.z;
  const u = dx * c - dz * s, v = dx * s + dz * c;
  const nearestU = clamp(u, -hx, hx), nearestV = clamp(v, -hz, hz);
  const inside = Math.abs(u) <= hx && Math.abs(v) <= hz;
  let nu, nv, depth;

  if (inside) {
    const xGap = hx - Math.abs(u), zGap = hz - Math.abs(v);
    // O eixo da face mais próxima define a mínima translação para fora.
    // Empate exato: escolhe z', com sentido positivo no centro — determinístico.
    if (xGap < zGap) {nu = u < 0 ? -1 : 1; nv = 0; depth = xGap + radius;}
    else {nu = 0; nv = v < 0 ? -1 : 1; depth = zGap + radius;}
  } else {
    const su = u - nearestU, sv = v - nearestV, dist = Math.hypot(su, sv);
    depth = radius - dist;
    if (!(depth > 1e-10) || dist <= 1e-10) return null;
    nu = su / dist;nv = sv / dist;
  }

  if (!(depth > 1e-10)) return null;
  return {
    normal: {x: nu * c + nv * s, z: -nu * s + nv * c},
    depth,
    inside,
  };
}
