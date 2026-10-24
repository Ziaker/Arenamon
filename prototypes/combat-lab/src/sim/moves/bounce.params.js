// @ts-check
// Parâmetros do Move "bounce" (declarativo): padrão em C.world.bounce, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.bounce existe sempre, com ou sem os Moves registrados.
// Bounce: Charge Trick+Melee. Carga máx. 1,2 s (PL1 <50%, PL2 <100%, PL3 em 100%); alturas 1,5/2,5/3,5 m (experimentais); alcance horizontal máx. 6 m; 12 HP nominais
// (× Ataque ÷ referência), 3 m/s H e 6 m/s V; recuperação 0,25 s após o pouso. gravity/contactRadius/landRadius não vêm do documento (MV-P27/MV-P28): provisórios.
import {defineMoveParams, paramRow} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('bounce', {
    id: "bounce", title: "Bounce",
    meta: {category: 'Charge', types: ['Trick', 'Melee'], pl: "PL1–PL3", status: PROPOSTO},
    hint: "Charge · Trick + Melee · PL1–PL3. Segure para carregar (até 1,2 s), solte para saltar em arco rumo ao alvo (até 6 m) e cair em cima do adversário.",
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado ao INICIAR a carga (Charge); interromper não devolve. Valor do catálogo — proposta, não homologada.", min: 0, max: 5, step: 0.05, unit: 'num', value: 1.2}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa junto com o custo, ao iniciar a carga (catálogo: 12 s).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 12}),
      paramRow({key: "maxCharge", label: "Carga máxima", tip: "PL1 abaixo de 50%, PL2 de 50% até antes de 100%, PL3 na carga máxima (catálogo: 1,2 s).", min: 0.2, max: 4, step: 0.05, unit: 'sec', value: 1.2}),
      paramRow({key: "minCharge", label: "Carga mínima para soltar", tip: "0 = pode soltar a qualquer momento.", min: 0, max: 2, step: 0.05, unit: 'sec', value: 0}),
      paramRow({key: "maxDistance", label: "Distância horizontal máxima", tip: "Com alvo travado mais perto, o salto vai só até ele (catálogo: 6 m).", min: 1, max: 15, step: 0.5, unit: 'm', value: 6}),
      paramRow({key: "heightPl1", label: "Altura do salto PL1", tip: "Altura máxima inicial com pouca carga (parâmetro experimental: 1,5 m).", min: 0.3, max: 8, step: 0.1, unit: 'm', value: 1.5}),
      paramRow({key: "heightPl2", label: "Altura do salto PL2", tip: "Altura com carga média (parâmetro experimental: 2,5 m).", min: 0.3, max: 8, step: 0.1, unit: 'm', value: 2.5}),
      paramRow({key: "heightPl3", label: "Altura do salto PL3", tip: "Altura com carga máxima (parâmetro experimental: 3,5 m).", min: 0.3, max: 8, step: 0.1, unit: 'm', value: 3.5}),
      paramRow({key: "gravity", label: "Gravidade do arco", tip: "Define o tempo de voo e a velocidade horizontal; não vem do catálogo (provisório: 17,5 m/s²).", min: 5, max: 40, step: 0.5, unit: 'num', value: 17.5}),
      paramRow({key: "damage", label: "Dano nominal", tip: "Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13). Catálogo: 12 HP.", min: 0, max: 60, step: 0.5, unit: 'num', value: 12}),
      paramRow({key: "knockbackH", label: "Knockback horizontal", tip: "Empurrão no alvo atingido (catálogo: 3 m/s).", min: 0, max: 20, step: 0.1, unit: 'ms', value: 3}),
      paramRow({key: "knockbackV", label: "Knockback vertical", tip: "Lançamento do alvo atingido (catálogo: 6 m/s).", min: 0, max: 20, step: 0.1, unit: 'ms', value: 6}),
      paramRow({key: "landRecovery", label: "Recuperação após o pouso", tip: "Tempo sem agir depois de aterrissar (catálogo: 0,25 s).", min: 0, max: 2, step: 0.01, unit: 'sec', value: 0.25}),
      paramRow({key: "contactRadius", label: "Folga do contato na descida", tip: "Margem somada ao corpo para acertar durante a descida (provisório: 0,3 m).", min: 0, max: 2, step: 0.05, unit: 'm', value: 0.3}),
      paramRow({key: "landRadius", label: "Raio do impacto do pouso", tip: "Quem está no chão dentro deste raio ao aterrissar também é atingido (provisório: 1,4 m).", min: 0, max: 5, step: 0.1, unit: 'm', value: 1.4}),
    ],
  });
