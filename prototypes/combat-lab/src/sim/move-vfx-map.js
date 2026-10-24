// @ts-check
// Mapa PURO (sem imports) de quais efeitos visuais COMPARTILHADOS cada Move dispara, e os nomes legíveis. Serve ao painel Moves › Visual e à linha
// do tempo do Move (cues de VFX). O efeito acontece quando o evento da simulação acontece (spawn, impacto…); a duração interna do efeito é do VFX.
/** id do Move → chaves de efeitos globais reutilizados por vários Moves (mudar um deles afeta todos que o disparam). */
export const MOVE_VFX = Object.freeze({
  reflect: ['barrier', 'solidReflect'], psyshock: ['rock', 'solidImpact'], harden: ['block'],
  swift: ['hit'], riposte: ['hit', 'clash'], 'emerging-stone': ['rock', 'ground'],
  'bullet-punch': ['hit', 'rangeRing'], 'sand-wave': ['ground', 'solidDust'],
  spikes: ['ground'], bounce: ['ground', 'jumpLanding'], feint: ['dodge'],
  'guard-break': ['hit', 'block'], lunge: ['hit'], 'quick-attack': ['hit', 'rangeRing'],
  'second-wind': ['regen'],
});
export const VFX_NAMES = Object.freeze({
  barrier: 'Barreira do Reflect', solidReflect: 'Superfície 3D da defesa', rock: 'Pedras e estilhaços', solidImpact: 'Impacto sólido', hit: 'Impacto compartilhado',
  clash: 'Colisão de ataques', ground: 'Contato com o chão', solidDust: 'Poeira sólida', rangeRing: 'Círculo de alcance', jumpLanding: 'Pouso', dodge: 'Esquiva',
  block: 'Bloqueio', regen: 'Regeneração',
});
