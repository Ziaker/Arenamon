// @ts-check
// Dividido de world.js (comportamento idêntico): world-schema.

import {length} from '../math.js';

export const ENTITY_KINDS = ['projectile', 'barrier', 'wall', 'area', 'beam', 'trap', 'sandwave', 'burrow'];
// ---------- Criação ----------
export const DEFAULTS = {
  projectile: {shape: 'circle', radius: .25, y: .65, height: 0, speed: 12, life: 2, pierce: 1, blockedBy: ['barrier', 'wall'], hitsOwner: false},
  barrier: {shape: 'box', hx: .9, hz: .15, y: 0, height: 1.8, life: 3, hp: Infinity, blocksProjectiles: true, blocksFighters: false, blocksOwner: false},
  wall: {shape: 'box', hx: 1.5, hz: .3, y: 0, height: 2.2, life: Infinity, blocksProjectiles: true, blocksFighters: true},
  beam: {y: .9, life: 2, length: 24, width: .04, pl: 1, interval: .25, turn: 0, hitsOwner: false, hit: {damage: 0}},
  area: {shape: 'circle', radius: 2, y: 0, height: 2, life: .3, grow: 0, pulses: 1, interval: 0, startup: 0, falloff: 'none', affectsOwner: false, follow: false},
  burrow: {shape: 'circle', radius: 0, y: 0, height: 0, life: 120},
  sandwave: {shape: 'box', y: 0, height: .35, life: 1.5, active: .75},
  trap: {shape: 'circle', radius: 1.2, y: 0, height: 1.2, life: 8, armDelay: 0, pl: 1, support: true, affectsOwner: false},
};
/** Valida um modelo de entidade (lança erro legível). */
export function validateEntity(t) {
  if (!ENTITY_KINDS.includes(t?.kind)) throw new Error(`entidade de tipo desconhecido (${t?.kind})`);
  if (t.shape && !['circle', 'box'].includes(t.shape)) throw new Error(`forma desconhecida (${t.shape})`);
  if (t.hit && t.hit.damage !== undefined && !(t.hit.damage >= 0)) throw new Error('dano inválido');
  return true;
}
