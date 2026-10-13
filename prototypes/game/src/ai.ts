import { TEST } from './config';
import { Fighter, idle, offensive } from './entity';
import { length, scale, sub, unit, vec } from './math';
export type Mode = 'inactive' | 'defensive' | 'offensive' | 'combat';
export class Brain {
  cooldown = .6; phase = 0; wasGuard = false;
  reset() { this.cooldown = .6; this.phase = 0; this.wasGuard = false; }
  command(self: Fighter, target: Fighter, mode: Mode, dt: number) {
    const c = idle();
    if (mode === 'inactive') { this.wasGuard = false; return c; }
    c.target = target.id;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const offset = sub(target.position, self.position), distance = length(offset), forward = unit(offset);
    if (mode === 'defensive') c.guard = true;
    else {
      c.move = distance > TEST.aiRange ? forward : distance < 1.4 ? scale(forward, -1) : vec();
      if (mode === 'combat' && offensive(target) && distance < 4.5) {
        if (this.phase % 3 === 2 && this.cooldown <= 0) {
          c.move = vec(forward.z, -forward.x); c.dodge = true;
          this.cooldown = TEST.aiInterval; this.phase++;
        } else c.guard = true;
      } else if (distance <= TEST.aiRange && this.cooldown <= 0 && !self.action && self.stun <= 0) {
        c.move = forward; c.dodge = true; this.cooldown = TEST.aiInterval; this.phase++;
      }
    }
    c.guardPressed = c.guard && !this.wasGuard; this.wasGuard = c.guard;
    return c;
  }
}
