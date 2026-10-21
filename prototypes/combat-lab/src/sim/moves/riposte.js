// @ts-check
// Riposte (Contra-ataque) — Normal · Status + Melee · PL1 apenas no contra-golpe (5_MOVES_GENERICOS_PROMPT §6). Postura baixa de 0,65 s; se um acerto elegível chega
// entre 0,13 s e 0,30 s, o dano e o knockback são ANULADOS e o personagem responde na hora com um Tackle PL1 (6 HP nominais, 3 m/s H, sem V) rumo a quem atacou, com
// i-frames até o fim da janela. Sem acerto, a janela fecha e o resto do cast é recuperação exposta. NÃO anula Guard Break (mantém o triângulo tático) nem agarrões; o
// interceptor está em entity.js (`riposteIntercept`), chamado por resolveHit (Tackle) e applyHit (projéteis, lasers, áreas). Valores: C.world.riposte, capturados no uso.
export const riposteDef = Object.freeze({
  id: 'riposte', name: 'Riposte', group: 'riposte', riposte: true, aim: 'target',
  description: 'Normal. Adota uma postura baixa; se for atingido na janelinha de 0,13–0,30 s, anula o golpe e contra-ataca na hora. Errar o tempo deixa você exposto.',
  cost: .8, cooldown: 8, duration: .65,
  motion: {type: 'root'},
});
