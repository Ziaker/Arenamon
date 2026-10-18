import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIFFICULTY_TIERS,
  applyDifficultyProfile,
  contractCheckDifficulty
} from '../src/sim/difficulty.js';

test('DIFFICULTY_TIERS define os 4 níveis esperados com valores justos', () => {
  const tiers = ['easy', 'normal', 'hard', 'expert'];
  for (const t of tiers) {
    assert.ok(DIFFICULTY_TIERS[t], `Tier ${t} deve existir`);
    assert.ok(DIFFICULTY_TIERS[t].reaction >= 0.05, 'Tempo de reação deve respeitar limites humanos (>= 50ms)');
    assert.ok(DIFFICULTY_TIERS[t].mistake >= 0, 'Mistake rate deve ser não-negativo');
    const contract = contractCheckDifficulty(t);
    assert.equal(contract.valid, true);
  }
});

test('applyDifficultyProfile preserva identidade do estilo e variações', () => {
  const base = {
    style: 2, // Counter
    variation: 0.45,
    customField: 'preserved',
  };

  const combined = applyDifficultyProfile(base, 'expert');
  assert.equal(combined.style, 2, 'Estilo original deve ser preservado');
  assert.equal(combined.variation, 0.45, 'Variação original deve ser preservada');
  assert.equal(combined.customField, 'preserved');
  assert.equal(combined.difficultyTier, 'expert');
  assert.equal(combined.reaction, DIFFICULTY_TIERS.expert.reaction);
  assert.equal(combined.usePlanner, true);
});

test('contractCheckDifficulty rejeita níveis desconhecidos', () => {
  assert.throws(() => {
    contractCheckDifficulty('godmode');
  }, /Nível de dificuldade desconhecido/);
});
