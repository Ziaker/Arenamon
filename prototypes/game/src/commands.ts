import { Command, Fighter } from './entity';
import { Vec, add, clamp, direction, dot, length, scale, smooth, sub, unit, vec } from './math';

export interface Buttons { x: number; forward: number; dodge: boolean; guard: boolean; guardPressed: boolean }
// This is a snapshot of the horizontal camera reference, never a visual mesh rotation.
export function resolveCommand(buttons: Buttons, self: Fighter, target: Fighter, yaw: number, locked: boolean): Command {
  const cameraForward = direction(yaw + Math.PI), screenRight = vec(-cameraForward.z, cameraForward.x);
  const offset = sub(target.position, self.position);
  const targetForward = length(offset) > 1e-6 ? unit(offset) : direction(self.combatHeading);

  let move: Vec;
  if (!locked) {
    move = unit(add(scale(cameraForward, buttons.forward), scale(screenRight, buttons.x)));
  } else {
    if (buttons.forward !== 0 && buttons.x === 0) {
      move = scale(targetForward, buttons.forward);
    } else if (buttons.forward === 0 && buttons.x !== 0) {
      move = scale(screenRight, buttons.x);
    } else if (buttons.forward !== 0 && buttons.x !== 0) {
      const F = scale(targetForward, buttons.forward);
      const R = scale(screenRight, buttons.x);
      const C = unit(add(scale(cameraForward, buttons.forward), R));
      const k = dot(F, R);
      const u = clamp(-k, 0, 1);
      const w = smooth(u);
      const S = add(F, R);
      move = unit(add(scale(S, 1 - w), scale(C, w)));
    } else {
      move = vec();
    }
  }

  const forward = locked ? targetForward : cameraForward;
  const noDirection = buttons.x === 0 && buttons.forward === 0;
  const dodgeDirection = noDirection
    ? (locked ? targetForward : direction(self.facing))
    : unit(add(scale(forward, buttons.forward), scale(screenRight, buttons.x)));

  return {
    move,
    target: locked ? target.id : null,
    dodge: buttons.dodge,
    guard: buttons.guard,
    guardPressed: buttons.guardPressed,
    dodgeDirection,
    dodgeForward: noDirection || (buttons.forward > 0 && buttons.x === 0),
  };
}

