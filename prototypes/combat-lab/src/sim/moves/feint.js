// @ts-check
// Feint (Finta Ofensiva) — Burst · Trick · sem PL (5_MOVES_GENERICOS_PROMPT §5). Cancela, em um flash curto, a ANTECIPAÇÃO de um ataque (Tackle, Lunge, Guard Break já
// solto, Quick Attack) ou a CARGA em curso (Guard Break, Tackle carregado, Charge em geral) e vira um recuo curto com i-frames, para trás ou para o lado do input; ao
// terminar (ou logo após a janela de encadeamento) qualquer ação pode começar. É um Move comum (`kind: 'move'`): não é Tackle, não tem PL e não entra em Clash/Counter.
// A lógica de cancelamento está em `pressFeint` (controller.js), porque mexe em f.action/f.charge. Fora da janela de cancelamento o Move é GASTO sem efeito e a ação
// anterior continua (punível, MV-P21); o custo da ação cancelada não volta (MV-P26). Valores: C.world.feint, capturados no uso (M28.4).

import {defineFicha} from './params-registry.js';
import {params, def as feintDef} from './feint.params.js';
export {feintDef};   // definição (id, fases, custo…) vem de feint.move.json

/** FICHA do Move (ver docs/COMO_CRIAR_UM_MOVE.md): `params` gera o padrão em C.world.feint e os sliders da aba Moves; `def` e os manipuladores são registrados sozinhos. */
export const ficha = defineFicha({
  def: feintDef,
  params,
});
