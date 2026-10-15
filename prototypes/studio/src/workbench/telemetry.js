// Camada de VISUALIZAÇÃO da telemetria oficial (`inspectRig`, schema `arenamon-rig-telemetry` v1 de rigging/telemetry.js).
//
// A Workbench não calcula telemetria própria. Este módulo só reorganiza o objeto oficial para a interface (árvore,
// detalhe da articulação, cartões de malha) e compara duas telemetrias oficiais (antes/depois). Cada número exibido
// vem de um campo do objeto oficial; o JSON copiado para a IA é o objeto oficial sem alterações.
export const TELEMETRY_SCHEMA = 'arenamon-rig-telemetry';

/** Estado do skinning do modelo (classificação para a interface; não é um indicador de qualidade). */
export function rigState(root, draft) {
  if (!root) return 'sem-modelo';
  let skinned = false, bones = false;root.traverse(o => {if (o.isSkinnedMesh && o.skeleton) skinned = true;if (o.isBone) bones = true;});
  return skinned ? 'vinculado' : draft?.joints?.length ? 'rascunho' : bones ? 'ossos-sem-skin' : 'sem-rig';
}
const mentions = (text, name) => new RegExp(`(^|[^\\w])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w]|$)`).test(text);

/** Visão da telemetria oficial `t` para a interface. `state` = rigState (ou 'proposta' do auto-rig). */
export function toView(t, {state, clips = []} = {}) {
  const tf = new Map(t.transforms.bones.map(b => [b.id, b])), skinned = t.skinning.isSkinned;
  const symmetry = new Map();
  for (const p of t.consistency.symmetry.pairs) {
    symmetry.set(p.leftId, {pair: p.rightId, pairName: p.rightName, asymmetryDelta: p.asymmetryDelta, isSymmetric: p.isSymmetric});
    symmetry.set(p.rightId, {pair: p.leftId, pairName: p.leftName, asymmetryDelta: p.asymmetryDelta, isSymmetric: p.isSymmetric});
  }
  const outside = new Map(t.consistency.outsideBounds.map(o => [o.id, o]));
  const joints = t.identification.hierarchy.map(h => {
    const b = tf.get(h.id) || {}, perMesh = skinned ? t.skinning.meshes.map(m => ({mesh: m.meshName, vertices: m.influencesPerBone?.[h.name] ?? 0})).filter(m => m.vertices) : [];
    return {
      id: h.id, name: h.name, parent: h.parent, parentId: h.parentId, children: h.children, depth: h.depth,
      p: b.modelRoot?.position ?? null, q: b.local?.quaternion ?? null, local: b.local?.position ?? null, world: b.world?.position ?? null,
      segmentLength: b.segmentLength ?? null, bindInverse: b.bindMatrixInverse ?? null,
      influence: skinned ? {vertices: perMesh.reduce((s, m) => s + m.vertices, 0), meshes: perMesh} : null,
      symmetry: symmetry.get(h.id) || null, outsideBounds: outside.get(h.id) || null,
      warnings: t.metrics.warnings.filter(w => mentions(w, h.name)),
    };
  });
  const skinByName = new Map(t.skinning.meshes.map(m => [m.meshName, m]));
  const meshes = t.identification.meshes.map(m => {
    const s = skinByName.get(m.name);
    return {name: m.name, type: m.type, vertices: m.vertices, skinned: m.skinned, bones: m.skeletonBoneCount ?? null,
      zeroWeights: s?.zeroWeightVertices ?? null, unnormalized: s?.unnormalizedVertices ?? null, uninfluencedBones: s?.uninfluencedBones ?? [],
      influencesPerBone: s?.influencesPerBone ?? null, weightStats: s?.weightStats ?? null, deformationWarnings: s?.deformationWarnings ?? []};
  });
  const orphan = t.consistency.orphanAnimationTracks;
  const animations = clips.map(c => ({name: c.name, tracks: c.tracks.length, orphanTracks: orphan.filter(o => o.clipName === c.name).map(o => o.trackName)}));
  const sum = k => t.skinning.meshes.reduce((s, m) => s + (m[k] || 0), 0);
  return {
    official: t, state, joints, meshes, animations, warnings: t.metrics.warnings, notes: t.notes,
    model: {name: t.modelName, state, bounds: t.bounds},
    symmetry: t.consistency.symmetry,
    summary: {
      bones: t.identification.totalBones, meshes: t.identification.meshCount, skinnedMeshes: t.identification.skinnedMeshCount, vertices: t.bounds?.vertices ?? null,
      verticesWithoutInfluence: sum('zeroWeightVertices'), unnormalizedVertices: sum('unnormalizedVertices'), orphanTracks: orphan.length,
      warnings: t.metrics.warningCount, jointsWithWarnings: joints.filter(j => j.warnings.length).length, maxAsymmetry: t.consistency.symmetry.maxAsymmetryDelta,
      outsideBounds: t.consistency.outsideBounds.length,
    },
  };
}

/** Recorte da telemetria OFICIAL para os ossos selecionados (mesmo schema; campo `selection` informa o recorte). */
export function selectTelemetry(t, ids) {
  const keep = new Set(t.identification.hierarchy.filter(h => ids.includes(h.id) || ids.includes(h.name)).map(h => h.id));
  const out = structuredClone(t);
  out.selection = [...keep];
  out.identification.hierarchy = out.identification.hierarchy.filter(h => keep.has(h.id));
  out.transforms.bones = out.transforms.bones.filter(b => keep.has(b.id));
  out.consistency.symmetry.pairs = out.consistency.symmetry.pairs.filter(p => keep.has(p.leftId) || keep.has(p.rightId));
  out.consistency.outsideBounds = out.consistency.outsideBounds.filter(o => keep.has(o.id));
  return out;
}

/** Avisos resolvidos e novos entre duas visões. */
export function warningDiff(before, after) {
  const a = new Set(before.warnings), b = new Set(after.warnings);
  return {resolved: [...a].filter(w => !b.has(w)), added: [...b].filter(w => !a.has(w))};
}
/** Vértices influenciados por osso (soma de influencesPerBone oficial) que mudaram. */
export function influenceDiff(before, after) {
  const A = new Map(before.joints.map(j => [j.id, j.influence?.vertices ?? null])), out = [];
  for (const j of after.joints) if (A.has(j.id) && A.get(j.id) !== (j.influence?.vertices ?? null)) out.push({id: j.id, name: j.name, before: A.get(j.id), after: j.influence?.vertices ?? null});
  return out;
}
/** Mudanças por osso entre duas visões (posição no espaço da raiz, rotação local, nome, pai, criados, removidos). */
export function transformChanges(before, after) {
  const A = new Map(before.joints.map(j => [j.id, j])), B = new Map(after.joints.map(j => [j.id, j])), out = [];
  const angle = (q1, q2) => {const d = Math.abs(q1[0] * q2[0] + q1[1] * q2[1] + q1[2] * q2[2] + q1[3] * q2[3]);return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI;};
  for (const [id, b] of B) {
    const a = A.get(id);
    if (!a) {out.push({id, name: b.name, kind: 'added', parentAfter: b.parent, p: b.p});continue;}
    const c = {id, name: b.name, kind: 'changed'};
    if (a.p && b.p) {const d = b.p.map((v, k) => v - a.p[k]), moved = Math.hypot(...d);if (moved > 1e-9) Object.assign(c, {moved, delta: d, pBefore: a.p, pAfter: b.p});}
    if (a.q && b.q) {const turned = angle(a.q, b.q);if (turned > 1e-4) Object.assign(c, {rotatedDeg: turned, qBefore: a.q, qAfter: b.q});}
    if (a.name !== b.name) c.nameBefore = a.name;
    if (a.parentId !== b.parentId) Object.assign(c, {parentBefore: a.parent, parentAfter: b.parent});
    if (Object.keys(c).length > 3) out.push(c);
  }
  for (const [id, a] of A) if (!B.has(id)) out.push({id, name: a.name, kind: 'removed', parentBefore: a.parent});
  return out;
}
