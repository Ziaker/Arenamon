// @ts-check
// F3.2 — Autoridade única das REAÇÕES do lutador: impulso (voo balístico), deslocamento coreografado (empurrão), knockback legado,
// hitstun, stagger, guard stun, guard break, guarda perfeita e recoil. Mesmo efeito do código anterior (combat.js/world-hit.js), só centralizado;
// as pequenas diferenças entre os chamadores antigos viraram opções explícitas da intenção (nenhum estado resultante muda).
// A força contínua (Sand Wave `sandPush`) não passa por aqui: o evento do Sand Wave declara `displacementPolicy: 'force'`.
import {C} from '../config.js';
import {vec, scale, normalize} from '../math.js';

/** Tipos de intenção aceitos por applyReaction. */
export const REACTION_KINDS = Object.freeze(['impulse', 'displacement', 'knockback', 'hitstun', 'stagger', 'guardStun', 'guardBreak', 'perfectGuard', 'recoil', 'counterStagger', 'barrierRecoil', 'wallStagger']);

/**
 * @typedef {{x: number, z: number}} V2
 * @typedef {{kind: 'impulse', direction: V2, horizontal: number, vertical: number, bounce?: boolean}
 *   | {kind: 'displacement', direction: V2, distance: number, duration: number, recoveryKind?: string, normalizeDirection?: boolean, resetMotion?: boolean, keepLongerRecovery?: boolean}
 *   | {kind: 'knockback', direction: V2, horizontal: number, vertical: number}
 *   | {kind: 'hitstun', duration: number, countHit?: boolean}
 *   | {kind: 'stagger', duration: number}
 *   | {kind: 'guardStun', duration: number, setState?: boolean, trackMax?: boolean}
 *   | {kind: 'guardBreak', duration: number}
 *   | {kind: 'perfectGuard', counterWindow: number, setState?: boolean}
 *   | {kind: 'recoil', heading: number}
 *   | {kind: 'counterStagger', duration: number}
 *   | {kind: 'barrierRecoil', direction: V2, distance: number, stagger: number, pushDuration: number}
 *   | {kind: 'wallStagger', duration: number}} ReactionIntent
 * @typedef {{policy: 'impulse'|'displacement'|'none', direction?: V2, horizontal?: number, vertical?: number, distance?: number, duration?: number, bounce?: boolean}} ReactionResult
 */

const countHit = (/** @type {any} */ f) => {f.hitSerial = (f.hitSerial ?? 0) + 1;};

/** Voo balístico (m/s). A altitude inicial preserva o voo em curso (juggle) ou a elevação atual (vault de C): mudar de estado nunca
 * descarta a posição vertical sem causa física (contrato de continuidade espacial da infraestrutura 3D). */
function impulse(/** @type {any} */ f, /** @type {V2} */ away, /** @type {number} */ horizontal, /** @type {number} */ vertical) {
  const n = normalize(away);
  const startY = f.flight ? (f.flight.y ?? 0) : (f.groundY ?? 0) + (f.vaultHeight ?? 0);
  f.flight = {y: startY, vy: vertical, horizontal: scale(n, horizontal)};
  f.launchedByHit = true;   // Inner Focus: só lançamento por golpe (edge-fall/jump não passa por aqui) reduz o hit stun
  f.action = null;f.push = null;f.blend = null;f.velocity = vec();f.locomotionVelocity = vec();
  f.guard = false;f.guardSuppressed = true;f.knockRecovery = 0;f.vaultHeight = 0;f.counterWindow = 0;f.landingSlide = null;f.state = 'airborne';
  f.tech = null;f.techDodge = null;f.wallSplat = null;
  return n;
}

/** Empurrão coreografado no chão (m, s). Padrão = antigo pushAway (direção normalizada, zera vault/janela/tech, recuperação = duração).
 * O knockback legado usa `normalizeDirection: false, resetMotion: false, keepLongerRecovery: true` (mesmo estado que produzia antes). */
function displacement(/** @type {any} */ f, /** @type {any} */ i) {
  const dir = i.normalizeDirection === false ? i.direction : normalize(i.direction), dur = i.duration;
  f.push = {direction: dir, distance: i.distance, elapsed: 0, duration: dur};
  f.action = null;f.flight = null;f.velocity = vec();f.locomotionVelocity = vec();f.blend = null;f.guard = false;f.guardSuppressed = true;
  if (i.resetMotion !== false) {f.vaultHeight = 0;f.counterWindow = 0;f.landingSlide = null;f.recoveryFrom = null;f.tech = null;f.techDodge = null;}
  f.knockRecovery = i.keepLongerRecovery ? Math.max(f.knockRecovery, dur) : dur;f.pushRecovery = dur;f.recoveryKind = i.recoveryKind ?? 'pushed';f.state = 'pushed';
  countHit(f);
  return dir;
}

/**
 * Aplica a reação pedida no lutador e devolve o que aconteceu (`policy` vai para o evento como `displacementPolicy`), ou null quando
 * a intenção não produz reação (knockback zero, guard stun sobre stun já ativo, tipo desconhecido).
 * @param {any} target @param {ReactionIntent} intent @returns {ReactionResult|null}
 */
export function applyReaction(target, intent) {
  const f = target, i = /** @type {any} */ (intent);
  switch (i.kind) {
    case 'impulse': {
      const n = impulse(f, i.direction, i.horizontal, i.vertical);
      return {policy: 'impulse', direction: n, horizontal: i.horizontal, vertical: i.vertical, ...(i.bounce ? {bounce: true} : {})};
    }
    case 'displacement': {
      const dir = displacement(f, i);
      return {policy: 'displacement', direction: dir, distance: i.distance, duration: i.duration};
    }
    case 'knockback': {   // regra legada única: vertical > 0 (ou já no ar) lança; só horizontal vira empurrão deslizante; zero = nada
      const h = i.horizontal, v = i.vertical;
      if (v > 1e-6 || f.flight) {impulse(f, i.direction, h, v);return {policy: 'impulse', direction: normalize(i.direction), horizontal: h, vertical: v};}
      if (h > 0) {
        const distance = Math.max(0.45, h * 1.5), duration = C.test?.pushDuration ?? 0.3;
        displacement(f, {direction: i.direction, distance, duration, normalizeDirection: false, resetMotion: false, keepLongerRecovery: true});
        return {policy: 'displacement', direction: normalize(i.direction), horizontal: h, vertical: 0, distance, duration};
      }
      return null;
    }
    case 'hitstun': {   // countHit: false = hitstun do tackle sem lançamento (o hitSerial é contado pelo dano no resolveHit)
      const d = i.duration;
      f.action = null;f.hitstun = Math.max(f.hitstun ?? 0, d);f.hitstunMax = Math.max(f.hitstunMax ?? 0, d);
      f.knockRecovery = Math.max(f.knockRecovery, d);f.recoveryKind = 'hitstun';f.state = 'hitstun';
      if (i.countHit !== false) countHit(f);
      return {policy: 'none', duration: d};
    }
    case 'stagger': {   // stagger real por stun (footstool): interrompe ação, empurrão e movimento, derruba a guarda; sem launch/push
      const d = i.duration;
      f.stun = Math.max(f.stun ?? 0, d);f.stunMax = d;f.state = 'stagger';
      f.action = null;f.push = null;f.blend = null;f.velocity = vec();f.locomotionVelocity = vec();
      f.vaultHeight = 0;f.counterWindow = 0;f.landingSlide = null;f.guard = false;f.guardSuppressed = true;
      return {policy: 'none', duration: d};
    }
    case 'guardStun': {   // só sem stun ativo. setState: entra em 'guardStun' (acerto de mundo); trackMax: grava stunMax (tackle)
      if (!(f.stun <= 1e-8)) return null;   // semântica antiga exata: stun indefinido/NaN não recebe guard stun
      f.stun = i.duration;
      if (i.trackMax !== false) f.stunMax = i.duration;
      if (i.setState) f.state = 'guardStun';
      return {policy: 'none', duration: i.duration};
    }
    case 'guardBreak': {   // derruba a guarda comum e aplica o guard stun próprio (sem empurrão)
      f.guard = false;f.guardSuppressed = true;f.state = 'stagger';
      f.stun = Math.max(f.stun, i.duration);f.stunMax = f.stun;
      return {policy: 'none', duration: f.stun};
    }
    case 'perfectGuard': {   // zera o stun e abre a janela de contra-ataque (se o bônus estiver ligado). setState: volta para 'guard' (acerto de mundo)
      f.perfectSucceeded = true;f.stun = 0;
      if (i.setState) f.state = 'guard';
      if (C.extras.toggles.enableCounterBonus) f.counterWindow = Math.max(f.counterWindow, i.counterWindow);
      return {policy: 'none'};
    }
    case 'recoil': {   // o atacante bloqueado recua na direção `heading` (rad)
      f.action = {kind: 'recoil', elapsed: 0, heading: i.heading, startAngle: 0, offensive: false, hits: new Set(), from: null};
      f.velocity = vec();f.state = 'recoil';f.blend = null;f.vaultHeight = 0;
      return {policy: 'none'};
    }
    case 'counterStagger': {   // Counter Stagger (PL): não acumula nem reinicia o ativo; interrompe a ação pela recuperação > 0
      const d = i.duration;
      if ((f.counterStagger ?? 0) > 1e-9 || !(d > 0)) return null;
      f.counterStagger = d;f.stagger = Math.max(f.stagger ?? 0, d);f.staggerMax = Math.max(f.staggerMax ?? 0, d);f.knockRecovery = Math.max(f.knockRecovery, d);f.recoveryKind = 'stagger';f.state = 'stagger';
      f.action = null;f.velocity = vec();f.locomotionVelocity = vec();countHit(f);
      return {policy: 'none', duration: d};
    }
    case 'barrierRecoil': {   // Tackle que quebra barreira: stagger + recuo curto (push) na direção `direction`
      const d = i.stagger;
      f.action = null;f.velocity = vec();f.locomotionVelocity = vec();f.blend = null;f.vaultHeight = 0;f.state = 'stagger';f.recoveryKind = 'stagger';
      f.stagger = Math.max(f.stagger ?? 0, d);f.staggerMax = Math.max(f.staggerMax ?? 0, d);countHit(f);
      f.push = {direction: i.direction, distance: i.distance, elapsed: 0, duration: i.pushDuration};f.pushRecovery = i.pushDuration;
      f.knockRecovery = Math.max(f.knockRecovery, d);
      return {policy: 'displacement', direction: i.direction, distance: i.distance, duration: i.pushDuration};
    }
    case 'wallStagger': {   // Sand Wave: pressionado contra a parede para e fica em stagger
      const d = i.duration;
      f.locomotionVelocity = vec();f.velocity = vec();f.knockRecovery = Math.max(f.knockRecovery, d);
      f.stagger = Math.max(f.stagger ?? 0, d);f.staggerMax = Math.max(f.staggerMax ?? 0, d);f.recoveryKind = 'stagger';f.state = 'stagger';countHit(f);
      f.pinned = true;   // prensado contra a parede: a animação «hit_crush» (stagger_crush) lê este marcador; é apagado quando a recuperação acaba (ctrl-update)
      return {policy: 'none', duration: d};
    }
    default: return null;
  }
}
