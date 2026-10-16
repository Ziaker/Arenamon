// @ts-check
// Moves padrão do laboratório (Reflect agora; Psyshock na Fase 3). O núcleo da simulação NÃO registra nada (D2): quem chama
// `registerStandardMoves()` é o bootstrap do laboratório (main.js) e os testes que precisam deles. Registrar não equipa:
// os slots continuam vazios até a homologação jogável (opt-in por `game.setLoadout`).
import {registerMove} from '../moves.js';
import {registerEffect} from '../move-effects.js';
import {reflectDef, reflectEffect} from './reflect.js';

export const STANDARD_MOVE_IDS = ['reflect'];
/** Registra as definições e os efeitos dos Moves padrão (idempotente: sobrescreve os de mesmo id). */
export function registerStandardMoves() {
  registerEffect('reflect', reflectEffect);
  registerMove(/** @type {any} */ (reflectDef));
  return [...STANDARD_MOVE_IDS];
}
