// @ts-check
// Sonda de colisão (Fase 7 do overhaul): leitura externa para as ferramentas visuais do laboratório. NÃO entra no estado da simulação, no save nem no replay
// (como physicsProbe): nada na simulação lê estes campos. Registra, por lutador, o último contato com o ambiente (objeto bloqueador, normal, profundidade
// corrigida e velocidade horizontal antes/depois) e as varreduras dos projéteis (trecho percorrido, ponto do primeiro contato e bloqueador).

import {C} from './config.js';
import {solidContact} from './solid-contact.js';

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

/** Penetração (m) do corpo (meio-lado `half`) numa pegada: cilindro (corpo redondo, como circleContact) ou caixa alinhada (corpo quadrado: menor sobreposição). */
const footPenetration = (/** @type {number} */ x, /** @type {number} */ z, /** @type {boolean} */ cyl, /** @type {number} */ sx, /** @type {number} */ sz, /** @type {number} */ hx, /** @type {number} */ hz, /** @type {number} */ r, /** @type {number} */ half) => {
  if (cyl) return Math.max(0, r + half - Math.hypot(x - sx, z - sz));
  const ox = hx + half - Math.abs(x - sx), oz = hz + half - Math.abs(z - sz);
  return ox > 0 && oz > 0 ? Math.min(ox, oz) : 0;
};
/**
 * Penetração (m) do corpo do lutador (quadrado de meio-lado `test.halfExtent`, altura `visual.bodyHeight`) num sólido de `collectSolids` (nav-graph): 0 = sem
 * penetração ou sem sobreposição vertical. Mesma geometria da física do mapa e derivada de C (não de constantes fixas): o diagnóstico acompanha os ajustes.
 */
export function bodyPenetration(/** @type {{x: number, y: number, z: number}} */ p, /** @type {any} */ s) {
  const half = C.test.halfExtent, head = p.y + (C.extras?.visual?.bodyHeight ?? 1.2);
  if (p.y >= s.top - 1e-9 || head <= s.base + 1e-9) return 0;
  return footPenetration(p.x, p.z, s.shape === 'cyl', s.x, s.z, s.hx, s.hz, s.r, half);
}
/**
 * Penetração residual (m) do lutador nos sólidos ESTÁTICOS que o solver resolve (F4, Task 8): paredes/barreiras de Moves (corpo redondo, solidContact, como
 * collideFighter) e plataformas, obstáculos e destrutíveis sólidos do mapa (altura ATUAL e faixa de montagem `map.mountTolerance`, como collideMapFighter).
 * A borda da arena não entra (clampToArena fecha cada rodada). Não conta o «subindo por cima» de salto/lançamento (risesOver): só pode superestimar.
 * `pos` troca a posição horizontal testada (busca do escape); a altura é sempre a do lutador. Só lê: não altera nada.
 * @param {any} f @param {any} world @param {{x: number, z: number}} [pos]
 */
export function staticPenetration(f, world, pos = f.position) {
  const half = C.test.halfExtent, h = C.extras?.visual?.bodyHeight ?? 1.2, mount = C.map?.mountTolerance ?? .25;
  const alt = (f.flight ? (f.flight.y ?? f.groundY ?? 0) : (f.groundY ?? 0)) + (f.vaultHeight ?? 0);
  let m = 0;
  for (const e of world?.entities ?? []) {
    if (e.dead) continue;
    const solid = e.kind === 'wall' ? e.blocksFighters : e.kind === 'barrier' && e.blocksFighters && (e.blocksOwner || e.owner !== f.id);
    if (!solid || alt > e.y + e.height || e.y > alt + h) continue;
    if (e.breakableByTackle && f.action?.kind === 'tackle' && !f.action.neutralized) continue;   // o Tackle quebra, não é empurrado
    const c = solidContact(e, pos, half);if (c && c.depth > m) m = c.depth;
  }
  const ms = world?.mapState;if (!ms) return m;
  // Faixa vertical como collideMapFighter: acima do topo − montagem passa; cabeça abaixo da base (ou encostada nela caindo/parado) não toca.
  const blocks = (/** @type {number} */ base, /** @type {number} */ top) => alt < top - mount && alt + h > base && !(f.flight && f.flight.vy <= 0 && Math.abs(alt + h - base) <= 1e-6);
  for (const p of ms.platforms ?? []) if (alt < p.height - mount) m = Math.max(m, footPenetration(pos.x, pos.z, false, p.pos?.x ?? p.x, p.pos?.z ?? p.z, (p.width ?? 3) / 2, (p.depth ?? 3) / 2, 0, half));
  for (const o of ms.obstacles ?? []) {
    const base = o.pos?.y ?? 0;if (!blocks(base, base + o.height)) continue;
    m = Math.max(m, footPenetration(pos.x, pos.z, o.shape === 'cylinder' || o.shape === 'pillar', o.pos.x, o.pos.z, o.hx, o.hz, o.radius, half));
  }
  for (const d of ms.destructibles ?? []) {
    if (d.state !== 'solid') continue;
    const base = d.pos?.y ?? 0;if (!blocks(base, base + (d.size?.height ?? 1.6))) continue;
    m = Math.max(m, footPenetration(pos.x, pos.z, false, d.pos.x, d.pos.z, d.size.hx, d.size.hz, 0, half));
  }
  return m > 1e-9 ? m : 0;   // encostar na face (resíduo de ponto flutuante do reposicionamento) não é penetração
}
