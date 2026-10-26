// @ts-check
// Psyshock — Move de carga (categoria Charge, tipo Projectile), tecla padrão S (M1–M30). Ao SOLTAR, dispara de 3 a 8 pedras
// telecinéticas ao mesmo tempo (uma a mais a cada 0,8 s de carga). Este arquivo tem a definição (dados) e o efeito de disparo;
// o voo, o homing, o acerto por alvo (0,8ⁿ e teto de knockback) e a colisão entre pedras estão em world.js. Valores: C.world.psyshock
// — PROVISÓRIOS (M30.10), capturados ao apertar o botão (M28.4, D1). Todas as pedras de uma execução são iguais em Power Level,
// dano-base e propriedades (M30.2); tamanho e altura visuais não mudam a física.
import {spawn, closestOnShape} from '../world.js';
import {add, scale, direction, normalize} from '../math.js';
import {C} from '../config.js';
import {hash32, rng, uniform} from './rng.js';
import {defineFicha} from './params-registry.js';
import {params, def as psyshockDef} from './psyshock.params.js';

/** Definição do movimento (dados puros, clonável). */
export {psyshockDef};   // definição (id, carga, custo…) vem de psyshock.move.json

/** Quantidade de pedras pela carga: 3 + 1 a cada `stoneSeconds` (por contagem de passos), no máximo `maxStones` (M11.1–M11.2). */
export const stoneCount = (/** @type {number} */ ticks, /** @type {Record<string, any>} */ P) => {
  const G = P.group, per = Math.max(1, Math.round(G.stoneSeconds / P.step));
  return Math.min(G.maxStones, G.minStones + Math.floor(ticks / per));
};

/** O ponto (círculo de raio r) está livre? Dentro da arena e fora de paredes, barreiras e lutadores (M26s.5, M27.3). */
function free(/** @type {any} */ game, /** @type {{x: number, z: number}} */ p, /** @type {number} */ r, /** @type {number} */ halfExtent) {
  const bound = C.test.arenaHalf - r;
  if (Math.abs(p.x) > bound || Math.abs(p.z) > bound) return false;
  for (const e of game.world.entities) {
    if (e.dead || e.shape !== 'box' || (e.kind !== 'wall' && e.kind !== 'barrier')) continue;
    if (closestOnShape(e, p).distance < r) return false;
  }
  for (const o of game.fighters) {
    if (o.hp <= 0) continue;
    if (closestOnShape({shape: 'box', pos: o.position, hx: halfExtent, hz: halfExtent, angle: 0}, p).distance < r) return false;
  }
  return true;
}

/**
 * Posições de partida das N pedras: um arco à frente do lançador (anéis e alturas variados, sorteados por semente) e, se alguma
 * não estiver livre, busca alternativa à frente dentro do alcance configurado (M27.3). `null` se faltar espaço (M29.3).
 * @returns {{x: number, z: number, y: number, scale: number}[] | null}
 */
export function stoneSlots(/** @type {any} */ game, /** @type {any} */ f, /** @type {Record<string, any>} */ P, /** @type {number} */ n, /** @type {number} */ heading, /** @type {() => number} */ rand) {
  const G = P.group, B = P.body, fwd = direction(heading), side = {x: fwd.z, z: -fwd.x}, arc = G.arc * Math.PI / 180, out = [];
  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : (i / (n - 1) - .5) * arc, ring = uniform(rand, G.ringMin, G.ringMax);
    const base = add(f.position, scale(direction(heading + off), ring)), y = uniform(rand, G.heightMin, G.heightMax), sc = uniform(rand, G.scaleMin, G.scaleMax);
    let spot = free(game, base, G.radius, B.halfExtent) ? base : null;
    for (let d = G.searchStep; !spot && d <= G.searchRange + 1e-9; d += G.searchStep) {
      for (const lat of [0, 1, -1, 2, -2]) {
        const p = add(add(base, scale(fwd, d)), scale(side, lat * G.searchStep));
        if (free(game, p, G.radius, B.halfExtent)) {spot = p;break;}
      }
    }
    if (!spot) return null;
    out.push({x: spot.x, z: spot.z, y, scale: sc});
  }
  return out;
}

/** Efeito de disparo (soltar o botão): cria as pedras ou falha com motivo (o jogo devolve a stamina e dissipa tudo). */
export function psyshockEffect(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const ch = fx.charge;
  if (!ch) return {ok: false, reason: 'semCarga'};
  const P = ch.params, G = P.group, B = P.body, n = stoneCount(ch.ticks, P), heading = fx.heading;
  if (game.world.entities.length + n > C.world.maxEntities) return {ok: false, reason: 'limiteDeEntidades'};
  const execId = game.world.nextId, rand = rng(hash32(game.tick, f.id, execId));
  const slots = stoneSlots(game, f, P, n, heading, rand);
  if (!slots) return {ok: false, reason: 'semEspaco'};
  const target = ch.lock != null && ch.lock !== f.id ? game.fighters[ch.lock] : null, locked = !!target && target.hp > 0;
  const fan = G.fanAngle * Math.PI / 180, base = G.damageFraction * f.attributes.attack;     // M30.1: 0,2 × Ataque gravado no disparo (P13: atributo-base, provisório)
  const aimHMin = G.aimHeightMin ?? .05, aimHMax = G.aimHeightMax ?? .95;
  (game.world.exec ??= {})[execId] = {owner: f.id, hits: {}, kb: {}};
  for (let i = 0; i < n; i++) {
    const s = slots[i], speed = uniform(rand, G.speedMin, G.speedMax);
    let dir, hSpeed = speed, vy = 0, homing = /** @type {any} */ (null);
    if (locked) {
      // Cada pedra mira um ponto sorteado dentro da caixa lógica do alvo (M30.8); o homing persegue esse mesmo ponto (0,3 s, 180°/s).
      const off = {x: uniform(rand, -B.halfExtent, B.halfExtent), z: uniform(rand, -B.halfExtent, B.halfExtent), y: uniform(rand, aimHMin * B.height, aimHMax * B.height)};
      const alt = (target.flight?.y ?? target.groundY ?? 0) + (target.vaultHeight ?? 0);
      const dx = target.position.x + off.x - s.x, dz = target.position.z + off.z - s.z, dy = alt + off.y - s.y, len3 = Math.hypot(dx, dy, dz) || 1e-9;
      dir = normalize({x: dx, z: dz});hSpeed = speed * Math.hypot(dx, dz) / len3;vy = speed * dy / len3;
      homing = {target: target.id, ticks: Math.round(G.homingSeconds / P.step), rate: G.homingRate * Math.PI / 180, offset: off};
    } else {
      // Sem alvo travado: leque discreto frontal (M26s.6), horizontal.
      dir = direction(heading + (n === 1 ? 0 : (i - (n - 1) / 2) * (fan / (n - 1))));
    }
    // Empurrão desta pedra: base × (1 + bônus por nível de PL acima do 1) × (1 + fator × (velocidade da pedra ÷ velocidade média − 1)). Padrões 0 = sem bônus.
    const kbH = G.knockbackPerStone * (1 + (G.knockbackLevelBonus ?? 0) * (ch.level - 1)) * (1 + (G.knockbackSpeedFactor ?? 0) * (speed / ((G.speedMin + G.speedMax) / 2) - 1));
    spawn(game.world, {
      kind: 'projectile', owner: f.id, pos: {x: s.x, z: s.z}, y: s.y, radius: G.radius, dir, speed: hSpeed, vy, life: Infinity, pierce: 1, blockedBy: ['barrier', 'wall'],
      hit: {damage: base, knockback: {horizontal: kbH, vertical: G.knockbackVertical ?? 0}}, pl: ch.level, clashable: true, exec: execId, homing, visualScale: s.scale,
      captured: {attackFraction: G.damageFraction, successiveFactor: G.successiveFactor, knockbackCap: G.knockbackCap, knockbackPerStone: G.knockbackPerStone, counterStagger: G.counterStagger, level: ch.level, move: def.id, speed},
    }, fx.events ?? []);
  }
  return {ok: true};
}

/** FICHA do Move (índice automático): definição e parâmetros vêm do psyshock.move.json. O registro continua em standard.js (Moves padrão, não «novos»). */
export const ficha = defineFicha({def: psyshockDef, effect: ['psyshock', psyshockEffect], params});
