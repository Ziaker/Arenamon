// Ponto de entrada do novo sistema de VFX declarativo.
// Exporta os subsistemas e as famílias de efeitos.
// O runtime (VfxRuntime) é o orquestrador principal; a view (view.js) o integra como
// substituto progressivo do sistema anterior (VfxSystem), mantendo este como fallback.

export {VfxRuntime} from './runtime.js';
export {BeamRenderer, BEAM_DEFAULTS, BEAM_PL_COLORS} from './beam-renderer.js';
export {EffectRegistry} from './registry.js';
import {EffectRegistry} from './registry.js';
export {Scheduler, PHASES} from './scheduler.js';
export {PoolManager, Pool, ParticlePool, RingPool, MeshPool, LightPool, TrailPool} from './pools.js';
export {Budget, QUALITY_LIMITS, EFFECT_COST} from './budget.js';
export {CameraFeedback, CAMERA_PROFILES} from './camera-feedback.js';
export {VfxTelemetry} from './telemetry.js';
export {
  adaptSimEvent, classifyVisualType, freezeVisualEvent, isSimEvent,
  VFX_FAMILIES, QUALITY, makeEventId, eventSeed,
} from './contract.js';
export {PresetManager, PRESET_SCHEMA, PRESET_SCHEMA_VERSION} from './presets.js';
export {TrailManager, TrailSegmentPool, physicalTrail, anchorTrail, afterimage} from './trails.js';

// Famílias de efeitos (DEFS e build functions).
export * from './effects/index.js';
import {IMPACT_DEFS} from './effects/impact.js';
import {DEFENSE_DEFS} from './effects/defense.js';
import {CLASH_DEFS} from './effects/clash.js';
import {LANDING_DEFS} from './effects/landing.js';
import {MOVEMENT_DEFS} from './effects/movement.js';
import {STATUS_DEFS} from './effects/status.js';
import {ENVIRONMENT_DEFS} from './effects/environment.js';

const ALL_DEFS = [
  ...IMPACT_DEFS, ...DEFENSE_DEFS, ...CLASH_DEFS, ...LANDING_DEFS,
  ...MOVEMENT_DEFS, ...STATUS_DEFS, ...ENVIRONMENT_DEFS,
];

// Registra todas as famílias de efeito no registry do runtime.
export function registerAllEffects(runtime) {
  const registry = runtime.registry || new EffectRegistry();
  runtime.setRegistry(registry);
  for (const def of ALL_DEFS) registry.register(def);
  return registry;
}
