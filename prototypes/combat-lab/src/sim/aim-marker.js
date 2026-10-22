// @ts-check
// Mira por MARCADOR (Moves Normais com destino: Spikes, Bullet Punch, Emerging Stone, Sand Wave): segurar o botão do slot abre o marcador, a direção do input o
// move pelo mundo (o corpo fica parado, MV-P29), soltar CONFIRMA — se o marcador for válido o Move é cobrado (stamina e recarga) e o cast começa; se for inválido
// (fora do alcance 3D, sem apoio, dentro de parede ou de personagem) soltar apenas cancela, sem custo (MV-P30). O marcador nunca é teleportado para o limite:
// fica onde está, inválido, até o jogador o trazer de volta. Depois de confirmado o destino é FIXO em coordenadas do mundo (`action.marker`).
// Este arquivo é o núcleo puro (validade e movimento); quem decide quando abre, cancela e confirma é o controlador.
import {C} from './config.js';
import {getGroundHeight} from './physics.js';
import {closestOnShape} from './world.js';
import {effectiveArenaRadius} from './map.js';
import {solidsOf, insideSolid} from './vision.js';
import {add, scale, sub, length, normalize, direction} from './math.js';

/**
 * O marcador em `pos` é válido para o lutador `f`? Alcance TRIDIMENSIONAL (inclui a diferença de altura até o apoio), apoio sólido sob o ponto (até `maxRise` acima
 * dos pés), arena, e livre de paredes/barreiras e de corpos. Devolve também a altura `y` do apoio.
 * @returns {{valid: boolean, reason: string|null, y: number, distance: number}}
 */
export function markerValidity(/** @type {any} */ f, /** @type {Record<string, any>} */ P, /** @type {{x: number, z: number}} */ pos, /** @type {any} */ world, /** @type {any[]} */ fighters) {
  const fy = f.groundY ?? 0;
  const y = getGroundHeight(pos, world, fy + (P.maxRise ?? 2));
  const dx = pos.x - f.position.x, dz = pos.z - f.position.z, dy = y - fy, distance = Math.hypot(dx, dz, dy);
  const bad = (/** @type {string} */ reason) => ({valid: false, reason, y, distance});
  if (Math.hypot(pos.x, pos.z) > effectiveArenaRadius() - (P.edgeMargin ?? .3)) return bad('outsideArena');
  if (distance > P.range + 1e-9) return bad('range');
  if ((P.minRange ?? 0) > 0 && distance < P.minRange - 1e-9) return bad('tooClose');
  for (const e of world?.entities ?? []) {
    if (e.dead || e.shape !== 'box' || (e.kind !== 'wall' && e.kind !== 'barrier') || !(e.blocksFighters ?? e.kind === 'wall')) continue;
    if (closestOnShape(e, pos).distance < (P.radius ?? 0)) return bad('blocked');
  }
  const bodyR = (C.test.halfExtent ?? .35) + (P.bodyMargin ?? 0);
  if (!P.allowOccupied) for (const o of fighters) {
    if (o.hp <= 0 || o.flight) continue;
    if (Math.hypot(pos.x - o.position.x, pos.z - o.position.z) < bodyR && Math.abs((o.groundY ?? 0) - y) < (C.extras?.visual?.bodyHeight ?? 1.2)) return bad('occupied');
  }
  return {valid: true, reason: null, y, distance};
}

/** Posição inicial do marcador: sobre o alvo travado (limitada ao alcance) ou à frente do lutador a `startDistance`. */
export function markerInitial(/** @type {any} */ f, /** @type {Record<string, any>} */ P, /** @type {any} */ locked) {
  const ahead = direction(f.facing);
  if (locked) {
    const d = sub(locked.position, f.position), l = length(d);
    return l <= P.range ? {x: locked.position.x, z: locked.position.z} : add(f.position, scale(normalize(d), P.range));
  }
  return {x: f.position.x + ahead.x * P.startDistance, z: f.position.z + ahead.z * P.startDistance};
}

/**
 * Marcador SEGUINDO o lutador (aimMode 'follow', Bullet Punch): distância cresce de `startDistance` a `maxDistance` em `growTime` s com curva QUADRÁTICA
 * (devagar e acelerando), na direção do último input (independente do corpo), e PARA no último ponto válido antes de parede ou borda da arena.
 * `enemyNear` = há adversário vivo dentro de `reach` do marcador (o círculo fica vermelho; não garante alvo nem acerto).
 */
export function followMarker(/** @type {any} */ f, /** @type {any} */ a, /** @type {{x: number, z: number}} */ input, /** @type {number} */ dt, /** @type {any} */ world, /** @type {any[]} */ fighters) {
  const P = a.params;
  if (length(input) > .01) a.dir = normalize(input);
  a.t += dt;
  const u = Math.min(1, a.t / P.growTime), want = P.startDistance + (P.maxDistance - P.startDistance) * u * u;
  const solids = solidsOf(world), lim = effectiveArenaRadius() - (P.edgeMargin ?? .3);
  let dist = 0, blocked = false;
  for (let d = .25; d <= want + 1e-9; d += .25) {
    const p = {x: f.position.x + a.dir.x * d, z: f.position.z + a.dir.z * d};
    if (Math.hypot(p.x, p.z) > lim || insideSolid(solids, p, C.test.halfExtent * .6)) {blocked = true;break;}
    dist = d;
  }
  if (!blocked) dist = want;
  a.pos = {x: f.position.x + a.dir.x * dist, z: f.position.z + a.dir.z * dist};
  a.distance = dist;a.y = getGroundHeight(a.pos, world, (f.groundY ?? 0) + (P.maxRise ?? 2));
  a.valid = true;a.reason = null;
  a.enemyNear = fighters.some(o => o.id !== f.id && o.hp > 0 && !o.absent && Math.hypot(o.position.x - a.pos.x, o.position.z - a.pos.z) <= P.reach);
}

/** Move o marcador pela direção do input (mundo) a `speed` m/s. */
export function markerMove(/** @type {{x: number, z: number}} */ pos, /** @type {{x: number, z: number}} */ input, /** @type {number} */ speed, /** @type {number} */ dt) {
  const l = length(input);
  return l > .01 ? add(pos, scale(normalize(input), speed * Math.min(1, l) * dt)) : pos;
}
