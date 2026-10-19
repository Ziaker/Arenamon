// Resolução de contatos ofensivos: lançamento, clash, invulnerabilidade, defesa parcial/perfeita.
import {C} from './config.js';
import {isInvulnerable, isOffensive} from './entity.js';
import {stat} from './status.js';
import {vec, add, scale, sub, dot, length, normalize, angleOf, direction} from './math.js';

/** Coloca o lutador em voo balístico (o eixo horizontal é integrado pela física). */
export function launch(f, away, horizontal, vertical) {
  const n = normalize(away);
  f.flight = {y: 0, vy: vertical, horizontal: scale(n, horizontal)};
  f.action = null;f.push = null;f.blend = null;f.velocity = vec();f.locomotionVelocity = vec();
  f.guard = false;f.guardSuppressed = true;f.knockRecovery = 0;f.vaultHeight = 0;f.counterWindow = 0;f.landingSlide = null;f.state = 'airborne';
  f.tech = null;f.techDodge = null;
}
/** Empurrão no chão (sem voo): o lutador desliza para longe do contato e fica em recuperação curta. */
export function pushAway(f, away, distance, duration) {
  const n = normalize(away);
  f.push = {direction: n, distance, elapsed: 0, duration};
  f.action = null;f.flight = null;f.velocity = vec();f.locomotionVelocity = vec();f.blend = null;f.guard = false;f.guardSuppressed = true;
  f.vaultHeight = 0;f.counterWindow = 0;f.landingSlide = null;f.knockRecovery = C.rules.landingRecovery;f.recoveryFrom = null;f.tech = null;f.techDodge = null;f.state = 'landing';
}
export function clashPossible(a, b, normal, relative) {
  const X = C.extras.combat;
  if (!C.extras.toggles.enableClash || a.action?.kind !== 'tackle' || b.action?.kind !== 'tackle' || a.flight || b.flight) return false;
  if (C.extras.toggles.enableAnimationCombatWindows && (!isOffensive(a) || !isOffensive(b))) return false;
  return dot(direction(a.action.heading), normal) > X.clashFacingAlignment && dot(direction(b.action.heading), normal) < -X.clashFacingAlignment && dot(relative, normal) > X.clashClosingSpeed;
}
/** X contra X: os dois recebem dano e são lançados (ou, com enableClashPush, empurrados no chão) em direções opostas (ignora invulnerabilidade). */
export function clash(a, b, normal) {
  const R = C.rules, toA = stat(b, 'attack', b.attributes.attack) * R.clashFraction * stat(a, 'damageTaken', 1), toB = stat(a, 'attack', a.attributes.attack) * R.clashFraction * stat(b, 'damageTaken', 1);
  a.hp = Math.max(0, a.hp - toA);b.hp = Math.max(0, b.hp - toB);
  const push = !!C.extras.toggles.enableClashPush;
  if (push) {pushAway(a, scale(normal, -1), R.clashPushDistance, R.clashPushDuration);pushAway(b, normal, R.clashPushDistance, R.clashPushDuration);}
  else {launch(a, scale(normal, -1), R.clashHorizontal, R.clashUp);launch(b, normal, R.clashHorizontal, R.clashUp);}
  return [{attacker: a.id, target: b.id, result: 'clash', damage: toB, normal: {...normal}, push}, {attacker: b.id, target: a.id, result: 'clash', damage: toA, normal: scale(normal, -1), push}];
}
/** O tackle do atacante conecta no defensor, dado a normal e a velocidade relativa do contato? */
export function tackleConnects(attacker, defender, normal, relative) {
  const X = C.extras.combat;
  if (attacker.action?.kind !== 'tackle' || attacker.action.neutralized || attacker.flight || defender.flight) return false;   // neutralizado por um Counter de PL superior: não conecta mais nesta ação
  const dir = direction(attacker.action.heading), off = sub(defender.position, attacker.position);
  const towards = length(off) > 1e-6 ? normalize(off) : normal;
  return dot(dir, towards) > X.tackleTargetAlignment && dot(dir, normal) > X.tackleNormalAlignment && dot(relative, normal) > X.tackleClosingSpeed;
}
/** Resolve um tackle conectado. Devolve o evento ou null. */
export function resolveHit(attacker, defender, normal, relative) {
  const R = C.rules, X = C.extras.combat, T = C.extras.toggles;
  if (!tackleConnects(attacker, defender, normal, relative) || defender.hp <= 0) return null;

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
  const attack = stat(attacker, 'attack', attacker.attributes.attack), damage = perfect ? 0 : attack * (protectedFront ? X.guardDamageMultiplier : 1) * stat(defender, 'damageTaken', 1);
  defender.hp = Math.max(0, defender.hp - damage);
  let launchInfo = null;
  if (protectedFront) {
    // O atacante recua; a defesa NÃO lança, empurra nem desloca o defensor.
    attacker.action = {kind: 'recoil', elapsed: 0, heading: angleOf(scale(normal, -1)), startAngle: 0, offensive: false, hits: new Set(), from: null};
    attacker.velocity = vec();attacker.state = 'recoil';attacker.blend = null;attacker.vaultHeight = 0;
    defender.push = null;defender.flight = null;defender.velocity = vec();defender.locomotionVelocity = vec();
    if (perfect) {defender.perfectSucceeded = true;defender.stun = 0;if (T.enableCounterBonus) defender.counterWindow = Math.max(defender.counterWindow, X.perfectGuardCounterWindow);}
    else if (defender.stun <= 1e-8) defender.stun = R.guardStun;
  } else {
    defender.counterWindow = 0;const closing = Math.max(0, dot(relative, normal));
    const launchSpeed = (R.launchHorizontal * (X.launchAttackBase + X.launchAttackWeight * attack / X.launchAttackReference) + Math.min(X.launchClosingCap, closing * X.launchClosingMultiplier)) * stat(defender, 'knockbackTaken', 1);
    const toward = normalize(sub(defender.position, attacker.position));
    const departure = normalize(add(scale(normal, X.launchNormalWeight), scale(toward, X.launchCenterWeight)));
    if (T.enableLaunch) {const dir = length(departure) > 1e-7 ? departure : normal;launch(defender, dir, launchSpeed, R.launchUp * stat(defender, 'knockbackTaken', 1));launchInfo = {direction: normalize(dir), horizontal: launchSpeed, vertical: R.launchUp};}
    else {defender.action = null;defender.knockRecovery = R.landingRecovery;}
  }
  if (defender.hp === 0) {defender.guard = false;defender.guardSuppressed = true;}
  return {attacker: attacker.id, target: defender.id, result: perfect ? 'perfect' : protectedFront ? 'partial' : 'impact', damage, normal: {...normal}, launch: launchInfo};
}
