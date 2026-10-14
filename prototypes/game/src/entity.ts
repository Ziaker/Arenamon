import { ACTIONS, ActionKind, Attributes, RULES } from './config';
import { Vec, vec } from './math';
export type State = 'neutral' | 'moving' | 'guard' | 'dodge' | 'tackle' | 'guardStun' | 'recoil' | 'pushed' | 'defeated';
// dodge = C (esquiva), tackle = X (investida). dodgeDirection é a direção pedida para C ou X (8 direções).
export interface Command { move: Vec; dodge: boolean; tackle: boolean; guard: boolean; guardPressed: boolean; target: number | null; dodgeDirection?: Vec; dodgeForward?: boolean }
export const idle = (): Command => ({ move: vec(), dodge: false, tackle: false, guard: false, guardPressed: false, target: null });
export interface Action {
  kind: ActionKind | 'recoil'; elapsed: number; startAngle: number; heading: number; offensive: boolean; hits: Set<number>; from: Vec | null;
  vault?: boolean; blendTime?: number; invulnerableFor?: number; liftStart?: number; liftTime?: number;
  fromCancel?: boolean; buffered?: boolean; speedMultiplier?: number;
}
export interface Directions { move: Vec; dodgeDirection?: Vec }
export interface Fighter {
  id: number; attributes: Attributes; position: Vec; velocity: Vec; facing: number; angularSpeed: number;
  desiredMove: Vec; locomotionVelocity: Vec; combatHeading: number; visualFacing: number;
  hp: number; stamina: number; exhausted: boolean; regenAge: number; regenBase: number;
  state: State; action: Action | null; guard: boolean; guardSuppressed: boolean;
  perfectLeft: number; perfectCooldown: number; perfectSucceeded: boolean; stun: number;
  push: { direction: Vec; distance: number; elapsed: number } | null;
  blend: { from: Vec; elapsed: number } | null; contacts: number;
  // Etapa A: altura do salto de C, janela de contra-ataque, buffer de entrada e X guardado no guard stun.
  vaultHeight: number; counterWindow: number;
  inputBuffer: (Directions & { kind: ActionKind; age: number }) | null; bufferedTackle: Directions | null;
}
export function fighter(id: number, attributes: Attributes, position: Vec): Fighter {
  return { id, attributes: { ...attributes }, position, velocity: vec(), facing: id ? Math.PI : 0,
    desiredMove: vec(), locomotionVelocity: vec(), combatHeading: id ? Math.PI : 0, visualFacing: id ? Math.PI : 0,
    angularSpeed: 0, hp: attributes.hp, stamina: RULES.staminaMax, exhausted: false,
    regenAge: 0, regenBase: RULES.staminaMax, state: 'neutral', action: null, guard: false,
    guardSuppressed: false, perfectLeft: 0, perfectCooldown: 0, perfectSucceeded: false,
    stun: 0, push: null, blend: null, contacts: 0, vaultHeight: 0, counterWindow: 0, inputBuffer: null, bufferedTackle: null };
}
/** Janela de invulnerabilidade da ação (um X vindo de C → X herda só o resto da de C). */
export const invulnerableWindow = (a: Action) => a.invulnerableFor ?? (a.kind === 'recoil' ? 0 : ACTIONS[a.kind].invulnerable);
export const invulnerable = (f: Fighter) => !!f.action && f.action.kind !== 'recoil' && f.action.elapsed < invulnerableWindow(f.action) - 1e-8;
/** Só X é ofensivo: C nunca causa dano. */
export const offensive = (f: Fighter) => f.action?.kind === 'tackle';
/** Distância nominal: distância × duração × velocidade (GDD 7.2: 2,5). Padrão C, usado também pelo recuo. */
export const nominalDistance = (f: Fighter, kind: ActionKind = 'dodge') => ACTIONS[kind].distance * ACTIONS[kind].duration * f.attributes.speed;
/** A ação atual já pode ser substituída por defesa ou outra ação? O recuo pode ser interrompido desde o início. */
export const chainOpen = (f: Fighter) => !f.action || f.action.kind === 'recoil' || f.action.elapsed >= ACTIONS[f.action.kind].chainAfter - 1e-8;
