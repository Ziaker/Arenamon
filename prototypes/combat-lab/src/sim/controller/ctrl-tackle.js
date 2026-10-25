// Dividido de controller.js (comportamento idêntico): ctrl-tackle.

import {C} from '../config.js';
import {getFighterMaxStamina} from '../entity.js';
import {hasFlag} from '../status.js';
import {vec, scale, sub, length, normalize, clamp, angleOf, angleDelta} from '../math.js';
import {report} from '../attempts.js';
import {getGroundHeight} from '../physics.js';
import {costOf, isDepleted, turnToward, walkSpeed} from './ctrl-basico.js';
import {startAction} from './ctrl-update.js';
import {bufferedSkill, pressSkill, stepAim, stepCharge, updateMove} from './ctrl-moves.js';

/** Nível de PL pela carga do tackle: PL1 abaixo de 50% do tempo máximo, PL2 de 50% a 99%, PL3 na carga máxima. */
export const tackleChargeLevel = (t, max = C.rules.chargeTackleMaxTime) => t >= max - 1e-9 ? 3 : t >= max / 2 - 1e-9 ? 2 : 1;
/** Aplica o Power Level a uma ação de tackle: velocidade/alcance (a duração é fixa) e dano proporcionais (valores em sliders). */
export function applyTacklePL(action, level) {
  const R = C.rules;level = Math.max(1, Math.min(3, Math.round(level)));action.pl = level;
  action.plSpeed = level === 3 ? R.chargeTackleSpeed3 : level === 2 ? R.chargeTackleSpeed2 : 1;
  action.plDamage = level === 3 ? R.chargeTackleDamage3 : level === 2 ? R.chargeTackleDamage2 : 1;
}
export function startTackleCharge(f, p) {
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
export function stepTackleCharge(f, cmd, fighters, dt, desiredHeading, target, move, diag) {
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
export function aimSlam(f, fighters, h = f.vaultHeight) {
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
export function aimSlamDive(f, fighters) {
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
export function armTechRecovery(f, cmd, dt) {
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
export function startNormalJump(f, move, diag, fromAir = false) {
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
export function airSkillStep(f, cmd, fighters, world, dt, diag) {
  const move = length(cmd.move) > 1 ? normalize(cmd.move) : cmd.move, target = fighters.find(o => o.id === cmd.target && o.hp > 0);
  const desiredHeading = target ? angleOf(sub(target.position, f.position)) : length(move) > 0 ? angleOf(move) : f.facing;
  if (cmd.skill != null) pressSkill(f, cmd, move, desiredHeading, !!target, diag, fighters, world);
  else if (f.skillBuffer) bufferedSkill(f, cmd, diag);
  if (f.aim && !f.aim.castFirst) stepAim(f, cmd, move, {desiredHeading, hasTarget: !!target, fighters, world, dt, diag});
  if (f.charge) stepCharge(f, cmd, {move, desiredHeading, hasTarget: !!target, fighters});
  const a = f.action;
  if (a?.kind === 'move' && a.air && f.flight) {updateMove(f, a, target, cmd, dt);if (f.flight) f.state = 'airborne';}
}
