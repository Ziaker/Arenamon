// @ts-check
// Parâmetros do Move "seed-bomb" (declarativo): padrão em C.world.seedBomb, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.seedBomb existe sempre, com ou sem os Moves registrados.
// Seed Bomb: Normal Projectile + Field instantâneo. Marcador (alcance 3D 16 m — pedido de 23/10 dobrou os 8 m do protótipo), cast 0,3 s + recovery 0,2 s, arco balístico de 0,65 s
// (gravidade 17,5 = a do salto/Bounce) com velocidade máx. 20 m/s, semente de raio 0,24 m (vida 1,25 s), explosão ESFÉRICA de 1,8 m, 10 HP nominais, empurrão 3 H / 1 V, oclusão por paredes.
// (Move como dado) Os parâmetros e a definição vêm de seed-bomb.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './seed-bomb.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
