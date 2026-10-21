// Resolução de contatos ofensivos: lançamento, clash, invulnerabilidade, defesa parcial/perfeita.
import {C} from './config.js';
import {isInvulnerable, isOffensive} from './entity.js';
import {stat} from './status.js';
import {vec, add, scale, sub, dot, length, normalize, angleOf, direction} from './math.js';

import {processDamageWithShieldAndStages} from './map.js';
import {knockbackFactor} from './passive-engine.js';

/** Coloca o lutador em voo balístico (o eixo horizontal é integrado pela física).
 * A altitude inicial preserva o voo em curso (juggle) ou a elevação atual (vault de C): mudar de estado nunca
 * descarta a posição vertical sem causa física (contrato de continuidade espacial da infraestrutura 3D). */
export function launch(f, away, horizontal, vertical) {
  const n = normalize(away);
  const startY = f.flight ? (f.flight.y ?? 0) : (f.groundY ?? 0) + (f.vaultHeight ?? 0);
  f.flight = {y: startY, vy: vertical, horizontal: scale(n, horizontal)};
  f.launchedByHit = true;   // Inner Focus: só lançamento por golpe (edge-fall/jump não passa por aqui) reduz o hit stun
  f.action = null;f.push = null;f.blend = null;f.velocity = vec();f.locomotionVelocity = vec();
  f.guard = false;f.guardSuppressed = true;f.knockRecovery = 0;f.vaultHeight = 0;f.counterWindow = 0;f.landingSlide = null;f.state = 'airborne';
  f.tech = null;f.techDodge = null;f.wallSplat = null;
}
/** Empurrão no chão (sem voo): o lutador desliza para longe do contato e fica em recuperação curta. */
export function pushAway(f, away, distance, duration) {
  const n = normalize(away);
  f.push = {direction: n, distance, elapsed: 0, duration};
  f.action = null;f.flight = null;f.velocity = vec();f.locomotionVelocity = vec();f.blend = null;f.guard = false;f.guardSuppressed = true;
  f.vaultHeight = 0;f.counterWindow = 0;f.landingSlide = null;f.knockRecovery = C.rules.landingRecovery;f.recoveryFrom = null;f.tech = null;f.techDodge = null;f.state = 'landing';
}
/** Preparação do meteor slam (no ar, jogado para cima): sem dano, sem clash, sem knockback. */
const slamPrep = f => !!f.action?.slam && !f.action.slamPrepDone;
/** Velocidade do deslize (m/s) do empurrão aplicado no defensor que bloqueia o meteor slam. A duração do deslize = distância ÷ esta velocidade. */
const SLAM_BLOCK_PUSH_SPEED = 12;
export function clashPossible(a, b, normal, relative) {
  const X = C.extras.combat;
  if (slamPrep(a) || slamPrep(b)) return false;
  if (!C.extras.toggles.enableClash || a.action?.kind !== 'tackle' || b.action?.kind !== 'tackle' || a.flight || b.flight) return false;
  if (C.extras.toggles.enableAnimationCombatWindows && (!isOffensive(a) || !isOffensive(b))) return false;
  const facing = dot(direction(a.action.heading), normal) > X.clashFacingAlignment && dot(direction(b.action.heading), normal) < -X.clashFacingAlignment && dot(relative, normal) > X.clashClosingSpeed;
  if (!facing) return false;
  // Power Levels diferentes: não há clash. O PL maior vence a disputa (o de baixo é neutralizado e só o dele conecta, pelo fluxo normal de acerto).
  const pa = a.action.pl ?? 1, pb = b.action.pl ?? 1;
  if (pa !== pb) {const loser = pa > pb ? b : a;loser.action.neutralized = true;loser.action.invulnerableFor = 0;loser.plDefeated = true;return false;}   // o derrotado perde a invulnerabilidade do início do tackle: o golpe do vencedor conecta
  return true;
}
/**
 * Dois tackles que conectam um no outro no mesmo contato sem chegar ao clash frontal (mira entre tackleTargetAlignment e
 * clashFacingAlignment): sem isso, o primeiro da lista lançava o rival e o contra-golpe deste nunca era avaliado (vantagem de índice).
 * Vale como clash: mesma resolução simétrica.
 */
export function mutualTackle(a, b, normal, relative) {
  if (slamPrep(a) || slamPrep(b)) return false;
  if (!C.extras.toggles.enableClash || a.flight || b.flight || a.action?.kind !== 'tackle' || b.action?.kind !== 'tackle') return false;
  if (C.extras.toggles.enableAnimationCombatWindows && (!isOffensive(a) || !isOffensive(b))) return false;
  if (a.action.hits?.has(b.id) || b.action.hits?.has(a.id)) return false;
  return tackleConnects(a, b, normal, relative) && tackleConnects(b, a, scale(normal, -1), scale(relative, -1));
}
/** X contra X: os dois recebem dano e são lançados (ou, com enableClashPush, empurrados no chão) em direções opostas (ignora invulnerabilidade). */
export function clash(a, b, normal) {
  const R = C.rules;
  const atkMultB = 1 + (b.stages?.attack ?? 0) * (C.map?.stageAttackBonus ?? 0.10);
  const atkMultA = 1 + (a.stages?.attack ?? 0) * (C.map?.stageAttackBonus ?? 0.10);
  const rawToA = stat(b, 'attack', b.attributes.attack) * atkMultB * R.clashFraction * stat(a, 'damageTaken', 1);
  const rawToB = stat(a, 'attack', a.attributes.attack) * atkMultA * R.clashFraction * stat(b, 'damageTaken', 1);
  const resA = processDamageWithShieldAndStages(a, rawToA, b, false, false, {category: 'direct', contact: 'clash'});
  const resB = processDamageWithShieldAndStages(b, rawToB, a, false, false, {category: 'direct', contact: 'clash'});
  const push = !!C.extras.toggles.enableClashPush;a.lastAttacker = b.id;b.lastAttacker = a.id;
  if (push) {pushAway(a, scale(normal, -1), R.clashPushDistance, R.clashPushDuration);pushAway(b, normal, R.clashPushDistance, R.clashPushDuration);}
  else {launch(a, scale(normal, -1), R.clashHorizontal, R.clashUp);launch(b, normal, R.clashHorizontal, R.clashUp);}
  return [{attacker: a.id, target: b.id, result: 'clash', damage: resB.hpDamage, shieldAbsorbed: resB.absorbedByShield, normal: {...normal}, push, contact: 'clash', ...(resB.sturdy ? {sturdy: true} : {})},
    {attacker: b.id, target: a.id, result: 'clash', damage: resA.hpDamage, shieldAbsorbed: resA.absorbedByShield, normal: scale(normal, -1), push, contact: 'clash', ...(resA.sturdy ? {sturdy: true} : {})}];
}
/** O tackle do atacante conecta no defensor, dado a normal e a velocidade relativa do contato? */
export function tackleConnects(attacker, defender, normal, relative) {
  const X = C.extras.combat;
  if (slamPrep(attacker)) return false;
  if (attacker.action?.kind !== 'tackle' || attacker.action.neutralized || attacker.flight || (defender.flight && !defender.wallSplat)) return false;
  // Volume tridimensional real (R7.11-R7.12): não conecta se separados verticalmente fora do meteor slam
  const attY = (attacker.groundY ?? 0) + (attacker.flight?.y ?? attacker.vaultHeight ?? 0);
  const defY = (defender.groundY ?? 0) + (defender.flight?.y ?? defender.vaultHeight ?? 0);
  if (Math.abs(attY - defY) > (C.extras?.visual?.bodyHeight ?? 1.2) && !attacker.action?.slam) return false;

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
  const R = C.rules;
  if (vKb > 1e-6 || target.flight) {launch(target, dir, hKb, vKb);return {direction: normalize(dir), horizontal: hKb, vertical: vKb};}
  if (hKb > 0) {
    target.action = null;target.flight = null;target.blend = null;target.guard = false;target.guardSuppressed = true;target.velocity = vec();target.locomotionVelocity = vec();
    target.push = {direction: dir, distance: Math.max(0.45, hKb * 1.5), elapsed: 0};target.knockRecovery = Math.max(target.knockRecovery, R.landingRecovery);target.state = 'pushed';
    return {direction: normalize(dir), horizontal: hKb, vertical: 0};
  }
  return null;
}
/** Resolve um tackle conectado. Devolve o evento ou null. */
export function resolveHit(attacker, defender, normal, relative, force = false) {
  const R = C.rules, X = C.extras.combat, T = C.extras.toggles;
  if ((!force && !tackleConnects(attacker, defender, normal, relative)) || defender.hp <= 0) return null;

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
    if (attacker.action.hits.has(defender.id)) return null;
  }
  // Hitbox espacial (extras.hitbox.enableShapes): a janela ativa decide a forma; meteor slam (force) não usa forma.
  if (!force && !hitShapeAllows(attacker, defender, windowIdx)) return null;

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
  const dmgResult = processDamageWithShieldAndStages(defender, rawDamage, attacker, protectedFront, perfect, {category: 'direct', contact: 'tackle'});
  const damage = dmgResult.hpDamage;

  let launchInfo = null;
  if (protectedFront) {
    // O atacante recua; a defesa NÃO lança, empurra nem desloca o defensor.
    // Exceção (Meteor Slam): o ataque é comprometido — o contato pode ocorrer no mergulho
    // (meteorDive) ou no chão (meteorGround). Em ambos, bloqueado não troca para recoil:
    // o mergulho segue, aterrissa e o slam finaliza normalmente.
    const slamCommitted = !!attacker.action.slam;
    if (!slamCommitted && !attacker.action.keepOnBlock) {   // keepOnBlock: Moves que seguem a própria sequência mesmo bloqueados (Quick Attack: o retorno acontece de qualquer jeito)
      attacker.action = {kind: 'recoil', elapsed: 0, heading: angleOf(scale(normal, -1)), startAngle: 0, offensive: false, hits: new Set(), from: null};
      attacker.velocity = vec();attacker.state = 'recoil';attacker.blend = null;attacker.vaultHeight = 0;
    }
    if (slamCommitted && !perfect) {
      // Slam bloqueado (parcial): o defensor é arrastado para trás DESLIZANDO no chão (sem lançamento),
      // afastado pela distância configurável (slider 3–10 m). Defesa perfeita mantém o defensor no lugar
      // (fica com a vantagem do contra-ataque).
      pushAway(defender, length(normal) > 1e-8 ? normal : direction(attacker.facing), R.slamBlockPushDistance, R.slamBlockPushDistance / SLAM_BLOCK_PUSH_SPEED);
    } else {
      defender.push = null;defender.flight = null;defender.velocity = vec();defender.locomotionVelocity = vec();
    }
    if (perfect) {defender.perfectSucceeded = true;defender.stun = 0;if (T.enableCounterBonus) defender.counterWindow = Math.max(defender.counterWindow, X.perfectGuardCounterWindow);}
    else if (defender.stun <= 1e-8) defender.stun = R.guardStun;
  } else {
    defender.counterWindow = 0;const closing = Math.max(0, dot(relative, normal));
    // Redução de knockback pelos estágios de Defesa (R6.11)
    const defStageKnockbackMult = Math.max(0, 1.0 - (defender.stages?.defense ?? 0) * (C.map?.stageDefenseReduction ?? 0.10));
    const kbo = attacker.action.kb;   // Moves que viram Tackle com knockback próprio {horizontal, vertical} em m/s (Lunge, Quick Attack…)
    const launchSpeed = kbo ? kbo.horizontal * stat(defender, 'knockbackTaken', 1) * defStageKnockbackMult : (R.launchHorizontal * (X.launchAttackBase + X.launchAttackWeight * attack / X.launchAttackReference) + Math.min(X.launchClosingCap, closing * X.launchClosingMultiplier)) * stat(defender, 'knockbackTaken', 1) * defStageKnockbackMult;
    const toward = normalize(sub(defender.position, attacker.position));
    const departure = normalize(add(scale(normal, X.launchNormalWeight), scale(toward, X.launchCenterWeight)));
    // Meteor slam: o rival é lançado para CIMA com groundBounceForce (ground bounce) e com pouco empurrão horizontal.
    const slam = !!attacker.action.slam, up = slam ? R.groundBounceForce : (kbo ? kbo.vertical : R.launchUp) * stat(defender, 'knockbackTaken', 1) * defStageKnockbackMult, hSpeed = launchSpeed * (slam ? R.slamLaunchHorizontal : 1) * knockbackFactor(defender);
    defender.lastAttacker = attacker.id;
    if (T.enableLaunch && kbo && !slam) {const dir = length(departure) > 1e-7 ? departure : normal;launchInfo = knockbackReaction(defender, dir, hSpeed, up);}   // knockback próprio: com V = 0 é empurrão, não voo
    else if (T.enableLaunch) {const dir = slam ? direction(attacker.facing) : length(departure) > 1e-7 ? departure : normal;launch(defender, dir, hSpeed, up);launchInfo = {direction: normalize(dir), horizontal: hSpeed, vertical: up, ...(slam ? {bounce: true} : {})};}
    else {defender.action = null;defender.knockRecovery = R.landingRecovery;}
  }
  if (defender.hp === 0) {defender.guard = false;defender.guardSuppressed = true;}
  return {attacker: attacker.id, target: defender.id, result: perfect ? 'perfect' : protectedFront ? 'partial' : 'impact', damage, shieldAbsorbed: dmgResult.absorbedByShield, normal: {...normal}, launch: launchInfo, contact: 'tackle', ...(dmgResult.sturdy ? {sturdy: true} : {}), ...(attacker.action.slam ? {slam: true} : {})};
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
  const dmgResult = processDamageWithShieldAndStages(defender, M.footstoolDamage ?? 5, attacker, false, false, {category: 'direct', contact: 'footstool'});
  defender.lastAttacker = attacker.id;
  const stagger = M.footstoolStagger ?? 0.25;
  defender.stun = Math.max(defender.stun ?? 0, stagger);
  // Interrupção pelas vias normais de golpe: ação/carga caem, velocidades zeram, sem launch e sem push.
  defender.action = null;defender.push = null;defender.blend = null;
  defender.velocity = vec();defender.locomotionVelocity = vec();
  defender.vaultHeight = 0;defender.counterWindow = 0;defender.landingSlide = null;
  defender.guard = false;defender.guardSuppressed = true;
  if (defender.tackleCharge) {defender.tackleCharge = null;if (defender.state === 'tackleCharge') defender.state = 'neutral';}
  if (defender.charge) defender.charge = null;   // interrompe a carga do Move (golpe sofrido; a devolução é do failMove)
  if (defender.hp === 0) {defender.guard = false;defender.guardSuppressed = true;}
  return {attacker: attacker.id, target: defender.id, result: 'footstool', damage: dmgResult.hpDamage, shieldAbsorbed: dmgResult.absorbedByShield, contact: 'footstool', stagger, ...(dmgResult.sturdy ? {sturdy: true} : {})};
}
