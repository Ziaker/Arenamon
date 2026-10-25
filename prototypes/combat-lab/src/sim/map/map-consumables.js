// @ts-check
// Dividido de map.js (comportamento idêntico): map-consumables.

import {C} from '../config.js';
import {getFighterMaxStamina} from '../entity.js';
import {MAP_DEFAULTS} from './map-config.js';

/**
 * Aplica o efeito do consumível ao lutador conforme todas as regras de progressão,
 * conversão em cura, concessão de escudo e bônus de stamina (R4, R5, R6, R9, R10, R11).
 */
export function applyConsumableEffect(fighter, type, events = []) {
  const M = C.map ?? MAP_DEFAULTS;
  fighter.stages ??= {attack: 0, defense: 0, staminaMax: 0, cooldown: 0, speed: 0};
  fighter.shield ??= {hp: 0, duration: 0, maxHp: M.shieldMaxCap ?? 80};

  const maxStages = M.stagesMax ?? 4;
  const isAllMaxed =
    fighter.stages.attack >= maxStages &&
    fighter.stages.defense >= maxStages &&
    fighter.stages.staminaMax >= maxStages &&
    fighter.stages.cooldown >= maxStages &&
    fighter.stages.speed >= maxStages;

  // 1. Consumível exclusivo de Cura de HP (R9.1: 20 HP padrão)
  if (type === 'heal_hp') {
    applyHpHeal(fighter, M.healHp ?? 20, events);
    return;
  }

  // 2. Consumível exclusivo de Stamina Imediata (R9.2: 2 pontos padrão)
  if (type === 'heal_stamina') {
    applyStaminaHeal(fighter, M.healStamina ?? 2, events);
    return;
  }

  // 3. Consumíveis de Atributos Evolutivos (5 categorias, R5.1)
  const categoryMap = {
    buff_attack: 'attack',
    buff_defense: 'defense',
    buff_stamina_max: 'staminaMax',
    buff_cooldown: 'cooldown',
    buff_speed: 'speed',
  };

  const cat = categoryMap[type];
  if (cat) {
    if (fighter.stages[cat] < maxStages) {
      // Evolui em 1 estágio permanente (R5.1, R5.3)
      fighter.stages[cat]++;

      // Efeito imediato na stamina máxima (R6.10: +1 à capacidade e +1 à stamina atual simultaneamente)
      if (cat === 'staminaMax') {
        const bonusCap = M.stageStaminaBonus ?? 1;
        const maxStam = getFighterMaxStamina(fighter);
        fighter.stamina = Math.min(maxStam, fighter.stamina + bonusCap);
        fighter.regenBase = fighter.stamina;
        fighter.exhausted = false;
      }

      events.push({result: 'stageUp', fighter: fighter.id, category: cat, stage: fighter.stages[cat]});
      return;
    }

    // A categoria já está no estágio 4! Converte em cura de HP comum (R5.10, R6.14)
    if (!isAllMaxed || fighter.hp < fighter.attributes.hp) {
      applyHpHeal(fighter, M.healHp ?? 20, events);
      return;
    }

    // Todos os 5 atributos estão no estágio 4 E HP está cheio!
    // Concede benefício especial repetível: recuperação imediata de stamina (R9.8, R9.9)
    if (fighter.stamina < getFighterMaxStamina(fighter)) {
      applyStaminaHeal(fighter, M.healStamina ?? 2, events);
      return;
    }

    // Se até a stamina já estiver cheia: concede escudo temporário acumulável (R10.4)
    applyShield(fighter, M.shieldCapacity ?? 40, M.shieldDuration ?? 10, events);
  }
}
/** Aplica cura de HP, convertendo qualquer excedente em pontos de escudo (R11.4, R5.11). */
export function applyHpHeal(fighter, amount, events = []) {
  const M = C.map ?? MAP_DEFAULTS;
  const maxHp = fighter.attributes.hp ?? 100;

  if (fighter.hp >= maxHp) {
    // HP já estava cheio: concede escudo temporário direto de 40 HP por 10s (R5.11, R6.15, R9.3, R9.4)
    applyShield(fighter, M.shieldCapacity ?? 40, M.shieldDuration ?? 10, events);
    return;
  }

  const missing = maxHp - fighter.hp;
  if (amount <= missing) {
    fighter.hp += amount;
    events.push({result: 'healedHp', fighter: fighter.id, amount, newHp: fighter.hp});
  } else {
    // Cura excedeu o HP máximo: recupera até o máximo e converte SOMENTE o excedente em escudo (R11.4)
    fighter.hp = maxHp;
    const overflow = amount - missing;
    events.push({result: 'healedHp', fighter: fighter.id, amount: missing, newHp: maxHp});
    applyShield(fighter, overflow, M.shieldDuration ?? 10, events);
  }
}
/** Aplica recuperação imediata de stamina. */
export function applyStaminaHeal(fighter, amount, events = []) {
  const maxStam = getFighterMaxStamina(fighter);
  const gained = Math.min(amount, Math.max(0, maxStam - fighter.stamina));
  fighter.stamina = Math.min(maxStam, fighter.stamina + amount);
  fighter.regenBase = fighter.stamina;
  fighter.regenAge = 0;
  if (fighter.stamina >= 1) fighter.exhausted = false;
  events.push({result: 'healedStamina', fighter: fighter.id, amount: gained, newStamina: fighter.stamina});
}
/**
 * Concede ou renova escudo temporário (R9.3–R9.7, R10.2).
 * - Duração renovada integralmente para 10 s (R10.2).
 * - Capacidade soma com a existente até teto configurável (R9.5).
 */
export function applyShield(fighter, points, duration = 10, events = []) {
  const M = C.map ?? MAP_DEFAULTS;
  const maxCap = fighter.shield?.maxHp ?? M.shieldMaxCap ?? 80;
  fighter.shield ??= {hp: 0, duration: 0, maxHp: maxCap};

  const oldHp = fighter.shield.hp;
  fighter.shield.hp = Math.min(maxCap, fighter.shield.hp + points);
  fighter.shield.duration = duration; // renova integralmente para 10s (R10.2)

  events.push({
    result: 'shieldApplied',
    fighter: fighter.id,
    added: fighter.shield.hp - oldHp,
    current: fighter.shield.hp,
    duration,
  });
}
/** Atualiza temporizador do escudo a cada passo fixo (congelado em pause/hitstop R11.8). */
export function stepShield(fighter, dt, events = []) {
  if (fighter.shield && fighter.shield.hp > 0) {
    fighter.shield.duration -= dt;
    if (fighter.shield.duration <= 0) {
      fighter.shield.hp = 0;
      fighter.shield.duration = 0;
      events.push({result: 'shieldExpired', fighter: fighter.id});
    }
  }
}
