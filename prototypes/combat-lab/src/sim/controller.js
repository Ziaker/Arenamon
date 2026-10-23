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
import {nominalDistance, actionParams, invulnerableWindow, chainOpen, actionSpec, getFighterMaxStamina} from './entity.js';
import {stat, hasFlag} from './status.js';
import {moveInSlot, getMove, getTackleSetup, nearestEligible} from './moves.js';
import {chargeParams, chargeLevel, interruptCooldown, boostPlan} from './charge.js';
import {vec, add, scale, sub, dot, length, normalize, clamp, angleOf, direction, angleDelta, smoothstep, actionCurve} from './math.js';
import {legacyApproach, locomotionStep} from './locomotion.js';
import {slideAlong} from './solid-contact.js';
import {actionProgress} from './motion.js';
import {report, attemptsActive} from './attempts.js';
import {getGroundHeight} from './physics.js';
import {passiveCost} from './passive-engine.js';
import {markerValidity, markerInitial, markerStep} from './aim-marker.js';
import {canSee} from './vision.js';
import {bulletPunchTravel} from './moves/bullet-punch.js';
import {isAirJump, isVaultArc, airKind, airUsable, vaultToFlight, takeOffToLift, applyLift} from './air.js';
import {ledgeUpdate} from './ledge.js';

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
export const costOf = (f, cost, kind = null) => {const base = stat(f, 'staminaCost', cost) * (kind === 'dodge' ? stat(f, 'mobilityCost', 1) : 1);return kind ? passiveCost(f, kind, base) : base;};

/**
 * Stamina esgotada: abaixo do menor custo de X e C (exhaustMode 1) ou exatamente zero (0, Etapa A).
 * Com máximos fracionários (ex.: 5,1 e custo 1) a stamina nunca chega a zero; agora a exaustão ocorre ao sobrar menos que uma ação.
 */
export function isDepleted(stamina) {
  const A = C.actions, min = Math.min(A.dodge.cost, A.tackle.cost);
  return C.rules.exhaustMode === 1 && min > 1e-8 ? stamina < min - 1e-8 : stamina < 1e-8;
}
/** Giro com aceleração angular (modelo 1) ou com velocidade constante (v6). */
function turnToward(f, goal, dt, k = 1) {
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
const staminaReason = (f, p, kind) => f.exhausted ? {reason: 'exhausted', detail: {value: f.stamina, refill: getFighterMaxStamina(f)}} : {reason: 'stamina', detail: {value: f.stamina, required: costOf(f, p.cost, kind)}};

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
/** Nível de PL pela carga do tackle: PL1 abaixo de 50% do tempo máximo, PL2 de 50% a 99%, PL3 na carga máxima. */
export const tackleChargeLevel = (t, max = C.rules.chargeTackleMaxTime) => t >= max - 1e-9 ? 3 : t >= max / 2 - 1e-9 ? 2 : 1;
/** Aplica o Power Level a uma ação de tackle: velocidade/alcance (a duração é fixa) e dano proporcionais (valores em sliders). */
export function applyTacklePL(action, level) {
  const R = C.rules;level = Math.max(1, Math.min(3, Math.round(level)));action.pl = level;
  action.plSpeed = level === 3 ? R.chargeTackleSpeed3 : level === 2 ? R.chargeTackleSpeed2 : 1;
  action.plDamage = level === 3 ? R.chargeTackleDamage3 : level === 2 ? R.chargeTackleDamage2 : 1;
}
function startTackleCharge(f, p) {
  f.stamina = Math.max(0, f.stamina - costOf(f, p.cost));f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = isDepleted(f.stamina);
  f.tackleCharge = {t: 0, level: 1, start: f.facing};
  f.guard = false;f.guardSuppressed = false;f.stun = 0;f.push = null;f.blend = null;f.vaultHeight = 0;f.bufferedTackle = null;f.inputBuffer = null;f.sprinting = false;
  f.velocity = vec();f.locomotionVelocity = vec();f.state = 'tackleCharge';
}
/** Direção válida da finta: a pedida (setas) só vale para os lados e para trás em relação ao ataque; para a frente (ou sem direção) não há finta. */
export function feintDirection(cmd, refHeading) {
  const m = cmd.dodgeDirection && length(cmd.dodgeDirection) > .01 ? cmd.dodgeDirection : length(cmd.move) > .01 ? cmd.move : null;
  if (!m) return null;
  return Math.abs(angleDelta(refHeading, angleOf(m))) >= C.rules.feintMinAngle * Math.PI / 180 - 1e-9 ? normalize(m) : null;
}
/** A stamina disponível (já contando a devolução do custo do tackle) cobre o custo da finta? */
export const canFeint = f => f.stamina + costOf(f, C.actions.tackle.cost) >= C.rules.feintCost - 1e-6;
/**
 * Finta: cancela o tackle (no startup ou na carga) e vira uma esquiva (C) para o lado ou para trás, um pouco mais rápida que a normal:
 * dura feintDuration × a duração da esquiva, percorre feintDistance × a distância dela e custa feintCost de stamina (o custo do tackle volta).
 */
export function doFeint(f, from, dir, fighters, desiredHeading, guardHeld) {
  const R = C.rules, tackleCost = costOf(f, C.actions.tackle.cost);
  if (from === 'charge') cancelTackleCharge(f, 'feint');
  f.action = null;f.guard = false;f.guardSuppressed = false;f.blend = null;f.vaultHeight = 0;f.bufferedTackle = null;f.inputBuffer = null;f.sprinting = false;f.stun = 0;f.push = null;
  f.stamina = clamp(f.stamina + tackleCost, 0, getFighterMaxStamina(f));
  startAction(f, 'dodge', {move: dir, dodgeDirection: dir}, fighters, desiredHeading, false, guardHeld);   // cobra o custo normal da esquiva
  const extra = Math.max(0, R.feintCost - costOf(f, C.actions.dodge.cost));
  f.stamina = Math.max(0, f.stamina - extra);f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = isDepleted(f.stamina);
  f.action.feint = true;f.action.durationScale = R.feintDuration;f.action.distanceScale = R.feintDistance;
  f.feints = (f.feints ?? 0) + 1;
}
export function cancelTackleCharge(f, why = 'cancel') {if (!f.tackleCharge) return;f.tackleCharge = null;f.tackleChargeEnd = why;if (f.state === 'tackleCharge') f.state = 'neutral';}
/** 'charging' (segue carregando, o passo termina aqui), 'fired' (a ação saiu) ou 'cancelled' (D ou C cancelaram; o pedido segue o fluxo normal). */
function stepTackleCharge(f, cmd, fighters, dt, desiredHeading, target, move, diag) {
  const R = C.rules, ch = f.tackleCharge;
  if (C.extras.toggles.enableTackleFeint && cmd.dodge) {
    const dir = feintDirection(cmd, f.facing);
    if (dir && canFeint(f)) {doFeint(f, 'charge', dir, fighters, desiredHeading, cmd.guard);if (diag) report(f, {kind: 'tackle', result: 'executed', note: 'finta (cancelou a carga)'});return 'feint';}
  }
  if ((cmd.guard && C.extras.toggles.enableDefense) || cmd.dodge) {cancelTackleCharge(f, cmd.dodge ? 'dodge' : 'guard');return 'cancelled';}
  ch.t += dt;ch.level = tackleChargeLevel(ch.t);
  if (ch.t < R.chargeTackleMaxTime) f.stamina = Math.max(0, f.stamina - R.chargeTackleDrain * dt);
  f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = isDepleted(f.stamina) || f.exhausted;
  // Carregando o tackle o lutador anda mais devagar (chargeTackleMove da velocidade de caminhada), não fica parado.
  const mv = hasFlag(f, 'rooted') || hasFlag(f, 'stunned') ? vec() : scale(move, walkSpeed(f) * R.chargeTackleMove);
  f.velocity = mv;f.locomotionVelocity = {...mv};f.desiredVelocity = {...mv};f.state = 'tackleCharge';
  if (target || length(move) > .01) turnToward(f, desiredHeading, dt, R.chargeTackleTurn);
  const empty = f.stamina <= 1e-8 && ch.t < R.chargeTackleMaxTime;
  if (cmd.tackleHeld && !empty) return 'charging';
  // Soltou (ou acabou a stamina): o tackle sai no PL alcançado, sem cobrar o custo de novo (já pago no início da carga).
  const level = ch.level, s0 = f.stamina;f.tackleCharge = null;
  startAction(f, 'tackle', {move, dodgeDirection: cmd.dodgeDirection}, fighters, desiredHeading, false, cmd.guard, !!target && !!cmd.locked);
  f.stamina = s0;f.regenBase = s0;f.regenAge = 0;f.exhausted = isDepleted(s0);
  applyTacklePL(f.action, level);f.action.charged = level;
  if (diag) report(f, {kind: 'tackle', result: 'executed', note: `carga solta no PL${level}`});
  return 'fired';
}
/**
 * Meteor slam a partir do voo de lançamento: o lutador sai do voo e mergulha em tackle oblíquo (slamAngle) na altura em que estava.
 * Gancho também para o futuro botão de pular: qualquer ação que deixe o lutador no ar pode chamar startSlam(f, altura, ...).
 */
export function startSlamFromFlight(f, dirs, fighters, desiredHeading, guardHeld, locked, world = null) {
  const startAlt = f.flight ? (f.flight.y ?? (f.groundY ?? 0)) : (f.groundY ?? 0);
  f.flight = null;f.wallSplat = null;f.tech = null;f.techDodge = null;f.knockRecovery = 0;f.normalJumpLanding = false;
  const targetGround = getGroundHeight(f.position, world, startAlt);
  f.groundY = targetGround;
  const h = Math.max(0.3, startAlt - targetGround);
  startSlam(f, h, dirs, fighters, desiredHeading, guardHeld, locked);
}
/** Meteor slam: estados 'meteorPrep' (jogado para cima por slamPrepTime) e 'meteorDive' (despenca em cima do rival). Aqui só a preparação; a mira vem em aimSlam. */
function aimSlam(f, fighters, h = f.vaultHeight) {
  const a = f.action;if (!a) return;
  a.slamCarry = a.from ? {...a.from} : {...f.velocity};   // velocidade herdada do dash: segue durante a preparação, reduzida por slamSpeedLoss, e zera ao terminá-la
  a.slamBase = a.slamH0 = h;a.slamT = 0;a.slamPrepDone = !(C.rules.slamPrepTime > 1e-6) || !(h > 1e-6);
  if (a.slamPrepDone) aimSlamDive(f, fighters);
  else if (a.locked) {
    const foeAngle = slamFoeAngle(f, fighters, true);
    if (foeAngle != null) a.heading = a.startAngle = foeAngle;
  }
}
const slamFoeAngle = (f, fighters, locked = false) => {
  if (!locked) return null;
  const foe = fighters.find(o => o.id !== f.id && o.hp > 0);
  if (!foe) return null;
  const d = Math.hypot(foe.position.x - f.position.x, foe.position.z - f.position.z);
  return d <= 8.0 ? angleOf({x: foe.position.x - f.position.x, z: foe.position.z - f.position.z}) : null;
};
/** Início da queda: vira para o rival se houver lock-on e estiver perto (<=8m); sem lock-on ou longe, mergulha na direção do movimento/olhar com alcance fixo. */
function aimSlamDive(f, fighters) {
  const a = f.action;if (!a) return;
  a.slamH0 = Math.max(f.vaultHeight, 1e-6);
  const foe = fighters.find(o => o.id !== f.id && o.hp > 0);
  const dist = foe ? Math.hypot(foe.position.x - f.position.x, foe.position.z - f.position.z) : Infinity;
  if (a.locked && foe && dist <= 8.0) {
    const dx = foe.position.x - f.position.x, dz = foe.position.z - f.position.z;
    if (dist > .35) a.heading = a.startAngle = angleOf({x: dx, z: dz});
    a.slamReach = Math.min(Math.max(.5, dist - .3), 8.0);
  } else {
    const mv = a.dirs?.move;
    if (mv && (mv.x !== 0 || mv.z !== 0)) {
      a.heading = a.startAngle = Math.atan2(mv.x, mv.z);
    }
    a.slamReach = Math.min(C.actions.tackle.distance ?? 4.0, 4.5);
  }
}
export function startSlam(f, height, dirs, fighters, desiredHeading, guardHeld, locked = false) {
  startAction(f, 'tackle', dirs, fighters, desiredHeading, false, guardHeld, locked);
  f.vaultHeight = Math.max(0, height);f.action.slam = true;f.action.fromSlam = true;f.action.plDamage = C.rules.slamDamage;f.action.pl = 2;aimSlam(f, fighters, height);   // Meteor Slam: PL 2
}
/** Tempo até o solo (s) de um lutador em voo balístico. */
export function timeToLand(f) {const g = C.rules.launchGravity, fl = f.flight;return fl ? (fl.vy + Math.sqrt(Math.max(0, fl.vy * fl.vy + 2 * g * fl.y))) / g : 0;}
/** Recovery rápido: C pedido no ar dentro da janela antes do pouso arma a esquiva; a direção segurada até o pouso é a que vale. */
function armTechRecovery(f, cmd, dt) {
  const R = C.rules, fl = f.flight;fl.age = (fl.age ?? 0) + dt;
  const dir = cmd.dodgeDirection && length(cmd.dodgeDirection) > .01 ? cmd.dodgeDirection : length(cmd.move) > .01 ? (length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move) : null;
  if (cmd.dodge && !f.tech && fl.age >= R.techMinAir - 1e-8 && timeToLand(f) <= R.techWindow + 1e-8) f.tech = {dir: dir ? {...dir} : vec(), at: fl.age};
  else if (f.tech && dir) f.tech.dir = {...dir};
}
/**
 * Salto normal (Plano D — overhaul do salto): decolagem imediata no mesmo passo do comando, preservando o
 * horizontal atual. O voo nasce marcado com `jumpFeel` quando o pacote experimental está ligado (gravidade
 * assimétrica, altura variável por botão mantido, velocidade terminal e controle aéreo por aceleração,
 * aplicados em stepPhysics). Com fromAir (coyote time), preserva a altitude do voo em curso em vez de groundY.
 */
function startNormalJump(f, move, diag, fromAir = false) {
  const M = C.map ?? {}, R = C.rules;
  const g = M.jumpGravity ?? R.launchGravity;
  const h = M.jumpHeight ?? 2.0;
  const vy = Math.sqrt(2 * g * h);
  const curH = fromAir && f.flight ? {...f.flight.horizontal} : {...f.velocity};
  const horiz = length(move) > 0
    ? scale(normalize(move), Math.max(length(curH), walkSpeed(f)))
    : curH;
  f.flight = {
    y: fromAir && f.flight ? f.flight.y : (f.groundY ?? 0),
    vy,
    horizontal: horiz,
    gravity: g,
    isNormalJump: true,
    jumpFeel: !!(M.jumpImprovements ?? 1),
    jumpHeld: true,
  };
  f.coyoteLeft = 0;          // coyote consumido (e nunca concede saltos extras no ar)
  f.airMoveDir = null;
  f.footstoolDoneWith = null;   // nova trajetória: libera um novo footstool por contato válido
  f.normalJumpLanding = true;
  f.jumpState.canJump = false;
  f.jumpState.cooldown = 0;
  f.state = 'airborne';
  f.sprinting = false;
  f.sprintCarry = false;
  if (diag) report(f, {kind: 'jump', result: 'executed', note: `${fromAir ? 'coyote · ' : ''}salto normal h=${h}m vy=${vy.toFixed(1)}m/s`});
}
/**
 * Passo dos Moves com o lutador em salto ou queda de borda (o ramo de voo retorna cedo e antes nunca chegava aqui). Mesmas funções do solo: toque no slot,
 * marcador, carga e soltura; e o relógio da ação 'move' aérea (air: true), cujos efeitos saem da linha do tempo sem tirar o corpo do voo.
 */
function airSkillStep(f, cmd, fighters, world, dt, diag) {
  const move = length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move, target = fighters.find(o => o.id === cmd.target && o.hp > 0);
  const desiredHeading = target ? angleOf(sub(target.position, f.position)) : length(move) > 0 ? angleOf(move) : f.facing;
  if (cmd.skill != null) pressSkill(f, cmd, move, desiredHeading, !!target, diag, fighters, world);
  else if (f.skillBuffer) bufferedSkill(f, cmd, diag);
  if (f.aim && !f.aim.castFirst) stepAim(f, cmd, move, {desiredHeading, hasTarget: !!target, fighters, world, dt, diag});
  if (f.charge) stepCharge(f, cmd, {move, desiredHeading, hasTarget: !!target, fighters});
  const a = f.action;
  if (a?.kind === 'move' && a.air && f.flight) {updateMove(f, a, target, cmd, dt);if (f.flight) f.state = 'airborne';}
}
export function updateFighter(f, cmd, fighters, dt, world = null) {
  CTX_FIGHTERS = fighters;CTX_WORLD = world;
  if (f.absent && !(f.action?.kind === 'move' && f.action.travel)) f.absent = false;   // rede de segurança: a ausência só existe durante a viagem do Bullet Punch; se a ação sumir (cancelada, lançamento, queda), o lutador reaparece em vez de ficar invisível e intangível para sempre
  if (cmd.target != null && fighters.find(o => o.id === cmd.target)?.absent) cmd = {...cmd, target: null, locked: false};   // ausente (Bullet Punch) não pode ser selecionado como alvo
  if (cmd.target != null && hasFlag(f, 'blind')) {   // cegueira: lock-on só em quem o cegado enxerga (10 m, sem parede bloqueando por completo); senão desliga
    const t = fighters.find(o => o.id === cmd.target);
    if (!canSee(f, t, world)) cmd = {...cmd, target: null, locked: false};
  }
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
  // Jump buffering (Plano D 2.6): o toque fica guardado por jumpBufferWindow e executa no primeiro passo em que as
  // regras permitirem — sem contornar stun, guard stun, cooldown, morte nem bloqueio de ação (o canNormalJump mais
  // abajo vale igual para toque direto e bufferado; o pedido expira e é consumido uma única vez). Fica no topo porque
  // o ramo de voo retorna cedo: o buffer precisa decair e ser armado também durante o salto (aperto antes do pouso).
  const MJ = C.map ?? {}, feelJ = !!(MJ.jumpImprovements ?? 1);
  // Decaimento: congela enquanto o ÚNICO bloqueio é o intervalo entre saltos pós-pouso (o salto bufferado sai
  // exatamente quando o cooldown termina, sem contorná-lo); no ar, em stun/knockback etc., decai normalmente.
  const waitingJumpCooldown = !f.flight && (f.jumpState?.cooldown ?? 0) > 0 && f.knockRecovery <= 1e-8 && f.stun <= 1e-8;
  if (!waitingJumpCooldown) f.jumpBuffered = Math.max(0, (f.jumpBuffered ?? 0) - dt);
  if (cmd.jump && f.hp > 0 && feelJ) f.jumpBuffered = Math.max(f.jumpBuffered ?? 0, MJ.jumpBufferWindow ?? 0.12);
  // Comandos novos com o lutador indisponível: o motivo é a própria condição que encerra o passo abaixo.
  const isSlamTrigger = f.flight && requested === 'tackle' && T.enableMeteorSlam && (f.flight.isNormalJump || f.flight.isEdgeFall || T.enableFlightSlam) && !f.wallSplat && f.hp > 0 && !f.exhausted && f.stamina >= costOf(f, A.tackle.cost) - 1e-8 && !hasFlag(f, 'disarmed') && !hasFlag(f, 'stunned');
  if (diag && (requested || cmd.guardPressed) && (f.flight || f.knockRecovery > 0 || f.hp <= 0)) {
    if (!isSlamTrigger) {
      const why = f.flight ? {reason: 'airborne'} : f.knockRecovery > 0 ? {reason: 'recovery', detail: {left: f.knockRecovery}} : {reason: 'defeated'};
      if (requested) report(f, {kind: requested, result: A.buffer.window > 0 && f.hp > 0 ? 'buffered' : 'denied', ...why});
      if (cmd.guardPressed && T.enableDefense) report(f, {kind: 'guard', result: 'denied', ...why});
    }
  }
  if (f.tackleCharge && (f.flight || f.knockRecovery > 0 || f.hp <= 0)) cancelTackleCharge(f, 'hit');   // golpe sofrido: a carga do tackle cai e a stamina gasta não volta
  if (f.aim && ((f.flight && !(isAirJump(f) && airKind(f.aim.def) !== 'none')) || f.knockRecovery > 0 || f.hp <= 0 || f.stun > 1e-8 || hasFlag(f, 'stunned') || hasFlag(f, 'silenced'))) cancelAim(f, f.hp <= 0 ? 'defeated' : 'hit');   // golpe sofrido: o marcador some sem custo
  if (f.charge && ((f.flight && !isAirJump(f)) || f.knockRecovery > 0 || f.hp <= 0)) cancelCharge(f, f.hp <= 0 ? 'defeated' : 'hit');   // golpe com lançamento, recuperação ou perda de apoio (M15.3, M27.1)
  if (f.aim?.castFirst && f.hp > 0) stepAim(f, cmd, length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move, {desiredHeading: f.facing, hasTarget: false, fighters, world, dt, diag});   // cast do Emerging Stone corre também no ar
  if (ledgeUpdate(f, cmd, fighters, world, dt, diag)) return;   // Ledge Grab: pendurado/subindo, ou acabou de agarrar neste passo (ledge.js)
  if (f.flight) {
    // Meteor slam de quem está no ar (salto normal com Espaço ou lançado): X no ar vira mergulho oblíquo (não vale preso na parede nem sem stamina).
    if (isSlamTrigger) {
      const target0 = fighters.find(o => o.id === cmd.target && o.hp > 0), mv = length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move;
      const isNormal = !!f.flight?.isNormalJump;
      const distToTarget = target0 ? Math.hypot(target0.position.x - f.position.x, target0.position.z - f.position.z) : Infinity;
      const useLock = !!cmd.locked && !!target0 && distToTarget <= 8.0;
      const desiredHeading = useLock ? angleOf(sub(target0.position, f.position)) : length(mv) > 0 ? angleOf(mv) : f.facing;
      startSlamFromFlight(f, {move: mv, dodgeDirection: cmd.dodgeDirection}, fighters, desiredHeading, cmd.guard, useLock, world);
      if (diag) report(f, {kind: 'tackle', result: 'executed', note: isNormal ? 'meteor slam (salto normal)' : 'meteor slam (lançado)'});
    } else {
      if (!f.flight.isNormalJump && !f.flight.bounce && T.enableTechRecovery && T.enableDodge && f.hp > 0 && !f.wallSplat) armTechRecovery(f, cmd, dt);
      const M0 = C.map ?? {}, feel0 = !!(M0.jumpImprovements ?? 1);
      if (f.flight.isNormalJump || f.flight.isEdgeFall) {
        // Plano D: o controlador grava o botão de salto mantido e a direção pedida; a física (stepPhysics)
        // aplica gravidade assimétrica/altura variável e o controle aéreo por aceleração sobre esses sinais.
        f.flight.jumpHeld = !!cmd.jumpHeld;
        f.airMoveDir = length(cmd.move) > 0.05 ? (length(cmd.move) > 1 ? normalize(cmd.move) : {...cmd.move}) : null;
        // Coyote time (2.5): queda natural recente da borda ainda permite o salto, sem saltos extras no ar e
        // nunca após knockback/lançamento (esses voos não são isEdgeFall). O meteor slam (X no ar) tem prioridade acima.
        if (f.flight.isEdgeFall && feel0 && f.coyoteLeft > 1e-8 && cmd.jump && f.hp > 0 && !f.wallSplat
          && !hasFlag(f, 'stunned') && !hasFlag(f, 'rooted') && f.jumpState.canJump) {
          f.jumpBuffered = 0;
          startNormalJump(f, length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move, diag, true);
          return;
        }
      }
      if (f.flight.isNormalJump && !(feel0 && (M0.jumpAirAccel ?? 0) > 0)) {
        // Controle aéreo legado (blend direcional), mantido quando o pacote novo está desligado ou sem aceleração.
        const airCtrl = M0.jumpAirControl ?? 0.0;
        if (length(f.flight.horizontal) < 0.05 && length(cmd.move) > 0.05) {
          const m = length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move;
          f.flight.horizontal = scale(m, walkSpeed(f));
        } else if (airCtrl > 0 && length(cmd.move) > 0.05) {
          const m = length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move;
          const targetH = scale(m, walkSpeed(f));
          const blendRate = Math.min(1, airCtrl * 5.0 * dt);
          f.flight.horizontal = add(
            scale(f.flight.horizontal, 1 - blendRate),
            scale(targetH, blendRate)
          );
        }
      }
      if (isAirJump(f) && f.hp > 0 && !hasFlag(f, 'stunned')) {airSkillStep(f, cmd, fighters, world, dt, diag);if (!f.flight) return;}   // Moves no ar: usar, mirar, carregar e a ação aérea em curso (air.js)
      if (!(f.action?.kind === 'move' && f.action.air && isAirJump(f))) f.action = null;
      f.push = null;f.guard = false;f.vaultHeight = 0;f.velocity = vec();f.locomotionVelocity = vec();f.bufferedTackle = null;f.state = f.wallSplat ? 'wallSplat' : 'airborne';return;
    }
  }
  // Derrota tem prioridade sobre recuperação: um lutador derrotado não pode ficar pendurado em
  // knockRecovery/landing — o estado físico precisa corresponder ao fato imediatamente (§22/§23).
  if (f.hp <= 0) {f.state = 'defeated';f.velocity = vec();f.action = null;f.push = null;f.vaultHeight = 0;f.bufferedTackle = null;return;}
  if (f.knockRecovery > 0) {f.knockRecovery = Math.max(0, f.knockRecovery - dt);if (f.knockRecovery <= 0) f.recoveryFrom = null;f.vaultHeight = 0;f.velocity = vec();f.locomotionVelocity = vec();f.action = null;f.guard = false;f.bufferedTackle = null;f.state = f.brakeLeft > 0 ? 'brake' : 'landing';f.brakeLeft = Math.max(0, (f.brakeLeft ?? 0) - dt);return;}
  const target = fighters.find(o => o.id === cmd.target && o.hp > 0);
  const inputMove = length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move;
  const move = f.aim && !f.aim.free ? vec() : inputMove;   // mirando com marcador, a direção move o marcador e o corpo fica parado (MV-P29)
  // Mira (ataques sem direção, prévia): o alvo, se houver. Orientação do corpo: ver faceGoal abaixo.
  const desiredHeading = target ? angleOf(sub(target.position, f.position)) : length(move) > 0 ? angleOf(move) : f.facing;
  // Finta: C ou D no startup do tackle cancelam o ataque (só derrapa, sem esquiva); o acerto já feito ou o mergulho impedem.
  if (T.enableTackleFeint && f.action?.kind === 'tackle' && !f.action.slam && (f.action.hits?.size ?? 0) === 0 && f.action.elapsed < R.feintWindow - 1e-9 && cmd.dodge) {
    const dir = feintDirection(cmd, f.action.heading);
    if (dir && canFeint(f)) {doFeint(f, 'startup', dir, fighters, desiredHeading, cmd.guard);if (diag) report(f, {kind: 'tackle', result: 'executed', note: 'finta (cancelou o startup)'});return;}
  }
  // Tackle carregado: enquanto X segue apertado o lutador fica parado carregando; soltar (ou acabar a stamina) dispara no PL alcançado.
  if (f.tackleCharge) {
    const r = stepTackleCharge(f, cmd, fighters, dt, desiredHeading, target, move, diag);
    if (r === 'charging' || r === 'feint') return;
  }
  // Recovery rápido: o pouso acabou de acontecer com C armado; esquiva na direção segurada, cobrando só o custo do recovery.
  if (f.techDodge) {
    const td = f.techDodge;f.techDodge = null;
    if (T.enableDodge && !f.action) {
      const s0 = f.stamina;
      startAction(f, 'dodge', {move: td.dir, dodgeDirection: length(td.dir) > .01 ? td.dir : undefined}, fighters, desiredHeading, false, cmd.guard, !!target && !!cmd.locked);
      f.action.techRecovery = true;f.techRecoveries = (f.techRecoveries ?? 0) + 1;
      f.stamina = Math.max(0, s0 - R.techCost);f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = isDepleted(f.stamina);
      if (diag) report(f, {kind: 'dodge', result: 'executed', note: 'recovery rápido'});
    }
  }
  f.desiredMove = {...move};f.combatHeading = desiredHeading;f.inputDir = {...move};
  f.perfectCooldown = Math.max(0, f.perfectCooldown - dt);
  if (f.perfectLeft > 0) {f.perfectLeft = Math.max(0, f.perfectLeft - dt);if (f.perfectLeft < 1e-8 && !f.perfectSucceeded) f.perfectCooldown = R.perfectCooldown;}
  f.stun = Math.max(0, f.stun - dt);
  f.counterWindow = Math.max(0, f.counterWindow - dt);
  const staminaBefore = f.stamina;
  // Sprint: consumo contínuo; a regeneração fica suspensa enquanto ele dura.
  if (f.sprinting) {f.regenBase = Math.max(0, f.stamina - A.sprint.staminaDrain * stat(f, 'mobilityCost', 1) * dt);f.regenAge = 0;}
  f.regenAge += dt * (f.guard ? X.combat.guardRegenFactor : 1) * stat(f, 'staminaRegen', 1);
  const regen = clamp((f.regenAge - R.regenDelay) / R.regenTime, 0, 1);
  const maxStam = getFighterMaxStamina(f);
  f.stamina = f.regenBase + (maxStam - f.regenBase) * regen ** 3;
  if (f.sprinting && isDepleted(f.stamina)) {f.exhausted = true;}
  if (f.stamina >= maxStam - 1e-8) {f.stamina = maxStam;f.exhausted = false;}
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
    if (f.charge) cancelCharge(f, 'guard');
    if (f.aim) cancelAim(f, 'guard');
    if (f.action && (f.action.kind === 'dodge' || f.action.kind === 'tackle')) f.blend = {from: {...f.velocity}, elapsed: 0};
    if (f.action?.kind === 'recoil') {f.velocity = vec();f.blend = null;}
    f.action = null;f.vaultHeight = 0;f.guard = true;
    // Segurar D não apaga o X guardado no guard stun; só um novo toque em D substitui o pedido (GDD 5: vale o último).
    if (cmd.guardPressed) f.bufferedTackle = null;
    if (cmd.guardPressed && f.perfectCooldown <= 0) {f.perfectLeft = R.perfect;f.perfectSucceeded = false;}
  }
  // Salto normal (R2.1–R2.8, R7.1–R7.2, R7.7–R7.9 + Plano D): Tecla Espaço em estado livre, caminhando ou correndo.
  // O jump buffering é armado/decai no topo de updateFighter (o ramo de voo retorna cedo).
  f.jumpState ??= {canJump: true, cooldown: 0};
  if (f.jumpState.cooldown > 0) {
    f.jumpState.cooldown = Math.max(0, f.jumpState.cooldown - dt);
    if (f.jumpState.cooldown <= 0 && !f.flight) f.jumpState.canJump = true;
  } else if (!f.flight && !f.action && !f.wallSplat && f.knockRecovery <= 0) {
    f.jumpState.canJump = true;
  }
  const canNormalJump = (cmd.jump || f.jumpBuffered > 1e-8) && f.hp > 0 && !f.action && !f.flight && !f.wallSplat && f.knockRecovery <= 0
    && !f.guard && !f.tackleCharge && !f.charge && f.stun <= 1e-8
    && !hasFlag(f, 'stunned') && !hasFlag(f, 'rooted')
    && f.jumpState.canJump && f.jumpState.cooldown <= 0;

  if (canNormalJump) {
    f.jumpBuffered = 0;   // consumido (toque direto ou bufferado)
    startNormalJump(f, move, diag);
    return;
  }
  // Pedido de ação: X tem prioridade se as duas teclas chegarem no mesmo passo (como no v6).
  let kind = requested, dirs = {move, dodgeDirection: cmd.dodgeDirection}, fromBuffer = false;
  if (!kind && f.inputBuffer) {kind = f.inputBuffer.kind;dirs = {move: f.inputBuffer.move, dodgeDirection: f.inputBuffer.dodgeDirection};fromBuffer = true;}
  // Tackle guardado durante o guard stun: sai assim que o stun termina (GDD 5: só o último pedido é mantido).
  if (!kind && f.bufferedTackle && f.stun <= 1e-8 && !f.action) {kind = 'tackle';dirs = f.bufferedTackle;f.bufferedTackle = null;}
  if (kind) {
    const p = actionParams(kind), disarmed = kind === 'tackle' && (hasFlag(f, 'disarmed') || hasFlag(f, 'stunned')), stunnedC = kind === 'dodge' && hasFlag(f, 'stunned');
    const permission = disarmed || stunnedC ? {ok: false, reason: disarmed && !hasFlag(f, 'stunned') ? 'disarmed' : 'stunned'} : startPermission(f, kind), affordable = !f.exhausted && f.stamina >= costOf(f, p.cost, kind) - 1e-8;
    const fresh = kind === requested && !fromBuffer, fromStun = !requested && !fromBuffer;
    if (permission.buffer) {f.bufferedTackle = {move: {...dirs.move}, dodgeDirection: dirs.dodgeDirection && {...dirs.dodgeDirection}};f.inputBuffer = null;if (diag && fresh) report(f, {kind, result: 'buffered', reason: permission.reason, detail: permission.detail, note: 'sai quando o guard stun acabar'});}
    else if (permission.ok && affordable) {
      const via = permission.viaCancel;if (f.charge) cancelCharge(f, 'dodge');if (f.aim) cancelAim(f, 'action');
      const chargeIt = kind === 'tackle' && T.enableChargeTackle && fresh && !via && !f.action && !f.sprinting && !!cmd.tackleHeld && !f.charge, sprintX = kind === 'tackle' && T.enableChargeTackle && fresh && f.sprinting && !via;
      if (chargeIt) {startTackleCharge(f, p);if (diag) report(f, {kind: 'tackle', result: 'executed', note: 'carga iniciada'});return;}
      startAction(f, kind, dirs, fighters, desiredHeading, via, cmd.guard, !!target && !!cmd.locked);if (fromBuffer) f.action.buffered = true;
      if (sprintX) applyTacklePL(f.action, R.sprintTacklePL);
      if (diag) report(f, {kind, result: 'executed', viaCancel: !!via, fromBuffer, note: fromStun ? 'guardado durante o guard stun' : undefined});
    } else if (diag) {
      // Sem permissão ou sem stamina: a ação atual continua intacta (inclusive a esquiva, no caso de C → X).
      const why = !permission.ok ? {reason: permission.reason, detail: permission.detail} : staminaReason(f, p, kind);
      if (f.inputBuffer && fromBuffer) lastBufferReason.set(f.inputBuffer, why);
      if (fresh) {if (f.inputBuffer) lastBufferReason.set(f.inputBuffer, why);report(f, {kind, result: f.inputBuffer ? 'buffered' : 'denied', viaCancel: !!permission.viaCancel, ...why});}
    }
  }
  // Movimento especial (slot): X/C pedidos no mesmo passo têm prioridade. Mesmo controlador, stamina e diagnóstico.
  if (!kind && cmd.skill != null && f.hp > 0) pressSkill(f, cmd, move, desiredHeading, !!target, diag, fighters, world);
  else if (!kind && f.skillBuffer && f.hp > 0) bufferedSkill(f, cmd, diag);
  if (f.aim && !f.aim.castFirst) stepAim(f, cmd, inputMove, {desiredHeading, hasTarget: !!target, fighters, world, dt, diag});   // marcador: mover, confirmar ou cancelar
  if (f.charge) stepCharge(f, cmd, {move, desiredHeading, hasTarget: !!target, fighters});   // soltar o Move: depois de defesa e X/C (M30.9)
  // Esquiva → sprint: C ainda pressionado, com direção, a partir de entryFraction da esquiva (ou logo depois dela).
  const S = A.sprint, L = C.locomotion;
  const sprintReady = !!T.enableSprint && cmd.dodgeHeld && f.sprintArmed && length(move) > .01 && !f.guard && !f.exhausted && !f.charge && f.stamina >= S.minStamina - 1e-8 && f.stun <= 1e-8;
  // Sprint pedido (C mantido com direção no ponto de entrada) e recusado por stamina: relatado uma vez por esquiva.
  if (diag && !sprintReady && T.enableSprint && cmd.dodgeHeld && f.sprintArmed && length(move) > .01 && f.action?.kind === 'dodge' && !f.action.vault && !sprintDenied.has(f.action)
    && f.action.elapsed >= S.entryFraction * A.dodge.duration - 1e-8 && (f.exhausted || f.stamina < S.minStamina - 1e-8)) {
    sprintDenied.add(f.action);report(f, {kind: 'sprint', result: 'denied', ...(f.exhausted ? {reason: 'exhausted', detail: {value: f.stamina, refill: getFighterMaxStamina(f)}} : {reason: 'sprintStamina', detail: {value: f.stamina, required: S.minStamina}})});
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
    } else {turnToward(f, faceGoal, dt, f.charge ? f.charge.params.turnSlow : 1);f.angularSpeed = 0;}
  }
  if (f.action) {
    f.locomotionVelocity = vec();f.sprintCarry = false;
    const action = f.action;
    if (action.kind === 'move') updateMove(f, action, target, cmd, dt);
    else if (action.kind === 'dodge' || action.kind === 'tackle') {
      const p = A[action.kind], homing = action.kind === 'tackle' && target && cmd.locked && L.lockTackleHoming;
      const steering = homing ? sub(target.position, f.position) : cmd.dodgeDirection ?? move;
      if ((length(move) > .01 || homing) && !action.fixedHeading) {
        const desired = action.startAngle + clamp(angleDelta(action.startAngle, angleOf(steering)), -p.steerLimit, p.steerLimit);
        action.heading += clamp(angleDelta(action.heading, desired), -p.steerRate * dt, p.steerRate * dt);
      }
      // O corpo pode olhar para o alvo; a trajetória da ação segue `heading`, independente da orientação.
      // No modelo novo, o tackle olha para a própria trajetória (exceto lockFacing = 1) e a esquiva olha para o alvo.
      const facingGoal = target && (L.model !== 1 || action.kind === 'dodge' || L.lockFacing === 1) ? desiredHeading : action.heading;
      turnToward(f, facingGoal, dt);
      const D = p.duration * (action.durationScale ?? 1), u0 = action.elapsed / D, u1 = (action.elapsed + dt) / D, nominal = nominalDistance(f, action.kind) * (action.speedMultiplier ?? 1) * (action.plSpeed ?? 1) * (action.distanceScale ?? 1);
      let speed;
      if (p.profile === 1) {
        // Integração com correção: o restante da distância (pretendida, sem contar colisões) é distribuído pelo restante
        // da curva. A mistura de entrada com a velocidade anterior não encurta nem alonga a ação.
        const rem = 1 - actionProgress(p, u0), left = Math.max(0, nominal - (action.traveled ?? 0) - (action.fricSkipped ?? 0));
        speed = rem > 1e-9 ? left * (actionProgress(p, u1) - actionProgress(p, u0)) / rem / dt : 0;
      } else speed = nominal * (actionProgress(p, u1) - actionProgress(p, u0)) / dt;
      if (action.kind === 'tackle' && !action.slam) {
        // Atrito do Tackle (por versão: PL1/PL2/PL3): a velocidade decai com exp(-atrito × tempo); a distância perdida não é compensada pela correção do perfil.
        const k = action.pl === 3 ? R.tackleFriction3 : action.pl === 2 ? R.tackleFriction2 : R.tackleFriction1;
        if (k > 0) {const s1 = speed * Math.exp(-k * (action.elapsed + dt));action.fricSkipped = (action.fricSkipped ?? 0) + (speed - s1) * dt;speed = s1;}
      }
      f.velocity = scale(direction(action.heading), speed);
      const blendTime = action.blendTime ?? p.blend;
      if (action.from && blendTime > 0 && action.elapsed < blendTime) {
        const blend = smoothstep((action.elapsed + dt) / blendTime);
        f.velocity = {x: action.from.x * (1 - blend) + f.velocity.x * blend, z: action.from.z * (1 - blend) + f.velocity.z * blend};
      }
      if (action.stepper) {const v = getTackleSetup(action.stepper)?.(f, action, dt);if (v) f.velocity = v;}   // Moves com movimento próprio dentro da ação de Tackle (Quick Attack: ida e volta)
      if (action.slam) {
        // Preparação: segue com a velocidade herdada menos slamSpeedLoss (a perda é total ao fim dela). Queda: avança o necessário para chegar ao rival no instante em que toca o chão (slamSpeedLoss reduz esse avanço); depois de aterrissar, parado.
        const tLeft = Math.max(dt, R.slamFallTime * f.vaultHeight / Math.max(1e-6, action.slamH0 ?? 0)), left = Math.max(0, (action.slamReach ?? 0) - (action.traveled ?? 0));
        f.velocity = action.slamLanded ? vec() : !action.slamPrepDone ? scale(action.slamCarry ?? vec(), 1 - R.slamSpeedLoss) : action.slamReach === undefined ? vec() : scale(direction(action.heading), Math.min(left / dt, left / tLeft));
      }
      action.traveled = (action.traveled ?? 0) + Math.max(0, dot(f.velocity, direction(action.heading))) * dt;
      if (action.kind === 'dodge' && action.jump) {
        // Pulo físico: altura integrada pela gravidade; deslocamento horizontal constante na direção do salto.
        const J = action.jump, g = A.dodge.vaultGravity;
        J.prevY = J.y;J.y += J.vy * dt - .5 * g * dt * dt;J.vy -= g * dt;
        f.velocity = scale(direction(action.heading), A.dodge.vaultHorizontal);
        if (action.from && (action.blendTime ?? p.blend) > 0 && action.elapsed < (action.blendTime ?? p.blend)) {const b = smoothstep((action.elapsed + dt) / (action.blendTime ?? p.blend));f.velocity = {x: action.from.x * (1 - b) + f.velocity.x * b, z: action.from.z * (1 - b) + f.velocity.z * b};}
        f.vaultHeight = Math.max(0, J.y);
        if (J.y <= 0 && action.elapsed > dt) J.landed = true;
      } else if (action.kind === 'dodge') {
        // C com salto (Etapa A): arco aéreo contínuo de decolagem e pouso, na duração da esquiva.
        f.vaultHeight = action.vault ? A.dodge.vaultHeight * Math.sin(Math.PI * clamp((action.elapsed + dt) / A.dodge.duration, 0, 1)) : 0;
      } else {
        // X vindo de um salto (C → X no ar): desce suavemente da altura em que estava, sem teletransporte.
        if (action.slam && !action.slamPrepDone) {
          // Jogado para cima: sobe desacelerando (sem pulo), sem andar, até o ponto mais alto; aí mira o rival e despenca.
          action.slamT += dt;const u = Math.min(1, action.slamT / R.slamPrepTime);
          f.vaultHeight = action.slamBase + R.slamHop * (1 - (1 - u) * (1 - u));
          if (u >= 1) {action.slamPrepDone = true;aimSlamDive(f, fighters);}
        } else if (action.slam) f.vaultHeight = Math.max(0, f.vaultHeight - (R.slamFallTime > 1e-6 ? (action.slamH0 ?? 0) / R.slamFallTime * dt : Infinity));   // despenca a altura inteira em slamFallTime
        if (action.slam && action.slamPrepDone && f.vaultHeight <= 1e-9 && (action.slamH0 ?? 0) > 1e-6) action.slamLanded = true;
        if (!action.slam) f.vaultHeight = action.liftStart > 0 ? (action.liftTime > 0 ? action.liftStart * (1 - smoothstep((action.elapsed + dt) / action.liftTime)) : 0) : 0;
      }
      f.state = action.slam ? (!action.slamPrepDone ? 'meteorPrep' : action.slamLanded ? 'meteorGround' : 'meteorDive') : action.kind;
    } else {
      f.vaultHeight = 0;
      const distance = nominalDistance(f) * R.recoilFraction;
      const step = smoothstep((action.elapsed + dt) / R.recoil) - smoothstep(action.elapsed / R.recoil);
      f.velocity = scale(direction(action.heading), distance * step / dt);f.state = 'recoil';
    }
  } else {
    const walk = walkSpeed(f), vMax = f.sprinting ? f.attributes.speed * S.speedMultiplier : walk, before = f.locomotionVelocity;
    if (f.sandPush && !(f.stun > 1e-8 || hasFlag(f, 'stunned'))) {   // empurrado pela areia: sem controle de deslocamento; a velocidade ganha se mantém depois (atrito normal)
      f.locomotionVelocity = add(f.locomotionVelocity, scale(f.sandPush.dir, f.sandPush.accel * dt));f.desiredVelocity = vec();f.locoPhase = 'sandPush';
    } else if (f.stun > 1e-8 || hasFlag(f, 'stunned')) {f.locomotionVelocity = vec();f.locoPhase = 'stun';f.desiredVelocity = vec();}
    else if (hasFlag(f, 'rooted')) {const r = locomotionStep(f.locomotionVelocity, vec(), walk, locomotionParams(f), dt);f.locomotionVelocity = r.velocity;f.desiredVelocity = vec();f.locoPhase = 'rooted';}
    else if (L.model !== 1) {f.locomotionVelocity = approachVelocity(f.locomotionVelocity, scale(move, walk), dt);f.desiredVelocity = scale(move, walk);f.locoPhase = length(move) ? 'legacy' : 'idle';}
    else {
      const r = locomotionStep(f.locomotionVelocity, slideAlong(move, f.surfaceNormals), vMax, locomotionParams(f), dt);   // contato com sólido redondo: a entrada que empurra para dentro é descartada (deslize)
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
  // Meteor slam: C → X a partir do salto do vault (acima da altura mínima) vira mergulho oblíquo com bônus de dano.
  if (viaCancel && kind === 'tackle' && T.enableMeteorSlam && liftStart > C.rules.slamMinHeight) {f.action.slam = true;f.action.fromSlam = true;f.action.plDamage = C.rules.slamDamage;f.action.pl = 2;aimSlam(f, fighters, liftStart);}
  if (viaCancel) f.action.fromCancel = true;
  if (countered) f.counterWindow = 0;
  // O custo de C já gasto continua gasto; X cobra o próprio custo. Technician desconta só esquiva ('dodge').
  f.stamina = Math.max(0, f.stamina - costOf(f, p.cost, kind));f.regenBase = f.stamina;f.regenAge = 0;
  f.exhausted = isDepleted(f.stamina);f.guard = false;f.guardSuppressed = guardHeld;
  f.stun = 0;f.push = null;f.blend = null;f.vaultHeight = liftStart;f.bufferedTackle = null;f.inputBuffer = null;
  f.sprinting = false;f.sprintCarry = false;f.sprintArmed = kind === 'dodge';f.plDefeated = false;
}

/** Avança o relógio da ação e a encerra ao fim da duração própria. */
export function advanceAction(f, dt) {
  if (!f.action) return;
  f.action.elapsed += dt;
  const kind = f.action.kind, spec = actionSpec(f.action), duration = spec.duration;
  // O pulo físico termina ao tocar o chão (a duração da esquiva não o corta no ar).
  const done = f.action.jump ? f.action.jump.landed : (f.action.elapsed >= duration - 1e-8 && !f.action.slam) || (f.action.slamLanded && (f.action.slamHold = (f.action.slamHold ?? 0) + dt) > C.rules.slamGroundTime + (f.action.hits.size === 0 ? C.rules.slamRecovery : 0));   // estado meteorGround: o mergulho segue no chão por slamGroundTime (+ slamRecovery se errou)
  if (done) {
    const wasExhausted = f.exhausted && (kind === 'dodge' || kind === 'tackle'), wasSlam = !!f.action.slam;
    f.action = null;f.velocity = vec();f.vaultHeight = 0;f.state = f.hp <= 0 ? 'defeated' : 'neutral';
    if (wasExhausted && f.hp > 0) f.knockRecovery = Math.max(f.knockRecovery, C.extras.combat.exhaustRecovery);
    const recovery = spec.recovery;
    if (recovery > 0 && f.hp > 0 && !wasSlam) f.knockRecovery = Math.max(f.knockRecovery, recovery);   // o meteor slam já passou pelo estado meteorGround: sem recuperação extra de 'aterrissar'
    // A animação segura a pose final da ação durante essa recuperação (não troca para “levantar”).
    f.recoveryFrom = f.knockRecovery > 0 && kind !== 'recoil' && kind !== 'move' ? kind : null;
    if (wasSlam && f.jumpState) {
      f.jumpState.canJump = true;
      f.jumpState.cooldown = C.map?.jumpInterval ?? 0.25;
    }
  }
}

// ---------- Movimentos especiais ----------
/**
 * O movimento do slot pode começar agora? Mesmas regras gerais de X e C: lutador livre ou ação em curso já
 * encadeável (ou listada em cancelFrom), defesa e guard stun conforme a definição, recarga, status e stamina.
 */
/** Lutadores da partida em curso (definido a cada updateFighter): permite que movePermission/HUD/IA avaliem Moves com aquisição de alvo. */
let CTX_FIGHTERS = [];
/** Mundo da partida em curso (definido a cada updateFighter): o apoio real sob o corpo para os Moves que descem do ar (air.js). */
let CTX_WORLD = null;
/** @param {any} f @param {any} def @param {number | null} [slot] */
export function movePermission(f, def, slot = null, opts = null) {
  if (!def) return {ok: false, reason: 'noMove', detail: {slot}};
  if (hasFlag(f, 'stunned')) return {ok: false, reason: 'stunned'};
  if (hasFlag(f, 'silenced')) return {ok: false, reason: 'silenced'};
  if (f.ledge) return {ok: false, reason: 'ledge'};
  if (f.moveRecovery > 1e-8) return {ok: false, reason: 'moveRecovery', detail: {left: f.moveRecovery}};
  const cd = f.moveCooldowns?.[def.id] ?? 0;if (cd > 1e-8) return {ok: false, reason: 'cooldown', detail: {left: cd}};
  if (f.guard && def.fromGuard === false) return {ok: false, reason: 'guardBlocks'};
  const cur = f.action, airOk = airUsable(f, def);   // ar utilizável (air.js): salto, queda de borda ou arco do vault
  if (f.flight && !airOk) return {ok: false, reason: 'noGround'};   // lançado, preso na parede ou Move sem uso no ar
  if (cur && !(def.cancelFrom || []).includes(cur.kind) && !(def.fromDodge && cur.kind === 'dodge') && !(airOk && isVaultArc(f))) {
    if (cur.kind === 'recoil') return {ok: false, reason: 'recoil', detail: {left: Math.max(0, C.rules.recoil - cur.elapsed)}};
    if (!chainOpen(f)) return {ok: false, reason: 'chain', detail: {left: Math.max(0, actionSpec(cur).chainAfter - cur.elapsed)}};
  }
  if (f.stun > 1e-8 && !def.fromGuardStun) return {ok: false, reason: 'guardStun', detail: {left: f.stun}};
  if (def.groundOnly && !airOk && (f.flight || (f.vaultHeight ?? 0) > 1e-8)) return {ok: false, reason: 'noGround'};
  if (def.needsTarget && !opts?.skipTarget) {const range = C.world[def.group]?.[def.needsTarget] ?? 0;if (!nearestEligible(f, CTX_FIGHTERS, range)) return {ok: false, reason: 'noTarget', detail: {range}};}
  const cost = costOf(f, def.cost ?? 1);
  if (f.exhausted && cost > 0) return {ok: false, reason: 'exhausted', detail: {value: f.stamina, refill: getFighterMaxStamina(f)}};
  if (f.stamina < cost - 1e-8) return {ok: false, reason: 'stamina', detail: {value: f.stamina, required: cost}};
  return {ok: true};
}
/**
 * Feint (slot): cancela a antecipação de um Tackle / Move-Tackle (Lunge, Guard Break já solto, Quick Attack) ou a carga em curso (Guard Break, Tackle carregado, qualquer Charge) e
 * vira um recuo curto com i-frames; sem ação ofensiva é só o recuo. Fora da janela de cancelamento o Move é GASTO sem efeito e a ação anterior continua (punível, MV-P21).
 * Custo e recarga na confirmação (Burst); o custo da ação cancelada NÃO volta (MV-P26).
 */
function pressFeint(f, cmd, def, slot, move, desiredHeading, hasTarget, diag) {
  const deny = (reason, detail) => {if (diag) report(f, {kind: 'skill', slot, move: def.id, result: 'denied', reason, detail});};
  const perm = movePermission(f, def, slot);
  if (!perm.ok) return deny(perm.reason, perm.detail);
  const P = C.world[def.group], cur = f.action;
  let cancelled = null, whiff = false;
  if (f.charge) {cancelCharge(f, 'feint');cancelled = 'charge';}
  else if (f.tackleCharge) {cancelTackleCharge(f, 'feint');cancelled = 'tackleCharge';}
  else if (cur?.kind === 'tackle') {
    if (!cur.slam && (cur.hits?.size ?? 0) === 0 && cur.elapsed < P.cancelWindow - 1e-9) {f.action = null;f.velocity = vec();cancelled = cur.move ?? 'tackle';}
    else whiff = true;
  }
  if (whiff) {   // gasto sem efeito: a animação do Feint acontece e a ação anterior segue
    const cost = costOf(f, def.cost ?? 1);f.stamina = Math.max(0, f.stamina - cost);f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = isDepleted(f.stamina);
    if (def.cooldown > 0) (f.moveCooldowns ??= {})[def.id] = def.cooldown;
    moveEvent(f, {result: 'feintWhiff', move: def.id, slot, interrupted: cur.move ?? 'tackle'});
  } else {
    startMove(f, def, slot, {move, dodgeDirection: cmd.dodgeDirection}, desiredHeading, hasTarget, cmd.guard);
    const dir = feintDirection(cmd, f.facing);
    f.action.heading = dir ? angleOf(dir) : f.facing + Math.PI;f.action.startAngle = f.action.heading;   // para o lado do input, ou para trás
    moveEvent(f, {result: 'feint', move: def.id, slot, cancelled});
  }
  if (diag) report(f, {kind: 'skill', slot, move: def.id, result: 'executed', note: whiff ? 'fora da janela: gasto sem efeito' : cancelled ? `cancelou ${cancelled}` : 'recuo'});
}
/** Inicia o movimento: cobra a stamina, inicia a recarga e agenda a linha do tempo (disparada em updateMove). */
function startMove(f, def, slot, dirs, desiredHeading, hasTarget, guardHeld) {
  const lift = airKind(def) === 'descend' ? takeOffToLift(f, CTX_WORLD) : 0, inAir = airKind(def) === 'cast' && isAirJump(f);
  const aim = def.aim ?? 'target', inputDir = dirs.dodgeDirection ?? dirs.move;
  const heading = aim === 'facing' ? f.facing : aim === 'input' && length(inputDir) > .01 ? angleOf(inputDir) : hasTarget || length(inputDir) <= .01 ? desiredHeading : angleOf(inputDir);
  // M28.4: a execução guarda a definição EFETIVA (com os sliders do momento) e os parâmetros do grupo; mexer em slider depois não a altera.
  f.action = {kind: 'move', move: def.id, slot, elapsed: 0, startAngle: heading, heading, offensive: false, hits: new Set(), fired: [], from: {...f.velocity}, def, params: def.group ? structuredClone(C.world[def.group]) : null, lock: dirs.lock ?? null};
  const cost = costOf(f, def.cost ?? 1);f.stamina = Math.max(0, f.stamina - cost);f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = isDepleted(f.stamina);
  if (def.cooldown > 0) (f.moveCooldowns ??= {})[def.id] = def.cooldown;
  f.guard = false;f.guardSuppressed = guardHeld;f.push = null;f.blend = null;f.vaultHeight = 0;f.bufferedTackle = null;f.inputBuffer = null;f.sprinting = false;f.sprintCarry = false;
  if (lift > 1e-8) applyLift(f, lift);else if (inAir) f.action.air = true;   // air.js: 'descend' desce enquanto age; 'cast' segue em voo
}
/**
 * Move que vira uma AÇÃO DE TACKLE com parâmetros próprios (Lunge, Quick Attack, Bullet Punch…): `startAction` cria a ação (colisão real, defesa, defesa
 * perfeita, i-frames, Clash/Counter, janelas, recuperação — tudo do Tackle); aqui se desfaz o custo do Tackle, cobra-se o do Move (stamina e cooldown no
 * início do uso, MV-P11) e a preparação registrada em `def.tackle` ajusta duração, distância, dano, knockback e janelas (parâmetros capturados, M28.4).
 */
function startTackleMove(f, def, slot, dirs, desiredHeading, hasTarget, guardHeld, fighters) {
  const before = f.stamina, lift = takeOffToLift(f, CTX_WORLD);   // no ar o Tackle curto começa descendo (air.js), como o C → X do vault
  startAction(f, 'tackle', dirs, fighters, desiredHeading, false, guardHeld, hasTarget);
  applyLift(f, lift);
  f.stamina = before;
  const cost = costOf(f, def.cost ?? 1);f.stamina = Math.max(0, f.stamina - cost);f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = isDepleted(f.stamina);
  if (def.cooldown > 0) (f.moveCooldowns ??= {})[def.id] = def.cooldown;
  const a = f.action, P = def.group ? structuredClone(C.world[def.group]) : {};
  a.move = def.id;a.slot = slot;a.params = P;a.moveDef = def;a.pl = 1;a.plSpeed = 1;a.plDamage = 1;
  getTackleSetup(def.tackle)?.(f, a, P, {fighters, def, hasTarget});
}
/** Soltura de um Charge que vira Tackle (`def.tackle` + `charge`): ação de Tackle com PL da carga; o custo do Tackle volta (o do Move foi cobrado ao apertar). */
function releaseTackleMove(f, def, ch, rel, cmd, ctx) {
  const before = f.stamina, lift = takeOffToLift(f, CTX_WORLD);
  startAction(f, 'tackle', {move: ctx.move, dodgeDirection: null}, ctx.fighters, ctx.desiredHeading, false, cmd.guard, ctx.hasTarget);
  applyLift(f, lift);
  f.stamina = before;
  const a = f.action, P = ch.params.group ?? {};
  a.move = def.id;a.slot = ch.slot;a.params = P;a.moveDef = def;a.pl = rel.level;a.plSpeed = 1;a.plDamage = 1;
  getTackleSetup(def.tackle)?.(f, a, P, {fighters: ctx.fighters, def, hasTarget: ctx.hasTarget, charge: rel});
}
/**
 * Contra-golpe do Riposte: troca a postura por um Tackle PL1 rumo a quem atacou, com os parâmetros capturados no uso; o custo do Tackle volta (o do Move foi
 * cobrado ao apertar) e o resto da janela vira invulnerabilidade do golpe. A ação dura até o fim do cast original (0,65 s).
 */
function startRiposteStrike(f, action) {
  const def = action.def, P = action.params, t = action.elapsed, p = C.actions.tackle;
  const foe = CTX_FIGHTERS.find(o => o.id === action.riposte.target && o.hp > 0), heading = foe ? angleOf(sub(foe.position, f.position)) : f.facing;
  const before = f.stamina, lift = takeOffToLift(f, CTX_WORLD);   // contra-golpe no ar: desce enquanto ataca (air.js)
  startAction(f, 'tackle', {move: vec(), dodgeDirection: null}, CTX_FIGHTERS, heading, false, false, false);
  applyLift(f, lift);
  f.stamina = before;
  const a = f.action;
  a.heading = a.startAngle = heading;a.fixedHeading = true;
  a.move = def.id;a.slot = action.slot;a.params = P;a.moveDef = def;a.pl = 4;a.plSpeed = 1;a.plDamage = P.damage / C.test.attackReference;   // MV-P13; contra-ataque: tratado como PL 4 (vence qualquer PL, nunca faz clash)
  a.kb = {horizontal: P.knockbackH, vertical: P.knockbackV};
  a.durationScale = Math.max(.1, P.cast - t) / p.duration;
  a.distanceScale = P.strikeRange / Math.max(1e-6, nominalDistance(f, 'tackle'));
  a.invulnerableFor = Math.max(0, P.windowEnd - t);
  a.chainAfter = Math.max(.1, P.cast - t);
  a.riposteStrike = true;
  moveEvent(f, {result: 'riposteStrike', move: def.id, slot: action.slot, target: action.riposte.target});
}
// ---------- Mira por marcador (aimMode 'marker') ----------
/** Abre o marcador: nada é cobrado até a confirmação; os parâmetros do grupo são capturados agora (M28.4). */
function startAim(f, def, slot, fighters, world, lockId) {
  const P = structuredClone(C.world[def.group]), locked = lockId != null ? fighters.find(o => o.id === lockId && o.hp > 0) : null;
  const pos = markerInitial(f, P, locked), v = markerValidity(f, P, pos, world, fighters);
  f.aim = {move: def.id, slot, ticks: 0, params: P, def, pos, valid: v.valid, reason: v.reason, y: v.y, distance: v.distance};
  if (def.castFirst) {   // cronologia C: o cast físico começa JÁ; o corpo continua livre (a 30% durante o cast)
    Object.assign(f.aim, {castFirst: true, free: true, castLeft: P.cast, hadSupport: !f.flight, released: false});
    f.guard = false;f.guardSuppressed = false;f.sprinting = false;f.sprintCarry = false;
    moveEvent(f, {result: 'aimStart', move: def.id, slot});
    return;
  }
  f.guard = false;f.guardSuppressed = false;f.sprinting = false;f.sprintCarry = false;f.velocity = vec();f.locomotionVelocity = vec();
  moveEvent(f, {result: 'aimStart', move: def.id, slot});
}
/**
 * Mira de ALCANCE (Moves de alvo único: Quick Attack, Bullet Punch): segurar o botão só mostra o círculo de alcance ao redor do lutador (azul com alvo dentro, vermelho sem alvo);
 * o corpo segue livre. Soltar executa na hora se houver alvo no alcance; senão não gasta nada e o círculo vermelho pisca (`f.rangeFlash`). Nada é cobrado ao abrir.
 */
function startRangeAim(f, def, slot) {
  const P = structuredClone(C.world[def.group]), range = P[def.needsTarget] ?? 0;
  f.aim = {move: def.id, slot, ticks: 0, params: P, def, range: true, free: true, rangeValue: range, inRange: !!nearestEligible(f, CTX_FIGHTERS, range), pos: {x: f.position.x, z: f.position.z}, y: f.groundY ?? 0, valid: true, reason: null, distance: 0};
  f.guard = false;f.guardSuppressed = false;
  moveEvent(f, {result: 'aimStart', move: def.id, slot, range: true});
}
/** Fecha o marcador sem executar nem cobrar. */
export function cancelAim(f, why) {
  const a = f.aim;if (!a) return;
  f.aim = null;moveEvent(f, {result: 'aimCancel', move: a.move, slot: a.slot, reason: why});
  if (attemptsActive()) report(f, {kind: 'skill', slot: a.slot, move: a.move, result: 'denied', reason: 'aimEnded', detail: {why}});
}
/** Um passo do marcador: move, revalida e, ao SOLTAR o botão, confirma (válido: cobra e começa o cast) ou cancela (inválido: sem custo). */
function stepAim(f, cmd, inputMove, ctx) {
  const a = f.aim, def = a.def ?? getMove(a.move);   // a definição EFETIVA do momento em que o marcador abriu (M28.4)
  if (!def) {f.aim = null;return;}
  if (a.range) {   // mira de alcance: acompanha o alvo mais próximo e executa ao soltar
    a.rangeValue = a.params[def.needsTarget] ?? 0;
    const tgt = nearestEligible(f, ctx.fighters, a.rangeValue);a.inRange = !!tgt;
    if (a.ticks > 0 && !cmd.skillHeld?.[a.slot]) {
      f.aim = null;
      const perm = movePermission(f, def, a.slot);
      if (!perm.ok) {
        moveEvent(f, {result: 'aimCancel', move: def.id, slot: a.slot, reason: perm.reason, detail: perm.detail});
        if (perm.reason === 'noTarget') f.rangeFlash = {t: C.display?.rangeRing?.flashTime ?? .7, total: C.display?.rangeRing?.flashTime ?? .7, range: a.rangeValue};   // o círculo vermelho pisca: o alvo está fora do alcance
        if (ctx.diag) report(f, {kind: 'skill', slot: a.slot, move: def.id, result: 'denied', reason: perm.reason, detail: perm.detail});
        return;
      }
      const heading = angleOf(sub(tgt.position, f.position));
      if (def.tackle && !def.moveCast) startTackleMove(f, def, a.slot, {move: inputMove, dodgeDirection: cmd.dodgeDirection}, heading, true, cmd.guard, ctx.fighters);
      else startMove(f, def, a.slot, {move: inputMove, dodgeDirection: cmd.dodgeDirection, lock: tgt.id}, heading, true, cmd.guard);
      if (ctx.diag) report(f, {kind: 'skill', slot: a.slot, move: def.id, result: 'executed', note: 'soltou com alvo no alcance'});
      return;
    }
    a.ticks++;return;
  }
  if (a.castFirst) {   // Emerging Stone (ES-D103 C): dispara quando o cast terminou E o botão foi solto com destino válido
    a.castLeft = Math.max(0, a.castLeft - ctx.dt);
    const grounded = !f.flight && !((f.vaultHeight ?? 0) > 1e-8);
    if (grounded) a.hadSupport = true;
    else if (a.hadSupport || a.castLeft <= 1e-9) {cancelAim(f, 'support');return;}   // perder o apoio no cast, ou não estar apoiado ao concluí-lo, cancela
    a.pos = markerStep(a, inputMove, a.params.markerSpeed, a.params.markerAccel ?? 0, ctx.dt);   // fora do alcance: fica onde está, inválido, sem teleporte para o limite
    const v = markerValidity(f, a.params, a.pos, ctx.world, ctx.fighters);
    a.valid = v.valid;a.reason = v.reason;a.y = v.y;a.distance = v.distance;
    if (a.ticks > 0 && !cmd.skillHeld?.[a.slot]) a.released = true;
    if (a.released) {
      if (!a.valid) {cancelAim(f, 'invalidMarker');return;}
      if (a.castLeft <= 1e-9) {
        const perm = movePermission(f, def, a.slot);
        f.aim = null;
        if (!perm.ok) {moveEvent(f, {result: 'aimCancel', move: def.id, slot: a.slot, reason: perm.reason, detail: perm.detail});return;}
        const cost = costOf(f, def.cost ?? 1);f.stamina = Math.max(0, f.stamina - cost);f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = isDepleted(f.stamina);   // cobrança só aqui (soltura confirmada)
        if (def.cooldown > 0) (f.moveCooldowns ??= {})[def.id] = def.cooldown;
        (f.moveFx ??= []).push({index: 0, move: def.id, heading: f.facing, params: a.params, def, lock: null, marker: {pos: {...a.pos}, y: a.y}});
        moveEvent(f, {result: 'aimConfirm', move: def.id, slot: a.slot, x: a.pos.x, z: a.pos.z});
        if (ctx.diag) report(f, {kind: 'skill', slot: a.slot, move: def.id, result: 'executed', note: 'disparo (cast concluído e botão solto)'});
      }
    }
    a.ticks++;
    return;
  }
  a.pos = markerStep(a, inputMove, a.params.markerSpeed, a.params.markerAccel ?? 0, ctx.dt);
  const v = markerValidity(f, a.params, a.pos, ctx.world, ctx.fighters);
  a.valid = v.valid;a.reason = v.reason;a.y = v.y;a.distance = v.distance;
  if (a.ticks > 0 && !cmd.skillHeld?.[a.slot]) {
    f.aim = null;
    const perm = a.valid ? movePermission(f, def, a.slot) : {ok: false, reason: 'invalidMarker', detail: {why: a.reason}};
    if (!perm.ok) {
      moveEvent(f, {result: 'aimCancel', move: def.id, slot: a.slot, reason: perm.reason, detail: perm.detail});
      if (ctx.diag) report(f, {kind: 'skill', slot: a.slot, move: def.id, result: 'denied', reason: perm.reason, detail: perm.detail});
      return;
    }
    const heading = angleOf(sub(a.pos, f.position));
    startMove(f, def, a.slot, {move: vec(), lock: null}, heading, false, cmd.guard);
    f.action.params = a.params;
    f.action.heading = f.action.startAngle = heading;f.action.marker = {pos: {...a.pos}, y: a.y};   // destino FIXO em coordenadas do mundo
    moveEvent(f, {result: 'aimConfirm', move: def.id, slot: a.slot, x: a.pos.x, z: a.pos.z});
    if (ctx.diag) report(f, {kind: 'skill', slot: a.slot, move: def.id, result: 'executed', note: 'marcador confirmado'});
    return;
  }
  a.ticks++;
}
/**
 * Move que dispara uma investida de Tackle por conta própria (Bullet Punch ao reaparecer): ação de Tackle real rumo a `heading`, custo do Tackle devolvido,
 * parâmetros do grupo e preparação registrada em `def.tackle`.
 */
export function startTackleAt(f, def, params, heading, fighters) {
  const before = f.stamina;
  startAction(f, 'tackle', {move: vec(), dodgeDirection: null}, fighters, heading, false, false, false);
  f.stamina = before;
  const a = f.action;
  a.heading = a.startAngle = heading;a.move = def.id;a.params = params;a.moveDef = def;a.pl = 1;a.plSpeed = 1;a.plDamage = 1;
  getTackleSetup(def.tackle)?.(f, a, params, {fighters, def});
  return a;
}
/** Um passo do movimento em curso: deslocamento (motion), orientação e efeitos da linha do tempo que vencem neste passo. */
function updateMove(f, action, target, cmd, dt) {
  const def = action.def ?? getMove(action.move);if (!def) {f.velocity = vec();return;}
  if (def.riposte && action.riposte) {startRiposteStrike(f, action);return;}   // acerto elegível na janela: vira o contra-golpe
  const m = def.motion ?? {type: 'none'};
  if (m.type === 'dash' && m.distance) {
    // Deslocamento suave entre start e end (s): mesma distância qualquer que seja o passo.
    const t0 = m.start ?? 0, t1 = m.end ?? def.duration, prog = t => smoothstep(clamp((t - t0) / Math.max(1e-6, t1 - t0), 0, 1));
    const dist = (m.distanceKey ? action.params?.[m.distanceKey] : undefined) ?? m.distance;   // distanceKey: o alcance vem de um slider do grupo (Feint)
    f.velocity = scale(direction(action.heading), dist * (prog(action.elapsed + dt) - prog(action.elapsed)) / dt);
  } else if (m.type === 'walk') {   // anda com o input a (1 − slow) da velocidade normal (Bullet Punch: preparação a 30%); ausente não se move
    const inp = length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move;
    f.velocity = f.absent ? vec() : scale(inp, walkSpeed(f) * (1 - (action.params?.slow ?? .7)));f.locomotionVelocity = {...f.velocity};
    if (action.travel) {   // ausente: viaja invisível até o alvo (a câmera segue a posição); quem estiver no caminho barra a corrida e leva o golpe
      const hit = bulletPunchTravel(f, action, dt, CTX_FIGHTERS);
      if (hit) {
        const idx = (def.timeline || []).findIndex(ev => ev.effect === 'bullet-punch-return');
        if (idx >= 0 && !action.fired.includes(idx)) {action.fired.push(idx);(f.moveFx ??= []).push({index: idx, move: def.id, heading: action.heading, params: action.params ?? null, def, lock: action.lock ?? null, marker: null, arrive: {hitId: hit.id}});}
        action.travel = null;
      }
    }
  } else if (m.type === 'root') f.velocity = vec();
  else {const from = action.from ?? vec(), k = Math.exp(-12 * dt);f.velocity = scale(from, k);action.from = {...f.velocity};}
  if (action.liftStart > 0) f.vaultHeight = action.liftTime > 0 ? action.liftStart * (1 - smoothstep((action.elapsed + dt) / action.liftTime)) : 0;   // desceu do ar (air.js): sem teletransporte ao chão
  if (!def.keepFacing) turnToward(f, target && def.aim !== 'facing' ? angleOf(sub(target.position, f.position)) : action.heading, dt);   // keepFacing: recuo sem virar o corpo (Feint)
  (def.timeline || []).forEach((ev, i) => {if (!action.fired.includes(i) && ev.at <= action.elapsed + dt + 1e-9) {action.fired.push(i);(f.moveFx ??= []).push({index: i, move: def.id, heading: action.heading, params: action.params ?? null, def, lock: action.lock ?? null, marker: action.marker ?? null});}});
  f.state = 'move';
}
// ---------- Movimentos de carga (Charge): segurar o botão carrega, soltar executa ----------
// O Charge NÃO é uma ação (f.action): o lutador continua andando (−25% de velocidade e de giro, M2.6/M11.7) e o estado fica em
// f.charge = {move, slot, ticks, params, cost}. 'params' é o instantâneo congelado do uso (M28.4, D1). Ordem das entradas no
// mesmo passo (M30.9): defesa → X/C → soltar o Move. Regras: M7.1–M7.9, M13.7, M15.1–M15.4, M16.1–M16.8, M17.8, M26s.8, M27.1, M27.4.
/** Fim do deslocamento principal da esquiva (a partir daqui um Move pode começar, M15.5): depois da desaceleração, antes da recuperação final. */
const dodgeMainEnd = () => C.actions.dodge.duration * (1 - C.actions.dodge.recoveryTime);
/**
 * O movimento de carga do slot pode começar agora? Mesmos motivos de movePermission, mais apoio no chão, esquiva e recuperação.
 * @param {any} f @param {any} def @param {number | null} [slot]
 */
export function chargePermission(f, def, slot = null) {
  if (!def) return {ok: false, reason: 'noMove', detail: {slot}};
  if (hasFlag(f, 'stunned')) return {ok: false, reason: 'stunned'};
  if (hasFlag(f, 'silenced')) return {ok: false, reason: 'silenced'};
  if (f.charge) return {ok: false, reason: 'charging'};
  if (f.ledge) return {ok: false, reason: 'ledge'};
  const cd = f.moveCooldowns?.[def.id] ?? 0;if (cd > 1e-8) return {ok: false, reason: 'cooldown', detail: {left: cd}};
  const airOk = airUsable(f, def);   // carregar no salto, na queda de borda ou no arco do vault (air.js)
  if (f.knockRecovery > 0 || ((f.flight || f.vaultHeight > 1e-8) && !airOk)) return {ok: false, reason: 'noGround'};
  if (f.moveRecovery > 1e-8) return {ok: false, reason: 'moveRecovery', detail: {left: f.moveRecovery}};
  if (f.guard && def.fromGuard === false) return {ok: false, reason: 'guardBlocks'};
  const cur = f.action;
  if (cur?.kind === 'dodge') {
    const left = dodgeMainEnd() - cur.elapsed;
    if (left > 1e-8 && !(airOk && isVaultArc(f))) return {ok: false, reason: 'chain', detail: {left}, buffer: left <= C.world.charge.bufferWindow + 1e-8};
  } else if (cur?.kind === 'tackle') return {ok: false, reason: 'chain', detail: {left: Math.max(0, C.actions.tackle.duration - cur.elapsed)}};
  else if (cur?.kind === 'recoil') return {ok: false, reason: 'recoil', detail: {left: Math.max(0, C.rules.recoil - cur.elapsed)}};
  else if (cur && !chainOpen(f)) return {ok: false, reason: 'chain', detail: {left: Math.max(0, actionSpec(cur).chainAfter - cur.elapsed)}};
  if (f.stun > 1e-8 && !def.fromGuardStun) return {ok: false, reason: 'guardStun', detail: {left: f.stun}};
  const cost = costOf(f, def.cost ?? 1);
  if (f.exhausted && cost > 0) return {ok: false, reason: 'exhausted', detail: {value: f.stamina, refill: getFighterMaxStamina(f)}};
  if (f.stamina < cost - 1e-8) return {ok: false, reason: 'stamina', detail: {value: f.stamina, required: cost}};
  return {ok: true};
}
const moveEvent = (f, e) => (f.moveEvents ??= []).push({attacker: f.id, target: null, damage: 0, ...e});
/** Começa a carga: cobra a stamina (M7.1, sem devolução em interrupção) e captura os parâmetros do uso. */
function startCharge(f, def, slot, guardHeld, fromBuffer = false) {
  const params = chargeParams(def), cost = costOf(f, def.cost ?? 1);
  f.stamina = Math.max(0, f.stamina - cost);f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = isDepleted(f.stamina);
  if (f.action?.kind === 'dodge') {f.locomotionVelocity = {...f.velocity};f.action = null;}
  f.charge = {move: def.id, slot, ticks: 0, params, cost, fromBuffer};
  if ((def.tackle || def.cooldownOnStart) && def.cooldown > 0) (f.moveCooldowns ??= {})[def.id] = def.cooldown;   // Charge que vira Tackle: custo e recarga no INÍCIO da carga (interromper mantém os dois)
  f.guard = false;f.guardSuppressed = guardHeld;f.push = null;f.blend = null;f.vaultHeight = 0;f.bufferedTackle = null;f.inputBuffer = null;f.skillBuffer = null;f.sprinting = false;f.sprintCarry = false;
  moveEvent(f, {result: 'chargeStart', move: def.id, slot});
}
/** Encerra a carga sem executar (defesa, esquiva, golpe, perda de apoio): custo mantido e metade da recarga (M7.3/M16.1); idempotente (M25.4). */
export function cancelCharge(f, why) {
  const ch = f.charge;if (!ch) return;
  f.charge = null;const def = getMove(ch.move);
  if (def && why !== 'defeated' && def.cooldown > 0) (f.moveCooldowns ??= {})[def.id] = Math.max(f.moveCooldowns?.[def.id] ?? 0, interruptCooldown(def, ch.params));
  const isInterrupt = why === 'hit' || why === 'minCharge' || why === 'interrupted';
  moveEvent(f, {result: isInterrupt ? 'chargeInterrupt' : 'chargeCancel', move: ch.move, slot: ch.slot, reason: why, seconds: ch.ticks * ch.params.step});
  if (attemptsActive()) report(f, {kind: 'skill', slot: ch.slot, move: ch.move, result: 'denied', reason: 'chargeEnded', detail: {why}});
}
/** Aceleração manual da recarga: novo toque (M7.9) gasta stamina para encurtá-la; permitida durante outro Charge (M17.8). */
function boostCooldown(f, def, slot, diag) {
  const left = f.moveCooldowns?.[def.id] ?? 0, plan = boostPlan(left, chargeParams(def)), cost = costOf(f, plan.cost);
  const deny = why => {if (diag) report(f, {kind: 'skill', slot, move: def.id, result: 'denied', ...why});};
  if (f.exhausted && cost > 0) return deny({reason: 'exhausted', detail: {value: f.stamina, refill: getFighterMaxStamina(f)}});
  if (f.stamina < cost - 1e-8) return deny({reason: 'stamina', detail: {value: f.stamina, required: cost}});
  f.stamina = Math.max(0, f.stamina - cost);f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = isDepleted(f.stamina);
  const rest = left - plan.reduce;if (rest <= 1e-8) delete f.moveCooldowns[def.id];else f.moveCooldowns[def.id] = rest;
  moveEvent(f, {result: 'cooldownBoost', move: def.id, slot, reduced: plan.reduce, cost});
  if (diag) report(f, {kind: 'skill', slot, move: def.id, result: 'executed', note: `recarga encurtada em ${plan.reduce.toFixed(2)} s (−${cost.toFixed(2)} de stamina)`});
}
/** Toque num slot (borda do botão): inicia o movimento, encurta a recarga, guarda no buffer ou nega com motivo. */
function pressSkill(f, cmd, move, desiredHeading, hasTarget, diag, fighters = [], world = null) {
  const slot = cmd.skill, def = moveInSlot(f, slot), onCooldown = !!def && (f.moveCooldowns?.[def.id] ?? 0) > 1e-8;
  const deny = (reason, detail) => {if (diag) report(f, {kind: 'skill', slot, move: def?.id ?? null, result: 'denied', reason, detail});};
  f.skillBuffer = null;
  if (def && def.cooldownBoost !== false && onCooldown) return boostCooldown(f, def, slot, diag);   // M5.8/M5.9: vale para TODO Move (novo toque + stamina); `cooldownBoost: false` desliga num Move específico
  if (def && isVaultArc(f) && airKind(def) !== 'none' && (airKind(def) === 'cast' || def.charge || def.aimMode) && (def.charge ? chargePermission(f, def, slot) : movePermission(f, def, slot)).ok) vaultToFlight(f);   // arco do vault: vira voo normal e o Move segue o caminho do salto (air.js)
  if (def?.feint) return pressFeint(f, cmd, def, slot, move, desiredHeading, hasTarget, diag);   // cancela a carga/ação ofensiva em curso (ou só recua)
  if (f.aim) return deny('aiming');                                       // um marcador de cada vez
  if (f.charge) return deny('charging');                                  // sem carregamentos simultâneos (M16.4)
  if (def?.charge) {
    const perm = chargePermission(f, def, slot);
    if (perm.ok) {startCharge(f, def, slot, cmd.guard);if (diag) report(f, {kind: 'skill', slot, move: def.id, result: 'executed', note: 'carga iniciada'});}
    else if (perm.buffer) {f.skillBuffer = {slot, ticks: 0, max: chargeParams(def).bufferTicks};if (diag) report(f, {kind: 'skill', slot, move: def.id, result: 'buffered', reason: perm.reason, detail: perm.detail});}
    else deny(perm.reason, perm.detail);
    return;
  }
  if (def?.needsTarget && movePermission(f, def, slot, {skipTarget: true}).ok) {startRangeAim(f, def, slot);if (diag) report(f, {kind: 'skill', slot, move: def.id, result: 'executed', note: 'círculo de alcance aberto (soltar executa)'});return;}
  const perm = movePermission(f, def, slot);
  if (perm.ok && def.aimMode) {startAim(f, def, slot, fighters, world, hasTarget ? cmd.target : null);if (diag) report(f, {kind: 'skill', slot, move: def.id, result: 'executed', note: 'marcador aberto'});return;}
  if (perm.ok && def.tackle && !def.moveCast) startTackleMove(f, def, slot, {move, dodgeDirection: cmd.dodgeDirection}, desiredHeading, hasTarget, cmd.guard, fighters);
  else if (perm.ok) startMove(f, def, slot, {move, dodgeDirection: cmd.dodgeDirection, lock: hasTarget ? cmd.target ?? null : null}, desiredHeading, hasTarget, cmd.guard);
  if (diag) report(f, {kind: 'skill', slot, move: def?.id ?? null, result: perm.ok ? 'executed' : 'denied', reason: perm.reason, detail: perm.detail});
}
/** Comando de Move guardado no fim da esquiva (M16.3): sai assim que a esquiva termina o deslocamento principal. */
function bufferedSkill(f, cmd, diag) {
  const b = f.skillBuffer, def = moveInSlot(f, b.slot);
  if (!def?.charge || cmd.guardPressed || ++b.ticks > b.max) {f.skillBuffer = null;if (diag) report(f, {kind: 'skill', slot: b.slot, move: def?.id ?? null, result: 'expired'});return;}
  const perm = chargePermission(f, def, b.slot);
  if (perm.ok) {f.skillBuffer = null;startCharge(f, def, b.slot, cmd.guard, true);if (diag) report(f, {kind: 'skill', slot: b.slot, move: def.id, result: 'executed', fromBuffer: true, note: 'carga iniciada'});}
  else if (!perm.buffer) {f.skillBuffer = null;if (diag) report(f, {kind: 'skill', slot: b.slot, move: def.id, result: 'expired', reason: perm.reason, detail: perm.detail});}
}
/** Passo do Charge depois de defesa e X/C: soltar executa (efeitos na soltura, M30.9); segurar acumula, parado no máximo (M7.5). */
function stepCharge(f, cmd, ctx) {
  const ch = f.charge, def = getMove(ch.move);
  if (!def) {f.charge = null;return;}
  if (ch.ticks > 0 && !cmd.skillHeld?.[ch.slot]) {
    const minTicks = ch.params.minTicks ?? (def.charge?.min ? Math.round(def.charge.min / ch.params.step) : 0);
    if (minTicks > 0 && ch.ticks < minTicks) {
      cancelCharge(f, 'minCharge');
      return;
    }
    const level = chargeLevel(ch.ticks, ch.params), rel = {ticks: ch.ticks, seconds: ch.ticks * ch.params.step, level, params: ch.params, cost: ch.cost, slot: ch.slot, failed: false, lock: cmd.target ?? null};   // lock: alvo travado no instante da soltura (mira do Psyshock)
    f.charge = null;
    if (def.tackle) {   // soltar vira um Tackle com os parâmetros congelados da carga (Guard Break); sem recarga nova nem recuperação de Move
      moveEvent(f, {result: 'chargeRelease', move: def.id, slot: ch.slot, level, seconds: rel.seconds});
      releaseTackleMove(f, def, ch, rel, cmd, ctx);
      return;
    }
    // Recarga na materialização/disparo (M2.4/M2.5) e recuperação (M26s.8); o jogo desfaz as duas se o efeito falhar (M13.7, M29.3).
    if (def.cooldown > 0 && !def.cooldownOnStart) (f.moveCooldowns ??= {})[def.id] = def.cooldown;
    f.moveRecovery = ch.params.recovery;
    moveEvent(f, {result: 'chargeRelease', move: def.id, slot: ch.slot, level, seconds: rel.seconds});
    (def.timeline || []).forEach((ev, i) => (f.moveFx ??= []).push({index: i, move: def.id, heading: f.facing, charge: rel}));
    return;
  }
  ch.ticks = Math.min(ch.ticks + 1, ch.params.maxTicks);
}

/** Recargas dos movimentos (chamado por passo; a taxa pode vir de status). */
export function tickCooldowns(f, dt) {
  if (f.rangeFlash) {f.rangeFlash.t -= dt;if (f.rangeFlash.t <= 0) f.rangeFlash = null;}
  if (f.moveRecovery > 0) f.moveRecovery = Math.max(0, f.moveRecovery - dt);
  if (f.counterStagger > 0) f.counterStagger = Math.max(0, f.counterStagger - dt);
  const cds = f.moveCooldowns;if (!cds) return;const rate = stat(f, 'cooldownRate', 1);
  for (const id of Object.keys(cds)) {cds[id] = Math.max(0, cds[id] - dt * rate);if (cds[id] <= 0) delete cds[id];}
}
