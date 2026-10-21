// prototypes/combat-lab/src/sim/animation-combat-windows.js
// Contrato e validador programático de janelas de combate da animação na Arena.
// Unidade canônica: passo de simulação (definido pela configuração ativa, padrão 120 Hz).
// Semântica de intervalos: estritamente semiabertos [startStep, endStep).
// SOMENTE LEITURA / ISOLADO: não altera simulação, dano, física ou balanceamento.

export const SCHEMA_VERSION = '1.0.0';
export const DEFAULT_SIMULATION_FPS = 120;
export const DEFAULT_STEP_SECONDS = 1 / DEFAULT_SIMULATION_FPS; // ~0.008333333333333333 s

/**
 * Funções de conversão temporal parametrizadas pela taxa de passos da simulação.
 */
export function createTimeHelpers(stepSeconds = DEFAULT_STEP_SECONDS) {
  const step = Number(stepSeconds) > 0 ? Number(stepSeconds) : DEFAULT_STEP_SECONDS;
  const fps = Math.round(1 / step);
  return {
    stepSeconds: step,
    fps,
    stepToMs: s => s * step * 1000,
    msToStep: ms => Math.round((ms / 1000) / step),
    secondsToStep: sec => Math.round(sec / step),
    stepToSeconds: s => s * step
  };
}

const defaultHelpers = createTimeHelpers(DEFAULT_STEP_SECONDS);
export const stepsToMs = defaultHelpers.stepToMs;
export const msToSteps = defaultHelpers.msToStep;
export const secondsToSteps = defaultHelpers.secondsToStep;
export const stepsToSeconds = defaultHelpers.stepToSeconds;

/**
 * Extrai a duração real de uma animação (em segundos) a partir de um AnimationClip
 * do Three.js ou da estrutura bruta de samplers/accessors do glTF.
 * @param {Object} clip - Objeto AnimationClip ou nó glTF animation
 * @param {Array} [gltfAccessors] - Array de accessors se analisando glTF JSON bruto
 * @returns {number} Duração real em segundos
 */
export function extractClipDuration(clip, gltfAccessors = null) {
  if (!clip) return 0;
  // Three.js AnimationClip
  if (typeof clip.duration === 'number' && Number.isFinite(clip.duration) && clip.duration > 0) {
    return clip.duration;
  }
  // glTF animation raw JSON
  if (Array.isArray(clip.samplers) && Array.isArray(gltfAccessors)) {
    let maxTime = 0;
    for (const sampler of clip.samplers) {
      const accessor = gltfAccessors[sampler.input];
      if (accessor && Array.isArray(accessor.max) && typeof accessor.max[0] === 'number') {
        if (accessor.max[0] > maxTime) maxTime = accessor.max[0];
      }
    }
    if (maxTime > 0) return maxTime;
  }
  return 0;
}

/**
 * Cria um objeto de contrato AnimationCombatWindows versionado e normalizado.
 * Intervalos seguem estritamente a convenção semiaberta [startStep, endStep).
 * @param {Object} spec
 * @returns {Object} Contrato normalizado
 */
export function createAnimationCombatWindows(spec = {}) {
  const stepSec = Number(spec.stepSeconds ?? spec.stepDuration ?? DEFAULT_STEP_SECONDS);
  const helpers = createTimeHelpers(stepSec);

  const clipDurationSec = Number(spec.clipDurationSeconds ?? 1.0);
  const actionDurationSec = Number(spec.actionDurationSeconds ?? clipDurationSec);
  const clipDurationSteps = helpers.secondsToStep(clipDurationSec);
  const actionDurationSteps = helpers.secondsToStep(actionDurationSec);
  const timeScale = clipDurationSec > 1e-6 ? actionDurationSec / clipDurationSec : 1.0;

  return {
    schemaVersion: SCHEMA_VERSION,
    characterId: String(spec.characterId ?? 'unknown'),
    actionId: String(spec.actionId ?? 'tackle'),
    clipName: String(spec.clipName ?? 'unnamed_clip'),
    variantIndex: Number.isInteger(spec.variantIndex) ? spec.variantIndex : 0,
    variantId: spec.variantId ? String(spec.variantId) : null,
    unit: 'step',
    intervalSemantics: '[startStep, endStep)',
    stepSeconds: stepSec,
    fps: helpers.fps,
    clipDurationSeconds: +clipDurationSec.toFixed(4),
    clipDurationSteps,
    actionDurationSeconds: +actionDurationSec.toFixed(4),
    actionDurationSteps,
    timeScale: +timeScale.toFixed(4),

    // Janelas ativas ofensivas: lista de [startStep, endStep)
    activeWindows: (spec.activeWindows || []).map(([s, e]) => [Math.round(s), Math.round(e)]),
    // Forma espacial opcional de cada janela ativa (esfera à frente do atacante; ver extras.hitbox): [{forward, radius}] em metros.
    ...(Array.isArray(spec.shapes) ? {shapes: spec.shapes.map(sh => ({forward: Number(sh?.forward) || 0, radius: Math.max(0.05, Number(sh?.radius) || 0.4)}))} : {}),

    // Janelas de invulnerabilidade: lista de [startStep, endStep)
    invulnerabilityWindows: (spec.invulnerabilityWindows || []).map(([s, e]) => [Math.round(s), Math.round(e)]),

    // Janelas de cancelamento / encadeamento: lista de [startStep, endStep)
    cancelWindows: (spec.cancelWindows || []).map(([s, e]) => [Math.round(s), Math.round(e)]),

    // Marcador visual de recuperação (vindo da animação)
    recoveryStart: spec.recoveryStart != null ? Math.round(spec.recoveryStart) : null,

    // Impact hints (pista visual/áudio com passo e ms)
    impactHints: (spec.impactHints || []).map((h, idx) => ({
      step: Math.round(h.step ?? 0),
      timeMs: +(helpers.stepToMs(h.step ?? 0)).toFixed(2),
      hitIndex: Number.isInteger(h.hitIndex) ? h.hitIndex : idx,
      kind: h.kind ? String(h.kind) : 'impact',
      description: h.description ? String(h.description) : ''
    })),

    // Volume isolado apenas como metadado (não participa da física da Arena)
    volume: spec.volume ? {
      shape: spec.volume.shape || 'aabb',
      offset: spec.volume.offset ? [...spec.volume.offset] : [0, 0, 0],
      size: spec.volume.size ? [...spec.volume.size] : [1, 1, 1],
      boneName: spec.volume.boneName ? String(spec.volume.boneName) : null,
      metadataOnly: true
    } : null,

    source: {
      origin: spec.source?.origin || 'synthetic',
      rawEventCount: Number(spec.source?.rawEventCount ?? 0),
      computedAt: spec.source?.computedAt || new Date().toISOString()
    }
  };
}

/**
 * Converte eventos brutos de GLB/Studio para o contrato canônico em passos semiabertos [start, end).
 * O pareamento é realizado por IDENTIDADE dos eventos (não pelo número do passo quantizado).
 * @param {Array<Object>} rawEvents
 * @param {Object} options
 * @returns {Object} Contrato AnimationCombatWindows
 */
export function fromGlbEvents(rawEvents = [], options = {}) {
  const stepSec = Number(options.stepSeconds ?? DEFAULT_STEP_SECONDS);
  const helpers = createTimeHelpers(stepSec);

  const clipDurationSec = Number(options.clipDurationSeconds ?? 1.0);
  const actionDurationSec = Number(options.actionDurationSeconds ?? clipDurationSec);
  const scale = clipDurationSec > 1e-6 ? actionDurationSec / clipDurationSec : 1.0;
  const actionDurationSteps = helpers.secondsToStep(actionDurationSec);

  // Normaliza e identifica eventos individualmente
  const sorted = rawEvents.map((e, index) => {
    const rawTime = e.time != null ? Number(e.time) : (Number(e.frame || 0) / (options.sourceFps || 30));
    const scaledTimeSec = rawTime * scale;
    const step = helpers.secondsToStep(scaledTimeSec);
    const eventId = e.id != null ? String(e.id) : `event_${index}_${e.type}`;
    return {...e, id: eventId, rawTime, scaledTimeSec, step, index};
  }).sort((a, b) => a.rawTime - b.rawTime);

  const consumedIds = new Set();

  // 1. Pareamento de hitbox_on / hitbox_off por identidade
  const activeWindows = [];
  const onEvents = sorted.filter(e => e.type === 'hitbox_on');
  for (const onEv of onEvents) {
    const offEv = sorted.find(e => e.type === 'hitbox_off' && e.rawTime >= onEv.rawTime && !consumedIds.has(e.id));
    let endStep = actionDurationSteps;
    if (offEv) {
      consumedIds.add(offEv.id);
      endStep = offEv.step;
    }
    // Garante que endStep seja estritamente maior que startStep no intervalo semiaberto
    const finalEnd = Math.max(onEv.step + 1, endStep);
    activeWindows.push([onEv.step, finalEnd]);
  }

  // 2. Pareamento de invulnerable_start / invulnerable_end por identidade
  const invulnerabilityWindows = [];
  const invStartEvents = sorted.filter(e => e.type === 'invulnerable_start');
  for (const startEv of invStartEvents) {
    const endEv = sorted.find(e => e.type === 'invulnerable_end' && e.rawTime >= startEv.rawTime && !consumedIds.has(e.id));
    let endStep = actionDurationSteps;
    if (endEv) {
      consumedIds.add(endEv.id);
      endStep = endEv.step;
    }
    const finalEnd = Math.max(startEv.step + 1, endStep);
    invulnerabilityWindows.push([startEv.step, finalEnd]);
  }

  // 3. Marcador de recuperação visual
  const recEv = sorted.find(e => e.type === 'recovery_start');
  const recoveryStart = recEv ? recEv.step : null;

  // 4. Impact hints
  const impactHints = sorted.filter(e => e.type === 'impact').map((e, idx) => ({
    step: e.step,
    timeMs: +(helpers.stepToMs(e.step)).toFixed(2),
    hitIndex: idx,
    kind: 'impact',
    description: e.label || 'Impacto marcado no GLB'
  }));

  return createAnimationCombatWindows({
    characterId: options.characterId,
    actionId: options.actionId,
    clipName: options.clipName,
    variantIndex: options.variantIndex ?? 0,
    variantId: options.variantId,
    stepSeconds: stepSec,
    clipDurationSeconds: clipDurationSec,
    actionDurationSeconds: actionDurationSec,
    activeWindows,
    invulnerabilityWindows,
    cancelWindows: [],
    recoveryStart,
    impactHints,
    volume: options.volume || null,
    source: {
      origin: 'glb_events',
      rawEventCount: rawEvents.length
    }
  });
}

/**
 * Consulta as janelas efetivas reais da simulação da Arena para a ação,
 * a partir do snapshot vivo de configuração (C).
 * Distingue formalmente chainAfter de recuperação e inclui invulnerabilidade do tackle e esquiva.
 * @param {string} actionId
 * @param {Object} config - Objeto de configuração da Arena (C)
 * @returns {Object} Janelas efetivas nominais da Arena
 */
export function effectiveArenaWindows(actionId, config = {}) {
  const stepSec = config.test?.step ?? DEFAULT_STEP_SECONDS;
  const helpers = createTimeHelpers(stepSec);
  const actions = config.actions || {};
  const toggles = config.extras?.toggles || {enableInvulnerability: 1};

  if (actionId === 'tackle') {
    const durSec = actions.tackle?.duration ?? 0.40;
    const durSteps = helpers.secondsToStep(durSec);
    const chainAfterSec = actions.tackle?.chainAfter ?? 0.20;
    const chainAfterSteps = helpers.secondsToStep(chainAfterSec);
    const invSec = (toggles.enableInvulnerability && actions.tackle?.invulnerable > 0) ? actions.tackle.invulnerable : 0;
    const invSteps = helpers.secondsToStep(invSec);

    return {
      actionId: 'tackle',
      stepSeconds: stepSec,
      fps: helpers.fps,
      durationSteps: durSteps,
      durationMs: durSec * 1000,
      intervalSemantics: '[startStep, endStep)',
      // Na Arena atual, tackle é ofensivo em 100% da ação [0, durationSteps)
      activeWindows: [[0, durSteps]],
      // Tackle possui invulnerabilidade própria se ativada
      invulnerabilityWindows: invSteps > 0 ? [[0, invSteps]] : [],
      // chainAfter indica a partir de qual passo o cancelamento para outra ação é permitido
      chainAfterStep: chainAfterSteps,
      chainAfterMs: chainAfterSec * 1000,
      recoveryMechanicalTime: actions.tackle?.recoveryTime ? helpers.secondsToStep(actions.tackle.recoveryTime) : 0,
      note: 'Arena atual: tackle ofensivo durante toda a duração [0, duration); invulnerabilidade nominal configurável.'
    };
  }

  if (actionId.startsWith('dodge') || actionId === 'vault') {
    const durSec = actions.dodge?.duration ?? 0.40;
    const durSteps = helpers.secondsToStep(durSec);
    const chainAfterSec = actions.dodge?.chainAfter ?? 0.20;
    const chainAfterSteps = helpers.secondsToStep(chainAfterSec);
    const invSec = (toggles.enableInvulnerability && actions.dodge?.invulnerable > 0) ? actions.dodge.invulnerable : 0;
    const invSteps = helpers.secondsToStep(invSec);

    // Cancelamento C -> X (windowMode e fromEnd)
    const cancelSettings = actions.cancel || actions.dodge?.cancel || {};
    let cancelWindowSteps = null;
    if (cancelSettings.dodgeToTackle) {
      const fromEndSec = cancelSettings.windowMode === 1 ? (cancelSettings.fromEnd ?? 0.15) : (durSec - (cancelSettings.windowStart ?? 0));
      const cancelStartStep = Math.max(0, helpers.secondsToStep(durSec - fromEndSec));
      cancelWindowSteps = [cancelStartStep, durSteps];
    }

    return {
      actionId,
      stepSeconds: stepSec,
      fps: helpers.fps,
      durationSteps: durSteps,
      durationMs: durSec * 1000,
      intervalSemantics: '[startStep, endStep)',
      activeWindows: [],
      invulnerabilityWindows: invSteps > 0 ? [[0, invSteps]] : [],
      chainAfterStep: chainAfterSteps,
      chainAfterMs: chainAfterSec * 1000,
      cancelWindow: cancelWindowSteps,
      recoveryMechanicalTime: actions.dodge?.recoveryTime ? helpers.secondsToStep(actions.dodge.recoveryTime) : 0,
      note: 'Arena atual: esquiva defensiva sem hitbox ativa; invulnerabilidade nominal no início.'
    };
  }

  return {
    actionId,
    stepSeconds: stepSec,
    fps: helpers.fps,
    durationSteps: 0,
    durationMs: 0,
    intervalSemantics: '[startStep, endStep)',
    activeWindows: [],
    invulnerabilityWindows: [],
    chainAfterStep: null,
    chainAfterMs: null,
    note: 'Ação sem janelas nominais padronizadas na Arena.'
  };
}

/**
 * Validador estrutural e temporal programático do contrato AnimationCombatWindows.
 * Verifica estritamente a integridade de tipos, limites de intervalo semiaberto [start, end),
 * ausência de NaN/Infinity, pareamento de eventos, sobreposições e quantização temporal.
 *
 * @param {Object} contract
 * @param {Array} [rawEvents]
 * @param {Object} [options]
 * @returns {{valid: boolean, errors: Array<{code: string, message: string, details?: any}>, warnings: Array<{code: string, message: string, details?: any}>}}
 */
export function validateCombatWindows(contract, rawEvents = null, options = {}) {
  const errors = [];
  const warnings = [];

  if (!contract || typeof contract !== 'object') {
    return {valid: false, errors: [{code: 'INVALID_CONTRACT_OBJECT', message: 'Contrato não é um objeto.'}], warnings: []};
  }

  // Validação de stepSeconds e compatibilidade
  const stepSec = Number(contract.stepSeconds);
  if (!Number.isFinite(stepSec) || stepSec <= 0) {
    errors.push({code: 'INVALID_STEP_SECONDS', message: `stepSeconds inválido: ${contract.stepSeconds}. Deve ser número positivo finito.`});
  } else if (options.expectedStepSeconds && Math.abs(stepSec - options.expectedStepSeconds) > 1e-6) {
    errors.push({
      code: 'INCOMPATIBLE_TICK_RATE',
      message: `Taxa do contrato (${(1 / stepSec).toFixed(1)} Hz) diverge da simulação esperada (${(1 / options.expectedStepSeconds).toFixed(1)} Hz).`
    });
  }

  const durSteps = Number(contract.actionDurationSteps);
  if (!Number.isFinite(durSteps) || durSteps <= 0) {
    errors.push({code: 'INVALID_ACTION_DURATION', message: `actionDurationSteps inválido: ${contract.actionDurationSteps}.`});
    return {valid: false, errors, warnings};
  }

  // Validação de cada janela em formato semiaberto [startStep, endStep)
  const validateInterval = (windowPair, name) => {
    if (!Array.isArray(windowPair) || windowPair.length !== 2) {
      errors.push({code: 'MALFORMED_WINDOW_TUPLE', message: `${name} não é uma tupla [start, end]: ${JSON.stringify(windowPair)}`});
      return;
    }
    const [start, end] = windowPair;
    if (typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || Number.isNaN(start) || Number.isNaN(end)) {
      errors.push({code: 'NAN_OR_INFINITY_IN_WINDOW', message: `${name} contém NaN ou Infinity: [${start}, ${end}].`, details: {window: windowPair}});
      return;
    }
    if (start < 0 || end < 0) {
      errors.push({code: 'NEGATIVE_TIME', message: `${name} possui tempo negativo: [${start}, ${end}].`, details: {window: windowPair}});
    }
    if (start > durSteps || end > durSteps) {
      errors.push({code: 'TIME_EXCEEDS_DURATION', message: `${name} ultrapassa duração máxima (${durSteps} passos): [${start}, ${end}].`, details: {window: windowPair, durSteps}});
    }
    // No intervalo semiaberto [start, end), start deve ser estritamente menor que end (duração > 0)
    if (start >= end) {
      errors.push({code: 'EMPTY_OR_INVERTED_WINDOW', message: `${name} [${start}, ${end}) é vazio ou invertido (start >= end).`, details: {window: windowPair}});
    }
  };

  for (const w of contract.activeWindows || []) validateInterval(w, 'activeWindow');
  for (const w of contract.invulnerabilityWindows || []) validateInterval(w, 'invulnerabilityWindow');
  for (const w of contract.cancelWindows || []) validateInterval(w, 'cancelWindow');

  // Marcador de recuperação visual
  if (contract.recoveryStart != null) {
    const rec = Number(contract.recoveryStart);
    if (!Number.isFinite(rec) || Number.isNaN(rec)) {
      errors.push({code: 'NAN_IN_RECOVERY_START', message: `recoveryStart contém NaN ou valor não-finito: ${contract.recoveryStart}`});
    } else if (rec < 0) {
      errors.push({code: 'NEGATIVE_RECOVERY_START', message: `recoveryStart negativo: ${rec}.`});
    } else if (rec > durSteps) {
      errors.push({code: 'RECOVERY_START_EXCEEDS_DURATION', message: `recoveryStart (${rec}) ultrapassa duração da ação (${durSteps} passos).`});
    }
  }

  // Impact hints
  for (const h of contract.impactHints || []) {
    if (typeof h.step !== 'number' || !Number.isFinite(h.step) || Number.isNaN(h.step)) {
      errors.push({code: 'NAN_IN_IMPACT_HINT', message: `impactHint contém step inválido: ${h.step}`});
    } else if (h.step < 0 || h.step > durSteps) {
      errors.push({code: 'IMPACT_HINT_OUT_OF_BOUNDS', message: `impactHint no passo ${h.step} fora de [0, ${durSteps}].`});
    }
  }

  // Volume metadata (validação estrutural de vetores e tamanhos positivos)
  if (contract.volume) {
    const v = contract.volume;
    if (!['aabb', 'sphere', 'box', 'capsule'].includes(v.shape)) {
      errors.push({code: 'INVALID_VOLUME_SHAPE', message: `Forma de volume não suportada: ${v.shape}.`});
    }
    if (!Array.isArray(v.offset) || v.offset.length !== 3 || v.offset.some(x => typeof x !== 'number' || !Number.isFinite(x) || Number.isNaN(x))) {
      errors.push({code: 'INVALID_VOLUME_OFFSET', message: `Volume offset deve ser array de 3 números finitos: ${JSON.stringify(v.offset)}.`});
    }
    if (!Array.isArray(v.size) || v.size.length !== 3 || v.size.some(x => typeof x !== 'number' || !Number.isFinite(x) || x <= 0 || Number.isNaN(x))) {
      errors.push({code: 'INVALID_VOLUME_SIZE', message: `Volume size deve ser array de 3 números estritamente positivos: ${JSON.stringify(v.size)}.`});
    }
    if (v.metadataOnly !== true) {
      errors.push({code: 'VOLUME_MUST_BE_METADATA_ONLY', message: 'Volume deve ser marcado explicitamente com metadataOnly: true.'});
    }
  }

  // Sobreposição de intervalos semiabertos [s1, e1) e [s2, e2)
  // Dois intervalos semiabertos colidem se e somente se max(s1, s2) < min(e1, e2)
  const sortedActive = [...(contract.activeWindows || [])].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < sortedActive.length - 1; i++) {
    const [s1, e1] = sortedActive[i];
    const [s2, e2] = sortedActive[i + 1];
    if (Math.max(s1, s2) < Math.min(e1, e2)) {
      errors.push({
        code: 'OVERLAPPING_ACTIVE_WINDOWS',
        message: `Sobreposição inválida de janelas ativas semiabertas: [${s1}, ${e1}) colide com [${s2}, ${e2}). Em golpes múltiplos, w2.start >= w1.end.`,
        details: {w1: [s1, e1], w2: [s2, e2]}
      });
    }
  }

  // Aviso de colisão de janela ativa com início da recuperação visual
  if (contract.recoveryStart != null) {
    for (const [start, end] of contract.activeWindows || []) {
      if (end > contract.recoveryStart) {
        warnings.push({
          code: 'ACTIVE_WINDOW_PAST_RECOVERY',
          message: `Janela ativa [${start}, ${end}) se estende além do marcador recovery_start (${contract.recoveryStart}).`,
          details: {window: [start, end], recoveryStart: contract.recoveryStart}
        });
      }
    }
  }

  // Verificação de eventos brutos do GLB (se fornecidos)
  if (Array.isArray(rawEvents)) {
    const typeCounts = {};
    const seenIds = new Set();
    for (const e of rawEvents) {
      typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
      if (e.id) {
        if (seenIds.has(e.id)) {
          warnings.push({code: 'DUPLICATE_EVENT_ID', message: `ID de evento duplicado no GLB: ${e.id}`});
        }
        seenIds.add(e.id);
      }
    }

    const onCount = typeCounts['hitbox_on'] || 0;
    const offCount = typeCounts['hitbox_off'] || 0;
    if (onCount !== offCount) {
      warnings.push({
        code: 'UNPAIRED_HITBOX_EVENTS',
        message: `Hitbox não pareada no GLB: ${onCount} hitbox_on para ${offCount} hitbox_off.`,
        details: {onCount, offCount}
      });
    }

    const invStartCount = typeCounts['invulnerable_start'] || 0;
    const invEndCount = typeCounts['invulnerable_end'] || 0;
    if (invStartCount !== invEndCount) {
      warnings.push({
        code: 'UNPAIRED_INVULNERABLE_EVENTS',
        message: `Invulnerabilidade não pareada no GLB: ${invStartCount} invulnerable_start para ${invEndCount} invulnerable_end.`,
        details: {invStartCount, invEndCount}
      });
    }

    if (rawEvents.length === 0) {
      warnings.push({
        code: 'VARIANT_WITHOUT_EVENTS',
        message: `A variante “${contract.clipName}” não possui nenhum evento de combate no GLB.`
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
