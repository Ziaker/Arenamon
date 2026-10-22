// @ts-check
// Sonda de colisão (Fase 7 do overhaul): leitura externa para as ferramentas visuais do laboratório. NÃO entra no estado da simulação, no save nem no replay
// (como physicsProbe): nada na simulação lê estes campos. Registra, por lutador, o último contato com o ambiente (objeto bloqueador, normal, profundidade
// corrigida e velocidade horizontal antes/depois) e as varreduras dos projéteis (trecho percorrido, ponto do primeiro contato e bloqueador).

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
/** Registra o contato DEPOIS da resolução (vAfter = velocidade atual); `vBefore` foi lida antes pelo chamador. */
export function noteContact(/** @type {any} */ f, /** @type {string} */ kind, /** @type {any} */ id, /** @type {V2} */ normal, /** @type {number} */ depth, /** @type {V2} */ vBefore) {
  const prev = collisionProbe.byFighter[f.id], same = prev && prev.step === collisionProbe.step && prev.kind === kind && prev.id === id;   // vários subpassos do mesmo passo no mesmo objeto: fica a velocidade de ANTES do primeiro toque
  collisionProbe.byFighter[f.id] = {step: collisionProbe.step, kind, id, normal: {x: normal.x, z: normal.z}, depth: same ? Math.max(prev.depth, depth) : depth, vBefore: same ? prev.vBefore : vBefore, vAfter: horizontalOf(f), x: f.position.x, z: f.position.z};
}
export function noteSweep(/** @type {any} */ entity, /** @type {V2} */ a, /** @type {V2} */ b, /** @type {{point: V2, solid: any} | null} */ hit) {
  /** @type {Sweep} */ const s = {step: collisionProbe.step, entity, a: {x: a.x, z: a.z}, b: {x: b.x, z: b.z}, hit: hit ? {x: hit.point.x, z: hit.point.z} : null, by: hit ? {kind: hit.solid?.kind ?? 'solid', id: hit.solid?.id ?? null} : null};
  collisionProbe.sweeps.push(s);if (collisionProbe.sweeps.length > MAX_SWEEPS) collisionProbe.sweeps.shift();
  if (hit) {collisionProbe.hits.push(s);if (collisionProbe.hits.length > MAX_HITS) collisionProbe.hits.shift();}
}
