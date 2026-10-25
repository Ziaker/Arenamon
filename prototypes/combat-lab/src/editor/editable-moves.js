// @ts-check
// Moves que o Editor de Moves sabe abrir: todos os que já estão em «Move como dado» (o <id>.params.js exporta def, params e visual; o índice
// moves/params.generated.js os junta sozinho — migrar um Move novo é tudo o que é preciso para ele aparecer aqui). Módulo de DADOS.
import {MOVES_DATA} from '../sim/moves/params.generated.js';

/**
 * @typedef {{id: string, name: string, group: string, def: any, params: any, visual: {atelier?: string, variant?: string} | null}} EditableMove
 */
/** @type {EditableMove[]} */
export const EDITABLE_MOVES = MOVES_DATA
  .map((/** @type {any} */ m) => ({id: m.def.id, name: m.def.name, group: m.params.group, def: m.def, params: m.params, visual: m.visual ?? null}))
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
export const editableMove = (/** @type {string} */ id) => EDITABLE_MOVES.find(m => m.id === id) ?? null;
