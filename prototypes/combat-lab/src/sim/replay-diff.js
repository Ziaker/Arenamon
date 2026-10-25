// @ts-check
// Replay DIFERENCIAL (#12 do plano de 23/10/2026): executa a mesma gravação duas vezes (por exemplo antes/depois de uma mudança, ou com dois
// conjuntos de ajustes) e aponta o PRIMEIRO tick em que o estado normalizado diverge, com o campo e o contexto. Sem renderização e sem
// mexer em nada além da configuração, que é restaurada no fim (withValues). Estado por partida não é isolado: C e os registros continuam globais.
import {C} from './config.js';
import {Game} from './game.js';
import {withValues} from './compare.js';
import {listMoves} from './moves.js';

export const r6 = (/** @type {number} */ n) => Math.round(n * 1e6) / 1e6;
const num = (/** @type {any} */ v) => typeof v === 'number' ? r6(v) : v;

/** Hash curto e estável de um texto (FNV-1a de 32 bits), em hexadecimal. */
export function hashText(/** @type {string} */ text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {h ^= text.charCodeAt(i);h = Math.imul(h, 0x01000193) >>> 0;}
  return h.toString(16).padStart(8, '0');
}
/** Hash da configuração viva (C inteiro + ids dos Moves registrados), para detectar "mesma gravação, outra configuração". */
export function configHash() {
  return hashText(JSON.stringify(C, (_, v) => typeof v === 'number' ? r6(v) : v) + '|' + listMoves().map(m => m.id).join(','));
}

/**
 * Projeção determinística do estado do jogo num tick: o que importa para a simulação, arredondado para evitar ruído de ponto flutuante
 * idêntico em duas execuções e sem campos puramente visuais.
 * @param {any} game
 */
export function normalizeState(game) {
  return {
    tick: game.tick, phase: game.phase, hitstop: num(game.hitstop), winner: game.winner,
    fighters: game.fighters.map((/** @type {any} */ f) => ({
      x: num(f.position.x), z: num(f.position.z), vx: num(f.velocity.x), vz: num(f.velocity.z), y: num(f.flight?.y ?? f.groundY ?? 0),
      hp: num(f.hp), stamina: num(f.stamina), state: f.state, action: f.action?.kind ?? null, move: f.action?.move ?? null, stun: num(f.stun), guard: !!f.guard,
      statuses: (f.statuses ?? []).map((/** @type {any} */ s) => `${s.id}:${num(s.remaining)}`).join(','), cooldowns: Object.entries(f.moveCooldowns ?? {}).map(([k, v]) => `${k}:${num(/** @type {number} */ (v))}`).join(','),
    })),
    entities: (game.world?.entities ?? []).map((/** @type {any} */ e) => `${e.kind}#${e.id}@${num(e.pos?.x ?? 0)},${num(e.pos?.z ?? 0)}${e.dead ? 'x' : ''}`).join(';'),
    events: game.lastStepEvents.map((/** @type {any} */ e) => `${e.id}:${e.result}:${e.attacker}>${e.target}:${num(e.damage ?? 0)}`).join(';'),
  };
}

/**
 * Executa uma gravação e devolve o estado normalizado de cada tick.
 * @param {{meta: any, commands: any[], commands1?: any[] | null}} rec meta = {seed, profile, enemyProfile, mode, moveLoadouts?}; commands = comando do azul por tick
 * @param {{values?: Record<string, any>, mutate?: ((tick: number, game: any) => void) | null, maxTicks?: number, setup?: ((game: any) => void) | null}} [opts] setup: ajuste de cena feito depois do reset (testes e capturas com cenário montado à mão)
 */
export function runRecording(rec, opts = {}) {
  const exec = () => {
    const meta = rec.meta, g = new Game({seed: meta.seed});
    g.brain.seed = meta.seed;g.playerBrain.seed = meta.seed + 7919;g.brain.reset();g.playerBrain.reset();
    g.profile = meta.profile ?? g.profile;g.enemyProfile = meta.enemyProfile ?? g.enemyProfile;g.mode = meta.mode ?? g.mode;
    g.reset(meta.positions ? {positions: meta.positions} : undefined);
    meta.moveLoadouts?.forEach((/** @type {string[]} */ ids, /** @type {number} */ i) => {if (ids?.some(Boolean)) g.setLoadout(i, ids);});
    opts.setup?.(g);
    const states = [], n = Math.min(rec.commands.length, opts.maxTicks ?? Infinity);
    for (let t = 0; t < n && g.phase !== 'result'; t++) {
      opts.mutate?.(t, g);
      g.step(rec.commands[t] ?? undefined, rec.commands1?.[t] ?? undefined);
      states.push(normalizeState(g));
    }
    return states;
  };
  return opts.values ? withValues(opts.values, exec) : exec();
}

/** Compara dois objetos planos e devolve o primeiro campo diferente (caminho legível) ou null. */
function firstFieldDiff(/** @type {any} */ a, /** @type {any} */ b, path = '') {
  if (a === b) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return {field: path, a, b};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = firstFieldDiff(a[k], b[k], path ? `${path}.${k}` : k);
    if (d) return d;
  }
  return null;
}

/**
 * Primeiro tick divergente entre duas execuções. `context` traz o estado anterior (último tick igual) para reprodução mínima.
 * @returns {{identical: true, ticks: number} | {identical: false, tick: number, field: string, a: any, b: any, context: {before: any, a: any, b: any}}}
 */
export function firstDivergence(/** @type {any[]} */ runA, /** @type {any[]} */ runB) {
  const n = Math.min(runA.length, runB.length);
  for (let i = 0; i < n; i++) {
    const d = firstFieldDiff(runA[i], runB[i]);
    if (d) return {identical: false, tick: runA[i].tick, field: d.field, a: d.a, b: d.b, context: {before: runA[i - 1] ?? null, a: runA[i], b: runB[i]}};
  }
  if (runA.length !== runB.length) return {identical: false, tick: n, field: 'comprimento', a: runA.length, b: runB.length, context: {before: runA[n - 1] ?? null, a: runA[n] ?? null, b: runB[n] ?? null}};
  return {identical: true, ticks: n};
}

/** Executa a gravação com dois conjuntos de valores (ou mutações) e devolve a divergência. */
export function diffRecording(/** @type {any} */ rec, /** @type {{values?: Record<string, any>, mutate?: any}} */ a = {}, /** @type {{values?: Record<string, any>, mutate?: any}} */ b = {}) {
  const runA = runRecording(rec, a), runB = runRecording(rec, b);
  return {divergence: firstDivergence(runA, runB), ticks: [runA.length, runB.length]};
}
