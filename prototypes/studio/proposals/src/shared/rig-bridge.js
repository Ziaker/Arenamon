// Rigging Bridge API — Camada de abstração e integração entre as interfaces de usuário
// e o núcleo técnico de rigging (compatível com os contratos do Codex e extensível).
import * as THREE from 'three';
import { modelBounds, makeTemplate, collectBones, currentJoints, auditRig, validateDraft, applyMirror, bindDraftToModel, exportCoordinates } from '../../../src/rigging/core.js';

export const HUMANOID_TEMPLATE_20 = 'humanoid-20';
export const CREATURE_QUADRUPED_24 = 'creature-quadruped-24';

/**
 * Gera um template de criatura quadrúpede com cauda e chifres
 * para demonstrar suporte a anatomias não-humanoides.
 */
export function makeCreatureTemplate(bounds) {
  const [xmin, ymin, zmin] = bounds.min;
  const [width, height, depth] = bounds.size;
  const midX = (xmin + bounds.max[0]) / 2;
  const midZ = (zmin + bounds.max[2]) / 2;

  const px = (side, fraction) => midX + side * width * fraction;
  const py = fraction => ymin + height * fraction;
  const pz = fraction => midZ + depth * fraction;

  const joints = [
    { name: 'Hips', parent: null, p: [midX, py(0.52), pz(-0.25)] },
    { name: 'SpineBack', parent: 'Hips', p: [midX, py(0.56), pz(-0.05)] },
    { name: 'SpineChest', parent: 'SpineBack', p: [midX, py(0.62), pz(0.18)] },
    { name: 'Neck', parent: 'SpineChest', p: [midX, py(0.72), pz(0.38)] },
    { name: 'Head', parent: 'Neck', p: [midX, py(0.82), pz(0.55)] },
    { name: 'Jaw', parent: 'Head', p: [midX, py(0.74), pz(0.65)] },
    // Chifres
    { name: 'LeftHorn', parent: 'Head', p: [px(-1, 0.22), py(0.95), pz(0.48)] },
    { name: 'RightHorn', parent: 'Head', p: [px(1, 0.22), py(0.95), pz(0.48)] },
    // Cauda
    { name: 'Tail1', parent: 'Hips', p: [midX, py(0.48), pz(-0.45)] },
    { name: 'Tail2', parent: 'Tail1', p: [midX, py(0.42), pz(-0.68)] },
    { name: 'Tail3', parent: 'Tail2', p: [midX, py(0.38), pz(-0.90)] },
  ];

  // Patas dianteiras
  for (const [label, side] of [['Left', -1], ['Right', 1]]) {
    joints.push(
      { name: label + 'Shoulder', parent: 'SpineChest', p: [px(side, 0.28), py(0.58), pz(0.22)] },
      { name: label + 'FrontKnee', parent: label + 'Shoulder', p: [px(side, 0.29), py(0.34), pz(0.25)] },
      { name: label + 'FrontAnkle', parent: label + 'FrontKnee', p: [px(side, 0.30), py(0.12), pz(0.20)] },
      { name: label + 'FrontPaw', parent: label + 'FrontAnkle', p: [px(side, 0.30), py(0.04), pz(0.28)] },
      // Patas traseiras
      { name: label + 'Hip', parent: 'Hips', p: [px(side, 0.25), py(0.50), pz(-0.25)] },
      { name: label + 'BackKnee', parent: label + 'Hip', p: [px(side, 0.27), py(0.32), pz(-0.35)] },
      { name: label + 'BackAnkle', parent: label + 'BackKnee', p: [px(side, 0.28), py(0.12), pz(-0.28)] },
      { name: label + 'BackPaw', parent: label + 'BackAnkle', p: [px(side, 0.28), py(0.04), pz(-0.20)] }
    );
  }

  return {
    schema: 'arenamon-rig',
    version: 1,
    space: 'model-root',
    mode: 'draft',
    templateType: CREATURE_QUADRUPED_24,
    source: 'template quadrúpede 24 pontos — anatomia estilizada',
    joints,
    bounds: {
      min: bounds.min.map(n => Math.round(n * 1000) / 1000),
      max: bounds.max.map(n => Math.round(n * 1000) / 1000),
      size: bounds.size.map(n => Math.round(n * 1000) / 1000)
    }
  };
}

export class RiggingBridge {
  constructor({ scene, camera, renderer, onStateChange = null }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.onStateChange = onStateChange;

    this.model = null;
    this.draft = null;
    this.activeTemplateType = HUMANOID_TEMPLATE_20;
    this.selectedJointName = null;
    this.symmetryEnabled = true;
    this.isolatedJointChain = null; // null ou Set com nomes dos ossos isolados

    // Histórico de Undo / Redo
    this.historyStack = [];
    this.redoStack = [];

    // Poses temporárias de teste de deformação
    this.poseOverrides = new Map(); // boneName -> { rotation: THREE.Euler, baseQuaternion: THREE.Quaternion }
    this.restBaseQuaternions = new Map();

    // Cache de auditoria
    this.cachedAudit = null;
  }

  notify() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.getStateSnapshot());
    }
  }

  getStateSnapshot() {
    return {
      hasModel: !!this.model,
      isSkinned: this.isSkinned(),
      draft: this.draft,
      templateType: this.activeTemplateType,
      selected: this.selectedJointName,
      symmetry: this.symmetryEnabled,
      joints: this.getJoints(),
      audit: this.cachedAudit,
      canUndo: this.historyStack.length > 0,
      canRedo: this.redoStack.length > 0
    };
  }

  setModel(model) {
    this.model = model;
    this.poseOverrides.clear();
    this.restBaseQuaternions.clear();
    this.historyStack = [];
    this.redoStack = [];

    if (this.model) {
      this.captureRestPose();
      if (!this.isSkinned()) {
        this.initTemplate(this.activeTemplateType);
      } else {
        this.draft = null;
        const bones = this.getBones();
        if (bones.length > 0) {
          this.selectedJointName = bones[0].name;
        }
      }
      this.refreshAudit();
    } else {
      this.draft = null;
      this.selectedJointName = null;
    }
    this.notify();
  }

  isSkinned() {
    if (!this.model) return false;
    let skinnedCount = 0;
    this.model.traverse(o => {
      if (o.isSkinnedMesh && o.skeleton) skinnedCount++;
    });
    return skinnedCount > 0;
  }

  getBones() {
    if (!this.model) return [];
    return collectBones(this.model);
  }

  getJoints() {
    if (this.draft && this.draft.joints) {
      return this.draft.joints;
    }
    if (this.model) {
      return currentJoints(this.model);
    }
    return [];
  }

  getJoint(name) {
    if (!name) return null;
    return this.getJoints().find(j => j.name === name) || null;
  }

  getBoneObject(name) {
    if (!this.model || !name) return null;
    let found = null;
    this.model.traverse(o => {
      if (!found && o.isBone && o.name === name) {
        found = o;
      }
    });
    return found;
  }

  getHierarchyTree() {
    const joints = this.getJoints();
    if (!joints.length) return [];

    const map = new Map();
    const roots = [];

    for (const j of joints) {
      map.set(j.name, { ...j, children: [] });
    }

    for (const j of joints) {
      const node = map.get(j.name);
      if (j.parent && map.has(j.parent)) {
        map.get(j.parent).children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  getDescendants(name) {
    const desc = new Set();
    const addChildren = (parentName) => {
      const children = this.getJoints().filter(j => j.parent === parentName);
      for (const c of children) {
        desc.add(c.name);
        addChildren(c.name);
      }
    };
    addChildren(name);
    return desc;
  }

  initTemplate(templateType = HUMANOID_TEMPLATE_20) {
    if (!this.model || this.isSkinned()) return;
    this.activeTemplateType = templateType;
    const bounds = modelBounds(this.model);
    if (templateType === CREATURE_QUADRUPED_24) {
      this.draft = makeCreatureTemplate(bounds);
    } else {
      this.draft = makeTemplate(bounds);
      this.draft.templateType = HUMANOID_TEMPLATE_20;
    }
    this.selectedJointName = this.draft.joints[0]?.name || null;
    this.refreshAudit();
    this.notify();
  }

  selectJoint(name) {
    if (!name) {
      this.selectedJointName = null;
      this.notify();
      return;
    }
    const exists = this.getJoint(name);
    if (exists) {
      this.selectedJointName = name;
      this.notify();
    }
  }

  selectChain(name) {
    if (!name) return;
    const desc = this.getDescendants(name);
    desc.add(name);
    this.isolatedJointChain = desc;
    this.selectJoint(name);
    this.notify();
  }

  clearIsolation() {
    this.isolatedJointChain = null;
    this.notify();
  }

  setJointPosition(name, newPosition, { recordHistory = true } = {}) {
    const current = this.getJoint(name);
    if (!current) return false;

    const oldPos = [...current.p];
    const isSame = oldPos.every((val, i) => Math.abs(val - newPosition[i]) < 1e-6);
    if (isSame) return false;

    const changes = new Map();
    changes.set(name, { from: oldPos, to: [...newPosition] });

    // Se simetria estiver ativa, calcula o par espelhado
    const companionName = this.getSymmetricCompanion(name);
    if (this.symmetryEnabled && companionName && this.getJoint(companionName)) {
      const compJoint = this.getJoint(companionName);
      const bounds = this.getModelBounds();
      const midX = (bounds.min[0] + bounds.max[0]) / 2;
      const mirroredPos = [2 * midX - newPosition[0], newPosition[1], newPosition[2]];
      changes.set(companionName, { from: [...compJoint.p], to: mirroredPos });
    }

    if (recordHistory) {
      this.pushHistory({
        type: 'move-joint',
        changes: Array.from(changes.entries()).map(([jointName, diff]) => ({
          name: jointName,
          from: diff.from,
          to: diff.to
        }))
      });
    }

    this.applyPositionChanges(changes);
    this.refreshAudit();
    this.notify();
    return true;
  }

  applyPositionChanges(changesMap) {
    for (const [name, diff] of changesMap.entries()) {
      const p = diff.to;
      if (this.draft) {
        const j = this.draft.joints.find(item => item.name === name);
        if (j) j.p = [...p];
      } else if (this.model) {
        const bone = this.getBoneObject(name);
        if (bone && bone.parent) {
          this.model.updateMatrixWorld(true);
          const worldPos = this.model.localToWorld(new THREE.Vector3(p[0], p[1], p[2]));
          const localToParent = bone.parent.worldToLocal(worldPos);
          bone.position.copy(localToParent);
          bone.updateMatrixWorld(true);
        }
      }
    }
  }

  getSymmetricCompanion(name) {
    if (name.startsWith('Left')) return 'Right' + name.slice(4);
    if (name.startsWith('Right')) return 'Left' + name.slice(5);
    if (name.endsWith('Left')) return name.slice(0, -4) + 'Right';
    if (name.endsWith('Right')) return name.slice(0, -5) + 'Left';
    return null;
  }

  mirrorSelectedJoint() {
    if (!this.selectedJointName) return;
    const companion = this.getSymmetricCompanion(this.selectedJointName);
    if (!companion) return;
    const current = this.getJoint(this.selectedJointName);
    if (!current) return;

    const bounds = this.getModelBounds();
    const midX = (bounds.min[0] + bounds.max[0]) / 2;
    const mirroredPos = [2 * midX - current.p[0], current.p[1], current.p[2]];

    this.setJointPosition(companion, mirroredPos);
  }

  pushHistory(command) {
    this.historyStack.push(command);
    this.redoStack = [];
  }

  undo() {
    if (!this.historyStack.length) return false;
    const cmd = this.historyStack.pop();
    if (cmd.type === 'move-joint') {
      const reverseChanges = new Map();
      for (const item of cmd.changes) {
        reverseChanges.set(item.name, { to: item.from });
      }
      this.applyPositionChanges(reverseChanges);
      this.redoStack.push(cmd);
      this.refreshAudit();
      this.notify();
      return true;
    }
    return false;
  }

  redo() {
    if (!this.redoStack.length) return false;
    const cmd = this.redoStack.pop();
    if (cmd.type === 'move-joint') {
      const applyChanges = new Map();
      for (const item of cmd.changes) {
        applyChanges.set(item.name, { to: item.to });
      }
      this.applyPositionChanges(applyChanges);
      this.historyStack.push(cmd);
      this.refreshAudit();
      this.notify();
      return true;
    }
    return false;
  }

  getModelBounds() {
    if (!this.model) return { min: [0, 0, 0], max: [1, 1, 1], size: [1, 1, 1], center: [0.5, 0.5, 0.5] };
    try {
      return modelBounds(this.model);
    } catch {
      return { min: [-1, 0, -1], max: [1, 2, 1], size: [2, 2, 2], center: [0, 1, 0] };
    }
  }

  captureRestPose() {
    if (!this.model) return;
    this.restBaseQuaternions.clear();
    this.model.traverse(o => {
      if (o.isBone) {
        this.restBaseQuaternions.set(o.name, o.quaternion.clone());
      }
    });
  }

  restoreRestPose() {
    if (!this.model) return;
    for (const [name, quat] of this.restBaseQuaternions.entries()) {
      const bone = this.getBoneObject(name);
      if (bone) {
        bone.quaternion.copy(quat);
        bone.updateMatrixWorld(true);
      }
    }
    this.poseOverrides.clear();
    this.notify();
  }

  setDeformRotation(boneName, axis = 'x', angleDegrees = 0) {
    if (!this.model) return;
    const bone = this.getBoneObject(boneName);
    if (!bone) return;

    if (!this.restBaseQuaternions.has(boneName)) {
      this.restBaseQuaternions.set(boneName, bone.quaternion.clone());
    }

    const baseQuat = this.restBaseQuaternions.get(boneName);
    const rad = THREE.MathUtils.degToRad(angleDegrees);
    const axisVec = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
    const rotQuat = new THREE.Quaternion().setFromAxisAngle(axisVec, rad);

    bone.quaternion.copy(baseQuat).multiply(rotQuat);
    bone.updateMatrixWorld(true);

    this.poseOverrides.set(boneName, { axis, angle: angleDegrees });
    this.notify();
  }

  getInfluenceMetrics(boneName) {
    if (!this.model || !this.isSkinned()) {
      return { vertexCount: 0, avgWeight: 0, maxWeight: 0, active: false };
    }
    const bone = this.getBoneObject(boneName);
    if (!bone) return { vertexCount: 0, avgWeight: 0, maxWeight: 0, active: false };

    let totalVertices = 0;
    let sumWeight = 0;
    let maxWeight = 0;

    this.model.traverse(o => {
      if (o.isSkinnedMesh && o.skeleton) {
        const boneIndex = o.skeleton.bones.indexOf(bone);
        if (boneIndex >= 0) {
          const skinIdxAttr = o.geometry.getAttribute('skinIndex');
          const skinWeightAttr = o.geometry.getAttribute('skinWeight');
          if (skinIdxAttr && skinWeightAttr) {
            for (let i = 0; i < skinIdxAttr.count; i++) {
              for (let k = 0; k < 4; k++) {
                if (skinIdxAttr.getComponent(i, k) === boneIndex) {
                  const w = skinWeightAttr.getComponent(i, k);
                  if (w > 0.001) {
                    totalVertices++;
                    sumWeight += w;
                    if (w > maxWeight) maxWeight = w;
                  }
                }
              }
            }
          }
        }
      }
    });

    return {
      vertexCount: totalVertices,
      avgWeight: totalVertices > 0 ? sumWeight / totalVertices : 0,
      maxWeight,
      active: true
    };
  }

  getVertexHeatmapColors(boneName) {
    if (!this.model || !boneName) return null;
    const bone = this.getBoneObject(boneName);
    const boneJoint = this.getJoint(boneName);
    if (!bone && !boneJoint) return null;

    // Se skinned, utiliza os pesos do skeleton
    let skinnedMesh = null;
    this.model.traverse(o => {
      if (!skinnedMesh && o.isSkinnedMesh) skinnedMesh = o;
    });

    if (skinnedMesh && bone) {
      const geom = skinnedMesh.geometry;
      const count = geom.attributes.position.count;
      const colors = new Float32Array(count * 3);
      const boneIndex = skinnedMesh.skeleton.bones.indexOf(bone);
      const ids = geom.getAttribute('skinIndex');
      const ws = geom.getAttribute('skinWeight');

      for (let i = 0; i < count; i++) {
        let weight = 0;
        if (boneIndex >= 0 && ids && ws) {
          for (let k = 0; k < 4; k++) {
            if (ids.getComponent(i, k) === boneIndex) {
              weight = ws.getComponent(i, k);
              break;
            }
          }
        }
        const color = this.weightToColor(weight);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      return colors;
    }

    // Se em rascunho (draft), gera aproximação por proximidade ao segmento
    let geomMesh = null;
    this.model.traverse(o => {
      if (!geomMesh && o.isMesh && o.geometry?.attributes?.position) geomMesh = o;
    });
    if (geomMesh && boneJoint) {
      const geom = geomMesh.geometry;
      const count = geom.attributes.position.count;
      const colors = new Float32Array(count * 3);
      const posAttr = geom.attributes.position;
      const jointPos = new THREE.Vector3(...boneJoint.p);
      const v = new THREE.Vector3();
      const bounds = this.getModelBounds();
      const maxDim = Math.max(...bounds.size);

      for (let i = 0; i < count; i++) {
        v.fromBufferAttribute(posAttr, i);
        const dist = v.distanceTo(jointPos);
        const normDist = Math.max(0, 1 - dist / (maxDim * 0.35));
        const color = this.weightToColor(normDist * normDist);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      return colors;
    }
    return null;
  }

  weightToColor(weight) {
    const w = THREE.MathUtils.clamp(weight, 0, 1);
    if (w <= 0.001) return new THREE.Color(0x0e1c33); // Fundo azul escuro sem peso
    if (w < 0.25) return new THREE.Color().lerpColors(new THREE.Color(0x0e1c33), new THREE.Color(0x00d4ff), w / 0.25);
    if (w < 0.5) return new THREE.Color().lerpColors(new THREE.Color(0x00d4ff), new THREE.Color(0x00ff88), (w - 0.25) / 0.25);
    if (w < 0.75) return new THREE.Color().lerpColors(new THREE.Color(0x00ff88), new THREE.Color(0xffee00), (w - 0.5) / 0.25);
    return new THREE.Color().lerpColors(new THREE.Color(0xffee00), new THREE.Color(0xff2200), (w - 0.75) / 0.25);
  }

  refreshAudit() {
    if (!this.model) {
      this.cachedAudit = null;
      return;
    }
    try {
      this.cachedAudit = auditRig(this.model);
    } catch (e) {
      this.cachedAudit = {
        schema: 'arenamon-rig-audit',
        bounds: this.getModelBounds(),
        bones: this.getJoints().length,
        skinnedMeshes: this.isSkinned() ? 1 : 0,
        meshes: [],
        warnings: ['Auditoria em rascunho: ' + e.message]
      };
    }
  }

  bindSkin({ smoothness = 0.13 } = {}) {
    if (!this.model || !this.draft) {
      throw new Error('Não há rascunho de rig ativo para vincular.');
    }
    const result = bindDraftToModel(this.model, this.draft, { smoothness });
    this.draft = null;
    this.historyStack = [];
    this.redoStack = [];
    this.captureRestPose();
    this.refreshAudit();
    this.notify();
    return result;
  }

  exportJSON() {
    if (!this.model) throw new Error('Nenhum modelo carregado.');
    const coords = exportCoordinates(this.model, this.draft);
    coords.modelName = this.model.name || 'ArenamonCharacter';
    coords.templateType = this.activeTemplateType;
    return coords;
  }
}
