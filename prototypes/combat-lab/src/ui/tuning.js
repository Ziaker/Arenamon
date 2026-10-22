// Ajustador: todos os parâmetros numéricos do laboratório, agrupados em abas, com busca, filtros
// (alterados / diferentes do jogo / só do laboratório), desfazer/refazer, presets, comparação de presets,
// exportação/importação versionada e relatório de diferenças em relação ao config.ts do jogo.
import {C, ROOT_KEYS, defaults, resetConfig} from '../sim/config.js';
import {AI_MODES} from '../sim/ai.js';
import {NAMES, SECTIONS, TOOLTIPS, KEY_HELP} from './tuning-meta.js';
import {OFFICIAL} from './official.js';
import {STYLES} from '../sim/tactics.js';
import {actionMeta, OFFICIAL_MAP, migrateFlat, flatten} from './actions-meta.js';
import {changedOutsideManifest, importOutsideManifest} from './tuning-io.js';
import {overhaulMeta} from './overhaul-meta.js';
import {VFX_TYPES, SHAKE_EVENTS} from '../view/vfx.js';
import {SOLID_FAMILIES} from '../view/solid-fx.js';
import {MECHANIC_ORDER, mechanicLabel, mechanicsOf, levelVisible, levelOf, LEVELS, derivedText, loadTags, saveTags, allTags, nestedFrom} from './organize.js';
import {PASSIVES} from '../sim/passives.js';

const $ = id => document.getElementById(id);
export const pathGet = (root, path) => path.split('.').reduce((a, k) => a?.[k], root);
export const pathSet = (root, path, value) => {const keys = path.split('.'), last = keys.pop();const obj = keys.reduce((a, k) => a?.[k], root);if (!obj || !(last in obj)) return false;obj[last] = value;return true;};
const TABS = [
  ['X e C', ['Smear de Membros', 'Squash & Stretch do Tackle', 'Esquiva (C)', 'Tackle (X)', 'Tackle carregado (PL)', 'Finta e brake slide', 'Wall-splat e meteor slam', 'Sprint (C mantido)', 'Cancelamento C → X', 'Buffer de entrada']],
  ['Combate', ['Regras gerais, defesa e stamina', 'Knockback e clash', 'Combate e colisões']],
  ['Atributos', ['Atributos: equilibrado', 'Atributos: ágil', 'Atributos: resistente']],
  ['Movimento', ['Movimento']], ['IA', ['IA: estratégia e decisões', 'IA: personalidade do vermelho', 'IA: personalidade do azul (IA jogador)']], ['Arena', ['Arena e simulação']],
  ['Mapa', ['Ledge Grab (agarre de borda)', 'Arena circular', 'Objetos destrutíveis', 'Obstáculos indestrutíveis', 'Plataformas e salto', 'Footstool (pisar no rival)', 'Consumíveis e drops', 'Progressão de estágios e escudo']],
  ['Visual', ['Renderizador e personagens', 'Efeitos e feedback', 'HUD e visualização', 'Cores: canais RGB individuais']],
  ['Sistemas', ['Ativar ou desativar sistemas', 'Modos de jogo']],
];
const COLOR_NAMES = {player: 'Jogador azul', enemy: 'Adversário vermelho', floor: 'Piso', wall: 'Paredes', background: 'Fundo', gridMajor: 'Grid principal', gridMinor: 'Grid secundário', impact: 'Impacto', clash: 'Clash', landing: 'Poeira ao aterrissar', partial: 'Defesa parcial', perfect: 'Defesa perfeita', invulnerable: 'Invulnerabilidade', shadow: 'Sombra', arrow: 'Seta frontal', arrowGuard: 'Seta defendendo', defeated: 'Derrotado', glowGuard: 'Brilho da defesa', glowInvuln: 'Brilho da invulnerabilidade', glowRecoil: 'Brilho de recuo', glowTackle: 'Brilho de tackle'};
const SAFE_MIN = {'rules.dodge': .05, 'rules.tackleDuration': .05, 'rules.recoil': .05, 'rules.regenTime': .1, 'rules.launchGravity': .5, 'rules.staminaMax': .1, 'test.contactStep': .01, 'test.halfExtent': .1, 'test.attackReference': .01, 'test.speedReference': .01,
  'test.defenseMedian': .01, 'camera.minDistance': .1, 'camera.maxDistance': .2, 'extras.cameraExtra.nearClip': .01, 'extras.combat.launchAttackReference': .01, 'extras.ai.evadeCycle': 1, 'extras.fx.impactDuration': .02,
  'extras.fx.clashDuration': .02, 'extras.visual.bodyWidth': .1, 'extras.visual.bodyHeight': .1, 'extras.visual.bodyDepth': .1, 'profiles.balanced.hp': 1, 'profiles.agile.hp': 1, 'profiles.resistant.hp': 1, 'test.hp': 1};
const RADIANS = ['steerLimit', 'steerRate', 'guardTurn', 'guardAcceleration', 'turnRate', 'visualTurnRate', 'maxTurnRate', 'deadZone', 'movingDeadZone', 'initialYaw', 'forwardTolerance'];
const INTEGERS = ['staminaMax', 'hp', 'attack', 'defense', 'attackReference', 'speedReference', 'defenseMedian', 'contactProjectionPasses', 'impactCount', 'clashCount', 'landingCount', 'evadeCycle', 'evadeCycleIndex', 'noticeFontSize', 'clashNoticeFontSize', 'debugFontSize', 'footerFontSize'];
const toggled = key => key.startsWith('enable') || ['fxVisible', 'hudVisible', 'debugVisible', 'showHitboxes', 'showAttackVectors', 'jumpImprovements', 'jumpPassOver', 'footstoolEnabled', 'footstoolVault'].includes(key);
const PROFILE_LABEL = ['Equilibrado', 'Ágil', 'Resistente'];
/** Sliders de COMBATE (regras, ações, Moves, atributos, locomoção, passivas, física, salto/footstool): o limite máximo vale o DOBRO do original (pedido de 22/10/2026: «limite muito pequeno»). Chaves liga/desliga e seletores ficam como estão. */
export const COMBAT_PATH = /^(rules|actions|world|profiles|locomotion|passivas).|^extras.combat.|^map.(jump|footstool)/;
export const COMBAT_RANGE_FACTOR = 2;
export const widenCombatRange = (path, r) => COMBAT_PATH.test(path) && !r.kind && !(r.step >= 1 && r.max <= 3) ? {...r, max: r.max * COMBAT_RANGE_FACTOR} : r;

/** Faixa, passo e formato de cada parâmetro (regras do ajustador v6). */
function range(key, value, path) {
  const parent = path.split('.').slice(0, -1).join('.');
  if (parent === 'extras.bindings') return {min: 0, max: C.extras.keyCodes.length - 1, step: 1, fmt: n => C.extras.keyCodes[n] ?? '?'};
  if (parent === 'extras.colors') return {min: 0, max: 255, step: 1, fmt: n => String(n)};
  if (parent === 'extras.gameModes') return key === 'enemyMode' ? {min: 0, max: AI_MODES.length - 1, step: 1, fmt: n => AI_MODES[n]?.[1] ?? '?'} : {min: 0, max: 2, step: 1, fmt: n => PROFILE_LABEL[n] ?? '?'};
  if (key === 'style' && (parent === 'extras.aiRed' || parent === 'extras.aiBlue')) return {min: 0, max: STYLES.length, step: 1, fmt: n => n ? STYLES[n - 1].label : 'Sorteado por partida'};
  if (toggled(key)) return {min: 0, max: 1, step: 1, fmt: n => n ? 'Ligado' : 'Desligado', kind: 'toggle'};
  if (RADIANS.includes(key)) {const max = key === 'initialYaw' ? 360 : /rate/i.test(key) || key === 'guardTurn' || key === 'guardAcceleration' ? 1440 : 180;return {min: 0, max: max * Math.PI / 180, step: Math.PI / 180, fmt: n => (n * 180 / Math.PI).toFixed(0) + '°'};}
  // Durações que podem vir das animações: até 4 s para caber clips longos.
  if (['recoil', 'guardStun', 'landingRecovery'].includes(key) && path.startsWith('rules.')) return {min: 0, max: 4, step: .01, fmt: n => n.toFixed(2) + ' s'};
  if (key === 'epsilon') return {min: 0, max: .000001, step: .000000001, fmt: n => n.toExponential(2)};
  if (key === 'step') return {min: 1 / 240, max: 1 / 30, step: 1 / 24000, fmt: n => (1000 * n).toFixed(2) + ' ms'};
  if (key === 'hitstopDamageBoost') return {min: 0, max: 3, step: .1, fmt: n => n ? '+' + (n * 100).toFixed(0) + '% no dano de referência' : 'Desligado (hitstop fixo)'};
  if (key === 'hitstopDamageRef') return {min: 5, max: 100, step: 1, fmt: n => n + ' HP'};
  if (key === 'contactShape') return {min: 0, max: 1, step: 1, fmt: n => n ? 'Circular (alcance igual em todos os ângulos)' : 'Quadrado (legado)'};
  if (key === 'arenaHalf') return {min: 6, max: 100, step: 1, fmt: n => (n * 2) + ' × ' + (n * 2) + ' m'};
  if (INTEGERS.includes(key)) {const upper = key === 'staminaMax' ? 12 : key === 'contactProjectionPasses' ? 10 : key === 'evadeCycle' || key === 'evadeCycleIndex' ? 12 : /Count$/.test(key) ? 64 : key.endsWith('Size') ? 56 : key === 'hp' ? 800 : 200;return {min: key === 'contactProjectionPasses' ? 1 : 0, max: upper, step: 1, fmt: n => String(n)};}
  if (['invulnRepeatDelay', 'impactNoticeMs', 'clashNoticeMs', 'invulnNoticeMs'].includes(key)) return {min: 0, max: 5000, step: 10, fmt: n => n + ' ms'};
  if (key === 'fov') return {min: 20, max: 120, step: 1, fmt: n => n + '°'};
  if (key === 'farClip') return {min: 10, max: 1000, step: 5, fmt: n => n + ' m'};
  if (key === 'renderPixelRatio') return {min: .5, max: 3, step: .1, fmt: n => n.toFixed(1) + '×'};
  if (key === 'fpsSmoothing') return {min: .01, max: .5, step: .01, fmt: n => n.toFixed(2)};
  if (key === 'speed' || key.endsWith('Speed')) return {min: .01, max: 30, step: .01, fmt: n => n.toFixed(2)};
  if (['launchGravity', 'launchHorizontal', 'clashHorizontal', 'clashUp', 'launchUp'].includes(key)) return {min: 0, max: 60, step: .1, fmt: n => n.toFixed(1)};
  if (['reversal', 'acceleration', 'braking'].includes(key)) return {min: 0, max: 400, step: 1, fmt: n => String(n)};
  if (['lightX', 'lightY', 'lightZ'].includes(key)) return {min: -30, max: 30, step: .5, fmt: n => n.toFixed(1)};
  if (key === 'gridDivisions') return {min: 2, max: 100, step: 1, fmt: n => String(n)};
  if (path && path.startsWith('extras.hitbox.') && (key === 'shapeForward' || key === 'shapeRadius')) return {min: .1, max: 2, step: .05, fmt: n => n.toFixed(2) + ' m'};
  if (path && path.startsWith('display.scenery.')) {
    if (key === 'labTheme') return {min: 0, max: 1, step: 1, fmt: n => n ? 'Laboratório técnico' : 'Clássico (cinza)', kind: 'toggle'};
    if (['labBlocks', 'labProps', 'labRulers', 'labRimGlow'].includes(key)) return {min: 0, max: 1, step: 1, fmt: n => n ? 'Ligado' : 'Desligado', kind: 'toggle'};
    if (key === 'labRingStep') return {min: 1, max: 16, step: 0.5, fmt: n => n.toFixed(1) + ' m'};
    if (key === 'labBlockScale') return {min: 0.2, max: 4, step: 0.05, fmt: n => n.toFixed(2) + '×'};
  }
  if (path && path.startsWith('display.progress.')) {
    if (key === 'pgEnabled' || key === 'pgAnimate') return {min: 0, max: 1, step: 1, fmt: n => n ? 'Ligado' : 'Desligado', kind: 'toggle'};
    if (key === 'pgScale' || key === 'pgScaleEnemy') return {min: 0.4, max: 2, step: 0.05, fmt: n => Math.round(n * 100) + '%'};
    if (key === 'pgLayout') return {min: 0, max: 1, step: 1, fmt: n => n ? 'Horizontal (compacto)' : 'Vertical (cantos)', kind: 'toggle'};
    if (key === 'pgSubject') return {min: 0, max: 2, step: 1, fmt: n => ['Jogador', 'Adversário', 'Os dois'][n] ?? '?'};
  }
  if (path && path.startsWith('display.consumables.')) {
    if (key === 'gemStyle') return {min: 0, max: 1, step: 1, fmt: n => n ? 'Gemas Facetadas' : 'Clássico', kind: 'toggle'};
    if (['gemIndicators', 'gemAnimate', 'gemParticles', 'gemPedestal'].includes(key)) return {min: 0, max: 1, step: 1, fmt: n => n ? 'Ligado' : 'Desligado', kind: 'toggle'};
    if (key === 'gemScale' || key === 'gemIndicatorSize') return {min: 0.3, max: 3, step: 0.05, fmt: n => n.toFixed(2) + '×'};
    if (key === 'gemHover') return {min: 0, max: 3, step: 0.05, fmt: n => n.toFixed(2) + ' m'};
  }
  if (path && path.startsWith('display.interpolation.')) {
    if (key === 'maxJump') return {min: .2, max: 4, step: .1, fmt: n => n.toFixed(1) + ' m'};
    if (key === 'enabled') return {min: 0, max: 1, step: 1, fmt: n => n ? 'Ligado' : 'Desligado', kind: 'toggle'};
  }
  if (path && path.startsWith('extras.nav.')) {
    if (key === 'spacing') return {min: .75, max: 4, step: .25, fmt: n => n.toFixed(2) + ' m'};
    if (key === 'replan' || key === 'stuckTime') return {min: .1, max: 3, step: .05, fmt: n => n.toFixed(2) + ' s'};
    if (['jumpReach', 'launch', 'arrival', 'stuckDistance', 'attackMaxHeightDiff', 'jumpMargin'].includes(key)) return {min: .05, max: 6, step: .05, fmt: n => n.toFixed(2) + ' m'};
    if (key === 'jumpPenalty' || key === 'dropPenalty') return {min: 1, max: 20, step: .5, fmt: n => n.toFixed(1) + '×'};
    if (['suppressBlockedAttacks', 'showDebug'].includes(key)) return {min: 0, max: 1, step: 1, fmt: n => n ? 'Ligado' : 'Desligado', kind: 'toggle'};
  }
  if (path && path.startsWith('vfx.post.')) {
    if (['enabled', 'bloomOn', 'distortOn', 'chromaOn', 'gradeOn', 'vignetteOn', 'dofOn', 'dofKoOnly'].includes(key)) return {min: 0, max: 1, step: 1, fmt: n => n ? 'Ligado' : 'Desligado', kind: 'toggle'};
    if (key === 'bloomMode') return {min: 0, max: 1, step: 1, fmt: n => n ? 'Por seleção' : 'Por limiar de brilho'};
    if (['bloomIntensity', 'distortStrength', 'bloomAttackBoost'].includes(key)) return {min: 0, max: 4, step: .05, fmt: n => n.toFixed(2) + '×'};
    if (['bloomThreshold', 'bloomSmoothing', 'bloomRadius', 'distortSize', 'vignetteDarkness', 'vignetteOffset'].includes(key)) return {min: 0, max: 1.5, step: .01, fmt: n => n.toFixed(2)};
    if (key === 'distortMinDamage') return {min: 0, max: 40, step: 1, fmt: n => n + ' HP'};
    if (key === 'chromaOffset') return {min: 0, max: .006, step: .0001, fmt: n => n.toFixed(4)};
    if (key === 'chromaImpact') return {min: 0, max: .02, step: .0005, fmt: n => n.toFixed(4)};
    if (['gradeSaturation', 'gradeContrast', 'gradeBrightness'].includes(key)) return {min: -1, max: 1, step: .02, fmt: n => n.toFixed(2)};
    if (key === 'gradeHue') return {min: -180, max: 180, step: 1, fmt: n => n + '°'};
    if (key === 'dofBokeh') return {min: .5, max: 8, step: .1, fmt: n => n.toFixed(1) + '×'};
  }
  if (path && path.startsWith('vfx.laser.')) {
    if (key.startsWith('coreWidth') || key.startsWith('haloWidth') || key === 'muzzleSize' || key === 'contactSize') {
      return {min: 0.01, max: 0.8, step: 0.005, fmt: n => n.toFixed(3) + ' m'};
    }
    if (key.endsWith('Opacity')) return {min: 0, max: 1, step: 0.05, fmt: n => (n * 100).toFixed(0) + '%'};
    if (key === 'intensity') return {min: 0.1, max: 3.0, step: 0.1, fmt: n => n.toFixed(1) + '×'};
    if (key === 'pulseFreq') return {min: 1.0, max: 3.0, step: 0.1, fmt: n => n.toFixed(1) + ' Hz'};
    if (key === 'flowSpeed') return {min: 0, max: 60, step: 1, fmt: n => n.toFixed(0) + ' m/s'};
    if (key === 'sparksPerSecond') return {min: 0, max: 100, step: 5, fmt: n => n.toFixed(0) + '/s'};
    if (key === 'pl') return {min: 1, max: 3, step: 1, fmt: n => 'PL' + n};
    if (key === 'quality') return {min: 0, max: 2, step: 1, fmt: n => ['Baixa', 'Média', 'Alta'][n] || 'Média'};
    if (['enabled', 'dynamicLight', 'noFlash', 'reduceMotion', 'highContrast', 'reflectionActive', 'neutralizeActive'].includes(key)) {
      return {min: 0, max: 1, step: 1, fmt: n => n ? 'Ligado' : 'Desligado'};
    }
  }
  if (path && path.startsWith('vfx.rock.')) {
    if (key === 'scale' || key === 'glow') return {min: 0.2, max: 3.0, step: 0.1, fmt: n => n.toFixed(1) + '×'};
    if (key === 'rotSpeed') return {min: 0, max: 10, step: 0.5, fmt: n => n.toFixed(1) + ' rad/s'};
    if (key === 'trailDensity') return {min: 1, max: 30, step: 1, fmt: n => String(n)};
    if (key === 'shatterCount') return {min: 4, max: 32, step: 2, fmt: n => String(n)};
    if (key === 'shatterSpeed' || key === 'shatterLife' || key === 'shatterSize') return {min: 0.2, max: 3.0, step: 0.05, fmt: n => n.toFixed(2) + '×'};
    if (['enabled', 'trail', 'shatter', 'cracksEmissive'].includes(key)) return {min: 0, max: 1, step: 1, fmt: n => n ? 'Ligado' : 'Desligado'};
    if (key === 'variant') return {min: 0, max: 2, step: 1, fmt: n => ['A · Boulder Facetado', 'B · Cristal Psíquico', 'C · Meteorito Runas'][n] || 'A'};
  }
  if (path && path.startsWith('vfx.barrier.')) {
    if (key === 'opacity') return {min: 0.1, max: 1.0, step: 0.05, fmt: n => (n * 100).toFixed(0) + '%'};
    if (key === 'pulseFreq') return {min: 0.5, max: 8.0, step: 0.1, fmt: n => n.toFixed(1) + ' Hz'};
    if (key === 'edgeGlow') return {min: 0.2, max: 3.0, step: 0.1, fmt: n => n.toFixed(1) + '×'};
    if (key === 'shatterFragments') return {min: 6, max: 48, step: 2, fmt: n => String(n)};
    if (key === 'shatterSpeed' || key === 'shatterLife' || key === 'shatterSize') return {min: 0.2, max: 3.0, step: 0.05, fmt: n => n.toFixed(2) + '×'};
    if (['enabled', 'ripples'].includes(key)) return {min: 0, max: 1, step: 1, fmt: n => n ? 'Ligado' : 'Desligado'};
    if (key === 'variant') return {min: 0, max: 2, step: 1, fmt: n => ['A · Hex-Grid', 'B · Cristal de Quartzo', 'C · Campo de Força'][n] || 'A'};
  }
  if (path && path.startsWith('map.')) {
    if (key === 'arenaRadius') return {min: 15, max: 100, step: 1, fmt: n => n + ' m'};
    if (key === 'mountTolerance') return {min: 0.05, max: 0.5, step: 0.01, fmt: n => n.toFixed(2) + ' m'};
    if (key === 'launchSolidCollision') return {min: 0, max: 1, step: 1, fmt: n => n ? 'Ligado' : 'Desligado', kind: 'toggle'};
    if (key === 'wallBounceMultiplier' || key === 'wallDamageMultiplier') return {min: 0, max: 3, step: 0.1, fmt: n => n.toFixed(1) + '×'};
    if (key === 'destructibleCount' || key === 'obstacleCount' || key === 'platformCount' || key === 'itemInitialCount' || key === 'itemMaxRegular' || key === 'stageStaminaBonus' || key === 'stagesMax') return {min: 0, max: 20, step: 1, fmt: n => String(n)};
    if (key === 'destructibleHp' || key === 'shieldCapacity' || key === 'shieldMaxCap') return {min: 5, max: 300, step: 5, fmt: n => n + ' HP'};
    if (key === 'destructibleRespawnMin' || key === 'destructibleRespawnMax' || key === 'itemSpawnIntervalMin' || key === 'itemSpawnIntervalMax' || key === 'itemLifetime' || key === 'shieldDuration') return {min: 2, max: 120, step: 1, fmt: n => n + ' s'};
    if (key === 'destructibleGhostPreview' || key === 'jumpInterval' || key === 'jumpLandingRecovery') return {min: 0.05, max: 5, step: 0.01, fmt: n => n.toFixed(2) + ' s'};
    if (key === 'impactMinSpeed') return {min: 0, max: 10, step: 0.1, fmt: n => n.toFixed(1) + ' m/s'};
    if (key === 'impactDamageToObject' || key === 'impactDamageToFighter') return {min: 0, max: 20, step: 0.25, fmt: n => n.toFixed(2) + ' por m/s'};
    if (key === 'passageClearance') return {min: 0, max: 3, step: 0.1, fmt: n => n.toFixed(1) + ' m'};
    if (key === 'spawnClearance') return {min: 0, max: 3, step: 0.1, fmt: n => n.toFixed(1) + ' m'};
    if (key === 'jumpHeight') return {min: 0.5, max: 5.0, step: 0.1, fmt: n => n.toFixed(1) + ' m'};
    if (key === 'jumpGravity') return {min: 5, max: 40, step: 0.5, fmt: n => n.toFixed(1) + ' m/s²'};
    if (key === 'jumpDrag') return {min: 0, max: 3.0, step: 0.05, fmt: n => n.toFixed(2) + ' s⁻¹'};
    if (key === 'jumpAirControl') return {min: 0, max: 1.0, step: 0.05, fmt: n => Math.round(n * 100) + '%'};
    if (key === 'jumpGravityUp' || key === 'jumpGravityDown') return {min: 5, max: 40, step: 0.5, fmt: n => n.toFixed(1) + ' m/s²'};
    if (key === 'jumpReleaseMult') return {min: 1, max: 4, step: 0.1, fmt: n => n.toFixed(1) + '×'};
    if (key === 'jumpMaxFallSpeed') return {min: 2, max: 30, step: 0.5, fmt: n => n.toFixed(1) + ' m/s'};
    if (key === 'jumpAirAccel') return {min: 0, max: 40, step: 0.5, fmt: n => n.toFixed(1) + ' m/s²'};
    if (key === 'jumpAirMaxSpeed') return {min: 0, max: 15, step: 0.1, fmt: n => n.toFixed(1) + ' m/s'};
    if (key === 'jumpCoyoteTime' || key === 'jumpBufferWindow') return {min: 0, max: 0.5, step: 0.01, fmt: n => n.toFixed(2) + ' s'};
    if (key === 'footstoolDamage') return {min: 0, max: 30, step: 1, fmt: n => n + ' HP'};
    if (key === 'footstoolBounce') return {min: 0, max: 14, step: 0.1, fmt: n => n.toFixed(1) + ' m/s'};
    if (key === 'footstoolAirAccel') return {min: 0, max: 60, step: 0.5, fmt: n => n.toFixed(1) + ' m/s²'};
    if (key === 'footstoolAirMaxSpeed') return {min: 0, max: 20, step: 0.1, fmt: n => n.toFixed(1) + ' m/s'};
    if (key === 'footstoolVaultMargin') return {min: 0, max: 1.2, step: 0.01, fmt: n => n.toFixed(2) + ' m'};
    if (key === 'footstoolStagger') return {min: 0, max: 2, step: 0.05, fmt: n => n.toFixed(2) + ' s'};
    if (key === 'footstoolTolerance') return {min: 0, max: 1, step: 0.01, fmt: n => n.toFixed(2) + ' m'};
    if (key === 'footstoolMinFallSpeed') return {min: 0, max: 10, step: 0.1, fmt: n => n.toFixed(1) + ' m/s'};
    if (key === 'footstoolCooldown') return {min: 0, max: 3, step: 0.05, fmt: n => n.toFixed(2) + ' s'};
    if (key === 'itemPickupRadius') return {min: 0.5, max: 5.0, step: 0.1, fmt: n => n.toFixed(1) + ' m'};
    if (key === 'healHp') return {min: 5, max: 100, step: 5, fmt: n => n + ' HP'};
    if (key === 'healStamina') return {min: 1, max: 10, step: 1, fmt: n => n + ' pontos'};
    if (key === 'stageAttackBonus' || key === 'stageCooldownReduction' || key === 'stageSpeedBonus') return {min: 0.01, max: 0.50, step: 0.01, fmt: n => '+' + (n * 100).toFixed(0) + '%'};
    if (key === 'stageDefenseReduction') return {min: 0.01, max: 0.50, step: 0.01, fmt: n => '-' + (n * 100).toFixed(0) + ' pp'};
  }
  if (/Fraction|Multiplier|Restitution|Scale|Weight|Base$|Opacity|Strength|Smoothing|Alignment|Dot$|Visible$/.test(key)) return {min: /Alignment|Dot/.test(key) ? -1 : 0, max: key === 'uiScale' ? 3 : 2, step: .01, fmt: n => n.toFixed(2)};
  const s = Math.abs(value), max = s >= 50 ? s * 3 : s >= 10 ? s * 4 : s >= 1 ? Math.max(10, s * 4) : s >= .1 ? Math.max(2, s * 5) : Math.max(.5, s * 8), step = s >= 20 ? .5 : s >= 1 ? .05 : s >= .1 ? .01 : .001;
  return {min: 0, max: Math.ceil(max / step) * step, step, fmt: n => n.toFixed(step >= .5 ? 1 : step >= .01 ? 2 : 3)};
}
function help(path, label) {
  const parts = path.split('.'), key = parts.at(-1);
  if (path.startsWith('extras.colors.')) return `Canal ${({R: 'vermelho', G: 'verde', B: 'azul'})[key.slice(-1)]} (0–255) da cor “${label}”. Não modifica a física.`;
  if (path.startsWith('extras.bindings.')) return `Tecla física que executa ${KEY_HELP[key] || key}. Evite atribuir a mesma tecla a comandos diferentes.`;
  if (path.startsWith('profiles.')) return `Perfil ${({balanced: 'equilibrado', agile: 'ágil', resistant: 'resistente'})[parts[1]]}: ${({attack: 'dano base de um tackle sem defesa; também influencia a força do lançamento.', defense: 'resistência legada a empurrões; não torna invulnerável.', speed: 'velocidade ao caminhar e referência da distância nominal de X/C.', hp: 'vida máxima.'})[key]}`;
  if (path === 'extras.gameModes.enemyMode') return 'Comportamento do adversário vermelho. Inclui os quatro modos do v6 e os modos de dummy do laboratório.';
  return TOOLTIPS[key] || 'Parâmetro do laboratório.';
}
/** Valor do jogo oficial para um caminho (ou undefined se o parâmetro não existe no jogo). */
export function officialValue(path) {
  if (OFFICIAL_MAP[path]) return pathGet(OFFICIAL, OFFICIAL_MAP[path]);
  const [root, ...rest] = path.split('.');
  if (root === 'extras') return undefined;
  return pathGet(OFFICIAL[root], rest.join('.'));
}
const same = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Seções do overhaul fora do catálogo original: sprint (Ajustes) e efeitos, sombras, HUD e tremores (Visualizar). */
export const EXTRA_SECTIONS = [['Smear de Membros', 'extras.visual.smear', null], ['Ledge Grab (agarre de borda)', 'ledge', null], ['Squash & Stretch do Tackle', 'extras.visual.squashStretch', null], ['Sprint (C mantido)', 'actions.sprint', null], ['VFX · geral', 'vfx.master', null], ['VFX 3D · geral', 'vfx.solid', null], ...SOLID_FAMILIES.map(f => [`VFX 3D · ${f.label}`, `vfx.${f.key}`, null]),
  ...VFX_TYPES.map(([type, label]) => [`VFX · ${label}`, `vfx.${type}`, null]), ['Tremor · geral', 'vfx.shakeMaster', null], ...SHAKE_EVENTS.map(([key, label]) => [`Tremor · ${label}`, `vfx.${key}`, null]),
  ['Teclas do vermelho (controle manual)', 'extras.bindings2', null], ['VFX · Laser da Arena (BeamRenderer)', 'vfx.laser', null], ['Sombras', 'display.shadow', null], ['HUD', 'display.hud', null], ['Habilidades passivas', 'display.passive', null], ['Altura visual', 'display.grounding', null], ['Indicador da janela C → X', 'display.cancelRing', null], ['Animação: transições', 'display.animation', null], ['Diagnóstico de comandos', 'display.diagnostics', null], ['Janelas de combate', 'display.windows', null], ['Medidor de desempenho', 'display.perf', null],
  // Passivas (catálogo experimental, §29): uma seção por passiva. A apresentação unificada fica em Visualizar.
  ...PASSIVES.map(p => [`Passivas · ${p.nome}${p.species ? ' (' + p.species + ')' : ''}`, `passivas.${p.id}`, null]),
  ['Passivas · gerais (detecção)', 'passivas.globals', null], ['VFX · three.quarks (experimental)', 'vfx.quarks', null], ['IA · Navegação Yuka (experimental)', 'extras.nav', null], ['VFX · Pós-processamento (experimental)', 'vfx.post', null], ['Hitbox espacial do golpe (experimental)', 'extras.hitbox', null], ['Interpolação do desenho (movimento liso)', 'display.interpolation', null],
  ['Cenário do laboratório', 'display.scenery', null], ['HUD de progressão (Banco de Células)', 'display.progress', null], ['Consumíveis (Gemas Facetadas)', 'display.consumables', null]];
/** Parâmetros mostrados em outras abas (sem duplicar controles no Ajustes). */
const ELSEWHERE = new Set(['extras.toggles.enableEnemyAI', 'extras.toggles.enemyManual', 'extras.visual.shadowMin', 'extras.visual.shadowHeightFade']);
export function createTuning({apply}) {
  const base = defaults(), manifest = [];
  for (const [section, rootPath, subset] of [...SECTIONS, ...EXTRA_SECTIONS]) {
    const root = pathGet(C, rootPath);
    for (const key of subset ?? Object.keys(root)) {
      const v = root[key];if (typeof v !== 'number') continue;
      const path = rootPath + '.' + key, am = overhaulMeta(path) || actionMeta(path), r = {...widenCombatRange(path, am ? am.range : range(key, v, path))};
      r.min = Math.max(r.min, SAFE_MIN[path] ?? -Infinity);r.min = Math.min(r.min, v);r.max = Math.max(r.max, v);
      const label = am ? am.label : path.startsWith('extras.colors.') ? (COLOR_NAMES[key.slice(0, -1)] || key) + ' · ' + ({R: 'Vermelho', G: 'Verde', B: 'Azul'})[key.slice(-1)] : path === 'extras.bindings.dodge' ? 'Tecla de esquiva (C)' : NAMES[key] || key;
      manifest.push({section, path, key, label, help: am ? am.help : help(path, label), initial: pathGet(base, path), official: officialValue(path), ...r});
    }
  }
  const byPath = new Map(manifest.map(m => [m.path, m]));
  const state = {tab: TABS[0][0], filter: 'all', undo: [], redo: [], saved: snapshotValues(), savedLabel: 'padrão', listeners: new Set(), folds: new Map(), external: new Set(), view: 'type', mech: MECHANIC_ORDER[0], level: 'basic', tagFilter: '', tags: loadTags()};
  try {const o = JSON.parse(localStorage.getItem('arenamon-lab-tune-view-v1') || '{}');if (o.view === 'mech' || o.view === 'type') state.view = o.view;if (['basic', 'advanced', 'technical'].includes(o.level)) state.level = o.level;} catch {/* sem armazenamento */}
  const saveView = () => {try {localStorage.setItem('arenamon-lab-tune-view-v1', JSON.stringify({view: state.view, level: state.level}));} catch {/* sem armazenamento */}};
  const inTabs = m => TABS.some(([, sec]) => sec.includes(m.section));
  const scoped = m => !ELSEWHERE.has(m.path) && (state.view === 'mech' || inTabs(m));
  const tagsOf = m => state.tags[m.path] ?? [];
  function snapshotValues() {return Object.fromEntries(manifest.map(m => [m.path, pathGet(C, m.path)]));}
  const status = m => {const v = pathGet(C, m.path);return m.official === undefined ? 'lab' : same(v, m.official) ? 'official' : 'experimental';};
  const changed = m => !same(pathGet(C, m.path), m.initial);
  function emit() {for (const fn of state.listeners) fn();}
  /** Aplica um conjunto de mudanças como uma única entrada de histórico. */
  function commit(changes, label) {
    const real = changes.filter(([p, v]) => !same(pathGet(C, p), v)).map(([p, v]) => [p, pathGet(C, p), v]);
    if (!real.length) return 0;
    for (const [p, , v] of real) pathSet(C, p, v);
    state.undo.push({label, changes: real});state.redo.length = 0;if (state.undo.length > 300) state.undo.shift();
    apply();render();emit();return real.length;
  }
  /** Aplica valores sem entrada no histórico (troca A × B durante a partida); o desfazer continua intacto. */
  function setTransient(changes) {let n = 0;for (const [p, v] of changes) if (!same(pathGet(C, p), v) && pathSet(C, p, v)) n++;if (n) {apply();render();emit();}return n;}
  function undo() {const e = state.undo.pop();if (!e) return;for (const [p, before] of e.changes) pathSet(C, p, before);state.redo.push(e);apply();render();emit();}
  function redo() {const e = state.redo.pop();if (!e) return;for (const [p, , after] of e.changes) pathSet(C, p, after);state.undo.push(e);apply();render();emit();}
  const dirty = () => manifest.some(m => !same(pathGet(C, m.path), state.saved[m.path]));
  function markSaved(label) {state.saved = snapshotValues();state.savedLabel = label;emit();}

  // ---------- Interface ----------
  const tip = $('help-tip');
  function showTip(m, el) {tip.replaceChildren();const t = document.createElement('strong');t.textContent = m.label;const b = document.createElement('span');b.textContent = m.help;const c = document.createElement('code');c.textContent = m.path + (m.official !== undefined ? ` · jogo: ${m.fmt(m.official)}` : ' · não existe no jogo');tip.append(t, b, c);tip.hidden = false;const r = el.getBoundingClientRect(), w = tip.getBoundingClientRect().width;tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';const h = tip.getBoundingClientRect().height;tip.style.top = (r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8) + 'px';}
  const hideTip = () => {tip.hidden = true;};
  function renderTabs() {
    const box = $('tune-tabs');box.replaceChildren();
    if (state.view === 'mech') {
      for (const id of MECHANIC_ORDER) {
        const n = manifest.filter(m => scoped(m) && mechanicsOf(m.path).includes(id) && visible(m)).length;if (!n && id !== state.mech) continue;
        const b = document.createElement('button');b.type = 'button';b.role = 'tab';b.textContent = `${mechanicLabel(id)} · ${n}`;b.setAttribute('aria-pressed', String(state.mech === id));b.onclick = () => {state.mech = id;render();};box.append(b);
      }
      return;
    }
    for (const [name, sections] of TABS) {
      const n = manifest.filter(m => sections.includes(m.section) && visible(m)).length, b = document.createElement('button');b.type = 'button';b.role = 'tab';
      b.textContent = `${name} · ${n}`;b.setAttribute('aria-pressed', String(state.tab === name));b.onclick = () => {state.tab = name;render();};box.append(b);
    }
  }
  function visible(m) {
    if (ELSEWHERE.has(m.path)) return false;
    const q = $('tune-search').value.trim().toLowerCase();
    if (q && !(m.label + ' ' + m.path + ' ' + m.help + ' ' + m.section).toLowerCase().includes(q)) return false;
    if (state.tagFilter) {const t = tagsOf(m);if (state.tagFilter === '__none' ? t.length : !t.includes(state.tagFilter)) return false;}
    // O nível só esconde parâmetros quando não há busca, filtro ou etiqueta: o que você procura sempre aparece.
    if (!q && state.filter === 'all' && !state.tagFilter && !levelVisible(m.path, state.level)) return false;
    return state.filter === 'all' || (state.filter === 'changed' ? changed(m) : status(m) === state.filter);
  }
  function render() {
    renderTabs();const list = $('tune-list');list.replaceChildren();const q = $('tune-search').value.trim();
    const everything = q || state.filter !== 'all' || state.tagFilter;
    const mech = state.view === 'mech', pool = m => mech ? scoped(m) && (everything || mechanicsOf(m.path).includes(state.mech)) : true;
    const sections = mech ? [...new Set(manifest.filter(m => scoped(m) && pool(m)).map(m => m.section))] : everything ? TABS.flatMap(([, s]) => s) : TABS.find(([n]) => n === state.tab)[1];
    let total = 0;
    for (const section of sections) {
      const members = manifest.filter(m => m.section === section && pool(m) && visible(m));if (!members.length) continue;total += members.length;
      const group = document.createElement('div');group.className = 'tune-group';
      const head = document.createElement('header');const title = document.createElement('span');title.textContent = section;
      const reset = document.createElement('button');reset.type = 'button';reset.textContent = '↺ grupo';reset.title = 'Restaurar este grupo aos padrões do laboratório';
      reset.onclick = () => commit(members.map(m => [m.path, m.initial]), 'Restaurar ' + section);
      const body = document.createElement('div');body.className = 'tune-body';for (const m of members) body.append(control(m));
      if (members.length > 2) {const fold = document.createElement('button');fold.type = 'button';fold.className = 'fold-btn';const set = open => {state.folds.set(section, open);body.hidden = !open;fold.textContent = open ? '▼' : '▶';fold.title = (open ? 'Recolher ' : 'Expandir ') + section;fold.setAttribute('aria-expanded', String(open));};fold.onclick = () => set(body.hidden);set(state.folds.get(section) ?? false);head.prepend(fold);}
      head.append(title, reset);group.append(head, body);
      list.append(group);
    }
    if (!total) {const p = document.createElement('p');p.className = 'hint';p.textContent = state.level !== 'technical' ? 'Nenhum parâmetro neste filtro. Alguns podem estar ocultos pelo nível: escolha “Tudo” em Nível.' : 'Nenhum parâmetro neste filtro.';list.append(p);}
    // Conta só o que esta aba mostra (efeitos, sombras, HUD, câmera e teclas ficam em outras abas).
    const here = manifest.filter(m => scoped(m));
    const hidden = (q || state.filter !== 'all' || state.tagFilter) ? 0 : manifest.filter(m => scoped(m) && !levelVisible(m.path, state.level)).length;
    $('tune-counter').textContent = `${total} de ${here.length} · ${here.filter(m => status(m) === 'experimental').length} ≠ jogo` + (hidden ? ` · ${hidden} ocultos pelo nível` : '');
    syncOrgUi();
    $('tune-undo').disabled = !state.undo.length;$('tune-redo').disabled = !state.redo.length;
    $('tune-undo').title = state.undo.length ? 'Desfazer: ' + state.undo.at(-1).label : 'Nada para desfazer';$('tune-redo').title = state.redo.length ? 'Refazer: ' + state.redo.at(-1).label : 'Nada para refazer';
  }
  const fill = el => {if (el.type === 'range') el.style.setProperty('--p', ((Number(el.value) - Number(el.min)) / ((Number(el.max) - Number(el.min)) || 1) * 100).toFixed(1) + '%');};
  function control(m) {
    const v = pathGet(C, m.path), row = document.createElement('div');row.className = 'tune-control' + (changed(m) ? ' changed' : '');
    const top = document.createElement('div');top.className = 'tune-top';
    // Um mesmo parâmetro pode aparecer em mais de um lugar (ex.: VFX simples e avançado): ids únicos, mesmo valor.
    let id = (state.renderingExternal ? 'ext-' : 'tune-') + m.path.replaceAll('.', '-');if (state.renderingExternal) {const base = id;for (let k = 2; document.getElementById(id); k++) id = `${base}-${k}`;}
    const label = document.createElement('label');label.htmlFor = id;label.textContent = m.label;
    const q = document.createElement('button');q.type = 'button';q.className = 'tune-help';q.textContent = '?';q.setAttribute('aria-label', 'Explicação: ' + m.label);
    q.onpointerenter = () => showTip(m, q);q.onpointerleave = hideTip;q.onfocus = () => showTip(m, q);q.onblur = hideTip;
    const st = status(m), badge = document.createElement('span');badge.className = 'badge ' + (st === 'lab' ? 'labonly' : st);
    badge.textContent = st === 'official' ? 'jogo' : st === 'experimental' ? '≠ jogo' : 'lab';
    badge.title = st === 'official' ? 'Igual ao config.ts do jogo' : st === 'experimental' ? `Difere do jogo (jogo: ${m.fmt(m.official)})` : 'Existe só no laboratório';
    const value = document.createElement('span');value.className = 'tune-value';value.textContent = m.fmt(v);
    top.append(label, q, badge, value);
    const slider = input(m, id, value);slider.setAttribute('aria-describedby', id + '-d');
    const bottom = document.createElement('div');bottom.className = 'tune-bottom';const code = document.createElement('span');code.id = id + '-d';code.textContent = m.path;
    const actions = document.createElement('span');
    const reset = document.createElement('button');reset.type = 'button';reset.textContent = '↺ lab';reset.title = 'Padrão do laboratório: ' + m.fmt(m.initial);reset.disabled = !changed(m);reset.onclick = () => commit([[m.path, m.initial]], 'Restaurar ' + m.label);
    actions.append(reset);
    if (st === 'experimental') {const g = document.createElement('button');g.type = 'button';g.textContent = '= jogo';g.title = 'Usar o valor do jogo: ' + m.fmt(m.official);g.onclick = () => commit([[m.path, m.official]], 'Valor do jogo: ' + m.label);actions.append(g);}
    const tg = document.createElement('button');tg.type = 'button';tg.className = 'tag-btn';tg.textContent = tagsOf(m).length ? '🏷 ' + tagsOf(m).length : '🏷';tg.title = tagsOf(m).length ? 'Etiquetas: ' + tagsOf(m).join(', ') : 'Adicionar etiqueta';tg.setAttribute('aria-label', 'Etiquetas de ' + m.label);
    tg.onclick = ev => {ev.stopPropagation();openTagPop(m, tg);};actions.prepend(tg);
    bottom.append(code, actions);
    // Liga/desliga fica na mesma linha do rótulo (mais compacto).
    if (m.kind === 'toggle') {top.prepend(slider);row.append(top, bottom);row.classList.add('is-toggle');} else row.append(top, slider, bottom);
    if (tagsOf(m).length) {const chips = document.createElement('div');chips.className = 'tag-chips';for (const t of tagsOf(m)) {const c = document.createElement('span');c.className = 'tag-chip';c.textContent = t;chips.append(c);}row.append(chips);}
    const d = derivedText(m.path);if (d) {const el = document.createElement('div');el.className = 'tune-derived';el.dataset.derived = m.path;el.textContent = '→ ' + d;row.append(el);}
    return row;
  }
  /** Campo do parâmetro conforme o tipo; mudanças entram no histórico (desfazer/refazer). */
  function input(m, id, value) {
    const v = pathGet(C, m.path);let el;
    if (m.kind === 'select') {el = document.createElement('select');m.options.forEach((o, i) => el.append(new Option(o, String(i))));el.value = String(Math.round(v));el.onchange = () => commit([[m.path, Number(el.value)]], m.label);}
    else if (m.kind === 'toggle') {el = document.createElement('input');el.type = 'checkbox';el.className = 'tune-toggle';el.checked = !!v;el.onchange = () => commit([[m.path, el.checked ? 1 : 0]], m.label);}
    else if (m.kind === 'color') {el = document.createElement('input');el.type = 'color';el.value = m.fmt(v);el.oninput = () => {pathSet(C, m.path, parseInt(el.value.slice(1), 16));value.textContent = el.value;apply();};el.onchange = () => {const after = parseInt(el.value.slice(1), 16);pathSet(C, m.path, state.colorBefore ?? after);commit([[m.path, after]], m.label);state.colorBefore = undefined;};el.onfocus = () => {state.colorBefore = pathGet(C, m.path);};}
    else {
      el = document.createElement('input');el.type = 'range';el.min = m.min;el.max = m.max;el.step = m.step;el.value = v;let before = null;fill(el);el.addEventListener('input', () => fill(el));
      el.addEventListener('input', () => {if (before === null) before = pathGet(C, m.path);const n = Math.max(m.min, Math.min(m.max, Number(el.value)));pathSet(C, m.path, n);value.textContent = m.fmt(n);apply();refreshDerived();});
      el.addEventListener('change', () => {const after = pathGet(C, m.path);if (before !== null && !same(before, after)) {pathSet(C, m.path, before);commit([[m.path, after]], m.label);}before = null;});
    }
    el.id = id;el.dataset.path = m.path;return el;
  }
  /** Controle de um parâmetro para outras abas (Visualizar, Partida, Controles). Atualiza sozinho em desfazer/presets. */
  /** Controles de uma seção inteira (para outras abas). */
  function sectionControls(section) {return manifest.filter(m => m.section === section && !ELSEWHERE.has(m.path)).map(m => controlFor(m.path));}
  function controlFor(path) {
    const m = byPath.get(path);if (!m) throw new Error('parâmetro inexistente: ' + path);
    state.renderingExternal = true;const row = control(m);state.renderingExternal = false;row.classList.add('external');state.external.add({row, m});return row;
  }
  function refreshExternal() {
    for (const e of [...state.external]) {
      if (!e.row.isConnected) {state.external.delete(e);continue;}
      const v = pathGet(C, e.m.path), el = e.row.querySelector('[data-path]'), out = e.row.querySelector('.tune-value');
      if (document.activeElement === el && e.m.kind !== 'select') continue;
      if (e.m.kind === 'toggle') el.checked = !!v;else if (e.m.kind === 'color') el.value = e.m.fmt(v);else el.value = String(e.m.kind === 'select' ? Math.round(v) : v);fill(el);
      out.textContent = e.m.fmt(v);e.row.classList.toggle('changed', changed(e.m));
    }
  }
  state.listeners.add(refreshExternal);
  $('tune-search').addEventListener('input', () => {hideTip();render();});
  for (const b of document.querySelectorAll('[data-filter]')) b.onclick = () => {state.filter = b.dataset.filter;for (const x of document.querySelectorAll('[data-filter]')) x.setAttribute('aria-pressed', String(x === b));render();};
  $('tune-undo').onclick = undo;$('tune-redo').onclick = redo;
  // ---------- Organização: visão, nível, etiquetas ----------
  /** Recalcula os textos derivados visíveis (os valores dependem de outros parâmetros). */
  function refreshDerived() {for (const el of document.querySelectorAll('.tune-derived[data-derived]')) el.textContent = '→ ' + (derivedText(el.dataset.derived) ?? '');}
  state.listeners.add(refreshDerived);
  function syncOrgUi() {
    for (const b of document.querySelectorAll('[data-tview]')) b.setAttribute('aria-pressed', String(b.dataset.tview === state.view));
    const lv = $('tune-level');if (lv) lv.value = state.level;
    const tg = $('tune-tag');
    if (tg) {
      const count = t => Object.values(state.tags).filter(a => a.includes(t)).length;
      const opts = [['', 'Todas as etiquetas'], ['__none', 'Sem etiqueta'], ...allTags(state.tags).map(t => [t, `🏷 ${t}${count(t) ? ' · ' + count(t) : ''}`])];
      tg.replaceChildren(...opts.map(([v, t]) => new Option(t, v)));tg.value = opts.some(([v]) => v === state.tagFilter) ? state.tagFilter : '';
    }
    const ex = $('tune-tag-export');
    if (ex) {
      const n = Object.keys(state.tags).filter(p => state.tags[p].length && byPath.has(p) && (!state.tagFilter || (state.tagFilter !== '__none' && state.tags[p].includes(state.tagFilter)))).length;
      ex.disabled = !n;ex.textContent = `↓ Exportar marcados (${n})`;ex.title = state.tagFilter ? `Exporta os ${n} parâmetros com a etiqueta “${state.tagFilter}”` : `Exporta os ${n} parâmetros que têm alguma etiqueta`;
    }
  }
  let pop = null;
  function closeTagPop() {pop?.remove();pop = null;}
  function openTagPop(m, anchor) {
    closeTagPop();pop = document.createElement('div');pop.className = 'tag-pop';pop.setAttribute('role', 'dialog');pop.setAttribute('aria-label', 'Etiquetas de ' + m.label);
    const title = document.createElement('strong');title.textContent = m.label;pop.append(title);
    const set = tag => {const cur = new Set(tagsOf(m));cur.has(tag) ? cur.delete(tag) : cur.add(tag);if (cur.size) state.tags[m.path] = [...cur];else delete state.tags[m.path];saveTags(state.tags);closeTagPop();render();emit();};
    const chips = document.createElement('div');chips.className = 'tag-pop-chips';
    for (const t of allTags(state.tags)) {const b = document.createElement('button');b.type = 'button';b.textContent = t;b.setAttribute('aria-pressed', String(tagsOf(m).includes(t)));b.onclick = () => set(t);chips.append(b);}
    const add = document.createElement('input');add.type = 'text';add.placeholder = 'Nova etiqueta + Enter';add.maxLength = 24;
    add.onkeydown = ev => {ev.stopPropagation();if (ev.key === 'Enter' && add.value.trim()) {ev.preventDefault();const t = add.value.trim().toLowerCase();if (!tagsOf(m).includes(t)) set(t);else closeTagPop();} else if (ev.key === 'Escape') closeTagPop();};
    pop.append(chips, add);document.body.append(pop);
    const r = anchor.getBoundingClientRect(), w = pop.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(innerWidth - w.width - 8, r.right - w.width)) + 'px';
    pop.style.top = (r.bottom + 6 + w.height > innerHeight ? Math.max(8, r.top - w.height - 6) : r.bottom + 6) + 'px';add.focus();
  }
  document.addEventListener('pointerdown', e => {if (pop && !pop.contains(e.target) && !e.target.closest?.('.tag-btn')) closeTagPop();});
  for (const b of document.querySelectorAll('[data-tview]')) b.onclick = () => {state.view = b.dataset.tview;saveView();render();};
  if ($('tune-level')) $('tune-level').onchange = () => {state.level = $('tune-level').value;saveView();render();};
  if ($('tune-tag')) $('tune-tag').onchange = () => {state.tagFilter = $('tune-tag').value;render();};
  /** Baixa um JSON no formato do Ajustes só com os parâmetros etiquetados (ou com a etiqueta filtrada). */
  function exportTagged() {
    const paths = Object.keys(state.tags).filter(p => byPath.has(p) && state.tags[p].length && (!state.tagFilter || (state.tagFilter !== '__none' && state.tags[p].includes(state.tagFilter))));
    if (!paths.length) return 0;
    const data = {schema: 'arenamon-tuning', version: 9, source: 'arenamon-combate-laboratorio (marcados)', createdAt: new Date().toISOString(), filterTag: state.tagFilter || null, values: nestedFrom(paths, p => pathGet(C, p)), tags: Object.fromEntries(paths.map(p => [p, state.tags[p]])), note: 'Somente parâmetros etiquetados; importe pela aba Exportar para aplicar.'};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], {type: 'application/json'})), a = document.createElement('a');
    a.href = url;a.download = 'arenamon-marcados' + (state.tagFilter ? '-' + state.tagFilter.replace(/[^A-Za-z0-9]+/g, '_') : '') + '.json';a.click();setTimeout(() => URL.revokeObjectURL(url), 4000);
    return paths.length;
  }
  if ($('tune-tag-export')) $('tune-tag-export').onclick = exportTagged;
  $('tune-list').addEventListener('scroll', hideTip, {passive: true});

  // Presets: ui/presets-panel.js (biblioteca com presets de sensação, categorias, versões e comparação).
  /** Todos os parâmetros numéricos de C (inclui os que NÃO têm controle no Ajustes, como os dos Moves em `world.*`): a exportação e a importação os levam junto. */
  const rootsOf = obj => Object.fromEntries(ROOT_KEYS.map(k => [k, obj[k]]));
  const manifestPaths = () => new Set(manifest.map(m => m.path));
  const known = () => new Set([...manifestPaths(), ...Object.keys(flatten(rootsOf(base)))]);
  /** Valores de referência para comparações: atuais, padrão do laboratório ou jogo oficial (presets: presets-panel). */
  const valuesOf = id => id === '__current' ? snapshotValues() : id === '__lab' ? Object.fromEntries(manifest.map(m => [m.path, m.initial])) : id === '__game' ? Object.fromEntries(manifest.filter(m => m.official !== undefined).map(m => [m.path, m.official])) : {};

  // ---------- JSON ----------
  /** Parâmetros alterados que o Ajustes não lista (Moves e demais ações em `world.*`, etc.): antes ficavam só em `values` e sumiam de «changedFromLabDefaults». */
  const extraChanged = () => changedOutsideManifest(rootsOf(C), rootsOf(base), manifestPaths());
  function exportData() {
    const values = Object.fromEntries(ROOT_KEYS.map(k => [k, structuredClone(C[k])]));
    return {schema: 'arenamon-tuning', version: 9, source: 'arenamon-combate-laboratorio (overhaul)', createdAt: new Date().toISOString(), values,
      changedFromLabDefaults: [...manifest.filter(changed).map(m => ({path: m.path, lab: m.initial, value: pathGet(C, m.path)})), ...extraChanged()],
      differencesFromGame: manifest.filter(m => status(m) === 'experimental').map(m => ({path: m.path, game: m.official, lab: pathGet(C, m.path)})),
      labOnlyParameters: manifest.filter(m => m.official === undefined).length,
      note: 'Valores do laboratório. Nada é aplicado ao jogo automaticamente; use differencesFromGame para decidir o que levar ao config.ts.'};
  }
  /** Valida sem aplicar. Aceita JSON v5/v6 ({values}), v7 e v8; formatos antigos são migrados com relatório. */
  function preview(raw) {
    let data;try {data = JSON.parse(raw);} catch (e) {return {error: 'JSON inválido: ' + e.message};}
    const nested = data?.values ?? data;if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return {error: 'Objeto de configurações não encontrado.'};
    const migration = migrateFlat(flatten(nested), known()), values = migration.values;
    const changes = [], invalid = [];
    for (const m of manifest) {const v = values[m.path];if (v === undefined) continue;if (typeof v !== 'number' || !Number.isFinite(v) || v < m.min - 1e-8 || v > m.max + 1e-8) {invalid.push(`${m.path} = ${v}`);continue;}if (!same(v, pathGet(C, m.path))) changes.push([m.path, v]);}
    // Parâmetros sem controle no Ajustes (Moves em `world.*` etc.): aceitos se existem no padrão e são números finitos (sem faixa de slider).
    const extra = importOutsideManifest(values, rootsOf(base), rootsOf(C), manifestPaths());
    changes.push(...extra.changes);invalid.push(...extra.invalid);
    if (invalid.length) return {error: `Valores inválidos ou fora da faixa (${invalid.length}): ${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? '…' : ''}`};
    return {changes, schema: data.schema || 'v5/v6', version: data.version ?? '—', converted: migration.converted, ignored: migration.ignored};
  }
  function apply_(changes, label) {const n = commit(changes, label);markSaved(label);return n;}
  function resetAll() {commit(manifest.map(m => [m.path, m.initial]), 'Restaurar todos os padrões');}
  render();
  return {manifest, byPath, exportTagged, state, commit, setTransient, undo, redo, render, controlFor, sectionControls, exportData, preview, applyChanges: apply_, resetAll, markSaved, dirty, status, changed,
    onChange: fn => state.listeners.add(fn), get savedLabel() {return state.savedLabel;}, snapshotValues, officialValue, valuesOf, migrate: flat => migrateFlat(flat, known())};
}
export const escape = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
export {resetConfig};
