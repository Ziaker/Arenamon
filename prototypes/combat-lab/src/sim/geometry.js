// @ts-check
// Geometria do plano XZ para barreiras finas (Reflect) e projéteis rápidos: retângulos orientados, varredura de segmento
// (primeiro contato com identificação da superfície) e segmento 3D contra volume. Funções puras, sem estado.
// Convenção da simulação (a mesma de world.closestOnShape): uma caixa tem centro `pos`, ângulo `angle` (rumo 0 = +Z) e meias-medidas
// hx (eixo x' = (cos, −sin), “lateral”) e hz (eixo z' = (sin, cos), “frente”). Para a barreira do Reflect: z' aponta para o lado
// de quem enfrenta o oponente (FRENTE = +z'); o verso (−z') fica do lado de quem lançou; as bordas são ±x'.

/** @typedef {{x: number, z: number}} V2 */
/** @typedef {{pos: V2, angle?: number, hx: number, hz: number}} Rect */

/** Coordenadas locais (u ao longo de x', v ao longo de z') de um ponto do mundo. */
export function toLocal(/** @type {Rect} */ r, /** @type {V2} */ p) {
  const c = Math.cos(r.angle ?? 0), s = Math.sin(r.angle ?? 0), dx = p.x - r.pos.x, dz = p.z - r.pos.z;
  return {u: dx * c - dz * s, v: dx * s + dz * c};
}
/** Ponto do mundo a partir de coordenadas locais. */
export function toWorld(/** @type {Rect} */ r, /** @type {number} */ u, /** @type {number} */ v) {
  const c = Math.cos(r.angle ?? 0), s = Math.sin(r.angle ?? 0);
  return {x: r.pos.x + u * c + v * s, z: r.pos.z - u * s + v * c};
}
/** Normais do mundo: frente (+z'), verso (−z'), bordas (±x'). */
export function faceNormals(/** @type {Rect} */ r) {
  const c = Math.cos(r.angle ?? 0), s = Math.sin(r.angle ?? 0);
  return {front: {x: s, z: c}, back: {x: -s, z: -c}, edgePlus: {x: c, z: -s}, edgeMinus: {x: -c, z: s}};
}

/**
 * Projeta um círculo para fora de uma caixa orientada. Retorna a posição corrigida e a normal de saída,
 * ou null quando não há penetração. Funciona também quando o centro nasce dentro da caixa: nesse caso
 * escolhe a face mais próxima, em vez de empurrar radialmente e deixar o corpo preso no volume.
 * @param {Rect} rect @param {V2} point @param {number} radius
 */
export function projectCircleFromBox(rect, point, radius) {
  const p = toLocal(rect, point), qu = Math.max(-rect.hx, Math.min(rect.hx, p.u)), qv = Math.max(-rect.hz, Math.min(rect.hz, p.v));
  const du = p.u - qu, dv = p.v - qv, d2 = du * du + dv * dv;
  if (d2 >= radius * radius - 1e-12) return null;
  let u, v;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2), nx = du / d, nz = dv / d;u = qu + nx * radius;v = qv + nz * radius;
  } else {
    const toX = rect.hx + radius - Math.abs(p.u), toZ = rect.hz + radius - Math.abs(p.v);
    if (toX < toZ) {u = (p.u >= 0 ? 1 : -1) * (rect.hx + radius);v = p.v;}
    else {u = p.u;v = (p.v >= 0 ? 1 : -1) * (rect.hz + radius);}
  }
  const position = toWorld(rect, u, v), dx = position.x - point.x, dz = position.z - point.z, len = Math.hypot(dx, dz);
  return {position, normal: len > 1e-12 ? {x: dx / len, z: dz / len} : {x: 1, z: 0}, depth: len};
}

/** Quatro cantos de um retângulo orientado. */
const corners = (/** @type {Rect} */ r) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => toWorld(r, a * r.hx, b * r.hz));
/** Dois retângulos orientados se sobrepõem? (SAT; encostar sem penetrar não conta). */
export function rectsOverlap(/** @type {Rect} */ a, /** @type {Rect} */ b, eps = 1e-9) {
  const axes = [0, Math.PI / 2].flatMap(k => [(a.angle ?? 0) + k, (b.angle ?? 0) + k]);
  const ca = corners(a), cb = corners(b);
  for (const t of axes) {
    const ax = Math.cos(t), az = -Math.sin(t);        // eixo x' de um retângulo com ângulo t (suficiente: cobre também z' via +π/2)
    const pa = ca.map(p => p.x * ax + p.z * az), pb = cb.map(p => p.x * ax + p.z * az);
    if (Math.max(...pa) <= Math.min(...pb) + eps || Math.max(...pb) <= Math.min(...pa) + eps) return false;
  }
  return true;
}

/**
 * Varre o segmento a→b de um disco de raio `r` contra a caixa e devolve o PRIMEIRO contato com a superfície atingida
 * (M7.7: primeira superfície fisicamente atingida; M30.5: empate dentro de `tieDistance` → frente > borda > verso).
 * Devolve null (sem contato), {inside: true} (o segmento começa dentro da caixa expandida) ou
 * {t, face: 'front' | 'back' | 'edge', normal, point, len}.
 * @param {Rect} rect @param {V2} a @param {V2} b @param {number} r @param {number} tieDistance
 */
export function sweepBox(rect, a, b, r, tieDistance) {
  const L = toLocal(rect, a), M = toLocal(rect, b), hx = rect.hx + r, hz = rect.hz + r;
  const du = M.u - L.u, dv = M.v - L.v;
  const slab = (/** @type {number} */ o, /** @type {number} */ d, /** @type {number} */ h) => {
    if (Math.abs(d) < 1e-12) return Math.abs(o) <= h ? {enter: -Infinity, exit: Infinity} : null;
    const t1 = (-h - o) / d, t2 = (h - o) / d;return {enter: Math.min(t1, t2), exit: Math.max(t1, t2)};
  };
  const su = slab(L.u, du, hx), sv = slab(L.v, dv, hz);
  if (!su || !sv) return null;
  const enter = Math.max(su.enter, sv.enter), exit = Math.min(su.exit, sv.exit);
  if (enter > exit || exit < 0 || enter > 1) return null;
  if (enter < 0) return {inside: true};
  const len = Math.hypot(b.x - a.x, b.z - a.z), N = faceNormals(rect);
  const vFace = dv > 0 ? 'back' : 'front';                       // andando em +v entra pelo verso (−v); em −v, pela frente (+v)
  const tie = Number.isFinite(su.enter) && Number.isFinite(sv.enter) && Math.abs(su.enter - sv.enter) * len <= tieDistance;
  /** @type {'front' | 'back' | 'edge'} */
  let face;
  if (tie) face = vFace === 'front' ? 'front' : 'edge';          // frente > borda > verso
  else face = sv.enter > su.enter ? vFace : 'edge';
  const normal = face === 'front' ? N.front : face === 'back' ? N.back : du > 0 ? N.edgeMinus : N.edgePlus;
  return {t: enter, face, normal, point: {x: a.x + (b.x - a.x) * enter, z: a.z + (b.z - a.z) * enter}, len};
}

/**
 * Segmento 3D (ponto com altura `y`) cruza o volume da caixa (altura de `y0` a `y0 + height`)? Usado na proteção contra
 * explosões (M30.7): do centro da explosão ao centro do corpo.
 * @param {Rect} rect @param {number} y0 @param {number} height
 * @param {{x: number, z: number, y: number}} p0 @param {{x: number, z: number, y: number}} p1
 */
export function segmentHitsVolume(rect, y0, height, p0, p1) {
  const A = toLocal(rect, p0), B = toLocal(rect, p1);
  // [origem, deslocamento, mínimo, máximo] por eixo: lateral e frente centrados na caixa; vertical de 0 a height (em relação a y0)
  const axes = [[A.u, B.u - A.u, -rect.hx, rect.hx], [A.v, B.v - A.v, -rect.hz, rect.hz], [p0.y - y0, p1.y - p0.y, 0, height]];
  let enter = 0, exit = 1;
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-12) {if (o < lo || o > hi) return false;continue;}
    const t1 = (lo - o) / d, t2 = (hi - o) / d;enter = Math.max(enter, Math.min(t1, t2));exit = Math.min(exit, Math.max(t1, t2));
    if (enter > exit) return false;
  }
  return true;
}
