// Modelo de dados não destrutivo.
// - O clip importado é copiado para `sources` no momento em que entra na biblioteca (fonte original).
// - Toda edição substitui tracks/duração/metadados do clip de trabalho por versões novas e é registrada
//   no histórico. Restaurar o original é uma edição como outra qualquer (pode ser desfeita).
// - Versões derivadas são clips novos (com `derivedFrom`) acrescentados ao fim da biblioteca.
// - Metadados do editor ficam em clip.userData.arenamon, que o GLTFExporter grava em animations[i].extras
//   e o GLTFLoader devolve em clip.userData ao reimportar.
import * as T from 'three';

export const EVENT_TYPES = [
  ['attack_start', 'Início de ataque', '#ffb35c'],
  ['hitbox_on', 'Ativar hitbox', '#ff5f6d'],
  ['hitbox_off', 'Desativar hitbox', '#b04a5a'],
  ['invulnerable_start', 'Início de invulnerabilidade', '#8fd3ff'],
  ['invulnerable_end', 'Fim de invulnerabilidade', '#4f8fb8'],
  ['impact', 'Impacto', '#fff06a'],
  ['vfx', 'Efeito visual', '#c58bff'],
  ['sfx', 'Som', '#7cf0c4'],
  ['recovery_start', 'Início de recuperação', '#9fb1c9'],
  ['recovery_end', 'Fim de recuperação', '#62738a'],
  ['ground_contact', 'Contato com o chão', '#a3e36b'],
  ['special_start', 'Início de movimento especial', '#ff8ad8'],
  ['special_end', 'Fim de movimento especial', '#b8649c'],
].map(([id, label, color]) => ({id, label, color}));
export const eventType = id => EVENT_TYPES.find(t => t.id === id) || {id, label: id, color: '#cccccc'};
const PAIRS = [['hitbox_on', 'hitbox_off'], ['invulnerable_start', 'invulnerable_end'], ['recovery_start', 'recovery_end'], ['special_start', 'special_end']];

let counter = 0;
export const newId = prefix => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Metadados do editor no clip (criados sob demanda). */
export function meta(clip) {
  const d = clip.userData.arenamon ??= {};
  d.schemaVersion = 1;d.id ??= newId('clip');d.derivedFrom ??= null;d.edits ??= [];d.events ??= [];d.rootMotion ??= null;
  return d;
}
const cloneData = data => JSON.parse(JSON.stringify(data ?? {}));
export function snapshot(clip) {return {tracks: clip.tracks.slice(), duration: clip.duration, name: clip.name, data: cloneData(clip.userData.arenamon)};}
export function applySnapshot(clip, s) {clip.tracks = s.tracks.slice();clip.duration = s.duration;clip.name = s.name;clip.userData.arenamon = cloneData(s.data);}

/** Avisos de consistência dos eventos (apenas informativos; não alteram o combate). */
export function eventWarnings(events, duration) {
  const warnings = [], sorted = [...events].sort((a, b) => a.time - b.time);
  for (const [open, close] of PAIRS) {
    let depth = 0;
    for (const e of sorted) {if (e.type === open) depth++;else if (e.type === close) {if (!depth) warnings.push(`“${eventType(close).label}” em ${e.time.toFixed(3)} s sem “${eventType(open).label}” antes.`);else depth--;}}
    if (depth) warnings.push(`“${eventType(open).label}” sem “${eventType(close).label}” correspondente.`);
  }
  for (const e of events) if (e.time < 0 || e.time > duration + 1e-4) warnings.push(`Evento fora da duração do clipe: ${e.label || eventType(e.type).label}.`);
  return warnings;
}

export function createStore({engine, history}) {
  const sources = new WeakMap();
  function register(clip) {meta(clip);if (!sources.has(clip)) sources.set(clip, snapshot(clip));}
  const source = clip => sources.get(clip) || null;
  function log(clip, op, params) {meta(clip).edits.push({op, ...params, at: new Date().toISOString()});}
  /**
   * Edita o clip de trabalho. `mutate(clip)` deve atribuir tracks novos (nunca alterar arrays) e pode alterar
   * meta(clip). Registra no histórico e reconstrói o preview.
   */
  function edit(clip, label, mutate, {op, params = {}} = {}) {
    register(clip);const before = snapshot(clip);
    mutate(clip);if (op) log(clip, op, params);
    const after = snapshot(clip);applySnapshot(clip, before);
    return history.run({label, clip, redo() {applySnapshot(clip, after);engine.clipChanged(clip);}, undo() {applySnapshot(clip, before);engine.clipChanged(clip);}});
  }
  /** Cria uma versão derivada (novo clip) a partir de `clip`, aplicando `build(copy)`. */
  function derive(clip, name, build, {op, params = {}} = {}) {
    register(clip);
    const copy = new T.AnimationClip(name, clip.duration, clip.tracks.slice(), clip.blendMode);
    copy.userData = cloneData(clip.userData);copy.sourceFile = clip.sourceFile;
    const d = meta(copy);d.id = newId('clip');d.derivedFrom = {id: meta(clip).id, clipName: clip.name};
    d.edits = [...meta(clip).edits];
    build?.(copy);if (op) log(copy, op, params);
    sources.set(copy, snapshot(copy));
    return history.run({label: `Criar “${name}”`, clip: copy, redo() {engine.addClip(copy);}, undo() {engine.removeClip(copy);}});
  }
  function restore(clip) {
    const s = source(clip);if (!s) return null;
    return edit(clip, `Restaurar “${clip.name}”`, c => {const name = c.name;applySnapshot(c, s);c.name = name;meta(c).edits.push({op: 'restore', at: new Date().toISOString()});});
  }
  function remove(clip) {
    if (!meta(clip).derivedFrom) throw Error('Somente clipes derivados podem ser excluídos. Os clipes importados são preservados como fonte.');
    return history.run({label: `Excluir “${clip.name}”`, clip, redo() {engine.removeClip(clip);}, undo() {engine.addClip(clip);}});
  }
  return {register, source, edit, derive, restore, remove, snapshot};
}
