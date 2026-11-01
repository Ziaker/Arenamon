// @ts-check
// Fidelidade ao que foi animado (auditoria de 31/10/2026, docs/AUDITORIA_ANIMACOES_JOGO.md). SÓ VISUAL.
// 1) Ações cronometradas pela simulação (esquiva, tackle, salto sobre o rival, recuo, atordoamento…) tocam o clipe na velocidade
//    em que foi animado, em vez de esticar/espremer o clipe INTEIRO na duração da ação. O que sobrar do clipe segue em epílogo.
// 2) O quadril só é preso à posição da física quando é ele que carrega o deslocamento; com um osso raiz acima dele (ex.: Eggo),
//    só a raiz é presa e o balanço do quadril dentro da pose fica.
import {C} from '../sim/config.js';
import {progressOf} from './visual-epilogue.js';

/**
 * Tempo do clipe numa ação cronometrada com a opção ligada (null = regra antiga: progresso da ação × duração do clipe).
 * @param {any} ch personagem @param {number} speed velocidade do clipe (global × editor) @param {any} [f] lutador
 */
export function nativeTimedTime(ch, speed, f) {
  if (!C.display.animation.timedNative || !ch.current) return null;
  const key = ch.current.key;if (key === 'vault' || (key === 'jump' && f?.flight)) return null;   // pulo e salto sobre o rival seguem o arco do voo (física)
  return Math.max(0, ch.clock - ch.current.started) * speed;
}

/**
 * O quadril carrega o deslocamento do personagem? Sim quando não há osso acima dele, ou quando os clipes o movem na horizontal
 * mais que 25% da altura de repouso (exportadores que gravam o deslocamento no quadril mesmo com uma raiz acima).
 * @param {any} hips osso do quadril @param {any[]} clips clipes do personagem
 */
export function hipsCarriesTravel(hips, clips) {
  if (!hips?.parent?.isBone) return true;
  const ref = Math.max(1e-6, Math.abs(hips.position.y) || hips.position.length());
  for (const clip of clips) for (const track of clip.tracks) {
    if (track.name !== hips.name + '.position') continue;
    const v = track.values;let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < v.length; i += 3) {x0 = Math.min(x0, v[i]);x1 = Math.max(x1, v[i]);z0 = Math.min(z0, v[i + 2]);z1 = Math.max(z1, v[i + 2]);}
    if (Math.max(x1 - x0, z1 - z0) > .25 * ref) return true;
  }
  return false;
}

const PHASES = ['jump_start', 'jump_rise', 'jump_apex', 'jump_fall'];
/**
 * Salto sobre o rival com fases do pulo próprias (ex.: Eggo): a fase sai do progresso do arco do salto (0–1), igual ao pulo normal
 * — início, subida, pico e queda — em vez de tocar o clipe «jump» inteiro (preparação + pouso) dentro de um voo curto. null = como antes.
 * @param {any} ch @param {any} f
 */
export function vaultPhaseKey(ch, f) {
  if (!C.display.animation.vaultPhases || !f.action?.jump || !ch.hasJumpPhases()) return null;
  const p = Math.max(0, Math.min(1, progressOf(ch, f, 'vault')));
  const k = p < .12 ? 'jump_start' : p < .42 ? 'jump_rise' : p < .58 ? 'jump_apex' : 'jump_fall';
  const own = id => ch.variants[id]?.length ? id : null;
  return own(k) ?? (k === 'jump_apex' ? own('jump_rise') : null);
}
/** Transição curta entre as fases do pulo (os clipes de fase são curtos: com a transição comum de ~0,2 s nenhuma aparecia inteira). */
export function jumpPhaseFade(/** @type {string} */ key) {
  const v = C.display.animation.jumpPhaseFade;
  return PHASES.includes(key) && Number.isFinite(v) ? Math.max(.02, v) : null;
}
