// @ts-check
// ColliderQueries (F4): consultas geométricas ÚNICAS do mapa. Antes cada sistema convertia o mapa em sólidos do seu jeito (visão/areia/Bullet Punch,
// grafo de navegação, CCD e laços de projéteis do world.js) e repetia o teste de ponto-em-sólido e a altura do piso (física × consumíveis).
// Aqui fica uma só enumeração (`solidsOf`), um só teste de ponto (`pointInSolid` redondo / `insideFootprint` quadrado do grafo), a linha de visão
// amostrada (`segmentClear`, 0,2 m como sempre: trocar por analítico mudaria decisões da IA e replays) e a superfície de apoio (`groundSurface`).
// Só consulta geometria: não altera estado. A resolução de contatos dos lutadores (map-collision.js) continua onde está.
import {C} from '../config.js';
import {vec, add, sub, scale, length} from '../math.js';

/** Ponto do contorno da forma mais próximo de p (plano XZ) e distância. */
export function closestOnShape(/** @type {any} */ e, /** @type {{x: number, z: number}} */ p) {
  if (e.shape === 'box') {
    const c = Math.cos(e.angle ?? 0), s = Math.sin(e.angle ?? 0), d = sub(p, e.pos);
    // Eixos locais: x' = (cos, -sin), z' = (sin, cos) — rumo 0 = +Z, como o resto do motor.
    const lx = d.x * c - d.z * s, lz = d.x * s + d.z * c, qx = Math.max(-e.hx, Math.min(e.hx, lx)), qz = Math.max(-e.hz, Math.min(e.hz, lz));
    const inside = Math.abs(lx) <= e.hx && Math.abs(lz) <= e.hz;
    const q = vec(e.pos.x + qx * c + qz * s, e.pos.z - qx * s + qz * c);
    return {point: q, distance: inside ? -Math.min(e.hx - Math.abs(lx), e.hz - Math.abs(lz)) : length(sub(p, q)), inside};
  }
  const d = sub(p, e.pos), l = length(d);
  return {point: l > 1e-9 ? add(e.pos, scale(d, e.radius / l)) : add(e.pos, vec(e.radius, 0)), distance: l - e.radius, inside: l < e.radius};
}

/**
 * Sólido do mapa no plano XZ com faixa vertical [y0, y1]. `kind` é a origem; `ref` é o objeto original (destrutível, obstáculo, plataforma ou parede).
 * `y1Final` só existe em destrutível: topo FINAL (rocha crescendo usa `targetHeight`), o que o grafo de navegação enxerga.
 * @typedef {{shape: 'box'|'circle', kind: 'wall'|'platform'|'obstacle'|'destructible', id: any, pos: {x: number, z: number}, hx?: number, hz?: number, radius?: number, angle: number, y0: number, y1: number, y1Final?: number, ref: any}} Solid
 */

/**
 * Sólidos do mundo em forma única. Ordem fixa: paredes, plataformas, obstáculos, destrutíveis sólidos (o grafo de navegação depende da ordem).
 * `barriers` = paredes (entidades 'wall' em caixa, não mortas) de `world.entities`; plataformas são superfície de apoio (visão/areia não as contam).
 * @param {any} mapState @param {any} world @param {{platforms?: boolean, barriers?: boolean, destructibles?: boolean, obstacles?: boolean}} [opts]
 * @returns {Solid[]}
 */
export function solidsOf(mapState, world, {platforms = true, barriers = false, destructibles = true, obstacles = true} = {}) {
  /** @type {Solid[]} */ const out = [];
  if (barriers) for (const e of world?.entities ?? []) if (!e.dead && e.kind === 'wall' && e.shape === 'box') out.push({shape: 'box', kind: 'wall', id: e.id ?? null, pos: e.pos, hx: e.hx, hz: e.hz, radius: 0, angle: e.angle ?? 0, y0: e.y ?? 0, y1: (e.y ?? 0) + (e.height ?? Infinity), ref: e});
  if (platforms) for (const p of mapState?.platforms ?? []) out.push({shape: 'box', kind: 'platform', id: p.id, pos: {x: p.pos ? p.pos.x : p.x, z: p.pos ? p.pos.z : p.z}, hx: (p.width ?? 3) / 2, hz: (p.depth ?? 3) / 2, radius: 0, angle: 0, y0: 0, y1: p.height, ref: p});
  if (obstacles) for (const o of mapState?.obstacles ?? []) {
    const y0 = o.pos?.y ?? 0;
    out.push({shape: o.shape === 'cylinder' || o.shape === 'pillar' ? 'circle' : 'box', kind: 'obstacle', id: o.id, pos: {x: o.pos?.x ?? 0, z: o.pos?.z ?? 0}, hx: o.hx ?? o.radius ?? 1.5, hz: o.hz ?? o.radius ?? 1.5, radius: o.radius ?? 1, angle: 0, y0, y1: y0 + (o.height ?? 1.5), ref: o});   // caixas do mapa são alinhadas aos eixos (`angle` do objeto é legado)
  }
  if (destructibles) for (const d of mapState?.destructibles ?? []) {
    if (d.state !== 'solid') continue;   // quebrado/fantasma não bloqueia
    const y0 = d.pos?.y ?? 0;
    out.push({shape: 'box', kind: 'destructible', id: d.id, pos: {x: d.pos.x, z: d.pos.z}, hx: d.size?.hx ?? .8, hz: d.size?.hz ?? .8, radius: 0, angle: 0, y0, y1: y0 + (d.size?.height ?? 1.6), y1Final: y0 + (d.targetHeight ?? d.size?.height ?? 1.6), ref: d});
  }
  return out;
}
/** O que uma linha de visão, onda de areia ou oclusão de área não atravessa: paredes, obstáculos e destrutíveis sólidos (sem plataformas). */
export const blockingSolids = (/** @type {any} */ world) => solidsOf(world?.mapState, world, {platforms: false, barriers: true});

/**
 * O ponto está dentro de algum sólido, com folga `margin` (distância exata à forma < margin; caixas giradas respeitadas)?
 * `y` (opcional) só conta sólidos cuja faixa vertical [y0, y1) contém essa altura.
 * @param {{x: number, z: number}} p @param {Solid[]} solids @param {{margin?: number, y?: number | null}} [opts]
 */
export function pointInSolid(p, solids, {margin = 0, y = null} = {}) {
  for (const s of solids) {
    if (y != null && (y < s.y0 || y >= s.y1)) continue;
    if (closestOnShape(/** @type {any} */ (s), p).distance < margin) return true;
  }
  return false;
}
/** O segmento a→b está livre de sólidos? Amostra a cada ~0,2 m (ponto inicial e final excluídos), como a visão sempre fez. */
export function segmentClear(/** @type {{x: number, z: number}} */ a, /** @type {{x: number, z: number}} */ b, /** @type {Solid[]} */ solids, step = .2) {
  if (!solids.length) return true;
  const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / step));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (pointInSolid({x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t}, solids)) return false;
  }
  return true;
}

/**
 * Sólidos no formato do grafo de navegação / diagnóstico de penetração (`{id, kind, shape: 'box'|'cyl', x, z, hx, hz, r, base, top}`): derivados de `solidsOf`
 * (sem paredes). Destrutível usa o topo final (`y1Final`): a rocha crescendo reconstruía o grafo a cada passo.
 * @param {any} mapState
 */
export function navSolidsOf(mapState) {
  return solidsOf(mapState, null).map(s => ({id: s.id, kind: s.kind, shape: s.shape === 'circle' ? 'cyl' : 'box', x: s.pos.x, z: s.pos.z, hx: s.hx, hz: s.hz, r: s.radius, base: s.y0, top: s.y1Final ?? s.y1}));
}
/** O ponto (x,z) está dentro do footprint (caixa alinhada ou cilindro) de um sólido do grafo, expandido por `pad` (quadrado, inclusivo)? */
export function insideFootprint(/** @type {any} */ s, /** @type {number} */ x, /** @type {number} */ z, pad = 0) {
  if (s.shape === 'cyl') return Math.hypot(x - s.x, z - s.z) <= s.r + pad;
  return Math.abs(x - s.x) <= s.hx + pad && Math.abs(z - s.z) <= s.hz + pad;
}

const GROUND = Object.freeze({y: 0, kind: 'ground', id: null, normal: Object.freeze({x: 0, y: 1, z: 0})});
/**
 * Superfície de APOIO na posição XZ (contrato da Fase 4): a mais alta entre plataformas, obstáculos e destrutíveis sólidos que apoiam um
 * lutador na altura `currentY` (null = qualquer altura), ou o piso. `y` é a altura real do topo; `normal` aponta para cima (as superfícies de
 * apoio são topos horizontais). Só considera superfícies válidas para a altura vertical atual do lutador (currentY).
 * `opts.destructibles = false` ignora destrutíveis; `opts.footMargin` troca a folga do pé (padrão: metade do meio-lado do lutador; 0 = footprint exato).
 * @param {any} pos @param {any} world @param {number | null} [currentY] @param {{destructibles?: boolean, footMargin?: number | null}} [opts]
 * @returns {{y: number, kind: 'ground' | 'platform' | 'obstacle' | 'destructible', id: any, normal: {x: number, y: number, z: number}}}
 */
export function groundSurface(pos, world, currentY = null, {destructibles: withDestructibles = true, footMargin: margin = null} = {}) {
  const mapState = world?.mapState;
  const platforms = mapState?.platforms ?? world?.platforms ?? C.map?.platforms;
  const obstacles = mapState?.obstacles ?? world?.obstacles ?? C.map?.obstacles;
  const destructibles = withDestructibles ? mapState?.destructibles ?? world?.destructibles : null;
  if (!platforms && !obstacles && !destructibles) return GROUND;
  /** @type {any} */ let best = GROUND;
  const footMargin = margin ?? (C.test?.halfExtent ?? 0.35) * 0.5;
  const support = (C.map?.mountTolerance ?? 0.25) + 0.10;   // apoio no topo: tolerância de montagem + 10 cm
  const consider = (/** @type {number} */ h, /** @type {string} */ kind, /** @type {any} */ id) => {
    if ((currentY === null || currentY >= h - support) && h > best.y) best = {y: h, kind, id, normal: GROUND.normal};
  };
  if (platforms) {
    for (const p of platforms) {
      const px = p.pos ? p.pos.x : p.x;
      const pz = p.pos ? p.pos.z : p.z;
      const hx = ((p.width ?? 3) / 2) + footMargin;
      const hz = ((p.depth ?? 3) / 2) + footMargin;
      if (Math.abs(pos.x - px) <= hx && Math.abs(pos.z - pz) <= hz) consider(p.height, 'platform', p.id ?? null);
    }
  }
  if (obstacles) {
    for (const o of obstacles) {
      const ox = o.pos?.x ?? 0, oz = o.pos?.z ?? 0;
      const h = (o.pos?.y ?? 0) + (o.height ?? 1.5);
      if (o.shape === 'cylinder' || o.shape === 'pillar') {
        const r = (o.radius ?? 1) + footMargin;
        const dx = pos.x - ox, dz = pos.z - oz;
        if (dx * dx + dz * dz <= r * r) consider(h, 'obstacle', o.id ?? null);
      } else {
        const hx = (o.hx ?? 1.5) + footMargin;
        const hz = (o.hz ?? 1.5) + footMargin;
        if (Math.abs(pos.x - ox) <= hx && Math.abs(pos.z - oz) <= hz) consider(h, 'obstacle', o.id ?? null);
      }
    }
  }
  if (destructibles) {
    for (const d of destructibles) {
      if (d.state !== 'solid') continue;
      const h = (d.pos?.y ?? 0) + (d.size?.height ?? 1.6);
      const hx = (d.size?.hx ?? 0.8) + footMargin;
      const hz = (d.size?.hz ?? 0.8) + footMargin;
      if (Math.abs(pos.x - d.pos.x) <= hx && Math.abs(pos.z - d.pos.z) <= hz) consider(h, 'destructible', d.id ?? null);
    }
  }
  return best;
}
/**
 * Altura do apoio na posição XZ (delega a `groundSurface`). Consumíveis usam `{footMargin: 0}`: footprint exato, sem filtro de altura
 * (mesmo resultado do antigo `getGroundHeightAt` do map-step, que também contava destrutíveis sólidos).
 * @param {any} pos @param {any} world @param {{currentY?: number | null, destructibles?: boolean, footMargin?: number | null}} [opts]
 */
export function groundHeightAt(pos, world, {currentY = null, destructibles = true, footMargin = null} = {}) {
  return groundSurface(pos, world, currentY, {destructibles, footMargin}).y;
}
