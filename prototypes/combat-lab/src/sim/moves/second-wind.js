// @ts-check
// Second Wind (Segundo Fôlego) — Normal · Status · sem PL (5_MOVES_GENERICOS_PROMPT §7). Cast de 0,35 s; ao concluir, 5 s de:
//   • regeneração extra de +40% da stamina MÁXIMA por segundo (MV-P09: o documento diz "+40%/s" sem base; adotada a capacidade máxima);
//   • esquiva (C) e sprint 25% mais baratos (atributo `mobilityCost` do status).
// Não recupera HP, não mexe em cooldowns, não dá invulnerabilidade; stagger não cancela o efeito; coexiste com Harden.
// Interrupção do cast: stamina e recarga já cobradas ficam, sem buff. Parâmetros: C.world.secondWind, capturados no início do uso (M28.4).
import {C} from '../config.js';
import {applyStatus} from '../status.js';
import {getFighterMaxStamina} from '../entity.js';

export const secondWindDef = Object.freeze({
  id: 'second-wind', name: 'Second Wind', air: 'cast', group: 'secondWind',
  description: 'Por 5 s regenera stamina bem mais rápido (+40% da máxima por segundo) e gasta 25% menos em esquiva e sprint. Não cura HP. Cast de 0,35 s.',
  cost: .8, cooldown: 12, duration: .35, aim: 'facing',
  timeline: [{at: .35, atKey: 'cast', effect: 'second-wind'}],
});

/** Passo de regeneração (a cada 0,1 s) em pontos de stamina para um lutador com `staminaMax`. */
export const REGEN_TICK = .1;
export function secondWindStatus(P, staminaMax) {
  return {
    id: 'second-wind', duration: P.duration, stacking: 'refresh', tags: ['buff', 'second-wind'],
    mul: {mobilityCost: 1 - P.mobilityCostPct},
    tick: {interval: REGEN_TICK, stamina: P.regenPctPerSecond * staminaMax * REGEN_TICK},
  };
}
export function secondWindEffect(game, f, def, fx) {
  const P = fx.params ?? C.world.secondWind;
  applyStatus(f, /** @type {any} */ (secondWindStatus(P, getFighterMaxStamina(f))), {source: f.id});
  fx.events?.push({result: 'moveEffect', move: 'second-wind', attacker: f.id, target: f.id, damage: 0, status: 'second-wind', duration: P.duration});
}
