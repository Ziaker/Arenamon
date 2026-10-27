import type {VfxProject} from '../core/types';
import {recoverProject, saveRecoverable, type ProjectStorage} from '../persistence/recovery';

export type AutosaveResult = {status: 'saved'; revision: number} | {status: 'skipped'; revision: number};

export class AutosaveManager {
  #lastSavedRevision = 0;

  constructor(private readonly storage: ProjectStorage, readonly projectId: string) {
    if (!projectId.trim()) throw new Error('projectId obrigatório');
  }

  save(project: VfxProject): AutosaveResult {
    if (project.projectId !== this.projectId) throw new Error('Projeto diferente do autosave');
    if (project.revision <= this.#lastSavedRevision) return {status: 'skipped', revision: project.revision};
    saveRecoverable(this.storage, project);
    this.#lastSavedRevision = project.revision;
    return {status: 'saved', revision: project.revision};
  }

  load(): {project: VfxProject; recovered: boolean} {
    const result = recoverProject(this.storage, this.projectId);
    if (!result.ok) throw new Error(result.message);
    // Após fallback, a revisão recuperada volta a ser a base autoritativa da sessão.
    this.#lastSavedRevision = result.project.revision;
    return {project: result.project, recovered: result.recovered};
  }
}
