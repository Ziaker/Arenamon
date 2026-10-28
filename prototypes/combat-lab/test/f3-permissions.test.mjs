// @ts-check
// F3.5: permissões de ação derivadas (sem estado próprio).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {actionPermissions, canAct, canMove} from '../src/sim/entity.js';
import {Recorder} from '../src/sim/telemetry.js';
import {Game} from '../src/sim/game.js';

const base = new Game();base.mode = 'inactive';base.reset();
const mk = (/** @type {any} */ over = {}) => Object.assign(structuredClone(base.fighters[0]), over);
const ALL_FALSE = {canMove: false, canAttack: false, canDodge: false, canGuard: false, canJump: false};

test('F3.5: lutador livre no chão pode tudo', () => {
  assert.deepEqual(actionPermissions(mk()), {canMove: true, canAttack: true, canDodge: true, canGuard: true, canJump: true});
});
test('F3.5: derrotado, hitstun, stagger, voo e ausente → nada', () => {
  assert.deepEqual(actionPermissions(mk({hp: 0})), ALL_FALSE);
  assert.deepEqual(actionPermissions(mk({hitstun: 0.2})), ALL_FALSE);
  assert.deepEqual(actionPermissions(mk({stagger: 0.2})), ALL_FALSE);
  assert.deepEqual(actionPermissions(mk({flight: {y: 1}})), ALL_FALSE);
  assert.deepEqual(actionPermissions(mk({absent: true})), ALL_FALSE);
});
test('F3.5: stun de guarda bloqueia mover/esquivar/pular, mas não grava nada', () => {
  const f = mk({stun: 0.3});
  const before = structuredClone(f);
  const p = actionPermissions(f);
  assert.equal(p.canMove, false);assert.equal(p.canDodge, false);assert.equal(p.canJump, false);
  assert.deepEqual(f, before, 'derivado não escreve estado');
});
test('F3.5: canMove/canAttack coincidem com canMove/canAct; flag stunned/rooted bloqueia o pulo', () => {
  for (const over of [{}, {action: {kind: 'tackle', elapsed: 0}}, {actionRecovery: 0.1}, {hp: 0}]) {
    const f = mk(over);const p = actionPermissions(f);
    assert.equal(p.canMove, canMove(f));
    assert.equal(p.canAttack, canAct(f));
  }
  assert.equal(actionPermissions(mk({jumpState: {canJump: false, cooldown: 0}})).canJump, false);
  assert.equal(actionPermissions(mk({jumpState: {canJump: true, cooldown: 0.1}})).canJump, false);
});
test('F3.5: telemetria usa as permissões (amostra canAct/canMove)', () => {
  const g = new Game();g.mode = 'inactive';g.reset();
  const r = new Recorder();r.record(g);
  const s = r.samples[0].f[0];
  assert.equal(s.canAct, actionPermissions(g.fighters[0]).canAttack);
  assert.equal(s.canMove, actionPermissions(g.fighters[0]).canMove);
});
