// @ts-check
// Emerging Stone (Mushroom, Move 1) — Normal · Field/Projectile virtual · sem PL (docs/MUSHROOM_MOVES_DECISOES.md §7; cronologia C = ES-D103).
// Pressionar INICIA já o cast físico de 0,55 s (o marcador de destino se ajusta enquanto o botão está segurado, de 3 a 10 m em distância 3D); só dispara quando o
// cast terminou E o botão foi solto com destino válido (soltar cedo completa o tempo; completar com o botão segurado espera a soltura). Stamina 3 e recarga 9 s só são
// cobradas nesse instante, antes do disparo (nada ao pressionar; sem reembolso depois). Durante o cast o corpo anda a 30%; depois do disparo fica livre para mover,
// atacar e defender. Pode começar no ar, mas precisa estar apoiado ao fim do cast e perder o apoio durante o cast cancela. A mecânica do projétil, da explosão e da
// rocha está em stone.js. Valores: C.world.emergingStone, capturados ao apertar (M28.4).
import {C} from '../config.js';
import {spawn} from '../world.js';
import {defineFicha} from './params-registry.js';
import {params, def as emergingStoneDef} from './emerging-stone.params.js';
import {stoneStep} from '../stone.js';

export {emergingStoneDef};   // definição (id, fases, custo…) vem de emerging-stone.move.json

/** Efeito do disparo: cria o projétil subterrâneo na posição real do lutador agora, rumo ao marcador confirmado. */
export function emergingStoneEffect(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const P = fx.params ?? C.world.emergingStone, m = fx.marker;
  if (!m) return {ok: false, reason: 'noMarker'};
  const from = {x: f.position.x, z: f.position.z, y: (f.groundY ?? 0) + (f.vaultHeight ?? 0)}, to = {x: m.pos.x, z: m.pos.z, y: m.y ?? 0};
  const total = Math.hypot(to.x - from.x, to.z - from.z, to.y - from.y);
  const e = spawn(game.world, {
    kind: 'burrow', owner: f.id, pos: {x: from.x, z: from.z}, from, to, total, travelled: 0, speed: P.speed, life: 120, params: structuredClone(P),
    damage: P.damage * f.attributes.attack / C.test.attackReference,   // MV-P13
    visual: 'burrow', captured: {move: def.id},
  }, fx.events ?? []);
  if (!e) return {ok: false, reason: 'entityLimit'};
}

/** FICHA do Move (ver docs/COMO_CRIAR_UM_MOVE.md): `params` gera o padrão em C.world.emergingStone e os sliders da aba Moves; `def` e os manipuladores são registrados sozinhos. */
export const ficha = defineFicha({
  // Quando a IA usa o Move (perfil declarativo, ver ai-profile.js): rival no chão a 3,8–6,4 m: cast e marcador nele.
  ai: {kind: 'aim', p: .2, why: 'rocha emergente no rival', mode: 'cast', distance: {min: 3.8, max: 6.4}, requires: ['tGround'], minStamina: 3},
  def: emergingStoneDef, effect: ['emerging-stone', emergingStoneEffect], steps: [['stone', stoneStep]],
  params,
});
