// @ts-check
// F5 — despachante único de eventos visuais (src/view/vfx/dispatch.js): deduplica por eventId uma vez por quadro e entrega só os
// eventos novos a cada consumidor; tabela OWNERS por resultado e canal com no máximo UM dono de partículas por resultado em cada
// modo (legado / novo runtime × three.quarks ligado/desligado); resultado sem dono conta em diagnostics().unknown e não desenha.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import * as Quarks from 'three.quarks';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {SCENARIOS, runScenario} from '../src/sim/scenarios.js';
import {runMoveScenarios} from '../src/sim/scenarios-moves.js';
import {VfxDispatch, OWNERS, SEM_VISUAL, CHANNELS, MODES, particleOwner, applyParticleOwners} from '../src/view/vfx/dispatch.js';
import {VfxRuntime} from '../src/view/vfx/runtime.js';
import {feedPulses, postFeedsThisFrame} from '../src/view/post/post-params.js';
import {registerAllEffects} from '../src/view/vfx/index.js';
import {VfxSystem} from '../src/view/vfx.js';
import {QuarksBridge} from '../src/view/quarks/bridge.js';

registerStandardMoves();
const here = dirname(fileURLToPath(import.meta.url)), src = join(here, '..', 'src');

/** Todo string entre aspas numa expressão `result: …` / `result = …` de src/sim (ternários incluídos; também os que nenhum cenário alcança). */
function staticResults() {
  const out = new Set(), walk = (/** @type {string} */ d) => {
    for (const n of readdirSync(d)) {const p = join(d, n);if (statSync(p).isDirectory()) walk(p);else if (p.endsWith('.js')) for (const m of readFileSync(p, 'utf8').matchAll(/\bresult\s*(?::|=(?!=))\s*([^,;}\n]*)/g)) for (const q of m[1].matchAll(/'([A-Za-z]+)'/g)) out.add(q[1]);}
  };
  walk(join(src, 'sim'));return out;
}
/** Resultados realmente emitidos por Game.step nos cenários (mesma varredura de f3-combat-event) + 4 seeds IA×IA. */
function emittedResults() {
  const orig = Game.prototype.step, seen = new Set();
  Game.prototype.step = function (...a) {orig.apply(this, a);for (const e of this.lastStepEvents) seen.add(e.result);};
  try {
    for (const def of SCENARIOS) {resetConfig(defaults());runScenario(def);}
    resetConfig(defaults());runMoveScenarios();
    for (const seed of [1, 2, 3, 4]) {
      resetConfig(defaults());const g = new Game({seed});g.start();g.mode = 'tactical';C.extras.toggles.enablePlayerAI = 1;
      for (let t = 0; t < 3000 && g.phase === 'playing'; t++) g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'tactical', C.test.step));
    }
  } finally {Game.prototype.step = orig;resetConfig(defaults());}
  return seen;
}

test('cobertura: todo resultado emitido (cenários + IA) e todo literal de src/sim tem dono em OWNERS ou está em SEM_VISUAL', () => {
  const emitted = emittedResults();
  for (const r of ['impact', 'clash', 'partial', 'perfect', 'reflected', 'spawn']) assert.ok(emitted.has(r), `a varredura alcança ${r}`);
  const stat = staticResults();
  for (const r of ['chargeCancel', 'chargeInterrupt', 'stoneClash', 'counter', 'buffered']) assert.ok(stat.has(r), `varredura estática pega ternário: ${r}`);
  const all = new Set([...emitted, ...stat]), missing = [...all].filter(r => !OWNERS[r] && !SEM_VISUAL.has(r));
  assert.deepEqual(missing, [], 'resultados sem dono nem «sem visual»');
  const both = Object.keys(OWNERS).filter(r => SEM_VISUAL.has(r));
  assert.deepEqual(both, [], 'resultado não pode ter dono E estar em «sem visual»');
  for (const [r, o] of Object.entries(OWNERS)) for (const ch of Object.keys(o)) assert.ok(CHANNELS.includes(ch), `${r}: canal desconhecido ${ch}`);
});

// --- Donos de partículas por modo: mede quem REALMENTE emite (VfxSystem.fire, VfxRuntime.spawnEffect, QuarksFx.emitBurst) ---
const fighters = () => [0, 1].map(id => ({id, position: {x: id * 2, y: 0, z: 0}, groundY: 0, state: 'idle', hp: 100, stamina: 3, statuses: [], velocity: {x: 0, z: 0}}));
let nextId = 1;
const evFor = (/** @type {string} */ result) => ({eventId: nextId++, id: nextId, tick: 10, result, attacker: 0, target: 1, damage: 20, normal: {x: 1, z: 0}, x: 1, y: .5, z: 0, w: 1, h: 1, base: 0, n: {x: 1, z: 0}});
function rig() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, .1, 100);
  const vfx = new VfxSystem(scene), rt = new VfxRuntime(scene, {camera, quality: 'medium', maxParticles: 256});registerAllEffects(rt);
  const quarks = new QuarksBridge({THREE, Quarks, scene});
  /** @type {Record<string, Set<string>>} */ const hits = {vfx: new Set(), runtime: new Set(), quarks: new Set()};let cur = '';
  vfx.fire = () => {hits.vfx.add(cur);};vfx.shake = () => {};
  rt.spawnEffect = () => {hits.runtime.add(cur);return null;};
  quarks.fx.emitBurst = () => {hits.quarks.add(cur);};
  /** Roda um evento por resultado pelos consumidores ativos no modo, como o View.draw faz. */
  const run = (/** @type {{useNewVfx: boolean, quarks: boolean}} */ mode) => {
    for (const r of Object.keys(OWNERS)) {
      cur = r;const fs = fighters(), ev = [evFor(r)];if (r === 'statusApplied') fs[1].state = 'exhausted';   // os efeitos 'status' do runtime exigem o alvo exausto
      if (mode.useNewVfx) rt.update(fs, ev, .016, {tick: 10});else vfx.update(fs, ev, .016);
      if (mode.quarks) quarks.update(fs, ev, .016);
    }
    return hits;
  };
  return {vfx, rt, quarks, run};
}

test('emissão sem filtro = tabela: nos modos base, quem emite partículas para cada resultado é exatamente o dono declarado', () => {
  resetConfig(defaults());
  for (const useNewVfx of [false, true]) {
    const r = rig();r.vfx.ownsParticles = null;r.rt.ownsParticles = null;   // sem filtro: o comportamento cru de cada consumidor
    const hits = r.run({useNewVfx, quarks: false}), who = useNewVfx ? 'runtime' : 'vfx';
    const declared = Object.keys(OWNERS).filter(k => particleOwner(k, {useNewVfx, quarks: false}) === who).sort();
    assert.deepEqual([...hits[who]].sort(), declared, `modo ${useNewVfx ? 'novo' : 'legado'}: emissores reais × OWNERS`);
  }
  const q = rig().run({useNewVfx: false, quarks: true}).quarks;
  assert.deepEqual([...q].sort(), Object.keys(OWNERS).filter(k => OWNERS[k].particles?.quarks === 'quarks').sort(), 'quarks: emissores reais × OWNERS');
});

test('nenhum resultado tem dois donos de partículas no mesmo modo (com o filtro do despachante aplicado)', () => {
  resetConfig(defaults());
  for (const mode of MODES) {
    const r = rig();applyParticleOwners({vfx: r.vfx, runtime: r.rt}, mode);
    const hits = r.run(mode);
    for (const res of Object.keys(OWNERS)) {
      const emitters = Object.keys(hits).filter(k => hits[k].has(res)), owner = particleOwner(res, mode);
      assert.ok(emitters.length <= 1, `${res} em ${JSON.stringify(mode)}: ${emitters.join(' + ')}`);
      if (emitters.length) assert.equal(emitters[0], owner, `${res} em ${JSON.stringify(mode)}: emissor ≠ dono`);
    }
    // o dono declarado dos golpes principais realmente desenha
    for (const res of ['impact', 'clash', 'partial', 'perfect']) assert.ok(hits[/** @type {'vfx'} */ (particleOwner(res, mode))]?.has(res), `${res} em ${JSON.stringify(mode)} sem partículas`);
  }
  // modo padrão (legado, quarks desligado) inalterado: o VFX legado continua dono de tudo que já desenhava
  for (const res of ['ledgeGrab', 'wallSplat', 'destructibleSplat', 'impact', 'partial', 'perfect', 'clash', 'footstool']) assert.equal(particleOwner(res, {useNewVfx: false, quarks: false}), 'vfx', res);
});

test('quarks ligado: o VFX legado cede só as partículas — o tremor de câmera continua dele', () => {
  resetConfig(defaults());
  const r = rig();applyParticleOwners({vfx: r.vfx, runtime: r.rt}, {useNewVfx: false, quarks: true});
  const shakes = /** @type {string[]} */ ([]);r.vfx.shake = (key) => {shakes.push(key);};
  r.vfx.update(fighters(), [evFor('impact')], .016);
  assert.ok(shakes.includes('shakeHit'), `shake mantido (${shakes})`);
});

test('runtime.update com resultado não mapeado (reflected, blocked, inventado) não lança e não desenha', () => {
  resetConfig(defaults());
  const scene = new THREE.Scene(), rt = new VfxRuntime(scene, {camera: new THREE.PerspectiveCamera(), quality: 'medium', maxParticles: 64});registerAllEffects(rt);
  let spawned = 0;const orig = rt.spawnEffect.bind(rt);rt.spawnEffect = (...a) => {spawned++;return orig(...a);};
  assert.doesNotThrow(() => rt.update(fighters(), ['reflected', 'blocked', 'resultadoInventado'].map(evFor), .016, {tick: 1}));
  assert.equal(spawned, 0);
});

test('despachante: deduplica entre quadros por eventId, entrega na ordem, reinicia no reset/load e conta desconhecidos', () => {
  const d = new VfxDispatch(), world = {}, a = {eventId: 1, result: 'impact'}, b = {eventId: 2, result: 'partial'};
  assert.deepEqual(d.dispatch([a, b], {epoch: world}).fresh, [a, b]);
  assert.deepEqual(d.dispatch([a, b], {epoch: world}).fresh, [], 'mesmo array no quadro seguinte: nada novo');
  const c = {eventId: 3, result: 'clash'}, clone = {...a};
  assert.deepEqual(d.dispatch([clone, b, c], {epoch: world}).fresh, [c], 'clone com o mesmo eventId (identidade nova) não repete');
  // load/reset do Game: world novo → contagem reinicia (eventIdSeq volta a 1)
  const w2 = {}, n1 = {eventId: 1, result: 'impact'};
  assert.deepEqual(d.dispatch([n1], {epoch: w2}).fresh, [n1], 'novo Game: eventId 1 volta a valer');
  // sem epoch (world null): regressão do eventId também reinicia
  const d2 = new VfxDispatch();d2.dispatch([{eventId: 5, result: 'impact'}]);const r1 = {eventId: 1, result: 'impact'};
  assert.deepEqual(d2.dispatch([r1]).fresh, [r1], 'eventId regrediu → novo Game');
  // reset explícito (view.reset)
  d.reset();assert.deepEqual(d.dispatch([n1], {epoch: w2}).fresh, [n1]);
  // desconhecido: conta e não é entregue; sem visual: entregue (consumidores ignoram), não conta
  const u = {eventId: 2, result: 'resultadoInventado'}, s = {eventId: 3, result: 'executed'};
  const out = d.dispatch([n1, u, s], {epoch: w2});
  assert.deepEqual(out.fresh, [s]);assert.deepEqual(out.unknown, [u]);
  assert.equal(d.diagnostics().unknown.resultadoInventado, 1);
  // evento sem eventId (chamada avulsa): dedupe por identidade
  const raw = {result: 'impact'};assert.deepEqual(d.dispatch([raw], {epoch: w2}).fresh, [raw]);assert.deepEqual(d.dispatch([raw], {epoch: w2}).fresh, []);
});

test('despachante: consumidor adiado (pausa) recebe o acumulado quando volta, uma única vez', () => {
  const d = new VfxDispatch(), w = {}, a = {eventId: 1, result: 'impact'}, b = {eventId: 2, result: 'clash'};
  d.dispatch([a], {epoch: w});assert.deepEqual(d.take('solid', false), [], 'pausado: segura');
  d.dispatch([a, b], {epoch: w});assert.deepEqual(d.take('solid', false), []);
  d.dispatch([a, b], {epoch: w});assert.deepEqual(d.take('solid', true), [a, b], 'despausou: entrega o acumulado na ordem');
  d.dispatch([a, b], {epoch: w});assert.deepEqual(d.take('solid', true), [], 'e não repete');
  d.dispatch([a, b, {eventId: 3, result: 'impact'}], {epoch: w});d.take('solid', false);d.reset();
  d.dispatch([], {epoch: w});assert.deepEqual(d.take('solid', true), [], 'reset descarta o acumulado');
});

test('View.draw usa o despachante (sem conjuntos `seen` próprios) e reseta no view.reset', () => {
  const s = readFileSync(join(src, 'view', 'view.js'), 'utf8');
  for (const k of ['this.dispatch.dispatch(events', 'this.dispatch.reset()', 'applyParticleOwners(']) assert.ok(s.includes(k), `view.js sem ${k}`);
  for (const k of ['legacySeen', 'auraSeen', 'postSeen', 'seenEvents']) assert.ok(!s.includes(k), `view.js ainda tem ${k}`);
});

test('pós-processamento: impact frame em silhueta e canvas 0×0 adiam o pulso (não perdem) — dispatch + take + feedPulses', () => {
  const d = new VfxDispatch(), w = {}, P = {enabled: 1}, hit = {eventId: 1, result: 'impact', target: 1, damage: 30};
  const fs = [{position: {x: 0, z: 0}}, {position: {x: 1, z: 0}, groundY: 0}];
  const frame = (/** @type {any[]} */ evs, /** @type {any} */ phase, W = 800, H = 600) => {
    d.dispatch(evs, {epoch: w});const out = /** @type {string[]} */ ([]);
    feedPulses({trigger: (/** @type {string} */ k) => {out.push(k);}}, d.take('post', postFeedsThisFrame(P, phase, W, H)), fs, null);return out;
  };
  assert.deepEqual(frame([hit], 'white'), [], 'silhueta: o pós não alimenta');
  assert.deepEqual(frame([hit], 'invert'), []);
  assert.deepEqual(frame([hit], null), ['impact', 'attack'], 'primeiro quadro normal: o pulso do golpe chega');
  assert.deepEqual(frame([hit], null), [], 'e só uma vez');
  const h2 = {eventId: 2, result: 'clash', attacker: 0, target: 1};
  assert.deepEqual(frame([hit, h2], null, 0, 0), [], 'canvas 0×0: espera');
  assert.deepEqual(frame([hit, h2], null), ['impact', 'attack'], 'canvas volta: entrega');
  assert.equal(postFeedsThisFrame({enabled: 0}, null, 800, 600), false);
  assert.equal(postFeedsThisFrame(P, 'normal', 800, 600), true);
});

test('diagnóstico: excesso no acumulado de um consumidor adiado é contado (truncated)', () => {
  const d = new VfxDispatch(), w = {}, evs = Array.from({length: 40}, (_, i) => ({eventId: i + 1, result: 'impact'}));
  d.dispatch(evs, {epoch: w});d.take('post', false);
  assert.equal(d.diagnostics().truncated, 8);d.dispatch(evs, {epoch: w});assert.equal(d.take('post', true).length, 32, 'quadro seguinte: os 32 mais recentes');
});
