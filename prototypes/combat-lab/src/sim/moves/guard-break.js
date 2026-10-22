// @ts-check
// Guard Break (Quebra de Guarda) — Charge · Melee · PL1/PL2/PL3 (5_MOVES_GENERICOS_PROMPT §4). Segurar o botão carrega (até 1 s); soltar executa UM Tackle real
// (`def.tackle`) cujo PL vem da carga: PL1 abaixo de 50%, PL2 de 50% até antes de 100%, PL3 na carga máxima. Custo de stamina E recarga são cobrados quando a carga
// é ativada (regra Charge): interromper a carga mantém os dois. O golpe usa colisão, defesa, i-frames e Clash/Counter do Tackle; o que é específico daqui é
// `action.guardBreak = {stun}`, lido por resolveHit: contra GUARDA COMUM o defensor perde a guarda e leva guard stun (0,5 s) sem empurrão e o atacante segue o golpe
// (não recua); contra defesa PERFEITA anula dano e stun (GM-P05, proposta) e o atacante recua como num Tackle; sem guarda: dano e 2 m/s H como qualquer golpe.
// Harden anula o knockback mas NÃO o guard stun (GM-P06, proposta). Valores: C.world.guardBreak, capturados ao apertar o botão (M28.4).
import {C} from '../config.js';
import {nominalDistance} from '../entity.js';

export const guardBreakDef = Object.freeze({
  id: 'guard-break', name: 'Guard Break', air: 'descend', group: 'guardBreak', tackle: 'guard-break',
  description: 'Charge. Segure para carregar (até 1 s, PL1/PL2/PL3), solte para um golpe pesado que derruba a guarda de quem defende e causa guard stun de 0,5 s.',
  cost: 1, cooldown: 10, charge: {max: 1, group: 'guardBreak'}, duration: .7,
});

/** Preparação do Tackle do golpe, com os parâmetros congelados no início da carga e o nível de PL da soltura. */
export function guardBreakSetup(/** @type {any} */ f, /** @type {any} */ a, /** @type {Record<string, any>} */ P, /** @type {{charge?: {level: number}}} */ ctx) {
  const p = C.actions.tackle, step = C.test.step, nominal = nominalDistance(f, 'tackle');
  a.pl = ctx.charge?.level ?? 1;
  a.durationScale = P.cast / p.duration;
  a.distanceScale = P.range / Math.max(1e-6, nominal);
  a.plDamage = P.damage / C.test.attackReference;                 // MV-P13: o dano não cresce com o PL (o PL só decide disputas)
  a.kb = {horizontal: P.knockbackH, vertical: P.knockbackV};
  a.invulnerableFor = P.invulnerableSeconds;
  a.chainAfter = P.chainAfter;
  a.keepOnBlock = true;                                           // guarda comum: o golpe segue; defesa perfeita ainda faz o atacante recuar (resolveHit)
  a.guardBreak = {stun: P.stun};
  const toStep = (/** @type {number} */ t) => Math.round(t / step);
  a.combatWindows = {activeWindows: [[toStep(P.hitStart), Math.max(toStep(P.hitStart) + 1, toStep(P.hitEnd))]], invulnerabilityWindows: P.invulnerableSeconds > 0 ? [[0, toStep(P.invulnerableSeconds)]] : []};
  a.hitWindows = [new Set()];
}
