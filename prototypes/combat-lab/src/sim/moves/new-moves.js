// @ts-check
// Moves NOVOS do Arenamon (genéricos e de Mushroom): tabela [definição, nome do efeito, manipulador]. Quem REGISTRA é standard.js (regra D2 do
// teste de arquitetura: só ele chama registerMove) e só o bootstrap do laboratório chama registerStandardMoves. Registrar não equipa: os slots
// continuam vazios e, sem equipar, nada muda no jogo (paridade testada). Plano e ordem: docs/moves-nao-iniciados/PROMPT_IMPLEMENTACAO_MOVES_NOVOS.md.
import {hardenDef, hardenEffect} from './harden.js';
import {secondWindDef, secondWindEffect} from './second-wind.js';

/** @type {[any, string, Function][]} */
export const NEW_MOVES = [
  [hardenDef, 'harden', hardenEffect],
  [secondWindDef, 'second-wind', secondWindEffect],
];
export const NEW_MOVE_IDS = NEW_MOVES.map(([d]) => d.id);
