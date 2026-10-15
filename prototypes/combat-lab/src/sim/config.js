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
  // Locomoção contínua (sim/locomotion.js). model 0 = aproximação linear do v6 (paridade); 1 = controlador com curvas,
  // aderência lateral, atrito e giro com aceleração angular. moveFrame: 0 = setas relativas à câmera também com
  // lock-on; 1 = relativas ao alvo (v6, força órbitas). lockFacing: 0 = corpo olha para onde anda; 1 = sempre para o
  // alvo; 2 = para o alvo parado/defendendo e para onde anda em movimento.
  const locomotion = {acceleration: 26, braking: 22, reversal: 38, turnRate: 4 * Math.PI, visualTurnRate: 5 * Math.PI,
    model: 1, accelCurve: .45, brakeCurve: .35, friction: .8, turnGrip: 34, residualSpeed: .25, turnAcceleration: 90,
    moveFrame: 0, frameLatch: 1, lockFacing: 2, stopThreshold: .55};
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
    // moveSmoothing: giro máximo (rad/s) da intenção de movimento da IA; minDirectionHold: tempo mínimo antes de inverter
    // a intenção (contra zigue-zague). 0 = intenções cruas (v6). Ataques e esquivas nunca são suavizados.
    ai: {moveSmoothing: 10, minDirectionHold: .18, initialCooldown: .6, orbitChangePeriod: 1.7, threatAlignment: .3, threatDistance: 4.8, defensiveRetreatDistance: 2.4, defensiveRetreatStrength: .5,
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
      enableHitstop: 1, enableCounterBonus: 1, enableLandingSkid: 1, enableEnemyAI: 1, enableSprint: 1},
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
  // distanceReference: tempo de referência da distância nominal (distância × referência × velocidade). Assim a distância
  // não muda quando a duração muda (por exemplo, ao sincronizar com um clipe). 0 = usar a própria duração (Etapa A).
  // profile: 0 = curva polinomial da Etapa A (curveStart); 1 = curva física em fases (sim/motion.js), com
  // preparação, impulso, deslocamento, desaceleração e recuperação, sempre com a mesma distância total.
  const common = () => ({duration: .4, cost: 1, invulnerable: .2, distance: 2.5, curveStart: 1.6, steerLimit: Math.PI / 6, steerRate: Math.PI, blend: .1, chainAfter: .2, recovery: 0, fromGuard: 1,
    distanceReference: .4, profile: 1});
  const actions = {
    // C — esquiva defensiva. Nunca causa dano. Salta sobre o rival quando a trajetória o atravessa.
    dodge: {...common(), fromRecoil: 1, fromGuardStun: 1, vaultHeight: 2.2, vaultReachBonus: .7, vaultForwardMin: .1, vaultLateralWidth: 1.15, perfectEvadeStamina: .2, counterWindow: .55,
      prepTime: .06, impulseTime: .14, decelStart: .55, recoveryTime: .12, prepSpeed: .45, travelEnd: .7},
    // X — tackle ofensivo, em qualquer direção. GDD 8.2: sem ataque durante o recuo; GDD 5: durante guard stun o ataque é guardado até o stun acabar.
    tackle: {...common(), fromRecoil: 0, fromGuardStun: 0, counterSpeed: 1.18,
      prepTime: .06, impulseTime: .1, decelStart: .5, recoveryTime: .08, prepSpeed: .5, travelEnd: .55},
    // Sprint: C mantido pressionado depois da esquiva. entryFraction: fração da esquiva a partir da qual, com C ainda
    // pressionado e uma direção, a esquiva vira sprint (1 = só ao terminar). Consome stamina por segundo.
    sprint: {speedMultiplier: 1.55, acceleration: 16, braking: 12, turnGrip: 20, staminaDrain: .55, minStamina: .2, entryFraction: .7, exhaustedStop: 1},
    // Cancelamento C → X (sistema próprio, independente da janela genérica de encadeamento).
    // invulnerability: 0 = mantém só o restante da invulnerabilidade de C; 1 = nenhuma; 2 = janela completa de X.
    cancel: {dodgeToTackle: 1, windowStart: 0, windowEnd: .4, transition: .06, velocityInfluence: 1, airDescent: .18, invulnerability: 0},
    // Buffer de entrada: X ou C pedidos cedo demais ficam guardados por este tempo e saem assim que permitidos (0 = desligado).
    buffer: {window: .1},
  };
  return {rules, test, locomotion, camera, profiles: profilesLab, extras, actions, vfx: vfxDefaults(), display: displayDefaults()};
}

/**
 * Efeitos visuais (view/vfx.js). Só aparência: nenhum valor daqui altera regras, tempos da simulação ou cooldowns.
 * Cada efeito tem enabled, variant (0 = A, 1 = B, 2 = C) e parâmetros próprios usados pelas três variantes.
 */
export function vfxDefaults() {
  const shake = (amplitude, duration, profile, enabled = 1) => ({enabled, profile, amplitude, duration, frequency: 26, damping: 7, angular: .6, intensity: 1, limit: .45});
  return {
    // legacy: liga também as partículas e o tremor antigos do v6 (parâmetros de Ajustes › Visual › Efeitos e feedback).
    master: {enabled: 1, maxParticles: 1400, debugLog: 1, legacy: 0},
    hit: {enabled: 1, variant: 0, size: 1.3, duration: .38, count: 18, intensity: 1, speed: 6, opacity: .95, color: 0xffb361, glow: 1.2, fade: 1.6},
    dodge: {enabled: 1, variant: 0, count: 6, length: 1.4, duration: .22, width: .07, opacity: .7, spread: .45, interval: .025, intensity: 1, color: 0x9dffd8},
    sprint: {enabled: 1, variant: 0, density: 1, length: 1.1, speed: 9, spread: .5, intensity: 1, opacity: .55, color: 0xd8f4ff, frequency: 28},
    block: {enabled: 1, variant: 1, size: 1, opacity: .75, duration: .3, color: 0x73caff, intensity: 1, count: 10, expansion: 1},
    perfect: {enabled: 1, variant: 0, intensity: 1.3, duration: .55, scale: 1.2, count: 26, wave: 2.4, glow: 1.6, color: 0x9dffd2, color2: 0xffffff, fade: 1.4, flash: .55, freeze: .07},
    ground: {enabled: 1, variant: 0, radius: 1.3, density: 1, duration: .55, intensity: 1, speed: 3.5, opacity: .85, particleSize: .22, elevation: .5, color: 0xe6edf2, minImpact: 2},
    clash: {enabled: 1, variant: 0, scale: 1.2, duration: .6, intensity: 1.3, count: 30, color: 0xffe58d, color2: 0xff7a3c, radius: 1.6, speed: 7, glow: 1.6},
    exhaust: {enabled: 1, variant: 0, target: 0, count: 5, fallSpeed: 1.1, spread: .55, size: .26, opacity: .85, glow: 1, startHeight: 2.1, interval: .14, color: 0x4fa3ff},
    regen: {enabled: 1, variant: 0, count: 3, frequency: 7, speed: 1.2, height: 1.8, intensity: 1, size: .2, opacity: .8, spread: .5, color: 0xffd34d, scaleWithRate: 1},
    shakeMaster: {enabled: 1},
    shakeGuard: shake(.05, .16, 0), shakeHit: shake(.12, .28, 0), shakeGround: shake(.09, .3, 1), shakePerfect: shake(.1, .3, 2), shakeClash: shake(.18, .42, 1),
  };
}

/** Apresentação: sombras, HUD, ajuste visual de altura e indicador da janela C → X. Não altera a física. */
export function displayDefaults() {
  return {
    // style: 0 = quadrada (compatibilidade), 1 = círculo simples, 2 = círculo suave (gradiente radial).
    shadow: {style: 2, opacity: .55, radius: .62, scaleX: 1, scaleZ: 1, softness: .6, offsetX: 0, offsetZ: 0, intensity: 1},
    // proposal: 0 = HUD atual, 1 = A (Arcade Vector), 2 = B (Combat Halo), 3 = C (Tactical Combat). Cooldowns: só demonstração.
    hud: {proposal: 0, scale: 1, demoCooldowns: 1, demoAuto: 1, demoDuration: 4, damageDelay: .45},
    // Altura visual: deslocamento do modelo/bloco sem mover o colisor nem a sombra.
    grounding: {autoGround: 1, visualOffset: 0},
    // Indicador da janela C → X (apenas desenho; a regra é por tempo, ver docs).
    cancelRing: {inner: 1.05, width: .25, opacity: .75},
  };
}

/** Configuração viva compartilhada pela simulação, visualização e ajustador. */
export const C = defaults();
export const ROOT_KEYS = ['rules', 'test', 'locomotion', 'camera', 'profiles', 'extras', 'actions', 'vfx', 'display'];
/**
 * Movimento da Etapa A (antes do overhaul): locomoção linear do v6, setas relativas ao alvo com lock-on, corpo sempre
 * voltado ao alvo, curva polinomial de X/C com distância proporcional à duração, IA sem suavização e sem sprint.
 */
export const ETAPA_A_MOTION = {'locomotion.model': 0, 'locomotion.acceleration': 60, 'locomotion.braking': 100, 'locomotion.reversal': 140, 'locomotion.moveFrame': 1,
  'locomotion.frameLatch': 0, 'locomotion.lockFacing': 1, 'actions.dodge.profile': 0, 'actions.tackle.profile': 0, 'actions.dodge.distanceReference': 0,
  'actions.tackle.distanceReference': 0, 'extras.ai.moveSmoothing': 0, 'extras.ai.minDirectionHold': 0, 'extras.toggles.enableSprint': 0};
/**
 * Ajustes que reproduzem o comportamento do laboratório v6 (usado no teste de paridade). Diferenças do padrão:
 * no v6 o tackle podia sair do recuo e do guard stun imediatamente, e C → X seguia a janela genérica (após 200 ms,
 * com a velocidade inteira, nova invulnerabilidade completa e retorno instantâneo ao chão).
 */
export const V6_COMPAT = {'actions.tackle.fromRecoil': 1, 'actions.tackle.fromGuardStun': 1, 'actions.cancel.windowStart': .2, 'actions.cancel.windowEnd': .4,
  'actions.cancel.transition': .1, 'actions.cancel.velocityInfluence': 1, 'actions.cancel.airDescent': 0, 'actions.cancel.invulnerability': 2, 'actions.buffer.window': 0,
  ...ETAPA_A_MOTION};
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
