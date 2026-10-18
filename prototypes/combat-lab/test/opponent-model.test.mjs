import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initOpponentModel,
  recordOpponentDefense,
  recordOpponentAttack,
  recordOpponentStamina,
  recordOpponentCharge,
  evaluateCounterStrategy
} from '../src/sim/opponent-model.js';

test('initOpponentModel inicia com priors neutros e zero hipóteses ativas', () => {
  const model = initOpponentModel();
  assert.equal(model.samples.defense, 0);
  assert.equal(model.samples.attack, 0);
  assert.equal(model.hypotheses.isTurtle.active, false);
  assert.equal(model.hypotheses.isDodger.active, false);
  assert.equal(model.hypotheses.isAggressive.active, false);

  const strat = evaluateCounterStrategy(model, {range: 1.0});
  assert.equal(strat.recommendedPosture, 'neutral');
  assert.equal(strat.confidence, 0);
});

test('Não confirma hipótese com apenas 1 ou 2 observações isoladas (anti-ruído)', () => {
  const model = initOpponentModel();
  recordOpponentDefense(model, 'guard', 0.3);
  assert.equal(model.hypotheses.isTurtle.active, false, '1 observação não deve ativar hipótese');
  recordOpponentDefense(model, 'guard', 0.3);
  assert.equal(model.hypotheses.isTurtle.active, false, '2 observações não devem ativar hipótese');
});

test('Confirma hipótese de Turtle após 4+ bloqueios frequentes e sugere anti_turtle', () => {
  const model = initOpponentModel();
  for (let i = 0; i < 5; i++) {
    recordOpponentDefense(model, 'guard', 0.35);
  }
  assert.equal(model.hypotheses.isTurtle.active, true);
  assert.ok(model.hypotheses.isTurtle.confidence >= 0.35);

  const strat = evaluateCounterStrategy(model, {range: 1.0});
  assert.equal(strat.recommendedPosture, 'anti_turtle');
  assert.ok(strat.baitWeightMod > 1.2, 'Deve aumentar peso de iscas contra turtle');
  assert.ok(strat.spacingBias < 0, 'Deve pressionar de mais perto contra turtle');
});

test('Confirma hipótese de Dodger após 4+ esquivas e sugere delayAttack', () => {
  const model = initOpponentModel();
  for (let i = 0; i < 5; i++) {
    recordOpponentDefense(model, 'dodge', 0.35);
  }
  assert.equal(model.hypotheses.isDodger.active, true);

  const strat = evaluateCounterStrategy(model, {range: 1.0});
  assert.equal(strat.recommendedPosture, 'anti_dodger');
  assert.equal(strat.delayAttack, true);
  assert.ok(strat.spacingBias > 0);
});

test('Rastreia ataques repetidos de perto e recomenda outspace contra agressivo', () => {
  const model = initOpponentModel();
  for (let i = 0; i < 4; i++) {
    recordOpponentAttack(model, 1.8, 0.3);
  }
  assert.equal(model.hypotheses.isAggressive.active, true);
  const strat = evaluateCounterStrategy(model, {range: 1.0});
  assert.equal(strat.recommendedPosture, 'outspace');
  assert.ok(strat.spacingBias > 0.3);
});

test('Rastreia exaustão frequente e recomenda exploitExhaustion', () => {
  const model = initOpponentModel();
  recordOpponentStamina(model, 0.5, true, 1.0);
  recordOpponentStamina(model, 0.2, true, 1.5);
  assert.equal(model.hypotheses.isStaminaSpender.active, true);

  const strat = evaluateCounterStrategy(model, {range: 1.0});
  assert.equal(strat.exploitExhaustion, true);
});

test('Rastreia carregamento longo de moves e recomenda rushdownCharge', () => {
  const model = initOpponentModel();
  recordOpponentCharge(model, 1.2, true);
  recordOpponentCharge(model, 1.4, true);
  assert.equal(model.hypotheses.isLongCharger.active, true);

  const strat = evaluateCounterStrategy(model, {range: 1.0});
  assert.equal(strat.rushdownCharge, true);
});
