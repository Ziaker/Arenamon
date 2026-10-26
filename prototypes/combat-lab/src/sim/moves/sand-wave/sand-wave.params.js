// @ts-check
// Parâmetros do Move "sand-wave" — AGORA LIDOS DE sand-wave.move.json (Move como dado; o arquivo de dados é a fonte, edite lá ou no Editor de Moves): padrão em C.world.sandWave, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.sandWave existe sempre, com ou sem os Moves registrados.
// Sand Wave: Burst PL1 (MUSHROOM_MOVES_DECISOES §6). Prep 0,25 s, barragem 1,5 s (0,75 s de hitbox + 0,75 s de dissipação), retângulo 4 (frente) × 3 (lado) m, 6 HP fixos,
// empurrão 12 m/s² (×0,5 na parcial), cegueira 4 s, stagger de parede 0,30 s, visão do cegado 10 m, fog = redução de 60% da luz. cell/detour/replanSteps: grade do caminho livre (técnicos).
import {loadMoveData} from '../move-data.js';
import data from './sand-wave.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json): referência, não cópia. */
export const visual = loaded.visual;
