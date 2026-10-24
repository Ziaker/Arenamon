// Resultado da prévia (docs/PADRAO_ATELIES_VFX.md §2: Finalização × Impacto): 0 = acerta o alvo (Impacto), 1 = expira sem acertar (Finalização:
// o efeito se dissipa no alcance máximo), 2 = interrompido no caminho (para a 60% do trajeto e se dissipa, sem contato).
export type Outcome = {res: 0 | 1 | 2; hits: boolean; reach: number};
export function outcomeOf(p: Record<string, number>): Outcome {
  const r = Math.max(0, Math.min(2, Math.round(p.outcome ?? 0))) as 0 | 1 | 2;
  return {res: r, hits: r === 0, reach: r === 2 ? .6 : 1};
}
