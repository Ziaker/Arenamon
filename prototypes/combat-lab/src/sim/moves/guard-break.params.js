// @ts-check
// Parâmetros do Move "guard-break" (declarativo): padrão em C.world, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.guardBreak existe sempre, com ou sem os Moves registrados.
// (Move como dado) Os parâmetros e a definição vêm de guard-break.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './guard-break.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
