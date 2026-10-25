// @ts-check
// Registro PURO (sem imports) das fichas de parâmetros dos Moves. Cada Move declara os próprios parâmetros UMA vez, no arquivo dele
// (`defineMoveParams`); daqui saem os padrões em C.world[grupo], os sliders da aba Moves (rótulo, dica, faixa, unidade) e a cobertura
// dos testes. Não importa config.js nem a interface de propósito: config.js importa este arquivo, e um ciclo quebraria a ordem de carga.

/** Unidades aceitas: a interface escolhe o formato de exibição pela unidade (ver FORMATTERS em ui/moves-panel.js). */
export const PARAM_UNITS = ['num', 'int', 'sec', 'pct', 'm', 'ms', 'ms2', 'deg', 'x', 'yesno'];

/**
 * @typedef {{key: string, label: string, tip: string, min: number, max: number, step: number, unit: string, value: number, approved?: boolean}} ParamRow
 * @typedef {{category: 'Normal' | 'Burst' | 'Charge', types: string[], pl: string, status: {proposto: boolean, aprovado: boolean, implementado: boolean, homologado: boolean}, version?: number}} MoveMeta
 *   meta do Move (REGRAS_CRIACAO_MOVES §2): categoria oficial, tipos (Melee/Projectile/Status/Field/Trick), PL ('SEM PL', 'PL1', 'PL1–PL3'…) e os QUATRO status independentes de governança
 * @typedef {{group: string, id: string, title: string, hint?: string, meta?: MoveMeta, rows: ParamRow[]}} ParamGroup
 */
export const MOVE_CATEGORIES = ['Normal', 'Burst', 'Charge'];
export const MOVE_TYPES = ['Melee', 'Projectile', 'Status', 'Field', 'Trick'];
/** @type {Map<string, ParamGroup>} */
const GROUPS = new Map();

/**
 * Declara a ficha de parâmetros de um Move.
 * @param {string} group chave em C.world (ex.: 'secondWind')
 * @param {{id: string, title: string, hint?: string, meta?: MoveMeta, rows: ParamRow[]}} spec id do Move, título do cartão, texto de apoio, metadados (categoria, tipos, PL, status) e linhas
 * @returns {ParamGroup}
 */
export function defineMoveParams(group, spec) {
  const fail = (/** @type {string} */ m) => {throw new Error(`ficha ${group}: ${m}`);};
  if (!group || typeof group !== 'string') throw new Error('ficha sem grupo');
  if (!spec?.id || !spec.title) fail('precisa de id e title');
  const m = spec.meta;
  if (m) {
    if (!MOVE_CATEGORIES.includes(m.category)) fail(`meta.category deve ser ${MOVE_CATEGORIES.join(', ')} (veio ${m.category})`);
    if (!Array.isArray(m.types) || !m.types.length || m.types.some(t => !MOVE_TYPES.includes(t))) fail(`meta.types deve usar ${MOVE_TYPES.join(', ')}`);
    if (!m.pl || typeof m.pl !== 'string') fail("meta.pl deve ser texto ('SEM PL', 'PL1', 'PL1–PL3'…)");
    for (const k of ['proposto', 'aprovado', 'implementado', 'homologado']) if (typeof m.status?.[k] !== 'boolean') fail(`meta.status.${k} deve ser verdadeiro ou falso`);
  }
  const seen = new Set();
  for (const r of spec.rows) {
    if (!r.key || seen.has(r.key)) fail(`chave repetida ou vazia (${r.key})`);
    seen.add(r.key);
    if (!PARAM_UNITS.includes(r.unit)) fail(`${r.key}: unidade desconhecida (${r.unit})`);
    if (!r.label || !r.tip) fail(`${r.key}: rótulo e dica são obrigatórios`);
    if (![r.min, r.max, r.step, r.value].every(Number.isFinite)) fail(`${r.key}: min, max, step e value precisam ser números`);
    if (r.min > r.max || r.value < r.min || r.value > r.max) fail(`${r.key}: valor ${r.value} fora de ${r.min}..${r.max}`);
    if (!(r.step > 0)) fail(`${r.key}: step deve ser > 0`);
  }
  const entry = {group, id: spec.id, title: spec.title, hint: spec.hint, meta: spec.meta, rows: spec.rows.map(r => ({approved: false, ...r}))};
  GROUPS.set(group, entry);
  return entry;
}
/** Remove uma ficha do registro (testes que registram fichas de mentira). */
export const removeMoveParams = group => GROUPS.delete(group);
export const moveParamGroups = () => [...GROUPS.values()];
/** Padrões de todas as fichas no formato de C.world: {grupo: {chave: valor}}. */
export const moveParamDefaults = () => Object.fromEntries([...GROUPS.values()].map(g => [g.group, Object.fromEntries(g.rows.map(r => [r.key, r.value]))]));
/** Garante os grupos das fichas num objeto C.world já existente (a config é criada antes de os Moves carregarem). */
export function syncMoveParams(/** @type {Record<string, any>} */ world) {
  for (const [group, values] of Object.entries(moveParamDefaults())) world[group] = {...values, ...(world[group] ?? {})};
}

const rowOf = (/** @type {Partial<ParamRow> & {key: string, label: string, tip: string, unit: string, value: number}} */ r) => /** @type {ParamRow} */ ({min: 0, max: 1, step: .01, ...r});
/**
 * Linhas padrão de um Move de "uso" (custo, recarga e duração da ação). `kind: 'cast'` descreve o cast antes do efeito; 'use' um Burst.
 * Qualquer linha pode ser sobrescrita pela ficha (`override`) ou acrescentada depois.
 */
export function standardRows(/** @type {{cost: number, cooldown: number, cast: number, kind?: 'cast' | 'use'}} */ v) {
  const cast = (v.kind ?? 'cast') === 'cast';
  return [
    rowOf({key: 'cost', label: 'Custo de stamina', tip: `Cobrado no início do ${cast ? 'cast (Normal sem marcador)' : 'uso (Burst)'}; vale nos PRÓXIMOS usos (M28.4). Valor do catálogo — proposta, não homologada.`, min: 0, max: 5, step: .05, unit: 'num', value: v.cost}),
    rowOf({key: 'cooldown', label: 'Cooldown', tip: `Começa junto com o custo, no início do ${cast ? 'cast' : 'uso'} (proposta).`, min: 0, max: 60, step: .5, unit: 'sec', value: v.cooldown}),
    rowOf({key: 'cast', label: cast ? 'Duração do cast' : 'Duração da ação', tip: cast ? 'Tempo do cast antes do efeito começar; interrupção nesse intervalo cancela sem reembolso (proposta).' : 'Tempo da ação (recuperação do Burst: não definido no catálogo; provisório MV-P14).', min: .05, max: 2, step: .01, unit: 'sec', value: v.cast}),
  ];
}
export {rowOf as paramRow};

/** Tremor de câmera ao acertar (aparência), igual para os Moves que o têm: o interruptor libera a intensidade e a duração. */
export const hitShakeRows = () => [
  rowOf({key: 'hitShakeOn', label: 'Tremor de câmera ao acertar', tip: 'Desligado (padrão): este Move não treme a câmera ao acertar. Ligado: libera a intensidade e a duração do tremor. Só aparência.', min: 0, max: 1, step: 1, unit: 'yesno', value: 0}),
  rowOf({key: 'hitShakeAmount', label: 'Tremor ao acertar: intensidade', tip: 'Multiplica o tremor de hit padrão (1 = igual ao do Tackle). Só aparência.', min: 0, max: 6, step: .05, unit: 'x', value: 1}),
  rowOf({key: 'hitShakeDuration', label: 'Tremor ao acertar: duração', tip: 'Multiplica a duração do tremor de hit padrão (1 = igual ao do Tackle). Só aparência.', min: .1, max: 5, step: .05, unit: 'x', value: 1}),
];

/**
 * @typedef {{def: any, effect?: [string, Function], tackle?: [string, Function], hooks?: [string, Function][], steps?: [string, Function][], effects?: [string, Function][], params?: ParamGroup, ai?: import('../ai-profile.js').AiProfile}} Ficha
 */
/** Declara a ficha de um Move (só dá tipo ao objeto: o checkJs reconhece os pares [nome, função]). */
export const defineFicha = (/** @type {Ficha} */ f) => f;
