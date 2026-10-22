// Approved timings are separate from provisional calibration (GDD §§3, 7–9).
export const RULES = {
  dodge: .4, invulnerable: .2, steerLimit: Math.PI / 6, steerRate: Math.PI,
  recoil: .514, recoilFraction: .15, blend: .1, guardStun: .514,
  perfect: .2, perfectCooldown: 2, staminaMax: 7.1, regenDelay: 1, regenTime: 1.25,
  guardSpeed: .6, exhaustedSpeed: .7, guardTurn: 3 * Math.PI, guardAcceleration: 15 * Math.PI,
};
export const TEST = {
  step: 1 / 120, maxFrame: .1, arenaHalf: 16, halfExtent: .5,
  hp: 100, attack: 20, defense: 50, speed: 4.8, attackReference: 20,
  speedReference: 10, defenseMedian: 50, pushCoefficient: 2, pushDuration: .3,
  aiInterval: .85, aiRange: 3.3, contactStep: .1, epsilon: 1e-8,
  forwardTolerance: Math.PI / 8,
};
// Provisional feel tuning: base profile reaches speed in 67ms, brakes in 40ms.
export const LOCOMOTION = { acceleration: 40, braking: 34, reversal: 62, turnRate: 6 * Math.PI, visualTurnRate: 7 * Math.PI };
export const CAMERA = {
  distance: 6.2, height: 2.2, lookHeight: 1.1, lookAhead: 1.8,
  followResponse: 12, distanceResponse: 5, yawResponse: 3,
  maxTurnRate: 1.208305, deadZone: Math.PI / 9, movingDeadZone: Math.PI / 3, closeRange: 1.3,
  initialYaw: Math.PI + .2, shoulder: .45, framingRange: 6, distanceScale: .35,
  manualHold: 1.5, minDistance: 4.8, maxDistance: 24,
};
export interface Attributes { attack: number; defense: number; speed: number; hp: number }
export const profiles: Record<string, Attributes> = {
  balanced: { attack: TEST.attack, defense: TEST.defense, speed: 4.19, hp: TEST.hp },
  agile: { attack: 16, defense: 35, speed: 6, hp: TEST.hp },
  resistant: { attack: 24, defense: 80, speed: 4.08, hp: TEST.hp },
};
