// @ts-check
// Parâmetros do Move "air-slash" (declarativo): padrão em C.world.airSlash, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.airSlash existe sempre, com ou sem os Moves registrados.
// Air Slash: Burst Projectile PL1. Startup 8 passos + recovery 20 passos, lâmina a 22 m/s com alcance 10 m (lifetime = alcance ÷ velocidade), colisor = círculo equivalente de raio 0,6 m,
// 8 HP nominais, empurrão H 2,5 (V 0). visualWidth/Height/Thickness: só o desenho da lâmina (1,20 × 0,70 × 0,22 m).
// (Move como dado) Os parâmetros e a definição vêm de air-slash.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './air-slash.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
