// @ts-check
// Dividido de map.js (comportamento idêntico): map-step.

import {C} from '../config.js';
import {length} from '../math.js';
import {MAP_DEFAULTS} from './map-config.js';
import {dist3D, getArenaScale, pickRandomConsumableType, randomRange} from './map-state.js';
import {fighterBlocksBox, isValidSpawnPosition, logSpawnRejection, placeOrReject} from './map-spawn.js';
import {applyConsumableEffect} from './map-consumables.js';
import {groundHeightAt} from '../collision/queries.js';

/**
 * Recusa de spawn durante a partida (F4): evento spawnRejected {kind, reason, position} + entrada no mapState.spawnLog com o tick.
 * @param {any} mapState @param {any[]} events @param {number|null} tick @param {string} kind @param {string} reason @param {any} rawPos
 */
function rejectSpawn(mapState, events, tick, kind, reason, rawPos) {
  events.push({result: 'spawnRejected', kind, reason, position: {x: rawPos.x, y: rawPos.y ?? 0, z: rawPos.z}});
  logSpawnRejection(mapState, tick, kind, reason);
}

/**
 * Atualiza o ciclo de vida do mapa a cada passo da simulação de passo fixo:
 * - Temporizadores de respawn de destrutíveis e prévia translúcida (ghost) (R6.5, R11.9)
 * - Queda física dos drops de consumíveis até solo ou plataforma (R11.6)
 * - Expiração de consumíveis após 15s (R6.2)
 * - Geração periódica de consumíveis a cada 20–40s respeitando limite de 4 regulares (R4.6, R6.1, R6.3, R6.7)
 * - Coleta de itens por distância esférica 3D com desempate determinístico (R11.5, R5.15)
 */
export function stepMap(mapState, dt, fighters = [], events = [], tick = null) {
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
        const placed = placeOrReject(rawPos, 1.2, mapState, fighters, {hx: d.size.hx, hz: d.size.hz});
        if ('rejected' in placed) {
          // Adia a geração quando não existir posição válida (R10.6, Caso C da auditoria); F4: recusa com motivo (evento + spawnLog)
          // só na PRIMEIRA recusa deste ciclo morto (a nova tentativa sai a cada passo enquanto não houver lugar: não inunda eventos nem o log).
          d.respawnTimer = 1.0;
          if (!d.spawnRejectNoted) {d.spawnRejectNoted = true;rejectSpawn(mapState, events, tick, 'destructible', placed.rejected, rawPos);}
          continue;
        }
        delete d.spawnRejectNoted;   // saiu do estado morto: o próximo ciclo morto volta a registrar
        const validPos = placed.pos;
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
        // Sem lutador (corpo quadrado, mesma altura) a menos de spawnClearance da caixa do objeto, e sem sobrepor outros sólidos.
        if (!isValidSpawnPosition(d.pos, 1.2, mapState, [], 0, {hx: d.size.hx, hz: d.size.hz}) || fighterBlocksBox(fighters, d.pos.x, d.pos.z, d.size.hx, d.size.hz, d.pos.y ?? 0, (d.pos.y ?? 0) + d.size.height)) {
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
    const targetY = groundHeightAt(item.pos, {mapState}, {footMargin: 0}) + 0.4; // flutua levemente (apoio com footprint exato: collision/queries.js, F4)
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
      const placed = placeOrReject(rawPos, 1.0, mapState, fighters), validPos = 'pos' in placed ? placed.pos : null;
      if ('rejected' in placed) rejectSpawn(mapState, events, tick, 'item', placed.rejected, rawPos);
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
