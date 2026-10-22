// @ts-check
// Moves no ar (pedido de 22/10/2026): salto normal, queda de borda e arco do vault da esquiva deixam de bloquear os Moves.
// Cada Move declara como trata o ar em `def.air`:
//   'cast'    — o corpo CONTINUA em voo e o Move acontece no ar: status, projéteis, barreira, pedras, marcador de destino e o Bounce (novo arco a partir da altitude atual);
//   'descend' — Move que precisa do chão (Tackle curto, investida, soltura de carga, reaparecimento): o corpo desce suavemente (`actions.cancel.airDescent`, como o C → X
//               a partir do vault) enquanto o Move começa, sem teletransporte;
//   'none'    — não usa no ar (padrão de quem não declara).
// Lançado por golpe, preso na parede e o arco do próprio Bounce NÃO são «ar utilizável»: continuam sem comando (é o estado de ser atingido, não de pular).
import {C} from './config.js';
import {getGroundHeight} from './physics.js';
import {clamp} from './math.js';

/** Voo voluntário ou queda natural de borda (não lançado, não preso na parede, não o arco do Bounce). */
export const isAirJump = (/** @type {any} */ f) => !!f.flight && !!(f.flight.isNormalJump || f.flight.isEdgeFall) && !f.flight.bounce && !f.wallSplat;
/** Arco da esquiva com salto por cima do rival (esquiva em curso com altura). */
export const isVaultArc = (/** @type {any} */ f) => f.action?.kind === 'dodge' && (f.vaultHeight ?? 0) > 1e-8;
export const airKind = (/** @type {any} */ def) => def?.air ?? 'none';
/** O Move pode ser usado agora, com o lutador neste estado aéreo? */
export const airUsable = (/** @type {any} */ f, /** @type {any} */ def) => airKind(def) !== 'none' && (isAirJump(f) || isVaultArc(f));

/** Converte o arco do vault em voo normal (mesma altitude, velocidade vertical e horizontal), como o footstool já faz: o resto do motor trata um só tipo de voo. */
export function vaultToFlight(/** @type {any} */ f) {
  const a = f.action, D = C.actions.dodge, J = a.jump;
  const y = (f.groundY ?? 0) + (f.vaultHeight ?? 0);
  const gravity = J ? D.vaultGravity : 8 * D.vaultHeight / Math.max(1e-6, D.duration * D.duration);
  const vy = J ? J.vy : D.vaultHeight * Math.PI / Math.max(1e-6, D.duration) * Math.cos(Math.PI * clamp(a.elapsed / Math.max(1e-6, D.duration), 0, 1));
  f.flight = {y, vy, horizontal: {...f.velocity}, gravity, isNormalJump: true, jumpFeel: false, jumpHeld: true, over: J?.over ?? null};
  f.action = null;f.vaultHeight = 0;f.blend = null;f.guard = false;
  f.normalJumpLanding = true;f.coyoteLeft = 0;f.footstoolDoneWith = null;f.state = 'airborne';f.sprinting = false;f.sprintCarry = false;
}

/**
 * Altura do corpo acima do apoio e, ao mesmo tempo, tira o corpo do voo/vault: vira `vaultHeight` sobre o apoio real (o chão desce com a ação, como no C → X).
 * Devolve a altura (0 se estava no chão).
 */
export function takeOffToLift(/** @type {any} */ f, /** @type {any} */ world) {
  let h = 0;
  if (isAirJump(f)) {
    const g = getGroundHeight(f.position, world, f.flight.y);
    h = Math.max(0, f.flight.y - g);f.groundY = g;f.flight = null;f.normalJumpLanding = false;
  } else if (isVaultArc(f)) h = f.vaultHeight;
  return h;
}
/** Depois de a ação existir: ela passa a descer da altura `h` em `airDescent` s. */
export function applyLift(/** @type {any} */ f, /** @type {number} */ h) {
  if (!(h > 1e-8) || !f.action) return;
  f.action.liftStart = h;f.action.liftTime = Math.max(0, C.actions.cancel.airDescent ?? .18);f.action.fromAir = true;f.vaultHeight = h;
}
