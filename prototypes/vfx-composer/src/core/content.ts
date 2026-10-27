import {PHASE_NAMES, type ValidationIssue} from './types';
import {parseVersion} from './version';
import {validateTextureDocument} from '../textures/texture-document';
import {validateMaterialGraph} from '../materials/material-graph';
import {validateParticleEmitters} from '../particles/particles';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(v);
const properties = ['opacity', 'scale', 'visible', 'position.x', 'position.y', 'position.z', 'rotation.x', 'rotation.y', 'rotation.z', 'path.points'];

// Contrato F0 mínimo. Novos payloads das ferramentas exigem extensão explícita do schema.
export function validateContent(project: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fail = (path: string, message: string) => issues.push({path, message});
  const lists = new Map<string, Record<string, unknown>[]>();
  for (const [key, limit] of [['nodes', 2048], ['assets', 256], ['subeffects', 256], ['pinnedComponents', 256]] as const) {
    const raw = project[key];
    if (!Array.isArray(raw)) continue;
    if (raw.length > limit) {fail(key, `Limite de ${limit} excedido`); continue;}
    const entries: Record<string, unknown>[] = [];
    const ids = new Set<string>();
    raw.forEach((entry, i) => {
      const field = key === 'assets' ? 'assetId' : key === 'pinnedComponents' ? 'componentId' : 'id';
      if (!object(entry) || !id(entry[field])) {fail(`${key}.${i}`, 'ID estável obrigatório'); return;}
      if (ids.has(entry[field] as string)) fail(`${key}.${i}`, 'ID duplicado');
      ids.add(entry[field] as string); entries.push(entry);
    });
    lists.set(key, entries);
  }
  const nodes = lists.get('nodes') ?? [], assets = lists.get('assets') ?? [];
  const byId = new Map(nodes.map(node => [node.id, node]));
  const assetIds = new Set(assets.map(asset => asset.assetId));
  assets.forEach((asset, i) => {if (!['texture', 'mesh', 'reference'].includes(String(asset.kind))) fail(`assets.${i}.kind`, 'Tipo de asset inválido');});
  nodes.forEach((node, i) => {
    if (!['group', 'mesh', 'stroke', 'particles', 'material'].includes(String(node.kind))) fail(`nodes.${i}.kind`, 'Tipo de nó inválido');
    if (node.parentId !== null && !byId.has(node.parentId)) fail(`nodes.${i}.parentId`, 'Pai ausente');
    if (!Array.isArray(node.assetIds) || node.assetIds.some(ref => !assetIds.has(ref))) fail(`nodes.${i}.assetIds`, 'Referência de asset ausente');
    if (node.transform !== undefined) {
      if (!object(node.transform)) fail(`nodes.${i}.transform`, 'Transform inválido');
      else for (const key of ['position', 'rotation', 'scale'] as const) {
        const vector = node.transform[key];
        if (!Array.isArray(vector) || vector.length !== 3 || vector.some(value => typeof value !== 'number' || !Number.isFinite(value)) || (key === 'scale' && vector.some(value => value <= 0))) fail(`nodes.${i}.transform.${key}`, 'Vetor 3D finito obrigatório');
      }
    }
    if (node.pivot !== undefined && (!Array.isArray(node.pivot) || node.pivot.length !== 3 || node.pivot.some(value => typeof value !== 'number' || !Number.isFinite(value)))) fail(`nodes.${i}.pivot`, 'Pivô exige vetor 3D finito');
    if (node.locked !== undefined && typeof node.locked !== 'boolean') fail(`nodes.${i}.locked`, 'locked deve ser booleano');
    if (node.geometry !== undefined) {
      if (!object(node.geometry)) fail(`nodes.${i}.geometry`, 'Geometria inválida');
      else if (node.geometry.kind === 'box') {
        if (!Array.isArray(node.geometry.size) || node.geometry.size.length !== 3 || node.geometry.size.some(value => typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) fail(`nodes.${i}.geometry`, 'Geometria box exige tamanho 3D positivo');
      } else if (node.geometry.kind === 'sphere') {
        if (typeof node.geometry.radius !== 'number' || !Number.isFinite(node.geometry.radius) || node.geometry.radius <= 0 || node.geometry.radius > 100) fail(`nodes.${i}.geometry.radius`, 'Esfera exige raio positivo até 100 m');
      } else if (node.geometry.kind === 'plane') {
        if (!Array.isArray(node.geometry.size) || node.geometry.size.length !== 2 || node.geometry.size.some(value => typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100)) fail(`nodes.${i}.geometry.size`, 'Plano exige largura e altura positivas até 100 m');
      } else if (['stroke', 'curve', 'ribbon'].includes(String(node.geometry.kind))) {
        const points = node.geometry.points;
        if (!Array.isArray(points) || points.length < 2 || points.length > 4096 || points.some(point => !Array.isArray(point) || point.length !== 3 || point.some(value => typeof value !== 'number' || !Number.isFinite(value)))) fail(`nodes.${i}.geometry.points`, 'Caminho exige 2–4096 pontos 3D finitos');
        if (typeof node.geometry.width !== 'number' || !Number.isFinite(node.geometry.width) || node.geometry.width <= 0 || node.geometry.width > 100) fail(`nodes.${i}.geometry.width`, 'Largura inválida');
        if (node.geometry.endWidth !== undefined && (node.geometry.kind !== 'ribbon' || typeof node.geometry.endWidth !== 'number' || !Number.isFinite(node.geometry.endWidth) || node.geometry.endWidth <= 0 || node.geometry.endWidth > 100)) fail(`nodes.${i}.geometry.endWidth`, 'Largura final válida apenas para Ribbon entre 0 e 100 m');
        if (node.geometry.extrusion !== undefined && (node.geometry.kind !== 'ribbon' || typeof node.geometry.extrusion !== 'number' || !Number.isFinite(node.geometry.extrusion) || node.geometry.extrusion <= 0 || node.geometry.extrusion > 100)) fail(`nodes.${i}.geometry.extrusion`, 'Extrusão válida apenas para Ribbon entre 0 e 100 m');
        if (typeof node.geometry.closed !== 'boolean') fail(`nodes.${i}.geometry.closed`, 'closed deve ser booleano');
      } else fail(`nodes.${i}.geometry.kind`, 'Tipo de geometria inválido');
    }
    const seen = new Set<unknown>(); let current: Record<string, unknown> | undefined = node;
    while (current) {
      if (seen.has(current.id)) {fail(`nodes.${i}.parentId`, 'Ciclo na hierarquia'); break;}
      seen.add(current.id); current = byId.get(current.parentId);
    }
  });
  if (project.authoring !== undefined) {
    const authoring = project.authoring;
    if (!object(authoring) || !object(authoring.drawingPlane)) fail('authoring', 'Configuração autoral inválida');
    else {
      for (const key of ['origin', 'rotation'] as const) {
        const vector = authoring.drawingPlane[key];
        if (!Array.isArray(vector) || vector.length !== 3 || vector.some(value => typeof value !== 'number' || !Number.isFinite(value))) fail(`authoring.drawingPlane.${key}`, 'Vetor 3D finito obrigatório');
      }
      if (typeof authoring.mirrorX !== 'boolean') fail('authoring.mirrorX', 'deve ser booleano');
      if (!Number.isSafeInteger(authoring.radialCopies) || Number(authoring.radialCopies) < 1 || Number(authoring.radialCopies) > 12) fail('authoring.radialCopies', 'inteiro entre 1 e 12 obrigatório');
    }
  }
  const trackIds = new Set<string>();
  const tracks = (raw: unknown, path: string) => {
    if (!Array.isArray(raw)) return;
    if (raw.length > 1024) {fail(path, 'Limite de tracks excedido'); return;}
    raw.forEach((track, i) => {
      const p = `${path}.${i}`;
      if (!object(track) || !id(track.id)) {fail(p, 'Track inválida'); return;}
      if (trackIds.has(track.id)) fail(p, 'ID de track duplicado');
      trackIds.add(track.id);
      if (!byId.has(track.targetId)) fail(`${p}.targetId`, 'Alvo ausente');
      if (!properties.includes(String(track.property))) fail(`${p}.property`, 'Propriedade visual inválida');
      if (!Array.isArray(track.keyframes) || !track.keyframes.length || track.keyframes.length > 4096) {fail(p, 'Keyframes inválidos ou acima do limite'); return;}
      let previous = -1;
      let pathPointCount: number | null = null;
      const timelineDuration = path === 'timeline.tracks' && object(project.timeline) && typeof project.timeline.duration === 'number' ? project.timeline.duration : null;
      track.keyframes.forEach((frame, j) => {
        const pathValue = track.property === 'path.points';
        const validPath = Array.isArray(frame?.value) && frame.value.length >= 2 && frame.value.every((point: unknown) => Array.isArray(point) && point.length === 3 && point.every(value => typeof value === 'number' && Number.isFinite(value)));
        const validNumber = typeof frame?.value === 'number' && Number.isFinite(frame.value);
        const interpolation = String(frame?.interpolation);
        if (!object(frame) || typeof frame.time !== 'number' || !Number.isFinite(frame.time) || frame.time < 0 || frame.time > 3600 || (timelineDuration !== null && frame.time > timelineDuration) || frame.time <= previous || (pathValue ? !validPath || !['linear', 'step'].includes(interpolation) : !validNumber || !['linear', 'step', 'bezier'].includes(interpolation)) || (frame.inTangent !== undefined && (typeof frame.inTangent !== 'number' || !Number.isFinite(frame.inTangent))) || (frame.outTangent !== undefined && (typeof frame.outTangent !== 'number' || !Number.isFinite(frame.outTangent)))) {fail(`${p}.keyframes.${j}`, 'Keyframe inválido ou fora de ordem'); return;}
        if (pathValue) {const count = (frame.value as unknown[]).length; if (pathPointCount !== null && count !== pathPointCount) fail(`${p}.keyframes.${j}.value`, 'Topologia de morph incompatível'); pathPointCount = count;}
        previous = frame.time;
      });
    });
  };
  if (object(project.timeline)) tracks(project.timeline.tracks, 'timeline.tracks');
  if (object(project.timeline)) {
    if (project.timeline.duration !== undefined && (typeof project.timeline.duration !== 'number' || !Number.isFinite(project.timeline.duration) || project.timeline.duration <= 0 || project.timeline.duration > 3600)) fail('timeline.duration', 'Duração deve ficar entre 0 e 3600 segundos');
    if (project.timeline.events !== undefined) {const eventIds = new Set<string>(), duration = typeof project.timeline.duration === 'number' ? project.timeline.duration : 3600; if (!Array.isArray(project.timeline.events) || project.timeline.events.some(event => !object(event) || !id(event.id) || eventIds.has(event.id) || (eventIds.add(event.id), false) || typeof event.name !== 'string' || !event.name.trim() || typeof event.time !== 'number' || !Number.isFinite(event.time) || event.time < 0 || event.time > duration)) fail('timeline.events', 'Eventos de timeline inválidos ou duplicados');}
  }
  if (object(project.phases)) for (const name of PHASE_NAMES) {
    const phase = project.phases[name]; if (object(phase)) tracks(phase.tracks, `phases.${name}.tracks`);
  }
  const pins = new Map((lists.get('pinnedComponents') ?? []).map(pin => [pin.componentId, pin.version]));
  (lists.get('subeffects') ?? []).forEach((sub, i) => {
    if (!id(sub.componentId) || typeof sub.version !== 'string' || !parseVersion(sub.version) || pins.get(sub.componentId) !== sub.version) fail(`subeffects.${i}`, 'Subefeito deve referenciar versão fixada');
    if (sub.parentId !== null && !byId.has(sub.parentId)) fail(`subeffects.${i}.parentId`, 'Pai ausente');
    if (typeof sub.delay !== 'number' || !Number.isFinite(sub.delay) || sub.delay < 0 || sub.delay > 3600) fail(`subeffects.${i}.delay`, 'Atraso inválido');
  });
  const textures = project.textures;
  if (textures !== undefined) {
    if (!Array.isArray(textures) || textures.length > 16) fail('textures', 'Limite de 16 texturas excedido');
    else textures.forEach((texture, i) => {const result = validateTextureDocument(texture as never); if (!result.ok) fail(`textures.${i}`, result.message);});
  }
  const materials = project.materials;
  if (materials !== undefined) {
    if (!Array.isArray(materials) || materials.length > 32) fail('materials', 'Limite de 32 materiais excedido');
    else materials.forEach((material, i) => {const result = validateMaterialGraph(material as never, Array.isArray(textures) ? textures as never : []); if (!result.ok) result.issues.forEach(entry => fail(`materials.${i}.${entry.path}`, entry.message));});
  }
  if (project.particles !== undefined) for (const issue of validateParticleEmitters(project.particles)) fail(issue.path, issue.message);
  return issues;
}
