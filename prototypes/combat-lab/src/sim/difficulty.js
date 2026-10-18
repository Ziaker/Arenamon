// Níveis de dificuldade honestos e preservação de estilos (Fase 10).
//
// Princípio fundamental: Dificuldade justa (zero trapaça de status, sem HP extra, sem dano inflado,
// sem reação zero-frame). A escala modula percepção, hesitação, precisão de timing e planejamento.

export const DIFFICULTY_TIERS = {
  easy: {
    id: 'easy',
    label: 'Fácil',
    reaction: 0.28,
    reactionJitter: 0.12,
    mistake: 0.22,
    adaptation: 0.20,
    hesitation: 0.25,
    aggression: 0.40,
    usePlanner: false,
    description: 'Reação relaxada, comete leituras erradas e hesita frequentemente.',
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    reaction: 0.16,
    reactionJitter: 0.08,
    mistake: 0.10,
    adaptation: 0.50,
    hesitation: 0.08,
    aggression: 0.50,
    usePlanner: true,
    description: 'Equilíbrio padrão; tempo de reação humano e adaptação equilibrada.',
  },
  hard: {
    id: 'hard',
    label: 'Difícil',
    reaction: 0.10,
    reactionJitter: 0.04,
    mistake: 0.03,
    adaptation: 0.75,
    hesitation: 0.00,
    aggression: 0.65,
    usePlanner: true,
    description: 'Reação ágil, adaptação rápida a hábitos e contra-ataques precisos.',
  },
  expert: {
    id: 'expert',
    label: 'Especialista',
    reaction: 0.065,
    reactionJitter: 0.02,
    mistake: 0.005,
    adaptation: 0.90,
    hesitation: 0.00,
    aggression: 0.80,
    usePlanner: true,
    description: 'Excelente leitura espacial, armadilhas de espaçamento e sequências refinadas.',
  },
};

/**
 * Aplica um nível de dificuldade aos parâmetros de personalidade sem sobrescrever a identidade do estilo.
 * @param {object} basePersonality - parâmetros de personalidade existentes (P)
 * @param {'easy'|'normal'|'hard'|'expert'} tierName
 * @returns {object} nova personalidade combinada
 */
export function applyDifficultyProfile(basePersonality = {}, tierName = 'normal') {
  if (typeof tierName === 'number') {
    tierName = ['easy', 'normal', 'hard', 'expert'][tierName] ?? 'normal';
  }
  const tier = DIFFICULTY_TIERS[tierName] ?? DIFFICULTY_TIERS.normal;
  return {
    ...basePersonality,
    difficultyTier: tier.id,
    reaction: tier.reaction,
    reactionJitter: tier.reactionJitter,
    mistake: tier.mistake,
    adaptation: tier.adaptation,
    hesitation: tier.hesitation,
    aggression: tier.aggression,
    usePlanner: tier.usePlanner,
  };
}

/**
 * Validação de integridade e contrato do nível de dificuldade.
 * Garante que a dificuldade não altere atributos do lutador (honestidade).
 * @param {string} tierName
 * @param {object} fighterAttributes
 */
export function contractCheckDifficulty(tierName, fighterAttributes = {}) {
  const tier = DIFFICULTY_TIERS[tierName];
  if (!tier) {
    throw new Error(`Nível de dificuldade desconhecido: "${tierName}"`);
  }

  // Contrato 1: Tempo de reação sempre perceptível e positivo (mínimo 50ms)
  if (tier.reaction < 0.05) {
    throw new Error(`Violação de dificuldade justa: reaction (${tier.reaction}s) menor que o limiar humano de 0.05s`);
  }

  // Contrato 2: Mistake rate positivo em todos os tiers
  if (tier.mistake < 0) {
    throw new Error(`Violação: mistake não pode ser negativo`);
  }

  // Contrato 3: Nenhum atributo de lutador (hp, attack, defense, speed) pode ser modificado
  const forbiddenKeys = ['hp', 'attack', 'defense', 'speed', 'stamina', 'weight'];
  for (const k of forbiddenKeys) {
    if (k in tier) {
      throw new Error(`Violação de dificuldade justa: tier define atributo ilegal "${k}"`);
    }
  }

  return {valid: true, tier: tier.id};
}
