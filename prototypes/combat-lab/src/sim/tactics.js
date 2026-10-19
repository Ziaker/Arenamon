// IA tática (modo "tactical"). Os modos do v6 continuam em ai.js, intactos (paridade).
//
// Camadas:
// 1. Estilo de luta sorteado por partida (ou fixo pela personalidade), com traços variados a cada partida.
// 2. Percepção: ações do adversário só são percebidas após o tempo de reação, e pode haver leitura errada.
// 3. Leitura do adversário (adaptação): como ele responde aos nossos X (defende, esquiva, choca, apanha) e com que
//    frequência ataca. As escolhas seguintes mudam conforme essa leitura.
// 4. Decisão por pesos sorteados: aproximar, circular, segurar a distância, isca, atacar, atacar pelo flanco
//    (C → X), defender andando, encurralar ou recuar para recuperar stamina.
// 5. Respostas a ameaças com tempo estimado até o contato: defesa perfeita, defesa, esquiva lateral no momento da
//    invulnerabilidade (esquiva perfeita e contra-ataque), salto por cima, clash ou recuo para o X passar curto.
// 6. Punições: recuo, X que passou curto, fim da esquiva, aterrissagem e exaustão do adversário.
// 7. Humor e placar: apanhar deixa a IA mais agressiva ou mais cautelosa; quem perde arrisca mais.
//
// Toda a aleatoriedade sai do gerador da Brain: a mesma semente repete a luta, e sementes diferentes lutam diferente.
// O estado fica em `brain.t`, um objeto simples (serializável para replay e cenários).
import {C} from './config.js';
import {emptyCommand, nominalDistance} from './entity.js';
import {vec, add, scale, sub, dot, length, normalize, direction, clamp} from './math.js';
import {actionProgress} from './motion.js';
import {cancelWindow, isDepleted, startPermission} from './controller.js';
import {chainOpen, actionSpec} from './entity.js';
import {initPerception, updatePerception} from './perception.js';
import {predictContact, canDefenseArrive, calculatePunishWindow, trackPredictionAccuracy} from './prediction.js';
import {getCombatZones, safeArenaDirection, cornerPressureDirection, hysteresisDistance, okizemePlan, shouldSprintManaged} from './spatial.js';
import {valueBasedStamina, staminaComboBudget, trackStaminaEfficiency} from './economy.js';
import {selectDefenseResponse, postBlockDecision, canPunishSafely} from './defense.js';
import {initOpponentModel, recordOpponentDefense, recordOpponentAttack, recordOpponentStamina, recordOpponentCharge, evaluateCounterStrategy} from './opponent-model.js';
import {PLAN_TYPES, createPlan, shouldInterruptPlan, updatePlan} from './sequence-planner.js';
import {applyDifficultyProfile} from './difficulty.js';

/** Estilos de luta: alcance preferido, gosto por cada ação e disciplina. Valores de 0 a 1, salvo indicação. */
export const STYLES = [
  {id: 'rushdown', label: 'Agressor', range: .72, attack: 1, bait: .25, guard: .3, dodge: .35, clash: .65, cancel: .55, perfect: .3, punish: .8, reserve: 0, think: .1, corner: .8},
  {id: 'counter', label: 'Contra-atacante', range: 1.08, attack: .3, bait: .85, guard: .65, dodge: .45, clash: .12, cancel: .45, perfect: .8, punish: 1, reserve: 1, think: .16, corner: .3},
  {id: 'evasive', label: 'Esquivador', range: .98, attack: .5, bait: .45, guard: .15, dodge: 1, clash: .15, cancel: 1, perfect: .65, punish: .8, reserve: 1, think: .13, corner: .2},
  {id: 'turtle', label: 'Paredão', range: .9, attack: .28, bait: .3, guard: 1, dodge: .12, clash: .08, cancel: .2, perfect: .9, punish: .9, reserve: 1, think: .2, corner: .4},
  {id: 'opportunist', label: 'Oportunista', range: 1, attack: .45, bait: .55, guard: .5, dodge: .5, clash: .3, cancel: .55, perfect: .55, punish: 1, reserve: .8, think: .14, corner: .6},
  {id: 'chaotic', label: 'Imprevisível', range: .9, attack: .7, bait: .5, guard: .5, dodge: .7, clash: .5, cancel: .7, perfect: .4, punish: .6, reserve: .3, think: .08, corner: .5, chaos: 1},
];
export const styleLabel = brain => brain?.t?.style?.label ?? '—';

const ema = (old, value, rate) => old + (value - old) * rate;
const contactDistance = () => 2 * C.test.halfExtent;

/** Sorteio ponderado: entries = [[peso, valor], ...]. */
function pick(brain, entries) {
  const total = entries.reduce((s, [w]) => s + Math.max(0, w), 0);if (total <= 0) return entries[0][1];
  let r = brain.random() * total;for (const [w, v] of entries) {r -= Math.max(0, w);if (r <= 0) return v;}
  return entries.at(-1)[1];
}

/** Estado tático de uma partida: estilo sorteado e traços variados pela personalidade. */
function init(brain, P) {
  if (P?.difficultyTier) {
    P = applyDifficultyProfile(P, 'normal');
  }
  const fixed = Math.round(P.style ?? 0), base = fixed >= 1 && fixed <= STYLES.length ? STYLES[fixed - 1] : STYLES[Math.floor(brain.random() * STYLES.length)];
  const spread = .15 + .35 * (P.variation ?? .4), style = {...base};
  for (const k of ['range', 'attack', 'bait', 'guard', 'dodge', 'clash', 'cancel', 'perfect', 'punish', 'reserve', 'corner']) style[k] = clamp(base[k] * (1 + spread * (2 * brain.random() - 1)), 0, k === 'range' ? 1.3 : 1);
  style.think = base.think * (1 + spread * (2 * brain.random() - 1));
  return {
    style, time: 0, think: 0, intent: 'approach', intentUntil: 0, orbit: brain.random() < .5 ? -1 : 1, rangeDrift: 0,
    perception: initPerception(brain, P),
    // Percepção do adversário.
    oppKind: null, oppElapsed: 0, threat: null, punishAt: null,
    // Leitura do adversário (médias móveis; começam neutras).
    model: {guard: .33, dodge: .33, clash: .2, hit: .2, attackRate: .5, attackDist: null}, dangerPlan: null,
    opponentModel: initOpponentModel(),
    activeSequencePlan: null,
    myAttack: null, mood: 0, lastHp: null, plan: null, wasDodging: false, baitPhase: 0,
  };
}

/** Quanto o X do adversário ainda percorre (m) e o tempo estimado até o contato com `self` (s). */
function incoming(self, target, perception = null) {
  const a = target.action;if (a?.kind !== 'tackle') return null;
  const X = C.actions.tackle, toSelf = sub(self.position, target.position), d = length(toSelf);
  const along = d > 1e-6 ? dot(direction(a.heading), normalize(toSelf)) : 1;
  if (along < C.extras.ai.threatAlignment) return null;
  const u = clamp(a.elapsed / X.duration, 0, 1), left = nominalDistance(target, 'tackle') * (a.speedMultiplier ?? 1) * (1 - actionProgress(X, u));
  const lateral = Math.sqrt(Math.max(0, d * d - (d * along) ** 2)), gap = d - contactDistance();
  const reaches = left * along + .15 >= gap && lateral < contactDistance() + .2;
  const targetVel = perception?.apparentVel ?? target.velocity;
  const closing = Math.max(.5, dot(sub(targetVel, self.velocity), d > 1e-6 ? normalize(toSelf) : vec(0, 1)));
  return {reaches, tte: Math.max(0, gap) / closing, left, distance: d};
}

/** Lado (±1) para circular/esquivar que afasta da parede e, se encurralando, coloca o rival contra ela. */
function safeSide(self, forward, preferred) {
  const half = C.test.arenaHalf, side = s => vec(forward.z * s, -forward.x * s);
  const room = s => {const p = add(self.position, scale(side(s), 2.5));return Math.min(half - Math.abs(p.x), half - Math.abs(p.z));};
  return room(preferred) < 1.2 && room(-preferred) > room(preferred) ? -preferred : preferred;
}

/** Comando da IA tática. */
export function tacticalCommand(brain, self, target, dt, P) {
  const c = emptyCommand();c.target = target.id;
  const F = featuresOf(brain);
  if (F.difficulty && P?.difficultyTier) {
    P = applyDifficultyProfile(P, 'normal');
  }
  const t = brain.t ??= init(brain, P), S = t.style, A = C.actions, R = C.rules;
  t.time += dt;brain.cooldown = Math.max(0, brain.cooldown - dt);
  t.perception ??= initPerception(brain, P);
  updatePerception(t.perception, brain, self, target, dt, P, t.time);
  const diff = sub(target.position, self.position), distance = length(diff), forward = distance > 1e-6 ? normalize(diff) : direction(self.facing);
  if (F.opponentModel && t.opponentModel) {
    const oppExhausted = !!target.exhausted;
    const justExhausted = oppExhausted && !t.oppWasExhausted;
    t.oppWasExhausted = oppExhausted;
    recordOpponentStamina(t.opponentModel, target.stamina, oppExhausted, dt, justExhausted);

    if (target.charge) {
      t.oppChargingTime = (t.oppChargingTime ?? 0) + dt;
      t.oppHadCharge = true;
      t.oppLastCharge = target.charge;
    } else if (t.oppHadCharge) {
      const ch = t.oppLastCharge;
      const holdDuration = t.oppChargingTime ?? (ch.ticks ? ch.ticks * (ch.params?.step ?? (1/120)) : 0.5);
      const releasedAtMax = ch.params?.maxTicks ? (ch.ticks >= ch.params.maxTicks) : (holdDuration >= 1.5);
      recordOpponentCharge(t.opponentModel, holdDuration, releasedAtMax);
      t.oppHadCharge = false;
      t.oppChargingTime = 0;
      t.oppLastCharge = null;
    }
  }
  if (self.charge) {
    const oppTackle = (F.perception && t.perception)
      ? t.perception.observedAction === 'tackle'
      : target?.action?.kind === 'tackle';
    const away = distance > 1e-6 ? normalize(scale(diff, -1)) : direction(self.facing + Math.PI);
    const side = vec(away.z * (t.orbit ?? 1), -away.x * (t.orbit ?? 1));
    const canDodgeCancel = self.charge.ticks >= (self.charge.params?.dodgeLockTicks ?? 30) && !self.exhausted && self.stamina >= A.dodge.cost;

    // Evasão emergencial durante o Charge: se o rival iniciar um Tackle a caminho, cancela a carga com esquiva lateral
    if (oppTackle && distance < 4.2 && canDodgeCancel) {
      c.dodge = true;
      c.dodgeDirection = side;
      c.move = side;
      c.tackle = false;
      c.guard = false;
      c.guardPressed = false;
      brain.wasGuard = false;
      return finish(brain, c, self, target);
    }

    // Enquanto o lutador estiver executando uma carga: prioriza espaçamento/manutenção de distância e evita cancelar sem motivo
    c.move = distance < 4.5 ? away : normalize(add(scale(away, 0.4), scale(side, 0.8)));
    c.tackle = false;
    c.dodge = false;
    c.guard = false;
    c.guardPressed = false;
    brain.wasGuard = false;
    return finish(brain, c, self, target);
  }
  const myReach = contactDistance() + nominalDistance(self, 'tackle') * (.55 + .3 * S.range), oppReach = contactDistance() + nominalDistance(target, 'tackle') * .85;
  const affordTackle = !self.exhausted && self.stamina >= A.tackle.cost - 1e-6, affordDodge = !self.exhausted && self.stamina >= A.dodge.cost - 1e-6;
  const free = !self.action && self.knockRecovery <= 0 && !self.flight;
  // Evita gastar a última ação e ficar exausto, salvo em oportunidade clara (finalização, rival vulnerável, contra-ataque).
  // Revisão 1: só a finalização ou o contra-ataque justificam ficar exausto (punir a queda do rival não vale ~6 s exausto).
  const opening = target.hp <= self.attributes.attack * 1.05 || self.counterWindow > 0 || (!F.stamina && (target.knockRecovery > 0 || !!target.flight));
  const zones = F.spatial ? getCombatZones(self, target, S) : null;
  const predForValue = F.economy ? predictContact(self, target, 'tackle', F.perception ? t.perception : null, C.test.arenaHalf) : null;
  const valueDecision = (F.economy && predForValue) ? valueBasedStamina(self, target, 'tackle', predForValue, S) : null;
  const keepsStamina = (!isDepleted(self.stamina - A.tackle.cost) || opening || (!F.stamina && S.reserve < .2) || (F.economy && valueDecision?.allowed));
  const keepsDodge = !F.dodgeStamina || !isDepleted(self.stamina - A.dodge.cost) || opening;
  const canDash = free && affordTackle && keepsStamina, canDodge = free && affordDodge && keepsDodge;
  // Esquiva reativa que deixaria exausto vale menos: defender costuma ser melhor.
  const dodgeKeeps = isDepleted(self.stamina - A.dodge.cost) ? .3 : 1;
  const chaos = S.chaos ? .5 + brain.random() : 1;

  // ---------- Humor e placar ----------
  if (t.lastHp !== null && self.hp < t.lastHp - 1e-9) t.mood = clamp(t.mood + (brain.random() < .55 ? .45 : -.45), -1, 1);
  t.lastHp = self.hp;t.mood *= Math.exp(-dt / 4);
  const lead = self.hp / self.attributes.hp - target.hp / target.attributes.hp;
  // Pressão do tempo: lutas longas deixam todos os estilos mais ousados (evita duas defesas esperando para sempre).
  const urgency = clamp((t.time - 15) / 35, 0, 1) * .9;
  const boldness = clamp((P.aggression ?? .5) + .35 * t.mood - .5 * lead + (target.exhausted ? .3 : 0) + urgency, 0, 1.6);
  // Disciplina de stamina: C → X custa C + X; sobra a reserva do estilo para uma esquiva defensiva.
  // Orçamento do C → X pelo flanco: com a exaustão abaixo do menor custo, sobra uma ação para não ficar exausto.
  const flankBudget = A.dodge.cost + A.tackle.cost + (C.rules.exhaustMode === 1 ? Math.min(A.dodge.cost, A.tackle.cost) * (1 - .5 * (1 - S.reserve)) : 0) + S.reserve * .6 * A.dodge.cost;

  // ---------- Percepção das ações do adversário ----------
  const oppKind = (F.perception && t.perception)
    ? t.perception.observedAction
    : (target.action?.kind ?? (target.guard ? 'guard' : null));
  const restarted = target.action && oppKind && oppKind === t.oppKind && (target.action?.elapsed ?? 0) < t.oppElapsed - 1e-9;
  if (oppKind !== t.oppKind || restarted) {
    if (oppKind === 'tackle') {
      const attackDist = (F.perception && t.perception?.observedActionDistance != null)
        ? t.perception.observedActionDistance
        : distance;
      if (F.opponentModel && t.opponentModel) {
        recordOpponentAttack(t.opponentModel, attackDist, .25 * (P.adaptation ?? .5) + .05);
        t.model.attackDist = t.opponentModel.preferredAttackDistance;
      } else {
        // Aprende de que distância o adversário costuma atacar (para ficar logo fora dela).
        t.model.attackDist = t.model.attackDist === null ? attackDist : ema(t.model.attackDist, attackDist, .2 + .5 * (P.adaptation ?? .5));
      }
      t.model.attackRate = ema(t.model.attackRate, attackDist < oppReach + 1 ? 1 : .3, .25 * (P.adaptation ?? .5) + .05);
      const reaction = F.perception ? 0 : ((P.reaction ?? .15) + brain.random() * (P.reactionJitter ?? .1));
      const misread = F.perception ? (t.perception?.actionMisread ?? false) : (brain.random() < (P.mistake ?? .1));
      t.threat = {at: t.time + reaction, decided: false, misread, response: null};
    }
  }
  // Como o adversário respondeu ao nosso X (para adaptar as próximas escolhas): observa o estado dele durante a
  // janela de resposta, inclusive quem já estava defendendo antes do ataque.
  if (t.myAttack && t.time - t.myAttack.at < .45 && !t.myAttack.read && t.time - t.myAttack.at > .02) {
    const k = target.action?.kind;
    t.myAttack.read = k === 'dodge' ? 'dodge' : k === 'tackle' ? 'clash' : target.guard || target.stun > 0 ? 'guard' : null;
  }
  t.oppKind = oppKind;t.oppElapsed = target.action?.elapsed ?? 0;
  if (t.myAttack && t.time - t.myAttack.at >= .45) {
    const read = t.myAttack.read ?? 'hit', rate = .15 + .45 * (P.adaptation ?? .5);
    if (F.opponentModel && t.opponentModel) {
      recordOpponentDefense(t.opponentModel, read, rate);
    }
    for (const k of ['guard', 'dodge', 'clash', 'hit']) t.model[k] = ema(t.model[k], k === read ? 1 : 0, rate);
    t.myAttack = null;
  }
  if (target.action?.kind !== 'tackle') t.threat = null;

  // Direção do X: mira onde o adversário vai estar (antecipa o movimento dele com velocidade aparente observada).
  const lead_t = clamp(distance / 14, 0, .25), targetVel = (F.perception && t.perception) ? t.perception.apparentVel : target.velocity, aim = normalize(sub(add(target.position, scale(targetVel, lead_t)), self.position));
  const attack = (dir = aim, why = 'outro') => {c.move = dir;c.tackle = true;c.dodgeDirection = dir;t.myAttack = {at: t.time, read: null};t.why = why;brain.cooldown = .25 + (1 - boldness) * .5 * brain.random();};
  /**
   * Revisão 1: o X só sai se deve alcançar o adversário — posição dele no meio do tackle (velocidade atual) dentro do
   * deslocamento nominal (mais o contato). Evita gastar stamina em X que não tocam ninguém.
   */
  const reaches = () => {
    if (!F.reach) return true;
    const mid = A.tackle.duration * .5, oa = target.action, horizon = oa && oa.kind !== 'recoil' ? Math.min(mid, Math.max(0, actionSpec(oa).duration - (oa?.elapsed ?? 0)) * .5) : mid;
    const p = add(target.position, scale(target.velocity, horizon)), d = length(sub(p, self.position));
    const baseReaches = d <= contactDistance() + nominalDistance(self, 'tackle') * (self.counterWindow > 0 ? A.tackle.counterSpeed : 1) * .92;
    if (F.prediction) {
      const pred = predictContact(self, target, 'tackle', t.perception, C.test.arenaHalf);
      t.lastContactPrediction = pred;
      return baseReaches || (pred.contactChance >= 0.38 && (pred.punishRisk <= 0.85 || opening));
    }
    return baseReaches;
  };
  const sideOf = s => vec(forward.z * s, -forward.x * s);

  // ---------- 1. Durante a própria esquiva: C → X planejado ou contra-ataque ----------
  if (self.action?.kind === 'dodge') {
    // Revisão 1: esquiva que inicia um sprint: mantém C e a direção até o sprint começar.
    if (t.sprinting && F.sprint) {c.move = forward;c.dodgeHeld = true;t.wasDodging = true;return finish(brain, c, self, target);}
    const K = A.cancel, el = self.action.elapsed, [w0, w1] = cancelWindow(), cancelOpen = K.dodgeToTackle && ((K.perfectAnytime && self.counterWindow > 0) || (el >= w0 && el <= w1)) && affordTackle
      && (!F.stamina || self.counterWindow > 0 || !isDepleted(self.stamina - A.tackle.cost)) && reaches();
    if (cancelOpen && (self.counterWindow > 0 || (t.plan?.cancelAt !== undefined && el >= t.plan.cancelAt)) && distance < myReach + (self.counterWindow > 0 && F.counter ? 1.5 : 1.2) && !target.flight) {attack(aim, 'cancel');t.plan = null;}
    t.wasDodging = true;
    return finish(brain, c, self, target);
  }
  if (t.wasDodging) {t.wasDodging = false;t.plan = null;if (!self.sprinting) t.sprinting = false;}
  // Contra-ataque fortalecido depois de esquiva ou defesa perfeita.
  // Revisão 1: a janela de contra-ataque (esquiva ou defesa perfeita) é sempre aproveitada quando o X alcança.
  if (self.counterWindow > 0 && canDash && distance < myReach + 1.5 && (F.counter ? reaches() : brain.random() < .35 + .6 * S.punish)) {attack(aim, 'counter');return finish(brain, c, self, target);}

  // ---------- 2. Ameaça percebida ----------
  const inc = incoming(self, target, F.perception ? t.perception : null), th = t.threat;
  if (inc && th && t.time >= th.at && !th.misread) {
    if (!th.decided) {
      th.decided = true;
      const perfectReady = self.perfectCooldown <= 0, m = t.model;
      if (!inc.reaches) th.response = 'whiff';
      else if (F.defense) {
        const defDec = selectDefenseResponse(self, target, inc, S, P, t.defenseHistory ?? [], () => brain.random());
        th.response = defDec.response;
        (t.defenseHistory ??= []).push(th.response);
        if (t.defenseHistory.length > 5) t.defenseHistory.shift();
      } else {
        th.response = pick(brain, [
          [S.guard * (perfectReady ? S.perfect : .3) * 1.2, 'perfectGuard'], [S.guard * (1 - .5 * S.perfect), 'guard'],
          [canDodge || affordDodge ? S.dodge * (.6 + S.perfect) * dodgeKeeps : 0, 'sidestep'], [canDodge || affordDodge ? S.dodge * .35 * chaos * dodgeKeeps : 0, 'vault'],
          [canDash || affordTackle ? S.clash * (self.attributes.attack >= target.attributes.attack ? 1.2 : .7) * (lead < 0 ? 1.3 : .8) * (1 + m.hit) : 0, 'clash'],
          [.15 * (1 - S.guard), 'backstep'],
        ]);
        if (F.prediction) {
          const perfCheck = canDefenseArrive(self, inc.tte, 'perfectGuard');
          const guardCheck = canDefenseArrive(self, inc.tte, 'guard');
          const dodgeCheck = canDefenseArrive(self, inc.tte, 'dodge');
          if (th.response === 'perfectGuard' && !perfCheck.canArrive) {
            th.response = guardCheck.canArrive ? 'guard' : (dodgeCheck.canArrive ? 'sidestep' : 'backstep');
          }
        }
      }
      th.dodgeAt = A.dodge.invulnerable * (.35 + .55 * brain.random() * (1.4 - S.perfect));
    }
    const r = th.response, perfectAt = R.perfect * (.35 + .4 * S.perfect);
    if (r === 'whiff') {c.move = scale(forward, -.6);t.punishAt = t.time;}
    else if (r === 'perfectGuard') {
      if (inc.tte <= perfectAt) {
        c.guard = true;
        c.guardPressed = true;
      } else if (!brain.wasGuard) {
        c.move = scale(forward, -.1);
      } else {
        c.guard = true;
        c.move = scale(forward, -.2);
      }
    } else if (r === 'guard') {c.guard = true;c.move = scale(forward, -.2);}
    else if (r === 'sidestep' || r === 'vault') {
      if (inc.tte <= th.dodgeAt + dt && canDodge) {
        const dir = r === 'vault' ? forward : sideOf(safeSide(self, forward, t.orbit));
        c.dodge = true;c.move = dir;c.dodgeDirection = dir;
        // Planeja o C → X: sai da esquiva no flanco do adversário.
        if (brain.random() < S.cancel) {const [w0, w1] = cancelWindow();t.plan = {cancelAt: w0 + (.12 + .2 * brain.random()) * (w1 - w0)};}
      } else if (!canDodge && inc.tte < .25) c.guard = true;
    } else if (r === 'clash') {if (canDash && inc.tte < .3) attack(forward, 'clash');else c.guard = !canDash && !affordTackle;}
    else if (r === 'backstep') c.move = scale(forward, -1);
    return finish(brain, c, self, target);
  }
  if (inc && inc.reaches && th && th.misread && inc.tte < .08 && S.guard > .6 && brain.random() < .3) c.guard = true; // reflexo tardio

  // ---------- 3. Punições ----------
  const counterStrat = F.opponentModel && t.opponentModel ? evaluateCounterStrategy(t.opponentModel, S) : null;
  t.lastCounterStrat = counterStrat;
  const oppAct = (F.perception && t.perception) ? t.perception.observedAction : target.action?.kind;
  const punish = (cond, prob) => {
    if (!cond || !canDash || brain.cooldown > 0 || !reaches()) return false;
    if (F.defense && F.prediction) {
      const pw = calculatePunishWindow(target);
      const cp = t.lastContactPrediction ?? predictContact(self, target, 'tackle', t.perception, C.test.arenaHalf);
      const safe = canPunishSafely(self, target, pw, cp);
      if (safe.canPunish || cond) {
        return brain.random() < Math.min(0.95, prob * 1.4 * (.4 + .6 * S.punish));
      }
      return false;
    }
    if (F.prediction) {
      return brain.random() < Math.min(0.95, prob * 1.3 * (.4 + .6 * S.punish));
    }
    return brain.random() < prob * (.4 + .6 * S.punish);
  };
  const oppElapsed = target.action?.elapsed ?? t.oppElapsed ?? 0;
  if (punish(oppAct === 'recoil' && distance < myReach, .5)) {attack(aim, 'punishRecoil');return finish(brain, c, self, target);}
  if (punish(oppAct === 'tackle' && !inc?.reaches && oppElapsed > A.tackle.duration * .55 && distance < myReach, .35)) {attack(aim, 'punishWhiff');return finish(brain, c, self, target);}
  const dodgeElapsedThreshold = counterStrat?.delayAttack ? A.dodge.duration * .68 : A.dodge.duration * .6;
  if (punish(oppAct === 'dodge' && oppElapsed > dodgeElapsedThreshold && distance < myReach, .3)) {attack(aim, 'punishDodge');return finish(brain, c, self, target);}
  const oppIsCharging = (F.perception && t.perception) ? !!t.perception.observedCharge : !!target.charge;
  if (counterStrat?.rushdownCharge && oppIsCharging && canDash && distance < myReach + 1.2 && brain.cooldown <= 0 && reaches()) {
    attack(aim, 'punishCharge');
    return finish(brain, c, self, target);
  }
  if (target.knockRecovery > 0 && !target.flight) {
    // Chega no tempo exato em que o adversário se levanta.
    const arrive = Math.max(0, distance - contactDistance()) / Math.max(4, nominalDistance(self, 'tackle') / A.tackle.duration);
    if (canDash && target.knockRecovery <= arrive + .03 && distance < myReach && brain.random() < .35 + .6 * S.punish && reaches()) {
      attack(aim, 'punishLanding');
      return finish(brain, c, self, target);
    }
    c.move = distance > myReach * .8 ? forward : vec();
    return finish(brain, c, self, target);
  } else if (target.flight) {
    if (F.spatial) {
      const oki = okizemePlan(self, target, C.test.arenaHalf);
      if (length(oki.moveDir) > 0.1) {
        c.move = oki.moveDir;
        return finish(brain, c, self, target);
      }
    }
    // Espera perto do ponto de queda previsto, fora do alcance imediato.
    const land = add(target.position, scale(target.flight.horizontal, Math.max(0, 2 * target.flight.vy / C.rules.launchGravity) * .7));
    const want = add(land, scale(normalize(sub(self.position, land)), myReach * .75)), go = sub(want, self.position);
    c.move = length(go) > .3 ? normalize(go) : vec();
    return finish(brain, c, self, target);
  }

  // ---------- Sprint (revisão 1 e 2): encurta distância longa sem gastar a reserva ----------
  if (F.sprint && C.extras.toggles.enableSprint) {
    const S2 = A.sprint, budget = A.dodge.cost + A.tackle.cost + S2.staminaDrain * .8 + .2;
    const threatDist = zones ? zones.threatZone : (myReach + 1.2);
    if (self.sprinting || (t.sprinting && self.action?.kind === 'dodge')) {
      const keep = (distance > (F.spatial ? threatDist : myReach + 1.2)) && self.stamina > A.tackle.cost + .25;
      if (keep && !oppAttackingNow(target)) {c.move = forward;c.dodgeHeld = true;return finish(brain, c, self, target);}
      t.sprinting = false;
    } else if (t.sprinting) t.sprinting = false;
    else if (free && (F.spatial ? shouldSprintManaged(self, distance, threatDist, budget) : (distance > myReach + 1.5 && self.stamina >= budget)) && !self.exhausted && brain.cooldown <= 0 && !target.flight) {
      t.sprinting = true;c.move = forward;c.dodge = true;c.dodgeHeld = true;c.dodgeDirection = forward;return finish(brain, c, self, target);
    }
  }

  // ---------- 4. Escolha de intenção (a cada "pensamento") ----------
  const reserveOk = self.stamina - A.tackle.cost >= S.reserve * A.dodge.cost - 1e-6 || target.hp <= self.attributes.attack * 1.05 || target.exhausted;
  if (t.time >= t.think || t.time >= t.intentUntil) {
    t.think = t.time + S.think * (.6 + .8 * brain.random()) * (target.exhausted ? .6 : 1);
    t.rangeDrift = clamp(t.rangeDrift + (brain.random() - .5) * .3, -.4, .4);
    const m = t.model, inMyRange = distance <= myReach, inTheirRange = distance <= oppReach, low = self.exhausted || self.stamina < A.dodge.cost + A.tackle.cost * .5;
    // Contra quem defende muito, ataque direto rende pouco: isca, flanco e paciência.
    const guardy = m.guard, dodgy = m.dodge, clashy = m.clash, eager = m.attackRate;
    const baitWeight = S.bait * (inTheirRange ? .4 : 1) * (.4 + eager) * 1.1 * (counterStrat?.baitWeightMod ?? 1.0);
    const choice = pick(brain, [
      [inMyRange && canDash && reserveOk && brain.cooldown <= 0 ? S.attack * boldness * 1.6 * (1 + urgency) * (1.2 - guardy * .9 * (1 - urgency)) * (1 - .5 * clashy) * (target.guard ? .4 : 1) * (target.stun > 0 ? .3 : 1) : 0, 'attack'],
      [inMyRange && canDodge && self.stamina >= flankBudget - 1e-6 && A.cancel.dodgeToTackle ? S.cancel * (.4 + guardy + .4 * dodgy) * .9 : 0, 'flank'],
      [!inMyRange ? 1.2 + boldness : .2, 'approach'],
      [.6 + .3 * (1 - S.attack), 'orbit'],
      [baitWeight, 'bait'],
      [inTheirRange ? S.guard * (.3 + eager) : .1, 'guardWalk'],
      [low ? (self.exhausted ? 3 : 1.6) * (1 - .4 * boldness) : .05, 'recover'],
      [S.corner * .5, 'corner'],
      [inTheirRange && canDodge && self.stamina >= flankBudget - 1e-6 ? (S.chaos ? .5 : .15) * S.dodge : 0, 'feintDodge'],
    ]);
    t.intent = choice;t.intentUntil = t.time + (choice === 'bait' ? .45 + .35 * brain.random() : choice === 'recover' ? .9 + brain.random() : .25 + .5 * brain.random());t.baitPhase = 0;
    if (F.sequencePlanner && P.usePlanner !== false) {
      if (choice === 'bait') {
        t.activeSequencePlan = createPlan(PLAN_TYPES.BAIT_AND_PUNISH);
      } else if (choice === 'corner') {
        t.activeSequencePlan = createPlan(PLAN_TYPES.CORNER_TRAP);
      } else if (choice === 'guardWalk' || (counterStrat?.recommendedPosture === 'anti_aggressive' && brain.random() < 0.5)) {
        t.activeSequencePlan = createPlan(PLAN_TYPES.ABSORB_AND_COUNTER);
      } else if ((choice === 'recover' || choice === 'orbit') && self.loadout?.some(Boolean) && distance < 4.0 && brain.random() < 0.4) {
        t.activeSequencePlan = createPlan(PLAN_TYPES.CHARGE_SETUP);
      } else {
        t.activeSequencePlan = null;
      }
    }
    if (brain.random() < .2 * (1 + (S.chaos ?? 0))) t.orbit *= -1;
  }

  // ---------- 5. Execução da intenção ----------
  let planHandled = false;
  if (F.sequencePlanner && t.activeSequencePlan && P.usePlanner !== false) {
    const planRes = updatePlan(t.activeSequencePlan, self, target, dt, {
      reach: myReach,
      arenaHalf: C.test.arenaHalf,
      hasUrgentThreat: !!(inc && inc.reaches && th && !th.misread),
    });
    if (planRes.command) {
      if (planRes.command.tackle) {
        if (canDash && reaches()) {
          attack(aim, 'sequencePlan');
          if (planRes.planComplete) t.activeSequencePlan = null;
          return finish(brain, c, self, target);
        } else {
          c.move = forward;
          planHandled = true;
        }
      } else {
        const inMyRange = distance <= myReach;
        if (inMyRange && canDash && reserveOk && brain.cooldown <= 0 && reaches()) {
          attack(aim, 'sequenceOpportunity');
          t.activeSequencePlan = null;
          return finish(brain, c, self, target);
        }
        if (planRes.command.move && length(planRes.command.move) > 0) c.move = planRes.command.move;
        if (planRes.command.guard) c.guard = true;
        planHandled = true;
      }
    }
    if (planRes.planComplete) t.activeSequencePlan = null;
  }
  // Zona de perigo: a distância de onde o adversário costuma atacar (aprendida), se ele puder atacar agora.
  const oppFree = (!target.action || target.action.elapsed >= (target.action.kind === 'recoil' ? C.actions.tackle.chainAfter : actionSpec(target.action).chainAfter)) && target.action?.kind !== 'recoil';
  const oppCanAttack = oppFree && !target.exhausted && target.stamina >= A.tackle.cost - 1e-6 && !target.flight && target.knockRecovery <= 0 && target.stun <= 1e-8;
  const dangerDist = (t.model.attackDist ?? oppReach * .7) + .35;
  const spacingBias = counterStrat?.spacingBias ?? 0;
  const want = Math.max(myReach * (S.range + t.rangeDrift * .5), S.range > .8 ? dangerDist + .3 : 0) + spacingBias, wallAware = s => safeSide(self, forward, s);
  if (!planHandled) switch (t.intent) {
    case 'attack':
      if (canDash && distance <= myReach && brain.cooldown <= 0 && reaches()) {attack(aim, 'intent');t.intentUntil = t.time;}
      else c.move = forward;
      break;
    case 'flank': {
      // C para o lado (ou por cima do rival, se ele estiver encostado) e cancela em X no flanco.
      if (canDodge && keepsStamina && distance <= myReach + .3) {
        const s = wallAware(t.orbit), dir = normalize(add(scale(forward, .35), sideOf(s)));
        c.dodge = true;c.move = dir;c.dodgeDirection = dir;
        {const [w0, w1] = cancelWindow();t.plan = {cancelAt: w0 + (.15 + .35 * brain.random()) * (w1 - w0)};}t.intentUntil = t.time;
      } else c.move = forward;
      break;
    }
    case 'approach':
      if (oppCanAttack && distance <= dangerDist + .25 && distance > myReach) {c.guard = S.guard > .25;c.move = scale(forward, .7);}
      else c.move = normalize(add(forward, scale(sideOf(wallAware(t.orbit)), .35 * brain.random())));
      break;
    case 'orbit': {
      const targetDist = (F.spatial && zones && self.loadout?.includes?.('psyshock')) ? Math.max(want, Math.min(want + 0.6, zones.sweetSpot)) : want;
      c.move = normalize(add(sideOf(wallAware(t.orbit)), scale(forward, clamp((distance - targetDist) * .6, -.8, .8))));
      break;
    }
    case 'bait': {
      // Entra na borda do alcance dele e sai de repente, esperando o X passar curto.
      const edge = dangerDist - .15;
      if (t.baitPhase === 0) {c.move = distance > edge ? forward : vec();if (distance <= edge + .05) {t.baitPhase = 1;t.baitTurn = t.time + .08 + .2 * brain.random();}}
      else c.move = t.time > t.baitTurn ? scale(forward, -1) : vec();
      break;
    }
    case 'guardWalk': c.guard = true;c.move = distance > want ? scale(forward, .6) : vec();break;
    case 'recover': c.move = distance < oppReach + 1.5 ? normalize(add(scale(forward, -1), scale(sideOf(wallAware(t.orbit)), .5))) : sideOf(wallAware(t.orbit));c.guard = distance < oppReach && S.guard > .4;break;
    case 'corner': {
      if (F.spatial) {
        c.move = cornerPressureDirection(self.position, target.position, C.test.arenaHalf);
      } else {
        // Circula para ficar entre o rival e o centro da arena, empurrando-o para a parede.
        const toCenter = normalize(sub(vec(), target.position)), s = dot(sideOf(1), toCenter) > 0 ? 1 : -1;
        c.move = normalize(add(scale(sideOf(s), .8), scale(forward, distance > want ? .6 : -.2)));
      }
      break;
    }
    case 'feintDodge': if (canDodge && keepsStamina) {const dir = scale(forward, -1);c.dodge = true;c.move = dir;c.dodgeDirection = dir;t.intentUntil = t.time;} break;
  }
  // Antecipação: dentro da zona de perigo sem estar atacando, defende de antemão ou recua para a borda.
  const committing = c.tackle || c.dodge || t.intent === 'attack' || t.intent === 'flank' || (t.intent === 'bait' && t.baitPhase === 1);
  // Um X do adversário já em curso (ainda não percebido) mantém o plano: a defesa erguida de antemão continua erguida.
  const oppAttacking = target.action?.kind === 'tackle';
  if ((oppCanAttack || oppAttacking) && distance < dangerDist + (oppAttacking ? 1.5 : 0) && !committing) {
    t.dangerPlan ??= pick(brain, [[(S.guard * .9 + .15 * (1 - boldness)) * (1 - .6 * urgency), 'guard'], [.35 * (1 - S.attack) + .25, 'space'], [boldness * .25 * (S.chaos ? 2 : 1), 'ignore']]);
    if (t.dangerPlan === 'guard') {c.guard = true;if (length(c.move) > .6) c.move = scale(normalize(c.move), .6);}
    else if (t.dangerPlan === 'space') c.move = normalize(add(scale(forward, -1), scale(sideOf(wallAware(t.orbit)), .45)));
  } else if (!oppAttacking && (distance > dangerDist + .3 || !oppCanAttack)) t.dangerPlan = null;
  // Evita a parede quando não está atacando.
  if (!c.tackle && !c.dodge && length(c.move) > 0) {
    const future = add(self.position, scale(c.move, .9)), lim = C.test.arenaHalf - 1;
    if (Math.abs(future.x) > lim || Math.abs(future.z) > lim) {
      t.orbit *= -1;
      if (F.spatial) {
        c.move = safeArenaDirection(self.position, c.move, C.test.arenaHalf, 1.2);
      } else {
        c.move = normalize(add(c.move, scale(normalize(sub(vec(), self.position)), 1.2)));
      }
    }
  }
  // Hesitação ocasional (traço de personalidade).
  if ((P.hesitation ?? 0) > 0 && !c.tackle && !c.dodge && !c.guard) {
    if (brain.pause > 0) {brain.pause -= dt;c.move = vec();}
    else if (brain.random() < P.hesitation * dt * .6) brain.pause = .08 + brain.random() * .25;
  }
  return finish(brain, c, self, target);
}

const oppAttackingNow = target => target.action?.kind === 'tackle';
/** Revisão em uso por esta IA (a avaliação pode fixar por lado; senão, o ajuste global extras.ai.revision). */
/** Só existe a IA mais recente (revisão 2); revisionOverride serve apenas à avaliação pareada interna. */
export const revisionOf = brain => (brain.revisionOverride ?? 2) | 0;
/** Melhorias das revisões da IA (a avaliação pode ligar uma a uma para medir o efeito). */
export const REVISION_FEATURES = ['validate', 'reach', 'stamina', 'counter', 'sprint', 'dodgeStamina', 'perception', 'prediction', 'spatial', 'economy', 'defense', 'opponentModel', 'sequencePlanner', 'difficulty'];
/**
 * Medido (400 lutas por variante contra a IA anterior, sementes fixas): “stamina” (nunca se exaurir por escolha) derrubou a
 * taxa de vitória de ~56% para ~34% — ficar passiva perde mais do que a exaustão custa —, por isso fica DESLIGADA na
 * revisão 1 (continua disponível para avaliação). As demais não pioraram e melhoram as métricas de uso das mecânicas.
 */
export const REVISION_1 = {validate: true, reach: true, stamina: false, counter: true, sprint: true, dodgeStamina: false, perception: false, prediction: false, spatial: false, economy: false, defense: false, opponentModel: false, sequencePlanner: false, difficulty: false};
export const REVISION_2 = {validate: true, reach: true, stamina: false, counter: true, sprint: true, dodgeStamina: false, perception: true, prediction: true, spatial: true, economy: true, defense: true, opponentModel: true, sequencePlanner: true, difficulty: true};
export const AI_REVISIONS = {
  0: {id: 'rev0', label: 'Anterior (v6)', description: 'IA de referência do v6; sem validação prévia de permissões, sem sprint tático.', features: Object.fromEntries(REVISION_FEATURES.map(k => [k, false]))},
  1: {id: 'rev1', label: 'Revisada (Tática)', description: 'Revisão tática com validação de permissões, estimativa de alcance, sprint e contra-ataques.', features: REVISION_1},
  2: {id: 'rev2', label: 'Evoluída (Preditiva, Adaptativa & Sequencial)', description: 'Fases 2–10: percepção justa, previsão de contato/paredes, gestão de zonas, economia por valor, defesa contextual, modelo do oponente, planejamento de sequências e dificuldade balanceada.', features: REVISION_2},
};
export const featuresOf = brain => {
  if (brain.revFeatures) return brain.revFeatures;
  const rev = revisionOf(brain);
  if (rev >= 2) return REVISION_2;
  if (rev === 1) return REVISION_1;
  return Object.fromEntries(REVISION_FEATURES.map(k => [k, false]));
};
/**
 * Fecha o comando. Revisão 1: só pede o que o motor aceitaria agora — usa a MESMA função de permissão do controlador
 * (startPermission) e a mesma condição de stamina —, então a IA não gasta tentativas em ações negadas e não segura
 * D no próprio tackle. Não dá vantagem: é a regra do jogador aplicada antes de apertar o botão.
 */
function finish(brain, c, self = null, target = null) {
  if (length(c.move) > 1) c.move = normalize(c.move);
  if (self && featuresOf(brain).validate) {
    const unavailable = !!self.flight || self.knockRecovery > 0 || self.hp <= 0;
    if (unavailable) {
      c.tackle = false;
      c.dodge = false;
      c.guard = false;
      if (brain.t) brain.t.sprinting = false;
    } else {
      const allowed = kind => {const p = startPermission(self, kind), afford = !self.exhausted && self.stamina >= C.actions[kind].cost - 1e-8;return p.ok && afford;};
      // X/C que o motor guardaria no buffer (sai assim que permitido) continuam valendo: só cai o pedido sem efeito.
      const buffered = C.actions.buffer.window > 0 && self.hp > 0;
      if (c.tackle && !allowed('tackle') && !buffered) c.tackle = false;
      if (c.dodge && !allowed('dodge') && !buffered) {c.dodge = false;if (brain.t) brain.t.sprinting = false;}
      // Defesa no próprio tackle só vale com o toque de defesa perfeita disponível (regra do controlador); fora isso, nada.
      const T = C.actions.tackle, tackleGuard = self.action?.kind !== 'tackle' || T.guardCancel || (T.perfectGuardCancel && self.perfectCooldown <= 0);
      if (c.guard && !tackleGuard) c.guard = false;
      // Defesa perfeita em recarga: segurar D (sem soltar e apertar de novo) — o toque não abriria a janela.
      if (c.guard && !brain.wasGuard && self.perfectCooldown > 0 && self.guard) c.guard = true;
    }
  }
  if (self && target && brain.t) {
    const t = brain.t;
    const diff = sub(target.position, self.position);
    const dist = length(diff);
    const F = featuresOf(brain);
    brain.lastDecision = {
      time: +t.time.toFixed(2),
      perception: {
        distance: +dist.toFixed(2),
        oppKind: t.oppKind,
        threat: t.threat ? {response: t.threat.response, misread: !!t.threat.misread} : null,
        oppStamina: +target.stamina.toFixed(2),
        oppExhausted: !!target.exhausted,
      },
      prediction: t.lastContactPrediction ? {
        contactChance: t.lastContactPrediction.contactChance,
        timeToContact: t.lastContactPrediction.timeToContact,
        punishRisk: t.lastContactPrediction.punishRisk,
      } : null,
      opponentModel: F.opponentModel && t.opponentModel && t.lastCounterStrat ? {
        activeHypothesis: t.lastCounterStrat.activeHypothesis ?? 'none',
        confidence: t.lastCounterStrat.confidence ?? 0,
        posture: t.lastCounterStrat.recommendedPosture ?? 'neutral',
      } : null,
      sequencePlan: t.activeSequencePlan ? {
        type: t.activeSequencePlan.type,
        step: t.activeSequencePlan.step,
        totalTime: +t.activeSequencePlan.totalTime.toFixed(2),
      } : null,
      plan: {
        intent: t.intent,
        why: t.why ?? 'none',
        dangerPlan: t.dangerPlan,
        sprinting: !!t.sprinting,
      },
      command: {
        tackle: !!c.tackle,
        dodge: !!c.dodge,
        guard: !!c.guard,
        move: {...c.move},
      },
    };
  }
  c.guardPressed = c.guard && !brain.wasGuard;brain.wasGuard = c.guard;return c;
}
