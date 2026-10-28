// Cores de lutador aplicáveis a modelos SEM textura (ou a qualquer modelo, tingindo a cor base dos materiais).
// A prévia do menu e o personagem em partida usam a MESMA paleta e a MESMA regra de "automática": quando os dois
// lutadores usam o mesmo modelo, o segundo recebe vermelho para não ficarem idênticos (comportamento antigo mantido).
import * as T from 'three';

/** Paleta escolhida para leitura rápida em arena escura. */
export const FIGHTER_COLORS = [
  {id: 'blue', label: 'Azul', hex: '#3f7cff'},
  {id: 'red', label: 'Vermelho', hex: '#ff4d47'},
  {id: 'yellow', label: 'Amarelo', hex: '#ffd23f'},
  {id: 'purple', label: 'Roxo', hex: '#a45cff'},
];
/** Opção padrão: só tinge quando os dois usam o mesmo modelo. */
export const AUTO_COLOR = {id: 'auto', label: 'Automática', hex: null};
export const COLOR_OPTIONS = [AUTO_COLOR, ...FIGHTER_COLORS];
export const COLOR_IDS = COLOR_OPTIONS.map(c => c.id);
const HEX = new Map(FIGHTER_COLORS.map(c => [c.id, c.hex]));
/** Mistura com a cor base: modelos com textura ficam mais discretos; sem textura, a cor do time domina. */
export const TINT_STRENGTH = {plain: .88, textured: .6};

export const isColorId = id => COLOR_IDS.includes(id);
/** Hex da cor, ou null para "sem tingimento" (automática sem conflito). */
export const colorHex = id => HEX.get(id) ?? null;

/** Dois "nomes de modelo" iguais = mesmo personagem (mesma regra usada pelo menu). */
export const sameModel = (a, b) => !!a && !!b && (a === b || (!!a.name && a.name === b.name));

/**
 * Cor EFETIVA de um espaço. `pick`/`otherPick` são as escolhas ('auto' | 'blue' | ...).
 * - escolha explícita vale sempre;
 * - 'auto' no segundo lutador (slot 1) vira vermelho quando os modelos são iguais;
 * - se o primeiro já escolheu vermelho, a automática do segundo usa azul (nunca os dois iguais);
 * - 'auto' no primeiro lutador não tinge (mantém o modelo original).
 */
export function effectiveColor(slot, pick, otherPick, same) {
  const own = isColorId(pick) ? pick : 'auto';
  if (own !== 'auto') return own;
  if (!same || slot !== 1) return null;
  return isColorId(otherPick) && otherPick === 'red' ? 'blue' : 'red';
}

/** Cor final de um material: base preservada e aproximada da cor do lutador. */
export function tintColor(baseHex, targetHex, hasMap = false) {
  const base = new T.Color(baseHex ?? 0xffffff);
  if (!targetHex) return base;
  return base.lerp(new T.Color(targetHex), hasMap ? TINT_STRENGTH.textured : TINT_STRENGTH.plain);
}
