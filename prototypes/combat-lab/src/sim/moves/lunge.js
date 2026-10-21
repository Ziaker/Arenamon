// @ts-check
// Lunge (Investida Rápida) — Burst · Melee · PL1 (5_MOVES_GENERICOS_PROMPT §3, proposta). Um Tackle de curta distância sem retorno: o Move vira uma AÇÃO DE
// TACKLE real (`def.tackle`), então colisão, defesa parcial/perfeita, i-frames do alvo, Clash/Counter (PL1 empata com Tackle PL1), janelas e recuperação
// são as do Tackle; esta preparação só ajusta duração, distância, dano, knockback e janelas. Valores: C.world.lunge, capturados no início do uso (M28.4).
// Decisões: dano nominal 8 HP @ Ataque de referência (MV-P13); knockback 4 m/s H / 0 V = empurrão deslizante (V = 0 não lança); i-frames 0,133 s (16 passos,
// janela da proposta, MV-P10); janela ativa recalculada por proporção das fases (o documento-fonte erra a conversão g→passos, ver REGRAS_CRIACAO_MOVES §22.1).
import {C} from '../config.js';
import {nominalDistance} from '../entity.js';

export const lungeDef = Object.freeze({
  id: 'lunge', name: 'Lunge', group: 'lunge', tackle: 'lunge',
  description: 'Burst. Avança em linha reta até 3,5 m aplicando um Tackle curto (PL1) e fica onde parou. Dano 8, empurrão de 4 m/s sem lançar.',
  cost: .75, cooldown: 6, duration: .6, aim: 'target',
});

/** Prepara a ação de Tackle do Lunge com os parâmetros capturados. */
export function lungeSetup(/** @type {any} */ f, /** @type {any} */ a, /** @type {Record<string, any>} */ P) {
  const p = C.actions.tackle, step = C.test.step, nominal = nominalDistance(f, 'tackle');
  a.durationScale = P.cast / p.duration;
  a.distanceScale = P.range / Math.max(1e-6, nominal);
  a.plDamage = P.damage / C.test.attackReference;                  // MV-P13: nominal @ referência; escala com o Ataque
  a.kb = {horizontal: P.knockbackH, vertical: P.knockbackV};
  a.invulnerableFor = P.invulnerableSeconds;
  a.chainAfter = P.chainAfter;
  const toStep = (/** @type {number} */ t) => Math.round(t / step);
  a.combatWindows = {activeWindows: [[toStep(P.hitStart), Math.max(toStep(P.hitStart) + 1, toStep(P.hitEnd))]], invulnerabilityWindows: P.invulnerableSeconds > 0 ? [[0, toStep(P.invulnerableSeconds)]] : []};
  a.hitWindows = [new Set()];
}
