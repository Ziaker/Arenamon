// Emerging Stone com as seis fases desligáveis (Tarefa 7 do plano docs/plans/2026-10-24-vfx-por-fase-atelier.md).
// O golden (golden/stone-padrao.json) foi gravado do StoneEffect ANTES da mudança: com os valores padrão o visual não pode mudar.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {Particles} from './src/particles.js';
import {StoneEffect} from './src/effects.js';
import {defaults} from './src/config.ts';

const golden = JSON.parse(await readFile(new URL('golden/stone-padrao.json', import.meta.url), 'utf8'));
const scene = new T.Scene(), stage = new T.Group();scene.add(stage);
function make(variant, over = {}) {
  const particles = new Particles(scene, {textures: false});
  let created = 0;const create = particles.create.bind(particles);particles.create = o => {created++;return create(o);};
  const fx = new StoneEffect(stage, particles, variant, {...defaults.stone, flightTime: 0, ...over}, null, variant);   // golden e asserções partem do trajeto 0 (visual legado)
  return {fx, particles, created: () => created};
}
function run(h, to) {let t = h.t ?? 0;while (t + 1 / 60 <= to + 1e-9) {t += 1 / 60;h.fx.update(t, 1 / 60);h.particles.update(1 / 60);}h.fx.update(to, 0);h.t = to;}
const row = fx => ({vis: fx.rock.visible ? 1 : 0, y: +fx.rock.position.y.toFixed(4), crack: +fx.cracks.userData.glow.opacity.toFixed(4), ring: +fx.rings[0].material.opacity.toFixed(4), shocks: fx.shocks.map(s => s.visible ? 1 : 0).join(''), punch: +fx.punch.toFixed(4), phase: fx.phase});

for (let v = 0; v < 3; v++) {
  const h = make(v);assert.equal(+h.fx.duration.toFixed(6), golden[v].duration, `duração v${v}`);
  for (const g of golden[v].rows) {const {t, ...want} = g;run(h, t);assert.deepEqual(row(h.fx), want, `v${v} em t=${t}`);}
}
for (let v = 0; v < 3; v++) {
  assert.deepEqual(make(v).fx.timeline().map(s => s.id), ['start', 'hold', 'finish'], 'sem trajeto subterrâneo por padrão');
  const fl = make(v, {flightTime: .8});
  assert.deepEqual(fl.fx.timeline().map(s => s.id), ['start', 'body', 'hold', 'finish']);
  assert.ok(Math.abs(fl.fx.duration - (golden[v].duration + .8)) < 1e-9, 'o trajeto soma à duração');

  // (a) surgimento desligado: sem rachaduras nem anéis de sinalização
  const a = make(v, {startOn: 0});run(a, .3);assert.equal(a.fx.cracks.userData.glow.opacity, 0);assert.ok(a.fx.rings.every(r => r.material.opacity === 0));

  // (b) trajeto subterrâneo: a rocha só sobe depois da viagem; o rastro anda da origem ao alvo
  run(fl, .55 + .4);assert.equal(fl.fx.rock.visible, false, 'durante a viagem a rocha ainda não emergiu');
  assert.ok(fl.fx.trail?.visible, 'rastro subterrâneo visível durante a viagem');
  const z1 = fl.fx.trail.userData.head.position.z;run(fl, .55 + .7);assert.ok(fl.fx.trail.userData.head.position.z > z1, 'a cabeça do rastro avança até o alvo');
  run(fl, .55 + .8 + .2);assert.equal(fl.fx.rock.visible, true, 'emergiu depois da viagem');
  const nb = make(v, {flightTime: .8, bodyOn: 0});run(nb, .55 + .4);assert.ok(!nb.fx.trail || !nb.fx.trail.visible, 'corpo desligado: sem rastro');

  // (c) contato desligado: sem partículas de erupção, sem choque, sem tremor — a rocha continua subindo
  const on = make(v), off = make(v, {impactOn: 0});run(on, .5);run(off, .5);const c0 = on.created(), c1 = off.created();run(on, .8);run(off, .8);
  assert.ok(on.created() > c0, 'com contato ligado a erupção cria partículas');assert.equal(off.created(), c1, 'com contato desligado não cria nenhuma');
  assert.ok(off.fx.shocks.every(s => !s.visible));assert.equal(off.fx.punch, 0);assert.equal(off.fx.rock.visible, true, 'a rocha segue subindo');

  // (d) duração desligada: sem rocha
  const sus = make(v, {holdOn: 0});run(sus, 1.5);assert.equal(sus.fx.rock.visible, false);

  // (e) finalização desligada: ao fim da permanência a rocha some sem afundar
  const fin = make(v), nofin = make(v, {finishOn: 0});const tEnd = golden[v].duration - .55 + .2;run(fin, tEnd);run(nofin, tEnd);
  assert.equal(fin.fx.rock.visible, true, 'com finalização a rocha ainda está afundando');assert.equal(nofin.fx.rock.visible, false, 'sem finalização some de uma vez');

  // (f) disparo: argola na origem quando escolhida
  const shot = make(v, {shotKind: 1});run(shot, .6);assert.ok(stage.getObjectByName('shot-ring'), 'argola do disparo');
}
// padrão NOVO (24/10, pedido do responsável): o trajeto subterrâneo vem ligado
assert.ok(defaults.stone.flightTime >= .5, 'o padrão tem trajeto subterrâneo');
const real = new StoneEffect(stage, new Particles(scene, {textures: false}), 0, {...defaults.stone}, null, 0);
assert.deepEqual(real.timeline().map(s => s.id), ['start', 'body', 'hold', 'finish'], 'com o padrão há fase de trajeto');
console.log('PASS: Emerging Stone com fases desligáveis');
