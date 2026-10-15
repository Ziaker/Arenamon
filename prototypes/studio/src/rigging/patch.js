// Arenamon Rigging — Rig Patch Engine & Transaction Manager (Marco 1)
// Execução programática e declarativa de correções estruturais em rigs.
// Garantia de atomicidade (rollback em falha), histórico Undo/Redo e sem eval.

import * as T from 'three';
import {
  collectBones,
  modelBounds,
  syncRigMetadata,
  uniqueJointName,
  validateDraft,
  ensureJointIds
} from './core.js';
import {inspectRig} from './telemetry.js';

const round5 = (n) => (Number.isFinite(n) ? Math.round(n * 100000) / 100000 : 0);
const tidyVec3 = (v) => [round5(v[0]), round5(v[1]), round5(v[2])];
const tidyQuat = (q) => [round5(q[0]), round5(q[1]), round5(q[2]), round5(q[3])];

let patchSeq = 0;
const newPatchJointId = () => `joint-p${Date.now().toString(36)}-${(++patchSeq).toString(36)}`;

// -------------------------------------------------------------
// 1. Snapshot e Rollback Atômico
// -------------------------------------------------------------
export function takeRigSnapshot(root) {
  root.updateMatrixWorld(true);
  const bones = collectBones(root);
  const boneStates = bones.map((b) => ({
    uuid: b.uuid,
    name: b.name,
    arenamonJointId: b.userData?.arenamonJointId || null,
    parentUuid: b.parent && b.parent.isBone ? b.parent.uuid : null,
    parentName: b.parent && b.parent.isBone ? b.parent.name : null,
    position: b.position.toArray(),
    quaternion: b.quaternion.toArray(),
    scale: b.scale.toArray()
  }));

  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const isSkinned = Boolean(o.isSkinnedMesh && o.skeleton);
    const entry = {
      uuid: o.uuid,
      name: o.name,
      isSkinned
    };
    if (isSkinned) {
      const idxAttr = o.geometry.getAttribute('skinIndex');
      const wAttr = o.geometry.getAttribute('skinWeight');
      entry.skinIndex = idxAttr ? new Uint16Array(idxAttr.array) : null;
      entry.skinWeight = wAttr ? new Float32Array(wAttr.array) : null;
      entry.boneInverses = o.skeleton.boneInverses.map((m) => m.clone());
      entry.skeletonBoneUuids = o.skeleton.bones.map((b) => b?.uuid || null);
    }
    meshes.push(entry);
  });

  const metadata = root.userData?.arenamonRig ? structuredClone(root.userData.arenamonRig) : null;
  const draft = root.userData?.arenamonRigDraft ? structuredClone(root.userData.arenamonRigDraft) : null;

  return {
    timestamp: Date.now(),
    boneStates,
    meshes,
    metadata,
    draft
  };
}

export function restoreRigSnapshot(root, snapshot) {
  if (!snapshot) return;

  // 1. Restaurar metadados
  if (snapshot.metadata) {
    root.userData.arenamonRig = structuredClone(snapshot.metadata);
  } else {
    delete root.userData.arenamonRig;
  }
  if (snapshot.draft) {
    root.userData.arenamonRigDraft = structuredClone(snapshot.draft);
  } else {
    delete root.userData.arenamonRigDraft;
  }

  // 2. Restaurar ossos
  const currentBones = collectBones(root);
  const boneMap = new Map();
  for (const b of currentBones) {
    boneMap.set(b.uuid, b);
    if (b.name) boneMap.set(b.name, b);
    if (b.userData?.arenamonJointId) boneMap.set(b.userData.arenamonJointId, b);
  }

  // Identificar ossos que foram criados após o snapshot e removê-los
  const snapshotUuids = new Set(snapshot.boneStates.map((s) => s.uuid));
  for (const b of currentBones) {
    if (!snapshotUuids.has(b.uuid)) {
      b.removeFromParent();
      boneMap.delete(b.uuid);
      boneMap.delete(b.name);
      if (b.userData?.arenamonJointId) boneMap.delete(b.userData.arenamonJointId);
    }
  }

  // Recriar ossos presentes no snapshot que tenham sido removidos (ex: durante Undo)
  for (const state of snapshot.boneStates) {
    let b = boneMap.get(state.uuid) || boneMap.get(state.name);
    if (!b) {
      b = new T.Bone();
      b.uuid = state.uuid;
      boneMap.set(b.uuid, b);
      boneMap.set(state.name, b);
      if (state.arenamonJointId) {
        b.userData.arenamonJointId = state.arenamonJointId;
        boneMap.set(state.arenamonJointId, b);
      }
    }
  }

  // Restaurar atributos e relações dos ossos
  for (const state of snapshot.boneStates) {
    const b = boneMap.get(state.uuid) || boneMap.get(state.name);
    if (b) {
      b.name = state.name;
      if (state.arenamonJointId) {
        b.userData.arenamonJointId = state.arenamonJointId;
      }
      b.position.fromArray(state.position);
      b.quaternion.fromArray(state.quaternion);
      b.scale.fromArray(state.scale);

      // Restaurar pai
      if (state.parentUuid || state.parentName) {
        const parentBone = boneMap.get(state.parentUuid) || boneMap.get(state.parentName);
        if (parentBone && b.parent !== parentBone) {
          parentBone.add(b);
        }
      } else {
        // Osso raiz do esqueleto
        if (!b.parent || b.parent.isBone) {
          const rootArmature = root.getObjectByName('Armature') || root;
          rootArmature.add(b);
        }
      }
    }
  }

  root.updateMatrixWorld(true);

  // 3. Restaurar pesos, paleta e matrizes das malhas
  root.traverse((o) => {
    if (!o.isSkinnedMesh || !o.skeleton) return;
    const meshSnapshot = snapshot.meshes.find((m) => m.uuid === o.uuid || m.name === o.name);
    if (meshSnapshot) {
      if (meshSnapshot.skeletonBoneUuids) {
        o.skeleton.bones = meshSnapshot.skeletonBoneUuids.map((u) => boneMap.get(u)).filter(Boolean);
      }
      if (meshSnapshot.skinIndex && meshSnapshot.skinWeight) {
        o.geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(meshSnapshot.skinIndex, 4));
        o.geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(meshSnapshot.skinWeight, 4));
        o.geometry.attributes.skinIndex.needsUpdate = true;
        o.geometry.attributes.skinWeight.needsUpdate = true;
      }
      if (meshSnapshot.boneInverses) {
        o.skeleton.boneInverses = meshSnapshot.boneInverses.map((m) => m.clone());
      }
    }
  });

  root.updateMatrixWorld(true);
}

// -------------------------------------------------------------
// 2. Validação e Simulação Pre-Flight (Dry Run)
// -------------------------------------------------------------
export function validatePatch(patch) {
  if (!patch || typeof patch !== 'object') {
    throw new Error('Patch inválido: esperado objeto JSON.');
  }
  if (patch.schema !== 'arenamon-rig-patch') {
    throw new Error(`Schema inválido: esperado "arenamon-rig-patch", recebido "${patch.schema}".`);
  }
  if (patch.version !== 1) {
    throw new Error(`Versão de patch não suportada: ${patch.version}. Use versão 1.`);
  }
  if (!Array.isArray(patch.operations)) {
    throw new Error('Patch inválido: o campo "operations" deve ser um array.');
  }

  const supportedOps = new Set([
    'setBonePosition',
    'setBoneQuaternion',
    'moveBone',
    'setRestPose',
    'mirrorBone',
    'correctSymmetry',
    'renameJoint',
    'createBone',
    'deleteBone',
    'reparentBone',
    'recomputeBindMatrices',
    'recomputeSkinningWeights',
    'normalizeSkinWeights',
    'modifyVertexWeights'
  ]);

  for (let i = 0; i < patch.operations.length; i++) {
    const op = patch.operations[i];
    if (!op || typeof op !== 'object' || typeof op.op !== 'string') {
      throw new Error(`Operação no índice ${i} inválida: esperado objeto com campo "op".`);
    }
    if (!supportedOps.has(op.op)) {
      throw new Error(`Operação não reconhecida no índice ${i}: "${op.op}".`);
    }
  }

  return true;
}

export function simulateRigPatch(root, patch, options = {}) {
  validatePatch(patch);
  const preTelemetry = inspectRig(root, options);
  const errors = [];
  const warnings = [];

  const bonesAdded = [];
  const bonesRemoved = [];
  const bonesMoved = [];
  const bonesRotated = [];
  const bonesRenamed = [];
  const bonesReparented = [];
  let skinningImpacted = false;

  const existingBones = new Map();
  for (const b of preTelemetry.identification.hierarchy) {
    existingBones.set(b.id, b);
    existingBones.set(b.name, b);
  }

  const existingMeshes = new Set(preTelemetry.identification.meshes.map((m) => m.name));

  // Simulação de efeitos em lista virtual
  const virtualBones = new Map(existingBones);
  const virtualNames = new Set(preTelemetry.identification.hierarchy.map((b) => b.name));

  for (let i = 0; i < patch.operations.length; i++) {
    const op = patch.operations[i];
    switch (op.op) {
      case 'setBonePosition':
      case 'moveBone': {
        const b = virtualBones.get(op.jointId);
        if (!b) {
          errors.push(`[Op ${i} ${op.op}] Osso não encontrado: "${op.jointId}".`);
        } else {
          bonesMoved.push({ id: op.jointId, name: b.name, op: op.op });
          if (preTelemetry.skinning.isSkinned) skinningImpacted = true;
        }
        break;
      }
      case 'setBoneQuaternion': {
        const b = virtualBones.get(op.jointId);
        if (!b) {
          errors.push(`[Op ${i} ${op.op}] Osso não encontrado: "${op.jointId}".`);
        } else {
          bonesRotated.push({ id: op.jointId, name: b.name });
          if (preTelemetry.skinning.isSkinned) skinningImpacted = true;
        }
        break;
      }
      case 'setRestPose': {
        const b = virtualBones.get(op.jointId);
        if (!b) {
          errors.push(`[Op ${i} ${op.op}] Osso não encontrado: "${op.jointId}".`);
        } else {
          bonesMoved.push({ id: op.jointId, name: b.name });
          bonesRotated.push({ id: op.jointId, name: b.name });
          skinningImpacted = true;
        }
        break;
      }
      case 'mirrorBone': {
        const b = virtualBones.get(op.jointId);
        if (!b) {
          errors.push(`[Op ${i} ${op.op}] Osso não encontrado: "${op.jointId}".`);
        } else {
          bonesMoved.push({ id: op.jointId, name: b.name, mirrored: true });
        }
        break;
      }
      case 'correctSymmetry': {
        bonesMoved.push({ id: 'all-bilateral-pairs', name: 'Symmetry correction' });
        break;
      }
      case 'renameJoint': {
        const b = virtualBones.get(op.jointId);
        if (!b) {
          errors.push(`[Op ${i} ${op.op}] Osso não encontrado: "${op.jointId}".`);
        } else if (!op.newName || typeof op.newName !== 'string' || !op.newName.trim()) {
          errors.push(`[Op ${i} ${op.op}] Novo nome inválido para "${op.jointId}".`);
        } else if (virtualNames.has(op.newName.trim()) && op.newName.trim() !== b.name) {
          errors.push(`[Op ${i} ${op.op}] Nome de osso "${op.newName.trim()}" já existe.`);
        } else {
          bonesRenamed.push({ id: op.jointId, from: b.name, to: op.newName.trim() });
          virtualNames.delete(b.name);
          virtualNames.add(op.newName.trim());
          warnings.push(`Renomear "${b.name}" para "${op.newName.trim()}" pode afetar trilhas de animação externas.`);
        }
        break;
      }
      case 'createBone': {
        if (!op.name || typeof op.name !== 'string' || !op.name.trim()) {
          errors.push(`[Op ${i} ${op.op}] Campo "name" é obrigatório.`);
        } else {
          const id = op.id || newPatchJointId();
          bonesAdded.push({ id, name: op.name.trim(), parent: op.parent || null });
          virtualBones.set(id, { id, name: op.name.trim(), parent: op.parent || null });
          virtualBones.set(op.name.trim(), { id, name: op.name.trim(), parent: op.parent || null });
          virtualNames.add(op.name.trim());
          if (preTelemetry.skinning.isSkinned) {
            warnings.push(`Criação do osso "${op.name}" em malha já skinned requer recálculo de bind e pesos.`);
            skinningImpacted = true;
          }
        }
        break;
      }
      case 'deleteBone': {
        const b = virtualBones.get(op.jointId);
        if (!b) {
          errors.push(`[Op ${i} ${op.op}] Osso a ser removido não encontrado: "${op.jointId}".`);
        } else {
          bonesRemoved.push({ id: op.jointId, name: b.name });
          virtualBones.delete(op.jointId);
          virtualBones.delete(b.name);
          virtualNames.delete(b.name);
          warnings.push(`A exclusão do osso "${b.name}" removerá suas influências de skinning e inutilizará trilhas correspondentes.`);
          skinningImpacted = true;
        }
        break;
      }
      case 'reparentBone': {
        const b = virtualBones.get(op.jointId);
        if (!b) {
          errors.push(`[Op ${i} ${op.op}] Osso não encontrado: "${op.jointId}".`);
        } else if (op.newParentJointId && !virtualBones.has(op.newParentJointId)) {
          errors.push(`[Op ${i} ${op.op}] Novo pai não encontrado: "${op.newParentJointId}".`);
        } else {
          bonesReparented.push({ id: op.jointId, name: b.name, newParent: op.newParentJointId });
          warnings.push(`Alteração na hierarquia de "${b.name}" pode alterar o comportamento cinemático.`);
        }
        break;
      }
      case 'recomputeBindMatrices':
      case 'recomputeSkinningWeights':
      case 'normalizeSkinWeights':
        skinningImpacted = true;
        break;
      case 'modifyVertexWeights': {
        if (!op.meshName || !existingMeshes.has(op.meshName)) {
          errors.push(`[Op ${i} ${op.op}] Malha "${op.meshName}" não encontrada no modelo.`);
        }
        if (!Array.isArray(op.influences)) {
          errors.push(`[Op ${i} ${op.op}] O campo "influences" deve ser um array.`);
        }
        skinningImpacted = true;
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    diff: {
      bonesAdded,
      bonesRemoved,
      bonesMoved,
      bonesRotated,
      bonesRenamed,
      bonesReparented,
      skinningImpacted
    }
  };
}

// -------------------------------------------------------------
// 3. Executor Transacional de Rig Patch
// -------------------------------------------------------------
export function applyRigPatch(root, patch, options = {}) {
  // Pre-flight validation
  const simulation = simulateRigPatch(root, patch, options);
  if (!simulation.valid) {
    const errorMsg = `Rig Patch rejeitado na validação prévia:\n- ${simulation.errors.join('\n- ')}`;
    throw new Error(errorMsg);
  }

  // Capturar snapshot para rollback atômico e Undo
  const preSnapshot = takeRigSnapshot(root);
  const undoStack = options.undoStack || null;

  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  const rootWorldQuat = root.getWorldQuaternion(new T.Quaternion());
  const rootWorldQuatInv = rootWorldQuat.clone().invert();

  // Helper para resolver osso por id estável ou nome
  function findBone(ref) {
    const bones = collectBones(root);
    return (
      bones.find((b) => b.userData?.arenamonJointId === ref) ||
      bones.find((b) => b.uuid === ref) ||
      bones.find((b) => b.name === ref) ||
      null
    );
  }

  // Helper para resolver draft joint se modelo ainda não for skinned
  function findDraftJoint(draft, ref) {
    if (!draft?.joints) return null;
    return draft.joints.find((j) => j.id === ref || j.name === ref) || null;
  }

  const isSkinned = Boolean(collectBones(root).length > 0 && root.userData?.arenamonRig);
  const draft = root.userData?.arenamonRigDraft || (root.userData?.arenamonRig?.mode === 'draft' ? root.userData.arenamonRig : null);

  try {
    for (const op of patch.operations) {
      switch (op.op) {
        case 'setBonePosition': {
          const space = op.space || 'model-root';
          const pos = op.position;
          const bone = findBone(op.jointId);

          if (bone) {
            if (space === 'model-root') {
              const targetWorld = root.localToWorld(new T.Vector3(...pos));
              const parentWorld = bone.parent ? bone.parent.matrixWorld.clone().invert() : new T.Matrix4();
              bone.position.copy(targetWorld.applyMatrix4(parentWorld));
            } else {
              bone.position.set(pos[0], pos[1], pos[2]);
            }
            bone.updateMatrixWorld(true);
          } else if (draft) {
            const dj = findDraftJoint(draft, op.jointId);
            if (dj) dj.p = [...pos];
          }
          break;
        }

        case 'setBoneQuaternion': {
          const quat = op.quaternion;
          const bone = findBone(op.jointId);
          if (bone) {
            bone.quaternion.set(quat[0], quat[1], quat[2], quat[3]);
            bone.updateMatrixWorld(true);
          } else if (draft) {
            const dj = findDraftJoint(draft, op.jointId);
            if (dj) dj.q = [...quat];
          }
          break;
        }

        case 'moveBone': {
          const space = op.space || 'model-root';
          const delta = op.delta;
          const bone = findBone(op.jointId);

          if (bone) {
            if (space === 'model-root') {
              const currentWorld = bone.getWorldPosition(new T.Vector3());
              const currentInRoot = currentWorld.clone().applyMatrix4(rootInv);
              currentInRoot.x += delta[0];
              currentInRoot.y += delta[1];
              currentInRoot.z += delta[2];
              const newWorld = root.localToWorld(currentInRoot);
              const parentInv = bone.parent ? bone.parent.matrixWorld.clone().invert() : new T.Matrix4();
              bone.position.copy(newWorld.applyMatrix4(parentInv));
            } else {
              bone.position.x += delta[0];
              bone.position.y += delta[1];
              bone.position.z += delta[2];
            }
            bone.updateMatrixWorld(true);
          } else if (draft) {
            const dj = findDraftJoint(draft, op.jointId);
            if (dj) {
              dj.p[0] += delta[0];
              dj.p[1] += delta[1];
              dj.p[2] += delta[2];
            }
          }
          break;
        }

        case 'renameJoint': {
          const newName = op.newName.trim();
          const bone = findBone(op.jointId);
          if (bone) {
            bone.name = newName;
          }
          if (draft) {
            const dj = findDraftJoint(draft, op.jointId);
            if (dj) {
              const oldName = dj.name;
              dj.name = newName;
              for (const other of draft.joints) {
                if (other.parent === oldName) other.parent = newName;
              }
            }
          }
          break;
        }

        case 'createBone': {
          const newId = op.id || newPatchJointId();
          const newName = op.name.trim();
          const parentRef = op.parent;
          const pos = op.position || [0, 0, 0];
          const quat = op.quaternion || [0, 0, 0, 1];

          const parentBone = parentRef ? findBone(parentRef) : null;
          const newBone = new T.Bone();
          newBone.name = newName;
          newBone.userData.arenamonJointId = newId;
          newBone.position.set(pos[0], pos[1], pos[2]);
          newBone.quaternion.set(quat[0], quat[1], quat[2], quat[3]);

          if (parentBone) {
            parentBone.add(newBone);
          } else {
            // Se não houver pai, adiciona ao container do esqueleto ou na raiz
            const existingRootBone = collectBones(root)[0];
            if (existingRootBone && existingRootBone.parent) {
              existingRootBone.parent.add(newBone);
            } else {
              root.add(newBone);
            }
          }

          // Se houver SkinnedMesh, expandir a paleta de esqueletos
          root.traverse((o) => {
            if (o.isSkinnedMesh && o.skeleton) {
              if (!o.skeleton.bones.includes(newBone)) {
                o.skeleton.bones.push(newBone);
                const inv = new T.Matrix4();
                newBone.updateMatrixWorld(true);
                inv.copy(newBone.matrixWorld).invert();
                o.skeleton.boneInverses.push(inv);
              }
            }
          });

          if (draft) {
            draft.joints.push({
              id: newId,
              name: newName,
              parent: parentRef,
              p: [...pos],
              q: [...quat]
            });
          }
          break;
        }

        case 'deleteBone': {
          const bone = findBone(op.jointId);
          if (bone) {
            const parent = bone.parent;
            const children = [...bone.children];
            for (const c of children) {
              c.removeFromParent();
              if (op.reparentChildren !== false && parent) {
                parent.add(c);
              }
            }
            bone.removeFromParent();

            // Atualizar paletas de SkinnedMesh
            root.traverse((o) => {
              if (o.isSkinnedMesh && o.skeleton) {
                const bIdx = o.skeleton.bones.indexOf(bone);
                if (bIdx >= 0) {
                  o.skeleton.bones.splice(bIdx, 1);
                  o.skeleton.boneInverses.splice(bIdx, 1);
                }
              }
            });
          }

          if (draft) {
            const idx = draft.joints.findIndex((j) => j.id === op.jointId || j.name === op.jointId);
            if (idx >= 0) {
              const removed = draft.joints[idx];
              for (const child of draft.joints) {
                if (child.parent === removed.name) {
                  child.parent = op.reparentChildren !== false ? removed.parent : null;
                }
              }
              draft.joints.splice(idx, 1);
            }
          }
          break;
        }

        case 'reparentBone': {
          const bone = findBone(op.jointId);
          const newParent = op.newParentJointId ? findBone(op.newParentJointId) : null;
          if (bone) {
            bone.removeFromParent();
            if (newParent) {
              newParent.add(bone);
            } else {
              root.add(bone);
            }
            bone.updateMatrixWorld(true);
          }
          if (draft) {
            const dj = findDraftJoint(draft, op.jointId);
            const pj = op.newParentJointId ? findDraftJoint(draft, op.newParentJointId) : null;
            if (dj) dj.parent = pj ? pj.name : null;
          }
          break;
        }

        case 'mirrorBone': {
          const bone = findBone(op.jointId);
          const bounds = modelBounds(root);
          const centerX = op.symmetryCenter !== undefined ? op.symmetryCenter : (bounds.min[0] + bounds.max[0]) / 2;

          const sidePairName = (name) => {
            if (name.startsWith('Left')) return 'Right' + name.slice(4);
            if (name.startsWith('Right')) return 'Left' + name.slice(5);
            return null;
          };

          if (bone) {
            const pairName = sidePairName(bone.name);
            const other = pairName ? findBone(pairName) : null;
            if (other) {
              const p = bone.getWorldPosition(new T.Vector3()).applyMatrix4(rootInv);
              const mirroredP = new T.Vector3(2 * centerX - p.x, p.y, p.z);
              const targetWorld = root.localToWorld(mirroredP);
              const otherParentInv = other.parent ? other.parent.matrixWorld.clone().invert() : new T.Matrix4();
              other.position.copy(targetWorld.applyMatrix4(otherParentInv));
              other.updateMatrixWorld(true);
            }
          }
          break;
        }

        case 'correctSymmetry': {
          const bounds = modelBounds(root);
          const centerX = (bounds.min[0] + bounds.max[0]) / 2;
          const refSide = op.referenceSide || 'Left';
          const bones = collectBones(root);

          for (const b of bones) {
            if (b.name.startsWith(refSide)) {
              const otherName = (refSide === 'Left' ? 'Right' : 'Left') + b.name.slice(refSide.length);
              const other = bones.find((x) => x.name === otherName);
              if (other) {
                const p = b.getWorldPosition(new T.Vector3()).applyMatrix4(rootInv);
                const mirroredP = new T.Vector3(2 * centerX - p.x, p.y, p.z);
                const targetWorld = root.localToWorld(mirroredP);
                const otherParentInv = other.parent ? other.parent.matrixWorld.clone().invert() : new T.Matrix4();
                other.position.copy(targetWorld.applyMatrix4(otherParentInv));
                other.updateMatrixWorld(true);
              }
            }
          }
          break;
        }

        case 'recomputeBindMatrices': {
          root.updateMatrixWorld(true);
          root.traverse((o) => {
            if (o.isSkinnedMesh && o.skeleton) {
              o.skeleton.calculateInverses();
            }
          });
          break;
        }

        case 'normalizeSkinWeights': {
          root.traverse((o) => {
            if (o.isSkinnedMesh && (!op.meshName || o.name === op.meshName)) {
              const attr = o.geometry.getAttribute('skinWeight');
              if (attr) {
                for (let i = 0; i < attr.count; i++) {
                  let sum = 0;
                  for (let k = 0; k < 4; k++) sum += attr.getComponent(i, k);
                  if (sum > 1e-5) {
                    for (let k = 0; k < 4; k++) attr.setComponent(i, k, attr.getComponent(i, k) / sum);
                  }
                }
                attr.needsUpdate = true;
              }
            }
          });
          break;
        }

        case 'modifyVertexWeights': {
          root.traverse((o) => {
            if (o.isSkinnedMesh && o.name === op.meshName) {
              const idxAttr = o.geometry.getAttribute('skinIndex');
              const wAttr = o.geometry.getAttribute('skinWeight');
              const vi = op.vertexIndex;
              if (idxAttr && wAttr && vi >= 0 && vi < wAttr.count) {
                const palette = o.skeleton.bones;
                for (let k = 0; k < 4; k++) {
                  if (k < op.influences.length) {
                    const inf = op.influences[k];
                    const bIdx = palette.findIndex((b) => b.userData?.arenamonJointId === inf.jointId || b.name === inf.jointId || b.uuid === inf.jointId);
                    idxAttr.setComponent(vi, k, Math.max(0, bIdx));
                    wAttr.setComponent(vi, k, Number(inf.weight) || 0);
                  } else {
                    idxAttr.setComponent(vi, k, 0);
                    wAttr.setComponent(vi, k, 0);
                  }
                }
                idxAttr.needsUpdate = true;
                wAttr.needsUpdate = true;
              }
            }
          });
          break;
        }
      }
    }

    // Sincronizar matrizes mundiais e metadados
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) {
        o.skeleton.calculateInverses();
      }
    });

    syncRigMetadata(root);

    // Snapshot pós-operação para suporte a Undo/Redo
    const postSnapshot = takeRigSnapshot(root);
    if (undoStack && typeof undoStack.push === 'function') {
      undoStack.push({
        name: `Rig Patch (${patch.operations.length} ops)`,
        undo: () => restoreRigSnapshot(root, preSnapshot),
        redo: () => restoreRigSnapshot(root, postSnapshot)
      });
    }

    const postTelemetry = inspectRig(root, options);
    return {
      success: true,
      diff: simulation.diff,
      warnings: simulation.warnings,
      telemetry: postTelemetry
    };
  } catch (err) {
    // ATOMIC ROLLBACK: Reverter integralmente em caso de qualquer exceção
    restoreRigSnapshot(root, preSnapshot);
    throw new Error(`Falha durante a execução do Rig Patch. Rollback atômico executado. Causa: ${err.message}`);
  }
}

// -------------------------------------------------------------
// 4. Fluent Builder para Programação Fácil por Agentes de IA
// -------------------------------------------------------------
export class RigPatchBuilder {
  constructor(targetModel = null) {
    this.patch = {
      schema: 'arenamon-rig-patch',
      version: 1,
      targetModel,
      operations: []
    };
  }

  setBonePosition(jointId, position, space = 'model-root') {
    this.patch.operations.push({ op: 'setBonePosition', jointId, space, position: tidyVec3(position) });
    return this;
  }

  setBoneQuaternion(jointId, quaternion) {
    this.patch.operations.push({ op: 'setBoneQuaternion', jointId, quaternion: tidyQuat(quaternion) });
    return this;
  }

  moveBone(jointId, delta, space = 'model-root') {
    this.patch.operations.push({ op: 'moveBone', jointId, space, delta: tidyVec3(delta) });
    return this;
  }

  renameJoint(jointId, newName) {
    this.patch.operations.push({ op: 'renameJoint', jointId, newName });
    return this;
  }

  createBone({ id, name, parent = null, position = [0, 0, 0], quaternion = [0, 0, 0, 1] }) {
    this.patch.operations.push({ op: 'createBone', id, name, parent, position: tidyVec3(position), quaternion: tidyQuat(quaternion) });
    return this;
  }

  deleteBone(jointId, { reparentChildren = true } = {}) {
    this.patch.operations.push({ op: 'deleteBone', jointId, reparentChildren });
    return this;
  }

  reparentBone(jointId, newParentJointId) {
    this.patch.operations.push({ op: 'reparentBone', jointId, newParentJointId });
    return this;
  }

  mirrorBone(jointId) {
    this.patch.operations.push({ op: 'mirrorBone', jointId });
    return this;
  }

  correctSymmetry(referenceSide = 'Left') {
    this.patch.operations.push({ op: 'correctSymmetry', referenceSide });
    return this;
  }

  recomputeBindMatrices() {
    this.patch.operations.push({ op: 'recomputeBindMatrices' });
    return this;
  }

  normalizeSkinWeights(meshName = null) {
    this.patch.operations.push({ op: 'normalizeSkinWeights', meshName });
    return this;
  }

  modifyVertexWeights(meshName, vertexIndex, influences) {
    this.patch.operations.push({ op: 'modifyVertexWeights', meshName, vertexIndex, influences });
    return this;
  }

  build() {
    validatePatch(this.patch);
    return structuredClone(this.patch);
  }
}

// -------------------------------------------------------------
// 5. Controlador Programático de Rig (RigController)
// -------------------------------------------------------------
export class RigController {
  constructor(root, options = {}) {
    this.root = root;
    this.undoStack = [];
    this.redoStack = [];
    this.options = options;
  }

  getTelemetry() {
    return inspectRig(this.root, this.options);
  }

  simulate(patch) {
    return simulateRigPatch(this.root, patch, this.options);
  }

  apply(patch) {
    const preSnapshot = takeRigSnapshot(this.root);
    const result = applyRigPatch(this.root, patch, this.options);
    const postSnapshot = takeRigSnapshot(this.root);

    this.undoStack.push({
      name: `Patch (${patch.operations?.length || 1} ops)`,
      undo: () => restoreRigSnapshot(this.root, preSnapshot),
      redo: () => restoreRigSnapshot(this.root, postSnapshot)
    });
    this.redoStack = []; // limpar redo ao aplicar nova ação
    return result;
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    const item = this.undoStack.pop();
    item.undo();
    this.redoStack.push(item);
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    const item = this.redoStack.pop();
    item.redo();
    this.undoStack.push(item);
    return true;
  }

  // Atalhos diretos programáticos
  moveBone(jointId, delta, space = 'model-root') {
    const patch = new RigPatchBuilder().moveBone(jointId, delta, space).build();
    return this.apply(patch);
  }

  setBonePosition(jointId, position, space = 'model-root') {
    const patch = new RigPatchBuilder().setBonePosition(jointId, position, space).build();
    return this.apply(patch);
  }

  renameJoint(jointId, newName) {
    const patch = new RigPatchBuilder().renameJoint(jointId, newName).build();
    return this.apply(patch);
  }

  createBone(params) {
    const patch = new RigPatchBuilder().createBone(params).build();
    return this.apply(patch);
  }

  deleteBone(jointId, options) {
    const patch = new RigPatchBuilder().deleteBone(jointId, options).build();
    return this.apply(patch);
  }

  mirrorBone(jointId) {
    const patch = new RigPatchBuilder().mirrorBone(jointId).build();
    return this.apply(patch);
  }

  correctSymmetry(referenceSide = 'Left') {
    const patch = new RigPatchBuilder().correctSymmetry(referenceSide).build();
    return this.apply(patch);
  }
}
