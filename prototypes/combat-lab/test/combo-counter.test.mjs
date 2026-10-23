// Contador de combo observacional: conta só acertos corpo a corpo com dano real e nunca muda o combate.
import {assert, arena, cmd, vec, secs, suite} from './moves-new-helpers.mjs';
import {countsForCombo} from '../src/sim/combo.js';
import {canAct} from '../src/sim/entity.js';

const {test, done} = suite('COMBOS — CONTADOR OBSERVACIONAL');
const EMPTY = {active: [null, null], last: [null, null]};

function tackleThenQuick() {
  const g = arena({equip: ['quick-attack'], positions: [vec(0, -.9), vec(0, .9)]});
  let first = false, pressed = false;
  const snaps = [], hits = [];
  for (let i = 0; i < secs(3); i++) {
    const press = first && !pressed && g.hitstop <= 0;
    g.step(!first ? cmd({tackle: i === 0}) : press ? cmd({skill: 0, skillHeld: [true, false, false, false]}) : cmd(), cmd());
    if (press) pressed = true;
    for (const e of g.lastStepEvents) if (e.attacker === 0 && e.result === 'impact' && e.damage > 0) hits.push([e.id, e.tick]);
    if (hits.length) first = true;
    snaps.push({active: g.combos.active[0] && {...g.combos.active[0]}, last: g.combos.last[0] && {...g.combos.last[0]}});
  }
  return {g, snaps, hits};
}

test('só conta impacto corpo a corpo com dano ao HP', () => {
  assert.equal(countsForCombo({result: 'impact', damage: 5, contact: 'tackle', attacker: 0, target: 1}), true);
  assert.equal(countsForCombo({result: 'impact', damage: 5, contact: 'melee', attacker: 0, target: 1}), true);
  for (const bad of [{result: 'partial', damage: 5, contact: 'tackle'}, {result: 'perfect', damage: 0, contact: 'tackle'}, {result: 'perfectDodge', damage: 0, contact: 'tackle'}, {result: 'impact', damage: 0, contact: 'tackle'}, {result: 'impact', damage: 5, contact: 'projectile'}, {result: 'impact', damage: 5, contact: 'area'}, {result: 'footstool', damage: 5, contact: 'footstool'}])
    assert.equal(countsForCombo({attacker: 0, target: 1, ...bad}), false, JSON.stringify(bad));
});
test('Tackle seguido de Quick Attack é UM combo de 2 acertos e termina quando o defensor volta a agir', () => {
  const {g, snaps} = tackleThenQuick();
  assert.equal(Math.max(...snaps.map(s => s.active?.count ?? 0)), 2, 'dois acertos no mesmo combo');
  const ended = snaps.find(s => s.last);
  assert.ok(ended, 'o combo termina');
  assert.equal(ended.last.count, 2);assert.equal(ended.last.target, 1);assert.ok(ended.last.damage > 0);
  assert.equal(canAct(g.fighters[1]), true);
  assert.equal(g.combos.active[0], null);
});
test('defesa não conta: Tackle bloqueado não abre combo', () => {
  const g = arena({positions: [vec(0, -.9), vec(0, .9)]});
  for (let i = 0; i < secs(1.5); i++) g.step(cmd({tackle: i === 0}), cmd({guard: true, guardPressed: i === 0}));
  assert.equal(g.combos.active[0], null);assert.equal(g.combos.last[0], null);
});
test('save/load preserva o contador e saves antigos (sem o campo) carregam vazios', () => {
  const {g} = tackleThenQuick();
  const saved = g.save();assert.deepEqual(saved.combos, g.combos);
  const g2 = arena({});delete saved.combos;g2.load(saved);
  assert.deepEqual(g2.combos, EMPTY);
});
test('observacional: os eventos do Tackle continuam idênticos (ids 1 e 3, ticks 9 e 16)', () => {
  assert.deepEqual(tackleThenQuick().hits, [[1, 9], [3, 16]]);
});
test('reset da partida zera o contador', () => {
  const {g} = tackleThenQuick();g.reset({positions: [vec(0, -3), vec(0, 3)]});
  assert.deepEqual(g.combos, EMPTY);
});

done();
