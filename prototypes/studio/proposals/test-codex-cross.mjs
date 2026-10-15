// Teste Cruzado de Integração e Compatibilidade entre as Propostas de Rigging (UI)
// e o Núcleo Estabilizado do Codex em codex/rig-editor-stabilization (commit 7323b48).
import * as THREE from 'three';
import assert from 'node:assert/strict';
import * as CodexCore from './test-codex-core-7323b48.js';
import {
  RiggingBridge,
  HUMANOID_TEMPLATE_20,
  CREATURE_QUADRUPED_24,
  CREATURE_QUADRUPED_27,
  makeCreatureTemplate
} from './src/shared/rig-bridge.js';

console.log('Iniciando Teste Cruzado Direto com o Núcleo Codex (commit 7323b48)...\n');

// -------------------------------------------------------------
// CENÁRIO 1: Validação Direta pelo Núcleo do Codex de Rigs Emitidos pelo RiggingBridge
// -------------------------------------------------------------
console.log('--- Cenário 1: Validação direta pelo Codex 7323b48 de exports do RiggingBridge ---');
const scene = new THREE.Scene();
const bridge = new RiggingBridge({ scene });
const model = new THREE.Group();
const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 0.8), new THREE.MeshBasicMaterial());
mesh.name = 'HeroCharacter';
model.add(mesh);
scene.add(model);
bridge.setModel(model);

const bounds = bridge.getModelBounds();

// 1.1 Exportação de Rascunho Humanoid-20 sem argumentos (deve ser Schema v2)
const draftV2Export = bridge.exportJSON();
assert.equal(draftV2Export.version, 2, 'Export sem argumentos deve produzir Schema version 2');
assert.equal(draftV2Export.joints.length, 20, 'Humanoid possui 20 articulações');
assert.doesNotThrow(() => {
  CodexCore.validateDraft(draftV2Export, bounds);
}, 'Codex 7323b48 validateDraft aprovou 100% o payload exportado pelo RiggingBridge');
console.log('✓ 1.1 Codex 7323b48 validou esqueleto Humanoid-20 emitido pela UI');

// 1.2 Exportação de Rascunho Quadrúpede 27 (Estilizado)
bridge.initTemplate(CREATURE_QUADRUPED_27);
const quad27Export = bridge.exportJSON();
assert.equal(quad27Export.version, 2, 'Quadrúpede 27 exporta Schema version 2');
assert.equal(quad27Export.joints.length, 27, 'Quadrúpede estilizado possui 27 articulações');
assert.doesNotThrow(() => {
  CodexCore.validateDraft(quad27Export, bounds);
}, 'Codex 7323b48 validateDraft aprovou esqueleto quadrúpede 27');
console.log('✓ 1.2 Codex 7323b48 validou esqueleto Quadrúpede-27 emitido pela UI');

// 1.3 Exportação de Rascunho Quadrúpede 24 (Base Pura de Locomoção)
bridge.initTemplate(CREATURE_QUADRUPED_24);
const quad24Export = bridge.exportJSON();
assert.equal(quad24Export.version, 2, 'Quadrúpede 24 exporta Schema version 2');
assert.equal(quad24Export.joints.length, 24, 'Quadrúpede base possui 24 articulações');
assert.doesNotThrow(() => {
  CodexCore.validateDraft(quad24Export, bounds);
}, 'Codex 7323b48 validateDraft aprovou esqueleto quadrúpede 24');
console.log('✓ 1.3 Codex 7323b48 validou esqueleto Quadrúpede-24 emitido pela UI');

// 1.4 Exportação a partir de Modelo com SkinnedMesh Ativo (após bindSkin)
bridge.initTemplate(HUMANOID_TEMPLATE_20);
bridge.bindSkin();
assert.equal(bridge.isSkinned(), true, 'Modelo vinculado a skin (isSkinned === true)');
assert.equal(bridge.draft, null, 'Draft limpo após bindSkin');

const skinnedV2Export = bridge.exportJSON();
assert.equal(skinnedV2Export.version, 2, 'Export de SkinnedMesh sem argumentos deve produzir Schema v2');
assert.equal(skinnedV2Export.joints.length, 20, 'SkinnedMesh exportou 20 articulações');
assert.doesNotThrow(() => {
  CodexCore.validateDraft(skinnedV2Export, bounds);
}, 'Codex 7323b48 validateDraft aprovou exportJSON de modelo com pele ativa');
console.log('✓ 1.4 Codex 7323b48 validou esqueleto de SkinnedMesh emitido pela UI após bindSkin');

// -------------------------------------------------------------
// CENÁRIO 2: Importação e Consumo pela UI de Rigs Manipulados pelo Codex 7323b48
// -------------------------------------------------------------
console.log('\n--- Cenário 2: Importação pelo RiggingBridge de rigs gerados/mutados pelo Codex 7323b48 ---');
const codexTemplate = CodexCore.makeTemplate(bounds);
CodexCore.ensureJointIds(codexTemplate);

// Mutação usando os métodos topológicos do Codex 7323b48
const extraJoint = CodexCore.addDraftJoint(codexTemplate, {
  name: 'SpineChestExtra',
  parent: 'Spine',
  p: [0, 1.25, 0.05],
  q: [0, 0, 0, 1]
});
assert.ok(extraJoint.id, 'Codex gerou id único para o osso extra');

CodexCore.renameDraftJoint(codexTemplate, extraJoint.id, 'ChestMid');
CodexCore.validateDraft(codexTemplate, bounds);

// Importa este rig manipulado pelo Codex de volta para o RiggingBridge
const bridgeImportTarget = new RiggingBridge({ scene });
const targetModel = new THREE.Group();
targetModel.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()));
bridgeImportTarget.setModel(targetModel);

const importResult = bridgeImportTarget.validateAndImportJSON(codexTemplate);
assert.equal(importResult.success, true, 'RiggingBridge importou com sucesso rig manipulado pelo Codex 7323b48');
assert.equal(importResult.appliedCount, 20, 'Todas as articulações correspondentes foram aplicadas');
console.log('✓ 2.1 RiggingBridge importou e sincronizou com sucesso rascunho com mutações topológicas do Codex');

// -------------------------------------------------------------
// CENÁRIO 3: Equivalência de Metadados e Sincronização de Modelo Three.js
// -------------------------------------------------------------
console.log('\n--- Cenário 3: Equivalência de Metadados userData.arenamonRig ---');
// Cria modelo skinned com o Codex diretamente
const codexSkinnedModel = new THREE.Group();
const testMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial());
codexSkinnedModel.add(testMesh);
scene.add(codexSkinnedModel);

const codexDraftForBind = CodexCore.makeTemplate(CodexCore.modelBounds(codexSkinnedModel));
CodexCore.ensureJointIds(codexDraftForBind);
CodexCore.bindDraftToModel(codexSkinnedModel, codexDraftForBind);

// Executa syncRigMetadata do Codex 7323b48
const codexMetadata = CodexCore.syncRigMetadata(codexSkinnedModel);

// Conecta ao RiggingBridge
const bridgeForCodexModel = new RiggingBridge({ scene });
bridgeForCodexModel.setModel(codexSkinnedModel);
const bridgeMetadata = bridgeForCodexModel.syncModelRigMetadata();

assert.equal(bridgeMetadata.schema, codexMetadata.schema, 'Schemas de metadados idênticos');
assert.equal(bridgeMetadata.version, codexMetadata.version, 'Versões de metadados idênticas (2)');
assert.equal(bridgeMetadata.joints.length, codexMetadata.joints.length, 'Contagem de juntas idêntica');

for (let i = 0; i < codexMetadata.joints.length; i++) {
  assert.equal(bridgeMetadata.joints[i].name, codexMetadata.joints[i].name, `Nome da junta ${i} coincide`);
  assert.equal(bridgeMetadata.joints[i].parent, codexMetadata.joints[i].parent, `Pai da junta ${i} coincide`);
}
console.log('✓ 3.1 Metadados gerados pelo RiggingBridge coincidem exatamente com syncRigMetadata do Codex 7323b48');

// -------------------------------------------------------------
// CENÁRIO 4: Matriz de Rejeição Canônica (Codex vs RiggingBridge)
// -------------------------------------------------------------
console.log('\n--- Cenário 4: Matriz de rejeição canônica (Codex vs RiggingBridge) ---');

const invalidCases = [
  {
    name: 'ID ausente no v2',
    payload: {
      schema: 'arenamon-rig',
      version: 2,
      joints: [
        { name: 'Hips', parent: null, p: [0, 0, 0], q: [0, 0, 0, 1] },
        { id: 'j-2', name: 'Spine', parent: 'Hips', p: [0, 1, 0], q: [0, 0, 0, 1] }
      ]
    },
    expectedSubstring: 'ID obrigatório no JSON v2'
  },
  {
    name: 'ID duplicado no v2',
    payload: {
      schema: 'arenamon-rig',
      version: 2,
      joints: [
        { id: 'dup-id', name: 'Hips', parent: null, p: [0, 0, 0], q: [0, 0, 0, 1] },
        { id: 'dup-id', name: 'Spine', parent: 'Hips', p: [0, 1, 0], q: [0, 0, 0, 1] }
      ]
    },
    expectedSubstring: 'ID de osso duplicado'
  },
  {
    name: 'Quaternion inválido/incompleto no v2',
    payload: {
      schema: 'arenamon-rig',
      version: 2,
      joints: [
        { id: 'j-1', name: 'Hips', parent: null, p: [0, 0, 0], q: [0, 0, 0, 1] },
        { id: 'j-2', name: 'Spine', parent: 'Hips', p: [0, 1, 0], q: [0, 0, 0] }
      ]
    },
    expectedSubstring: 'Quaternion obrigatório e finito no JSON v2'
  },
  {
    name: 'Ciclo na hierarquia',
    payload: {
      schema: 'arenamon-rig',
      version: 2,
      joints: [
        { id: 'j-1', name: 'Hips', parent: 'Spine', p: [0, 0, 0], q: [0, 0, 0, 1] },
        { id: 'j-2', name: 'Spine', parent: 'Hips', p: [0, 1, 0], q: [0, 0, 0, 1] }
      ]
    },
    expectedSubstring: 'Ciclo no esqueleto'
  },
  {
    name: 'Múltiplas raízes',
    payload: {
      schema: 'arenamon-rig',
      version: 2,
      joints: [
        { id: 'j-1', name: 'Hips1', parent: null, p: [0, 0, 0], q: [0, 0, 0, 1] },
        { id: 'j-2', name: 'Hips2', parent: null, p: [0, 1, 0], q: [0, 0, 0, 1] }
      ]
    },
    expectedSubstring: 'O esqueleto precisa de exatamente um osso raiz'
  },
  {
    name: 'Coordenadas fora do limite',
    payload: {
      schema: 'arenamon-rig',
      version: 2,
      joints: [
        { id: 'j-1', name: 'Hips', parent: null, p: [0, 0, 0], q: [0, 0, 0, 1] },
        { id: 'j-2', name: 'Spine', parent: 'Hips', p: [5000000, 0, 0], q: [0, 0, 0, 1] }
      ]
    },
    expectedSubstring: 'Coordenada fora de limite'
  }
];

for (const testCase of invalidCases) {
  // 1. Testa Codex 7323b48
  let codexThrew = false;
  let codexMsg = '';
  try {
    CodexCore.validateDraft(testCase.payload, bounds);
  } catch (err) {
    codexThrew = true;
    codexMsg = err.message;
  }
  assert.equal(codexThrew, true, `Codex 7323b48 deve rejeitar: ${testCase.name}`);
  assert.ok(codexMsg.includes(testCase.expectedSubstring), `Mensagem do Codex deve conter "${testCase.expectedSubstring}"`);

  // 2. Testa RiggingBridge.validateAndImportJSON
  const bridgeReport = bridge.validateAndImportJSON(testCase.payload);
  assert.equal(bridgeReport.success, false, `RiggingBridge deve rejeitar: ${testCase.name}`);
  assert.ok(bridgeReport.errors.some(e => e.includes(testCase.expectedSubstring)), `Mensagem da UI deve conter "${testCase.expectedSubstring}"`);
  console.log(`✓ 4.${invalidCases.indexOf(testCase) + 1} Rejeição canônica idêntica para caso: ${testCase.name}`);
}

console.log('\n=============================================================');
console.log('✓ TESTE CRUZADO COM O NÚCLEO CODEX 7323b48 CONCLUÍDO COM 100% DE SUCESSO!');
console.log('=============================================================\n');
