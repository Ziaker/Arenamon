import {phases, phaseNames, phaseOf, isToggle, type Category, type Control, type Phase} from './config.ts';

// Modelo PURO do painel (sem DOM): agrupa os controles por fase, com o interruptor «Ligar esta fase» de cada uma, e diz quais sliders do disparo
// aparecem para o efeito escolhido. A interface (main.js) só desenha o que este modelo devolve.
export type PanelGroup = {phase: Phase; title: string; toggle: Control | null; controls: Control[]};

/** Fases que NÃO se aplicam à categoria (o interruptor fica desabilitado, com a razão). Rocha é inspeção de objeto, não um ataque. */
export const notApplicable: Partial<Record<Category, {phases: Phase[]; reason: string}>> = {
  rock: {phases: ['start', 'launch', 'body', 'finish', 'impact'], reason: 'Não se aplica: a rocha é um modelo para inspeção, não um ataque; só existe a fase de duração em cena.'},
};

export function buildPanel(defs: readonly Control[]): PanelGroup[] {
  return phases.map(phase => ({
    phase, title: phaseNames[phase],
    toggle: defs.find(d => d[0] === phase + 'On') ?? null,
    controls: defs.filter(d => !isToggle(d[0]) && phaseOf(d[0]) === phase),
  }));
}

const RING_ONLY = ['shotThickness', 'shotSquash'];
const CONE_ONLY = ['shotAngleH', 'shotAngleV', 'shotCount', 'shotLength', 'shotParticleSize', 'shotParticleLife'];
/** Só aparecem os sliders do efeito de disparo escolhido (0 Nenhum, 1 Argola, 2 Tiro em cone); os valores dos dois ficam guardados. */
export function shotKeyVisible(key: string, kind: number): boolean {
  if (key === 'shotKind' || !key.startsWith('shot')) return true;
  if (kind === 0) return false;
  if (RING_ONLY.includes(key)) return kind === 1;
  if (CONE_ONLY.includes(key)) return kind === 2;
  return true;
}

/** Rótulos dos seletores (controles de poucos valores inteiros). */
export const selectorLabels: Record<string, string[]> = {
  shotKind: ['Nenhum', 'Argola', 'Tiro em cone'],
  scenario: ['Acerto na janela → contra-ataque', 'Sem acerto → janela expira', 'Golpe tardio (0,62 s)', 'Guard Break → atravessa'],
  outcome: ['Acerta o alvo', 'Expira sem acertar', 'Interrompido no caminho'],
};
