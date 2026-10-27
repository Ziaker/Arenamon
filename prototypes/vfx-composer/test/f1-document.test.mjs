import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root = new URL('../', import.meta.url);
const validation = new URL('validation/', root);
await mkdir(validation, {recursive: true});
await build({entryPoints: [fileURLToPath(new URL('src/index.ts', root))], bundle: true, platform: 'node', format: 'esm', outfile: fileURLToPath(new URL('f1.mjs', validation))});
const api = await import(new URL('f1.mjs', validation));
const fixture = () => JSON.parse(readFileSync(new URL('fixtures/canonical-project.json', import.meta.url), 'utf8'));

assert.equal(typeof api.DocumentStore, 'function');

const store = new api.DocumentStore(fixture(), 8);
store.addNode({
  id: 'cube-1', kind: 'mesh', parentId: null, assetIds: [],
  transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
  geometry: {kind: 'box', size: [1, 1, 1]},
});
assert.equal(store.project.nodes.length, 1);
assert.equal(store.selectedId, 'cube-1');
assert.equal(api.validateProject(store.project).ok, true);

store.transaction('Mover cubo', () => {
  store.setTransform('cube-1', {position: [2, 3, 4]});
  store.setTransform('cube-1', {rotation: [0, Math.PI / 2, 0]});
});
assert.deepEqual(store.project.nodes[0].transform.position, [2, 3, 4]);
assert.equal(store.undo(), true);
assert.deepEqual(store.project.nodes[0].transform.position, [0, 0, 0]);
assert.deepEqual(store.project.nodes[0].transform.rotation, [0, 0, 0]);
assert.equal(store.redo(), true);
assert.deepEqual(store.project.nodes[0].transform.position, [2, 3, 4]);

store.setTransform('cube-1', {scale: [2, 2, 2]});
assert.equal(store.redo(), false, 'nova edição invalida redo');
assert.throws(() => store.setTransform('cube-1', {position: [NaN, 0, 0]}), /finito/i);
assert.deepEqual(store.project.nodes[0].transform.position, [2, 3, 4]);

store.removeNode('cube-1');
assert.equal(store.project.nodes.length, 0);
assert.equal(store.selectedId, null);
assert.equal(store.undo(), true);
assert.equal(store.project.nodes[0].id, 'cube-1');

const cleanStore = new api.DocumentStore(fixture());
assert.throws(() => cleanStore.transaction('Falha', () => cleanStore.setTransform('ausente', {position: [1, 2, 3]})), /ausente/i);
assert.equal(cleanStore.undo(), false, 'transação revertida não pode criar passo de Undo vazio');
const importedProject = fixture(); importedProject.projectId = 'imported-project'; importedProject.effectId = 'imported-effect';
cleanStore.replaceProject(importedProject);
assert.equal(cleanStore.project.effectId, 'imported-effect');
assert.equal(cleanStore.selectedId, null);
assert.equal(cleanStore.undo(), true);
assert.notEqual(cleanStore.project.effectId, 'imported-effect');
assert.throws(() => cleanStore.replaceProject({schemaVersion: 99}), /inválido/i);

console.log('✓ F1 DocumentStore: validade, seleção, importação, transação, undo/redo e rejeição de NaN.');

assert.equal(typeof api.AutosaveManager, 'function');
const memory = new Map();
const storage = {getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value)};
const autosave = new api.AutosaveManager(storage, 'project-water-pulse');
const first = fixture();
assert.equal(autosave.save(first).status, 'saved');
assert.equal(autosave.save(first).status, 'skipped');
const second = fixture(); second.revision = 2; second.effectId = 'water-pulse.edited';
assert.equal(autosave.save(second).status, 'saved');
assert.equal(autosave.load().project.effectId, 'water-pulse.edited');
memory.set('arenamon.vfx.project-water-pulse', '{corrompido');
const recovered = autosave.load();
assert.equal(recovered.recovered, true);
assert.equal(recovered.project.revision, 1);
const afterRecovery = recovered.project; afterRecovery.revision = 2; afterRecovery.effectId = 'water-pulse.recovered-edit';
assert.equal(autosave.save(afterRecovery).status, 'saved', 'edição após recuperar backup deve substituir o slot corrompido');
assert.equal(autosave.load().project.effectId, 'water-pulse.recovered-edit');

assert.equal(typeof api.saveProjectFile, 'function');
const fileCalls = [];
const adapters = {
  writeFile: async (name, text) => fileCalls.push(['file', name, text]),
  download: (name, text) => fileCalls.push(['download', name, text]),
};
assert.equal(await api.saveProjectFile(second, adapters), 'download');
assert.equal(fileCalls.at(-1)[0], 'download');
assert.equal(await api.saveProjectFile(second, adapters, {useFileSystem: true}), 'file-system');
assert.equal(fileCalls.at(-1)[0], 'file');
assert.equal(api.openProjectText(fileCalls.at(-1)[2]).effectId, 'water-pulse.edited');
assert.throws(() => api.openProjectText('{"schemaVersion":99}'), /incompatível/i);

console.log('✓ F1 persistência: autosave por revisão, backup após corrupção e fallback explícito de arquivo.');

assert.equal(typeof api.createPathGeometry, 'function');
const stroke = api.createPathGeometry('stroke', [[0, 0, 0], [.26, .49, 0], [1, 1, 0]], {width: .08, snap: .25});
assert.deepEqual(stroke.points, [[0, 0, 0], [.25, .5, 0], [1, 1, 0]]);
assert.equal(stroke.width, .08);
const ribbon = api.createPathGeometry('ribbon', [[0, 0, 0], [0, 1, 0], [1, 1, 0]], {width: .4, extrusion: .12, closed: true});
assert.equal(ribbon.closed, true);
assert.equal(ribbon.extrusion, .12);
assert.throws(() => api.createPathGeometry('stroke', [[0, 0, 0], [0, 0, 0]], {width: .1}), /degenerada/i);
assert.throws(() => api.createPathGeometry('curve', [[0, 0, 0], [NaN, 1, 0]], {width: .1}), /finito/i);
assert.throws(() => api.createPathGeometry('ribbon', Array.from({length: 4097}, (_, i) => [i, 0, 0]), {width: .1}), /limite/i);

const pathStore = new api.DocumentStore(fixture());
pathStore.addNode({id: 'curve-1', kind: 'stroke', parentId: null, assetIds: [], geometry: stroke});
pathStore.setPathPoint('curve-1', 1, [.74, .26, .1], .25);
assert.deepEqual(pathStore.project.nodes[0].geometry.points[1], [.75, .25, 0]);
assert.equal(pathStore.undo(), true);
assert.deepEqual(pathStore.project.nodes[0].geometry.points[1], [.25, .5, 0]);
assert.throws(() => pathStore.setPathPoint('curve-1', 8, [0, 0, 0], .25), /índice/i);
assert.throws(() => pathStore.setPathPoint('curve-1', 1, [NaN, 0, 0], .25), /finito/i);
pathStore.insertPathPoint('curve-1', 1, [1.24, .74, 0], .25);
assert.deepEqual(pathStore.project.nodes[0].geometry.points, [[0, 0, 0], [.25, .5, 0], [1.25, .75, 0], [1, 1, 0]]);
pathStore.removePathPoint('curve-1', 2);
assert.deepEqual(pathStore.project.nodes[0].geometry.points, [[0, 0, 0], [.25, .5, 0], [1, 1, 0]]);
assert.equal(pathStore.undo(), true);
assert.equal(pathStore.project.nodes[0].geometry.points.length, 4);
assert.throws(() => pathStore.insertPathPoint('curve-1', 9, [2, 2, 0], .25), /índice/i);
const twoPointStore = new api.DocumentStore(fixture());
twoPointStore.addNode({id: 'line-1', kind: 'stroke', parentId: null, assetIds: [], geometry: api.createPathGeometry('stroke', [[0, 0, 0], [1, 0, 0]], {width: .1})});
assert.throws(() => twoPointStore.removePathPoint('line-1', 0), /dois pontos/i);
pathStore.setPivot('curve-1', [.5, 0, -.5]);
assert.deepEqual(pathStore.project.nodes[0].pivot, [.5, 0, -.5]);
assert.equal(pathStore.undo(), true);
assert.equal(pathStore.project.nodes[0].pivot, undefined);
assert.throws(() => pathStore.setPivot('curve-1', [Infinity, 0, 0]), /finito/i);
const ribbonStore = new api.DocumentStore(fixture());
ribbonStore.addNode({id: 'ribbon-1', kind: 'stroke', parentId: null, assetIds: [], geometry: ribbon});
ribbonStore.setPathExtrusion('ribbon-1', .2);
assert.equal(ribbonStore.project.nodes[0].geometry.extrusion, .2);
assert.equal(ribbonStore.undo(), true);
assert.equal(ribbonStore.project.nodes[0].geometry.extrusion, .12);
assert.throws(() => ribbonStore.setPathExtrusion('ribbon-1', 0), /extrusão/i);
assert.throws(() => pathStore.setPathExtrusion('curve-1', .2), /ribbon/i);

console.log('✓ F1 geometria: caminhos finitos, snapping, vértices, pivô e extrusão de Ribbon com Undo e limites.');
