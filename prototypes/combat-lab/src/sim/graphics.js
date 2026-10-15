// Perfis gráficos: mudam SÓ parâmetros de desempenho visual (resolução de renderização, limite e quantidade de
// partículas, estilo da sombra). Nunca física, dano, stamina, IA, tempos das ações ou regras — verificado nos testes.
import {C, vfxDefaults} from './config.js';

/** Parâmetros que um perfil gráfico pode tocar (lista fechada). */
const COUNT_KEYS = {hit: 'count', dodge: 'count', sprint: 'density', block: 'count', perfect: 'count', ground: 'density', clash: 'count', exhaust: 'count', regen: 'count'};
export const GRAPHICS_PATHS = ['extras.visual.renderPixelRatio', 'vfx.master.maxParticles', 'display.shadow.style', ...Object.entries(COUNT_KEYS).map(([t, k]) => `vfx.${t}.${k}`)];
const base = vfxDefaults();
const scaled = k => Object.fromEntries(Object.entries(COUNT_KEYS).map(([t, key]) => {const v = base[t][key];return [`vfx.${t}.${key}`, key === 'density' ? +(v * k).toFixed(2) : Math.max(1, Math.round(v * k))];}));
export const GRAPHICS_PROFILES = [
  {id: 'low', label: 'Baixo', description: 'Resolução 1×, até 300 partículas, ~40% das partículas por efeito, sombra circular simples.', values: {'extras.visual.renderPixelRatio': 1, 'vfx.master.maxParticles': 300, 'display.shadow.style': 1, ...scaled(.4)}},
  {id: 'mid', label: 'Médio', description: 'Resolução 1,5×, até 800 partículas, ~70% das partículas por efeito, sombra suave.', values: {'extras.visual.renderPixelRatio': 1.5, 'vfx.master.maxParticles': 800, 'display.shadow.style': 2, ...scaled(.7)}},
  {id: 'high', label: 'Alto', description: 'Padrão do laboratório: resolução até 2×, 1400 partículas, quantidades completas, sombra suave.', values: {'extras.visual.renderPixelRatio': 2, 'vfx.master.maxParticles': 1400, 'display.shadow.style': 2, ...scaled(1)}},
];
const get = p => p.split('.').reduce((o, k) => o?.[k], C);
/** Perfil em uso (ou 'custom' quando algum parâmetro gráfico foi ajustado à mão). */
export function detectProfile(values = null) {
  const v = p => values ? values[p] : get(p);
  return GRAPHICS_PROFILES.find(pr => Object.entries(pr.values).every(([p, x]) => Math.abs(v(p) - x) < 1e-9))?.id ?? 'custom';
}
export const isGraphicsPath = p => GRAPHICS_PATHS.includes(p);
