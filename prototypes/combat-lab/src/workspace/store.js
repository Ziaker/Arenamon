// Armazenamento do workspace. Ordem de preferência, decidida por teste real de gravação (não pela simples existência
// da API, porque em file:// alguns navegadores expõem o IndexedDB mas recusam gravar):
//   1. IndexedDB — estado (JSON) e assets binários (GLB) como ArrayBuffer, nunca como base64.
//   2. localStorage — só o estado JSON; os GLBs ficam apenas na memória desta aba (avisado na interface).
//   3. Memória — nada persiste entre sessões (avisado na interface).
// Uma gravação só é dada como concluída quando a transação termina (oncomplete); falhas e cota esgotada são relatadas.
import {sha256} from './hash.js';

export const DB_NAME = 'arenamon-lab-workspace', DB_VERSION = 1, LS_PREFIX = 'arenamon-lab-ws-v1:';
const reqP = r => new Promise((ok, fail) => {r.onsuccess = () => ok(r.result);r.onerror = () => fail(r.error);});
const friendly = (e, what) => {
  const name = e?.name || '', msg = e?.message || String(e);
  if (name === 'QuotaExceededError' || /quota/i.test(msg)) return Object.assign(new Error(`Espaço de armazenamento do navegador esgotado ao gravar ${what}. Libere espaço em Personagens › Armazenamento ou exporte um backup.`), {code: 'quota', cause: e});
  return Object.assign(new Error(`Falha ao gravar ${what}: ${msg}`), {code: name || 'error', cause: e});
};
const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, fail) => setTimeout(() => fail(new Error(`${label}: sem resposta em ${ms} ms`)), ms))]);
const bytesOf = d => d instanceof ArrayBuffer ? d : d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);

class MemoryBackend {
  constructor(reason) {this.kind = 'memory';this.binary = false;this.persistent = false;this.reason = reason;this.kv = new Map();this.meta = new Map();this.blobs = new Map();}
  async getKV(key) {return structuredClone(this.kv.get(key));}
  async setKV(key, value) {this.kv.set(key, structuredClone(value));}
  async deleteKV(key) {this.kv.delete(key);}
  async keysKV() {return [...this.kv.keys()];}
  async putAsset(meta, bytes) {this.meta.set(meta.id, {...meta});this.blobs.set(meta.id, bytesOf(bytes).slice(0));}
  async getAssetMeta(id) {return this.meta.get(id) ? {...this.meta.get(id)} : null;}
  async getAssetBytes(id) {return this.blobs.get(id) ?? null;}
  async listAssets() {return [...this.meta.values()].map(m => ({...m}));}
  async deleteAsset(id) {this.meta.delete(id);this.blobs.delete(id);}
  async touchAsset(id, patch) {if (this.meta.has(id)) Object.assign(this.meta.get(id), patch);}
}

/** JSON em localStorage; binários só na memória da aba. */
class LocalBackend extends MemoryBackend {
  constructor(ls, reason) {super(reason);this.kind = 'localstorage';this.ls = ls;this.persistent = true;}
  async getKV(key) {const raw = this.ls.getItem(LS_PREFIX + key);return raw == null ? undefined : JSON.parse(raw);}
  async setKV(key, value) {try {this.ls.setItem(LS_PREFIX + key, JSON.stringify(value));} catch (e) {throw friendly(e, `“${key}”`);}}
  async deleteKV(key) {this.ls.removeItem(LS_PREFIX + key);}
  async keysKV() {const out = [];for (let i = 0; i < this.ls.length; i++) {const k = this.ls.key(i);if (k?.startsWith(LS_PREFIX)) out.push(k.slice(LS_PREFIX.length));}return out;}
}

class IdbBackend {
  constructor(db) {this.kind = 'indexeddb';this.binary = true;this.persistent = true;this.db = db;this.reason = '';}
  tx(stores, mode, fn, what) {
    return new Promise((ok, fail) => {
      let t, result;
      try {t = this.db.transaction(stores, mode);} catch (e) {fail(friendly(e, what));return;}
      t.oncomplete = () => ok(result);t.onerror = () => fail(friendly(t.error, what));t.onabort = () => fail(friendly(t.error || new Error('transação abortada'), what));
      try {Promise.resolve(fn(t)).then(r => {result = r;}, e => {try {t.abort();} catch {}fail(friendly(e, what));});} catch (e) {try {t.abort();} catch {}fail(friendly(e, what));}
    });
  }
  getKV(key) {return this.tx('kv', 'readonly', t => reqP(t.objectStore('kv').get(key)), `“${key}”`);}
  setKV(key, value) {return this.tx('kv', 'readwrite', t => {t.objectStore('kv').put(value, key);}, `“${key}”`);}
  deleteKV(key) {return this.tx('kv', 'readwrite', t => {t.objectStore('kv').delete(key);}, `“${key}”`);}
  keysKV() {return this.tx('kv', 'readonly', t => reqP(t.objectStore('kv').getAllKeys()), 'chaves');}
  putAsset(meta, bytes) {return this.tx(['assets', 'blobs'], 'readwrite', t => {t.objectStore('assets').put(meta);t.objectStore('blobs').put(bytesOf(bytes), meta.id);}, `o arquivo “${meta.name}”`);}
  getAssetMeta(id) {return this.tx('assets', 'readonly', t => reqP(t.objectStore('assets').get(id)), 'metadados').then(m => m ?? null);}
  getAssetBytes(id) {return this.tx('blobs', 'readonly', t => reqP(t.objectStore('blobs').get(id)), 'arquivo').then(b => b ?? null);}
  listAssets() {return this.tx('assets', 'readonly', t => reqP(t.objectStore('assets').getAll()), 'lista de arquivos');}
  deleteAsset(id) {return this.tx(['assets', 'blobs'], 'readwrite', t => {t.objectStore('assets').delete(id);t.objectStore('blobs').delete(id);}, 'exclusão');}
  touchAsset(id, patch) {return this.tx('assets', 'readwrite', async t => {const s = t.objectStore('assets'), m = await reqP(s.get(id));if (m) s.put({...m, ...patch});}, 'metadados');}
}

function openIdb(idb, name) {
  return new Promise((ok, fail) => {
    let r;try {r = idb.open(name, DB_VERSION);} catch (e) {fail(e);return;}
    r.onupgradeneeded = () => {const db = r.result;for (const s of ['kv', 'blobs']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', {keyPath: 'id'});};
    r.onsuccess = () => ok(r.result);r.onerror = () => fail(r.error);r.onblocked = () => fail(new Error('banco bloqueado por outra aba do laboratório'));
  });
}

/** Abre o melhor armazenamento que REALMENTE grava neste navegador/contexto. */
export async function openStore({name = DB_NAME, indexedDB = globalThis.indexedDB, localStorage = (() => {try {return globalThis.localStorage;} catch {return null;}})(), timeout = 4000} = {}) {
  const reasons = [];
  if (indexedDB) {
    try {
      const db = await withTimeout(openIdb(indexedDB, name), timeout, 'IndexedDB');
      const b = new IdbBackend(db), probe = {at: Date.now()};
      await b.setKV('__probe', probe);const back = await b.getKV('__probe');await b.deleteKV('__probe');
      if (back?.at !== probe.at) throw new Error('leitura de teste divergente');
      db.onversionchange = () => db.close();
      return b;
    } catch (e) {reasons.push(`IndexedDB indisponível (${e?.message || e})`);}
  } else reasons.push('IndexedDB inexistente neste navegador');
  if (localStorage) {
    try {localStorage.setItem(LS_PREFIX + '__probe', '1');localStorage.removeItem(LS_PREFIX + '__probe');return new LocalBackend(localStorage, reasons.join('; ') + '. Modelos e animações não persistem entre sessões.');}
    catch (e) {reasons.push(`localStorage indisponível (${e?.message || e})`);}
  }
  return new MemoryBackend(reasons.join('; ') + '. Nada persiste entre sessões: exporte um backup antes de fechar.');
}

/**
 * Grava um asset (modelo ou animação) identificado pelo SHA-256 do conteúdo. Arquivos idênticos com nomes diferentes
 * viram o mesmo asset (duplicate: true); o nome original fica nos metadados.
 */
export async function storeAsset(store, {name, kind, bytes}) {
  const data = bytesOf(bytes), id = await sha256(data), existing = await store.getAssetMeta(id);
  // Já existe: reaproveita, a menos que os bytes armazenados estejam ausentes ou corrompidos (aí regrava).
  const intact = existing && await store.getAssetBytes(id).then(async b => !!b && b.byteLength === data.byteLength && await sha256(b) === id, () => false);
  if (existing && intact) {
    const names = [...new Set([...(existing.names || [existing.name]), name])];
    await store.touchAsset(id, {names, lastUsedAt: Date.now()});
    return {id, duplicate: true, meta: {...existing, names}};
  }
  const meta = {id, sha256: id, name, names: existing ? [...new Set([...(existing.names || [existing.name]), name])] : [name], kind: existing?.kind ?? kind, size: data.byteLength, addedAt: existing?.addedAt ?? Date.now(), lastUsedAt: Date.now()};
  await store.putAsset(meta, data);
  return {id, duplicate: false, repaired: !!existing, meta};
}

/** Lê um asset e confere a integridade (o SHA-256 do conteúdo precisa ser a própria chave). */
export async function loadAsset(store, id) {
  const meta = await store.getAssetMeta(id);
  if (!meta) return {error: 'missing', message: 'O arquivo não está mais armazenado neste navegador (foi excluído, o navegador limpou os dados ou o laboratório foi aberto em outro navegador).'};
  const bytes = await store.getAssetBytes(id);
  if (!bytes) return {error: 'missing', meta, message: `Os bytes de “${meta.name}” não estão armazenados (só os metadados).`};
  const check = await sha256(bytes);
  if (check !== id) return {error: 'corrupt', meta, message: `“${meta.name}” está corrompido (SHA-256 não confere). Selecione o arquivo de novo.`};
  if (bytes.byteLength !== meta.size) return {error: 'corrupt', meta, message: `“${meta.name}” tem tamanho diferente do registrado.`};
  return {meta, bytes};
}

/** Uso do armazenamento: soma dos assets e estimativa do navegador (quando disponível). */
export async function storageUsage(store) {
  const assets = await store.listAssets(), assetBytes = assets.reduce((n, a) => n + (a.size || 0), 0);
  let estimate = null, persisted = null;
  try {estimate = await navigator.storage?.estimate?.();} catch {estimate = null;}
  try {persisted = await navigator.storage?.persisted?.();} catch {persisted = null;}
  return {backend: store.kind, binary: store.binary, persistent: store.persistent, reason: store.reason, assets: assets.length, assetBytes, usage: estimate?.usage ?? null, quota: estimate?.quota ?? null, persisted};
}
export const formatBytes = n => n == null ? '—' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`;
