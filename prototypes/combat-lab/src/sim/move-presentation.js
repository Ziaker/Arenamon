// @ts-check
// Identidade visual estável dos Moves. O contrato é aditivo: quando não há chave
// específica, a ordem de fallbacks permanece a mesma do caminho legado por slot.

const clampSlot = (/** @type {number} */ slot) => Math.max(0, Math.min(3, Number.isFinite(slot) ? Math.trunc(slot) : 0));
const unique = (/** @type {(string | null | undefined)[]} */ values) => [...new Set(values.filter(v => typeof v === 'string' && v.length > 0))];

/**
 * @param {{id?: string, presentation?: {action?: string, charge?: string, release?: string}}} def
 * @param {number} slot
 * @param {'action'|'charge'|'release'|string} phase
 * @returns {string[]}
 */
export function presentationActionCandidates(def, slot = 0, phase = 'action') {
  const moveSlot = `move_${clampSlot(slot) + 1}`, p = def?.presentation ?? {}, id = def?.id ?? '';
  if (phase === 'charge') return unique([p.charge, id ? `charge_${id}` : null, 'idle']);
  if (phase === 'release') return unique([p.release, id ? `release_${id}` : null, moveSlot, 'tackle', 'idle']);
  return unique([p.action, moveSlot, 'tackle', 'idle']);
}

/**
 * @param {any} def @param {number} slot @param {string} phase
 * @param {(key: string) => boolean} available
 */
export function firstAvailablePresentationAction(def, slot, phase, available) {
  return presentationActionCandidates(def, slot, phase).find(available) ?? null;
}

