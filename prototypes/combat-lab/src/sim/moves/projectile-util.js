// @ts-check
// Utilidades dos Moves elementais de projétil (Water Pulse, Air Slash, Seed Bomb): origem na ALTITUDE REAL do emissor, spawn que recusa sólidos (sem teletransporte)
// e mira 3D (componente horizontal + vertical a partir de uma velocidade escalar). Existem porque o padrão do Swift/Psyshock nasce em y ABSOLUTO: disparado de uma
// plataforma ele morria na própria plataforma (sonda de 23/10/2026). Aqui o y já soma o chão/plataforma/voo do atirador.
import {C} from '../config.js';
import {closestOnShape} from '../world.js';
import {direction, normalize} from '../math.js';

export const bodyHeight = () => C.extras?.visual?.bodyHeight ?? 1.2;
/** Altitude dos pés do emissor: solo, plataforma, voo normal ou arco do vault. */
export const emitterAltitude = (/** @type {any} */ f) => (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0);
/** Posição horizontal de nascimento: `forward` m à frente do corpo na direção `dir` (vetor XZ unitário). */
export const spawnPoint = (/** @type {any} */ f, /** @type {{x: number, z: number}} */ dir, /** @type {number} */ forward) => ({x: f.position.x + dir.x * forward, z: f.position.z + dir.z * forward});

const vOverlap = (/** @type {number} */ a0, /** @type {number} */ a1, /** @type {number} */ b0, /** @type {number} */ b1) => a0 <= b1 && b0 <= a1;

/**
 * O ponto de nascimento (círculo de raio r na altura y) está dentro de um sólido? Paredes e barreiras, obstáculos, destrutíveis e plataformas do mapa (faixa vertical
 * considerada). Política de spawn inválido (WP-P05): o Move FALHA com reembolso; nada é teletransportado.
 */
export function spawnBlocked(/** @type {any} */ game, /** @type {{x: number, z: number}} */ pos, /** @type {number} */ y, /** @type {number} */ r) {
  const y0 = y - r, y1 = y + r;
  for (const e of game.world.entities) {
    if (e.dead || e.shape !== 'box' || (e.kind !== 'wall' && e.kind !== 'barrier')) continue;
    if (e.reflect) continue;   // a barreira refletora não impede o nascimento: o projétil a atravessa pelo verso ou é refletido
    if (vOverlap(y0, y1, e.y, e.y + e.height) && closestOnShape(e, pos).distance < r) return true;
  }
  const ms = game.mapState;
  if (!ms) return false;
  for (const d of ms.destructibles ?? []) {
    if (d.state !== 'solid' || !vOverlap(y0, y1, d.pos.y, d.pos.y + d.size.height)) continue;
    if (closestOnShape(/** @type {any} */ ({shape: 'box', pos: {x: d.pos.x, z: d.pos.z}, hx: d.size.hx, hz: d.size.hz, angle: 0}), pos).distance < r) return true;
  }
  for (const o of ms.obstacles ?? []) {
    if (!vOverlap(y0, y1, o.pos.y ?? 0, (o.pos.y ?? 0) + o.height)) continue;
    const shape = o.shape === 'cylinder' || o.shape === 'pillar' ? {shape: 'circle', pos: {x: o.pos.x, z: o.pos.z}, radius: o.radius} : {shape: 'box', pos: {x: o.pos.x, z: o.pos.z}, hx: o.hx, hz: o.hz, angle: 0};
    if (closestOnShape(/** @type {any} */ (shape), pos).distance < r) return true;
  }
  for (const p of ms.platforms ?? []) {
    if (!vOverlap(y0, y1, 0, p.height)) continue;
    const box = {shape: 'box', pos: {x: p.pos?.x ?? p.x, z: p.pos?.z ?? p.z}, hx: (p.width ?? 3) / 2, hz: (p.depth ?? 3) / 2, angle: 0};
    if (closestOnShape(/** @type {any} */ (box), pos).distance < r) return true;
  }
  return false;
}

/**
 * Velocidade 3D de uma linha reta: de (from, y0) até (to, y1) com velocidade escalar `speed`. Devolve a direção horizontal unitária, a velocidade horizontal e a vertical
 * (mesma decomposição do Swift/Psyshock). Sem deslocamento horizontal, usa `fallbackDir`.
 */
export function straightLaunch(/** @type {{x: number, z: number}} */ from, /** @type {number} */ y0, /** @type {{x: number, z: number}} */ to, /** @type {number} */ y1, /** @type {number} */ speed, /** @type {{x: number, z: number}} */ fallbackDir) {
  const dx = to.x - from.x, dz = to.z - from.z, dy = y1 - y0, flat = Math.hypot(dx, dz), len3 = Math.hypot(dx, dy, dz) || 1e-9;
  const dir = flat > 1e-6 ? normalize({x: dx, z: dz}) : fallbackDir;
  return {dir, hSpeed: speed * flat / len3, vy: speed * dy / len3};
}

/** Direção horizontal a partir do rumo (rad). */
export const headingDir = (/** @type {number} */ heading) => direction(heading);
