import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN_TYPES,
  createPlan,
  shouldInterruptPlan,
  updatePlan
} from '../src/sim/sequence-planner.js';
import {vec} from '../src/sim/math.js';

test('createPlan inicializa planos com defaults corretos', () => {
  const plan = createPlan(PLAN_TYPES.BAIT_AND_PUNISH);
  assert.equal(plan.type, PLAN_TYPES.BAIT_AND_PUNISH);
  assert.equal(plan.step, 'approach');
  assert.equal(plan.status, 'running');
  assert.equal(plan.stepTime, 0);
  assert.ok(plan.maxTime > 1.0);
});

test('shouldInterruptPlan interrompe por dano sofrido ou atordoamento', () => {
  const plan = createPlan(PLAN_TYPES.CORNER_TRAP);
  const self = {knockRecovery: 0.3, stun: 0, flight: null, exhausted: false};
  const target = {exhausted: false};

  const interrupted = shouldInterruptPlan(plan, self, target);
  assert.equal(interrupted, true);
  assert.equal(plan.status, 'interrupted');
  assert.equal(plan.interruptionReason, 'hit_taken');
});

test('shouldInterruptPlan expira quando excede maxTime', () => {
  const plan = createPlan(PLAN_TYPES.BAIT_AND_PUNISH, {maxTime: 1.5});
  plan.totalTime = 1.6;
  const self = {knockRecovery: 0, stun: 0, flight: null, exhausted: false};
  const target = {exhausted: false};

  const interrupted = shouldInterruptPlan(plan, self, target);
  assert.equal(interrupted, true);
  assert.equal(plan.status, 'expired');
});

test('shouldInterruptPlan interrompe por ameaça urgente', () => {
  const plan = createPlan(PLAN_TYPES.CORNER_TRAP);
  const self = {knockRecovery: 0, stun: 0, flight: null, exhausted: false};
  const target = {exhausted: false};

  const interrupted = shouldInterruptPlan(plan, self, target, {hasUrgentThreat: true});
  assert.equal(interrupted, true);
  assert.equal(plan.interruptionReason, 'urgent_threat');
});

test('updatePlan progride a sequência de bait & punish', () => {
  const plan = createPlan(PLAN_TYPES.BAIT_AND_PUNISH);
  const self = {position: vec(0, 0), velocity: vec(), knockRecovery: 0, stun: 0, flight: null, exhausted: false};
  const target = {position: vec(3.5, 0), velocity: vec(), action: null, knockRecovery: 0, stun: 0, exhausted: false};

  // Passo 1: Approach
  let res = updatePlan(plan, self, target, 0.1, {reach: 2.2});
  assert.equal(plan.step, 'approach');
  assert.ok(res.command.move.x > 0);

  // Força aproximação
  self.position = vec(2.4, 0);
  res = updatePlan(plan, self, target, 0.1, {reach: 2.2});
  assert.equal(plan.step, 'feint_retreat');
  // No próximo tick, executa feint_retreat
  res = updatePlan(plan, self, target, 0.1, {reach: 2.2});
  assert.ok(res.command.move.x < 0, 'Feint deve recuar');

  // Simula oponente desferindo tackle whiffado
  target.action = {kind: 'tackle', elapsed: 0.35};
  res = updatePlan(plan, self, target, 0.1, {reach: 2.2});
  assert.equal(plan.step, 'await_whiff');

  // Simula oponente em recoil (vulnerável para punição)
  target.action = {kind: 'recoil', elapsed: 0.05};
  res = updatePlan(plan, self, target, 0.1, {reach: 2.2});
  assert.equal(plan.step, 'punish');
  assert.equal(res.command.tackle, true, 'Deve desferir tackle na punição');
  assert.equal(res.planComplete, true);
});

test('updatePlan executa corner trap e mantém pressão de parede', () => {
  const plan = createPlan(PLAN_TYPES.CORNER_TRAP);
  const self = {position: vec(1.0, 1.0), velocity: vec(), knockRecovery: 0, stun: 0, flight: null, exhausted: false};
  const target = {position: vec(4.0, 4.0), velocity: vec(), action: null, knockRecovery: 0, stun: 0, exhausted: false};

  const res = updatePlan(plan, self, target, 0.1, {arenaHalf: 5.0, reach: 2.2});
  assert.ok(res.command !== null);
  assert.ok(res.command.move);
});
