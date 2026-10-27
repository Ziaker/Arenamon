import {validateProject} from './validation';
import type {VfxProject} from './types';

export function snapshotProject(input: VfxProject): Readonly<VfxProject> {
  const validation = validateProject(input);
  if (!validation.ok) throw new Error(validation.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
  const copy: VfxProject = JSON.parse(JSON.stringify(input));
  const freeze = (value: unknown): void => {
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
  };
  freeze(copy);
  return copy;
}
