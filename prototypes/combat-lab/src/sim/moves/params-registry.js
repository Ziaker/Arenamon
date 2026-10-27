// @ts-check
// Registro PURO (sem imports) das fichas de parâmetros dos Moves. Cada Move declara os próprios parâmetros UMA vez, no arquivo dele
// (`defineMoveParams`); daqui saem os padrões em C.world[grupo], os sliders da aba Moves (rótulo, dica, faixa, unidade) e a cobertura
// dos testes. Não importa config.js nem a interface de propósito: config.js importa este arquivo, e um ciclo quebraria a ordem de carga.

/** Unidades aceitas: a interface escolhe o formato de exibição pela unidade (ver FORMATTERS em ui/moves-panel.js). */
export const PARAM_UNITS = ['num', 'int', 'sec', 'pct', 'm', 'ms', 'ms2', 'deg', 'x', 'yesno'];

/** As 16 categorias obrigatórias de inspeção mecânica dos Moves. */
export const MOVE_MECHANIC_CATEGORIES = Object.freeze([
  'Recursos',
  'Preparação',
  'Dano',
  'Hitboxes',
  'Knockback',
  'Movimentação',
  'Projéteis',
  'Área e persistência',
  'Status',
  'Defesa e Counter',
  'Cancelamentos',
  'Alvo e mira',
  'Ambiente e colisão',
  'Eventos e múltiplos hits',
  'IA do Move',
  'Interações globais',
]);

/** Tipos de parâmetro mecânico no registro único. */
export const PARAM_KINDS = Object.freeze(['exclusive', 'inherited', 'calculated', 'technical']);
/** Níveis de profundidade de edição no Editor de Moves. */
export const PARAM_TIERS = Object.freeze(['essential', 'advanced', 'technical']);
/** Quando a alteração de um parâmetro entra em vigor (M28.4: por padrão na próxima ativação). */
export const PARAM_TIMINGS = Object.freeze(['nextActivation', 'immediate']);

/** Regra única de limite efetivo para sliders de knockback e faixas ampliadas (compartilhada entre aba Moves e Editor de Moves). */
export const KNOCKBACK_KEY_RE = /^(knockbackH|knockbackV|knockback|knockbackPl\d|knockbackPerStone|knockbackVertical|knockbackCap|blastKnockback|blastKnockbackV|burstForce|burstVertical|launchH|launchV)$/;
export const KNOCKBACK_MAX = 15;
/** @type {Record<string, number>} */
export const KNOCKBACK_MAX_EXCEPTIONS = Object.freeze({'riposte.knockbackH': 17});

/**
 * Calcula a faixa efetiva (min, max, step) de um parâmetro no painel e no Editor de Moves (fonte única, sem duplicação).
 * @param {string} group
 * @param {{key: string, min: number, max: number, step: number, unit?: string, noDouble?: boolean}} row
 * @returns {{min: number, max: number, step: number}}
 */
export function effectiveRangeOf(group, row) {
  const min = row.min, step = row.step;
  const id = `${group}.${row.key}`;
  let max = row.max;
  if (KNOCKBACK_KEY_RE.test(row.key)) max = KNOCKBACK_MAX_EXCEPTIONS[id] ?? KNOCKBACK_MAX;
  else if (!row.noDouble && row.unit !== 'yesno' && !(min === 0 && max === 1 && step === 1) && !(step >= 1 && max <= 3)) max = max * 2;
  return {min, max, step};
}

const ESSENTIAL_KEYS = new Set([
  'cost', 'cooldown', 'cast', 'startup', 'recovery', 'chargeRecovery', 'landRecovery', 'minCharge', 'maxCharge',
  'damage', 'damagePl1', 'damagePl2', 'damagePl3', 'damageFraction', 'range', 'maxDistance', 'reach', 'acquireRange',
  'length', 'width', 'radius', 'hitRadius', 'zoneRadius', 'explosionRadius', 'blastRadius', 'strikeRange', 'strikeReach',
  'speed', 'speedMin', 'speedMax', 'duration', 'durationBase', 'life', 'active', 'interval', 'count', 'minStones',
  'maxStones', 'defensePct', 'regenPctPerSecond', 'mobilityCostPct', 'blind', 'stun', 'knockback', 'knockbackH',
  'knockbackV', 'knockbackPerStone', 'knockbackPl1', 'knockbackPl2', 'knockbackPl3', 'blastKnockback', 'retreat',
  'windowStart', 'windowEnd', 'pushDurationMode',
]);

const TECHNICAL_KEYS = new Set([
  'tieTolerance', 'maxReflections', 'searchStep', 'rockSearchStep', 'rayStep', 'freeSearchStep', 'cell', 'replanSteps',
  'stuckTicks', 'stuckSpeedRatio', 'approachStopDist', 'returnStopDist', 'supportTolerance', 'wallPressMinSpeed',
  'wallPressMoveRatio', 'waveBottomTolerance', 'burrowMaxLife', 'hitShakeOn', 'hitShakeAmount', 'hitShakeDuration', 'fxOn', 'fxIntensity',
  'fxSize', 'blastOn', 'blastSize', 'fxLines', 'fxHideBody', 'fxTrailOn', 'fxTrailSize', 'visualWidth', 'visualHeight',
  'visualThickness', 'scaleMin', 'scaleMax', 'plScaleBonus', 'minStrikeDuration',
]);

/**
 * Classifica o nível de profundidade ('essential' | 'advanced' | 'technical') de um parâmetro.
 * @param {string} key
 * @param {Partial<ParamRow>} [row]
 * @returns {'essential' | 'advanced' | 'technical'}
 */
export function inferParamTier(key, row) {
  if (row?.tier && PARAM_TIERS.includes(row.tier)) return row.tier;
  if (ESSENTIAL_KEYS.has(key)) return 'essential';
  if (TECHNICAL_KEYS.has(key)) return 'technical';
  return 'advanced';
}

/**
 * Classifica a categoria de inspeção mecânica (uma das 16 obrigatórias) de um parâmetro.
 * @param {string} group
 * @param {string} key
 * @returns {string}
 */
export function inferParamCategory(group, key) {
  if (['cost', 'cooldown', 'mobilityCostPct', 'boostStaminaPerSecond', 'boostStep'].includes(key)) return 'Recursos';
  if (['cast', 'startup', 'recovery', 'chargeRecovery', 'landRecovery', 'armDelay', 'riseTime', 'vanish', 'minCharge', 'maxCharge', 'minStrikeDuration'].includes(key)) return 'Preparação';
  if (['damage', 'damagePl1', 'damagePl2', 'damagePl3', 'damageFraction', 'successiveFactor', 'burstDamage', 'burstHurt', 'partialFactor', 'impactMult'].includes(key)) return 'Dano';
  if (['knockback', 'knockbackH', 'knockbackV', 'knockbackOwn', 'knockbackCap', 'knockbackPerStone', 'knockbackVertical', 'knockbackLevelBonus', 'knockbackSpeedFactor', 'knockbackPl1', 'knockbackPl2', 'knockbackPl3', 'blastKnockback', 'blastKnockbackV', 'launchH', 'launchV', 'burstForce', 'burstVertical', 'burstPush', 'negateKnockback', 'pushSpeed', 'pushDuration', 'pushDurationMode', 'pushContinueAfterActive', 'pushContinuesOutsideArea', 'pushReleaseDelay', 'pushContinuesDuringStagger', 'pushMaxSpeed', 'pushAccelerationMode', 'pushCurvePower', 'pushTargetSpeed', 'pushRampTime'].includes(key)) return 'Knockback';
  if (['acquireRange', 'airReach', 'minRange', 'startDistance', 'markerSpeed', 'markerAccel', 'allowOccupied', 'aimHeightMin', 'aimHeightMax'].includes(key)) return 'Alvo e mira';
  if (['maxRise', 'edgeMargin', 'rockSearch', 'rockSearchStep', 'searchRange', 'searchStep', 'rayStep', 'freeSearchRadius', 'freeSearchStep', 'cell', 'detour', 'replanSteps', 'occlusion', 'supportTolerance', 'wallPressMinSpeed', 'wallPressMoveRatio', 'waveBottomTolerance', 'tieTolerance', 'maxReflections'].includes(key)) return 'Ambiente e colisão';
  if (['chainAfter', 'cancelAfter', 'cancelWindow', 'dodgeCancelAfter', 'interruptCooldownFactor', 'pushCancelsDodge', 'pushCancelsExistingDodge'].includes(key)) return 'Cancelamentos';
  if (['stun', 'guardStun', 'wallStagger', 'wallStaggerOn', 'wallPressStopRatio', 'wallUnpinDistance', 'counterStagger', 'tackleRecoil', 'tackleStagger', 'invulnerableSeconds', 'invulnStart', 'invulnEnd', 'windowStart', 'windowEnd', 'strikePl', 'pl', 'seedPl', 'pulsePl', 'trapPl'].includes(key)) return 'Defesa e Counter';
  if (['duration', 'defensePct', 'regenPctPerSecond', 'regenInterval', 'blind', 'blindOnPartial', 'visionRadius', 'fogDarkness'].includes(key)) return 'Status';
  if (['count', 'minStones', 'stoneSeconds', 'maxStones', 'interval', 'maxTargets'].includes(key)) return 'Eventos e múltiplos hits';
  if (['active', 'dissipate', 'life', 'blastLife', 'burstLife', 'durationBase', 'maxActive', 'maxRocks', 'rockScale', 'rockHp'].includes(key)) return 'Área e persistência';
  if (['speed', 'speedMin', 'speedMax', 'waveSpeed', 'maxSpeed', 'flightTime', 'lifetime', 'burrowMaxLife', 'homingSeconds', 'homingRate', 'fanAngle', 'arc', 'ringMin', 'ringMax', 'pierce'].includes(key)) return 'Projéteis';
  if (['maxDistance', 'reach', 'stopShort', 'retreat', 'dashStart', 'dashEnd', 'approachMax', 'returnMax', 'approachStopDist', 'returnStopDist', 'stuckTicks', 'stuckSpeedRatio', 'castSlow', 'slow', 'accel', 'waveAccel', 'speedFromReach', 'pushClearsLocomotion', 'pushPreserveVelocity', 'heightPl1', 'heightPl2', 'heightPl3'].includes(key) || (key === 'gravity' && group === 'bounce') || (key === 'range' && ['lunge', 'guardBreak'].includes(group))) return 'Movimentação';
  if (key === 'range') return 'Alvo e mira';
  if (key === 'gravity') return 'Projéteis';
  if (['hitstopMult', 'shakeMult', 'hitShakeOn', 'hitShakeAmount', 'hitShakeDuration', 'fxOn', 'fxIntensity', 'fxSize', 'blastOn', 'blastSize', 'fxLines', 'fxHideBody', 'fxTrailOn', 'fxTrailSize', 'atelierVfx'].includes(key)) return 'Interações globais';
  if (key.startsWith('ai')) return 'IA do Move';
  return 'Hitboxes';
}

/**
 * Dependência entre parâmetros (quando um controle depende de outro estar ligado ou configurar um limite).
 * @param {string} _group
 * @param {string} key
 * @returns {string | null}
 */
export function inferParamDependsOn(_group, key) {
  if (key === 'hitShakeAmount' || key === 'hitShakeDuration') return 'hitShakeOn';
  if (key === 'burstForce' || key === 'burstVertical') return 'burstPush';
  if (key === 'burstDamage') return 'burstHurt';
  if (key === 'fxIntensity' || key === 'fxSize') return 'fxOn';
  if (key === 'blastSize') return 'blastOn';
  if (key === 'fxTrailSize') return 'fxTrailOn';
  if (key === 'pushCurvePower' || key === 'pushTargetSpeed' || key === 'pushRampTime') return 'pushAccelerationMode';
  if (key === 'pushPreserveVelocity') return 'pushClearsLocomotion';
  return null;
}

/** @type {Record<string, {file: string, fn: string}>} */
const GROUP_CONSUMERS = {
  harden: {file: 'src/sim/moves/harden.js', fn: 'hardenEffect'},
  secondWind: {file: 'src/sim/moves/second-wind.js', fn: 'secondWindEffect / secondWindStatus'},
  swift: {file: 'src/sim/moves/swift.js', fn: 'swiftEffect'},
  lunge: {file: 'src/sim/moves/lunge.js', fn: 'lungeSetup'},
  guardBreak: {file: 'src/sim/moves/guard-break.js', fn: 'guardBreakSetup / resolveHit'},
  bounce: {file: 'src/sim/moves/bounce.js', fn: 'bounceEffect / stepBounceFlight'},
  spikes: {file: 'src/sim/moves/spikes.js', fn: 'spikesEffect / stepTrap'},
  sandWave: {file: 'src/sim/moves/sand-wave/sand-wave.js', fn: 'sandWaveEffect / stepSandwave'},
  bulletPunch: {file: 'src/sim/moves/bullet-punch/bullet-punch.js', fn: 'bulletPunchTravel / bulletPunchReturn'},
  emergingStone: {file: 'src/sim/moves/emerging-stone.js', fn: 'emergingStoneEffect / stepBurrow / stepRock'},
  feint: {file: 'src/sim/controller/ctrl-moves.js', fn: 'pressFeint / updateMove'},
  riposte: {file: 'src/sim/controller/ctrl-moves.js', fn: 'riposteIntercept / startRiposteStrike'},
  quickAttack: {file: 'src/sim/moves/quick-attack.js', fn: 'quickAttackSetup / stepQuickAttack'},
  waterPulse: {file: 'src/sim/moves/water-pulse/water-pulse.js', fn: 'waterPulseEffect'},
  fireSpin: {file: 'src/sim/moves/fire-spin.js', fn: 'fireSpinEffect'},
  airSlash: {file: 'src/sim/moves/air-slash.js', fn: 'airSlashEffect'},
  seedBomb: {file: 'src/sim/moves/seed-bomb.js', fn: 'seedBombEffect'},
  reflect: {file: 'src/sim/moves/reflect.js', fn: 'reflectEffect / reflectPlacement / reflectPass'},
  psyshock: {file: 'src/sim/moves/psyshock.js', fn: 'psyshockEffect / stoneCount / stoneSlots'},
};

/**
 * Identifica o arquivo e função consumidores reais de cada parâmetro mecânico no motor.
 * @param {string} group
 * @param {string} key
 * @returns {{file: string, fn: string}}
 */
export function inferParamConsumer(group, key) {
  if (['cost', 'cooldown', 'cast', 'cancelAfter'].includes(key)) return {file: 'src/sim/moves.js', fn: 'effectiveMove'};
  if (['minCharge', 'maxCharge', 'chargeRecovery'].includes(key)) return {file: 'src/sim/charge.js', fn: 'chargeParams'};
  if (['markerSpeed', 'markerAccel', 'startDistance', 'minRange', 'maxRise', 'allowOccupied'].includes(key)) return {file: 'src/sim/aim-marker.js', fn: 'markerInitial / markerStep / markerValidity'};
  if (['hitShakeOn', 'hitShakeAmount', 'hitShakeDuration'].includes(key)) return {file: 'src/view/vfx.js', fn: 'triggerMoveHitShake'};
  if (group === 'sandWave') {
    if (['speedFromReach', 'waveSpeed', 'waveAccel', 'length', 'width', 'active', 'dissipate'].includes(key)) return {file: 'src/sim/moves/sand-wave/sand-wave.js', fn: 'sandWaveEffect'};
    if (['pushDuration', 'pushDurationMode', 'pushContinueAfterActive', 'pushContinuesOutsideArea', 'pushReleaseDelay', 'pushContinuesDuringStagger', 'pushMaxSpeed', 'pushAccelerationMode', 'pushCurvePower', 'pushTargetSpeed', 'pushRampTime'].includes(key)) return {file: 'src/sim/moves/sand-wave/sand-push.js', fn: 'pushWindowState / pushAccelNow'};
    if (key === 'visionRadius') return {file: 'src/sim/vision.js', fn: 'canSee'};
    if (key === 'fogDarkness') return {file: 'src/view/view.js', fn: 'update (fog/cegueira)'};
    return {file: 'src/sim/sand.js', fn: 'stepSand'};
  }
  return GROUP_CONSUMERS[group] ?? {file: `src/sim/moves/${group}.js`, fn: `${group}Effect`};
}

/**
 * @typedef {{
 *   key: string, label: string, tip: string, min: number, max: number, step: number, unit: string, value: number,
 *   approved?: boolean,
 *   kind?: 'exclusive' | 'inherited' | 'calculated' | 'technical',
 *   tier?: 'essential' | 'advanced' | 'technical',
 *   category?: string,
 *   consumer?: {file: string, fn: string} | string,
 *   dependsOn?: string | null,
 *   options?: Array<{value: number, label: string}>,
 *   noDouble?: boolean,
 *   applyTiming?: 'nextActivation' | 'immediate'
 * }} ParamRow
 * @typedef {{category: 'Normal' | 'Burst' | 'Charge', types: string[], pl: string, status: {proposto: boolean, aprovado: boolean, implementado: boolean, homologado: boolean}, version?: number}} MoveMeta
 *   meta do Move (REGRAS_CRIACAO_MOVES §2): categoria oficial, tipos (Melee/Projectile/Status/Field/Trick), PL ('SEM PL', 'PL1', 'PL1–PL3'…) e os QUATRO status independentes de governança
 * @typedef {{group: string, id: string, title: string, hint?: string, meta?: MoveMeta, rows: ParamRow[]}} ParamGroup
 */
export const MOVE_CATEGORIES = ['Normal', 'Burst', 'Charge'];
export const MOVE_TYPES = ['Melee', 'Projectile', 'Status', 'Field', 'Trick'];
/** @type {Map<string, ParamGroup>} */
const GROUPS = new Map();

/**
 * Devolve os metadados enriquecidos de uma linha de parâmetro (categoria, tipo, nível de profundidade, consumidor, dependência e faixa efetiva).
 * @param {string} group
 * @param {ParamRow} r
 */
export function classifyParamRow(group, r) {
  return {
    ...r,
    kind: r.kind ?? 'exclusive',
    tier: inferParamTier(r.key, r),
    category: r.category ?? inferParamCategory(group, r.key),
    consumer: typeof r.consumer === 'string' ? {file: r.consumer.split(':')[0], fn: r.consumer.split(':')[1] ?? 'effect'} : (r.consumer ?? inferParamConsumer(group, r.key)),
    dependsOn: r.dependsOn !== undefined ? r.dependsOn : inferParamDependsOn(group, r.key),
    applyTiming: r.applyTiming ?? 'nextActivation',
    effectiveRange: effectiveRangeOf(group, r),
  };
}

/**
 * Declara a ficha de parâmetros de um Move.
 * @param {string} group chave em C.world (ex.: 'secondWind')
 * @param {{id: string, title: string, hint?: string, meta?: MoveMeta, rows: ParamRow[]}} spec id do Move, título do cartão, texto de apoio, metadados (categoria, tipos, PL, status) e linhas
 * @returns {ParamGroup}
 */
export function defineMoveParams(group, spec) {
  const fail = (/** @type {string} */ m) => {throw new Error(`ficha ${group}: ${m}`);};
  if (!group || typeof group !== 'string') throw new Error('ficha sem grupo');
  if (!spec?.id || !spec.title) fail('precisa de id e title');
  const m = spec.meta;
  if (m) {
    if (!MOVE_CATEGORIES.includes(m.category)) fail(`meta.category deve ser ${MOVE_CATEGORIES.join(', ')} (veio ${m.category})`);
    if (!Array.isArray(m.types) || !m.types.length || m.types.some(t => !MOVE_TYPES.includes(t))) fail(`meta.types deve usar ${MOVE_TYPES.join(', ')}`);
    if (!m.pl || typeof m.pl !== 'string') fail("meta.pl deve ser texto ('SEM PL', 'PL1', 'PL1–PL3'…)");
    for (const k of ['proposto', 'aprovado', 'implementado', 'homologado']) if (typeof m.status?.[k] !== 'boolean') fail(`meta.status.${k} deve ser verdadeiro ou falso`);
  }
  const seen = new Set();
  for (const r of spec.rows) {
    if (!r.key || seen.has(r.key)) fail(`chave repetida ou vazia (${r.key})`);
    seen.add(r.key);
    if (!PARAM_UNITS.includes(r.unit)) fail(`${r.key}: unidade desconhecida (${r.unit})`);
    if (!r.label || !r.tip) fail(`${r.key}: rótulo e dica são obrigatórios`);
    if (![r.min, r.max, r.step, r.value].every(Number.isFinite)) fail(`${r.key}: min, max, step e value precisam ser números`);
    if (r.min > r.max || r.value < r.min || r.value > r.max) fail(`${r.key}: valor ${r.value} fora de ${r.min}..${r.max}`);
    if (!(r.step > 0)) fail(`${r.key}: step deve ser > 0`);
    if (r.kind !== undefined && !PARAM_KINDS.includes(r.kind)) fail(`${r.key}: kind desconhecido (${r.kind})`);
    if (r.tier !== undefined && !PARAM_TIERS.includes(r.tier)) fail(`${r.key}: tier desconhecido (${r.tier})`);
    if (r.category !== undefined && !MOVE_MECHANIC_CATEGORIES.includes(r.category)) fail(`${r.key}: categoria desconhecida (${r.category})`);
    if (r.applyTiming !== undefined && !PARAM_TIMINGS.includes(r.applyTiming)) fail(`${r.key}: applyTiming desconhecido (${r.applyTiming})`);
  }
  const entry = {group, id: spec.id, title: spec.title, hint: spec.hint, meta: spec.meta, rows: spec.rows.map(r => ({approved: false, ...r}))};
  GROUPS.set(group, entry);
  return entry;
}
/** Remove uma ficha do registro (testes que registram fichas de mentira). */
export const removeMoveParams = group => GROUPS.delete(group);
export const moveParamGroups = () => [...GROUPS.values()];
/** Padrões de todas as fichas no formato de C.world: {grupo: {chave: valor}}. */
export const moveParamDefaults = () => Object.fromEntries([...GROUPS.values()].map(g => [g.group, Object.fromEntries(g.rows.map(r => [r.key, r.value]))]));
/** Garante os grupos das fichas num objeto C.world já existente (a config é criada antes de os Moves carregarem). */
export function syncMoveParams(/** @type {Record<string, any>} */ world) {
  for (const [group, values] of Object.entries(moveParamDefaults())) world[group] = {...values, ...(world[group] ?? {})};
}

const rowOf = (/** @type {Partial<ParamRow> & {key: string, label: string, tip: string, unit: string, value: number}} */ r) => /** @type {ParamRow} */ ({min: 0, max: 1, step: .01, ...r});
/**
 * Linhas padrão de um Move de "uso" (custo, recarga e duração da ação). `kind: 'cast'` descreve o cast antes do efeito; 'use' um Burst.
 * Qualquer linha pode ser sobrescrita pela ficha (`override`) ou acrescentada depois.
 */
export function standardRows(/** @type {{cost: number, cooldown: number, cast: number, kind?: 'cast' | 'use'}} */ v) {
  const cast = (v.kind ?? 'cast') === 'cast';
  return [
    rowOf({key: 'cost', label: 'Custo de stamina', tip: `Cobrado no início do ${cast ? 'cast (Normal sem marcador)' : 'uso (Burst)'}; vale nos PRÓXIMOS usos (M28.4). Valor do catálogo — proposta, não homologada.`, min: 0, max: 5, step: .05, unit: 'num', value: v.cost}),
    rowOf({key: 'cooldown', label: 'Cooldown', tip: `Começa junto com o custo, no início do ${cast ? 'cast' : 'uso'} (proposta).`, min: 0, max: 60, step: .5, unit: 'sec', value: v.cooldown}),
    rowOf({key: 'cast', label: cast ? 'Duração do cast' : 'Duração da ação', tip: cast ? 'Tempo do cast antes do efeito começar; interrupção nesse intervalo cancela sem reembolso (proposta).' : 'Tempo da ação (recuperação do Burst: não definido no catálogo; provisório MV-P14).', min: .05, max: 2, step: .01, unit: 'sec', value: v.cast}),
  ];
}
export {rowOf as paramRow};

/** Tremor de câmera ao acertar (aparência), igual para os Moves que o têm: o interruptor libera a intensidade e a duração. */
export const hitShakeRows = () => [
  rowOf({key: 'hitShakeOn', label: 'Tremor de câmera ao acertar', tip: 'Desligado (padrão): este Move não treme a câmera ao acertar. Ligado: libera a intensidade e a duração do tremor. Só aparência.', min: 0, max: 1, step: 1, unit: 'yesno', value: 0}),
  rowOf({key: 'hitShakeAmount', label: 'Tremor ao acertar: intensidade', tip: 'Multiplica o tremor de hit padrão (1 = igual ao do Tackle). Só aparência.', min: 0, max: 6, step: .05, unit: 'x', value: 1}),
  rowOf({key: 'hitShakeDuration', label: 'Tremor ao acertar: duração', tip: 'Multiplica a duração do tremor de hit padrão (1 = igual ao do Tackle). Só aparência.', min: .1, max: 5, step: .05, unit: 'x', value: 1}),
];

/**
 * @typedef {{def: any, effect?: [string, Function], tackle?: [string, Function], hooks?: [string, Function][], steps?: [string, Function][], effects?: [string, Function][], params?: ParamGroup, ai?: import('../ai-profile.js').AiProfile}} Ficha
 */
/** Declara a ficha de um Move (só dá tipo ao objeto: o checkJs reconhece os pares [nome, função]). */
export const defineFicha = (/** @type {Ficha} */ f) => f;
