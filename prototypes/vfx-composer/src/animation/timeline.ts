import type {AuthoringFps, NumericKeyframe, Vec3, VisualTrack} from '../core/types';

export interface PlaybackState {time: number; duration: number; direction: 1 | -1; playing: boolean}

export function quantizeTime(time: number, fps: AuthoringFps, duration: number): number {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration < 0 || ![24, 30, 60].includes(fps)) throw new Error('Tempo, duração ou FPS inválido');
  return Math.min(duration, Math.max(0, Math.round(time * fps) / fps));
}

const segment = <T extends {time: number}>(frames: T[], time: number): [T, T] => {
  if (!frames.length) throw new Error('Track sem keyframes');
  if (time <= frames[0].time) return [frames[0], frames[0]];
  for (let i = 0; i < frames.length - 1; i++) if (time < frames[i + 1].time) return [frames[i], frames[i + 1]];
  return [frames.at(-1)!, frames.at(-1)!];
};

export function evaluateNumericTrack(track: Extract<VisualTrack, {property: Exclude<VisualTrack['property'], 'path.points'>}>, time: number): number {
  const [a, b] = segment(track.keyframes, time);
  if (a === b || a.interpolation === 'step') return a.value;
  const span = b.time - a.time, t = (time - a.time) / span;
  if (a.interpolation === 'linear') return a.value + (b.value - a.value) * t;
  const m0 = (a.outTangent ?? 0) * span, m1 = (b.inTangent ?? 0) * span;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * a.value + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b.value + (t3 - t2) * m1;
}

export function evaluatePathTrack(track: Extract<VisualTrack, {property: 'path.points'}>, time: number): Vec3[] {
  const count = track.keyframes[0]?.value.length;
  if (!count || track.keyframes.some(frame => frame.value.length !== count)) throw new Error('Topologia incompatível na track de morph');
  const [a, b] = segment(track.keyframes, time);
  if (a === b || a.interpolation === 'step') return a.value.map(point => [...point] as Vec3);
  const t = (time - a.time) / (b.time - a.time);
  return a.value.map((point, i) => point.map((value, axis) => value + (b.value[i][axis] - value) * t) as Vec3);
}

export function advancePlayback(state: PlaybackState, delta: number): PlaybackState {
  if (!Number.isFinite(delta) || delta < 0) throw new Error('Delta inválido');
  if (!state.playing) return {...state};
  const time = Math.min(state.duration, Math.max(0, state.time + delta * state.direction));
  return {...state, time, playing: time > 0 && time < state.duration};
}
