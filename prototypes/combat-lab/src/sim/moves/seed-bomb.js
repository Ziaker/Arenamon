// @ts-check
// Seed Bomb — Normal · Projectile + Field instantâneo (protótipo de 23/10/2026; números do prompt de 22/10, NÃO homologados; substitui o Power Whip). Segurar abre o marcador
// (alcance 3D 8 m, com apoio sólido sob o destino), soltar confirma: stamina e recarga na confirmação, cast de 0,3 s e, no fim dele, uma semente é lançada em ARCO BALÍSTICO real
// (tempo de voo e gravidade configuráveis) rumo ao marcador. Ao tocar um corpo ou uma superfície ela detona UMA vez (M22.7): explosão ESFÉRICA 3D de 1,8 m, com oclusão por
// paredes, dano único por alvo e empurrão radial. A semente em si não causa dano. Destino que exigiria mais que a velocidade máxima FALHA com reembolso (sem corrigir a trajetória em
// silêncio). Reflexão: o dono da explosão e o dano passam a ser os de quem refletiu. Decisões provisórias da Rodada 1: SB-P04 B (esfera 3D) e FS-P01/SB-P09 A (sem Clash de área).
import {C} from '../config.js';
import {spawn} from '../world.js';
import {direction, normalize, length, sub} from '../math.js';
import {markerValidity} from '../aim-marker.js';
import {emitterAltitude, spawnPoint, spawnBlocked} from './projectile-util.js';
import {defineFicha} from './params-registry.js';
import {params} from './seed-bomb.params.js';

export const seedBombDef = Object.freeze({
  id: 'seed-bomb', name: 'Seed Bomb', air: 'cast', group: 'seedBomb', aimMode: 'marker', aim: 'facing',
  description: 'Normal · Projectile + Field. Segure para escolher o local (até 8 m), solte para confirmar: uma semente voa em arco e explode ao tocar algo, num raio esférico de 1,8 m.',
  cost: 1, cooldown: 8, duration: .5, durationKeys: ['cast', 'recovery'], motion: {type: 'root'},
  timeline: [{at: .3, atKeys: ['cast'], effect: 'seed-bomb'}],
});

/**
 * Velocidade inicial do arco: tempo de voo T fixo, gravidade g. A integração do motor é Euler semi-implícita (a velocidade vertical é atualizada antes da posição), então
 * a posição final fica ½·g·T·dt abaixo da fórmula contínua; a correção entra aqui (erro de pouso medido ≤ 0,05 m).
 */
export function ballisticLaunch(/** @type {number} */ dist, /** @type {number} */ dh, /** @type {number} */ T, /** @type {number} */ g, /** @type {number} */ dt = C.test.step) {
  const vh = dist / T, vy = (dh + .5 * g * T * T + .5 * g * T * dt) / T;
  return {vh, vy, speed: Math.hypot(vh, vy)};
}

export function seedBombEffect(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const P = fx.params ?? C.world.seedBomb, m = fx.marker;
  if (!m) return {ok: false, reason: 'noMarker'};
  const v = markerValidity(f, {...P, range: Infinity, minRange: 0}, m.pos, game.world, game.fighters);
  if (!v.valid) return {ok: false, reason: 'invalidPlacement', detail: {why: v.reason}};
  if (game.world.entities.length + 1 > C.world.maxEntities) return {ok: false, reason: 'limiteDeEntidades'};
  const toMarker = sub(m.pos, f.position), flat = length(toMarker), dir = flat > 1e-6 ? normalize(toMarker) : direction(fx.heading);
  const y0 = emitterAltitude(f) + P.originHeight, pos = spawnPoint(f, dir, P.spawnForward);
  if (spawnBlocked(game, pos, y0, P.seedRadius)) return {ok: false, reason: 'semEspaco'};
  // Altura do CENTRO da semente no pouso: o motor detecta o chão pelo centro (y ≤ 0) e uma plataforma pelo raio (y − r ≤ topo); mirar o raio no chão faria pousar ≈0,4 m além.
  const landY = v.y > 1e-6 ? v.y + P.seedRadius : 0;
  const dist = Math.hypot(m.pos.x - pos.x, m.pos.z - pos.z), dh = landY - y0, shot = ballisticLaunch(dist, dh, P.flightTime, P.gravity);
  if (shot.speed > P.maxSpeed + 1e-9) return {ok: false, reason: 'tooFar', detail: {needed: shot.speed, max: P.maxSpeed}};
  const damage = P.damage * f.attributes.attack / C.test.attackReference;   // MV-P13: gravado no disparo; reflexão o recalcula com o Ataque do refletor
  const e = spawn(game.world, {
    kind: 'projectile', owner: f.id, pos, y: y0, radius: P.seedRadius, dir, speed: shot.vh, vy: shot.vy, gravity: P.gravity, life: P.lifetime, pierce: 1, blockedBy: ['barrier', 'wall'],
    hit: {damage: 0}, detonateOnly: true, pl: 1, clashable: true, visual: 'seed',
    captured: {explosionFraction: P.damage / C.test.attackReference, level: 1, move: def.id, speed: shot.speed, counterStagger: P.counterStagger},
    onHit: {kind: 'area', sphere: true, radius: P.explosionRadius, life: P.blastLife, pulses: 1, falloff: 'none', explosion: true, occlusion: P.occlusion ? 1 : 0, pl: 1, visual: 'seedblast',
      hit: {damage, knockback: {horizontal: P.knockbackH, vertical: P.knockbackV}}},
  }, fx.events ?? []);
  if (!e) return {ok: false, reason: 'entityLimit'};
  fx.events?.push({result: 'moveEffect', move: 'seed-bomb', attacker: f.id, target: null, damage: 0, level: 1, entity: e.id, speed: shot.speed});
}

/** FICHA do Move (ver docs/COMO_CRIAR_UM_MOVE.md): `params` gera o padrão em C.world.seedBomb e os sliders da aba Moves; `def` e os manipuladores são registrados sozinhos. */
export const ficha = defineFicha({
  def: seedBombDef, effect: ['seed-bomb', seedBombEffect],
  params,
});
