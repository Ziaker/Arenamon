// Controle de cada lutador por passo fixo: stamina, defesa, X (tackle) e C (esquiva), cancelamento C → X,
// salto da esquiva, recuo e locomoção.
//
// X e C são ações independentes: cada uma lê somente o próprio bloco de parâmetros (C.actions.tackle ou
// C.actions.dodge). As transições entre ações seguem estas regras, nesta ordem:
//   • C → X: sistema próprio (C.actions.cancel), com janela própria; não depende da janela genérica.
//   • Recuo → nova ação: permitido conforme `fromRecoil` da ação pedida (GDD 8.2: sem tackle durante o recuo).
//   • Guard stun → X: conforme `fromGuardStun`; com 0 o pedido fica guardado e o tackle sai quando o stun acaba (GDD 5).
//   • Demais encadeamentos (C → C, X → C, X → X e defesa): janela genérica `chainAfter` da ação em curso (GDD 7.3/7.4).
// Com os ajustes V6_COMPAT (config.js) o resultado é idêntico ao laboratório v6 (teste de paridade).
import {C} from './config.js';
import {nominalDistance, actionParams, invulnerableWindow, chainOpen, actionSpec} from './entity.js';
import {stat, hasFlag} from './status.js';
import {moveInSlot, getMove} from './moves.js';
import {vec, add, scale, sub, dot, length, normalize, clamp, angleOf, direction, angleDelta, smoothstep, actionCurve} from './math.js';
import {legacyApproach, locomotionStep} from './locomotion.js';
import {actionProgress} from './motion.js';
import {report, attemptsActive} from './attempts.js';

/** Aceleração/frenagem/reversão da locomoção comum no modelo do v6 (mantido para compatibilidade). */
export function approachVelocity(current, desired, dt) {return legacyApproach(current, desired, C.locomotion, dt);}

/** Parâmetros efetivos da locomoção (caminhada ou sprint) para o passo atual. */
export function locomotionParams(f) {
  const L = C.locomotion, S = C.actions.sprint;
  return f.sprinting ? {acceleration: S.acceleration, braking: S.braking, reversal: L.reversal, turnGrip: S.turnGrip, accelCurve: L.accelCurve, brakeCurve: L.brakeCurve, friction: L.friction, residualSpeed: L.residualSpeed, overspeedBraking: S.braking}
    : {acceleration: L.acceleration, braking: L.braking, reversal: L.reversal, turnGrip: L.turnGrip, accelCurve: L.accelCurve, brakeCurve: L.brakeCurve, friction: L.friction, residualSpeed: L.residualSpeed, overspeedBraking: f.sprintCarry ? S.braking : L.braking};
}
/** Velocidade máxima de caminhada do lutador agora (defesa e exaustão reduzem). */
export const walkSpeed = f => stat(f, 'speed', f.attributes.speed) * (f.guard ? C.rules.guardSpeed : 1) * (f.exhausted ? C.rules.exhaustedSpeed : 1);
/** Custo de stamina de uma ação com o modificador de status (sem status: o próprio custo). */
export const costOf = (f, cost) => stat(f, 'staminaCost', cost);

/**
 * Stamina esgotada: abaixo do menor custo de X e C (exhaustMode 1) ou exatamente zero (0, Etapa A).
 * Com máximos fracionários (ex.: 5,1 e custo 1) a stamina nunca chega a zero; agora a exaustão ocorre ao sobrar menos que uma ação.
 */
export function isDepleted(stamina) {
  const A = C.actions, min = Math.min(A.dodge.cost, A.tackle.cost);
  return C.rules.exhaustMode === 1 && min > 1e-8 ? stamina < min - 1e-8 : stamina < 1e-8;
}
/** Giro com aceleração angular (modelo 1) ou com velocidade constante (v6). */
function turnToward(f, goal, dt) {
  const L = C.locomotion, diff = angleDelta(f.facing, goal);
  if (L.model !== 1 || L.turnAcceleration <= 0) {f.facing += clamp(diff, -L.turnRate * dt, L.turnRate * dt);f.turnVelocity = 0;return;}
  const want = Math.sign(diff) * Math.min(L.turnRate, Math.sqrt(2 * L.turnAcceleration * Math.abs(diff)));
  f.turnVelocity += clamp(want - f.turnVelocity, -L.turnAcceleration * dt, L.turnAcceleration * dt);
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
  if (f.guard && !p.fromGuard) return {ok: false, reason: 'guardBlocks'};
  if (cur?.kind === 'dodge' && kind === 'tackle') {
    // C → X: só na janela (por padrão, o fim da esquiva). Depois de uma esquiva perfeita, a qualquer momento.
    const c = A.cancel, [w0, w1] = cancelWindow(), perfect = c.perfectAnytime && f.counterWindow > 0;
    const inWindow = cur.elapsed >= w0 - 1e-8 && cur.elapsed <= w1 + 1e-8, ok = !!c.dodgeToTackle && (perfect || inWindow);
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
const staminaReason = (f, p) => f.exhausted ? {reason: 'exhausted', detail: {value: f.stamina, refill: C.rules.staminaMax}} : {reason: 'stamina', detail: {value: f.stamina, required: p.cost}};

// Memória só do diagnóstico (fora do estado do lutador: não entra em save/replay nem altera a simulação).
const lastBufferReason = new WeakMap(), sprintDenied = new WeakSet();
/** Guarda X ou C pedidos durante o hitstop no buffer de entrada (antes eram descartados). */
export function bufferDuringHitstop(f, cmd) {
  const T = C.extras.toggles, A = C.actions, kind = cmd.tackle && T.enableTackle ? 'tackle' : cmd.dodge && T.enableDodge ? 'dodge' : null;
  if (!kind || f.hp <= 0) return;
  report(f, {kind, result: 'buffered', reason: 'hitstop'});
  const m = length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move;
  f.inputBuffer = {kind, move: {...m}, dodgeDirection: cmd.dodgeDirection && {...cmd.dodgeDirection}, age: -Math.max(0, A.buffer.window > 0 ? 0 : 1e9), hitstop: true};
}
export function updateFighter(f, cmd, fighters, dt) {
  const R = C.rules, X = C.extras, T = X.toggles, A = C.actions;
  // Buffer de entrada: o pedido mais recente de X ou C vale por actions.buffer.window, mesmo no ar ou na aterrissagem.
  const requested = cmd.tackle && T.enableTackle ? 'tackle' : cmd.dodge && T.enableDodge ? 'dodge' : null;
  const diag = attemptsActive();
  if (diag) {
    if (cmd.tackle && !T.enableTackle) report(f, {kind: 'tackle', result: 'denied', reason: 'disabled'});
    if (cmd.dodge && !T.enableDodge && !(cmd.tackle && T.enableTackle)) report(f, {kind: 'dodge', result: 'denied', reason: 'disabled'});
    if (cmd.guardPressed && !T.enableDefense) report(f, {kind: 'guard', result: 'denied', reason: 'disabled'});
  }
  if (f.inputBuffer) {
    f.inputBuffer.age += dt;
    if (f.inputBuffer.age > A.buffer.window + 1e-8 || cmd.guardPressed) {if (diag && !requested) report(f, {kind: f.inputBuffer.kind, result: 'expired', ...(f.inputBuffer.age > A.buffer.window + 1e-8 ? lastBufferReason.get(f.inputBuffer) ?? {} : {note: 'substituído pela defesa'})});f.inputBuffer = null;}
  }
  if (requested && A.buffer.window > 0) {const m = length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move;f.inputBuffer = {kind: requested, move: {...m}, dodgeDirection: cmd.dodgeDirection && {...cmd.dodgeDirection}, age: 0};}
  // Comandos novos com o lutador indisponível: o motivo é a própria condição que encerra o passo abaixo.
  if (diag && (requested || cmd.guardPressed) && (f.flight || f.knockRecovery > 0 || f.hp <= 0)) {
    const why = f.flight ? {reason: 'airborne'} : f.knockRecovery > 0 ? {reason: 'recovery', detail: {left: f.knockRecovery}} : {reason: 'defeated'};
    if (requested) report(f, {kind: requested, result: A.buffer.window > 0 && f.hp > 0 ? 'buffered' : 'denied', ...why});
    if (cmd.guardPressed && T.enableDefense) report(f, {kind: 'guard', result: 'denied', ...why});
  }
  if (f.flight) {f.action = null;f.push = null;f.guard = false;f.vaultHeight = 0;f.velocity = vec();f.locomotionVelocity = vec();f.bufferedTackle = null;f.state = 'airborne';return;}
  if (f.knockRecovery > 0) {f.knockRecovery = Math.max(0, f.knockRecovery - dt);if (f.knockRecovery <= 0) f.recoveryFrom = null;f.vaultHeight = 0;f.velocity = vec();f.locomotionVelocity = vec();f.action = null;f.guard = false;f.bufferedTackle = null;f.state = 'landing';return;}
  if (f.hp <= 0) {f.state = 'defeated';f.velocity = vec();f.action = null;f.push = null;f.vaultHeight = 0;f.bufferedTackle = null;return;}
  const target = fighters.find(o => o.id === cmd.target && o.hp > 0);
  const move = length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move;
  // Mira (ataques sem direção, prévia): o alvo, se houver. Orientação do corpo: ver faceGoal abaixo.
  const desiredHeading = target ? angleOf(sub(target.position, f.position)) : length(move) > 0 ? angleOf(move) : f.facing;
  f.desiredMove = {...move};f.combatHeading = desiredHeading;f.inputDir = {...move};
  f.perfectCooldown = Math.max(0, f.perfectCooldown - dt);
  if (f.perfectLeft > 0) {f.perfectLeft = Math.max(0, f.perfectLeft - dt);if (f.perfectLeft < 1e-8 && !f.perfectSucceeded) f.perfectCooldown = R.perfectCooldown;}
  f.stun = Math.max(0, f.stun - dt);
  f.counterWindow = Math.max(0, f.counterWindow - dt);
  const staminaBefore = f.stamina;
  // Sprint: consumo contínuo; a regeneração fica suspensa enquanto ele dura.
  if (f.sprinting) {f.regenBase = Math.max(0, f.stamina - A.sprint.staminaDrain * dt);f.regenAge = 0;}
  f.regenAge += dt * (f.guard ? X.combat.guardRegenFactor : 1) * stat(f, 'staminaRegen', 1);
  const regen = clamp((f.regenAge - R.regenDelay) / R.regenTime, 0, 1);
  f.stamina = f.regenBase + (R.staminaMax - f.regenBase) * regen ** 3;
  if (f.sprinting && isDepleted(f.stamina)) {f.exhausted = true;}
  if (f.stamina >= R.staminaMax - 1e-8) {f.stamina = R.staminaMax;f.exhausted = false;}
  f.staminaTrend = (f.stamina - staminaBefore) / dt;
  if (!cmd.dodgeHeld) f.sprintArmed = false;
  if (!cmd.guard || !T.enableDefense) {f.guard = false;f.guardSuppressed = false;}
  // Defesa durante o tackle: só com “Defesa cancela o tackle” ligado, ou com um toque de defesa perfeita disponível.
  const tackleGuard = f.action?.kind !== 'tackle' || A.tackle.guardCancel || (A.tackle.perfectGuardCancel && cmd.guardPressed && f.perfectCooldown <= 0);
  const open = chainOpen(f) && tackleGuard;
  if (diag && cmd.guardPressed && T.enableDefense) {
    if (!f.guardSuppressed && open) {
      report(f, {kind: 'guard', result: 'executed', note: f.action ? `cancela ${f.action.kind === 'tackle' ? 'o tackle' : f.action.kind === 'dodge' ? 'a esquiva' : 'o recuo'}` : undefined});
      report(f, f.perfectCooldown <= 0 ? {kind: 'perfectGuard', result: 'executed', note: `janela de ${Math.round(R.perfect * 1000)} ms aberta`} : {kind: 'perfectGuard', result: 'denied', reason: 'perfectCooldown', detail: {left: f.perfectCooldown}});
    } else if (!f.guardSuppressed) report(f, {kind: 'guard', result: 'denied', ...(!tackleGuard ? {reason: 'tackleNoGuard'} : {reason: 'chain', detail: {left: Math.max(0, actionSpec(f.action).chainAfter - f.action.elapsed)}})});
  }
  if (cmd.guard && T.enableDefense && !f.guardSuppressed && open) {
    if (f.action && (f.action.kind === 'dodge' || f.action.kind === 'tackle')) f.blend = {from: {...f.velocity}, elapsed: 0};
    if (f.action?.kind === 'recoil') {f.velocity = vec();f.blend = null;}
    f.action = null;f.vaultHeight = 0;f.guard = true;
    // Segurar D não apaga o X guardado no guard stun; só um novo toque em D substitui o pedido (GDD 5: vale o último).
    if (cmd.guardPressed) f.bufferedTackle = null;
    if (cmd.guardPressed && f.perfectCooldown <= 0) {f.perfectLeft = R.perfect;f.perfectSucceeded = false;}
  }
  // Pedido de ação: X tem prioridade se as duas teclas chegarem no mesmo passo (como no v6).
  let kind = requested, dirs = {move, dodgeDirection: cmd.dodgeDirection}, fromBuffer = false;
  if (!kind && f.inputBuffer) {kind = f.inputBuffer.kind;dirs = {move: f.inputBuffer.move, dodgeDirection: f.inputBuffer.dodgeDirection};fromBuffer = true;}
  // Tackle guardado durante o guard stun: sai assim que o stun termina (GDD 5: só o último pedido é mantido).
  if (!kind && f.bufferedTackle && f.stun <= 1e-8 && !f.action) {kind = 'tackle';dirs = f.bufferedTackle;f.bufferedTackle = null;}
  if (kind) {
    const p = actionParams(kind), disarmed = kind === 'tackle' && (hasFlag(f, 'disarmed') || hasFlag(f, 'stunned')), stunnedC = kind === 'dodge' && hasFlag(f, 'stunned');
    const permission = disarmed || stunnedC ? {ok: false, reason: disarmed && !hasFlag(f, 'stunned') ? 'disarmed' : 'stunned'} : startPermission(f, kind), affordable = !f.exhausted && f.stamina >= costOf(f, p.cost) - 1e-8;
    const fresh = kind === requested && !fromBuffer, fromStun = !requested && !fromBuffer;
    if (permission.buffer) {f.bufferedTackle = {move: {...dirs.move}, dodgeDirection: dirs.dodgeDirection && {...dirs.dodgeDirection}};f.inputBuffer = null;if (diag && fresh) report(f, {kind, result: 'buffered', reason: permission.reason, detail: permission.detail, note: 'sai quando o guard stun acabar'});}
    else if (permission.ok && affordable) {
      const via = permission.viaCancel;startAction(f, kind, dirs, fighters, desiredHeading, via, cmd.guard, !!target && !!cmd.locked);if (fromBuffer) f.action.buffered = true;
      if (diag) report(f, {kind, result: 'executed', viaCancel: !!via, fromBuffer, note: fromStun ? 'guardado durante o guard stun' : undefined});
    } else if (diag) {
      // Sem permissão ou sem stamina: a ação atual continua intacta (inclusive a esquiva, no caso de C → X).
      const why = !permission.ok ? {reason: permission.reason, detail: permission.detail} : staminaReason(f, p);
      if (f.inputBuffer && fromBuffer) lastBufferReason.set(f.inputBuffer, why);
      if (fresh) {if (f.inputBuffer) lastBufferReason.set(f.inputBuffer, why);report(f, {kind, result: f.inputBuffer ? 'buffered' : 'denied', viaCancel: !!permission.viaCancel, ...why});}
    }
  }
  // Movimento especial (slot): X/C pedidos no mesmo passo têm prioridade. Mesmo controlador, stamina e diagnóstico.
  if (!kind && cmd.skill != null && f.hp > 0) {
    const def = moveInSlot(f, cmd.skill), perm = movePermission(f, def, cmd.skill);
    if (perm.ok) startMove(f, def, cmd.skill, {move, dodgeDirection: cmd.dodgeDirection}, desiredHeading, !!target, cmd.guard);
    if (diag) report(f, {kind: 'skill', slot: cmd.skill, move: def?.id ?? null, result: perm.ok ? 'executed' : 'denied', reason: perm.reason, detail: perm.detail});
  }
  // Esquiva → sprint: C ainda pressionado, com direção, a partir de entryFraction da esquiva (ou logo depois dela).
  const S = A.sprint, L = C.locomotion;
  const sprintReady = !!T.enableSprint && cmd.dodgeHeld && f.sprintArmed && length(move) > .01 && !f.guard && !f.exhausted && f.stamina >= S.minStamina - 1e-8 && f.stun <= 1e-8;
  // Sprint pedido (C mantido com direção no ponto de entrada) e recusado por stamina: relatado uma vez por esquiva.
  if (diag && !sprintReady && T.enableSprint && cmd.dodgeHeld && f.sprintArmed && length(move) > .01 && f.action?.kind === 'dodge' && !f.action.vault && !sprintDenied.has(f.action)
    && f.action.elapsed >= S.entryFraction * A.dodge.duration - 1e-8 && (f.exhausted || f.stamina < S.minStamina - 1e-8)) {
    sprintDenied.add(f.action);report(f, {kind: 'sprint', result: 'denied', ...(f.exhausted ? {reason: 'exhausted', detail: {value: f.stamina, refill: R.staminaMax}} : {reason: 'sprintStamina', detail: {value: f.stamina, required: S.minStamina}})});
  }
  if (sprintReady && f.action?.kind === 'dodge' && !f.action.vault && f.action.elapsed >= S.entryFraction * A.dodge.duration - 1e-8) {
    f.locomotionVelocity = {...f.velocity};f.action = null;f.vaultHeight = 0;f.sprinting = true;f.sprintCarry = false;
  } else if (sprintReady && !f.action && !f.sprinting) {f.sprinting = true;f.sprintCarry = false;}
  if (f.sprinting && (!cmd.dodgeHeld || length(move) <= .01 || f.guard || f.exhausted || f.stamina <= 1e-8 || f.action || f.stun > 1e-8 || !T.enableSprint)) {
    f.sprinting = false;f.sprintCarry = !f.action;f.sprintArmed = false;
  }
  // Orientação do corpo: separada da locomoção. Com lock-on, olha para o alvo conforme lockFacing (a mira continua no alvo).
  const lockedFace = target && (L.model !== 1 || L.lockFacing === 1 || (L.lockFacing === 2 && (length(move) <= .01 || f.guard)));
  // Sprint sempre olha para onde corre (a animação de sprint serve às 8 direções girando o corpo).
  const faceGoal = f.sprinting && length(move) > 0 && !(target && L.lockFacing === 1) ? angleOf(move) : lockedFace ? desiredHeading : length(move) > 0 ? angleOf(move) : f.facing;
  f.faceGoal = faceGoal; // meta de orientação (a animação escolhe frente/lado/trás por ela, não pelo giro em curso)
  if (!f.action) {
    f.vaultHeight = 0;
    const diff = angleDelta(f.facing, desiredHeading);
    if (f.guard && target) {
      const max = Math.min(R.guardTurn, Math.sqrt(2 * R.guardAcceleration * Math.abs(diff)));
      f.angularSpeed = Math.min(max, f.angularSpeed + R.guardAcceleration * dt);
      f.facing += clamp(diff, -f.angularSpeed * dt, f.angularSpeed * dt);f.turnVelocity = 0;
    } else {turnToward(f, faceGoal, dt);f.angularSpeed = 0;}
  }
  if (f.action) {
    f.locomotionVelocity = vec();f.sprintCarry = false;
    const action = f.action;
    if (action.kind === 'move') updateMove(f, action, target, cmd, dt);
    else if (action.kind === 'dodge' || action.kind === 'tackle') {
      const p = A[action.kind], homing = action.kind === 'tackle' && target && cmd.locked && L.lockTackleHoming;
      const steering = homing ? sub(target.position, f.position) : cmd.dodgeDirection ?? move;
      if (length(move) > .01 || homing) {
        const desired = action.startAngle + clamp(angleDelta(action.startAngle, angleOf(steering)), -p.steerLimit, p.steerLimit);
        action.heading += clamp(angleDelta(action.heading, desired), -p.steerRate * dt, p.steerRate * dt);
      }
      // O corpo pode olhar para o alvo; a trajetória da ação segue `heading`, independente da orientação.
      // No modelo novo, o tackle olha para a própria trajetória (exceto lockFacing = 1) e a esquiva olha para o alvo.
      const facingGoal = target && (L.model !== 1 || action.kind === 'dodge' || L.lockFacing === 1) ? desiredHeading : action.heading;
      turnToward(f, facingGoal, dt);
      const D = p.duration, u0 = action.elapsed / D, u1 = (action.elapsed + dt) / D, nominal = nominalDistance(f, action.kind) * (action.speedMultiplier ?? 1);
      let speed;
      if (p.profile === 1) {
        // Integração com correção: o restante da distância (pretendida, sem contar colisões) é distribuído pelo restante
        // da curva. A mistura de entrada com a velocidade anterior não encurta nem alonga a ação.
        const rem = 1 - actionProgress(p, u0), left = Math.max(0, nominal - (action.traveled ?? 0));
        speed = rem > 1e-9 ? left * (actionProgress(p, u1) - actionProgress(p, u0)) / rem / dt : 0;
      } else speed = nominal * (actionProgress(p, u1) - actionProgress(p, u0)) / dt;
      f.velocity = scale(direction(action.heading), speed);
      const blendTime = action.blendTime ?? p.blend;
      if (action.from && blendTime > 0 && action.elapsed < blendTime) {
        const blend = smoothstep((action.elapsed + dt) / blendTime);
        f.velocity = {x: action.from.x * (1 - blend) + f.velocity.x * blend, z: action.from.z * (1 - blend) + f.velocity.z * blend};
      }
      action.traveled = (action.traveled ?? 0) + Math.max(0, dot(f.velocity, direction(action.heading))) * dt;
      if (action.kind === 'dodge' && action.jump) {
        // Pulo físico: altura integrada pela gravidade; deslocamento horizontal constante na direção do salto.
        const J = action.jump, g = A.dodge.vaultGravity;
        J.y += J.vy * dt - .5 * g * dt * dt;J.vy -= g * dt;
        f.velocity = scale(direction(action.heading), A.dodge.vaultHorizontal);
        if (action.from && (action.blendTime ?? p.blend) > 0 && action.elapsed < (action.blendTime ?? p.blend)) {const b = smoothstep((action.elapsed + dt) / (action.blendTime ?? p.blend));f.velocity = {x: action.from.x * (1 - b) + f.velocity.x * b, z: action.from.z * (1 - b) + f.velocity.z * b};}
        f.vaultHeight = Math.max(0, J.y);
        if (J.y <= 0 && action.elapsed > dt) J.landed = true;
      } else if (action.kind === 'dodge') {
        // C com salto (Etapa A): arco aéreo contínuo de decolagem e pouso, na duração da esquiva.
        f.vaultHeight = action.vault ? A.dodge.vaultHeight * Math.sin(Math.PI * clamp((action.elapsed + dt) / A.dodge.duration, 0, 1)) : 0;
      } else {
        // X vindo de um salto (C → X no ar): desce suavemente da altura em que estava, sem teletransporte.
        f.vaultHeight = action.liftStart > 0 ? (action.liftTime > 0 ? action.liftStart * (1 - smoothstep((action.elapsed + dt) / action.liftTime)) : 0) : 0;
      }
      f.state = action.kind;
    } else {
      f.vaultHeight = 0;
      const distance = nominalDistance(f) * R.recoilFraction;
      const step = smoothstep((action.elapsed + dt) / R.recoil) - smoothstep(action.elapsed / R.recoil);
      f.velocity = scale(direction(action.heading), distance * step / dt);f.state = 'recoil';
    }
  } else {
    const walk = walkSpeed(f), vMax = f.sprinting ? f.attributes.speed * S.speedMultiplier : walk, before = f.locomotionVelocity;
    if (f.stun > 1e-8 || hasFlag(f, 'stunned')) {f.locomotionVelocity = vec();f.locoPhase = 'stun';f.desiredVelocity = vec();}
    else if (hasFlag(f, 'rooted')) {const r = locomotionStep(f.locomotionVelocity, vec(), walk, locomotionParams(f), dt);f.locomotionVelocity = r.velocity;f.desiredVelocity = vec();f.locoPhase = 'rooted';}
    else if (L.model !== 1) {f.locomotionVelocity = approachVelocity(f.locomotionVelocity, scale(move, walk), dt);f.desiredVelocity = scale(move, walk);f.locoPhase = length(move) ? 'legacy' : 'idle';}
    else {
      const r = locomotionStep(f.locomotionVelocity, move, vMax, locomotionParams(f), dt);
      f.locomotionVelocity = r.velocity;f.desiredVelocity = r.desired;
      if (f.sprintCarry && length(r.velocity) <= walk + 1e-3) f.sprintCarry = false;
      f.locoPhase = f.sprinting ? 'sprint' : f.sprintCarry ? 'sprintStop' : r.phase;
    }
    f.appliedAccel = scale(sub(f.locomotionVelocity, before), 1 / dt);
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

/** Rival por cima do qual a esquiva salta (o contato entre os dois é ignorado até o pouso). */
function vaultTarget(f, heading, fighters) {const v = direction(heading);let best = null, bestD = Infinity;for (const o of fighters) {if (o.id === f.id || o.hp <= 0) continue;const d = dot(sub(o.position, f.position), v);if (d > 0 && d < bestD) {bestD = d;best = o.id;}}return best;}
/** C nesta direção atravessaria um adversário (e portanto saltaria)? Usado pela esquiva e pela prévia de trajetória. */
export function wouldVault(f, heading, fighters) {
  const A = C.actions, v = direction(heading), D = A.dodge;
  const travel = D.vaultPhysics ? D.vaultHorizontal * 2 * D.vaultUp / Math.max(.1, D.vaultGravity) : nominalDistance(f, 'dodge'), maxTravel = travel + D.vaultReachBonus;
  return fighters.some(other => {
    if (other.id === f.id || other.hp <= 0) return false;
    const delta = sub(other.position, f.position), ahead = dot(delta, v), lateral = length(sub(delta, scale(v, ahead)));
    return ahead > A.dodge.vaultForwardMin && ahead < maxTravel && lateral < A.dodge.vaultLateralWidth;
  });
}

/** Inicia X ou C. No cancelamento C → X, preserva velocidade, altura e invulnerabilidade de forma controlada. */
function startAction(f, kind, dirs, fighters, desiredHeading, viaCancel, guardHeld, locked = false) {
  const A = C.actions, p = A[kind], T = C.extras.toggles, prev = f.action;
  const requested = dirs.dodgeDirection ?? dirs.move;
  // Lock-on: o tackle sempre parte rumo ao oponente (mesmo com ↓ ou C → X). Sem lock-on, vale a direção pedida.
  const homing = kind === 'tackle' && locked && C.locomotion.lockTackleHoming;
  // C → X sem nova direção: continua na direção da esquiva (continuidade determinística).
  const heading = homing ? desiredHeading : viaCancel && length(dirs.move) <= .01 ? prev.heading : length(requested) > .01 ? angleOf(requested) : desiredHeading;
  // Curva em fases: sempre parte da velocidade atual (a curva começa parada; sem a mistura a velocidade saltaria).
  let from = f.action || p.profile === 1 ? {...f.velocity} : null, blendTime, invulnerableFor, liftStart = 0, liftTime = 0;
  if (viaCancel) {
    const c = A.cancel;from = scale(f.velocity, c.velocityInfluence);blendTime = c.transition;
    // A invulnerabilidade de C não vira invulnerabilidade extra de X.
    invulnerableFor = c.invulnerability === 1 ? 0 : c.invulnerability === 2 ? undefined : Math.max(0, invulnerableWindow(prev) - prev.elapsed);
    if (f.vaultHeight > 0) {liftStart = f.vaultHeight;liftTime = c.airDescent;}
  }
  // C só salta quando o caminho atravessa de fato um adversário; as demais esquivas ficam baixas.
  const vault = !!T.enableVault && kind === 'dodge' && wouldVault(f, heading, fighters);
  const countered = kind === 'tackle' && f.counterWindow > 0 && T.enableCounterBonus;
  const combatWindows = f.combatWindows?.[kind] || C.combatWindows?.[kind] || null;
  f.action = {kind, elapsed: 0, startAngle: heading, heading, offensive: kind === 'tackle', vault, hits: new Set(), from, speedMultiplier: countered ? A.tackle.counterSpeed : 1,
    combatWindows: combatWindows ? structuredClone(combatWindows) : null,
    hitWindows: combatWindows?.activeWindows?.length ? combatWindows.activeWindows.map(() => new Set()) : []};
  // Salto sobre o rival: pulo balístico (impulso vertical, gravidade e velocidade horizontal próprias).
  if (vault && A.dodge.vaultPhysics) f.action.jump = {y: 0, vy: A.dodge.vaultUp, over: vaultTarget(f, heading, fighters)};
  if (blendTime !== undefined) f.action.blendTime = blendTime;
  if (invulnerableFor !== undefined) f.action.invulnerableFor = invulnerableFor;
  if (liftStart > 0) {f.action.liftStart = liftStart;f.action.liftTime = liftTime;f.action.fromCancel = true;}
  if (viaCancel) f.action.fromCancel = true;
  if (countered) f.counterWindow = 0;
  // O custo de C já gasto continua gasto; X cobra o próprio custo.
  f.stamina = Math.max(0, f.stamina - costOf(f, p.cost));f.regenBase = f.stamina;f.regenAge = 0;
  f.exhausted = isDepleted(f.stamina);f.guard = false;f.guardSuppressed = guardHeld;
  f.stun = 0;f.push = null;f.blend = null;f.vaultHeight = liftStart;f.bufferedTackle = null;f.inputBuffer = null;
  f.sprinting = false;f.sprintCarry = false;f.sprintArmed = kind === 'dodge';
}

/** Avança o relógio da ação e a encerra ao fim da duração própria. */
export function advanceAction(f, dt) {
  if (!f.action) return;
  f.action.elapsed += dt;
  const kind = f.action.kind, spec = actionSpec(f.action), duration = spec.duration;
  // O pulo físico termina ao tocar o chão (a duração da esquiva não o corta no ar).
  const done = f.action.jump ? f.action.jump.landed : f.action.elapsed >= duration - 1e-8;
  if (done) {
    const wasExhausted = f.exhausted && (kind === 'dodge' || kind === 'tackle');
    f.action = null;f.velocity = vec();f.vaultHeight = 0;f.state = f.hp <= 0 ? 'defeated' : 'neutral';
    if (wasExhausted && f.hp > 0) f.knockRecovery = Math.max(f.knockRecovery, C.extras.combat.exhaustRecovery);
    const recovery = spec.recovery;
    if (recovery > 0 && f.hp > 0) f.knockRecovery = Math.max(f.knockRecovery, recovery);
    // A animação segura a pose final da ação durante essa recuperação (não troca para “levantar”).
    f.recoveryFrom = f.knockRecovery > 0 && kind !== 'recoil' && kind !== 'move' ? kind : null;
  }
}

// ---------- Movimentos especiais ----------
/**
 * O movimento do slot pode começar agora? Mesmas regras gerais de X e C: lutador livre ou ação em curso já
 * encadeável (ou listada em cancelFrom), defesa e guard stun conforme a definição, recarga, status e stamina.
 */
export function movePermission(f, def, slot = null) {
  if (!def) return {ok: false, reason: 'noMove', detail: {slot}};
  if (hasFlag(f, 'stunned')) return {ok: false, reason: 'stunned'};
  if (hasFlag(f, 'silenced')) return {ok: false, reason: 'silenced'};
  const cd = f.moveCooldowns?.[def.id] ?? 0;if (cd > 1e-8) return {ok: false, reason: 'cooldown', detail: {left: cd}};
  if (f.guard && def.fromGuard === false) return {ok: false, reason: 'guardBlocks'};
  const cur = f.action;
  if (cur && !(def.cancelFrom || []).includes(cur.kind)) {
    if (cur.kind === 'recoil') return {ok: false, reason: 'recoil', detail: {left: Math.max(0, C.rules.recoil - cur.elapsed)}};
    if (!chainOpen(f)) return {ok: false, reason: 'chain', detail: {left: Math.max(0, actionSpec(cur).chainAfter - cur.elapsed)}};
  }
  if (f.stun > 1e-8 && !def.fromGuardStun) return {ok: false, reason: 'guardStun', detail: {left: f.stun}};
  const cost = costOf(f, def.cost ?? 1);
  if (f.exhausted && cost > 0) return {ok: false, reason: 'exhausted', detail: {value: f.stamina, refill: C.rules.staminaMax}};
  if (f.stamina < cost - 1e-8) return {ok: false, reason: 'stamina', detail: {value: f.stamina, required: cost}};
  return {ok: true};
}
/** Inicia o movimento: cobra a stamina, inicia a recarga e agenda a linha do tempo (disparada em updateMove). */
function startMove(f, def, slot, dirs, desiredHeading, hasTarget, guardHeld) {
  const aim = def.aim ?? 'target', inputDir = dirs.dodgeDirection ?? dirs.move;
  const heading = aim === 'facing' ? f.facing : aim === 'input' && length(inputDir) > .01 ? angleOf(inputDir) : hasTarget || length(inputDir) <= .01 ? desiredHeading : angleOf(inputDir);
  f.action = {kind: 'move', move: def.id, slot, elapsed: 0, startAngle: heading, heading, offensive: false, hits: new Set(), fired: [], from: {...f.velocity}};
  const cost = costOf(f, def.cost ?? 1);f.stamina = Math.max(0, f.stamina - cost);f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = isDepleted(f.stamina);
  if (def.cooldown > 0) (f.moveCooldowns ??= {})[def.id] = def.cooldown;
  f.guard = false;f.guardSuppressed = guardHeld;f.push = null;f.blend = null;f.vaultHeight = 0;f.bufferedTackle = null;f.inputBuffer = null;f.sprinting = false;f.sprintCarry = false;
}
/** Um passo do movimento em curso: deslocamento (motion), orientação e efeitos da linha do tempo que vencem neste passo. */
function updateMove(f, action, target, cmd, dt) {
  const def = getMove(action.move);if (!def) {f.velocity = vec();return;}
  const m = def.motion ?? {type: 'none'};
  if (m.type === 'dash' && m.distance) {
    // Deslocamento suave entre start e end (s): mesma distância qualquer que seja o passo.
    const t0 = m.start ?? 0, t1 = m.end ?? def.duration, prog = t => smoothstep(clamp((t - t0) / Math.max(1e-6, t1 - t0), 0, 1));
    f.velocity = scale(direction(action.heading), m.distance * (prog(action.elapsed + dt) - prog(action.elapsed)) / dt);
  } else if (m.type === 'root') f.velocity = vec();
  else {const from = action.from ?? vec(), k = Math.exp(-12 * dt);f.velocity = scale(from, k);action.from = {...f.velocity};}
  turnToward(f, target && def.aim !== 'facing' ? angleOf(sub(target.position, f.position)) : action.heading, dt);
  (def.timeline || []).forEach((ev, i) => {if (!action.fired.includes(i) && ev.at <= action.elapsed + dt + 1e-9) {action.fired.push(i);(f.moveFx ??= []).push({index: i, move: def.id, heading: action.heading});}});
  f.state = 'move';
}
/** Recargas dos movimentos (chamado por passo; a taxa pode vir de status). */
export function tickCooldowns(f, dt) {
  const cds = f.moveCooldowns;if (!cds) return;const rate = stat(f, 'cooldownRate', 1);
  for (const id of Object.keys(cds)) {cds[id] = Math.max(0, cds[id] - dt * rate);if (cds[id] <= 0) delete cds[id];}
}
