// @ts-check
// Parâmetros do Move "lunge" (declarativo): padrão em C.world.lunge, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.lunge existe sempre, com ou sem os Moves registrados.
// Lunge: Tackle de curta distância (3,5 m, total 0,6 s), 8 HP nominais, 4 m/s H sem V, i-frames 0,133 s, cancelável após 0,45 s; janela ativa 0,19–0,26 s só vale com "janelas de combate" ligadas.
// (Move como dado) Os parâmetros e a definição vêm de lunge.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './lunge.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
