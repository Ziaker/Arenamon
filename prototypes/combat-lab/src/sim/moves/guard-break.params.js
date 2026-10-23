// @ts-check
// Parâmetros do Move "guard-break" (declarativo): padrão em C.world, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.guardBreak existe sempre, com ou sem os Moves registrados.
import {defineMoveParams, paramRow} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('guardBreak', {
    id: 'guard-break', title: "Guard Break",
    meta: {category: 'Charge', types: ['Melee'], pl: 'PL1–PL3', status: PROPOSTO},
    hint: 'Charge · Melee · PL1–PL3. Segure para carregar (até 1 s), solte para um golpe pesado que derruba a guarda e causa guard stun de 0,5 s.',
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado ao INICIAR a carga (Charge); interromper a carga não devolve. Valor da proposta — não homologada.", min: 0, max: 5, step: 0.05, unit: 'num', value: 1}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa junto com o custo, ao iniciar a carga (proposta: 10 s).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 10}),
      paramRow({key: "cast", label: "Duração do golpe (pós-soltura)", tip: "Do disparo ao fim da recuperação (proposta: 0,7 s).", min: 0.2, max: 3, step: 0.01, unit: 'sec', value: 0.7}),
      paramRow({key: "maxCharge", label: "Carga máxima", tip: "PL1 abaixo de 50%, PL2 de 50% até antes de 100%, PL3 na carga máxima (proposta: 1 s).", min: 0.2, max: 4, step: 0.05, unit: 'sec', value: 1}),
      paramRow({key: "minCharge", label: "Carga mínima para soltar", tip: "0 = pode soltar a qualquer momento (proposta).", min: 0, max: 2, step: 0.05, unit: 'sec', value: 0}),
      paramRow({key: "range", label: "Distância do avanço", tip: "Não definida no documento: provisório (MV-P20).", min: 0.5, max: 8, step: 0.1, unit: 'm', value: 2.6}),
      paramRow({key: "damage", label: "Dano nominal", tip: "Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13); não cresce com o PL. Valor do laboratório: 14 HP (a proposta original era 6; subiu para o contra-golpe ser um grande impacto).", min: 0, max: 40, step: 0.5, unit: 'num', value: 6}),
      paramRow({key: "knockbackH", label: "Knockback horizontal (sem guarda)", tip: "Empurrão em quem NÃO está defendendo (proposta: 2 m/s). Contra guarda o valor é o guard stun.", min: 0, max: 20, step: 0.1, unit: 'ms', value: 2}),
      paramRow({key: "knockbackV", label: "Knockback vertical", tip: "Com valor acima de zero o golpe passa a lançar o alvo (proposta: 0).", min: 0, max: 20, step: 0.1, unit: 'ms', value: 0}),
      paramRow({key: "stun", label: "Guard stun", tip: "Tempo que o defensor fica sem agir após ter a guarda quebrada (proposta: 0,5 s, GM-P04). Defesa perfeita anula.", min: 0, max: 3, step: 0.05, unit: 'sec', value: 0.5}),
      paramRow({key: "invulnerableSeconds", label: "Invulnerabilidade do atacante", tip: "I-frames no começo do golpe (proposta: nenhum; o startup é punível).", min: 0, max: 1, step: 0.01, unit: 'sec', value: 0}),
      paramRow({key: "chainAfter", label: "Cancelável após", tip: "Instante a partir do qual esquiva/outras ações podem cancelar (proposta: 0,47 s).", min: 0, max: 2, step: 0.01, unit: 'sec', value: 0.47}),
      paramRow({key: "hitStart", label: "Janela ativa: início", tip: "Só vale com \"janelas de combate\" ligadas (proposta: 0,33 s).", min: 0, max: 1.5, step: 0.01, unit: 'sec', value: 0.333}),
      paramRow({key: "hitEnd", label: "Janela ativa: fim", tip: "Só vale com \"janelas de combate\" ligadas (proposta: 0,53 s).", min: 0, max: 1.5, step: 0.01, unit: 'sec', value: 0.533}),
    ],
  });
