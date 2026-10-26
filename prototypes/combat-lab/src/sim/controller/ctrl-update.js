// Dividido de controller.js (comportamento idêntico): ctrl-update.

import {C} from '../config.js';
import {nominalDistance, actionParams, invulnerableWindow, chainOpen, actionSpec, getFighterMaxStamina} from '../entity.js';
import {stat, hasFlag} from '../status.js';
import {getTackleSetup} from '../moves.js';
import {vec, add, scale, sub, dot, length, normalize, clamp, angleOf, direction, angleDelta, smoothstep} from '../math.js';
import {locomotionStep} from '../locomotion.js';
import {slideAlong} from '../solid-contact.js';
import {actionProgress} from '../motion.js';
import {report, attemptsActive} from '../attempts.js';
import {canSee} from '../vision.js';
import {isAirJump, airKind} from '../air.js';
import {ledgeUpdate} from '../ledge.js';
import {approachVelocity, costOf, isDepleted, lastBufferReason, locomotionParams, sprintDenied, staminaReason, startPermission, turnToward, walkSpeed} from './ctrl-basico.js';
import {applySandPushStep} from '../moves/sand-wave/sand-push.js';
import {aimSlam, aimSlamDive, airSkillStep, applyTacklePL, armTechRecovery, canFeint, cancelTackleCharge, doFeint, feintDirection, startNormalJump, startSlamFromFlight, startTackleCharge, stepTackleCharge} from './ctrl-tackle.js';
import {bufferedSkill, cancelAim, cancelCharge, pressSkill, stepAim, stepCharge, updateMove} from './ctrl-moves.js';

export function updateFighter(f, cmd, fighters, dt, world = null) {
  CTX_FIGHTERS = fighters;CTX_WORLD = world;
  if (C.extras?.toggles?.enableInfiniteStamina) {f.stamina = getFighterMaxStamina(f);f.regenBase = f.stamina;f.exhausted = false;}   // stamina infinita: sempre cheia
  if (f.absent && !(f.action?.kind === 'move' && f.action.travel)) f.absent = false;   // rede de segurança: a ausência só existe durante a viagem do Bullet Punch; se a ação sumir (cancelada, lançamento, queda), o lutador reaparece em vez de ficar invisível e intangível para sempre
  if (cmd.target != null && fighters.find(o => o.id === cmd.target)?.absent) cmd = {...cmd, target: null, locked: false};   // ausente (Bullet Punch) não pode ser selecionado como alvo
  if (cmd.target != null && hasFlag(f, 'blind')) {   // cegueira: lock-on só em quem o cegado enxerga (10 m, sem parede bloqueando por completo); senão desliga
    const t = fighters.find(o => o.id === cmd.target);
    if (!canSee(f, t, world)) cmd = {...cmd, target: null, locked: false};
  }
  const R = C.rules, X = C.extras, T = X.toggles, A = C.actions;
  // Buffer de entrada: o pedido mais recente de X ou C vale por actions.buffer.window, mesmo no ar ou na aterrissagem.
  const requested = (f.action?.slam) ? null : (cmd.tackle && T.enableTackle ? 'tackle' : cmd.dodge && T.enableDodge ? 'dodge' : null);   // Meteor Slam: nenhum botao durante o slam (ar e chao)
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
  if (cmd.jump && !f.action?.slam && f.hp > 0 && feelJ) f.jumpBuffered = Math.max(f.jumpBuffered ?? 0, MJ.jumpBufferWindow ?? 0.12);
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
  if (f.hp <= 0) {f.state = 'defeated';f.velocity = vec();f.action = null;f.push = null;f.vaultHeight = 0;f.bufferedTackle = null;return;}
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
  if (f.knockRecovery > 0) {
    f.knockRecovery = Math.max(0, f.knockRecovery - dt);if (f.landingRecovery > 0) f.landingRecovery = Math.max(0, f.landingRecovery - dt);if (f.hitstun > 0) f.hitstun = Math.max(0, f.hitstun - dt);if (f.stagger > 0) f.stagger = Math.max(0, f.stagger - dt);if (f.exhaustRecovery > 0) f.exhaustRecovery = Math.max(0, f.exhaustRecovery - dt);if (f.actionRecovery > 0) f.actionRecovery = Math.max(0, f.actionRecovery - dt);if (f.pushRecovery > 0) f.pushRecovery = Math.max(0, f.pushRecovery - dt);if (f.knockRecovery <= 0) {f.recoveryFrom = null;f.recoveryKind = null;f.landingRecovery = 0;f.hitstun = 0;f.stagger = 0;f.counterStagger = 0;f.exhaustRecovery = 0;f.actionRecovery = 0;f.pushRecovery = 0;}f.vaultHeight = 0;f.action = null;f.guard = false;f.bufferedTackle = null;f.brakeLeft = Math.max(0, (f.brakeLeft ?? 0) - dt);
    // Política do Sand Wave: a recuperação/stagger só interrompe a força quando a ficha manda. Com continuidade ligada,
    // o alvo continua sendo empurrado mesmo preso na parede (a colisão ainda limita o deslocamento real).
    if (f.sandPush?.continuesDuringStagger) {applySandPushStep(f, dt);f.velocity = {...f.locomotionVelocity};f.state = (f.recoveryKind === 'stagger' || (f.stagger ?? 0) > 0) ? 'stagger' : 'pushed';}
    else if (f.push) {f.state = 'pushed';}
    else {f.velocity = vec();f.locomotionVelocity = vec();f.state = f.brakeLeft > 0 ? 'brake' : (f.recoveryKind === 'landing' ? 'landing' : (f.recoveryKind === 'stagger' || (f.stagger ?? 0) > 0 || (f.counterStagger ?? 0) > 0) ? 'stagger' : (f.recoveryKind === 'hitstun' || (f.hitstun ?? 0) > 0) ? 'hitstun' : (f.recoveryKind === 'exhaust' || (f.exhaustRecovery ?? 0) > 0) ? 'recover' : (f.recoveryKind === 'action' || f.recoveryFrom) ? 'actionRecovery' : (f.recoveryKind === 'pushed') ? 'pushed' : 'hitstun');}
    return;
  }
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
  f.comboLeft = Math.max(0, (f.comboLeft ?? 0) - dt);   // janela de combo aberta por um acerto corpo a corpo recente
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
  if (C.extras?.toggles?.enableInfiniteStamina) {f.stamina = maxStam;f.regenBase = maxStam;f.exhausted = false;}
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
  if (!f.action?.slam && cmd.guard && T.enableDefense && !f.guardSuppressed && open) {
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
        if (!action.slam) {
          if (action.airCurve) {   // Quick Attack anti-aéreo: sobe até o alvo na ida e desce na volta
            const c = action.airCurve, t = action.elapsed + dt, u = c.up > 1e-9 ? Math.min(1, t / c.up) : 1;
            const down = Math.max(0, Math.min(1, (t - c.up - (c.hold ?? 0)) / Math.max(1e-9, c.down ?? 0)));
            f.vaultHeight = c.from + (c.to - c.from) * (1 - (1 - u) * (1 - u)) * (1 - down);
          } else f.vaultHeight = action.liftStart > 0 ? (action.liftTime > 0 ? action.liftStart * (1 - smoothstep((action.elapsed + dt) / action.liftTime)) : 0) : 0;
        }
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
    if (f.sandPush && (!(f.stun > 1e-8 || hasFlag(f, 'stunned')) || f.sandPush.continuesDuringStagger)) {   // empurrado pela areia: sem controle de deslocamento; a velocidade ganha se mantém depois (atrito normal)
      applySandPushStep(f, dt);f.desiredVelocity = vec();f.locoPhase = 'sandPush';
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
    f.state = f.stun > 1e-8 ? 'guardStun' : f.guard ? 'guard' : (f.push || f.sandPush) ? 'pushed' : length(move) ? 'moving' : 'neutral';
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
export function startAction(f, kind, dirs, fighters, desiredHeading, viaCancel, guardHeld, locked = false) {
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
  f.comboLeft = 0;   // a janela de combo é consumida pela ação que ela permitiu
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
    if (wasExhausted && f.hp > 0) {const exh = C.extras.combat.exhaustRecovery;f.knockRecovery = Math.max(f.knockRecovery, exh);f.exhaustRecovery = Math.max(f.exhaustRecovery ?? 0, exh);f.recoveryKind = 'exhaust';f.state = 'recover';}
    const recovery = spec.recovery;
    if (recovery > 0 && f.hp > 0 && !wasSlam) {f.knockRecovery = Math.max(f.knockRecovery, recovery);f.actionRecovery = Math.max(f.actionRecovery ?? 0, recovery);f.recoveryKind = 'action';f.state = 'actionRecovery';}   // o meteor slam já passou pelo estado meteorGround: sem recuperação extra de 'aterrissar'
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
export let CTX_FIGHTERS = [];
/** Mundo da partida em curso (definido a cada updateFighter): o apoio real sob o corpo para os Moves que descem do ar (air.js). */
export let CTX_WORLD = null;
