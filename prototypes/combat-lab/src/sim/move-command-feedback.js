// @ts-check
// Projeção efêmera dos resultados que o controlador já decide. Não duplica
// permissões e não toca em stamina, cooldown, ações, carga ou buffers.

const TTL = Object.freeze({accepted: .45, buffered: .7, denied: .7});

/** @param {any} event */
export function moveCommandFeedback(event) {
  const kind = event?.result === 'executed' ? 'accepted' : event?.result === 'buffered' ? 'buffered' : event?.result === 'denied' ? 'denied' : null;
  if (!kind) return null;
  return {kind, move: event.move ?? null, slot: event.slot ?? null, reason: event.reason ?? null, ttl: TTL[kind]};
}

/** @param {{kind?: string, reason?: string|null}|null} feedback @param {string|null} [reasonText] */
export function moveCommandFeedbackText(feedback, reasonText = feedback?.reason ?? null) {
  if (feedback?.kind === 'accepted') return 'comando aceito';
  if (feedback?.kind === 'buffered') return 'no buffer';
  if (feedback?.kind === 'denied') return `negado${reasonText ? `: ${reasonText}` : ''}`;
  return '';
}

/** @param {any} fighter @param {any} event */
export function setMoveCommandFeedback(fighter, event) {
  const feedback = moveCommandFeedback(event);
  if (feedback) fighter.moveCommandFeedback = feedback;
  return feedback;
}

/** @param {any} fighter @param {number} dt */
export function tickMoveCommandFeedback(fighter, dt) {
  const feedback = fighter.moveCommandFeedback;
  if (!feedback) return null;
  feedback.ttl = Math.max(0, feedback.ttl - Math.max(0, dt));
  if (feedback.ttl <= 1e-8) fighter.moveCommandFeedback = null;
  return fighter.moveCommandFeedback;
}

