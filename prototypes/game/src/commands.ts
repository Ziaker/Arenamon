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

  /**
   * Geometric Conflict Note:
   * Combining target-relative forward navigation (advance/retreat toward lock-on target)
   * with screen-relative lateral navigation (strafe along screen horizontal axis) inherently
   * creates opposing intentions when the adversary is positioned perpendicular to camera-forward
   * (e.g. directly to the screen's left or right).
   * In such configurations:
   *   - Advancing toward target (F) and strafing right (R) project onto opposite directions
   *     along the screen horizontal axis (k = F · R < 0).
   *   - No single 2D vector can simultaneously maximize pure target approach and pure screen strafe
   *     when those vectors oppose each other.
   *
   * Deterministic Resolution:
   * 1. Cardinals: pure forward/backward strictly tracks targetForward; pure strafe strictly tracks screenRight.
   * 2. Diagonals: when k < 0, smooth transition toward the screen diagonal C prevents zero-vector cancellation
   *    and maintains continuous normalized evasion along the requested lateral sign.
   * 3. Dodge direction: strictly matches `move` whenever directional input is present, eliminating zero vectors
   *    and preventing improper fallback to combatHeading/facing under opposing geometry.
   */
  const noDirection = buttons.x === 0 && buttons.forward === 0;
  const dodgeDirection = noDirection
    ? (locked ? targetForward : direction(self.facing))
    : move;

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

