// Camada de disparo (Tarefa 2 do plano docs/plans/2026-10-24-vfx-por-fase-atelier.md): Argola ou Tiro em cone, controles com sinal, valores dos dois guardados.
import assert from 'node:assert/strict';
import * as T from 'three';
import {Particles} from './src/particles.js';
import {defaults} from './src/config.ts';
import {ShotEffect} from './src/shot-effect.ts';

const scene = new T.Scene(), stage = new T.Group();scene.add(stage);
const particles = new Particles(scene, {textures: false});
const base = {...defaults.sand};
const make = (over = {}, opts = {}) => new ShotEffect(stage, particles, {...base, ...over}, {origin: [0, .4, -2], direction: [0, 0, 1], ...opts});
const ring = () => stage.getObjectByName('shot-ring');
const cleanup = fx => {fx.dispose();assert.equal(stage.children.length, 0, 'estágio limpo');assert.equal(particles.count, 0, 'sem partículas');particles.clear();};

// Argola (shotKind 1): desenhada na origem + deslocamentos COM SINAL
let fx = make({shotKind: 1, shotRadius: .5, shotHorizontal: -.5, shotVertical: .25, shotSquash: 2});
fx.fire();
assert.ok(ring(), 'argola existe depois do disparo');
assert.equal(ring().geometry.type, 'TorusGeometry');
assert.ok(Math.abs(ring().position.z - (-2 - .5)) < 1e-9, 'horizontal negativo vai para trás: ' + ring().position.z);
assert.ok(Math.abs(ring().position.y - (.4 + .25)) < 1e-9, 'vertical positivo sobe');
assert.ok(Math.abs(ring().scale.z - 2) < 1e-9, 'achatamento ao longo do trajeto');
assert.equal(particles.systems.length, 0, 'argola não cria jato de partículas');
cleanup(fx);

// Impulso com sinal: positivo à frente, negativo para trás
const z0 = -2;
fx = make({shotKind: 1, shotHorizontal: 0, shotImpulseH: 2, shotImpulseV: 0});fx.fire();fx.update(.1);
assert.ok(Math.abs(ring().position.z - (z0 + .2)) < 1e-9, 'impulso positivo à frente');cleanup(fx);
fx = make({shotKind: 1, shotHorizontal: 0, shotImpulseH: -2, shotImpulseV: 0});fx.fire();fx.update(.1);
assert.ok(Math.abs(ring().position.z - (z0 - .2)) < 1e-9, 'impulso negativo para trás');cleanup(fx);

// A argola some ao fim de shotTime
fx = make({shotKind: 1, shotTime: .25});fx.fire();fx.update(.1);assert.ok(ring().material.opacity > 0);
fx.update(.3);assert.ok(!ring() || ring().visible === false || ring().material.opacity === 0, 'argola apagada ao fim do tempo');cleanup(fx);

// Tiro em cone (shotKind 2): jato de partículas, sem argola; ângulo com sinal
fx = make({shotKind: 2, shotCount: 40});fx.fire();
assert.equal(ring(), undefined, 'cone não desenha argola');
assert.equal(particles.systems.length, 1, 'um sistema Quarks');
for (let i = 0; i < 10; i++) particles.update(1 / 60);
assert.ok(particles.count > 0, 'partículas nasceram');cleanup(fx);
const dirOf = fx => {const e = particles.systems[0].emitter;return new T.Vector3(0, 0, 1).applyQuaternion(e.quaternion);};
fx = make({shotKind: 2, shotAngleH: 40});fx.fire();const right = dirOf(fx);cleanup(fx);
fx = make({shotKind: 2, shotAngleH: -40});fx.fire();const left = dirOf(fx);cleanup(fx);
assert.ok(right.x > .3 && left.x < -.3 && Math.abs(right.x + left.x) < 1e-6, `ângulo horizontal com sinal: ${right.x} / ${left.x}`);
fx = make({shotKind: 2, shotAngleV: 30});fx.fire();assert.ok(dirOf(fx).y > .3, 'ângulo vertical positivo sobe');cleanup(fx);
fx = make({shotKind: 2, shotImpulseH: -3, shotLength: 1});fx.fire();assert.ok(dirOf(fx).z < 0, 'impulso negativo dominante inverte o jato');cleanup(fx);

// Nenhum (shotKind 0, o padrão): não desenha nem emite nada, mesmo com a fase ligada
fx = make({shotKind: 0});fx.fire();assert.equal(stage.children.length, 0);assert.equal(particles.systems.length, 0);cleanup(fx);
assert.equal(defaults.sand.shotKind, 0, 'o padrão é Nenhum: o visual atual não muda');

// Fase de disparo desligada: não executa nada
fx = make({launchOn: 0, shotKind: 1});fx.fire();assert.equal(stage.children.length, 0);cleanup(fx);

// Trocar o tipo não mexe nos valores do outro (a camada nunca escreve nos valores)
const values = {...base, shotKind: 1, shotCount: 77, shotRadius: .9};
const before = JSON.stringify(values);
fx = new ShotEffect(stage, particles, values, {origin: [0, 0, 0], direction: [0, 0, 1]});fx.fire();cleanup(fx);
assert.equal(JSON.stringify(values), before, 'valores intactos');

// Burst de vento anime (shotKind 3): lâminas radiais e speedlines
fx = make({shotKind: 3, shotWindBlades: 6, shotBladeCurve: 45, shotSnapTime: .15});fx.fire();
const blades = stage.getObjectByName('shot-blades');
assert.ok(blades, 'shot-blades existe para o burst anime');
assert.equal(blades.children.filter(c => c.name === 'blade').length, 6, '6 lâminas em crescente criadas');
assert.ok(blades.children.some(c => c.name === 'line') && blades.children.some(c => c.name === 'ring'), 'linhas de velocidade e anel de choque');
assert.ok(particles.systems.length > 0, 'partículas streak do burst criadas');
fx.update(.08);
const b0 = blades.children.find(c => c.name === 'blade').userData.tw.position.x;fx.update(.05);assert.ok(blades.children.find(c => c.name === 'blade').userData.tw.position.x > b0, 'lâminas abrem para fora');
fx.update(2);
assert.ok(!blades.visible, 'lâminas dissiparam depois do estalo');
cleanup(fx);

// Jato pressurizado perfurante (shotKind 4): afunilamento métrico e cavitação
fx = make({shotKind: 4, shotRadius: .5, shotRadiusEnd: .1, shotFocalDist: 2.0, shotCavitation: 6});fx.fire();
assert.equal(particles.systems.length, 2, 'núcleo concentrado + estrias de cavitação');
assert.equal(stage.getObjectByName('shot-ring'), undefined);
cleanup(fx);

// Impacto estelar em cruz (shotKind 5): cruz ortogonal de detonação
fx = make({shotKind: 5, shotCrossArms: 1.2, shotCrossAngle: 45, shotCrossSparks: 18});fx.fire();
const cross = stage.getObjectByName('shot-cross');
assert.ok(cross, 'shot-cross existe');
assert.ok(cross.getObjectByName('star-body') && cross.getObjectByName('star-core') && cross.getObjectByName('ring'), 'estrela, núcleo branco e anel');
assert.ok(Math.abs(cross.userData.spin.rotation.z - 45 * Math.PI / 180) < 1e-6, 'rotação inicial em cruz X');
assert.ok(particles.systems.length > 0, 'centelhas em cruz emitidas');
cleanup(fx);

// Segue a origem durante shotFollow
let originZ = -2;
fx = make({shotKind: 1, shotFollow: .5, shotImpulseH: 0, shotHorizontal: 0}, {follow: () => [0, .4, originZ]});fx.fire();originZ = 3;fx.update(.1);
assert.ok(Math.abs(ring().position.z - 3) < 1e-9, 'argola acompanha a origem enquanto durar o seguimento');cleanup(fx);
console.log('PASS: camada de disparo com 5 opções e afunilamento');
