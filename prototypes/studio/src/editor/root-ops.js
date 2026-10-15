// Root motion: análise, extração e edição do deslocamento do osso raiz.
// Os valores do track de posição estão no espaço local do pai do osso raiz (por exemplo, a Armature
// Mixamo em centímetros com escala 0,01). `basis.toModel` converte vetores desse espaço para o espaço do
// modelo (Y para cima, unidades do modelo); `basis.fromModel` faz o caminho inverso.
import * as T from 'three';
import {sampler, valueSize, EPS} from './clip-ops.js';

const identity = () => ({toModel: new T.Matrix3(), fromModel: new T.Matrix3()});

/** Constrói a base a partir do pai do osso raiz em pose de repouso, relativa à raiz do modelo. */
export function basisFor(node, modelRoot) {
  if (!node?.parent || !modelRoot) return identity();
  modelRoot.updateMatrixWorld(true);
  const rel = new T.Matrix4().copy(modelRoot.matrixWorld).invert().multiply(node.parent.matrixWorld);
  const toModel = new T.Matrix3().setFromMatrix4(rel);
  return {toModel, fromModel: toModel.clone().invert()};
}

/** Eixo vertical do modelo expresso no espaço local do pai (normalizado). */
function upLocal(basis) {return new T.Vector3(0, 1, 0).applyMatrix3(basis.fromModel).normalize();}

/** Rotação em torno de `axis` contida em q (decomposição swing–twist). */
export function twist(q, axis) {
  const p = axis.clone().multiplyScalar(axis.x * q.x + axis.y * q.y + axis.z * q.z);
  const t = new T.Quaternion(p.x, p.y, p.z, q.w);
  return t.lengthSq() < 1e-12 ? new T.Quaternion() : t.normalize();
}
const twistAngle = (q, axis) => {const t = twist(q, axis);const s = axis.x * t.x + axis.y * t.y + axis.z * t.z;return 2 * Math.atan2(s, t.w);};

/** Amostra a raiz em fps e devolve deslocamentos relativos ao primeiro quadro, no espaço do modelo. */
export function analyzeRoot({position, quaternion, duration, basis = identity(), fps = 30}) {
  const samples = [];if (!position && !quaternion) return {samples, metrics: null};
  const pos = position && sampler(position), rot = quaternion && sampler(quaternion);
  const p0 = pos ? new T.Vector3().fromArray(pos(0)) : new T.Vector3(), q0 = rot ? new T.Quaternion().fromArray(rot(0)) : new T.Quaternion();
  const axis = upLocal(basis), count = Math.max(1, Math.round(duration * fps));
  let yawPrev = 0, yawAcc = 0, path = 0, prev = null, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i <= count; i++) {
    const t = Math.min(duration, i / fps);
    const d = pos ? new T.Vector3().fromArray(pos(t)).sub(p0).applyMatrix3(basis.toModel) : new T.Vector3();
    let yaw = 0;
    if (rot) {const q = new T.Quaternion().fromArray(rot(t)).multiply(q0.clone().invert());yaw = twistAngle(q, axis);let delta = yaw - yawPrev;while (delta > Math.PI) delta -= 2 * Math.PI;while (delta < -Math.PI) delta += 2 * Math.PI;yawAcc += delta;yawPrev = yaw;}
    if (prev) path += Math.hypot(d.x - prev.x, d.z - prev.z);prev = d;minY = Math.min(minY, d.y);maxY = Math.max(maxY, d.y);
    samples.push({t, x: d.x, y: d.y, z: d.z, yaw: yawAcc});
  }
  const last = samples[samples.length - 1];
  return {samples, metrics: {dx: last.x, dy: last.y, dz: last.z, horizontal: Math.hypot(last.x, last.z), path, minY, maxY, yawDegrees: T.MathUtils.radToDeg(last.yaw)}};
}

/**
 * Edita a raiz. options:
 *  horizontal: fator 0..2 (1 = original, 0 = in-place)
 *  method: 'full' (escala todo o deslocamento horizontal) | 'trend' (escala só o avanço linear e preserva o balanço)
 *  vertical: 'keep' | 'lock'
 *  rotation: 'keep' | 'remove-yaw'
 * Devolve novos tracks (ou null quando o track não existe).
 */
export function editRoot({position, quaternion, duration, basis = identity()}, {horizontal = 1, method = 'full', vertical = 'keep', rotation = 'keep'} = {}) {
  const result = {position: null, quaternion: null};const up = new T.Vector3(0, 1, 0), axis = upLocal(basis);
  if (position) {
    const size = valueSize(position), pos = sampler(position), times = Array.from(position.times), values = [];
    const p0 = new T.Vector3().fromArray(pos(0)), endModel = new T.Vector3().fromArray(pos(duration)).sub(p0).applyMatrix3(basis.toModel);
    const endH = endModel.clone().sub(up.clone().multiplyScalar(endModel.dot(up)));
    for (let i = 0; i < times.length; i++) {
      const p = new T.Vector3().fromArray(position.values, i * size), d = p.clone().sub(p0).applyMatrix3(basis.toModel);
      const v = up.clone().multiplyScalar(d.dot(up)), h = d.clone().sub(v);
      let h2;
      if (method === 'trend') h2 = h.clone().sub(endH.clone().multiplyScalar((1 - horizontal) * (duration > EPS ? times[i] / duration : 0)));
      else h2 = h.clone().multiplyScalar(horizontal);
      const v2 = vertical === 'lock' ? new T.Vector3() : v;
      const out = p0.clone().add(h2.add(v2).applyMatrix3(basis.fromModel));
      values.push(out.x, out.y, out.z);
    }
    result.position = new position.constructor(position.name, times, values, position.getInterpolation());
  }
  if (quaternion && rotation === 'remove-yaw') {
    const size = valueSize(quaternion), times = Array.from(quaternion.times), values = [];
    const q0 = new T.Quaternion().fromArray(sampler(quaternion)(0)), q0i = q0.clone().invert();
    for (let i = 0; i < times.length; i++) {
      const q = new T.Quaternion().fromArray(quaternion.values, i * size), yaw = twist(q.clone().multiply(q0i), axis);
      const out = yaw.invert().multiply(q).normalize();values.push(out.x, out.y, out.z, out.w);
    }
    result.quaternion = new quaternion.constructor(quaternion.name, times, values, quaternion.getInterpolation());
  }
  return result;
}

/** Dados de root motion separados da animação visual (para o jogo), arredondados a 0,1 mm/0,01°. */
export function rootMotionData(analysis, fps) {
  const r = x => Math.round(x * 1e4) / 1e4;
  return {
    fps, space: 'model', units: 'model-units', relativeTo: 'first-frame',
    samples: analysis.samples.map(s => [r(s.t), r(s.x), r(s.y), r(s.z), Math.round(T.MathUtils.radToDeg(s.yaw) * 100) / 100]),
    columns: ['time', 'x', 'y', 'z', 'yawDegrees'],
    metrics: analysis.metrics && Object.fromEntries(Object.entries(analysis.metrics).map(([k, v]) => [k, r(v)])),
  };
}
