// Lutadores, comandos e predicados de estado.
import {C} from './config.js';
import {vec} from './math.js';

export function createFighter(id, attributes, position) {
  return {id, attributes: {...attributes}, position, velocity: vec(), facing: id ? Math.PI : 0, desiredMove: vec(), locomotionVelocity: vec(),
    combatHeading: id ? Math.PI : 0, visualFacing: id ? Math.PI : 0, angularSpeed: 0, hp: attributes.hp, stamina: C.rules.staminaMax, exhausted: false,
    regenAge: 0, regenBase: C.rules.staminaMax, state: 'neutral', action: null, guard: false, guardSuppressed: false, perfectLeft: 0, perfectCooldown: 0,
    perfectSucceeded: false, stun: 0, push: null, blend: null, contacts: 0, flight: null, knockRecovery: 0, vaultHeight: 0, counterWindow: 0, landingSlide: null,
    bufferedTackle: null};
}
export const emptyCommand = () => ({move: vec(), dodge: false, tackle: false, guard: false, guardPressed: false, target: null});
/** Parâmetros próprios de uma ação X/C (C.actions.dodge ou C.actions.tackle). */
export const actionParams = kind => C.actions[kind];
/** Duração de uma ação: esquiva e tackle têm durações independentes; recuo usa as regras gerais. */
export const actionDuration = kind => kind === 'recoil' ? C.rules.recoil : C.actions[kind].duration;
/** Distância nominal: multiplicador próprio × duração própria × velocidade do lutador (GDD 7.2: 2,5 × 400 ms). */
export const nominalDistance = (f, kind = 'dodge') => C.actions[kind].distance * C.actions[kind].duration * f.attributes.speed;
/** Invulnerável agora? Janela própria da ação (ou a herdada no cancelamento C → X). */
export const invulnerableWindow = action => action.invulnerableFor ?? C.actions[action.kind].invulnerable;
export const isInvulnerable = f => !!C.extras.toggles.enableInvulnerability && (f.action?.kind === 'dodge' || f.action?.kind === 'tackle') && f.action.elapsed < invulnerableWindow(f.action) - 1e-8;
export const isOffensive = f => f.action?.kind === 'tackle';
/** Janela genérica de encadeamento: a ação atual já pode ser substituída por outra (ou pela defesa)? */
export const chainOpen = f => !f.action || f.action.kind === 'recoil' || f.action.elapsed >= C.actions[f.action.kind].chainAfter - 1e-8;
/** Pode iniciar X/C/defesa agora (telemetria de vantagem): no chão, sem recuperação e com a janela de encadeamento aberta. */
export const canAct = f => f.hp > 0 && !f.flight && f.knockRecovery <= 0 && chainOpen(f);
/** Livre para se mover: sem ação, sem guard stun, no chão e sem recuperação de queda. */
export const canMove = f => f.hp > 0 && !f.flight && f.knockRecovery <= 0 && !f.action && f.stun <= 1e-8;
