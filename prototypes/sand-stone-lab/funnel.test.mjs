// Afunilamento métrico (PADRAO §3), funil do cone/jato e atraso do disparo.
import assert from 'node:assert/strict';
import * as T from 'three';
import {Particles} from './src/particles.js';
import {defaults} from './src/config.ts';
import {ShotEffect, funnelRadius} from './src/shot-effect.ts';

// raio ao longo do trajeto: afina (r1 < r0) ou abre (r1 > r0); perfis diferentes entre si; offset com sinal; nunca negativo
assert.equal(funnelRadius(0, .8, .1, 2, 0, 0), .8);assert.ok(Math.abs(funnelRadius(2, .8, .1, 2, 0, 0) - .1) < 1e-9);assert.ok(funnelRadius(1, .8, .1, 2, 0, 0) < .8 && funnelRadius(1, .8, .1, 2, 0, 0) > .1);
assert.ok(funnelRadius(1, .8, .1, 2, 0, 1) < funnelRadius(1, .8, .1, 2, 0, 0), 'parabólico fecha mais rápido no começo');
assert.ok(funnelRadius(1, .8, .1, 2, 0, 2) > funnelRadius(1, .8, .1, 2, 0, 0), 'exponencial fecha só perto do fim');
assert.equal(funnelRadius(.5, .8, .1, 2, 1, 0), .8, 'offset positivo adia o início do afunilamento');
assert.ok(funnelRadius(0, .8, .1, 2, -1, 0) < .8, 'offset negativo começa o afunilamento antes da boca');
assert.ok(funnelRadius(5, .02, .01, .1, -2, 2) > 0, 'raio nunca é zero ou negativo');

const stage = new T.Group(), particles = new Particles(new T.Scene(), {textures: false});
const make = v => new ShotEffect(stage, particles, {...defaults.sand, ...v}, {origin: [0, .4, 0], direction: [0, 0, 1]});
const clean = fx => {fx.dispose();stage.clear();particles.clear();};
const verts = () => stage.getObjectByName('shot-funnel').children[0].geometry.attributes.position;
const width = (name, z) => {const p = verts();let m = 0;for (let i = 0; i < p.count; i++) if (Math.abs(p.getZ(i) - z) < 1e-6) m = Math.max(m, Math.abs(p[name](i)));return m;};

// cone e jato desenham um funil: largo na boca, fino no fim, e mais largo na horizontal com shotSquash
for (const kind of [2, 4]) {
  let fx = make({shotKind: kind, shotRadius: .8, shotRadiusEnd: .1, shotFocalDist: 1.5, shotLength: 2, shotSquash: 2});fx.fire();
  assert.ok(stage.getObjectByName('shot-funnel'), 'funil criado (tipo ' + kind + ')');
  assert.ok(width('getX', 0) > width('getX', 2) * 4, 'fino no fim');
  assert.ok(Math.abs(width('getX', 0) - 2 * width('getY', 0)) < 1e-6, 'largura horizontal = 2× a vertical');clean(fx);
}
// atraso: nada nasce antes da hora
let fx = make({shotKind: 2, shotDelay: .5});fx.fire();
assert.equal(stage.children.length, 0);assert.equal(particles.systems.length, 0, 'nada antes do atraso');
fx.update(.3);assert.equal(stage.children.length, 0);
fx.update(.25);assert.ok(stage.getObjectByName('shot-funnel') && particles.systems.length > 0, 'nasce depois do atraso');clean(fx);
fx = make({shotKind: 0, shotDelay: .2, shotRecoilFlash: 1});fx.fire();assert.equal(stage.children.length, 0);fx.update(.3);assert.ok(stage.getObjectByName('shot-recoil'), 'atraso vale também para Recoil & Flash');clean(fx);
// jato: contração cria o anel; sem contração não
fx = make({shotKind: 4, shotContraction: 2});fx.fire();assert.ok(stage.getObjectByName('contraction'));clean(fx);
fx = make({shotKind: 4});fx.fire();assert.equal(stage.getObjectByName('contraction'), undefined);clean(fx);
console.log('PASS: funil do disparo (perfil, offset, largura horizontal), atraso e contração');
