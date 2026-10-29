// @ts-check
// Game feel 6 — contrato de fases da animação aprovado. A DEFINIÇÃO do Move/ação continua autoritativa por padrão (phaseMode = 0).
// Com phaseMode = 1 («Animação aprovada») os marcadores do clipe (janela ativa, cancelamento, invulnerabilidade) podem assumir os tempos
// do combate, fase por fase (phaseActive / phaseCancel / phaseInvuln), SOMENTE se o contrato inteiro for válido: qualquer falha numa fase
// autorizada rejeita todas (nunca aplicação parcial) e o combate usa os tempos da definição. phaseMode = 2 («Comparar») só calcula a tabela.
// Funções puras: o mesmo personagem + ação + perfil resolvem o mesmo contrato na pré-visualização e no combate.
import {effectiveArenaWindows} from './animation-combat-windows.js';
import {effectiveMovePhases} from './move-phases.js';

/** Fases controláveis: chave de autorização no ajuste, rótulo e campo do contrato de janelas. */
export const PHASE_FIELDS = Object.freeze([
  {key: 'active', auth: 'phaseActive', label: 'Janela ativa', field: 'activeWindows'},
  {key: 'cancel', auth: 'phaseCancel', label: 'Cancelamento', field: 'cancelWindows'},
  {key: 'invuln', auth: 'phaseInvuln', label: 'Invulnerabilidade', field: 'invulnerabilityWindows'},
]);

/** Relatório mais recente por lutador (0 azul, 1 vermelho): preenchido pela sincronização de janelas, lido pelo painel. */
export const phaseReports = [null, null];

const isStep = (/** @type {any} */ v) => Number.isInteger(v) && v >= 0;
/**
 * Valida uma lista de janelas [início, fim) em passos: ordem, sobreposição e limite da duração da ação.
 * @param {string} label @param {any} windows @param {number} durationSteps
 * @returns {string|null} mensagem de erro ou null
 */
export function validateWindows(label, windows, durationSteps) {
  if (!Array.isArray(windows)) return `${label}: formato inválido`;
  let prevEnd = -1;
  for (const w of [...windows].sort((a, b) => a[0] - b[0])) {
    const [s, e] = w ?? [];
    if (!isStep(s) || !isStep(e)) return `${label}: marcador não é um passo inteiro (${s}, ${e})`;
    if (e <= s) return `${label}: o fim (${e}) não vem depois do início (${s})`;
    if (s < prevEnd) return `${label}: janelas se sobrepõem (${s} < ${prevEnd})`;
    if (e > durationSteps) return `${label}: marcador em ${e} passos passa da duração da ação (${durationSteps})`;
    prevEnd = e;
  }
  return null;
}

/**
 * Resolve o contrato de UMA ação. Nunca lança; sempre devolve {applied, errors, rows, windows}.
 * @param {{actionId: string, contract: any, definition: any, auth: {active: boolean, cancel: boolean, invuln: boolean}, stepSeconds: number}} p
 */
export function resolvePhaseContract({actionId, contract, definition, auth, stepSeconds}) {
  const errors = [], rows = [], dur = definition?.durationSteps ?? 0;
  const sec = (/** @type {number|null|undefined} */ steps) => steps == null ? null : +(steps * stepSeconds).toFixed(4);
  const defWin = {active: definition?.activeWindows ?? [], cancel: definition?.cancelWindow ? [definition.cancelWindow] : (definition?.chainAfterStep != null ? [[definition.chainAfterStep, dur]] : []), invuln: definition?.invulnerabilityWindows ?? []};
  const animWin = {active: contract?.activeWindows ?? [], cancel: contract?.cancelWindows ?? [], invuln: contract?.invulnerabilityWindows ?? []};
  const out = {actionId, applied: {active: false, cancel: false, invuln: false}, errors, rows, durationSteps: dur, stepSeconds, cancelAfterSeconds: null};
  const wanted = PHASE_FIELDS.filter(p => auth[/** @type {'active'|'cancel'|'invuln'} */ (p.key)]);
  // Linhas da tabela «antes e depois» (sempre calculadas, aplicadas ou não).
  for (const p of PHASE_FIELDS) {
    const d = defWin[/** @type {'active'|'cancel'|'invuln'} */ (p.key)][0] ?? null, a = animWin[/** @type {'active'|'cancel'|'invuln'} */ (p.key)][0] ?? null;
    rows.push({phase: p.label, key: p.key, definition: d, animation: a, definitionSeconds: d ? [sec(d[0]), sec(d[1])] : null, animationSeconds: a ? [sec(a[0]), sec(a[1])] : null, authorized: !!auth[/** @type {'active'|'cancel'|'invuln'} */ (p.key)], status: a ? 'marcador no clipe' : 'sem marcador no clipe'});
  }
  if (!wanted.length) return {...out, windows: null};
  if (!contract) {errors.push(`${actionId}: sem clipe/contrato mapeado — usando os tempos da definição`);for (const r of rows) if (r.authorized) r.status = 'rejeitado: sem clipe';return {...out, windows: null};}
  if (!dur) {errors.push(`${actionId}: a ação não tem duração definida`);return {...out, windows: null};}
  const eff = {active: defWin.active, cancel: defWin.cancel, invuln: defWin.invuln};
  for (const p of wanted) {
    const k = /** @type {'active'|'cancel'|'invuln'} */ (p.key), list = animWin[k];
    if (!list.length) continue;   // sem marcador: a fase segue a definição (não é erro)
    const bad = validateWindows(p.label, list, dur);
    if (bad) errors.push(`${actionId}: ${bad}`);
    else if (k === 'active' && list.some(([s, e]) => e - s < 1)) errors.push(`${actionId}: janela ativa com 0 passo de simulação`);
    else eff[k] = list;
  }
  // Segurança do cancelamento: não pode abrir antes do primeiro ponto de compromisso (início da primeira janela ativa efetiva).
  if (wanted.some(p => p.key === 'cancel') && animWin.cancel.length) {
    const firstActive = (eff.active[0]?.[0]) ?? 0, cs = Math.min(...animWin.cancel.map((/** @type {number[]} */ w) => w[0]));
    if (cs < firstActive) errors.push(`${actionId}: o cancelamento abre em ${cs} passos, antes do primeiro compromisso (${firstActive})`);
  }
  if (errors.length) {for (const r of rows) if (r.authorized) r.status = 'rejeitado (contrato inteiro recusado)';return {...out, windows: null};
  }
  const applied = {active: false, cancel: false, invuln: false};
  for (const p of wanted) {const k = /** @type {'active'|'cancel'|'invuln'} */ (p.key);if (animWin[k].length) {applied[k] = true;const r = rows.find(x => x.key === k);if (r) r.status = 'aplicado';}}
  const windows = {
    ...contract,
    activeWindows: applied.active ? animWin.active.map((/** @type {number[]} */ w) => [...w]) : [],
    invulnerabilityWindows: applied.invuln ? animWin.invuln.map((/** @type {number[]} */ w) => [...w]) : [],
    cancelWindows: applied.cancel ? animWin.cancel.map((/** @type {number[]} */ w) => [...w]) : [],
    phaseContract: {version: 1, actionId, applied, cancelAfterSeconds: applied.cancel ? sec(Math.min(...animWin.cancel.map((/** @type {number[]} */ w) => w[0]))) : null, stepSeconds},
  };
  return {...out, applied, cancelAfterSeconds: windows.phaseContract.cancelAfterSeconds, windows};
}

/** Definição «nominal» de um Move em passos, no mesmo formato de effectiveArenaWindows (para comparar com o clipe `move_<id>`). */
export function moveDefinition(def, group, stepSeconds) {
  const ph = effectiveMovePhases(def, group), st = (/** @type {number} */ s) => Math.round(s / stepSeconds), dur = st(ph.duration);
  return {actionId: `move_${def.id}`, stepSeconds, durationSteps: dur,
    activeWindows: ph.active.map((/** @type {number[]} */ w) => [st(w[0]), Math.max(st(w[0]) + 1, st(w[1]))]),
    invulnerabilityWindows: ph.invulnerable.map((/** @type {number[]} */ w) => [st(w[0]), Math.max(st(w[0]) + 1, st(w[1]))]),
    cancelWindow: ph.cancel ? [st(ph.cancel[0]), dur] : null, chainAfterStep: ph.cancel ? st(ph.cancel[0]) : null};
}

/**
 * Resolve o contrato de todas as ações com janelas de um personagem (tackle, esquiva e Moves com clipe próprio).
 * `o.off[açãoKey][fase] = true` desautoriza só aquela fase, naquele personagem e naquela ação («Restaurar»).
 * @param {Record<string, any>|null} raw janelas lidas dos clipes (Character.getAllCombatWindows) @param {any} C configuração viva @param {{phaseMode: number, phaseActive: number, phaseCancel: number, phaseInvuln: number}} G
 * @param {{forceAll?: boolean, off?: Record<string, any>, getMove?: (id: string) => any}} [o] forceAll: autoriza todas as fases só para a tabela de comparação · off: fases restauradas por ação · getMove: busca da definição do Move
 */
export function resolveAllPhases(raw, C, G, o = {}) {
  const stepSeconds = C.test?.step ?? 1 / 120, windows = {}, reports = {}, off = o.off ?? {};
  const authFor = (/** @type {string} */ key) => o.forceAll ? {active: true, cancel: true, invuln: true} : {active: !!G.phaseActive && !off[key]?.active, cancel: !!G.phaseCancel && !off[key]?.cancel, invuln: !!G.phaseInvuln && !off[key]?.invuln};
  const one = (/** @type {string} */ key, /** @type {any} */ contract, /** @type {any} */ definition) => {
    const res = resolvePhaseContract({actionId: key, contract, definition, auth: authFor(key), stepSeconds});
    const w = res.windows ?? (contract ? {...contract, activeWindows: [], invulnerabilityWindows: [], cancelWindows: [], phaseContract: {version: 1, actionId: key, applied: {active: false, cancel: false, invuln: false}, cancelAfterSeconds: null, stepSeconds, rejected: res.errors.length > 0}} : null);
    return [res, w];
  };
  for (const [id, defId] of /** @type {const} */ ([['tackle', 'tackle'], ['dodge', 'dodge_forward']])) {
    const [res, w] = one(id, raw?.[id] ?? null, effectiveArenaWindows(defId, C));
    reports[id] = res;windows[id] = w;
  }
  if (raw?.moves) {
    reports.moves = {};windows.moves = {};
    for (const [mid, contract] of Object.entries(raw.moves)) {
      const def = o.getMove?.(mid);if (!def || !contract) continue;
      const [res, w] = one(`move_${mid}`, contract, moveDefinition(def, def.group ? C.world?.[def.group] ?? null : null, stepSeconds));
      reports.moves[mid] = res;if (w) windows.moves[mid] = w;
    }
  }
  return {windows, reports};
}
