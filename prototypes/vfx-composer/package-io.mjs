import {createHash} from 'node:crypto';
import {zipSync, unzipSync} from 'fflate';

// Ferramenta Node F0. Adaptação browser pertence ao fluxo de arquivos F1.
const LIMIT = 32 * 1024 * 1024;
const FILE_LIMIT = 8 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const safePath = path => typeof path === 'string' && path.length <= 240 && /^[A-Za-z0-9_.\/-]+$/.test(path)
  && !path.startsWith('/') && path.split('/').every(part => part && part !== '.' && part !== '..' && !part.endsWith('.') && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part));

function validateDependencies(projectText, assets, deserialize) {
  if (typeof deserialize !== 'function') throw new Error('Validador de projeto obrigatório');
  const result = deserialize(projectText);
  if (!result.ok) throw new Error('Projeto inválido');
  const required = new Set(result.value.assets.map(asset => asset.uri));
  if (required.size !== Object.keys(assets).length || [...required].some(path => !Object.hasOwn(assets, path))) throw new Error('Dependência ausente ou não referenciada');
}

export function createPackage(projectText, assets = {}, deserialize) {
  const files = Object.create(null);
  files['project.vfx-project.json'] = new TextEncoder().encode(projectText);
  for (const [path, data] of Object.entries(assets)) {
    if (!path.startsWith('assets/') || !safePath(path) || !(data instanceof Uint8Array)) throw new Error('Asset ou caminho inválido');
    files[path] = data.slice();
  }
  validateDependencies(projectText, assets, deserialize);
  const entries = Object.entries(files);
  if (entries.length > 257 || entries.some(([, data]) => data.length > FILE_LIMIT) || entries.reduce((sum, [, data]) => sum + data.length, 0) > LIMIT) throw new Error('Limite de pacote excedido');
  const manifest = {schema: 'arenamon.vfx-package', schemaVersion: 1, files: entries.map(([path, data]) => ({path, size: data.length, sha256: hash(data)}))};
  files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
  return zipSync(files, {level: 0, mtime: new Date('2000-01-01T00:00:00Z')});
}

export function openPackage(bytes, deserialize) {
  if (!(bytes instanceof Uint8Array) || bytes.length > LIMIT + 1024 * 1024) throw new Error('Pacote excede limite');
  const names = new Set(); let total = 0;
  const files = unzipSync(bytes, {filter: entry => {
    const canonical = entry.name.toLowerCase();
    if (!safePath(entry.name) || names.has(canonical)) throw new Error('Caminho inseguro ou duplicado');
    names.add(canonical); total += entry.originalSize;
    if (names.size > 258 || entry.originalSize > FILE_LIMIT || total > LIMIT) throw new Error('Limite de descompactação excedido');
    // F0 aceita somente ZIP armazenado: tamanho pode ser conferido sem expansão.
    if (entry.compression !== 0 || entry.size !== entry.originalSize) throw new Error('Compressão não suportada no contrato F0');
    return true;
  }});
  const decode = data => new TextDecoder('utf-8', {fatal: true}).decode(data);
  if (!files['manifest.json']) throw new Error('Manifesto ausente');
  const manifest = JSON.parse(decode(files['manifest.json']));
  if (manifest?.schema !== 'arenamon.vfx-package' || manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || manifest.files.length > 257) throw new Error('Manifesto inválido');
  const declared = new Set();
  for (const entry of manifest.files) {
    if (!entry || !safePath(entry.path) || entry.path === 'manifest.json' || declared.has(entry.path)) throw new Error('Manifesto com caminho inválido');
    const data = files[entry.path];
    if (!data || entry.size !== data.length || entry.sha256 !== hash(data)) throw new Error('Hash ou tamanho divergente');
    declared.add(entry.path);
  }
  if (Object.keys(files).length !== declared.size + 1 || !declared.has('project.vfx-project.json')) throw new Error('Dependência ausente ou não declarada');
  const assets = Object.create(null);
  for (const name of declared) {
    if (name === 'project.vfx-project.json') continue;
    if (!name.startsWith('assets/')) throw new Error('Recurso fora de assets');
    assets[name] = files[name];
  }
  const projectText = decode(files['project.vfx-project.json']);
  validateDependencies(projectText, assets, deserialize);
  return {projectText, assets};
}
