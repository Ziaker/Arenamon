// Testes unitários (Node) das operações puras de animação. Uso: node prototypes/studio/test/ops.test.mjs
import * as T from 'three';
import assert from 'node:assert/strict';
import {trimClip, trimTrack, scaleClipTime, closeLoop, sampler, bakeTrack, trimEvents, scaleEvents, keyTimes} from '../src/editor/clip-ops.js';
import {analyzeRoot, editRoot, twist, rootMotionData} from '../src/editor/root-ops.js';
import {createHistory} from '../src/editor/history.js';
import {eventWarnings} from '../src/editor/store.js';

const near = (a, b, eps = 1e-5, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} esperado ${b}, obtido ${a}`);
const nearArr = (a, b, eps = 1e-5, msg) => {assert.equal(a.length, b.length, msg);a.forEach((v, i) => near(v, b[i], eps, msg));};
const qAngle = (a, b) => new T.Quaternion().fromArray(a).angleTo(new T.Quaternion().fromArray(b));
const Q = (axis, deg) => new T.Quaternion().setFromAxisAngle(new T.Vector3(...axis), deg * Math.PI / 180).toArray();
let passed = 0;const test = (name, fn) => {fn();passed++;console.log('✓', name);};

const pos = new T.VectorKeyframeTrack('hips.position', [0, 1, 2, 3], [0, 0, 0, 1, 0, 0, 2, 1, 0, 3, 0, 0]);
const rot = new T.QuaternionKeyframeTrack('head.quaternion', [0, 3], [...Q([1, 0, 0], 0), ...Q([1, 0, 0], 90)]);
const step = new T.BooleanKeyframeTrack('mesh.visible', [0, 1.5], [true, false]);
const clip = new T.AnimationClip('tackle', 3, [pos, rot, step]);

test('recorte interpola as fronteiras e desloca para 0', () => {
  const r = trimClip(clip, .5, 2.25);near(r.duration, 1.75);
  const p = r.tracks[0];nearArr(Array.from(p.times), [0, .5, 1.5, 1.75]);
  nearArr(Array.from(p.values), [.5, 0, 0, 1, 0, 0, 2, 1, 0, 2.25, .75, 0]);
  const q = r.tracks[1];nearArr(Array.from(q.times), [0, 1.75]);
  near(qAngle(Array.from(q.values.slice(0, 4)), Q([1, 0, 0], 15)), 0, 1e-3, 'slerp no início');
  near(qAngle(Array.from(q.values.slice(4, 8)), Q([1, 0, 0], 67.5)), 0, 1e-3, 'slerp no fim');
  assert.deepEqual(Array.from(r.tracks[2].values), [true, false, false]);
});
test('recorte não altera o clip original (não destrutivo)', () => {
  nearArr(Array.from(pos.times), [0, 1, 2, 3]);assert.equal(clip.duration, 3);assert.equal(clip.tracks[0], pos);
});
test('recorte exatamente sobre chaves não duplica tempos', () => {
  const t = trimTrack(pos, 1, 2);nearArr(Array.from(t.times), [0, 1]);
});
test('trecho de 0,4 s de uma animação de 3 s', () => {
  const r = trimClip(clip, 1.2, 1.6);near(r.duration, .4);for (const t of r.tracks) {near(t.times[0], 0);near(t.times.at(-1), .4);}
  near(sampler(r.tracks[0])(.2)[0], 1.4);
});
test('recorte rejeita duração zero', () => assert.throws(() => trimClip(clip, 1, 1)));
test('velocidade 200% reduz a duração à metade e eventos acompanham', () => {
  const r = scaleClipTime(clip, .5);near(r.duration, 1.5);nearArr(Array.from(r.tracks[0].times), [0, .5, 1, 1.5]);
  nearArr(Array.from(r.tracks[0].values), Array.from(pos.values));
  near(scaleEvents([{time: 1}], .5)[0].time, .5);
});
test('eventos fora do trecho são descartados e os demais deslocados', () => {
  const e = trimEvents([{id: 'a', time: .2}, {id: 'b', time: 1}, {id: 'c', time: 2.9}], .5, 2);assert.deepEqual(e.map(x => [x.id, +x.time.toFixed(3)]), [['b', .5]]);
});
test('fechar loop iguala a pose final à inicial e preserva o avanço da raiz', () => {
  const r = closeLoop(clip, .5, {fps: 30, keepTravel: ['hips.position']});const p = r.tracks[0], q = r.tracks[1];
  const last = Array.from(p.values.slice(-3));near(last[0], 3, 1e-5, 'X (avanço) preservado');near(last[1], 0, 1e-5, 'Y fechado');
  near(qAngle(Array.from(q.values.slice(-4)), Q([1, 0, 0], 0)), 0, 1e-3, 'rotação final = inicial');
  near(qAngle(sampler(q)(2.5), Q([1, 0, 0], 75)), 0, 1e-3, 'antes da janela permanece igual');
  const times = Array.from(q.times);for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1]);
});
test('bake de spline cúbica gera amostras lineares', () => {
  const t = new T.VectorKeyframeTrack('a.position', [0, 1], [0, 0, 0, 1, 1, 1], T.InterpolateSmooth);const b = bakeTrack(t, 10);assert.equal(b.times.length, 11);
});
test('tempos de chave únicos', () => assert.deepEqual(keyTimes(clip), [0, 1, 1.5, 2, 3]));
test('twist extrai somente a rotação em torno do eixo', () => {
  const q = new T.Quaternion().setFromEuler(new T.Euler(.3, .8, 0, 'YXZ'));const t = twist(q, new T.Vector3(0, 1, 0));
  near(new T.Euler().setFromQuaternion(t, 'YXZ').y, .8, 1e-6);near(t.x, 0);near(t.z, 0);
});

// Raiz Mixamo: posições em cm sob uma Armature com escala 0,01.
const fps = 30, times = Array.from({length: 31}, (_, i) => i / fps);
const rootPos = new T.VectorKeyframeTrack('hips.position', times, times.flatMap(t => [Math.sin(t * 8) * 5, 100 + Math.sin(t * 6) * 4, t * 300]));
const rootRot = new T.QuaternionKeyframeTrack('hips.quaternion', times, times.flatMap(t => new T.Quaternion().setFromEuler(new T.Euler(.2 * Math.sin(t * 6), Math.PI / 2 * t, 0, 'YXZ')).toArray()));
const armature = new T.Object3D();armature.scale.setScalar(.01);armature.updateMatrixWorld(true);
const basis = {toModel: new T.Matrix3().setFromMatrix4(armature.matrixWorld)};basis.fromModel = basis.toModel.clone().invert();
const info = {position: rootPos, quaternion: rootRot, duration: 1, basis};

test('análise mede deslocamento em unidades do modelo e giro acumulado', () => {
  const a = analyzeRoot({...info, fps});near(a.metrics.dz, 3, 1e-4);near(a.metrics.horizontal, Math.hypot(a.metrics.dx, 3), 1e-6);near(a.metrics.yawDegrees, 90, .01);
  const data = rootMotionData(a, fps);assert.equal(data.samples.length, 31);assert.deepEqual(data.columns, ['time', 'x', 'y', 'z', 'yawDegrees']);
});
test('in-place total remove todo o deslocamento horizontal e preserva a altura', () => {
  const out = editRoot(info, {horizontal: 0});const v = out.position.values;
  for (let i = 0; i < times.length; i++) {near(v[i * 3], rootPos.values[0]);near(v[i * 3 + 2], rootPos.values[2]);near(v[i * 3 + 1], rootPos.values[i * 3 + 1]);}
  assert.equal(out.quaternion, null);nearArr(Array.from(rootPos.values.slice(0, 3)), [0, 100, 0]);
});
test('remover só o avanço preserva o balanço lateral', () => {
  const out = editRoot(info, {horizontal: 0, method: 'trend'}), v = out.position.values;
  near(v.at(-1), 0, 1e-4, 'Z final volta ao início');near(v[15 * 3], rootPos.values[15 * 3] - rootPos.values[30 * 3] * .5, 1e-4, 'X: balanço mantido, só a deriva linear sai');
});
test('intensidade 50% reduz o deslocamento pela metade e altura neutralizada', () => {
  const out = editRoot(info, {horizontal: .5, vertical: 'lock'});near(out.position.values.at(-1), 150, 1e-4);near(out.position.values.at(-2), 100, 1e-6);
});
test('neutralizar giro remove o yaw e mantém a inclinação', () => {
  const out = editRoot(info, {rotation: 'remove-yaw'});const a = analyzeRoot({...info, quaternion: out.quaternion, fps});near(a.metrics.yawDegrees, 0, 1e-3);
  const e = new T.Euler().setFromQuaternion(new T.Quaternion().fromArray(out.quaternion.values, 15 * 4), 'YXZ');near(e.x, .2 * Math.sin(.5 * 6), 1e-4);
});

test('histórico desfaz e refaz na ordem correta', () => {
  let value = 0;const states = [];const h = createHistory({onChange: s => states.push(s)});
  h.run({label: 'a', redo: () => {value = 1;}, undo: () => {value = 0;}});h.run({label: 'b', redo: () => {value = 2;}, undo: () => {value = 1;}});
  h.undo();assert.equal(value, 1);h.undo();assert.equal(value, 0);assert.equal(h.undo(), null);h.redo();assert.equal(value, 1);
  h.run({label: 'c', redo: () => {value = 5;}, undo: () => {value = 1;}});assert.equal(h.state().canRedo, false);assert.equal(states.at(-1).undoLabel, 'c');
});
test('avisos de eventos sem par', () => {
  const w = eventWarnings([{type: 'hitbox_on', time: .2}, {type: 'invulnerable_end', time: .5}], 1);assert.equal(w.length, 2);
  assert.deepEqual(eventWarnings([{type: 'hitbox_on', time: .2}, {type: 'hitbox_off', time: .4}], 1), []);
});
console.log(`\n${passed} testes unitários aprovados.`);
