import assert from 'node:assert/strict';
import * as T from 'three';
import {
  analyzeGeometry,
  generateHumanoidDraft,
  generateQuadrupedDraft,
  fitDraftToLandmarks,
  regenerateRegion,
  computeEnhancedSkinningWeights
} from '../src/rigging/autorig.js';
import {validateDraft, modelBounds} from '../src/rigging/core.js';

let pass = 0;
const test = (name, fn) => {
  fn();
  pass++;
  console.log('✓ ' + name);
};

function humanoidMeshFixture() {
  const root = new T.Group();
  root.name = 'HumanoidFixture';
  const body = new T.Mesh(new T.BoxGeometry(1.2, 2.4, 0.6, 6, 12, 4), new T.MeshStandardMaterial());
  body.name = 'Body';
  body.position.y = 1.2;
  root.add(body);
  const head = new T.Mesh(new T.SphereGeometry(0.4, 8, 8), new T.MeshStandardMaterial());
  head.name = 'Head';
  head.position.y = 2.7;
  root.add(head);
  return root;
}

function quadrupedMeshFixture() {
  const root = new T.Group();
  root.name = 'QuadrupedFixture';
  // Criatura alongada em Z (típico de quadrúpede: profundidade 3.0, largura 1.2, altura 1.5)
  const body = new T.Mesh(new T.BoxGeometry(1.2, 1.2, 3.0, 6, 6, 12), new T.MeshStandardMaterial());
  body.name = 'Body';
  body.position.set(0, 1.0, 0);
  root.add(body);
  return root;
}

test('analyzeGeometry extrai limites, proporções e plano de simetria bilateral', () => {
  const root = humanoidMeshFixture();
  const analysis = analyzeGeometry(root);

  assert.ok(analysis.bounds.vertices > 0);
  assert.equal(analysis.symmetry.plane, 'YZ');
  assert.ok(analysis.symmetry.score >= 0.9, 'Malha centrada possui alta simetria');
  assert.equal(analysis.symmetry.isBilateral, true);
  assert.equal(analysis.submeshes.length, 2);
  assert.ok(analysis.candidateRegions.head.confidence > 0.7);
  assert.ok(analysis.candidateRegions.torso.confidence > 0.7);
});

test('analyzeGeometry identifica candidato a quadrúpede com base em eixos dominantes', () => {
  const root = quadrupedMeshFixture();
  const analysis = analyzeGeometry(root);

  assert.equal(analysis.proportions.isQuadrupedCandidate, true);
  assert.equal(analysis.candidateRegions.limbs.type, 'quadruped-limbs');
});

test('generateHumanoidDraft produz draft válido com 20 ossos e schema v2', () => {
  const root = humanoidMeshFixture();
  const analysis = analyzeGeometry(root);
  const draft = generateHumanoidDraft(analysis.bounds, analysis);

  assert.equal(validateDraft(draft), true);
  assert.equal(draft.joints.length, 20);
  assert.equal(draft.joints[0].name, 'Hips');
  assert.ok(draft.joints.every((j) => j.id && j.q?.length === 4));
});

test('generateHumanoidDraft adapta proporções para estilo chibi quando especificado', () => {
  const root = humanoidMeshFixture();
  const b = modelBounds(root);
  const stdDraft = generateHumanoidDraft(b, null, {proportions: 'standard'});
  const chibiDraft = generateHumanoidDraft(b, null, {proportions: 'chibi'});

  const stdHipsY = stdDraft.joints.find((j) => j.name === 'Hips').p[1];
  const chibiHipsY = chibiDraft.joints.find((j) => j.name === 'Hips').p[1];

  // Em proporção chibi, os membros são mais curtos e os quadris ficam mais baixos
  assert.ok(chibiHipsY < stdHipsY, 'Quadris adaptados mais baixos no chibi');
  assert.equal(validateDraft(chibiDraft), true);
});

test('generateQuadrupedDraft constrói rig de 24 ossos com membros quadrúpedes e cauda', () => {
  const root = quadrupedMeshFixture();
  const b = modelBounds(root);
  const draft = generateQuadrupedDraft(b, null, {boneCount: 24});

  assert.equal(validateDraft(draft), true);
  assert.equal(draft.joints.length, 24);

  // Verifica patas dianteiras e traseiras
  assert.ok(draft.joints.some((j) => j.name === 'LeftHindHip'));
  assert.ok(draft.joints.some((j) => j.name === 'RightHindHip'));
  assert.ok(draft.joints.some((j) => j.name === 'LeftFrontShoulder'));
  assert.ok(draft.joints.some((j) => j.name === 'RightFrontShoulder'));
  assert.ok(draft.joints.some((j) => j.name === 'Tail1'));
  assert.ok(draft.joints.some((j) => j.name === 'Tail3'));
});

test('generateQuadrupedDraft constrói rig de 27 ossos incluindo scapulae e cauda estendida', () => {
  const root = quadrupedMeshFixture();
  const b = modelBounds(root);
  const draft = generateQuadrupedDraft(b, null, {boneCount: 27});

  assert.equal(validateDraft(draft), true);
  assert.equal(draft.joints.length, 27);
  assert.ok(draft.joints.some((j) => j.name === 'LeftFrontScapula'));
  assert.ok(draft.joints.some((j) => j.name === 'RightFrontScapula'));
  assert.ok(draft.joints.some((j) => j.name === 'Tail4'));
});

test('fitDraftToLandmarks ajusta posições respeitando ossos travados (lockedJoints)', () => {
  const root = humanoidMeshFixture();
  const draft = generateHumanoidDraft(modelBounds(root));

  const origHeadP = [...draft.joints.find((j) => j.name === 'Head').p];
  const origHipsP = [...draft.joints.find((j) => j.name === 'Hips').p];

  const landmarks = {
    Head: [origHeadP[0], origHeadP[1] + 0.3, origHeadP[2]],
    Hips: [origHipsP[0], origHipsP[1] + 0.2, origHipsP[2]]
  };

  // Trava Hips
  const result = fitDraftToLandmarks(draft, landmarks, {lockedJoints: ['Hips']});
  assert.equal(result.modifiedCount, 1);
  assert.ok(result.modifiedJoints.includes('Head'));

  // Head mudou, Hips permaneceu intacto
  const postHead = draft.joints.find((j) => j.name === 'Head');
  const postHips = draft.joints.find((j) => j.name === 'Hips');
  assert.ok(Math.abs(postHead.p[1] - (origHeadP[1] + 0.3)) < 1e-4);
  assert.ok(Math.abs(postHips.p[1] - origHipsP[1]) < 1e-4);
});

test('regenerateRegion regenera apenas a cauda sem alterar membros ou torso', () => {
  const root = quadrupedMeshFixture();
  const b = modelBounds(root);
  const draft = generateQuadrupedDraft(b, null, {boneCount: 24});

  const origHeadP = [...draft.joints.find((j) => j.name === 'Head').p];
  regenerateRegion(draft, b, 'tail', {tailBones: 5});

  // Head permaneceu intacto
  const postHead = draft.joints.find((j) => j.name === 'Head');
  assert.deepEqual(postHead.p, origHeadP);
  // Agora há 5 ossos de cauda (Tail1 a Tail5)
  assert.ok(draft.joints.some((j) => j.name === 'Tail5'));
  assert.equal(validateDraft(draft), true);
});

test('computeEnhancedSkinningWeights aplica pesos por cápsula sem vértices órfãos', () => {
  const root = humanoidMeshFixture();
  const mesh = root.getObjectByName('Body');
  const b = modelBounds(root);
  const draft = generateHumanoidDraft(b);

  // Montar esqueleto sintético a partir do draft
  const bones = draft.joints.map((j) => {
    const bone = new T.Bone();
    bone.name = j.name;
    bone.position.fromArray(j.p);
    return bone;
  });
  const skel = new T.Skeleton(bones);

  const res = computeEnhancedSkinningWeights(mesh, skel, {smoothness: 0.15});
  assert.equal(res.algorithm, 'capsule-distance-falloff');

  const wAttr = mesh.geometry.getAttribute('skinWeight');
  const idxAttr = mesh.geometry.getAttribute('skinIndex');
  assert.ok(wAttr);
  assert.ok(idxAttr);

  // Todos os vértices devem ter soma de peso exatamente normalizada a 1.0
  for (let i = 0; i < wAttr.count; i++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      sum += wAttr.getComponent(i, k);
      assert.ok(idxAttr.getComponent(i, k) < bones.length);
    }
    assert.ok(Math.abs(sum - 1.0) < 1e-4, `Vértice ${i} não normalizado: ${sum}`);
  }
});

console.log(`\nAuto-Rig: ${pass} testes unitários aprovados.`);
