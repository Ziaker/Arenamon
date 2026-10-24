// @ts-check
// Parâmetros do Move "emerging-stone" (declarativo): padrão em C.world.emergingStone, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.emergingStone existe sempre, com ou sem os Moves registrados.
// Emerging Stone (ES-D01…D103, cronologia C): cast 0,55 s (corpo a 30%), marcador 3–10 m 3D, projétil 15 m/s, explosão de 5 m horizontais (20 nominais × Ataque ÷ referência, 8 m/s radial),
// rocha 3 m × escala (0,25–4×, passo 0,25), emerge em 0,40 s, 5 HP, lançamento da emergência 8 H/14 V, até 3 por dono. markerSpeed/startDistance/rockSearch/maxRise: provisórios.
// (Move como dado) Os parâmetros e a definição vêm de emerging-stone.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './emerging-stone.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
