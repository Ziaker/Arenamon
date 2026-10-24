import {phases, phaseNames, phaseOf, isToggle, isUsed, type Category, type Control, type Phase} from './config.ts';

// Modelo PURO do painel (sem DOM): agrupa os controles por fase, com o interruptor «Ligar esta fase» de cada uma, e diz quais sliders do disparo
// aparecem para o efeito escolhido. A interface (main.js) só desenha o que este modelo devolve.
export type PanelGroup = {phase: Phase; title: string; toggle: Control | null; controls: Control[]};

/** Fases que NÃO se aplicam à categoria (o interruptor fica desabilitado, com a razão). Rocha é inspeção de objeto, não um ataque. */
export const notApplicable: Partial<Record<Category, {phases: Phase[]; reason: string}>> = {
  rock: {phases: ['start', 'launch', 'body', 'finish', 'impact'], reason: 'Não se aplica: a rocha é um modelo para inspeção, não um ataque; só existe a fase de duração em cena.'},
};

/** Agrupa por fase. Com `category`, esconde os controles que NÃO se aplicam à categoria/proposta (notUsed em config.ts): slider sem efeito seria «morto». */
export function buildPanel(defs: readonly Control[], category?: Category, variant = 0): PanelGroup[] {
  const shown = category ? defs.filter(d => isUsed(category, variant, d[0])) : defs;
  return phases.map(phase => ({
    phase, title: phaseNames[phase],
    toggle: defs.find(d => d[0] === phase + 'On') ?? null,
    controls: shown.filter(d => !isToggle(d[0]) && phaseOf(d[0]) === phase),
  }));
}

const RING_ONLY = ['shotThickness'];
const CONE_ONLY = ['shotAngleH', 'shotAngleV', 'shotCount', 'shotParticleSize', 'shotParticleLife', 'shotConeAngle'];
const WIND_ONLY = ['shotWindBlades', 'shotBladeCurve', 'shotSnapTime', 'shotContour', 'shotBladeWidth', 'shotFan'];
const JET_ONLY = ['shotCavitation', 'shotJetPressure', 'shotContraction'];
const STAR_ONLY = ['shotCrossArms', 'shotCrossAngle', 'shotCoreGlow', 'shotCrossSparks', 'shotCoreThickness'];

/** Só aparecem os sliders do efeito de disparo escolhido (0 Nenhum, 1 Argola, 2 Tiro em cone, 3 Burst anime, 4 Jato pressurizado, 5 Impacto estelar); os valores ficam guardados ao trocar. */
export function shotKeyVisible(key: string, kind: number): boolean {
  if (key === 'shotKind' || key.startsWith('shotRecoil') || key === 'shotDelay' || !key.startsWith('shot')) return true;   // Recoil & Flash soma a qualquer opção, inclusive «Nenhum»
  if (kind === 0) return false;
  if (RING_ONLY.includes(key)) return kind === 1;
  if (CONE_ONLY.includes(key)) return kind === 2;
  if (WIND_ONLY.includes(key)) return kind === 3;
  if (JET_ONLY.includes(key)) return kind === 4;
  if (STAR_ONLY.includes(key)) return kind === 5;
  if (key === 'shotTime') return kind !== 3;
  if (key === 'shotFocalDist' || key === 'shotTaperProfile' || key === 'shotFocalOffset') return kind === 2 || kind === 4;
  if (key === 'shotSquash') return kind === 1 || kind === 2 || kind === 4;
  if (key === 'shotRadiusEnd') return kind === 2 || kind === 3 || kind === 4;
  if (key === 'shotRadius') return kind === 1 || kind === 2 || kind === 3 || kind === 4;
  if (key === 'shotLength') return kind === 2 || kind === 3 || kind === 4;
  return true;
}

/** Rótulos dos seletores (controles de poucos valores inteiros). */
export const selectorLabels: Record<string, string[]> = {
  shotTaperProfile: ['Linear (cone reto)', 'Parabólico (bico de alta pressão)', 'Exponencial (ponta afiada)'],
  shotKind: ['Nenhum', 'Argola', 'Tiro em cone', 'Burst de vento anime', 'Jato pressurizado', 'Impacto estelar'],
  scenario: ['Acerto na janela → contra-ataque', 'Sem acerto → janela expira', 'Golpe tardio (0,62 s)', 'Guard Break → atravessa'],
  outcome: ['Acerta o alvo', 'Expira sem acertar', 'Interrompido no caminho'],
};
