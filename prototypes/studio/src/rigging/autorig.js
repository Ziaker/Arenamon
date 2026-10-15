// Arenamon Rigging — Auto-Rig Avançado e Análise Geométrica (Marco 2)
// Identificação paramétrica de proporções, eixos de simetria, templates adaptativos
// e algoritmo aprimorado de pesos de deformação (capsule distance falloff).

import * as T from 'three';
import {modelBounds, ensureJointIds, uniqueJointName, validateDraft} from './core.js';

const round5 = (n) => (Number.isFinite(n) ? Math.round(n * 100000) / 100000 : 0);
const tidy = (v) => [round5(v[0]), round5(v[1]), round5(v[2])];

// -------------------------------------------------------------
// 1. Análise Geométrica e Estimativa de Regiões Anatômicas
// -------------------------------------------------------------
export function analyzeGeometry(root, options = {}) {
  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  const bounds = modelBounds(root);

  const [minX, minY, minZ] = bounds.min;
  const [maxX, maxY, maxZ] = bounds.max;
  const [width, height, depth] = bounds.size;
  const [cx, cy, cz] = bounds.center;

  // Análise de submalhas
  const submeshes = [];
  const verticesInRoot = [];

  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    const meshMatrix = rootInv.clone().multiply(o.matrixWorld);
    const mBox = new T.Box3();
    const tempP = new T.Vector3();

    for (let i = 0; i < pos.count; i++) {
      tempP.fromBufferAttribute(pos, i).applyMatrix4(meshMatrix);
      mBox.expandByPoint(tempP);
      verticesInRoot.push([tempP.x, tempP.y, tempP.z]);
    }

    submeshes.push({
      name: o.name || o.uuid,
      type: o.type,
      vertices: pos.count,
      bounds: {
        min: tidy([mBox.min.x, mBox.min.y, mBox.min.z]),
        max: tidy([mBox.max.x, mBox.max.y, mBox.max.z]),
        size: tidy([mBox.max.x - mBox.min.x, mBox.max.y - mBox.min.y, mBox.max.z - mBox.min.z]),
        center: tidy([(mBox.min.x + mBox.max.x) / 2, (mBox.min.y + mBox.max.y) / 2, (mBox.min.z + mBox.max.z) / 2])
      }
    });
  });

  // Fatiamento vertical em 20 camadas para perfil de densidade
  const sliceCount = 20;
  const slices = Array.from({length: sliceCount}, (_, i) => ({
    index: i,
    yMin: minY + (i / sliceCount) * height,
    yMax: minY + ((i + 1) / sliceCount) * height,
    yCenter: minY + ((i + 0.5) / sliceCount) * height,
    vertices: 0,
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
    sumX: 0,
    sumZ: 0
  }));

  for (const [vx, vy, vz] of verticesInRoot) {
    const fraction = (vy - minY) / (height || 1);
    const sliceIdx = Math.min(sliceCount - 1, Math.max(0, Math.floor(fraction * sliceCount)));
    const s = slices[sliceIdx];
    s.vertices++;
    if (vx < s.minX) s.minX = vx;
    if (vx > s.maxX) s.maxX = vx;
    if (vz < s.minZ) s.minZ = vz;
    if (vz > s.maxZ) s.maxZ = vz;
    s.sumX += vx;
    s.sumZ += vz;
  }

  // Estatísticas de cada fatia
  for (const s of slices) {
    if (s.vertices > 0) {
      s.width = s.maxX - s.minX;
      s.depth = s.maxZ - s.minZ;
      s.centerX = s.sumX / s.vertices;
      s.centerZ = s.sumZ / s.vertices;
    } else {
      s.width = 0;
      s.depth = 0;
      s.centerX = cx;
      s.centerZ = cz;
    }
  }

  // Avaliação de simetria bilateral (plano YZ centrado em cx)
  let symmetryErrorSum = 0;
  let symmetrySamples = 0;
  for (const s of slices) {
    if (s.vertices > 10) {
      const leftExtent = s.maxX - cx;
      const rightExtent = cx - s.minX;
      symmetryErrorSum += Math.abs(leftExtent - rightExtent);
      symmetrySamples++;
    }
  }
  const bilateralSymmetryScore = symmetrySamples > 0 ? round5(1 - Math.min(1, symmetryErrorSum / (symmetrySamples * (width || 1)))) : 1;

  // Eixos dominantes
  const dominantVertical = height >= width && height >= depth;
  const dominantLongitudinal = depth > width && depth > height * 0.7; // Típico de quadrúpedes

  // Identificação de proporções corporais
  // Top 3 fatias: Cabeça (fatias 17..19)
  const headSlice = slices.slice(17, 20);
  const neckSlice = slices[16];
  const chestSlice = slices.slice(12, 16);
  const hipSlice = slices[9];
  const legSlices = slices.slice(0, 9);

  const headVolumeRatio = headSlice.reduce((acc, s) => acc + s.vertices, 0) / (verticesInRoot.length || 1);
  const isChibiOrStylized = headVolumeRatio > 0.28; // Cabeça representa mais de 28% dos vértices
  const isQuadrupedCandidate = dominantLongitudinal && height / depth < 1.3;

  // Regiões anatômicas candidatas (com nível de confiança explícito)
  const candidateRegions = {
    head: {
      yRange: [minY + height * 0.85, maxY],
      confidence: round5(0.75 + (headSlice[1]?.vertices > 0 ? 0.15 : 0)),
      estimatedCenter: tidy([cx, minY + height * 0.93, cz]),
      isEstimated: true
    },
    neck: {
      yRange: [minY + height * 0.78, minY + height * 0.85],
      confidence: 0.7,
      estimatedCenter: tidy([cx, minY + height * 0.82, cz]),
      isEstimated: true
    },
    torso: {
      yRange: [minY + height * 0.45, minY + height * 0.78],
      confidence: 0.85,
      estimatedCenter: tidy([cx, minY + height * 0.62, cz]),
      isEstimated: true
    },
    pelvis: {
      yRange: [minY + height * 0.38, minY + height * 0.50],
      confidence: 0.8,
      estimatedCenter: tidy([cx, minY + height * 0.45, cz]),
      isEstimated: true
    },
    limbs: {
      type: isQuadrupedCandidate ? 'quadruped-limbs' : 'biped-limbs',
      confidence: round5(isQuadrupedCandidate ? 0.82 : 0.88),
      legHeightFraction: round5(hipSlice.yCenter / (height || 1)),
      isEstimated: true
    }
  };

  return {
    bounds,
    proportions: {
      width,
      height,
      depth,
      aspectRatio: round5(height / (width || 1)),
      depthRatio: round5(depth / (height || 1)),
      isChibiOrStylized,
      isQuadrupedCandidate
    },
    symmetry: {
      plane: 'YZ',
      centerX: round5(cx),
      score: bilateralSymmetryScore,
      isBilateral: bilateralSymmetryScore > 0.85
    },
    submeshes,
    slices: slices.map((s) => ({
      index: s.index,
      yCenter: round5(s.yCenter),
      vertices: s.vertices,
      width: round5(s.width),
      depth: round5(s.depth)
    })),
    candidateRegions
  };
}

// -------------------------------------------------------------
// 2. Templates Paramétricos Flexíveis
// -------------------------------------------------------------

// Template Humanoide Avançado (20 ossos) adaptado às proporções geométricas
export function generateHumanoidDraft(bounds, analysis = null, options = {}) {
  const [xmin, ymin, zmin] = bounds.min;
  const [width, height, depth] = bounds.size;
  const midX = (xmin + bounds.max[0]) / 2;
  const midZ = (zmin + bounds.max[2]) / 2;

  const proportions = analysis?.proportions;
  const isChibi = options.proportions === 'chibi' || proportions?.isChibiOrStylized;

  // Fatores de altura adaptativos
  const hipsFraction = isChibi ? 0.38 : 0.49;
  const spineFraction = isChibi ? 0.56 : 0.69;
  const neckFraction = isChibi ? 0.72 : 0.86;
  const headFraction = isChibi ? 0.88 : 0.96;
  const armSpread = options.armSpread !== undefined ? options.armSpread : 0.28;

  const py = (f) => round5(ymin + height * f);
  const px = (side, f) => round5(midX + side * width * f);
  const pz = (f) => round5(midZ + depth * f);

  const joints = [
    {name: 'Hips', parent: null, p: [midX, py(hipsFraction), midZ]},
    {name: 'Spine', parent: 'Hips', p: [midX, py(spineFraction), midZ]},
    {name: 'Neck', parent: 'Spine', p: [midX, py(neckFraction), pz(0)]},
    {name: 'Head', parent: 'Neck', p: [midX, py(headFraction), pz(0.02)]}
  ];

  for (const [label, side] of [['Left', -1], ['Right', 1]]) {
    const clavicleY = isChibi ? 0.68 : 0.80;
    const shoulderY = isChibi ? 0.66 : 0.79;
    const elbowY = isChibi ? 0.52 : 0.68;
    const wristY = isChibi ? 0.42 : 0.67;

    const hipY = isChibi ? 0.35 : 0.45;
    const kneeY = isChibi ? 0.20 : 0.25;
    const ankleY = isChibi ? 0.08 : 0.075;
    const footY = 0.045;

    joints.push(
      {name: label + 'Clavicle', parent: 'Spine', p: [px(side, 0.12), py(clavicleY), midZ]},
      {name: label + 'Shoulder', parent: label + 'Clavicle', p: [px(side, armSpread), py(shoulderY), midZ]},
      {name: label + 'Elbow', parent: label + 'Shoulder', p: [px(side, armSpread + 0.24), py(elbowY), midZ]},
      {name: label + 'Wrist', parent: label + 'Elbow', p: [px(side, armSpread + 0.48), py(wristY), midZ]},
      {name: label + 'Hip', parent: 'Hips', p: [px(side, 0.16), py(hipY), midZ]},
      {name: label + 'Knee', parent: label + 'Hip', p: [px(side, 0.19), py(kneeY), pz(0.035)]},
      {name: label + 'Ankle', parent: label + 'Knee', p: [px(side, 0.19), py(ankleY), midZ]},
      {name: label + 'Foot', parent: label + 'Ankle', p: [px(side, 0.20), py(footY), pz(0.20)]}
    );
  }

  const draft = {
    schema: 'arenamon-rig',
    version: 2,
    space: 'model-root',
    mode: 'draft',
    joints,
    source: isChibi ? 'template humanoid chibi adaptativo (20 ossos)' : 'template humanoid standard adaptativo (20 ossos)',
    bounds: {min: tidy(bounds.min), max: tidy(bounds.max), size: tidy(bounds.size)}
  };

  return ensureJointIds(draft);
}

// Template Quadrúpede (24 e 27 ossos)
export function generateQuadrupedDraft(bounds, analysis = null, options = {}) {
  const [xmin, ymin, zmin] = bounds.min;
  const [width, height, depth] = bounds.size;
  const midX = (xmin + bounds.max[0]) / 2;
  const midZ = (zmin + bounds.max[2]) / 2;

  const boneCount = options.boneCount === 27 ? 27 : 24;
  const withTail = options.withTail !== false;

  const py = (f) => round5(ymin + height * f);
  const px = (side, f) => round5(midX + side * width * f);
  const pz = (f) => round5(midZ + depth * f);

  // Coluna vertebral horizontal: Pelvis atrás (-Z), Chest à frente (+Z)
  const joints = [
    {name: 'Hips', parent: null, p: [midX, py(0.65), pz(-0.25)]},
    {name: 'Spine', parent: 'Hips', p: [midX, py(0.68), pz(0.0)]},
    {name: 'Chest', parent: 'Spine', p: [midX, py(0.70), pz(0.25)]},
    {name: 'Neck', parent: 'Chest', p: [midX, py(0.82), pz(0.40)]},
    {name: 'Head', parent: 'Neck', p: [midX, py(0.92), pz(0.50)]}
  ];

  // Patas traseiras (ligadas ao Hips)
  for (const [label, side] of [['Left', -1], ['Right', 1]]) {
    joints.push(
      {name: label + 'HindHip', parent: 'Hips', p: [px(side, 0.22), py(0.60), pz(-0.25)]},
      {name: label + 'HindKnee', parent: label + 'HindHip', p: [px(side, 0.24), py(0.38), pz(-0.18)]},
      {name: label + 'HindAnkle', parent: label + 'HindKnee', p: [px(side, 0.24), py(0.18), pz(-0.28)]},
      {name: label + 'HindFoot', parent: label + 'HindAnkle', p: [px(side, 0.24), py(0.04), pz(-0.22)]}
    );
  }

  // Patas dianteiras (ligadas ao Chest)
  for (const [label, side] of [['Left', -1], ['Right', 1]]) {
    if (boneCount === 27) {
      // 27 ossos inclui Scapula na frente e 1 cauda
      joints.push({name: label + 'FrontScapula', parent: 'Chest', p: [px(side, 0.18), py(0.72), pz(0.25)]});
      joints.push(
        {name: label + 'FrontShoulder', parent: label + 'FrontScapula', p: [px(side, 0.24), py(0.58), pz(0.25)]},
        {name: label + 'FrontElbow', parent: label + 'FrontShoulder', p: [px(side, 0.24), py(0.36), pz(0.28)]},
        {name: label + 'FrontWrist', parent: label + 'FrontElbow', p: [px(side, 0.24), py(0.18), pz(0.25)]},
        {name: label + 'FrontFoot', parent: label + 'FrontWrist', p: [px(side, 0.24), py(0.04), pz(0.28)]}
      );
    } else {
      // 24 ossos convencional (sem Scapula, Shoulder direto no Chest)
      joints.push(
        {name: label + 'FrontShoulder', parent: 'Chest', p: [px(side, 0.22), py(0.60), pz(0.25)]},
        {name: label + 'FrontElbow', parent: label + 'FrontShoulder', p: [px(side, 0.24), py(0.38), pz(0.28)]},
        {name: label + 'FrontWrist', parent: label + 'FrontElbow', p: [px(side, 0.24), py(0.18), pz(0.25)]},
        {name: label + 'FrontFoot', parent: label + 'FrontWrist', p: [px(side, 0.24), py(0.04), pz(0.28)]}
      );
    }
  }

  // Cauda (3 articulações para completar ou enriquecer)
  if (boneCount === 24) {
    // 5 base + 8 hind + 8 front = 21. Adiciona 3 de cauda = 24!
    joints.push(
      {name: 'Tail1', parent: 'Hips', p: [midX, py(0.62), pz(-0.35)]},
      {name: 'Tail2', parent: 'Tail1', p: [midX, py(0.58), pz(-0.48)]},
      {name: 'Tail3', parent: 'Tail2', p: [midX, py(0.52), pz(-0.62)]}
    );
  } else if (boneCount === 27) {
    // 5 base + 8 hind + 10 front = 23. Adiciona 4 de cauda = 27!
    joints.push(
      {name: 'Tail1', parent: 'Hips', p: [midX, py(0.62), pz(-0.35)]},
      {name: 'Tail2', parent: 'Tail1', p: [midX, py(0.58), pz(-0.48)]},
      {name: 'Tail3', parent: 'Tail2', p: [midX, py(0.52), pz(-0.60)]},
      {name: 'Tail4', parent: 'Tail3', p: [midX, py(0.46), pz(-0.72)]}
    );
  }

  const draft = {
    schema: 'arenamon-rig',
    version: 2,
    space: 'model-root',
    mode: 'draft',
    joints,
    source: `template quadruped adaptativo (${boneCount} ossos)`,
    bounds: {min: tidy(bounds.min), max: tidy(bounds.max), size: tidy(bounds.size)}
  };

  return ensureJointIds(draft);
}

// -------------------------------------------------------------
// 3. Ajuste Assistido por Landmarks e Regeneração Parcial
// -------------------------------------------------------------
export function fitDraftToLandmarks(draft, landmarks = {}, options = {}) {
  const lockedJoints = new Set(options.lockedJoints || []);
  const jointsModified = [];

  for (const [nameOrId, pos] of Object.entries(landmarks)) {
    const joint = draft.joints.find((j) => j.id === nameOrId || j.name === nameOrId);
    if (joint && !lockedJoints.has(joint.id) && !lockedJoints.has(joint.name)) {
      joint.p = tidy(pos);
      jointsModified.push(joint.name);
    }
  }

  validateDraft(draft);
  return {
    draft,
    modifiedCount: jointsModified.length,
    modifiedJoints: jointsModified
  };
}

export function regenerateRegion(draft, bounds, regionName, options = {}) {
  const lockedJoints = new Set(options.lockedJoints || []);
  const [midX] = [(bounds.min[0] + bounds.max[0]) / 2];

  if (regionName === 'tail') {
    // Remove ossos de cauda não travados e recria
    draft.joints = draft.joints.filter((j) => !j.name.startsWith('Tail') || lockedJoints.has(j.name));
    const hips = draft.joints.find((j) => j.name === 'Hips');
    const baseP = hips ? hips.p : [midX, bounds.min[1] + bounds.size[1] * 0.5, bounds.min[2]];
    const tailBones = options.tailBones || 3;

    let parentName = hips ? hips.name : null;
    for (let i = 1; i <= tailBones; i++) {
      const name = `Tail${i}`;
      const p = [baseP[0], baseP[1] - i * 0.08, baseP[2] - i * 0.15];
      draft.joints.push({name, parent: parentName, p: tidy(p), q: [0, 0, 0, 1]});
      parentName = name;
    }
  }

  ensureJointIds(draft);
  validateDraft(draft);
  return draft;
}

// -------------------------------------------------------------
// 4. Algoritmo Aprimorado de Pesos (Capsule Distance Falloff)
// -------------------------------------------------------------
function pointToSegmentDistanceSquared(p, a, b) {
  const ab = new T.Vector3().subVectors(b, a);
  const l2 = ab.lengthSq();
  if (l2 < 1e-12) return p.distanceToSquared(a);
  const t = T.MathUtils.clamp(new T.Vector3().subVectors(p, a).dot(ab) / l2, 0, 1);
  const proj = new T.Vector3().copy(a).addScaledVector(ab, t);
  return p.distanceToSquared(proj);
}

export function computeEnhancedSkinningWeights(mesh, skeleton, options = {}) {
  const geom = mesh.geometry;
  const posAttr = geom.getAttribute('position');
  if (!posAttr) throw new Error('Malha sem atributo de posição.');

  const smoothness = Number(options.smoothness) || 0.15;
  const bones = skeleton.bones;
  const vCount = posAttr.count;

  mesh.updateMatrixWorld(true);
  const meshToWorld = mesh.matrixWorld;
  const tempPos = new T.Vector3();
  const boneWorldPositions = bones.map((b) => b.getWorldPosition(new T.Vector3()));

  // Determinar raio característico do modelo
  geom.computeBoundingBox();
  const bbox = geom.boundingBox;
  const diag = bbox.getSize(new T.Vector3()).length();
  const sigma = Math.max(0.05, diag * smoothness);

  const indices = new Uint16Array(vCount * 4);
  const weights = new Float32Array(vCount * 4);

  for (let vi = 0; vi < vCount; vi++) {
    tempPos.fromBufferAttribute(posAttr, vi).applyMatrix4(meshToWorld);

    const candidates = [];
    for (let bi = 0; bi < bones.length; bi++) {
      const bone = bones[bi];
      const pBone = boneWorldPositions[bi];
      let d2 = 0;

      // Se tiver osso pai, calcula distância ao segmento da cápsula
      if (bone.parent && bone.parent.isBone) {
        const parentIdx = bones.indexOf(bone.parent);
        const pParent = parentIdx >= 0 ? boneWorldPositions[parentIdx] : bone.parent.getWorldPosition(new T.Vector3());
        d2 = pointToSegmentDistanceSquared(tempPos, pParent, pBone);
      } else {
        d2 = tempPos.distanceToSquared(pBone);
      }

      // Função de ponderação suave baseada em falloff gaussiano/r-squared
      const score = Math.exp(-d2 / (2 * sigma * sigma));
      candidates.push({index: bi, score: Math.max(1e-8, score)});
    }

    candidates.sort((a, b) => b.score - a.score);
    const top4 = candidates.slice(0, 4);
    const sumScore = top4.reduce((s, c) => s + c.score, 0);

    for (let k = 0; k < 4; k++) {
      if (k < top4.length && sumScore > 1e-12) {
        indices[vi * 4 + k] = top4[k].index;
        weights[vi * 4 + k] = top4[k].score / sumScore;
      } else {
        indices[vi * 4 + k] = 0;
        weights[vi * 4 + k] = 0;
      }
    }
  }

  geom.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
  geom.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
  geom.attributes.skinIndex.needsUpdate = true;
  geom.attributes.skinWeight.needsUpdate = true;

  return {
    vertices: vCount,
    algorithm: 'capsule-distance-falloff',
    smoothness,
    bonesCount: bones.length
  };
}
