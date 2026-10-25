import {phases, type Phase} from './config.ts';

// Relógio de fases desligáveis (docs/PADRAO_ATELIES_VFX.md §1.1). Cada efeito declara as janelas (em segundos, no tempo próprio dele) das fases
// que tem; o relógio costura só as fases LIGADAS: a desligada não executa, não ocupa tempo e nunca aparece na legenda.
/** `freeze`: segundos de permanência em que o efeito fica PARADO no instante `from` (duração em cena sem avançar o tempo do efeito); `to` = `from`. */
export type Span = {id: Phase; from: number; to: number; freeze?: number};
type Seg = {id: Phase; outFrom: number; effFrom: number; len: number; frozen: boolean};

/** Fases ligadas, na ordem do padrão. Valor ausente = ligada (presets antigos não têm os interruptores). */
export function enabledPhases(values: Record<string, number>): Phase[] {
  return phases.filter(p => values[p + 'On'] !== 0);
}

export class PhaseClock {
  readonly duration: number;
  readonly nothingToShow: boolean;
  private readonly segs: Seg[] = [];
  constructor(spans: Span[], values: Record<string, number>) {
    const on = new Set(enabledPhases(values));
    let acc = 0;
    for (const s of [...spans].sort((a, b) => a.from - b.from)) {
      if (!on.has(s.id)) continue;
      if ((s.freeze ?? 0) > 0) {this.segs.push({id: s.id, outFrom: acc, effFrom: s.from, len: s.freeze!, frozen: true});acc += s.freeze!;continue;}
      if (s.to <= s.from) continue;
      this.segs.push({id: s.id, outFrom: acc, effFrom: s.from, len: s.to - s.from, frozen: false});
      acc += s.to - s.from;
    }
    this.duration = acc;
    this.nothingToShow = this.segs.length === 0;
  }
  private seg(t: number): Seg | null {
    if (this.nothingToShow) return null;
    const x = Math.min(Math.max(0, t), this.duration);
    for (let i = this.segs.length - 1; i >= 0; i--) if (x >= this.segs[i].outFrom) return this.segs[i];
    return this.segs[0];
  }
  /** Tempo do efeito que corresponde ao tempo `t` da reprodução (pula as fases desligadas). */
  map(t: number): number {
    const s = this.seg(t);
    if (!s) return 0;
    const x = Math.min(Math.max(0, t), this.duration);
    return s.frozen ? s.effFrom : s.effFrom + Math.min(x - s.outFrom, s.len);
  }
  /** Fase ativa em `t`; nunca devolve uma fase desligada. */
  phaseAt(t: number): Phase | null {
    return this.seg(t)?.id ?? null;
  }
}
