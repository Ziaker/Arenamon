// Camada Recoil & Flash (PADRAO §4.6) e tema por elemento dos disparos (§7.3).
import assert from 'node:assert/strict';
import * as T from 'three';
import {Particles} from './src/particles.js';
import {defaults} from './src/config.ts';
import {ShotEffect} from './src/shot-effect.ts';

const stage = new T.Group(), particles = new Particles(new T.Scene(), {textures: false});
const make = (v, o = {}) => new ShotEffect(stage, particles, {...defaults.sand, ...v}, {origin: [0, .4, 0], direction: [0, 0, 1], ...o});
const clean = fx => {fx.dispose();stage.clear();particles.clear();};

for (const k of ['shotRecoilFlash', 'shotRecoilHalo', 'shotRecoilKick', 'shotRecoilWaves', 'shotRecoilPlume']) assert.equal(defaults.sand[k], 0, k + ' nasce desligado');
let fx = make({shotKind: 0});fx.fire();assert.equal(stage.children.length, 0);assert.equal(particles.systems.length, 0);clean(fx);   // padrão: nada muda

// soma ao disparo, inclusive com «Nenhum»
fx = make({shotKind: 0, shotRecoilFlash: 1, shotRecoilHalo: 1, shotRecoilKick: .3, shotRecoilWaves: 3, shotRecoilPlume: 20});fx.fire();
const rc = stage.getObjectByName('shot-recoil');assert.ok(rc, 'camada criada com Nenhum');
assert.deepEqual(rc.children.map(c => c.userData.id), ['flash', 'halo', 'kick', 'wave0', 'wave1', 'wave2']);
assert.equal(particles.systems.length, 1, 'jato de escape para trás');
const dir = new T.Vector3(0, 0, 1).applyQuaternion(particles.systems[0].emitter.quaternion);assert.ok(dir.z < -.9, 'escape sopra para trás');
fx.update(.1);assert.ok(rc.children.find(c => c.userData.id === 'kick').position.z < -.05, 'o núcleo recua');
fx.update(1);assert.equal(rc.visible, false, 'a camada some depois do pulso');clean(fx);
fx = make({shotKind: 1, launchOn: 0, shotRecoilFlash: 1});fx.fire();assert.equal(stage.children.length, 0, 'fase Disparo desligada apaga a camada');clean(fx);

// tema por elemento: sem `element` o desenho antigo; com `element`, gradiente de 3 níveis e partícula do próprio Move
fx = make({shotKind: 2});fx.fire();const plain = particles.systems.length;clean(fx);
fx = make({shotKind: 2}, {element: 'earth'});fx.fire();assert.equal(particles.systems.length, plain + 1, 'rastro escuro extra');
assert.ok(particles.systems.some(e => e.kind === 'grain'), 'terra usa grãos');clean(fx);
fx = make({shotKind: 1}, {element: 'psychic'});fx.fire();assert.equal(stage.getObjectByName('shot-ring').children.length, 1, 'fio interno claro');clean(fx);
fx = make({shotKind: 1});fx.fire();assert.equal(stage.getObjectByName('shot-ring').children.length, 0);clean(fx);
const colors = el => {const f = make({shotKind: 5, shotCoreGlow: .5}, {element: el});f.fire();const c = stage.getObjectByName('shot-cross').getObjectByName('star-body').material.color.getHex();clean(f);return c;};
assert.equal(new Set(['earth', 'psychic', 'steel', 'star', 'wind', 'fighting'].map(colors)).size, 6, 'cada elemento tem a sua cor');
console.log('PASS: Recoil & Flash e tema por elemento dos disparos');
