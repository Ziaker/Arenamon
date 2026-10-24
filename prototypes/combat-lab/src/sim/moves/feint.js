// @ts-check
// Feint (Finta Ofensiva) — Burst · Trick · sem PL (5_MOVES_GENERICOS_PROMPT §5). Cancela, em um flash curto, a ANTECIPAÇÃO de um ataque (Tackle, Lunge, Guard Break já
// solto, Quick Attack) ou a CARGA em curso (Guard Break, Tackle carregado, Charge em geral) e vira um recuo curto com i-frames, para trás ou para o lado do input; ao
// terminar (ou logo após a janela de encadeamento) qualquer ação pode começar. É um Move comum (`kind: 'move'`): não é Tackle, não tem PL e não entra em Clash/Counter.
// A lógica de cancelamento está em `pressFeint` (controller.js), porque mexe em f.action/f.charge. Fora da janela de cancelamento o Move é GASTO sem efeito e a ação
// anterior continua (punível, MV-P21); o custo da ação cancelada não volta (MV-P26). Valores: C.world.feint, capturados no uso (M28.4).

import {defineFicha} from './params-registry.js';
import {params} from './feint.params.js';
export const feintDef = Object.freeze({
  id: 'feint', name: 'Feint', air: 'cast', group: 'feint', feint: true, cancelFrom: ['tackle'], keepFacing: true, aim: 'input',
  description: 'Burst. Cancela um ataque que ainda está na antecipação (ou a carga em curso) e recua um pouco com i-frames curtos. Fora da janela, gasta o Move e o ataque continua.',
  cost: .3, cooldown: 3, duration: .22, cancelAfter: .0333,
  invulnerable: [.0167, .0833], invulnerableKeys: ['invulnStart', 'invulnEnd'],
  motion: {type: 'dash', distance: .25, start: .03, end: .15, distanceKey: 'retreat'},
});

/** FICHA do Move (ver docs/COMO_CRIAR_UM_MOVE.md): `params` gera o padrão em C.world.feint e os sliders da aba Moves; `def` e os manipuladores são registrados sozinhos. */
export const ficha = defineFicha({
  def: feintDef,
  params,
});
