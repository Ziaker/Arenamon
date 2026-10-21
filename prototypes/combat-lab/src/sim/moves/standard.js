// @ts-check
// Moves padrão do laboratório (Reflect agora; Psyshock na Fase 3). O núcleo da simulação NÃO registra nada (D2): quem chama
// `registerStandardMoves()` é o bootstrap do laboratório (main.js) e os testes que precisam deles. Registrar não equipa:
// os slots continuam vazios até a homologação jogável (opt-in por `game.setLoadout`).
import {registerMove, registerTackleSetup} from '../moves.js';
import {registerEffect} from '../move-effects.js';
import {reflectDef, reflectEffect} from './reflect.js';
import {psyshockDef, psyshockEffect} from './psyshock.js';
import {NEW_MOVES} from './new-moves.js';

export const STANDARD_MOVE_IDS = ['reflect', 'psyshock'];
/** Registra as definições e os efeitos dos Moves padrão (idempotente: sobrescreve os de mesmo id). */
export function registerStandardMoves() {
  registerEffect('reflect', reflectEffect);
  registerEffect('psyshock', psyshockEffect);
  registerMove(/** @type {any} */ (reflectDef));
  registerMove(/** @type {any} */ (psyshockDef));
  for (const {def, effect, tackle, hooks} of NEW_MOVES) {if (effect) registerEffect(effect[0], effect[1]);if (tackle) registerTackleSetup(tackle[0], tackle[1]);for (const [n, fn] of hooks ?? []) registerTackleSetup(n, fn);registerMove(def);}   // Moves novos: registrados, nunca equipados por padrão
  return [...STANDARD_MOVE_IDS];
}
