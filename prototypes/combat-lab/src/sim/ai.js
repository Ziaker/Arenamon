// IA determinística. Os quatro modos do v6 (inactive, defensive, offensive, combat) são reproduzidos sem
// alterações; os modos de dummy do laboratório (guard, evade, counter, random) foram acrescentados.
import {C} from './config.js';
import {emptyCommand} from './entity.js';
import {vec, add, scale, sub, dot, length, normalize, direction} from './math.js';

export const AI_MODES = [
  ['inactive', 'Parado (dummy)'], ['defensive', 'Defensivo (v6)'], ['offensive', 'Ofensivo (v6)'], ['combat', 'Combate (v6)'],
  ['guard', 'Sempre defendendo'], ['evade', 'Sempre esquivando'], ['counter', 'Defende e contra-ataca'], ['random', 'Aleatório (semente fixa)'],
];

/** O tackle do atacante aponta para o defensor? */
export function threatens(attacker, defender) {
  if (attacker.action?.kind !== 'tackle') return false;
  const toDefender = sub(defender.position, attacker.position);
  if (length(toDefender) < 1e-6) return true;
  return dot(direction(attacker.action.heading), normalize(toDefender)) > C.extras.ai.threatAlignment;
}
/** Passo do gerador pseudoaleatório determinístico mulberry32: devolve [valor, próximo estado]. */
export function mulberry(state) {
  const a = (state + 0x6D2B79F5) >>> 0;let t = a;t = Math.imul(t ^ (t >>> 15), t | 1);t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

export class Brain {
  constructor(seed = 1) {this.seed = seed;this.reset();}
  reset() {this.cooldown = C.extras.ai.initialCooldown;this.phase = 0;this.wasGuard = false;this.orbitAge = 0;this.orbitSign = 1;this.rngState = this.seed >>> 0;this.hold = 0;this.held = null;}
  random() {const [v, next] = mulberry(this.rngState);this.rngState = next;return v;}
  /** Estado serializável (replay e cenários). */
  save() {const {cooldown, phase, wasGuard, orbitAge, orbitSign, rngState, hold, held, seed} = this;return {cooldown, phase, wasGuard, orbitAge, orbitSign, rngState, hold, held, seed};}
  load(s) {Object.assign(this, s);}
  command(self, target, mode, dt) {
    const A = C.extras.ai, c = emptyCommand();
    if (mode === 'inactive') {this.wasGuard = false;return c;}
    c.target = target.id;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.orbitAge += dt;
    if (this.orbitAge > A.orbitChangePeriod) {this.orbitAge -= A.orbitChangePeriod;this.orbitSign *= -1;}
    const difference = sub(target.position, self.position), distance = length(difference);
    const forward = length(difference) > 1e-7 ? normalize(difference) : direction(self.facing);
    const side = vec(forward.z * this.orbitSign, -forward.x * this.orbitSign);
    const threatNear = threatens(target, self) && distance < A.threatDistance;
    const threat = !!C.extras.toggles.enableAIReactive && mode === 'combat' && threatNear;
    const canDash = !self.exhausted && self.stamina >= C.extras.combat.actionCost && self.knockRecovery <= 0 && !self.flight && !self.action;
    if (mode === 'guard') {c.guard = true;}
    else if (mode === 'evade') {
      if (threatNear && canDash) {c.move = side;c.dodge = true;}
    } else if (mode === 'counter') {
      if (self.counterWindow > 0 && canDash) {c.move = forward;c.tackle = true;} else c.guard = true;
    } else if (mode === 'random') {
      // Decide uma intenção a cada 0,25–0,75 s; a sequência é sempre a mesma para a mesma semente.
      this.hold -= dt;
      if (this.hold <= 0 || !this.held) {
        const r = this.random();this.hold = .25 + this.random() * .5;
        this.held = r < .3 ? 'approach' : r < .5 ? 'strafe' : r < .65 ? 'guard' : r < .8 ? 'tackle' : r < .9 ? 'dodge' : 'retreat';
      }
      const h = this.held;
      c.move = h === 'approach' ? forward : h === 'strafe' ? side : h === 'retreat' ? scale(forward, -1) : vec();
      c.guard = h === 'guard';
      if ((h === 'tackle' || h === 'dodge') && canDash && this.cooldown <= 0) {c[h] = true;c.move = h === 'tackle' ? forward : side;this.cooldown = A.combatAttackCooldown;this.held = null;}
    } else if (mode === 'defensive') {
      c.guard = true;
      c.move = distance < A.defensiveRetreatDistance ? scale(forward, -A.defensiveRetreatStrength) : vec();
    } else if (threat) {
      const predict = dot(direction(target.action.heading), forward);
      if (canDash && this.phase % A.evadeCycle === A.evadeCycleIndex && this.cooldown <= 0) {c.move = side;c.dodge = true;this.cooldown = C.test.aiInterval;this.phase++;}
      else {c.guard = true;c.move = predict > 0 ? scale(forward, -A.reactiveRetreatStrength) : vec();}
    } else {
      if (distance > A.approachDistance) c.move = forward;
      else if (distance < A.retreatDistance) c.move = scale(forward, -A.retreatStrength);
      else if (mode === 'combat') c.move = scale(side, A.strafeStrength);
      // Evita encostar na parede enquanto circula.
      const future = add(self.position, scale(c.move, A.wallPrediction));
      if (Math.abs(future.x) > C.test.arenaHalf - A.wallMargin || Math.abs(future.z) > C.test.arenaHalf - A.wallMargin) {this.orbitSign *= -1;c.move = forward;}
      if (C.extras.toggles.enableAIAttack && distance <= A.attackRange && this.cooldown <= 0 && canDash && !target.flight) {
        c.move = forward;c.tackle = true;
        this.cooldown = mode === 'combat' ? A.combatAttackCooldown : C.test.aiInterval;
        this.phase++;
      }
      if (self.stamina < A.lowStaminaThreshold && distance < A.lowStaminaDistance && !c.tackle) c.move = scale(forward, -A.lowStaminaRetreat);
    }
    c.guardPressed = c.guard && !this.wasGuard;this.wasGuard = c.guard;
    return c;
  }
}
