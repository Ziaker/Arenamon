// @ts-check
// Moves que o Editor de Moves sabe abrir: os que já têm `<id>.move.json` (Move como dado). Para incluir um Move, migre-o (docs/PLANO_EDITOR_DE_MOVES.md,
// fase 5) e acrescente uma linha aqui. Módulo de DADOS: não importa nada de interface nem de visão.
import {params, def, visual} from '../sim/moves/sand-wave.params.js';

/**
 * @typedef {{id: string, name: string, group: string, def: any, params: any, visual: {atelier?: string, variant?: string} | null}} EditableMove
 */
/** @type {EditableMove[]} */
export const EDITABLE_MOVES = [
  {id: def.id, name: def.name, group: params.group, def, params, visual},
];
export const editableMove = (/** @type {string} */ id) => EDITABLE_MOVES.find(m => m.id === id) ?? null;
