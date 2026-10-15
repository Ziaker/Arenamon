// Rigging Telemetry Workbench sobre a API OFICIAL de rigging (56b01a5): testes em Node do adaptador
// (engine-official.js), da migração explícita do formato anterior e da camada de visualização da telemetria.
// O motor de patch, a telemetria e o auto-rig são os oficiais; o "importador" abaixo reproduz só o mapa de repouso do
// motor do Studio (enterRigRest/commitRig), que é o ponto em que a integração falhava.
import assert from 'node:assert/strict';
import * as T from 'three';
import * as core from '../src/rigging/core.js';
import {createHistory} from '../src/editor/history.js';
import {createOfficialEngine, rigFingerprint, PROFILES} from '../src/workbench/engine-official.js';
import {parsePatch, migrateLegacyPatch, patchFromRigJSON, OP_LIMITS} from '../src/workbench/patch.js';
import {toView, selectTelemetry} from '../src/workbench/telemetry.js';
import {buildWorkbenchCharacter} from './workbench-fixture.mjs';
let n = 0;const test = (name, fn) => {fn();n++;console.log('✓ ' + name);};

/** Studio mínimo: mapa de repouso dos ossos como em engine.js (enterRigRest restaura; commitRig grava). */
function studio({bind = true} = {}) {
  const {root, clips, draft} = buildWorkbenchCharacter(T, core, {bind}), rest = new Map();
  const record = () => root.traverse(o => {if (o.isBone) rest.set(o.uuid, {p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone()});});
  record();
  const E = {model: root, clips: [], commits: 0,
    enterRigRest() {root.traverse(o => {const r = o.isBone && rest.get(o.uuid);if (r) {o.position.copy(r.p);o.quaternion.copy(r.q);o.scale.copy(r.s);}});root.updateMatrixWorld(true);},
    commitRig() {this.commits++;root.updateMatrixWorld(true);record();root.traverse(o => {if (o.isSkinnedMesh && o.skeleton) o.skeleton.calculateInverses();});}};
  E.clips.push(...clips);
  const H = createHistory(), rig = {draft: null, selectedId: null, select() {}};
  const engine = createOfficialEngine({importer: () => E, rig: () => rig, history: () => H});
  return {root, clips, draft, E, H, rig, engine, ids: () => Object.fromEntries(engine.current().map(j => [j.name, j.id]))};
}
const P = (operations, extra = {}) => ({schema: 'arenamon-rig-patch', version: 1, operations, ...extra});
const asym = (engine, left) => engine.telemetry().symmetry.pairs.find(p => p.leftName === left).asymmetryDelta;
const pos = (engine, name) => engine.telemetry().joints.find(j => j.name === name).p;

test('telemetria = inspectRig oficial: visão sem números próprios e JSON oficial intacto', () => {
  const {root, clips, engine} = studio(), t = core.inspectRig(root, {clips}), v = engine.telemetry();
  assert.equal(v.official.schema, 'arenamon-rig-telemetry');assert.equal(v.state, 'vinculado');
  assert.deepEqual(engine.official().identification, t.identification, 'mesmo objeto de identificação');
  assert.equal(v.summary.bones, t.identification.totalBones);assert.equal(v.summary.meshes, 6);assert.equal(v.summary.skinnedMeshes, 6);
  assert.equal(v.summary.orphanTracks, 1);assert.equal(v.summary.warnings, t.metrics.warningCount);assert.equal(v.summary.maxAsymmetry, t.consistency.symmetry.maxAsymmetryDelta);
  for (const j of v.joints) {
    const b = t.transforms.bones.find(x => x.id === j.id);
    assert.deepEqual(j.p, b.modelRoot.position);assert.deepEqual(j.q, b.local.quaternion);assert.deepEqual(j.bindInverse, b.bindMatrixInverse);
    const inf = t.skinning.meshes.reduce((s, m) => s + (m.influencesPerBone[j.name] || 0), 0);assert.equal(j.influence.vertices, inf, j.name);
  }
  assert.equal(v.joints.find(j => j.name === 'LeftElbow').symmetry.asymmetryDelta, t.consistency.symmetry.pairs.find(p => p.leftName === 'LeftElbow').asymmetryDelta);
  assert.ok(Math.abs(asym(engine, 'LeftElbow') - Math.hypot(.06, .12)) < 1e-4);
  assert.deepEqual(v.animations[0].orphanTracks, ['TailMissing.quaternion']);
});
test('seleção para a IA: recorte do objeto oficial (mesmo schema) por ID ou nome', () => {
  const {engine, ids} = studio(), sel = engine.telemetry({select: [ids().LeftElbow, 'RightElbow']});
  assert.equal(sel.schema, 'arenamon-rig-telemetry');assert.deepEqual(sel.identification.hierarchy.map(h => h.name).sort(), ['LeftElbow', 'RightElbow']);
  assert.equal(sel.transforms.bones.length, 2);assert.equal(sel.consistency.symmetry.pairs.length, 1);assert.equal(sel.selection.length, 2);
  assert.deepEqual(selectTelemetry(engine.official(), []).transforms.bones, []);
});
test('patch canônico: erros com caminho, validatePatch oficial e JSON inválido com linha', () => {
  const bad = parsePatch(P([{op: 'setBonePosition', jointId: 'Hips', position: [0, 'x', 0]}, {op: 'girar'}, {op: 'setBoneQuaternion', jointId: 'Hips', quaternion: [0, 0, 0, 2]}, {op: 'renameJoint', jointId: 'Head', newName: 'H', extra: 1}]));
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.errors.map(e => e.path), ['(validatePatch oficial)', 'operations[0].position', 'operations[2].quaternion', 'operations[3].extra']);
  assert.match(bad.errors[0].message, /girar/);
  assert.match(parsePatch('{ "schema": ').errors[0].message, /JSON inválido/);
  assert.match(parsePatch({schema: 'outro', version: 2, operations: []}).errors[0].message, /Schema inválido/);
  assert.match(parsePatch({schema: 'arenamon-rig-patch', version: 1, ops: [], operations: []}).errors[0].message, /ao mesmo tempo/);
  assert.ok(parsePatch(P([{op: 'mirrorBone', jointId: 'LeftElbow', note: 'corrige'}])).ok);
});
test('migração explícita ops → operations: todas as operações anteriores, com relatório', () => {
  const {engine} = studio(), joints = engine.current(), clav = joints.find(j => j.name === 'LeftClavicle');
  const m = migrateLegacyPatch({schema: 'arenamon-rig-patch', version: 1, space: 'model-root', description: 'antigo', ops: [
    {op: 'setPosition', joint: 'Head', p: [0, 2.3, 0]}, {op: 'translate', joint: 'Head', delta: [0, .1, 0]}, {op: 'setRotation', joint: 'Spine', q: [0, 0, 0, 1]},
    {op: 'rename', joint: 'Head', name: 'HeadMain', note: 'n'}, {op: 'reparent', joint: 'LeftClavicle', parent: 'Neck'}, {op: 'addJoint', name: 'Top', parent: 'Neck', p: [0, 2.5, 0]},
    {op: 'removeJoint', joint: 'RightFoot'}, {op: 'mirror', joint: 'LeftElbow'}]}, joints);
  assert.deepEqual(m.errors, []);assert.equal(m.patch.description, 'antigo');assert.equal(m.patch.ops, undefined);
  assert.deepEqual(m.patch.operations.map(o => o.op), ['setBonePosition', 'moveBone', 'setBoneQuaternion', 'renameJoint', 'reparentBone', 'setBonePosition', 'createBone', 'setBonePosition', 'deleteBone', 'mirrorBone']);
  assert.deepEqual(m.patch.operations[5], {op: 'setBonePosition', jointId: clav.id, position: clav.p, space: 'model-root'}, 'reparent preserva a posição na raiz');
  assert.equal(m.patch.operations[7].jointId, m.patch.operations[6].id, 'addJoint recebe ID e posição na raiz');
  assert.equal(m.report.length, 8);assert.deepEqual(m.report[4].to, ['operations[4] reparentBone', 'operations[5] setBonePosition']);assert.equal(m.patch.operations[3].note, 'n');
  assert.match(migrateLegacyPatch({ops: [{op: 'voar'}]}).errors[0].path, /ops\[0\]\.op/);
  const parsed = parsePatch({schema: 'arenamon-rig-patch', version: 1, ops: [{op: 'mirror', joint: 'LeftElbow'}]});
  assert.ok(parsed.ok);assert.equal(parsed.migration.from, 'ops');assert.equal(parsed.patch.operations[0].op, 'mirrorBone');
});
test('comparar (ensaio real) não modifica o modelo: ossos, pesos, matrizes e metadados idênticos', () => {
  const {root, engine, H, E, ids} = studio(), before = rigFingerprint(root), i = ids();
  const d = engine.dryRun(P([{op: 'mirrorBone', jointId: i.LeftElbow}, {op: 'renameJoint', jointId: i.Head, newName: 'HeadMain'}, {op: 'createBone', name: 'HeadTop', parent: i.Head, position: [0, .2, 0]}, {op: 'normalizeSkinWeights'}]));
  assert.ok(d.ok, JSON.stringify(d.errors));assert.equal(d.restored, true);
  assert.equal(rigFingerprint(root), before, 'modelo intacto');assert.equal(H.state().canUndo, false, 'nada no histórico');assert.equal(E.commits, 0, 'mapa de repouso intacto');
  assert.ok(d.changes.some(c => c.name === 'RightElbow' && c.moved > .13));assert.ok(d.changes.some(c => c.name === 'HeadMain' && c.nameBefore === 'Head'));
  assert.ok(d.changes.some(c => c.kind === 'added' && c.name === 'HeadTop'));
  assert.equal(d.simulation.diff.bonesRenamed[0].to, 'HeadMain');const el = v => v.symmetry.pairs.find(p => p.leftName === 'LeftElbow').asymmetryDelta;assert.ok(el(d.after) < 1e-4 && el(d.before) > .13);
  assert.equal(engine.telemetry().joints.length, 20);
});
test('aplicar = UMA transação; Undo/Redo restauram ossos, pesos, matrizes e metadados; o repouso do Studio acompanha', () => {
  const {root, engine, H, E, ids} = studio(), i = ids(), a = rigFingerprint(root), meta = structuredClone(root.userData.arenamonRig);
  const r = engine.apply(P([{op: 'mirrorBone', jointId: i.LeftElbow}, {op: 'setBoneQuaternion', jointId: i.Spine, quaternion: [0, .2588190451, 0, .9659258263]}, {op: 'createBone', name: 'HeadTop', parent: i.Head, position: [0, .2, 0]}, {op: 'normalizeSkinWeights'}], {description: 'teste'}));
  assert.ok(r.ok, JSON.stringify(r.errors));assert.equal(r.label, 'Rig Patch: teste (4 op.)');
  assert.equal(H.state().undoLabel, r.label);H.undo();assert.equal(H.state().canUndo, false, 'uma única entrada');H.redo();
  const b = rigFingerprint(root);assert.notEqual(b, a);
  E.enterRigRest();assert.equal(rigFingerprint(root), b, 'enterRigRest mantém a correção (mapa de repouso atualizado)');
  assert.ok(Math.abs(engine.telemetry().joints.find(j => j.name === 'Spine').q[1] - .25882) < 1e-4);assert.equal(root.userData.arenamonRig.joints.length, 21);
  H.undo();assert.equal(rigFingerprint(root), a, 'undo: idêntico ao original');assert.deepEqual(root.userData.arenamonRig, meta, 'metadados');
  E.enterRigRest();assert.equal(rigFingerprint(root), a, 'repouso também restaurado');
  H.redo();assert.equal(rigFingerprint(root), b, 'redo: idêntico ao aplicado');E.enterRigRest();assert.equal(rigFingerprint(root), b);
});
test('rotação de repouso (setBoneQuaternion) aplicada e desfeita com a API oficial', () => {
  const {engine, H, ids} = studio(), q = [0, .2588190451, 0, .9659258263], q0 = engine.telemetry().joints.find(j => j.name === 'Spine').q;
  assert.ok(engine.apply(P([{op: 'setBoneQuaternion', jointId: ids().Spine, quaternion: q}])).ok);
  assert.ok(engine.telemetry().joints.find(j => j.name === 'Spine').q.every((v, k) => Math.abs(v - q[k]) < 1e-4));
  H.undo();assert.deepEqual(engine.telemetry().joints.find(j => j.name === 'Spine').q, q0);
});
test('patch anterior com reparent: a migração preserva a posição na raiz (reparentBone oficial sozinho não preserva)', () => {
  const s1 = studio(), p0 = pos(s1.engine, 'LeftElbow');
  assert.ok(s1.engine.apply({schema: 'arenamon-rig-patch', version: 1, ops: [{op: 'reparent', joint: 'LeftClavicle', parent: 'Neck'}]}).ok);
  assert.ok(pos(s1.engine, 'LeftElbow').every((v, k) => Math.abs(v - p0[k]) < 1e-4), 'cadeia no mesmo lugar');
  assert.equal(s1.engine.telemetry().joints.find(j => j.name === 'LeftClavicle').parent, 'Neck');
  const s2 = studio();assert.ok(s2.engine.apply(P([{op: 'reparentBone', jointId: s2.ids().LeftClavicle, newParentJointId: s2.ids().Neck}])).ok);
  assert.ok(Math.hypot(...pos(s2.engine, 'LeftElbow').map((v, k) => v - p0[k])) > .05, 'API oficial mantém a posição local: a cadeia se desloca');
});
test('limites comprovados da API oficial ficam bloqueados com o motivo (nada é aplicado em silêncio)', () => {
  const {root, engine, H, ids} = studio(), a = rigFingerprint(root);
  for (const op of [{op: 'deleteBone', jointId: ids().Spine}, {op: 'setRestPose', jointId: ids().Head}, {op: 'recomputeSkinningWeights'}]) {
    const r = engine.apply(P([op]));assert.equal(r.ok, false, op.op);assert.equal(r.stage, 'pendente');assert.equal(r.errors[0].message, `${op.op}: ${OP_LIMITS[op.op].all || OP_LIMITS[op.op].bound}`);
  }
  assert.equal(rigFingerprint(root), a);assert.equal(H.state().canUndo, false);
  const miss = engine.validate(P([{op: 'mirrorBone', jointId: 'Fantasma'}]));assert.equal(miss.stage, 'simulateRigPatch');assert.equal(miss.errors[0].path, 'operations[0]');
});
test('evidência dos defeitos bloqueados: deleteBone desloca pesos e setRestPose não faz nada (API oficial direta)', () => {
  const {root} = buildWorkbenchCharacter(T, core), id = name => core.currentJoints(root).find(j => j.name === name).id;
  const inf = () => {const t = core.inspectRig(root), s = {};for (const m of t.skinning.meshes) for (const [k, v] of Object.entries(m.influencesPerBone)) s[k] = (s[k] || 0) + v;return s;};
  const before = inf();
  core.applyRigPatch(root, P([{op: 'deleteBone', jointId: id('Spine')}]));
  assert.equal(inf().Head, before.Neck, 'os vértices do Neck passam para o Head: skinIndex não foi remapeado');assert.notEqual(inf().Head, before.Head);
  const {root: r2} = buildWorkbenchCharacter(T, core), fp = rigFingerprint(r2);
  assert.equal(core.applyRigPatch(r2, P([{op: 'setRestPose', jointId: core.currentJoints(r2)[3].id, position: [0, 3, 0]}])).success, true);
  const rig = s => {const o = JSON.parse(s);return JSON.stringify([o.bones, o.meshes]);};
  assert.equal(rig(rigFingerprint(r2)), rig(fp), 'setRestPose: success=true e ossos, pesos e matrizes não mudam (só a re-sincronização dos metadados)');
});
for (const profile of PROFILES) test(`auto-rig ${profile.label}: proposta → patch → bind (sem vértices sem peso) → undo/redo`, () => {
  const {root, engine, H} = studio({bind: false}), clean = rigFingerprint(root);
  assert.equal(engine.state(), 'sem-rig');assert.ok(engine.autoRig.canPropose());
  const d = engine.autoRig.generate(profile.id);assert.equal(d.joints.length, profile.boneCount || 20);
  const v = engine.telemetry();assert.equal(v.state, 'proposta');assert.equal(v.summary.bones, d.joints.length);assert.equal(rigFingerprint(root), clean, 'gerar não toca no modelo');
  assert.ok(engine.autoRig.regionConfidence.length && engine.autoRig.regionConfidence.every(c => c.confidence > 0 && c.confidence <= 1));
  const head = engine.current().find(j => j.name === 'Head'), add = P([{op: 'createBone', name: 'HeadTop', parent: head.id, position: [head.p[0], head.p[1] + .1, head.p[2]]}]);
  const dry = engine.dryRun(add);assert.ok(dry.ok, JSON.stringify(dry.errors));assert.equal(engine.telemetry().summary.bones, d.joints.length, 'ensaio não altera a proposta');
  assert.ok(engine.apply(add).ok);
  assert.equal(engine.telemetry().joints.find(j => j.name === 'HeadTop').parent, 'Head', 'pai por ID convertido para o rascunho');
  engine.autoRig.bind();assert.equal(engine.state(), 'vinculado');
  const t = engine.telemetry();assert.equal(t.summary.skinnedMeshes, 6);assert.equal(t.summary.verticesWithoutInfluence, 0);assert.equal(t.summary.bones, d.joints.length + 1);
  H.undo();assert.equal(engine.state(), 'proposta');assert.equal(rigFingerprint(root), clean, 'undo do bind devolve o modelo sem skin');
  H.undo();assert.equal(engine.telemetry().summary.bones, d.joints.length);H.undo();assert.equal(engine.state(), 'sem-rig');
  H.redo();H.redo();H.redo();assert.equal(engine.state(), 'vinculado');assert.equal(engine.telemetry().summary.bones, d.joints.length + 1);
});
test('ossos travados: patch e ajuste aos marcos não movem pontos travados; regenerar cauda preserva travas', () => {
  const {engine, H} = studio({bind: false});engine.autoRig.generate('quadruped-27');
  const j = name => engine.telemetry().joints.find(x => x.name === name), head = j('Head');
  engine.autoRig.toggleLock(head.id);assert.deepEqual(engine.autoRig.locked, [head.id]);
  const r = engine.validate(P([{op: 'moveBone', jointId: head.id, delta: [0, .1, 0]}]));assert.equal(r.ok, false);assert.match(r.errors[0].message, /travado/);
  const fit = engine.autoRig.fitLandmarks();assert.ok(fit.landmarks.includes('Head'));assert.ok(!fit.modified.includes('Head'));assert.deepEqual(j('Head').p, head.p, 'Head travado');
  const tailBefore = engine.telemetry().joints.filter(x => x.name.startsWith('Tail')).map(x => x.id);
  engine.autoRig.regenerate('tail');const tailAfter = engine.telemetry().joints.filter(x => x.name.startsWith('Tail'));
  assert.equal(tailAfter.length, 3, 'regenerateRegion recria 3 ossos de cauda');assert.notDeepEqual(tailAfter.map(x => x.id), tailBefore);assert.deepEqual(j('Head').p, head.p);
  assert.throws(() => engine.autoRig.regenerate('leftArm'), /não implementada/);
  H.undo();assert.deepEqual(engine.telemetry().joints.filter(x => x.name.startsWith('Tail')).map(x => x.id), tailBefore, 'undo devolve a cauda anterior');
});
test('rascunho da aba Rigging: comparar funciona, aplicar exige editar como proposta (sem incompatibilidade silenciosa)', () => {
  const {root, draft, engine, rig} = studio({bind: false});rig.draft = core.ensureJointIds(structuredClone(draft));
  assert.equal(engine.state(), 'rascunho');const ids = Object.fromEntries(rig.draft.joints.map(x => [x.name, x.id]));
  const d = engine.dryRun(P([{op: 'setBonePosition', jointId: ids.RightElbow, position: [-.5, 1.8, 0]}]));assert.ok(d.ok);assert.ok(d.changes.some(c => c.name === 'RightElbow'));
  const m = engine.validate(P([{op: 'mirrorBone', jointId: ids.LeftElbow}]));assert.equal(m.stage, 'pendente');
  const a = engine.apply(P([{op: 'setBonePosition', jointId: ids.RightElbow, position: [-.5, 1.8, 0]}]));assert.equal(a.ok, false);assert.match(a.errors[0].message, /não sincroniza/);
  engine.autoRig.adoptDraft();assert.equal(engine.state(), 'proposta');assert.ok(engine.apply(P([{op: 'setBonePosition', jointId: ids.RightElbow, position: [-.5, 1.8, 0]}])).ok);
  assert.deepEqual(engine.current().find(x => x.name === 'RightElbow').p, [-.5, 1.8, 0]);
  const preview = engine.bindPreview(P([{op: 'setBonePosition', jointId: ids.RightElbow, position: [-.6, 1.8, 0]}]));assert.ok(preview.ok);assert.ok(preview.influence.length > 0);
  let skinned = false;root.traverse(o => {if (o.isSkinnedMesh) skinned = true;});assert.equal(skinned, false, 'prévia não vincula o modelo');
});
test('coordenadas corrigidas (JSON arenamon-rig) viram patch canônico de setBonePosition', () => {
  const {root, engine} = studio(), rigJSON = core.exportCoordinates(root);rigJSON.joints.find(j => j.name === 'Head').p[1] += .05;
  const patch = patchFromRigJSON(rigJSON, engine.current());assert.equal(patch.operations.length, 1);assert.equal(patch.operations[0].op, 'setBonePosition');
  assert.ok(engine.validate(patch).ok);
});
test('visão de rascunho: sem skin, sem influência', () => {
  const {root, draft} = studio({bind: false}), v = toView(core.inspectRig(root, {draft}), {state: 'rascunho'});
  assert.equal(v.summary.bones, 20);assert.equal(v.joints[0].influence, null);assert.equal(v.summary.skinnedMeshes, 0);
});
test('ciclo de hierarquia: simulateRigPatch oficial aceita; o adaptador recusa antes do apply', () => {
  const {root, engine, H, ids} = studio(), i = ids(), a = rigFingerprint(root), cyc = P([{op: 'reparentBone', jointId: i.Hips, newParentJointId: i.Head}]);
  assert.equal(core.simulateRigPatch(root, cyc).valid, true, 'evidência: a simulação oficial não detecta o ciclo');
  const r = engine.apply(cyc);assert.equal(r.ok, false);assert.equal(r.stage, 'hierarquia');assert.match(r.errors[0].message, /Ciclo/);
  assert.equal(rigFingerprint(root), a);assert.equal(H.state().canUndo, false);
  assert.ok(engine.validate(P([{op: 'reparentBone', jointId: i.LeftClavicle, newParentJointId: i.Neck}])).ok, 'reparentar fora do ramo continua válido');
});
console.log(`\nWorkbench: ${n} testes unitários aprovados (API oficial de rigging).`);
