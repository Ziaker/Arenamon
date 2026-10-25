// @ts-check
// Dividido de map.js (comportamento idêntico): map-damage.

import {C} from '../config.js';
import {sturdyGuard} from '../passive-engine.js';
import {wholeDamage} from '../damage-rule.js';
import {pickRandomConsumableType, randomRange} from './map-state.js';

/**
 * Pipeline Central de Dano com Escudo e Estágios de Defesa (R9.6, R10.1, R10.3, R11.3):
 * 1. Escudo absorve dano BRUTO antes da Defesa (R9.6, R11.3).
 * 2. Se dano bruto > escudo: consome todo o escudo e o excedente passa pela Defesa (R10.1).
 * 3. Defesa básica + estágios de defesa (-10 pp por estágio, R10.3) aplicados apenas ao excedente.
 * 4. Escudo não bloqueia empurrões nem lançamentos (R9.7).
 * @param {any} [arg0]
 * @param {any} [arg1]
 * @param {any} [arg2]
 * @param {boolean} [isBlocked]
 * @param {boolean} [isPerfect]
 * @param {{category?: string, contact?: string, attacker?: any}} [ctx] origem do dano ('direct' | 'periodic' | 'environmental' | 'reflected'): Sturdy só vale para dano letal DIRETO de ataque (R6).
 */
export function processDamageWithShieldAndStages(arg0, arg1, arg2 = null, isBlocked = false, isPerfect = false, ctx = {}) {
  let defender, rawDamage, attacker;
  if (typeof arg1 === 'number') {
    defender = arg0;
    rawDamage = arg1;
    attacker = arg2;
  } else {
    attacker = arg0;
    defender = arg1;
    rawDamage = typeof arg2 === 'number' ? arg2 : 0;
  }

  if (!defender || defender.hp <= 0) return {absorbedByShield: 0, hpDamage: 0};
  if (isPerfect) return {absorbedByShield: 0, hpDamage: 0};
  rawDamage = wholeDamage(rawDamage);   // regra de 23/10/2026: todo dano é número inteiro, arredondado SEMPRE para baixo

  defender.shield ??= {hp: 0, duration: 0, maxHp: 80};
  defender.stages ??= {attack: 0, defense: 0, staminaMax: 0, cooldown: 0, speed: 0};

  let unshieldedRaw = rawDamage;
  let absorbed = 0;

  // Escudo intercepta dano bruto primeiro (R9.6, R11.3)
  if (defender.shield.hp > 0) {
    if (defender.shield.hp >= rawDamage) {
      absorbed = rawDamage;
      defender.shield.hp -= rawDamage;
      unshieldedRaw = 0;
    } else {
      absorbed = defender.shield.hp;
      unshieldedRaw = rawDamage - defender.shield.hp;
      defender.shield.hp = 0;
      defender.shield.duration = 0;
    }
  }

  // Dano excedente passa pela Defesa básica e redução de estágios (R10.1, R10.3)
  let finalHpDamage = 0;
  /** @type {{hpDamage: number, sturdy: boolean}|null} Sturdy (R6/§7), quando aplicável. */
  let sg = null;
  if (unshieldedRaw > 0) {
    const X = C.extras?.combat;
    const guardMultiplier = isBlocked ? (X?.guardDamageMultiplier ?? 0.5) : 1.0;

    // Redução de 10 p.p. por estágio de Defesa (R6.11, R10.3)
    const stageReduction = (defender.stages.defense ?? 0) * (C.map?.stageDefenseReduction ?? 0.10);
    const defenseFactor = Math.max(0, 1.0 - stageReduction);

    finalHpDamage = wholeDamage(unshieldedRaw * guardMultiplier * defenseFactor);
    // Sturdy (R6/§7): dano letal DIRETO de ataque deixa exatamente 1 HP, 1× por rodada (DOT/ambiental/refletido não protege).
    sg = sturdyGuard(defender, finalHpDamage, {...ctx, attacker});
    finalHpDamage = sg.hpDamage;
    defender.hp = sg.sturdy ? 1 : Math.max(0, defender.hp - finalHpDamage);   // Sturdy já fixou o HP em 1 dentro de sturdyGuard

    if (attacker) {
      defender.lastAttacker = attacker.id;
      defender.lastDamagedTick = (defender.lastDamagedTick ?? 0) + 1;
    }
  }

  return {absorbedByShield: absorbed, hpDamage: finalHpDamage, sturdy: !!sg?.sturdy};
}
/**
 * Danifica um objeto destrutível de acordo com a categoria de entrega e bônus ofensivo (R3.6, R5.14, R9.10).
 * @param {any} destructible
 * @param {number} baseDamage
 * @param {string} [category]
 * @param {any} [attacker]
 * @param {any} [mapState]
 * @param {any[]} [events]
 */
export function damageDestructible(destructible, baseDamage, category = 'physical', attacker = null, mapState = null, events = []) {
  if (destructible.state !== 'solid' || destructible.hp <= 0) return false;
  if (destructible.rock) {   // Emerging Stone: HP 5; dano por golpe válido = P0 1, P1 2, P2 3, P3 4 (sem PL = P0); sem drops nem renascimento
    const pl = category === 'physical' ? (attacker?.action?.pl ?? 0) : 0, table = destructible.hpPerPl ?? [1, 2, 3, 4], dmgRock = table[Math.max(0, Math.min(3, pl))];
    destructible.hp = Math.max(0, destructible.hp - dmgRock);
    events.push({result: 'destructibleDamaged', id: destructible.id, damage: dmgRock, remainingHp: destructible.hp});
    if (destructible.hp <= 0 && mapState) {
      destructible.state = 'dead';mapState.destructibles = mapState.destructibles.filter(x => x !== destructible);
      events.push({result: 'rockDestroyed', id: destructible.id, owner: destructible.owner, why: 'hp', x: destructible.pos.x, z: destructible.pos.z});
      return true;
    }
    return false;
  }

  // Bônus de estágio de Ataque do atacante afeta objetos destrutíveis (R5.14)
  let atkMult = 1.0;
  if (attacker && attacker.stages?.attack) {
    atkMult += attacker.stages.attack * (C.map?.stageAttackBonus ?? 0.10);
  }

  // Multiplicador de resistência do objeto por categoria (R9.10)
  const res = destructible.resistances?.[category] ?? 1.0;
  const dmg = wholeDamage(baseDamage * atkMult * res);

  destructible.hp = Math.max(0, destructible.hp - dmg);
  events.push({result: 'destructibleDamaged', id: destructible.id, damage: dmg, remainingHp: destructible.hp});

  if (destructible.hp <= 0) {
    // Objeto destruído! (R1.12, R3.8, R6.5, R11.6)
    destructible.state = 'dead';
    destructible.respawnTimer = randomRange(mapState, C.map?.destructibleRespawnMin ?? 15, C.map?.destructibleRespawnMax ?? 30);
    if (mapState?.destructibleStats) mapState.destructibleStats.broken++;
    events.push({result: 'destructibleDestroyed', id: destructible.id, pos: {...destructible.pos}});

    // Spawn do drop de consumível que cai fisicamente (R1.12, R4.11, R11.6)
    if (mapState?.items) {
      const dropType = pickRandomConsumableType(mapState);
      const dHeight = destructible.size?.height ?? destructible.size?.hy ?? 1.6;
      mapState.items.push({
        id: mapState.nextEntityId++,
        type: dropType,
        pos: {x: destructible.pos.x, y: dHeight + 0.2, z: destructible.pos.z},
        life: C.map?.itemLifetime ?? 15,
        isDrop: true, // drop excepcional que pode exceder 4 itens (R5.16)
        vy: 1.5, // leve impulso para cima antes da queda balística
      });
      events.push({result: 'dropSpawned', type: dropType, pos: {...destructible.pos}});
      events.push({result: 'itemDropped', type: dropType, pos: {...destructible.pos}});
    }
    return true;
  }
  return false;
}
