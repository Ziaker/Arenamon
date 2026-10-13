import { LOCOMOTION } from './config';
import { Vec, add, dot, length, scale, sub } from './math';

export function approachVelocity(current: Vec, desired: Vec, dt: number): Vec {
  const difference = sub(desired, current), distance = length(difference);
  const rate = length(desired) < 1e-8 ? LOCOMOTION.braking
    : dot(current, desired) < 0 ? LOCOMOTION.reversal : LOCOMOTION.acceleration;
  return distance <= rate * dt ? { ...desired } : add(current, scale(difference, rate * dt / distance));
}
