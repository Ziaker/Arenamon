import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root = new URL('../', import.meta.url);
await mkdir(new URL('validation/', root), {recursive: true});
await build({entryPoints: [fileURLToPath(new URL('src/index.ts', root))], bundle: true, platform: 'node', format: 'esm', outfile: fileURLToPath(new URL('validation/f3-quarks.mjs', root))});
const api = await import(new URL('validation/f3-quarks.mjs', root));

const emitter = api.defaultEmitter('quarks-contract', 'Contrato Quarks');
const recipe = api.toQuarksRecipe(emitter, {profile: 'high', reduceMotion: false, noFlash: false});
assert.equal(recipe.id, 'quarks-contract');
assert.deepEqual(recipe.emission, {mode: 'burst', count: 36, rate: 0, interval: 0.12, duration: 1.2});
assert.deepEqual(recipe.lifetime, [0.35, 0.7]);
assert.deepEqual(recipe.speed, [3, 6]);
assert.deepEqual(recipe.shape, {kind: 'sphere', radius: 0.12, angleRadians: 0});
assert.deepEqual(recipe.gravity, [0, -6, 0]);
assert.equal(recipe.drag, 1.2);
assert.deepEqual(recipe.look, {size: [0.09, 0.02], opacity: [1, 0], colors: ['#ffd166', '#ff5a3c'], blending: 'additive', depthWrite: false});
assert.equal(recipe.maxParticles, 320);

const shapeExpected = {
  point: {kind: 'point', radius: 0, angleRadians: 0},
  sphere: {kind: 'sphere', radius: 2, angleRadians: 0},
  ring: {kind: 'ring', radius: 2, angleRadians: 0},
  cone: {kind: 'cone', radius: 2, angleRadians: Math.PI / 3},
};
for (const [kind, expected] of Object.entries(shapeExpected)) {
  const shaped = {...emitter, shape: {kind, radius: 2, angle: 60}};
  assert.deepEqual(api.toQuarksRecipe(shaped).shape, expected, `${kind} deve mapear para forma Quarks segura`);
}

const continuous = {...emitter, emission: {...emitter.emission, mode: 'continuous', rate: 100}};
assert.deepEqual(api.toQuarksRecipe(continuous, {profile: 'medium'}).emission, {mode: 'continuous', count: 0, rate: 75, interval: 0.12, duration: 1.2});
assert.equal(api.toQuarksRecipe(emitter, {profile: 'low'}).emission.count, 16);
assert.equal(api.toQuarksRecipe(emitter, {profile: 'high', reduceMotion: true}).emission.count, 13);
assert.equal(api.toQuarksRecipe({...emitter, look: {...emitter.look, opacityStart: 1}}, {noFlash: true}).look.opacity[0], 0.85);
assert.equal(api.toQuarksRecipe({...emitter, forces: {...emitter.forces, turbulenceAmplitude: 2}}).approximations.includes('turbulence'), true);

assert.throws(() => api.toQuarksRecipe({...emitter, maxParticles: 0}), /Emissor Quarks inválido/);
assert.throws(() => api.toQuarksRecipe(null), /Emissor Quarks inválido/);
console.log('F3.2 Quarks contract: OK');

