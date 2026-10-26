// @ts-check
// Spikes (Armadilha de Espinhos) — Normal · Field · PL1 ofensivo (catálogo de genéricos §5). Segurar o botão abre o marcador de colocação (alcance 3D de 5 m),
// soltar confirma (válido: cobra 1 de stamina e 10 s de recarga e começa o cast de 0,4 s; inválido: cancela sem custo). Ao fim do cast nasce uma armadilha de
// 1,2 m de raio sobre o apoio escolhido (rampas e plataformas valem, nada de paredes, personagens ou vazio), que dura 8 s, causa 6 HP nominais (× Ataque ÷
// referência, MV-P13) UMA vez ao primeiro adversário que pisar nela, sem knockback, e some. Perder o apoio a remove sem efeito (MV-P05); o dano é comum para
// Sturdy. A entidade e a regra de acionamento estão em trap.js. Valores: C.world.spikes, capturados ao abrir o marcador (M28.4).
import {C} from '../config.js';
import {spawn} from '../world.js';
import {markerValidity} from '../aim-marker.js';
import {defineFicha} from './params-registry.js';
import {params, def as spikesDef} from './spikes.params.js';

export {spikesDef};   // definição (id, fases, custo…) vem de spikes.move.json

/** Efeito do fim do cast: confere de novo o local fixado e cria a armadilha. */
export function spikesEffect(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const P = fx.params ?? C.world.spikes, m = fx.marker;
  if (!m) return {ok: false, reason: 'noMarker'};
  const v = markerValidity(f, {...P, range: Infinity, minRange: 0}, m.pos, game.world, game.fighters);
  if (!v.valid) return {ok: false, reason: 'invalidPlacement', detail: {why: v.reason}};
  const damage = P.damage * f.attributes.attack / C.test.attackReference;   // MV-P13
  const e = spawn(game.world, {
    kind: 'trap', owner: f.id, pos: {...m.pos}, y: v.y, radius: P.radius, height: P.trapHeight, life: P.life, armDelay: P.armDelay, support: true, supportTolerance: P.supportTolerance ?? .06,
    hit: {damage, knockback: {horizontal: P.knockbackH, vertical: P.knockbackV}}, pl: P.trapPl ?? 1, visual: 'spikes', captured: {move: def.id},
  }, fx.events ?? []);
  if (!e) return {ok: false, reason: 'entityLimit'};
}

/** FICHA do Move (ver docs/COMO_CRIAR_UM_MOVE.md): `params` gera o padrão em C.world.spikes e os sliders da aba Moves; `def` e os manipuladores são registrados sozinhos. */
export const ficha = defineFicha({
  // Quando a IA usa o Move (perfil declarativo, ver ai-profile.js): rival no chão a 3–8 m: marcador no caminho dele.
  ai: {kind: 'aim', p: .22, why: 'armadilha no caminho do rival', mode: 'absolute', distance: {min: 3, max: 8}, requires: ['tGround'], minStamina: 1.5},
  def: spikesDef, effect: ['spikes', spikesEffect],
  params,
});
