// IA determinística por semente. Os quatro modos do v6 (inactive, defensive, offensive, combat) são reproduzidos
// sem alterações quando a personalidade está neutra; os modos de dummy do laboratório foram acrescentados.
//
// Personalidade (extras.aiRed / extras.aiBlue): tempo de reação, erros de leitura e de oportunidade,
// agressividade, variação de ritmo e hesitação. Tudo é sorteado pelo gerador da própria IA: a mesma
// semente reproduz a mesma luta (replay e cenários continuam determinísticos), mas cada lutador e cada
// semente lutam de forma diferente.
import {C} from './config.js';
import {emptyCommand} from './entity.js';
import {vec, add, scale, sub, dot, length, normalize, direction} from './math.js';
import {tacticalCommand} from './tactics.js';

export const AI_MODES = [
  ['inactive', 'Parado (dummy)'], ['defensive', 'Defensivo (v6)'], ['offensive', 'Ofensivo (v6)'], ['combat', 'Combate (v6)'],
  ['guard', 'Sempre defendendo'], ['evade', 'Sempre esquivando'], ['counter', 'Defende e contra-ataca'], ['random', 'Aleatório (semente fixa)'],
  ['tactical', 'Tático (estratégico)'],
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

/** Personalidade neutra: reproduz exatamente a IA do v6. */
export const NEUTRAL_PERSONALITY = {reaction: 0, reactionJitter: 0, mistake: 0, aggression: .5, variation: 0, hesitation: 0, evadeChance: .33};
const STATE = ['cooldown', 'phase', 'wasGuard', 'orbitAge', 'orbitSign', 'rngState', 'hold', 'held', 'seed', 'threatAge', 'reactAt', 'misread', 'pause', 'orbitPeriod', 'rangeBias', 'wantsEvade', 't'];

export class Brain {
  /** side: 'aiRed' (adversário) ou 'aiBlue' (IA do jogador) escolhe a personalidade. */
  constructor(seed = 1, side = 'aiRed') {this.seed = seed;this.side = side;this.reset();}
  reset() {
    this.cooldown = C.extras.ai.initialCooldown;this.phase = 0;this.wasGuard = false;this.orbitAge = 0;this.orbitSign = 1;this.rngState = this.seed >>> 0;this.hold = 0;this.held = null;
    this.threatAge = 0;this.reactAt = null;this.misread = false;this.pause = 0;this.orbitPeriod = null;this.rangeBias = 1;this.wantsEvade = false;
    this.t = null; // estado da IA tática (tactics.js), recriado a cada partida
  }
  random() {const [v, next] = mulberry(this.rngState);this.rngState = next;return v;}
  personality() {return {...NEUTRAL_PERSONALITY, ...(C.extras[this.side] || {})};}
  /** Estado serializável (replay e cenários). */
  save() {return Object.fromEntries(STATE.map(k => [k, this[k]]));}
  load(s) {Object.assign(this, structuredClone(s));}
  command(self, target, mode, dt) {
    const A = C.extras.ai, P = this.personality(), c = emptyCommand();
    if (mode === 'inactive') {this.wasGuard = false;return c;}
    if (mode === 'tactical') return tacticalCommand(this, self, target, dt, P);
    c.target = target.id;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.orbitAge += dt;
    const period = this.orbitPeriod ?? A.orbitChangePeriod;
    if (this.orbitAge > period) {
      this.orbitAge -= period;this.orbitSign *= -1;
      // Variação: o próximo período de troca de lado e a distância preferida mudam a cada troca.
      if (P.variation > 0) {this.orbitPeriod = A.orbitChangePeriod * (1 + P.variation * (2 * this.random() - 1));this.rangeBias = 1 + P.variation * .35 * (2 * this.random() - 1);}
    }
    const difference = sub(target.position, self.position), distance = length(difference);
    const forward = length(difference) > 1e-7 ? normalize(difference) : direction(self.facing);
    const side = vec(forward.z * this.orbitSign, -forward.x * this.orbitSign);
    const threatNear = threatens(target, self) && distance < A.threatDistance;
    let threat = !!C.extras.toggles.enableAIReactive && mode === 'combat' && threatNear;
    // Tempo de reação e leitura errada: a ameaça só é percebida depois de um atraso sorteado.
    if (threat) {
      if (this.reactAt === null) {this.reactAt = P.reaction + (P.reactionJitter > 0 ? this.random() * P.reactionJitter : 0);this.misread = P.mistake > 0 && this.random() < P.mistake;this.wantsEvade = P.variation > 0 && this.random() < P.evadeChance;}
      this.threatAge += dt;if (this.threatAge < this.reactAt - 1e-9 || this.misread) threat = false;
    } else {this.threatAge = 0;this.reactAt = null;this.misread = false;}
    // Cada ação tem custo próprio: a IA só tenta X ou C quando tem stamina para aquela ação.
    const ready = kind => !self.exhausted && self.stamina >= C.actions[kind].cost && self.knockRecovery <= 0 && !self.flight && !self.action;
    const canDash = ready('tackle'), canDodge = ready('dodge');
    if (mode === 'guard') {c.guard = true;}
    else if (mode === 'evade') {
      if (threatNear && canDodge) {c.move = side;c.dodge = true;}
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
      if ((h === 'tackle' ? canDash : h === 'dodge' && canDodge) && this.cooldown <= 0) {c[h] = true;c.move = h === 'tackle' ? forward : side;this.cooldown = A.combatAttackCooldown;this.held = null;}
    } else if (mode === 'defensive') {
      c.guard = true;
      c.move = distance < A.defensiveRetreatDistance ? scale(forward, -A.defensiveRetreatStrength) : vec();
    } else if (threat) {
      const predict = dot(direction(target.action.heading), forward);
      // Sem variação: ciclo fixo do v6. Com variação: esquiva ou defesa sorteadas pela preferência de esquiva.
      const evade = P.variation > 0 ? this.wantsEvade : this.phase % A.evadeCycle === A.evadeCycleIndex;
      if (canDodge && evade && this.cooldown <= 0) {c.move = side;c.dodge = true;this.cooldown = C.test.aiInterval * this.rhythm(P);this.phase++;}
      else {c.guard = true;c.move = predict > 0 ? scale(forward, -A.reactiveRetreatStrength) : vec();}
    } else {
      if (distance > A.approachDistance * this.rangeBias) c.move = forward;
      else if (distance < A.retreatDistance * this.rangeBias) c.move = scale(forward, -A.retreatStrength);
      else if (mode === 'combat') c.move = scale(side, A.strafeStrength);
      // Evita encostar na parede enquanto circula.
      const future = add(self.position, scale(c.move, A.wallPrediction));
      if (Math.abs(future.x) > C.test.arenaHalf - A.wallMargin || Math.abs(future.z) > C.test.arenaHalf - A.wallMargin) {this.orbitSign *= -1;c.move = forward;}
      const reach = A.attackRange * (.75 + .5 * P.aggression) * this.rangeBias;
      if (C.extras.toggles.enableAIAttack && distance <= reach && this.cooldown <= 0 && canDash && !target.flight) {
        if (P.mistake > 0 && this.random() < P.mistake * .5) this.cooldown = .15 + this.random() * .35; // deixou passar a oportunidade
        else {
          c.move = forward;c.tackle = true;
          this.cooldown = (mode === 'combat' ? A.combatAttackCooldown : C.test.aiInterval) * this.rhythm(P);
          this.phase++;
        }
      }
      if (self.stamina < A.lowStaminaThreshold && distance < A.lowStaminaDistance && !c.tackle) c.move = scale(forward, -A.lowStaminaRetreat);
    }
    // Hesitação: de vez em quando para por um instante (não cancela tackle, esquiva nem defesa).
    if (P.hesitation > 0 && (mode === 'combat' || mode === 'offensive' || mode === 'defensive')) {
      if (this.pause > 0) {this.pause -= dt;if (!c.tackle && !c.dodge) c.move = vec();}
      else if (this.random() < P.hesitation * dt) this.pause = .12 + this.random() * .3;
    }
    c.guardPressed = c.guard && !this.wasGuard;this.wasGuard = c.guard;
    return c;
  }
  /** Multiplicador do intervalo entre ações: agressividade encurta; variação sorteia ±. */
  rhythm(P) {return (P.variation > 0 ? 1 + P.variation * (2 * this.random() - 1) : 1) / (.5 + P.aggression);}
}
