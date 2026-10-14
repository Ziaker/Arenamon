// Telemetria do rig (schema `arenamon-rig-telemetry`, versão 1), pronta para copiar para uma IA.
//
// Origem de cada dado (nenhum indicador de "qualidade" é inventado aqui):
// - Ossos, IDs persistentes, hierarquia, posições (raiz, local, mundo) e quaternions: `currentJoints` do Codex
//   (ou o rascunho do Codex, quando a malha ainda não foi vinculada).
// - Avisos, malhas, pesos inválidos, vértices sem influência e vértices por osso: `auditRig` do Codex.
// - Simetria: `applyMirror` do Codex numa cópia do rascunho (distância entre o lado direito e o espelho do esquerdo).
// - Matrizes de bind, pesos por osso e por malha e histogramas: leitura direta de `skeleton.boneInverses` e dos
//   atributos `skinIndex`/`skinWeight` (dados brutos do modelo, sem interpretação).
// - Faixas de animação órfãs: `PropertyBinding.findNode` do Three.js para cada trilha de cada clipe.
// - Comprimento do segmento: distância entre o osso e o pai no espaço da raiz (mesma medida do painel do Codex).
import * as T from 'three';
import {auditRig, currentJoints, applyMirror, modelBounds} from '../rigging/core.js';
import {draftFromModel} from './patch.js';

export const TELEMETRY_SCHEMA = 'arenamon-rig-telemetry';
// Precisão numérica completa do modelo (como o JSON de coordenadas do Codex); só a interface arredonda para leitura.
const round = v => v, r3 = a => [...a];
const pairOf = name => name.startsWith('Left') ? 'Right' + name.slice(4) : name.startsWith('Right') ? 'Left' + name.slice(5) : null;
const nameOf = o => o.name || o.uuid;

/** Estado do skinning do modelo. */
export function rigState(root, draft) {
  if (!root) return 'sem-modelo';
  let skinned = false, bones = false;root.traverse(o => {if (o.isSkinnedMesh && o.skeleton) skinned = true;if (o.isBone) bones = true;});
  return skinned ? 'vinculado' : draft?.joints?.length ? 'rascunho' : bones ? 'ossos-sem-skin' : 'sem-rig';
}

/** Pesos reais por osso e por malha, lidos dos atributos de skin. */
function skinData(root) {
  const meshes = [], perBone = new Map(), bindInverse = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const geom = o.geometry, n = geom.attributes.position?.count || 0, entry = {uuid: o.uuid, name: nameOf(o), vertices: n, skinned: !!(o.isSkinnedMesh && o.skeleton)};
    if (entry.skinned) {
      const ids = geom.getAttribute('skinIndex'), ws = geom.getAttribute('skinWeight'), palette = o.skeleton.bones;
      palette.forEach((b, i) => {if (b && !bindInverse.has(b.uuid)) bindInverse.set(b.uuid, Array.from(o.skeleton.boneInverses[i].elements).map(round));});
      const bones = new Map(), histogram = new Array(10).fill(0), influenceCount = [0, 0, 0, 0, 0], unweighted = [];
      if (ids && ws) for (let v = 0; v < n; v++) {
        let count = 0, max = 0, sum = 0;
        for (let k = 0; k < 4; k++) {
          const w = ws.getComponent(v, k), bone = palette[ids.getComponent(v, k)];
          if (!(w > 1e-5) || !bone) continue;
          count++;sum += w;max = Math.max(max, w);
          const s = bones.get(bone.uuid) || {vertices: 0, weightSum: 0, maxWeight: 0};s.vertices++;s.weightSum += w;s.maxWeight = Math.max(s.maxWeight, w);bones.set(bone.uuid, s);
        }
        influenceCount[count]++;
        if (sum < .001) {if (unweighted.length < 500) unweighted.push(v);}
        else histogram[Math.min(9, Math.floor(max * 10))]++;
      }
      entry.influencingBones = [...bones].map(([uuid, s]) => ({uuid, vertices: s.vertices, weightSum: round(s.weightSum), maxWeight: round(s.maxWeight)}));
      entry.dominantWeightHistogram = histogram;entry.influencesPerVertex = influenceCount;entry.unweightedVertexSample = unweighted;
      for (const [uuid, s] of bones) {const list = perBone.get(uuid) || [];list.push({mesh: entry.name, meshUuid: o.uuid, vertices: s.vertices, weightSum: round(s.weightSum), maxWeight: round(s.maxWeight)});perBone.set(uuid, list);}
    }
    meshes.push(entry);
  });
  return {meshes, perBone, bindInverse};
}

/** Trilhas de cada clipe que não encontram o osso/nó de destino no modelo. */
export function animationCompatibility(root, clips = []) {
  return clips.map(clip => {
    const orphan = [];
    for (const track of clip.tracks) {
      const parsed = T.PropertyBinding.parseTrackName(track.name);
      if (!T.PropertyBinding.findNode(root, parsed.nodeName)) orphan.push(track.name);
    }
    return {name: clip.name, tracks: clip.tracks.length, boundTracks: clip.tracks.length - orphan.length, orphanTracks: orphan};
  });
}

/**
 * Telemetria completa. `draft` = rascunho do Codex em edição (malha sem skin), se houver. `select` = IDs a incluir
 * (seleção de ossos para a IA); sem `select`, todos.
 */
export function buildTelemetry(root, {draft = null, clips = [], modelName = '', select = null} = {}) {
  if (!root) throw Error('Nenhum modelo carregado.');
  const state = rigState(root, draft), audit = auditRig(root), bounds = modelBounds(root);
  const live = state === 'rascunho' ? null : currentJoints(root);
  const base = state === 'rascunho' ? draftFromModel(root, draft) : draftFromModel(root);
  const joints = base.joints, byName = new Map(joints.map(j => [j.name, j]));
  const liveById = new Map((live || []).map(j => [j.id, j]));
  const skin = skinData(root), skinned = state === 'vinculado';
  const animations = animationCompatibility(root, clips);
  const out = joints.map(j => {
    const lj = liveById.get(j.id), parent = j.parent ? byName.get(j.parent) : null, pair = pairOf(j.name), pairJoint = pair ? byName.get(pair) : null;
    let symmetry = null;
    if (pairJoint && j.name.startsWith('Left')) {
      const copy = structuredClone(base);applyMirror(copy, j.name);const mirrored = copy.joints.find(x => x.id === pairJoint.id).p;
      symmetry = {pair: pairJoint.id, pairName: pairJoint.name, mirrorDistance: round(Math.hypot(...mirrored.map((v, k) => v - pairJoint.p[k])))};
    } else if (pairJoint) symmetry = {pair: pairJoint.id, pairName: pairJoint.name, mirrorDistance: null, note: 'medido no lado Left'};
    const vertices = audit.vertexInfluences?.[j.name] ?? null, uuid = lj?.uuid ?? null;
    const warnings = audit.warnings.filter(w => new RegExp(`(^|[^\\w])${j.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w]|$)`).test(w));
    if (skinned && vertices === 0) warnings.push('Sem vértices influenciados (auditRig).');
    return {
      id: j.id, name: j.name, uuid, parent: j.parent, parentId: parent?.id ?? null,
      children: joints.filter(c => c.parent === j.name).map(c => c.id),
      p: r3(j.p), local: lj ? r3(lj.local) : null, world: lj ? r3(lj.world) : null, q: r3(j.q || [0, 0, 0, 1]),
      segmentLength: parent ? round(Math.hypot(...j.p.map((v, k) => v - parent.p[k]))) : null,
      bindInverse: uuid && skin.bindInverse.has(uuid) ? skin.bindInverse.get(uuid) : null,
      influence: skinned ? {vertices, meshes: skin.perBone.get(uuid) || []} : null,
      symmetry, warnings,
    };
  });
  const chosen = select ? out.filter(j => select.includes(j.id) || select.includes(j.name)) : out;
  const orphanTotal = animations.reduce((s, a) => s + a.orphanTracks.length, 0);
  return {
    schema: TELEMETRY_SCHEMA, version: 1, generatedAt: new Date().toISOString(), space: 'model-root',
    source: {engine: 'codex rigging/core.js', functions: ['currentJoints', 'auditRig', 'applyMirror', 'modelBounds'], raw: ['skeleton.boneInverses', 'skinIndex', 'skinWeight', 'PropertyBinding']},
    model: {name: modelName, state, bounds: {min: r3(bounds.min), max: r3(bounds.max), size: r3(bounds.size), center: r3(bounds.center)}},
    summary: {
      bones: joints.length, meshes: audit.meshes.length, skinnedMeshes: audit.skinnedMeshes, vertices: audit.meshes.reduce((s, m) => s + m.vertices, 0),
      verticesWithoutInfluence: audit.meshes.reduce((s, m) => s + m.zeroWeights, 0), invalidWeights: audit.meshes.reduce((s, m) => s + m.invalidWeights, 0),
      jointsWithWarnings: out.filter(j => j.warnings.length).length, orphanTracks: orphanTotal, warnings: audit.warnings.length,
    },
    selection: select ? chosen.map(j => j.id) : null,
    joints: chosen,
    meshes: audit.meshes.map((m, i) => ({...m, ...skin.meshes[i], name: m.name})),
    animations, warnings: audit.warnings,
    patchFormat: {schema: 'arenamon-rig-patch', version: 1, space: 'model-root', ops: ['setPosition', 'translate', 'setRotation', 'rename', 'reparent', 'addJoint', 'removeJoint', 'mirror'],
      note: 'Responda com um JSON {schema, version: 1, space: "model-root", ops: [...]}; refira-se aos ossos pelo id.'},
  };
}

/** Diferenças de avisos entre duas telemetrias (resolvidos e novos). */
export function warningDiff(before, after) {
  const a = new Set(before.warnings), b = new Set(after.warnings);
  return {resolved: [...a].filter(w => !b.has(w)), added: [...b].filter(w => !a.has(w))};
}
/** Diferenças de influência por osso (vértices influenciados) entre duas telemetrias. */
export function influenceDiff(before, after) {
  const map = t => new Map(t.joints.map(j => [j.id, j.influence?.vertices ?? null]));
  const A = map(before), B = map(after), out = [];
  for (const [id, v] of B) if (A.has(id) && A.get(id) !== v) out.push({id, name: after.joints.find(j => j.id === id).name, before: A.get(id), after: v});
  return out;
}
