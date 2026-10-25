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
