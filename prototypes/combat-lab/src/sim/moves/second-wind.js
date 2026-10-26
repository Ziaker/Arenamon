// @ts-check
// Second Wind (Segundo Fôlego) — Normal · Status · sem PL (5_MOVES_GENERICOS_PROMPT §7). Cast de 0,35 s; ao concluir, 5 s de:
//   • regeneração extra de +40% da stamina MÁXIMA por segundo (MV-P09: o documento diz "+40%/s" sem base; adotada a capacidade máxima);
//   • esquiva (C) e sprint 25% mais baratos (atributo `mobilityCost` do status).
// Não recupera HP, não mexe em cooldowns, não dá invulnerabilidade; stagger não cancela o efeito; coexiste com Harden.
// Interrupção do cast: stamina e recarga já cobradas ficam, sem buff. Parâmetros: C.world.secondWind, capturados no início do uso (M28.4).
import {C} from '../config.js';
import {applyStatus} from '../status.js';
import {getFighterMaxStamina} from '../entity.js';
import {defineFicha} from './params-registry.js';
import {params, def as secondWindDef} from './second-wind.params.js';

export {secondWindDef};   // definição (id, fases, custo…) vem de second-wind.move.json

/** Passo de regeneração padrão (a cada 0,1 s) em pontos de stamina para um lutador com `staminaMax`. */
export const REGEN_TICK = .1;
export function secondWindStatus(P, staminaMax) {
  const interval = P.regenInterval ?? REGEN_TICK;
  return {
    id: 'second-wind', duration: P.duration, stacking: 'refresh', tags: ['buff', 'second-wind'],
    mul: {mobilityCost: 1 - P.mobilityCostPct},
    tick: {interval, stamina: P.regenPctPerSecond * staminaMax * interval},
  };
}
export function secondWindEffect(game, f, def, fx) {
  const P = fx.params ?? C.world.secondWind;
  applyStatus(f, /** @type {any} */ (secondWindStatus(P, getFighterMaxStamina(f))), {source: f.id});
  fx.events?.push({result: 'moveEffect', move: 'second-wind', attacker: f.id, target: f.id, damage: 0, status: 'second-wind', duration: P.duration});
}

/** FICHA do Move (ver harden.js): `params` gera o padrão em C.world.secondWind e os sliders; `def`/`effect` são registrados sozinhos. */
export const ficha = defineFicha({
  def: secondWindDef,
  effect: ['second-wind', secondWindEffect],
  params,
  ai: {kind: 'tap', p: .6, why: 'stamina baixa e rival longe: recupera', notStatus: 'second-wind', maxStamina: 1.3, distance: {min: 3}, forbids: ['tackling']},
});
