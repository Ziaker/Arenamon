// @ts-check
// Water Pulse — Charge · Projectile · PL1/PL2/PL3 pela carga (protótipo de 23/10/2026; números do prompt de 22/10, NÃO homologados). Segurar carrega até 1,5 s
// (PL2 em 90 passos, PL3 em 180); soltar dispara UM projétil hidráulico reto, sem homing, que acerta o primeiro corpo. Custo e recarga na ATIVAÇÃO da carga
// (`cooldownOnStart`, norma universal). Decisões provisórias da Rodada 1 (WP-P08 A: o projétil sai no passo da soltura; EL-P04 A: knockback horizontal com vertical 0
// é o empurrão do motor, 1,5 × H m). A direção 3D e o alvo travado são capturados NA SOLTURA. Valores: C.world.waterPulse, capturados ao apertar (M28.4).
import {C} from '../config.js';
import {spawn} from '../world.js';
import {direction} from '../math.js';
import {emitterAltitude, spawnPoint, spawnBlocked, straightLaunch, bodyHeight} from './projectile-util.js';
import {defineFicha} from './params-registry.js';
import {params} from './water-pulse.params.js';

export const waterPulseDef = Object.freeze({
  id: 'water-pulse', name: 'Water Pulse', air: 'cast', group: 'waterPulse', cooldownOnStart: true,
  description: 'Charge · Projectile. Segure para carregar (até 1,5 s), solte para disparar uma esfera de água reta, sem homing. Mais carga = mais PL, dano e empurrão.',
  cost: 1, cooldown: 9, charge: {max: 1.5, group: 'waterPulse'},
  timeline: [{effect: 'water-pulse'}],
});

/** Efeito da soltura: cria o projétil (ou falha com reembolso se o ponto de nascimento estiver num sólido). */
export function waterPulseEffect(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const ch = fx.charge;
  if (!ch) return {ok: false, reason: 'semCarga'};
  const P = ch.params.group ?? C.world.waterPulse, level = ch.level, dt = C.test.step;
  if (game.world.entities.length + 1 > C.world.maxEntities) return {ok: false, reason: 'limiteDeEntidades'};
  const fwd = direction(fx.heading), y0 = emitterAltitude(f) + P.originHeight, pos = spawnPoint(f, fwd, P.spawnForward);
  if (spawnBlocked(game, pos, y0, P.radius)) return {ok: false, reason: 'semEspaco'};   // WP-P05: sem espaço, falha com reembolso (nada de teletransporte)
  const foe = ch.lock != null && ch.lock !== f.id ? game.fighters[ch.lock] : null, locked = !!foe && foe.hp > 0;
  let dir = fwd, hSpeed = P.speed, vy = 0;
  if (locked) {   // com alvo travado na soltura: direção 3D até o centro do corpo, velocidade escalar constante
    const aim = straightLaunch(pos, y0, foe.position, emitterAltitude(foe) + bodyHeight() / 2, P.speed, fwd);
    dir = aim.dir;hSpeed = aim.hSpeed;vy = aim.vy;
  }
  const nominal = [P.damagePl1, P.damagePl2, P.damagePl3][level - 1], kbH = [P.knockbackPl1, P.knockbackPl2, P.knockbackPl3][level - 1];
  const damage = nominal * f.attributes.attack / C.test.attackReference;   // MV-P13: nominal × Ataque ÷ referência, gravado no disparo (o Ataque não entra de novo no acerto)
  const e = spawn(game.world, {
    kind: 'projectile', owner: f.id, pos, y: y0, radius: P.radius, dir, speed: hSpeed, vy, life: P.range / P.speed + dt * .5, pierce: 1, blockedBy: ['barrier', 'wall'],
    hit: {damage, knockback: {horizontal: kbH, vertical: P.knockbackV ?? 0}}, pl: level, clashable: true, visual: 'waterorb', visualScale: 1 + (level - 1) * .25,
    captured: {attackFraction: nominal / C.test.attackReference, successiveFactor: 1, level, move: def.id, speed: P.speed, counterStagger: P.counterStagger},
  }, fx.events ?? []);
  if (!e) return {ok: false, reason: 'entityLimit'};
  fx.events?.push({result: 'moveEffect', move: 'water-pulse', attacker: f.id, target: null, damage: 0, level, entity: e.id});
}

/** FICHA do Move (ver docs/COMO_CRIAR_UM_MOVE.md): `params` gera o padrão em C.world.waterPulse e os sliders da aba Moves; `def` e os manipuladores são registrados sozinhos. */
export const ficha = defineFicha({
  def: waterPulseDef, effect: ['water-pulse', waterPulseEffect],
  params,
});
