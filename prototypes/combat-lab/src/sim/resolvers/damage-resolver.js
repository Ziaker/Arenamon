// @ts-check
// F3.1 — Autoridade central de dano: TODO dano a lutador passa por aqui (golpe, choque, footstool, mundo, ambiente, status, refletido).
// Mesma matemática do pipeline antigo de map-damage.js (escudo → guarda → estágios de Defesa → inteiro → Sturdy); só centraliza e devolve o detalhamento.
import {C} from '../config.js';
import {wholeDamage} from '../damage-rule.js';

/** Origens válidas. As categorias antigas do pipeline viram: 'direct' → 'direct', 'periodic' → 'status', 'environmental' → 'environmental', 'reflected' → 'reflected'; sem categoria → 'system'. */
export const SOURCE_KINDS = Object.freeze(['direct', 'environmental', 'status', 'reflected', 'system']);
/** Converte a `category` antiga (ctx do processDamageWithShieldAndStages) no `sourceKind` novo. */
export const sourceKindOf = (/** @type {string|undefined} */ category) => category === 'periodic' ? 'status' : category && SOURCE_KINDS.includes(category) ? category : 'system';

/** Sturdy (R6/§7): dano letal DIRETO de ataque deixa o HP exatamente em 1, uma vez por rodada. Devolve o dano efetivo ao HP.
 * Mora aqui (e não em passive-engine.js) para o resolvedor não importar o motor de passivas — que importa o resolvedor (sem ciclo de importação).
 * @param {any} defender @param {number} finalHpDamage @param {{category?: string, attacker?: any}} [ctx] */
export function sturdyGuard(defender, finalHpDamage, ctx = {}) {
  const st = defender.passiveState;
  if (!C.extras?.toggles?.enablePassives || !st || ctx.category !== 'direct' || !ctx.attacker) return {hpDamage: finalHpDamage, sturdy: false};
  if (!st.loadout.includes('sturdy') || !st.sturdyAvailable || st.sturdyUsed || defender.hp <= 0) return {hpDamage: finalHpDamage, sturdy: false};
  if (finalHpDamage < defender.hp) return {hpDamage: finalHpDamage, sturdy: false};
  const effective = Math.max(0, defender.hp - 1);
  defender.hp = 1;
  st.sturdyAvailable = false;st.sturdyUsed = true;
  return {hpDamage: effective, sturdy: true};
}

/**
 * @typedef {{rawDamage: number, hpDamage: number, shieldAbsorbed: number, absorbedByDefense: number, sturdy: boolean, perfect: boolean, guarded: boolean,
 *   sourceKind: string, contact: string|null, attackerId: number|null, indirectAttackerId: number|null, killed: boolean}} DamageResult
 */

/**
 * Resolve um dano no alvo e devolve o detalhamento. Ordem (R9.6, R10.1, R10.3, R11.3, R6):
 * 1. alvo nulo/derrotado ou defesa perfeita → nada acontece (0);
 * 2. dano bruto vira inteiro para baixo (regra de 23/10/2026);
 * 3. escudo absorve o bruto primeiro (policy.bypassShield pula);
 * 4. o excedente × guardDamageMultiplier (se guardado) × (1 − estágios·stageDefenseReduction), inteiro de novo (policy.bypassDefense pula);
 * 5. Sturdy: só dano letal DIRETO com atacante deixa 1 HP;
 * 6. lastAttacker/lastDamagedTick só quando há autor (attacker, ou o indireto) e policy.trackAttacker ≠ false — e só se algo passou do escudo (como antes).
 * `absorbedByDefense` = excedente após o escudo − dano ao HP ANTES do Sturdy: o que a guarda, os estágios de Defesa e o arredondamento tiraram (pode ser < 0 com estágio negativo).
 * `hpDamage` = dano efetivo ao HP; não é limitado ao HP restante (golpe letal pode passar do que sobrava, como no evento antigo), exceto pelo Sturdy.
 * @param {{target: any, attacker?: any, indirectAttacker?: any, rawDamage: number, sourceKind: string, contact?: string|null, guarded?: boolean, perfect?: boolean,
 *   policy?: {bypassShield?: boolean, bypassDefense?: boolean, trackAttacker?: boolean}}} req
 * @returns {DamageResult}
 */
export function resolveDamage(req) {
  const t = req?.target, hp0 = t?.hp ?? null, sh0 = t ? (t.shield?.hp ?? 0) : null;
  const r = resolveCore(req);
  damageLedger.count++;
  if (damageLedger.entries) damageLedger.entries.push({targetId: t?.id ?? null, hpBefore: hp0, hpAfter: t?.hp ?? null, shieldBefore: sh0, shieldAfter: t ? (t.shield?.hp ?? 0) : null, ...r});
  return r;
}
/**
 * F6 — Livro de transações de dano (diagnóstico/teste; a simulação nunca o lê): `count` soma toda chamada a resolveDamage; com `entries` = [],
 * cada transação é anotada {targetId, hpBefore, hpAfter, shieldBefore, shieldAfter, ...DamageResult}. No jogo `entries` fica null (custo: um incremento).
 * Prova de conservação em test/f6-moves-contract.test.mjs: HP/escudo de lutador só mudam por aqui.
 * @type {{count: number, entries: any[] | null}}
 */
export const damageLedger = {count: 0, entries: null};

/** @param {Parameters<typeof resolveDamage>[0]} req @returns {DamageResult} */
function resolveCore({target, attacker = null, indirectAttacker = null, rawDamage, sourceKind, contact = null, guarded = false, perfect = false, policy = {}}) {
  const hpBefore = target?.hp ?? 0;
  /** @type {DamageResult} */
  const out = {rawDamage: 0, hpDamage: 0, shieldAbsorbed: 0, absorbedByDefense: 0, sturdy: false, perfect: !!perfect, guarded: !!guarded, sourceKind, contact: contact ?? null,
    attackerId: attacker?.id ?? null, indirectAttackerId: indirectAttacker?.id ?? null, killed: false};
  if (!target || target.hp <= 0 || perfect) return out;
  const raw = wholeDamage(rawDamage);
  out.rawDamage = raw;
  let unshieldedRaw = raw;
  if (!policy.bypassShield) {
    target.shield ??= {hp: 0, duration: 0, maxHp: 80};
    if (target.shield.hp > 0) {
      if (target.shield.hp >= raw) {out.shieldAbsorbed = raw;target.shield.hp -= raw;unshieldedRaw = 0;}
      else {out.shieldAbsorbed = target.shield.hp;unshieldedRaw = raw - target.shield.hp;target.shield.hp = 0;target.shield.duration = 0;}
    }
  }
  if (!policy.bypassDefense) target.stages ??= {attack: 0, defense: 0, staminaMax: 0, cooldown: 0, speed: 0};
  if (unshieldedRaw <= 0) return out;
  let hpDamage = unshieldedRaw;
  if (!policy.bypassDefense) {
    const guardMultiplier = guarded ? (C.extras?.combat?.guardDamageMultiplier ?? 0.5) : 1.0;
    const defenseFactor = Math.max(0, 1.0 - (target.stages.defense ?? 0) * (C.map?.stageDefenseReduction ?? 0.10));   // −10 p.p. por estágio (R6.11, R10.3)
    hpDamage = wholeDamage(unshieldedRaw * guardMultiplier * defenseFactor);
  }
  out.absorbedByDefense = unshieldedRaw - hpDamage;
  const author = attacker ?? indirectAttacker;
  const sg = sturdyGuard(target, hpDamage, {category: sourceKind, attacker});   // só 'direct' com atacante; o indireto nunca ativa Sturdy
  out.hpDamage = sg.hpDamage;out.sturdy = !!sg.sturdy;
  target.hp = sg.sturdy ? 1 : Math.max(0, target.hp - out.hpDamage);   // Sturdy já fixou o HP em 1 dentro de sturdyGuard
  if (author && policy.trackAttacker !== false) {
    target.lastAttacker = author.id;
    target.lastDamagedTick = (target.lastDamagedTick ?? 0) + 1;
  }
  out.killed = hpBefore > 0 && target.hp <= 0;
  return out;
}

/** Campos de dano padronizados para os eventos (F3.1): quem emite evento de dano espalha isto nele. */
export const damageEventFields = (/** @type {DamageResult} */ r) => ({rawDamage: r.rawDamage, hpDamage: r.hpDamage, shieldAbsorbed: r.shieldAbsorbed, sourceKind: r.sourceKind});
