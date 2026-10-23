// @ts-check
// Parâmetros do Move "harden" (declarativo): padrão em C.world, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.harden existe sempre, com ou sem os Moves registrados.
import {defineMoveParams, paramRow, standardRows} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('harden', {
    id: 'harden', title: 'Harden',
    meta: {category: 'Normal', types: ['Status'], pl: 'SEM PL', status: PROPOSTO},
    hint: 'Normal · Status. Toque para endurecer: +30% de Defesa e nenhum knockback ofensivo por 5 s (cast de 0,35 s).',
    rows: [
      ...standardRows({cost: .8, cooldown: 10, cast: .35}),
      paramRow({key: 'duration', label: 'Duração do efeito', tip: 'Quanto tempo o status dura depois do cast (proposta).', min: .5, max: 20, step: .25, unit: 'sec', value: 5}),
      paramRow({key: 'defensePct', label: 'Bônus de Defesa', tip: '+30% de Defesa = dano recebido × 1/(1+bônus), mesma convenção da passiva de Defesa (MV-P01; proposta).', min: 0, max: 2, step: .05, unit: 'pct', value: .30}),
      paramRow({key: 'negateKnockback', label: 'Anula o knockback ofensivo?', tip: 'Liga a negação do arremesso/empurrão de ataques e projéteis. O empurrão físico do corpo do atacante e a gravidade não são knockback (MV-P12).', min: 0, max: 1, step: 1, unit: 'yesno', value: 1}),
    ],
  });
