// @ts-check
// Replay de REFERÊNCIA (#12, tarefa 3 do plano de 23/10/2026): uma gravação guardada em JSON traz o roteiro de comandos e o que a simulação
// produziu (um hash por grupo de estado em cada tick + o estado normalizado completo a cada CHECKPOINT ticks). Rodar de novo e comparar
// aponta o primeiro tick divergente, o grupo e, quando há estado guardado nesse tick, o campo exato. Não renderiza nada.
import {emptyCommand} from './entity.js';
import {hashText, runRecording} from './replay-diff.js';

/** A cada quantos ticks o estado normalizado completo é guardado. */
export const CHECKPOINT = 30;
const GROUPS = ['scalars', 'fighter0', 'fighter1', 'entities', 'events'];

/**
 * Roteiro compacto → um comando por tick. `script` (azul; `script1` = vermelho, opcional) = [{from, to, cmd}] (to exclusivo); onde nada é dito vale emptyCommand().
 * @param {{from: number, to: number, cmd: any}[]} script @param {number} ticks
 */
export function expandScript(script, ticks) {
  return Array.from({length: ticks}, (_, t) => {
    const c = {...emptyCommand()};
    for (const s of script) if (t >= s.from && t < s.to) Object.assign(c, s.cmd);
    return c;
  });
}

/** Partes do estado normalizado que têm hash próprio (para dizer ONDE divergiu sem guardar o estado de todo tick). */
function groupsOf(/** @type {any} */ s) {
  return {
    scalars: {tick: s.tick, phase: s.phase, hitstop: s.hitstop, winner: s.winner},
    fighter0: s.fighters[0], fighter1: s.fighters[1], entities: s.entities, events: s.events,
  };
}
const hashGroups = (/** @type {any} */ s) => Object.values(groupsOf(s)).map(g => hashText(JSON.stringify(g))).join('.');

/** Executa a referência (opcionalmente com valores/mutações para provocar divergência) e devolve os estados normalizados. */
function execute(/** @type {any} */ ref, /** @type {any} */ opts = {}) {
  return runRecording({meta: ref.meta, commands: expandScript(ref.script, ref.ticks), commands1: ref.script1 ? expandScript(ref.script1, ref.ticks) : null}, opts);
}

/** Roda o roteiro e devolve a referência com `expected` preenchido (hashes por tick e checkpoints). */
export function recordReference(/** @type {any} */ ref) {
  const states = execute(ref);
  const checkpoints = /** @type {Record<string, any>} */ ({});
  for (const s of states) if (s.tick % CHECKPOINT === 0) checkpoints[s.tick] = s;
  return {...ref, expected: {hashes: states.map(hashGroups), checkpoints, final: states[states.length - 1]}};
}

/**
 * Compara uma nova execução com o que foi guardado.
 * @param {any} ref @param {{values?: Record<string, any>, mutate?: any}} [opts]
 * @returns {{ok: true, ticks: number} | {ok: false, tick: number, group: string, field?: string, expected: any, got: any}}
 */
export function compareReference(ref, opts = {}) {
  const states = execute(ref, opts), exp = ref.expected.hashes;
  const n = Math.max(states.length, exp.length);
  for (let i = 0; i < n; i++) {
    if (!states[i]) return {ok: false, tick: i + 1, group: 'comprimento', expected: exp.length, got: states.length};
    if (!exp[i]) return {ok: false, tick: states[i].tick, group: 'comprimento', expected: exp.length, got: states.length};
    const got = hashGroups(states[i]);
    if (got === exp[i]) continue;
    const eg = exp[i].split('.'), gg = got.split('.'), gi = gg.findIndex((h, k) => h !== eg[k]);
    const tick = states[i].tick, group = GROUPS[gi], saved = ref.expected.checkpoints[tick];
    if (!saved) return {ok: false, tick, group, expected: eg[gi], got: gg[gi]};
    const d = firstField(saved, states[i], '');
    return {ok: false, tick, group, field: d?.field, expected: d?.a ?? eg[gi], got: d?.b ?? gg[gi]};
  }
  return {ok: true, ticks: states.length};
}

function firstField(/** @type {any} */ a, /** @type {any} */ b, path = '') {
  if (a === b) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return {field: path, a, b};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = firstField(a[k], b[k], path ? `${path}.${k}` : k);
    if (d) return d;
  }
  return null;
}
