// Biblioteca de animações CC0: procedência, integridade dos dados e fidelidade do retarget em rigs diferentes
// (o próprio rig de origem, o template humanoide do Codex com skin e um rig no padrão Mixamo em centímetros).
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import * as T from 'three';
import * as core from '../src/rigging/core.js';
import {buildSourceSkeleton, mapRoles, retargetClip, inspectTarget, poseSource, REQUIRED, LIMBS, modelBones} from '../src/library/retarget.js';
import {buildWorkbenchCharacter} from './workbench-fixture.mjs';
import {extract} from '../tools/extract-cc0-animations.mjs';
const library = JSON.parse(readFileSync(new URL('../src/library/robot-expressive.anim.json', import.meta.url), 'utf8'));
let n = 0;const test = (name, fn) => {fn();n++;console.log('✓ ' + name);};
const deg = (a, b) => a.angleTo(b) * 180 / Math.PI;
const rootP = (root, o) => root.worldToLocal(o.getWorldPosition(new T.Vector3()));

/** Rig no padrão Mixamo (centímetros sob Armature 0,01), com os nomes reais do Mixamo e orientações de repouso próprias. */
function mixamoRig() {
  const root = new T.Group(), arm = new T.Object3D();arm.name = 'Armature';arm.scale.setScalar(.01);root.add(arm);
  const bone = (name, parent, p, rotZ = 0) => {const b = new T.Bone();b.name = 'mixamorig' + name;b.position.set(...p);b.rotation.z = rotZ;parent.add(b);return b;};
  const hips = bone('Hips', arm, [0, 100, 0]), s = bone('Spine', hips, [0, 10, 0]), s1 = bone('Spine1', s, [0, 10, 0]), s2 = bone('Spine2', s1, [0, 10, 0]);
  const neck = bone('Neck', s2, [0, 15, 0]);bone('Head', neck, [0, 10, 0]);
  for (const [side, x] of [['Left', 1], ['Right', -1]]) {
    const sh = bone(side + 'Shoulder', s2, [x * 5, 12, 0], -x * Math.PI / 2), a = bone(side + 'Arm', sh, [0, 10, 0]), f = bone(side + 'ForeArm', a, [0, 25, 0]);bone(side + 'Hand', f, [0, 22, 0]);
    const up = bone(side + 'UpLeg', hips, [x * 9, -5, 0], Math.PI), leg = bone(side + 'Leg', up, [0, 42, 0]);bone(side + 'Foot', leg, [0, 40, 0]);
  }
  root.updateMatrixWorld(true);return root;
}
/** Aplica o clipe convertido ao modelo no instante t (mixer real do Three.js). */
function play(model, clip, t) {const m = new T.AnimationMixer(model), a = m.clipAction(clip);a.setLoop(T.LoopOnce);a.clampWhenFinished = true;a.play();m.setTime(t);model.updateMatrixWorld(true);return () => {m.stopAllAction();m.uncacheRoot(model);};}
// Segmentos entre ossos ADJACENTES nos dois rigs (uma polilinha, como tórax→cabeça, depende das proporções de cada rig).
const SEGMENTS = [['upperArm.L', 'lowerArm.L'], ['upperArm.R', 'lowerArm.R'], ['clavicle.L', 'upperArm.L'], ['clavicle.R', 'upperArm.R'], ['upperLeg.L', 'lowerLeg.L'], ['upperLeg.R', 'lowerLeg.R'], ['chest', 'neck'], ['neck', 'head'], ['root', 'chest']];
/** Fidelidade: membros apontam como na origem (girada por A) em todo quadro, inclusive com repousos diferentes (T × braços
 * baixos); tronco e cabeça mantêm o mesmo ângulo do repouso.
 * Segmentos cujo osso final é transladado pelo clipe (ex.: cabeça em Death) são verificados à parte. */
function fidelity(model, label) {
  const source = buildSourceSkeleton(library), srcRoles = mapRoles(source.bones);let worst = 0, frames = 0, restGap = 0;const motion = {};
  for (const c of library.clips) {
    const clip = retargetClip(library, c.name, model, {source}), A = new T.Quaternion().fromArray(clip.userData.alignment), tgtRoles = mapRoles(modelBones(model));
    const dirs = () => SEGMENTS.map(([a, b]) => [rootP(source.root, srcRoles[b]).sub(rootP(source.root, srcRoles[a])).applyQuaternion(A).normalize(), rootP(model, tgtRoles[b]).sub(rootP(model, tgtRoles[a])).normalize()]);
    const rest = dirs().map(([s, t]) => deg(s, t)), restT = dirs().map(([, t]) => t);restGap = Math.max(restGap, rest[0]);
    for (const time of [0, c.duration * .37, c.duration * .71, c.duration]) {
      const restoreSrc = poseSource(source, c, time), stop = play(model, clip, time);
      const moved = new Set(c.tracks.filter(x => x.path === 'position').map(x => x.node));
      dirs().forEach(([, t], i) => {motion[c.name] = Math.max(motion[c.name] || 0, deg(t, restT[i]));});
      dirs().forEach(([s, t], i) => {if (moved.has(srcRoles[SEGMENTS[i][1]].name)) return;const e = SEGMENTS[i][0] in LIMBS ? deg(s, t) : Math.abs(deg(s, t) - rest[i]);worst = Math.max(worst, e);assert.ok(e < .5, `${label} ${c.name} t=${time.toFixed(2)} ${SEGMENTS[i].join('→')}: ${e.toFixed(3)}°`);});
      stop();restoreSrc();frames++;
    }
  }
  for (const name of ['Walking', 'Running', 'Punch', 'Wave', 'Jump']) assert.ok(motion[name] > 20, `${label} ${name}: o alvo se move (${motion[name].toFixed(1)}°)`);
  return {worst, frames, restGap};
}

test('procedência: CC0 1.0, autor, commit e SHA-256 do arquivo de origem registrados', () => {
  assert.equal(library.schema, 'arenamon-animation-library');assert.equal(library.source.license, 'CC0 1.0 Universal (domínio público)');
  assert.match(library.source.author, /Tomás Laulhé/);assert.match(library.source.url, /mrdoob\/three\.js\/tree\/b924f0c/);assert.match(library.source.sha256, /^[0-9a-f]{64}$/);
  assert.ok(existsSync(new URL('../src/library/LICENSE-CC0-robot-expressive.txt', import.meta.url)), 'licença e créditos no repositório');
});
test('14 clipes reais com dados íntegros (tempos crescentes, quaternions unitários, valores finitos)', () => {
  assert.deepEqual(library.clips.map(c => c.name), ['Dance', 'Death', 'Idle', 'Jump', 'No', 'Punch', 'Running', 'Sitting', 'Standing', 'ThumbsUp', 'Walking', 'WalkJump', 'Wave', 'Yes']);
  for (const c of library.clips) {
    assert.ok(c.duration > .3 && c.tracks.length >= 6, c.name);
    for (const t of c.tracks) {
      const size = t.path === 'quaternion' ? 4 : 3;assert.equal(t.values.length, t.times.length * size, c.name + ' ' + t.node);
      assert.ok(t.times.every((v, i) => i === 0 || v > t.times[i - 1]));assert.ok(t.values.every(Number.isFinite));
      if (size === 4) for (let i = 0; i < t.values.length; i += 4) assert.ok(Math.abs(Math.hypot(...t.values.slice(i, i + 4)) - 1) < 1e-3);
    }
  }
  assert.deepEqual(library.clips.filter(c => c.loop).map(c => c.name), ['Dance', 'Idle', 'Running', 'Walking']);
});
test('extração reproduzível a partir do GLB original (quando disponível localmente)', () => {
  const path = process.env.ARENAMON_ROBOT_GLB;
  if (!path || !existsSync(path)) {console.log('  (pulado: defina ARENAMON_ROBOT_GLB com o arquivo de origem para conferir a extração)');return;}
  assert.deepEqual(JSON.parse(JSON.stringify(extract(readFileSync(path)))), library);
});
test('papéis anatômicos: origem, template do Codex e Mixamo (sem confundir clavícula e braço)', () => {
  const src = mapRoles(buildSourceSkeleton(library).bones);for (const r of REQUIRED) assert.ok(src[r], r);
  assert.equal(src.root.name, 'Body');assert.equal(src.chest.name, 'Torso');assert.equal(src['upperArm.L'].name, 'UpperArm.L');
  const {root} = buildWorkbenchCharacter(T, core), tpl = inspectTarget(root);assert.ok(tpl.ok, tpl.missing.join());
  assert.equal(tpl.roles['clavicle.L'], 'LeftClavicle');assert.equal(tpl.roles['upperArm.L'], 'LeftShoulder');assert.equal(tpl.roles['lowerLeg.R'], 'RightKnee');
  const mx = inspectTarget(mixamoRig());assert.ok(mx.ok, mx.missing.join());
  assert.equal(mx.roles['clavicle.L'], 'mixamorigLeftShoulder');assert.equal(mx.roles['upperArm.L'], 'mixamorigLeftArm');assert.equal(mx.roles.chest, 'mixamorigSpine2');
  const bad = new T.Group(), b = new T.Bone();b.name = 'Qualquer';bad.add(b);assert.equal(inspectTarget(bad).ok, false);
  assert.throws(() => retargetClip(library, 'Walking', bad), /não tem ossos para/);
});
test('identidade: converter para o próprio rig de origem reproduz as rotações originais', () => {
  const target = buildSourceSkeleton(library).root, source = buildSourceSkeleton(library), srcRoles = mapRoles(source.bones);
  for (const name of ['Walking', 'Punch', 'Death']) {
    const c = library.clips.find(x => x.name === name), clip = retargetClip(library, name, target);
    for (const t of [0, c.duration / 2, c.duration]) {
      const restore = poseSource(source, c, t), stop = play(target, clip, t), tr = mapRoles(modelBones(target));
      for (const role of ['upperArm.L', 'lowerArm.R', 'upperLeg.L', 'lowerLeg.R', 'head']) assert.ok(deg(new T.Vector3(1, 1, 1).applyQuaternion(srcRoles[role].quaternion), new T.Vector3(1, 1, 1).applyQuaternion(tr[role].quaternion)) < .05, `${name} ${role}`);
      stop();restore();
    }
  }
});
test('fidelidade no template humanoide do Codex (T-pose) com skin: 14 clipes, segmentos dentro de 0,5°', () => {
  const {root} = buildWorkbenchCharacter(T, core), r = fidelity(root, 'template');assert.equal(r.frames, 56);
  assert.ok(r.restGap > 30, `repousos diferentes de verdade: braço em T × braço baixo = ${r.restGap.toFixed(1)}° antes da correção`);console.log(`  pior desvio: ${r.worst.toFixed(4)}° (diferença de repouso corrigida: ${r.restGap.toFixed(1)}°)`);
});
test('fidelidade num rig Mixamo (cm, Armature 0,01, repousos girados): 14 clipes dentro de 0,5°', () => {
  const r = fidelity(mixamoRig(), 'mixamo');console.log(`  pior desvio: ${r.worst.toFixed(4)}°`);
});
test('translação da raiz proporcional à altura e convertida para o espaço do pai (escala 0,01)', () => {
  const source = buildSourceSkeleton(library), roles = mapRoles(source.bones), c = library.clips.find(x => x.name === 'Jump');
  const srcH = rootP(source.root, roles.head).distanceTo(rootP(source.root, roles.root)), y0 = rootP(source.root, roles.root).y;
  let srcMax = 0;for (const t of c.tracks[0].times) {const restore = poseSource(source, c, t);srcMax = Math.max(srcMax, rootP(source.root, roles.root).y - y0);restore();}
  for (const model of [mixamoRig(), buildWorkbenchCharacter(T, core).root]) {
    const tr = mapRoles(modelBones(model)), h = rootP(model, tr.head).distanceTo(rootP(model, tr.root)), base = rootP(model, tr.root).y, clip = retargetClip(library, 'Jump', model);
    let max = 0;for (const t of c.tracks[0].times) {const stop = play(model, clip, t);max = Math.max(max, rootP(model, tr.root).y - base);stop();}
    assert.ok(Math.abs(max / h - srcMax / srcH) < .01 * (srcMax / srcH) + 1e-6, `${max / h} × ${srcMax / srcH}`);
  }
  assert.ok(srcMax > 0, 'o pulo da origem sobe');
});
test('translações de ossos não-raiz (Death): cabeça e ombro se deslocam na mesma direção da origem', () => {
  const source = buildSourceSkeleton(library), sr = mapRoles(source.bones), c = library.clips.find(x => x.name === 'Death');
  const wq = (root, o) => root.getWorldQuaternion(new T.Quaternion()).invert().multiply(o.getWorldQuaternion(new T.Quaternion()));
  // Translação própria do osso no espaço da raiz: deslocamento em relação ao pai, menos o efeito da rotação do pai.
  const own = (root, b, restOff, restParentQ) => rootP(root, b).sub(rootP(root, b.parent)).sub(restOff.clone().applyQuaternion(wq(root, b.parent).multiply(restParentQ.clone().invert())));
  for (const model of [mixamoRig(), buildWorkbenchCharacter(T, core).root]) {
    const clip = retargetClip(library, 'Death', model, {source}), A = new T.Quaternion().fromArray(clip.userData.alignment), tr = mapRoles(modelBones(model));
    for (const role of ['head', 'clavicle.R']) {
      assert.ok(clip.tracks.some(x => x.name === tr[role].name + '.position'), role + ': trilha de posição');
      const s = sr[role], g = tr[role], restS = rootP(source.root, s).sub(rootP(source.root, s.parent)), restG = rootP(model, g).sub(rootP(model, g.parent));
      const pS = wq(source.root, s.parent), pG = wq(model, g.parent), t = c.duration * .6, undo = poseSource(source, c, t), stop = play(model, clip, t);
      const dS = own(source.root, s, restS, pS).applyQuaternion(A), dG = own(model, g, restG, pG);
      assert.ok(dS.length() > 1e-4, role + ': a origem translada');assert.ok(deg(dS, dG) < 1, `${role}: ${deg(dS, dG).toFixed(2)}°`);
      stop();undo();
    }
  }
});
test('clipe convertido: trilhas só de ossos existentes, sem NaN, duração e metadados de licença', () => {
  const {root} = buildWorkbenchCharacter(T, core), names = new Set(modelBones(root).map(b => b.name));
  for (const c of library.clips) {
    const clip = retargetClip(library, c.name, root);assert.equal(clip.duration, c.duration);assert.ok(clip.validate(), c.name);
    for (const t of clip.tracks) {assert.ok(names.has(t.name.split('.')[0]), t.name);assert.ok(Array.from(t.values).every(Number.isFinite), t.name);}
    assert.equal(clip.userData.license, 'CC0 1.0 Universal (domínio público)');assert.match(clip.name, /\(CC0\)$/);
  }
});
console.log(`\nBiblioteca CC0: ${n} testes aprovados.`);
