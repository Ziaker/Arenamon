// @ts-check
// MOVE COMO DADO: carrega um `<id>.move.json` (identidade + fases + parâmetros de mecânica + referência ao visual aprovado) e entrega
// o que o motor já conhecia: a definição (`def`, congelada) e a ficha de parâmetros (`params`, a mesma de defineMoveParams).
// A LÓGICA (o efeito que roda na simulação) continua em código no <id>.js; os NÚMEROS e textos moram só no JSON, que o Editor de Moves
// (docs/PLANO_EDITOR_DE_MOVES.md) lê e grava. Módulo PURO: só importa params-registry.js (o config.js carrega os params antes dos Moves).
import {defineMoveParams, paramRow, standardRows, hitShakeRows} from './params-registry.js';

export const MOVE_DATA_SCHEMA = 1;
const TOP_KEYS = ['schemaVersion', 'def', 'params', 'visual'];
const DEF_REQUIRED = ['id', 'name'];   // custo, recarga e duração são opcionais (Moves cuja duração vem de durationKeys/charge)
const PARAMS_KEYS = ['group', 'title', 'hint', 'meta', 'rows'];
const VISUAL_KEYS = ['atelier', 'variant'];

const AIMS = ['target', 'facing', 'input'], MOTIONS = ['none', 'root', 'dash', 'walk'], TARGETS = ['self', 'opponent'], AIR_KINDS = ['none', 'cast', 'descend'];
/**
 * Regras MECÂNICAS da definição (as mesmas que `validateMove` de moves.js aplica no registro, sem depender de C.world): o Editor não pode gravar
 * um Move que o motor recusaria ao registrar. Teste de paridade em test/move-save-api.test.mjs. Devolve a lista de problemas.
 * @param {any} def @returns {string[]}
 */
export function validateMoveMechanics(def) {
  /** @type {string[]} */ const bad = [];
  if (!def || typeof def !== 'object') return ['def ausente'];
  const num = (/** @type {any} */ v) => typeof v === 'number' && Number.isFinite(v);
  if (!def.charge && !(def.duration > 0)) bad.push('def.duration deve ser > 0');
  if (def.duration !== undefined && !(def.duration > 0)) bad.push('def.duration deve ser > 0');
  for (const k of ['cost', 'cooldown', 'cancelAfter']) if (def[k] !== undefined && !(num(def[k]) && def[k] >= 0)) bad.push(`def.${k} não pode ser negativo`);
  if (def.cancelAfter !== undefined && num(def.cancelAfter) && num(def.duration) && def.cancelAfter > def.duration + 1e-9) bad.push('def.cancelAfter passa da duração');
  if (def.charge !== undefined) {
    if (!def.charge || typeof def.charge !== 'object') bad.push('def.charge deve ser um objeto');
    else if (def.charge.max !== undefined && !(def.charge.max > 0)) bad.push('def.charge.max deve ser > 0');
  }
  if (def.cooldownBoost !== undefined && typeof def.cooldownBoost !== 'boolean') bad.push('def.cooldownBoost deve ser booleano');
  if (def.aim !== undefined && !AIMS.includes(def.aim)) bad.push(`def.aim desconhecido (${def.aim})`);
  if (def.motion && !MOTIONS.includes(def.motion.type)) bad.push(`def.motion desconhecido (${def.motion.type})`);
  if (def.air !== undefined && !AIR_KINDS.includes(def.air)) bad.push(`def.air desconhecido (${def.air})`);
  for (const k of ['moveCast', 'groundOnly', 'feint']) if (def[k] !== undefined && typeof def[k] !== 'boolean') bad.push(`def.${k} deve ser booleano`);
  if (def.invulnerable && !(Array.isArray(def.invulnerable) && num(def.invulnerable[0]) && num(def.invulnerable[1]) && def.invulnerable[0] >= 0 && def.invulnerable[0] <= def.invulnerable[1])) bad.push('def.invulnerable deve ser [início, fim] com 0 ≤ início ≤ fim');
  for (const [i, ev] of (def.timeline || []).entries()) {
    if (!def.charge && !((ev?.at ?? -1) >= 0 && (ev?.at ?? 0) <= (def.duration ?? 0))) bad.push(`def.timeline[${i}].at fora da duração`);
    const kinds = ['spawn', 'status', 'hit', 'effect'].filter(k => ev?.[k]);
    if (kinds.length !== 1) bad.push(`def.timeline[${i}] precisa de exatamente um entre spawn, status, hit e effect`);
    if (ev?.target && !TARGETS.includes(ev.target)) bad.push(`def.timeline[${i}].target desconhecido`);
  }
  return bad;
}

/**
 * Confere o formato de um move.json. Devolve a lista de problemas (vazia = válido); nada lança aqui.
 * @param {any} data
 * @returns {string[]}
 */
export function validateMoveData(data) {
  /** @type {string[]} */ const bad = [];
  const isObj = (/** @type {any} */ v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(data)) return ['o arquivo precisa ser um objeto'];
  for (const k of Object.keys(data)) if (!TOP_KEYS.includes(k)) bad.push(`campo desconhecido: ${k}`);
  if (data.schemaVersion !== MOVE_DATA_SCHEMA) bad.push(`schemaVersion deve ser ${MOVE_DATA_SCHEMA}`);
  if (!isObj(data.def)) bad.push('def ausente');
  else {
    for (const k of DEF_REQUIRED) if (data.def[k] === undefined) bad.push(`def.${k} é obrigatório`);
    if (typeof data.def.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.def.id)) bad.push('def.id precisa ser kebab-case minúsculo');
    for (const k of ['cost', 'cooldown', 'duration']) if (data.def[k] !== undefined && !Number.isFinite(data.def[k])) bad.push(`def.${k} precisa ser número`);
    bad.push(...validateMoveMechanics(data.def));
  }
  if (!isObj(data.params)) bad.push('params ausente');
  else {
    for (const k of Object.keys(data.params)) if (!PARAMS_KEYS.includes(k)) bad.push(`params.${k}: campo desconhecido`);
    if (typeof data.params.group !== 'string' || !data.params.group) bad.push('params.group é obrigatório (chave em C.world)');
    if (typeof data.params.title !== 'string') bad.push('params.title é obrigatório');
    if (!Array.isArray(data.params.rows) || !data.params.rows.length) bad.push('params.rows precisa ser uma lista não vazia');
    else data.params.rows.forEach((/** @type {any} */ r, /** @type {number} */ i) => {
      if (!isObj(r)) bad.push(`params.rows[${i}] precisa ser objeto`);
      else if (r.preset !== undefined) { if (!['hitShake', 'standard'].includes(r.preset)) bad.push(`params.rows[${i}]: preset desconhecido (${r.preset})`); }
      else for (const k of ['key', 'label', 'tip', 'unit', 'min', 'max', 'step', 'value']) if (r[k] === undefined) bad.push(`params.rows[${i}] (${r.key ?? '?'}): falta ${k}`);
    });
  }
  if (data.def?.id && data.params && data.params.id !== undefined) bad.push('params.id não existe no arquivo: o id vem de def.id');
  if (data.visual !== undefined) {
    if (!isObj(data.visual)) bad.push('visual precisa ser objeto');
    else for (const k of Object.keys(data.visual)) if (!VISUAL_KEYS.includes(k)) bad.push(`visual.${k}: campo desconhecido`);
  }
  return bad;
}

/**
 * Carrega um move.json validado.
 * @param {any} data conteúdo do arquivo (import com `with {type: 'json'}`)
 * @returns {{def: any, params: ReturnType<typeof defineMoveParams>, visual: {atelier?: string, variant?: string} | null}}
 */
export function loadMoveData(data) {
  const bad = validateMoveData(data);
  if (bad.length) throw new Error(`move.json inválido${data?.def?.id ? ` (${data.def.id})` : ''}: ${bad.join('; ')}`);
  const rows = data.params.rows.flatMap((/** @type {any} */ r) => r.preset === 'hitShake' ? hitShakeRows() : r.preset === 'standard' ? standardRows(r.values) : [paramRow(r)]);
  const params = defineMoveParams(data.params.group, {id: data.def.id, title: data.params.title, hint: data.params.hint, meta: data.params.meta, rows});
  return {def: Object.freeze({...data.def}), params, visual: data.visual ?? null};
}
