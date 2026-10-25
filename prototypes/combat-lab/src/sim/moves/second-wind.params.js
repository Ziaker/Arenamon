// @ts-check
// Parâmetros do Move "second-wind" (declarativo): padrão em C.world, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.secondWind existe sempre, com ou sem os Moves registrados.
// (Move como dado) Os parâmetros e a definição vêm de second-wind.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './second-wind.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
