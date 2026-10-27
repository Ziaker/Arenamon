import type {AuthoringFps, AuthoringSettings, MaterialGraph, TextureDocument, Vec3, VfxProject, VisualNode, VisualTrack, VisualTransform} from '../core/types';
import {validateProject} from '../core/validation';
import {createPathGeometry} from './geometry';
import type {ParticleEmitter} from '../particles/particles';

interface EditorState {project: VfxProject; selectedId: string | null}
type TransformPatch = Partial<VisualTransform>;

// O documento já passou pelo contrato JSON da F0; manter o núcleo sem APIs DOM/Node.
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const withDefaults = (project: VfxProject): VfxProject => {const value = clone(project); value.timeline.duration ??= 2; value.timeline.events ??= []; value.textures ??= []; value.materials ??= []; value.particles ??= []; return value;};
const state = (project: VfxProject, selectedId: string | null): EditorState => ({project: clone(project), selectedId});
const finiteVec3 = (value: Vec3): boolean => value.length === 3 && value.every(Number.isFinite);

export class DocumentStore {
  #project: VfxProject;
  #selectedId: string | null = null;
  #undo: EditorState[] = [];
  #redo: EditorState[] = [];
  #transactionDepth = 0;
  #transactionStart: EditorState | null = null;

  constructor(project: VfxProject, readonly historyLimit = 100) {
    if (!Number.isSafeInteger(historyLimit) || historyLimit < 1 || historyLimit > 1000) throw new Error('Limite de histórico inválido');
    const checked = validateProject(project);
    if (!checked.ok) throw new Error(`Projeto inválido: ${checked.issues[0]?.path}`);
    this.#project = withDefaults(checked.value);
  }

  get project(): VfxProject { return clone(this.#project); }
  get selectedId(): string | null { return this.#selectedId; }

  addNode(node: VisualNode): void {
    this.#change(project => { project.nodes.push(node); }, node.id);
  }

  replaceProject(project: unknown): void {
    const checked = validateProject(project);
    if (!checked.ok) throw new Error(`Projeto importado inválido: ${checked.issues[0]?.path}`);
    const before = state(this.#project, this.#selectedId);
    const candidate = withDefaults(checked.value);
    candidate.revision = Math.max(candidate.revision, this.#project.revision + 1);
    this.#pushUndo(before);
    this.#redo = [];
    this.#project = candidate;
    this.#selectedId = null;
  }

  setTransform(id: string, patch: TransformPatch): void {
    for (const [key, value] of Object.entries(patch) as [keyof VisualTransform, Vec3][]) {
      if (!finiteVec3(value) || (key === 'scale' && value.some(component => component <= 0))) throw new Error('Transform exige vetor finito e escala positiva');
    }
    this.#change(project => {
      const node = project.nodes.find(candidate => candidate.id === id);
      if (!node) throw new Error(`Nó ausente: ${id}`);
      if (node.locked) throw new Error(`Nó travado: ${id}`);
      const current: VisualTransform = node.transform ?? {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]};
      node.transform = {...current, ...clone(patch)};
    }, id);
  }

  setPivot(id: string, pivot: Vec3): void {
    if (!finiteVec3(pivot)) throw new Error('Pivô exige vetor finito');
    this.#change(project => {
      const node = project.nodes.find(candidate => candidate.id === id);
      if (!node?.geometry) throw new Error(`Geometria ausente: ${id}`);
      if (node.locked) throw new Error(`Nó travado: ${id}`);
      node.pivot = clone(pivot);
    }, id);
  }

  setPathPoint(id: string, index: number, point: Vec3, snap?: number): void {
    if (!finiteVec3(point)) throw new Error('Vértice exige vetor finito');
    this.#change(project => {
      const node = project.nodes.find(candidate => candidate.id === id);
      if (!node?.geometry || node.geometry.kind === 'box' || node.geometry.kind === 'sphere' || node.geometry.kind === 'plane') throw new Error(`Caminho ausente: ${id}`);
      if (node.locked) throw new Error(`Nó travado: ${id}`);
      if (!Number.isSafeInteger(index) || index < 0 || index >= node.geometry.points.length) throw new Error('Índice de vértice inválido');
      const points = clone(node.geometry.points);
      points[index] = clone(point);
      node.geometry = createPathGeometry(node.geometry.kind, points, {width: node.geometry.width, endWidth: node.geometry.endWidth, extrusion: node.geometry.extrusion, closed: node.geometry.closed, snap});
    }, id);
  }

  insertPathPoint(id: string, afterIndex: number, point: Vec3, snap?: number): void {
    if (!finiteVec3(point)) throw new Error('Vértice exige vetor finito');
    this.#change(project => {
      const node = project.nodes.find(candidate => candidate.id === id);
      if (!node?.geometry || node.geometry.kind === 'box' || node.geometry.kind === 'sphere' || node.geometry.kind === 'plane') throw new Error(`Caminho ausente: ${id}`);
      if (node.locked) throw new Error(`Nó travado: ${id}`);
      if (!Number.isSafeInteger(afterIndex) || afterIndex < 0 || afterIndex >= node.geometry.points.length) throw new Error('Índice de vértice inválido');
      const points = clone(node.geometry.points);
      points.splice(afterIndex + 1, 0, clone(point));
      node.geometry = createPathGeometry(node.geometry.kind, points, {width: node.geometry.width, endWidth: node.geometry.endWidth, extrusion: node.geometry.extrusion, closed: node.geometry.closed, snap});
    }, id);
  }

  removePathPoint(id: string, index: number): void {
    this.#change(project => {
      const node = project.nodes.find(candidate => candidate.id === id);
      if (!node?.geometry || node.geometry.kind === 'box' || node.geometry.kind === 'sphere' || node.geometry.kind === 'plane') throw new Error(`Caminho ausente: ${id}`);
      if (node.locked) throw new Error(`Nó travado: ${id}`);
      if (!Number.isSafeInteger(index) || index < 0 || index >= node.geometry.points.length) throw new Error('Índice de vértice inválido');
      if (node.geometry.points.length <= 2) throw new Error('O caminho precisa manter ao menos dois pontos');
      const points = clone(node.geometry.points);
      points.splice(index, 1);
      node.geometry = createPathGeometry(node.geometry.kind, points, {width: node.geometry.width, endWidth: node.geometry.endWidth, extrusion: node.geometry.extrusion, closed: node.geometry.closed});
    }, id);
  }

  setPathExtrusion(id: string, extrusion: number): void {
    if (!Number.isFinite(extrusion) || extrusion <= 0 || extrusion > 100) throw new Error('Extrusão deve ser finita entre 0 e 100 m');
    this.#change(project => {
      const node = project.nodes.find(candidate => candidate.id === id);
      if (!node?.geometry || node.geometry.kind !== 'ribbon') throw new Error('Extrusão é exclusiva de Ribbon');
      if (node.locked) throw new Error(`Nó travado: ${id}`);
      node.geometry.extrusion = extrusion;
    }, id);
  }

  setPathTaper(id: string, endWidth: number): void {
    if (!Number.isFinite(endWidth) || endWidth <= 0 || endWidth > 100) throw new Error('Largura final deve ser finita entre 0 e 100 m');
    this.#change(project => {
      const node = project.nodes.find(candidate => candidate.id === id);
      if (!node?.geometry || node.geometry.kind !== 'ribbon') throw new Error('Largura final é exclusiva de Ribbon');
      if (node.locked) throw new Error(`Nó travado: ${id}`);
      node.geometry.endWidth = endWidth;
    }, id);
  }

  setLocked(id: string, locked: boolean): void {
    this.#change(project => {
      const node = project.nodes.find(candidate => candidate.id === id);
      if (!node) throw new Error(`Nó ausente: ${id}`);
      node.locked = locked;
    }, id);
  }

  setAuthoringSettings(settings: AuthoringSettings): void {
    this.#change(project => { project.authoring = clone(settings); }, this.#selectedId);
  }

  setTimelineFps(fps: AuthoringFps): void { this.#change(project => {project.timeline.fps = fps;}, this.#selectedId); }
  setTimelineDuration(duration: number): void { this.#change(project => {project.timeline.duration = duration;}, this.#selectedId); }
  upsertTrack(track: VisualTrack): void { this.#change(project => {const index = project.timeline.tracks.findIndex(item => item.id === track.id); if (index < 0) project.timeline.tracks.push(clone(track)); else project.timeline.tracks[index] = clone(track);}, track.targetId); }
  upsertTexture(texture: TextureDocument): void { this.#change(project => {project.textures ??= []; const index = project.textures.findIndex(item => item.id === texture.id); if (index < 0) project.textures.push(clone(texture)); else project.textures[index] = clone(texture);}, this.#selectedId); }
  removeTexture(id: string): void { this.#change(project => {project.textures = (project.textures ?? []).filter(item => item.id !== id);}, this.#selectedId); }
  upsertMaterial(material: MaterialGraph): void { this.#change(project => {project.materials ??= []; const index = project.materials.findIndex(item => item.id === material.id); if (index < 0) project.materials.push(clone(material)); else project.materials[index] = clone(material);}, this.#selectedId); }
  removeMaterial(id: string): void { this.#change(project => {project.materials = (project.materials ?? []).filter(item => item.id !== id);}, this.#selectedId); }
  upsertEmitter(emitter: ParticleEmitter): void { this.#change(project => {project.particles ??= []; const index = project.particles.findIndex(item => item.id === emitter.id); if (index < 0) project.particles.push(clone(emitter)); else project.particles[index] = clone(emitter);}, this.#selectedId); }
  removeEmitter(id: string): void { this.#change(project => {project.particles = (project.particles ?? []).filter(item => item.id !== id);}, this.#selectedId); }
  setAccessibility(patch: {noFlash?: boolean; reduceMotion?: boolean}): void { this.#change(project => {project.accessibility = {...project.accessibility, ...patch};}, this.#selectedId); }

  removeNode(id: string): void {
    this.#change(project => {
      const removed = new Set([id]);
      const target = project.nodes.find(node => node.id === id);
      if (target?.locked) throw new Error(`Nó travado: ${id}`);
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of project.nodes) if (node.parentId && removed.has(node.parentId) && !removed.has(node.id)) {removed.add(node.id); changed = true;}
      }
      project.nodes = project.nodes.filter(node => !removed.has(node.id));
      project.timeline.tracks = project.timeline.tracks.filter(track => !removed.has(track.targetId));
      for (const phase of Object.values(project.phases)) phase.tracks = phase.tracks.filter(track => !removed.has(track.targetId));
      project.subeffects = project.subeffects.filter(effect => !effect.parentId || !removed.has(effect.parentId));
    }, this.#selectedId === id ? null : this.#selectedId);
  }

  transaction(_label: string, operation: () => void): void {
    const outer = this.#transactionDepth === 0;
    let completed = false;
    if (outer) this.#transactionStart = state(this.#project, this.#selectedId);
    this.#transactionDepth++;
    try { operation(); completed = true; }
    catch (error) {
      if (outer && this.#transactionStart) this.#restore(this.#transactionStart, false);
      throw error;
    } finally {
      this.#transactionDepth--;
      if (outer) {
        if (completed && this.#transactionStart && (JSON.stringify(this.#transactionStart.project) !== JSON.stringify(this.#project) || this.#transactionStart.selectedId !== this.#selectedId)) this.#pushUndo(this.#transactionStart);
        this.#transactionStart = null;
      }
    }
  }

  undo(): boolean {
    const previous = this.#undo.pop();
    if (!previous) return false;
    this.#redo.push(state(this.#project, this.#selectedId));
    this.#restore(previous, true);
    return true;
  }

  redo(): boolean {
    const next = this.#redo.pop();
    if (!next) return false;
    this.#undo.push(state(this.#project, this.#selectedId));
    this.#restore(next, true);
    return true;
  }

  #change(mutator: (project: VfxProject) => void, selectedId: string | null): void {
    const before = state(this.#project, this.#selectedId);
    const candidate = clone(this.#project);
    mutator(candidate);
    if (JSON.stringify(candidate) === JSON.stringify(this.#project)) { this.#selectedId = selectedId; return; }
    candidate.revision = this.#project.revision + 1;
    const checked = validateProject(candidate);
    if (!checked.ok) throw new Error(`Edição inválida: ${checked.issues[0]?.path} — ${checked.issues[0]?.message}`);
    if (!this.#transactionDepth) this.#pushUndo(before);
    this.#redo = [];
    this.#project = clone(checked.value);
    this.#selectedId = selectedId;
  }

  #pushUndo(value: EditorState): void {
    this.#undo.push(value);
    if (this.#undo.length > this.historyLimit) this.#undo.splice(0, this.#undo.length - this.historyLimit);
  }

  #restore(value: EditorState, advanceRevision: boolean): void {
    const revision = this.#project.revision;
    this.#project = clone(value.project);
    if (advanceRevision) this.#project.revision = revision + 1;
    this.#selectedId = value.selectedId;
  }
}
