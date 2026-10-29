import assert from 'node:assert/strict';
import {effectiveMovePhases} from '../src/sim/move-phases.js';

const endCast = {id: 'end-cast', duration: .4, timeline: [{at: .4, effect: 'burst'}]};
assert.deepEqual(effectiveMovePhases(endCast), {
  duration: .4, startup: [0, .4], active: [], recovery: [.4, .4], cancel: null, invulnerable: [], impacts: [{at: .4, kind: 'effect', name: 'burst'}],
});

const instant = {id: 'instant', duration: .25, timeline: [{at: 0, effect: 'shot'}]};
assert.deepEqual(effectiveMovePhases(instant), {
  duration: .25, startup: [0, 0], active: [], recovery: [0, .25], cancel: null, invulnerable: [], impacts: [{at: 0, kind: 'effect', name: 'shot'}],
});

const tackle = {id: 'dash', duration: .7, tackle: 'dash-setup', timeline: []};
assert.deepEqual(effectiveMovePhases(tackle, {hitStart: .15, hitEnd: .35, chainAfter: .45}), {
  duration: .7, startup: [0, .15], active: [[.15, .35]], recovery: [.35, .7], cancel: [.45, .7], invulnerable: [], impacts: [],
});

const charge = {id: 'charge', charge: {max: 4}, timeline: [{at: 1, effect: 'release'}]};
assert.deepEqual(effectiveMovePhases(charge), {
  duration: 0, startup: [0, 0], active: [], recovery: [0, 0], cancel: null, invulnerable: [], impacts: [{at: 0, kind: 'effect', name: 'release'}],
}, 'Charge dispara seus eventos na soltura e não inventa duração');

const noHit = {id: 'status', duration: .5, cancelAfter: .3, invulnerable: [.1, .2], timeline: []};
assert.deepEqual(effectiveMovePhases(noHit), {
  duration: .5, startup: [0, .5], active: [], recovery: [.5, .5], cancel: [.3, .5], invulnerable: [[.1, .2]], impacts: [],
}, 'ausência de hit não cria janela ativa');

console.log('✓ projeção efetiva das fases dos Moves aprovada');
