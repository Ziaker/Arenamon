// Modelo observável do adversário e adaptação durante a luta (Fase 8).
//
// Princípios:
// 1. Percepção justa: observa somente estados públicos do adversário (ações, distâncias, exaustão visível).
// 2. Não reage a ruído isolado: exige limiar mínimo de amostras antes de confirmar hipóteses com alta confiança.
// 3. Decaimento temporal: dá maior peso a observações recentes com taxa adaptativa configurável.
// 4. Contraestratégias claras: sugere ajustes no espaçamento, probabilidade de isca (bait) e punição.

import {clamp} from './math.js';

const MIN_DEFENSE_SAMPLES = 4;
const MIN_ATTACK_SAMPLES = 3;
const MIN_STAMINA_SAMPLES = 3;

/** Inicializa um modelo de dados do adversário com priors neutros. */
export function initOpponentModel() {
  return {
    samples: {
      defense: 0,
      attack: 0,
      staminaObservations: 0,
      charges: 0,
    },
    // Distribuição de respostas defensivas (guard, dodge, clash, hit)
    defense: {
      guard: 0.25,
      dodge: 0.25,
      clash: 0.25,
      hit: 0.25,
    },
    // Distribuição de distância onde o adversário desfere ataques
    attackDistances: {
      close: 0.33, // < 2.2m
      mid: 0.34,   // 2.2m - 3.8m
      far: 0.33,   // > 3.8m
    },
    preferredAttackDistance: 2.8,
    // Comportamento de stamina
    staminaHabits: {
      exhaustCount: 0,
      lowStaminaTime: 0, // segundos em stamina < 2.0
      disciplinedFraction: 0.8,
    },
    // Comportamento ao carregar Moves
    chargeHabits: {
      totalCharges: 0,
      fullReleases: 0,
      earlyReleases: 0,
      averageHoldSeconds: 0,
    },
    // Hipóteses ativas com grau de confiança (0.0 a 1.0)
    hypotheses: {
      isTurtle: {active: false, confidence: 0},
      isDodger: {active: false, confidence: 0},
      isAggressive: {active: false, confidence: 0},
      isStaminaSpender: {active: false, confidence: 0},
      isLongCharger: {active: false, confidence: 0},
    },
  };
}

/**
 * Atualiza o modelo após observar uma resposta defensiva do adversário.
 * @param {object} model
 * @param {'guard'|'dodge'|'clash'|'hit'} response
 * @param {number} rate - taxa de aprendizado (0.1 a 0.5)
 */
export function recordOpponentDefense(model, response, rate = 0.25) {
  if (!model.defense[response] && model.defense[response] !== 0) return;
  model.samples.defense++;
  const n = model.samples.defense;
  const effectiveRate = n < MIN_DEFENSE_SAMPLES ? (1 / n) : clamp(rate, 0.1, 0.6);

  for (const k of ['guard', 'dodge', 'clash', 'hit']) {
    const targetVal = (k === response) ? 1.0 : 0.0;
    model.defense[k] = model.defense[k] + (targetVal - model.defense[k]) * effectiveRate;
  }

  // Atualiza hipóteses defensivas
  const confScale = clamp((n - 2) / 6, 0, 1);
  model.hypotheses.isTurtle = {
    active: n >= MIN_DEFENSE_SAMPLES && model.defense.guard >= 0.50,
    confidence: +(confScale * clamp((model.defense.guard - 0.35) / 0.45, 0, 1)).toFixed(2),
  };
  model.hypotheses.isDodger = {
    active: n >= MIN_DEFENSE_SAMPLES && model.defense.dodge >= 0.45,
    confidence: +(confScale * clamp((model.defense.dodge - 0.30) / 0.50, 0, 1)).toFixed(2),
  };
}

/**
 * Atualiza o modelo quando o adversário dispara um ataque.
 * @param {object} model
 * @param {number} distance - distância no momento do ataque
 * @param {number} rate
 */
export function recordOpponentAttack(model, distance, rate = 0.25) {
  model.samples.attack++;
  const n = model.samples.attack;
  const effectiveRate = n < MIN_ATTACK_SAMPLES ? (1 / n) : clamp(rate, 0.1, 0.5);

  const bucket = distance < 2.2 ? 'close' : distance <= 3.8 ? 'mid' : 'far';
  for (const k of ['close', 'mid', 'far']) {
    const targetVal = (k === bucket) ? 1.0 : 0.0;
    model.attackDistances[k] = model.attackDistances[k] + (targetVal - model.attackDistances[k]) * effectiveRate;
  }

  model.preferredAttackDistance = model.preferredAttackDistance + (distance - model.preferredAttackDistance) * effectiveRate;

  const confScale = clamp((n - 2) / 5, 0, 1);
  const aggressiveRatio = model.attackDistances.close + model.attackDistances.mid * 0.5;
  model.hypotheses.isAggressive = {
    active: n >= MIN_ATTACK_SAMPLES && aggressiveRatio >= 0.65,
    confidence: +(confScale * clamp(aggressiveRatio, 0, 1)).toFixed(2),
  };
}

/**
 * Atualiza o rastreamento de disciplina de stamina do oponente.
 * @param {object} model
 * @param {number} stamina
 * @param {boolean} exhausted
 * @param {number} dt
 * @param {boolean} [justExhausted]
 */
export function recordOpponentStamina(model, stamina, exhausted, dt, justExhausted = exhausted) {
  model.samples.staminaObservations++;
  if (justExhausted) {
    model.staminaHabits.exhaustCount++;
  }
  if (stamina < 2.0 || exhausted) {
    model.staminaHabits.lowStaminaTime += dt;
  }
  const isSpendingCarelessly = model.staminaHabits.exhaustCount >= 2 || model.staminaHabits.lowStaminaTime > 3.5;
  const confScale = clamp(model.staminaHabits.exhaustCount / 3, 0, 1);
  model.hypotheses.isStaminaSpender = {
    active: isSpendingCarelessly,
    confidence: +(confScale).toFixed(2),
  };
}

/**
 * Atualiza o comportamento de carregamento de moves.
 * @param {object} model
 * @param {number} holdDuration
 * @param {boolean} releasedAtMax
 */
export function recordOpponentCharge(model, holdDuration, releasedAtMax) {
  model.samples.charges++;
  model.chargeHabits.totalCharges++;
  if (releasedAtMax) {
    model.chargeHabits.fullReleases++;
  } else {
    model.chargeHabits.earlyReleases++;
  }
  const n = model.chargeHabits.totalCharges;
  model.chargeHabits.averageHoldSeconds += (holdDuration - model.chargeHabits.averageHoldSeconds) / n;

  const fullRatio = model.chargeHabits.fullReleases / n;
  model.hypotheses.isLongCharger = {
    active: n >= 2 && fullRatio >= 0.6 && model.chargeHabits.averageHoldSeconds >= 0.5,
    confidence: +(clamp((n / 3) * fullRatio, 0, 1)).toFixed(2),
  };
}

/**
 * Computa uma contraestratégia adaptada com base nas hipóteses validadas.
 * @param {object} model
 * @param {object} style - estilo da IA
 * @returns {object} recomendações táticas
 */
export function evaluateCounterStrategy(model, style) {
  const hyp = model.hypotheses;
  const strat = {
    recommendedPosture: 'neutral',
    spacingBias: 0.0,
    baitWeightMod: 1.0,
    delayAttack: false,
    exploitExhaustion: false,
    rushdownCharge: false,
    confidence: 0.0,
    activeHypothesis: null,
  };

  // 1. Adversário bloqueador compulsivo (Turtle)
  if (hyp.isTurtle.active && hyp.isTurtle.confidence >= 0.35) {
    strat.recommendedPosture = 'anti_turtle';
    strat.baitWeightMod = 1.6 + hyp.isTurtle.confidence * 0.8;
    strat.spacingBias = -0.2; // pressiona mais perto para gastar a guarda dele
    strat.activeHypothesis = 'turtle';
    strat.confidence = hyp.isTurtle.confidence;
  }
  // 2. Adversário esquivador compulsivo (Dodger)
  else if (hyp.isDodger.active && hyp.isDodger.confidence >= 0.35) {
    strat.recommendedPosture = 'anti_dodger';
    strat.delayAttack = true; // espera término da esquiva
    strat.baitWeightMod = 1.4;
    strat.spacingBias = 0.3; // mantém borda para forçar esquiva vazia
    strat.activeHypothesis = 'dodger';
    strat.confidence = hyp.isDodger.confidence;
  }
  // 3. Adversário agressivo (Rushdown / Impulsivo)
  else if (hyp.isAggressive.active && hyp.isAggressive.confidence >= 0.4) {
    strat.recommendedPosture = 'outspace';
    strat.spacingBias = 0.45; // fica logo fora do alcance dele
    strat.baitWeightMod = 1.3;
    strat.activeHypothesis = 'aggressive';
    strat.confidence = hyp.isAggressive.confidence;
  }

  // Condições auxiliares não mutuamente exclusivas:
  if (hyp.isStaminaSpender.active && hyp.isStaminaSpender.confidence >= 0.4) {
    strat.exploitExhaustion = true;
  }
  if (hyp.isLongCharger.active && hyp.isLongCharger.confidence >= 0.4) {
    strat.rushdownCharge = true;
  }

  return strat;
}
