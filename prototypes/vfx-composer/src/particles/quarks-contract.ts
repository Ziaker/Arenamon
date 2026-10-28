import type {Vec3} from '../core/types';
import {
  NO_FLASH_OPACITY_CAP,
  particleScale,
  validateParticleEmitter,
  type BlendMode,
  type EmitterShape,
  type ParticleEmitter,
  type SimulationOptions,
} from './particles';

export interface QuarksRecipe {
  id: string;
  name: string;
  seed: number;
  origin: Vec3;
  worldSpace: true;
  emission: {mode: 'burst' | 'continuous'; count: number; rate: number; interval: number; duration: number};
  lifetime: [number, number];
  speed: [number, number];
  shape: {kind: EmitterShape; radius: number; angleRadians: number};
  spreadRadians: number;
  gravity: Vec3;
  drag: number;
  turbulence: {frequency: number; amplitude: number};
  look: {
    size: [number, number];
    opacity: [number, number];
    colors: [string, string];
    blending: BlendMode;
    depthWrite: boolean;
  };
  maxParticles: number;
  approximations: string[];
}
/** Converte o contrato persistido em dados puros; nenhuma instância Quarks cruza esta fronteira. */
export function toQuarksRecipe(value: unknown, options: SimulationOptions = {}): QuarksRecipe {
  const issues = validateParticleEmitter(value);
  if (issues.length) throw new Error(`Emissor Quarks inválido: ${issues[0].path} — ${issues[0].message}`);
  const emitter = value as ParticleEmitter;
  const scale = particleScale(options);
  const opacityCap = options.noFlash ? NO_FLASH_OPACITY_CAP : 1;
  const isBurst = emitter.emission.mode === 'burst';
  const shape = emitter.shape.kind;
  const approximations: string[] = [];
  if (emitter.forces.turbulenceAmplitude > 0) approximations.push('turbulence');
  if (emitter.velocity.spread > 0) approximations.push('spread');
  return {
    id: emitter.id,
    name: emitter.name,
    seed: emitter.seed,
    origin: [...emitter.origin] as Vec3,
    worldSpace: true,
    emission: {
      mode: emitter.emission.mode,
      count: isBurst ? Math.max(1, Math.round(emitter.emission.count * scale)) : 0,
      rate: isBurst ? 0 : emitter.emission.rate * scale,
      interval: emitter.emission.interval,
      duration: emitter.emission.duration,
    },
    lifetime: [emitter.lifetime.min, emitter.lifetime.max],
    speed: [emitter.velocity.speedMin, emitter.velocity.speedMax],
    shape: {
      kind: shape,
      radius: shape === 'point' ? 0 : emitter.shape.radius,
      angleRadians: shape === 'cone' ? emitter.shape.angle * Math.PI / 180 : 0,
    },
    spreadRadians: emitter.velocity.spread * Math.PI / 180,
    gravity: [...emitter.forces.gravity] as Vec3,
    drag: emitter.forces.drag,
    turbulence: {frequency: emitter.forces.turbulenceFrequency, amplitude: emitter.forces.turbulenceAmplitude},
    look: {
      size: [emitter.look.sizeStart, emitter.look.sizeEnd],
      opacity: [Math.min(opacityCap, emitter.look.opacityStart), Math.min(opacityCap, emitter.look.opacityEnd)],
      colors: [emitter.look.colorStart, emitter.look.colorEnd],
      blending: emitter.look.blending,
      depthWrite: emitter.look.depthWrite,
    },
    maxParticles: emitter.maxParticles,
    approximations,
  };
}

