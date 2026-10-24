// @ts-check
// Parâmetros do Move "quick-attack" (declarativo): padrão em C.world.quickAttack, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.quickAttack existe sempre, com ou sem os Moves registrados.
// Quick Attack: alvo mais próximo a até 7 m, ida ≤ 0,16 s e volta ≤ 0,14 s (velocidades = alcance ÷ tempo), recuperação 0,12 s, 8 HP nominais, 4 m/s H sem V.
// Sem i-frames do atacante (o catálogo não define; MV-P16). Ação total = ida + volta + recuperação.
import {defineMoveParams, paramRow} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('quickAttack', {
    id: "quick-attack", title: "Quick Attack",
    meta: {category: 'Burst', types: ['Melee'], pl: "PL1", status: PROPOSTO},
    hint: "Burst · Melee · PL1. Toque para investir no adversário mais próximo (até 7 m) e voltar na hora ao ponto de partida. Sem alvo ao alcance, não faz nada.",
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado no início do uso (Burst); vale nos PRÓXIMOS usos (M28.4). Valor da proposta — não homologada.", min: 0, max: 5, step: 0.05, unit: 'num', value: 0.75}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa junto com o custo, no início do uso (proposta: 6 s).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 6}),
      paramRow({key: "acquireRange", label: "Alcance de aquisição do alvo", tip: "Adversário elegível mais próximo dentro desta distância; sem ninguém o Move nem começa (MV-P17). Proposta: 7 m.", min: 1, max: 20, step: 0.5, unit: 'm', value: 7}),
      paramRow({key: "approachMax", label: "Tempo máximo da ida", tip: "A ida termina no contato, ao chegar ou neste tempo (proposta: 0,16 s). A velocidade da ida = alcance ÷ este tempo.", min: 0.05, max: 1, step: 0.01, unit: 'sec', value: 0.16}),
      paramRow({key: "returnMax", label: "Tempo máximo da volta", tip: "Retorno ao ponto de partida (proposta: 0,14 s). Sem segundo acerto na volta.", min: 0.05, max: 1, step: 0.01, unit: 'sec', value: 0.14}),
      paramRow({key: "recovery", label: "Recuperação final", tip: "Tempo parado depois de voltar, antes de agir de novo (proposta: 0,12 s).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0.12}),
      paramRow({key: "damage", label: "Dano nominal", tip: "Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Proposta: 8 HP.", min: 0, max: 40, step: 0.5, unit: 'num', value: 8}),
      paramRow({key: "knockbackH", label: "Knockback horizontal", tip: "Empurrão deslizante no alvo (proposta: 4 m/s).", min: 0, max: 20, step: 0.1, unit: 'ms', value: 4}),
      paramRow({key: "knockbackV", label: "Knockback vertical", tip: "Com valor acima de zero o golpe passa a lançar o alvo (proposta: 0).", min: 0, max: 20, step: 0.1, unit: 'ms', value: 0}),
      paramRow({key: "invulnerableSeconds", label: "Invulnerabilidade do atacante", tip: "I-frames no começo da ida; o catálogo não define, então o padrão é 0 (MV-P16).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0}),
      paramRow({key: "fxLines", label: "Linhas de velocidade no sumiço", tip: "O lutador some em linhas de velocidade na ida e volta com outras linhas no retorno, como o Bullet Punch. Só aparência.", min: 0, max: 1, step: 1, unit: 'yesno', value: 1}),
      paramRow({key: "fxHideBody", label: "Ocultar o corpo durante o sumiço", tip: "Liga/desliga o desaparecimento visual do corpo durante a ida e a volta. Só aparência.", min: 0, max: 1, step: 1, unit: 'yesno', value: 1}),
      paramRow({key: "airReach", label: "Alcance vertical anti-aéreo", tip: "Altura de alvo em voo que o Move consegue adquirir e acertar (0 = só no chão, como antes). Padrão: 3 m.", min: 0, max: 8, step: 0.25, unit: 'm', value: 3}),
    ],
  });
