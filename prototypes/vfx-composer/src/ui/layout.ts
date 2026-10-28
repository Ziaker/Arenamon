import type {Density, UiPreferencesV1, WorkspacePreset} from './preferences';
import {saveUiPreferences, type UiPreferenceStorage} from './preferences';

export const DENSITY_TOKENS: Record<Density, {scale: number; usesCssZoom: false}> = {
  'reference-80': {scale: 1.25, usesCssZoom: false}, compact: {scale: 1, usesCssZoom: false}, enlarged: {scale: 1.5, usesCssZoom: false},
};
export const clampPaneSizes = (sizes: UiPreferencesV1['paneSizes']): UiPreferencesV1['paneSizes'] => ({
  hierarchy: Math.min(520, Math.max(180, sizes.hierarchy)), inspector: Math.min(520, Math.max(180, sizes.inspector)), timeline: Math.min(480, Math.max(96, sizes.timeline)),
});
const PRESETS: Record<Exclude<WorkspacePreset, 'custom'>, Pick<UiPreferencesV1, 'paneSizes' | 'collapsedPanes'>> = {
  modeling: {paneSizes: {hierarchy: 260, inspector: 370, timeline: 164}, collapsedPanes: []},
  animation: {paneSizes: {hierarchy: 230, inspector: 330, timeline: 300}, collapsedPanes: []},
  materials: {paneSizes: {hierarchy: 220, inspector: 440, timeline: 150}, collapsedPanes: []},
  particles: {paneSizes: {hierarchy: 220, inspector: 460, timeline: 150}, collapsedPanes: []},
};
export const workspacePreset = (preset: Exclude<WorkspacePreset, 'custom'>) => structuredClone(PRESETS[preset]);

export class WorkspaceLayout {
  constructor(private root: HTMLElement, public preferences: UiPreferencesV1, private storage?: UiPreferenceStorage) { this.apply(); }
  private apply(): void {
    const sizes = clampPaneSizes(this.preferences.paneSizes);
    this.root.style.setProperty('--hierarchy-width', `${sizes.hierarchy}px`);
    this.root.style.setProperty('--inspector-width', `${sizes.inspector}px`);
    this.root.style.setProperty('--timeline-height', `${sizes.timeline}px`);
    this.root.dataset.density = this.preferences.density;
    this.root.classList.toggle('viewport-maximized', this.preferences.viewportMaximized);
  }
  applyPreset(preset: Exclude<WorkspacePreset, 'custom'>): void { Object.assign(this.preferences, workspacePreset(preset), {workspace: preset}); this.apply(); this.persist(); }
  maximizeViewport(): void { this.preferences.viewportMaximized = true; this.apply(); this.persist(); }
  restoreViewport(): void { this.preferences.viewportMaximized = false; this.apply(); this.persist(); }
  toggleViewport(): void { this.preferences.viewportMaximized ? this.restoreViewport() : this.maximizeViewport(); }
  resetLayout(): void { this.applyPreset('modeling'); }
  private persist(): void { saveUiPreferences(this.storage, this.preferences); }
  dispose(): void { /* DOM listeners are owned by the composition root */ }
}

export function mountWorkspaceLayout(root: HTMLElement, preferences: UiPreferencesV1, storage?: UiPreferenceStorage): WorkspaceLayout {
  const layout = new WorkspaceLayout(root, preferences, storage);
  root.querySelector('#maximize-viewport')?.addEventListener('click', () => layout.toggleViewport());
  return layout;
}
