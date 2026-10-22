// @ts-check
// Sonda de colisão (Fase 7 do overhaul): leitura externa para as ferramentas visuais do laboratório. NÃO entra no estado da simulação, no save nem no replay
// (como physicsProbe): nada na simulação lê estes campos. Registra, por lutador, o último contato com o ambiente (objeto bloqueador, normal, profundidade
// corrigida e velocidade horizontal antes/depois) e as varreduras dos projéteis (trecho percorrido, ponto do primeiro contato e bloqueador).

import {C} from './config.js';

/** @typedef {{x: number, z: number}} V2 */
/** @typedef {{step: number, kind: string, id: any, normal: V2, depth: number, vBefore: V2, vAfter: V2, x: number, z: number}} EnvContact */
/** @typedef {{step: number, entity: any, a: V2, b: V2, hit: V2 | null, by: {kind: string, id: any} | null}} Sweep */

const MAX_SWEEPS = 64, MAX_HITS = 16;
export const collisionProbe = {
  /** Contador de passos físicos (idade dos registros = step atual − step do registro). */
  step: 0,
  /** @type {Record<number, EnvContact>} */ byFighter: {},
  /** @type {Sweep[]} */ sweeps: [],
  /** Varreduras que tocaram algo (as últimas), para o desenho não perder o ponto de impacto quando o projétil morre. @type {Sweep[]} */ hits: [],
};
export function resetCollisionProbe() {collisionProbe.step = 0;collisionProbe.byFighter = {};collisionProbe.sweeps = [];collisionProbe.hits = [];}
/** Velocidade horizontal que está valendo para o lutador (a do voo, no ar). */
export const horizontalOf = (/** @type {any} */ f) => ({x: (f.flight?.horizontal ?? f.velocity).x, z: (f.flight?.horizontal ?? f.velocity).z});
/** Registra o contato DEPOIS da resolução (vAfter = velocidade atual); a velocidade de antes (vx0, vz0) foi lida antes pelo chamador. */
export function noteContact(/** @type {any} */ f, /** @type {string} */ kind, /** @type {any} */ id, /** @type {V2} */ normal, /** @type {number} */ depth, /** @type {number} */ vx0, /** @type {number} */ vz0) {
  const prev = collisionProbe.byFighter[f.id], same = prev && prev.step === collisionProbe.step && prev.kind === kind && prev.id === id;   // vários subpassos do mesmo passo no mesmo objeto: fica a velocidade de ANTES do primeiro toque
  collisionProbe.byFighter[f.id] = {step: collisionProbe.step, kind, id, normal: {x: normal.x, z: normal.z}, depth: same ? Math.max(prev.depth, depth) : depth, vBefore: same ? prev.vBefore : {x: vx0, z: vz0}, vAfter: horizontalOf(f), x: f.position.x, z: f.position.z};
}
export function noteSweep(/** @type {any} */ entity, /** @type {V2} */ a, /** @type {V2} */ b, /** @type {{point: V2, solid: any} | null} */ hit) {
  /** @type {Sweep} */ const s = {step: collisionProbe.step, entity, a: {x: a.x, z: a.z}, b: {x: b.x, z: b.z}, hit: hit ? {x: hit.point.x, z: hit.point.z} : null, by: hit ? {kind: hit.solid?.kind ?? 'solid', id: hit.solid?.id ?? null} : null};
  collisionProbe.sweeps.push(s);if (collisionProbe.sweeps.length > MAX_SWEEPS) collisionProbe.sweeps.shift();
  if (hit) {collisionProbe.hits.push(s);if (collisionProbe.hits.length > MAX_HITS) collisionProbe.hits.shift();}
}

/**
 * Penetração (m) do corpo do lutador (quadrado de meio-lado `test.halfExtent`, altura `visual.bodyHeight`) num sólido de `collectSolids` (nav-graph): 0 = sem
 * penetração ou sem sobreposição vertical. Mesma geometria da física do mapa e derivada de C (não de constantes fixas): o diagnóstico acompanha os ajustes.
 */
export function bodyPenetration(/** @type {{x: number, y: number, z: number}} */ p, /** @type {any} */ s) {
  const half = C.test.halfExtent, head = p.y + (C.extras?.visual?.bodyHeight ?? 1.2);
  if (p.y >= s.top - 1e-9 || head <= s.base + 1e-9) return 0;
  if (s.shape === 'cyl') return Math.max(0, s.r + half - Math.hypot(p.x - s.x, p.z - s.z));
  const ox = s.hx + half - Math.abs(p.x - s.x), oz = s.hz + half - Math.abs(p.z - s.z);
  return ox > 0 && oz > 0 ? Math.min(ox, oz) : 0;
}
