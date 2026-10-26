// @ts-check
// Auditoria e Catálogo Completo de Mecânica dos Moves (Fases 1, 2 e 3 do Overhaul dos Sliders Mecânicos).
// Este módulo é puro e seguro para navegador e Node:
//   1. Conecta cada Move aos seus parâmetros EXCLUSIVOS (da ficha .move.json), HERDADOS (de sistemas compartilhados:
//      Charge, Tackle, Combate global e IA), CALCULADOS (fórmulas derivadas ao vivo) e TÉCNICOS (constantes justificadas);
//   2. Verifica que todo parâmetro exclusivo possui categoria oficial (uma das 16 obrigatórias), nível de profundidade,
//      faixa efetiva única e consumidor real no motor;
//   3. Analisa sintaticamente o código-fonte JS dos Moves para impedir números mecânicos escondidos.

import {
  MOVE_MECHANIC_CATEGORIES,
  PARAM_KINDS,
  PARAM_TIERS,
  classifyParamRow,
  effectiveRangeOf,
  moveParamGroups,
} from './params-registry.js';

/**
 * Constantes técnicas explicitamente identificadas, justificadas e bloqueadas na interface (Regra Central §2).
 * Qualquer literal numérico no código de um Move que não seja um parâmetro editável precisa pertencer a uma destas
 * classes técnicas justificadas; caso contrário o teste `moves-mechanics-audit.test.mjs` falha.
 */
export const TECHNICAL_CONSTANTS = Object.freeze([
  {
    id: 'IEEE754_EPSILON',
    values: [1e-12, 1e-9, 1e-8, 1e-6, 1e-4, 0.001],
    unit: 'num',
    scope: 'Todos os Moves',
    file: 'src/sim/moves/*.js',
    reason: 'Tolerâncias numéricas de ponto flutuante IEEE-754 para evitar divisão por zero e erros de borda em ticks de 120 Hz.',
  },
  {
    id: 'DEG_RAD_CONVERSION',
    values: [180, 360],
    unit: 'deg',
    scope: 'psyshock, swift, emerging-stone, bullet-punch',
    file: 'src/sim/moves/*.js',
    reason: 'Fator matemático exato de conversão entre graus e radianos (π / 180° e 2π = 360°).',
  },
  {
    id: 'CHARGE_PL_LEVELS',
    values: [1, 2, 3],
    unit: 'int',
    scope: 'reflect, psyshock, water-pulse, guard-break, bounce',
    file: 'src/sim/charge.js',
    reason: 'Identificadores inteiros dos níveis de Power Level (PL1, PL2, PL3) e divisão de 50% da carga para o PL2 (regra M19.1).',
  },
  {
    id: 'BISECTION_STEPS',
    values: [24, 32],
    unit: 'int',
    scope: 'reflect, bullet-punch',
    file: 'src/sim/moves/reflect.js, src/sim/moves/bullet-punch.js',
    reason: 'Passos da busca binária geométrica (precisão > 10⁻⁷ m ao ajustar largura da barreira ou encostar no obstáculo).',
  },
  {
    id: 'SPATIAL_SEARCH_TOPOLOGY',
    values: [8, 16, 4096, -2, 2],
    unit: 'int',
    scope: 'sand-wave, emerging-stone, bullet-punch, psyshock, swift',
    file: 'src/sim/sand.js, src/sim/moves/emerging-stone.js, src/sim/moves/bullet-punch.js',
    reason: 'Topologia discreta de vizinhança (8 direções na grade A*, 16 direções radiais no anel de busca, limite de segurança de 4096 nós).',
  },
  {
    id: 'GROUND_PROBE_OFFSET',
    values: [0.3],
    unit: 'm',
    scope: 'emerging-stone, spikes',
    file: 'src/sim/stone.js, src/sim/trap.js',
    reason: 'Offset vertical técnico acima da base do objeto para iniciar a sondagem de altura do piso (getGroundHeight).',
  },
  {
    id: 'GEOMETRIC_COLLISION_MARGINS',
    values: [0.01, 0.02, 0.05, 0.06, 0.2, 0.9, 0.95, 0.98],
    unit: 'm',
    scope: 'bullet-punch, quick-attack, sand-wave, emerging-stone',
    file: 'src/sim/moves/bullet-punch.js, src/sim/moves/quick-attack.js, src/sim/sand.js, src/sim/stone.js',
    reason: 'Margens geométricas sub-métricas de segurança de colisão AABB (1 cm–20 cm), piso mínimo de passo de raycast (5 cm) e folga de separação (90%–98%).',
  },
]);

/** Conjunto de literais técnicos/matemáticos/índices permitidos fora de `P.<chave>`. */
export const ALLOWED_TECHNICAL_NUMBERS = new Set([
  0, 1, -1, 2, -2, 3, 4, 0.5, 0.25, 0.1,
  ...TECHNICAL_CONSTANTS.flatMap(c => c.values),
]);

/**
 * Analisa sintaticamente o código JS de um Move (sem dependências externas) e devolve qualquer literal numérico que NÃO seja:
 *  - dentro de comentários ou strings;
 *  - dentro do bloco declarativo `ai: {...}` de `defineFicha`;
 *  - o lado direito (fallback defensivo) de `?? <numero>`;
 *  - uma constante técnica/matemática/índice autorizada em `ALLOWED_TECHNICAL_NUMBERS`.
 * @param {string} code
 * @param {string} fileLabel
 * @returns {Array<{file: string, line: number, value: number, context: string}>}
 */
export function findUnclassifiedMoveNumbers(code, fileLabel) {
  const lines = code.split(/\r?\n/);
  // 1. Substitui comentários e strings por espaços preservando quebras de linha (para manter números de linha exatos)
  let clean = code.replace(/\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, m => m.replace(/[^\r\n]/g, ' '));
  // 2. Remove blocos declarativos `ai: { ... }` (balanceamento de IA declarativo na ficha)
  clean = clean.replace(/\bai\s*:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, m => m.replace(/[^\r\n]/g, ' '));
  // 3. Remove fallbacks defensivos `?? <numero>` ou `?? -<numero>` (quando o parâmetro já é lido à esquerda de `??`)
  clean = clean.replace(/\?\?\s*-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi, m => m.replace(/[^\r\n]/g, ' '));

  /** @type {Array<{file: string, line: number, value: number, context: string}>} */
  const offenders = [];
  const cleanLines = clean.split(/\r?\n/);
  const numRe = /(?<![a-zA-Z0-9_$])(-?(?:\d+\.\d+|\.\d+|\d+)(?:e[+-]?\d+)?)(?![a-zA-Z0-9_$])/gi;

  for (let i = 0; i < cleanLines.length; i++) {
    const ln = cleanLines[i];
    let match;
    numRe.lastIndex = 0;
    while ((match = numRe.exec(ln)) !== null) {
      const raw = match[1];
      const val = Number(raw);
      if (!Number.isFinite(val)) continue;
      if (!ALLOWED_TECHNICAL_NUMBERS.has(val) && !ALLOWED_TECHNICAL_NUMBERS.has(Math.abs(val))) {
        offenders.push({
          file: fileLabel,
          line: i + 1,
          value: val,
          context: (lines[i] ?? '').trim(),
        });
      }
    }
  }
  return offenders;
}

/** Moves que usam o sistema compartilhado de Carga (Charge). */
const CHARGE_MOVES = new Set(['reflect', 'psyshock', 'water-pulse', 'guard-break', 'bounce']);
/** Moves que usam a física e curvas compartilhadas do Tackle (`def.tackle` ou contra-golpe de Tackle). */
const TACKLE_MOVES = new Set(['lunge', 'guard-break', 'quick-attack', 'bullet-punch', 'riposte']);
/** Moves que causam dano direto ou por entidade e interagem com defesa/hitstop/Ataque de referência. */
const OFFENSIVE_MOVES = new Set([
  'psyshock', 'reflect', 'swift', 'lunge', 'guard-break', 'bounce', 'spikes', 'sand-wave',
  'bullet-punch', 'emerging-stone', 'riposte', 'quick-attack', 'water-pulse', 'fire-spin', 'air-slash', 'seed-bomb',
]);

/**
 * Devolve os parâmetros HERDADOS de sistemas compartilhados que influenciam mecanicamente o Move indicado.
 * Cada item aponta para o caminho real na configuração viva (`world.charge.*`, `actions.tackle.*`, `world.ai.*`, etc.),
 * permitindo inspecionar e ajustar o valor herdado direto do Editor de Moves.
 * @param {string} moveId
 * @param {string} group
 * @returns {Array<{path: string, group: string, key: string, label: string, tip: string, min: number, max: number, step: number, unit: string, category: string, consumer: {file: string, fn: string}, overriddenBy?: string}>}
 */
export function getInheritedParamsForMove(moveId, group) {
  /** @type {Array<{path: string, group: string, key: string, label: string, tip: string, min: number, max: number, step: number, unit: string, category: string, consumer: {file: string, fn: string}, overriddenBy?: string}>} */
  const list = [];

  if (CHARGE_MOVES.has(moveId)) {
    list.push(
      {
        path: 'world.charge.moveSlow', group: 'charge', key: 'moveSlow',
        label: 'Velocidade na carga (herdada)',
        tip: 'Fração da velocidade normal de caminhada enquanto segura o botão de carga (M2.6). Compartilhado por todos os Moves de Charge.',
        min: 0.2, max: 1, step: 0.01, unit: 'pct', category: 'Movimentação',
        consumer: {file: 'src/sim/controller/ctrl-basico.js', fn: 'walkSpeed'},
      },
      {
        path: 'world.charge.turnSlow', group: 'charge', key: 'turnSlow',
        tip: 'Fração da velocidade de giro enquanto carrega (M11.7). Compartilhado pelos Moves de Charge.',
        label: 'Giro na carga (herdado)',
        min: 0.2, max: 1, step: 0.01, unit: 'pct', category: 'Movimentação',
        consumer: {file: 'src/sim/controller/ctrl-basico.js', fn: 'turnToward'},
      },
      {
        path: 'world.charge.dodgeCancelAfter', group: 'charge', key: 'dodgeCancelAfter',
        label: 'Esquiva cancela a carga após (herdado)',
        tip: 'Tempo mínimo de carga antes de a esquiva poder cancelá-la (M16.2).',
        min: 0, max: 1, step: 0.01, unit: 'sec', category: 'Cancelamentos',
        consumer: {file: 'src/sim/charge.js', fn: 'chargeParams'},
      },
      {
        path: 'world.charge.interruptCooldownFactor', group: 'charge', key: 'interruptCooldownFactor',
        label: 'Fator de recarga ao interromper carga (herdado)',
        tip: 'Fração do cooldown cobrada quando a carga é cancelada ou interrompida (M7.3).',
        min: 0, max: 1, step: 0.01, unit: 'pct', category: 'Recursos',
        consumer: {file: 'src/sim/charge.js', fn: 'interruptCooldown'},
      },
      {
        path: 'world.charge.recovery', group: 'charge', key: 'recovery',
        label: 'Recuperação pós-soltura (herdada)',
        tip: 'Tempo sem novos Moves após soltar a carga (M26s.8). No Water Pulse, substituído por chargeRecovery.',
        min: 0, max: 1, step: 0.01, unit: 'sec', category: 'Preparação',
        consumer: {file: 'src/sim/charge.js', fn: 'chargeParams'},
        ...(moveId === 'water-pulse' ? {overriddenBy: `${group}.chargeRecovery`} : {}),
      },
      {
        path: 'world.charge.bufferWindow', group: 'charge', key: 'bufferWindow',
        label: 'Buffer no fim da esquiva (herdado)',
        tip: 'Janela no fim da esquiva em que segurar o Move agenda o início da carga (M16.3).',
        min: 0, max: 0.5, step: 0.01, unit: 'sec', category: 'Cancelamentos',
        consumer: {file: 'src/sim/charge.js', fn: 'chargeParams'},
      },
    );
  }

  // Aceleração manual de recarga (M5.8): vale para todos os Moves
  list.push(
    {
      path: 'world.charge.boostStaminaPerSecond', group: 'charge', key: 'boostStaminaPerSecond',
      label: 'Custo de acelerar recarga (herdado)',
      tip: 'Stamina gasta por segundo de cooldown removido ao apertar o botão durante a recarga (M5.8).',
      min: 0, max: 3, step: 0.05, unit: 'num', category: 'Recursos',
      consumer: {file: 'src/sim/charge.js', fn: 'boostPlan'},
    },
    {
      path: 'world.charge.boostStep', group: 'charge', key: 'boostStep',
      label: 'Recarga removida por toque (herdado)',
      tip: 'Segundos de cooldown encurtados a cada toque extra no botão (M5.8).',
      min: 0.25, max: 4, step: 0.25, unit: 'sec', category: 'Recursos',
      consumer: {file: 'src/sim/charge.js', fn: 'boostPlan'},
    },
  );

  if (TACKLE_MOVES.has(moveId)) {
    list.push(
      {
        path: 'actions.tackle.prepTime', group: 'tackle', key: 'prepTime',
        label: 'Curva do Tackle: fração de preparo (herdada)',
        tip: 'Fração inicial da duração do golpe em velocidade reduzida de preparação (sim/motion.js).',
        min: 0, max: 0.3, step: 0.01, unit: 'pct', category: 'Movimentação',
        consumer: {file: 'src/sim/motion.js', fn: 'actionSpeedFactor'},
      },
      {
        path: 'actions.tackle.impulseTime', group: 'tackle', key: 'impulseTime',
        label: 'Curva do Tackle: fim do impulso (herdado)',
        tip: 'Fração da duração em que a investida atinge a velocidade de cruzeiro (sim/motion.js).',
        min: 0.02, max: 0.4, step: 0.01, unit: 'pct', category: 'Movimentação',
        consumer: {file: 'src/sim/motion.js', fn: 'actionSpeedFactor'},
      },
      {
        path: 'actions.tackle.decelStart', group: 'tackle', key: 'decelStart',
        label: 'Curva do Tackle: início da frenagem (herdado)',
        tip: 'Fração da duração em que começa a desaceleração da investida (sim/motion.js).',
        min: 0.2, max: 0.9, step: 0.01, unit: 'pct', category: 'Movimentação',
        consumer: {file: 'src/sim/motion.js', fn: 'actionSpeedFactor'},
      },
      {
        path: 'actions.tackle.travelEnd', group: 'tackle', key: 'travelEnd',
        label: 'Curva do Tackle: fim do avanço (herdado)',
        tip: 'Fração da duração em que o deslocamento físico termina e resta a recuperação (sim/motion.js).',
        min: 0.3, max: 0.95, step: 0.01, unit: 'pct', category: 'Movimentação',
        consumer: {file: 'src/sim/motion.js', fn: 'actionSpeedFactor'},
      },
    );
  }

  if (OFFENSIVE_MOVES.has(moveId)) {
    list.push(
      {
        path: 'extras.combat.guardDamageMultiplier', group: 'combat', key: 'guardDamageMultiplier',
        label: 'Multiplicador de dano na guarda comum (herdado)',
        tip: 'Fração do dano que atravessa a defesa comum (Sand Wave substitui por partialFactor).',
        min: 0, max: 1, step: 0.05, unit: 'pct', category: 'Defesa e Counter',
        consumer: {file: 'src/sim/world/world-hit.js', fn: 'applyHit'},
        ...(moveId === 'sand-wave' ? {overriddenBy: 'sandWave.partialFactor'} : {}),
      },
      {
        path: 'extras.combat.impactHitstop', group: 'combat', key: 'impactHitstop',
        label: 'Hitstop base de impacto (herdado)',
        tip: 'Congelamento base de impacto em segundos (Riposte multiplica por hitstopMult).',
        min: 0, max: 0.2, step: 0.005, unit: 'sec', category: 'Interações globais',
        consumer: {file: 'src/sim/combat.js', fn: 'resolveHit'},
      },
    );
  }

  // Parâmetros de IA herdados
  if (moveId === 'reflect') {
    list.push(
      {
        path: 'world.ai.reflectHold', group: 'ai', key: 'reflectHold',
        label: 'IA: tempo mínimo segurando Reflect',
        tip: 'Tempo que a IA segura o Reflect antes de soltar.',
        min: 0.5, max: 4, step: 0.05, unit: 'sec', category: 'IA do Move',
        consumer: {file: 'src/sim/ai-moves.js', fn: 'stepMoveBrain'},
      },
      {
        path: 'world.ai.barrierBreakRange', group: 'ai', key: 'barrierBreakRange',
        label: 'IA: alcance para quebrar barreira com Tackle',
        tip: 'Distância abaixo da qual a IA tenta quebrar uma barreira Reflect inimiga.',
        min: 0, max: 8, step: 0.1, unit: 'm', category: 'IA do Move',
        consumer: {file: 'src/sim/ai-moves.js', fn: 'stepMoveBrain'},
      },
    );
  } else if (moveId === 'psyshock') {
    list.push(
      {
        path: 'world.ai.psyshockMinDistance', group: 'ai', key: 'psyshockMinDistance',
        label: 'IA: distância mínima para Psyshock',
        tip: 'Distância mínima do alvo para a IA iniciar o Psyshock.',
        min: 0, max: 12, step: 0.1, unit: 'm', category: 'IA do Move',
        consumer: {file: 'src/sim/ai-moves.js', fn: 'stepMoveBrain'},
      },
      {
        path: 'world.ai.pl2Distance', group: 'ai', key: 'pl2Distance',
        label: 'IA: distância para carregar até PL2',
        tip: 'Distância a partir da qual a IA segura o Psyshock até o PL2.',
        min: 0, max: 15, step: 0.1, unit: 'm', category: 'IA do Move',
        consumer: {file: 'src/sim/ai-moves.js', fn: 'stepMoveBrain'},
      },
      {
        path: 'world.ai.pl3Distance', group: 'ai', key: 'pl3Distance',
        label: 'IA: distância para carregar até PL3',
        tip: 'Distância a partir da qual a IA segura o Psyshock até o PL3.',
        min: 0, max: 20, step: 0.1, unit: 'm', category: 'IA do Move',
        consumer: {file: 'src/sim/ai-moves.js', fn: 'stepMoveBrain'},
      },
    );
  } else {
    list.push({
      path: 'world.ai.newMovesRate', group: 'ai', key: 'newMovesRate',
      label: 'IA: multiplicador de frequência dos Moves novos',
      tip: 'Escala a probabilidade declarativa de a IA usar este Move quando equipado.',
      min: 0, max: 3, step: 0.1, unit: 'x', category: 'IA do Move',
      consumer: {file: 'src/sim/ai-moves.js', fn: 'decideNewMove'},
    });
  }

  return list;
}

/**
 * Calcula ao vivo os valores derivados por fórmula mecânica para um Move a partir do estado atual de `C`.
 * @param {string} moveId
 * @param {string} group
 * @param {Record<string, any>} worldObj `C.world`
 * @param {{attackRef?: number, bodyHeight?: number, halfExtent?: number}} [ctx]
 * @returns {Array<{id: string, label: string, formula: string, value: string, category: string, consumer: string}>}
 */
export function getCalculatedValuesForMove(moveId, group, worldObj, ctx = {}) {
  const P = worldObj?.[group] ?? {};
  const atk = ctx.attackRef ?? 20;
  const bodyH = ctx.bodyHeight ?? 1.3;
  const bodyW = 2 * (ctx.halfExtent ?? 0.5);
  const f2 = (/** @type {number} */ n) => Number.isFinite(n) ? +n.toFixed(2) : 0;

  switch (moveId) {
    case 'sand-wave': {
      const T = Math.max(0.05, P.active ?? 0.75), L = P.length ?? 4, a = P.accel ?? 12;
      const v0 = (L - 0.5 * a * T * T) / T;
      const vf = v0 + a * T;
      return [
        {id: 'v0', label: 'Velocidade inicial da frente (v₀)', formula: '(length − ½·accel·active²) ÷ active', value: `${f2(v0)} m/s`, category: 'Movimentação', consumer: 'src/sim/sand.js:sandSpeed'},
        {id: 'vf', label: 'Velocidade final da frente (v_f)', formula: 'v₀ + accel × active', value: `${f2(vf)} m/s`, category: 'Movimentação', consumer: 'src/sim/sand.js:sandSpeed'},
        {id: 'totalLife', label: 'Vida total da onda (ativa + dissipação)', formula: 'active + dissipate', value: `${f2((P.active ?? 0.75) + (P.dissipate ?? 0.75))} s`, category: 'Área e persistência', consumer: 'src/sim/sand.js:stepSandwave'},
        {id: 'guardDmg', label: 'Dano em guarda comum', formula: 'damage × partialFactor', value: `${f2((P.damage ?? 6) * (P.partialFactor ?? 0.5))} HP`, category: 'Dano', consumer: 'src/sim/sand.js:hitFighter'},
      ];
    }
    case 'emerging-stone': {
      const sp = Math.max(0.1, P.speed ?? 15), rng = P.range ?? 10;
      const sc = P.rockScale ?? 1, bw = (P.rockBaseWidth ?? 3) * sc, bh = (P.rockBaseHeight ?? 3) * sc;
      return [
        {id: 'travelMax', label: 'Tempo de viagem subterrânea no alcance máx.', formula: 'range ÷ speed', value: `${f2(rng / sp)} s`, category: 'Projéteis', consumer: 'src/sim/moves/emerging-stone.js:stepBurrow'},
        {id: 'rockDims', label: 'Dimensões físicas da rocha (L × P × A)', formula: '(rockBaseWidth × rockScale)² × (rockBaseHeight × rockScale)', value: `${f2(bw)} × ${f2(bw)} × ${f2(bh)} m`, category: 'Ambiente e colisão', consumer: 'src/sim/stone.js:spawnRock'},
        {id: 'totalAt5m', label: 'Tempo total do cast até erguer a 5 m', formula: 'cast + (5 ÷ speed) + riseTime', value: `${f2((P.cast ?? 0.55) + 5 / sp + (P.riseTime ?? 0.4))} s`, category: 'Preparação', consumer: 'src/sim/stone.js:stepRock'},
      ];
    }
    case 'quick-attack': {
      const tGo = Math.max(0.01, P.approachMax ?? 0.16), tBack = Math.max(0.01, P.returnMax ?? 0.14);
      return [
        {id: 'vApproach4m', label: 'Velocidade média de ida (alvo a 4 m)', formula: '4 m ÷ approachMax', value: `${f2(4 / tGo)} m/s`, category: 'Movimentação', consumer: 'src/sim/moves/quick-attack.js:quickAttackSetup'},
        {id: 'vReturn4m', label: 'Velocidade média de retorno (4 m)', formula: '4 m ÷ returnMax', value: `${f2(4 / tBack)} m/s`, category: 'Movimentação', consumer: 'src/sim/moves/quick-attack.js:startReturn'},
        {id: 'maxTotal', label: 'Duração máxima total (ida + volta + rec.)', formula: 'approachMax + returnMax + recovery', value: `${f2(tGo + tBack + (P.recovery ?? 0.12))} s`, category: 'Preparação', consumer: 'src/sim/moves/quick-attack.js:stepQuickAttack'},
      ];
    }
    case 'bullet-punch': {
      return [
        {id: 'totalCast', label: 'Duração até o golpe (preparo + sumiço)', formula: 'cast + vanish', value: `${f2((P.cast ?? 0.75) + (P.vanish ?? 0.2))} s`, category: 'Preparação', consumer: 'src/sim/moves/bullet-punch.js:bulletPunchDef'},
        {id: 'walkFactor', label: 'Velocidade de caminhada no preparo', formula: '(1 − slow) × 100%', value: `${f2((1 - (P.slow ?? 0.7)) * 100)} %`, category: 'Movimentação', consumer: 'src/sim/controller/ctrl-moves.js:updateMove'},
        {id: 'totalReach', label: 'Alcance efetivo total (viagem + soco)', formula: 'reach + strikeReach − stopShort', value: `${f2((P.reach ?? 6) + (P.strikeReach ?? 2.2) - (P.stopShort ?? 1.1))} m`, category: 'Movimentação', consumer: 'src/sim/moves/bullet-punch.js:bulletPunchReturn'},
      ];
    }
    case 'bounce': {
      const g = Math.max(0.5, P.gravity ?? 17.5);
      const tFlight = (/** @type {number} */ h) => 2 * Math.sqrt(2 * Math.max(0, h) / g);
      return [
        {id: 'airTimePl1', label: 'Tempo total no ar (PL1)', formula: '2 × √(2 · heightPl1 ÷ gravity)', value: `${f2(tFlight(P.heightPl1 ?? 1.5))} s`, category: 'Movimentação', consumer: 'src/sim/moves/bounce.js:bounceEffect'},
        {id: 'airTimePl2', label: 'Tempo total no ar (PL2)', formula: '2 × √(2 · heightPl2 ÷ gravity)', value: `${f2(tFlight(P.heightPl2 ?? 2.5))} s`, category: 'Movimentação', consumer: 'src/sim/moves/bounce.js:bounceEffect'},
        {id: 'airTimePl3', label: 'Tempo total no ar (PL3)', formula: '2 × √(2 · heightPl3 ÷ gravity)', value: `${f2(tFlight(P.heightPl3 ?? 3.5))} s`, category: 'Movimentação', consumer: 'src/sim/moves/bounce.js:bounceEffect'},
        {id: 'vyPl3', label: 'Impulso vertical inicial (PL3)', formula: '√(2 · gravity · heightPl3)', value: `${f2(Math.sqrt(2 * g * Math.max(0, P.heightPl3 ?? 3.5)))} m/s`, category: 'Movimentação', consumer: 'src/sim/moves/bounce.js:bounceEffect'},
      ];
    }
    case 'water-pulse': {
      const sp = Math.max(0.1, P.speed ?? 14), rng = P.range ?? 12;
      const r3 = (P.radius ?? 0.38) * (1 + 2 * (P.plScaleBonus ?? 0.25));
      return [
        {id: 'pl2At', label: 'Marco de carga para PL2 (50%)', formula: 'maxCharge × 0,5', value: `${f2((P.maxCharge ?? 1.5) * 0.5)} s`, category: 'Preparação', consumer: 'src/sim/charge.js:chargeParams'},
        {id: 'flightTime', label: 'Tempo de voo até o alcance máximo', formula: 'range ÷ speed', value: `${f2(rng / sp)} s`, category: 'Projéteis', consumer: 'src/sim/moves/water-pulse.js:waterPulseEffect'},
        {id: 'scalePl3', label: 'Raio visual da esfera em PL3', formula: 'radius × (1 + 2 × plScaleBonus)', value: `${f2(r3)} m`, category: 'Hitboxes', consumer: 'src/sim/moves/water-pulse.js:waterPulseEffect'},
      ];
    }
    case 'psyshock': {
      const maxC = P.maxCharge ?? 4, stSec = Math.max(0.05, P.stoneSeconds ?? 0.8);
      const nMax = Math.min(P.maxStones ?? 8, (P.minStones ?? 3) + Math.floor(maxC / stSec));
      const d1 = (P.damageFraction ?? 0.2) * atk, sf = P.successiveFactor ?? 0.8;
      return [
        {id: 'stonesAtMax', label: 'Pedras geradas na carga máxima', formula: 'min(maxStones, minStones + ⌊maxCharge ÷ stoneSeconds⌋)', value: `${nMax} pedras`, category: 'Eventos e múltiplos hits', consumer: 'src/sim/moves/psyshock.js:stoneCount'},
        {id: 'dmg1', label: 'Dano da 1ª pedra (@ Ataque ref.)', formula: 'damageFraction × Ataque', value: `${f2(d1)} HP`, category: 'Dano', consumer: 'src/sim/moves/psyshock.js:psyshockEffect'},
        {id: 'dmg3', label: 'Dano acumulado de 3 acertos', formula: 'd₁ × (1 + f + f²)', value: `${f2(d1 * (1 + sf + sf * sf))} HP`, category: 'Dano', consumer: 'src/sim/world/world-hit.js:applyHit'},
      ];
    }
    case 'reflect': {
      const maxC = P.maxCharge ?? 4;
      return [
        {id: 'widthSpan', label: 'Largura física da barreira (carga mín → máx)', formula: '(widthMin..widthMax) × largura do corpo', value: `${f2((P.widthMin ?? 1.5) * bodyW)} m → ${f2((P.widthMax ?? 3) * bodyW)} m`, category: 'Área e persistência', consumer: 'src/sim/moves/reflect.js:reflectPlacement'},
        {id: 'heightSpan', label: 'Altura física da barreira (carga mín → máx)', formula: '(heightMin..heightMax) × altura do corpo', value: `${f2((P.heightMin ?? 1.5) * bodyH)} m → ${f2((P.heightMax ?? 2.5) * bodyH)} m`, category: 'Área e persistência', consumer: 'src/sim/moves/reflect.js:reflectPlacement'},
        {id: 'maxLife', label: 'Duração da barreira na carga máxima', formula: 'durationBase + maxCharge', value: `${f2((P.durationBase ?? 4) + maxC)} s`, category: 'Área e persistência', consumer: 'src/sim/moves/reflect.js:reflectEffect'},
      ];
    }
    case 'fire-spin': {
      const life = P.life ?? 2.4, st = P.startup ?? 0, iv = Math.max(0.05, P.interval ?? 0.6);
      const pulses = life >= st ? 1 + Math.floor((life - st + 1e-9) / iv) : 0;
      const tot = pulses * (P.damage ?? 2);
      return [
        {id: 'pulses', label: 'Total de pulsos emitidos', formula: '1 + ⌊(life − startup) ÷ interval⌋', value: `${pulses} pulsos`, category: 'Eventos e múltiplos hits', consumer: 'src/sim/moves/fire-spin.js:fireSpinEffect'},
        {id: 'totalDmg', label: 'Dano total máximo (todos os pulsos)', formula: 'pulsos × damage', value: `${f2(tot)} HP`, category: 'Dano', consumer: 'src/sim/moves/fire-spin.js:fireSpinEffect'},
        {id: 'dps', label: 'DPS médio da zona ativa', formula: 'danoTotal ÷ life', value: `${f2(tot / Math.max(0.1, life))} HP/s`, category: 'Dano', consumer: 'src/sim/moves/fire-spin.js:fireSpinEffect'},
      ];
    }
    case 'seed-bomb': {
      const T = Math.max(0.05, P.flightTime ?? 0.65), g = P.gravity ?? 17.5;
      const vy0 = 0.5 * g * T, apex = 0.125 * g * T * T;
      return [
        {id: 'vy0', label: 'Velocidade vertical inicial (chão plano)', formula: '½ × gravity × flightTime', value: `${f2(vy0)} m/s`, category: 'Projéteis', consumer: 'src/sim/moves/seed-bomb.js:seedArc'},
        {id: 'apex', label: 'Altura do ápice da parábola', formula: '⅛ × gravity × flightTime²', value: `${f2(apex)} m`, category: 'Projéteis', consumer: 'src/sim/moves/seed-bomb.js:seedArc'},
        {id: 'v10m', label: 'Velocidade horizontal para alvo a 10 m', formula: 'min(maxSpeed, 10 ÷ flightTime)', value: `${f2(Math.min(P.maxSpeed ?? 20, 10 / T))} m/s`, category: 'Projéteis', consumer: 'src/sim/moves/seed-bomb.js:seedArc'},
      ];
    }
    case 'swift': {
      const n = P.count ?? 3, sp = Math.max(0.1, P.speed ?? 15), rng = P.range ?? 12;
      return [
        {id: 'flightTime', label: 'Tempo de vida / voo das estrelas', formula: 'range ÷ speed', value: `${f2(rng / sp)} s`, category: 'Projéteis', consumer: 'src/sim/moves/swift.js:swiftEffect'},
        {id: 'totalDmg', label: 'Dano bruto total (todas as estrelas)', formula: 'count × damage', value: `${f2(n * (P.damage ?? 3))} HP`, category: 'Dano', consumer: 'src/sim/moves/swift.js:swiftEffect'},
        {id: 'fanStep', label: 'Passo angular no leque sem alvo', formula: 'fanAngle ÷ (count − 1)', value: `${f2(n > 1 ? (P.fanAngle ?? 20) / (n - 1) : 0)}°`, category: 'Projéteis', consumer: 'src/sim/moves/swift.js:swiftEffect'},
      ];
    }
    case 'air-slash': {
      const sp = Math.max(0.1, P.speed ?? 22), rng = P.range ?? 10;
      return [
        {id: 'totalCast', label: 'Duração total da ação (startup + rec.)', formula: 'startup + recovery', value: `${f2((P.startup ?? 0.067) + (P.recovery ?? 0.167))} s`, category: 'Preparação', consumer: 'src/sim/moves/air-slash.js:airSlashDef'},
        {id: 'flightTime', label: 'Tempo de voo da lâmina de ar', formula: 'range ÷ speed', value: `${f2(rng / sp)} s`, category: 'Projéteis', consumer: 'src/sim/moves/air-slash.js:airSlashEffect'},
      ];
    }
    case 'harden': {
      const mult = 1 / (1 + Math.max(0, P.defensePct ?? 0.3));
      return [
        {id: 'dmgMult', label: 'Multiplicador de dano recebido', formula: '1 ÷ (1 + defensePct)', value: `${f2(mult)}×`, category: 'Defesa e Counter', consumer: 'src/sim/moves/harden.js:hardenStatus'},
        {id: 'dmgRed', label: 'Redução efetiva de dano recebido', formula: '(1 − 1 ÷ (1 + defensePct)) × 100%', value: `${f2((1 - mult) * 100)} %`, category: 'Defesa e Counter', consumer: 'src/sim/moves/harden.js:hardenStatus'},
      ];
    }
    case 'second-wind': {
      const dur = P.duration ?? 5, iv = Math.max(0.02, P.regenInterval ?? 0.1);
      const pulses = Math.floor(dur / iv);
      return [
        {id: 'pulses', label: 'Pulsos totais de regeneração', formula: '⌊duration ÷ regenInterval⌋', value: `${pulses} pulsos`, category: 'Status', consumer: 'src/sim/moves/second-wind.js:secondWindStatus'},
        {id: 'totalRegen', label: 'Stamina extra total recuperada (% máx)', formula: 'duration × regenPctPerSecond × 100%', value: `${f2(dur * (P.regenPctPerSecond ?? 0.4) * 100)} %`, category: 'Recursos', consumer: 'src/sim/moves/second-wind.js:secondWindStatus'},
        {id: 'mobMul', label: 'Custo efetivo de esquiva e sprint', formula: '(1 − mobilityCostPct) × 100%', value: `${f2((1 - (P.mobilityCostPct ?? 0.25)) * 100)} %`, category: 'Recursos', consumer: 'src/sim/moves/second-wind.js:secondWindStatus'},
      ];
    }
    case 'guard-break': {
      return [
        {id: 'pl2At', label: 'Marco de carga para PL2 (50%)', formula: 'maxCharge × 0,5', value: `${f2((P.maxCharge ?? 1) * 0.5)} s`, category: 'Preparação', consumer: 'src/sim/charge.js:chargeParams'},
        {id: 'activeWin', label: 'Duração da janela ativa', formula: 'hitEnd − hitStart', value: `${f2(Math.max(0, (P.hitEnd ?? 0.533) - (P.hitStart ?? 0.333)))} s`, category: 'Hitboxes', consumer: 'src/sim/moves/guard-break.js:guardBreakSetup'},
        {id: 'vAvg', label: 'Velocidade média do golpe', formula: 'range ÷ cast', value: `${f2((P.range ?? 2.6) / Math.max(0.05, P.cast ?? 0.7))} m/s`, category: 'Movimentação', consumer: 'src/sim/moves/guard-break.js:guardBreakSetup'},
      ];
    }
    case 'lunge': {
      return [
        {id: 'vAvg', label: 'Velocidade média da investida', formula: 'range ÷ cast', value: `${f2((P.range ?? 3.5) / Math.max(0.05, P.cast ?? 0.6))} m/s`, category: 'Movimentação', consumer: 'src/sim/moves/lunge.js:lungeSetup'},
        {id: 'activeWin', label: 'Duração da janela ativa', formula: 'hitEnd − hitStart', value: `${f2(Math.max(0, (P.hitEnd ?? 0.26) - (P.hitStart ?? 0.19)))} s`, category: 'Hitboxes', consumer: 'src/sim/moves/lunge.js:lungeSetup'},
      ];
    }
    case 'feint': {
      const dtDash = Math.max(0.005, (P.dashEnd ?? 0.15) - (P.dashStart ?? 0.03));
      return [
        {id: 'iframeDur', label: 'Duração total dos i-frames', formula: 'invulnEnd − invulnStart', value: `${f2(Math.max(0, (P.invulnEnd ?? 0.0833) - (P.invulnStart ?? 0.0167)))} s`, category: 'Defesa e Counter', consumer: 'src/sim/moves.js:effectiveMove'},
        {id: 'dashDur', label: 'Duração do impulso físico de recuo', formula: 'dashEnd − dashStart', value: `${f2(dtDash)} s`, category: 'Movimentação', consumer: 'src/sim/controller/ctrl-moves.js:updateMove'},
        {id: 'dashSpeed', label: 'Velocidade média durante o impulso', formula: 'retreat ÷ (dashEnd − dashStart)', value: `${f2((P.retreat ?? 0.25) / dtDash)} m/s`, category: 'Movimentação', consumer: 'src/sim/controller/ctrl-moves.js:updateMove'},
      ];
    }
    case 'riposte': {
      return [
        {id: 'winDur', label: 'Duração da janela de contra-ataque', formula: 'windowEnd − windowStart', value: `${f2(Math.max(0, (P.windowEnd ?? 0.3) - (P.windowStart ?? 0.13)))} s`, category: 'Defesa e Counter', consumer: 'src/sim/entity.js:riposteIntercept'},
        {id: 'vulnTail', label: 'Recuperação exposta (se não acionado)', formula: 'cast − windowEnd', value: `${f2(Math.max(0, (P.cast ?? 0.65) - (P.windowEnd ?? 0.3)))} s`, category: 'Preparação', consumer: 'src/sim/controller/ctrl-moves.js:updateMove'},
      ];
    }
    case 'spikes': {
      const r = P.radius ?? 1.2;
      return [
        {id: 'activeTime', label: 'Tempo armado ativo', formula: 'life − armDelay', value: `${f2(Math.max(0, (P.life ?? 8) - (P.armDelay ?? 0.25)))} s`, category: 'Área e persistência', consumer: 'src/sim/trap.js:stepTrap'},
        {id: 'areaM2', label: 'Área circular coberta no piso', formula: 'π × radius²', value: `${f2(Math.PI * r * r)} m²`, category: 'Hitboxes', consumer: 'src/sim/trap.js:stepTrap'},
      ];
    }
    default:
      return [];
  }
}

/**
 * Devolve as constantes técnicas justificadas aplicáveis ao Move indicado.
 * @param {string} moveId
 */
export function getTechnicalConstantsForMove(moveId) {
  return TECHNICAL_CONSTANTS.filter(c => c.scope === 'Todos os Moves' || c.scope.split(/,\s*/).includes(moveId));
}

/**
 * Audita o registro vivo de parâmetros de todos os Moves registrados:
 * confere categoria, tier, kind, faixa efetiva e consumidor de cada parâmetro.
 */
export function auditMoveRegistry() {
  /** @type {Array<{moveId: string, group: string, key: string, issue: string}>} */
  const issues = [];
  const groups = moveParamGroups();
  for (const g of groups) {
    for (const r of g.rows) {
      const c = classifyParamRow(g.group, r);
      if (!MOVE_MECHANIC_CATEGORIES.includes(c.category)) {
        issues.push({moveId: g.id, group: g.group, key: r.key, issue: `categoria inválida: ${c.category}`});
      }
      if (!PARAM_KINDS.includes(c.kind)) {
        issues.push({moveId: g.id, group: g.group, key: r.key, issue: `kind inválido: ${c.kind}`});
      }
      if (!PARAM_TIERS.includes(c.tier)) {
        issues.push({moveId: g.id, group: g.group, key: r.key, issue: `tier inválido: ${c.tier}`});
      }
      if (!c.consumer?.file || !c.consumer?.fn) {
        issues.push({moveId: g.id, group: g.group, key: r.key, issue: 'sem consumidor declarado'});
      }
      const eff = effectiveRangeOf(g.group, r);
      if (r.value < eff.min - 1e-9 || r.value > eff.max + 1e-9) {
        issues.push({moveId: g.id, group: g.group, key: r.key, issue: `valor padrão ${r.value} fora da faixa efetiva ${eff.min}..${eff.max}`});
      }
    }
  }
  return {groupsCount: groups.length, totalExclusiveParams: groups.reduce((s, g) => s + g.rows.length, 0), issues};
}
