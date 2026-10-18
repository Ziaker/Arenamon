// Testes unitários da Fase 3 — Previsão de combate de curto prazo
import {strict as assert} from 'node:assert';
import {createFighter} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {
  predictFighterPosition,
  predictContact,
  predictProjectileTrajectory,
  canDefenseArrive,
  calculatePunishWindow,
  trackPredictionAccuracy,
} from '../src/sim/prediction.js';

const baseAttributes = {hp: 100, attack: 10, defense: 10, speed: 1.0};

console.log('--- Iniciando testes da Fase 3 (Previsão de combate) ---');

// 1. Previsão de posição com clamping de parede da arena
{
  const f = createFighter(0, baseAttributes, vec(6.0, 0));
  f.velocity = vec(5.0, 0); // Movendo em direção à parede direita (limite ~7.0)
  const pred = predictFighterPosition(f, 1.0, 7.0);
  assert(pred.x <= 7.0 - 0.4, 'Posição prevista deve respeitar os limites da parede da arena');
  console.log('✓ previsão de posição respeita as paredes da arena');
}

// 2. Previsão unificada de chance de contato e tempo até contato
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  const target = createFighter(1, baseAttributes, vec(1.2, 0)); // Bem perto
  const predClose = predictContact(self, target, 'tackle');
  assert(predClose.contactChance >= 0.7, `Chance próxima deve ser alta, obtido: ${predClose.contactChance}`);
  assert(predClose.timeToContact < 0.2, 'Tempo até contato deve ser pequeno');

  const farTarget = createFighter(1, baseAttributes, vec(10.0, 0)); // Muito longe
  const predFar = predictContact(self, farTarget, 'tackle');
  assert(predFar.contactChance <= 0.1, `Chance distante deve ser baixa, obtido: ${predFar.contactChance}`);
  assert(predFar.timeToContact >= 999, 'Tempo para contato impossível deve ser sentinela');
  console.log('✓ chance de contato e tempo até contato calculados coerentemente');
}

// 3. Previsão de trajetória de projétil e interceptação por barreira
{
  const target = createFighter(1, baseAttributes, vec(5.0, 0));
  const proj = {id: 10, pos: vec(0, 0), vel: vec(10.0, 0), pl: 1, owner: 0, radius: 0.2};
  const worldWithoutBarrier = {entities: []};

  const pred1 = predictProjectileTrajectory(proj, worldWithoutBarrier, target);
  assert(pred1.willHitTarget === true, 'Projétil em rota deve prever impacto no alvo');
  assert(Math.abs(pred1.timeToHit - 0.5) < 0.05, 'Tempo de impacto deve ser ~0.5s');

  const barrier = {id: 99, reflect: true, dead: false, owner: 1, pl: 2, y: 0, height: 2, hx: 1.0, hz: 1.0, pos: {x: 2.5, z: 0}};
  const worldWithBarrier = {entities: [barrier]};
  const pred2 = predictProjectileTrajectory(proj, worldWithBarrier, target);
  assert(pred2.willHitBarrier === true, 'Projétil deve interceptar a barreira');
  assert(pred2.willReflect === true, 'Barreira com PL superior deve refletir o projétil');
  console.log('✓ trajetória de projéteis e reflexão em barreira previstas com precisão');
}

// 4. Viabilidade temporal de ações defensivas
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  self.perfectCooldown = 0;
  // Ameaça chega em 0.15s: guarda rápida chega a tempo
  const guardCheck = canDefenseArrive(self, 0.15, 'guard');
  assert(guardCheck.canArrive === true, 'Guarda deve ficar pronta a tempo');

  // Ameaça chega em 0.05s: perfeita viável
  const perfectCheck = canDefenseArrive(self, 0.05, 'perfectGuard');
  assert(perfectCheck.canArrive === true, 'Defesa perfeita deve ser viável');

  // Com cooldown na defesa perfeita, não é viável
  self.perfectCooldown = 0.5;
  const perfectCheckCd = canDefenseArrive(self, 0.05, 'perfectGuard');
  assert(perfectCheckCd.canArrive === false, 'Defesa perfeita em cooldown não pode ser viável');
  console.log('✓ viabilidade de respostas defensivas avaliada com regras reais');
}

// 5. Cálculo de janelas de punição e telemetria de calibração
{
  const vulnerableTarget = createFighter(1, baseAttributes, vec(0, 0));
  vulnerableTarget.knockRecovery = 0.45;
  const punish = calculatePunishWindow(vulnerableTarget);
  assert(punish.isVulnerable === true, 'Alvo em knockRecovery deve ser punível');
  assert(punish.windowDuration === 0.45, 'Duração da janela deve corresponder');

  const brain = {t: {}};
  trackPredictionAccuracy(brain, {contactChance: 0.8}, 'hit');
  trackPredictionAccuracy(brain, {contactChance: 0.8}, 'whiff');
  assert(brain.t.predictionTelemetry.samples === 2, 'Telemetria deve registrar 2 amostras');
  console.log('✓ janelas de punição e telemetria de acurácia validadas');
}

console.log('\n5 verificações de previsão de combate (Fase 3) aprovadas.');
