// @ts-check
// Visão do personagem cegado. Os sólidos que bloqueiam a linha de visão (paredes, obstáculos fixos e destrutíveis ainda sólidos) vêm de
// `blockingSolids` (collision/queries.js, F4); `canSee` é a regra de percepção da cegueira do Sand Wave (SW-D15/SW-D45/SW-D64): alcance de 10 m a partir do cegado e linha de visão
// que não esteja TOTALMENTE bloqueada por parede sólida — basta ver UMA parte do corpo do alvo. Usada pelo lock-on do jogador, pelo controlador e pela IA.
import {C} from './config.js';
import {blockingSolids, segmentClear} from './collision/queries.js';
import {hasFlag} from './status.js';
import {emptyCommand} from './entity.js';

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
  const solids = blockingSolids(world);
  if (!solids.length) return true;
  const h = C.test.halfExtent, o = other.position;
  for (const [dx, dz] of [[0, 0], [h, h], [-h, h], [h, -h], [-h, -h]]) if (segmentClear(self.position, {x: o.x + dx, z: o.z + dz}, solids)) return true;
  return false;
}

/** Comando da IA cegada sem alvo perceptível (SW-D66): defesa e reposicionamento — guarda levantada e passos lentos para o centro da arena, sem perseguir quem não vê. */
export function blindDefensiveCommand(/** @type {any} */ f) {
  const d = {x: -f.position.x, z: -f.position.z}, l = Math.hypot(d.x, d.z);
  return {...emptyCommand(), move: l > 3 ? {x: d.x / l * .6, z: d.z / l * .6} : {x: 0, z: 0}, guard: true};
}
