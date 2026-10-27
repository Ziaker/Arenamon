import type {VfxProject} from '../core/types';

export function migrateProject(value: unknown): VfxProject | null {
  if (typeof value !== 'object' || value === null) return null;
  const schemaVersion = (value as {schemaVersion?: unknown}).schemaVersion;
  return schemaVersion === 1 ? value as VfxProject : null;
}
