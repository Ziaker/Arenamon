// Configuração viva do laboratório.
// Os valores iniciais reproduzem exatamente o laboratório v6 (arenamon-combate-laboratorio-v6.html).
// O jogo oficial (prototypes/game/src/config.ts) é lido por ui/official.js apenas para comparação.

export function defaults() {
  // Regras gerais. Os parâmetros próprios de C (esquiva) e X (tackle) ficam em `actions`.
  // blend: dissipação da velocidade quando a DEFESA cancela uma esquiva/tackle (GDD 7.3: 100 ms).
  const rules = {recoil: .3, recoilFraction: .15, blend: .1, guardStun: .2,
    launchGravity: 17.5, launchUp: 7.3, launchHorizontal: 11, launchDrag: 1.15, clashFraction: .3, clashUp: 8.1, clashHorizontal: 12,
    landingRecovery: .19, wallRestitution: .28, perfect: .2, perfectCooldown: 2, staminaMax: 3, regenDelay: 1, regenTime: 5, guardSpeed: .6,
    exhaustedSpeed: .7, guardTurn: 3 * Math.PI, guardAcceleration: 15 * Math.PI};
  const test = {step: 1 / 120, maxFrame: .1, arenaHalf: 16, halfExtent: .5, hp: 100, attack: 20, defense: 50, speed: 4.8, attackReference: 20,
    speedReference: 10, defenseMedian: 50, pushCoefficient: 2, pushDuration: .3, aiInterval: .85, aiRange: 3.3, contactStep: .1, epsilon: 1e-8,
    forwardTolerance: Math.PI / 8};
  const locomotion = {acceleration: 60, braking: 100, reversal: 140, turnRate: 4 * Math.PI, visualTurnRate: 5 * Math.PI};
  const camera = {distance: 6.2, height: 2.2, lookHeight: 1.1, lookAhead: 1.8, followResponse: 12, distanceResponse: 5, yawResponse: 3.0,
    maxTurnRate: Math.PI / 2.6, deadZone: Math.PI / 9, movingDeadZone: Math.PI / 3, closeRange: 1.3, initialYaw: Math.PI + .2, shoulder: .45,
    framingRange: 6, distanceScale: .35, manualHold: 1.5, minDistance: 4.8, maxDistance: 24};
  const profilesLab = {balanced: {attack: test.attack, defense: test.defense, speed: test.speed, hp: test.hp},
    agile: {attack: 16, defense: 35, speed: 6, hp: test.hp}, resistant: {attack: 24, defense: 80, speed: 4.08, hp: test.hp}};
  const extras = {
    combat: {vaultCollisionHeight: 1.3, tackleTargetAlignment: .15,
      tackleNormalAlignment: 0, tackleClosingSpeed: .06, clashFacingAlignment: .2, clashClosingSpeed: .06, guardFrontAlignment: 0, guardDamageMultiplier: .5,
      launchAttackBase: .85, launchAttackWeight: .15, launchAttackReference: 20, launchClosingCap: 2, launchClosingMultiplier: .1, launchNormalWeight: .75,
      launchCenterWeight: .25, contactProjectionPasses: 4, clashHitstop: .085, impactHitstop: .035, perfectGuardCounterWindow: .70,
      exhaustRecovery: .15, guardRegenFactor: .70, landingSkidFraction: .34, landingSkidDrag: 8, landingSkidMin: .08},
    ai: {initialCooldown: .6, orbitChangePeriod: 1.7, threatAlignment: .3, threatDistance: 4.8, defensiveRetreatDistance: 2.4, defensiveRetreatStrength: .5,
      reactiveRetreatStrength: .2, approachDistance: 3, retreatDistance: 1.35, retreatStrength: .65, strafeStrength: .72, wallPrediction: .8, wallMargin: 1,
      attackRange: 3.35, combatAttackCooldown: 1.1, lowStaminaThreshold: .95, lowStaminaDistance: 2.5, lowStaminaRetreat: .7, evadeCycle: 3, evadeCycleIndex: 2},
    // Personalidade de cada IA. Reação/erros/variação/hesitação 0 e agressividade 0,5 = IA exata do v6.
    aiRed: {reaction: .16, reactionJitter: .14, mistake: .16, aggression: .45, variation: .45, hesitation: .3, evadeChance: .35, style: 0, adaptation: .55},
    aiBlue: {reaction: .1, reactionJitter: .12, mistake: .1, aggression: .62, variation: .4, hesitation: .15, evadeChance: .5, style: 0, adaptation: .7},
    cameraExtra: {idleAlignDelay: .85, idleAlignSpeed: 1.5, unlockedTurnMultiplier: 1.2, verticalFollow: 7, flightZoomFactor: .18, flightHeightFactor: .42,
      flightLookFactor: .40, orbitSensitivity: .006, wheelSensitivity: .01, fov: 48, nearClip: .1, farClip: 100, lockTargetBias: .28, lockBiasLimit: 4.7,
      framingSeparationFactor: .45, framingPadding: 1.2, cameraShakeAmount: .12, cameraShakeDecay: 10},
    visual: {bodyWidth: 1, bodyHeight: 1.3, bodyDepth: 1, arrowRadius: .16, arrowLength: .42, arrowOffset: .2, arrowHeight: 1.48, guardScale: 1.03,
      landingScale: .82, shadowMin: .3, shadowHeightFade: .16, renderPixelRatio: 2, ambientLightIntensity: 2.5, directionalIntensity: 2, floorThickness: .1,
      wallHeight: .35, wallThickness: .15, gridDivisions: 32, lightX: 4, lightY: 12, lightZ: -8},
    fx: {impactCount: 8, clashCount: 12, landingCount: 7, impactDuration: .34, clashDuration: .48, particleWidth: .075, particleHeight: .07, particleLength: .66,
      clashParticleLength: .95, particleOpacity: .92, particleTravel: 1.6, particleInitialTravel: .15, particleRise: .36, particleHeightFromGround: .22,
      particleStretch: 1.9, invulnRepeatDelay: 300, impactNoticeMs: 630, clashNoticeMs: 970, invulnNoticeMs: 350, noticeFontSize: 30, clashNoticeFontSize: 40,
      hitboxOpacity: .60, attackVectorWidth: .13},
    hud: {uiScale: 1, debugFontSize: 12, footerFontSize: 15, fxVisible: 1, hudVisible: 1, debugVisible: 0, menuOpacity: .85, fpsSmoothing: .05},
    gameModes: {enemyMode: 8, playerProfile: 0},
    toggles: {enableTackle: 1, enableDodge: 1, enableDefense: 1, enableClash: 1, enableInvulnerability: 1, enableLaunch: 1, enableVault: 1, enableWallBounce: 1,
      enableAIAttack: 1, enableAIReactive: 1, enableCameraFollow: 1, enableCameraRecenter: 1, enablePlayerAI: 0, showHitboxes: 0, showAttackVectors: 0,
      enableHitstop: 1, enableCounterBonus: 1, enableLandingSkid: 1},
    bindings: {forward: 0, back: 1, left: 2, right: 3, tackle: 4, dodge: 5, defend: 6, lock: 7, pause: 8, restart: 9, debug: 10},
    colors: {playerR: 53, playerG: 137, playerB: 255, enemyR: 242, enemyG: 81, enemyB: 75, floorR: 96, floorG: 109, floorB: 116, wallR: 202, wallG: 212, wallB: 219,
      backgroundR: 32, backgroundG: 43, backgroundB: 53, gridMajorR: 196, gridMajorG: 209, gridMajorB: 217, gridMinorR: 133, gridMinorG: 147, gridMinorB: 156,
      impactR: 255, impactG: 179, impactB: 97, clashR: 255, clashG: 229, clashB: 141, landingR: 180, landingG: 193, landingB: 203,
      partialR: 115, partialG: 202, partialB: 255, perfectR: 157, perfectG: 255, perfectB: 210, invulnerableR: 195, invulnerableG: 215, invulnerableB: 255,
      shadowR: 19, shadowG: 26, shadowB: 32, arrowR: 255, arrowG: 255, arrowB: 255, arrowGuardR: 255, arrowGuardG: 224, arrowGuardB: 100,
      defeatedR: 86, defeatedG: 97, defeatedB: 106, glowGuardR: 84, glowGuardG: 80, glowGuardB: 51,
      glowInvulnR: 49, glowInvulnG: 91, glowInvulnB: 88, glowRecoilR: 96, glowRecoilG: 48, glowRecoilB: 71, glowTackleR: 107, glowTackleG: 54, glowTackleB: 4},
    keyCodes: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyX', 'KeyC', 'KeyD', 'Tab', 'Escape', 'KeyR', 'F3', 'KeyA', 'KeyS', 'KeyZ', 'Space', 'KeyQ',
      'KeyE', 'KeyF', 'KeyW', 'KeyT', 'ShiftLeft', 'ShiftRight', 'Enter', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6',
      'Numpad7', 'Numpad8', 'Numpad9'],
  };
  // Ações independentes. Cada uma lê SOMENTE o próprio bloco: mudar C não muda X e vice-versa.
  // Valores iniciais = os do v6 (referência de migração; não são padrões aprovados).
  const common = () => ({duration: .4, cost: 1, invulnerable: .2, distance: 2.5, curveStart: 1.6, steerLimit: Math.PI / 6, steerRate: Math.PI, blend: .1, chainAfter: .2, recovery: 0, fromGuard: 1});
  const actions = {
    // C — esquiva defensiva. Nunca causa dano. Salta sobre o rival quando a trajetória o atravessa.
    dodge: {...common(), fromRecoil: 1, fromGuardStun: 1, vaultHeight: 2.2, vaultReachBonus: .7, vaultForwardMin: .1, vaultLateralWidth: 1.15, perfectEvadeStamina: .2, counterWindow: .55},
    // X — tackle ofensivo, em qualquer direção. GDD 8.2: sem ataque durante o recuo; GDD 5: durante guard stun o ataque é guardado até o stun acabar.
    tackle: {...common(), fromRecoil: 0, fromGuardStun: 0, counterSpeed: 1.18},
    // Cancelamento C → X (sistema próprio, independente da janela genérica de encadeamento).
    // invulnerability: 0 = mantém só o restante da invulnerabilidade de C; 1 = nenhuma; 2 = janela completa de X.
    cancel: {dodgeToTackle: 1, windowStart: 0, windowEnd: .4, transition: .06, velocityInfluence: 1, airDescent: .18, invulnerability: 0},
    // Buffer de entrada: X ou C pedidos cedo demais ficam guardados por este tempo e saem assim que permitidos (0 = desligado).
    buffer: {window: .1},
  };
  return {rules, test, locomotion, camera, profiles: profilesLab, extras, actions};
}

/** Configuração viva compartilhada pela simulação, visualização e ajustador. */
export const C = defaults();
export const ROOT_KEYS = ['rules', 'test', 'locomotion', 'camera', 'profiles', 'extras', 'actions'];
/**
 * Ajustes que reproduzem o comportamento do laboratório v6 (usado no teste de paridade). Diferenças do padrão:
 * no v6 o tackle podia sair do recuo e do guard stun imediatamente, e C → X seguia a janela genérica (após 200 ms,
 * com a velocidade inteira, nova invulnerabilidade completa e retorno instantâneo ao chão).
 */
export const V6_COMPAT = {'actions.tackle.fromRecoil': 1, 'actions.tackle.fromGuardStun': 1, 'actions.cancel.windowStart': .2, 'actions.cancel.windowEnd': .4,
  'actions.cancel.transition': .1, 'actions.cancel.velocityInfluence': 1, 'actions.cancel.airDescent': 0, 'actions.cancel.invulnerability': 2, 'actions.buffer.window': 0};
/** Restaura os padrões do laboratório (mantendo a identidade dos objetos, que outros módulos guardam). */
export function resetConfig(values = defaults()) {
  for (const key of ROOT_KEYS) deepAssign(C[key], values[key]);
}
function deepAssign(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') deepAssign(target[k], v);
    else target[k] = Array.isArray(v) ? [...v] : v;
  }
}
export const keyFor = name => C.extras.keyCodes[C.extras.bindings[name]];
export const rgb = base => {const c = C.extras.colors;return ((c[base + 'R'] | 0) << 16) | ((c[base + 'G'] | 0) << 8) | (c[base + 'B'] | 0);};
