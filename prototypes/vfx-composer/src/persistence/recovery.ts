import {deserializeProject, serializeProject} from './serialization';
import type {VfxProject} from '../core/types';

export interface ProjectStorage {getItem(key: string): string | null; setItem(key: string, value: string): void}

// Dois slots: o snapshot válido anterior permanece disponível se a nova escrita falhar.
export function saveRecoverable(storage: ProjectStorage, project: VfxProject): void {
  const text = serializeProject(project);
  const key = `arenamon.vfx.${project.projectId}`;
  const current = storage.getItem(key);
  if (current !== null) {
    const previous = deserializeProject(current);
    if (previous.ok) {
      if (previous.value.projectId !== project.projectId || previous.value.revision >= project.revision) throw new Error('Revisão antiga ou conflitante');
      storage.setItem(`${key}.backup`, current);
    }
  }
  storage.setItem(key, text);
}

export function recoverProject(storage: ProjectStorage, projectId: string) {
  const key = `arenamon.vfx.${projectId}`;
  for (const slot of [key, `${key}.backup`]) {
    const text = storage.getItem(slot);
    if (text === null) continue;
    const parsed = deserializeProject(text);
    if (parsed.ok && parsed.value.projectId === projectId) return {ok: true as const, project: parsed.value, recovered: slot !== key};
  }
  return {ok: false as const, message: 'Nenhum snapshot válido; dados originais preservados'};
}
