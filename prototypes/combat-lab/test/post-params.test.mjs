// @ts-check
// Fase 4 (postprocessing): parâmetros, acessibilidade e pulsos de evento (módulo puro, sem WebGL).
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {postDefaults, effectiveParams, PostPulses, bloomNow, chromaNow, feedPulses} from '../src/view/post/post-params.js';

let passed = 0, failed = 0;
function test(name, fn) {try {fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}}
console.log('\n--- FASE 4: PÓS-PROCESSAMENTO (parâmetros e pulsos) ---\n');

test('padrão: desligado (renderer atual, custo zero) e igual ao C.vfx.post do jogo', () => {
  resetConfig(defaults());
  assert.equal(C.vfx.post.enabled, 0);assert.deepEqual(postDefaults(), C.vfx.post);
  assert.notEqual(postDefaults(), postDefaults(), 'cópia independente a cada chamada');
});
test('bloom padrão é por limiar alto: arena escura não brilha, só energia', () => {
  const P = postDefaults();
  assert.equal(P.bloomMode, 0);assert.ok(P.bloomThreshold >= .7);assert.ok(P.bloomIntensity <= 1.2);
});
test('acessibilidade: sem flash remove o reforço de brilho e limita o bloom', () => {
  const E = effectiveParams({...postDefaults(), bloomIntensity: 2}, {noFlash: true});
  assert.equal(E.bloomAttackBoost, 1);assert.ok(E.bloomIntensity <= .8);
});
test('acessibilidade: reduzir movimento remove distorção, pulso de aberração e DoF', () => {
  const E = effectiveParams({...postDefaults(), dofOn: 1}, {reduceMotion: true});
  assert.equal(E.distortOn, 0);assert.equal(E.dofOn, 0);assert.equal(E.chromaImpact, E.chromaOffset);
});
test('acessibilidade: alto contraste desliga todos os efeitos que reduzem legibilidade', () => {
  const E = effectiveParams(postDefaults(), {highContrast: true});
  for (const k of ['bloomOn', 'vignetteOn', 'gradeOn', 'chromaOn', 'distortOn']) assert.equal(E[k], 0, k);
});
test('acessibilidade não altera o objeto original (sem efeito colateral)', () => {
  const P = postDefaults(), snap = JSON.stringify(P);effectiveParams(P, {noFlash: true, reduceMotion: true, highContrast: true});
  assert.equal(JSON.stringify(P), snap);
});
test('pulsos decaem exponencialmente, o maior vence e zeram', () => {
  const p = new PostPulses();p.trigger('impact', .5);p.trigger('impact', 1);assert.equal(p.get('impact'), 1);
  p.tick(.32);assert.ok(Math.abs(p.get('impact') - Math.exp(-1)) < 1e-9);
  for (let i = 0; i < 100; i++) p.tick(.1);assert.equal(p.get('impact'), 0);
  p.trigger('attack', 1);p.reset();assert.equal(p.get('attack'), 0);
});
test('bloom e aberração reforçam com o pulso e voltam ao valor base', () => {
  const E = postDefaults(), p = new PostPulses();
  assert.equal(bloomNow(E, p), E.bloomIntensity);assert.equal(chromaNow(E, p), E.chromaOffset);
  p.trigger('attack', 1);p.trigger('impact', 1);
  assert.ok(Math.abs(bloomNow(E, p) - E.bloomIntensity * E.bloomAttackBoost) < 1e-9);assert.ok(Math.abs(chromaNow(E, p) - E.chromaImpact) < 1e-9);
  assert.equal(bloomNow({...E, bloomOn: 0}, p), 0);assert.equal(chromaNow({...E, chromaOn: 0}, p), 0);
});
test('eventos reais: impacto forte dispara pulso e onda de choque no alvo, uma vez por evento', () => {
  const p = new PostPulses(), seen = new WeakSet(), shocks = [];
  const fighters = [{position: {x: 0, z: 0}, groundY: 0}, {position: {x: 3, z: 1}, groundY: 0}];
  const ev = [{result: 'impact', damage: 30, attacker: 0, target: 1}];
  feedPulses(p, ev, fighters, seen, (pos, s) => shocks.push([pos, s]), 12);
  feedPulses(p, ev, fighters, seen, (pos, s) => shocks.push([pos, s]), 12);   // mesmo evento: ignorado
  assert.equal(shocks.length, 1);assert.deepEqual(shocks[0][0], {x: 3, y: 1, z: 1});
  assert.ok(p.get('impact') > .8 && p.get('attack') > .8);
});
test('impacto fraco (abaixo do dano mínimo) pulsa mas não distorce a tela', () => {
  const p = new PostPulses(), shocks = [];
  feedPulses(p, [{result: 'impact', damage: 5, attacker: 0, target: 1}], [{position: {x: 0, z: 0}}, {position: {x: 1, z: 0}}], new WeakSet(), () => shocks.push(1), 12);
  assert.equal(shocks.length, 0);assert.ok(p.get('impact') > 0);
});
test('clash pulsa no ponto médio e a carga mantém o bloom reforçado', () => {
  const p = new PostPulses(), shocks = [];
  const f = [{position: {x: 0, z: 0}}, {position: {x: 4, z: 0}}];
  feedPulses(p, [{result: 'clash', attacker: 0, target: 1}], f, new WeakSet(), (pos) => shocks.push(pos), 12);
  assert.deepEqual(shocks[0], {x: 2, y: 1, z: 0});
  const q = new PostPulses();feedPulses(q, [], [{charge: {pl: 1}}], new WeakSet());assert.ok(q.get('attack') > 0);
});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
