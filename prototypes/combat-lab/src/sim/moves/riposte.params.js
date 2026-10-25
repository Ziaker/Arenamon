// @ts-check
// Parâmetros do Move "riposte" (declarativo): padrão em C.world.riposte, faixa, unidade, rótulo e dica de cada slider da aba Moves.
// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.riposte existe sempre, com ou sem os Moves registrados.
// Riposte: Normal Status+Melee PL1. Postura de 0,65 s; entre 0,13 e 0,30 s qualquer acerto elegível (menos Guard Break) é anulado e dispara um contra-golpe PL1 de 6 HP
// (× Ataque ÷ referência), 3 m/s H, na hora do gatilho (MV-P24); strikeRange = alcance do golpe (não definido no documento: MV-P25). Janela fechada sem acerto = recuperação exposta.
// (Move como dado) Os parâmetros e a definição vêm de riposte.move.json: edite lá ou no Editor de Moves.
import {loadMoveData} from './move-data.js';
import data from './riposte.move.json' with {type: 'json'};

const loaded = loadMoveData(data);
export const params = loaded.params;
/** Definição do Move (identidade, fases, custo/recarga/duração iniciais): vem do JSON, congelada. */
export const def = loaded.def;
/** Visual aprovado no atelier (approved/<categoria>.json), quando houver: referência, não cópia. */
export const visual = loaded.visual;
