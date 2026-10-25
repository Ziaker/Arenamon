// Modelo dos controles visuais dos Moves elementais (23/10/2026): quais sliders cada Move realmente usa, em subgrupos.
// A lista é a MESMA do Ateliê Elemental (elemental-lab/main.js): só entra o parâmetro que o desenho daquele Move lê, em vez de despejar todas as ~100 chaves
// de água, fogo e vento em todos os Moves (a maioria não fazia nada no Move errado). Dados puros: a marcação fica em moves-vfx-panel.js.
import {ELEMENTAL_CONTROLS, FIRE_CONTROLS, WATER_CONTROLS, SHOT_CONTROLS, SEED_CONTROLS, SHOT_RING_CONTROLS, SHOT_CONE_CONTROLS, CONTROL_HELP} from '../view/quarks/presets.js';

/** Tempo que as argolas/cones do disparo acompanham o projétil antes de ficarem soltas (parâmetro por Move e por variante). */
export const FOLLOW_ROW = ['shotFollowTime', 'Tempo de seguimento do efeito de disparo', 's', 0, 3, 0.01,
  'Quanto tempo os efeitos de saída do disparo (argolas, ondas de choque e cone) acompanham o projétil depois de nascer. Passado esse tempo, ficam soltos no ponto de saída. 0 = nascem soltos.'];

const SECTION_OF = {stretch: 'Núcleo e movimento', launchCount: 'Disparo das argolas', waterNose: 'Forma e faixas da água', trailRate: 'Gotas do rastro', contactDuration: 'Contato e explosão', shotDuration: 'Impacto do disparo', fireArms: 'Chamas do vórtice'};
const SUB_OF_SECTION = {'Núcleo e movimento': 'Efeito principal', 'Forma e faixas da água': 'Efeito principal', 'Gotas do rastro': 'Efeito principal', 'Chamas do vórtice': 'Efeito principal', 'Disparo das argolas': 'Disparo', 'Impacto do disparo': 'Disparo', 'Contato e explosão': 'Contato e explosão'};
export const MOVE_KEYS = {'water-pulse': 'waterPulse', 'fire-spin': 'fireSpin', 'air-slash': 'airSlash', 'seed-bomb': 'seedBomb'};
export const VARIANT_PATH = {waterPulse: 'waterVariant', fireSpin: 'fireVariant', airSlash: 'airVariant'};
/** Ordem de exibição dos subgrupos visuais. */
export const VISUAL_SUB_ORDER = ['Efeito principal', 'Base (todo o efeito)', 'Surgimento', 'Disparo', 'Voo', 'Rastro de folhas', 'Contato e explosão', 'Contato / explosão', 'Hit (cor e tremor)', 'Efeito do Move', 'Efeitos compartilhados'];

/**
 * Linhas de um Move elemental: [{sub, section, key, label, unit, min, max, step, help, shotKind}], nesta ordem.
 * `shotKind` marca as linhas do efeito de disparo da Seed Bomb ('ring' | 'cone'): os valores moram em shotRing/shotCone.
 * @param {string} move waterPulse | fireSpin | airSlash | seedBomb
 * @param {number} shotEffect Seed Bomb: 0 nenhum, 1 argola, 2 cone
 */
export function elementalRows(move, shotEffect = 0) {
  const rows = [];
  const push = (sub, section, c, extra = {}) => rows.push({sub, section, key: c[0], label: c[1], unit: c[2], min: c[3], max: c[4], step: c[5], help: c[6] ?? CONTROL_HELP[c[0]] ?? 'Ajusta a aparência deste parâmetro.', ...extra});
  if (move === 'seedBomb') {
    for (const c of SEED_CONTROLS) {
      const phase = c[7], sub = phase.startsWith('Base') ? 'Base (todo o efeito)' : phase;
      if (c[2] === 'eixo') continue;                      // eixo do giro: texto, não numérico (fica no padrão)
      if (c[0] === '__shotEffect') {
        rows.push({sub, section: null, key: '__shotEffect', label: c[1], unit: 'efeito', help: c[6]});
        push(sub, null, FOLLOW_ROW);
        if (shotEffect === 1) for (const r of SHOT_RING_CONTROLS) push(sub, 'Efeito de disparo · Argola', r, {shotKind: 'ring'});
        if (shotEffect === 2) for (const r of SHOT_CONE_CONTROLS) push(sub, 'Efeito de disparo · Tiro em cone', r, {shotKind: 'cone'});
        continue;
      }
      push(sub, null, c);
    }
    return rows;
  }
  const list = [...ELEMENTAL_CONTROLS, ...(move === 'fireSpin' ? FIRE_CONTROLS : move === 'waterPulse' ? WATER_CONTROLS : []), ...(['waterPulse', 'airSlash'].includes(move) ? SHOT_CONTROLS : [])];
  let section = 'Núcleo e movimento', followAdded = false;
  for (const c of list) {
    const key = c[0];
    if ((key === 'stretch' && move !== 'waterPulse') || (key === 'opening' && move !== 'fireSpin') || (key === 'contactSize' && !['waterPulse', 'airSlash'].includes(move))) continue;
    if (key === 'trail' && move !== 'airSlash') continue;
    if (key === 'spread' && move === 'fireSpin') continue;
    if (key === 'duration' && move === 'fireSpin') continue;   // no jogo a zona vive o tempo da simulação (Duração da zona), então este slider não teria efeito
    if (SECTION_OF[key]) section = SECTION_OF[key];
    const sub = key === 'contactSize' ? 'Contato e explosão' : SUB_OF_SECTION[section];
    if (sub === 'Disparo' && !followAdded) {followAdded = true;push('Disparo', section, FOLLOW_ROW);}
    push(sub, key === 'contactSize' ? 'Contato e explosão' : section, c);
  }
  rows.push({sub: 'Efeito principal', section: 'Cores', key: 'color', label: 'Cor principal', unit: 'cor', help: 'Cor principal do efeito.'}, {sub: 'Efeito principal', section: 'Cores', key: 'accent', label: 'Cor secundária', unit: 'cor', help: 'Cor secundária (realces) do efeito.'});
  return rows;
}

/** Limites de um slider seguindo a regra do ateliê: máximo ×5 (e mínimo ×5 quando negativo); ângulos em ±180°. O valor atual sempre cabe. */
export function sliderRange(row, value) {
  const angle = row.unit === '°';
  let mn = angle ? (row.min < 0 ? -180 : 0) : (row.min < 0 ? row.min * 5 : row.min);
  let mx = angle ? 180 : row.max * 5;
  if (typeof value === 'number') {mn = Math.min(mn, value);mx = Math.max(mx, value);}
  return {min: mn, max: mx};
}
