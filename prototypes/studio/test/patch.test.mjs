import assert from 'node:assert/strict';
import * as T from 'three';
import {
  validatePatch,
  simulateRigPatch,
  applyRigPatch,
  RigPatchBuilder,
  RigController
} from '../src/rigging/patch.js';
import {modelBounds, makeTemplate, bindDraftToModel, collectBones} from '../src/rigging/core.js';
import {inspectRig} from '../src/rigging/telemetry.js';

let pass = 0;
const test = (name, fn) => {
  fn();
  pass++;
  console.log('✓ ' + name);
};

function skinnedFixture() {
  const root = new T.Group();
  root.name = 'SkinnedPatchTest';
  const geo = new T.BoxGeometry(2, 3, 1, 4, 6, 2);
  const mesh = new T.Mesh(geo, new T.MeshStandardMaterial());
  mesh.name = 'CreatureMesh';
  mesh.position.y = 1.5;
  root.add(mesh);
  const d = makeTemplate(modelBounds(root));
  bindDraftToModel(root, d);
  return root;
}

test('validação de patch rejeita schemas inválidos e operações desconhecidas', () => {
  assert.throws(() => validatePatch(null), /inválido/i);
  assert.throws(() => validatePatch({schema: 'other-schema', version: 1, operations: []}), /schema inválido/i);
  assert.throws(() => validatePatch({schema: 'arenamon-rig-patch', version: 2, operations: []}), /versão/i);
  assert.throws(() => validatePatch({schema: 'arenamon-rig-patch', version: 1, operations: [{op: 'unknownOp'}]}), /não reconhecida/i);
});

test('dry run (simulação) gera relatório de diferenças sem alterar o modelo', () => {
  const root = skinnedFixture();
  const preBones = collectBones(root).map((b) => ({name: b.name, pos: b.position.toArray()}));

  const patch = new RigPatchBuilder()
    .moveBone('Spine', [0, 0.2, 0])
    .renameJoint('Head', 'Cranium')
    .createBone({name: 'Tail1', parent: 'Hips', position: [0, 0.5, -0.5]})
    .build();

  const sim = simulateRigPatch(root, patch);
  assert.equal(sim.valid, true);
  assert.equal(sim.errors.length, 0);
  assert.ok(sim.diff.bonesMoved.some((b) => b.name === 'Spine'));
  assert.ok(sim.diff.bonesRenamed.some((b) => b.from === 'Head' && b.to === 'Cranium'));
  assert.ok(sim.diff.bonesAdded.some((b) => b.name === 'Tail1'));

  // Confirma que o modelo real NÃO foi alterado
  const postBones = collectBones(root);
  assert.equal(postBones.length, preBones.length);
  assert.equal(postBones.find((b) => b.name === 'Head') !== undefined, true);
  assert.equal(postBones.find((b) => b.name === 'Cranium'), undefined);
});

test('aplicar patch move osso e preserva precisão de coordenadas', () => {
  const root = skinnedFixture();
  const spine = collectBones(root).find((b) => b.name === 'Spine');
  const initialY = spine.position.y;

  const patch = new RigPatchBuilder()
    .moveBone('Spine', [0, 0.25, 0], 'local')
    .build();

  const res = applyRigPatch(root, patch);
  assert.equal(res.success, true);
  assert.ok(Math.abs(spine.position.y - (initialY + 0.25)) < 1e-5);
});

test('aplicar patch renomeia osso e atualiza telemetria', () => {
  const root = skinnedFixture();
  const patch = new RigPatchBuilder()
    .renameJoint('LeftElbow', 'LeftForearm')
    .build();

  applyRigPatch(root, patch);
  const rep = inspectRig(root);
  assert.ok(rep.identification.hierarchy.some((b) => b.name === 'LeftForearm'));
  assert.ok(!rep.identification.hierarchy.some((b) => b.name === 'LeftElbow'));
});

test('aplicar patch cria novo osso na hierarquia e adiciona à paleta de skinning', () => {
  const root = skinnedFixture();
  const patch = new RigPatchBuilder()
    .createBone({id: 'joint-tail-1', name: 'Tail.001', parent: 'Hips', position: [0, 0.5, -0.3]})
    .build();

  applyRigPatch(root, patch);
  const rep = inspectRig(root);
  assert.equal(rep.identification.totalBones, 21);
  const tailNode = rep.identification.hierarchy.find((b) => b.name === 'Tail.001');
  assert.ok(tailNode);
  assert.equal(tailNode.parent, 'Hips');
});

test('aplicar patch exclui osso e reparenteia filhos', () => {
  const root = skinnedFixture();
  // Spine é pai de Neck, LeftClavicle e RightClavicle. Excluir Spine deve reparentear filhos para Hips.
  const patch = new RigPatchBuilder()
    .deleteBone('Spine', {reparentChildren: true})
    .build();

  applyRigPatch(root, patch);
  const rep = inspectRig(root);
  assert.equal(rep.identification.totalBones, 19);
  const neckNode = rep.identification.hierarchy.find((b) => b.name === 'Neck');
  assert.equal(neckNode.parent, 'Hips');
});

test('aplicar patch espelha osso e restaura simetria bilateral', () => {
  const root = skinnedFixture();
  // Desalinhar o cotovelo esquerdo
  const leftElbow = collectBones(root).find((b) => b.name === 'LeftElbow');
  leftElbow.position.x -= 0.35;
  root.updateMatrixWorld(true);

  let preRep = inspectRig(root);
  assert.equal(preRep.consistency.symmetry.isGloballySymmetric, false);

  // Aplicar mirror
  const patch = new RigPatchBuilder()
    .mirrorBone('LeftElbow')
    .build();

  applyRigPatch(root, patch);
  let postRep = inspectRig(root);
  const elbowPair = postRep.consistency.symmetry.pairs.find((p) => p.leftName === 'LeftElbow');
  assert.ok(elbowPair);
  assert.ok(elbowPair.asymmetryDelta < 1e-4);
});

test('rollback atômico reverte o modelo integralmente se uma operação falhar no meio', () => {
  const root = skinnedFixture();
  const preTelemetry = inspectRig(root);

  // Patch com uma operação válida seguida por uma operação com erro forçado
  const corruptedPatch = {
    schema: 'arenamon-rig-patch',
    version: 1,
    operations: [
      {op: 'moveBone', jointId: 'Spine', space: 'local', delta: [0, 0.5, 0]},
      {op: 'renameJoint', jointId: 'Head', newName: 'Cranium'},
      // Operação propositalmente inválida (não encontrada)
      {op: 'setBonePosition', jointId: 'GhostBoneDoesNotExist', position: [0, 0, 0]}
    ]
  };

  assert.throws(() => applyRigPatch(root, corruptedPatch), /rejeitado|falha/i);

  // Confirma que o rollback atômico reverteu a renomeação e o movimento
  const postTelemetry = inspectRig(root);
  assert.equal(postTelemetry.identification.totalBones, preTelemetry.identification.totalBones);
  const head = postTelemetry.identification.hierarchy.find((b) => b.name === 'Head');
  assert.ok(head, 'Head não deve ter sido renomeado');
  const spine = collectBones(root).find((b) => b.name === 'Spine');
  const origSpineP = preTelemetry.transforms.bones.find((b) => b.name === 'Spine').local.position;
  assert.ok(Math.abs(spine.position.y - origSpineP[1]) < 1e-4, 'Posição do Spine revertida');
});

test('RigController gerencia Undo e Redo de ponta a ponta', () => {
  const root = skinnedFixture();
  const controller = new RigController(root);

  const origSpineY = collectBones(root).find((b) => b.name === 'Spine').position.y;
  controller.moveBone('Spine', [0, 0.3, 0], 'local');
  assert.ok(Math.abs(collectBones(root).find((b) => b.name === 'Spine').position.y - (origSpineY + 0.3)) < 1e-4);

  // Desfazer
  const undone = controller.undo();
  assert.equal(undone, true);
  assert.ok(Math.abs(collectBones(root).find((b) => b.name === 'Spine').position.y - origSpineY) < 1e-4);

  // Refazer
  const redone = controller.redo();
  assert.equal(redone, true);
  assert.ok(Math.abs(collectBones(root).find((b) => b.name === 'Spine').position.y - (origSpineY + 0.3)) < 1e-4);
});

console.log(`\nPatch: ${pass} testes unitários aprovados.`);
