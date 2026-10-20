// Configuração viva do laboratório.
// Os valores iniciais reproduzem exatamente o laboratório v6 (arenamon-combate-laboratorio-v6.html).
// O jogo oficial (prototypes/game/src/config.ts) é lido por ui/official.js apenas para comparação.

import {MAP_DEFAULTS} from './map.js';

export function defaults() {
  // Regras gerais. Os parâmetros próprios de C (esquiva) e X (tackle) ficam em `actions`.
  // blend: dissipação da velocidade quando a DEFESA cancela uma esquiva/tackle (GDD 7.3: 100 ms).
  const rules = {recoil: .3, recoilFraction: .15, blend: .1, guardStun: .2,
    launchGravity: 17.5, launchUp: 7.3, launchHorizontal: 11, launchDrag: 1.15, clashFraction: .3, clashUp: 8.1, clashHorizontal: 12,
    // Clash por empurrão (enableClashPush): os dois recuam no chão em vez de serem lançados. Recovery rápido (enableTechRecovery): C no ar.
    clashPushDistance: 2.2, clashPushDuration: .35, techWindow: .35, techMinAir: 0, techCost: 1,
    // Tackle carregado (enableChargeTackle): segurar X carrega (PL1 < 50%, PL2 de 50% a 99%, PL3 na carga máxima); soltar dispara.
    // Velocidade e alcance andam juntos (a duração do tackle é fixa). sprintTacklePL: X apertado correndo sai neste PL, sem carga.
    chargeTackleMaxTime: 1.2, chargeTackleDrain: .8, chargeTackleTurn: .25, chargeTackleMove: .8, chargeTackleSpeed2: 1.25, chargeTackleSpeed3: 1.6, chargeTackleDamage2: 1.3, chargeTackleDamage3: 1.7, sprintTacklePL: 2,
    // Wall-splat: lançado que bate na parede JÁ CAINDO, rápido o bastante, fica suspenso e indefeso por wallSplatDuration (a subida continua com o ricochete).
    // Meteor slam: X no ar (C → X no salto do vault ou X de quem foi lançado) vira mergulho oblíquo (slamAngle); o acerto lança o rival para CIMA (ground bounce).
    // Finta (enableTackleFeint): C com direção para os lados ou para trás (ângulo ≥ feintMinAngle em relação ao ataque), no startup do tackle (feintWindow) ou
    // durante a carga, cancela o ataque e vira uma esquiva rápida: dura feintDuration × a da esquiva, percorre feintDistance × a dela e custa feintCost.
    feintFxOn: 1, feintFxIntensity: 1, feintFxSize: 1, feintFxColor: .5, feintWindow: .12, feintMinAngle: 60, feintDuration: .8, feintDistance: 1, feintCost: 1.6,
    wallSplatMinSpeed: 6, wallSplatDuration: .7, wallSplatDamage: 0, slamAngle: Math.PI / 4, slamMinHeight: .3, slamDamage: 1, tackleFriction1: 0, tackleFriction2: 0, tackleFriction3: 0, slamRingOn: 1, slamRingStart: .6, slamRingRadius: 4, slamRingDuration: .7, slamRingThickness: .35, slamRingIntensity: 1, slamRingOpacity: .9, slamRingFade: 1, slamFxOn: 1, slamFxSize: 1, slamFxLength: 1, slamFxIntensity: 1, slamFxHeat: .5, slamFxSparks: 1, slamFxFlicker: .5, slamFxFadeOut: .25, slamGroundTime: .45, slamGroundRadius: 1.4, slamPrepTime: .5, slamHop: .8, slamFallTime: .12, slamSpeedLoss: .6, slamImpactScale: 1.2, slamImpactShake: 1.2, slamRecovery: .6, slamLaunchHorizontal: .4, groundBounceForce: 9, slamBlockPushDistance: 5,
    landingRecovery: .19, wallRestitution: .28, perfect: .2, perfectCooldown: 2, staminaMax: 3, regenDelay: 1, regenTime: 5, guardSpeed: .6,
    exhaustedSpeed: .7, guardTurn: 3 * Math.PI, guardAcceleration: 15 * Math.PI,
    // exhaustMode 1: exausto quando sobra menos que o menor custo de X/C (0 = só em zero, Etapa A). Rebote na parede: vertical.
    exhaustMode: 1, wallBounceVertical: 1, wallBounceUp: 0};
  // circleCap: cap técnico explícito para a arena circular (cenários de teste). null = raio oficial (C.map.arenaRadius),
  // que é o MESMO raio que posiciona piso/anél visíveis (effectiveArenaRadius em sim/map.js): parede física = parede visual.
  // O half-size legado da arena quadrada (arenaHalf) NUNCA limita a arena circular.
  const test = {step: 1 / 120, maxFrame: .1, arenaRadius: 50, arenaHalf: 10.4, circleCap: null, halfExtent: .5, hp: 100, attack: 20, defense: 50, speed: 4.8, attackReference: 20,
    speedReference: 10, defenseMedian: 50, pushCoefficient: 2, pushDuration: .3, aiInterval: .85, aiRange: 3.3, contactStep: .1, epsilon: 1e-8,
    forwardTolerance: Math.PI / 8};
  // Locomoção contínua (sim/locomotion.js). model 0 = aproximação linear do v6 (paridade); 1 = controlador com curvas,
  // aderência lateral, atrito e giro com aceleração angular. moveFrame: 0 = setas relativas à câmera também com
  // lock-on; 1 = relativas ao alvo (v6, força órbitas). lockFacing: 0 = corpo olha para onde anda; 1 = sempre para o
  // alvo; 2 = para o alvo parado/defendendo e para onde anda em movimento.
  const locomotion = {acceleration: 26, braking: 22, reversal: 38, turnRate: 4 * Math.PI, visualTurnRate: 5 * Math.PI,
    model: 1, accelCurve: .45, brakeCurve: .35, friction: .8, turnGrip: 34, residualSpeed: .25, turnAcceleration: 90,
    moveFrame: 0, frameLatch: 1, lockFacing: 2, stopThreshold: .55, lockTackleHoming: 1};
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
    // revision: 0 = IA tática anterior (15/10/2026); 1 = revisada (valida ações antes de pedir, alcance, sprint, contra-ataque);
    // 2 = evoluída (percepção justa, previsão de contato, gestão de arena/zonas, economia, defesa contextual, modelo do oponente, sequências e dificuldade balanceada).
    ai: {revision: 2, difficultyTier: 'normal', sprintReserve: .2, sprintMargin: 0,
      // Tackle carregado, finta e fuga do wall-splat (revisão 2): usar a carga (PL2/PL3) a distância segura, fintar tackle que o rival lê, mergulhar para escapar da parede.
      useCharge: 1, useFeint: 1, wallEscape: 1, chargeMargin: .25, chargeChance: .8, feintChance: .5, moveSmoothing: 10, minDirectionHold: .18, initialCooldown: .6, orbitChangePeriod: 1.7, threatAlignment: .3, threatDistance: 4.8, defensiveRetreatDistance: 2.4, defensiveRetreatStrength: .5,
      reactiveRetreatStrength: .2, approachDistance: 3, retreatDistance: 1.35, retreatStrength: .65, strafeStrength: .72, wallPrediction: .8, wallMargin: 1,
      attackRange: 3.35, combatAttackCooldown: 1.1, lowStaminaThreshold: .95, lowStaminaDistance: 2.5, lowStaminaRetreat: .7, evadeCycle: 3, evadeCycleIndex: 2},
    // Personalidade de cada IA. Reação/erros/variação/hesitação 0 e agressividade 0,5 = IA exata do v6.
    aiRed: {difficultyTier: 'normal', reaction: .16, reactionJitter: .14, mistake: .16, aggression: .45, variation: .45, hesitation: .3, evadeChance: .35, style: 0, adaptation: .55},
    aiBlue: {reaction: .1, reactionJitter: .12, mistake: .1, aggression: .62, variation: .4, hesitation: .15, evadeChance: .5, style: 0, adaptation: .7},
    cameraExtra: {idleAlignDelay: .85, idleAlignSpeed: 1.5, unlockedTurnMultiplier: 1.2, verticalFollow: 7, flightZoomFactor: .18, flightHeightFactor: .42,
      flightLookFactor: .40, orbitSensitivity: .006, wheelSensitivity: .01, fov: 48, nearClip: .1, farClip: 100, lockTargetBias: .28, lockBiasLimit: 4.7,
      framingSeparationFactor: .45, framingPadding: 1.2, cameraShakeAmount: .12, cameraShakeDecay: 10},
    visual: {smear: {enableSmear: 1, smearDurationFrames: 2, smearMinVelocity: 12, smearWidth: .18, smearColorMode: 0, smearOpacity: .85, smearPlBoost: 1}, squashStretch: {enableSquashStretch: 1, squashIntensity: .15, stretchIntensity: .20, squashWindow: 60, settleDuration: 80, preserveVolume: 1, plScaling: 1}, bodyWidth: 1, bodyHeight: 1.3, bodyDepth: 1, arrowRadius: .16, arrowLength: .42, arrowOffset: .2, arrowHeight: 1.48, guardScale: 1.03,
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
      enableHitstop: 1, enableCounterBonus: 1, enableLandingSkid: 1, enableEnemyAI: 1, enableSprint: 1, enemyManual: 0, enableAnimationCombatWindows: 0, enableClashPush: 0, enableTechRecovery: 1, enableChargeTackle: 1, enableWallSplat: 1, enableMeteorSlam: 1, enableFlightSlam: 0, enableTackleFeint: 1,
      // Sistema de passivas (catálogo experimental). 0 = motor idêntico ao anterior (cenário de paridade, §32).
      enablePassives: 1},
    // skill1–4: slots de movimentos especiais (padrão A, S, 3 e 4 do teclado; A e S = Reflect e Psyshock, D3). Sem movimento equipado, a tecla não faz nada.
    bindings: {forward: 0, back: 1, left: 2, right: 3, tackle: 4, dodge: 5, defend: 6, lock: 7, pause: 8, restart: 9, debug: 10, skill1: 11, skill2: 12, skill3: 49, skill4: 50, jump: 14},
    // Teclas do vermelho no controle manual (índices em keyCodes): I/J/K/L movem, U tackle, O esquiva, P defesa, Y alvo.
    bindings2: {forward: 33, back: 35, left: 34, right: 36, tackle: 37, dodge: 38, defend: 39, lock: 40, skill1: 41, skill2: 42, skill3: 44, skill4: 45, jump: 14},
    colors: {playerR: 53, playerG: 137, playerB: 255, enemyR: 242, enemyG: 81, enemyB: 75, floorR: 96, floorG: 109, floorB: 116, wallR: 202, wallG: 212, wallB: 219,
      backgroundR: 32, backgroundG: 43, backgroundB: 53, gridMajorR: 196, gridMajorG: 209, gridMajorB: 217, gridMinorR: 133, gridMinorG: 147, gridMinorB: 156,
      impactR: 255, impactG: 179, impactB: 97, clashR: 255, clashG: 229, clashB: 141, landingR: 180, landingG: 193, landingB: 203,
      partialR: 115, partialG: 202, partialB: 255, perfectR: 157, perfectG: 255, perfectB: 210, invulnerableR: 195, invulnerableG: 215, invulnerableB: 255,
      shadowR: 19, shadowG: 26, shadowB: 32, arrowR: 255, arrowG: 255, arrowB: 255, arrowGuardR: 255, arrowGuardG: 224, arrowGuardB: 100,
      defeatedR: 86, defeatedG: 97, defeatedB: 106, glowGuardR: 84, glowGuardG: 80, glowGuardB: 51,
      glowInvulnR: 49, glowInvulnG: 91, glowInvulnB: 88, glowRecoilR: 96, glowRecoilG: 48, glowRecoilB: 71, glowTackleR: 107, glowTackleG: 54, glowTackleB: 4},
    keyCodes: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyX', 'KeyC', 'KeyD', 'Tab', 'Escape', 'KeyR', 'F3', 'KeyA', 'KeyS', 'KeyZ', 'Space', 'KeyQ',
      'KeyE', 'KeyF', 'KeyW', 'KeyT', 'ShiftLeft', 'ShiftRight', 'Enter', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6',
      'Numpad7', 'Numpad8', 'Numpad9', 'KeyI', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyO', 'KeyP', 'KeyY', 'KeyH', 'KeyG', 'KeyB', 'KeyN', 'KeyM', 'KeyV', 'Digit1', 'Digit2', 'Digit3', 'Digit4'],
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
      prepTime: .06, impulseTime: .14, decelStart: .55, recoveryTime: .12, prepSpeed: .45, travelEnd: .7,
      // C só cancela C nos últimos selfCancelFromEnd segundos. Salto sobre o rival como pulo físico (impulso, gravidade, horizontal).
      selfCancelFromEnd: .1, vaultPhysics: 1, vaultUp: 9, vaultGravity: 40, vaultHorizontal: 11},
    // X — tackle ofensivo, em qualquer direção. GDD 8.2: sem ataque durante o recuo; GDD 5: durante guard stun o ataque é guardado até o stun acabar.
    tackle: {...common(), fromRecoil: 0, fromGuardStun: 0, counterSpeed: 1.18,
      prepTime: .06, impulseTime: .1, decelStart: .5, recoveryTime: .08, prepSpeed: .5, travelEnd: .55,
      // X não cancela X; a defesa só cancela o tackle com o toggle (desligado) ou com um toque de defesa perfeita.
      selfCancel: 0, guardCancel: 0, perfectGuardCancel: 1},
    // Sprint: C mantido pressionado depois da esquiva. entryFraction: fração da esquiva a partir da qual, com C ainda
    // pressionado e uma direção, a esquiva vira sprint (1 = só ao terminar). Consome stamina por segundo.
    sprint: {speedMultiplier: 1.55, acceleration: 16, braking: 12, turnGrip: 20, staminaDrain: .55, minStamina: .2, entryFraction: .7, exhaustedStop: 1},
    // Cancelamento C → X (sistema próprio, independente da janela genérica de encadeamento).
    // invulnerability: 0 = mantém só o restante da invulnerabilidade de C; 1 = nenhuma; 2 = janela completa de X.
    // windowMode 1: C → X só nos últimos fromEnd segundos da esquiva (0 = início/fim absolutos); depois de esquiva perfeita, a qualquer momento.
    cancel: {dodgeToTackle: 1, windowStart: 0, windowEnd: .4, transition: .06, velocityInfluence: 1, airDescent: .18, invulnerability: 0, windowMode: 1, fromEnd: .15, perfectAnytime: 1},
    // Buffer de entrada: X ou C pedidos cedo demais ficam guardados por este tempo e saem assim que permitidos (0 = desligado).
    buffer: {window: .1},
  };
  // Mundo de combate (projéteis, barreiras, paredes, áreas) criado por movimentos. maxEntities: limite simultâneo
  // (acima dele a criação é recusada com evento). slots: quantidade de movimentos equipáveis por lutador.
  // charge: regras compartilhadas dos movimentos de carga (Reflect/Psyshock). PROVISÓRIOS (M30.10), configuráveis; cada uso captura uma cópia congelada no início (M28.4, D1).
  const world = {maxEntities: 64, slots: 4, charge: {moveSlow: .75, turnSlow: .75, dodgeCancelAfter: .2, interruptCooldownFactor: .5, recovery: .25, bufferWindow: .15, boostStaminaPerSecond: .5, boostStep: 1},
    // reflect: valores iniciais PROVISÓRIOS do Reflect (M30.10); largura/altura em múltiplos das dimensões lógicas do motor (M30.4); crescimento linear com a carga.
    reflect: {widthMin: 1.5, widthMax: 3, heightMin: 1.5, heightMax: 2.5, thickness: .1, gapFraction: .5, durationBase: 4, minCharge: .9, tackleRecoil: .15, tackleStagger: .25, burstRadius: 0, burstForce: 3, burstDamage: 0, burstPush: 0, burstHurt: 0, tieTolerance: .001, maxReflections: 16},
    // psyshock: valores iniciais PROVISÓRIOS do Psyshock (M30.10): pedras (3 a 8, +1 por 0,8 s), velocidade sorteada por pedra (D4), homing 0,3 s a 180°/s, leque de 20° sem alvo, busca de espaço de 3 m, dano 0,2 × Ataque, fator 0,8 por acerto no mesmo alvo, knockback 0,3 m/s por pedra com teto de 0,9 m/s por alvo.
    psyshock: {minStones: 3, maxStones: 8, stoneSeconds: .8, speedMin: 10, speedMax: 14, homingSeconds: .3, homingRate: 180, fanAngle: 20, searchRange: 3, searchStep: .25, arc: 120, ringMin: .8, ringMax: 1.1, heightMin: .35, heightMax: 1.1, scaleMin: .7, scaleMax: 1.3, radius: .2, damageFraction: .2, successiveFactor: .8, knockbackPerStone: .3, knockbackCap: .9, knockbackVertical: 0, knockbackLevelBonus: 0, knockbackSpeedFactor: 0, counterStagger: .2},
    // beam: lasers contínuos e emissores técnicos (Fase 7). PROVISÓRIOS: comprimento máximo, segmentos refletidos por passo e intervalo entre danos por alvo.
    beam: {length: 24, maxSegments: 8, interval: .25, damage: 2},
    // ai: como a IA decide usar os Moves (sim/ai-moves.js). Distâncias em m, tempos em s. Os padrões reproduzem o comportamento anterior.
    ai: {evadeDistance: 4.5, pl2Distance: 4.8, pl3Distance: 7, reflectHold: .9, lastSecondDefend: .22, noTimeDefend: .26, barrierBreakRange: 3.2, barrierBreakChance: .6, psyshockMinDistance: 3.5, psyshockMinStamina: 2, psyshockChanceMax: .9, afterChargeWait: .35, decisionInterval: .5}};
  // Passivas (CATÁLOGO EXPERIMENTAL, não homologado): parâmetros de balanceamento por passiva (§29), ajustáveis no
  // painel (aba Passivas) e congelados por snapshot em cada ativação (não retroativos). Ver sim/passives.js.
  const passivas = {
    globals: {detectDistance: 3.5},
    'speed-boost': {speedPct: .15},
    technician: {costPct: .2},
    'rough-skin': {reflectDamage: 3, cooldown: 10},
    regenerator: {heal: 5, quietTime: 5, cooldown: 15},
    unburden: {speedPct: .15, duration: 4, cooldown: 14},
    stamina: {defensePct: .10, duration: 4, cooldown: 10},
    'suction-cups': {knockbackPct: .20},
    'magic-guard': {dotReductionPct: .50},
    'clear-body': {},
    defiant: {attackPct: .15, duration: 4, cooldown: 12},
    'poison-touch': {dps: 2, duration: 3, cooldown: 12},
    anticipation: {speedPct: .15, duration: 2, cooldown: 12, detectDistance: 3.5},
    forewarn: {windowBonus: .06, maxDuration: 4, cooldown: 12, detectDistance: 3.5},
    'inner-focus': {stunPct: .20},
    'effect-spore': {slowPct: .15, duration: 3, cooldown: 12},
    sturdy: {},
    'vital-spirit': {thresholdPct: .30, regenPct: .30},
    guts: {attackPct: .15},
  };
  return {rules, test, locomotion, camera, profiles: profilesLab, extras, actions, vfx: vfxDefaults(), display: displayDefaults(), world, map: {...MAP_DEFAULTS}, passivas};
}

/**
 * Efeitos visuais (view/vfx.js). Só aparência: nenhum valor daqui altera regras, tempos da simulação ou cooldowns.
 * Cada efeito tem enabled, variant (0 = A, 1 = B, 2 = C) e parâmetros próprios usados pelas três variantes.
 */
export function vfxDefaults() {
  const solidFam = (extra = {}) => ({enabled: 1, variant: 0, intensity: 1, amount: 1, size: 1, duration: 1, velocity: 1, scatter: 1, lift: 1, turbulence: 1, opacity: 1, fadeStart: .6, fadeEnd: 1, ...extra});
  const shake = (amplitude, duration, profile, enabled = 1) => ({enabled, profile, amplitude, duration, frequency: 26, damping: 7, angular: .6, intensity: 1, limit: .45});
  return {
    // legacy: liga também as partículas e o tremor antigos do v6 (parâmetros de Ajustes › Visual › Efeitos e feedback).
    master: {enabled: 1, maxParticles: 1400, debugLog: 1, legacy: 0, noFlash: 0, reduceMotion: 0, highContrast: 0},
    hit: {enabled: 1, variant: 0, size: 1.3, duration: .38, count: 18, intensity: 1, speed: 6, opacity: .95, color: 0xffb361, glow: 1.2, fade: 1.6},
    dodge: {enabled: 1, variant: 0, count: 6, length: 1.4, duration: .22, width: .07, opacity: .7, spread: .45, interval: .025, intensity: 1, color: 0x9dffd8},
    sprint: {enabled: 1, variant: 0, density: 1, length: 1.1, speed: 9, spread: .5, intensity: 1, opacity: .55, color: 0xd8f4ff, frequency: 28},
    block: {enabled: 1, variant: 1, size: 1, opacity: .75, duration: .3, color: 0x73caff, intensity: 1, count: 10, expansion: 1},
    perfect: {enabled: 1, variant: 0, intensity: 1.3, duration: .55, scale: 1.2, count: 26, wave: 2.4, glow: 1.6, color: 0x9dffd2, color2: 0xffffff, fade: 1.4, flash: .55, freeze: .07},
    ground: {enabled: 1, variant: 0, radius: 1.3, density: 1, duration: .55, intensity: 1, speed: 3.5, opacity: .85, particleSize: .22, elevation: .5, color: 0xe6edf2, minImpact: 2, mixA: 1, mixB: .8, mixC: .6},
    clash: {enabled: 1, variant: 0, scale: 1.2, duration: .6, intensity: 1.3, count: 30, color: 0xffe58d, color2: 0xff7a3c, radius: 1.6, speed: 7, glow: 1.6},
    exhaust: {enabled: 1, variant: 0, target: 0, count: 5, fallSpeed: 1.1, spread: .55, size: .26, opacity: .85, glow: 1, startHeight: 2.1, interval: .14, color: 0x4fa3ff},
    regen: {enabled: 1, variant: 0, count: 3, frequency: 7, speed: 1.2, height: 1.8, intensity: 1, size: .28, opacity: .8, spread: .5, color: 0xffd34d, scaleWithRate: 1},
    rock: {
      enabled: 1, variant: 0,
      scale: 1.0, rotSpeed: 3.5,
      trail: 1, trailDensity: 8,
      shatter: 1, shatterCount: 14, shatterSpeed: 1, shatterLife: 1, shatterSize: 1,
      glow: 1.2, cracksEmissive: 1,
    },
    barrier: {
      enabled: 1, variant: 0,
      opacity: 0.65, pulseFreq: 2.2,
      ripples: 1, shatterFragments: 20, shatterSpeed: 1, shatterLife: 1, shatterSize: 1,
      edgeGlow: 1.4,
    },
    laser: {
      enabled: 1, pl: 1,
      coreWidth1: 0.04, coreWidth2: 0.065, coreWidth3: 0.095, coreOpacity: 0.95,
      haloWidth1: 0.15, haloWidth2: 0.24, haloWidth3: 0.38, haloOpacity: 0.65,
      intensity: 1.2, pulseFreq: 2.0, flowSpeed: 24,
      muzzleSize: 0.28, contactSize: 0.35, sparksPerSecond: 20,
      dynamicLight: 1, reflectionActive: 1, neutralizeActive: 1,
      quality: 1, noFlash: 0, reduceMotion: 0, highContrast: 0,
    },
    // VFX sólidos (malhas 3D instanciadas, view/solid-fx.js). variant: índice da opção listada em SOLID_FAMILIES.
    solid: {enabled: 1, maxObjects: 220, quality: 1},
    // Todas as famílias 3D têm os mesmos controles: intensidade, amount (quantidade/taxa ×), size, duration (×), velocity (×),
    // scatter (dispersão ×), lift (altura ×), turbulence (rotação/ruído ×), opacity e o fade ao longo da vida (fadeStart/fadeEnd, fração da vida). Só aparência.
    solidDust: {...solidFam(), color: 0xb9a07a, color2: 0x7fffe0},
    solidWind: {...solidFam(), color: 0xf4f9ff},
    solidRunDust: {...solidFam(), color: 0xd8c9ad},
    solidRunWind: {...solidFam(), color: 0xf4f9ff},
    solidDodge: {...solidFam(), color: 0x9dffd8},
    solidLanding: {...solidFam(), color: 0xd9c9a8},
    solidImpact: {...solidFam(), color: 0xffb361},
    solidBlock: {...solidFam(), color: 0x73caff},
    solidClash: {...solidFam(), color: 0xffe58d},
    solidReflect: {...solidFam(), color: 0x73caff},
    shakeMaster: {enabled: 1},
    shakeGuard: shake(.05, .16, 0), shakeHit: shake(.12, .28, 0), shakeGround: shake(.09, .3, 1), shakePerfect: shake(.1, .3, 2), shakeClash: shake(.18, .42, 1),
    // VFX de ativação de passivas (§16): 0,60 s, círculos brancos 3D + sparkles; variant 0/1/2 = A/B/C
    // (Orbital Halo / Celestial Intersections / Luminous Resonance). Só aparência; não altera regras nem cooldowns.
    passive: {enabled: 1, variant: 0, intensity: 1, size: 1, opacity: 1, duration: 1, sparkles: 1},
    // Camada experimental three.quarks (Fase 2 da integração open source): efeitos A (carga),
    // B (impacto), C (pouso) e footstool por partículas GPU, A/B comparativo com o legado.
    // 0 = desligada (custo zero, nada é instanciado). Só aparência.
    quarks: {enabled: 0},
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
    // Transições da máquina de estados de animação (Personagens). Só visual: não mudam tempos, física ou regras.
    animation: {fade: .18, actionFade: .07, locomotionHold: .1, speed: 1},
    // Diagnóstico de comandos (só apresentação): aviso na arena 0 = desligado, 1 = só o jogador, 2 = ambos.
    diagnostics: {toast: 0, toastMs: 1400, logExecuted: 0},
    // Indicadores das janelas de combate acima dos lutadores (tempos lidos da simulação). mode: 0 desligado, 1 jogador, 2 ambos.
    // Medidor de desempenho: caixa compacta na arena (0/1). Só apresentação.
    perf: {overlay: 0},
    windows: {mode: 0, scale: 1, opacity: .9, invulnerable: 1, cancel: 1, chain: 1, recovery: 1, guardStun: 1, recoil: 1, perfect: 1, perfectCooldown: 1, counter: 1, buffer: 1, hitstop: 0, statuses: 1, cooldowns: 1},
  };
}

/** Configuração viva compartilhada pela simulação, visualização e ajustador. */
export const C = defaults();
export const ROOT_KEYS = ['rules', 'test', 'locomotion', 'camera', 'profiles', 'extras', 'actions', 'vfx', 'display', 'world', 'map', 'passivas'];
/**
 * Movimento da Etapa A (antes do overhaul): locomoção linear do v6, setas relativas ao alvo com lock-on, corpo sempre
 * voltado ao alvo, curva polinomial de X/C com distância proporcional à duração, IA sem suavização e sem sprint.
 */
export const ETAPA_A_MOTION = {'locomotion.model': 0, 'locomotion.acceleration': 60, 'locomotion.braking': 100, 'locomotion.reversal': 140, 'locomotion.moveFrame': 1,
  'locomotion.frameLatch': 0, 'locomotion.lockFacing': 1, 'actions.dodge.profile': 0, 'actions.tackle.profile': 0, 'actions.dodge.distanceReference': 0,
  'actions.tackle.distanceReference': 0, 'extras.ai.moveSmoothing': 0, 'extras.ai.minDirectionHold': 0, 'extras.toggles.enableSprint': 0};
/**
 * Regras de cancelamento, exaustão e salto da Etapa A (antes das correções de 15/10/2026): X cancela X e é cancelado pela
 * defesa após chainAfter, C → X desde o início da esquiva, C cancela C após chainAfter, exaustão só em zero, salto em arco fixo.
 */
export const ETAPA_A_RULES = {'actions.tackle.selfCancel': 1, 'actions.tackle.guardCancel': 1, 'actions.dodge.selfCancelFromEnd': 99, 'actions.dodge.vaultPhysics': 0,
  'actions.cancel.windowMode': 0, 'actions.cancel.perfectAnytime': 0, 'rules.exhaustMode': 0, 'locomotion.lockTackleHoming': 0, 'map.arenaShape': 'square'};
/**
 * Ajustes que reproduzem o comportamento do laboratório v6 (usado no teste de paridade). Diferenças do padrão:
 * no v6 o tackle podia sair do recuo e do guard stun imediatamente, e C → X seguia a janela genérica (após 200 ms,
 * com a velocidade inteira, nova invulnerabilidade completa e retorno instantâneo ao chão).
 */
export const V6_COMPAT = {'actions.tackle.fromRecoil': 1, 'actions.tackle.fromGuardStun': 1, 'actions.cancel.windowStart': .2, 'actions.cancel.windowEnd': .4,
  'actions.cancel.transition': .1, 'actions.cancel.velocityInfluence': 1, 'actions.cancel.airDescent': 0, 'actions.cancel.invulnerability': 2, 'actions.buffer.window': 0,
  ...ETAPA_A_MOTION, ...ETAPA_A_RULES};
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
/** Tecla do vermelho no controle manual. */
export const keyFor2 = name => C.extras.keyCodes[C.extras.bindings2[name]];
export const rgb = base => {const c = C.extras.colors;return ((c[base + 'R'] | 0) << 16) | ((c[base + 'G'] | 0) << 8) | (c[base + 'B'] | 0);};

/** Cor dos efeitos da finta: 0 = amarelo-limão, 0,5 = amarelo-ouro (padrão), 1 = laranja. */
export function feintColor(t) {
  const a = [0xf5, 0xee, 0x50], b = [0xff, 0xd2, 0x3c], c = [0xff, 0x9a, 0x2e], u = Math.max(0, Math.min(1, t)), [p, q, k] = u < .5 ? [a, b, u * 2] : [b, c, (u - .5) * 2];
  return (Math.round(p[0] + (q[0] - p[0]) * k) << 16) | (Math.round(p[1] + (q[1] - p[1]) * k) << 8) | Math.round(p[2] + (q[2] - p[2]) * k);
}
