// Quick Attack e Bullet Punch com as seis fases desligáveis e o ciclo REAL de cada Move (Tarefa 8 do plano de 24/10).
// Quick Attack: arrancada → contato → RETORNO à origem sem segundo hit. Bullet Punch: corpo AUSENTE durante a corrida e de volta no golpe.
// O golden (golden/rush-antes-da-chegada.json) foi gravado ANTES da mudança: até a chegada o visual padrão não pode mudar.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {Particles} from './src/particles.js';
import {RushEffect} from './src/rush-effects.ts';
import {defaults} from './src/config.ts';

const golden = JSON.parse(await readFile(new URL('golden/rush-antes-da-chegada.json', import.meta.url), 'utf8'));
const scene = new T.Scene(), stage = new T.Group();scene.add(stage);
function make(kind, v, over = {}) {
  const particles = new Particles(scene, {textures: false});
  let created = 0;const create = particles.create.bind(particles);particles.create = o => {created++;return create(o);};
  const p = {...defaults[kind], ...over};
  return {fx: new RushEffect(stage, particles, kind, v, p), particles, p, created: () => created, arrival: p.chargeTime + p.travelTime};
}
function run(h, to) {let t = h.t ?? 0;while (t + 1 / 60 <= to + 1e-9) {t += 1 / 60;h.fx.update(t, 1 / 60);h.particles.update(1 / 60);}h.fx.update(to, 0);h.t = to;}

for (const kind of ['bulletpunch', 'quickattack']) for (let v = 0; v < 3; v++) {
  const h = make(kind, v), g = golden[kind + v];
  assert.equal(+h.fx.duration.toFixed(6), g.duration, `${kind}${v}: duração`);
  const rows = kind === 'quickattack' ? g.rows.slice(0, -1) : g.rows;   // Quick Attack: depois da chegada o retorno é novo (de propósito)
  for (const r of rows) {
    run(h, r.t);
    const got = {t: r.t, az: +h.fx.actor.position.z.toFixed(4) || 0, ay: +h.fx.actor.position.y.toFixed(4) || 0, av: h.fx.actor.visible ? 1 : 0, punch: +h.fx.punch.toFixed(4), phase: h.fx.phase};
    assert.deepEqual(got, r, `${kind}${v} em t=${r.t}`);
  }
}

for (const kind of ['bulletpunch', 'quickattack']) for (let v = 0; v < 3; v++) {
  const base = make(kind, v), tl = base.fx.timeline(), ids = tl.map(s => s.id);
  assert.deepEqual(ids, ['start', 'body', 'finish', 'impact'], `${kind}${v}: janelas`);
  assert.ok(Math.abs(tl.at(-1).to - base.fx.duration) < 1e-9, 'as janelas fecham na duração');

  // (a) surgimento desligado: sem o anel de antecipação
  const a = make(kind, v, {startOn: 0});run(a, a.p.chargeTime * .5);assert.equal(a.fx.launch.visible, false);
  // (b) corpo desligado: nada se move durante a corrida
  const b = make(kind, v, {bodyOn: 0});run(b, b.p.chargeTime + b.p.travelTime / 2);
  assert.equal(b.fx.actor.visible, false);assert.ok(b.fx.ghosts.every(x => !x.visible));
  // (c) contato desligado: sem clarão, tremor nem partículas do acerto
  const on = make(kind, v), off = make(kind, v, {impactOn: 0});run(on, on.arrival - .01);run(off, off.arrival - .01);const c0 = on.created(), c1 = off.created();run(on, on.arrival + .1);run(off, off.arrival + .1);
  assert.ok(on.created() > c0);assert.equal(off.created(), c1);assert.equal(off.fx.impact.visible, false);assert.equal(off.fx.punch, 0);
  // (d) disparo: parte do ponto de origem quando escolhido; fase desligada, nada
  const s = make(kind, v, {shotKind: 1});run(s, s.p.chargeTime + .05);assert.ok(stage.getObjectByName('shot-ring'), 'argola na origem');
}

// Quick Attack: o retorno vai de volta à origem e NÃO gera segundo hit
for (let v = 0; v < 3; v++) {
  const q = make('quickattack', v), fin = q.p.finishTime;
  const ref = make('quickattack', v);run(ref, ref.arrival);const zHit = ref.fx.actor.position.z;
  run(q, q.arrival + .01);const made = q.created();
  run(q, q.arrival + fin * .9);assert.ok(q.fx.actor.position.z < zHit - 1, 'o corpo já está voltando: ' + q.fx.actor.position.z);
  assert.equal(q.created(), made, 'o retorno não cria partículas de acerto (sem segundo hit)');
  assert.ok(q.fx.actor.visible, 'visível durante o retorno');
  run(q, q.arrival + fin + .02);assert.ok(q.fx.actor.position.z < -1.8, 'voltou à origem: ' + q.fx.actor.position.z);
  const nr = make('quickattack', v, {finishOn: 0});run(nr, nr.arrival + nr.p.finishTime * .9);assert.ok(Math.abs(nr.fx.actor.position.z - zHit) < 1e-6, 'finalização desligada: sem retorno');
}
// Bullet Punch: o corpo some durante a corrida e reaparece no golpe
for (let v = 0; v < 3; v++) {
  const b = make('bulletpunch', v);
  run(b, b.p.chargeTime * .5);assert.equal(b.fx.caster.visible, true, 'antes da soltura o corpo está presente');
  run(b, b.p.chargeTime + b.p.travelTime / 2);assert.equal(b.fx.caster.visible, false, 'na corrida o corpo está AUSENTE');
  run(b, b.arrival + .05);assert.equal(b.fx.caster.visible, true, 'reaparece no golpe');assert.ok(b.fx.caster.position.z > 0, 'perto do alvo, não na origem');
}
console.log('PASS: Quick Attack e Bullet Punch com fases desligáveis');
