import { Attributes, RULES } from './config';
import { Vec, vec } from './math';
export type State = 'neutral' | 'moving' | 'guard' | 'dodge' | 'tackle' | 'guardStun' | 'recoil' | 'pushed' | 'defeated';
export interface Command { move: Vec; dodge: boolean; guard: boolean; guardPressed: boolean; target: number | null; dodgeDirection?: Vec; dodgeForward?: boolean }
export const idle = (): Command => ({ move: vec(), dodge: false, guard: false, guardPressed: false, target: null });
export interface Action { kind: 'dodge' | 'recoil'; elapsed: number; startAngle: number; heading: number; offensive: boolean; hits: Set<number>; from: Vec | null }
export interface Fighter {
  id: number; attributes: Attributes; position: Vec; velocity: Vec; facing: number; angularSpeed: number;
  desiredMove: Vec; locomotionVelocity: Vec; combatHeading: number; visualFacing: number;
  hp: number; stamina: number; exhausted: boolean; regenAge: number; regenBase: number;
  state: State; action: Action | null; guard: boolean; guardSuppressed: boolean;
  perfectLeft: number; perfectCooldown: number; perfectSucceeded: boolean; stun: number;
  push: { direction: Vec; distance: number; elapsed: number } | null;
  blend: { from: Vec; elapsed: number } | null; contacts: number;
}
export function fighter(id: number, attributes: Attributes, position: Vec): Fighter {
  return { id, attributes: { ...attributes }, position, velocity: vec(), facing: id ? Math.PI : 0,
    desiredMove: vec(), locomotionVelocity: vec(), combatHeading: id ? Math.PI : 0, visualFacing: id ? Math.PI : 0,
    angularSpeed: 0, hp: attributes.hp, stamina: RULES.staminaMax, exhausted: false,
    regenAge: 0, regenBase: RULES.staminaMax, state: 'neutral', action: null, guard: false,
    guardSuppressed: false, perfectLeft: 0, perfectCooldown: 0, perfectSucceeded: false,
    stun: 0, push: null, blend: null, contacts: 0 };
}
export const invulnerable = (f: Fighter) => f.action?.kind === 'dodge' && f.action.elapsed < RULES.invulnerable - 1e-8;
export const offensive = (f: Fighter) => f.action?.kind === 'dodge';
export const nominalDistance = (f: Fighter) => 2.5 * RULES.dodge * f.attributes.speed;
