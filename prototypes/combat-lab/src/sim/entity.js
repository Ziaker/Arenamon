// Lutadores, comandos e predicados de estado.
import {C} from './config.js';
import {vec} from './math.js';

export function createFighter(id, attributes, position) {
  return {id, attributes: {...attributes}, position, velocity: vec(), facing: id ? Math.PI : 0, desiredMove: vec(), locomotionVelocity: vec(),
    combatHeading: id ? Math.PI : 0, visualFacing: id ? Math.PI : 0, angularSpeed: 0, hp: attributes.hp, stamina: C.rules.staminaMax, exhausted: false,
    regenAge: 0, regenBase: C.rules.staminaMax, state: 'neutral', action: null, guard: false, guardSuppressed: false, perfectLeft: 0, perfectCooldown: 0,
    perfectSucceeded: false, stun: 0, push: null, blend: null, contacts: 0, flight: null, knockRecovery: 0, vaultHeight: 0, counterWindow: 0, landingSlide: null};
}
export const emptyCommand = () => ({move: vec(), dodge: false, tackle: false, guard: false, guardPressed: false, target: null});
export const isInvulnerable = f => !!C.extras.toggles.enableInvulnerability && (f.action?.kind === 'dodge' || f.action?.kind === 'tackle') && f.action.elapsed < C.rules.invulnerable - 1e-8;
export const isOffensive = f => f.action?.kind === 'tackle';
/** Duração de uma ação X/C: o tackle tem duração própria; a esquiva usa `dodge`. */
export const actionDuration = kind => kind === 'tackle' ? C.rules.tackleDuration ?? C.rules.dodge : C.rules.dodge;
/** Distância nominal de X/C: 2,5 × duração × velocidade (sem tipo: a da esquiva, como no v6). */
export const nominalDistance = (f, kind = 'dodge') => 2.5 * actionDuration(kind) * f.attributes.speed;
/** Pode iniciar X/C/defesa agora: mesma regra de cancelamento do controlador (recuo e guard stun são canceláveis). */
export const canAct = f => f.hp > 0 && !f.flight && f.knockRecovery <= 0 && (!f.action || f.action.kind === 'recoil' || f.action.elapsed >= C.rules.invulnerable - 1e-8);
/** Livre para se mover: sem ação, sem guard stun, no chão e sem recuperação de queda. */
export const canMove = f => f.hp > 0 && !f.flight && f.knockRecovery <= 0 && !f.action && f.stun <= 1e-8;
