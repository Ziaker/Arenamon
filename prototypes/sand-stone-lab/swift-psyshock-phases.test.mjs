// Swift (Burst, SEM carga) e Psyshock (única com carga) com as seis fases desligáveis (Tarefa 9 do plano de 24/10).
// O golden (golden/swift-psyshock-padrao.json) foi gravado ANTES da mudança: com os valores padrão nada muda.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {Particles} from './src/particles.js';
import {SwiftEffect, PsyshockEffect} from './src/new-effects.ts';
import {defaults} from './src/config.ts';

const golden = JSON.parse(await readFile(new URL('golden/swift-psyshock-padrao.json', import.meta.url), 'utf8'));
const scene = new T.Scene(), stage = new T.Group();scene.add(stage);
function make(kind, v, over = {}) {
  const particles = new Particles(scene, {textures: false});
  let created = 0;const create = particles.create.bind(particles);particles.create = o => {created++;return create(o);};
  const p = {...defaults[kind], ...over};
  const fx = kind === 'swift' ? new SwiftEffect(stage, particles, v, p) : new PsyshockEffect(stage, particles, v, p, 5);
  return {fx, particles, p, created: () => created, cast: kind === 'swift' ? .42 : 1.15, arrival: kind === 'swift' ? 1.37 : 2.0, obj: () => fx.stars?.[0] ?? fx.stones[0]};
}
function run(h, to) {let t = h.t ?? 0;while (t + 1 / 60 <= to + 1e-9) {t += 1 / 60;h.fx.update(t, 1 / 60);h.particles.update(1 / 60);}h.fx.update(to, 0);h.t = to;}
const r4 = v => +v.toFixed(4) || 0;
const row = (h, t) => {const o = h.obj();return {t: +t.toFixed(6), v: o.visible ? 1 : 0, z: r4(o.position.z), s: r4(o.scale.x), punch: r4(h.fx.punch), phase: h.fx.phase};};

for (const kind of ['swift', 'psyshock']) for (let v = 0; v < 3; v++) {
  const h = make(kind, v), g = golden[kind + v];assert.equal(+h.fx.duration.toFixed(6), g.duration, `${kind}${v}: duração`);
  for (const r of g.rows) {run(h, r.t);assert.deepEqual(row(h, r.t), r, `${kind}${v} em t=${r.t}`);}
}
for (const kind of ['swift', 'psyshock']) for (let v = 0; v < 3; v++) {
  const base = make(kind, v), tl = base.fx.timeline();
  assert.deepEqual(tl.map(s => s.id), ['start', 'body', 'finish', 'impact'], `${kind}${v}: janelas`);
  assert.ok(Math.abs(tl.at(-1).to - base.fx.duration) < 1e-9);assert.ok(Math.abs(tl[0].to - base.cast) < 1e-9, 'surgimento/carga termina em ' + base.cast);

  // tempos dos sliders mandam no efeito
  const slow = make(kind, v, {startTime: base.cast + .3, flightTime: 1.5});
  assert.ok(Math.abs(slow.fx.timeline()[0].to - (base.cast + .3)) < 1e-9);assert.ok(Math.abs(slow.fx.timeline()[1].to - (base.cast + .3 + 1.5)) < 1e-9);

  // (b) corpo desligado: nada voa
  const b = make(kind, v, {bodyOn: 0});run(b, (b.cast + b.arrival) / 2);assert.equal(b.obj().visible, false);
  // (c) contato desligado: sem partículas de impacto, sem grupo de impacto, sem tremor
  const on = make(kind, v), off = make(kind, v, {impactOn: 0});run(on, on.arrival - .01);run(off, off.arrival - .01);const c0 = on.created(), c1 = off.created();run(on, on.arrival + .1);run(off, off.arrival + .1);
  assert.ok(on.created() > c0, 'o impacto cria partículas');assert.equal(off.created(), c1);assert.equal(off.fx.punch, 0);
  assert.ok(kind === 'swift' ? !off.fx.impact.visible : off.fx.impacts.every(g => !g.visible));
  // (e) finalização desligada: o corpo some ao chegar, sem encolher/desvanecer
  const f0 = make(kind, v, {finishOn: 0});run(f0, f0.arrival + .02);assert.equal(f0.obj().visible, false);
  const f1 = make(kind, v);run(f1, f1.arrival + .02);assert.equal(f1.obj().visible, true, 'com finalização ainda está visível');
  // (d) disparo escolhido: argola na origem
  const s = make(kind, v, {shotKind: 1});run(s, s.cast + .05);assert.ok(stage.getObjectByName('shot-ring'), 'argola do disparo');
}
// Swift é Burst: NÃO tem carga. Psyshock é o único com carga (rótulo da fase).
assert.match(make('psyshock', 0).p.startTime >= 1 ? 'carga' : 'sem', /carga/);
assert.ok(defaults.swift.startTime < 1, 'o surgimento do Swift é curto (não é carga)');
console.log('PASS: Swift e Psyshock com fases desligáveis');
