import { ACTIONS, ActionKind, LOCOMOTION, RULES } from './config';
import { approachVelocity } from './locomotion';
import { Command, Directions, Fighter, chainOpen, invulnerableWindow, nominalDistance } from './entity';
import { actionCurve, angle, clamp, delta, direction, dot, length, scale, smooth, sub, unit, vec } from './math';

/** A ação `kind` pode começar agora? `viaCancel` = C → X; `buffer` = X pedido no guard stun (sai quando o stun acaba). */
export function startPermission(f: Fighter, kind: ActionKind): { ok: boolean; viaCancel?: boolean; buffer?: boolean } {
  const p = ACTIONS[kind], cur = f.action;
  if (f.guard && !p.fromGuard) return { ok: false };
  if (cur?.kind === 'dodge' && kind === 'tackle') {
    // C → X: só a janela própria decide (inclusive dentro dos primeiros 200 ms).
    const c = ACTIONS.cancel;
    return { ok: c.dodgeToTackle && cur.elapsed >= c.windowStart - 1e-8 && cur.elapsed <= c.windowEnd + 1e-8, viaCancel: true };
  }
  if (cur?.kind === 'recoil') return { ok: p.fromRecoil };
  if (cur) return { ok: chainOpen(f) };
  if (f.stun > 1e-8 && !p.fromGuardStun) return { ok: false, buffer: kind === 'tackle' };
  return { ok: true };
}

/** C nesta direção atravessaria um adversário (e portanto saltaria por cima)? */
export function wouldVault(f: Fighter, heading: number, fighters: Fighter[]) {
  const D = ACTIONS.dodge, v = direction(heading), maxTravel = nominalDistance(f, 'dodge') + D.vaultReachBonus;
  return fighters.some(o => {
    if (o.id === f.id || o.hp <= 0) return false;
    const offset = sub(o.position, f.position), ahead = dot(offset, v), lateral = length(sub(offset, scale(v, ahead)));
    return ahead > D.vaultForwardMin && ahead < maxTravel && lateral < D.vaultLateralWidth;
  });
}

export function prepare(f: Fighter, c: Command, fighters: Fighter[], dt: number) {
  if (f.hp <= 0) { f.state = 'defeated'; f.velocity = vec(); f.action = null; f.push = null; f.vaultHeight = 0; f.inputBuffer = null; f.bufferedTackle = null; return; }
  // Buffer de entrada: o pedido mais recente de X ou C vale por ACTIONS.buffer.window; um toque na defesa descarta.
  const requested: ActionKind | null = c.tackle ? 'tackle' : c.dodge ? 'dodge' : null;
  if (f.inputBuffer) { f.inputBuffer.age += dt; if (f.inputBuffer.age > ACTIONS.buffer.window + 1e-8 || c.guardPressed) f.inputBuffer = null; }
  const target = fighters.find(t => t.id === c.target && t.hp > 0);
  const move = length(c.move) > 1 ? unit(c.move) : c.move;
  if (requested && ACTIONS.buffer.window > 0) f.inputBuffer = { kind: requested, move: { ...move }, dodgeDirection: c.dodgeDirection && { ...c.dodgeDirection }, age: 0 };
  const desiredHeading = target ? angle(sub(target.position, f.position)) : length(move) ? angle(move) : f.facing;
  f.desiredMove = { ...move }; f.combatHeading = desiredHeading;
  f.perfectCooldown = Math.max(0, f.perfectCooldown - dt);
  if (f.perfectLeft > 0) {
    f.perfectLeft = Math.max(0, f.perfectLeft - dt);
    if (f.perfectLeft < 1e-8 && !f.perfectSucceeded) f.perfectCooldown = RULES.perfectCooldown;
  }
  f.stun = Math.max(0, f.stun - dt);
  f.counterWindow = Math.max(0, f.counterWindow - dt);
  f.regenAge += dt;
  const regen = clamp((f.regenAge - RULES.regenDelay) / RULES.regenTime, 0, 1);
  f.stamina = f.regenBase + (RULES.staminaMax - f.regenBase) * regen ** 3;
  if (f.stamina >= RULES.staminaMax - 1e-8) { f.stamina = RULES.staminaMax; f.exhausted = false; }
  if (!c.guard) { f.guard = false; f.guardSuppressed = false; }
  if (c.guard && !f.guardSuppressed && chainOpen(f)) {
    if (f.action?.kind === 'dodge' || f.action?.kind === 'tackle') f.blend = { from: { ...f.velocity }, elapsed: 0 };
    if (f.action?.kind === 'recoil') { f.velocity = vec(); f.blend = null; }
    f.action = null; f.vaultHeight = 0;
    f.guard = true;
    // Segurar a defesa não apaga o X guardado no guard stun; só um novo toque substitui o pedido (GDD 5: vale o último).
    if (c.guardPressed) f.bufferedTackle = null;
    if (c.guardPressed && f.perfectCooldown <= 0) { f.perfectLeft = RULES.perfect; f.perfectSucceeded = false; }
  }
  // X tem prioridade se as duas teclas chegarem no mesmo passo.
  let kind = requested, dirs: Directions = { move, dodgeDirection: c.dodgeDirection }, fromBuffer = false;
  if (!kind && f.inputBuffer) { kind = f.inputBuffer.kind; dirs = { move: f.inputBuffer.move, dodgeDirection: f.inputBuffer.dodgeDirection }; fromBuffer = true; }
  if (!kind && f.bufferedTackle && f.stun <= 1e-8 && !f.action) { kind = 'tackle'; dirs = f.bufferedTackle; f.bufferedTackle = null; }
  if (kind) {
    const permission = startPermission(f, kind), affordable = !f.exhausted && f.stamina >= ACTIONS[kind].cost - 1e-8;
    if (permission.buffer) { f.bufferedTackle = { move: { ...dirs.move }, dodgeDirection: dirs.dodgeDirection && { ...dirs.dodgeDirection } }; f.inputBuffer = null; }
    else if (permission.ok && affordable) { start(f, kind, dirs, fighters, desiredHeading, !!permission.viaCancel, c.guard); if (fromBuffer) f.action!.buffered = true; }
    // Sem permissão ou sem stamina: a ação atual continua intacta (inclusive a esquiva, no caso de C → X).
  }
  if (!f.action) {
    f.vaultHeight = 0;
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
    if (a.kind === 'dodge' || a.kind === 'tackle') {
      const p = ACTIONS[a.kind], steering = c.dodgeDirection ?? move;
      if (length(move) > .01) {
        const desired = a.startAngle + clamp(delta(a.startAngle, angle(steering)), -p.steerLimit, p.steerLimit);
        a.heading += clamp(delta(a.heading, desired), -p.steerRate * dt, p.steerRate * dt);
      }
      // A trajetória segue `heading`; o corpo pode olhar para o alvo (lock-on) independentemente.
      const facingGoal = target ? desiredHeading : a.heading;
      f.facing += clamp(delta(f.facing, facingGoal), -LOCOMOTION.turnRate * dt, LOCOMOTION.turnRate * dt);
      const speed = nominalDistance(f, a.kind) * (a.speedMultiplier ?? 1) * (actionCurve((a.elapsed + dt) / p.duration, p.curveStart) - actionCurve(a.elapsed / p.duration, p.curveStart)) / dt;
      f.velocity = scale(direction(a.heading), speed);
      const blendTime = a.blendTime ?? p.blend;
      if (a.from && blendTime > 0 && a.elapsed < blendTime) {
        const t = smooth((a.elapsed + dt) / blendTime);
        f.velocity = { x: a.from.x * (1 - t) + f.velocity.x * t, z: a.from.z * (1 - t) + f.velocity.z * t };
      }
      if (a.kind === 'dodge') f.vaultHeight = a.vault ? ACTIONS.dodge.vaultHeight * Math.sin(Math.PI * clamp((a.elapsed + dt) / p.duration, 0, 1)) : 0;
      // X vindo de um salto (C → X no ar): desce suavemente da altura em que estava, sem teletransporte.
      else f.vaultHeight = a.liftStart && a.liftStart > 0 ? (a.liftTime! > 0 ? a.liftStart * (1 - smooth((a.elapsed + dt) / a.liftTime!)) : 0) : 0;
      f.state = a.kind;
    } else {
      f.vaultHeight = 0;
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

/** Inicia X ou C. No C → X preserva velocidade, altura e só o resto da invulnerabilidade de C. */
function start(f: Fighter, kind: ActionKind, dirs: Directions, fighters: Fighter[], desiredHeading: number, viaCancel: boolean, guardHeld: boolean) {
  const p = ACTIONS[kind], prev = f.action, requested = dirs.dodgeDirection ?? dirs.move;
  // C → X sem nova direção: continua na direção da esquiva.
  const heading = viaCancel && length(dirs.move) <= .01 ? prev!.heading : length(requested) > .01 ? angle(requested) : desiredHeading;
  let from = f.action ? { ...f.velocity } : null, blendTime: number | undefined, invulnerableFor: number | undefined, liftStart = 0, liftTime = 0;
  if (viaCancel) {
    const c = ACTIONS.cancel; from = scale(f.velocity, c.velocityInfluence); blendTime = c.transition;
    invulnerableFor = Math.max(0, invulnerableWindow(prev!) - prev!.elapsed);
    if (f.vaultHeight > 0) { liftStart = f.vaultHeight; liftTime = c.airDescent; }
  }
  const countered = kind === 'tackle' && f.counterWindow > 0;
  f.action = { kind, elapsed: 0, startAngle: heading, heading, offensive: kind === 'tackle', hits: new Set(), from,
    vault: kind === 'dodge' && wouldVault(f, heading, fighters), speedMultiplier: countered ? ACTIONS.tackle.counterSpeed : 1 };
  if (blendTime !== undefined) f.action.blendTime = blendTime;
  if (invulnerableFor !== undefined) f.action.invulnerableFor = invulnerableFor;
  if (liftStart > 0) { f.action.liftStart = liftStart; f.action.liftTime = liftTime; }
  if (viaCancel) f.action.fromCancel = true;
  if (countered) f.counterWindow = 0;
  // O custo de C já gasto continua gasto; X cobra o próprio custo.
  f.stamina = Math.max(0, f.stamina - p.cost); f.regenBase = f.stamina; f.regenAge = 0;
  f.exhausted = f.stamina < 1e-8; f.guard = false; f.guardSuppressed = guardHeld;
  f.stun = 0; f.push = null; f.blend = null; f.vaultHeight = liftStart; f.bufferedTackle = null; f.inputBuffer = null;
}

/** Avança o relógio da ação e a encerra ao fim da duração própria (C, X ou recuo). */
export function finish(f: Fighter, dt: number) {
  if (f.action) {
    f.action.elapsed += dt;
    const duration = f.action.kind === 'recoil' ? RULES.recoil : ACTIONS[f.action.kind].duration;
    if (f.action.elapsed >= duration - 1e-8) {
      f.action = null; f.velocity = vec(); f.vaultHeight = 0; f.state = f.hp <= 0 ? 'defeated' : 'neutral';
    }
  }
}
