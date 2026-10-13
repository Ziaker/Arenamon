import { LOCOMOTION, RULES, TEST } from './config';
import { approachVelocity } from './locomotion';
import { Command, Fighter, nominalDistance } from './entity';
import { angle, clamp, delta, direction, dodgeProgress, length, scale, smooth, sub, unit, vec } from './math';

export function prepare(f: Fighter, c: Command, fighters: Fighter[], dt: number) {
  if (f.hp <= 0) { f.state = 'defeated'; f.velocity = vec(); f.action = null; f.push = null; return; }
  const target = fighters.find(t => t.id === c.target && t.hp > 0);
  const move = length(c.move) > 1 ? unit(c.move) : c.move;
  const desiredHeading = target ? angle(sub(target.position, f.position)) : length(move) ? angle(move) : f.facing;
  f.desiredMove = { ...move }; f.combatHeading = desiredHeading;
  f.perfectCooldown = Math.max(0, f.perfectCooldown - dt);
  if (f.perfectLeft > 0) {
    f.perfectLeft = Math.max(0, f.perfectLeft - dt);
    if (f.perfectLeft < 1e-8 && !f.perfectSucceeded) f.perfectCooldown = RULES.perfectCooldown;
  }
  f.stun = Math.max(0, f.stun - dt);
  f.regenAge += dt;
  const regen = clamp((f.regenAge - RULES.regenDelay) / RULES.regenTime, 0, 1);
  f.stamina = f.regenBase + (RULES.staminaMax - f.regenBase) * regen ** 3;
  if (f.stamina >= RULES.staminaMax - 1e-8) { f.stamina = RULES.staminaMax; f.exhausted = false; }
  if (!c.guard) { f.guard = false; f.guardSuppressed = false; }
  const cancellable = !f.action || f.action.kind === 'recoil' || f.action.elapsed >= RULES.invulnerable - 1e-8;
  if (c.guard && !f.guardSuppressed && cancellable) {
    if (f.action?.kind === 'dodge') f.blend = { from: { ...f.velocity }, elapsed: 0 };
    if (f.action?.kind === 'recoil') { f.velocity = vec(); f.blend = null; }
    f.action = null;
    f.guard = true;
    if (c.guardPressed && f.perfectCooldown <= 0) { f.perfectLeft = RULES.perfect; f.perfectSucceeded = false; }
  }
  if (c.dodge && cancellable && !f.exhausted && f.stamina >= 1 - 1e-8) {
    const dodgeMove = c.dodgeDirection ?? move;
    const heading = length(dodgeMove) > .01 ? angle(dodgeMove) : desiredHeading;
    const from = f.action ? { ...f.velocity } : null;
    // Forward means aimed at selected opponent, or the body's heading when unlocked.
    const frontal = c.dodgeForward ?? (Math.abs(delta(target ? desiredHeading : f.facing, heading)) < TEST.forwardTolerance);
    f.action = { kind: 'dodge', elapsed: 0, startAngle: heading, heading, offensive: frontal, hits: new Set(), from };
    f.stamina = Math.max(0, f.stamina - 1); f.regenBase = f.stamina; f.regenAge = 0;
    f.exhausted = f.stamina < 1e-8; f.guard = false; f.guardSuppressed = c.guard;
    f.stun = 0; f.push = null; f.blend = null;
  }
  if (!f.action) {
    const diff = delta(f.facing, desiredHeading);
    if (f.guard && target) {
      const max = Math.min(RULES.guardTurn, Math.sqrt(2 * RULES.guardAcceleration * Math.abs(diff)));
      f.angularSpeed = Math.min(max, f.angularSpeed + RULES.guardAcceleration * dt);
      f.facing += clamp(diff, -f.angularSpeed * dt, f.angularSpeed * dt);
    } else { f.facing += clamp(diff, -LOCOMOTION.turnRate * dt, LOCOMOTION.turnRate * dt); f.angularSpeed = 0; }
  }
  if (f.action) {
    f.locomotionVelocity = vec();
    const a = f.action;
    if (a.kind === 'dodge') {
      const steering = c.dodgeDirection ?? move;
      if (length(move) > .01) {
        const desired = a.startAngle + clamp(delta(a.startAngle, angle(steering)), -RULES.steerLimit, RULES.steerLimit);
        a.heading += clamp(delta(a.heading, desired), -RULES.steerRate * dt, RULES.steerRate * dt);
      }
      // Lateral evasion and facing are separate. Lock-on retains combat orientation.
      const facingGoal = target ? desiredHeading : a.heading;
      f.facing += clamp(delta(f.facing, facingGoal), -LOCOMOTION.turnRate * dt, LOCOMOTION.turnRate * dt);
      const speed = nominalDistance(f) * (dodgeProgress((a.elapsed + dt) / RULES.dodge) - dodgeProgress(a.elapsed / RULES.dodge)) / dt;
      f.velocity = scale(direction(a.heading), speed);
      if (a.from && a.elapsed < RULES.blend) {
        const t = smooth((a.elapsed + dt) / RULES.blend);
        f.velocity = { x: a.from.x * (1 - t) + f.velocity.x * t, z: a.from.z * (1 - t) + f.velocity.z * t };
      }
      f.state = a.offensive ? 'tackle' : 'dodge';
    } else {
      const distance = nominalDistance(f) * RULES.recoilFraction;
      const d = smooth((a.elapsed + dt) / RULES.recoil) - smooth(a.elapsed / RULES.recoil);
      f.velocity = scale(direction(a.heading), distance * d / dt); f.state = 'recoil';
    }
  } else {
    const speed = f.attributes.speed * (f.guard ? RULES.guardSpeed : 1) * (f.exhausted ? RULES.exhaustedSpeed : 1);
    f.locomotionVelocity = f.stun > 1e-8 ? vec() : approachVelocity(f.locomotionVelocity, scale(move, speed), dt);
    f.velocity = { ...f.locomotionVelocity };
    if (f.blend) {
      const t = smooth((f.blend.elapsed + dt) / RULES.blend);
      f.velocity = { x: f.blend.from.x * (1 - t) + f.velocity.x * t, z: f.blend.from.z * (1 - t) + f.velocity.z * t };
      f.blend.elapsed += dt; if (f.blend.elapsed >= RULES.blend - 1e-8) f.blend = null;
    }
    f.state = f.stun > 1e-8 ? 'guardStun' : f.guard ? 'guard' : f.push ? 'pushed' : length(move) ? 'moving' : 'neutral';
  }
  f.visualFacing += clamp(delta(f.visualFacing, f.facing), -LOCOMOTION.visualTurnRate * dt, LOCOMOTION.visualTurnRate * dt);
}
export function finish(f: Fighter, dt: number) {
  if (f.action) {
    f.action.elapsed += dt;
    if (f.action.elapsed >= (f.action.kind === 'dodge' ? RULES.dodge : RULES.recoil) - 1e-8) {
      f.action = null; f.velocity = vec(); f.state = f.hp <= 0 ? 'defeated' : 'neutral';
    }
  }
}
