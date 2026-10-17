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
import {length, sub, dot, normalize} from './math.js';

/** Passos de carga para chegar a cada Power Level (PL1 curto; PL2 em 2,0 s; PL3 em 4,0 s). */
const LEVEL_TICKS = {1: 30, 2: 240, 3: 480};
/** Passos mínimos para o Reflect (mínimo de 1,5 s = 180 passos no PL1). */
const REFLECT_TICKS = {1: 180, 2: 240, 3: 480};
const held = (/** @type {number} */ slot) => Array.from({length: C.world.slots}, (_, i) => i === slot);
const altOf = (/** @type {any} */ f) => (f.flight?.y ?? 0) + (f.vaultHeight ?? 0);

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
  const t = brain.t, mv = (t.mv ??= {phase: 'idle', slot: -1, goalTicks: 0, wait: 0, roll: 0, last: t.time ?? 0, log: []});
  const dt = Math.max(0, (t.time ?? 0) - mv.last);mv.last = t.time ?? 0;
  const world = brain.getWorld?.() ?? null;
  const threat = world ? incomingProjectile(world, self) : null;
  const defend = () => {c.guard = true;c.guardPressed = !brain.wasGuard;brain.wasGuard = true;};

  // ---------- Carga em andamento: sustentar proporcional à distância, suprimir cancelamentos acidentais ----------
  if (self.charge) {
    mv.phase = 'charging';
    const ch = self.charge;
    const distance = target ? length(sub(target.position, self.position)) : 10;
    if (ch.move === 'psyshock') {
      // Quanto mais distante, mais mantém a carga para atingir PL superior (PL2 em 2s, PL3 em 4s)
      if (distance >= 7.0) mv.goalTicks = Math.max(mv.goalTicks, LEVEL_TICKS[3]);
      else if (distance >= 4.8) mv.goalTicks = Math.max(mv.goalTicks, LEVEL_TICKS[2]);
      // Se o adversário se aproximar muito rápido, solta antecipadamente se já atingiu o patamar mínimo
      if (distance < 3.2 && ch.ticks >= LEVEL_TICKS[1]) mv.goalTicks = Math.min(mv.goalTicks, ch.ticks);
    } else if (ch.move === 'reflect') {
      mv.goalTicks = Math.max(mv.goalTicks, 180);
    }
    if (threat && threat.time < .22 && threat.pl > 0 && (ch.move !== 'reflect' || ch.ticks < 180)) {
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
  if (mv.phase === 'charging') {mv.phase = 'idle';mv.wait = .35;}      // terminou (soltou ou foi interrompida): respira um pouco
  mv.wait = Math.max(0, mv.wait - dt);
  if (mv.wait > 0 || self.action || self.flight || self.knockRecovery > 0 || self.hp <= 0) return c;

  const start = (/** @type {number} */ slot, /** @type {number} */ goal, /** @type {string} */ why, /** @type {any} */ extra = {}) => {
    const def = getMove(slots[slot]);if (!def) return false;
    if (!chargePermission(self, def, slot).ok) return false;
    c.skill = slot;c.skillHeld = held(slot);mv.phase = 'charging';mv.slot = slot;mv.goalTicks = goal;
    log(mv, {time: +t.time.toFixed(3), move: def.id, why, goalTicks: goal, ...extra});return true;
  };

  // ---------- Reflect reativo (só se der tempo de chegar a um PL suficiente) ----------
  const ri = slots.indexOf('reflect');
  if (threat) {
    const need = ri >= 0 ? Math.max(180, REFLECT_TICKS[Math.min(3, threat.pl)] ?? 480) : (LEVEL_TICKS[Math.min(3, threat.pl)] ?? 480);
    const canMakeIt = threat.time * 120 >= need + 18;
    if (ri >= 0 && canMakeIt && start(ri, need, 'projétil hostil a caminho', {pl: threat.pl, time: +threat.time.toFixed(2)})) return c;
    if (threat.time < .26 && !self.guard && !c.dodge) {defend();log(mv, {time: +t.time.toFixed(3), move: null, why: 'sem tempo para o PL do projétil: defende', pl: threat.pl});return c;}
  }
  if (!world) return c;

  const distance = length(sub(target.position, self.position)), S = t.style ?? {attack: .5, reserve: .5, bait: .5};
  mv.roll = Math.max(0, (mv.roll ?? 0) - dt);
  if (mv.roll > 0) return c;

  // ---------- Barreira do adversário no caminho: destruí-la com Tackle quando está perto ----------
  const barrier = enemyBarrierBetween(world, self, target);
  if (barrier) {
    mv.roll = .5;
    const to = sub(barrier.pos, self.position), d = length(to);
    if (d < 3.2 && !self.exhausted && self.stamina >= C.actions.tackle.cost + .5 && brain.random() < .6) {
      c.tackle = true;c.move = normalize(to);log(mv, {time: +t.time.toFixed(3), move: 'tackle', why: 'destruir barreira do adversário', distance: +d.toFixed(2)});
    }
    return c;
  }

  // ---------- Psyshock ofensivo ----------
  const pi = slots.indexOf('psyshock');
  if (pi >= 0 && distance > 3.5 && self.stamina >= 2 && !target.flight) {
    mv.roll = .5;
    const p = Math.min(.9, .25 + .5 * (S.attack ?? .5) + (distance > 6 ? .15 : 0));
    if (brain.random() < p) {
      const r = brain.random(), far = distance > 6.5, patient = (S.reserve ?? .5) > .6 || (S.bait ?? .5) > .6;
      const level = r < (far && patient ? .2 : .45) ? 1 : r < (far ? .7 : .9) ? 2 : 3;
      start(pi, LEVEL_TICKS[level], 'ataque à distância', {pl: level, distance: +distance.toFixed(2)});
    }
  }
  return c;
}
