// Sand Wave (A-11): a assinatura que invalida o campo em cache muda com QUALQUER dimensão/orientação do sólido (antes só posição e hx).
import assert from 'node:assert/strict';
import {solidsSignature} from '../src/sim/sand.js';
const base = {shape: 'box', pos: {x: 1, z: 2}, hx: 1, hz: 1, angle: 0, base: 0, top: 2};
const sig = s => solidsSignature([s]);
const s0 = sig(base);
assert.equal(sig({...base}), s0, 'igual → mesma assinatura');
for (const [nome, o] of Object.entries({hz: {hz: 3}, hx: {hx: 2}, angle: {angle: .7}, top: {top: 4}, base: {base: 1}, shape: {shape: 'circle'}, raio: {radius: 2}, x: {pos: {x: 1.5, z: 2}}, z: {pos: {x: 1, z: 2.5}}})) assert.notEqual(sig({...base, ...o}), s0, `mudar ${nome} invalida o cache`);
assert.notEqual(solidsSignature([base, base]), s0, 'outro número de sólidos');
console.log('sand-cache-assinatura: 11 verificações aprovadas.');
