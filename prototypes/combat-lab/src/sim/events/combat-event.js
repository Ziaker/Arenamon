// @ts-check
// F3.4 — CombatEvent normalizado. Todo evento que sai de Game.step passa por normalizeCombatEvent (no laço final, depois do id e do tick):
// ganha os campos canônicos sem perder nenhum legado (a view continua lendo attacker/target/result/damage/pos...). Contrato: docs/CONTRATO_EVENTOS_VFX.md §2.
//   eventId = id · outcome = result · attackerId/targetId = attacker/target numéricos ou null · indirectAttackerId (autor indireto: wall splat, destrutível)
//   sourceKind: o do DamageResolver quando já existe; senão environmental (category), status (status/periódico), system (sem alvo lutador ou ciclo de vida), direct
//   position = position | pos | {x, y, z} soltos | null (y ausente = 0) · normal | null · rawDamage/hpDamage (= damage) · shieldAbsorbed (0 padrão)

export const SOURCE_KINDS = Object.freeze(['direct', 'environmental', 'status', 'reflected', 'system']);
const STATUS_RESULTS = new Set(['statusApplied', 'statusTick', 'statusExpired']);
/** Eventos com alvo lutador que não são combate: ciclo de vida de passivas e curas. */
const SYSTEM_RESULTS = new Set(['passiveActivated', 'passiveEnded', 'passiveCycleSuspect', 'passiveHeal', 'healedHp', 'healedStamina', 'shieldApplied', 'stageUp']);

const num = (/** @type {any} */ v) => typeof v === 'number' && Number.isFinite(v);
const idOrNull = (/** @type {any} */ v) => num(v) ? v : null;
/** @param {any} p */
const vec3 = p => p && num(p.x) && num(p.z) ? (num(p.y) ? p : {x: p.x, y: 0, z: p.z}) : null;
/** x/y/z soltos no próprio evento: sempre um objeto novo (nunca o evento). @param {any} e */
const loose = e => num(e.x) && num(e.z) ? {x: e.x, y: num(e.y) ? e.y : 0, z: e.z} : null;

/** @param {any} e */
function sourceKindOf(e, /** @type {number|null} */ targetId) {
  if (SOURCE_KINDS.includes(e.sourceKind)) return e.sourceKind;
  if (e.category === 'environmental') return 'environmental';
  if (STATUS_RESULTS.has(e.result) || e.category === 'periodic') return 'status';
  if (targetId == null || SYSTEM_RESULTS.has(e.result)) return 'system';
  return 'direct';
}

/** Preenche os campos canônicos no próprio evento (in-place, idempotente) e o devolve. */
export function normalizeCombatEvent(/** @type {any} */ e) {
  e.eventId = e.id;
  e.outcome = e.result;
  e.attackerId = idOrNull(e.attacker);
  e.targetId = idOrNull(e.target);
  e.indirectAttackerId = idOrNull(e.indirectAttackerId ?? e.indirectAttacker);
  e.sourceKind = sourceKindOf(e, e.targetId);
  e.position = vec3(e.position) ?? vec3(e.pos) ?? loose(e);
  e.normal ??= null;
  e.hpDamage = num(e.hpDamage) ? e.hpDamage : num(e.damage) ? e.damage : 0;
  e.rawDamage = num(e.rawDamage) ? e.rawDamage : e.hpDamage;
  e.shieldAbsorbed = num(e.shieldAbsorbed) ? e.shieldAbsorbed : 0;
  return e;
}

/** Lista de violações do contrato (vazia = válido). */
export function validateCombatEvent(/** @type {any} */ e) {
  const out = [];
  if (e.eventId == null || e.eventId !== e.id) out.push(`eventId ${e.eventId} ≠ id ${e.id}`);
  if (!Number.isInteger(e.tick) || e.tick < 0) out.push(`tick inválido ${e.tick}`);
  if (typeof e.outcome !== 'string' || !e.outcome || e.outcome !== e.result) out.push(`outcome ${e.outcome} ≠ result ${e.result}`);
  if (e.attackerId !== idOrNull(e.attacker)) out.push(`attackerId ${e.attackerId} ≠ attacker ${e.attacker}`);
  if (e.targetId !== idOrNull(e.target)) out.push(`targetId ${e.targetId} ≠ target ${e.target}`);
  if (e.indirectAttackerId !== null && !num(e.indirectAttackerId)) out.push(`indirectAttackerId inválido ${e.indirectAttackerId}`);
  if (num(e.indirectAttacker) && e.indirectAttackerId !== e.indirectAttacker) out.push(`indirectAttackerId ${e.indirectAttackerId} ≠ indirectAttacker ${e.indirectAttacker}`);
  if (!SOURCE_KINDS.includes(e.sourceKind)) out.push(`sourceKind inválido ${e.sourceKind}`);
  if (e.sourceKind === 'environmental' && e.attackerId !== null) out.push(`ambiental com attackerId ${e.attackerId}`);
  if (e.position !== null && !(e.position && num(e.position.x) && num(e.position.y) && num(e.position.z))) out.push(`position inválida ${JSON.stringify(e.position)}`);
  if (e.normal !== null && !(e.normal && num(e.normal.x) && num(e.normal.z) && (e.normal.y === undefined || num(e.normal.y)))) out.push(`normal inválida ${JSON.stringify(e.normal)}`);
  for (const k of ['rawDamage', 'hpDamage', 'shieldAbsorbed']) if (!num(e[k]) || e[k] < 0) out.push(`${k} inválido ${e[k]}`);
  if (num(e.damage) && e.hpDamage !== e.damage) out.push(`hpDamage ${e.hpDamage} ≠ damage ${e.damage}`);
  return out;
}
