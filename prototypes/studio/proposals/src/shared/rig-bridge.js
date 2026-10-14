// Rigging Bridge API — Camada de abstração e integração entre as interfaces de usuário
// e o núcleo técnico de rigging (compatível com os contratos do Codex e extensível).
import * as THREE from 'three';
import { modelBounds, makeTemplate, collectBones, currentJoints, auditRig, validateDraft, applyMirror, bindDraftToModel, exportCoordinates } from '../../../src/rigging/core.js';

export const HUMANOID_TEMPLATE_20 = 'humanoid-20';
export const CREATURE_QUADRUPED_24 = 'creature-quadruped-24';
export const CREATURE_QUADRUPED_27 = 'creature-quadruped-27';

// Decomposição anatômica do template quadrúpede:
// 24 ossos base (coluna 5 + cauda 3 + 4 membros 16) vs 3 articulações de estilização facial/chifres
export const QUADRUPED_BASE_BONES_24 = [
  'Hips', 'SpineBack', 'SpineChest', 'Neck', 'Head',
  'Tail1', 'Tail2', 'Tail3',
  'LeftShoulder', 'LeftFrontKnee', 'LeftFrontAnkle', 'LeftPaw',
  'RightShoulder', 'RightFrontKnee', 'RightFrontAnkle', 'RightPaw',
  'LeftHip', 'LeftBackKnee', 'LeftBackAnkle', 'LeftBackPaw',
  'RightHip', 'RightBackKnee', 'RightBackAnkle', 'RightBackPaw'
];

export const QUADRUPED_STYLIZATION_BONES_3 = [
  'Jaw', 'LeftHorn', 'RightHorn'
];

let jointSequence = 0;
export const newJointId = () => `joint-${Date.now().toString(36)}-${(++jointSequence).toString(36)}`;

export function ensureJointIds(draft) {
  if (!draft || !Array.isArray(draft.joints)) return draft;
  const used = new Set(draft.joints.map(j => typeof j.id === 'string' && j.id.trim() ? j.id : null).filter(Boolean));
  for (const joint of draft.joints) {
    if (typeof joint.id !== 'string' || !joint.id.trim()) {
      let id = newJointId();
      while (used.has(id)) id = newJointId();
      joint.id = id;
      used.add(id);
    }
    if (!Array.isArray(joint.q) || joint.q.length !== 4 || !joint.q.every(Number.isFinite)) {
      joint.q = [0, 0, 0, 1];
    }
  }
  return draft;
}

/**
 * Validador estrito de conformidade com o Schema arenamon-rig (v1 e v2),
 * idêntico às regras canônicas do núcleo do Codex (commit 7323b48).
 */
export function validateDraftStructure(draft) {
  if (!draft || draft.schema !== 'arenamon-rig' || !Array.isArray(draft.joints)) {
    throw new Error('JSON de rig inválido: esperado schema arenamon-rig e joints.');
  }
  const version = draft.version ?? 1;
  if (version !== 1 && version !== 2) {
    throw new Error('Versão de rig não suportada: ' + version + '. Use JSON v1 ou v2.');
  }
  if (draft.joints.length < 2 || draft.joints.length > 200) {
    throw new Error('O rig precisa de 2 a 200 pontos.');
  }
  const ids = new Set();
  for (const j of draft.joints) {
    const hasId = typeof j.id === 'string' && !!j.id.trim();
    if (version === 2 && !hasId) {
      throw new Error('ID obrigatório no JSON v2: ' + (j.name || '(sem nome)'));
    }
    if (hasId && ids.has(j.id)) {
      throw new Error('ID de osso duplicado: ' + j.id);
    }
    if (hasId) ids.add(j.id);
    const hasQuaternion = Array.isArray(j.q) && j.q.length === 4 && j.q.every(n => typeof n === 'number' && Number.isFinite(n));
    if (version === 2 && !hasQuaternion) {
      throw new Error('Quaternion obrigatório e finito no JSON v2: ' + (j.name || '(sem nome)'));
    }
    if (j.q !== undefined && !hasQuaternion) {
      throw new Error('Quaternion inválido: ' + (j.name || '(sem nome)'));
    }
  }
  const map = new Map();
  for (const j of draft.joints) {
    if (typeof j.name !== 'string' || !j.name.trim() || map.has(j.name)) {
      throw new Error('Osso duplicado/inválido: ' + j.name);
    }
    if (!Array.isArray(j.p) || j.p.length !== 3 || !j.p.every(n => typeof n === 'number' && Number.isFinite(n))) {
      throw new Error('Coordenadas inválidas: ' + j.name);
    }
    if (j.p.some(x => Math.abs(x) > 1e6)) {
      throw new Error('Coordenada fora de limite: ' + j.name);
    }
    map.set(j.name, j);
  }
  for (const j of draft.joints) {
    if (j.parent != null && !map.has(j.parent)) {
      throw new Error('Pai não encontrado para ' + j.name + ': ' + j.parent);
    }
    let p = j.parent;
    const seen = new Set([j.name]);
    while (p) {
      if (seen.has(p)) throw new Error('Ciclo no esqueleto: ' + j.name);
      seen.add(p);
      p = map.get(p)?.parent;
    }
  }
  const roots = draft.joints.filter(j => j.parent == null);
  if (roots.length !== 1) {
    throw new Error('O esqueleto precisa de exatamente um osso raiz.');
  }
  return true;
}

/**
 * Gera o template de criatura quadrúpede suportando explicitamente:
 * 1. Variante Estilizada (27 articulações): 24 base + 3 estilização (Jaw, LeftHorn, RightHorn).
 * 2. Variante Base de Locomoção (24 articulações puras): sem apêndices estilizados.
 */
export function makeCreatureTemplate(bounds, { includeStylization = true } = {}) {
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
  ];

  if (includeStylization) {
    joints.push(
      { name: 'Jaw', parent: 'Head', p: [midX, py(0.74), pz(0.65)] },
      { name: 'LeftHorn', parent: 'Head', p: [px(-1, 0.22), py(0.95), pz(0.48)] },
      { name: 'RightHorn', parent: 'Head', p: [px(1, 0.22), py(0.95), pz(0.48)] }
    );
  }

  // Cauda
  joints.push(
    { name: 'Tail1', parent: 'Hips', p: [midX, py(0.48), pz(-0.45)] },
    { name: 'Tail2', parent: 'Tail1', p: [midX, py(0.42), pz(-0.68)] },
    { name: 'Tail3', parent: 'Tail2', p: [midX, py(0.38), pz(-0.90)] }
  );

  // Patas dianteiras e traseiras
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

  const actualCount = joints.length;
  const declaredCount = includeStylization ? 27 : 24;
  const templateType = includeStylization ? CREATURE_QUADRUPED_27 : CREATURE_QUADRUPED_24;

  const tpl = {
    schema: 'arenamon-rig',
    version: 2,
    space: 'model-root',
    mode: 'draft',
    templateType,
    source: includeStylization
      ? 'template criatura quadrúpede estilizada (27 articulações: 24 base + 3 estilização)'
      : 'template quadrúpede base de locomoção (24 articulações)',
    divergenceInfo: {
      declaredCount,
      actualCount,
      status: 'resolved',
      baseBones: QUADRUPED_BASE_BONES_24,
      stylizationBones: QUADRUPED_STYLIZATION_BONES_3,
      stylizationIncluded: includeStylization,
      note: includeStylization
        ? 'Template de criatura estilizada com 27 articulações (24 base + mandíbula e chifres). Contagem declarada e instanciada em conformidade (27).'
        : 'Template quadrúpede base com 24 articulações de locomoção (sem apêndices). Contagem declarada e instanciada em conformidade (24).'
    },
    joints,
    bounds: {
      min: bounds.min.map(n => Math.round(n * 1000) / 1000),
      max: bounds.max.map(n => Math.round(n * 1000) / 1000),
      size: bounds.size.map(n => Math.round(n * 1000) / 1000)
    }
  };

  return ensureJointIds(tpl);
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
        this.ensureSkinnedBonesIds();
        this.syncModelRigMetadata();
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

  ensureSkinnedBonesIds() {
    if (!this.model) return;
    const used = new Set();
    const bones = this.getBones();
    for (const b of bones) {
      if (typeof b.userData.arenamonJointId === 'string' && b.userData.arenamonJointId.trim()) {
        used.add(b.userData.arenamonJointId);
      }
    }
    for (const b of bones) {
      if (typeof b.userData.arenamonJointId !== 'string' || !b.userData.arenamonJointId.trim()) {
        let id = newJointId();
        while (used.has(id)) id = newJointId();
        b.userData.arenamonJointId = id;
        used.add(id);
      }
    }
  }

  syncModelRigMetadata() {
    if (!this.model || !this.isSkinned()) return null;
    const joints = this.getJoints().map(j => {
      const bone = this.getBoneObject(j.name);
      return {
        id: bone?.userData?.arenamonJointId || j.id || j.uuid || newJointId(),
        name: j.name,
        parent: j.parent,
        p: [...j.p],
        q: bone ? [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w] : (j.q || [0, 0, 0, 1])
      };
    });
    const base = this.model.userData?.arenamonRig || {};
    const metadata = {
      ...structuredClone(base),
      schema: 'arenamon-rig',
      version: 2,
      joints
    };
    this.model.userData.arenamonRig = metadata;
    return metadata;
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
      const joints = currentJoints(this.model);
      return joints.map(j => {
        const bone = this.getBoneObject(j.name);
        const id = bone?.userData?.arenamonJointId || j.id || j.uuid;
        const q = bone ? [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w] : (j.q || [0, 0, 0, 1]);
        return {
          ...j,
          id,
          q
        };
      });
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
    if (templateType === CREATURE_QUADRUPED_27) {
      this.draft = makeCreatureTemplate(bounds, { includeStylization: true });
    } else if (templateType === CREATURE_QUADRUPED_24) {
      this.draft = makeCreatureTemplate(bounds, { includeStylization: false });
    } else {
      this.draft = makeTemplate(bounds);
      this.draft.templateType = HUMANOID_TEMPLATE_20;
    }
    ensureJointIds(this.draft);
    this.selectedJointName = this.draft.joints[0]?.name || null;
    this.refreshAudit();
    this.notify();
  }

  setQuadrupedStylization(include) {
    if (!this.draft || (this.activeTemplateType !== CREATURE_QUADRUPED_24 && this.activeTemplateType !== CREATURE_QUADRUPED_27)) return;
    const targetType = include ? CREATURE_QUADRUPED_27 : CREATURE_QUADRUPED_24;
    this.initTemplate(targetType);
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
    if (this.isSkinned()) {
      this.syncModelRigMetadata();
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

  beginDrag(name) {
    if (!name) return;
    const joint = this.getJoint(name);
    if (!joint) return;

    this.dragSession = {
      name,
      startPositions: new Map()
    };
    this.dragSession.startPositions.set(name, [...joint.p]);

    const companion = this.getSymmetricCompanion(name);
    if (this.symmetryEnabled && companion && this.getJoint(companion)) {
      this.dragSession.startPositions.set(companion, [...this.getJoint(companion).p]);
    }
  }

  commitDrag(name) {
    if (!this.dragSession) return false;
    const session = this.dragSession;
    this.dragSession = null;

    const joint = this.getJoint(session.name);
    if (!joint) return false;

    const initialPos = session.startPositions.get(session.name);
    if (!initialPos) return false;

    const moved = initialPos.some((coord, idx) => Math.abs(coord - joint.p[idx]) > 1e-5);
    if (!moved) return false;

    const changes = [];
    changes.push({
      name: session.name,
      from: [...initialPos],
      to: [...joint.p]
    });

    const companion = this.getSymmetricCompanion(session.name);
    if (this.symmetryEnabled && companion && session.startPositions.has(companion)) {
      const compJoint = this.getJoint(companion);
      if (compJoint) {
        changes.push({
          name: companion,
          from: [...session.startPositions.get(companion)],
          to: [...compJoint.p]
        });
      }
    }

    this.pushHistory({
      type: 'move-joint',
      source: 'gizmo-drag',
      changes
    });

    this.refreshAudit();
    this.notify();
    return true;
  }

  pushHistory(command) {
    this.historyStack.push(command);
    this.redoStack = [];
  }

  undo() {
    if (!this.historyStack.length) return false;
    const cmd = this.historyStack.pop();
    if (cmd.type === 'move-joint' || cmd.type === 'import-coordinates') {
      const reverseChanges = new Map();
      for (const item of cmd.changes) {
        reverseChanges.set(item.name, { to: [...item.from] });
        if (cmd.type === 'import-coordinates') {
          if (this.draft) {
            const joint = this.getJoint(item.name);
            if (joint) {
              if (item.fromId !== undefined) {
                if (item.fromId) joint.id = item.fromId;
                else delete joint.id;
              }
              if (item.fromQ !== undefined) {
                if (item.fromQ) joint.q = [...item.fromQ];
                else delete joint.q;
              }
            }
          } else if (this.isSkinned()) {
            const bone = this.getBoneObject(item.name);
            if (bone) {
              if (item.fromId !== undefined) {
                bone.userData.arenamonJointId = item.fromId;
              }
              if (item.fromQ) {
                bone.quaternion.set(item.fromQ[0], item.fromQ[1], item.fromQ[2], item.fromQ[3]);
                bone.updateMatrixWorld(true);
                this.restBaseQuaternions.set(bone.name, bone.quaternion.clone());
              }
            }
          }
        }
      }
      this.applyPositionChanges(reverseChanges);
      if (this.isSkinned()) {
        this.syncModelRigMetadata();
      }
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
    if (cmd.type === 'move-joint' || cmd.type === 'import-coordinates') {
      const applyChanges = new Map();
      for (const item of cmd.changes) {
        applyChanges.set(item.name, { to: [...item.to] });
        if (cmd.type === 'import-coordinates') {
          if (this.draft) {
            const joint = this.getJoint(item.name);
            if (joint) {
              if (item.toId !== undefined) {
                if (item.toId) joint.id = item.toId;
                else delete joint.id;
              }
              if (item.toQ !== undefined) {
                if (item.toQ) joint.q = [...item.toQ];
                else delete joint.q;
              }
            }
          } else if (this.isSkinned()) {
            const bone = this.getBoneObject(item.name);
            if (bone) {
              if (item.toId !== undefined) {
                bone.userData.arenamonJointId = item.toId;
              }
              if (item.toQ) {
                bone.quaternion.set(item.toQ[0], item.toQ[1], item.toQ[2], item.toQ[3]);
                bone.updateMatrixWorld(true);
                this.restBaseQuaternions.set(bone.name, bone.quaternion.clone());
              }
            }
          }
        }
      }
      this.applyPositionChanges(applyChanges);
      if (this.isSkinned()) {
        this.syncModelRigMetadata();
      }
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

  getMeshHeatmapColors(mesh, boneName) {
    if (!mesh || !mesh.geometry || !mesh.geometry.attributes.position || !boneName) return null;
    const geom = mesh.geometry;
    const count = geom.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const bone = this.getBoneObject(boneName);
    const boneJoint = this.getJoint(boneName);

    // Se skinnedMesh com skeleton válido
    if (mesh.isSkinnedMesh && mesh.skeleton && bone) {
      const boneIndex = mesh.skeleton.bones.indexOf(bone);
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
        const col = this.weightToColor(weight);
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }
      return colors;
    }

    // Se em rascunho (draft) ou malha estática, calcula influência por distância euclidiana precisa
    if (boneJoint && this.model) {
      const posAttr = geom.attributes.position;
      const jointLocal = new THREE.Vector3(...boneJoint.p);
      const jointWorld = this.model.localToWorld(jointLocal.clone());
      const v = new THREE.Vector3();
      const bounds = this.getModelBounds();
      const maxDim = Math.max(...bounds.size);

      for (let i = 0; i < count; i++) {
        v.fromBufferAttribute(posAttr, i);
        mesh.localToWorld(v); // converte vértice específico da malha para o espaço de mundo
        const dist = v.distanceTo(jointWorld);
        const normDist = Math.max(0, 1 - dist / (maxDim * 0.35));
        const weight = normDist * normDist;
        const col = this.weightToColor(weight);
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }
      return colors;
    }

    const zeroColor = this.weightToColor(0);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = zeroColor.r;
      colors[i * 3 + 1] = zeroColor.g;
      colors[i * 3 + 2] = zeroColor.b;
    }
    return colors;
  }

  getVertexHeatmapColors(boneName) {
    if (!this.model || !boneName) return null;
    let firstMesh = null;
    this.model.traverse(o => {
      if (!firstMesh && o.isMesh && o.geometry?.attributes?.position) firstMesh = o;
    });
    if (!firstMesh) return null;
    return this.getMeshHeatmapColors(firstMesh, boneName);
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
    const draftJoints = this.draft.joints.map(j => ({ ...j }));
    const result = bindDraftToModel(this.model, this.draft, { smoothness });

    // Transfere identificadores e orientações canônicas para os ossos criados
    for (const j of draftJoints) {
      const bone = this.getBoneObject(j.name);
      if (bone) {
        bone.userData.arenamonJointId = j.id || newJointId();
        if (Array.isArray(j.q) && j.q.length === 4 && j.q.every(Number.isFinite)) {
          bone.quaternion.set(j.q[0], j.q[1], j.q[2], j.q[3]);
          bone.updateMatrixWorld(true);
        }
      }
    }
    this.syncModelRigMetadata();
    this.draft = null;
    this.historyStack = [];
    this.redoStack = [];
    this.captureRestPose();
    this.refreshAudit();
    this.notify();
    return result;
  }

  exportJSON({ version = 1 } = {}) {
    if (!this.model) throw new Error('Nenhum modelo carregado.');
    const coords = exportCoordinates(this.model, this.draft);
    coords.modelName = this.model.name || 'ArenamonCharacter';
    coords.templateType = this.activeTemplateType;

    const requestedV2 = version === 2 || this.draft?.version === 2;
    if (requestedV2) {
      coords.version = 2;
      const assignedIds = new Set();
      coords.joints = coords.joints.map(j => {
        const existing = this.getJoint(j.name);
        const bone = this.getBoneObject(j.name);
        let id = bone?.userData?.arenamonJointId || existing?.id;
        if (typeof id !== 'string' || !id.trim() || assignedIds.has(id)) {
          let fresh = newJointId();
          while (assignedIds.has(fresh)) fresh = newJointId();
          id = fresh;
        }
        assignedIds.add(id);

        let q = [0, 0, 0, 1];
        if (bone && bone.quaternion) {
          q = [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w];
        } else if (Array.isArray(existing?.q) && existing.q.length === 4 && existing.q.every(Number.isFinite)) {
          q = [...existing.q];
        }

        return {
          ...j,
          id,
          q
        };
      });

      // Validação estrita canônica: garante que nenhum esqueleto inválido seja emitido
      validateDraftStructure(coords);
    }
    return coords;
  }

  validateAndImportJSON(jsonData) {
    let data = jsonData;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (err) {
        return {
          success: false,
          errors: ['Arquivo JSON inválido ou corrompido: ' + err.message],
          warnings: [],
          appliedCount: 0,
          totalInFile: 0,
          totalInRig: this.getJoints().length,
          matched: [],
          missing: [],
          unknown: [],
          invalid: []
        };
      }
    }

    if (!data || typeof data !== 'object') {
      return {
        success: false,
        errors: ['O conteúdo informado não é um objeto JSON válido.'],
        warnings: [],
        appliedCount: 0,
        totalInFile: 0,
        totalInRig: this.getJoints().length,
        matched: [],
        missing: [],
        unknown: [],
        invalid: []
      };
    }

    // Validação estrutural canônica estrita idêntica ao Codex (commit 7323b48)
    try {
      validateDraftStructure(data);
    } catch (structuralError) {
      return {
        success: false,
        errors: [structuralError.message],
        warnings: [],
        appliedCount: 0,
        totalInFile: Array.isArray(data?.joints) ? data.joints.length : 0,
        totalInRig: this.getJoints().length,
        matched: [],
        missing: [],
        unknown: [],
        invalid: [{ reason: structuralError.message }]
      };
    }

    const warnings = [];
    if (data.version === 2) {
      warnings.push('Compatibilidade de schema v2: Arquivo gerado sob schema "arenamon-rig" versão 2. Identificadores persistentes e orientações de rotação (q) validados e sincronizados.');
    }

    const currentJoints = this.getJoints();
    const currentByName = new Map(currentJoints.map(j => [j.name, j]));
    const currentById = new Map();
    for (const j of currentJoints) {
      if (j.id) currentById.set(j.id, j);
      if (j.uuid) currentById.set(j.uuid, j);
    }

    const matched = [];
    const unknown = [];
    const invalid = [];
    const fileMatchedTargets = new Set();

    for (const item of data.joints) {
      const jointId = item.id || null;
      const jointName = item.name || null;

      // Correspondência: primeiro por ID (schema v2), fallback por Nome (schema v1)
      let targetJoint = null;
      if (jointId && currentById.has(jointId)) {
        targetJoint = currentById.get(jointId);
      } else if (jointName && currentByName.has(jointName)) {
        targetJoint = currentByName.get(jointName);
      }

      if (targetJoint) {
        if (fileMatchedTargets.has(targetJoint.name)) {
          invalid.push({ name: jointName || jointId, reason: `Conflito de identificação: múltiplas entradas apontam para a mesma articulação "${targetJoint.name}"` });
          continue;
        }
        fileMatchedTargets.add(targetJoint.name);

        matched.push({
          target: targetJoint,
          name: targetJoint.name,
          p: item.p,
          id: jointId || targetJoint.id || null,
          q: item.q ? [...item.q] : (targetJoint.q ? [...targetJoint.q] : null)
        });
      } else {
        unknown.push(jointName || jointId);
      }
    }

    const missing = currentJoints.filter(j => !fileMatchedTargets.has(j.name)).map(j => j.name);

    if (matched.length === 0) {
      return {
        success: false,
        errors: [`Nenhuma articulação do arquivo coincide com o modelo ativo (${currentJoints.length} articulações esperadas).`],
        warnings,
        appliedCount: 0,
        totalInFile: data.joints.length,
        totalInRig: currentJoints.length,
        matched: [],
        missing,
        unknown,
        invalid
      };
    }

    if (invalid.length > 0) {
      warnings.push(`${invalid.length} articulação(ões) continham conflitos e foram ignoradas.`);
    }

    if (missing.length > 0) {
      warnings.push(`${missing.length} articulação(ões) do esqueleto atual não constam no arquivo e mantiveram suas posições originais.`);
    }

    if (unknown.length > 0) {
      warnings.push(`${unknown.length} articulação(ões) do arquivo não existem no esqueleto atual e foram desconsideradas.`);
    }

    // Aplica alterações e grava histórico de Undo
    const changes = [];
    for (const m of matched) {
      const cur = m.target;
      const bone = this.getBoneObject(cur.name);
      const fromId = bone?.userData?.arenamonJointId || cur.id || null;
      const toId = m.id || fromId;
      const fromQ = bone ? [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w] : (cur.q ? [...cur.q] : null);
      const toQ = m.q ? [...m.q] : fromQ;

      changes.push({
        name: cur.name,
        from: [...cur.p],
        to: [...m.p],
        fromId,
        toId,
        fromQ,
        toQ
      });

      if (this.draft) {
        if (m.id) cur.id = m.id;
        if (m.q) cur.q = [...m.q];
      } else if (this.isSkinned() && bone) {
        if (toId) bone.userData.arenamonJointId = toId;
        if (m.q) {
          bone.quaternion.set(m.q[0], m.q[1], m.q[2], m.q[3]);
          bone.updateMatrixWorld(true);
          this.restBaseQuaternions.set(bone.name, bone.quaternion.clone());
        }
      }
    }

    this.pushHistory({
      type: 'import-coordinates',
      source: 'json-import',
      changes
    });

    const applyMap = new Map();
    for (const c of changes) {
      applyMap.set(c.name, { to: c.to });
    }
    this.applyPositionChanges(applyMap);
    if (this.isSkinned()) {
      this.syncModelRigMetadata();
    }
    this.refreshAudit();
    this.notify();

    return {
      success: true,
      errors: [],
      warnings,
      appliedCount: matched.length,
      totalInFile: data.joints.length,
      totalInRig: currentJoints.length,
      matched: matched.map(m => m.name),
      missing,
      unknown,
      invalid
    };
  }
}
