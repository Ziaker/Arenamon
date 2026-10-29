// @ts-check
// F6 (correção) — a explosão do Seed Bomb ganhou `move: 'seed-bomb'` no evento (contrato canônico: todo dano carrega o id do Move), mas o VFX legado
// de hit NÃO pode mudar por isso: a explosão sempre usou o hit padrão (sem tinta própria do Move) e o tremor genérico de câmera. Sem pedido do
// usuário nenhum comportamento visual existente muda (AGENTS.md). Compara o evento atual com o formato anterior (`move: null`).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {VfxSystem} from '../src/view/vfx.js';
import {C, resetConfig, factoryDefaults} from '../src/sim/config.js';
import {arena, cmd, vec, HOLD} from './moves-new-helpers.mjs';

const fighter = (/** @type {number} */ id) => ({id, position: {x: id * 2, z: 0}, groundY: 0, vaultHeight: 0, flight: null, action: null, hp: 100, stamina: 3, staminaTrend: 0, exhausted: false, sprinting: false, statuses: [], lastLanding: {n: 0}});
/** Roda o evento no VfxSystem legado e devolve tudo o que ele pediu (fire/shake) e as partículas geradas. */
function drive(/** @type {any} */ ev) {
  resetConfig(factoryDefaults());
  let seed = 12345;const realRandom = Math.random;Math.random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;   // partículas e tremor usam Math.random: semente fixa para comparar
  try {return run(ev);} finally {Math.random = realRandom;}
}
function run(/** @type {any} */ ev) {
  const v = /** @type {any} */ (new VfxSystem({add: () => {}, remove: () => {}}, {flashEl: {style: {}}}));
  const fires = [], shakes = [];
  const fire = v.fire.bind(v), shake = v.shake.bind(v);
  v.fire = (/** @type {any} */ type, /** @type {any} */ ctx, /** @type {any} */ r) => {fires.push({type, color: ctx && type === 'hit' ? JSON.stringify(C.vfx.moveHit) : null, ctx: JSON.stringify({...ctx, pos: null})});return fire(type, ctx, r);};
  v.shake = (/** @type {any} */ ...a) => {shakes.push(JSON.stringify(a.slice(0, 5).map((x, i) => i === 2 || i === 4 ? x : (i === 0 ? x : JSON.stringify(x)))));return shake(...a);};
  v.update([fighter(0), fighter(1)], [ev], .016);
  const parts = [...v.add.p, ...v.norm.p].map((/** @type {any} */ p) => [p.cell, p.mode, +p.r.toFixed(4), +p.g.toFixed(4), +p.b.toFixed(4), +p.w.toFixed(4), +p.life.toFixed(4)]);
  return {fires, shakes, parts, shakeList: v.shakes.map((/** @type {any} */ s) => [s.key ?? s.type ?? null, s.power ?? s.amp ?? null, s.dur ?? s.duration ?? null])};
}
const impact = (/** @type {any} */ extra) => ({tick: 10, attacker: 0, target: 1, result: 'impact', damage: 10, normal: {x: 1, z: 0}, launch: null, contact: 'area', ...extra});

test('explosão do Seed Bomb (move: seed-bomb) é visualmente idêntica ao formato anterior (move: null): mesmos fire/shake/partículas', () => {
  const novo = drive(impact({move: 'seed-bomb'})), antigo = drive(impact({move: null}));
  assert.ok(antigo.shakes.length > 0, 'o formato anterior tinha o tremor genérico');
  assert.deepEqual(novo.fires.map(f => f.ctx.replace('"move":"seed-bomb"', '"move":null')), antigo.fires.map(f => f.ctx.replace('"move":"seed-bomb"', '"move":null')));
  assert.deepEqual(novo.shakes, antigo.shakes, 'mesmo tremor (potência e duração)');
  assert.deepEqual(novo.shakeList, antigo.shakeList);
  assert.deepEqual(novo.parts, antigo.parts, 'mesmas cores e tamanhos das partículas (sem a tinta verde do Move)');
});

test('Seed Bomb real no Game: o evento da explosão, passado ao VFX legado, resulta idêntico a move: null', () => {
  const g = arena({equip: ['seed-bomb'], positions: [vec(0, -6), vec(0, 1)], setup: () => {C.world.seedBomb.markerAccel = 0;C.world.seedBomb.startDistance = 7;}});
  const press0 = {skill: 0, skillHeld: HOLD(0)}, held = {skillHeld: HOLD(0)};
  g.step(cmd(press0), cmd());for (let i = 0; i < 3; i++) g.step(cmd(held), cmd());g.step(cmd(), cmd());
  /** @type {any} */ let ev = null;
  for (let i = 0; i < 300 && !ev; i++) {g.step(cmd(), cmd());ev = g.lastStepEvents.find((/** @type {any} */ e) => e.result === 'impact' && e.move === 'seed-bomb') ?? null;}
  assert.ok(ev, 'a explosão gera um evento de impacto com move seed-bomb (contrato canônico preservado)');
  const novo = drive(ev), antigo = drive({...ev, move: null});
  assert.ok(antigo.shakes.length > 0);
  assert.deepEqual(novo.shakes, antigo.shakes);
  assert.deepEqual(novo.parts, antigo.parts);
});
