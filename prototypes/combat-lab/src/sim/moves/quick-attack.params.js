// @ts-check
// Parâmetros do Move "quick-attack" (declarativo): padrão em C.world.quickAttack, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.quickAttack existe sempre, com ou sem os Moves registrados.
// Quick Attack: alvo mais próximo a até 7 m, ida ≤ 0,16 s e volta ≤ 0,14 s (velocidades = alcance ÷ tempo), recuperação 0,12 s, 8 HP nominais, 4 m/s H sem V.
// Sem i-frames do atacante (o catálogo não define; MV-P16). Ação total = ida + volta + recuperação.
// (Move como dado) Os parâmetros e a definição vêm de quick-attack.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './quick-attack.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
