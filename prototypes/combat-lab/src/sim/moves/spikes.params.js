// @ts-check
// Parâmetros do Move "spikes" (declarativo): padrão em C.world.spikes, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.spikes existe sempre, com ou sem os Moves registrados.
// Spikes: Normal Field PL1. Marcador de colocação (alcance 3D 5 m), cast 0,4 s, armadilha de 1,2 m de raio por 8 s, 6 HP nominais (× Ataque ÷ referência), sem knockback, 1 acionamento.
// markerSpeed/startDistance/maxRise/armDelay/trapHeight não vêm do documento (MV-P29/MV-P31): provisórios.
// (Move como dado) Os parâmetros e a definição vêm de spikes.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './spikes.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
