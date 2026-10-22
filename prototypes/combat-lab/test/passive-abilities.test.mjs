import assert from 'node:assert/strict';
import * as T from 'three';
import {C, resetConfig} from '../src/sim/config.js';
import {PASSIVE_ABILITIES, PassiveAbilitySystem} from '../src/view/passive-abilities.js';

resetConfig();
assert.equal(PASSIVE_ABILITIES.length, 3);
for (const ability of PASSIVE_ABILITIES) {assert.match(ability.name, /^\S+$/u, `${ability.name} deve ter uma palavra`);assert.equal(ability.duration, .5);}

const scene = new T.Scene(), notices = [];
const system = new PassiveAbilitySystem(scene, {notify: (id, name) => notices.push({id, name})});
const fighters = [
  {id: 0, hp: 100, position: {x: 1.25, z: -2.5}, visualFacing: .4, flight: null, vaultHeight: 0},
  {id: 1, hp: 100, position: {x: -3, z: 4.5}, visualFacing: -1.2, flight: {y: .7}, vaultHeight: .2},
];
const characters = [{groundOffset: .12}, {groundOffset: .3}];
C.display.passive.playerAbility = 0;
C.display.passive.enemyAbility = 1;
system.update(fighters, 1 / 60, {characters});

assert.deepEqual(notices, [], 'o jogo não dispara nomes fictícios ao iniciar');
system.activate(0, C.display.passive.playerAbility);
system.activate(1, C.display.passive.enemyAbility);
assert.deepEqual(notices, [{id: 0, name: 'Órbita'}, {id: 1, name: 'Prisma'}]);
system.activate(0, 0, 'Regenerator');
assert.equal(notices.at(-1).name, 'Regenerator', 'eventos reais podem informar o nome da passiva equipada');
assert.deepEqual(system.fighters[0].root.position.toArray(), [1.25, .12, -2.5]);
assert.deepEqual(system.fighters[1].root.position.toArray(), [-3, 1.2, 4.5]);
assert.equal(system.fighters[0].root.rotation.y, .4);
assert.equal(system.fighters[0].particles.length, 28);
assert.ok(system.fighters.every(fx => fx.particles.every(p => p.material.color.getHex() === 0xffffff)), 'todas as habilidades usam apenas sparkles brancos');

const meshCount = scene.getObjectByName('passive-ability-0').children.reduce((n, group) => n + group.children.length, 0);
for (let i = 0; i < 20; i++) system.activate(0, i % 3);
assert.equal(scene.getObjectByName('passive-ability-0').children.reduce((n, group) => n + group.children.length, 0), meshCount, 'ativações reutilizam as malhas');

const age = system.fighters[0].age;
fighters[0].position = {x: 7, z: 8};
fighters[0].visualFacing = 2.1;
fighters[0].groundY = 1;
system.update(fighters, 0, {characters});
assert.deepEqual(system.fighters[0].root.position.toArray(), [7, 1.12, 8], 'segue o lutador e a plataforma mesmo com simulação pausada');
assert.equal(system.fighters[0].root.rotation.y, 2.1);
assert.equal(system.fighters[0].age, age, 'a animação não avança durante a pausa');

for (let i = 0; i < 29; i++) system.update(fighters, 1 / 60, {characters});
assert.equal(system.fighters[0].active, true, 'o efeito permanece ativo antes de 0,5 s');
for (let i = 0; i < 2; i++) system.update(fighters, 1 / 60, {characters});
assert.equal(system.fighters[0].active, false, 'o efeito termina em 0,5 s e volta ao pool visual');
console.log('✓ passivas: nomes, disparo, acompanhamento, pausa e reutilização');
