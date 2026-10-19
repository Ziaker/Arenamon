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
import {movesCommand} from './ai-moves.js';

export const AI_MODES = [
  ['inactive', 'Parado (dummy)'], ['defensive', 'Defensivo (v6)'], ['offensive', 'Ofensivo (v6)'], ['combat', 'Combate (v6)'],
  ['guard', 'Sempre defendendo'], ['evade', 'Sempre esquivando'], ['counter', 'Defende e contra-ataca'], ['random', 'Aleatório (semente fixa)'],
  ['tactical', 'Tático (estratégico)'],
];

/** Modos oferecidos na interface: IA normal (a mais recente), ataque constante, defesa constante e parado. */
export const UI_AI_MODES = [['tactical', 'Normal (IA tática)'], ['offensive', 'Ataque constante'], ['guard', 'Defesa constante'], ['inactive', 'Parado (IA desligada)']];

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
const STATE = ['cooldown', 'phase', 'wasGuard', 'orbitAge', 'orbitSign', 'rngState', 'hold', 'held', 'seed', 'threatAge', 'reactAt', 'misread', 'pause', 'orbitPeriod', 'rangeBias', 'wantsEvade', 't', 'moveIntent', 'intentAge', 'lastTurnFrom'];

export class Brain {
  /** side: 'aiRed' (adversário) ou 'aiBlue' (IA do jogador) escolhe a personalidade. */
  constructor(seed = 1, side = 'aiRed') {this.seed = seed;this.side = side;this.reset();}
  reset() {
    this.cooldown = C.extras.ai.initialCooldown;this.phase = 0;this.wasGuard = false;this.orbitAge = 0;this.orbitSign = 1;this.rngState = this.seed >>> 0;this.hold = 0;this.held = null;
    this.threatAge = 0;this.reactAt = null;this.misread = false;this.pause = 0;this.orbitPeriod = null;this.rangeBias = 1;this.wantsEvade = false;
    this.moveIntent = null;this.intentAge = 0;this.lastTurnFrom = null;
    this.t = null; // estado da IA tática (tactics.js), recriado a cada partida
  }
  random() {const [v, next] = mulberry(this.rngState);this.rngState = next;return v;}
  personality() {return {...NEUTRAL_PERSONALITY, ...(C.extras[this.side] || {})};}
  /** Estado serializável (replay e cenários). */
  save() {return Object.fromEntries(STATE.map(k => [k, this[k]]));}
  load(s) {Object.assign(this, structuredClone(s));}
  /** Intenção de movimento enviada ao mesmo controlador do jogador, suavizada contra giros instantâneos e zigue-zague. */
  command(self, target, mode, dt) {return this.smooth(this.decide(self, target, mode, dt), dt, target);}
  smooth(c, dt, target) {
    const A = C.extras.ai, rate = A.moveSmoothing ?? 0;
    if (rate <= 0) return c;
    const prev = this.moveIntent ?? vec(), want = c.move, wl = length(want), pl = length(prev);
    this.intentAge = (this.intentAge ?? 0) + dt;
    // Ataques e esquivas usam a direção pedida, sem suavização (as regras de mira não mudam).
    // Respostas a ameaças (tackle do adversário em curso ou defesa) também passam direto: a suavização é só da locomoção livre.
    if (c.tackle || c.dodge || c.guard || target?.action?.kind === 'tackle') {this.moveIntent = {...want};this.intentAge = 0;return c;}
    let dir = want;
    const ang = v => Math.atan2(v.x, v.z), gap = (a, b) => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
    if (wl > 1e-6 && pl > 1e-6) {
      const a = ang(prev), b = ang(want), diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
      // Zigue-zague: voltar à direção anterior logo depois de mudar fica retido por minDirectionHold.
      const flipBack = this.lastTurnFrom && gap(b, ang(this.lastTurnFrom)) < .6 && Math.abs(diff) > .6 && this.intentAge < (A.minDirectionHold ?? 0);
      if (flipBack) dir = prev;
      // Inversões intencionais (recuar, isca) passam inteiras: a física já as torna graduais (frenagem e reversão).
      else if (Math.abs(diff) > 2.4) {dir = want;this.lastTurnFrom = {...prev};this.intentAge = 0;}
      else {
        const turn = Math.max(-rate * dt, Math.min(rate * dt, diff));dir = scale(direction(a + turn), wl);
        if (Math.abs(diff) > .6) {if (this.intentAge > .05) this.lastTurnFrom = {...prev};this.intentAge = 0;}
      }
    } else if (wl > 1e-6 || pl > 1e-6) this.intentAge = 0;
    this.moveIntent = {...dir};c.move = dir;return c;
  }
  decide(self, target, mode, dt) {
    const A = C.extras.ai, P = this.personality(), c = emptyCommand();
    if (mode === 'inactive') {this.wasGuard = false;return c;}
    if (mode === 'tactical') return movesCommand(this, self, target, tacticalCommand(this, self, target, dt, P));   // Moves equipados: mesmas regras do jogador (ai-moves.js)
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
      const mapState = this.getMapState?.();
      let seekItem = null;
      if (mapState?.items?.length && self.hp < (self.attributes.hp * 0.7) && distance > 5.5 && !threatNear) {
        let minDist = Infinity;
        for (const it of mapState.items) {
          const d = Math.hypot(it.pos.x - self.position.x, it.pos.z - self.position.z);
          if (d < 25 && d < minDist) {
            minDist = d;
            seekItem = it;
          }
        }
      }
      if (seekItem) {
        const toItem = sub({x: seekItem.pos.x, z: seekItem.pos.z}, self.position);
        c.move = length(toItem) > 1e-4 ? normalize(toItem) : vec();
      } else if (distance > A.approachDistance * this.rangeBias) c.move = forward;
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
