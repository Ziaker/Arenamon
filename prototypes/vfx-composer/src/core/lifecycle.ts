export type CancelReason = 'cancel' | 'disabled' | 'scene-reset' | 'missing-resource' | 'reset';
export type DissipationPolicy = Record<CancelReason, number>;
export const DEFAULT_DISSIPATION: Readonly<DissipationPolicy> = Object.freeze({cancel: 0.15, disabled: 0, 'scene-reset': 0, 'missing-resource': 0, reset: 0});

export class VisualLifecycle {
  private status: 'active' | 'cancelled' | 'cleaned' = 'active';
  private cancelReason: CancelReason | null = null;
  private remaining = 0;
  private resources: (() => void)[] = [];
  private readonly policy: DissipationPolicy;
  constructor(private readonly instanceId: string, policy: DissipationPolicy = DEFAULT_DISSIPATION) {
    for (const reason of Object.keys(DEFAULT_DISSIPATION) as CancelReason[]) {
      if (!Number.isFinite(policy[reason]) || policy[reason] < 0 || policy[reason] > 10) throw new Error('Duração de dissipação inválida');
    }
    this.policy = {...policy};
  }
  own(release: () => void): void {
    if (this.status !== 'active') throw new Error('Instância encerrando');
    this.resources.push(release);
  }
  cancel(reason: CancelReason): {changed: boolean} {
    if (!Object.hasOwn(this.policy, reason)) throw new Error('Motivo inválido');
    if (this.status !== 'active') return {changed: false};
    this.status = 'cancelled';
    this.cancelReason = reason;
    this.remaining = this.policy[reason];
    return {changed: true};
  }
  advance(seconds: number): {changed: boolean; errors: unknown[]} {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Tempo inválido');
    if (this.status !== 'cancelled') return {changed: false, errors: []};
    this.remaining = Math.max(0, this.remaining - seconds);
    return this.remaining === 0 ? this.cleanup() : {changed: false, errors: []};
  }
  cleanup(): {changed: boolean; errors: unknown[]} {
    if (this.status === 'cleaned') return {changed: false, errors: []};
    this.status = 'cleaned';
    const errors: unknown[] = [];
    const resources = this.resources; this.resources = [];
    for (const release of resources) {try {release();} catch (error) {errors.push(error);}}
    return {changed: true, errors};
  }
  snapshot() { return {instanceId: this.instanceId, status: this.status, cancelReason: this.cancelReason}; }
}
