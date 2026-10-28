// @ts-check
// Dividido de map.js (comportamento idêntico): map-damage.

import {C} from '../config.js';
import {resolveDamage, sourceKindOf} from '../resolvers/damage-resolver.js';
import {wholeDamage} from '../damage-rule.js';
import {pickRandomConsumableType, randomRange} from './map-state.js';

/**
 * Adaptador legado (F3.1): a autoridade de dano agora é resolveDamage (resolvers/damage-resolver.js); isto só traduz a assinatura antiga e devolve o formato antigo.
 * Escudo absorve o bruto antes da Defesa (R9.6, R11.3); o excedente passa por guarda e estágios de Defesa (R10.1, R10.3); escudo não bloqueia empurrões nem lançamentos (R9.7).
 * Sobrecarga legada: (atacante, alvo, dano) quando o 2º argumento não é número.
 * @param {any} [arg0]
 * @param {any} [arg1]
 * @param {any} [arg2]
 * @param {boolean} [isBlocked]
 * @param {boolean} [isPerfect]
 * @param {{category?: string, contact?: string, attacker?: any}} [ctx] origem do dano ('direct' | 'periodic' | 'environmental' | 'reflected'): Sturdy só vale para dano letal DIRETO de ataque (R6).
 */
export function processDamageWithShieldAndStages(arg0, arg1, arg2 = null, isBlocked = false, isPerfect = false, ctx = {}) {
  const legacy = typeof arg1 !== 'number';
  const defender = legacy ? arg1 : arg0, attacker = legacy ? arg0 : arg2, rawDamage = legacy ? (typeof arg2 === 'number' ? arg2 : 0) : arg1;
  if (!defender || defender.hp <= 0 || isPerfect) return {absorbedByShield: 0, hpDamage: 0};
  const r = resolveDamage({target: defender, attacker, rawDamage, sourceKind: sourceKindOf(ctx.category), contact: ctx.contact ?? null, guarded: isBlocked});
  return {absorbedByShield: r.shieldAbsorbed, hpDamage: r.hpDamage, sturdy: r.sturdy};
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
