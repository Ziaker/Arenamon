// @ts-check
// Fase 2 (integração open source): testes do adaptador three.quarks.
// Verifica em Node (sem WebGL): conversão dos presets declarativos em parâmetros
// da biblioteca, round-trip de serialização, runtime da camada QuarksFx
// (explosão, carga contínua com intensidade crescente, encerramento, reduceMotion,
// reset/dispose sem vazamento) e respeito ao toggle desligado.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as Quarks from 'three.quarks';
import {QUARKS_PRESETS, QUARKS_PRESET_ORDER, defaultQuarksPresets} from '../src/view/quarks/presets.js';
import {presetToSystemParams, buildShape, buildBehaviors, QuarksFx, createDefaultMaterial} from '../src/view/quarks/adapter.js';
import {QuarksBridge} from '../src/view/quarks/bridge.js';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {registerMove} from '../src/sim/moves.js';
import {registerEffect} from '../src/sim/move-effects.js';

registerStandardMoves();
registerEffect('quarks:teste-fx', () => ({ok: true}));
registerMove({id: 'quarks:teste-a', charge: {max: 2}, cost: 1, cooldown: 4, timeline: [{effect: 'quarks:teste-fx'}]});

let passed = 0, failed = 0;
function test(name, fn) {
  try {fn();passed++;console.log(`  ✓ ${name}`);}
  catch (err) {failed++;console.error(`  ✗ ${name}:`, err.message);}
}

console.log('\n--- FASE 2: ADAPTADOR THREE.QUARKS ---\n');

const material = () => new THREE.MeshBasicMaterial({transparent: true});

// ---------- Presets declarativos → parâmetros da biblioteca ----------

test('os 4 presets existem e são JSON puros', () => {
  assert.deepEqual(QUARKS_PRESET_ORDER, ['charge', 'impact', 'landing', 'footstool']);
  for (const name of QUARKS_PRESET_ORDER) {
    const preset = QUARKS_PRESETS[name];
    assert.ok(preset, `preset ${name}`);
    assert.doesNotThrow(() => JSON.stringify(preset), `preset ${name} serializável`);
  }
  // cópia profunda independente
  const copy = defaultQuarksPresets();
  copy.impact.burst.count = 999;
  assert.notEqual(copy.impact.burst.count, QUARKS_PRESETS.impact.burst.count);
});

test('charge: contínuo, em looping, emissor donut com órbita', () => {
  const params = presetToSystemParams(QUARKS_PRESETS.charge, {Quarks, THREE, material: material()});
  assert.equal(params.looping, true);
  assert.ok(params.emissionOverTime.genValue({data: [], dataCount: 0}) > 0, 'emissão contínua');
  assert.ok(params.shape instanceof Quarks.DonutEmitter, 'emissor donut');
  assert.ok(params.behaviors.some(b => b instanceof Quarks.OrbitOverLife), 'órbita');
  assert.ok(params.behaviors.some(b => b instanceof Quarks.ColorOverLife), 'gradiente de cor');
  assert.equal(params.worldSpace, false, 'órbita segue o lutador (espaço local)');
});

test('impact: explosão única com faíscas e dissipação', () => {
  const params = presetToSystemParams(QUARKS_PRESETS.impact, {Quarks, THREE, material: material()});
  assert.equal(params.looping, false);
  assert.equal(params.emissionBursts.length, 1);
  assert.ok(params.emissionBursts[0].count.genValue({data: [], dataCount: 0}) >= 20);
  assert.ok(params.behaviors.some(b => b instanceof Quarks.SpeedOverLife), 'curva de velocidade');
  assert.ok(params.behaviors.some(b => b instanceof Quarks.SizeOverLife), 'curva de tamanho');
  assert.ok(params.behaviors.some(b => b instanceof Quarks.ApplyForce), 'gravidade');
  assert.ok(params.worldSpace, 'origem fica no ponto do impacto');
});

test('landing: intensidade física entra via scale/power', () => {
  const base = presetToSystemParams(QUARKS_PRESETS.landing, {Quarks, THREE, material: material(), scale: 1});
  const big = presetToSystemParams(QUARKS_PRESETS.landing, {Quarks, THREE, material: material(), scale: 2});
  assert.ok(big.startSize.b > base.startSize.b, 'escala maior com impacto maior');
});

test('scale/countScale/emissionScale multiplicam os valores certos', () => {
  const params = presetToSystemParams(QUARKS_PRESETS.impact, {Quarks, THREE, material: material(), scale: 2, countScale: 3});
  assert.equal(params.emissionBursts[0].count.genValue({data: [], dataCount: 0}), QUARKS_PRESETS.impact.burst.count * 3);
  const charge = presetToSystemParams(QUARKS_PRESETS.charge, {Quarks, THREE, material: material(), emissionScale: .5});
  const gen = {data: [], dataCount: 0};
  assert.ok(Math.abs(charge.emissionOverTime.genValue(gen) - QUARKS_PRESETS.charge.emissionOverTime * .5) < 1e-6);
});

test('formas de emissor: point/sphere/cone/donut', () => {
  const mk = s => buildShape({shape: s}, Quarks);
  assert.ok(mk({type: 'point'}) instanceof Quarks.PointEmitter);
  assert.ok(mk({type: 'sphere', radius: 1}) instanceof Quarks.SphereEmitter);
  assert.ok(mk({type: 'cone', radius: 1, angle: 30}) instanceof Quarks.ConeEmitter);
  assert.ok(mk({type: 'donut', radius: 1}) instanceof Quarks.DonutEmitter);
});

test('preset desconhecido usa forma ponto e não quebra', () => {
  const params = presetToSystemParams({duration: 1, material: material()}, {Quarks, THREE, material: material()});
  assert.ok(params.shape instanceof Quarks.PointEmitter);
  assert.ok(Array.isArray(params.behaviors));
});

// ---------- Serialização (presets salvos/importados) ----------

test('round-trip: params → sistema → JSON → sistema restaura campos-chave', () => {
  const mat = material();
  const meta = {geometries: {}, materials: {[mat.uuid]: mat}};
  const params = presetToSystemParams(QUARKS_PRESETS.impact, {Quarks, THREE, material: mat});
  const system = new Quarks.ParticleSystem(params);
  const json = system.toJSON(meta);
  const text = JSON.stringify(json);
  assert.ok(text.length > 100, 'JSON não vazio');
  const restored = Quarks.ParticleSystem.fromJSON(JSON.parse(text), meta, {});
  assert.equal(restored.duration, system.duration);
  assert.equal(restored.looping, system.looping);
  assert.equal(restored.worldSpace, system.worldSpace);
  assert.equal(restored.behaviors.length, system.behaviors.length, 'behaviors restaurados');
});

// ---------- Runtime QuarksFx (headless: three funciona sem WebGL até o render) ----------

function makeFx(accessibility = null) {
  const scene = new THREE.Scene();
  const fx = new QuarksFx({THREE, Quarks, scene, accessibility, presets: defaultQuarksPresets()});
  return {fx, scene};
}
const step = (fx, n, dt = 1 / 60) => {for (let i = 0; i < n; i++) fx.update(dt);};

test('emitBurst cria explosão que nasce e morre sozinha', () => {
  const {fx} = makeFx();
  fx.emitBurst('impact', {x: 1, y: 1, z: 0});
  assert.equal(fx.bursts.length, 1);
  step(fx, 10);
  assert.equal(fx.stats.emitted, 1);
  step(fx, 120); // 2 s > ttl
  assert.equal(fx.bursts.length, 0, 'explosões coletadas');
});

test('attach contínuo: intensidade crescente e encerramento controlado', () => {
  const {fx} = makeFx();
  const anchor = new THREE.Object3D();
  assert.equal(fx.attach('charge', anchor), true);
  const entry = fx.continuous.get('charge');
  assert.ok(entry, 'carga anexada');
  const gen = {data: [], dataCount: 0};
  const eFull = entry.system.emissionOverTime.genValue(gen);
  fx.setIntensity('charge', 0); // zera
  const e0 = entry.system.emissionOverTime.genValue(gen);
  fx.setIntensity('charge', 1); // máximo
  const e1 = entry.system.emissionOverTime.genValue(gen);
  assert.equal(e0, 0, 'intensidade zera');
  assert.ok(e1 > 0 && Math.abs(e1 - eFull) < 1e-6, 'intensidade cresce de volta ao máximo');
  assert.equal(fx.detach('charge'), true);
  assert.equal(fx.continuous.size, 0, 'encerramento remove da lista ativa');
  step(fx, 120);
  assert.equal(fx.bursts.length, 0, 'resto da carga dissipou sem vazamento');
  assert.equal(anchor.children.length, 0, 'emitter saiu do ancorador');
});

test('attach recusa preset não contínuo', () => {
  const {fx} = makeFx();
  assert.equal(fx.attach('impact', new THREE.Object3D()), false);
});

test('reduceMotion reduz a quantidade emitida', () => {
  const full = makeFx();
  const reduced = makeFx({reduceMotion: true});
  const pFull = presetToSystemParams(full.fx.presets.impact, {Quarks, THREE, material: material()});
  // _motionFactor é interno; validamos pelo comportamento de emitBurst com contagem
  const s1 = full.fx.emitBurst('impact', {x: 0, y: 0, z: 0});
  const s2 = reduced.fx.emitBurst('impact', {x: 0, y: 0, z: 0});
  assert.ok(s1 && s2, 'ambos emitem');
  const c1 = s1.emissionBursts[0].count.genValue({data: [], dataCount: 0});
  const c2 = s2.emissionBursts[0].count.genValue({data: [], dataCount: 0});
  assert.ok(c2 < c1, `reduceMotion reduz contagem (${c2} < ${c1})`);
});

test('reset e dispose limpam tudo', () => {
  const {fx, scene} = makeFx();
  fx.emitBurst('impact', {x: 0, y: 0, z: 0});
  fx.emitBurst('landing', {x: 1, y: 0, z: 1});
  fx.attach('charge', new THREE.Object3D());
  fx.reset();
  assert.equal(fx.bursts.length, 0);
  assert.equal(fx.continuous.size, 0);
  assert.equal(fx.stats.active, 0);
  const rendererInScene = scene.children.includes(fx.renderer);
  fx.dispose();
  assert.notEqual(scene.children.includes(fx.renderer), rendererInScene, 'renderer removido da cena');
});

test('toggle desligado congela a camada (custo zero de update)', () => {
  const {fx} = makeFx();
  fx.enabled = false;
  const before = fx.stats.emitted;
  fx.emitBurst('impact', {x: 0, y: 0, z: 0}); // criação ainda ocorre; update é que não roda
  let ran = false;
  const origUpdate = fx.renderer.update.bind(fx.renderer);
  fx.renderer.update = dt => {ran = true;origUpdate(dt);};
  step(fx, 5);
  assert.equal(ran, false, 'BatchedRenderer.update não chamado desligado');
  assert.equal(fx.stats.emitted, before + 1);
  fx.enabled = true;
  step(fx, 5);
  assert.equal(ran, true, 'BatchedRenderer.update volta ligado');
});

test('presets padrão carregam no QuarksFx sem erro', () => {
  const scene = new THREE.Scene();
  const fx = new QuarksFx({THREE, Quarks, scene});
  for (const name of QUARKS_PRESET_ORDER) fx.emitBurst(name, {x: 0, y: 0, z: 0});
  step(fx, 3);
  assert.equal(fx.stats.emitted, QUARKS_PRESET_ORDER.length);
  fx.dispose();
});

test('createDefaultMaterial funciona sem DOM (Node)', () => {
  const m = createDefaultMaterial(THREE);
  assert.ok(m.transparent && m.isMaterial);
  assert.equal(m.blending, THREE.AdditiveBlending);
});

// ---------- Ponte: eventos REAIS da simulação → explosões ----------

const cmd = o => ({...emptyCommand(), ...o});
function bridgeSim(seed = 7) {
  resetConfig(defaults());
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed});
  g.start();
  const bridge = new QuarksBridge({THREE, Quarks, scene: new THREE.Scene()});
  const counts = {};
  const orig = bridge.fx.emitBurst.bind(bridge.fx);
  bridge.fx.emitBurst = (name, pos, opts) => {counts[name] = (counts[name] ?? 0) + 1;return orig(name, pos, opts);};
  const drive = (steps, cA = cmd(), cB = cmd()) => {
    for (let i = 0; i < steps; i++) {g.step(cA, cB);bridge.update(g.fighters, g.lastStepEvents, C.test.step);}
  };
  return {g, bridge, counts, drive};
}

test('evento real: impacto de tackle dispara explosão B no alvo', () => {
  const {g, bridge, counts, drive} = bridgeSim(5);
  const a = g.fighters[0], d = g.fighters[1];
  a.position = {x: 0, z: -2.2};a.velocity = vec();a.facing = 0;
  d.position = {x: 0, z: 0};d.velocity = vec();d.facing = Math.PI;
  g.step(cmd({tackle: true, tackleHeld: true, move: vec(0, 1)}), cmd());
  bridge.update(g.fighters, g.lastStepEvents, C.test.step);
  drive(120, cmd({move: vec(0, 1)}));
  assert.ok((counts.impact ?? 0) > 0, `impacto real gerou explosão (contagem: ${JSON.stringify(counts)})`);
  bridge.dispose();
});

test('evento real: footstool dispara efeito separado e o pouso gera poeira', () => {
  const {g, bridge, counts, drive} = bridgeSim(21);
  const a = g.fighters[0], d = g.fighters[1];
  a.position = {x: 0, z: -0.3};a.velocity = vec();a.groundY = 0;
  d.position = {x: 0, z: 0};d.velocity = vec();d.groundY = 0;
  a.flight = {y: 2.2, vy: -3, horizontal: vec(), isNormalJump: true, jumpFeel: true, jumpHeld: false};
  drive(300);
  assert.ok((counts.footstool ?? 0) > 0, `footstool real disparou o efeito separado (${JSON.stringify(counts)})`);
  assert.ok((counts.landing ?? 0) > 0, `pouso após o footstool gerou poeira proporcional (${JSON.stringify(counts)})`);
  bridge.dispose();
});

test('evento real: carga contínua com intensidade e encerramento controlado', () => {
  const {g, bridge, counts, drive} = bridgeSim(3);
  g.setLoadout(0, ['quarks:teste-a']);
  const a = g.fighters[0], d = g.fighters[1];
  a.position = {x: 0, z: -4};a.velocity = vec();a.facing = 0;
  d.position = {x: 0, z: 4};d.velocity = vec();d.facing = Math.PI;
  const H0 = [true, false, false, false];
  drive(1, cmd({skill: 0, skillHeld: H0}));
  drive(40, cmd({skillHeld: H0}));
  assert.ok(bridge.fx.continuous.has('charge#0'), 'efeito A anexado durante a carga real');
  const entry = bridge.fx.continuous.get('charge#0');
  const gen = {data: [], dataCount: 0};
  assert.ok(entry.system.emissionOverTime.genValue(gen) > 0, 'intensidade crescente > 0');
  drive(60, cmd({skillHeld: H0}));
  const later = entry.system.emissionOverTime.genValue(gen);
  drive(1, cmd()); // soltou
  assert.ok(!bridge.fx.continuous.has('charge#0'), 'encerramento controlado removeu a carga');
  assert.ok((counts.charge ?? 0) > 0, `rajada final da carga disparou (${JSON.stringify(counts)})`);
  assert.ok(later > 0);
  bridge.dispose();
});

console.log(`\n${passed} passaram, ${failed} falharam\n`);
process.exit(failed ? 1 : 0);
