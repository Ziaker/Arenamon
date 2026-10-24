// @ts-check
// Rastreio de um Move no palco (Editor de Moves, fase 3): roda o MESMO cenário do editor passo a passo e devolve a LINHA DO TEMPO (faixas por tempo) e as
// MÉTRICAS numéricas; também compara dois conjuntos de valores (A × B). Sem interface, sem navegador: usa o Game/World reais, então é testável.
import {C} from '../sim/config.js';
import {Game} from '../sim/game.js';
import {prepareScenario} from '../sim/scenarios.js';
import {makeMoveScenario} from './move-editor-model.js';

/**
 * @typedef {{from: number, to: number}} Span                       // em segundos desde o início do cenário
 * @typedef {{t: number, tick: number, damage: number, result: string}} HitMark
 * @typedef {{label: string, kind: string, spans: Span[]}} Lane
 * @typedef {{press: number, lanes: Lane[], hits: HitMark[], metrics: Record<string, number | null>, total: number, step: number, ticks: number}} MoveTrace
 */

/** Valores atuais dos sliders de mecânica do Move ({chave: valor}) — o que vale «agora» em C.world[grupo]. */
export function currentValues(/** @type {{group: string, params: any}} */ move, /** @type {any} */ world = C.world) {
  const g = world[move.group] ?? {};
  return Object.fromEntries(move.params.rows.filter((/** @type {any} */ r) => r.key && r.key in g).map((/** @type {any} */ r) => [r.key, g[r.key]]));
}
/** Valores padrão do Move (os do move.json). */
export function defaultValues(/** @type {{params: any}} */ move) {
  return Object.fromEntries(move.params.rows.filter((/** @type {any} */ r) => r.key).map((/** @type {any} */ r) => [r.key, r.value]));
}
/** Executa fn com estes valores aplicados em C.world[grupo] e restaura os anteriores (também se fn lançar). */
export function withValues(/** @type {{group: string}} */ move, /** @type {Record<string, number> | null} */ values, /** @type {() => any} */ fn) {
  if (!values) return fn();
  const g = /** @type {any} */ (C.world)[move.group], saved = {...g};
  try {Object.assign(g, values);return fn();} finally {for (const k of Object.keys(values)) g[k] = saved[k];}
}

const r3 = (/** @type {number} */ v) => Math.round(v * 1000) / 1000;
/** Une faixas de ticks consecutivos em intervalos [from, to) (em segundos). */
function spansOf(/** @type {number[]} */ ticks, /** @type {number} */ dt) {
  const out = /** @type {Span[]} */ ([]);
  for (const t of ticks) {
    const last = out.at(-1);
    if (last && Math.abs(t * dt - last.to) < dt * 1.01) last.to = r3((t + 1) * dt);
    else out.push({from: r3(t * dt), to: r3((t + 1) * dt)});
  }
  return out;
}

/**
 * Roda o Move no palco e devolve a linha do tempo e as métricas.
 * @param {{id: string, group: string, def: any, name: string, params?: any}} move
 * @param {{distance?: number, target?: string, hold?: number}} [stage]
 * @param {Record<string, number> | null} [values] valores de mecânica a aplicar só nesta execução (null = os atuais)
 * @returns {MoveTrace}
 */
export function traceMove(move, stage = {}, values = null) {
  return withValues(move, values, () => {
    const dt = C.test.step, game = new Game(), def = makeMoveScenario(move, stage), run = prepareScenario(def, game);
    const g = /** @type {any} */ (C.world)[move.group] ?? {};
    const cost = g.cost ?? move.def.cost ?? 0, cooldown = g.cooldown ?? move.def.cooldown ?? 0;
    const busy = /** @type {number[]} */ ([]), kinds = /** @type {Map<string, number[]>} */ (new Map()), statusTicks = /** @type {Map<string, number[]>} */ (new Map());
    const hits = /** @type {HitMark[]} */ ([]);
    let pressTick = -1, spawnTick = -1, startHp = 0, t = 0;
    startHp = game.fighters[1].hp;
    while (!run.done) {
      const [a, b] = run.commands();
      if (pressTick < 0 && a.skill != null) pressTick = t;
      game.step(a, b);run.observe();
      const blue = game.fighters[0], red = game.fighters[1];
      if (blue.action || blue.charge || blue.aim) busy.push(t);
      for (const e of game.world.entities) {
        if (e.dead) continue;
        if (!kinds.has(e.kind)) kinds.set(e.kind, []);
        kinds.get(e.kind)?.push(t);
        if (spawnTick < 0 && e.owner === 0) spawnTick = t;
      }
      for (const [who, f] of [['alvo', red], ['azul', blue]]) for (const s of f.statuses ?? []) {
        const key = `${who}:${s.id}`;if (!statusTicks.has(key)) statusTicks.set(key, []);statusTicks.get(key)?.push(t);
      }
      for (const ev of game.lastStepEvents) {
        if (ev.attacker === 0 && ev.target === 1 && ['impact', 'partial', 'perfect', 'footstool'].includes(ev.result)) hits.push({t: r3(t * dt), tick: t, damage: ev.damage ?? 0, result: ev.result});
      }
      t++;
    }
    const total = r3(t * dt), press = pressTick < 0 ? 0 : r3(pressTick * dt);
    /** @type {Lane[]} */
    const lanes = [];
    if (busy.length) lanes.push({label: 'Azul ocupado (ação, mira ou carga)', kind: 'action', spans: spansOf(busy, dt)});
    for (const [kind, ticks] of kinds) lanes.push({label: `Efeito no mundo: ${kind}`, kind: 'entity', spans: spansOf(ticks, dt)});
    for (const [key, ticks] of statusTicks) lanes.push({label: `Status ${key.replace(':', ' · ')}`, kind: 'status', spans: spansOf(ticks, dt)});
    const dmg = r3(startHp - game.fighters[1].hp);
    const firstHit = hits[0], lastHit = hits.at(-1);
    const entitySpan = [...kinds.values()].flat();
    const entityS = entitySpan.length ? r3((Math.max(...entitySpan) - Math.min(...entitySpan) + 1) * dt) : null;
    const busyS = busy.length ? r3((busy.at(-1) - busy[0] + 1) * dt) : null;
    const effectAt = spawnTick >= 0 ? spawnTick : firstHit ? firstHit.tick : -1;
    const metrics = {
      'Tempo até o efeito (s)': effectAt >= 0 ? r3(Math.max(0, (effectAt - pressTick) * dt)) : null,
      'Tempo até o primeiro acerto (s)': firstHit ? r3(Math.max(0, (firstHit.tick - pressTick) * dt)) : null,
      'Acertos': hits.length,
      'Dano total (HP)': dmg,
      'Dano por stamina (HP)': cost > 0 ? r3(dmg / cost) : null,
      'Dano por segundo de efeito (HP/s)': firstHit && lastHit && lastHit.t > firstHit.t ? r3(dmg / (lastHit.t - firstHit.t)) : null,
      'Duração do efeito no mundo (s)': entityS,
      'Azul ocupado (s)': busyS,
      'Custo de stamina': r3(cost),
      'Recarga (s)': r3(cooldown),
    };
    return {press, lanes, hits, metrics, total, step: dt, ticks: t};
  });
}

/** Melhor = menor ou maior? (para colorir a diferença). null = neutro. */
const LOWER_BETTER = new Set(['Tempo até o efeito (s)', 'Tempo até o primeiro acerto (s)', 'Azul ocupado (s)', 'Custo de stamina', 'Recarga (s)']);
const HIGHER_BETTER = new Set(['Acertos', 'Dano total (HP)', 'Dano por stamina (HP)', 'Dano por segundo de efeito (HP/s)']);

/**
 * Compara dois rastreios (A × B): linhas {label, a, b, delta, better}. better: 'a' | 'b' | 'igual' | null (medida neutra).
 * @param {MoveTrace} A
 * @param {MoveTrace} B
 */
export function compareTraces(A, B) {
  return Object.keys(A.metrics).map(label => {
    const a = A.metrics[label], b = B.metrics[label];
    const delta = a != null && b != null ? r3(b - a) : null;
    let better = /** @type {'a' | 'b' | 'igual' | null} */ (null);
    if (delta === 0) better = 'igual';
    else if (delta != null && LOWER_BETTER.has(label)) better = delta < 0 ? 'b' : 'a';
    else if (delta != null && HIGHER_BETTER.has(label)) better = delta > 0 ? 'b' : 'a';
    return {label, a, b, delta, better};
  });
}

/** Conta quantos valores de A e B diferem (para o aviso «A e B são iguais»). */
export const diffCount = (/** @type {Record<string, number>} */ a, /** @type {Record<string, number>} */ b) => Object.keys(a).filter(k => a[k] !== b[k]).length;
