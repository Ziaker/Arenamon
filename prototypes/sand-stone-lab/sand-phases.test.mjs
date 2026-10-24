// Sand Wave com as seis fases desligáveis (Tarefa 3 do plano docs/plans/2026-10-24-vfx-por-fase-atelier.md).
// O golden (golden/sand-padrao.json) foi gravado do SandEffect ANTES da mudança: com os valores padrão o visual não pode mudar.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {Particles} from './src/particles.js';
import {SandEffect} from './src/effects.js';
import {defaults} from './src/config.ts';

const golden = JSON.parse(await readFile(new URL('golden/sand-padrao.json', import.meta.url), 'utf8'));
const scene = new T.Scene(), stage = new T.Group();scene.add(stage);
function make(variant, over = {}) {
  const particles = new Particles(scene, {textures: false});
  let created = 0;const create = particles.create.bind(particles);particles.create = o => {created++;return create(o);};
  const fx = new SandEffect(stage, particles, variant, {...defaults.sand, ...over});
  return {fx, particles, created: () => created};
}
function run(h, to) {let t = h.t ?? 0;while (t + 1 / 60 <= to + 1e-9) {t += 1 / 60;h.fx.update(t, 1 / 60);h.particles.update(1 / 60);}h.fx.update(to, 0);h.t = to;}
const row = fx => ({z: fx.fronts.map(f => f.head.position.z.toFixed(4)).join(','), vis: fx.fronts.map(f => f.head.visible ? 1 : 0).join(''), sy: +fx.fronts[0].head.scale.y.toFixed(4), fade: +fx.fronts[0].surface.material.uniforms.fade.value.toFixed(4), warn: +fx.warning.material.opacity.toFixed(4), shocks: fx.shocks.map(s => s.visible ? 1 : 0).join(''), punch: +fx.punch.toFixed(4), phase: fx.phase});

// (e) valores padrão: nada muda no visual
for (let v = 0; v < 3; v++) {
  const h = make(v);assert.equal(h.fx.duration, golden[v].duration, `duração v${v}`);
  for (const g of golden[v].rows) {const {t, ...want} = g;run(h, t);assert.deepEqual(row(h.fx), want, `v${v} em t=${t}`);}
}

for (let v = 0; v < 3; v++) {
  // janelas por fase, no tempo do efeito
  const h = make(v), tl = h.fx.timeline();
  assert.deepEqual(tl.map(s => s.id), ['start', 'body', 'finish', 'impact'], 'sustain de duração zero não entra; a cauda de contato fecha a linha');
  assert.deepEqual([tl[0].from, tl[0].to, tl[1].to], [0, .25, 1]);
  const withHold = make(v, {holdTime: .4}).fx.timeline();
  assert.deepEqual(withHold.map(s => s.id), ['start', 'body', 'sustain', 'finish', 'impact']);
  assert.ok(Math.abs(withHold[2].to - withHold[2].from - .4) < 1e-9);

  // tempos dos sliders mandam no efeito
  const slow = make(v, {startTime: .5, flightTime: 1.5});assert.equal(slow.fx.cast, .5);assert.equal(slow.fx.travel, 1.5);

  // (a) surgimento desligado: a sinalização não aparece
  const a = make(v, {startOn: 0});run(a, .1);assert.equal(a.fx.warning.material.opacity, 0);

  // (b) corpo desligado: nenhuma frente, nenhuma corrente de partículas
  const b = make(v, {bodyOn: 0});run(b, .6);assert.ok(b.fx.fronts.every(f => !f.head.visible), 'frentes ocultas');assert.equal(b.fx.streams.length, 0);

  // (c) contato desligado: sem choque, sem tremor, sem partículas de impacto
  const on = make(v), off = make(v, {impactOn: 0});run(on, .9);run(off, .9);const c0 = on.created(), c1 = off.created();run(on, 1.1);run(off, 1.1);
  assert.ok(on.created() > c0, 'com contato ligado nascem partículas de impacto');
  assert.equal(off.created(), c1, 'com contato desligado não nasce nenhuma');
  assert.ok(off.fx.shocks.every(s => !s.visible));assert.equal(off.fx.punch, 0);

  // (d) finalização desligada: a frente some ao chegar, sem o desvanecer
  const fadeOn = make(v), fadeOff = make(v, {finishOn: 0});run(fadeOn, 1.1);run(fadeOff, 1.1);
  assert.ok(fadeOn.fx.fronts[0].head.visible, 'com finalização a frente ainda desvanece');
  assert.ok(!fadeOff.fx.fronts[0].head.visible, 'sem finalização a frente some ao chegar');

  // permanência: a frente fica inteira durante holdTime
  const hold = make(v, {holdTime: .4});run(hold, 1.2);assert.equal(hold.fx.fronts[0].surface.material.uniforms.fade.value, v === 1 ? 1 : 1, 'inteira durante a permanência');
}
console.log('PASS: Sand Wave com fases desligáveis');
