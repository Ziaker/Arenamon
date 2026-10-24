// @ts-check
// Parâmetros do Move "spikes" (declarativo): padrão em C.world.spikes, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.spikes existe sempre, com ou sem os Moves registrados.
// Spikes: Normal Field PL1. Marcador de colocação (alcance 3D 5 m), cast 0,4 s, armadilha de 1,2 m de raio por 8 s, 6 HP nominais (× Ataque ÷ referência), sem knockback, 1 acionamento.
// markerSpeed/startDistance/maxRise/armDelay/trapHeight não vêm do documento (MV-P29/MV-P31): provisórios.
import {defineMoveParams, paramRow, hitShakeRows} from './params-registry.js';

/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */
const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};

export const params = defineMoveParams('spikes', {
    id: "spikes", title: "Spikes",
    meta: {category: 'Normal', types: ['Field'], pl: "SEM PL", status: PROPOSTO},
    hint: "Normal · Field. Segure para escolher o local (setas movem o marcador, até 5 m), solte para confirmar: nasce uma armadilha de espinhos que fere o primeiro adversário que pisar nela.",
    rows: [
      paramRow({key: "cost", label: "Custo de stamina", tip: "Cobrado ao CONFIRMAR o marcador (Normal); marcador inválido cancela sem custo. Valor do catálogo — proposta, não homologada.", min: 0, max: 5, step: 0.05, unit: 'num', value: 1}),
      paramRow({key: "cooldown", label: "Cooldown", tip: "Começa junto com o custo, na confirmação (catálogo: 10 s).", min: 0, max: 60, step: 0.5, unit: 'sec', value: 10}),
      paramRow({key: "cast", label: "Duração do cast", tip: "Tempo entre confirmar e a armadilha nascer; interrupção cancela sem reembolso (catálogo: 0,4 s).", min: 0.05, max: 2, step: 0.01, unit: 'sec', value: 0.4}),
      paramRow({key: "range", label: "Alcance de colocação (3D)", tip: "Distância tridimensional máxima do marcador, incluindo a altura do apoio (catálogo: 5 m).", min: 1, max: 15, step: 0.5, unit: 'm', value: 5}),
      paramRow({key: "minRange", label: "Alcance mínimo", tip: "0 = pode colocar colada em você (provisório).", min: 0, max: 10, step: 0.25, unit: 'm', value: 0}),
      paramRow({key: "radius", label: "Raio do campo", tip: "Região ofensiva da armadilha (catálogo: 1,2 m).", min: 0.3, max: 4, step: 0.05, unit: 'm', value: 1.2}),
      paramRow({key: "life", label: "Duração máxima", tip: "Tempo até sumir sem acionar (catálogo: 8 s).", min: 1, max: 30, step: 0.5, unit: 'sec', value: 8}),
      paramRow({key: "damage", label: "Dano nominal", tip: "Com o Ataque de referência; final = nominal × Ataque ÷ referência (MV-P13); dano comum para Sturdy (MV-P05). Catálogo: 6 HP.", min: 0, max: 40, step: 0.5, unit: 'num', value: 6}),
      paramRow({key: "knockbackH", label: "Knockback horizontal", tip: "O catálogo define 0: dano sem empurrão.", min: 0, max: 10, step: 0.1, unit: 'ms', value: 0}),
      paramRow({key: "knockbackV", label: "Knockback vertical", tip: "O catálogo define 0.", min: 0, max: 10, step: 0.1, unit: 'ms', value: 0}),
      paramRow({key: "armDelay", label: "Tempo de armação", tip: "Depois de nascer, a armadilha só aciona após este tempo (provisório: 0,25 s, MV-P31).", min: 0, max: 2, step: 0.05, unit: 'sec', value: 0.25}),
      paramRow({key: "markerAccel", label: "Aceleração do marcador", tip: "Quão rápido o marcador ganha velocidade ao mudar a direção do corpo: ele DESLIZA para o novo lado em vez de aparecer lá. 0 = instantâneo (como antes); padrão 24 m/s².", min: 0, max: 200, step: 1, unit: 'num', value: 24}),
      paramRow({key: "markerSpeed", label: "Velocidade do marcador", tip: "Quão rápido a direção move o marcador enquanto o botão está segurado (provisório: 8 m/s, MV-P29).", min: 1, max: 30, step: 0.5, unit: 'ms', value: 8}),
      paramRow({key: "startDistance", label: "Distância inicial do marcador", tip: "Onde o marcador aparece ao apertar, à frente do corpo (provisório: 3 m).", min: 0.5, max: 10, step: 0.25, unit: 'm', value: 3}),
      paramRow({key: "maxRise", label: "Altura máxima de apoio acima dos pés", tip: "Até que altura de plataforma/rampa o marcador alcança (provisório: 2 m).", min: 0, max: 6, step: 0.25, unit: 'm', value: 2}),
      paramRow({key: "trapHeight", label: "Altura da região ofensiva", tip: "Faixa vertical em que a armadilha pega quem pisa (provisório: 1,2 m).", min: 0.3, max: 4, step: 0.1, unit: 'm', value: 1.2}),
      ...hitShakeRows(),
    ],
  });
