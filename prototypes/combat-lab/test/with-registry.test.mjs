// withRegistry: escopos assíncronos que terminam fora de ordem não deixam o registro errado ativo (A-08).
import assert from 'node:assert/strict';
import {MoveRegistry, defaultRegistry, activeRegistry, withRegistry} from '../src/sim/moves.js';
const wait = ms => new Promise(r => setTimeout(r, ms));
const A = new MoveRegistry(), B = new MoveRegistry();
assert.equal(activeRegistry(), defaultRegistry);
// síncrono: restaura, inclusive quando lança
assert.equal(withRegistry(A, () => activeRegistry() === A), true);assert.equal(activeRegistry(), defaultRegistry);
assert.throws(() => withRegistry(A, () => {throw new Error('x');}));assert.equal(activeRegistry(), defaultRegistry);
// aninhado síncrono
withRegistry(A, () => {withRegistry(B, () => assert.equal(activeRegistry(), B));assert.equal(activeRegistry(), A);});
assert.equal(activeRegistry(), defaultRegistry);
// assíncronos sobrepostos terminando FORA de ordem (A começa primeiro, mas termina depois)
const pa = withRegistry(A, async () => {await wait(30);return 'a';});
const pb = withRegistry(B, async () => {await wait(5);return 'b';});
await pb;assert.equal(activeRegistry(), A, 'B terminou antes: A (ainda pendente) volta a ser o ativo');
await pa;assert.equal(activeRegistry(), defaultRegistry, 'tudo terminou: o registro padrão volta, sem vazamento');
// assíncrono que falha também limpa
await assert.rejects(withRegistry(A, async () => {await wait(1);throw new Error('y');}));
assert.equal(activeRegistry(), defaultRegistry);
console.log('withRegistry: 5 verificações aprovadas (síncrono, aninhado, assíncronos fora de ordem, falha assíncrona).');
