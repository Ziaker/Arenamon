// @ts-check
// Sólidos do chão e visão do personagem cegado. `solidsOf` junta o que uma onda de areia ou uma linha de visão não atravessa (paredes, obstáculos fixos e
// destrutíveis ainda sólidos); `canSee` é a regra de percepção da cegueira do Sand Wave (SW-D15/SW-D45/SW-D64): alcance de 10 m a partir do cegado e linha de visão
// que não esteja TOTALMENTE bloqueada por parede sólida — basta ver UMA parte do corpo do alvo. Usada pelo lock-on do jogador, pelo controlador e pela IA.
import {C} from './config.js';
import {closestOnShape} from './world/world-hit.js';
import {hasFlag} from './status.js';
import {emptyCommand} from './entity.js';

/**
 * @typedef {{shape: 'box'|'circle', pos: {x: number, z: number}, hx?: number, hz?: number, radius?: number, angle?: number}} Solid
 */
/** Sólidos de chão do mundo (caixas e círculos no plano XZ). Plataformas não bloqueiam: são superfícies de apoio, não paredes. */
export function solidsOf(/** @type {any} */ world) {
  /** @type {Solid[]} */ const out = [];
  for (const e of world?.entities ?? []) if (!e.dead && e.kind === 'wall' && e.shape === 'box') out.push({shape: 'box', pos: e.pos, hx: e.hx, hz: e.hz, angle: e.angle ?? 0});
  const ms = world?.mapState;
  for (const o of ms?.obstacles ?? []) {
    const pos = {x: o.pos?.x ?? 0, z: o.pos?.z ?? 0};
    if (o.shape === 'cylinder' || o.shape === 'pillar') out.push({shape: 'circle', pos, radius: o.radius ?? 1});
    else out.push({shape: 'box', pos, hx: o.hx ?? 1.5, hz: o.hz ?? 1.5, angle: 0});
  }
  for (const d of ms?.destructibles ?? []) if (d.state === 'solid') out.push({shape: 'box', pos: {x: d.pos.x, z: d.pos.z}, hx: d.size?.hx ?? .8, hz: d.size?.hz ?? .8, angle: 0});
  return out;
}
/** O ponto está dentro de algum sólido (com folga `margin`)? */
export function insideSolid(/** @type {Solid[]} */ solids, /** @type {{x: number, z: number}} */ p, margin = 0) {
  for (const s of solids) if (closestOnShape(/** @type {any} */ (s), p).distance < margin) return true;
  return false;
}
/** O segmento a→b está livre de sólidos? (amostra a cada ~0,2 m) */
export function segmentClear(/** @type {Solid[]} */ solids, /** @type {{x: number, z: number}} */ a, /** @type {{x: number, z: number}} */ b, step = .2) {
  if (!solids.length) return true;
  const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / step));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (insideSolid(solids, {x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t})) return false;
  }
  return true;
}

/** O lutador está cego (status do Sand Wave)? */
export const isBlind = (/** @type {any} */ f) => !!f && hasFlag(f, 'blind');
/** Raio de visão do cegado (m): C.world.sandWave.visionRadius (padrão do documento: 10). */
export const blindRadius = () => C.world.sandWave?.visionRadius ?? 10;

/**
 * `self` enxerga `other` agora? Sem cegueira, sempre sim. Cego: a até `visionRadius` e com ao menos um de cinco pontos do corpo do alvo (centro e quatro
 * cantos) visível sem atravessar sólido. Deterministico e sem estado.
 */
export function canSee(/** @type {any} */ self, /** @type {any} */ other, /** @type {any} */ world) {
  if (!other || other.hp <= 0) return false;
  if (!isBlind(self)) return true;
  if (Math.hypot(other.position.x - self.position.x, other.position.z - self.position.z) > blindRadius() + 1e-9) return false;
  const solids = solidsOf(world);
  if (!solids.length) return true;
  const h = C.test.halfExtent, o = other.position;
  for (const [dx, dz] of [[0, 0], [h, h], [-h, h], [h, -h], [-h, -h]]) if (segmentClear(solids, self.position, {x: o.x + dx, z: o.z + dz})) return true;
  return false;
}

/** Comando da IA cegada sem alvo perceptível (SW-D66): defesa e reposicionamento — guarda levantada e passos lentos para o centro da arena, sem perseguir quem não vê. */
export function blindDefensiveCommand(/** @type {any} */ f) {
  const d = {x: -f.position.x, z: -f.position.z}, l = Math.hypot(d.x, d.z);
  return {...emptyCommand(), move: l > 3 ? {x: d.x / l * .6, z: d.z / l * .6} : {x: 0, z: 0}, guard: true};
}
