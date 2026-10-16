// Sistema de presets do VFX.
// Schema versionado, migração explícita, importação com preview, exportação,
// desfazer/refazer, comparação A/B, reset por efeito/família, preview isolado,
// validação de valores. Controles puramente visuais — nunca alteram dano,
// hitbox ou regras de combate.

export const PRESET_SCHEMA = 'arenamon-vfx-preset';
export const PRESET_SCHEMA_VERSION = 1;

// Migrações: version → função de migração.
const MIGRATIONS = {
  // Exemplo: 0 → 1 (não há v0 ainda, mas a estrutura está pronta).
};

function migrate(values, fromVersion) {
  let v = fromVersion || 0;
  let out = {...values};
  while (v < PRESET_SCHEMA_VERSION && MIGRATIONS[v]) {
    out = MIGRATIONS[v](out);
    v++;
  }
  return {values: out, version: v, migrated: v !== fromVersion};
}

// Validar valores de um efeito (só campos visuais).
function validateValues(values) {
  const errors = [];
  const numeric = ['size', 'count', 'intensity', 'duration', 'speed', 'opacity', 'glow', 'fade', 'radius', 'density', 'scale', 'wave', 'flash', 'freeze', 'spread', 'length', 'width', 'height', 'frequency', 'interval', 'amplitude', 'damping', 'angular'];
  for (const [k, val] of Object.entries(values)) {
    if (numeric.includes(k) && typeof val === 'number' && !isFinite(val)) errors.push(`${k} deve ser finito`);
    if (k === 'variant' && typeof val === 'number' && (val < 0 || val > 3)) errors.push('variant deve estar entre 0 e 3');
    if (k === 'enabled' && typeof val !== 'boolean' && typeof val !== 'number') errors.push('enabled deve ser booleano');
  }
  return errors;
}

export class PresetManager {
  constructor(registry) {
    this.registry = registry;
    this.presets = new Map(); // nome → {name, schema, version, values, createdAt}
    this.history = []; // undo stack: [{name, values}]
    this.redoStack = [];
    this.maxHistory = 50;
    this.comparing = null; // {a, b} para comparação A/B
  }
  // Criar preset a partir dos valores atuais do registry (snapshot).
  capture(name, values) {
    const errs = validateValues(values);
    if (errs.length) return {ok: false, errors: errs};
    const preset = {name, schema: PRESET_SCHEMA, version: PRESET_SCHEMA_VERSION, values: {...values}, createdAt: Date.now()};
    this.presets.set(name, preset);
    this.history.push({name, values: {...values}});
    if (this.history.length > this.maxHistory) this.history.shift();
    this.redoStack = [];
    return {ok: true, preset};
  }
  // Obter preset por nome.
  get(name) { return this.presets.get(name) || null; }
  list() { return [...this.presets.values()]; }
  // Aplicar um preset ao registry (sobrescreve valores dos efeitos).
  apply(name) {
    const preset = this.presets.get(name);
    if (!preset) return {ok: false, error: 'preset não encontrado'};
    const mig = migrate(preset.values, preset.version);
    const errs = validateValues(mig.values);
    if (errs.length) return {ok: false, errors: errs};
    // Aplicar valores aos efeitos registrados (atualiza parâmetros, não a definição).
    for (const [effectId, value] of Object.entries(mig.values)) {
      const def = this.registry.getLatest(effectId);
      if (def && def.onApply) def.onApply(value);
    }
    return {ok: true, values: mig.values, migrated: mig.migrated};
  }
  // Exportar preset para JSON.
  export(name) {
    const preset = this.presets.get(name);
    if (!preset) return null;
    return JSON.stringify({schema: PRESET_SCHEMA, version: PRESET_SCHEMA_VERSION, name, values: preset.values, createdAt: preset.createdAt}, null, 2);
  }
  // Importar preset de JSON (com preview — retorna os valores sem aplicar).
  import(json) {
    try {
      const data = JSON.parse(json);
      if (data.schema !== PRESET_SCHEMA) return {ok: false, error: 'schema inválido'};
      const mig = migrate(data.values, data.version);
      const errs = validateValues(mig.values);
      if (errs.length) return {ok: false, errors: errs};
      return {ok: true, name: data.name || 'importado', values: mig.values, migrated: mig.migrated, preview: true};
    } catch (e) {
      return {ok: false, error: e.message};
    }
  }
  // Confirmar importação (aplica ao registry).
  confirmImport(name, values) {
    return this.capture(name, values);
  }
  // Desfazer.
  undo() {
    if (this.history.length === 0) return {ok: false, error: 'nada para desfazer'};
    const last = this.history.pop();
    this.redoStack.push(last);
    const prev = this.history[this.history.length - 1];
    if (prev) {
      return {ok: true, restored: prev.values, name: prev.name};
    }
    return {ok: true, cleared: true};
  }
  // Refazer.
  redo() {
    if (this.redoStack.length === 0) return {ok: false, error: 'nada para refazer'};
    const next = this.redoStack.pop();
    this.history.push(next);
    return {ok: true, restored: next.values, name: next.name};
  }
  // Comparação A/B de dois presets (ou preset vs valores atuais).
  compare(nameA, nameB) {
    const a = this.presets.get(nameA);
    const b = this.presets.get(nameB);
    if (!a || !b) return {ok: false, error: 'preset ausente'};
    const diff = {};
    const keys = new Set([...Object.keys(a.values), ...Object.keys(b.values)]);
    for (const k of keys) {
      if (JSON.stringify(a.values[k]) !== JSON.stringify(b.values[k])) {
        diff[k] = {a: a.values[k], b: b.values[k]};
      }
    }
    this.comparing = {a: nameA, b: nameB, diff};
    return {ok: true, diff, identical: Object.keys(diff).length === 0};
  }
  // Reset por efeito (voltar ao valor padrão do registry).
  resetEffect(effectId) {
    const def = this.registry.getLatest(effectId);
    if (!def) return {ok: false, error: 'efeito não encontrado'};
    const defaults = def.defaults || {};
    return {ok: true, values: defaults};
  }
  // Reset por família (todos os efeitos da família).
  resetFamily(family) {
    const out = {};
    for (const def of this.registry.byFamily(family)) {
      out[def.id] = def.defaults || {};
    }
    return {ok: true, values: out};
  }
  // Preview isolado de um efeito (não aplica globalmente).
  preview(effectId, values) {
    const def = this.registry.getLatest(effectId);
    if (!def) return {ok: false, error: 'efeito não encontrado'};
    const errs = validateValues(values);
    if (errs.length) return {ok: false, errors: errs};
    return {ok: true, effectId, values};
  }
}
