// @ts-check
// Perfil tático DECLARATIVO da IA (#09 do plano de 23/10/2026): em vez de um `if` por Move espalhado em ai-new-moves.js, o Move declara na própria
// ficha quando a IA deve usá-lo (distância útil, modalidade, condições, stamina, chance) e este módulo compila isso numa regra de oportunidade.
// A IA continua pedindo pelos mesmos comandos do jogador e passando pelas mesmas permissões (custo, recarga, chão, alvo): o perfil só diz
// "vale a pena agora"; quem decide se PODE é o controlador. O motivo (`why`) vai para o log de decisões da IA. Sem rebalancear nada sozinho.

/** Condições booleanas do contexto de decisão (ver `context()` em ai-new-moves.js). */
export const AI_FLAGS = ['tGround', 'tGuard', 'facing', 'tackling', 'tCharging'];
export const AI_KINDS = ['tap', 'charge', 'aim'];

/**
 * @typedef {{kind: 'tap' | 'charge' | 'aim', p: number, why: string, distance?: {min?: number, max?: number}, minStamina?: number, maxStamina?: number,
 *   requires?: string[], forbids?: string[], anyOf?: string[], notStatus?: string, goal?: number | ((x: any, self: any) => number), mode?: string, offset?: number,
 *   when?: (x: any, self: any, target: any) => boolean}} AiProfile
 *   distance: faixa ABERTA em metros (min < d < max); requires/forbids/anyOf: sinalizadores do contexto; notStatus: a IA não repete um buff que já tem;
 *   goal: passos de carga (kind 'charge'); mode/offset: plano de marcador (kind 'aim'); when: condição extra especial quando os dados não bastam
 */

/** Erros do perfil (lista vazia = válido). */
export function validateAiProfile(/** @type {any} */ p) {
  /** @type {string[]} */ const e = [];
  if (!p || typeof p !== 'object') return ['perfil ausente'];
  if (!AI_KINDS.includes(p.kind)) e.push(`kind deve ser ${AI_KINDS.join(', ')}`);
  if (!(p.p > 0 && p.p <= 1)) e.push('p (chance base) deve estar em (0, 1]');
  if (!p.why || typeof p.why !== 'string') e.push('why (motivo para o log) é obrigatório');
  if (p.distance) {
    const {min, max} = p.distance;
    if ((min !== undefined && !Number.isFinite(min)) || (max !== undefined && !Number.isFinite(max))) e.push('distance.min/max devem ser números');
    if (min !== undefined && max !== undefined && min >= max) e.push('distance.min deve ser menor que distance.max');
  }
  for (const k of ['requires', 'forbids', 'anyOf']) for (const f of p[k] ?? []) if (!AI_FLAGS.includes(f)) e.push(`${k}: sinalizador desconhecido (${f}); use ${AI_FLAGS.join(', ')}`);
  if (p.kind === 'charge' && p.goal === undefined) e.push("kind 'charge' precisa de goal (passos de carga)");
  if (p.kind === 'aim' && !['absolute', 'near', 'cast'].includes(p.mode)) e.push("kind 'aim' precisa de mode: absolute, near ou cast");
  return e;
}

/** Compila o perfil numa regra `(x, self, target) => null | {p, kind, why, goal?, mode?, offset?}` com a semântica das regras antigas (condições em E). */
export function compileAiProfile(/** @type {AiProfile} */ p) {
  const errors = validateAiProfile(p);
  if (errors.length) throw new Error('perfil de IA inválido: ' + errors.join('; '));
  const d = p.distance ?? {};
  return (/** @type {any} */ x, /** @type {any} */ self, /** @type {any} */ target) => {
    if (d.min !== undefined && !(x.distance > d.min)) return null;
    if (d.max !== undefined && !(x.distance < d.max)) return null;
    if (p.minStamina !== undefined && !(self.stamina >= p.minStamina)) return null;
    if (p.maxStamina !== undefined && !(self.stamina < p.maxStamina)) return null;
    if (p.notStatus && self.statuses?.some((/** @type {any} */ s) => s.id === p.notStatus)) return null;
    if (p.requires && !p.requires.every(f => x[f])) return null;
    if (p.forbids && p.forbids.some(f => x[f])) return null;
    if (p.anyOf && !p.anyOf.some(f => x[f])) return null;
    if (p.when && !p.when(x, self, target)) return null;
    /** @type {any} */ const r = {p: p.p, kind: p.kind, why: p.why};
    if (p.kind === 'charge') r.goal = typeof p.goal === 'function' ? p.goal(x, self) : p.goal;
    if (p.kind === 'aim') {r.mode = p.mode;if (p.offset !== undefined) r.offset = p.offset;}
    return r;
  };
}

/** @type {Map<string, {profile: AiProfile, defaults: AiProfile, rule: ReturnType<typeof compileAiProfile>}>} */
const PROFILES = new Map();
/** Ajustes do Editor de Moves por cima do perfil declarativo da ficha (DOC03 §7.3). Vazio = comportamento aprovado. */
/** @type {Map<string, any>} */
const OVERRIDES = new Map();
const copyProfile = (/** @type {AiProfile} */ p) => ({...p, ...(p.distance ? {distance: {...p.distance}} : {})});
export function registerAiProfile(/** @type {string} */ id, /** @type {AiProfile} */ profile) {
  PROFILES.set(id, {profile, defaults: copyProfile(profile), rule: compileAiProfile(profile)});
  OVERRIDES.delete(id);
  return id;
}
export const getAiRule = (/** @type {string} */ id) => PROFILES.get(id)?.rule ?? null;
export const getAiProfile = (/** @type {string} */ id) => PROFILES.get(id)?.profile ?? null;
/** Perfil de fábrica (o declarado na ficha), sem ajustes do Editor. */
export const getDefaultAiProfile = (/** @type {string} */ id) => PROFILES.get(id)?.defaults ?? null;
/** Ajustes ativos do Editor para o Move (ou null). */
export const getAiProfileOverride = (/** @type {string} */ id) => OVERRIDES.get(id) ?? null;

/** Mescla um ajuste parcial (p, distance.min/max, minStamina, maxStamina) sem tocar no restante do perfil declarativo. */
function mergeProfile(/** @type {AiProfile} */ base, /** @type {any} */ patch) {
  return {
    ...base,
    ...patch,
    ...(patch?.distance || base.distance ? {distance: {...(base.distance ?? {}), ...(patch?.distance ?? {})}} : {}),
  };
}

/**
 * Aplica (ou remove, com patch nulo) um ajuste do Editor ao perfil de IA de um Move.
 * Valida o resultado com `validateAiProfile`; nada muda se o perfil ficar inválido.
 * @param {string} id
 * @param {any} patch
 * @returns {{ok: boolean, errors: string[]}}
 */
export function setAiProfileOverride(/** @type {string} */ id, /** @type {any} */ patch) {
  const entry = PROFILES.get(id);
  if (!entry) return {ok: false, errors: [`Move sem perfil de IA: ${id}`]};
  const next = patch == null ? copyProfile(entry.defaults) : mergeProfile(entry.defaults, patch);
  const errors = validateAiProfile(next);
  if (errors.length) return {ok: false, errors};
  PROFILES.set(id, {profile: next, defaults: entry.defaults, rule: compileAiProfile(next)});
  if (patch == null) OVERRIDES.delete(id); else OVERRIDES.set(id, copyProfile(patch));
  return {ok: true, errors: []};
}
/** Restaura o perfil declarativo de fábrica (usado por «Restaurar Move» e pelos testes de mutação). */
export function resetAiProfileOverride(/** @type {string} */ id) {
  return setAiProfileOverride(id, null);
}
export const hasAiProfile = (/** @type {string} */ id) => PROFILES.has(id);
export const aiProfileIds = () => [...PROFILES.keys()];
export const clearAiProfiles = () => {PROFILES.clear();OVERRIDES.clear();};
