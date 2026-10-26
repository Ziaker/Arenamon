// @ts-check
// Telemetria REAL do empurrão do Sand Wave para o Editor de Moves.
// Roda o cenário de verdade (Game + prepareScenario), com os valores A ou B aplicados em C.world, e devolve
// velocidade, aceleração, estado do empurrão e motivo de interrupção por alvo em cada tick. É a mesma
// simulação que o jogo usa — os gráficos não são uma fórmula decorativa.
import {C} from '../sim/config.js';
import {Game} from '../sim/game.js';
import {prepareScenario} from '../sim/scenarios.js';
import {withValues} from './move-trace.js';
import {makeMoveScenario} from './move-editor-model.js';
import {pushReasonLabel} from '../sim/moves/sand-wave/sand-push.js';

/** Distâncias oficiais do teste A/B (m). */
export const PUSH_TRACE_DISTANCES = Object.freeze([1, 2, 3, 4]);
/** Janela de observação (s): cobre a barragem, a dissipação e os modos experimentais que continuam depois de `active`. */
export const PUSH_TRACE_SECONDS = 8;

/**
 * @typedef {{t: number, age: number | null, speed: number, accel: number, on: boolean, reason: string | null, x: number, z: number}} PushSample
 * @typedef {{distance: number, hitAt: number | null, startAt: number | null, endAt: number | null, duration: number, reason: string | null, reasonLabel: string, samples: PushSample[], peakSpeed: number, peakAccel: number, displacement: number, hp: number, pushTicks: number, contactTicks: number}} PushTrace
 */

/**
 * Roda o Sand Wave de verdade a `distance` m e devolve a telemetria por tick.
 * @param {any} move ficha editável (group/params/def/name)
 * @param {Record<string, number> | null} values valores aplicados em C.world[move.group]
 * @param {number} distance distância inicial até o alvo (m)
 * @param {{seconds?: number, containment?: boolean}} [opts] `containment` põe uma parede ao fim do alcance para o alvo
 *   permanecer dentro do retângulo e provar o motivo `barrageEnded` (na arena aberta ele costuma sair em `leftArea`).
 * @returns {PushTrace}
 */
export function traceSandPush(move, values, distance, opts = {}) {
  const seconds = Math.max(1, opts.seconds ?? PUSH_TRACE_SECONDS);
  return withValues(move, values, () => {
    const dt = C.test.step;
    const base = makeMoveScenario(move, {distance, target: 'still', arena: opts.containment ? 'backwall' : 'open', hold: 0});
    const def = {...base, ticks: () => Math.max(1, Math.ceil(seconds / dt))};
    const game = new Game();
    const run = prepareScenario(def, game);
    /** @type {PushSample[]} */
    const samples = [];
    let hitAt = /** @type {number | null} */ (null);
    let startAt = /** @type {number | null} */ (null);
    let endAt = /** @type {number | null} */ (null);
    let reason = /** @type {string | null} */ (null);
    let startPos = /** @type {{x: number, z: number} | null} */ (null);
    /** @type {any} */ let lastWave = null;
    let pushTicks = 0, contactTicks = 0;
    try {
      while (!run.done) {
        const [a, b] = run.commands();
        game.step(a, b);
        run.observe();
        // A onda é removida do mundo no MESMO passo em que `age` chega a `life`. Guardamos a última referência para
        // ainda ler o motivo (`barrageEnded`) e a idade final depois que ela sai de `game.world.entities`.
        const live = game.world.entities.find((/** @type {any} */ x) => x.kind === 'sandwave' && !x.dead);
        if (live) lastWave = live;
        const e = live ?? lastWave;
        const f = game.fighters[1];
        const st = e && f ? e.targets?.[f.id] : null;
        if (e && st && hitAt === null) hitAt = e.age;
        const on = !!f?.sandPush;
        if (on && startAt === null) {startAt = e?.age ?? null;startPos = {x: f.position.x, z: f.position.z};}
        if (!on && startAt !== null && endAt === null) {endAt = e?.age ?? null;reason = st?.reason ?? null;}
        if (st?.reason && st.reason !== 'releaseGrace' && endAt !== null && !on) reason = st.reason;
        if (on) pushTicks++;
        if (st) contactTicks++;
        samples.push({
          t: samples.length * dt,
          age: e?.age ?? null,
          speed: f ? (f.locomotionVelocity?.z ?? 0) : 0,
          accel: f?.sandPush?.accel ?? 0,
          on,
          reason: st?.reason ?? null,
          x: f?.position.x ?? 0,
          z: f?.position.z ?? 0,
        });
      }
      const f = game.fighters[1];
      const end = samples.at(-1)?.age ?? startAt;
      const duration = startAt === null ? 0 : Math.max(0, (endAt ?? end ?? startAt) - startAt);
      const after = !f?.sandPush && startAt !== null;
      const finalReason = reason ?? (after ? (samples.at(-1)?.reason ?? null) : null);
      return {
        distance,
        hitAt,
        startAt,
        endAt,
        duration,
        reason: finalReason,
        reasonLabel: pushReasonLabel(finalReason),
        samples,
        peakSpeed: samples.reduce((m, s) => Math.max(m, s.on ? Math.abs(s.speed) : 0), 0),
        peakAccel: samples.reduce((m, s) => Math.max(m, s.accel), 0),
        displacement: startPos && f ? Math.hypot(f.position.x - startPos.x, f.position.z - startPos.z) : 0,
        hp: f?.hp ?? 0,
        pushTicks,
        contactTicks,
      };
    } finally {
      run.abort();
    }
  });
}

/**
 * Roda o mesmo cenário para A e B e devolve os dois traços (para as tabelas e os gráficos de comparação).
 * @param {any} move
 * @param {Record<string, number> | null} valuesA
 * @param {Record<string, number> | null} valuesB
 * @param {number} distance
 * @returns {{a: PushTrace, b: PushTrace}}
 */
export function traceSandPushPair(move, valuesA, valuesB, distance) {
  return {a: traceSandPush(move, valuesA, distance), b: traceSandPush(move, valuesB, distance)};
}

/**
 * Série SVG (`points`) a partir das amostras, normalizada por um máximo. `key` escolhe a grandeza.
 * @param {PushSample[]} samples
 * @param {'speed' | 'accel'} key
 * @param {number} max
 * @param {number} width
 * @param {number} height
 * @returns {string}
 */
export function svgPoints(samples, key, max, width, height) {
  if (!samples.length) return '';
  const span = Math.max(1e-6, max);
  const lastT = Math.max(1e-6, samples.at(-1)?.t ?? 1);
  return samples.map(s => {
    const x = (s.t / lastT) * width;
    const y = height - Math.min(1, Math.max(0, Math.abs(s[key]) / span)) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

/** Faixa horizontal do empurrão (início/fim) em coordenadas do gráfico. */
export function svgPushBand(/** @type {PushTrace} */ trace, /** @type {number} */ width, /** @type {number} */ height) {
  if (trace.startAt === null || trace.endAt === null || !trace.samples.length) return null;
  const lastT = Math.max(1e-6, trace.samples.at(-1)?.t ?? 1);
  const x1 = Math.max(0, Math.min(1, trace.startAt / lastT)) * width;
  const x2 = Math.max(0, Math.min(1, trace.endAt / lastT)) * width;
  return {x: Math.min(x1, x2), width: Math.max(1, Math.abs(x2 - x1)), y: 0, height};
}
