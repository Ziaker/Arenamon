import { Command, Fighter } from './entity';
import { Vec, add, direction, dot, length, scale, smooth, sub, unit, vec } from './math';

export interface Buttons { x: number; forward: number; dodge: boolean; guard: boolean; guardPressed: boolean }
// This is a snapshot of the horizontal camera reference, never a visual mesh rotation.
export function resolveCommand(buttons: Buttons, self: Fighter, target: Fighter, yaw: number, locked: boolean): Command {
  const cameraForward = direction(yaw + Math.PI), screenRight = vec(-cameraForward.z, cameraForward.x);
  const offset = sub(target.position, self.position);
  const targetForward = length(offset) > 1e-6 ? unit(offset) : direction(self.combatHeading);
  const targetRight = vec(-targetForward.z, targetForward.x);

  let move: Vec;
  if (!locked) {
    move = unit(add(scale(cameraForward, buttons.forward), scale(screenRight, buttons.x)));
  } else {
    if (buttons.forward !== 0 && buttons.x === 0) {
      move = scale(targetForward, buttons.forward);
    } else if (buttons.forward === 0 && buttons.x !== 0) {
      move = scale(screenRight, buttons.x);
    } else if (buttons.forward !== 0 && buttons.x !== 0) {
      // Diagonal: use the orthonormal target basis aligned with camera
      move = unit(add(scale(targetForward, buttons.forward), scale(targetRight, buttons.x)));
    } else {
      move = vec();
    }
  }

  const dodgeRight = locked ? targetRight : screenRight;
  const forward = locked ? targetForward : cameraForward;
  const noDirection = buttons.x === 0 && buttons.forward === 0;
  const dodgeDirection = noDirection
    ? (locked ? targetForward : direction(self.facing))
    : unit(add(scale(forward, buttons.forward), scale(dodgeRight, buttons.x)));

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

