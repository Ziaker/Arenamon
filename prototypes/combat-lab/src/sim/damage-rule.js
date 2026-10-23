// @ts-check
// Regra do jogo (23/10/2026): todo dano é um número INTEIRO, sempre arredondado para o inteiro mais próximo ABAIXO (0,99 → 0; 7,9 → 7).
// A tolerância de 1e-9 evita que erro de ponto flutuante (3,9999999999) tire 1 HP indevido. Desligável em C.extras.toggles.integerDamage (0 = dano fracionário, como antes).
import {C} from './config.js';

export function wholeDamage(/** @type {number} */ value) {
  if (!(value > 0)) return 0;
  // `__legacyFractionalDamage`: só os testes que caracterizam a matemática anterior à regra ligam isto (nunca o jogo).
  return C.extras?.toggles?.integerDamage === 0 || /** @type {any} */ (globalThis).__legacyFractionalDamage ? value : Math.floor(value + 1e-9);
}
