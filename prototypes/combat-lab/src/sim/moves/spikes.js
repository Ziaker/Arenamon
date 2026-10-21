// @ts-check
// Spikes (Armadilha de Espinhos) — Normal · Field · PL1 ofensivo (catálogo de genéricos §5). Segurar o botão abre o marcador de colocação (alcance 3D de 5 m),
// soltar confirma (válido: cobra 1 de stamina e 10 s de recarga e começa o cast de 0,4 s; inválido: cancela sem custo). Ao fim do cast nasce uma armadilha de
// 1,2 m de raio sobre o apoio escolhido (rampas e plataformas valem, nada de paredes, personagens ou vazio), que dura 8 s, causa 6 HP nominais (× Ataque ÷
// referência, MV-P13) UMA vez ao primeiro adversário que pisar nela, sem knockback, e some. Perder o apoio a remove sem efeito (MV-P05); o dano é comum para
// Sturdy. A entidade e a regra de acionamento estão em trap.js. Valores: C.world.spikes, capturados ao abrir o marcador (M28.4).
import {C} from '../config.js';
import {spawn} from '../world.js';
import {markerValidity} from '../aim-marker.js';

export const spikesDef = Object.freeze({
  id: 'spikes', name: 'Spikes', group: 'spikes', aimMode: 'marker', aim: 'facing',
  description: 'Normal · Field. Segure para escolher o local (até 5 m), solte para confirmar: nasce uma armadilha de espinhos que fere o primeiro adversário que pisar nela.',
  cost: 1, cooldown: 10, duration: .4, motion: {type: 'root'},
  timeline: [{at: .4, atKey: 'cast', effect: 'spikes'}],
});

/** Efeito do fim do cast: confere de novo o local fixado e cria a armadilha. */
export function spikesEffect(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const P = fx.params ?? C.world.spikes, m = fx.marker;
  if (!m) return {ok: false, reason: 'noMarker'};
  const v = markerValidity(f, {...P, range: Infinity, minRange: 0}, m.pos, game.world, game.fighters);
  if (!v.valid) return {ok: false, reason: 'invalidPlacement', detail: {why: v.reason}};
  const damage = P.damage * f.attributes.attack / C.test.attackReference;   // MV-P13
  const e = spawn(game.world, {
    kind: 'trap', owner: f.id, pos: {...m.pos}, y: v.y, radius: P.radius, height: P.trapHeight, life: P.life, armDelay: P.armDelay, support: true,
    hit: {damage, knockback: {horizontal: P.knockbackH, vertical: P.knockbackV}}, pl: 1, visual: 'spikes', captured: {move: def.id},
  }, fx.events ?? []);
  if (!e) return {ok: false, reason: 'entityLimit'};
}
