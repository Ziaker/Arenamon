export type Density = 'reference-80' | 'compact' | 'enlarged';
export type WorkspacePreset = 'modeling' | 'animation' | 'materials' | 'particles' | 'custom';

export interface TutorialSessionRef {lessonId: string; stepId: string; projectId: string; autosaveSlot: string}
export interface UiLayoutSnapshot {workspace: Exclude<WorkspacePreset, 'custom'>; paneSizes: UiPreferencesV1['paneSizes']; collapsedPanes: string[]}
export interface UiPreferenceStorage {getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void}
export interface UiPreferencesV1 {
  version: 1;
  density: Density;
  workspace: WorkspacePreset;
  paneSizes: {hierarchy: number; inspector: number; timeline: number};
  collapsedPanes: string[];
  inspectorGroups: Record<string, string[]>;
  academy: {open: boolean; activeSession: TutorialSessionRef | null};
  customLayout: UiLayoutSnapshot | null;
  viewportMaximized: boolean;
}

export const UI_PREFERENCES_KEY = 'arenamon.vfx.ui.v1';
export const DEFAULT_UI_PREFERENCES: Readonly<UiPreferencesV1> = Object.freeze({
  version: 1, density: 'reference-80', workspace: 'modeling',
  paneSizes: {hierarchy: 260, inspector: 370, timeline: 164},
  collapsedPanes: [], inspectorGroups: {}, academy: {open: false, activeSession: null},
  customLayout: null, viewportMaximized: false,
});

const clamp = (value: unknown, min: number, max: number, fallback: number): number => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback));
const cloneDefaults = (): UiPreferencesV1 => structuredClone(DEFAULT_UI_PREFERENCES);

export function loadUiPreferences(storage?: UiPreferenceStorage): UiPreferencesV1 {
  let input: Record<string, unknown> = {};
  try { input = JSON.parse(storage?.getItem(UI_PREFERENCES_KEY) ?? '{}') as Record<string, unknown>; } catch { return cloneDefaults(); }
  const defaults = cloneDefaults();
  const sizes = typeof input.paneSizes === 'object' && input.paneSizes ? input.paneSizes as Record<string, unknown> : {};
  const density = ['reference-80', 'compact', 'enlarged'].includes(String(input.density)) ? input.density as Density : defaults.density;
  const workspace = ['modeling', 'animation', 'materials', 'particles', 'custom'].includes(String(input.workspace)) ? input.workspace as WorkspacePreset : defaults.workspace;
  return {
    ...defaults, density, workspace,
    paneSizes: {
      hierarchy: clamp(sizes.hierarchy, 180, 520, defaults.paneSizes.hierarchy),
      inspector: clamp(sizes.inspector, 180, 520, defaults.paneSizes.inspector),
      timeline: clamp(sizes.timeline, 96, 480, defaults.paneSizes.timeline),
    },
    collapsedPanes: Array.isArray(input.collapsedPanes) ? input.collapsedPanes.filter(value => typeof value === 'string') : [],
    inspectorGroups: typeof input.inspectorGroups === 'object' && input.inspectorGroups ? input.inspectorGroups as Record<string, string[]> : {},
    academy: typeof input.academy === 'object' && input.academy ? {...defaults.academy, ...(input.academy as UiPreferencesV1['academy']), open: Boolean((input.academy as {open?: unknown}).open)} : defaults.academy,
    customLayout: typeof input.customLayout === 'object' && input.customLayout ? input.customLayout as UiLayoutSnapshot : null,
    viewportMaximized: Boolean(input.viewportMaximized),
  };
}

export function saveUiPreferences(storage: UiPreferenceStorage | undefined, value: UiPreferencesV1): void {
  try { storage?.setItem(UI_PREFERENCES_KEY, JSON.stringify(value)); } catch { /* file:// or private storage may be unavailable */ }
}
