// @ts-check
// Parâmetros do Move "feint" (declarativo): padrão em C.world.feint, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.feint existe sempre, com ou sem os Moves registrados.
// Feint: Burst Trick sem PL. Cancela Tackle/Lunge/Guard Break (e a carga de Tackle) só na antecipação (cancelWindow = 4 quadros a 30 fps = 0,133 s) e vira um recuo curto
// (retreat m, para trás ou para o lado do input) com i-frames de 2 a 10 passos a 120 Hz. Fora da janela o Move é gasto sem efeito e o golpe segue (punível; MV-P21).
// (Move como dado) Os parâmetros e a definição vêm de feint.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './feint.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
