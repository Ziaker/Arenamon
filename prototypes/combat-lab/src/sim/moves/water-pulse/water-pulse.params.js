// @ts-check
// Parâmetros do Move "water-pulse" (declarativo): padrão em C.world.waterPulse, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.waterPulse existe sempre, com ou sem os Moves registrados.
// Water Pulse: Charge Projectile. Carga máx. 1,5 s (180 passos; PL2 em 90, PL3 em 180), custo e recarga na ativação, 6/9/12 HP nominais, empurrão H 2/3/4 (V 0 ⇒ o motor empurra 1,5 × H m),
// projétil de raio 0,38 m a 14 m/s e alcance 12 m (lifetime = alcance ÷ velocidade), recuperação de 0,30 s a partir da soltura. originHeight/spawnForward: nascimento (não definidos no prompt).
// (Move como dado) Os parâmetros e a definição vêm de water-pulse.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from '../move-data.js';
import data from './water-pulse.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
