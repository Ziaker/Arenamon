// Testes unitários da Fase 6 — Defesa e punição contextuais
import {strict as assert} from 'node:assert';
import {createFighter} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {
  selectDefenseResponse,
  postBlockDecision,
  canPunishSafely,
} from '../src/sim/defense.js';

const baseAttributes = {hp: 100, attack: 10, defense: 10, speed: 1.0};
const style = {guard: 0.8, perfect: 0.8, dodge: 0.6, reserve: 0.5};
const personality = {reaction: 0.15, mistake: 0.0};

console.log('--- Iniciando testes da Fase 6 (Defesa e punição contextuais) ---');

// 1. Ameaça que não alcança gera whiff
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  const target = createFighter(1, baseAttributes, vec(5, 0));
  const threat = {reaches: false, tte: 0.5, distance: 5};
  const res = selectDefenseResponse(self, target, threat, style, personality);
  assert.equal(res.response, 'whiff');
  assert.equal(res.reason, 'threat_will_miss');
  console.log('✓ ameaça fora de alcance gera whiff sem desperdiçar defesa');
}

// 2. Defesa perfeita escolhida quando a janela é ideal e não houve repetição
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  self.perfectCooldown = 0;
  const target = createFighter(1, baseAttributes, vec(1.2, 0));
  const threat = {reaches: true, tte: 0.08, distance: 1.2};
  const res = selectDefenseResponse(self, target, threat, style, personality, []);
  assert.equal(res.response, 'perfectGuard');
  assert.equal(res.reason, 'perfect_guard_optimal_window');
  console.log('✓ defesa perfeita acionada na janela favorável');
}

// 3. Anti-previsibilidade: se usou defesa perfeita repetidamente, varia para outra opção
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  self.perfectCooldown = 0;
  const target = createFighter(1, baseAttributes, vec(1.2, 0));
  const threat = {reaches: true, tte: 0.08, distance: 1.2};
  const history = ['perfectGuard', 'perfectGuard']; // 2 seguidas
  const res = selectDefenseResponse(self, target, threat, style, personality, history);
  assert.notEqual(res.response, 'perfectGuard', 'Não deve repetir perfectGuard após 2 consecutivas');
  console.log('✓ anti-previsibilidade evita exploração de padrões repetitivos');
}

// 4. Decisão pós-bloqueio
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  self.counterWindow = 0.4;
  self.stamina = 3.0;
  const target = createFighter(1, baseAttributes, vec(1.2, 0));

  // Contra-ataque imediato após defesa perfeita
  const decPerf = postBlockDecision(self, target, 'perfect', {contactChance: 0.8, punishRisk: 0.2});
  assert.equal(decPerf, 'counter', 'Defesa perfeita deve iniciar contra-ataque');

  // Reposicionamento quando sem stamina
  self.counterWindow = 0;
  self.stamina = 0.5;
  self.exhausted = true;
  const decExh = postBlockDecision(self, target, 'partial', {contactChance: 0.8, punishRisk: 0.2});
  assert.equal(decExh, 'reset', 'Sem stamina pós-bloqueio deve recuar/reposicionar');
  console.log('✓ decisão pós-bloqueio respeita vantagem de quadros e stamina');
}

// 5. Verificação prévia de viabilidade de punição
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  self.stamina = 3.0;
  const target = createFighter(1, baseAttributes, vec(1.0, 0));
  const windowVulnerable = {isVulnerable: true, windowDuration: 0.4};

  // Punição que chega a tempo com boa chance: aprovada
  const predGood = {contactChance: 0.85, timeToContact: 0.15, punishRisk: 0.2};
  assert.equal(canPunishSafely(self, target, windowVulnerable, predGood).canPunish, true);

  // Punição que chegaria tarde demais (tempo > janela): recusada
  const predLate = {contactChance: 0.85, timeToContact: 0.6, punishRisk: 0.2};
  assert.equal(canPunishSafely(self, target, windowVulnerable, predLate).canPunish, false);
  console.log('✓ punições verificam se chegam a tempo antes de gastar ação');
}

console.log('\n5 verificações de defesa e punição contextuais (Fase 6) aprovadas.');
