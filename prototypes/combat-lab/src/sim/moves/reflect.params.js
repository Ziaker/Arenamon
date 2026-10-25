// @ts-check
// Parâmetros e definição do Move "reflect" — LIDOS DE reflect.move.json (Move como dado). Antes: padrões em C.world.reflect (config.js), rótulos e faixas numa tabela
// de ui/moves-panel.js e a definição em reflect.js. Agora tudo mora no JSON: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './reflect.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga, carga): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier, quando houver. */
export const visual = loaded.visual;
