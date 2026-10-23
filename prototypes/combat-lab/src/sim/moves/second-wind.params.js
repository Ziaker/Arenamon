// @ts-check
// Parâmetros do Move "second-wind" (declarativo): padrão em C.world, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.secondWind existe sempre, com ou sem os Moves registrados.
import {defineMoveParams, paramRow, standardRows} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('secondWind', {
    id: 'second-wind', title: 'Second Wind',
    meta: {category: 'Normal', types: ['Status'], pl: 'SEM PL', status: PROPOSTO},
    hint: 'Normal · Status. Toque para regenerar stamina bem mais rápido e gastar 25% menos em esquiva e sprint por 5 s (cast de 0,35 s).',
    rows: [
      ...standardRows({cost: .8, cooldown: 12, cast: .35}),
      paramRow({key: 'duration', label: 'Duração do efeito', tip: 'Quanto tempo o status dura depois do cast (proposta).', min: .5, max: 20, step: .25, unit: 'sec', value: 5}),
      paramRow({key: 'regenPctPerSecond', label: 'Regeneração extra por segundo', tip: 'Fração da stamina MÁXIMA recuperada por segundo durante o efeito (MV-P09: o documento diz "+40%/s" sem base).', min: 0, max: 2, step: .05, unit: 'pct', value: .40}),
      paramRow({key: 'mobilityCostPct', label: 'Desconto em esquiva e sprint', tip: 'Redução do custo da esquiva (C) e do consumo do sprint durante o efeito (proposta: 25%).', min: 0, max: .9, step: .05, unit: 'pct', value: .25}),
    ],
  });
