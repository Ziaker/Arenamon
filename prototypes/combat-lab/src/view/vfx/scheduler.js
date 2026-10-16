// Scheduler do VFX com fases explícitas: spawn → sustain → decay → cancel.
// Processa efeitos ativos por fase, respeitando duração e políticas de cancelamento.

export const PHASES = Object.freeze(['spawn', 'sustain', 'decay', 'cancel']);

// Um efeito ativo no scheduler.
class EffectInstance {
  constructor(effectDef, instanceId, startTime, ctx) {
    this.effectDef = effectDef; // definição declarativa
    this.instanceId = instanceId;
    this.startTime = startTime;
    this.age = 0;
    this.life = effectDef.duration || 0;
    this.ctx = ctx;
    this.phase = 'spawn';
    this.cancelled = false;
    this.done = false;
    this.spawned = false;
  }
  get progress() { return this.life > 0 ? Math.min(1, Math.max(0, this.age / this.life)) : 1; }
  update(dt, now) {
    if (this.done || this.cancelled) return;
    this.age = now - this.startTime;
    // Determina a fase com base no progresso.
    const p = this.progress;
    if (p <= 0) this.phase = 'spawn';
    else if (p < 1) this.phase = 'sustain';
    else this.phase = 'decay';
  }
  markDone() { this.done = true; }
  markCancelled() { this.cancelled = true; this.phase = 'cancel'; }
}

// Scheduler: gerencia o ciclo de vida dos efeitos visuais.
export class Scheduler {
  constructor({maxConcurrent = 128} = {}) {
    this.maxConcurrent = maxConcurrent;
    this._instances = []; // instâncias ativas
    this.nextInstanceId = 1;
    this.now = 0;
  }
  get instances() { return this._instances; }
  // Registra um novo efeito para execução. Retorna o id da instância ou null se acima do limite.
  schedule(effectDef, ctx) {
    if (this._instances.length >= this.maxConcurrent) return null;
    const inst = new EffectInstance(effectDef, this.nextInstanceId++, this.now, ctx);
    this._instances.push(inst);
    return inst.instanceId;
  }
  // Avança o tempo e processa todas as fases em ordem.
  tick(dt) {
    this.now += dt;
    // Atualiza progresso/fase de cada instância.
    for (const inst of this._instances) inst.update(dt, this.now);
    // Fase 1: spawn — efeitos que ainda não spawnaram (callback opcional da definição).
    for (const inst of this._instances) {
      if (!inst.spawned && inst.phase === 'spawn') {
        if (inst.effectDef.onSpawn) inst.effectDef.onSpawn(inst.ctx, inst);
        inst.spawned = true;
      }
    }
    // Fase 2: sustain — efeitos em andamento.
    for (const inst of this._instances) {
      if (!inst.done && !inst.cancelled && inst.phase === 'sustain') {
        if (inst.effectDef.onSustain) inst.effectDef.onSustain(inst.ctx, inst, dt);
      }
    }
    // Fase 3: decay — efeitos que atingiram o fim da vida.
    for (const inst of this._instances) {
      if (!inst.done && !inst.cancelled && inst.phase === 'decay') {
        if (inst.effectDef.onDecay) inst.effectDef.onDecay(inst.ctx, inst, dt);
        if (inst.age >= inst.life + (inst.effectDef.decayExtension || 0)) {
          inst.markDone();
        }
      }
    }
    // Fase 4: cancel — devolve as instâncias finalizadas/canceladas para que o
    // runtime libere orçamento e recursos exatamente uma vez.
    const removed = this._instances.filter(inst => inst.done || inst.cancelled);
    this._instances = this._instances.filter(inst => !(inst.done || inst.cancelled));
    return removed;
  }
  // Cancela uma instância específica (ex: trocar personagem, desativar VFX).
  cancel(instanceId) {
    const inst = this._instances.find(i => i.instanceId === instanceId);
    if (inst && !inst.done && !inst.cancelled) inst.markCancelled();
  }
  cancelAll() {
    for (const inst of this._instances) inst.markCancelled();
    this._instances = [];
  }
  // Limpeza completa (reset de luta, replay, menu).
  clear() {
    this._instances = [];
    this.nextInstanceId = 1;
  }
  stats() {
    let active = 0, byPhase = {};
    for (const ph of PHASES) byPhase[ph] = 0;
    for (const inst of this._instances) {
      active++;
      byPhase[inst.phase] = (byPhase[inst.phase] || 0) + 1;
    }
    return {active, byPhase, maxConcurrent: this.maxConcurrent};
  }
}
