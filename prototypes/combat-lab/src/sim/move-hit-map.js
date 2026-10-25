// @ts-check
// Mapas puros de identidade dos Moves usados pelo VFX de hit e pelo painel Moves (sem importar nada: serve a simulação, à visão e à interface).
// `move` (id) chega nos eventos de acerto (`applyHit` → `event.move`); null = Tackle/corpo.

/** id do Move → grupo em C.world (onde moram os parâmetros do Move). */
export const MOVE_GROUP = Object.freeze({
  reflect: 'reflect', psyshock: 'psyshock', swift: 'swift', 'emerging-stone': 'emergingStone', 'sand-wave': 'sandWave', spikes: 'spikes',
  'water-pulse': 'waterPulse', 'fire-spin': 'fireSpin', 'air-slash': 'airSlash', 'seed-bomb': 'seedBomb',
  lunge: 'lunge', 'quick-attack': 'quickAttack', 'guard-break': 'guardBreak', bounce: 'bounce', riposte: 'riposte', 'bullet-punch': 'bulletPunch',
});
/** Moves corpo a corpo (usam a mecânica do Tackle): mantêm o tremor de hit padrão. Todos os outros só tremem se o interruptor do Move estiver ligado. */
export const MELEE_MOVES = Object.freeze(new Set(['lunge', 'quick-attack', 'guard-break', 'bounce', 'riposte', 'bullet-punch']));
/** Grupos de C.world cujo Move NÃO é corpo a corpo e causa dano: têm interruptor e sliders de tremor de hit. */
export const SHAKE_GROUPS = Object.freeze(['reflect', 'psyshock', 'swift', 'emergingStone', 'sandWave', 'spikes', 'waterPulse', 'fireSpin', 'airSlash', 'seedBomb']);
/** id do Move → elemento (gancho para o VFX de hit por elemento, ver HIT_BY_ELEMENT em view/vfx.js). */
export const MOVE_ELEMENT = Object.freeze({
  'water-pulse': 'water', 'fire-spin': 'fire', 'air-slash': 'air', 'seed-bomb': 'grass',
  psyshock: 'psychic', reflect: 'psychic', 'emerging-stone': 'ground', 'sand-wave': 'ground', spikes: 'ground', swift: 'normal',
});
/** Cores de hit por Move não corpo a corpo (0xRRGGBB): `color` = traços/partículas, `color2` = brilho/segunda camada. Editáveis em Moves → Visual → Contato (hit). */
export const HIT_COLOR_DEFAULTS = Object.freeze({
  reflect: {color: 0x7fd0ff, color2: 0xe3f6ff}, psyshock: {color: 0xd977ff, color2: 0xffd6ff}, swift: {color: 0xffe27a, color2: 0xffffff},
  emergingStone: {color: 0xb08968, color2: 0xe0c9a6}, sandWave: {color: 0xe3c27a, color2: 0xfff1c9}, spikes: {color: 0xc5c9d1, color2: 0xffffff},
  waterPulse: {color: 0x3aa8ff, color2: 0xcdeeff}, fireSpin: {color: 0xff6a1a, color2: 0xffd34d}, airSlash: {color: 0xcfeaff, color2: 0xffffff}, seedBomb: {color: 0x7bd957, color2: 0xc8ff9a},
});
