// @ts-check
// Dividido de map.js (comportamento idêntico): map-spawn.

import {C} from '../config.js';
import {vec, length, clamp} from '../math.js';
import {dist2D, effectiveArenaRadius, getArenaScale, nextRandom, pickRandomConsumableType, randomRange, solidGap} from './map-state.js';
import {MAP_DEFAULTS} from './map-config.js';

/** Forma física de um sólido do mapa (obstáculo, destrutível ou plataforma) em XZ. */
function footprintOf(kind, o, pos = o.pos) {
  if (kind === 'platform') return {x: pos.x, z: pos.z, hx: o.width / 2, hz: o.depth / 2};
  if (kind === 'destructible') return {x: pos.x, z: pos.z, hx: o.size.hx, hz: o.size.hz};
  return o.shape === 'box' ? {x: pos.x, z: pos.z, hx: o.hx, hz: o.hz} : {x: pos.x, z: pos.z, r: o.radius};
}
/**
 * Motivo (o PRIMEIRO teste que falha) de a posição não servir para nascer, ou null se serve. Mesma ordem e medidas de sempre;
 * os motivos vão para mapState.spawnLog e para o evento spawnRejected (F4).
 * @param {any} pos @param {number} radius @param {any} mapState @param {any[]} [fighters] @param {number} [minDistFighter] @param {any} [solid]
 * @returns {null|'outsideArena'|'nearFighter'|'overlapsPlatform'|'overlapsObstacle'|'overlapsDestructible'|'passageClearance'}
 */
export function whyInvalidSpawn(pos, radius, mapState, fighters = [], minDistFighter = 5.0, solid = /** @type {any} */ (null)) {
  const arenaR = effectiveArenaRadius();
  const dCenter = Math.hypot(pos.x, pos.z);
  // Deve estar dentro da arena com margem
  if (dCenter + radius > arenaR - 2.0) return 'outsideArena';

  // Distância mínima dos lutadores
  for (const f of fighters) {
    if (f && f.position && dist2D(pos, f.position) < minDistFighter) return 'nearFighter';
  }

  // Não sobrepor plataformas
  for (const p of mapState.platforms) {
    const hw = p.width / 2 + radius + 0.5;
    const hd = p.depth / 2 + radius + 0.5;
    if (Math.abs(pos.x - p.pos.x) < hw && Math.abs(pos.z - p.pos.z) < hd) return 'overlapsPlatform';
  }

  // Não sobrepor obstáculos indestrutíveis
  for (const o of mapState.obstacles) {
    const or = (o.radius ?? Math.max(o.hx, o.hz)) + radius + 0.8;
    if (dist2D(pos, o.pos) < or) return 'overlapsObstacle';
  }

  // Não sobrepor outros destrutíveis sólidos
  for (const d of mapState.destructibles) {
    if (dist2D(pos, d.pos) < 1e-4) continue; // ignora a si mesmo se já estiver nesta coordenada
    if (d.state === 'solid' || d.state === 'ghost') {
      const dr = Math.max(d.size.hx, d.size.hz) + radius + 0.8;
      if (dist2D(pos, d.pos) < dr) return 'overlapsDestructible';
    }
  }

  // Objeto SÓLIDO: o vão até qualquer outro sólido tem de ser ≥ passageClearance (ou o lutador entra, não cabe e fica preso).
  if (solid) {
    const me = {x: pos.x, z: pos.z, ...solid}, need = C.map?.passageClearance ?? MAP_DEFAULTS.passageClearance;
    for (const p of mapState.platforms) if (solidGap(me, footprintOf('platform', p)) < need) return 'passageClearance';
    for (const o of mapState.obstacles) if (solidGap(me, footprintOf('obstacle', o)) < need) return 'passageClearance';
    for (const d of mapState.destructibles) {
      if (dist2D(pos, d.pos) < 1e-4) continue;
      if ((d.state === 'solid' || d.state === 'ghost') && solidGap(me, footprintOf('destructible', d)) < need) return 'passageClearance';
    }
  }

  return null;
}
/** @param {any} pos @param {number} radius @param {any} mapState @param {any[]} [fighters] @param {number} [minDistFighter] @param {any} [solid] */
export function isValidSpawnPosition(pos, radius, mapState, fighters = [], minDistFighter = 5.0, solid = /** @type {any} */ (null)) {
  return whyInvalidSpawn(pos, radius, mapState, fighters, minDistFighter, solid) === null;
}
/**
 * Busca sistemática da posição válida mais próxima (R9.12).
 * Se o ponto sorteado for inválido, espirala para fora até encontrar uma válida.
 * Se nenhuma for encontrada após tentativas, retorna null para adiar (R10.6).
 */
export function findNearestValidPosition(candidate, radius, mapState, fighters = [], maxAttempts = 32, solid = /** @type {any} */ (null), maxRing = 8) {
  if (isValidSpawnPosition(candidate, radius, mapState, fighters, 5.0, solid)) return candidate;

  const stepDist = 1.5;
  for (let ring = 1; ring <= maxRing; ring++) {
    const r = ring * stepDist;
    const count = ring * 8;
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2;
      const testPos = {
        x: candidate.x + Math.cos(theta) * r,
        z: candidate.z + Math.sin(theta) * r,
        y: candidate.y ?? 0,
      };
      if (isValidSpawnPosition(testPos, radius, mapState, fighters, 5.0, solid)) {
        return testPos;
      }
    }
  }
  return null; // Adiar geração (R10.6)
}
/** Anéis da reamostragem de objetos do mapa (F4): os 8 de sempre (1,5 m a 12 m) + 2 (até 15 m). Anéis 1–8 na mesma ordem: onde já achava, acha o mesmo ponto. */
export const SPAWN_RINGS = 10;
/** Tamanho do registro de recusas (mapState.spawnLog): só as últimas. */
export const SPAWN_LOG_MAX = 32;
/**
 * Coloca ou recusa (F4): a posição sorteada se válida, senão a válida mais próxima na espiral (SPAWN_RINGS anéis); sem nenhuma,
 * {rejected: motivo do ponto sorteado} — nunca mais «nasce assim mesmo» dentro de sólido ou colado em lutador. A espiral não consome RNG:
 * recusar ou não deixa a sequência de sorteios da seed idêntica. `solid` = pegada do objeto sólido (regra de passagem), como em isValidSpawnPosition.
 * @param {any} rawPos @param {number} radius @param {any} mapState @param {any[]} [fighters] @param {any} [solid] @param {{rings?: number}} [opts]
 * @returns {{pos: any} | {rejected: string}}
 */
export function placeOrReject(rawPos, radius, mapState, fighters = [], solid = /** @type {any} */ (null), {rings = SPAWN_RINGS} = {}) {
  const pos = findNearestValidPosition(rawPos, radius, mapState, fighters, 32, solid, rings);
  return pos ? {pos} : {rejected: /** @type {string} */ (whyInvalidSpawn(rawPos, radius, mapState, fighters, 5.0, solid))};
}
/** Registra uma recusa em mapState.spawnLog ({tick, kind, reason}), mantendo as últimas SPAWN_LOG_MAX. Save antigo sem o campo ganha a lista aqui. */
/** @param {any} mapState @param {number|null} tick @param {string} kind @param {string} reason */
export function logSpawnRejection(mapState, tick, kind, reason) {
  const log = (mapState.spawnLog ??= []);
  log.push({tick, kind, reason});
  if (log.length > SPAWN_LOG_MAX) log.splice(0, log.length - SPAWN_LOG_MAX);
}
/**
 * Ponto válido mais próximo de `target` em TODA a arena (lutador nunca é recusado): varredura determinística em grade de 0,5 m, desempate pela
 * ordem da varredura. Sem ponto que respeite a distância aos outros lutadores, relaxa essa regra; sem nenhum (arena minúscula), devolve `target`.
 * @param {any} target @param {number} radius @param {any} mapState @param {any[]} [fighters] @returns {any}
 */
export function nearestValidInArena(target, radius, mapState, fighters = []) {
  const R = effectiveArenaRadius(), step = 0.5, n = Math.floor(R / step);
  for (const fs of [fighters, []]) {
    let best = /** @type {any} */ (null), bestD = Infinity;
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const p = {x: i * step, y: target.y ?? 0, z: j * step}, d = (p.x - target.x) ** 2 + (p.z - target.z) ** 2;
      if (d < bestD && isValidSpawnPosition(p, radius, mapState, fs)) {best = p;bestD = d;}
    }
    if (best) return best;
  }
  return target;
}
/** Folga (m) entre o corpo quadrado de um lutador e uma caixa alinhada aos eixos centrada em (x, z); negativa = sobreposição. */
export function bodyGapToBox(pos, x, z, hx, hz) {
  const r = C.test?.halfExtent ?? 0.5;
  return Math.max(Math.abs(pos.x - x) - hx - r, Math.abs(pos.z - z) - hz - r);
}
/**
 * Algum lutador impede materializar (ou posicionar) uma caixa sólida aqui? Vale se o corpo, na mesma faixa de altura do objeto
 * (R3.13 em 3D: quem está no ar acima do topo não bloqueia), estiver a menos de `map.spawnClearance` da caixa — sobreposição incluída.
 */
export function fighterBlocksBox(fighters, x, z, hx, hz, y0, y1) {
  const clearance = C.map?.spawnClearance ?? MAP_DEFAULTS.spawnClearance, bodyH = C.extras?.visual?.bodyHeight ?? 1.2;
  for (const f of fighters) {
    if (!f?.position || f.hp <= 0 || f.absent) continue;
    const alt = (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0);
    if (alt >= y1 || alt + bodyH <= y0) continue;
    if (bodyGapToBox(f.position, x, z, hx, hz) < clearance) return true;
  }
  return false;
}
/**
 * Reposiciona plataformas que nasceriam sobre (ou colada em) um lutador: espiral determinística de 1,5 m a partir da posição sorteada,
 * sem consumir RNG (as demais seeds ficam idênticas). Sem posição válida, mantém a sorteada e registra em mapState.placementConflicts.
 */
function clearPlatformsOfFighters(mapState, fighters) {
  const arenaR = effectiveArenaRadius(), square = (C.map?.arenaShape ?? 'circle') === 'square', half = C.test?.arenaHalf ?? 16, passage = C.map?.passageClearance ?? MAP_DEFAULTS.passageClearance;
  // Mesmo contorno do clampToArena: circular (raio − 2 m de margem) ou, na arena quadrada, o meio-lado.
  const inside = (p, pos) => square ? Math.max(Math.abs(pos.x) + p.width / 2, Math.abs(pos.z) + p.depth / 2) <= half : Math.hypot(pos.x, pos.z) + Math.hypot(p.width, p.depth) / 2 <= arenaR - 2.0;
  const clear = (p, pos, placed) => !fighterBlocksBox(fighters, pos.x, pos.z, p.width / 2, p.depth / 2, 0, p.height)
    && placed.every(o => Math.abs(pos.x - o.pos.x) >= (p.width + o.width) / 2 + passage || Math.abs(pos.z - o.pos.z) >= (p.depth + o.depth) / 2 + passage)
    && inside(p, pos);
  const placed = [];
  for (const p of mapState.platforms) {
    if (!clear(p, p.pos, placed)) {
      let moved = false;
      for (let ring = 1; ring <= 8 && !moved; ring++) {
        const n = ring * 8;
        for (let i = 0; i < n && !moved; i++) {
          const theta = (i / n) * Math.PI * 2, pos = {x: p.pos.x + Math.cos(theta) * ring * 1.5, y: p.pos.y, z: p.pos.z + Math.sin(theta) * ring * 1.5};
          if (clear(p, pos, placed)) {p.pos = pos;moved = true;}
        }
      }
      if (!moved) mapState.placementConflicts = (mapState.placementConflicts ?? 0) + 1;
    }
    placed.push(p);
  }
}
/** Inicializa a arena completa com plataformas, obstáculos, destrutíveis e itens iniciais. */
export function initMap(mapState, fighters = []) {
  const M = C.map ?? MAP_DEFAULTS;
  const arenaR = M.arenaRadius ?? 50;
  const arenaScale = getArenaScale();

  // 1. Duas plataformas de 3x3m com alturas 1.0m e 1.5m (R7.4, R7.5, R2.9)
  // Posições escaladas pelo tamanho da arena para permanecerem dentro da borda.
  // Quantidade configurável via M.platformCount (padrão 2; 0 desativa plataformas).
  const platformDefs = [
    {
      id: 'plat_1',
      pos: {x: -12 + (nextRandom(mapState) - 0.5) * 8, y: 0, z: 10 + (nextRandom(mapState) - 0.5) * 8},
      width: 3.0,
      depth: 3.0,
      height: 1.0,
    },
    {
      id: 'plat_2',
      pos: {x: 12 + (nextRandom(mapState) - 0.5) * 8, y: 0, z: -10 + (nextRandom(mapState) - 0.5) * 8},
      width: 3.0,
      depth: 3.0,
      height: 1.5,
    },
  ];
  const platformCount = clamp(M.platformCount ?? 2, 0, platformDefs.length);
  mapState.platforms = platformDefs.slice(0, platformCount).map(p => ({
    ...p,
    pos: {x: p.pos.x * arenaScale, y: p.pos.y, z: p.pos.z * arenaScale},
  }));

  clearPlatformsOfFighters(mapState, fighters);   // R3.13: proteger as posições iniciais dos lutadores

  // 2. Obstáculos indestrutíveis: mistura de caixas, cilindros e pilares (R1.7, R3.11)
  mapState.obstacles = [];
  const obstacleShapes = [
    {shape: 'box', hx: 1.5, hz: 1.5, height: 2.2},
    {shape: 'cylinder', radius: 1.4, height: 3.0},
    {shape: 'pillar', radius: 0.9, height: 4.5},
    {shape: 'box', hx: 2.0, hz: 1.0, height: 1.8},
  ];

  const obstacleCount = M.obstacleCount ?? 4;
  for (let i = 0; i < obstacleCount; i++) {
    const s = obstacleShapes[i % obstacleShapes.length];
    const angle = (i / 4) * Math.PI * 2 + randomRange(mapState, -0.4, 0.4);
    const dist = randomRange(mapState, 14, 28) * arenaScale;
    const rawPos = {x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, y: 0};
    const shapeBox = s.shape === 'box', solid = shapeBox ? {hx: s.hx, hz: s.hz} : {r: s.radius};
    const placed = placeOrReject(rawPos, 2.0, mapState, fighters, solid);
    const facing = (randomRange(mapState, 0, Math.PI * 2), 0);   // o sorteio é consumido (sequência da RNG preservada), mas a física sempre tratou caixas como alinhadas aos eixos: o desenho passa a ser igual
    if ('rejected' in placed) {   // F4: sem posição válida o obstáculo não nasce (antes ficava no ponto sorteado, dentro de outro sólido)
      mapState.placementConflicts = (mapState.placementConflicts ?? 0) + 1;logSpawnRejection(mapState, 0, 'obstacle', placed.rejected);continue;
    }
    mapState.obstacles.push({
      id: `obs_${i + 1}`,
      pos: placed.pos,
      shape: s.shape,
      hx: s.hx ?? s.radius,
      hz: s.hz ?? s.radius,
      radius: s.radius ?? Math.max(s.hx, s.hz),
      height: s.height,
      angle: facing,
    });
  }

  // 3. Objetos destrutíveis com 30 HP cada (R1.3, R1.4, R9.11)
  mapState.destructibles = [];
  const destructibleCount = M.destructibleCount ?? 4;
  for (let i = 0; i < destructibleCount; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4 + randomRange(mapState, -0.3, 0.3);
    const dist = randomRange(mapState, 10, 24) * arenaScale;
    const rawPos = {x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, y: 0};
    const placed = placeOrReject(rawPos, 1.2, mapState, fighters, {hx: 0.8, hz: 0.8});
    const facing = (randomRange(mapState, 0, Math.PI * 2), 0);   // idem obstáculos: caixa alinhada aos eixos (sorteio consumido mesmo na recusa)
    if ('rejected' in placed) {
      mapState.placementConflicts = (mapState.placementConflicts ?? 0) + 1;logSpawnRejection(mapState, 0, 'destructible', placed.rejected);continue;
    }
    const baseHp = M.destructibleHp ?? 30;
    mapState.destructibles.push({
      id: `dest_${i + 1}`,
      hp: baseHp,
      maxHp: baseHp,
      pos: placed.pos,
      size: {hx: 0.8, hz: 0.8, height: 1.6},
      shape: 'box',
      angle: facing,
      state: 'solid',
      respawnTimer: 0,
      ghostTimer: 0,
      resistances: {physical: 1.0, projectile: 1.0, area: 1.0, environmental: 1.0}, // R9.10
    });
  }

  // 4. Consumíveis iniciais equiprováveis (R4.4, R6.4, R10.9); quantidade configurável
  mapState.items = [];
  const initialItems = M.itemInitialCount ?? 2;
  for (let i = 0; i < initialItems; i++) {
    const t = pickRandomConsumableType(mapState);
    const angle = randomRange(mapState, 0, Math.PI * 2);
    const dist = randomRange(mapState, 8, 22) * arenaScale;
    const rawPos = {x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, y: 0.4};
    const placed = placeOrReject(rawPos, 1.0, mapState, fighters);
    if ('rejected' in placed) {logSpawnRejection(mapState, 0, 'item', placed.rejected);continue;}   // F4: recusa no lugar de «|| rawPos»
    mapState.items.push({
      id: mapState.nextEntityId++,
      type: t,
      pos: placed.pos,
      life: M.itemLifetime ?? 15,
      isDrop: false,
      vy: 0,
    });
    mapState.itemStats.spawned++;
  }

  // Timer para o próximo spawn regular (20 a 40 segundos, R6.1)
  mapState.regularSpawnTimer = randomRange(mapState, M.itemSpawnIntervalMin ?? 20, M.itemSpawnIntervalMax ?? 40);
}
/**
 * Sorteia dois pontos iniciais opostos válidos com separação equilibrada (R11.1).
 */
export function generateFighterSpawnPositions(mapState) {
  const s = getArenaScale();
  const separationRadius = randomRange(mapState, 6.0, 9.0) * s; // separação mútua escalada
  const baseAngle = randomRange(mapState, 0, Math.PI * 2);
  for (let attempt = 0; attempt < 16; attempt++) {
    const angle = baseAngle + (attempt * Math.PI) / 8;
    const p0 = {x: Math.cos(angle) * separationRadius, z: Math.sin(angle) * separationRadius, y: 0};
    const p1 = {x: -p0.x, z: -p0.z, y: 0};
    const valid0 = findNearestValidPosition(p0, 1.0, mapState, []);
    if (!valid0) continue;
    const valid1 = findNearestValidPosition(p1, 1.0, mapState, [{position: valid0}]);
    if (!valid1) continue;
    return [vec(valid0.x, valid0.z), vec(valid1.x, valid1.z)];
  }
  // Lutador nunca é recusado (F4): o ponto padrão só se válido; senão o válido mais próximo da arena inteira (motivo no spawnLog).
  const keep = (/** @type {any} */ p, /** @type {any[]} */ fs) => {
    const why = whyInvalidSpawn(p, 1.0, mapState, fs);
    if (why === null) return p;
    logSpawnRejection(mapState, 0, 'fighter', why);
    return nearestValidInArena(p, 1.0, mapState, fs);
  };
  const p0 = keep({x: 0, y: 0, z: -8 * s}, []), p1 = keep({x: 0, y: 0, z: 8 * s}, [{position: p0}]);
  return [vec(p0.x, p0.z), vec(p1.x, p1.z)];
}
