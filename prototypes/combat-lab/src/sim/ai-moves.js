// @ts-check
// IA tática com Moves (M15.7–M15.8, M27.6). A IA pede os movimentos pelos MESMOS campos de comando do jogador (`skill` = toque,
// `skillHeld` = botão mantido) e só pede o que o motor aceitaria agora (a mesma função de permissão do controlador), então não
// tem vantagem de regras: respeita stamina, recarga, recuperação, apoio no chão e esquiva/defesa como qualquer jogador.
// Sem movimentos equipados este módulo não faz nada e não consome sorteios (a luta é idêntica à anterior).
//
// O que a IA faz:
//   • Reflect reativo: vê um projétil hostil vindo e o PL dele; só carrega se der tempo de chegar a um PL ≥ o do projétil (senão uma
//     barreira de PL menor seria destruída) — nesse caso defende (D) em cima da hora.
//   • Psyshock ofensivo: de longe, com o caminho livre, escolhe PL1/PL2/PL3 pelo estilo e pela distância; trava o alvo (homing).
//   • Barreira do adversário no caminho: tenta destruí-la com Tackle quando está perto.
//   • Decisões ficam em `brain.t.mv.log` (telemetria opcional, serializável com o resto do estado da IA).
import {C} from './config.js';
import {getMove} from './moves.js';
import {chargePermission} from './controller.js';
import {segmentHitsVolume} from './geometry.js';
import {length, sub, dot, normalize, scale, vec, direction} from './math.js';
import {perceiveIncomingProjectile} from './perception.js';
import {predictProjectileTrajectory} from './prediction.js';
import {featuresOf} from './tactics.js';
import {evaluateMoveOpportunity, evaluateChargeContinuation} from './move-strategy.js';
import {newMovesCommand} from './ai-new-moves.js';

/** Passos de carga para chegar a cada Power Level (PL1 curto; PL2 em 2,0 s; PL3 em 4,0 s). */
const LEVEL_TICKS = {1: 30, 2: 240, 3: 480};
/** Passos mínimos para o Reflect (mínimo de 1,5 s = 180 passos no PL1). */
const REFLECT_TICKS = {1: 180, 2: 240, 3: 480};
const held = (/** @type {number} */ slot) => Array.from({length: C.world.slots}, (_, i) => i === slot);
const altOf = (/** @type {any} */ f) => (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0);

/** Projétil hostil que vai atingir o lutador: o mais próximo no tempo (com PL e tempo até o impacto), ou null. */
function incomingProjectile(/** @type {any} */ world, /** @type {any} */ self) {
  let best = /** @type {{time: number, pl: number, id: number} | null} */ (null);
  for (const p of world.entities) {
    if (p.kind !== 'projectile' || p.dead || p.owner === self.id) continue;
    const speed = length(p.vel);if (speed < 1e-6) continue;
    const dir = {x: p.vel.x / speed, z: p.vel.z / speed}, d = sub(self.position, p.pos), along = dot(d, dir);
    if (along <= 0 || along > 26) continue;
    const lateral = Math.hypot(d.x - dir.x * along, d.z - dir.z * along);if (lateral > C.test.halfExtent + (p.radius ?? .2) + .35) continue;
    const time = along / speed;if (!best || time < best.time) best = {time, pl: p.pl ?? 1, id: p.id};
  }
  return best;
}
/** Barreira refletora do adversário cruzando a linha entre os dois (o Psyshock seria refletido). */
function enemyBarrierBetween(world, self, target) {
  const p0 = {x: self.position.x, z: self.position.z, y: altOf(self) + .65}, p1 = {x: target.position.x, z: target.position.z, y: altOf(target) + .65};
  return world.entities.find(e => e.reflect && !e.dead && e.owner !== self.id && segmentHitsVolume(e, e.y, e.height, p0, p1)) ?? null;
}
const log = (mv, entry) => {mv.log.push(entry);if (mv.log.length > 30) mv.log.shift();};

/**
 * Acrescenta ao comando tático as decisões de movimento. `c` é o comando já pronto (e já passado por `finish`); devolve o mesmo objeto.
 * @param {any} brain @param {any} self @param {any} target @param {any} c
 */
export function movesCommand(brain, self, target, c) {
  const slots = self.loadout;
  if (!slots || !slots.some(Boolean) || !brain.t) return c;
  const A = C.world.ai, holdTicks = Math.max(1, Math.round(A.reflectHold / C.test.step));   // parâmetros ajustáveis na aba Moves › IA com Moves
  const t = brain.t, mv = (t.mv ??= {phase: 'idle', slot: -1, goalTicks: 0, wait: 0, roll: 0, last: t.time ?? 0, log: []});
  const dt = Math.max(0, (t.time ?? 0) - mv.last);mv.last = t.time ?? 0;
  const world = brain.getWorld?.() ?? null;
  const F = typeof featuresOf === 'function' ? featuresOf(brain) : null;
  const perc = (F?.perception && t.perception) ? t.perception : null;
  const P = typeof brain.personality === 'function' ? brain.personality() : (brain.P ?? {});
  let threat = (world && perc) ? perceiveIncomingProjectile(perc, brain, world, self, t.time ?? 0, P) : (world ? incomingProjectile(world, self) : null);
  if (threat && world && typeof featuresOf === 'function' && featuresOf(brain)?.prediction) {
    const tid = threat.id;
    const proj = world.entities.find((/** @type {any} */ e) => e.id === tid);
    if (proj) {
      const pred = predictProjectileTrajectory(proj, world, self);
      if (pred.willHitBarrier) threat = null;
    }
  }
  const defend = () => {c.guard = true;c.guardPressed = !brain.wasGuard;brain.wasGuard = true;};

  if (self.aim && target && newMovesCommand(brain, self, target, c, mv, perc, t.style)) return c;   // marcador dos Moves novos: mantém, aponta e solta
  if (self.charge) {
    mv.phase = 'charging';
    const ch = self.charge;
    const distance = target ? length(sub(target.position, self.position)) : 10;
    const oppTackle = (perc && perc.observedAction !== undefined && perc.observedAction !== null)
      ? perc.observedAction === 'tackle'
      : target?.action?.kind === 'tackle';
    const canDodgeCancel = ch.ticks >= (ch.params?.dodgeLockTicks ?? 30) && !self.exhausted && self.stamina >= (C.actions?.dodge?.cost ?? 1);

    // Evasão emergencial durante o Charge: se o rival inicia um Tackle a curta distância, esquiva lateralmente cancelando o charge
    if (oppTackle && distance < A.evadeDistance && canDodgeCancel) {
      const diff = sub(target.position, self.position);
      const away = length(diff) > 1e-6 ? normalize(scale(diff, -1)) : direction(self.facing + Math.PI);
      const side = vec(away.z, -away.x);
      c.dodge = true;
      c.dodgeDirection = side;
      c.move = side;
      c.skillHeld = null;
      c.tackle = false;
      c.guard = false;
      c.guardPressed = false;
      log(mv, {time: +t.time.toFixed(3), move: ch.move, why: 'evasão emergencial contra tackle', distance: +distance.toFixed(2)});
      return c;
    }

    // Se tactics já tiver pedido esquiva emergencial, respeita e solta a tecla do charge
    if (c.dodge && canDodgeCancel) {
      c.skillHeld = null;
      return c;
    }

    if (ch.move === 'psyshock') {
      // Quanto mais distante, mais mantém a carga para atingir PL superior (PL2 em 2s, PL3 em 4s)
      if (distance >= A.pl3Distance) mv.goalTicks = Math.max(mv.goalTicks, LEVEL_TICKS[3]);
      else if (distance >= A.pl2Distance) mv.goalTicks = Math.max(mv.goalTicks, LEVEL_TICKS[2]);
      const cont = evaluateChargeContinuation(self, target, ch, distance, threat);
      if (cont.shouldRelease) mv.goalTicks = Math.min(mv.goalTicks, ch.ticks);
    } else if (ch.move === 'reflect') {
      mv.goalTicks = Math.max(mv.goalTicks, holdTicks);
      const cont = evaluateChargeContinuation(self, target, ch, distance, threat);
      if (cont.shouldRelease) mv.goalTicks = Math.min(mv.goalTicks, ch.ticks);
    }
    if (threat && threat.time < A.lastSecondDefend && threat.pl > 0 && (ch.move !== 'reflect' || ch.ticks < holdTicks)) {
      defend();
      log(mv, {time: +t.time.toFixed(3), move: ch.move, why: 'defesa em cima da hora', pl: threat.pl});
      return c;
    }
    c.guard = false;
    c.guardPressed = false;
    c.dodge = false;
    c.dodgeHeld = false;
    c.tackle = false;
    if (ch.ticks < mv.goalTicks) c.skillHeld = held(ch.slot);
    return c;
  }
  if (mv.phase === 'charging') {mv.phase = 'idle';mv.wait = A.afterChargeWait;}      // terminou (soltou ou foi interrompida): respira um pouco
  mv.wait = Math.max(0, mv.wait - dt);
  if (mv.wait <= 0 && target && newMovesCommand(brain, self, target, c, mv, perc, t.style)) return c;   // Moves novos (Harden … Emerging Stone)
  if (mv.wait > 0 || self.action || self.flight || self.knockRecovery > 0 || self.hp <= 0) return c;

  const start = (/** @type {number} */ slot, /** @type {number} */ goal, /** @type {string} */ why, /** @type {any} */ extra = {}) => {
    const def = getMove(slots[slot]);if (!def) return false;
    if (!chargePermission(self, def, slot).ok) return false;
    c.skill = slot;c.skillHeld = held(slot);mv.phase = 'charging';mv.slot = slot;mv.goalTicks = goal;
    c.tackle = false;c.dodge = false;c.guard = false;c.guardPressed = false;brain.wasGuard = false;
    log(mv, {time: +t.time.toFixed(3), move: def.id, why, goalTicks: goal, ...extra});return true;
  };

  // ---------- Reflect reativo (só se der tempo de chegar a um PL suficiente) ----------
  const ri = slots.indexOf('reflect');
  if (threat) {
    const need = ri >= 0 ? Math.max(holdTicks, REFLECT_TICKS[Math.min(3, threat.pl)] ?? 480) : (LEVEL_TICKS[Math.min(3, threat.pl)] ?? 480);
    const canMakeIt = threat.time * 120 >= need + 18;
    if (ri >= 0 && canMakeIt && start(ri, need, 'projétil hostil a caminho', {pl: threat.pl, time: +threat.time.toFixed(2)})) return c;
    if (threat.time < A.noTimeDefend && !self.guard && !c.dodge) {defend();log(mv, {time: +t.time.toFixed(3), move: null, why: 'sem tempo para o PL do projétil: defende', pl: threat.pl});return c;}
  }
  if (!world) return c;

  const distance = length(sub(target.position, self.position)), S = t.style ?? {attack: .5, reserve: .5, bait: .5};
  mv.roll = Math.max(0, (mv.roll ?? 0) - dt);
  if (mv.roll > 0) return c;

  // ---------- Barreira do adversário no caminho: destruí-la com Tackle quando está perto ----------
  const barrier = enemyBarrierBetween(world, self, target);
  if (barrier) {
    mv.roll = A.decisionInterval;
    const to = sub(barrier.pos, self.position), d = length(to);
    if (d < A.barrierBreakRange && !self.exhausted && self.stamina >= C.actions.tackle.cost + .5 && brain.random() < A.barrierBreakChance) {
      c.tackle = true;c.move = normalize(to);log(mv, {time: +t.time.toFixed(3), move: 'tackle', why: 'destruir barreira do adversário', distance: +d.toFixed(2)});
    }
    return c;
  }

  // ---------- Psyshock ofensivo ----------
  const pi = slots.indexOf('psyshock');
  if (pi >= 0 && distance > A.psyshockMinDistance && self.stamina >= A.psyshockMinStamina && !target.flight && (brain.cooldown ?? 0) <= 0) {
    mv.roll = A.decisionInterval;
    const oppEval = evaluateMoveOpportunity(self, target, 'psyshock', pi, world, {distance, threat}, S, () => brain.random());
    if (oppEval.viable) {
      const p = Math.min(A.psyshockChanceMax, .25 + .5 * (S.attack ?? .5) + (distance > 6 ? .15 : 0));
      if (brain.random() < p) {
        start(pi, oppEval.goalTicks, 'ataque à distância', {pl: oppEval.level ?? (oppEval.goalTicks >= LEVEL_TICKS[3] ? 3 : oppEval.goalTicks >= LEVEL_TICKS[2] ? 2 : 1), distance: +distance.toFixed(2)});
      }
    }
  }
  if (brain.lastDecision) {
    if (c.skillHeld) brain.lastDecision.command.skillHeld = c.skillHeld;
    if (c.skill) brain.lastDecision.command.skill = c.skill;
  }
  return c;
}
