// @ts-check
// Sand Wave (Onda de Areia) — Burst · Melee · PL1 (docs/MUSHROOM_MOVES_DECISOES.md §6, SW-D01…SW-D68; substitui o Sand Kick). Só no chão; cobra 2 de stamina e 10 s
// de recarga na ATIVAÇÃO; 0,25 s de preparação (sair do chão ou ser interrompido cancela, sem reembolso); ao fim dela nasce a entidade 'sandwave' (sand.js) com o
// retângulo 4 × 3 m fixado na direção do disparo, e o lutador fica livre. A barragem dura 1,5 s (0,75 s de hitbox + 0,75 s de dissipação). Cada adversário
// em terra com os pés no retângulo e alcançado pela frente da onda leva 6 HP fixos, cegueira de 4 s (a perfeita anula) e empurrão de 12 m/s² (6 na parcial).
// Visual: a barragem e a nuvem do cegado usam formas provisórias (a direção de arte NÃO foi aprovada, SW-P07). Valores: C.world.sandWave, capturados no disparo.
import {C} from '../config.js';
import {spawn} from '../world.js';
import {direction} from '../math.js';
import {isAirJump} from '../air.js';

export const sandWaveDef = Object.freeze({
  id: 'sand-wave', name: 'Sand Wave', air: 'cast', group: 'sandWave', groundOnly: true, aim: 'target',
  description: 'Burst. Só no chão: após 0,25 s lança uma barragem de areia (retângulo 4 × 3 m à frente) que fere, empurra e CEGA por 4 s quem estiver no chão dentro dela.',
  cost: 2, cooldown: 10, duration: .25, motion: {type: 'root'},
  timeline: [{at: .25, atKey: 'cast', effect: 'sand-wave'}],
});

/** Efeito do fim da preparação: cria a barragem com a direção e as dimensões fixadas agora. */
export function sandWaveEffect(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const P = fx.params ?? C.world.sandWave;
  if ((f.flight && !isAirJump(f)) || (!f.flight && (f.vaultHeight ?? 0) > 1e-8)) return {ok: false, reason: 'noGround'};   // lançado ou em outra ação aérea na preparação: cancela (custo mantido). No salto a barragem nasce no chão sob o lutador
  const dir = direction(fx.heading);
  const e = spawn(game.world, {
    kind: 'sandwave', owner: f.id, pos: {x: f.position.x, z: f.position.z}, dir, length: P.length, width: P.width, active: P.active, life: P.active + P.dissipate,
    speed: P.length / P.active, damage: P.damage, accel: P.accel, partialFactor: P.partialFactor, blind: P.blind, wallStagger: P.wallStagger, cell: P.cell, detour: P.detour,
    replanSteps: P.replanSteps, y: 0, height: .35, visual: 'sand', captured: {move: def.id},
  }, fx.events ?? []);
  if (!e) return {ok: false, reason: 'entityLimit'};
}
