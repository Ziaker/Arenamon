// Operações puras sobre AnimationClips.
// Regras: nenhuma função altera tracks/arrays recebidos; sempre devolve tracks novos.
// Isso permite que o histórico (undo/redo) guarde apenas referências aos arrays de tracks.
import * as T from 'three';

export const EPS = 1e-5;

/** Número de componentes por chave (considera tracks cubic spline do GLTFLoader, que guardam tangentes). */
export function valueSize(track) {
  const raw = track.values.length / Math.max(1, track.times.length);
  return track.createInterpolant?.isInterpolantFactoryMethodGLTFCubicSpline ? raw / 3 : raw;
}
export const isQuaternion = track => track.ValueTypeName === 'quaternion';
export const isCubic = track => !!track.createInterpolant?.isInterpolantFactoryMethodGLTFCubicSpline;

/** Retorna fn(t) → cópia dos valores interpolados (slerp para quaternions, degrau para tracks discretos). */
export function sampler(track) {
  const interpolant = track.createInterpolant();
  return t => Array.from(interpolant.evaluate(t));
}

function makeTrack(source, times, values, interpolation = source.getInterpolation()) {
  const Ctor = source.constructor;
  // Tracks cubic spline são convertidos em lineares amostrados; os demais preservam a interpolação.
  const mode = isCubic(source) ? T.InterpolateLinear : interpolation;
  const track = new Ctor(source.name, times, values, mode);
  return track;
}

/** Remove chaves com tempos duplicados (mantém a última) e garante ordem crescente. */
function dedupe(times, values, size) {
  const t = [], v = [];
  for (let i = 0; i < times.length; i++) {
    if (t.length && Math.abs(times[i] - t[t.length - 1]) < EPS) {t[t.length - 1] = times[i];v.splice(v.length - size, size, ...values.slice(i * size, i * size + size));continue;}
    t.push(times[i]);v.push(...values.slice(i * size, i * size + size));
  }
  return {times: t, values: v};
}

/** Converte um track cubic spline em amostras lineares (bake). */
export function bakeTrack(track, fps = 30, start = 0, end = track.times[track.times.length - 1] ?? 0) {
  const sample = sampler(track), size = valueSize(track), times = [], values = [];
  const count = Math.max(1, Math.ceil((end - start) * fps - EPS));
  for (let i = 0; i <= count; i++) {const t = Math.min(end, start + i / fps);times.push(t);values.push(...sample(t));}
  const d = dedupe(times, values, size);
  return makeTrack(track, d.times, d.values);
}

function keysOf(track) {
  const size = valueSize(track);
  if (!isCubic(track)) return {times: Array.from(track.times), values: Array.from(track.values), size};
  const baked = bakeTrack(track, 60);return {times: Array.from(baked.times), values: Array.from(baked.values), size};
}

/**
 * Recorta um track ao intervalo [start, end] e desloca para começar em 0.
 * As fronteiras recebem chaves interpoladas, de modo que a pose em start/end seja exatamente a do original.
 */
export function trimTrack(track, start, end) {
  const {times, values, size} = keysOf(track), sample = sampler(track);
  const outT = [0], outV = [...sample(start)];
  for (let i = 0; i < times.length; i++) if (times[i] > start + EPS && times[i] < end - EPS) {outT.push(times[i] - start);outV.push(...values.slice(i * size, i * size + size));}
  if (end - start > EPS) {outT.push(end - start);outV.push(...sample(end));}
  const d = dedupe(outT, outV, size);
  return makeTrack(track, d.times, d.values);
}

export function trimClip(clip, start, end) {
  start = Math.max(0, Math.min(start, clip.duration));end = Math.max(start, Math.min(end, clip.duration));
  if (end - start < EPS) throw Error('O trecho selecionado precisa ter duração maior que zero.');
  return {tracks: clip.tracks.map(t => trimTrack(t, start, end)), duration: end - start};
}

/** Multiplica todos os tempos por factor (factor 2 = duas vezes mais lento). */
export function scaleClipTime(clip, factor) {
  if (!(factor > 0) || !Number.isFinite(factor)) throw Error('Fator de tempo inválido.');
  return {
    tracks: clip.tracks.map(t => {const {times, values} = keysOf(t);return makeTrack(t, times.map(x => x * factor), values);}),
    duration: clip.duration * factor,
  };
}
export const setClipSpeed = (clip, speed) => scaleClipTime(clip, 1 / speed);
export const setClipDuration = (clip, duration) => scaleClipTime(clip, duration / clip.duration);

const smooth = x => x * x * (3 - 2 * x);
function blendValues(track, a, b, w) {
  if (isQuaternion(track)) {const qa = new T.Quaternion().fromArray(a), qb = new T.Quaternion().fromArray(b);if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w);return qa.slerp(qb, w).toArray();}
  if (track.getInterpolation() === T.InterpolateDiscrete) return w < .5 ? a : b;
  return a.map((v, i) => v + (b[i] - v) * w);
}

/**
 * Fecha o loop: na janela final [d - blend, d] a pose converge suavemente para a pose inicial.
 * A janela é reamostrada em fps para que a transição seja suave mesmo em tracks com poucas chaves.
 * options.keepTravel: lista de nomes de tracks de posição cujo deslocamento horizontal deve ser preservado
 * (só o eixo vertical é fechado), evitando “puxar” a raiz de volta numa corrida com deslocamento.
 */
export function closeLoop(clip, blend, {fps = 30, keepTravel = []} = {}) {
  const d = clip.duration;blend = Math.max(1 / fps, Math.min(blend, d));const from = d - blend;
  const tracks = clip.tracks.map(track => {
    const {times, values, size} = keysOf(track), sample = sampler(track), first = sample(0);
    const outT = [], outV = [];
    for (let i = 0; i < times.length; i++) if (times[i] < from - EPS) {outT.push(times[i]);outV.push(...values.slice(i * size, i * size + size));}
    const steps = Math.max(1, Math.ceil(blend * fps));
    for (let s = 0; s <= steps; s++) {
      const t = from + blend * s / steps, w = smooth(s / steps), v = sample(t);
      let target = first;
      if (keepTravel.includes(track.name) && size === 3) target = [v[0], first[1], v[2]];
      outT.push(t);outV.push(...blendValues(track, v, target, w));
    }
    const dd = dedupe(outT, outV, size);
    return makeTrack(track, dd.times, dd.values);
  });
  return {tracks, duration: d};
}

/** Tempos de chave únicos de todo o clip (para desenhar na timeline). */
export function keyTimes(clip, limit = 4000) {
  const set = new Set();
  for (const t of clip.tracks) for (const x of t.times) {set.add(Math.round(x * 1000) / 1000);if (set.size > limit) break;}
  return [...set].sort((a, b) => a - b);
}

/** Eventos: recorte e reescala preservando a associação ao clip. */
export function trimEvents(events, start, end) {
  return (events || []).filter(e => e.time >= start - EPS && e.time <= end + EPS).map(e => ({...e, time: Math.max(0, Math.min(end - start, e.time - start))}));
}
export const scaleEvents = (events, factor) => (events || []).map(e => ({...e, time: e.time * factor}));
