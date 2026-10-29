// @ts-check
// Estado de cada slot de movimento para a interface (HUD e painel): pronto, carregando (com PL), em recarga, em recuperação ou bloqueado
// (com o motivo do próprio motor). Fonte única: usa as MESMAS funções de permissão do controlador, então a tela nunca promete o que o
// motor negaria. Só lê; não altera nenhum estado.
import {C} from './config.js';
import {getMove} from './moves.js';
import {chargePermission, movePermission} from './controller.js';
import {chargeLevel} from './charge.js';
import {REASONS} from './attempts.js';
import {moveCommandFeedbackText} from './move-command-feedback.js';

/**
 * @typedef {{slot: number, id: string, name: string, state: 'pronto' | 'carregando' | 'recarga' | 'recuperacao' | 'bloqueado',
 *   progress: number, level: number, left: number, total: number, reason: string | null, text: string}} SlotStatus
 */
const ms = (/** @type {number} */ s) => `${s.toFixed(1)} s`;

/** Estado do slot (ou null se vazio). @param {any} f lutador @param {number} slot */
export function slotStatus(f, slot) {
  const id = f.loadout?.[slot], def = id ? getMove(id) : null;
  if (!def) return null;
  const rawFeedback = f.moveCommandFeedback?.slot === slot ? f.moveCommandFeedback : null;
  const feedbackReason = rawFeedback?.reason ? (REASONS[rawFeedback.reason]?.(rawFeedback.detail ?? {}) ?? rawFeedback.reason) : null;
  const feedback = rawFeedback ? {...rawFeedback, text: moveCommandFeedbackText(rawFeedback, feedbackReason)} : null;
  const base = {slot, id: def.id, name: def.name ?? def.id, progress: 0, level: 0, left: 0, total: def.cooldown ?? 0, reason: null, feedback};
  const ch = f.charge;
  if (ch && ch.slot === slot) {
    const p = ch.params, progress = Math.min(1, ch.ticks / p.maxTicks), level = chargeLevel(ch.ticks, p);
    return {...base, state: 'carregando', progress, level, left: 0, text: `carregando ${Math.round(progress * 100)}% · PL${level}${ch.ticks >= p.maxTicks ? ' (máximo)' : ''}`};
  }
  const cd = f.moveCooldowns?.[def.id] ?? 0;
  if (cd > 1e-8) return {...base, state: 'recarga', left: cd, progress: base.total > 0 ? 1 - cd / base.total : 1, text: `recarga ${ms(cd)}`};
  if (f.moveRecovery > 1e-8) return {...base, state: 'recuperacao', left: f.moveRecovery, text: `recuperação ${ms(f.moveRecovery)}`};
  const perm = def.charge ? chargePermission(f, def, slot) : movePermission(f, def, slot);
  if (!perm.ok) {
    const why = perm.reason ? (REASONS[perm.reason]?.(perm.detail ?? {}) ?? perm.reason) : 'indisponível';
    return {...base, state: 'bloqueado', reason: perm.reason ?? null, left: perm.detail?.left ?? 0, text: why};
  }
  return {...base, state: 'pronto', progress: 1, text: 'pronto'};
}
/** Estados de todos os slots ocupados do lutador. */
export const slotStatuses = (/** @type {any} */ f) => Array.from({length: C.world.slots}, (_, i) => slotStatus(f, i)).filter(Boolean);
