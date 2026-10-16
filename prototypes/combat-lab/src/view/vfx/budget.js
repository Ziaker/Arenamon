// Orçamento de qualidade do VFX.
// Baixo / Médio / Alto. Suprime efeitos quando o orçamento está esgotado,
// registrando a supressão na telemetria (nunca falha silenciosamente).

export const QUALITY_LEVELS = Object.freeze(['low', 'medium', 'high']);

// Limites por nível de qualidade.
export const QUALITY_LIMITS = Object.freeze({
  low: {
    maxParticles: 400,
    maxRings: 16,
    maxLights: 0, // sem luzes dinâmicas temporárias
    maxTrails: 64,
    maxDecals: 8,
    distortion: false,
    trailLength: 'short',
  },
  medium: {
    maxParticles: 900,
    maxRings: 32,
    maxLights: 4,
    maxTrails: 256,
    maxDecals: 16,
    distortion: false,
    trailLength: 'medium',
  },
  high: {
    maxParticles: 1400,
    maxRings: 64,
    maxLights: 16,
    maxTrails: 512,
    maxDecals: 32,
    distortion: true,
    trailLength: 'full',
  },
});

// Custo aproximado de cada família de efeito (em partículas/objetos).
export const EFFECT_COST = Object.freeze({
  impact: {particles: 24, rings: 1, lights: 0, decals: 0, trails: 0},
  defense: {particles: 16, rings: 1, lights: 0, decals: 0, trails: 0},
  clash: {particles: 36, rings: 2, lights: 1, decals: 0, trails: 0},
  landing: {particles: 20, rings: 1, lights: 0, decals: 2, trails: 0},
  movement: {particles: 8, rings: 0, lights: 0, decals: 0, trails: 4},
  status: {particles: 12, rings: 0, lights: 0, decals: 0, trails: 0},
  environment: {particles: 10, rings: 0, lights: 0, decals: 1, trails: 0},
});

export class Budget {
  constructor({quality = 'medium', limits = QUALITY_LIMITS[quality]} = {}) {
    this.quality = quality;
    this.limits = {...limits};
    this.active = {particles: 0, rings: 0, lights: 0, trails: 0, decals: 0, drawCalls: 0};
    this.suppressed = []; // {effect, tick, reason, position, anchor, normal, variant, seed, duration}
    this.frameSuppressed = 0;
  }
  setQuality(quality) {
    this.quality = quality;
    this.limits = {...QUALITY_LIMITS[quality]};
  }
  // Tenta reservar recursos para um efeito. Retorna false se suprimido.
  reserve(family, {particles = 0, rings = 0, lights = 0, trails = 0, decals = 0, drawCalls = 0} = {}) {
    const next = {
      particles: this.active.particles + particles,
      rings: this.active.rings + rings,
      lights: this.active.lights + lights,
      trails: this.active.trails + trails,
      decals: this.active.decals + decals,
      drawCalls: this.active.drawCalls + drawCalls,
    };
    const over = [];
    if (next.particles > this.limits.maxParticles) over.push('particles');
    if (next.rings > this.limits.maxRings) over.push('rings');
    if (next.lights > this.limits.maxLights) over.push('lights');
    if (next.trails > this.limits.maxTrails) over.push('trails');
    if (next.decals > this.limits.maxDecals) over.push('decals');
    if (over.length > 0) return {ok: false, over};
    this.active = next;
    return {ok: true};
  }
  release({particles = 0, rings = 0, lights = 0, trails = 0, decals = 0, drawCalls = 0} = {}) {
    this.active.particles = Math.max(0, this.active.particles - particles);
    this.active.rings = Math.max(0, this.active.rings - rings);
    this.active.lights = Math.max(0, this.active.lights - lights);
    this.active.trails = Math.max(0, this.active.trails - trails);
    this.active.decals = Math.max(0, this.active.decals - decals);
    this.active.drawCalls = Math.max(0, this.active.drawCalls - drawCalls);
  }
  // Registra uma supressão (chamada pelo runtime quando reserve falha).
  suppress({effect, tick, reason, position, anchor, normal, variant, seed, duration}) {
    this.frameSuppressed++;
    this.suppressed.push({
      effect, tick, reason, position, anchor, normal, variant, seed, duration,
      suppressedAt: performance.now(),
    });
    if (this.suppressed.length > 200) this.suppressed.shift();
  }
  beginFrame() { this.frameSuppressed = 0; }
  // Zera contadores ativos e supressões (chamado em reset de luta / menu / troca de personagem).
  reset() {
    this.active = {particles: 0, rings: 0, lights: 0, trails: 0, decals: 0, drawCalls: 0};
    this.suppressed = [];
    this.frameSuppressed = 0;
  }
  stats() {
    return {
      quality: this.quality,
      active: {...this.active},
      limits: {...this.limits},
      suppressedTotal: this.suppressed.length,
      frameSuppressed: this.frameSuppressed,
      utilization: {
        particles: this.active.particles / Math.max(1, this.limits.maxParticles),
        rings: this.active.rings / Math.max(1, this.limits.maxRings),
        lights: this.active.lights / Math.max(1, this.limits.maxLights),
        trails: this.active.trails / Math.max(1, this.limits.maxTrails),
        decals: this.active.decals / Math.max(1, this.limits.maxDecals),
      },
    };
  }
}
