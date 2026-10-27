import {evaluateBudget, type QualityProfile} from '../core/budget';
import type {BudgetCost, Vec3} from '../core/types';

// F3.1 — contrato declarativo de partículas.
// A simulação é pura, semeada e integrável de forma fechada: o mesmo emissor, tempo e
// perfil produzem sempre as mesmas amostras. Nada aqui conhece o jogo, o renderer ou o DOM.

export const EMITTER_MODES = ['burst', 'continuous'] as const;
export type EmissionMode = typeof EMITTER_MODES[number];
export const EMITTER_SHAPES = ['point', 'sphere', 'ring', 'cone'] as const;
export type EmitterShape = typeof EMITTER_SHAPES[number];
export const BLEND_MODES = ['normal', 'additive'] as const;
export type BlendMode = typeof BLEND_MODES[number];

export interface ParticleEmitter {
  id: string;
  name: string;
  enabled: boolean;
  seed: number;
  origin: Vec3;
  emission: {mode: EmissionMode; count: number; rate: number; interval: number; duration: number};
  lifetime: {min: number; max: number};
  shape: {kind: EmitterShape; radius: number; angle: number};
  velocity: {speedMin: number; speedMax: number; spread: number};
  forces: {gravity: Vec3; drag: number; turbulenceFrequency: number; turbulenceAmplitude: number};
  look: {
    sizeStart: number;
    sizeEnd: number;
    opacityStart: number;
    opacityEnd: number;
    colorStart: string;
    colorEnd: string;
    blending: BlendMode;
    depthWrite: boolean;
  };
  maxParticles: number;
}

// Limites do contrato. O orçamento de publicação é validado separadamente por perfil.
export const PARTICLE_LIMITS = Object.freeze({
  emitters: 12,
  particlesPerEmitter: 1400,
  totalParticles: 1400,
  lifetime: Object.freeze({min: 0.01, max: 30}),
  speed: 50,
  radius: 50,
  gravity: 50,
  drag: 20,
  turbulenceFrequency: 20,
  turbulenceAmplitude: 20,
  size: Object.freeze({min: 0.001, max: 5}),
  duration: Object.freeze({min: 0.01, max: 60}),
  interval: Object.freeze({min: 0.01, max: 60}),
});

export const QUALITY_SCALE: Record<QualityProfile, number> = Object.freeze({low: 0.45, medium: 0.75, high: 1});
export const REDUCE_MOTION_SCALE = 0.35;
export const NO_FLASH_OPACITY_CAP = 0.85;

const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const TAU = Math.PI * 2;

export interface SimulationOptions {
  profile?: QualityProfile;
  reduceMotion?: boolean;
  noFlash?: boolean;
}

export function defaultEmitter(id = 'emissor-1', name = 'Faíscas de impacto'): ParticleEmitter {
  return {
    id, name, enabled: true, seed: 1337, origin: [0, 1, 0],
    emission: {mode: 'burst', count: 36, rate: 90, interval: 0.12, duration: 1.2},
    lifetime: {min: 0.35, max: 0.7},
    shape: {kind: 'sphere', radius: 0.12, angle: 40},
    velocity: {speedMin: 3, speedMax: 6, spread: 140},
    forces: {gravity: [0, -6, 0], drag: 1.2, turbulenceFrequency: 2.5, turbulenceAmplitude: 0.35},
    look: {
      sizeStart: 0.09, sizeEnd: 0.02, opacityStart: 1, opacityEnd: 0,
      colorStart: '#ffd166', colorEnd: '#ff5a3c', blending: 'additive', depthWrite: false,
    },
    maxParticles: 320,
  };
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const between = (value: unknown, min: number, max: number): boolean => finite(value) && value >= min && value <= max;
const vector = (value: unknown, limit: number): boolean => Array.isArray(value) && value.length === 3 && value.every(component => between(component, -limit, limit));

/** Validação defensiva do emissor; devolve caminhos relativos ao emissor. */
export function validateParticleEmitter(value: unknown): {path: string; message: string}[] {
  const issues: {path: string; message: string}[] = [];
  const fail = (path: string, message: string) => issues.push({path, message});
  if (!object(value)) {fail('$', 'emissor deve ser um objeto'); return issues;}
  if (typeof value.id !== 'string' || !ID.test(value.id)) fail('id', 'ID estável obrigatório');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 64) fail('name', 'nome de 1 a 64 caracteres obrigatório');
  if (typeof value.enabled !== 'boolean') fail('enabled', 'deve ser booleano');
  if (!Number.isSafeInteger(value.seed) || Number(value.seed) < 0 || Number(value.seed) > 4294967295) fail('seed', 'inteiro entre 0 e 4294967295 obrigatório');
  if (!vector(value.origin, 100)) fail('origin', 'origem exige vetor 3D entre -100 e 100 m');
  if (!Number.isSafeInteger(value.maxParticles) || Number(value.maxParticles) < 1 || Number(value.maxParticles) > PARTICLE_LIMITS.particlesPerEmitter) fail('maxParticles', `inteiro entre 1 e ${PARTICLE_LIMITS.particlesPerEmitter} obrigatório`);

  const emission = value.emission;
  if (!object(emission)) fail('emission', 'emissão obrigatória');
  else {
    if (!EMITTER_MODES.includes(emission.mode as EmissionMode)) fail('emission.mode', 'modo deve ser burst ou continuous');
    if (!Number.isSafeInteger(emission.count) || Number(emission.count) < 1 || Number(emission.count) > 400) fail('emission.count', 'inteiro entre 1 e 400 obrigatório');
    if (!between(emission.rate, 0.1, 400)) fail('emission.rate', 'taxa deve ficar entre 0,1 e 400 partículas/s');
    if (!between(emission.interval, PARTICLE_LIMITS.interval.min, PARTICLE_LIMITS.interval.max)) fail('emission.interval', 'intervalo deve ficar entre 0,01 e 60 s');
    if (!between(emission.duration, PARTICLE_LIMITS.duration.min, PARTICLE_LIMITS.duration.max)) fail('emission.duration', 'duração deve ficar entre 0,01 e 60 s');
  }
  const lifetime = value.lifetime;
  if (!object(lifetime) || !between(lifetime.min, PARTICLE_LIMITS.lifetime.min, PARTICLE_LIMITS.lifetime.max) || !between(lifetime.max, PARTICLE_LIMITS.lifetime.min, PARTICLE_LIMITS.lifetime.max) || !(Number(lifetime.min) <= Number(lifetime.max))) fail('lifetime', 'vida exige mínimo e máximo entre 0,01 e 30 s, com mínimo ≤ máximo');

  const shape = value.shape;
  if (!object(shape)) fail('shape', 'forma obrigatória');
  else {
    if (!EMITTER_SHAPES.includes(shape.kind as EmitterShape)) fail('shape.kind', 'forma deve ser point, sphere, ring ou cone');
    if (!between(shape.radius, 0, PARTICLE_LIMITS.radius)) fail('shape.radius', 'raio deve ficar entre 0 e 50 m');
    if (!between(shape.angle, 0, 180)) fail('shape.angle', 'ângulo do cone deve ficar entre 0 e 180°');
  }
  const velocity = value.velocity;
  if (!object(velocity) || !between(velocity.speedMin, 0, PARTICLE_LIMITS.speed) || !between(velocity.speedMax, 0, PARTICLE_LIMITS.speed) || !(Number(velocity.speedMin) <= Number(velocity.speedMax)) || !between(velocity.spread, 0, 360)) fail('velocity', 'velocidade exige mínima/máxima entre 0 e 50 m/s e abertura entre 0 e 360°');

  const forces = value.forces;
  if (!object(forces)) fail('forces', 'forças obrigatórias');
  else {
    if (!vector(forces.gravity, PARTICLE_LIMITS.gravity)) fail('forces.gravity', 'gravidade exige vetor 3D entre -50 e 50');
    if (!between(forces.drag, 0, PARTICLE_LIMITS.drag)) fail('forces.drag', 'arrasto deve ficar entre 0 e 20');
    if (!between(forces.turbulenceFrequency, 0, PARTICLE_LIMITS.turbulenceFrequency)) fail('forces.turbulenceFrequency', 'frequência deve ficar entre 0 e 20 Hz');
    if (!between(forces.turbulenceAmplitude, 0, PARTICLE_LIMITS.turbulenceAmplitude)) fail('forces.turbulenceAmplitude', 'amplitude deve ficar entre 0 e 20 m');
  }
  const look = value.look;
  if (!object(look)) fail('look', 'aparência obrigatória');
  else {
    if (!between(look.sizeStart, PARTICLE_LIMITS.size.min, PARTICLE_LIMITS.size.max)) fail('look.sizeStart', 'tamanho inicial deve ficar entre 0,001 e 5 m');
    if (!between(look.sizeEnd, PARTICLE_LIMITS.size.min, PARTICLE_LIMITS.size.max)) fail('look.sizeEnd', 'tamanho final deve ficar entre 0,001 e 5 m');
    if (!between(look.opacityStart, 0, 1)) fail('look.opacityStart', 'opacidade inicial deve ficar entre 0 e 1');
    if (!between(look.opacityEnd, 0, 1)) fail('look.opacityEnd', 'opacidade final deve ficar entre 0 e 1');
    if (typeof look.colorStart !== 'string' || !HEX.test(look.colorStart)) fail('look.colorStart', 'cor inicial deve ser hexadecimal #rrggbb');
    if (typeof look.colorEnd !== 'string' || !HEX.test(look.colorEnd)) fail('look.colorEnd', 'cor final deve ser hexadecimal #rrggbb');
    if (!BLEND_MODES.includes(look.blending as BlendMode)) fail('look.blending', 'blending deve ser normal ou additive');
    if (typeof look.depthWrite !== 'boolean') fail('look.depthWrite', 'depthWrite deve ser booleano');
  }
  return issues;
}

/** Valida a lista completa; rejeita duplicidade e o total acima do orçamento máximo. */
export function validateParticleEmitters(value: unknown): {path: string; message: string}[] {
  const issues: {path: string; message: string}[] = [];
  if (!Array.isArray(value)) return [{path: 'particles', message: 'deve ser uma lista'}];
  if (value.length > PARTICLE_LIMITS.emitters) return [{path: 'particles', message: `limite de ${PARTICLE_LIMITS.emitters} emissores excedido`}];
  const ids = new Set<string>();
  let total = 0;
  value.forEach((emitter, index) => {
    for (const issue of validateParticleEmitter(emitter)) issues.push({path: `particles.${index}.${issue.path}`, message: issue.message});
    if (object(emitter) && typeof emitter.id === 'string') {
      if (ids.has(emitter.id)) issues.push({path: `particles.${index}.id`, message: 'ID duplicado'});
      ids.add(emitter.id);
      if (Number.isSafeInteger(emitter.maxParticles)) total += Number(emitter.maxParticles);
    }
  });
  if (total > PARTICLE_LIMITS.totalParticles) issues.push({path: 'particles', message: `total de ${total} partículas excede o teto de ${PARTICLE_LIMITS.totalParticles}`});
  return issues;
}

export function hexToRgb(hex: string): Vec3 {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

const multiply = (value: number) => value >>> 0;
/** Hash determinístico por partícula e canal; substitui Math.random em toda a simulação. */
export function randomAt(seed: number, index: number, channel: number): number {
  let state = multiply(seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca77));
  state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d);
  state = Math.imul(state ^ (state >>> 12), 0x297a2d39);
  return ((state ^ (state >>> 15)) >>> 0) / 4294967296;
}

export interface ParticleSample {
  x: number; y: number; z: number;
  size: number; opacity: number;
  r: number; g: number; b: number;
  age: number; life: number;
}
export type ParticleSink = (particle: ParticleSample) => void;

/** Escala efetiva de partículas para o perfil + acessibilidade. */
export function particleScale(options: SimulationOptions = {}): number {
  const quality = QUALITY_SCALE[options.profile ?? 'high'];
  return quality * (options.reduceMotion ? REDUCE_MOTION_SCALE : 1);
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Percorre as partículas vivas no instante `time` sem alocar por partícula.
 * Integração fechada com arrasto, gravidade e turbulência senoidal: permite scrub e
 * rewind exatos sem estado acumulado entre quadros.
 */
export function forEachParticle(emitter: ParticleEmitter, time: number, sink: ParticleSink, options: SimulationOptions = {}): number {
  if (!emitter.enabled || !Number.isFinite(time) || time < 0) return 0;
  const scale = particleScale(options);
  const {emission, lifetime, shape, velocity, forces, look} = emitter;
  const burstCount = emission.mode === 'burst' ? Math.max(1, Math.round(emission.count * scale)) : 0;
  const rate = emission.mode === 'continuous' ? Math.max(0.05, emission.rate * scale) : 0;
  const births = emission.mode === 'burst'
    ? burstCount * (Math.floor(time / emission.interval) + 1)
    : Math.floor(rate * time);
  const first = Math.max(0, births - emitter.maxParticles);
  const colorStart = hexToRgb(look.colorStart), colorEnd = hexToRgb(look.colorEnd);
  const spreadRad = (velocity.spread * Math.PI) / 180;
  const coneRad = (shape.angle * Math.PI) / 180;
  const opacityCap = options.noFlash ? NO_FLASH_OPACITY_CAP : 1;
  const sinkTarget: ParticleSample = {x: 0, y: 0, z: 0, size: 0, opacity: 0, r: 0, g: 0, b: 0, age: 0, life: 0};
  let emitted = 0;

  for (let index = first; index < births; index++) {
    const life = lerp(lifetime.min, lifetime.max, randomAt(emitter.seed, index, 1));
    const birth = emission.mode === 'burst' ? Math.floor(index / burstCount) * emission.interval : index / rate;
    if (birth > emission.duration + 1e-9) continue;
    const age = time - birth;
    if (age < 0 || age > life) continue;

    // Posição inicial: volume esférico, anel no plano XZ ou cone em +Y.
    const r1 = randomAt(emitter.seed, index, 2), r2 = randomAt(emitter.seed, index, 3), r3 = randomAt(emitter.seed, index, 4);
    const phi = TAU * r2;
    let x0 = 0, y0 = 0, z0 = 0;
    if (shape.kind === 'sphere') {
      const theta = Math.acos(2 * r1 - 1), radius = shape.radius * Math.cbrt(r3);
      x0 = Math.sin(theta) * Math.cos(phi) * radius;
      y0 = Math.cos(theta) * radius;
      z0 = Math.sin(theta) * Math.sin(phi) * radius;
    } else if (shape.kind === 'ring') {
      x0 = Math.cos(phi) * shape.radius;
      z0 = Math.sin(phi) * shape.radius;
    } else if (shape.kind === 'cone') {
      const theta = Math.acos(1 - r1 * (1 - Math.cos(coneRad)));
      x0 = Math.sin(theta) * Math.cos(phi) * shape.radius * r3;
      y0 = Math.cos(theta) * shape.radius * r3;
      z0 = Math.sin(theta) * Math.sin(phi) * shape.radius * r3;
    }

    // Direção: cone em +Y com abertura `spread` (360° = esfera completa).
    const full = velocity.spread >= 359.999;
    const theta = full ? Math.acos(2 * r1 - 1) : Math.acos(1 - r1 * (1 - Math.cos(spreadRad / 2)));
    const dirX = Math.sin(theta) * Math.cos(phi), dirY = Math.cos(theta), dirZ = Math.sin(theta) * Math.sin(phi);
    const speed = lerp(velocity.speedMin, velocity.speedMax, r3);
    const vx = dirX * speed, vy = dirY * speed, vz = dirZ * speed;
    const [gx, gy, gz] = forces.gravity;
    const k = forces.drag;

    let x: number, y: number, z: number;
    if (k > 1e-6) {
      const decay = Math.exp(-k * age), flow = (1 - decay) / k, tail = (age - flow) / k;
      x = x0 + vx * flow + gx * tail;
      y = y0 + vy * flow + gy * tail;
      z = z0 + vz * flow + gz * tail;
    } else {
      x = x0 + vx * age + 0.5 * gx * age * age;
      y = y0 + vy * age + 0.5 * gy * age * age;
      z = z0 + vz * age + 0.5 * gz * age * age;
    }
    if (forces.turbulenceAmplitude > 0 && forces.turbulenceFrequency > 0) {
      const phase = TAU * forces.turbulenceFrequency * age;
      const wobble = forces.turbulenceAmplitude * Math.sin(phase);
      x += wobble * (randomAt(emitter.seed, index, 5) - 0.5);
      y += wobble * (randomAt(emitter.seed, index, 6) - 0.5) * 0.5;
      z += wobble * (randomAt(emitter.seed, index, 7) - 0.5);
    }

    const t = Math.min(1, age / life);
    sinkTarget.x = emitter.origin[0] + x;
    sinkTarget.y = emitter.origin[1] + y;
    sinkTarget.z = emitter.origin[2] + z;
    sinkTarget.size = lerp(look.sizeStart, look.sizeEnd, t);
    sinkTarget.opacity = Math.min(opacityCap, lerp(look.opacityStart, look.opacityEnd, t) * smoothstep(0, 0.06, t));
    sinkTarget.r = lerp(colorStart[0], colorEnd[0], t);
    sinkTarget.g = lerp(colorStart[1], colorEnd[1], t);
    sinkTarget.b = lerp(colorStart[2], colorEnd[2], t);
    sinkTarget.age = age;
    sinkTarget.life = life;
    sink(sinkTarget);
    emitted++;
  }
  return emitted;
}

/** Amostras materializadas — usada por testes e pela telemetria de verificação. */
export function simulateEmitter(emitter: ParticleEmitter, time: number, options: SimulationOptions = {}): ParticleSample[] {
  const samples: ParticleSample[] = [];
  forEachParticle(emitter, time, particle => samples.push({...particle}), options);
  return samples;
}

export interface ParticleBudgetReport {
  cost: BudgetCost;
  peak: number;
  rawPeak: number;
  suppressed: number;
  activeEmitters: number;
  verdict: ReturnType<typeof evaluateBudget>;
}

/** Pico conservador por emissor (considera vida máxima e escala do perfil). */
export function estimateEmitterPeak(emitter: ParticleEmitter, options: SimulationOptions = {}): number {
  const scale = particleScale(options);
  const {emission, lifetime} = emitter;
  const raw = emission.mode === 'burst'
    ? Math.max(1, Math.round(emission.count * scale)) * (Math.floor(lifetime.max / emission.interval) + 1)
    : Math.ceil(Math.max(0.05, emission.rate * scale) * lifetime.max);
  return Math.min(emitter.maxParticles, raw);
}

/** Custo agregado + veredito de orçamento + supressão visível para a UI. */
export function evaluateParticleBudget(emitters: readonly ParticleEmitter[], profile: QualityProfile, accessibility: {noFlash: boolean; reduceMotion: boolean}): ParticleBudgetReport {
  const active = emitters.filter(emitter => emitter.enabled);
  const options: SimulationOptions = {profile, reduceMotion: accessibility.reduceMotion, noFlash: accessibility.noFlash};
  const peak = active.reduce((total, emitter) => total + estimateEmitterPeak(emitter, options), 0);
  const rawPeak = active.reduce((total, emitter) => total + estimateEmitterPeak(emitter, {profile: 'high'}), 0);
  const cost: BudgetCost = {particles: peak, lights: 0, drawCalls: active.length};
  return {cost, peak, rawPeak, suppressed: Math.max(0, rawPeak - peak), activeEmitters: active.length, verdict: evaluateBudget(profile, cost)};
}
