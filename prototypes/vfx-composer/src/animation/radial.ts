import type {Vec3, VisualTrack} from '../core/types';

export interface RadialStep {time: number; reach: number}
export interface RadialExplosionOptions {radius: number; seed: number; lift?: number; steps: readonly RadialStep[]}
export interface RadialTarget {id: string; origin: Vec3}

export const RADIAL_LIMITS = {radiusMin: .2, radiusMax: 20, timeMin: .1, timeMax: 5, seedMax: 999999, liftMin: -10, liftMax: 10} as const;

const GOLDEN_ANGLE = 2.399963229728653;

// Direção determinística na esfera: mesmo índice, total e semente devolvem o mesmo vetor.
export function radialDirection(index: number, total: number, seed: number): Vec3 {
  if (!Number.isSafeInteger(index) || index < 0 || !Number.isSafeInteger(total) || total < 1 || total > 512) throw new Error('Índice radial inválido');
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > RADIAL_LIMITS.seedMax) throw new Error('Semente radial inválida');
  const normalized = index % total;
  const y = total === 1 ? 0 : 1 - 2 * (normalized + .5) / total;
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = (normalized + seed) * GOLDEN_ANGLE;
  return [Math.cos(phi) * ring, y, Math.sin(phi) * ring];
}

// Trilhas de posição para uma explosão: centro em t = 0 e raio crescente nos passos informados.
export function buildRadialTracks(targets: readonly RadialTarget[], options: RadialExplosionOptions): VisualTrack[] {
  const {radius, seed, lift = 0, steps} = options;
  if (!Number.isFinite(radius) || radius < RADIAL_LIMITS.radiusMin || radius > RADIAL_LIMITS.radiusMax) throw new Error(`Raio deve ficar entre ${RADIAL_LIMITS.radiusMin} e ${RADIAL_LIMITS.radiusMax} m`);
  if (!Number.isFinite(lift) || lift < RADIAL_LIMITS.liftMin || lift > RADIAL_LIMITS.liftMax) throw new Error('Elevação radial fora do intervalo');
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > RADIAL_LIMITS.seedMax) throw new Error('Semente radial inválida');
  if (!steps.length || steps[0].time !== 0) throw new Error('A explosão precisa começar em t = 0');
  steps.forEach((step, index) => {
    if (!Number.isFinite(step.time) || step.time < 0 || step.time > 3600) throw new Error('Tempo radial inválido');
    if (index > 0 && step.time <= steps[index - 1].time) throw new Error('Os tempos radiais precisam ser crescentes');
    if (!Number.isFinite(step.reach) || step.reach < 0 || step.reach > 1) throw new Error('Progresso radial precisa ficar entre 0 e 1');
  });
  const seen = new Set<string>();
  targets.forEach(target => {
    if (!target.id || seen.has(target.id)) throw new Error(`Alvo radial duplicado: ${target.id || 'sem ID'}`);
    seen.add(target.id);
    if (target.origin.length !== 3 || target.origin.some(value => !Number.isFinite(value))) throw new Error(`Origem radial inválida: ${target.id}`);
  });
  return targets.flatMap((target, index) => {
    const direction = radialDirection(index, targets.length, seed);
    return (['position.x', 'position.y', 'position.z'] as const).map((property, axis) => ({
      id: `track-${target.id}-${property.replace('.', '-')}`,
      targetId: target.id,
      property,
      keyframes: steps.map(step => ({
        time: Number(step.time.toFixed(4)),
        value: Number((target.origin[axis] + direction[axis] * radius * step.reach + (axis === 1 ? lift * step.reach : 0)).toFixed(5)),
        interpolation: 'linear' as const,
      })),
    }));
  });
}
