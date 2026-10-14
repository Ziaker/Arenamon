// Approved timings are separate from provisional calibration (GDD §§3, 7–9).
export const RULES = {
  dodge: .4, invulnerable: .2, steerLimit: Math.PI / 6, steerRate: Math.PI,
  recoil: .3, recoilFraction: .15, blend: .1, guardStun: .2,
  perfect: .2, perfectCooldown: 2, staminaMax: 3, regenDelay: 1, regenTime: 5,
  guardSpeed: .6, exhaustedSpeed: .7, guardTurn: 3 * Math.PI, guardAcceleration: 15 * Math.PI,
};
export const TEST = {
  step: 1 / 120, maxFrame: .1, arenaHalf: 10, halfExtent: .5,
  hp: 100, attack: 20, defense: 50, speed: 4, attackReference: 20,
  speedReference: 10, defenseMedian: 50, pushCoefficient: 2, pushDuration: .3,
  aiInterval: .85, aiRange: 3.3, contactStep: .1, epsilon: 1e-8,
  forwardTolerance: Math.PI / 8,
};
// Provisional feel tuning: base profile reaches speed in 67ms, brakes in 40ms.
export const LOCOMOTION = { acceleration: 60, braking: 100, reversal: 140, turnRate: 4 * Math.PI, visualTurnRate: 5 * Math.PI };
export const CAMERA = {
  distance: 6.2, height: 2.2, lookHeight: 1.1, lookAhead: 1.8,
  followResponse: 12, distanceResponse: 4, yawResponse: 2.5,
  maxTurnRate: Math.PI / 4, deadZone: Math.PI / 9, movingDeadZone: Math.PI / 3, closeRange: 2.5,
  initialYaw: Math.PI + .2, shoulder: .45, framingRange: 6, distanceScale: .35,
  manualHold: 1.5, minDistance: 4.8, maxDistance: 16,
};
// Etapa A (aprovada em 14/10/2026; referência: prototypes/combat-lab, branch feat/combat-core-etapa-a).
// X (tackle) e C (esquiva) são ações independentes; cada uma lê só o próprio bloco. Os valores iniciais são os mesmos
// que o jogo já usava para a esquiva-investida única (RULES), então o balanceamento não muda.
export type ActionKind = 'dodge' | 'tackle';
const common = () => ({ duration: RULES.dodge, cost: 1, invulnerable: RULES.invulnerable, distance: 2.5, curveStart: 1.6,
  steerLimit: RULES.steerLimit, steerRate: RULES.steerRate, blend: RULES.blend, chainAfter: RULES.invulnerable, recovery: 0, fromGuard: true });
export const ACTIONS = {
  // C — esquiva defensiva: nunca causa dano; salta sobre o adversário só quando a trajetória o atravessa.
  dodge: { ...common(), fromRecoil: true, fromGuardStun: true, vaultHeight: 2.2, vaultReachBonus: .7, vaultForwardMin: .1, vaultLateralWidth: 1.15,
    vaultCollisionHeight: 1.3, perfectEvadeStamina: .2, counterWindow: .55 },
  // X — tackle ofensivo em qualquer direção. GDD 8.2: sem ataque durante o recuo; GDD 5: no guard stun o X fica guardado.
  tackle: { ...common(), fromRecoil: false, fromGuardStun: false, counterSpeed: 1.18 },
  // Cancelamento C → X: janela própria (desde o 1º passo), velocidade contínua, X cobra o próprio custo;
  // invulnerabilidade de X = só o resto da de C; no ar, X desce da altura atual sem teletransporte.
  cancel: { dodgeToTackle: true, windowStart: 0, windowEnd: .4, transition: .06, velocityInfluence: 1, airDescent: .18 },
  // X ou C pedidos até 100 ms antes de serem permitidos saem no primeiro passo permitido (0 desliga).
  buffer: { window: .1 },
  // X contra X: cada um recebe 30% do dano do tackle do outro e é empurrado para trás (empurrão do GDD, inalterado).
  clash: { fraction: .3, facingAlignment: .2, closingSpeed: .06 },
  // Defesa perfeita também abre a janela de contra-ataque (o X seguinte é mais rápido e vai mais longe).
  perfectGuardCounterWindow: .7,
};
export interface Attributes { attack: number; defense: number; speed: number; hp: number }
export const profiles: Record<string, Attributes> = {
  balanced: { attack: TEST.attack, defense: TEST.defense, speed: TEST.speed, hp: TEST.hp },
  agile: { attack: 16, defense: 35, speed: 5, hp: TEST.hp },
  resistant: { attack: 24, defense: 80, speed: 3.4, hp: TEST.hp },
};
