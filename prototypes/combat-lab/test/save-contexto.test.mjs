// Save/load (A-09): modo, semente e perfis viajam no save; o save antigo (sem eles) carrega sem quebrar.
import assert from 'node:assert/strict';
import {Game} from '../src/sim/game.js';
const g = new Game({seed: 777});g.mode = 'tactical';g.profile = 'agile';g.enemyProfile = 'resistant';g.reset();
const snap = g.save();
assert.deepEqual([snap.mode, snap.seed, snap.profile, snap.enemyProfile], ['tactical', 777, 'agile', 'resistant']);
const h = new Game({seed: 1});h.reset();h.load(snap);
assert.deepEqual([h.mode, h.seed, h.profile, h.enemyProfile], ['tactical', 777, 'agile', 'resistant']);
const antigo = {...snap};for (const k of ['mode', 'seed', 'profile', 'enemyProfile']) delete antigo[k];
const i = new Game({seed: 5});i.mode = 'inactive';i.reset();i.load(antigo);
assert.deepEqual([i.mode, i.seed], ['inactive', 5], 'save antigo mantém o contexto da instância');
for (let t = 0; t < 120; t++) {g.step({move: {x: 0, z: 0}}, {move: {x: 0, z: 0}});h.step({move: {x: 0, z: 0}}, {move: {x: 0, z: 0}});}
assert.equal(JSON.stringify(g.fighters.map(f => [f.position, f.hp])), JSON.stringify(h.fighters.map(f => [f.position, f.hp])), 'mesmo futuro depois do load');
console.log('save-contexto: 4 verificações aprovadas.');
