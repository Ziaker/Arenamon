// Emerging Stone: o trajeto subterrâneo precisa ser perceptível (calombo, faixa de terra revirada, torrões e poeira) e sumir depois do contato.
import assert from 'node:assert/strict';
import * as T from 'three';
import {Particles} from './src/particles.js';
import {StoneEffect} from './src/effects.js';
import {defaults} from './src/config.ts';

for (const v of [0, 1, 2]) {
  const stage = new T.Group(), particles = new Particles(new T.Scene(), {textures: false}), made = [], create = particles.create.bind(particles);
  particles.create = o => {made.push(o);return create(o);};
  const p = {...defaults.stone}, fx = new StoneEffect(stage, particles, v, p, null, v), mid = p.warning + p.flightTime * .5;
  for (let t = 0; t < mid; t += 1 / 30) {fx.update(t, 1 / 30);particles.update(1 / 30);}
  assert.ok(fx.trail.visible && fx.scar.visible && fx.clods.visible, `proposta ${v}: trajeto visível no meio do voo`);
  assert.ok(fx.soil.scale.y > .5 && fx.soil.scale.y < fx.travelLen, 'a faixa de terra cresce até o ponto atual');
  assert.ok(made.filter(o => o.kind === 'dust').length > 10, 'poeira de terra sai do solo durante o voo');
  const hidden = fx.clodData.length - fx.clodData.filter((c, i) => i / fx.clodN * p.flightTime < mid - p.warning).length;
  assert.ok(hidden > 0 && hidden < fx.clodN, 'os torrões nascem ao longo do caminho');
  fx.update(p.warning + p.flightTime + 1.2, 1 / 30);
  assert.ok(!fx.scar.visible && !fx.trail.visible, 'a cicatriz some depois do contato');
  const off = new StoneEffect(new T.Group(), particles, v, {...p, bodyOn: 0}, null, v);off.update(mid, 1 / 30);
  assert.ok(!off.scar.visible && !off.trail.visible, 'desligar «Corpo e trajeto» apaga o trajeto');
}
console.log('PASS: trajeto subterrâneo do Emerging Stone (calombo, terra revirada, torrões, poeira)');
