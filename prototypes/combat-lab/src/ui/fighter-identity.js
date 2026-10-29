// Identidade visual dos dois lutadores FORA da simulação: a cor escolhida no pré-jogo (view/character-colors.js)
// vira rótulo, cor e símbolo do HUD da arena, dos cabeçalhos do menu e do indicador de recarga acelerada.
// Nada aqui altera regras: é só leitura do estado já aplicado por menu-quick.applyColors().
import {FIGHTER_COLORS, colorHex} from '../view/character-colors.js';

const BASE = ['JOGADOR', 'ADVERSÁRIO'];
const LABELS = new Map(FIGHTER_COLORS.map(c => [c.id, c.label.toUpperCase()]));
/** @type {{hex: string | null, label: string | null}[]} */
const state = [{hex: null, label: null}, {hex: null, label: null}];

/** Atualiza a identidade de um espaço. `colorId` = 'auto' | 'blue' | 'red' | 'yellow' | 'purple' | null. */
export function setFighterIdentity(slot, colorId) {
  if (slot !== 0 && slot !== 1) return;
  state[slot].hex = colorHex(colorId);
  state[slot].label = LABELS.get(colorId) ?? null;
}
/** Cor (hex) usada no HUD; null = o lutador mantém a cor original do modelo. */
export const fighterColorHex = slot => state[slot]?.hex ?? null;
/** Nome da cor em maiúsculas ("ROXO"); null quando não há tingimento. */
export const fighterColorLabel = slot => state[slot]?.label ?? null;
/** Símbolo que distingue os espaços SEM depender da cor (daltonismo, captura em preto e branco). */
export const fighterGlyph = slot => slot === 0 ? '◆' : '●';
/** Título do HUD: "JOGADOR · ROXO" ou só "JOGADOR" quando não há tingimento. */
export function fighterTitle(slot, {playerAI = false} = {}) {
  const base = slot === 0 && playerAI ? 'JOGADOR IA' : BASE[slot] ?? 'LUTADOR';
  const label = fighterColorLabel(slot);
  return label ? `${base} · ${label}` : base;
}
