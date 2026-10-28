import type {ParticleBudgetReport} from '../particles/particles';

export interface StatusInput {budget: ParticleBudgetReport; recoveryNotice: string; backend: string; autosave: 'saved' | 'pending' | 'error'}
export function statusViewModel(input: StatusInput) {
  const ratio = Math.min(1, input.budget.peak / 1000);
  const verdict = input.budget.verdict as typeof input.budget.verdict & {ok?: boolean};
  const publishable = verdict.ok ?? verdict.publishable;
  const level = input.budget.peak >= 800 || !publishable ? 'danger' : input.budget.peak >= 500 ? 'warning' : 'safe';
  const autosaveLabel = input.autosave === 'saved' ? 'salvo' : input.autosave === 'pending' ? 'salvando' : 'erro ao salvar';
  const recovery = input.recoveryNotice.trim();
  return {budget: {level, ratio, peak: input.budget.peak, emitters: input.budget.activeEmitters}, backend: input.backend, autosave: input.autosave, accessibleText: `${input.budget.peak} partículas, ${input.budget.activeEmitters} emissores; projeto ${autosaveLabel}; preview ${input.backend}${recovery ? `; ${recovery}` : ''}`};
}

export class StatusSurface {
  constructor(private readonly root: HTMLElement) {}
  update(input: StatusInput): void {
    const model = statusViewModel(input);
    this.root.setAttribute('aria-label', model.accessibleText);
    this.root.innerHTML = `<span class="status-save" data-state="${model.autosave}"><i></i>${model.autosave === 'saved' ? 'Salvo' : model.autosave === 'pending' ? 'Salvando' : 'Falha'}</span><span class="status-backend">Preview <strong>${model.backend}</strong></span><span class="status-budget" data-level="${model.budget.level}" title="${model.budget.peak} partículas em ${model.budget.emitters} emissores"><span>Orçamento</span><i><b style="width:${model.budget.ratio * 100}%"></b></i></span><details><summary>Detalhes</summary><span>${model.accessibleText}</span></details>`;
  }
}
