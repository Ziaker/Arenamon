// Lutadores, comandos e predicados de estado.
import {C} from './config.js';
import {vec} from './math.js';
import {moveSpec} from './moves.js';
import {stat} from './status.js';

export function createFighter(id, attributes, position) {
  return {id, attributes: {...attributes}, position, velocity: vec(), facing: id ? Math.PI : 0, desiredMove: vec(), locomotionVelocity: vec(),
    combatHeading: id ? Math.PI : 0, visualFacing: id ? Math.PI : 0, angularSpeed: 0, hp: attributes.hp, stamina: C.rules.staminaMax, exhausted: false,
    regenAge: 0, regenBase: C.rules.staminaMax, state: 'neutral', action: null, guard: false, guardSuppressed: false, perfectLeft: 0, perfectCooldown: 0,
    perfectSucceeded: false, stun: 0, push: null, blend: null, contacts: 0, surfaceNormals: [], support: null, flight: null, knockRecovery: 0, vaultHeight: 0, counterWindow: 0, landingSlide: null,
    bufferedTackle: null, inputBuffer: null,
    // Locomoção contínua: fase (accel/cruise/brake/reverse/turn/overspeed), sprint e telemetria do último passo.
    turnVelocity: 0, sprinting: false, sprintCarry: false, locoPhase: 'idle', desiredVelocity: vec(), appliedAccel: vec(), inputDir: vec(), staminaTrend: 0, lastLanding: null, faceGoal: id ? Math.PI : 0, recoveryFrom: null,
    // Movimentos especiais e status (vazios até existirem movimentos): slots equipados, recargas, buffs/debuffs, efeitos a disparar.
    loadout: [], moveCooldowns: {}, statuses: [], moveFx: [],
    // Charge (charge.js): carga em andamento (null = nenhuma), recuperação após soltar (s), comando de Move guardado e eventos a entregar ao jogo.
    charge: null, moveRecovery: 0, skillBuffer: null, moveEvents: [], counterStagger: 0,
    combatWindows: null,
    // Novo Mapa: altura do piso, estágios permanentes, escudo temporário e salto normal
    groundY: 0,
    stages: {attack: 0, defense: 0, staminaMax: 0, cooldown: 0, speed: 0},
    shield: {hp: 0, duration: 0, maxHp: C.map?.shieldMaxCap ?? 80},
    jumpState: {canJump: true, cooldown: 0},
    // Plano D (salto/footstool): coyote time, jump buffering e controle de repetição do footstool.
    coyoteLeft: 0, jumpBuffered: 0, airMoveDir: null, footstoolCooldownT: 0, footstoolDoneWith: null,
    lastAttacker: null, lastDamagedTick: 0};
}
/** Stamina máxima individual de um combatente (inclui seus estágios permanentes individuais sem alterar C.rules.staminaMax). */
export const getFighterMaxStamina = f => f ? C.rules.staminaMax + (f.stages?.staminaMax ?? 0) * (C.map?.stageStaminaBonus ?? 1) : C.rules.staminaMax;

// skill: índice do slot de movimento especial pedido neste passo (null = nenhum; só a BORDA do botão). skillHeld: botões de slot mantidos
// pressionados (array por slot, ou null quando nenhum): é o que mantém e solta um Charge.
/** Altitude real (m) dos pés: `flight.y` já é ABSOLUTA (voo parte de groundY), então em voo NÃO se soma groundY; no chão vale groundY (+ elevação do vault). */
export const altitudeOf = f => (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0);
export const emptyCommand = () => ({move: vec(), dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
/** Parâmetros próprios de uma ação X/C (C.actions.dodge ou C.actions.tackle). */
export const actionParams = kind => C.actions[kind];
/** Duração de uma ação: esquiva e tackle têm durações independentes; recuo usa as regras gerais. */
export const actionDuration = kind => kind === 'recoil' ? C.rules.recoil : C.actions[kind].duration;
/** Tempos de qualquer ação em curso (X, C, recuo ou movimento especial): duração, encadeamento, invulnerabilidade, recuperação. */
export function actionSpec(action) {
  if (action.kind === 'recoil') return {duration: C.rules.recoil, chainAfter: 0, invulnerable: 0, invulnerableFrom: 0, recovery: 0};
  if (action.kind === 'move') return moveSpec(action);
  const p = C.actions[action.kind];return {duration: p.duration * (action.durationScale ?? 1), chainAfter: action.chainAfter ?? p.chainAfter, invulnerable: p.invulnerable, invulnerableFrom: 0, recovery: p.recovery};
}
/**
 * Distância nominal: multiplicador próprio × tempo de referência × velocidade do lutador (GDD 7.2: 2,5 × 400 ms).
 * Com distanceReference = 0 o tempo de referência é a própria duração (Etapa A: a distância acompanhava a duração).
 */
export const nominalDistance = (f, kind = 'dodge') => {const p = C.actions[kind];return p.distance * (p.distanceReference > 0 ? p.distanceReference : p.duration) * stat(f, 'speed', f.attributes.speed);};
/** Invulnerável agora? Janela própria da ação (ou a herdada no cancelamento C → X). */
export const invulnerableWindow = action => {
  if (action?.invulnerableFor !== undefined) return action.invulnerableFor;
  if (action?.kind === 'move') return moveSpec(action).invulnerable;
  if (C.extras?.toggles?.enableAnimationCombatWindows && action?.combatWindows?.invulnerabilityWindows?.length) {
    const stepSec = C.test?.step || (1 / 120);
    return action.combatWindows.invulnerabilityWindows[0][1] * stepSec;
  }
  return C.actions[action?.kind]?.invulnerable ?? 0;
};
export function isInvulnerable(f) {
  if (f?.ledge?.invuln > 0) return true;   // subida da borda com i-frames (ledge.climbInvuln)
  if (!C.extras?.toggles?.enableInvulnerability || !f?.action) return false;
  if (f.action.invulnerableFor === 0) return false;
  const kind = f.action.kind;
  if (C.extras.toggles.enableAnimationCombatWindows && f.action.combatWindows?.invulnerabilityWindows?.length) {
    if (f.action.invulnerableFor !== undefined) {
      return f.action.elapsed < f.action.invulnerableFor - 1e-8;
    }
    const stepSec = C.test?.step || (1 / 120);
    const curStep = Math.round((f.action.elapsed ?? 0) / stepSec);
    return f.action.combatWindows.invulnerabilityWindows.some(([s, e]) => curStep >= s && curStep < e);
  }
  return ((kind === 'dodge' || kind === 'tackle') && f.action.elapsed < invulnerableWindow(f.action) - 1e-8
    || (kind === 'move' && (() => {const s = moveSpec(f.action);return f.action.elapsed >= s.invulnerableFrom - 1e-8 && f.action.elapsed < s.invulnerable - 1e-8;})()));
}
/**
 * Riposte: a janela de contra-ataque está aberta? (defensor com a ação do Move entre windowStart e windowEnd; depois do gatilho a ação vira um Tackle e
 * a janela fecha, mas a invulnerabilidade `invulnerableFor` do golpe cobre o resto dela).
 */
export function riposteWindow(f) {
  const a = f?.action;
  if (a?.kind !== 'move' || !a.def?.riposte || !a.params) return null;
  return a.elapsed >= a.params.windowStart - 1e-9 && a.elapsed < a.params.windowEnd - 1e-9 ? a : null;
}
/**
 * Acerto elegível durante a janela do Riposte: dano e knockback anulados (nenhum dos dois é aplicado) e o gatilho do contra-golpe fica marcado na ação
 * (o controlador o executa no passo seguinte). Quem NÃO é interceptado (Guard Break, agarrões) é decidido por quem chama. Devolve o evento ou null.
 */
export function riposteIntercept(defender, attackerId, normal, base = {}) {
  const a = riposteWindow(defender);if (!a) return null;
  a.riposte ??= {target: attackerId ?? null, at: a.elapsed};
  return {...base, attacker: attackerId, target: defender.id, result: 'riposte', damage: 0, normal: {...normal}, launch: null};
}
export function isOffensive(f) {
  if (!f?.action || f.action.kind !== 'tackle') return false;
  if (!C.extras?.toggles?.enableAnimationCombatWindows || !f.action.combatWindows?.activeWindows?.length) {
    return true;
  }
  const stepSec = C.test?.step || (1 / 120);
  const curStep = Math.round((f.action.elapsed ?? 0) / stepSec);
  return f.action.combatWindows.activeWindows.some(([s, e]) => curStep >= s && curStep < e);
}
/** Janela genérica de encadeamento: a ação atual já pode ser substituída por outra (ou pela defesa)? */
export const chainOpen = f => !f.action || f.action.kind === 'recoil' || f.action.elapsed >= actionSpec(f.action).chainAfter - 1e-8;
/** Pode iniciar X/C/defesa agora (telemetria de vantagem): no chão, sem recuperação e com a janela de encadeamento aberta. */
export const canAct = f => f.hp > 0 && !f.flight && f.knockRecovery <= 0 && chainOpen(f);
/** Livre para se mover: sem ação, sem guard stun, no chão e sem recuperação de queda. */
export const canMove = f => f.hp > 0 && !f.flight && f.knockRecovery <= 0 && !f.action && f.stun <= 1e-8;
