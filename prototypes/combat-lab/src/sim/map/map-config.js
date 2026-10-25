// @ts-check
// Dividido de map.js (comportamento idêntico): map-config.


export const MAP_DEFAULTS = {
  arenaRadius: 32.5,
  arenaShape: 'circle', // 'circle' ou 'square'
  wallBounceMultiplier: 1.0,
  wallDamageMultiplier: 1.0,
  destructibleCount: 4,
  destructibleHp: 30,
  destructibleRespawnMin: 15,
  destructibleRespawnMax: 30,
  destructibleGhostPreview: 2.0,
  impactMinSpeed: 1.0,           // velocidade horizontal mínima (m/s) para um arremessado machucar um destrutível (R7.15)
  impactDamageToObject: 6.0,     // dano ao destrutível = velocidade horizontal relativa × este coeficiente (R3.7, R7.15)
  impactDamageToFighter: 2.5,    // dano ao arremessado = velocidade horizontal relativa × este coeficiente (colisão ambiental)
  passageClearance: 1.2, // vão mínimo (m) entre dois sólidos do mapa: corpo do lutador (1,0) + folga; vão menor prende o lutador e a IA
  spawnClearance: 0.6,   // folga mínima (m) entre o corpo de um lutador e qualquer objeto sólido recém-colocado (R3.13: distâncias mínimas configuráveis)
  obstacleCount: 4,
  platformCount: 2,   // quantas plataformas do catálogo abaixo entram no mapa (0 desliga; o catálogo consome RNG igual)
  platforms: [
    {id: 'plat1', x: -10, z: 8, width: 3, depth: 3, height: 1.0},
    {id: 'plat2', x: 12, z: -10, width: 3, depth: 3, height: 1.5},
  ],
  jumpHeight: 2.0,
  jumpGravity: 17.5,
  // Pacote experimental de sensação do salto (Plano D): gravidade assimétrica, altura variável,
  // velocidade terminal, controle aéreo por aceleração, coyote time e jump buffer. Com jumpImprovements
  // = 0 a física do salto volta a ser a legada (gravidade única jumpGravity), para comparação A/B.
  jumpImprovements: 1,
  jumpGravityUp: 17.5,     // gravidade durante a subida (m/s²); impulso continua sqrt(2·g·altura)
  jumpGravityDown: 22.0,   // gravidade durante a descida: queda mais firme, sem flutuação
  jumpReleaseMult: 2.2,    // multiplicador da gravidade de subida ao SOLTAR o botão (salto curto)
  jumpMaxFallSpeed: 12.0,  // velocidade terminal de queda no salto normal (m/s)
  jumpAirAccel: 8.0,       // aceleração do controle aéreo (m/s²); 0 desliga
  jumpAirMaxSpeed: 4.5,    // velocidade horizontal máx. alcançável no ar (m/s); 0 = sem limite próprio
  jumpCoyoteTime: 0.10,     // tolerância para saltar logo após sair de uma borda (s)
  jumpBufferWindow: 0.12,   // janela de jump buffering antes do pouso (s)
  jumpInterval: 0.12,       // intervalo mínimo entre saltos (era 0,25; 0,12 acompanha o buffer)
  jumpLandingRecovery: 0.19,
  jumpDrag: 0.0,
  jumpAirControl: 0.0,      // legado: blend direcional no ar (mantido para compatibilidade)
  // Footstool (pisar na cabeça do rival): ataque de contato superior do salto normal.
  footstoolEnabled: 1,
  footstoolDamage: 5,        // dano exato em alvo desprotegido (requisito do plano)
  footstoolBounce: 6.5,      // impulso vertical de rebote do atacante (m/s); era 3,7. Segurar o botão de salto sustenta a subida (altura variável)
  footstoolAirAccel: 20,     // controle aéreo APÓS o rebote (m/s²); o salto comum usa jumpAirAccel (8)
  footstoolAirMaxSpeed: 7.5, // velocidade horizontal máxima alcançável no ar após o rebote (m/s); o salto comum usa jumpAirMaxSpeed (4,5)
  footstoolVaultMargin: 0.35,// esquiva (C) sobre o rival: os pés só precisam descer até (topo da cabeça − esta margem) para pisar nele, pois o arco do vault não passa muito da cabeça (m)
  footstoolStagger: 0.25,     // stagger do defensor (s)
  footstoolTolerance: 0.12,  // tolerância física de contato horizontal (m)
  footstoolMinFallSpeed: 1.0,// velocidade vertical mínima de queda para valer (m/s)
  footstoolCooldown: 0.5,    // controle de repetição: espera mínima entre footstools do mesmo atacante (s)
  footstoolVault: 1,         // a esquiva (C) que passa por cima do rival também pisa nele (footstool) e vira um salto com rebote e controle aéreo
  // Colisão com sólidos do mapa (correção medida na varredura de 30 partidas: lançados por golpe atravessavam até 1 m das plataformas).
  // launchSolidCollision = 1: só o SALTO voluntário "passa por cima" da lateral de um sólido quando sobe rápido; lançamentos colidem
  // e deslizam. 0 = comportamento anterior (para comparar). mountTolerance: quanto (m) os pés podem estar abaixo do topo e ainda
  // "montar" o sólido (antes fixo em 0,25); o apoio no chão usa mountTolerance + 0,10.
  launchSolidCollision: 1,
  mountTolerance: 0.25,
  // jumpPassOver = 0 (padrão): a lateral de um sólido BLOQUEIA o salto até os pés chegarem à faixa de montagem (corpo encostado na face, sem entrar). 1 = comportamento anterior: se a previsão diz que o salto
  // passa do topo, o corpo atravessa a lateral — e quando o salto não passa (botão solto cedo, previsão errada) é ejetado de lado (até 0,4 m). Medido: 35 ejeções em 120 partidas aleatórias → 0, mesma taxa de montagem.
  jumpPassOver: 0,
  itemInitialCount: 2,
  itemSpawnIntervalMin: 20,
  itemSpawnIntervalMax: 40,
  itemMaxRegular: 4,
  itemLifetime: 15,
  itemPickupRadius: 1.3,
  healHp: 20,
  healStamina: 2,
  shieldDuration: 10,
  shieldCapacity: 40,
  shieldMaxCap: 80,
  stageAttackBonus: 0.10,
  stageDefenseReduction: 0.10,
  stageStaminaBonus: 1,
  stageCooldownReduction: 0.10,
  stageSpeedBonus: 0.05,
  stagesMax: 4,
};
export const CONSUMABLE_TYPES = [
  'heal_hp',
  'heal_stamina',
  'buff_attack',
  'buff_defense',
  'buff_stamina_max',
  'buff_cooldown',
  'buff_speed',
];
