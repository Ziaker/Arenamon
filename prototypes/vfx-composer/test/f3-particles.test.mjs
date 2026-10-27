import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root = new URL('../', import.meta.url);
await mkdir(new URL('validation/', root), {recursive: true});
await build({entryPoints: [fileURLToPath(new URL('src/index.ts', root))], bundle: true, platform: 'node', format: 'esm', outfile: fileURLToPath(new URL('validation/f3.mjs', root))});
const api = await import(new URL('validation/f3.mjs', root));
const fixture = () => JSON.parse(readFileSync(new URL('fixtures/canonical-project.json', import.meta.url), 'utf8'));
const base = () => api.defaultEmitter('emissor-teste', 'Teste');

// --- contrato -------------------------------------------------------------
assert.equal(api.validateParticleEmitter(base()).length, 0, 'emissor padrão precisa ser válido');
assert.equal(api.validateProject({...fixture(), particles: [base()]}).ok, true, 'projeto F2 aceita partículas opcionais');
assert.equal(api.validateProject(fixture()).ok, true, 'projeto antigo continua válido sem partículas');
assert.deepEqual(api.PARTICLE_LIMITS.emitters, 12);
assert.equal(api.PARTICLE_LIMITS.particlesPerEmitter, 1400);

const bad = (patch) => ({...base(), ...patch});
assert.equal(api.validateParticleEmitter(bad({lifetime: {min: 2, max: 1}})).length > 0, true, 'vida invertida é rejeitada');
assert.equal(api.validateParticleEmitter(bad({lifetime: {min: 0.2, max: Number.NaN}})).length > 0, true, 'NaN é rejeitado');
assert.equal(api.validateParticleEmitter(bad({shape: {kind: 'sphere', radius: -1, angle: 40}})).length > 0, true, 'raio negativo é rejeitado');
assert.equal(api.validateParticleEmitter(bad({look: {...base().look, colorStart: 'red'}})).length > 0, true, 'cor fora de #rrggbb é rejeitada');
assert.equal(api.validateParticleEmitter(bad({look: {...base().look, blending: 'glow'}})).length > 0, true, 'blending desconhecido é rejeitado');
assert.equal(api.validateParticleEmitter(bad({look: {...base().look, depthWrite: 'yes'}})).length > 0, true, 'depthWrite não booleano é rejeitado');
assert.equal(api.validateParticleEmitter(bad({maxParticles: 0})).length > 0, true, 'capacidade zero é rejeitada');
assert.equal(api.validateParticleEmitter(bad({velocity: {...base().velocity, spread: 361}})).length > 0, true, 'abertura acima de 360° é rejeitada');
assert.equal(api.validateParticleEmitter(bad({seed: -1})).length > 0, true, 'seed negativa é rejeitada');
assert.equal(api.validateParticleEmitter(bad({id: 'com espaço'})).length > 0, true, 'ID inválido é rejeitado');
assert.equal(api.validateParticleEmitters([base(), base()]).length > 0, true, 'IDs duplicados são rejeitados');
assert.equal(api.validateParticleEmitters(Array.from({length: 13}, (_, index) => api.defaultEmitter(`e-${index}`))).length > 0, true, 'limite de emissores é aplicado');
assert.equal(api.validateProject({...fixture(), particles: [{...base(), maxParticles: 1400}, {...base(), id: 'outro', maxParticles: 1}]}).ok, false, 'teto total de partículas é aplicado');
assert.equal(api.validateProject({...fixture(), particles: [null]}).ok, false);

// --- determinismo ---------------------------------------------------------
const emitter = base();
const first = api.simulateEmitter(emitter, 0.5);
const second = api.simulateEmitter(emitter, 0.5);
assert.equal(first.length > 0, true, 'o burst em t=0.5 precisa produzir partículas');
assert.deepEqual(first, second, 'mesmo seed + tempo = mesmas amostras');
api.simulateEmitter(emitter, 0.2);
assert.deepEqual(api.simulateEmitter(emitter, 0.5), first, 'amostrar outro tempo não contamina o estado');
assert.deepEqual(api.simulateEmitter(emitter, 0), api.simulateEmitter(emitter, 0), 'rewind para t=0 é determinístico');
assert.notDeepEqual(api.simulateEmitter({...emitter, seed: 7}, 0.5), first, 'seed diferente muda o resultado');
assert.equal(first.every(p => [p.x, p.y, p.z, p.size, p.opacity, p.r, p.g, p.b, p.age, p.life].every(Number.isFinite)), true, 'nenhuma amostra pode ter NaN/Infinity');
assert.equal(first.every(p => p.opacity >= 0 && p.opacity <= 1 && p.size > 0 && p.age >= 0 && p.age <= p.life), true, 'amostras respeitam os limites do contrato');
assert.equal(first.length <= emitter.maxParticles, true, 'capacidade máxima é respeitada');

// --- emissão --------------------------------------------------------------
const continuous = {...emitter, emission: {mode: 'continuous', count: 36, rate: 100, interval: 0.1, duration: 5}, lifetime: {min: 1, max: 1}, maxParticles: 400};
assert.equal(api.simulateEmitter(continuous, 0.25).length, 25, 'taxa contínua gera 25 partículas em 0,25 s');
assert.equal(api.simulateEmitter(continuous, 1).length, 100, 'taxa contínua gera 100 partículas em 1 s');
const windowed = {...emitter, emission: {mode: 'burst', count: 10, rate: 90, interval: 0.12, duration: 0.5}, lifetime: {min: 2, max: 2}, maxParticles: 400};
assert.equal(api.simulateEmitter(windowed, 1).length, 50, 'duração encerra novos nascimentos após 0,5 s');
const capped = {...continuous, maxParticles: 40};
assert.equal(api.simulateEmitter(capped, 1).length, 40, 'teto por emissor é respeitado');

// --- orçamento, perfis e acessibilidade -----------------------------------
const heavy = {...emitter, emission: {mode: 'continuous', count: 36, rate: 400, interval: 0.1, duration: 5}, lifetime: {min: 5, max: 5}, maxParticles: 1400};
const low = api.evaluateParticleBudget([heavy], 'low', {noFlash: false, reduceMotion: false});
const high = api.evaluateParticleBudget([heavy], 'high', {noFlash: false, reduceMotion: false});
assert.equal(high.cost.particles, 1400, 'perfil high usa o teto de 1400 partículas');
assert.equal(low.cost.particles < high.cost.particles, true, 'perfil low reduz o pico');
assert.equal(low.verdict.publishable, false, 'low bloqueia publicação acima de 400 partículas');
assert.deepEqual(low.verdict.over, ['particles']);
assert.equal(high.verdict.publishable, true, 'high aceita 1400 partículas');
assert.equal(high.cost.lights, 0, 'F3.1 não cria luzes');
assert.equal(high.cost.drawCalls, 1, 'um draw call por emissor');
const motion = api.evaluateParticleBudget([heavy], 'high', {noFlash: false, reduceMotion: true});
assert.equal(motion.cost.particles < high.cost.particles, true, 'reduce motion suprime partículas');
assert.equal(motion.suppressed > 0, true, 'supressão precisa ser reportada');
const flash = api.simulateEmitter({...emitter, look: {...emitter.look, opacityStart: 1, opacityEnd: 1}}, 0.5, {noFlash: true});
assert.equal(flash.every(p => p.opacity <= api.NO_FLASH_OPACITY_CAP + 1e-9), true, 'noFlash limita a opacidade');

// --- documento ------------------------------------------------------------
const project = {...fixture(), particles: [base()]};
const store = new api.DocumentStore(project);
assert.equal(store.project.particles.length, 1);
store.upsertEmitter({...base(), name: 'Renomeado', seed: 99});
assert.equal(store.project.particles[0].name, 'Renomeado');
assert.equal(store.undo(), true);
assert.equal(store.project.particles[0].name, 'Teste');
assert.equal(store.redo(), true);
assert.equal(store.project.particles[0].seed, 99);
store.setAccessibility({reduceMotion: true});
assert.equal(store.project.accessibility.reduceMotion, true);
assert.equal(api.validateProject(JSON.parse(JSON.stringify(store.project))).ok, true, 'roundtrip mantém o projeto válido');
store.removeEmitter('emissor-teste');
assert.deepEqual(store.project.particles, []);
assert.throws(() => store.upsertEmitter({...base(), lifetime: {min: 3, max: 1}}), /Edição inválida/);

console.log('✓ F3.1: contrato de partículas, determinismo, perfis, orçamento e acessibilidade.');
