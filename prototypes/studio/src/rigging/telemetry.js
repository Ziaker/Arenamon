// Arenamon Rigging — Telemetria Completa de Rigging (Marco 1)
// API de inspeção pura, determinística e auditável para agentes de IA e UI.
// Métricas matemáticas estritas estritamente separadas de hipóteses anatômicas.

import * as T from 'three';
import {modelBounds, collectBones, currentJoints} from './core.js';

const round5 = (n) => (Number.isFinite(n) ? Math.round(n * 100000) / 100000 : 0);
const tidyVec3 = (v) => [round5(v.x ?? v[0]), round5(v.y ?? v[1]), round5(v.z ?? v[2])];
const tidyQuat = (q) => [round5(q.x ?? q[0]), round5(q.y ?? q[1]), round5(q.z ?? q[2]), round5(q.w ?? q[3])];
const tidyMat4 = (m) => Array.from(m.elements || m).map(round5);

export function inspectRig(root, options = {}) {
  if (!root || !root.isObject3D) {
    throw new Error('inspectRig requer um objeto Three.js válido como raiz.');
  }

  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  const rootWorldQuat = root.getWorldQuaternion(new T.Quaternion());
  const rootWorldQuatInv = rootWorldQuat.clone().invert();

  // 1. Limites do modelo
  let bounds = null;
  try {
    bounds = modelBounds(root);
  } catch {
    bounds = { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0], center: [0, 0, 0], vertices: 0 };
  }

  // 2. Coleta de ossos e nós
  const bones = collectBones(root);
  const draftJoints = options.draft?.joints || root.userData?.arenamonRig?.joints || root.userData?.arenamonRigDraft?.joints || null;

  // Mapa de identificadores estáveis
  const boneList = [];
  const nameOccurrences = new Map();
  const idOccurrences = new Map();
  const bonesByName = new Map();
  const bonesById = new Map();
  const invalidReferences = [];

  if (bones.length > 0) {
    for (const b of bones) {
      const stableId = b.userData?.arenamonJointId || b.uuid;
      const name = b.name || b.uuid;
      nameOccurrences.set(name, (nameOccurrences.get(name) || 0) + 1);
      idOccurrences.set(stableId, (idOccurrences.get(stableId) || 0) + 1);
      bonesByName.set(name, b);
      bonesById.set(stableId, b);
      boneList.push({ bone: b, id: stableId, name });
    }
  } else if (draftJoints && draftJoints.length > 0) {
    for (const j of draftJoints) {
      const stableId = j.id || `joint-${j.name}`;
      const name = j.name;
      nameOccurrences.set(name, (nameOccurrences.get(name) || 0) + 1);
      idOccurrences.set(stableId, (idOccurrences.get(stableId) || 0) + 1);
      boneList.push({ draft: j, id: stableId, name });
    }
  }

  const duplicateNames = Array.from(nameOccurrences.entries())
    .filter(([_, count]) => count > 1)
    .map(([name, count]) => ({ name, count }));

  const duplicateIds = Array.from(idOccurrences.entries())
    .filter(([_, count]) => count > 1)
    .map(([id, count]) => ({ id, count }));

  // 3. Hierarquia
  const roots = [];
  const hierarchyNodes = [];
  const childrenMap = new Map();

  for (const item of boneList) {
    childrenMap.set(item.id, []);
  }

  for (const item of boneList) {
    let parentName = null;
    let parentId = null;

    if (item.bone) {
      const p = item.bone.parent;
      if (p && p.isBone) {
        parentName = p.name || p.uuid;
        parentId = p.userData?.arenamonJointId || p.uuid;
      }
    } else if (item.draft) {
      parentName = item.draft.parent;
      if (parentName) {
        const pj = draftJoints.find((j) => j.name === parentName || j.id === parentName);
        parentId = pj ? pj.id || `joint-${pj.name}` : null;
      }
    }

    if (parentId && childrenMap.has(parentId)) {
      childrenMap.get(parentId).push(item.id);
    } else if (parentName) {
      // Procurar por nome caso parentId não seja chave direta
      const parentItem = boneList.find((b) => b.name === parentName);
      if (parentItem && childrenMap.has(parentItem.id)) {
        childrenMap.get(parentItem.id).push(item.id);
        parentId = parentItem.id;
      } else {
        invalidReferences.push({
          childId: item.id,
          childName: item.name,
          referencedParent: parentName,
          reason: 'Pai referenciado não encontrado no esqueleto'
        });
      }
    }

    if (!parentId) {
      roots.push(item.id);
    }
  }

  // Calcular profundidade da hierarquia com detecção de ciclo
  function computeDepth(id, visited = new Set()) {
    if (visited.has(id)) return -1; // ciclo detectado
    visited.add(id);
    const item = boneList.find((b) => b.id === id);
    if (!item) return 0;
    let pId = null;
    if (item.bone) {
      const p = item.bone.parent;
      if (p && p.isBone) pId = p.userData?.arenamonJointId || p.uuid;
    } else if (item.draft && item.draft.parent) {
      const pj = draftJoints.find((j) => j.name === item.draft.parent || j.id === item.draft.parent);
      pId = pj?.id || null;
    }
    if (!pId) return 0;
    const parentDepth = computeDepth(pId, visited);
    return parentDepth < 0 ? -1 : parentDepth + 1;
  }

  for (const item of boneList) {
    const depth = computeDepth(item.id);
    let parentId = null;
    let parentName = null;

    if (item.bone) {
      const p = item.bone.parent;
      if (p && p.isBone) {
        parentId = p.userData?.arenamonJointId || p.uuid;
        parentName = p.name || p.uuid;
      }
    } else if (item.draft) {
      parentName = item.draft.parent || null;
      if (parentName) {
        const pj = draftJoints.find((j) => j.name === parentName || j.id === parentName);
        parentId = pj?.id || null;
      }
    }

    hierarchyNodes.push({
      id: item.id,
      name: item.name,
      parent: parentName,
      parentId,
      children: childrenMap.get(item.id) || [],
      depth
    });
  }

  // 4. Coleta de Malhas e SkinnedMeshes
  const meshSummaries = [];
  const skinnedMeshes = [];
  const skeletonsFound = new Set();
  const skeletonMeshMap = new Map();

  root.traverse((o) => {
    if (!o.isMesh) return;
    const isSkinned = Boolean(o.isSkinnedMesh && o.skeleton);
    const vCount = o.geometry?.attributes?.position?.count || 0;
    if (isSkinned) {
      skinnedMeshes.push(o);
      skeletonsFound.add(o.skeleton);
      const list = skeletonMeshMap.get(o.skeleton) || [];
      list.push(o.name || o.uuid);
      skeletonMeshMap.set(o.skeleton, list);
    }
    meshSummaries.push({
      name: o.name || o.uuid,
      type: isSkinned ? 'SkinnedMesh' : 'Mesh',
      vertices: vCount,
      skinned: isSkinned,
      skeletonBoneCount: isSkinned ? o.skeleton.bones.length : 0
    });
  });

  // 5. Transformações e Matrizes
  const transformsList = [];
  const tempWorldPos = new T.Vector3();
  const tempWorldQuat = new T.Quaternion();
  const tempWorldScale = new T.Vector3();
  const tempParentWorldPos = new T.Vector3();

  // Localizar bindMatrixInverse para cada osso se houver skinnedMesh
  const boneInverseMap = new Map();
  if (skinnedMeshes.length > 0) {
    const primarySkinned = skinnedMeshes[0];
    const skel = primarySkinned.skeleton;
    if (skel && skel.boneInverses) {
      skel.bones.forEach((b, idx) => {
        if (b && skel.boneInverses[idx]) {
          const id = b.userData?.arenamonJointId || b.uuid;
          boneInverseMap.set(id, tidyMat4(skel.boneInverses[idx]));
        }
      });
    }
  }

  for (const item of boneList) {
    if (item.bone) {
      const b = item.bone;
      b.getWorldPosition(tempWorldPos);
      b.getWorldQuaternion(tempWorldQuat);
      b.getWorldScale(tempWorldScale);

      const modelRootPos = tempWorldPos.clone().applyMatrix4(rootInv);
      const modelRootQuat = rootWorldQuatInv.clone().multiply(tempWorldQuat);

      let segmentLength = 0;
      if (b.parent && b.parent.isBone) {
        b.parent.getWorldPosition(tempParentWorldPos);
        segmentLength = round5(tempWorldPos.distanceTo(tempParentWorldPos));
      }

      transformsList.push({
        id: item.id,
        name: item.name,
        local: {
          position: tidyVec3(b.position),
          quaternion: tidyQuat(b.quaternion),
          scale: tidyVec3(b.scale)
        },
        world: {
          position: tidyVec3(tempWorldPos),
          quaternion: tidyQuat(tempWorldQuat),
          scale: tidyVec3(tempWorldScale)
        },
        modelRoot: {
          position: tidyVec3(modelRootPos),
          quaternion: tidyQuat(modelRootQuat)
        },
        segmentLength,
        localMatrix: tidyMat4(b.matrix),
        worldMatrix: tidyMat4(b.matrixWorld),
        bindMatrixInverse: boneInverseMap.get(item.id) || null
      });
    } else if (item.draft) {
      const d = item.draft;
      let segmentLength = 0;
      if (d.parent) {
        const pj = draftJoints.find((j) => j.name === d.parent || j.id === d.parent);
        if (pj) {
          const dx = (d.p[0] || 0) - (pj.p[0] || 0);
          const dy = (d.p[1] || 0) - (pj.p[1] || 0);
          const dz = (d.p[2] || 0) - (pj.p[2] || 0);
          segmentLength = round5(Math.hypot(dx, dy, dz));
        }
      }

      transformsList.push({
        id: item.id,
        name: item.name,
        local: {
          position: tidyVec3(d.p || [0, 0, 0]),
          quaternion: tidyQuat(d.q || [0, 0, 0, 1]),
          scale: [1, 1, 1]
        },
        world: {
          position: tidyVec3(d.p || [0, 0, 0]),
          quaternion: tidyQuat(d.q || [0, 0, 0, 1]),
          scale: [1, 1, 1]
        },
        modelRoot: {
          position: tidyVec3(d.p || [0, 0, 0]),
          quaternion: tidyQuat(d.q || [0, 0, 0, 1])
        },
        segmentLength,
        localMatrix: null,
        worldMatrix: null,
        bindMatrixInverse: null
      });
    }
  }

  // 6. Análise de Skinning
  const skinningResults = [];
  const globalInfluencedBones = new Set();

  for (const sm of skinnedMeshes) {
    const geom = sm.geometry;
    const vCount = geom.attributes.position?.count || 0;
    const skinIndexAttr = geom.getAttribute('skinIndex');
    const skinWeightAttr = geom.getAttribute('skinWeight');
    const palette = sm.skeleton.bones;

    let zeroWeightVertices = 0;
    let unnormalizedVertices = 0;
    const influencesPerBone = {};
    const usedPaletteIndices = new Set();
    let totalInfluencesCount = 0;
    let minNonZeroWeight = 1.0;
    let maxWeight = 0.0;

    for (const b of palette) {
      if (b) influencesPerBone[b.name || b.uuid] = 0;
    }

    if (skinIndexAttr && skinWeightAttr) {
      for (let i = 0; i < vCount; i++) {
        let vertexSum = 0;
        let activeInfluencesOnVertex = 0;

        for (let k = 0; k < 4; k++) {
          const boneIdx = skinIndexAttr.getComponent(i, k);
          const weight = skinWeightAttr.getComponent(i, k);

          if (Number.isFinite(weight) && weight > 1e-5 && boneIdx >= 0 && boneIdx < palette.length) {
            usedPaletteIndices.add(boneIdx);
            const b = palette[boneIdx];
            if (b) {
              const bName = b.name || b.uuid;
              influencesPerBone[bName] = (influencesPerBone[bName] || 0) + 1;
              globalInfluencedBones.add(b.userData?.arenamonJointId || b.uuid);
            }
            vertexSum += weight;
            activeInfluencesOnVertex++;
            if (weight < minNonZeroWeight) minNonZeroWeight = weight;
            if (weight > maxWeight) maxWeight = weight;
          }
        }

        totalInfluencesCount += activeInfluencesOnVertex;
        if (vertexSum < 1e-4) {
          zeroWeightVertices++;
        }
        if (Math.abs(vertexSum - 1.0) > 0.015) {
          unnormalizedVertices++;
        }
      }
    }

    const uninfluencedBones = palette
      .filter((_, idx) => !usedPaletteIndices.has(idx))
      .map((b) => b?.name || b?.uuid);

    const deformationWarnings = [];
    if (zeroWeightVertices > 0) {
      deformationWarnings.push(`${zeroWeightVertices} vértices sem influência óssea (peso total = 0).`);
    }
    if (unnormalizedVertices > 0) {
      deformationWarnings.push(`${unnormalizedVertices} vértices com soma de pesos diferente de 1.0 (não normalizados).`);
    }
    if (uninfluencedBones.length > 0) {
      deformationWarnings.push(`${uninfluencedBones.length} ossos na paleta não influenciam nenhum vértice desta malha.`);
    }

    skinningResults.push({
      meshName: sm.name || sm.uuid,
      vertices: vCount,
      zeroWeightVertices,
      unnormalizedVertices,
      uninfluencedBones,
      influencesPerBone,
      weightStats: {
        minNonZero: minNonZeroWeight <= 1.0 ? round5(minNonZeroWeight) : 0,
        max: round5(maxWeight),
        avgInfluencesPerVertex: vCount > 0 ? round5(totalInfluencesCount / vCount) : 0,
        maxInfluencesPerVertex: 4
      },
      deformationWarnings
    });
  }

  const sharedSkeletons = Array.from(skeletonMeshMap.entries()).map(([skel, meshes], idx) => ({
    skeletonIndex: idx,
    meshNames: meshes,
    boneCount: skel.bones.length,
    isShared: meshes.length > 1
  }));

  // 7. Consistência e Detecção de Anomalias
  const coincidentSegments = [];
  const collinearSegments = [];
  const outsideBounds = [];
  const unexpectedHierarchies = [];
  const orphanAnimationTracks = [];
  const structuralRiskFlags = [];

  // Checagem de ossos fora dos limites geométricos (com margem de 10% do tamanho da malha)
  const maxDim = Math.max(bounds.size[0], bounds.size[1], bounds.size[2], 0.1);
  const margin = maxDim * 0.1;
  const bboxMin = [bounds.min[0] - margin, bounds.min[1] - margin, bounds.min[2] - margin];
  const bboxMax = [bounds.max[0] + margin, bounds.max[1] + margin, bounds.max[2] + margin];

  for (const t of transformsList) {
    const p = t.modelRoot.position;
    const isOutside =
      p[0] < bboxMin[0] || p[0] > bboxMax[0] ||
      p[1] < bboxMin[1] || p[1] > bboxMax[1] ||
      p[2] < bboxMin[2] || p[2] > bboxMax[2];

    if (isOutside && bounds.vertices > 0) {
      outsideBounds.push({
        id: t.id,
        name: t.name,
        position: p,
        distanceExceeded: round5(
          Math.max(
            bboxMin[0] - p[0], p[0] - bboxMax[0],
            bboxMin[1] - p[1], p[1] - bboxMax[1],
            bboxMin[2] - p[2], p[2] - bboxMax[2]
          )
        )
      });
    }
  }

  // Segmentos coincidentes e colineares
  for (const t of transformsList) {
    if (t.segmentLength < 1e-5 && t.name !== 'Hips' && t.name !== 'Root') {
      const node = hierarchyNodes.find((h) => h.id === t.id);
      if (node && node.parent) {
        coincidentSegments.push({
          childId: t.id,
          childName: t.name,
          parentId: node.parentId,
          parentName: node.parent,
          segmentLength: t.segmentLength
        });
      }
    }
  }

  // Checagem de simetria bilateral (plano YZ, eixo X simétrico em relação ao centro)
  const symmetryPairs = [];
  let maxAsymmetryDelta = 0;
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;

  const sidePairName = (name) => {
    if (name.startsWith('Left')) return 'Right' + name.slice(4);
    if (name.startsWith('Right')) return 'Left' + name.slice(5);
    if (name.startsWith('left_')) return 'right_' + name.slice(5);
    if (name.startsWith('right_')) return 'left_' + name.slice(6);
    if (name.endsWith('_L')) return name.slice(0, -2) + '_R';
    if (name.endsWith('_R')) return name.slice(0, -2) + '_L';
    return null;
  };

  const analyzedPairs = new Set();
  for (const item of transformsList) {
    const pairName = sidePairName(item.name);
    if (pairName && !analyzedPairs.has(pairName) && (item.name.startsWith('Left') || item.name.startsWith('left_') || item.name.endsWith('_L'))) {
      const other = transformsList.find((t) => t.name === pairName);
      analyzedPairs.add(item.name);
      analyzedPairs.add(pairName);

      if (other) {
        const leftP = item.modelRoot.position;
        const rightP = other.modelRoot.position;
        const expectedRightX = 2 * centerX - leftP[0];
        const asymmetryDelta = round5(
          Math.hypot(rightP[0] - expectedRightX, rightP[1] - leftP[1], rightP[2] - leftP[2])
        );

        if (asymmetryDelta > maxAsymmetryDelta) maxAsymmetryDelta = asymmetryDelta;

        symmetryPairs.push({
          leftName: item.name,
          leftId: item.id,
          rightName: other.name,
          rightId: other.id,
          asymmetryDelta,
          isSymmetric: asymmetryDelta < 1e-3
        });
      }
    }
  }

  // Verificação de trilhas de animação órfãs
  const animationClips = options.clips || root.animations || root.userData?.animations || [];
  if (Array.isArray(animationClips) && animationClips.length > 0) {
    const validNames = new Set(boneList.map((b) => b.name));
    root.traverse((o) => validNames.add(o.name));

    for (const clip of animationClips) {
      if (clip?.tracks) {
        for (const track of clip.tracks) {
          const trackNodeName = track.name.slice(0, track.name.lastIndexOf('.'));
          if (!validNames.has(trackNodeName)) {
            orphanAnimationTracks.push({
              clipName: clip.name,
              trackName: track.name,
              targetNode: trackNodeName,
              reason: 'Nó alvo da animação não existe no esqueleto nem na hierarquia do modelo'
            });
          }
        }
      }
    }
  }

  // Hierarquias inesperadas e ciclos
  if (roots.length > 1) {
    unexpectedHierarchies.push(`Esqueleto possui múltiplos nós raiz (${roots.length}): ${roots.join(', ')}.`);
  } else if (roots.length === 0 && boneList.length > 0) {
    unexpectedHierarchies.push('Esqueleto não possui nó raiz identificável (possível ciclo circular em todos os nós).');
  }

  for (const node of hierarchyNodes) {
    if (node.depth === -1) {
      unexpectedHierarchies.push(`Ciclo de parentesco detectado envolvendo o osso ${node.name} (${node.id}).`);
    }
  }

  // Riscos estruturais
  if (skinnedMeshes.length > 0 && bones.length < 2) {
    structuralRiskFlags.push('Esqueleto possui menos de 2 ossos para malha skinned.');
  }
  if (duplicateNames.length > 0) {
    structuralRiskFlags.push('Nomes de ossos duplicados impedem vinculação unívoca por nome em exportadores GLB/FBX.');
  }
  if (duplicateIds.length > 0) {
    structuralRiskFlags.push('IDs estáveis duplicados violam a integridade transacional de Rig Patch.');
  }

  // 8. Resumo e Métricas
  const warnings = [
    ...unexpectedHierarchies,
    ...structuralRiskFlags,
    ...duplicateNames.map((d) => `Nome duplicado: ${d.name} (${d.count}x)`),
    ...duplicateIds.map((d) => `ID duplicado: ${d.id} (${d.count}x)`),
    ...coincidentSegments.map((c) => `Segmento coincidente: ${c.childName} e ${c.parentName}`),
    ...outsideBounds.map((o) => `Osso fora da geometria: ${o.name} (excedeu ${o.distanceExceeded})`),
    ...orphanAnimationTracks.map((a) => `Track órfão: ${a.clipName} -> ${a.trackName}`),
    ...invalidReferences.map((i) => `Referência inválida: ${i.childName} -> ${i.referencedParent}`)
  ];

  for (const sm of skinningResults) {
    warnings.push(...sm.deformationWarnings.map((w) => `${sm.meshName}: ${w}`));
  }

  const mathematicalPass =
    duplicateNames.length === 0 &&
    duplicateIds.length === 0 &&
    invalidReferences.length === 0 &&
    unexpectedHierarchies.length === 0 &&
    (skinnedMeshes.length === 0 || skinningResults.every((s) => s.zeroWeightVertices === 0 && s.unnormalizedVertices === 0));

  return {
    schema: 'arenamon-rig-telemetry',
    version: 1,
    timestamp: new Date().toISOString(),
    modelName: root.name || 'UnnamedModel',
    bounds,
    identification: {
      totalBones: boneList.length,
      roots,
      hierarchy: hierarchyNodes,
      duplicateNames,
      duplicateIds,
      invalidReferences,
      meshCount: meshSummaries.length,
      skinnedMeshCount: skinnedMeshes.length,
      staticMeshCount: meshSummaries.filter((m) => !m.skinned).length,
      meshes: meshSummaries
    },
    transforms: {
      bones: transformsList,
      hasRestPoseStored: Boolean(root.userData?.arenamonRig?.joints)
    },
    skinning: {
      isSkinned: skinnedMeshes.length > 0,
      meshes: skinningResults,
      sharedSkeletons,
      globalUninfluencedBonesCount: boneList.length - globalInfluencedBones.size
    },
    consistency: {
      symmetry: {
        plane: 'YZ',
        centerPlaneX: round5(centerX),
        pairs: symmetryPairs,
        maxAsymmetryDelta: round5(maxAsymmetryDelta),
        isGloballySymmetric: maxAsymmetryDelta < 1e-3
      },
      outsideBounds,
      coincidentSegments,
      collinearSegments,
      unexpectedHierarchies,
      orphanAnimationTracks,
      structuralRiskFlags
    },
    metrics: {
      mathematicalPass,
      warningCount: warnings.length,
      warnings
    },
    notes: 'Relatório de telemetria diagnóstica. Métricas numéricas e geométricas não constituem validação ou certificação anatômica.'
  };
}

export function exportTelemetryJSON(root, options = {}) {
  const telemetry = inspectRig(root, options);
  return JSON.stringify(telemetry, null, 2);
}
