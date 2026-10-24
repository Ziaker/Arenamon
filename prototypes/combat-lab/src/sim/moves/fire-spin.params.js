// @ts-check
// Parâmetros do Move "fire-spin" (declarativo): padrão em C.world.fireSpin, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.fireSpin existe sempre, com ou sem os Moves registrados.
// Fire Spin: Normal Field. Marcador de colocação (alcance 3D 10 m — pedido de 23/10 dobrou os 5 m do protótipo), cast 0,4 s + recovery 0,2 s, zona cilíndrica de 1,6 m de raio × 2,4 m,
// 2,4 s de vida, 4 pulsos a cada 0,6 s de 2 HP nominais, sem knockback e (padrão provisório) sem guard stun; occlusion = paredes bloqueiam o pulso; maxActive = zonas simultâneas por dono.
// (Move como dado) Os parâmetros e a definição vêm de fire-spin.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './fire-spin.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
