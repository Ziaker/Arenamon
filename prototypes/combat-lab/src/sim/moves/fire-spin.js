// @ts-check
// Fire Spin — Normal · Field (protótipo de 23/10/2026; números do prompt de 22/10, NÃO homologados). Segurar abre o marcador de colocação (alcance 3D 5 m), soltar confirma
// (válido: cobra stamina e recarga e começa o cast; inválido: cancela sem custo). No fim do cast, e depois de revalidar o local, nasce uma ZONA cilíndrica sobre o apoio
// escolhido que dá PULSOS de dano (4, um a cada 0,6 s). Sem knockback, sem queimadura, sem prisão. Decisões provisórias da Rodada 1: FS-P07 A (os pulsos não aplicam guard stun
// por padrão: quem defende toma o dano reduzido e fica livre) e FS-P01 A (os pulsos não fazem Clash/Counter). Perder o apoio remove a zona; paredes ocluem os pulsos (XZ).
// Valores: C.world.fireSpin, capturados ao abrir o marcador (M28.4).
import {C} from '../config.js';
import {spawn} from '../world.js';
import {markerValidity} from '../aim-marker.js';

export const fireSpinDef = Object.freeze({
  id: 'fire-spin', name: 'Fire Spin', air: 'cast', group: 'fireSpin', aimMode: 'marker', aim: 'facing',
  description: 'Normal · Field. Segure para escolher o local (até 5 m), solte para confirmar: nasce um tornado de fogo que dá 4 pulsos de dano a quem estiver dentro. Não prende nem empurra.',
  cost: 1, cooldown: 11, duration: .6, durationKeys: ['cast', 'recovery'], motion: {type: 'root'},
  timeline: [{at: .4, atKeys: ['cast'], effect: 'fire-spin'}],
});

/** Efeito do fim do cast: revalida o local (como o Spikes), respeita o limite de zonas por dono e cria a zona. */
export function fireSpinEffect(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const P = fx.params ?? C.world.fireSpin, m = fx.marker;
  if (!m) return {ok: false, reason: 'noMarker'};
  const v = markerValidity(f, {...P, range: Infinity, minRange: 0}, m.pos, game.world, game.fighters);
  if (!v.valid) return {ok: false, reason: 'invalidPlacement', detail: {why: v.reason}};
  const mine = game.world.entities.filter((/** @type {any} */ e) => !e.dead && e.kind === 'area' && e.visual === 'firespin' && e.owner === f.id);
  while (mine.length >= Math.max(1, Math.round(P.maxActive))) {const old = mine.shift();old.dead = true;(fx.events ?? []).push({result: 'fieldReplaced', attacker: f.id, target: null, damage: 0, entity: old.id, kind: 'area'});}   // FS-P04: por padrão 1 zona por dono (a nova substitui a antiga)
  const pulses = Math.max(1, Math.min(Math.round(P.pulses), Math.floor((P.life - 1e-6) / Math.max(1e-3, P.interval)) + 1));   // o último pulso precisa cair antes da expiração
  const damage = P.damage * f.attributes.attack / C.test.attackReference;   // MV-P13
  const e = spawn(game.world, {
    kind: 'area', owner: f.id, pos: {...m.pos}, y: v.y, radius: P.zoneRadius, height: P.zoneHeight, life: P.life, pulses, interval: P.interval, falloff: 'none',
    hit: {damage, knockback: {horizontal: 0, vertical: 0}, guardStun: P.guardStun}, support: true, occlusion: P.occlusion ? 1 : 0, pl: 1, visual: 'firespin', captured: {move: def.id},
  }, fx.events ?? []);
  if (!e) return {ok: false, reason: 'entityLimit'};
}
