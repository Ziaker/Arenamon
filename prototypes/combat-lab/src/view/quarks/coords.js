// @ts-check
// F5 — coordenadas mundo → local para emissores three.quarks/Three presos a grupos (onda de areia, rush, splash). O emissor é FILHO do grupo:
// a posição dele está no espaço do grupo, então um ponto do mundo (contato da simulação) precisa de worldToLocal; uma DIREÇÃO não pode levar a
// translação nem a escala — em grupos só girados (ou escala uniforme) basta o quaternion mundial inverso; com escala não uniforme (ou cisalhamento
// de pais aninhados) a direção usa a inversa da parte linear e a NORMAL de superfície usa a transposta (a matriz normal do three é (M⁻¹)ᵀ, logo
// n_local ∝ Mᵀ·n_mundo). Sem alocação por chamada além do `out` opcional.
import * as T from 'three';

const _q = new T.Quaternion(), _m = new T.Matrix3(), _mt = new T.Matrix3();

/** @param {any} obj @returns {any} matriz de mundo atualizada (pais inclusive) */
function worldMatrixOf(obj) {obj.updateWorldMatrix(true, false);return obj.matrixWorld;}

/** A parte linear do mundo é rotação × escala uniforme (MᵀM ≈ s²·I)? Então o quaternion mundial inverso basta para direções. @param {any} obj */
export function isUniformWorldScale(obj, eps = 1e-9) {
  const e = _m.copy(_mt.setFromMatrix4(worldMatrixOf(obj))).transpose().multiply(_mt).elements;   // MᵀM
  const s = e[0];
  return Math.abs(e[4] - s) <= eps * Math.max(1, s) && Math.abs(e[8] - s) <= eps * Math.max(1, s) && Math.abs(e[1]) <= eps * Math.max(1, s) && Math.abs(e[2]) <= eps * Math.max(1, s) && Math.abs(e[5]) <= eps * Math.max(1, s);
}

/** Ponto do mundo → espaço local de `obj` (onde vivem os filhos dele). @param {any} obj @param {{x: number, y?: number, z: number}} p @param {any} [out] */
export function worldPointToLocal(obj, p, out = new T.Vector3()) {
  worldMatrixOf(obj);
  return obj.worldToLocal(out.set(p.x, p.y ?? 0, p.z));
}

/** Ponto no espaço do PAI de `obj` (o grupo do mundo do jogo, onde valem as coordenadas da simulação) → local de `obj`. @param {any} obj @param {{x: number, y?: number, z: number}} p @param {any} [out] */
export function parentPointToLocal(obj, p, out = new T.Vector3()) {
  out.set(p.x, p.y ?? 0, p.z);
  if (obj.parent) {worldMatrixOf(obj.parent);obj.parent.localToWorld(out);}
  return worldPointToLocal(obj, out, out);
}

/** Direção no espaço do PAI de `obj` → local (unitária). @param {any} obj @param {{x: number, y?: number, z: number}} d @param {any} [out] */
export function parentDirToLocal(obj, d, out = new T.Vector3()) {
  out.set(d.x, d.y ?? 0, d.z);
  if (obj.parent) out.transformDirection(worldMatrixOf(obj.parent));
  return worldDirToLocal(obj, out, out);
}

/** Direção do mundo → local (unitária): quaternion mundial inverso em grupos rotacionais; inversa linear com escala não uniforme. @param {any} obj @param {{x: number, y?: number, z: number}} d @param {any} [out] */
export function worldDirToLocal(obj, d, out = new T.Vector3()) {
  out.set(d.x, d.y ?? 0, d.z);
  if (isUniformWorldScale(obj)) {obj.getWorldQuaternion(_q);return out.applyQuaternion(_q.invert()).normalize();}
  return out.applyMatrix3(_m.setFromMatrix4(worldMatrixOf(obj)).invert()).normalize();
}

/** Normal de superfície do mundo → local (unitária), coerente com a matriz normal do three: n_local ∝ Mᵀ·n_mundo. @param {any} obj @param {{x: number, y?: number, z: number}} n @param {any} [out] */
export function worldNormalToLocal(obj, n, out = new T.Vector3()) {
  out.set(n.x, n.y ?? 0, n.z);
  return out.applyMatrix3(_m.setFromMatrix4(worldMatrixOf(obj)).transpose()).normalize();
}
