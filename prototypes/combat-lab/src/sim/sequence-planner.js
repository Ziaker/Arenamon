// Planejamento de sequências táticas hierárquicas (Fase 9).
//
// Permite que a IA execute planos estruturados em múltiplos passos (ex: bait & punish, corner trap,
// absorb & counter, charge setup) sem oscilar frame a frame, com interrupções limpas de emergência.

import {C} from './config.js';
import {vec, add, sub, scale, length, normalize, dot, clamp} from './math.js';
import {safeArenaDirection, cornerPressureDirection} from './spatial.js';
import {calculatePunishWindow} from './prediction.js';

export const PLAN_TYPES = {
  BAIT_AND_PUNISH: 'bait_and_punish',
  CORNER_TRAP: 'corner_trap',
  ABSORB_AND_COUNTER: 'absorb_and_counter',
  CHARGE_SETUP: 'charge_setup',
};

/**
 * Cria uma nova instância de plano estruturado.
 * @param {string} type
 * @param {object} options
 */
export function createPlan(type, options = {}) {
  const defaults = {
    [PLAN_TYPES.BAIT_AND_PUNISH]: {maxTime: 2.2, step: 'approach'},
    [PLAN_TYPES.CORNER_TRAP]: {maxTime: 2.8, step: 'cut_off'},
    [PLAN_TYPES.ABSORB_AND_COUNTER]: {maxTime: 1.8, step: 'guard'},
    [PLAN_TYPES.CHARGE_SETUP]: {maxTime: 2.5, step: 'retreat_safe'},
  };

  const def = defaults[type] ?? {maxTime: 2.0, step: 'start'};
  return {
    type,
    step: def.step,
    stepTime: 0,
    totalTime: 0,
    maxTime: options.maxTime ?? def.maxTime,
    status: 'running', // 'running' | 'completed' | 'interrupted' | 'expired'
    data: {...options},
  };
}

/**
 * Avalia se o plano ativo deve ser interrompido por emergência.
 * @param {object} plan
 * @param {object} self
 * @param {object} target
 * @param {object} context
 * @returns {boolean}
 */
export function shouldInterruptPlan(plan, self, target, context = {}) {
  if (!plan || plan.status !== 'running') return false;

  // 1. Dano sofrido / controle de grupo
  if (self.knockRecovery > 0 || self.stun > 0 || self.flight) {
    plan.status = 'interrupted';
    plan.interruptionReason = 'hit_taken';
    return true;
  }

  // 2. Exaustão do próprio lutador (não consegue mais executar o plano)
  if (self.exhausted) {
    plan.status = 'interrupted';
    plan.interruptionReason = 'self_exhausted';
    return true;
  }

  // 3. Timeout de segurança
  if (plan.totalTime >= plan.maxTime) {
    plan.status = 'expired';
    plan.interruptionReason = 'timeout';
    return true;
  }

  // 4. Oponente ficou exausto: oportunidade de finalização substitui planos lentos
  if (target.exhausted && plan.type !== PLAN_TYPES.CORNER_TRAP) {
    plan.status = 'interrupted';
    plan.interruptionReason = 'opponent_exhausted_opportunity';
    return true;
  }

  // 5. Ameaça iminente de projétil ou golpe inesperado que exige defesa imediata
  if (context.hasUrgentThreat && plan.step !== 'guard' && plan.step !== 'counter') {
    plan.status = 'interrupted';
    plan.interruptionReason = 'urgent_threat';
    return true;
  }

  return false;
}

/**
 * Executa um passo do plano ativo e devolve comandos sugeridos.
 * @param {object} plan
 * @param {object} self
 * @param {object} target
 * @param {number} dt
 * @param {object} options
 * @returns {{command: object, planComplete: boolean}}
 */
export function updatePlan(plan, self, target, dt, options = {}) {
  if (!plan || plan.status !== 'running') {
    return {command: null, planComplete: true};
  }

  plan.totalTime += dt;
  plan.stepTime += dt;

  if (shouldInterruptPlan(plan, self, target, options)) {
    return {command: null, planComplete: true};
  }

  const diff = sub(target.position, self.position);
  const distance = length(diff);
  const forward = distance > 1e-6 ? normalize(diff) : vec(0, 1);
  const arenaHalf = options.arenaHalf ?? C.test.arenaHalf;
  const reach = options.reach ?? 2.4;
  const cmd = {move: vec(), tackle: false, dodge: false, guard: false, dodgeDirection: null};

  switch (plan.type) {
    case PLAN_TYPES.BAIT_AND_PUNISH: {
      // Passo 1: Aproximação até a borda de perigo (~reach + 0.3)
      if (plan.step === 'approach') {
        cmd.move = forward;
        if (distance <= reach + 0.35 || plan.stepTime > 0.5) {
          plan.step = 'feint_retreat';
          plan.stepTime = 0;
        }
      }
      // Passo 2: Micro-recuo súbito para induzir o whiff do rival
      else if (plan.step === 'feint_retreat') {
        cmd.move = scale(forward, -0.6);
        // Se o oponente desfere um tackle que passa curto
        if (target.action?.kind === 'tackle' || plan.stepTime >= 0.25) {
          plan.step = 'await_whiff';
          plan.stepTime = 0;
        }
      }
      // Passo 3: Espera a janela de whiff do oponente
      else if (plan.step === 'await_whiff') {
        cmd.guard = true; // mantém guarda pronta caso ele alcance mais do que o esperado
        const pw = calculatePunishWindow(target);
        if (pw.isVulnerable || target.action?.kind === 'recoil' || (target.action?.kind === 'tackle' && target.action.elapsed > 0.3)) {
          plan.step = 'punish';
          cmd.guard = false;
          cmd.move = forward;
          cmd.tackle = true;
          plan.status = 'completed';
          return {command: cmd, planComplete: true};
        } else if (plan.stepTime >= 0.35) {
          plan.status = 'completed';
          return {command: cmd, planComplete: true};
        }
      }
      // Passo 4: Punição imediata com tackle
      else if (plan.step === 'punish') {
        cmd.move = forward;
        cmd.tackle = true;
        plan.status = 'completed';
        return {command: cmd, planComplete: true};
      }
      break;
    }

    case PLAN_TYPES.CORNER_TRAP: {
      // Corta a rota de fuga para o centro da arena e empurra o oponente para a parede
      if (plan.step === 'cut_off') {
        cmd.move = cornerPressureDirection(self.position, target.position, arenaHalf);
        if (distance <= reach + 0.2 || plan.stepTime >= 0.6) {
          plan.step = 'press';
          plan.stepTime = 0;
        }
      } else if (plan.step === 'press') {
        // Encurralado: se o oponente tenta esquivar ou whiffar, pune; se vulnerável, ataca; senão mantém contenção
        if ((target.action?.kind === 'dodge' && target.action.elapsed > 0.18) || (distance <= reach && !target.guard && target.action?.kind !== 'tackle')) {
          cmd.move = forward;
          cmd.tackle = true;
          plan.status = 'completed';
          return {command: cmd, planComplete: true};
        } else {
          cmd.move = scale(forward, distance > reach * 0.7 ? 0.6 : 0);
          if (distance <= reach * 0.9) {
            cmd.guard = true; // guarda preventiva enquanto oprime
          }
          if (plan.stepTime >= 0.5) {
            plan.status = 'completed';
            return {command: cmd, planComplete: true};
          }
        }
      }
      break;
    }

    case PLAN_TYPES.ABSORB_AND_COUNTER: {
      if (plan.step === 'guard') {
        cmd.guard = true;
        cmd.move = scale(forward, -0.2); // absorve com recuo suave
        if (self.counterWindow > 0 || target.action?.kind === 'recoil') {
          plan.step = 'counter';
          plan.stepTime = 0;
        } else if (plan.stepTime >= 0.6) {
          plan.status = 'completed';
          return {command: cmd, planComplete: true};
        }
      } else if (plan.step === 'counter') {
        cmd.move = forward;
        cmd.tackle = true;
        plan.status = 'completed';
        return {command: cmd, planComplete: true};
      }
      break;
    }

    case PLAN_TYPES.CHARGE_SETUP: {
      if (plan.step === 'retreat_safe') {
        cmd.move = scale(forward, -1.0);
        if (distance >= reach + 1.8 || plan.stepTime >= 0.6) {
          plan.step = 'charge_ready';
          plan.stepTime = 0;
          plan.status = 'completed';
          return {command: cmd, planComplete: true};
        }
      }
      break;
    }

    default:
      plan.status = 'completed';
      return {command: null, planComplete: true};
  }

  // Clamping de arena no movimento do plano
  if (length(cmd.move) > 0.05) {
    cmd.move = safeArenaDirection(self.position, cmd.move, arenaHalf, 1.5);
  }

  return {command: cmd, planComplete: plan.status !== 'running'};
}
