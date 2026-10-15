// Workspace persistente do laboratório: um documento JSON versionado (ajustes, preferências, última partida, modelos
// por slot, estado das animações por modelo, histórico de calibrações) mais os assets binários (GLB) no armazenamento.
// Os modelos e clipes são referenciados pelo SHA-256 do conteúdo; o nome do arquivo é só informativo.
//
// Pacote portátil (ZIP): manifest.json (versionado) + workspace.json + presets.json + homologation.json +
// assets/<sha256>.glb. A importação valida esquema, versão, integridade de cada arquivo e referências ANTES de
// qualquer mudança, e devolve uma prévia; nada é aplicado sem confirmação.
import {storeAsset, loadAsset} from './store.js';
import {sha256} from './hash.js';
import {writeZip, readZip, zipText} from './zip.js';

export const WS_SCHEMA = 'arenamon-lab-workspace', WS_VERSION = 1, PKG_SCHEMA = 'arenamon-lab-workspace-package', PKG_VERSION = 1;
export const DOC_KEY = 'workspace';
export const LEGACY = {session: 'arenamon-lab-session-v7', anim: 'arenamon-lab-anim-v1:', presets: 'arenamon-lab-presets-v7', homologation: 'arenamon-lab-homologation-v1'};
export const MAX_CALIBRATIONS = 60;

export function emptyDoc() {
  return {schema: WS_SCHEMA, version: WS_VERSION, createdAt: new Date().toISOString(), savedAt: null,
    prefs: {autoRestoreSession: 1, warnOnClose: 0},
    tuning: null, animOptions: null, ui: {}, match: null,
    slots: [{modelId: null, name: null, autoRestore: 1}, {modelId: null, name: null, autoRestore: 1}],
    models: {}, calibrations: [], legacyModels: {}, sequences: [], benchmarks: [], extra: {}};
}

/** Normaliza um documento lido (versões futuras são recusadas; campos ausentes ganham o padrão). */
export function migrateDoc(raw) {
  const notes = [];
  if (!raw || typeof raw !== 'object') return {doc: emptyDoc(), notes};
  if (raw.schema !== WS_SCHEMA) return {doc: emptyDoc(), notes: ['Documento de workspace desconhecido ignorado.'], error: 'schema'};
  if ((raw.version | 0) > WS_VERSION) return {doc: emptyDoc(), notes: [`Workspace gravado por uma versão mais nova do laboratório (v${raw.version}); não foi carregado para não perder dados. Atualize o HTML.`], error: 'future'};
  const base = emptyDoc(), doc = {...base, ...raw, prefs: {...base.prefs, ...(raw.prefs || {})}, ui: {...(raw.ui || {})}, extra: {...(raw.extra || {})}};
  doc.slots = [0, 1].map(i => ({...base.slots[i], ...(raw.slots?.[i] || {})}));
  doc.models = raw.models && typeof raw.models === 'object' ? raw.models : {};
  doc.calibrations = Array.isArray(raw.calibrations) ? raw.calibrations.slice(-MAX_CALIBRATIONS) : [];
  doc.legacyModels = raw.legacyModels || {};doc.sequences = Array.isArray(raw.sequences) ? raw.sequences : [];doc.benchmarks = Array.isArray(raw.benchmarks) ? raw.benchmarks : [];
  return {doc, notes};
}

/** Dados do formato antigo (localStorage por nome de arquivo) para migração. Não apaga nada. */
export function readLegacy(ls) {
  const out = {tuning: null, models: {}, notes: []};if (!ls) return out;
  try {const s = JSON.parse(ls.getItem(LEGACY.session) || 'null');if (s && typeof s === 'object') {out.tuning = {values: s, source: LEGACY.session};out.notes.push('ajustes da sessão anterior (formato v7)');}} catch {/* ignorado */}
  try {
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);if (!k?.startsWith(LEGACY.anim)) continue;
      const state = JSON.parse(ls.getItem(k) || 'null');if (state) out.models[k.slice(LEGACY.anim.length)] = state;
    }
    const n = Object.keys(out.models).length;if (n) out.notes.push(`associações de animação de ${n} modelo(s) gravadas por nome de arquivo`);
  } catch {/* ignorado */}
  return out;
}

export class Workspace {
  constructor(store, doc, {debounce = 350, now = () => Date.now()} = {}) {
    this.store = store;this.doc = doc;this.debounce = debounce;this.now = now;this.timer = null;this.listeners = new Set();
    this.status = {state: 'idle', at: null, error: null, pending: false};this.saving = null;this.suspended = 0;
  }
  /** Abre (ou cria) o workspace; migra o formato antigo do localStorage quando ainda não há documento. */
  static async open(store, {ls = null, debounce} = {}) {
    let raw;let readError = null;
    try {raw = await store.getKV(DOC_KEY);} catch (e) {readError = e;}
    const {doc, notes, error} = migrateDoc(raw);
    const ws = new Workspace(store, doc, {debounce});ws.notes = [...notes];ws.loadError = readError ? readError.message : error || null;ws.fresh = !raw;
    if (!raw) {
      const legacy = readLegacy(ls);
      if (legacy.tuning) doc.tuning = legacy.tuning;
      for (const [name, state] of Object.entries(legacy.models)) doc.legacyModels[name] = state;
      if (legacy.notes.length) ws.notes.push('Migrado do formato antigo: ' + legacy.notes.join('; ') + '.');
      ws.migratedLegacy = legacy.notes.length > 0;
    }
    return ws;
  }
  onStatus(fn) {this.listeners.add(fn);return () => this.listeners.delete(fn);}
  emit() {for (const fn of this.listeners) fn(this.status);}
  /** Altera uma seção do documento e agenda a gravação. */
  set(section, value) {this.doc[section] = value;this.touch();}
  patch(section, partial) {this.doc[section] = {...(this.doc[section] || {}), ...partial};this.touch();}
  touch() {
    if (this.suspended) return;
    this.status = {...this.status, pending: true};this.emit();clearTimeout(this.timer);this.timer = setTimeout(() => this.saveNow(), this.debounce);
  }
  /** Grava agora. Resolve com {ok, error}; o estado só vira “salvo” depois da transação concluída. */
  async saveNow() {
    clearTimeout(this.timer);this.timer = null;
    if (this.saving) {await this.saving;if (!this.status.pending) return {ok: this.status.state === 'saved', error: this.status.error};}
    this.status = {...this.status, pending: false, state: 'saving'};this.emit();
    const snapshot = structuredClone({...this.doc, savedAt: new Date(this.now()).toISOString()});
    this.saving = this.store.setKV(DOC_KEY, snapshot).then(() => {this.doc.savedAt = snapshot.savedAt;this.status = {state: this.store.persistent ? 'saved' : 'memory', at: this.now(), error: null, pending: this.status.pending};},
      e => {this.status = {state: 'error', at: this.now(), error: e.message, code: e.code, pending: this.status.pending};});
    await this.saving;this.saving = null;this.emit();
    if (this.status.pending) this.touch();
    return {ok: this.status.state === 'saved' || this.status.state === 'memory', error: this.status.error};
  }
  /** Suspende o salvamento automático durante restaurações (evita gravar estados intermediários). */
  async batch(fn) {this.suspended++;try {return await fn();} finally {this.suspended--;}}

  // ---------- Modelos e animações ----------
  modelEntry(id) {return this.doc.models[id] ??= {name: null, state: null, imports: []};}
  /** Estado das associações do modelo; se ainda não há, adota o do formato antigo com o mesmo nome de arquivo. */
  modelState(id, name) {
    const m = this.doc.models[id];if (m?.state) return {state: m.state};
    const legacy = name && this.doc.legacyModels?.[name];
    if (legacy) {const e = this.modelEntry(id);e.name ??= name;e.state = structuredClone(legacy);e.migratedFrom = name;this.touch();return {state: e.state, migrated: true};}
    return {state: null};
  }
  setModelState(id, name, state) {const e = this.modelEntry(id);e.name = name ?? e.name;e.state = structuredClone(state);this.touch();}
  /** Registra uma animação importada para o modelo (ordem preservada: os nomes dos clipes dependem dela). */
  addImport(modelId, asset) {
    const e = this.modelEntry(modelId);if (e.imports.some(i => i.id === asset.id)) return false;
    e.imports.push({id: asset.id, name: asset.name});this.touch();return true;
  }
  removeImport(modelId, assetId) {const e = this.doc.models[modelId];if (!e) return;e.imports = e.imports.filter(i => i.id !== assetId);this.touch();}
  setSlot(slot, patch) {this.doc.slots[slot] = {...this.doc.slots[slot], ...patch};this.touch();}
  /** Todos os assets referenciados (slots + importações de cada modelo). */
  referencedAssets() {
    const refs = new Map(), add = (id, why) => {if (!id) return;if (!refs.has(id)) refs.set(id, []);refs.get(id).push(why);};
    this.doc.slots.forEach((s, i) => add(s.modelId, `slot ${i ? 'vermelho' : 'azul'}`));
    for (const [mid, m] of Object.entries(this.doc.models)) {if (m.state || m.imports?.length) add(mid, 'modelo com associações');for (const imp of m.imports || []) add(imp.id, `animação do modelo ${m.name || mid.slice(0, 8)}`);}
    return refs;
  }

  // ---------- Histórico de calibrações ----------
  addCalibration({label, values, kind = 'manual', meta = {}}) {
    const entry = {id: `${this.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, label: String(label || 'Calibração').slice(0, 80), kind, at: new Date(this.now()).toISOString(), values: structuredClone(values), meta};
    this.doc.calibrations.push(entry);if (this.doc.calibrations.length > MAX_CALIBRATIONS) this.doc.calibrations.splice(0, this.doc.calibrations.length - MAX_CALIBRATIONS);
    this.touch();return entry;
  }
  removeCalibration(id) {this.doc.calibrations = this.doc.calibrations.filter(c => c.id !== id);this.touch();}
}

// ---------- Pacote portátil ----------
const json = v => JSON.stringify(v, null, 2);
/**
 * Monta o ZIP do workspace. extras: {presets, homologation, app}. includeAll: também assets não referenciados.
 * Devolve {bytes, manifest, missing} — `missing` lista referências cujo arquivo não está armazenado (não entram).
 */
export async function buildPackage(ws, {presets = [], homologation = null, app = {}, includeAll = false} = {}) {
  const refs = ws.referencedAssets(), ids = new Set(refs.keys());
  if (includeAll) for (const a of await ws.store.listAssets()) ids.add(a.id);
  const files = [], assets = [], missing = [];
  for (const id of ids) {
    const r = await loadAsset(ws.store, id);
    if (r.error) {missing.push({id, reason: r.message, refs: refs.get(id) || []});continue;}
    const path = `assets/${id}.${r.meta.kind === 'animation' && /\.gltf$/i.test(r.meta.name) ? 'gltf' : 'glb'}`;
    files.push({path, data: new Uint8Array(r.bytes)});assets.push({id, sha256: id, name: r.meta.name, names: r.meta.names || [r.meta.name], kind: r.meta.kind, size: r.meta.size, path, refs: refs.get(id) || []});
  }
  const doc = structuredClone(ws.doc);
  const manifest = {schema: PKG_SCHEMA, version: PKG_VERSION, workspaceSchema: WS_SCHEMA, workspaceVersion: WS_VERSION, createdAt: new Date().toISOString(), app,
    contents: {workspace: 'workspace.json', presets: 'presets.json', homologation: 'homologation.json'}, assets, missing,
    summary: {models: Object.keys(doc.models).length, slots: doc.slots.map(s => s.modelId ? s.name : null), calibrations: doc.calibrations.length, presets: presets.length, assetBytes: assets.reduce((n, a) => n + a.size, 0)}};
  files.unshift({path: 'manifest.json', data: json(manifest)}, {path: 'workspace.json', data: json(doc)}, {path: 'presets.json', data: json(presets)}, {path: 'homologation.json', data: json(homologation)});
  return {bytes: writeZip(files), manifest, missing};
}

/** Lê e valida um pacote sem alterar nada. Erros fatais em `error`; problemas não fatais em `warnings`. */
export async function readPackage(input) {
  let files;try {files = await readZip(input);} catch (e) {return {error: e.message};}
  const parse = (path, required) => {
    const f = files.get(path);if (!f) return required ? {error: `Arquivo obrigatório ausente no pacote: ${path}`} : {value: null};
    try {return {value: JSON.parse(zipText(f))};} catch (e) {return {error: `${path} inválido: ${e.message}`};}
  };
  const m = parse('manifest.json', true);if (m.error) return {error: m.error};
  const manifest = m.value;
  if (manifest?.schema !== PKG_SCHEMA) return {error: 'Este ZIP não é um pacote de workspace do laboratório (manifest.schema diferente).'};
  if ((manifest.version | 0) > PKG_VERSION) return {error: `Pacote gerado por uma versão mais nova do laboratório (pacote v${manifest.version}, suportado até v${PKG_VERSION}). Atualize o HTML antes de importar.`};
  const w = parse(manifest.contents?.workspace || 'workspace.json', true);if (w.error) return {error: w.error};
  const {doc, notes, error} = migrateDoc(w.value);if (error) return {error: notes.join(' ')};
  const presets = parse(manifest.contents?.presets || 'presets.json', false), homologation = parse(manifest.contents?.homologation || 'homologation.json', false);
  const warnings = [...notes], assets = new Map();
  if (presets.error) warnings.push(presets.error);if (homologation.error) warnings.push(homologation.error);
  for (const a of manifest.assets || []) {
    const bytes = files.get(a.path);
    if (!bytes) {warnings.push(`Arquivo listado e ausente: ${a.name} (${a.path}).`);continue;}
    const id = await sha256(bytes);
    if (id !== a.id) return {error: `Falha de integridade: o SHA-256 de “${a.name}” não confere com o manifesto. O pacote está corrompido.`};
    assets.set(a.id, {meta: a, bytes});
  }
  for (const miss of manifest.missing || []) warnings.push(`O pacote foi exportado sem “${miss.id.slice(0, 12)}…” (${miss.reason}).`);
  return {manifest, doc, presets: Array.isArray(presets.value) ? presets.value : [], homologation: homologation.value, assets, warnings};
}

/** Referências do documento importado que não podem ser satisfeitas (nem no pacote, nem neste navegador). */
export async function unresolvedRefs(pkg, store) {
  const need = new Map(), add = (id, why) => {if (id) need.set(id, [...(need.get(id) || []), why]);};
  pkg.doc.slots.forEach((s, i) => add(s.modelId, `modelo do slot ${i ? 'vermelho' : 'azul'} (${s.name || '?'})`));
  for (const [mid, m] of Object.entries(pkg.doc.models)) for (const imp of m.imports || []) add(imp.id, `animação “${imp.name}” de ${m.name || mid.slice(0, 8)}`);
  const out = [];
  for (const [id, why] of need) {if (pkg.assets.has(id)) continue;const local = await store.getAssetMeta(id).catch(() => null);if (!local) out.push({id, why});}
  return out;
}

/** Grava os assets do pacote no armazenamento local (deduplicados pelo SHA-256). */
export async function installPackageAssets(pkg, store) {
  const report = [];
  for (const [id, {meta, bytes}] of pkg.assets) {
    const r = await storeAsset(store, {name: meta.name, kind: meta.kind, bytes});
    if (r.id !== id) throw new Error(`Integridade: ${meta.name}`);
    report.push({id, name: meta.name, duplicate: r.duplicate});
  }
  return report;
}
