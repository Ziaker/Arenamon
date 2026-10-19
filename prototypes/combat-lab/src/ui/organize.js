// Organização dos parâmetros do Ajustes: visão por mecânica, níveis (Básico / Avançado / Técnico), valores derivados
// e etiquetas próprias. Funções puras (sem DOM), exceto o armazenamento das etiquetas, que é opcional e tolerante a falhas.
import {C} from '../sim/config.js';

// ---------- Mecânicas ----------
// Um parâmetro pode aparecer em mais de uma mecânica (ex.: guard stun em Defesa e em Tackle). A visão "Por tipo" continua igual.
const re = (...p) => new RegExp('^(?:' + p.join('|') + ')');
export const MECHANICS = [
  ['tackle', 'Tackle (X)', re('rules\\.(?:chargeTackle|sprintTacklePL|wallSplat|slam|groundBounce|feint)', 'extras\\.toggles\\.(?:enableChargeTackle|enableWallSplat|enableMeteorSlam|enableTackleFeint)', 'actions\\.tackle\\.', 'actions\\.buffer\\.', 'extras\\.combat\\.(?:tackle|impactHitstop|contactProjection)', 'rules\\.(?:recoil|blend)', 'extras\\.toggles\\.(?:enableTackle|enableHitstop)', 'vfx\\.(?:hit|solidImpact|shakeHit)\\.')],
  ['dodge', 'Esquiva (C)', re('actions\\.dodge\\.', 'actions\\.cancel\\.', 'extras\\.combat\\.vault', 'extras\\.toggles\\.(?:enableDodge|enableInvulnerability|enableVault|enableTechRecovery)', 'vfx\\.(?:dodge|solidDodge)\\.')],
  ['sprint', 'Sprint', re('actions\\.sprint\\.', 'extras\\.toggles\\.enableSprint', 'vfx\\.(?:sprint|solidRunDust|solidRunWind|solidDust|solidWind)\\.')],
  ['defense', 'Defesa e bloqueio perfeito', re('rules\\.(?:guard|perfect)', 'extras\\.combat\\.(?:guard|perfect)', 'actions\\.dodge\\.(?:counterWindow|perfectEvadeStamina)', 'actions\\.tackle\\.(?:counterSpeed|guardCancel|perfectGuardCancel)', 'extras\\.toggles\\.(?:enableDefense|enableCounterBonus)', 'vfx\\.(?:block|solidBlock|perfect|shakeGuard|shakePerfect)\\.')],
  ['stamina', 'Stamina e exaustão', re('rules\\.(?:staminaMax|regen|exhaust)', 'extras\\.combat\\.(?:exhaustRecovery|guardRegenFactor)', 'actions\\.sprint\\.(?:staminaDrain|minStamina|exhaustedStop)', 'vfx\\.(?:exhaust|regen)\\.')],
  ['launch', 'Dano, empurrão e lançamento', re('rules\\.(?:launch|landing|wallRestitution|wallBounce)', 'extras\\.combat\\.(?:launch|landingSkid)', 'test\\.(?:push|attack|defense|speedReference|defenseMedian|attackReference)', 'extras\\.toggles\\.(?:enableLaunch|enableWallBounce|enableLandingSkid)', 'vfx\\.(?:solidLanding|ground|shakeGround)\\.')],
  ['clash', 'Clash', re('rules\\.clash', 'extras\\.combat\\.clash', 'extras\\.toggles\\.enableClash', 'vfx\\.(?:clash|solidClash|shakeClash)\\.')],
  ['attributes', 'Atributos e perfis', re('profiles\\.', 'test\\.(?:hp|attack|defense|speed)$')],
  ['movement', 'Movimento', re('locomotion\\.', 'rules\\.(?:exhaustedSpeed|guardSpeed)')],
  ['ai', 'IA', re('extras\\.ai\\.', 'extras\\.aiRed\\.', 'extras\\.aiBlue\\.', 'test\\.(?:aiInterval|aiRange)', 'extras\\.toggles\\.(?:enableAIAttack|enableAIReactive|enablePlayerAI|enableEnemyAI|enemyManual)')],
  ['camera', 'Câmera', re('camera\\.', 'extras\\.cameraExtra\\.', 'extras\\.toggles\\.enableCamera')],
  ['moves', 'Reflect e Psyshock (visual)', re('vfx\\.(?:rock|barrier|solidReflect|laser)\\.')],
  ['arena', 'Arena e simulação', re('test\\.(?:step|maxFrame|arenaHalf|halfExtent|contactStep|epsilon|forwardTolerance)')],
  ['visual', 'Visual, efeitos e HUD', re('extras\\.(?:visual|colors|fx|hud)\\.', 'display\\.', 'vfx\\.', 'extras\\.toggles\\.(?:showHitboxes|showAttackVectors)')],
  ['keys', 'Teclas', re('extras\\.(?:bindings|bindings2|keyCodes)\\.')],
];
const FALLBACK = ['other', 'Outros'];

/** Mecânicas a que um caminho pertence (ordem de MECHANICS); nunca vazio. */
export function mechanicsOf(path) {
  const out = MECHANICS.filter(([, , test]) => test.test(path)).map(([id]) => id);
  return out.length ? out : [FALLBACK[0]];
}
export const mechanicLabel = id => (MECHANICS.find(([i]) => i === id) ?? FALLBACK)[1];
export const MECHANIC_ORDER = [...MECHANICS.map(([id]) => id), FALLBACK[0]];

// ---------- Níveis ----------
export const LEVELS = [['basic', 'Básico'], ['advanced', 'Avançado'], ['technical', 'Técnico']];
const BASIC = new Set([
  'actions.tackle.duration', 'actions.tackle.cost', 'actions.tackle.distance', 'actions.tackle.invulnerable', 'actions.tackle.recovery',
  'actions.dodge.duration', 'actions.dodge.cost', 'actions.dodge.distance', 'actions.dodge.invulnerable', 'actions.dodge.recovery', 'actions.dodge.counterWindow', 'actions.dodge.perfectEvadeStamina',
  'actions.cancel.windowStart', 'actions.cancel.windowEnd', 'actions.cancel.invulnerability', 'actions.buffer.window',
  'actions.sprint.speedMultiplier', 'actions.sprint.staminaDrain', 'actions.sprint.minStamina',
  'rules.recoil', 'rules.recoilFraction', 'rules.guardStun', 'rules.perfect', 'rules.perfectCooldown', 'rules.staminaMax', 'rules.regenDelay', 'rules.regenTime', 'rules.guardSpeed', 'rules.exhaustedSpeed',
  'rules.feintCost', 'rules.feintDuration', 'rules.wallSplatDuration', 'rules.wallSplatMinSpeed', 'rules.slamDamage', 'rules.groundBounceForce', 'rules.chargeTackleMaxTime', 'rules.chargeTackleSpeed2', 'rules.chargeTackleSpeed3', 'rules.chargeTackleDamage2', 'rules.chargeTackleDamage3', 'rules.clashFraction', 'rules.clashPushDistance', 'rules.techWindow', 'rules.techCost', 'rules.clashUp', 'rules.clashHorizontal', 'rules.launchUp', 'rules.launchHorizontal', 'rules.launchGravity', 'rules.landingRecovery', 'rules.wallRestitution',
  'extras.combat.guardDamageMultiplier', 'extras.combat.impactHitstop', 'extras.combat.clashHitstop', 'extras.combat.perfectGuardCounterWindow',
  'test.pushCoefficient', 'test.pushDuration', 'test.arenaHalf', 'test.hp',
  'locomotion.acceleration', 'locomotion.braking', 'locomotion.turnRate', 'locomotion.friction',
  'camera.distance', 'camera.fov', 'extras.ai.attackRange', 'extras.ai.combatAttackCooldown', 'extras.ai.approachDistance',
]);
const TECH_PATH = /^(?:display\.|extras\.colors\.|extras\.bindings2?\.|extras\.cameraExtra\.|extras\.hud\.|test\.(?:step|maxFrame|epsilon|contactStep|forwardTolerance|halfExtent|aiInterval)|extras\.combat\.contactProjection)/;
const TECH_KEY = /(?:^|\.)(?:curveStart|blend|profile|steerLimit|steerRate|decelStart|prepSpeed|prepTime|impulseTime|travelEnd|selfCancelFromEnd|selfCancel|recoveryTime|chainAfter|distanceReference|vaultPhysics|windowMode|fromEnd|velocityInfluence|transition|epsilon|accelCurve|brakeCurve|frameLatch|moveFrame|stopThreshold|residualSpeed|turnGrip|turnAcceleration)$/;
const BASIC_VFX = /^vfx\.[A-Za-z0-9]+\.(?:enabled|intensity)$/;
const ADVANCED_VFX = /^vfx\.[A-Za-z0-9]+\.(?:variant|amount|size|duration|opacity|count|scale|length|radius|density|speed)$/;

/** Nível de um parâmetro: 'basic' | 'advanced' | 'technical'. */
export function levelOf(path) {
  if (BASIC.has(path) || BASIC_VFX.test(path) || /^extras\.toggles\.enable/.test(path)) return 'basic';
  if (/^profiles\.[a-z]+\.(?:attack|defense|speed|hp)$/.test(path)) return 'basic';
  if (TECH_PATH.test(path) || TECH_KEY.test(path)) return 'technical';
  if (path.startsWith('vfx.')) return ADVANCED_VFX.test(path) ? 'advanced' : 'technical';
  return 'advanced';
}
const LEVEL_RANK = {basic: 0, advanced: 1, technical: 2};
/** `shown` = 'basic' | 'advanced' | 'technical' (o maior nível exibido; 'technical' mostra tudo). */
export const levelVisible = (path, shown) => LEVEL_RANK[levelOf(path)] <= (LEVEL_RANK[shown] ?? 2);

// ---------- Valores derivados ----------
const f = (n, d = 2) => Number(n).toFixed(d).replace('.', ',');
const attrSpeed = () => C.profiles?.balanced?.speed ?? C.test.speed;
function actionFacts(kind) {
  const a = C.actions[kind];if (!a) return null;
  const ref = a.distanceReference > 0 ? a.distanceReference : a.duration, dist = a.distance * ref * attrSpeed();
  return {a, dist, avg: a.duration > 0 ? dist / a.duration : 0};
}
/** Texto explicando o efeito real de um parâmetro (perfil equilibrado), ou null. Recalculado a cada renderização. */
export function derivedText(path) {
  let m;
  if ((m = /^actions\.(tackle|dodge)\.(duration|distance|distanceReference|cost)$/.exec(path))) {
    const k = actionFacts(m[1]), R = C.rules;if (!k) return null;
    if (m[2] === 'cost') return `Com stamina máxima ${f(R.staminaMax, 1)}: ${k.a.cost > 0 ? Math.floor(R.staminaMax / k.a.cost + 1e-9) : '∞'} uso(s) seguidos.`;
    return `Percorre ≈ ${f(k.dist)} m em ${f(k.a.duration)} s (média ${f(k.avg, 1)} m/s) com o perfil equilibrado.`;
  }
  if (/^rules\.(staminaMax|regenDelay|regenTime)$/.test(path)) {
    const R = C.rules, t = R.regenDelay + R.regenTime;
    return `Recarga completa ≈ ${f(t, 1)} s (espera ${f(R.regenDelay, 1)} s + ${f(R.regenTime, 1)} s). Cabem ${R.staminaMax > 0 && C.actions.tackle.cost > 0 ? Math.floor(R.staminaMax / C.actions.tackle.cost + 1e-9) : '∞'} X seguidos.`;
  }
  if (path === 'actions.sprint.speedMultiplier') return `Sprint ≈ ${f(C.actions.sprint.speedMultiplier * attrSpeed(), 1)} m/s (caminhada ${f(attrSpeed(), 1)} m/s).`;
  if (/^(rules\.(guardStun|perfect|perfectCooldown|recoil)|actions\.buffer\.window|actions\.cancel\.(windowStart|windowEnd)|extras\.combat\.(impactHitstop|clashHitstop))$/.test(path)) {
    const v = path.split('.').reduce((o, k) => o?.[k], C);
    if (typeof v === 'number') return `= ${Math.round(v * 1000)} ms (${f(v * 60, 1)} quadros a 60 Hz).`;
  }
  if (path === 'rules.clashFraction') return `Cada lutador recebe ${Math.round(C.rules.clashFraction * 100)}% do dano que o tackle do rival causaria.`;
  if (path === 'test.arenaHalf') return `Arena de ${C.test.arenaHalf * 2} × ${C.test.arenaHalf * 2} m.`;
  return null;
}

// ---------- Etiquetas ----------
const TAGS_KEY = 'arenamon-lab-tags-v1';
export function loadTags() {
  try {const o = JSON.parse(localStorage.getItem(TAGS_KEY) || '{}');return o && typeof o === 'object' && !Array.isArray(o) ? o : {};} catch {return {};}
}
export function saveTags(tags) {try {localStorage.setItem(TAGS_KEY, JSON.stringify(tags));} catch {/* sem armazenamento: vale só nesta sessão */}}
export const SUGGESTED_TAGS = ['em teste', 'calibrar depois', 'não mexer'];
export const allTags = tags => [...new Set([...SUGGESTED_TAGS, ...Object.values(tags).flat()])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
/** Objeto aninhado {extras: {...}} só com os caminhos dados (formato aceito pela importação do Ajustes). */
export function nestedFrom(paths, get) {
  const out = {};
  for (const p of paths) {const keys = p.split('.'), last = keys.pop();let o = out;for (const k of keys) o = o[k] ??= {};o[last] = get(p);}
  return out;
}
