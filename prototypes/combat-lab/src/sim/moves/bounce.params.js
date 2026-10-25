// @ts-check
// Parâmetros do Move "bounce" (declarativo): padrão em C.world.bounce, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.bounce existe sempre, com ou sem os Moves registrados.
// Bounce: Charge Trick+Melee. Carga máx. 1,2 s (PL1 <50%, PL2 <100%, PL3 em 100%); alturas 1,5/2,5/3,5 m (experimentais); alcance horizontal máx. 6 m; 12 HP nominais
// (× Ataque ÷ referência), 3 m/s H e 6 m/s V; recuperação 0,25 s após o pouso. gravity/contactRadius/landRadius não vêm do documento (MV-P27/MV-P28): provisórios.
// (Move como dado) Os parâmetros e a definição vêm de bounce.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './bounce.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
