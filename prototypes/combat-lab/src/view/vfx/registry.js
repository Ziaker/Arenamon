// Registro de efeitos visuais.
// Cada efeito é uma definição declarativa: id, versão, gatilho, condições, prioridade,
// anchor, duração, seed determinística, variante, camadas visuais, perfil de qualidade,
// limites, política de agregação e comportamento no replay.
// Efeitos são imutáveis após o registro.

// Política de agregação: quantos efeitos idênticos podem coexistir.
export const AGGREGATION = Object.freeze({
  none: 'none',        // cada evento gera um efeito independente
  stack: 'stack',      // efeitos se acumulam (até maxStack)
  refresh: 'refresh',  // renova o efeito existente se houver um ativo
  coalesce: 'coalesce',// mescla múltiplos eventos próximos em um só
});

// Comportamento no replay.
export const REPLAY = Object.freeze({
  full: 'full',        // reproduz exatamente (padrão)
  reduced: 'reduced',  // reduzido em replay
  disabled: 'disabled',// desligado em replay
});

// Valida uma definição de efeito.
function validateDef(def) {
  const errors = [];
  if (!def.id || typeof def.id !== 'string') errors.push('id é obrigatório');
  if (!def.version || typeof def.version !== 'string') errors.push('version é obrigatória');
  if (!def.trigger) errors.push('trigger é obrigatório');
  if (!def.duration || def.duration <= 0) errors.push('duration deve ser > 0');
  if (def.quality && !['low','medium','high'].includes(def.quality)) errors.push('quality inválido');
  if (def.aggregation && !Object.values(AGGREGATION).includes(def.aggregation)) errors.push('aggregation inválido');
  if (def.replay && !Object.values(REPLAY).includes(def.replay)) errors.push('replay inválido');
  return errors;
}

export class EffectRegistry {
  constructor() {
    this.effects = new Map(); // chave: '${id}:${version}'
    this.byId = new Map(); // id → versão mais recente
  }
  // Registra uma definição de efeito. Retorna {ok, errors}.
  register(def) {
    const errors = validateDef(def);
    if (errors.length) return {ok: false, errors};
    const entry = Object.freeze({
      ...def,
      id: def.id,
      version: def.version,
      trigger: def.trigger,
      conditions: def.conditions || [],
      priority: def.priority || 0,
      anchor: def.anchor || 'contact',
      duration: def.duration,
      seed: def.seed !== false, // determinístico por padrão
      variant: def.variant || 0,
      layers: def.layers || [],
      quality: def.quality || 'medium',
      limits: def.limits || {},
      aggregation: def.aggregation || AGGREGATION.none,
      maxStack: def.maxStack || 1,
      replay: def.replay || REPLAY.full,
      onSpawn: def.onSpawn || null,
      onSustain: def.onSustain || null,
      onDecay: def.onDecay || null,
    });
    const key = `${entry.id}:${entry.version}`;
    this.effects.set(key, entry);
    // Atualizar versão mais recente por id.
    const cur = this.byId.get(entry.id);
    if (!cur || entry.version > cur.version) this.byId.set(entry.id, entry);
    return {ok: true, entry};
  }
  // Busca efeito por id e versão.
  get(id, version) {
    return this.effects.get(`${id}:${version}`) || null;
  }
  // Busca a versão mais recente de um id.
  getLatest(id) {
    return this.byId.get(id) || null;
  }
  // Lista todos os efeitos.
  list() { return [...this.effects.values()]; }
  // Busca efeitos por família (prefixo do id antes do primeiro ':' ou ponto).
  byFamily(family) {
    return this.list().filter(e => e.id.startsWith(family + ':') || e.id.startsWith(family + '.'));
  }
  // Remove um efeito (id:version). Retorna true se removeu.
  unregister(id, version) {
    const key = `${id}:${version}`;
    const had = this.effects.has(key);
    this.effects.delete(key);
    if (had) this.rebuildById();
    return had;
  }
  rebuildById() {
    this.byId.clear();
    for (const e of this.effects.values()) {
      const cur = this.byId.get(e.id);
      if (!cur || e.version > cur.version) this.byId.set(e.id, e);
    }
  }
  stats() {
    return {total: this.effects.size, byId: this.byId.size};
  }
}
