import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root = new URL('../', import.meta.url);
await mkdir(new URL('validation/', root), {recursive: true});
await build({entryPoints: [fileURLToPath(new URL('src/app/quarks-particle-preview.ts', root))], bundle: true, platform: 'node', format: 'esm', outfile: fileURLToPath(new URL('validation/f3-quarks-adapter.mjs', root))});
const {QuarksParticlePreview} = await import(new URL('validation/f3-quarks-adapter.mjs', root));
const THREE = await import('three');
const apiBuild = fileURLToPath(new URL('validation/f3-quarks-api.mjs', root));
await build({entryPoints: [fileURLToPath(new URL('src/index.ts', root))], bundle: true, platform: 'node', format: 'esm', outfile: apiBuild});
const api = await import(new URL('validation/f3-quarks-api.mjs', root));

const scene = new THREE.Scene();
const baselineChildren = scene.children.length;
const preview = new QuarksParticlePreview(scene);
const emitter = api.defaultEmitter('adaptador-real', 'Adaptador real');

let report = preview.update([emitter], 0.25, {profile: 'high'});
assert.equal(report.backend, 'quarks');
assert.equal(report.systems, 1);
assert.equal(report.drawCalls, 1);
assert.equal(report.rebuilds, 1);
assert.equal(report.approximations.includes('turbulence'), true);
assert.equal(scene.children.length, baselineChildren + 1, 'adaptador deve possuir um único grupo de cena');

report = preview.update([emitter], 0.5, {profile: 'high'});
assert.equal(report.rebuilds, 1, 'avanço normal não deve recriar o sistema');
report = preview.update([emitter], 0.1, {profile: 'high'});
assert.equal(report.rebuilds, 2, 'rewind deve reconstruir o sistema');
report = preview.update([], 0.1, {profile: 'high'});
assert.equal(report.systems, 0, 'remoção deve liberar o sistema imediatamente');

preview.dispose();
assert.equal(scene.children.length, baselineChildren, 'dispose deve remover todo recurso de cena pertencente ao adaptador');
assert.deepEqual(preview.report, {backend: 'quarks', systems: 0, active: 0, drawCalls: 0, rebuilds: 0, approximations: []});
console.log('F3.2 Quarks adapter lifecycle: OK');

