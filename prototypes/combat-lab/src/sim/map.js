// @ts-check
// Módulo de Gerenciamento do Mapa: Arena Circular de 50 m de raio (100 m diâmetro),
// Plataformas 3D sólidas, Obstáculos Indestrutíveis, Objetos Destrutíveis com Respawn e Prévia Translúcida,
// Consumíveis (7 tipos com probabilidades iguais, drops balísticos, coleta esférica 3D),
// Progressão de 4 Estágios Permanentes por Atributo e Sistema de Escudo Temporário.
// Implementa rigorosamente as decisões das Rodadas 1–11 de docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md.

import {C} from './config.js';
import {getFighterMaxStamina} from './entity.js';
import {sturdyGuard} from './passive-engine.js';
import {circleContact} from './solid-contact.js';
import {vec, add, sub, scale, length, normalize, dot, clamp, direction, angleOf} from './math.js';

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

/** Cria o estado inicial do mapa (serializável para save/replay). */
export function createMapState(seed = 12345) {
  return {
    seed,
    rngState: seed,
    regularSpawnTimer: 25, // segundos até próximo item regular
    items: [], // {id, type, pos: {x,y,z}, life: 15, isDrop: false, vy: 0}
    destructibles: [], // {id, hp, maxHp: 30, pos: {x,y,z}, size: {hx, hz, height}, shape: 'box', angle: 0, state: 'solid'|'dead'|'ghost', respawnTimer: 0, ghostTimer: 0}
    obstacles: [], // {id, pos: {x,y,z}, shape: 'box'|'cylinder', hx, hz, radius, height, angle: 0}
    platforms: [], // {id, pos: {x,y,z}, width: 3, depth: 3, height: 1.0/1.5}
    nextEntityId: 1000,
    itemStats: {spawned: 0, collected: 0, expired: 0},
    destructibleStats: {broken: 0, respawned: 0},
  };
}

/** Gerador pseudoaleatório determinístico linear congruencial. */
export function nextRandom(state) {
  state.rngState = (state.rngState * 1664525 + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}

export function randomRange(state, min, max) {
  return min + nextRandom(state) * (max - min);
}

/**
 * Fator de escala para posicionar os objetos do mundo em função do tamanho atual
 * da arena. As distâncias fixas (plataformas, ranges de spawn de obstáculos,
 * destrutíveis, itens e lutadores) foram pensadas para a arena padrão (raio 50 m);
 * ao alterar o raio (slider de raio) ou o meio-lado (arena quadrada), tudo se
 * reposiciona proporcionalmente e permanece dentro da arena.
 */
export function getArenaScale() {
  const M = C.map ?? MAP_DEFAULTS;
  if ((M.arenaShape ?? 'circle') === 'square') {
    // Arena quadrada: meio-lado padrão 16 m corresponde ao raio padrão de 50 m.
    return (C.test?.arenaHalf ?? 16) / 50;
  }
  return (M.arenaRadius ?? 50) / 50;
}

/**
 * Raio efetivo da arena circular. É a MESMA medida usada pelo limite físico
 * (clampToArena), pela renderização (piso/anél) e pela validação de spawns: assim a
 * parede física coincide EXATAMENTE com a parede visível e nada spawna fora da área
 * alcançável. Única redução admitida: o cap técnico explícito de cenários de teste
 * (C.test.circleCap) — nunca o meio-lado legado da arena quadrada (C.test.arenaHalf),
 * que não representa a borda circular e gerava "paredes invisíveis".
 */
export function effectiveArenaRadius() {
  const r = C.map?.arenaRadius ?? MAP_DEFAULTS.arenaRadius;
  return C.test?.circleCap != null ? Math.min(C.test.circleCap, r) : r;
}

/** Escolhe um tipo de consumível com probabilidades exatamente iguais (R4.7). */
export function pickRandomConsumableType(state) {
  const idx = Math.floor(nextRandom(state) * CONSUMABLE_TYPES.length);
  return CONSUMABLE_TYPES[clamp(idx, 0, CONSUMABLE_TYPES.length - 1)];
}

/** Distância 2D no plano XZ. */
export function dist2D(p1, p2) {
  return Math.hypot(p1.x - p2.x, (p1.z ?? p1.y) - (p2.z ?? p2.y));
}

/** Distância 3D real entre dois pontos (R11.5). */
export function dist3D(p1, p2) {
  const y1 = p1.y ?? 0, y2 = p2.y ?? 0;
  return Math.hypot(p1.x - p2.x, y1 - y2, p1.z - p2.z);
}

/**
 * Validação espacial de posições (R3.13, R9.12):
 * Garante que não sobreponha outros objetos, plataformas, spawns de lutadores,
 * e permaneça dentro da arena circular de 50 m.
 */
export function isValidSpawnPosition(pos, radius, mapState, fighters = [], minDistFighter = 5.0) {
  const arenaR = effectiveArenaRadius();
  const dCenter = Math.hypot(pos.x, pos.z);
  // Deve estar dentro da arena com margem
  if (dCenter + radius > arenaR - 2.0) return false;

  // Distância mínima dos lutadores
  for (const f of fighters) {
    if (f && f.position && dist2D(pos, f.position) < minDistFighter) return false;
  }

  // Não sobrepor plataformas
  for (const p of mapState.platforms) {
    const hw = p.width / 2 + radius + 0.5;
    const hd = p.depth / 2 + radius + 0.5;
    if (Math.abs(pos.x - p.pos.x) < hw && Math.abs(pos.z - p.pos.z) < hd) return false;
  }

  // Não sobrepor obstáculos indestrutíveis
  for (const o of mapState.obstacles) {
    const or = (o.radius ?? Math.max(o.hx, o.hz)) + radius + 0.8;
    if (dist2D(pos, o.pos) < or) return false;
  }

  // Não sobrepor outros destrutíveis sólidos
  for (const d of mapState.destructibles) {
    if (dist2D(pos, d.pos) < 1e-4) continue; // ignora a si mesmo se já estiver nesta coordenada
    if (d.state === 'solid' || d.state === 'ghost') {
      const dr = Math.max(d.size.hx, d.size.hz) + radius + 0.8;
      if (dist2D(pos, d.pos) < dr) return false;
    }
  }

  return true;
}

/**
 * Busca sistemática da posição válida mais próxima (R9.12).
 * Se o ponto sorteado for inválido, espirala para fora até encontrar uma válida.
 * Se nenhuma for encontrada após tentativas, retorna null para adiar (R10.6).
 */
export function findNearestValidPosition(candidate, radius, mapState, fighters = [], maxAttempts = 32) {
  if (isValidSpawnPosition(candidate, radius, mapState, fighters)) return candidate;

  const stepDist = 1.5;
  for (let ring = 1; ring <= 8; ring++) {
    const r = ring * stepDist;
    const count = ring * 8;
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2;
      const testPos = {
        x: candidate.x + Math.cos(theta) * r,
        z: candidate.z + Math.sin(theta) * r,
        y: candidate.y ?? 0,
      };
      if (isValidSpawnPosition(testPos, radius, mapState, fighters)) {
        return testPos;
      }
    }
  }
  return null; // Adiar geração (R10.6)
}

/** Inicializa a arena completa com plataformas, obstáculos, destrutíveis e itens iniciais. */
export function initMap(mapState, fighters = []) {
  const M = C.map ?? MAP_DEFAULTS;
  const arenaR = M.arenaRadius ?? 50;
  const arenaScale = getArenaScale();

  // 1. Duas plataformas de 3x3m com alturas 1.0m e 1.5m (R7.4, R7.5, R2.9)
  // Posições escaladas pelo tamanho da arena para permanecerem dentro da borda.
  // Quantidade configurável via M.platformCount (padrão 2; 0 desativa plataformas).
  const platformDefs = [
    {
      id: 'plat_1',
      pos: {x: -12 + (nextRandom(mapState) - 0.5) * 8, y: 0, z: 10 + (nextRandom(mapState) - 0.5) * 8},
      width: 3.0,
      depth: 3.0,
      height: 1.0,
    },
    {
      id: 'plat_2',
      pos: {x: 12 + (nextRandom(mapState) - 0.5) * 8, y: 0, z: -10 + (nextRandom(mapState) - 0.5) * 8},
      width: 3.0,
      depth: 3.0,
      height: 1.5,
    },
  ];
  const platformCount = clamp(M.platformCount ?? 2, 0, platformDefs.length);
  mapState.platforms = platformDefs.slice(0, platformCount).map(p => ({
    ...p,
    pos: {x: p.pos.x * arenaScale, y: p.pos.y, z: p.pos.z * arenaScale},
  }));

  // 2. Obstáculos indestrutíveis: mistura de caixas, cilindros e pilares (R1.7, R3.11)
  mapState.obstacles = [];
  const obstacleShapes = [
    {shape: 'box', hx: 1.5, hz: 1.5, height: 2.2},
    {shape: 'cylinder', radius: 1.4, height: 3.0},
    {shape: 'pillar', radius: 0.9, height: 4.5},
    {shape: 'box', hx: 2.0, hz: 1.0, height: 1.8},
  ];

  const obstacleCount = M.obstacleCount ?? 4;
  for (let i = 0; i < obstacleCount; i++) {
    const s = obstacleShapes[i % obstacleShapes.length];
    const angle = (i / 4) * Math.PI * 2 + randomRange(mapState, -0.4, 0.4);
    const dist = randomRange(mapState, 14, 28) * arenaScale;
    const rawPos = {x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, y: 0};
    const validPos = findNearestValidPosition(rawPos, 2.0, mapState, fighters) || rawPos;
    mapState.obstacles.push({
      id: `obs_${i + 1}`,
      pos: validPos,
      shape: s.shape,
      hx: s.hx ?? s.radius,
      hz: s.hz ?? s.radius,
      radius: s.radius ?? Math.max(s.hx, s.hz),
      height: s.height,
      angle: randomRange(mapState, 0, Math.PI * 2),
    });
  }

  // 3. Objetos destrutíveis com 30 HP cada (R1.3, R1.4, R9.11)
  mapState.destructibles = [];
  const destructibleCount = M.destructibleCount ?? 4;
  for (let i = 0; i < destructibleCount; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4 + randomRange(mapState, -0.3, 0.3);
    const dist = randomRange(mapState, 10, 24) * arenaScale;
    const rawPos = {x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, y: 0};
    const validPos = findNearestValidPosition(rawPos, 1.2, mapState, fighters) || rawPos;
    const baseHp = M.destructibleHp ?? 30;
    mapState.destructibles.push({
      id: `dest_${i + 1}`,
      hp: baseHp,
      maxHp: baseHp,
      pos: validPos,
      size: {hx: 0.8, hz: 0.8, height: 1.6},
      shape: 'box',
      angle: randomRange(mapState, 0, Math.PI * 2),
      state: 'solid',
      respawnTimer: 0,
      ghostTimer: 0,
      resistances: {physical: 1.0, projectile: 1.0, area: 1.0, environmental: 1.0}, // R9.10
    });
  }

  // 4. Consumíveis iniciais equiprováveis (R4.4, R6.4, R10.9); quantidade configurável
  mapState.items = [];
  const initialItems = M.itemInitialCount ?? 2;
  for (let i = 0; i < initialItems; i++) {
    const t = pickRandomConsumableType(mapState);
    const angle = randomRange(mapState, 0, Math.PI * 2);
    const dist = randomRange(mapState, 8, 22) * arenaScale;
    const rawPos = {x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, y: 0.4};
    const validPos = findNearestValidPosition(rawPos, 1.0, mapState, fighters) || rawPos;
    mapState.items.push({
      id: mapState.nextEntityId++,
      type: t,
      pos: validPos,
      life: M.itemLifetime ?? 15,
      isDrop: false,
      vy: 0,
    });
    mapState.itemStats.spawned++;
  }

  // Timer para o próximo spawn regular (20 a 40 segundos, R6.1)
  mapState.regularSpawnTimer = randomRange(mapState, M.itemSpawnIntervalMin ?? 20, M.itemSpawnIntervalMax ?? 40);
}

/**
 * Sorteia dois pontos iniciais opostos válidos com separação equilibrada (R11.1).
 */
export function generateFighterSpawnPositions(mapState) {
  const s = getArenaScale();
  const separationRadius = randomRange(mapState, 6.0, 9.0) * s; // separação mútua escalada
  const baseAngle = randomRange(mapState, 0, Math.PI * 2);
  for (let attempt = 0; attempt < 16; attempt++) {
    const angle = baseAngle + (attempt * Math.PI) / 8;
    const p0 = {x: Math.cos(angle) * separationRadius, z: Math.sin(angle) * separationRadius, y: 0};
    const p1 = {x: -p0.x, z: -p0.z, y: 0};
    const valid0 = findNearestValidPosition(p0, 1.0, mapState, []);
    if (!valid0) continue;
    const valid1 = findNearestValidPosition(p1, 1.0, mapState, [{position: valid0}]);
    if (!valid1) continue;
    return [vec(valid0.x, valid0.z), vec(valid1.x, valid1.z)];
  }
  return [vec(0, -8 * s), vec(0, 8 * s)];
}

/**
 * Atualiza o ciclo de vida do mapa a cada passo da simulação de passo fixo:
 * - Temporizadores de respawn de destrutíveis e prévia translúcida (ghost) (R6.5, R11.9)
 * - Queda física dos drops de consumíveis até solo ou plataforma (R11.6)
 * - Expiração de consumíveis após 15s (R6.2)
 * - Geração periódica de consumíveis a cada 20–40s respeitando limite de 4 regulares (R4.6, R6.1, R6.3, R6.7)
 * - Coleta de itens por distância esférica 3D com desempate determinístico (R11.5, R5.15)
 */
export function stepMap(mapState, dt, fighters = [], events = []) {
  const M = C.map ?? MAP_DEFAULTS;

  // 1. Atualizar destrutíveis (respawn e prévia translúcida R11.9)
  for (const d of mapState.destructibles) {
    if (d.noRespawn) continue;   // destruído pela explosão do Emerging Stone: só volta na rodada seguinte
    if (d.state === 'dead') {
      d.respawnTimer -= dt;
      if (d.respawnTimer <= (M.destructibleGhostPreview ?? 2.0)) {
        // Sorteia nova posição válida na arena (R6.6)
        const angle = randomRange(mapState, 0, Math.PI * 2);
        const dist = randomRange(mapState, 10, 24) * getArenaScale();
        const rawPos = {x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, y: 0};
        const validPos = findNearestValidPosition(rawPos, 1.2, mapState, fighters);
        if (!validPos) {
          // Adia a geração quando não existir posição válida (R10.6, Caso C da auditoria)
          d.respawnTimer = 1.0;
          continue;
        }
        // Entra na fase de prévia translúcida (ghost) antes de se tornar sólido
        d.pos = validPos;
        d.state = 'ghost';
        d.ghostTimer = d.respawnTimer;
        events.push({result: 'destructibleGhost', id: d.id, pos: {...d.pos}});
      }
    } else if (d.state === 'ghost') {
      d.ghostTimer -= dt;
      if (d.ghostTimer <= 0) {
        // Antes de materializar sólido, verifica se o local não foi bloqueado por combatente (R10.6)
        if (!isValidSpawnPosition(d.pos, 1.2, mapState, fighters, 1.5)) {
          d.ghostTimer = 0.5; // Adia a materialização física enquanto houver sobreposição
          continue;
        }
        // Materialização sólida definitiva
        d.state = 'solid';
        d.hp = d.maxHp;
        mapState.destructibleStats.respawned++;
        events.push({result: 'destructibleRespawned', id: d.id, pos: {...d.pos}});
      }
    }
  }

  // 2. Atualizar consumíveis em campo (queda física e expiração)
  for (let i = mapState.items.length - 1; i >= 0; i--) {
    const item = mapState.items[i];

    // Queda física do item até solo ou plataforma (R11.6)
    const currentY = item.pos.y ?? 0;
    const targetY = getGroundHeightAt(item.pos.x, item.pos.z, mapState) + 0.4; // flutua levemente
    if (currentY > targetY) {
      item.vy = (item.vy ?? 0) - 18 * dt; // gravidade
      item.pos.y = Math.max(targetY, currentY + item.vy * dt);
      if (item.pos.y <= targetY) {
        item.pos.y = targetY;
        item.vy = 0;
      }
    } else {
      item.pos.y = targetY;
    }

    // Expiração após 15 segundos (R6.2)
    item.life -= dt;
    if (item.life <= 0) {
      mapState.items.splice(i, 1);
      mapState.itemStats.expired++;
      events.push({result: 'itemExpired', id: item.id, type: item.type});
    }
  }

  // 3. Spawner regular de consumíveis (20–40s, máx 4 consumíveis totais no cenário R4.6, R6.1, R6.3, R6.7)
  const totalCount = mapState.items.length;
  if (totalCount < (M.itemMaxRegular ?? 4)) {
    mapState.regularSpawnTimer -= dt;
    if (mapState.regularSpawnTimer <= 0) {
      // Gerar 1 novo consumível regular
      const t = pickRandomConsumableType(mapState);
      const angle = randomRange(mapState, 0, Math.PI * 2);
      const dist = randomRange(mapState, 8, 22) * getArenaScale();
      const rawPos = {x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, y: 0.4};
      const validPos = findNearestValidPosition(rawPos, 1.0, mapState, fighters);
      if (validPos) {
        mapState.items.push({
          id: mapState.nextEntityId++,
          type: t,
          pos: validPos,
          life: M.itemLifetime ?? 15,
          isDrop: false,
          vy: 0,
        });
        mapState.itemStats.spawned++;
        events.push({result: 'itemSpawned', type: t, pos: {...validPos}});
      }
      // Novo intervalo aleatório
      mapState.regularSpawnTimer = randomRange(mapState, M.itemSpawnIntervalMin ?? 20, M.itemSpawnIntervalMax ?? 40);
    }
  }

  // 4. Detecção de coleta automática por distância esférica 3D (R11.5, R4.3, R5.13)
  const pickupR = M.itemPickupRadius ?? 1.3;
  for (let i = mapState.items.length - 1; i >= 0; i--) {
    const item = mapState.items[i];
    let candidateFighter = /** @type {any} */ (null);
    let minDist = Infinity;

    for (const f of fighters) {
      // Lutadores derrotados (HP = 0) não podem coletar (R10.5)
      if (!f || f.hp <= 0) continue;

      const fPos = {
        x: f.position.x,
        y: (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0) + 0.6, // centro do corpo
        z: f.position.z,
      };

      const d = dist3D(item.pos, fPos);
      if (d <= pickupR && d < minDist) {
        minDist = d;
        candidateFighter = f;
      }
    }

    if (candidateFighter) {
      // Coleta bem-sucedida!
      mapState.items.splice(i, 1);
      mapState.itemStats.collected++;
      events.push({result: 'itemCollected', id: item.id, type: item.type, fighter: candidateFighter.id});
      applyConsumableEffect(candidateFighter, item.type, events);
    }
  }

  return events;
}

/** Altura do piso/plataforma em determinada coordenada (X, Z). */
export function getGroundHeightAt(x, z, mapState) {
  let highest = 0;
  if (mapState.platforms) {
    for (const p of mapState.platforms) {
      const hx = p.width / 2;
      const hz = p.depth / 2;
      if (Math.abs(x - p.pos.x) <= hx && Math.abs(z - p.pos.z) <= hz) {
        if (p.height > highest) highest = p.height;
      }
    }
  }
  if (mapState.obstacles) {
    for (const o of mapState.obstacles) {
      const h = (o.pos?.y ?? 0) + o.height;
      if (o.shape === 'cylinder' || o.shape === 'pillar') {
        const dx = x - o.pos.x, dz = z - o.pos.z;
        if (dx * dx + dz * dz <= o.radius * o.radius) {
          if (h > highest) highest = h;
        }
      } else {
        if (Math.abs(x - o.pos.x) <= o.hx && Math.abs(z - o.pos.z) <= o.hz) {
          if (h > highest) highest = h;
        }
      }
    }
  }
  if (mapState.destructibles) {
    for (const d of mapState.destructibles) {
      if (d.state !== 'solid') continue;
      const h = (d.pos?.y ?? 0) + (d.size?.height ?? 1.6);
      if (Math.abs(x - d.pos.x) <= d.size.hx && Math.abs(z - d.pos.z) <= d.size.hz) {
        if (h > highest) highest = h;
      }
    }
  }
  return highest;
}

/**
 * Aplica o efeito do consumível ao lutador conforme todas as regras de progressão,
 * conversão em cura, concessão de escudo e bônus de stamina (R4, R5, R6, R9, R10, R11).
 */
export function applyConsumableEffect(fighter, type, events = []) {
  const M = C.map ?? MAP_DEFAULTS;
  fighter.stages ??= {attack: 0, defense: 0, staminaMax: 0, cooldown: 0, speed: 0};
  fighter.shield ??= {hp: 0, duration: 0, maxHp: M.shieldMaxCap ?? 80};

  const maxStages = M.stagesMax ?? 4;
  const isAllMaxed =
    fighter.stages.attack >= maxStages &&
    fighter.stages.defense >= maxStages &&
    fighter.stages.staminaMax >= maxStages &&
    fighter.stages.cooldown >= maxStages &&
    fighter.stages.speed >= maxStages;

  // 1. Consumível exclusivo de Cura de HP (R9.1: 20 HP padrão)
  if (type === 'heal_hp') {
    applyHpHeal(fighter, M.healHp ?? 20, events);
    return;
  }

  // 2. Consumível exclusivo de Stamina Imediata (R9.2: 2 pontos padrão)
  if (type === 'heal_stamina') {
    applyStaminaHeal(fighter, M.healStamina ?? 2, events);
    return;
  }

  // 3. Consumíveis de Atributos Evolutivos (5 categorias, R5.1)
  const categoryMap = {
    buff_attack: 'attack',
    buff_defense: 'defense',
    buff_stamina_max: 'staminaMax',
    buff_cooldown: 'cooldown',
    buff_speed: 'speed',
  };

  const cat = categoryMap[type];
  if (cat) {
    if (fighter.stages[cat] < maxStages) {
      // Evolui em 1 estágio permanente (R5.1, R5.3)
      fighter.stages[cat]++;

      // Efeito imediato na stamina máxima (R6.10: +1 à capacidade e +1 à stamina atual simultaneamente)
      if (cat === 'staminaMax') {
        const bonusCap = M.stageStaminaBonus ?? 1;
        const maxStam = getFighterMaxStamina(fighter);
        fighter.stamina = Math.min(maxStam, fighter.stamina + bonusCap);
        fighter.regenBase = fighter.stamina;
        fighter.exhausted = false;
      }

      events.push({result: 'stageUp', fighter: fighter.id, category: cat, stage: fighter.stages[cat]});
      return;
    }

    // A categoria já está no estágio 4! Converte em cura de HP comum (R5.10, R6.14)
    if (!isAllMaxed || fighter.hp < fighter.attributes.hp) {
      applyHpHeal(fighter, M.healHp ?? 20, events);
      return;
    }

    // Todos os 5 atributos estão no estágio 4 E HP está cheio!
    // Concede benefício especial repetível: recuperação imediata de stamina (R9.8, R9.9)
    if (fighter.stamina < getFighterMaxStamina(fighter)) {
      applyStaminaHeal(fighter, M.healStamina ?? 2, events);
      return;
    }

    // Se até a stamina já estiver cheia: concede escudo temporário acumulável (R10.4)
    applyShield(fighter, M.shieldCapacity ?? 40, M.shieldDuration ?? 10, events);
  }
}

/** Aplica cura de HP, convertendo qualquer excedente em pontos de escudo (R11.4, R5.11). */
export function applyHpHeal(fighter, amount, events = []) {
  const M = C.map ?? MAP_DEFAULTS;
  const maxHp = fighter.attributes.hp ?? 100;

  if (fighter.hp >= maxHp) {
    // HP já estava cheio: concede escudo temporário direto de 40 HP por 10s (R5.11, R6.15, R9.3, R9.4)
    applyShield(fighter, M.shieldCapacity ?? 40, M.shieldDuration ?? 10, events);
    return;
  }

  const missing = maxHp - fighter.hp;
  if (amount <= missing) {
    fighter.hp += amount;
    events.push({result: 'healedHp', fighter: fighter.id, amount, newHp: fighter.hp});
  } else {
    // Cura excedeu o HP máximo: recupera até o máximo e converte SOMENTE o excedente em escudo (R11.4)
    fighter.hp = maxHp;
    const overflow = amount - missing;
    events.push({result: 'healedHp', fighter: fighter.id, amount: missing, newHp: maxHp});
    applyShield(fighter, overflow, M.shieldDuration ?? 10, events);
  }
}

/** Aplica recuperação imediata de stamina. */
export function applyStaminaHeal(fighter, amount, events = []) {
  const maxStam = getFighterMaxStamina(fighter);
  const gained = Math.min(amount, Math.max(0, maxStam - fighter.stamina));
  fighter.stamina = Math.min(maxStam, fighter.stamina + amount);
  fighter.regenBase = fighter.stamina;
  fighter.regenAge = 0;
  if (fighter.stamina >= 1) fighter.exhausted = false;
  events.push({result: 'healedStamina', fighter: fighter.id, amount: gained, newStamina: fighter.stamina});
}

/**
 * Concede ou renova escudo temporário (R9.3–R9.7, R10.2).
 * - Duração renovada integralmente para 10 s (R10.2).
 * - Capacidade soma com a existente até teto configurável (R9.5).
 */
export function applyShield(fighter, points, duration = 10, events = []) {
  const M = C.map ?? MAP_DEFAULTS;
  const maxCap = fighter.shield?.maxHp ?? M.shieldMaxCap ?? 80;
  fighter.shield ??= {hp: 0, duration: 0, maxHp: maxCap};

  const oldHp = fighter.shield.hp;
  fighter.shield.hp = Math.min(maxCap, fighter.shield.hp + points);
  fighter.shield.duration = duration; // renova integralmente para 10s (R10.2)

  events.push({
    result: 'shieldApplied',
    fighter: fighter.id,
    added: fighter.shield.hp - oldHp,
    current: fighter.shield.hp,
    duration,
  });
}

/** Atualiza temporizador do escudo a cada passo fixo (congelado em pause/hitstop R11.8). */
export function stepShield(fighter, dt, events = []) {
  if (fighter.shield && fighter.shield.hp > 0) {
    fighter.shield.duration -= dt;
    if (fighter.shield.duration <= 0) {
      fighter.shield.hp = 0;
      fighter.shield.duration = 0;
      events.push({result: 'shieldExpired', fighter: fighter.id});
    }
  }
}

/**
 * Pipeline Central de Dano com Escudo e Estágios de Defesa (R9.6, R10.1, R10.3, R11.3):
 * 1. Escudo absorve dano BRUTO antes da Defesa (R9.6, R11.3).
 * 2. Se dano bruto > escudo: consome todo o escudo e o excedente passa pela Defesa (R10.1).
 * 3. Defesa básica + estágios de defesa (-10 pp por estágio, R10.3) aplicados apenas ao excedente.
 * 4. Escudo não bloqueia empurrões nem lançamentos (R9.7).
 * @param {any} [arg0]
 * @param {any} [arg1]
 * @param {any} [arg2]
 * @param {boolean} [isBlocked]
 * @param {boolean} [isPerfect]
 * @param {{category?: string, contact?: string, attacker?: any}} [ctx] origem do dano ('direct' | 'periodic' | 'environmental' | 'reflected'): Sturdy só vale para dano letal DIRETO de ataque (R6).
 */
export function processDamageWithShieldAndStages(arg0, arg1, arg2 = null, isBlocked = false, isPerfect = false, ctx = {}) {
  let defender, rawDamage, attacker;
  if (typeof arg1 === 'number') {
    defender = arg0;
    rawDamage = arg1;
    attacker = arg2;
  } else {
    attacker = arg0;
    defender = arg1;
    rawDamage = typeof arg2 === 'number' ? arg2 : 0;
  }

  if (!defender || defender.hp <= 0) return {absorbedByShield: 0, hpDamage: 0};
  if (isPerfect) return {absorbedByShield: 0, hpDamage: 0};

  defender.shield ??= {hp: 0, duration: 0, maxHp: 80};
  defender.stages ??= {attack: 0, defense: 0, staminaMax: 0, cooldown: 0, speed: 0};

  let unshieldedRaw = rawDamage;
  let absorbed = 0;

  // Escudo intercepta dano bruto primeiro (R9.6, R11.3)
  if (defender.shield.hp > 0) {
    if (defender.shield.hp >= rawDamage) {
      absorbed = rawDamage;
      defender.shield.hp -= rawDamage;
      unshieldedRaw = 0;
    } else {
      absorbed = defender.shield.hp;
      unshieldedRaw = rawDamage - defender.shield.hp;
      defender.shield.hp = 0;
      defender.shield.duration = 0;
    }
  }

  // Dano excedente passa pela Defesa básica e redução de estágios (R10.1, R10.3)
  let finalHpDamage = 0;
  /** @type {{hpDamage: number, sturdy: boolean}|null} Sturdy (R6/§7), quando aplicável. */
  let sg = null;
  if (unshieldedRaw > 0) {
    const X = C.extras?.combat;
    const guardMultiplier = isBlocked ? (X?.guardDamageMultiplier ?? 0.5) : 1.0;

    // Redução de 10 p.p. por estágio de Defesa (R6.11, R10.3)
    const stageReduction = (defender.stages.defense ?? 0) * (C.map?.stageDefenseReduction ?? 0.10);
    const defenseFactor = Math.max(0, 1.0 - stageReduction);

    finalHpDamage = unshieldedRaw * guardMultiplier * defenseFactor;
    // Sturdy (R6/§7): dano letal DIRETO de ataque deixa exatamente 1 HP, 1× por rodada (DOT/ambiental/refletido não protege).
    sg = sturdyGuard(defender, finalHpDamage, {...ctx, attacker});
    finalHpDamage = sg.hpDamage;
    defender.hp = sg.sturdy ? 1 : Math.max(0, defender.hp - finalHpDamage);   // Sturdy já fixou o HP em 1 dentro de sturdyGuard

    if (attacker) {
      defender.lastAttacker = attacker.id;
      defender.lastDamagedTick = (defender.lastDamagedTick ?? 0) + 1;
    }
  }

  return {absorbedByShield: absorbed, hpDamage: finalHpDamage, sturdy: !!sg?.sturdy};
}

/**
 * Danifica um objeto destrutível de acordo com a categoria de entrega e bônus ofensivo (R3.6, R5.14, R9.10).
 * @param {any} destructible
 * @param {number} baseDamage
 * @param {string} [category]
 * @param {any} [attacker]
 * @param {any} [mapState]
 * @param {any[]} [events]
 */
export function damageDestructible(destructible, baseDamage, category = 'physical', attacker = null, mapState = null, events = []) {
  if (destructible.state !== 'solid' || destructible.hp <= 0) return false;
  if (destructible.rock) {   // Emerging Stone: HP 5; dano por golpe válido = P0 1, P1 2, P2 3, P3 4 (sem PL = P0); sem drops nem renascimento
    const pl = category === 'physical' ? (attacker?.action?.pl ?? 0) : 0, table = destructible.hpPerPl ?? [1, 2, 3, 4], dmgRock = table[Math.max(0, Math.min(3, pl))];
    destructible.hp = Math.max(0, destructible.hp - dmgRock);
    events.push({result: 'destructibleDamaged', id: destructible.id, damage: dmgRock, remainingHp: destructible.hp});
    if (destructible.hp <= 0 && mapState) {
      destructible.state = 'dead';mapState.destructibles = mapState.destructibles.filter(x => x !== destructible);
      events.push({result: 'rockDestroyed', id: destructible.id, owner: destructible.owner, why: 'hp', x: destructible.pos.x, z: destructible.pos.z});
      return true;
    }
    return false;
  }

  // Bônus de estágio de Ataque do atacante afeta objetos destrutíveis (R5.14)
  let atkMult = 1.0;
  if (attacker && attacker.stages?.attack) {
    atkMult += attacker.stages.attack * (C.map?.stageAttackBonus ?? 0.10);
  }

  // Multiplicador de resistência do objeto por categoria (R9.10)
  const res = destructible.resistances?.[category] ?? 1.0;
  const dmg = baseDamage * atkMult * res;

  destructible.hp = Math.max(0, destructible.hp - dmg);
  events.push({result: 'destructibleDamaged', id: destructible.id, damage: dmg, remainingHp: destructible.hp});

  if (destructible.hp <= 0) {
    // Objeto destruído! (R1.12, R3.8, R6.5, R11.6)
    destructible.state = 'dead';
    destructible.respawnTimer = randomRange(mapState, C.map?.destructibleRespawnMin ?? 15, C.map?.destructibleRespawnMax ?? 30);
    if (mapState?.destructibleStats) mapState.destructibleStats.broken++;
    events.push({result: 'destructibleDestroyed', id: destructible.id, pos: {...destructible.pos}});

    // Spawn do drop de consumível que cai fisicamente (R1.12, R4.11, R11.6)
    if (mapState?.items) {
      const dropType = pickRandomConsumableType(mapState);
      const dHeight = destructible.size?.height ?? destructible.size?.hy ?? 1.6;
      mapState.items.push({
        id: mapState.nextEntityId++,
        type: dropType,
        pos: {x: destructible.pos.x, y: dHeight + 0.2, z: destructible.pos.z},
        life: C.map?.itemLifetime ?? 15,
        isDrop: true, // drop excepcional que pode exceder 4 itens (R5.16)
        vy: 1.5, // leve impulso para cima antes da queda balística
      });
      events.push({result: 'dropSpawned', type: dropType, pos: {...destructible.pos}});
      events.push({result: 'itemDropped', type: dropType, pos: {...destructible.pos}});
    }
    return true;
  }
  return false;
}

/**
 * Colisão física de um lutador contra plataformas (laterais sólidas), obstáculos e destrutíveis (R1.6, R1.8, R7.6, R7.15, R10.7-R10.8).
 */
/** Subindo rápido o bastante para passar por cima do topo? Só o salto voluntário (ou tudo, com launchSolidCollision = 0). */
function risesOver(f, fY, top) {
  const fl = f.flight;
  if (!fl || !(fl.vy > 0) || fY + (fl.vy * fl.vy) / 35 < top) return false;
  return !!fl.isNormalJump || !((C.map?.launchSolidCollision) ?? 1);
}
export function collideMapFighter(mapState, f, events = []) {
  if (!mapState) return;
  const halfExtent = C.test?.halfExtent ?? 0.35;
  const currentY = f.flight ? (f.flight.y ?? (f.groundY ?? 0)) : (f.groundY ?? 0);
  const fY = currentY + (f.vaultHeight ?? 0);
  const fHeight = C.extras?.visual?.bodyHeight ?? 1.2;
  const mount = C.map?.mountTolerance ?? 0.25;

  // 1. Plataformas (laterais sólidas R7.6 com tolerância para montar no topo)
  if (mapState.platforms) {
    for (const p of mapState.platforms) {
      if (fY >= p.height - mount) continue;
      if (risesOver(f, fY, p.height)) continue;
      const px = p.pos?.x ?? p.x, pz = p.pos?.z ?? p.z;
      const hx = (p.width ?? 3) / 2, hz = (p.depth ?? 3) / 2;
      const dx = f.position.x - px, dz = f.position.z - pz;
      const ox = (hx + halfExtent) - Math.abs(dx);
      const oz = (hz + halfExtent) - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) {
          const sign = dx > 0 ? 1 : -1;
          f.position.x = px + sign * (hx + halfExtent);
          if (f.velocity.x * sign < 0) f.velocity.x = 0;
          if (f.flight && !f.flight.isNormalJump && f.flight.horizontal.x * sign < 0) f.flight.horizontal.x = 0;
        } else {
          const sign = dz > 0 ? 1 : -1;
          f.position.z = pz + sign * (hz + halfExtent);
          if (f.velocity.z * sign < 0) f.velocity.z = 0;
          if (f.flight && !f.flight.isNormalJump && f.flight.horizontal.z * sign < 0) f.flight.horizontal.z = 0;
        }
        f.contacts++;
      }
    }
  }

  // 2. Obstáculos indestrutíveis (R1.8 com suporte a topo e tolerância)
  if (mapState.obstacles) {
    for (const o of mapState.obstacles) {
      const topY = (o.pos?.y ?? 0) + o.height;
      if (fY >= topY - mount) continue;
      if (fY + fHeight <= (o.pos?.y ?? 0)) continue;
      // Contato de teto: cabeça exatamente na face inferior, sem subida — é contato, não penetração: sem empurrão.
      if (f.flight && f.flight.vy <= 0 && Math.abs(fY + fHeight - (o.pos?.y ?? 0)) <= 1e-6) continue;
      if (risesOver(f, fY, topY)) continue;
      if (o.shape === 'cylinder' || o.shape === 'pillar') {
        // Menor translação real, inclusive com o centro do lutador exatamente no centro do pilar (antes: contato descartado e lutador preso).
        const contact = circleContact(o.pos, o.radius, f.position, halfExtent);
        if (contact) {
          const n = contact.normal;
          f.position.x += n.x * contact.depth;
          f.position.z += n.z * contact.depth;
          // Só a componente que entra no sólido é removida (como nas caixas); a tangente é preservada.
          const into = f.velocity.x * n.x + f.velocity.z * n.z;
          if (into < 0) {f.velocity.x -= n.x * into;f.velocity.z -= n.z * into;}
          if (f.flight && !f.flight.isNormalJump) {
            const hv = f.flight.horizontal.x * n.x + f.flight.horizontal.z * n.z;
            if (hv < 0) {f.flight.horizontal.x -= n.x * hv;f.flight.horizontal.z -= n.z * hv;}
          }
          f.contacts++;
        }
      } else {
        const dx = f.position.x - o.pos.x, dz = f.position.z - o.pos.z;
        const ox = (o.hx + halfExtent) - Math.abs(dx);
        const oz = (o.hz + halfExtent) - Math.abs(dz);
        if (ox > 0 && oz > 0) {
          if (ox < oz) {
            const sign = dx > 0 ? 1 : -1;
            f.position.x = o.pos.x + sign * (o.hx + halfExtent);
            if (f.velocity.x * sign < 0) f.velocity.x = 0;
            if (f.flight && !f.flight.isNormalJump && f.flight.horizontal.x * sign < 0) f.flight.horizontal.x = 0;
          } else {
            const sign = dz > 0 ? 1 : -1;
            f.position.z = o.pos.z + sign * (o.hz + halfExtent);
            if (f.velocity.z * sign < 0) f.velocity.z = 0;
            if (f.flight && !f.flight.isNormalJump && f.flight.horizontal.z * sign < 0) f.flight.horizontal.z = 0;
          }
          f.contacts++;
        }
      }
    }
  }

  // 3. Destrutíveis (R1.6, R3.7, R7.15, R10.7-R10.8)
  if (mapState.destructibles) {
    for (const d of mapState.destructibles) {
      if (d.state !== 'solid') continue;
      const topY = (d.pos?.y ?? 0) + (d.size?.height ?? 1.6);
      if (fY >= topY - mount) continue;
      if (fY + fHeight <= (d.pos?.y ?? 0)) continue;
      // Contato de teto: cabeça exatamente na face inferior, sem subida — é contato, não penetração: sem empurrão.
      if (f.flight && f.flight.vy <= 0 && Math.abs(fY + fHeight - (d.pos?.y ?? 0)) <= 1e-6) continue;
      if (risesOver(f, fY, topY)) continue;
      const dx = f.position.x - d.pos.x, dz = f.position.z - d.pos.z;
      const ox = (d.size.hx + halfExtent) - Math.abs(dx);
      const oz = (d.size.hz + halfExtent) - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (f.flight && !f.flight.isNormalJump) {
          const relSpeed = length(f.flight.horizontal);
          if (relSpeed > 1.0) {
            const dmgToObj = relSpeed * 6.0;
            const dmgToFighter = relSpeed * 2.5;
            damageDestructible(d, dmgToObj, 'environment', f, mapState, events);
            processDamageWithShieldAndStages(f, dmgToFighter, null, false, false);
            events.push({result: 'destructibleSplat', fighter: f.id, destructible: d.id, damage: dmgToFighter});
            f.flight.horizontal = {x: 0, z: 0};
            f.velocity = {x: 0, z: 0};
          }
        }
        if (d.state === 'solid') {
          if (ox < oz) {
            const sign = dx > 0 ? 1 : -1;
            f.position.x = d.pos.x + sign * (d.size.hx + halfExtent);
            if (f.velocity.x * sign < 0) f.velocity.x = 0;
            if (f.flight && !f.flight.isNormalJump && f.flight.horizontal.x * sign < 0) f.flight.horizontal.x = 0;
          } else {
            const sign = dz > 0 ? 1 : -1;
            f.position.z = d.pos.z + sign * (d.size.hz + halfExtent);
            if (f.velocity.z * sign < 0) f.velocity.z = 0;
            if (f.flight && !f.flight.isNormalJump && f.flight.horizontal.z * sign < 0) f.flight.horizontal.z = 0;
          }
          f.contacts++;
        }
      }
    }
  }
}
