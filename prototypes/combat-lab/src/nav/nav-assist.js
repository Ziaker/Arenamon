// @ts-check
// Fase 3 (Yuka): ponte entre a IA existente e o planejador. Só ajusta a INTENÇÃO de movimento (e pede salto)
// quando o alvo não é alcançável em linha reta; defesa, esquiva, ataque e balanceamento da IA ficam intactos.
// Desligado (extras.nav.enableNav = 0, padrão) esta função devolve o comando sem tocar em nada.
import {C} from '../sim/config.js';
import {NAV_STATE0, navStep} from './nav-planner.js';
import {getMove} from '../sim/moves.js';

/**
 * @param {{mapState:any}} game partida (lê o mapState)
 * @param {any} brain Brain do lutador (guarda o estado do planejador em brain.nav)
 * @param {any} self lutador controlado pela IA
 * @param {any} target alvo
 * @param {any} cmd comando decidido pela IA atual
 */
export function navAssist(game, brain, self, target, cmd) {
  const N = C.extras.nav;
  if (!N?.enableNav || self.hp <= 0 || target.hp <= 0) return cmd;
  brain.nav ??= NAV_STATE0();
  const r = navStep({self, target, mapState: game.mapState, state: brain.nav, dt: C.test.step});
  if (r.status === 'direct') return cmd;
  // «Agindo» inclui Moves: o slot 0 é falsy (`cmd.skill` = índice), e botão segurado, marcador aberto, carga e ação de Move em curso também mandam no movimento.
  const skillDef = cmd.skill != null ? getMove(self.loadout?.[cmd.skill]) : null;
  const acting = cmd.tackle || cmd.dodge || cmd.guard || cmd.skill != null || !!cmd.skillHeld?.some(Boolean) || !!self.aim || !!self.charge || self.action?.kind === 'move';
  if (!acting && r.move) {
    // Recuos e afastamentos da IA atual são preservados; só a aproximação/circulação é substituída pela rota.
    const toT = {x: target.position.x - self.position.x, z: target.position.z - self.position.z}, tl = Math.hypot(toT.x, toT.z) || 1;
    const retreating = (cmd.move.x * toT.x + cmd.move.z * toT.z) / tl < -.3 && Math.hypot(cmd.move.x, cmd.move.z) > .1;
    if (!retreating || r.jumpHeld || self.flight) cmd.move = {x: r.move.x, z: r.move.z};
  }
  if (r.jump && cmd.skill == null && !self.aim && !self.charge) cmd.jump = true;   // o salto da rota não rouba o instante de um Move
  if (r.jumpHeld) cmd.jumpHeld = true;
  if (N.suppressBlockedAttacks && r.blockAttack && cmd.tackle) {cmd.tackle = false;cmd.tackleHeld = false;}
  // Moves ofensivos também não são disparados no vazio contra alvo inalcançável (Lunge, Quick/Bullet Punch, Swift, Spikes, Sand Wave...)
  if (N.suppressBlockedAttacks && r.blockAttack && skillDef && (skillDef.tackle || skillDef.needsTarget || ['swift', 'sand-wave', 'spikes'].includes(skillDef.id))) {cmd.skill = null;cmd.skillHeld = null;}
  return cmd;
}
