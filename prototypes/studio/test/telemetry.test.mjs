import assert from 'node:assert/strict';
import * as T from 'three';
import {inspectRig, exportTelemetryJSON} from '../src/rigging/telemetry.js';
import {modelBounds, makeTemplate, bindDraftToModel} from '../src/rigging/core.js';

let pass = 0;
const test = (name, fn) => {
  fn();
  pass++;
  console.log('✓ ' + name);
};

function singleMeshFixture() {
  const root = new T.Group();
  root.name = 'SingleMeshTest';
  const geo = new T.BoxGeometry(2, 3, 1, 4, 6, 2);
  const mesh = new T.Mesh(geo, new T.MeshStandardMaterial());
  mesh.name = 'BodyMesh';
  mesh.position.y = 1.5;
  root.add(mesh);
  return root;
}

function multiMeshFixture() {
  const root = new T.Group();
  root.name = 'MultiMeshTest';
  const body = new T.Mesh(new T.BoxGeometry(2, 3, 1, 4, 6, 2), new T.MeshStandardMaterial());
  body.name = 'Body';
  body.position.y = 1.5;
  root.add(body);
  const head = new T.Mesh(new T.SphereGeometry(0.8, 8, 8), new T.MeshStandardMaterial());
  head.name = 'Head';
  head.position.y = 3.5;
  root.add(head);
  return root;
}

function syntheticRig() {
  const root = new T.Group();
  root.name = 'SyntheticRoot';
  const armature = new T.Object3D();
  armature.name = 'Armature';
  root.add(armature);
  const hips = new T.Bone();
  hips.name = 'mixamorigHips';
  hips.position.set(0, 1, 0);
  armature.add(hips);
  const spine = new T.Bone();
  spine.name = 'mixamorigSpine';
  spine.position.set(0, 0.3, 0);
  hips.add(spine);
  const head = new T.Bone();
  head.name = 'mixamorigHead';
  head.position.set(0, 0.3, 0);
  spine.add(head);
  const foot = new T.Bone();
  foot.name = 'mixamorigLeftFoot';
  foot.position.set(0.2, -0.9, 0);
  hips.add(foot);

  const geometry = new T.BoxGeometry(0.5, 1.6, 0.3, 2, 8, 2);
  geometry.translate(0, 0.8, 0);
  const n = geometry.attributes.position.count;
  const idx = new Uint16Array(n * 4);
  const w = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const y = geometry.attributes.position.getY(i);
    idx[i * 4] = y < 0.5 ? 3 : y < 1.1 ? 0 : y < 1.4 ? 1 : 2;
    w[i * 4] = 1.0;
  }
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(idx, 4));
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(w, 4));
  const mesh = new T.SkinnedMesh(geometry, new T.MeshStandardMaterial());
  mesh.name = 'Body';
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton([hips, spine, head, foot]));

  const runT = [0, 0.5, 1.0];
  const run = new T.AnimationClip('Run', 1, [
    new T.VectorKeyframeTrack('mixamorigHips.position', runT, [0, 1, 0, 0.1, 1.05, 0.5, 0, 1, 1]),
    new T.QuaternionKeyframeTrack('mixamorigSpine.quaternion', [0, 1], [0, 0, 0, 1, 0, 0.1, 0, 0.995])
  ]);
  return {root, clips: [run]};
}

test('telemetria inspeciona draft antes do bind e gera schema v1 válido', () => {
  const root = singleMeshFixture();
  const bounds = modelBounds(root);
  const draft = makeTemplate(bounds);
  const rep = inspectRig(root, {draft});

  assert.equal(rep.schema, 'arenamon-rig-telemetry');
  assert.equal(rep.version, 1);
  assert.equal(rep.identification.totalBones, 20);
  assert.equal(rep.identification.roots.length, 1);
  assert.equal(rep.identification.duplicateNames.length, 0);
  assert.equal(rep.identification.duplicateIds.length, 0);
  assert.equal(rep.identification.meshCount, 1);
  assert.equal(rep.identification.skinnedMeshCount, 0);
  assert.equal(rep.skinning.isSkinned, false);
  assert.equal(rep.transforms.bones.length, 20);
  assert.ok(rep.consistency.symmetry.isGloballySymmetric);
});

test('telemetria inspeciona personagem skinned e audita pesos e matrizes', () => {
  const root = singleMeshFixture();
  const draft = makeTemplate(modelBounds(root));
  bindDraftToModel(root, draft);

  const rep = inspectRig(root);
  assert.equal(rep.identification.totalBones, 20);
  assert.equal(rep.identification.skinnedMeshCount, 1);
  assert.equal(rep.skinning.isSkinned, true);
  assert.equal(rep.skinning.meshes.length, 1);
  assert.equal(rep.skinning.meshes[0].zeroWeightVertices, 0);
  assert.equal(rep.skinning.meshes[0].unnormalizedVertices, 0);

  // Cada osso skinned tem matrizes mundiais e bindMatrixInverse
  const spine = rep.transforms.bones.find((b) => b.name === 'Spine');
  assert.ok(spine);
  assert.ok(Array.isArray(spine.bindMatrixInverse));
  assert.equal(spine.bindMatrixInverse.length, 16);
  assert.ok(spine.segmentLength > 0);
});

test('telemetria detecta esqueleto compartilhado em multi-mesh', () => {
  const root = multiMeshFixture();
  const draft = makeTemplate(modelBounds(root));
  bindDraftToModel(root, draft);

  const rep = inspectRig(root);
  assert.equal(rep.identification.skinnedMeshCount, 2);
  assert.equal(rep.skinning.sharedSkeletons.length, 1);
  assert.equal(rep.skinning.sharedSkeletons[0].isShared, true);
  assert.equal(rep.skinning.sharedSkeletons[0].meshNames.length, 2);
  assert.ok(rep.skinning.sharedSkeletons[0].meshNames.includes('Body'));
  assert.ok(rep.skinning.sharedSkeletons[0].meshNames.includes('Head'));
});

test('telemetria detecta assimetria intencional ao deslocar um membro', () => {
  const root = singleMeshFixture();
  const draft = makeTemplate(modelBounds(root));
  const leftWrist = draft.joints.find((j) => j.name === 'LeftWrist');
  leftWrist.p[0] -= 0.5; // desloca 50cm em X

  const rep = inspectRig(root, {draft});
  const wristPair = rep.consistency.symmetry.pairs.find((p) => p.leftName === 'LeftWrist');
  assert.ok(wristPair);
  assert.ok(wristPair.asymmetryDelta >= 0.49);
  assert.equal(wristPair.isSymmetric, false);
  assert.equal(rep.consistency.symmetry.isGloballySymmetric, false);
});

test('telemetria detecta nomes duplicados e IDs duplicados', () => {
  const root = singleMeshFixture();
  const draft = makeTemplate(modelBounds(root));
  draft.joints[1].name = draft.joints[0].name; // nome duplicado
  draft.joints[2].id = draft.joints[0].id; // ID duplicado

  const rep = inspectRig(root, {draft});
  assert.equal(rep.identification.duplicateNames.length, 1);
  assert.equal(rep.identification.duplicateIds.length, 1);
  assert.equal(rep.metrics.mathematicalPass, false);
});

test('telemetria detecta tracks de animação órfãos', () => {
  const {root, clips} = syntheticRig();
  // Adiciona um track apontando para nó inexistente "MissingBone"
  const orphanTrack = new T.VectorKeyframeTrack('MissingBone.position', [0, 1], [0, 0, 0, 1, 1, 1]);
  clips[0].tracks.push(orphanTrack);

  const rep = inspectRig(root, {clips});
  assert.ok(rep.consistency.orphanAnimationTracks.length >= 1);
  const found = rep.consistency.orphanAnimationTracks.find((t) => t.targetNode === 'MissingBone');
  assert.ok(found);
  assert.equal(found.clipName, clips[0].name);
});

test('telemetria detecta ossos fora da geometria', () => {
  const root = singleMeshFixture();
  const draft = makeTemplate(modelBounds(root));
  const head = draft.joints.find((j) => j.name === 'Head');
  head.p[1] += 50.0; // 50 unidades acima da malha

  const rep = inspectRig(root, {draft});
  assert.ok(rep.consistency.outsideBounds.length >= 1);
  const found = rep.consistency.outsideBounds.find((b) => b.name === 'Head');
  assert.ok(found);
  assert.ok(found.distanceExceeded > 40);
});

test('exportTelemetryJSON produz JSON serializável e estrito', () => {
  const {root, clips} = syntheticRig();
  const jsonStr = exportTelemetryJSON(root, {clips});
  assert.ok(typeof jsonStr === 'string');
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.schema, 'arenamon-rig-telemetry');
  assert.equal(parsed.version, 1);
  assert.ok(parsed.identification.totalBones >= 4);
});

console.log(`\nTelemetry: ${pass} testes unitários aprovados.`);
