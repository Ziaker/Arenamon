// @ts-check
// Game feel 6 — Moves com fases aprovadas da animação. No início do uso, se o personagem carrega um contrato resolvido e válido para o Move
// (`f.combatWindows.moves[id].phaseContract.applied`), os tempos aprovados são CAPTURADOS na ação (como os sliders, M28.4): mexer no perfil
// depois não altera uma ação em curso nem um replay. Sem contrato aplicado, nada muda (a definição do Move segue autoritativa).
/**
 * @param {any} f lutador @param {any} action ação recém-criada (kind 'move' ou o 'tackle' de um Move-tackle) @param {any} def definição efetiva do Move
 * @param {any} P parâmetros capturados do grupo (podem receber hitStart/hitEnd aprovados)
 */
export function applyMovePhase(f, action, def, P) {
  const w = f?.combatWindows?.moves?.[def?.id], pc = w?.phaseContract;
  if (!pc?.applied || !(pc.applied.active || pc.applied.cancel || pc.applied.invuln)) return false;
  const st = pc.stepSeconds, /** @type {any} */ ph = action.phase = {from: 'animação aprovada', applied: {...pc.applied}};
  if (pc.applied.invuln && w.invulnerabilityWindows?.[0]) ph.invulnerable = [w.invulnerabilityWindows[0][0] * st, w.invulnerabilityWindows[0][1] * st];
  if (pc.applied.cancel && pc.cancelAfterSeconds != null) ph.chainAfter = pc.cancelAfterSeconds;
  if (pc.applied.active && w.activeWindows?.[0] && P && Number.isFinite(P.hitStart) && Number.isFinite(P.hitEnd)) {
    P.hitStart = w.activeWindows[0][0] * st;P.hitEnd = Math.max(P.hitStart + st, w.activeWindows[0][1] * st);
  }
  if (action.kind === 'tackle') {   // Move que vira Tackle: o relógio de cancelamento e a invulnerabilidade inicial são os da ação de tackle
    if (ph.chainAfter != null) action.chainAfter = ph.chainAfter;
    if (ph.invulnerable && ph.invulnerable[0] === 0) action.invulnerableFor = ph.invulnerable[1];
  }
  return true;
}
