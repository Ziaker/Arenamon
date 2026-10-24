// @ts-check
// Parâmetros do Move "lunge" (declarativo): padrão em C.world.lunge, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.lunge existe sempre, com ou sem os Moves registrados.
// Lunge: Tackle de curta distância (3,5 m, total 0,6 s), 8 HP nominais, 4 m/s H sem V, i-frames 0,133 s, cancelável após 0,45 s; janela ativa 0,19–0,26 s só vale com "janelas de combate" ligadas.
import {defineMoveParams, paramRow} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('lunge', {
    id: "lunge", title: "Lunge",
    meta: {category: 'Burst', types: ['Melee'], pl: "PL1", status: PROPOSTO},
    hint: "Burst · Melee · PL1. Toque para avançar 3,5 m em linha reta com um Tackle curto e ficar onde parou.",
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado no início do uso (Burst); vale nos PRÓXIMOS usos (M28.4). Valor da proposta — não homologada.", min: 0, max: 5, step: 0.05, unit: 'num', value: 0.75}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa junto com o custo, no início do uso (proposta: 6 s).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 6}),
      paramRow({key: "cast", label: "Duração total da ação", tip: "Do início ao fim da recuperação (proposta: 0,6 s).", min: 0.1, max: 2, step: 0.01, unit: 'sec', value: 0.6}),
      paramRow({key: "range", label: "Distância do avanço", tip: "Distância percorrida em linha reta, sem retorno (proposta: 3,5 m).", min: 0.5, max: 12, step: 0.1, unit: 'm', value: 3.5}),
      paramRow({key: "damage", label: "Dano nominal", tip: "Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Proposta: 8 HP.", min: 0, max: 40, step: 0.5, unit: 'num', value: 8}),
      paramRow({key: "knockbackH", label: "Knockback horizontal", tip: "Empurrão deslizante no alvo (proposta: 4 m/s).", min: 0, max: 20, step: 0.1, unit: 'ms', value: 4}),
      paramRow({key: "knockbackV", label: "Knockback vertical", tip: "Com valor acima de zero o golpe passa a lançar o alvo (proposta: 0).", min: 0, max: 20, step: 0.1, unit: 'ms', value: 0}),
      paramRow({key: "invulnerableSeconds", label: "Invulnerabilidade inicial", tip: "Janela de i-frames do atacante no começo do avanço (proposta: 0,133 s; 0 desliga).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0.1333}),
      paramRow({key: "chainAfter", label: "Cancelável após", tip: "Instante a partir do qual esquiva/outras ações podem cancelar (proposta: 0,45 s).", min: 0, max: 2, step: 0.01, unit: 'sec', value: 0.45}),
      paramRow({key: "hitStart", label: "Janela ativa: início", tip: "Só vale com \"janelas de combate\" ligadas (proposta: 0,19 s).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0.19}),
      paramRow({key: "hitEnd", label: "Janela ativa: fim", tip: "Só vale com \"janelas de combate\" ligadas (proposta: 0,26 s).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0.26}),
    ],
  });
