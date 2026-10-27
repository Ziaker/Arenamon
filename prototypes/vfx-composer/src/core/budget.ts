import type {BudgetCost} from './types';

export type QualityProfile = 'low' | 'medium' | 'high';
export const BUDGET_LIMITS = Object.freeze({
  low: Object.freeze({particles: 400, lights: 0}),
  medium: Object.freeze({particles: 900, lights: 4}),
  high: Object.freeze({particles: 1400, lights: 16}),
});

export function evaluateBudget(profile: QualityProfile, cost: BudgetCost) {
  if (!Object.hasOwn(BUDGET_LIMITS, profile)) throw new Error('Perfil de qualidade inválido');
  const limits = BUDGET_LIMITS[profile];
  const over: (keyof BudgetCost)[] = (['particles', 'lights'] as const).filter(key => !Number.isSafeInteger(cost[key]) || cost[key] < 0 || cost[key] > limits[key]);
  if (!Number.isSafeInteger(cost.drawCalls) || cost.drawCalls < 0) over.push('drawCalls');
  return {publishable: over.length === 0, over, limits: {...limits}, performanceVerified: false as const};
}
