// Testes unitários da Fase 5 — Economia de stamina baseada em valor
import {strict as assert} from 'node:assert';
import {createFighter} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {
  valueBasedStamina,
  staminaComboBudget,
  trackStaminaEfficiency,
} from '../src/sim/economy.js';

const baseAttributes = {hp: 100, attack: 10, defense: 10, speed: 1.0};

console.log('--- Iniciando testes da Fase 5 (Economia de stamina baseada em valor) ---');

// 1. Ação permitida quando há stamina de sobra
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  self.stamina = 5.0; // saudável
  const target = createFighter(1, baseAttributes, vec(2, 0));
  const pred = {contactChance: 0.7, punishRisk: 0.3};
  const res = valueBasedStamina(self, target, 'tackle', pred);
  assert(res.allowed === true, 'Ação com stamina saudável deve ser permitida');
  assert(res.reason === 'stamina_healthy');
  console.log('✓ stamina saudável aprova ataques sem restrição excessiva');
}

// 2. Finalização compensatória: exaustão aceita quando o golpe finaliza o rival
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  self.stamina = 1.0; // tackle esgota a stamina
  const lowHpTarget = createFighter(1, baseAttributes, vec(1.5, 0));
  lowHpTarget.hp = 8.0; // morre com 1 tackle (dano ~10.5)
  const pred = {contactChance: 0.85, punishRisk: 0.1};
  const res = valueBasedStamina(self, lowHpTarget, 'tackle', pred);
  assert(res.allowed === true, 'Golpe fatal deve ser permitido mesmo causando exaustão');
  assert(res.reason === 'finishing_blow');
  console.log('✓ exaustão aceita deliberadamente para finalização');
}

// 3. Exaustão recusada em ataque arriscado de baixo retorno
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  self.stamina = 1.0; // causaria exaustão
  const healthyTarget = createFighter(1, baseAttributes, vec(2.5, 0));
  healthyTarget.hp = 90.0;
  healthyTarget.stamina = 5.0;
  const pred = {contactChance: 0.45, punishRisk: 0.8};
  const res = valueBasedStamina(self, healthyTarget, 'tackle', pred);
  assert(res.allowed === false, 'Ataque de baixo valor que causaria exaustão deve ser vetado');
  assert(res.reason === 'prevent_unfavorable_exhaustion');
  console.log('✓ ataques que causariam exaustão sem retorno proporcional são evitados');
}

// 4. Orçamento de combos encadeados (esquiva + cancelamento + tackle)
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  self.stamina = 3.2; // 3.2 - 2.0 = 1.2 >= min cost (1.0)
  const comboCheck = staminaComboBudget(self, ['dodge', 'tackle']);
  assert(comboCheck.canAfford === true, '3.2 de stamina deve comportar dodge (1) + tackle (1) sem exaustão');

  self.stamina = 2.2; // 2.2 - 2.0 = 0.2 < min cost (1.0) -> causaria exaustão
  const poorCheck = staminaComboBudget(self, ['dodge', 'tackle']);
  assert(poorCheck.canAfford === false, '2.2 de stamina não comporta combo sem causar exaustão');
  console.log('✓ orçamento de sequências e combos calculado com precisão');
}

// 5. Rastreamento de métricas de eficiência
{
  const brain = {t: {}};
  trackStaminaEfficiency(brain, 1.0, 10.5, false);
  trackStaminaEfficiency(brain, 1.0, 0.0, true);
  assert.equal(brain.t.staminaTelemetry.spentTotal, 2.0);
  assert.equal(brain.t.staminaTelemetry.voluntaryExhaustions, 1);
  assert.equal(brain.t.staminaTelemetry.damagePerStamina, 5.25);
  console.log('✓ telemetria de dano por stamina e exaustões voluntárias validada');
}

console.log('\n5 verificações de economia de stamina (Fase 5) aprovadas.');
