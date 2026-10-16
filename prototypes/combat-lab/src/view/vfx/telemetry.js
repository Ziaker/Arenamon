// Telemetria do VFX — somente leitura.
// Fornece dados de diagnóstico sobre efeitos, supressões, pools e CPU.
// Não pode alterar a execução da simulação nem do VFX.

export class VfxTelemetry {
  constructor({capacity = 400} = {}) {
    this.capacity = capacity;
    this.events = []; // {effect, tick, reason, position, anchor, normal, variant, seed, duration, particlesRequested, particlesProduced, suppressed, timestamp}
    this.snapshots = []; // {tick, activeObjects, peakParticles, drawCalls, triangles, cpuMs, orphans}
    this.cpuMeasurements = [];
  }
  // Registra um efeito disparado (chamado pelo runtime).
  recordEffect({effect, tick, reason, position, anchor, normal, variant, seed, duration,
    particlesRequested = 0, particlesProduced = 0, suppressed = false}) {
    this.events.push({
      effect, tick, reason, position: position ? {...position} : null,
      anchor, normal: normal ? {...normal} : null, variant, seed, duration,
      particlesRequested, particlesProduced, suppressed,
      timestamp: performance.now(),
    });
    if (this.events.length > this.capacity) this.events.shift();
  }
  // Registra um snapshot do estado (chamado a cada quadro).
  recordSnapshot({tick, activeObjects, peakParticles, drawCalls = 0, triangles = 0, cpuMs, orphans = 0}) {
    this.snapshots.push({tick, activeObjects, peakParticles, drawCalls, triangles, cpuMs, orphans, timestamp: performance.now()});
    if (this.snapshots.length > this.capacity) this.snapshots.shift();
  }
  // Mede CPU gasto no VFX no quadro (ms).
  recordCpu(ms) {
    this.cpuMeasurements.push(ms);
    if (this.cpuMeasurements.length > 120) this.cpuMeasurements.shift();
  }
  // Lista de efeitos com filtros.
  list({active = false, changed = false, expensive = false, suppressed = false,
    character = null, family = null, limit = 100} = {}) {
    let out = this.events;
    if (suppressed) out = out.filter(e => e.suppressed);
    else if (active) out = out.filter(e => !e.suppressed);
    if (character != null) {
      // character é o id do lutador (attacker ou target) — não temos isso direto no evento,
      // mas filtramos por reason contendo o id quando disponível.
      out = out.filter(e => e.reason != null && e.reason.includes(`:${character}:`));
    }
    if (family) out = out.filter(e => e.effect === family || e.effect.startsWith(family));
    if (expensive) out = out.filter(e => e.particlesRequested >= 20);
    return out.slice(0, limit);
  }
  // Supressões por orçamento.
  suppressions() { return this.events.filter(e => e.suppressed); }
  // Efeitos por família.
  byFamily() {
    const map = {};
    for (const e of this.events) {
      const fam = e.effect;
      map[fam] = (map[fam] || 0) + 1;
    }
    return map;
  }
  // Partículas solicitadas vs produzidas (taxa de atendimento).
  particleStats() {
    let requested = 0, produced = 0, suppressed = 0;
    for (const e of this.events) {
      requested += e.particlesRequested;
      produced += e.particlesProduced;
      if (e.suppressed) suppressed++;
    }
    return {requested, produced, suppressed, fillRate: requested > 0 ? produced / requested : 1};
  }
  // Pico de partículas e CPU recente.
  peakStats() {
    let peakParticles = 0, maxCpu = 0;
    for (const s of this.snapshots) {
      peakParticles = Math.max(peakParticles, s.peakParticles);
      if (s.cpuMs != null) maxCpu = Math.max(maxCpu, s.cpuMs);
    }
    const recentCpu = this.cpuMeasurements.length
      ? this.cpuMeasurements.reduce((a, b) => a + b, 0) / this.cpuMeasurements.length
      : 0;
    return {peakParticles, maxCpu, avgCpu: recentCpu};
  }
  // Efeitos órfãos (excederam duração e não foram limpos) — detectado pelo runtime.
  recordOrphans(count) { this.orphanCount = count; }
  orphanStats() { return {orphans: this.orphanCount || 0}; }
  // Exportar dados somente leitura (clone estrutural para não expor referências internas).
  export() {
    return {
      events: JSON.parse(JSON.stringify(this.events)),
      snapshots: JSON.parse(JSON.stringify(this.snapshots)),
      particleStats: this.particleStats(),
      peakStats: this.peakStats(),
      orphanStats: this.orphanStats(),
    };
  }
  clear() {
    this.events = [];
    this.snapshots = [];
    this.cpuMeasurements = [];
    this.orphanCount = 0;
  }
}
