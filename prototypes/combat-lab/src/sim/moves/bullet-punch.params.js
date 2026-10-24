// @ts-check
// Parâmetros do Move "bullet-punch" (declarativo): padrão em C.world.bulletPunch, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.bulletPunch existe sempre, com ou sem os Moves registrados.
// Bullet Punch (como o Quick Attack, decisão de 22/10/2026): alvo = adversário mais próximo dentro de `reach` (alcance do Move), fixado ao soltar; preparação 0,75 s (corpo a 30%, slow .7),
// desaparecimento de `vanish` s numa corrida invisível até `stopShort` m do alvo, golpe PL2 de `strikeReach` m ao chegar (ou no primeiro adversário a `hitRadius` m do caminho),
// custo 1,5× o do Tackle (Tackle = 1) e 8 s; impactMult = velocidade de impacto do knockback. fxLines/fxHideBody: visual do sumiço (linhas de velocidade e corpo oculto).
// (Move como dado) Os parâmetros e a definição vêm de bullet-punch.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './bullet-punch.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
