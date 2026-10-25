// Dividido de controller.js (comportamento idêntico): ctrl-basico.

import {C} from '../config.js';
import {chainOpen, actionSpec, getFighterMaxStamina} from '../entity.js';
import {stat} from '../status.js';
import {length, normalize, clamp, angleDelta} from '../math.js';
import {legacyApproach} from '../locomotion.js';
import {report} from '../attempts.js';
import {passiveCost} from '../passive-engine.js';

/** Aceleração/frenagem/reversão da locomoção comum no modelo do v6 (mantido para compatibilidade). */
export function approachVelocity(current, desired, dt) {return legacyApproach(current, desired, C.locomotion, dt);}
/** Parâmetros efetivos da locomoção (caminhada ou sprint) para o passo atual. */
export function locomotionParams(f) {
  const L = C.locomotion, S = C.actions.sprint;
  return f.sprinting ? {acceleration: S.acceleration, braking: S.braking, reversal: L.reversal, turnGrip: S.turnGrip, accelCurve: L.accelCurve, brakeCurve: L.brakeCurve, friction: L.friction, residualSpeed: L.residualSpeed, overspeedBraking: S.braking}
    : {acceleration: L.acceleration, braking: L.braking, reversal: L.reversal, turnGrip: L.turnGrip, accelCurve: L.accelCurve, brakeCurve: L.brakeCurve, friction: L.friction, residualSpeed: L.residualSpeed, overspeedBraking: f.sprintCarry ? S.braking : L.braking};
}
/** Velocidade máxima de caminhada do lutador agora (defesa e exaustão reduzem). */
export const walkSpeed = f => stat(f, 'speed', f.attributes.speed) * (f.guard ? C.rules.guardSpeed : 1) * (f.exhausted ? C.rules.exhaustedSpeed : 1) * (f.charge ? f.charge.params.moveSlow : 1) * (f.aim?.castLeft > 0 ? 1 - f.aim.params.castSlow : 1);
/** Custo de stamina de uma ação com o modificador de status (sem status: o próprio custo). */
// kind opcional ('dodge' | 'tech'): passivas como Technician alteram o custo efetivo de esquivas e recovery (R10);
// X/tackles e Moves continuam usando o custo base (C.extras.toggles.enablePassives desligado = paridade exata).
export const costOf = (f, cost, kind = null) => {
  if (C.extras?.toggles?.enableInfiniteStamina) return 0;   // stamina infinita: nenhuma ação consome
  const base = stat(f, 'staminaCost', cost) * (kind === 'dodge' ? stat(f, 'mobilityCost', 1) : 1);return kind ? passiveCost(f, kind, base) : base;
};
/**
 * Stamina esgotada: abaixo do menor custo de X e C (exhaustMode 1) ou exatamente zero (0, Etapa A).
 * Com máximos fracionários (ex.: 5,1 e custo 1) a stamina nunca chega a zero; agora a exaustão ocorre ao sobrar menos que uma ação.
 */
export function isDepleted(stamina) {
  if (C.extras?.toggles?.enableInfiniteStamina) return false;
  const A = C.actions, min = Math.min(A.dodge.cost, A.tackle.cost);
  return C.rules.exhaustMode === 1 && min > 1e-8 ? stamina < min - 1e-8 : stamina < 1e-8;
}
/** Giro com aceleração angular (modelo 1) ou com velocidade constante (v6). */
export function turnToward(f, goal, dt, k = 1) {
  const L = C.locomotion, diff = angleDelta(f.facing, goal), rate = L.turnRate * k, accel = L.turnAcceleration * k;   // k < 1: giro mais lento durante o Charge
  if (L.model !== 1 || L.turnAcceleration <= 0) {f.facing += clamp(diff, -rate * dt, rate * dt);f.turnVelocity = 0;return;}
  const want = Math.sign(diff) * Math.min(rate, Math.sqrt(2 * accel * Math.abs(diff)));
  f.turnVelocity += clamp(want - f.turnVelocity, -accel * dt, accel * dt);
  const step = f.turnVelocity * dt;
  if (Math.abs(step) >= Math.abs(diff) && Math.sign(step) === Math.sign(diff)) {f.facing = goal;f.turnVelocity = 0;} else f.facing += step;
}
/**
 * Janela do cancelamento C → X, em segundos da esquiva: [início, fim].
 * windowMode 1: só nos últimos `fromEnd` segundos da esquiva; 0: início e fim absolutos (Etapa A).
 */
export function cancelWindow() {
  const c = C.actions.cancel, d = C.actions.dodge.duration;
  return c.windowMode === 1 ? [Math.max(0, d - c.fromEnd), d] : [c.windowStart, c.windowEnd];
}
/**
 * A ação `kind` pode começar agora? Devolve {ok, viaCancel, buffer} e, quando negada, `reason` e `detail` — a própria
 * condição que decidiu (usados pelo diagnóstico de comandos; a decisão é exatamente a mesma).
 */
export function startPermission(f, kind) {
  const A = C.actions, cur = f.action, p = A[kind];
  // Charge em andamento: Tackle indisponível (M15.2); Dodge só cancela depois da trava (M16.2); recuperação do Move bloqueia o Tackle (M27.4).
  if (f.charge) {
    if (kind === 'tackle') return {ok: false, reason: 'charging'};
    const left = (f.charge.params.dodgeLockTicks - f.charge.ticks) * f.charge.params.step;
    return left > 1e-8 ? {ok: false, reason: 'chargeLock', detail: {left}} : {ok: true, viaCharge: true};
  }
  if (f.moveRecovery > 1e-8 && kind === 'tackle') return {ok: false, reason: 'moveRecovery', detail: {left: f.moveRecovery}};
  if (f.sandPush && kind === 'dodge') return {ok: false, reason: 'sandPush'};   // sob o empurrão da areia não se inicia esquiva (SW-D58)
  if (f.guard && !p.fromGuard) return {ok: false, reason: 'guardBlocks'};
  if (cur?.kind === 'dodge' && kind === 'tackle') {
    // C → X: só na janela (por padrão, o fim da esquiva). Depois de uma esquiva perfeita, a qualquer momento.
    const c = A.cancel, [w0, w1] = cancelWindow(), perfect = c.perfectAnytime && f.counterWindow > 0;
    const airSlam = !!C.extras.toggles.enableMeteorSlam && f.vaultHeight > C.rules.slamMinHeight, inWindow = airSlam || (cur.elapsed >= w0 - 1e-8 && cur.elapsed <= w1 + 1e-8), ok = !!c.dodgeToTackle && (perfect || inWindow);
    return {ok, viaCancel: true, ...(ok ? {} : c.dodgeToTackle ? {reason: 'cancelWindow', detail: {elapsed: cur.elapsed, open: [w0, w1]}} : {reason: 'cancelDisabled'})};
  }
  // X não cancela o próprio X (selfCancel 0) e C só cancela C nos últimos selfCancelFromEnd segundos.
  if (cur?.kind === 'tackle' && kind === 'tackle' && !A.tackle.selfCancel) return {ok: false, reason: 'selfCancelX'};
  if (cur?.kind === 'dodge' && kind === 'dodge' && cur.elapsed < A.dodge.duration - A.dodge.selfCancelFromEnd - 1e-8) return {ok: false, reason: 'selfCancelC', detail: {elapsed: cur.elapsed, from: A.dodge.duration - A.dodge.selfCancelFromEnd, window: A.dodge.selfCancelFromEnd}};
  if (cur?.kind === 'recoil') return p.fromRecoil ? {ok: true} : {ok: false, reason: 'recoil', detail: {left: Math.max(0, C.rules.recoil - cur.elapsed)}};
  if (cur) {const open = chainOpen(f);return open ? {ok: true} : {ok: false, reason: 'chain', detail: {left: Math.max(0, actionSpec(cur).chainAfter - cur.elapsed)}};}
  if (f.stun > 1e-8 && !p.fromGuardStun) return {ok: false, buffer: kind === 'tackle', reason: 'guardStun', detail: {left: f.stun}};
  return {ok: true};
}
/** Motivo da falta de stamina (mesma condição de `affordable` em updateFighter). */
export const staminaReason = (f, p, kind) => f.exhausted ? {reason: 'exhausted', detail: {value: f.stamina, refill: getFighterMaxStamina(f)}} : {reason: 'stamina', detail: {value: f.stamina, required: costOf(f, p.cost, kind)}};
// Memória só do diagnóstico (fora do estado do lutador: não entra em save/replay nem altera a simulação).
export const lastBufferReason = new WeakMap(), sprintDenied = new WeakSet();
/** Guarda X ou C pedidos durante o hitstop no buffer de entrada (antes eram descartados). */
export function bufferDuringHitstop(f, cmd) {
  const T = C.extras.toggles, A = C.actions, kind = cmd.tackle && T.enableTackle ? 'tackle' : cmd.dodge && T.enableDodge ? 'dodge' : null;
  if (!kind || f.hp <= 0) return;
  report(f, {kind, result: 'buffered', reason: 'hitstop'});
  const m = length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move;
  f.inputBuffer = {kind, move: {...m}, dodgeDirection: cmd.dodgeDirection && {...cmd.dodgeDirection}, age: -Math.max(0, A.buffer.window > 0 ? 0 : 1e9), hitstop: true};
}
