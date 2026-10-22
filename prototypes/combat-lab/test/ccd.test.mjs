// Núcleo puro da detecção contínua: sweepCircle e firstContact (src/sim/ccd.js).
// Uso: node prototypes/combat-lab/test/ccd.test.mjs
import assert from 'node:assert/strict';
import {sweepCircle, sweepRoundedBox, firstContact} from '../src/sim/ccd.js';

let tests = 0;const failures = [];
const check = (name, fn) => {try {fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≉ ${b}`);

check('sweepCircle: frontal, tempo e ponto de impacto exatos', () => {
  const h = sweepCircle({x: 0, z: 5}, 1, {x: 0, z: 0}, {x: 0, z: 10}, .5);   // alcance 1,5 → toca em z = 3,5
  near(h.t, .35);near(h.point.z, 3.5);near(h.normal.z, -1);near(h.normal.x, 0);
});
check('sweepCircle: segmento que passa ao lado sem tocar', () => {
  assert.equal(sweepCircle({x: 3, z: 5}, 1, {x: 0, z: 0}, {x: 0, z: 10}, .5), null);
});
check('sweepCircle: rasante (tangente) conta como contato', () => {
  const h = sweepCircle({x: 1.5, z: 5}, 1, {x: 0, z: 0}, {x: 0, z: 10}, .5);
  assert.ok(h && Math.abs(h.t - .5) < 1e-6);
});
check('sweepCircle: começa sobreposto → inside; segmento curto demais → null; imóvel → null', () => {
  assert.deepEqual(sweepCircle({x: 0, z: 0}, 1, {x: 0, z: 0}, {x: 1, z: 0}, .1), {inside: true});
  assert.equal(sweepCircle({x: 0, z: 5}, 1, {x: 0, z: 0}, {x: 0, z: 1}, .1), null);
  assert.equal(sweepCircle({x: 0, z: 5}, 1, {x: 0, z: 0}, {x: 0, z: 0}, .1), null);
});
check('sweepCircle: afastando-se do círculo nunca bate', () => {
  assert.equal(sweepCircle({x: 0, z: -5}, 1, {x: 0, z: 0}, {x: 0, z: 10}, .5), null);
});
check('firstContact: escolhe o menor t, qualquer que seja a ordem da lista', () => {
  const near1 = {shape: 'box', pos: {x: 0, z: 2}, hx: 10, hz: .01}, far1 = {shape: 'box', pos: {x: 0, z: 2.06}, hx: 10, hz: .01};
  for (const list of [[near1, far1], [far1, near1]]) {
    const h = firstContact(list, {x: 0, z: 0}, {x: 0, z: 5}, .02);
    assert.ok(h);assert.equal(h.solid, near1);near(h.point.z, 2 - .01 - .02);
  }
});
check('firstContact: mistura caixa e círculo; vence o que está primeiro no caminho', () => {
  const wall = {shape: 'box', pos: {x: 0, z: 4}, hx: 5, hz: .1}, pillar = {shape: 'circle', pos: {x: 0, z: 2}, radius: .5};
  const h = firstContact([wall, pillar], {x: 0, z: 0}, {x: 0, z: 6}, .1);
  assert.equal(h.solid, pillar);near(h.point.z, 2 - .5 - .1);
});
check('firstContact: sem contato, ou só sólidos já sobrepostos → null', () => {
  assert.equal(firstContact([], {x: 0, z: 0}, {x: 1, z: 0}, .1), null);
  assert.equal(firstContact([{shape: 'circle', pos: {x: 0, z: 0}, radius: 1}], {x: 0, z: 0}, {x: 1, z: 0}, .1), null);
});
check('firstContact: empate de t fica com o menor índice (determinístico)', () => {
  const a = {shape: 'box', pos: {x: 0, z: 3}, hx: 2, hz: .1}, b = {shape: 'box', pos: {x: 0, z: 3}, hx: 2, hz: .1};
  assert.equal(firstContact([a, b], {x: 0, z: 0}, {x: 0, z: 6}, .1).index, 0);
  assert.equal(firstContact([b, a], {x: 0, z: 0}, {x: 0, z: 6}, .1).index, 0);
});

check('sweepRoundedBox: pela face o contato é em z = −(hz + r); pelo canto, na distância exata r do canto (não no retângulo expandido)', () => {
  const rect = {pos: {x: 0, z: 0}, hx: 1, hz: .01};
  near(sweepRoundedBox(rect, {x: 0, z: -3}, {x: 0, z: 3}, .035).point.z, -.045);
  const h = sweepRoundedBox(rect, {x: 1.02, z: -3}, {x: 1.02, z: 3}, .035);      // 0,02 além da ponta: passa pelo arredondado do canto
  near(Math.hypot(h.point.x - 1, h.point.z + .01), .035, 1e-9);
  assert.ok(h.point.z > -.045, 'antes de rejeitar por canto, o retângulo expandido antecipava o contato');
  assert.equal(sweepRoundedBox(rect, {x: 1.04, z: -3}, {x: 1.04, z: 3}, .035), null, 'a mais de r da ponta não há contato');
});
check('sweepRoundedBox: caixa rotacionada e começar dentro', () => {
  const rect = {pos: {x: 0, z: 0}, angle: Math.PI / 2, hx: .01, hz: 1};   // girada 90°: a face longa fica ao longo de x
  const h = sweepRoundedBox(rect, {x: -3, z: 0}, {x: 3, z: 0}, .02);
  near(h.t, (3 - 1 - .02) / 6, 1e-9);
  assert.deepEqual(sweepRoundedBox(rect, {x: 0, z: 0}, {x: 1, z: 0}, .02), {inside: true});
});

console.log(`CCD (núcleo puro): ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
