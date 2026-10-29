import assert from 'node:assert/strict';
import {moveCommandFeedback, moveCommandFeedbackText, setMoveCommandFeedback, tickMoveCommandFeedback} from '../src/sim/move-command-feedback.js';

const executed = {result: 'executed', move: 'swift', slot: 1};
const before = structuredClone(executed);
assert.deepEqual(moveCommandFeedback(executed), {kind: 'accepted', move: 'swift', slot: 1, reason: null, ttl: .45});
assert.deepEqual(executed, before, 'o adaptador puro não altera o evento de origem');

assert.deepEqual(
  moveCommandFeedback({result: 'buffered', move: 'reflect', slot: 0, reason: 'chain'}),
  {kind: 'buffered', move: 'reflect', slot: 0, reason: 'chain', ttl: .7},
);
assert.deepEqual(
  moveCommandFeedback({result: 'denied', move: 'sand-wave', slot: 3, reason: 'stamina'}),
  {kind: 'denied', move: 'sand-wave', slot: 3, reason: 'stamina', ttl: .7},
);
assert.equal(moveCommandFeedback({result: 'expired', move: 'swift', slot: 1}), null, 'eventos fora do contrato não inventam feedback');
assert.equal(moveCommandFeedbackText({kind: 'accepted', reason: null}), 'comando aceito');
assert.equal(moveCommandFeedbackText({kind: 'buffered', reason: 'chain'}), 'no buffer');
assert.equal(moveCommandFeedbackText({kind: 'denied', reason: 'stamina'}), 'negado: stamina');

const fighter = {stamina: 4, moveCooldowns: {swift: 2}, action: null, charge: null, skillBuffer: null};
const stateBefore = structuredClone(fighter);
setMoveCommandFeedback(fighter, executed);
assert.deepEqual({...fighter, moveCommandFeedback: undefined}, {...stateBefore, moveCommandFeedback: undefined}, 'feedback não altera estado mecânico');
assert.equal(fighter.moveCommandFeedback.kind, 'accepted');
tickMoveCommandFeedback(fighter, .2);
assert.equal(fighter.moveCommandFeedback.ttl, .25);
tickMoveCommandFeedback(fighter, .3);
assert.equal(fighter.moveCommandFeedback, null, 'feedback expira sem afetar o Move');

console.log('✓ feedback imediato dos comandos de Move aprovado');
