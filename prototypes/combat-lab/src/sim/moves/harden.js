// @ts-check
// Harden (Endurecimento) — Normal · Status · sem PL (catálogo de genéricos §4). Cast de 0,35 s e, ao concluir, status de 5 s:
// +30% de Defesa (dano recebido × 1/(1+0,30), a MESMA convenção da passiva de Defesa, MV-P01) e knockback ofensivo recebido = 0.
// Não dá invulnerabilidade, não elimina hit stun nem guard stun, não segura no ar nem atravessa sólidos: o status só zera o multiplicador
// `knockbackTaken` (lido por resolveHit e applyHit); queda, gravidade, wall-splat e correção de penetração continuam normais.
// O empurrão FÍSICO de corpo (o atacante continua o dash e empurra o corpo do alvo por contato) NÃO é knockback e permanece (MV-P12).
// Interrupção do cast antes de concluir: sem status, stamina e recarga já cobradas ficam (sem reembolso). Parâmetros: C.world.harden,
// capturados no início do uso (M28.4). Fonte: docs/MOVES_GENERICOS_CATALOGO.md; pendência MV-P03 (empurrões contínuos de Fields: NÃO negados).
import {C} from '../config.js';
import {applyStatus} from '../status.js';

export const hardenDef = Object.freeze({
  id: 'harden', name: 'Harden', air: 'cast', group: 'harden',
  description: 'Endurece o corpo por 5 s: +30% de Defesa e nenhum knockback ofensivo (o dano e o stun continuam). Cast de 0,35 s.',
  cost: .8, cooldown: 10, duration: .35, aim: 'facing',
  timeline: [{at: .35, atKey: 'cast', effect: 'harden'}],
});

/** Status resultante dos parâmetros capturados (puro: serve ao efeito, à prévia e aos testes). */
export function hardenStatus(P) {
  return {
    id: 'harden', duration: P.duration, stacking: 'refresh', tags: ['buff', 'harden'],
    mul: {damageTaken: 1 / (1 + P.defensePct), knockbackTaken: P.negateKnockback ? 0 : 1},
  };
}
/** Efeito do fim do cast: aplica o status em si mesmo. */
export function hardenEffect(game, f, def, fx) {
  const P = fx.params ?? C.world.harden;
  applyStatus(f, hardenStatus(P), {source: f.id});
  fx.events?.push({result: 'moveEffect', move: 'harden', attacker: f.id, target: f.id, damage: 0, status: 'harden', duration: P.duration});
}
