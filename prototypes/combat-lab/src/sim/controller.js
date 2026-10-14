// Controle de cada lutador por passo fixo: stamina, defesa, X/C (tackle/esquiva), salto, recuo e locomoção.
// Porto fiel do v6; a ordem das operações foi mantida para que a simulação seja idêntica.
import {C} from './config.js';
import {nominalDistance, actionDuration} from './entity.js';
import {vec, add, scale, sub, dot, length, normalize, clamp, angleOf, direction, angleDelta, smoothstep, dodgeCurve} from './math.js';

/** Aceleração/frenagem/reversão da locomoção comum. */
export function approachVelocity(current, desired, dt) {
  const L = C.locomotion, delta = sub(desired, current), dist = length(delta);
  const rate = length(desired) < 1e-8 ? L.braking : dot(current, desired) < 0 ? L.reversal : L.acceleration;
  return dist <= rate * dt ? {...desired} : add(current, scale(delta, rate * dt / dist));
}

export function updateFighter(f, cmd, fighters, dt) {
  const R = C.rules, X = C.extras, T = X.toggles;
  if (f.flight) {f.action = null;f.push = null;f.guard = false;f.vaultHeight = 0;f.velocity = vec();f.locomotionVelocity = vec();f.state = 'airborne';return;}
  if (f.knockRecovery > 0) {f.knockRecovery = Math.max(0, f.knockRecovery - dt);f.vaultHeight = 0;f.velocity = vec();f.locomotionVelocity = vec();f.action = null;f.guard = false;f.state = 'landing';return;}
  if (f.hp <= 0) {f.state = 'defeated';f.velocity = vec();f.action = null;f.push = null;f.vaultHeight = 0;return;}
  const target = fighters.find(o => o.id === cmd.target && o.hp > 0);
  const move = length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move;
  const desiredHeading = target ? angleOf(sub(target.position, f.position)) : length(move) > 0 ? angleOf(move) : f.facing;
  f.desiredMove = {...move};f.combatHeading = desiredHeading;
  f.perfectCooldown = Math.max(0, f.perfectCooldown - dt);
  if (f.perfectLeft > 0) {f.perfectLeft = Math.max(0, f.perfectLeft - dt);if (f.perfectLeft < 1e-8 && !f.perfectSucceeded) f.perfectCooldown = R.perfectCooldown;}
  f.stun = Math.max(0, f.stun - dt);
  f.counterWindow = Math.max(0, f.counterWindow - dt);
  f.regenAge += dt * (f.guard ? X.combat.guardRegenFactor : 1);
  const regen = clamp((f.regenAge - R.regenDelay) / R.regenTime, 0, 1);
  f.stamina = f.regenBase + (R.staminaMax - f.regenBase) * regen ** 3;
  if (f.stamina >= R.staminaMax - 1e-8) {f.stamina = R.staminaMax;f.exhausted = false;}
  if (!cmd.guard || !T.enableDefense) {f.guard = false;f.guardSuppressed = false;}
  const cancellable = !f.action || f.action.kind === 'recoil' || f.action.elapsed >= R.invulnerable - 1e-8;
  if (cmd.guard && T.enableDefense && !f.guardSuppressed && cancellable) {
    if (f.action && (f.action.kind === 'dodge' || f.action.kind === 'tackle')) f.blend = {from: {...f.velocity}, elapsed: 0};
    if (f.action?.kind === 'recoil') {f.velocity = vec();f.blend = null;}
    f.action = null;f.vaultHeight = 0;f.guard = true;
    if (cmd.guardPressed && f.perfectCooldown <= 0) {f.perfectLeft = R.perfect;f.perfectSucceeded = false;}
  }
  // X e C são entradas independentes, com o mesmo custo de stamina e a mesma duração.
  if (((cmd.tackle && T.enableTackle) || (cmd.dodge && T.enableDodge)) && cancellable && !f.exhausted && f.stamina >= X.combat.actionCost - 1e-8) {
    const requested = cmd.dodgeDirection ?? move;
    const heading = length(requested) > .01 ? angleOf(requested) : desiredHeading;
    const from = f.action ? {...f.velocity} : null;
    const kind = cmd.tackle && T.enableTackle ? 'tackle' : 'dodge';
    // C só salta quando o caminho atravessa de fato um adversário; as demais esquivas ficam baixas.
    const v = direction(heading), maxTravel = nominalDistance(f) + X.combat.vaultReachBonus;
    const vault = !!T.enableVault && kind === 'dodge' && fighters.some(other => {
      if (other.id === f.id || other.hp <= 0) return false;
      const delta = sub(other.position, f.position), ahead = dot(delta, v), lateral = length(sub(delta, scale(v, ahead)));
      return ahead > X.combat.vaultForwardMin && ahead < maxTravel && lateral < X.combat.vaultLateralWidth;
    });
    const countered = kind === 'tackle' && f.counterWindow > 0 && T.enableCounterBonus;
    f.action = {kind, elapsed: 0, startAngle: heading, heading, offensive: kind === 'tackle', vault, hits: new Set(), from, speedMultiplier: countered ? X.combat.counterSpeed : 1};
    if (countered) f.counterWindow = 0;
    f.stamina = Math.max(0, f.stamina - X.combat.actionCost);f.regenBase = f.stamina;f.regenAge = 0;
    f.exhausted = f.stamina < 1e-8;f.guard = false;f.guardSuppressed = cmd.guard;
    f.stun = 0;f.push = null;f.blend = null;f.vaultHeight = 0;
  }
  if (!f.action) {
    f.vaultHeight = 0;
    const diff = angleDelta(f.facing, desiredHeading);
    if (f.guard && target) {
      const max = Math.min(R.guardTurn, Math.sqrt(2 * R.guardAcceleration * Math.abs(diff)));
      f.angularSpeed = Math.min(max, f.angularSpeed + R.guardAcceleration * dt);
      f.facing += clamp(diff, -f.angularSpeed * dt, f.angularSpeed * dt);
    } else {f.facing += clamp(diff, -C.locomotion.turnRate * dt, C.locomotion.turnRate * dt);f.angularSpeed = 0;}
  }
  if (f.action) {
    f.locomotionVelocity = vec();
    const action = f.action;
    if (action.kind === 'dodge' || action.kind === 'tackle') {
      const steering = cmd.dodgeDirection ?? move;
      if (length(move) > .01) {
        const desired = action.startAngle + clamp(angleDelta(action.startAngle, angleOf(steering)), -R.steerLimit, R.steerLimit);
        action.heading += clamp(angleDelta(action.heading, desired), -R.steerRate * dt, R.steerRate * dt);
      }
      const facingGoal = target ? desiredHeading : action.heading;
      f.facing += clamp(angleDelta(f.facing, facingGoal), -C.locomotion.turnRate * dt, C.locomotion.turnRate * dt);
      const D = actionDuration(action.kind);
      const speed = nominalDistance(f, action.kind) * (action.speedMultiplier ?? 1) * (dodgeCurve((action.elapsed + dt) / D) - dodgeCurve(action.elapsed / D)) / dt;
      f.velocity = scale(direction(action.heading), speed);
      if (action.from && action.elapsed < R.blend) {
        const blend = smoothstep((action.elapsed + dt) / R.blend);
        f.velocity = {x: action.from.x * (1 - blend) + f.velocity.x * blend, z: action.from.z * (1 - blend) + f.velocity.z * blend};
      }
      // A esquiva C com salto é um arco aéreo contínuo de decolagem e pouso.
      f.vaultHeight = action.kind === 'dodge' && action.vault ? R.dodgeVaultHeight * Math.sin(Math.PI * clamp((action.elapsed + dt) / R.dodge, 0, 1)) : 0;
      f.state = action.kind;
    } else {
      f.vaultHeight = 0;
      const distance = nominalDistance(f) * R.recoilFraction;
      const step = smoothstep((action.elapsed + dt) / R.recoil) - smoothstep(action.elapsed / R.recoil);
      f.velocity = scale(direction(action.heading), distance * step / dt);f.state = 'recoil';
    }
  } else {
    const speed = f.attributes.speed * (f.guard ? R.guardSpeed : 1) * (f.exhausted ? R.exhaustedSpeed : 1);
    f.locomotionVelocity = f.stun > 1e-8 ? vec() : approachVelocity(f.locomotionVelocity, scale(move, speed), dt);
    f.velocity = {...f.locomotionVelocity};
    if (f.blend) {
      const amount = smoothstep((f.blend.elapsed + dt) / R.blend);
      f.velocity = {x: f.blend.from.x * (1 - amount) + f.velocity.x * amount, z: f.blend.from.z * (1 - amount) + f.velocity.z * amount};
      f.blend.elapsed += dt;if (f.blend.elapsed >= R.blend - 1e-8) f.blend = null;
    }
    f.state = f.stun > 1e-8 ? 'guardStun' : f.guard ? 'guard' : f.push ? 'pushed' : length(move) ? 'moving' : 'neutral';
  }
  f.visualFacing += clamp(angleDelta(f.visualFacing, f.facing), -C.locomotion.visualTurnRate * dt, C.locomotion.visualTurnRate * dt);
}

/** Avança o relógio da ação e a encerra ao fim da duração. */
export function advanceAction(f, dt) {
  if (!f.action) return;
  f.action.elapsed += dt;
  const duration = f.action.kind === 'recoil' ? C.rules.recoil : actionDuration(f.action.kind);
  if (f.action.elapsed >= duration - 1e-8) {
    const wasExhausted = f.exhausted && (f.action.kind === 'dodge' || f.action.kind === 'tackle');
    f.action = null;f.velocity = vec();f.vaultHeight = 0;f.state = f.hp <= 0 ? 'defeated' : 'neutral';
    if (wasExhausted && f.hp > 0) f.knockRecovery = Math.max(f.knockRecovery, C.extras.combat.exhaustRecovery);
  }
}
