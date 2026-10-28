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

const periodic = {...emitter, id: 'burst-periodico', emission: {mode: 'burst', count: 2, rate: 1, interval: 0.1, duration: 0.3}, lifetime: {min: 1, max: 1}, maxParticles: 20};
report = preview.update([periodic], 0.25, {profile: 'high'});
assert.equal(report.active >= 6, true, `bursts em 0, 0.1 e 0.2 devem estar vivos; recebido ${report.active}`);

const capped = {...emitter, id: 'teto-real', emission: {mode: 'continuous', count: 1, rate: 400, interval: 0.1, duration: 5}, lifetime: {min: 5, max: 5}, maxParticles: 40};
report = preview.update([capped], 2, {profile: 'high'});
assert.equal(report.active <= 40, true, `Quarks ultrapassou maxParticles: ${report.active}`);

const depth = {...emitter, id: 'depth-real', look: {...emitter.look, depthWrite: true}};
preview.update([depth], 0.1, {profile: 'high'});
const batchMaterial = preview.group.children.find(child => child.type === 'BatchedRenderer').batches.find(batch => batch.systems.size > 0).material;
assert.equal(batchMaterial.depthWrite, true, 'depthWrite precisa chegar ao ShaderMaterial do batch');

const narrow = {...emitter, id: 'spread-real', shape: {...emitter.shape, kind: 'point'}, velocity: {...emitter.velocity, spread: 20}};
preview.update([narrow], 0.1, {profile: 'high'});
const particleEmitter = preview.group.children.find(child => child.type === 'ParticleEmitter');
assert.equal(particleEmitter.system.emitterShape.angle > 0, true, 'abertura precisa chegar à forma real do Quarks');

report = preview.update([{...emitter, lifetime: {min: 2, max: 1}}], 0.1, {profile: 'high'});
assert.equal(report.rejected, 1, 'draft inválido deve ser reportado sem lançar nem parar o preview');
assert.equal(report.systems, 0);

report = preview.update([emitter], 60, {profile: 'high'});
assert.equal(report.lastAdvanceSteps <= 120, true, `scrub longo executou ${report.lastAdvanceSteps} passos síncronos`);

const rebuildsBeforeAdvance = preview.update([emitter], 0.25, {profile: 'high'}).rebuilds;
report = preview.update([emitter], 0.5, {profile: 'high'});
assert.equal(report.rebuilds, rebuildsBeforeAdvance, 'avanço normal não deve recriar o sistema');
report = preview.update([emitter], 0.1, {profile: 'high'});
assert.equal(report.rebuilds, rebuildsBeforeAdvance + 1, 'rewind deve reconstruir o sistema');
report = preview.update([], 0.1, {profile: 'high'});
assert.equal(report.systems, 0, 'remoção deve liberar o sistema imediatamente');

preview.dispose();
assert.equal(scene.children.length, baselineChildren, 'dispose deve remover todo recurso de cena pertencente ao adaptador');
assert.deepEqual(preview.report, {backend: 'quarks', systems: 0, active: 0, drawCalls: 0, rebuilds: 0, rejected: 0, lastAdvanceSteps: 0, approximations: []});
console.log('F3.2 Quarks adapter lifecycle: OK');

