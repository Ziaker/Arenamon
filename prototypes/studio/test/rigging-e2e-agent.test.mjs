// Arenamon Rigging — Teste de Integração de Ponta a Ponta: Fluxo de Agente IA
// Valida o fluxo completo: Inspeção -> Telemetria JSON -> Rig Patch JSON -> Simulação -> Aplicação -> Pós-Telemetria -> Undo/Redo.

import assert from 'node:assert/strict';
import * as T from 'three';
import {inspectRig, exportTelemetryJSON} from '../src/rigging/telemetry.js';
import {
  validatePatch,
  simulateRigPatch,
  applyRigPatch,
  RigPatchBuilder,
  RigController
} from '../src/rigging/patch.js';
import {modelBounds, makeTemplate, bindDraftToModel, collectBones} from '../src/rigging/core.js';

let pass = 0;
const test = (name, fn) => {
  fn();
  pass++;
  console.log('✓ ' + name);
};

function createAsymmetricCreature() {
  const root = new T.Group();
  root.name = 'AgentCreatureTest';
  const geo = new T.BoxGeometry(2, 3, 1, 4, 6, 2);
  const mesh = new T.Mesh(geo, new T.MeshStandardMaterial());
  mesh.name = 'CreatureBody';
  mesh.position.y = 1.5;
  root.add(mesh);

  const draft = makeTemplate(modelBounds(root));
  // Introduzir uma assimetria forçada de 0.4m no ombro esquerdo
  const leftShoulder = draft.joints.find((j) => j.name === 'LeftShoulder');
  leftShoulder.p[0] -= 0.4;
  leftShoulder.p[1] += 0.2;

  bindDraftToModel(root, draft);
  return root;
}

test('fluxo completo de ponta a ponta: telemetria -> diagnóstico -> patch JSON -> simulação -> correção -> pós-auditoria', () => {
  // 1. O Studio recebe o personagem
  const root = createAsymmetricCreature();

  // 2. O motor gera a telemetria completa
  const initialTelemetry = inspectRig(root);
  assert.equal(initialTelemetry.schema, 'arenamon-rig-telemetry');
  assert.equal(initialTelemetry.version, 1);
  assert.equal(initialTelemetry.skinning.isSkinned, true);

  // 3. Usuário / sistema exporta o relatório JSON
  const telemetryJsonString = exportTelemetryJSON(root);
  const aiInput = JSON.parse(telemetryJsonString);

  // 4. A IA analisa o relatório e identifica defeitos:
  // - Assimetria suspeita no par LeftShoulder / RightShoulder
  const shoulderPair = aiInput.consistency.symmetry.pairs.find((p) => p.leftName === 'LeftShoulder');
  assert.ok(shoulderPair);
  assert.ok(shoulderPair.asymmetryDelta > 0.35, 'IA detecta assimetria');
  assert.equal(shoulderPair.isSymmetric, false);

  // 5. A IA gera um Rig Patch JSON declarativo para corrigir a simetria e adicionar cauda
  const aiPatch = {
    schema: 'arenamon-rig-patch',
    version: 1,
    operations: [
      {
        op: 'mirrorBone',
        jointId: 'LeftShoulder'
      },
      {
        op: 'createBone',
        id: 'joint-tail-root',
        name: 'TailRoot',
        parent: 'Hips',
        position: [0, 0.6, -0.4],
        quaternion: [0, 0, 0, 1]
      },
      {
        op: 'createBone',
        id: 'joint-tail-mid',
        name: 'TailMid',
        parent: 'TailRoot',
        position: [0, 0.4, -0.8],
        quaternion: [0, 0, 0, 1]
      }
    ]
  };

  // 6. O motor valida e simula (dry-run pre-flight)
  validatePatch(aiPatch);
  const simulation = simulateRigPatch(root, aiPatch);
  assert.equal(simulation.valid, true);
  assert.equal(simulation.errors.length, 0);
  assert.equal(simulation.diff.bonesAdded.length, 2);
  assert.ok(simulation.diff.bonesMoved.some((b) => b.name === 'LeftShoulder' && b.mirrored));

  // 7. Aplicação da correção via transação segura
  const undoStack = [];
  const applyResult = applyRigPatch(root, aiPatch, {undoStack});
  assert.equal(applyResult.success, true);
  assert.equal(undoStack.length, 1);

  // 8. Pós-telemetria comprova que a assimetria foi sanada e os ossos da cauda foram integrados
  const postTelemetry = inspectRig(root);
  assert.equal(postTelemetry.identification.totalBones, 22);

  const postShoulderPair = postTelemetry.consistency.symmetry.pairs.find((p) => p.leftName === 'LeftShoulder');
  assert.ok(postShoulderPair);
  assert.ok(postShoulderPair.asymmetryDelta < 1e-4, 'Assimetria sanada pelo mirror');
  assert.equal(postShoulderPair.isSymmetric, true);

  const tailRoot = postTelemetry.identification.hierarchy.find((b) => b.name === 'TailRoot');
  const tailMid = postTelemetry.identification.hierarchy.find((b) => b.name === 'TailMid');
  assert.ok(tailRoot);
  assert.equal(tailRoot.parent, 'Hips');
  assert.ok(tailMid);
  assert.equal(tailMid.parent, 'TailRoot');

  // Metadados do rig preservados e sincronizados com schema v2
  assert.equal(root.userData.arenamonRig.schema, 'arenamon-rig');
  assert.equal(root.userData.arenamonRig.version, 2);
  assert.equal(root.userData.arenamonRig.joints.length, 22);

  // 9. Desfazer transação (Undo) restaura o estado exato inicial
  undoStack[0].undo();
  const revertedTelemetry = inspectRig(root);
  assert.equal(revertedTelemetry.identification.totalBones, 20);
  const revertedShoulderPair = revertedTelemetry.consistency.symmetry.pairs.find((p) => p.leftName === 'LeftShoulder');
  assert.ok(revertedShoulderPair.asymmetryDelta > 0.35, 'Estado anterior restaurado');

  // 10. Refazer transação (Redo) reaplica todas as correções perfeitamente
  undoStack[0].redo();
  const reAppliedTelemetry = inspectRig(root);
  assert.equal(reAppliedTelemetry.identification.totalBones, 22);
  assert.ok(reAppliedTelemetry.consistency.symmetry.pairs.find((p) => p.leftName === 'LeftShoulder').asymmetryDelta < 1e-4);
});

console.log(`\nAgent E2E: ${pass} testes de fluxo aprovados.`);
