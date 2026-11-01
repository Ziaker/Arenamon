// @ts-check
// Velocidade da locomoção por personagem (pedido de 31/10/2026: «a velocidade do personagem acompanha a animação»).
// Três modos, escolhidos no painel do personagem (bloco «Velocidade da locomoção»):
//   jogo     — como sempre: andar = atributo de velocidade; sprint = andar × multiplicador do sprint (Ajustes).
//   animacao — andar e sprint = quantos metros por segundo a walk e o sprint andam no próprio clipe (raiz do GLB).
//   manual   — valores digitados no painel (m/s).
// A simulação recebe só os números (game.setLocomotion → f.locoSpeeds); o modelo nunca é lido pela física.
// Além disso, a sincronia de passada ajusta a velocidade do clipe de andar/correr à do corpo, limitada a ±strideSyncLimit %.
import {C} from '../sim/config.js';

const cache = new WeakMap();
/** Escala do modelo no jogo (ajuste à altura do corpo × escala do personagem): o que o clipe anda no arquivo vezes isto = o que anda no jogo. */
export const visualScale = (/** @type {any} */ ch) => (ch.constructor.options?.fit ? C.extras.visual.bodyHeight / Math.max(1e-6, ch.restHeight || 1) : 1) * (ch.heightScale || 1);
/** Metros por segundo que o clipe anda no arquivo (deslocamento horizontal da raiz do início ao fim ÷ duração). */
export function clipTravelSpeed(/** @type {any} */ ch, /** @type {number} */ index) {
  const clip = ch.clips[index];if (!clip || !ch.hips) return 0;
  let per = cache.get(ch);if (!per) cache.set(ch, per = new Map());
  if (per.has(index)) return per.get(index);
  ch.groundCurve(index);const probe = ch.probe;let node = null;probe.root.traverse((/** @type {any} */ o) => {if (!node && o.name === ch.hips.name) node = o;});
  let v = 0;
  if (node) {
    const a = probe.mixer.clipAction(clip), P = ch.root.position.constructor;probe.mixer.stopAllAction();a.reset();a.play();
    const at = (/** @type {number} */ t) => {a.time = t;probe.mixer.update(0);probe.root.updateMatrixWorld(true);return node.getWorldPosition(new P());};
    const p0 = at(0), p1 = at(clip.duration || 0);a.stop();
    v = clip.duration > 0 ? Math.hypot(p1.x - p0.x, p1.z - p0.z) / clip.duration : 0;   // no tamanho do arquivo; a escala do jogo entra em visualScale()
  }
  per.set(index, v);return v;
}
/** Velocidade do clipe de um estado de locomoção, já com a velocidade de reprodução (global × editor). */
export function stateClipSpeed(/** @type {any} */ ch, /** @type {string} */ id) {
  const i = ch.variantsOf(id)[0];return i == null ? 0 : clipTravelSpeed(ch, i) * visualScale(ch) * ch.speedOf(id);
}
/** Configuração do personagem (padrão: Eggo «animacao», demais «jogo»). */
export function locoSettingOf(/** @type {any} */ ch) {
  return ch.locoSpeed ??= {mode: /eggo/i.test(ch.source?.name || '') ? 'animacao' : 'jogo', walk: 4.8, sprint: 7.44};
}
/** Velocidades que a simulação deve usar para o personagem, ou null (= regra do jogo). */
export function locoSpeedsOf(/** @type {any} */ ch) {
  if (!ch) return null;
  const s = locoSettingOf(ch);
  if (s.mode === 'manual') return {walk: Math.max(.1, +s.walk || .1), sprint: Math.max(.1, +s.sprint || .1)};
  if (s.mode !== 'animacao') return null;
  const walk = stateClipSpeed(ch, 'walk'), sprint = stateClipSpeed(ch, 'sprint');
  if (walk < .05 && sprint < .05) return null;   // clipes no lugar (sem deslocamento da raiz): não há o que medir
  return {walk: walk >= .05 ? walk : null, sprint: sprint >= .05 ? sprint : null};
}
/**
 * Multiplicador da velocidade do clipe de andar/correr para acompanhar o corpo (1 quando não se aplica).
 * @param {any} ch @param {any} f @param {string} key estado visual atual
 */
export function strideRate(ch, f, key) {
  const A = C.display.animation;
  if (!A.strideSync || !(key?.startsWith('walk') || key?.startsWith('sprint')) || !ch.current) return 1;
  const clipV = clipTravelSpeed(ch, ch.current.index) * visualScale(ch) * ch.speedOf(ch.current.id), body = Math.hypot(f.velocity?.x ?? 0, f.velocity?.z ?? 0);
  if (clipV < .05 || body < .05) return 1;
  const lim = Math.max(0, A.strideSyncLimit ?? 20) / 100;
  return Math.max(1 - lim, Math.min(1 + lim, body / clipV));
}
