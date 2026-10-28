// Resolução de contatos ofensivos: lançamento, clash, invulnerabilidade, defesa parcial/perfeita.
import {C} from './config.js';
import {isInvulnerable, isOffensive, riposteIntercept, altitudeOf} from './entity.js';
import {stat} from './status.js';
import {vec, add, scale, sub, dot, length, normalize, angleOf, direction} from './math.js';

import {resolveDamage, damageEventFields} from './resolvers/damage-resolver.js';
import {knockbackFactor} from './passive-engine.js';
import {applyReaction} from './resolvers/reaction-resolver.js';

/** Coloca o lutador em voo balístico (adaptador de applyReaction "impulse": altitude preservada, eixo horizontal integrado pela física). */
export function launch(f, away, horizontal, vertical) {applyReaction(f, {kind: 'impulse', direction: away, horizontal, vertical});}
/** Empurrão no chão (adaptador de applyReaction "displacement"): sem duração, desliza a SLAM_BLOCK_PUSH_SPEED. */
export function pushAway(f, away, distance, duration) {applyReaction(f, {kind: 'displacement', direction: away, distance, duration: duration ?? (distance / SLAM_BLOCK_PUSH_SPEED)});}
/** Preparação do meteor slam (no ar, jogado para cima): sem dano, sem clash, sem knockback. */
const slamPrep = f => !!f.action?.slam && !f.action.slamPrepDone;
/** Velocidade do deslize (m/s) do empurrão aplicado no defensor que bloqueia o meteor slam. A duração do deslize = distância ÷ esta velocidade. */
const SLAM_BLOCK_PUSH_SPEED = 12;
/** Ações que nunca disputam clash: Meteor Slam (PL 2) e o contra-golpe do Riposte (tratado como PL 4). */
const noClash = f => !!f.action?.slam || !!f.action?.riposteStrike;
export function clashPossible(a, b, normal, relative) {
  const X = C.extras.combat;
  if (slamPrep(a) || slamPrep(b)) return false;
  if (!C.extras.toggles.enableClash || a.action?.kind !== 'tackle' || b.action?.kind !== 'tackle' || a.flight || b.flight) return false;
  if (C.extras.toggles.enableAnimationCombatWindows && (!isOffensive(a) || !isOffensive(b))) return false;
  const facing = dot(direction(a.action.heading), normal) > X.clashFacingAlignment && dot(direction(b.action.heading), normal) < -X.clashFacingAlignment && dot(relative, normal) > X.clashClosingSpeed;
  if (!facing) return false;
  // Power Levels diferentes: não há clash. O PL maior vence a disputa (o de baixo é neutralizado e só o dele conecta, pelo fluxo normal de acerto).
  const pa = a.action.pl ?? 1, pb = b.action.pl ?? 1;
  if (pa !== pb) {const loser = pa > pb ? b : a;loser.action.neutralized = true;loser.action.invulnerableFor = 0;loser.plDefeated = true;return false;}
  if (noClash(a) || noClash(b)) return false;   // Meteor Slam e contra-golpe do Riposte NUNCA fazem clash (mesmo com PL igual)   // o derrotado perde a invulnerabilidade do início do tackle: o golpe do vencedor conecta
  return true;
}
/**
 * Dois tackles que conectam um no outro no mesmo contato sem chegar ao clash frontal (mira entre tackleTargetAlignment e
 * clashFacingAlignment): sem isso, o primeiro da lista lançava o rival e o contra-golpe deste nunca era avaliado (vantagem de índice).
 * Vale como clash: mesma resolução simétrica.
 */
export function mutualTackle(a, b, normal, relative) {
  if (slamPrep(a) || slamPrep(b)) return false;
  if (noClash(a) || noClash(b)) return false;   // sem troca simultânea «de clash»: o PL decide (clashPossible) e o contra-golpe/slam seguem o fluxo normal de acerto
  if (!C.extras.toggles.enableClash || a.flight || b.flight || a.action?.kind !== 'tackle' || b.action?.kind !== 'tackle') return false;
  if (C.extras.toggles.enableAnimationCombatWindows && (!isOffensive(a) || !isOffensive(b))) return false;
  if (a.action.hits?.has(b.id) || b.action.hits?.has(a.id)) return false;
  return tackleConnects(a, b, normal, relative) && tackleConnects(b, a, scale(normal, -1), scale(relative, -1));
}
/** Contador de contactId de chamadas diretas a clash() sem `world` (testes unitários). Nunca é usado por um Game: lá o contador é `world.contactSeq`. */
const localContactSeq = {contactSeq: 0};
const nextContactId = (/** @type {{contactSeq?: number}} */ owner) => owner.contactSeq = (owner.contactSeq ?? 0) + 1;

/** X contra X: os dois recebem dano e são lançados (ou, com enableClashPush, empurrados no chão) em direções opostas (ignora invulnerabilidade). */
export function clash(a, b, normal, world = null) {
  const R = C.rules;
  const atkMultB = 1 + (b.stages?.attack ?? 0) * (C.map?.stageAttackBonus ?? 0.10);
  const atkMultA = 1 + (a.stages?.attack ?? 0) * (C.map?.stageAttackBonus ?? 0.10);
  const rawToA = stat(b, 'attack', b.attributes.attack) * atkMultB * R.clashFraction * stat(a, 'damageTaken', 1);
  const rawToB = stat(a, 'attack', a.attributes.attack) * atkMultA * R.clashFraction * stat(b, 'damageTaken', 1);
  const resA = resolveDamage({target: a, attacker: b, rawDamage: rawToA, sourceKind: 'direct', contact: 'clash'});
  const resB = resolveDamage({target: b, attacker: a, rawDamage: rawToB, sourceKind: 'direct', contact: 'clash'});
  const push = !!C.extras.toggles.enableClashPush;a.lastAttacker = b.id;b.lastAttacker = a.id;
  if (push) {pushAway(a, scale(normal, -1), R.clashPushDistance, R.clashPushDuration);pushAway(b, normal, R.clashPushDistance, R.clashPushDuration);}
  else {launch(a, scale(normal, -1), R.clashHorizontal, R.clashUp);launch(b, normal, R.clashHorizontal, R.clashUp);}
  const contactId = nextContactId(world ?? localContactSeq), displacementPolicy = push ? 'displacement' : 'impulse';
  return [{attacker: a.id, target: b.id, result: 'clash', contactId, damage: resB.hpDamage, ...damageEventFields(resB), normal: {...normal}, push, displacementPolicy, contact: 'clash', ...(resB.sturdy ? {sturdy: true} : {})},
    {attacker: b.id, target: a.id, result: 'clash', contactId, damage: resA.hpDamage, ...damageEventFields(resA), normal: scale(normal, -1), push, displacementPolicy, contact: 'clash', ...(resA.sturdy ? {sturdy: true} : {})}];
}
/** O tackle do atacante conecta no defensor, dado a normal e a velocidade relativa do contato? */
export function tackleConnects(attacker, defender, normal, relative) {
  const X = C.extras.combat, antiAir = !!attacker.action?.antiAir;
  if (slamPrep(attacker)) return false;
  if (attacker.action?.slam && !attacker.action.slamLanded) return false;   // a hitbox do Meteor Slam só existe com o personagem NO CHÃO (no mergulho não acerta)
  if (attacker.action?.kind !== 'tackle' || attacker.action.neutralized || attacker.flight || (defender.flight && !defender.wallSplat && !antiAir)) return false;   // anti-aéreo (Quick Attack/Bullet Punch) alcança quem está em voo
  // Volume tridimensional real (R7.11-R7.12): não conecta se separados verticalmente fora do meteor slam (anti-aéreo usa o airReach do Move)
  const attY = altitudeOf(attacker);
  const defY = altitudeOf(defender);
  const reachY = antiAir ? Math.max(C.extras?.visual?.bodyHeight ?? 1.2, attacker.action?.airReach ?? 0) : (C.extras?.visual?.bodyHeight ?? 1.2);
  if (Math.abs(attY - defY) > reachY && !attacker.action?.slam) return false;

  const dir = direction(attacker.action.heading), off = sub(defender.position, attacker.position);
  const towards = length(off) > 1e-6 ? normalize(off) : normal;
  return dot(dir, towards) > X.tackleTargetAlignment && dot(dir, normal) > X.tackleNormalAlignment && dot(relative, normal) > X.tackleClosingSpeed;
}
/**
 * Forma espacial (esfera no plano XZ) do golpe atual: centro à frente do atacante e raio. Cada janela da animação pode trazer a
 * sua (`combatWindows.shapes[i] = {forward, radius}`); sem forma própria vale extras.hitbox. null = formas desligadas ou golpe sem forma (slam).
 * @returns {{x:number, z:number, radius:number, forward:number}|null}
 */
export function hitShapeOf(attacker, windowIdx = 0) {
  const H = C.extras.hitbox;
  if (!H?.enableShapes || attacker.action?.kind !== 'tackle' || attacker.action.slam) return null;
  const own = attacker.action.combatWindows?.shapes?.[Math.max(0, windowIdx)] ?? {}, forward = own.forward ?? H.shapeForward, radius = own.radius ?? H.shapeRadius;
  const d = direction(attacker.action.heading);
  return {x: attacker.position.x + d.x * forward, z: attacker.position.z + d.z * forward, radius, forward};
}
/** O defensor está dentro da forma espacial do golpe? (sempre true com as formas desligadas) */
export function hitShapeAllows(attacker, defender, windowIdx = 0) {
  const sh = hitShapeOf(attacker, windowIdx);
  return !sh || Math.hypot(defender.position.x - sh.x, defender.position.z - sh.z) <= sh.radius + C.test.halfExtent;
}
/**
 * Reação a um empurrão calculado (mesma da entidade `applyHit`): com vertical > 0 (ou já no ar) lança; só horizontal vira empurrão deslizante com
 * recuperação de pouso; zero = nenhuma reação. Usada pelos Moves que viram Tackle com knockback próprio (`action.kb`).
 */
export function knockbackReaction(target, dir, hKb, vKb) {
  const r = applyReaction(target, {kind: 'knockback', direction: dir, horizontal: hKb, vertical: vKb});
  return r && {direction: r.direction, horizontal: r.horizontal, vertical: r.vertical};   // forma antiga do launch do evento (a política vai em displacementPolicy)
}
/** Resolve um tackle conectado. Devolve o evento ou null. */
export function resolveHit(attacker, defender, normal, relative, force = false) {
  const R = C.rules, X = C.extras.combat, T = C.extras.toggles;
  if ((!force && !tackleConnects(attacker, defender, normal, relative)) || defender.hp <= 0 || defender.absent || attacker.absent) return null;

  // Verificação de janelas ativas e multi-hit (quando o toggle estiver ativo e a ação tiver janelas marcadas)
  let windowIdx = -1;
  const activeWindows = attacker.action?.combatWindows?.activeWindows;
  if (T.enableAnimationCombatWindows && Array.isArray(activeWindows) && activeWindows.length > 0) {
    const stepSec = C.test?.step || (1 / 120);
    const attackerStep = Math.round((attacker.action.elapsed ?? 0) / stepSec);
    windowIdx = activeWindows.findIndex(([s, e]) => attackerStep >= s && attackerStep < e);
    // Fora de janela ativa (startup ou recuperação): não conecta
    if (windowIdx === -1) return null;

    // Multi-hit: verifica se este defensor já foi atingido nesta janela ativa específica
    attacker.action.hitWindows ??= [];
    attacker.action.hitWindows[windowIdx] ??= new Set();
    if (attacker.action.hitWindows[windowIdx].has(defender.id)) return null;
  } else {
    // Modo legado: tackle conecta uma única vez durante toda a sua duração
    attacker.action.hits ??= new Set();
    if (attacker.action.hits.has(defender.id)) return null;
  }
  // Hitbox espacial (extras.hitbox.enableShapes): a janela ativa decide a forma; meteor slam (force) não usa forma.
  if (!force && !hitShapeAllows(attacker, defender, windowIdx)) return null;

  if (!attacker.action.guardBreak) {   // Riposte: o acerto elegível é anulado e dispara o contra-golpe (Guard Break não é anulado: mantém o triângulo tático)
    const rip = riposteIntercept(defender, attacker.id, normal);
    if (rip) {attacker.action.hits.add(defender.id);if (windowIdx >= 0) attacker.action.hitWindows[windowIdx].add(defender.id);return rip;}
  }
  if (isInvulnerable(defender)) {
    attacker.action.hits.add(defender.id);
    if (windowIdx >= 0) attacker.action.hitWindows[windowIdx].add(defender.id);
    // Esquiva perfeita: só a esquiva C (não um tackle que herdou invulnerabilidade de C) concede o bônus, uma vez por tackle.
    if (defender.action?.kind === 'dodge' && T.enableCounterBonus) {
      const D = C.actions.dodge;
      defender.counterWindow = Math.max(defender.counterWindow, D.counterWindow);
      if (D.perfectEvadeStamina > 0) {
        defender.stamina = Math.min(R.staminaMax, defender.stamina + D.perfectEvadeStamina);
        defender.regenBase = defender.stamina;defender.regenAge = 0;
        if (defender.stamina >= D.cost) defender.exhausted = false;
      }
      return {attacker: attacker.id, target: defender.id, result: 'perfectDodge', damage: 0, normal: {...normal}};
    }
    return {attacker: attacker.id, target: defender.id, result: 'invulnerable', damage: 0, normal: {...normal}};
  }
  attacker.action.hits.add(defender.id);
  if (windowIdx >= 0) attacker.action.hitWindows[windowIdx].add(defender.id);
  const protectedFront = defender.guard && dot(direction(defender.facing), normalize(sub(attacker.position, defender.position))) >= X.guardFrontAlignment;
  const perfect = protectedFront && defender.perfectLeft > 1e-8;
  const atkStageMult = 1 + (attacker.stages?.attack ?? 0) * (C.map?.stageAttackBonus ?? 0.10);
  const attack = stat(attacker, 'attack', attacker.attributes.attack) * (attacker.action.plDamage ?? 1) * atkStageMult;
  const rawDamage = perfect ? 0 : attack * stat(defender, 'damageTaken', 1);

  // Pipeline central: absorve dano bruto no escudo antes da Defesa (R9.6, R10.1, R10.3, R11.3)
  const dmgResult = resolveDamage({target: defender, attacker, rawDamage, sourceKind: 'direct', contact: 'tackle', guarded: protectedFront, perfect});
  const damage = dmgResult.hpDamage;

  let launchInfo = null, displacementPolicy = 'none';
  const isGuardBreak = !!attacker.action?.guardBreak;
  const gbConfig = attacker.action?.guardBreak;
  if (protectedFront) {
    // O atacante recua; a defesa NÃO lança, empurra nem desloca o defensor.
    // Exceção (Meteor Slam): o ataque é comprometido — o contato pode ocorrer no mergulho
    // (meteorDive) ou no chão (meteorGround). Em ambos, bloqueado não troca para recoil:
    // o mergulho segue, aterrissa e o slam finaliza normalmente.
    const slamCommitted = !!attacker.action.slam;
    if (!slamCommitted && !isGuardBreak && !(attacker.action.keepOnBlock && !perfect)) {   // keepOnBlock: Moves que seguem a própria sequência mesmo bloqueados (Quick Attack: o retorno acontece de qualquer jeito)
      applyReaction(attacker, {kind: 'recoil', heading: angleOf(scale(normal, -1))});
    }
    if (slamCommitted && !perfect) {
      pushAway(defender, length(normal) > 1e-8 ? normal : direction(attacker.facing), R.slamBlockPushDistance, R.slamBlockPushDistance / SLAM_BLOCK_PUSH_SPEED);displacementPolicy = 'displacement';
    } else {
      defender.push = null;defender.flight = null;defender.velocity = vec();defender.locomotionVelocity = vec();
    }
    if (perfect) {
      applyReaction(defender, {kind: 'perfectGuard', counterWindow: X.perfectGuardCounterWindow});
    } else if (isGuardBreak) {   // Guard Break: derruba a guarda comum e aplica o guard stun próprio (sem empurrão)
      const gbStun = (typeof gbConfig === 'object' && gbConfig?.stun) ? gbConfig.stun : (C.rules?.guardBreakStun ?? 0.6);
      applyReaction(defender, {kind: 'guardBreak', duration: gbStun});
    } else applyReaction(defender, {kind: 'guardStun', duration: R.guardStun});   // só sem stun ativo; grava stunMax e não troca o estado
  } else {
    defender.counterWindow = 0;const closing = Math.max(0, dot(relative, normal)) * (attacker.action.impactMult ?? 1);   // impactMult: velocidade de impacto do Move (Bullet Punch)
    // Redução de knockback pelos estágios de Defesa (R6.11)
    const defStageKnockbackMult = Math.max(0, 1.0 - (defender.stages?.defense ?? 0) * (C.map?.stageDefenseReduction ?? 0.10));
    const kbo = attacker.action.kb;   // Moves que viram Tackle com knockback próprio {horizontal, vertical} em m/s (Lunge, Quick Attack…)
    const launchSpeed = kbo ? kbo.horizontal * stat(defender, 'knockbackTaken', 1) * defStageKnockbackMult : (R.launchHorizontal * (X.launchAttackBase + X.launchAttackWeight * attack / X.launchAttackReference) + Math.min(X.launchClosingCap, closing * X.launchClosingMultiplier)) * stat(defender, 'knockbackTaken', 1) * defStageKnockbackMult;
    const toward = normalize(sub(defender.position, attacker.position));
    const departure = normalize(add(scale(normal, X.launchNormalWeight), scale(toward, X.launchCenterWeight)));
    // Meteor slam: o rival é lançado para CIMA com groundBounceForce (ground bounce) e com pouco empurrão horizontal.
    const slam = !!attacker.action.slam, up = slam ? R.groundBounceForce : (kbo ? kbo.vertical : R.launchUp) * stat(defender, 'knockbackTaken', 1) * defStageKnockbackMult, hSpeed = launchSpeed * (slam ? R.slamLaunchHorizontal : 1) * knockbackFactor(defender);
    defender.lastAttacker = attacker.id;
    if (T.enableLaunch && kbo && !slam) {const dir = length(departure) > 1e-7 ? departure : normal;const r = applyReaction(defender, {kind: 'knockback', direction: dir, horizontal: hSpeed, vertical: up});if (r) {launchInfo = {direction: r.direction, horizontal: r.horizontal, vertical: r.vertical};displacementPolicy = r.policy;}}   // knockback próprio: com V = 0 é empurrão, não voo
    else if (T.enableLaunch) {const dir = slam ? direction(attacker.facing) : length(departure) > 1e-7 ? departure : normal;const r = applyReaction(defender, {kind: 'impulse', direction: dir, horizontal: hSpeed, vertical: up, bounce: slam});launchInfo = {direction: r.direction, horizontal: hSpeed, vertical: up, ...(slam ? {bounce: true} : {})};displacementPolicy = 'impulse';}
    else {
      applyReaction(defender, {kind: 'hitstun', duration: R.hitstun ?? R.guardStun ?? 0.2, countHit: false});   // o hitSerial vem do dano, logo abaixo
    }
  }
  if (defender.hp === 0) {defender.guard = false;defender.guardSuppressed = true;}
  if (damage > 0) {attacker.comboLeft = Math.max(attacker.comboLeft ?? 0, C.rules.comboWindow ?? 0);defender.hitSerial = (defender.hitSerial ?? 0) + 1;}   // acertou um golpe corpo a corpo: abre a janela de combo
  return {attacker: attacker.id, target: defender.id, result: perfect ? 'perfect' : protectedFront ? 'partial' : 'impact', damage, ...damageEventFields(dmgResult), normal: {...normal}, launch: launchInfo, displacementPolicy, contact: 'tackle', ...(dmgResult.sturdy ? {sturdy: true} : {}), ...(attacker.action.slam ? {slam: true} : {}), ...(attacker.action.riposteStrike ? {riposte: true} : {}), ...(protectedFront && !perfect && isGuardBreak ? {guardBreak: true, broken: true, stun: defender.stun} : {})};
}
/**
 * Footstool (Plano D, Etapa 3): pisar na cabeça do adversário vindo de cima com o salto normal.
 * Não é tackle nem Move: é uma interação de movimento/colisão física, simétrica para os dois lados.
 * Contratos: dano 5 HP em alvo desprotegido pelo pipeline central (escudo absorve primeiro; estágios de
 * defesa reduzem — "desprotegido" = sem escudo/estágios), stagger REAL por stun (afeta permissões de ação e
 * movimento; sem reuso de counterStagger, que é semântica de disputa de Power Level), zero knockback/launch,
 * zero stamina, ação em curso interrompida. Contato superior ignora a defesa frontal D (o golpe vem de cima).
 * Invulnerabilidade é respeitada: o atacante ainda rebate (a física aplica o impulso), mas sem dano/stagger.
 */
export function resolveFootstool(attacker, defender) {
  const M = C.map ?? {};
  if (isInvulnerable(defender)) {
    return {attacker: attacker.id, target: defender.id, result: 'invulnerable', damage: 0, contact: 'footstool'};
  }
  const dmgResult = resolveDamage({target: defender, attacker, rawDamage: M.footstoolDamage ?? 5, sourceKind: 'direct', contact: 'footstool'});
  defender.lastAttacker = attacker.id;
  const stagger = M.footstoolStagger ?? 0.25;
  // Stagger real + interrupção pelas vias normais de golpe: ação/carga caem, velocidades zeram, sem launch e sem push.
  applyReaction(defender, {kind: 'stagger', duration: stagger});
  if (defender.tackleCharge) {defender.tackleCharge = null;if (defender.state === 'tackleCharge') defender.state = 'neutral';}
  if (defender.charge) defender.charge = null;   // interrompe a carga do Move (golpe sofrido; a devolução é do failMove)
  if (defender.hp === 0) {defender.guard = false;defender.guardSuppressed = true;}
  const footstoolNormal = {x: 0, y: -1, z: 0};
  const footstoolPos = {x: defender.position.x, y: (defender.groundY ?? 0) + (defender.attributes?.height ?? 1.2), z: defender.position.z};
  return {attacker: attacker.id, target: defender.id, result: 'footstool', damage: dmgResult.hpDamage, ...damageEventFields(dmgResult), contact: 'footstool', stagger, normal: footstoolNormal, position: footstoolPos, x: footstoolPos.x, y: footstoolPos.y, z: footstoolPos.z, ...(dmgResult.sturdy ? {sturdy: true} : {})};
}
