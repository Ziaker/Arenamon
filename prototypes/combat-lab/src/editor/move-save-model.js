// @ts-check
// Modelo da GRAVAÇÃO do Editor de Moves (sem interface, sem rede): a partir do arquivo que está no DISCO e dos valores ATUAIS, monta o novo documento
// (move.json ou visual aprovado) mexendo só no que mudou, e lista as diferenças para o diálogo de confirmação.
// Partir do arquivo do disco (e não dos dados em memória) preserva tudo que o editor não edita: ordem das chaves, «preset» do tremor de hit, selo
// `approved`, referência de visual, comentários de rótulo, etc. Salvar sem mexer em nada produz o MESMO arquivo (teste de ida e volta).
import {hitShakeRows} from '../sim/moves/params-registry.js';

/** @typedef {{path: string, from: any, to: any, note?: string}} Diff */

const isObj = (/** @type {any} */ v) => v && typeof v === 'object' && !Array.isArray(v);
const eq = (/** @type {any} */ a, /** @type {any} */ b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Diferenças entre dois documentos JSON. Listas de linhas com `key` (sliders) são comparadas por chave: `params.rows[damage].value`.
 * @param {any} a antes (disco)
 * @param {any} b depois (novo)
 * @param {string} [path]
 * @returns {Diff[]}
 */
export function diffDocs(a, b, path = '') {
  if (eq(a, b)) return [];
  if (isObj(a) && isObj(b)) {
    /** @type {Diff[]} */ const out = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out.push(...diffDocs(a[k], b[k], path ? `${path}.${k}` : k));
    return out;
  }
  const idOf = (/** @type {any} */ x) => isObj(x) ? (typeof x.key === 'string' ? x.key : typeof x.preset === 'string' ? 'preset:' + x.preset : null) : null;
  const keyed = (/** @type {any} */ l) => Array.isArray(l) && l.length > 0 && l.every(x => idOf(x) !== null);
  if (keyed(a) && keyed(b)) {
    /** @type {Diff[]} */ const out = [];
    const am = new Map(a.map((/** @type {any} */ x) => [idOf(x), x])), bm = new Map(b.map((/** @type {any} */ x) => [idOf(x), x]));
    for (const k of new Set([...am.keys(), ...bm.keys()])) out.push(...diffDocs(am.get(k), bm.get(k), `${path}[${k}]`));
    return out;
  }
  return [{path, from: a, to: b}];
}

/** Texto curto de um valor para a tela. */
export const showValue = (/** @type {any} */ v) => v === undefined ? '—' : typeof v === 'number' ? String(+v.toFixed(4)) : (JSON.stringify(v) ?? '—').slice(0, 70);

/** Rótulos legíveis para os caminhos de um move.json: `params.rows[damage].value` → «Dano fixo · valor». */
export function labelFor(/** @type {string} */ path, /** @type {any} */ doc) {
  const m = path.match(/^params\.rows\[([^\]]+)\]\.(\w+)$/);
  if (m) {
    const row = doc?.params?.rows?.find((/** @type {any} */ r) => r.key === m[1]);
    const what = {value: 'valor', min: 'limite mínimo do arquivo', max: 'limite máximo do arquivo', step: 'passo'}[/** @type {'value'} */ (m[2])] ?? m[2];
    return `${row?.label ?? m[1]} · ${what}`;
  }
  if (path.startsWith('def.')) return `Definição · ${path.slice(4)}`;
  if (path.startsWith('visualParameters.')) return `Visual · ${path.slice('visualParameters.'.length)}`;
  return path;
}

/**
 * Novo move.json: o do disco com os valores ATUAIS dos sliders de mecânica.
 *  - `value` de cada linha = valor atual em C.world[grupo] (só se mudou);
 *  - se o valor ficou fora de [min, max] do arquivo (os sliders do editor têm limites ampliados), o limite do arquivo é AMPLIADO para caber
 *    (o carregador recusa valor fora da faixa); isso aparece no diálogo de confirmação;
 *  - def.cost / def.cooldown / def.duration acompanham os sliders de custo, recarga e preparação (cast);
 *  - o preset de tremor de hit vira linhas explícitas se algum dos 3 valores deixou de ser o padrão (o preset não guarda valores).
 * @param {any} disk move.json lido do disco
 * @param {Record<string, any>} group C.world[grupo] atual
 */
export function buildMoveDoc(disk, group) {
  const doc = structuredClone(disk);
  const rows = /** @type {any[]} */ (doc.params.rows), changed = new Set();
  for (const r of rows) {
    if (!r.key || !(r.key in group)) continue;
    const v = group[r.key];
    if (typeof v !== 'number' || v === r.value) continue;
    r.value = v;changed.add(r.key);
    if (v > r.max) r.max = v;
    if (v < r.min) r.min = v;
  }
  const shake = rows.findIndex(r => r.preset === 'hitShake');
  if (shake >= 0) {
    const base = hitShakeRows();
    if (base.some(r => typeof group[r.key] === 'number' && group[r.key] !== r.value)) {
      rows.splice(shake, 1, ...base.map(r => ({key: r.key, label: r.label, tip: r.tip, min: r.min, max: r.max, step: r.step, unit: r.unit, value: typeof group[r.key] === 'number' ? group[r.key] : r.value})));
    }
  }
  for (const [defKey, key] of [['cost', 'cost'], ['cooldown', 'cooldown'], ['duration', 'cast']]) {
    if (changed.has(key) && typeof group[key] === 'number' && defKey in doc.def) doc.def[defKey] = group[key];   // só quando o slider mudou (def e sliders podem divergir de propósito)
  }
  return doc;
}

/**
 * Novo visual aprovado: o do disco com os parâmetros visuais ATUAIS por cima (o que o editor não mexeu e o arquivo já tinha fica).
 * @param {any} disk exportação do atelier lida do disco
 * @param {Record<string, number>} current parâmetros visuais em uso (ATELIER_GAME_PARAMS[categoria])
 */
export function buildVisualDoc(disk, current) {
  const doc = structuredClone(disk);
  doc.visualParameters = {...doc.visualParameters, ...current};
  return doc;
}

/** Diferenças já com rótulo legível, prontas para o diálogo. */
export function describeDiffs(/** @type {any} */ disk, /** @type {any} */ next) {
  return diffDocs(disk, next).map(d => ({...d, label: labelFor(d.path, next), from: showValue(d.from), to: showValue(d.to)}));
}
