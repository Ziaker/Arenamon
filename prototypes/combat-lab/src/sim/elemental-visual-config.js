// @ts-check
// Dados puros para os controles visuais dos quatro Moves elementais no jogo.
// As chaves são objetos, e não arrays, para que o export/import do ajustador
// consiga percorrer todos os valores por caminho estável.
import {ELEMENTAL_GAME_PARAMS} from '../view/quarks/elemental-game-params.js';
import {seedDefaults} from '../view/quarks/presets.js';

const C_FOLLOW_DEFAULT = .3;
export const elementalVisualKey = (move, variant = 0) => `${move}${variant}`;

export function elementalVisualDefaults() {
  const visual = {};
  const numbers = raw => Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => {
    if (typeof value === 'number') return [[key, value]];
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return [[key, Number.parseInt(value.slice(1), 16)]];
    if (value && typeof value === 'object' && !Array.isArray(value)) return [[key, numbers(value)]];
    return [];
  }));
  for (const [move, variants] of Object.entries(ELEMENTAL_GAME_PARAMS)) {
    variants.forEach((raw, variant) => {
      const values = numbers(move === 'seedBomb' ? {...seedDefaults(), ...raw} : raw);
      values.opacity = 1;
      // Tempo (s) que argolas, ondas e cone do disparo acompanham o projétil: um valor por Move e por variante (pedido de 23/10/2026).
      if (move !== 'fireSpin') values.shotFollowTime = C_FOLLOW_DEFAULT;
      // A lâmina era pequena e pouco contrastada em relação à arena.
      if (move === 'airSlash') values.brightness = Math.max(1.6, values.brightness);
      visual[elementalVisualKey(move, variant)] = values;
    });
  }
  return visual;
}
