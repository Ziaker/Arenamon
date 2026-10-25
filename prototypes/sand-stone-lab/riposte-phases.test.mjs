// Riposte com as seis fases desligáveis (Tarefa 8 do plano de 24/10). Os quatro cenários seguem corretos: só o 0 gera contra-ataque.
// O golden (golden/riposte-padrao.json) foi gravado ANTES da mudança: com os valores padrão nada muda.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {Particles} from './src/particles.js';
import {RiposteEffect} from './src/riposte-effect.ts';
import {defaults} from './src/config.ts';

const golden = JSON.parse(await readFile(new URL('golden/riposte-padrao.json', import.meta.url), 'utf8'));
const scene = new T.Scene(), stage = new T.Group();scene.add(stage);
function make(v, sc, over = {}) {
  const particles = new Particles(scene, {textures: false});
  let created = 0;const create = particles.create.bind(particles);particles.create = o => {created++;return create(o);};
  return {fx: new RiposteEffect(stage, particles, v, {...defaults.riposte, scenario: sc, ...over}), particles, created: () => created};
}
function run(h, to) {let t = h.t ?? 0;while (t + 1 / 60 <= to + 1e-9) {t += 1 / 60;h.fx.update(t, 1 / 60);h.particles.update(1 / 60);}h.fx.update(to, 0);h.t = to;}
const row = (fx, t) => ({t: +t.toFixed(6), g: fx.guard.visible ? 1 : 0, c: fx.counter.visible ? 1 : 0, i: fx.impact.visible ? 1 : 0, dz: +fx.defender.position.z.toFixed(4) || 0, punch: +fx.punch.toFixed(4), phase: fx.phase});

for (let v = 0; v < 3; v++) for (let sc = 0; sc < 4; sc++) {
  const h = make(v, sc), g = golden[`${v}-${sc}`];assert.equal(+h.fx.duration.toFixed(6), g.duration);
  for (const r of g.rows) {run(h, r.t);assert.deepEqual(row(h.fx, r.t), r, `v${v} cenário ${sc} em t=${r.t}`);}
}
const ids = (v, sc, over) => make(v, sc, over).fx.timeline().map(s => s.id).join();
for (let v = 0; v < 3; v++) {
  assert.equal(ids(v, 0), 'start,body,impact', 'acerto: guarda → contra-ataque → impacto');
  assert.equal(ids(v, 1), 'start,impact', 'sem acerto: só a guarda e o fim');
  assert.equal(ids(v, 2), 'start,finish,impact', 'golpe tardio: guarda → consequência');
  assert.equal(ids(v, 3), 'start,finish,impact', 'Guard Break: guarda → consequência');
  for (const sc of [0, 1, 2, 3]) {const h = make(v, sc), tl = h.fx.timeline();assert.ok(Math.abs(tl.at(-1).to - h.fx.duration) < 1e-9);}

  // (a) abertura da guarda desligada
  const a = make(v, 0, {startOn: 0});run(a, .1);assert.equal(a.fx.guard.visible, false);
  // (b) corpo (contra-ataque em movimento) desligado: o contra-ataque não aparece, o resto continua
  const b = make(v, 0, {bodyOn: 0});run(b, .4);assert.equal(b.fx.counter.visible, false);assert.ok(b.fx.ribbons.every(r => !r.mesh.visible));
  // (c) contato desligado: sem impacto, sem tremor, sem partículas do acerto
  const on = make(v, 0), off = make(v, 0, {impactOn: 0});run(on, .64);run(off, .64);const c0 = on.created(), c1 = off.created();run(on, .8);run(off, .8);
  assert.ok(on.created() > c0, 'o impacto cria partículas');assert.equal(off.created(), c1);assert.equal(off.fx.impact.visible, false);assert.ok(off.fx.punch < 1e-4, 'sem tremor do impacto (resta só o resíduo do contato inicial)');
  // (d) disparo desligado: a saída do contra-ataque não solta o clarão de interceptação
  const l1 = make(v, 0), l0 = make(v, 0, {launchOn: 0});run(l1, .4);run(l0, .4);assert.ok(l1.created() > l0.created(), 'launchOn=0 não cria o clarão da interceptação');
  // (e) finalização desligada (golpe tardio): o defensor não é empurrado
  const f1 = make(v, 2), f0 = make(v, 2, {finishOn: 0});run(f1, .8);run(f0, .8);assert.ok(f1.fx.defender.position.z < -1.95, 'com finalização o golpe tardio empurra');assert.equal(+f0.fx.defender.position.z.toFixed(4), -1.9, 'sem finalização, não');
  // (f) disparo escolhido: argola na saída do contra-ataque
  const s = make(v, 0, {shotKind: 1});run(s, .4);assert.ok(stage.getObjectByName('shot-ring'), 'argola do disparo');
}
console.log('PASS: Riposte com fases desligáveis');
