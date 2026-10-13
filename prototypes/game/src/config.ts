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
  cameraDistance: 13, cameraHeight: 9, cameraResponse: 8,
  cameraYaw: Math.PI + .35, forwardTolerance: Math.PI / 8,
};
export interface Attributes { attack: number; defense: number; speed: number; hp: number }
export const profiles: Record<string, Attributes> = {
  balanced: { attack: TEST.attack, defense: TEST.defense, speed: TEST.speed, hp: TEST.hp },
  agile: { attack: 16, defense: 35, speed: 5, hp: TEST.hp },
  resistant: { attack: 24, defense: 80, speed: 3.4, hp: TEST.hp },
};
