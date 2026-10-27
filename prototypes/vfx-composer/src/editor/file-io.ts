import type {VfxProject} from '../core/types';
import {deserializeProject, serializeProject} from '../persistence/serialization';

export interface ProjectFileAdapters {
  writeFile?: (suggestedName: string, text: string) => void | Promise<void>;
  download: (suggestedName: string, text: string) => void | Promise<void>;
}

export interface SaveProjectOptions {useFileSystem?: boolean}

const fileName = (project: VfxProject): string => `${project.projectId.replace(/[^A-Za-z0-9._-]+/g, '_')}.vfx-project.json`;

export function openProjectText(text: string): VfxProject {
  const result = deserializeProject(text);
  if (!result.ok) throw new Error(result.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
  return result.value;
}

export async function saveProjectFile(project: VfxProject, adapters: ProjectFileAdapters, options: SaveProjectOptions = {}): Promise<'file-system' | 'download'> {
  const text = serializeProject(project);
  const name = fileName(project);
  if (options.useFileSystem && adapters.writeFile) {
    await adapters.writeFile(name, text);
    return 'file-system';
  }
  await adapters.download(name, text);
  return 'download';
}
