// @ts-check
// Dividido de map.js (comportamento idêntico): map-state.

import {C} from '../config.js';
import {length, clamp} from '../math.js';
import {CONSUMABLE_TYPES, MAP_DEFAULTS} from './map-config.js';

/** Cria o estado inicial do mapa (serializável para save/replay). */
export function createMapState(seed = 12345) {
  return {
    seed,
    rngState: seed,
    regularSpawnTimer: 25, // segundos até próximo item regular
    items: [], // {id, type, pos: {x,y,z}, life: 15, isDrop: false, vy: 0}
    destructibles: [], // {id, hp, maxHp: 30, pos: {x,y,z}, size: {hx, hz, height}, shape: 'box', angle: 0, state: 'solid'|'dead'|'ghost', respawnTimer: 0, ghostTimer: 0}
    obstacles: [], // {id, pos: {x,y,z}, shape: 'box'|'cylinder', hx, hz, radius, height, angle: 0}
    platforms: [], // {id, pos: {x,y,z}, width: 3, depth: 3, height: 1.0/1.5}
    nextEntityId: 1000,
    itemStats: {spawned: 0, collected: 0, expired: 0},
    destructibleStats: {broken: 0, respawned: 0},
    placementConflicts: 0, // objetos sólidos sem posição válida (livre de lutadores e com passagem): recusados (F4: não nascem); contagem visível no diagnóstico
    spawnLog: [], // F4: últimas 32 recusas de spawn {tick, kind: 'obstacle'|'destructible'|'item'|'fighter', reason} (fighter = realocado, nunca recusado)
  };
}
/** Gerador pseudoaleatório determinístico linear congruencial. */
export function nextRandom(state) {
  state.rngState = (state.rngState * 1664525 + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}
export function randomRange(state, min, max) {
  return min + nextRandom(state) * (max - min);
}
/**
 * Fator de escala para posicionar os objetos do mundo em função do tamanho atual
 * da arena. As distâncias fixas (plataformas, ranges de spawn de obstáculos,
 * destrutíveis, itens e lutadores) foram pensadas para a arena padrão (raio 50 m);
 * ao alterar o raio (slider de raio) ou o meio-lado (arena quadrada), tudo se
 * reposiciona proporcionalmente e permanece dentro da arena.
 */
export function getArenaScale() {
  const M = C.map ?? MAP_DEFAULTS;
  if ((M.arenaShape ?? 'circle') === 'square') {
    // Arena quadrada: meio-lado padrão 16 m corresponde ao raio padrão de 50 m.
    return (C.test?.arenaHalf ?? 16) / 50;
  }
  return (M.arenaRadius ?? 50) / 50;
}
/**
 * Raio efetivo da arena circular. É a MESMA medida usada pelo limite físico
 * (clampToArena), pela renderização (piso/anél) e pela validação de spawns: assim a
 * parede física coincide EXATAMENTE com a parede visível e nada spawna fora da área
 * alcançável. Única redução admitida: o cap técnico explícito de cenários de teste
 * (C.test.circleCap) — nunca o meio-lado legado da arena quadrada (C.test.arenaHalf),
 * que não representa a borda circular e gerava "paredes invisíveis".
 */
export function effectiveArenaRadius() {
  const r = C.map?.arenaRadius ?? MAP_DEFAULTS.arenaRadius;
  return C.test?.circleCap != null ? Math.min(C.test.circleCap, r) : r;
}
/** Escolhe um tipo de consumível com probabilidades exatamente iguais (R4.7). */
export function pickRandomConsumableType(state) {
  const idx = Math.floor(nextRandom(state) * CONSUMABLE_TYPES.length);
  return CONSUMABLE_TYPES[clamp(idx, 0, CONSUMABLE_TYPES.length - 1)];
}
/** Distância 2D no plano XZ. */
export function dist2D(p1, p2) {
  return Math.hypot(p1.x - p2.x, (p1.z ?? p1.y) - (p2.z ?? p2.y));
}
/** Distância 3D real entre dois pontos (R11.5). */
export function dist3D(p1, p2) {
  const y1 = p1.y ?? 0, y2 = p2.y ?? 0;
  return Math.hypot(p1.x - p2.x, y1 - y2, p1.z - p2.z);
}
/**
 * Validação espacial de posições (R3.13, R9.12):
 * Garante que não sobreponha outros objetos, plataformas, spawns de lutadores,
 * e permaneça dentro da arena circular de 50 m.
 */
/** Vão exato (m) entre duas formas do plano XZ: caixa alinhada {x, z, hx, hz} ou círculo {x, z, r}; negativo = sobreposição. */
export function solidGap(a, b) {
  if (a.r != null && b.r != null) return Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
  if (a.r != null || b.r != null) {
    const [c, k] = a.r != null ? [a, b] : [b, a], dx = Math.max(Math.abs(c.x - k.x) - k.hx, 0), dz = Math.max(Math.abs(c.z - k.z) - k.hz, 0);
    return dx === 0 && dz === 0 ? -(c.r + Math.min(k.hx - Math.abs(c.x - k.x), k.hz - Math.abs(c.z - k.z))) : Math.hypot(dx, dz) - c.r;
  }
  const dx = Math.abs(a.x - b.x) - a.hx - b.hx, dz = Math.abs(a.z - b.z) - a.hz - b.hz;
  return dx > 0 && dz > 0 ? Math.hypot(dx, dz) : Math.max(dx, dz);
}
