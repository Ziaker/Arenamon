import {PHASE_NAMES, type AuthoringFps, type OutcomePhase, type PhaseMap, type PhaseName} from './types';

export interface ClockSegment {phase: PhaseName; start: number; end: number}
export interface AuthoringClock {segments: ClockSegment[]; duration: number; invisible: boolean; outcome: OutcomePhase}

export function buildAuthoringClock(phases: PhaseMap, outcome: OutcomePhase): AuthoringClock {
  const segments: ClockSegment[] = [];
  let cursor = 0;
  for (const phase of PHASE_NAMES) {
    if (phase === 'finish' && outcome !== 'finish') continue;
    if (phase === 'impact' && outcome !== 'impact') continue;
    const definition = phases[phase];
    if (!definition.enabled) continue;
    segments.push({phase, start: cursor, end: cursor + definition.duration});
    cursor += definition.duration;
  }
  return {segments, duration: cursor, invisible: segments.length === 0, outcome};
}

export function sampleAuthoringClock(clock: AuthoringClock, seconds: number): {phase: PhaseName | null; localTime: number; progress: number} {
  if (!Number.isFinite(seconds)) throw new Error('Tempo deve ser finito');
  const time = Math.max(0, Math.min(clock.duration, seconds));
  const segment = clock.segments.find(item => time >= item.start && (time < item.end || item === clock.segments.at(-1)));
  if (!segment) return {phase: null, localTime: 0, progress: 0};
  const length = segment.end - segment.start;
  return {phase: segment.phase, localTime: time - segment.start, progress: length > 0 ? (time - segment.start) / length : 1};
}

export const frameToSeconds = (frame: number, fps: AuthoringFps): number => frame / fps;
export const secondsToFrame = (seconds: number, fps: AuthoringFps): number => Math.round(seconds * fps);

export interface AuthorityState {alive: boolean; endedAt: number | null; outcome: OutcomePhase | null}

// Tempo absoluto desde o nascimento, em segundos. Scrub não depende da ordem das chamadas.
export function samplePersistentClock(phases: PhaseMap, seconds: number, authority: AuthorityState) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Tempo inválido');
  if (authority.alive && (authority.endedAt !== null || authority.outcome !== null)) throw new Error('Estado autoritativo contraditório');
  if (!authority.alive && (authority.endedAt === null || !Number.isFinite(authority.endedAt) || authority.endedAt < 0 || !['finish', 'impact'].includes(String(authority.outcome)))) throw new Error('Desfecho autoritativo obrigatório');
  const prefix = buildAuthoringClock(phases, 'finish').segments.filter(s => ['start', 'launch', 'body'].includes(s.phase));
  const prefixEnd = prefix.at(-1)?.end ?? 0;
  if (!authority.alive && seconds >= authority.endedAt!) {
    const outcome = authority.outcome!;
    const definition = phases[outcome];
    const localTime = seconds - authority.endedAt!;
    return {phase: definition.enabled && localTime < definition.duration ? outcome : null, localTime, done: !definition.enabled || localTime >= definition.duration};
  }
  const segment = prefix.find(s => seconds >= s.start && seconds < s.end);
  if (segment) return {phase: segment.phase, localTime: seconds - segment.start, done: false};
  return {phase: phases.hold.enabled ? 'hold' as const : null, localTime: Math.max(0, seconds - prefixEnd), done: false};
}
