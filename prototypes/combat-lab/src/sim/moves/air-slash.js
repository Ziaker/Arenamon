// @ts-check
// Air Slash — Burst · Projectile · PL1 fixo (protótipo de 23/10/2026; números do prompt de 22/10, NÃO homologados). Toque: stamina e recarga na pressão (Burst, MV-P11);
// startup de 8 passos sem hitbox; no passo 8 nasce UMA lâmina de ar reta, sem homing, que não persegue (a mira com alvo travado é capturada NA PRESSÃO). Recovery de 20 passos.
// Decisões provisórias da Rodada 1: AS-P02 A (colisor = círculo equivalente, raio 0,6; a caixa 1,20×0,70×0,22 é só o desenho); EL-P04 A (knockback horizontal com vertical 0 = empurrão
// do motor); sem espaço no ponto de nascimento (sólido), a lâmina se dissipa: o Burst é gasto sem efeito (sem reembolso, como a Feint fora da janela). Valores: C.world.airSlash, capturados ao apertar (M28.4).
import {C} from '../config.js';
import {spawn} from '../world.js';
import {direction} from '../math.js';
import {emitterAltitude, spawnPoint, spawnBlocked, straightLaunch} from './projectile-util.js';
import {defineFicha} from './params-registry.js';
import {params, def as airSlashDef} from './air-slash.params.js';

export {airSlashDef};   // definição (id, fases, custo…) vem de air-slash.move.json

export function airSlashEffect(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const P = fx.params ?? C.world.airSlash, dt = C.test.step;
  if (game.world.entities.length + 1 > C.world.maxEntities) return {ok: false, reason: 'limiteDeEntidades'};
  const fwd = direction(fx.heading), y0 = emitterAltitude(f) + P.originHeight, pos = spawnPoint(f, fwd, P.spawnForward);
  if (spawnBlocked(game, pos, y0, P.radius)) return {ok: false, reason: 'semEspaco'};
  let dir = fwd, hSpeed = P.speed, vy = 0;
  if (fx.aimAt) {const aim = straightLaunch(pos, y0, fx.aimAt, fx.aimAt.y, P.speed, fwd);dir = aim.dir;hSpeed = aim.hSpeed;vy = aim.vy;}   // ponto do alvo capturado no toque
  const damage = P.damage * f.attributes.attack / C.test.attackReference;   // MV-P13
  const e = spawn(game.world, {
    kind: 'projectile', owner: f.id, pos, y: y0, radius: P.radius, dir, speed: hSpeed, vy, life: P.range / P.speed + dt * .5, pierce: 1, blockedBy: ['barrier', 'wall'],
    hit: {damage, knockback: {horizontal: P.knockbackH, vertical: P.knockbackV ?? 0}}, pl: 1, clashable: true, visual: 'airslash',
    captured: {attackFraction: P.damage / C.test.attackReference, successiveFactor: 1, level: 1, move: def.id, speed: P.speed, counterStagger: P.counterStagger, w: P.visualWidth, h: P.visualHeight, t: P.visualThickness},
  }, fx.events ?? []);
  if (!e) return {ok: false, reason: 'entityLimit'};
  fx.events?.push({result: 'moveEffect', move: 'air-slash', attacker: f.id, target: null, damage: 0, level: 1, entity: e.id});
}

/** FICHA do Move (ver docs/COMO_CRIAR_UM_MOVE.md): `params` gera o padrão em C.world.airSlash e os sliders da aba Moves; `def` e os manipuladores são registrados sozinhos. */
export const ficha = defineFicha({
  // Quando a IA usa o Move (perfil declarativo, ver ai-profile.js): rival a 3–9,5 m e de frente.
  ai: {kind: 'tap', p: .4, why: 'lâmina de ar à distância', distance: {min: 3, max: 9.5}, requires: ['facing'], minStamina: 1.2},
  def: airSlashDef, effect: ['air-slash', airSlashEffect],
  params,
});
