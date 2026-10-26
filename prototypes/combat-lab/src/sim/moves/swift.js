// @ts-check
// Swift (Estrelas Velozes) — Burst · Projectile · PL1 (catálogo de genéricos §3). Dispara 3 estrelas luminosas SEM carga, com homing curto e
// limitado. Reaproveita o motor de projéteis do Psyshock: contas por execução (`exec`), teto de knockback por alvo/execução, Clash/Counter de PL,
// reflexão pelo Reflect (dono troca, dano recalculado com o Ataque do refletor, sem duplicar). Valores: C.world.swift — PROPOSTAS do catálogo,
// capturadas ao iniciar o uso (M28.4). Dano "nominal": valor com o Ataque de referência (test.attackReference); final = nominal × Ataque ÷ referência (MV-P13).
import {spawn} from '../world.js';
import {direction, normalize} from '../math.js';
import {C} from '../config.js';
import {defineFicha} from './params-registry.js';
import {params, def as swiftDef} from './swift.params.js';
import {hash32, rng, uniform} from './rng.js';

export {swiftDef};   // definição (id, fases, custo…) vem de swift.move.json

/** Leque frontal sem lock-on e a abertura lateral das estrelas na saída. */
export const swiftSpread = (/** @type {number} */ i, /** @type {number} */ n, /** @type {number} */ fanRad) => n === 1 ? 0 : (i - (n - 1) / 2) * (fanRad / (n - 1));

export function swiftEffect(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const P = fx.params ?? C.world.swift, B = {halfExtent: C.test.halfExtent, height: C.extras.visual.bodyHeight}, step = C.test.step;
  const n = Math.max(1, Math.round(P.count));
  if (game.world.entities.length + n > C.world.maxEntities) return {ok: false, reason: 'limiteDeEntidades'};
  const execId = game.world.nextId, rand = rng(hash32(game.tick, f.id, execId)), heading = fx.heading;
  const fwd = direction(heading), side = {x: fwd.z, z: -fwd.x};
  const target = fx.lock != null && fx.lock !== f.id ? game.fighters[fx.lock] : null, locked = !!target && target.hp > 0;
  const damage = P.damage * f.attributes.attack / C.test.attackReference;       // MV-P13
  const baseY = P.originHeight ?? .65, stepY = P.heightStep ?? .15;
  (game.world.exec ??= {})[execId] = {owner: f.id, hits: {}, kb: {}};
  for (let i = 0; i < n; i++) {
    const lat = n === 1 ? 0 : (i - (n - 1) / 2) * P.spawnSpacing, y = baseY + (i % 2) * stepY;
    const pos = {x: f.position.x + fwd.x * P.spawnForward + side.x * lat, z: f.position.z + fwd.z * P.spawnForward + side.z * lat};
    let dir, hSpeed = P.speed, vy = 0, homing = /** @type {any} */ (null);
    if (locked) {
      // cada estrela mira um ponto sorteado dentro da caixa lógica do alvo; o homing (0,25 s, 90°/s) persegue o MESMO ponto
      const hMin = Math.min(P.aimHeightMin ?? .05, P.aimHeightMax ?? .95), hMax = Math.max(P.aimHeightMin ?? .05, P.aimHeightMax ?? .95);
      const off = {x: uniform(rand, -B.halfExtent, B.halfExtent), z: uniform(rand, -B.halfExtent, B.halfExtent), y: uniform(rand, hMin * B.height, hMax * B.height)};
      const alt = (target.flight?.y ?? target.groundY ?? 0) + (target.vaultHeight ?? 0);
      const dx = target.position.x + off.x - pos.x, dz = target.position.z + off.z - pos.z, dy = alt + off.y - y, len3 = Math.hypot(dx, dy, dz) || 1e-9;
      dir = normalize({x: dx, z: dz});hSpeed = P.speed * Math.hypot(dx, dz) / len3;vy = P.speed * dy / len3;
      homing = {target: target.id, ticks: Math.round(P.homingSeconds / step), rate: P.homingRate * Math.PI / 180, offset: off};
    } else dir = direction(heading + swiftSpread(i, n, P.fanAngle * Math.PI / 180));
    spawn(game.world, {
      kind: 'projectile', owner: f.id, pos, y, radius: P.radius, dir, speed: hSpeed, vy, life: P.range / P.speed, pierce: 1, blockedBy: ['barrier', 'wall'],
      hit: {damage, knockback: {horizontal: P.knockback, vertical: P.knockbackV ?? 0}}, pl: 1, clashable: true, exec: execId, homing, visualScale: 1, visual: 'star',
      captured: {attackFraction: P.damage / C.test.attackReference, successiveFactor: 1, knockbackCap: P.knockbackCap, knockbackPerStone: P.knockback, counterStagger: P.counterStagger, level: 1, move: def.id, speed: P.speed},
    }, fx.events ?? []);
  }
  return {ok: true};
}

/** FICHA do Move (ver docs/COMO_CRIAR_UM_MOVE.md): `params` gera o padrão em C.world.swift e os sliders da aba Moves. */
export const ficha = defineFicha({
  def: swiftDef, effect: ['swift', swiftEffect],
  params,
  ai: {kind: 'tap', p: .4, why: 'estrelas à distância', distance: {min: 3.5, max: 11}, requires: ['tGround']},
});
