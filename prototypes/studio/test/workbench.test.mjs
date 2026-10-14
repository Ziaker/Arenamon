// Rigging Telemetry Workbench: testes em Node do formato Rig Patch e da telemetria, com o motor REAL do Codex
// (rigging/core.js): template, bind, auditRig, currentJoints e validação de rascunho. Nada é simulado à parte.
import assert from 'node:assert/strict';
import * as T from 'three';
import * as core from '../src/rigging/core.js';
import {parsePatch, simulateOnDraft, diffDrafts, draftFromModel, patchFromRigJSON, findJoint} from '../src/workbench/patch.js';
import {buildTelemetry, warningDiff, animationCompatibility} from '../src/workbench/telemetry.js';
import {buildWorkbenchCharacter} from './workbench-fixture.mjs';
let n = 0;const test = (name, fn) => {fn();n++;console.log('✓ ' + name);};

test('telemetria do rig vinculado: 20 ossos, 6 malhas independentes, IDs persistentes e dados do motor', () => {
  const {root, clips} = buildWorkbenchCharacter(T, core), t = buildTelemetry(root, {clips, modelName: 'sintetico'});
  assert.equal(t.schema, 'arenamon-rig-telemetry');assert.equal(t.model.state, 'vinculado');
  assert.equal(t.summary.bones, 20);assert.equal(t.summary.meshes, 6);assert.equal(t.summary.skinnedMeshes, 6);
  const audit = core.auditRig(root);
  assert.equal(t.summary.vertices, audit.meshes.reduce((s, m) => s + m.vertices, 0), 'vértices = auditRig');
  assert.deepEqual(t.warnings, audit.warnings, 'avisos = auditRig');
  for (const j of t.joints) {
    assert.match(j.id, /^joint-/);assert.ok(j.uuid && j.local && j.world && j.q.length === 4);
    assert.equal(j.bindInverse.length, 16, j.name + ': matriz de bind');
    assert.equal(j.influence.vertices, audit.vertexInfluences[j.name], j.name + ': vértices = auditRig');
  }
  const live = new Map(core.currentJoints(root).map(j => [j.id, j]));
  for (const j of t.joints) assert.ok(j.p.every((v, k) => Math.abs(v - live.get(j.id).p[k]) < 1e-6), j.name + ': posição = currentJoints');
  const hips = t.joints.find(j => j.name === 'Hips');assert.equal(hips.parent, null);assert.ok(hips.children.length >= 3);
});
test('pesos reais por osso e por malha: soma por malha bate com os atributos de skin', () => {
  const {root} = buildWorkbenchCharacter(T, core), t = buildTelemetry(root);
  for (const m of t.meshes.filter(x => x.skinned)) {
    assert.equal(m.influencesPerVertex.reduce((a, b) => a + b, 0), m.vertices);
    const mesh = root.getObjectByProperty('uuid', m.uuid), ws = mesh.geometry.getAttribute('skinWeight');
    let total = 0;for (let i = 0; i < ws.count; i++) for (let k = 0; k < 4; k++) if (ws.getComponent(i, k) > 1e-5) total += ws.getComponent(i, k);
    const reported = m.influencingBones.reduce((s, b) => s + b.weightSum, 0);
    assert.ok(Math.abs(total - reported) < 1e-3, `${m.name}: ${total} × ${reported}`);
  }
});
test('assimetria medida com applyMirror do Codex e faixas órfãs detectadas', () => {
  const {root, clips} = buildWorkbenchCharacter(T, core), t = buildTelemetry(root, {clips});
  const elbow = t.joints.find(j => j.name === 'LeftElbow');assert.ok(Math.abs(elbow.symmetry.mirrorDistance - Math.hypot(.06, .12)) < 1e-6, String(elbow.symmetry.mirrorDistance));
  assert.equal(t.joints.find(j => j.name === 'LeftKnee').symmetry.mirrorDistance, 0);
  assert.deepEqual(t.animations[0].orphanTracks, ['TailMissing.quaternion']);assert.equal(t.animations[0].boundTracks, 1);assert.equal(t.summary.orphanTracks, 1);
});
test('seleção de ossos para a IA: só os pedidos, por ID ou nome', () => {
  const {root} = buildWorkbenchCharacter(T, core), all = buildTelemetry(root), id = all.joints.find(j => j.name === 'LeftElbow').id;
  const sel = buildTelemetry(root, {select: [id, 'RightElbow']});
  assert.deepEqual(sel.joints.map(j => j.name).sort(), ['LeftElbow', 'RightElbow']);assert.deepEqual(sel.selection.length, 2);
});
test('patch: validação estrutural com caminho do erro', () => {
  const bad = parsePatch({schema: 'arenamon-rig-patch', version: 1, ops: [{op: 'setPosition', joint: 'Hips', p: [0, 'x', 0]}, {op: 'girar'}, {op: 'setRotation', joint: 'Hips', q: [0, 0, 0, 2]}, {op: 'rename', joint: 'Hips', name: 'H', extra: 1}]});
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.errors.map(e => e.path), ['ops[0].p', 'ops[1].op', 'ops[2].q', 'ops[3].extra']);
  assert.match(parsePatch('{ "schema": ').errors[0].message, /JSON inválido/);
  assert.equal(parsePatch({schema: 'outro', version: 2, ops: []}).errors.length, 3);
  assert.ok(parsePatch({schema: 'arenamon-rig-patch', version: 1, space: 'model-root', ops: [{op: 'mirror', joint: 'LeftElbow', note: 'corrige'}]}).ok);
});
test('simulação com o motor do Codex: correção de assimetria, renomear, reparentar e criar; diff por ID', () => {
  const {root} = buildWorkbenchCharacter(T, core), before = draftFromModel(root), bounds = core.modelBounds(root);
  const left = findJoint(before, 'LeftElbow');
  const {patch} = parsePatch({schema: 'arenamon-rig-patch', version: 1, ops: [
    {op: 'mirror', joint: left.id}, {op: 'rename', joint: 'Head', name: 'HeadMain'}, {op: 'addJoint', name: 'HeadTop', parent: 'HeadMain', p: [0, 2.45, 0]},
    {op: 'reparent', joint: 'LeftClavicle', parent: 'Neck'}]});
  const sim = simulateOnDraft(before, patch, bounds);assert.ok(sim.ok, sim.error);
  const d = diffDrafts(before, sim.after);
  const elbow = d.find(c => c.name === 'RightElbow');assert.ok(Math.abs(elbow.moved - Math.hypot(.06, .12)) < 1e-6);
  assert.equal(d.find(c => c.name === 'HeadMain').nameBefore, 'Head');assert.equal(d.find(c => c.kind === 'added').name, 'HeadTop');
  assert.ok(d.some(c => c.name === 'LeftClavicle' && c.parentBefore === 'Spine' && c.parentAfter === 'Neck'));
  assert.ok(core.validateDraft(sim.after, bounds));
});
test('simulação rejeita o que o motor do Codex rejeita: ciclo, osso inexistente, nome duplicado, segunda raiz', () => {
  const {root} = buildWorkbenchCharacter(T, core), before = draftFromModel(root), bounds = core.modelBounds(root);
  const run = ops => simulateOnDraft(before, parsePatch({schema: 'arenamon-rig-patch', version: 1, ops}).patch, bounds);
  assert.match(run([{op: 'reparent', joint: 'Hips', parent: 'Head'}]).error, /Ciclo/);
  assert.match(run([{op: 'setPosition', joint: 'Fantasma', p: [0, 0, 0]}]).error, /não encontrado/);
  assert.match(run([{op: 'rename', joint: 'Head', name: 'Spine'}]).error, /Já existe/);
  assert.match(run([{op: 'addJoint', name: 'Solto', parent: null, p: [0, 0, 0]}]).error, /raiz/);
  const r = run([{op: 'translate', joint: 'Head', delta: [0, .1, 0]}, {op: 'reparent', joint: 'Hips', parent: 'Head'}]);
  assert.equal(r.steps.length, 2);assert.equal(r.steps[0].ok, true);assert.equal(r.steps[1].ok, false);
  assert.equal(findJoint(before, 'Head').p[1], findJoint(draftFromModel(root), 'Head').p[1], 'o modelo e o rascunho original não mudam');
});
test('pesos depois do bind (rascunho): bind real do Codex em cópias mostra avisos resolvidos/novos', () => {
  const {root, draft} = buildWorkbenchCharacter(T, core, {bind: false}), bounds = core.modelBounds(root);
  const fixed = simulateOnDraft(draft, parsePatch({schema: 'arenamon-rig-patch', version: 1, ops: [{op: 'mirror', joint: 'LeftElbow'}]}).patch, bounds);
  const bindCopy = d => {const c = root.clone(true);c.traverse(o => {if (o.isMesh) o.geometry = o.geometry.clone();});core.bindDraftToModel(c, structuredClone(d));return buildTelemetry(c);};
  const a = bindCopy(draft), b = bindCopy(fixed.after);
  assert.equal(a.model.state, 'vinculado');assert.ok(Array.isArray(warningDiff(a, b).added));
  assert.notDeepEqual(a.joints.find(j => j.name === 'RightElbow').influence, b.joints.find(j => j.name === 'RightElbow').influence, 'a correção muda a influência real');
  let skinned = false;root.traverse(o => {if (o.isSkinnedMesh) skinned = true;});assert.equal(skinned, false, 'o modelo original continua sem skin');
});
test('coordenadas corrigidas (JSON arenamon-rig do Codex) viram patch de setPosition', () => {
  const {root} = buildWorkbenchCharacter(T, core), current = draftFromModel(root), rig = core.exportCoordinates(root);
  rig.joints.find(j => j.name === 'Head').p[1] += .05;
  const patch = patchFromRigJSON(rig, current);assert.equal(patch.ops.length, 1);assert.equal(patch.ops[0].joint, findJoint(current, 'Head').id);
  assert.ok(parsePatch(patch).ok);
});
test('compatibilidade de animação: nome e UUID resolvem; inexistente é órfã', () => {
  const {root} = buildWorkbenchCharacter(T, core), bone = core.collectBones(root)[0];
  const clip = new T.AnimationClip('x', 1, [new T.QuaternionKeyframeTrack(bone.uuid + '.quaternion', [0], [0, 0, 0, 1]), new T.QuaternionKeyframeTrack('Nada.quaternion', [0], [0, 0, 0, 1])]);
  assert.deepEqual(animationCompatibility(root, [clip])[0], {name: 'x', tracks: 2, boundTracks: 1, orphanTracks: ['Nada.quaternion']});
});
console.log(`\nWorkbench: ${n} testes unitários aprovados (motor real do Codex).`);
