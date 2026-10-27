import {compareVersions, parseVersion} from './version';
import {snapshotProject} from './snapshot';
import type {VfxProject} from './types';

export class ComponentCatalog {
  private entries = new Map<string, Readonly<VfxProject>>();
  private revisions = new Map<string, string[]>();
  register(version: string, project: VfxProject): void {
    if (!parseVersion(version)) throw new Error('Versão inválida');
    const snapshot = snapshotProject(project);
    const key = `${project.effectId}@${version}`;
    if (this.entries.has(key)) throw new Error('Versão publicada é imutável');
    this.entries.set(key, snapshot);
    this.revisions.set(project.effectId, [...(this.revisions.get(project.effectId) ?? []), version].sort(compareVersions));
  }
  get(effectId: string, version: string): Readonly<VfxProject> | null {return this.entries.get(`${effectId}@${version}`) ?? null;}
  latest(effectId: string): string | null {return this.revisions.get(effectId)?.at(-1) ?? null;}
  select(effectId: string, current: string, next: string, confirmed: boolean): string {
    if (!this.get(effectId, current) || !this.get(effectId, next)) throw new Error('Dependência ausente');
    return confirmed ? next : current;
  }
}
