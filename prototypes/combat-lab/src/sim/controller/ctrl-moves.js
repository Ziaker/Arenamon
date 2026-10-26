// Dividido de controller.js (comportamento idêntico): ctrl-moves.

import {C} from '../config.js';
import {nominalDistance, chainOpen, actionSpec, getFighterMaxStamina} from '../entity.js';
import {stat, hasFlag} from '../status.js';
import {moveInSlot, getMove, getTackleSetup, nearestEligible, targetReachOf} from '../moves.js';
import {chargeParams, chargeLevel, interruptCooldown, boostPlan} from '../charge.js';
import {vec, scale, sub, length, normalize, clamp, angleOf, direction, smoothstep} from '../math.js';
import {report, attemptsActive} from '../attempts.js';
import {markerValidity, markerInitial, markerStep} from '../aim-marker.js';
import {bulletPunchTravel} from '../moves/bullet-punch.js';
import {isAirJump, isVaultArc, airKind, airUsable, vaultToFlight, takeOffToLift, applyLift} from '../air.js';
import {CTX_FIGHTERS, CTX_WORLD, startAction} from './ctrl-update.js';
import {cancelWindow, costOf, isDepleted, turnToward, walkSpeed} from './ctrl-basico.js';
import {cancelTackleCharge, feintDirection} from './ctrl-tackle.js';

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
  if (def.needsTarget && !opts?.skipTarget) {const range = C.world[def.group]?.[def.needsTarget] ?? 0;if (!nearestEligible(f, CTX_FIGHTERS, range, targetReachOf(def))) return {ok: false, reason: 'noTarget', detail: {range}};}
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
  if (f.action?.slam) return {ok: false, reason: 'slam'};   // Meteor Slam: nenhum Move durante o slam
  const lift = airKind(def) === 'descend' ? takeOffToLift(f, CTX_WORLD) : 0, inAir = airKind(def) === 'cast' && isAirJump(f);
  const aim = def.aim ?? 'target', inputDir = dirs.dodgeDirection ?? dirs.move;
  const heading = aim === 'facing' ? f.facing : aim === 'input' && length(inputDir) > .01 ? angleOf(inputDir) : hasTarget || length(inputDir) <= .01 ? desiredHeading : angleOf(inputDir);
  // M28.4: a execução guarda a definição EFETIVA (com os sliders do momento) e os parâmetros do grupo; mexer em slider depois não a altera.
  f.action = {kind: 'move', move: def.id, slot, elapsed: 0, startAngle: heading, heading, offensive: false, hits: new Set(), fired: [], from: {...f.velocity}, def, params: def.group ? structuredClone(C.world[def.group]) : null, lock: dirs.lock ?? null};
  f.comboLeft = 0;
  const cost = costOf(f, def.cost ?? 1);f.stamina = Math.max(0, f.stamina - cost);f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = isDepleted(f.stamina);
  if (def.cooldown > 0) (f.moveCooldowns ??= {})[def.id] = def.cooldown;
  f.guard = false;f.guardSuppressed = guardHeld;f.push = null;f.blend = null;f.vaultHeight = 0;f.bufferedTackle = null;f.inputBuffer = null;f.sprinting = false;f.sprintCarry = false;
  if (lift > 1e-8) applyLift(f, lift);else if (inAir) f.action.air = true;   // air.js: 'descend' desce enquanto age; 'cast' segue em voo
  if (def.captureAim && dirs.lock != null) {   // Burst com mira capturada na CONFIRMAÇÃO (Air Slash): ponto do alvo no instante do toque, sem perseguir depois
    const o = CTX_FIGHTERS.find(x => x.id === dirs.lock && x.hp > 0);
    if (o) f.action.aimAt = {x: o.position.x, z: o.position.z, y: (o.flight?.y ?? o.groundY ?? 0) + (o.vaultHeight ?? 0) + (C.extras?.visual?.bodyHeight ?? 1.2) / 2};
  }
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
  a.antiAir = !!def.antiAir;a.airReach = def.group ? (C.world[def.group]?.airReach ?? 0) : 0;
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
  const a = f.action, minDur = P.minStrikeDuration ?? .1;
  a.heading = a.startAngle = heading;a.fixedHeading = true;
  a.move = def.id;a.slot = action.slot;a.params = P;a.moveDef = def;a.pl = P.strikePl ?? 4;a.plSpeed = 1;a.plDamage = P.damage / C.test.attackReference;   // MV-P13; contra-ataque: tratado como PL 4 por padrão (vence qualquer PL, nunca faz clash)
  a.kb = {horizontal: P.knockbackH, vertical: P.knockbackV};
  a.durationScale = Math.max(minDur, P.cast - t) / p.duration;
  a.distanceScale = P.strikeRange / Math.max(1e-6, nominalDistance(f, 'tackle'));
  a.invulnerableFor = Math.max(0, P.windowEnd - t);
  a.chainAfter = Math.max(minDur, P.cast - t);
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
function startRangeAim(f, def, slot, guardHeld = false) {
  const P = structuredClone(C.world[def.group]), range = P[def.needsTarget] ?? 0;
  f.aim = {move: def.id, slot, ticks: 0, params: P, def, range: true, free: true, rangeValue: range, inRange: !!nearestEligible(f, CTX_FIGHTERS, range, targetReachOf(def)), pos: {x: f.position.x, z: f.position.z}, y: f.groundY ?? 0, valid: true, reason: null, distance: 0};
  f.guard = false;f.guardSuppressed = !!guardHeld;   // com D segurada o toque no slot não é cancelado pela defesa no passo seguinte (como startMove)
  moveEvent(f, {result: 'aimStart', move: def.id, slot, range: true});
}
/** Fecha o marcador sem executar nem cobrar. */
export function cancelAim(f, why) {
  const a = f.aim;if (!a) return;
  f.aim = null;moveEvent(f, {result: 'aimCancel', move: a.move, slot: a.slot, reason: why});
  if (attemptsActive()) report(f, {kind: 'skill', slot: a.slot, move: a.move, result: 'denied', reason: 'aimEnded', detail: {why}});
}
/** Um passo do marcador: move, revalida e, ao SOLTAR o botão, confirma (válido: cobra e começa o cast) ou cancela (inválido: sem custo). */
export function stepAim(f, cmd, inputMove, ctx) {
  const a = f.aim, def = a.def ?? getMove(a.move);   // a definição EFETIVA do momento em que o marcador abriu (M28.4)
  if (!def) {f.aim = null;return;}
  if (a.range) {   // mira de alcance: acompanha o alvo mais próximo e executa ao soltar
    a.rangeValue = a.params[def.needsTarget] ?? 0;
    const tgt = nearestEligible(f, ctx.fighters, a.rangeValue, targetReachOf(def));a.inRange = !!tgt;
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
  a.antiAir = !!def.antiAir;a.airReach = def.group ? (C.world[def.group]?.airReach ?? 0) : 0;
  getTackleSetup(def.tackle)?.(f, a, params, {fighters, def});
  return a;
}
/** Um passo do movimento em curso: deslocamento (motion), orientação e efeitos da linha do tempo que vencem neste passo. */
export function updateMove(f, action, target, cmd, dt) {
  const def = action.def ?? getMove(action.move);if (!def) {f.velocity = vec();return;}
  if (def.riposte && action.riposte) {startRiposteStrike(f, action);return;}   // acerto elegível na janela: vira o contra-golpe
  const m = def.motion ?? {type: 'none'};
  if (m.type === 'dash' && m.distance) {
    // Deslocamento suave entre start e end (s): mesma distância qualquer que seja o passo.
    const t0 = (m.startKey ? action.params?.[m.startKey] : undefined) ?? m.start ?? 0;
    const t1 = (m.endKey ? action.params?.[m.endKey] : undefined) ?? m.end ?? def.duration;
    const prog = t => smoothstep(clamp((t - t0) / Math.max(1e-6, t1 - t0), 0, 1));
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
  (def.timeline || []).forEach((ev, i) => {if (!action.fired.includes(i) && ev.at <= action.elapsed + dt + 1e-9) {action.fired.push(i);(f.moveFx ??= []).push({index: i, move: def.id, heading: action.heading, params: action.params ?? null, def, lock: action.lock ?? null, marker: action.marker ?? null, aimAt: action.aimAt ?? null});}});
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
  f.comboLeft = 0;
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
export function pressSkill(f, cmd, move, desiredHeading, hasTarget, diag, fighters = [], world = null) {
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
  if (def?.needsTarget && movePermission(f, def, slot, {skipTarget: true}).ok) {startRangeAim(f, def, slot, cmd.guard);if (diag) report(f, {kind: 'skill', slot, move: def.id, result: 'executed', note: 'círculo de alcance aberto (soltar executa)'});return;}
  const perm = movePermission(f, def, slot);
  if (perm.ok && def.aimMode) {startAim(f, def, slot, fighters, world, hasTarget ? cmd.target : null);if (diag) report(f, {kind: 'skill', slot, move: def.id, result: 'executed', note: 'marcador aberto'});return;}
  if (perm.ok && def.tackle && !def.moveCast) startTackleMove(f, def, slot, {move, dodgeDirection: cmd.dodgeDirection}, desiredHeading, hasTarget, cmd.guard, fighters);
  else if (perm.ok) startMove(f, def, slot, {move, dodgeDirection: cmd.dodgeDirection, lock: hasTarget ? cmd.target ?? null : null}, desiredHeading, hasTarget, cmd.guard);
  if (diag) report(f, {kind: 'skill', slot, move: def?.id ?? null, result: perm.ok ? 'executed' : 'denied', reason: perm.reason, detail: perm.detail});
}
/** Comando de Move guardado no fim da esquiva (M16.3): sai assim que a esquiva termina o deslocamento principal. */
export function bufferedSkill(f, cmd, diag) {
  const b = f.skillBuffer, def = moveInSlot(f, b.slot);
  if (!def?.charge || cmd.guardPressed || ++b.ticks > b.max) {f.skillBuffer = null;if (diag) report(f, {kind: 'skill', slot: b.slot, move: def?.id ?? null, result: 'expired'});return;}
  const perm = chargePermission(f, def, b.slot);
  if (perm.ok) {f.skillBuffer = null;startCharge(f, def, b.slot, cmd.guard, true);if (diag) report(f, {kind: 'skill', slot: b.slot, move: def.id, result: 'executed', fromBuffer: true, note: 'carga iniciada'});}
  else if (!perm.buffer) {f.skillBuffer = null;if (diag) report(f, {kind: 'skill', slot: b.slot, move: def.id, result: 'expired', reason: perm.reason, detail: perm.detail});}
}
/** Passo do Charge depois de defesa e X/C: soltar executa (efeitos na soltura, M30.9); segurar acumula, parado no máximo (M7.5). */
export function stepCharge(f, cmd, ctx) {
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
