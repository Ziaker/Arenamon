// Retarget de animações da biblioteca CC0 para o rig humanoide do personagem carregado.
//
// Método (rotação no espaço da raiz, sem IK):
// 1. Cada esqueleto tem papéis anatômicos (raiz, tórax, pescoço, cabeça, clavícula, braço, antebraço, coxa e canela
//    de cada lado), achados pelo nome do osso (convenções Arenamon/Codex, Mixamo e a da própria biblioteca).
// 2. Uma rotação A alinha os eixos dos dois rigs: "cima" = raiz → cabeça; "lado" = braço direito → braço esquerdo.
// 3. Para cada quadro, a variação de rotação de cada osso de origem em relação ao repouso, Δ = W(t)·W₀⁻¹ (espaço da
//    raiz), é levada ao osso equivalente: W'(t) = A·Δ·A⁻¹·W'₀. A rotação local sai de W' e da rotação do pai no
//    mesmo quadro. Ossos sem papel ficam no repouso local.
// 4. A translação da raiz é a da origem, girada por A e escalada pela razão das alturas raiz → cabeça.
// 5. Correção de repouso nos membros (clavícula, braço, antebraço, coxa, canela): antes de seguir a origem, cada
//    membro do alvo é girado para apontar como o da origem em repouso (ex.: T-pose do template × braços baixos do
//    robô): W'(t) = A·Δ·A⁻¹·C·W'₀, com C levando a direção de repouso do alvo à da origem.
// Assim cada membro aponta exatamente como na origem, e tronco e cabeça variam exatamente como na origem (testado),
// seja qual for a orientação de repouso dos ossos do personagem.
import * as T from 'three';

const SIDES = {L: ['l', 'left'], R: ['r', 'right']};
/** Candidatos por papel, em ordem de preferência (nomes normalizados). `{s}`/`{side}` = sufixo/prefixo do lado. */
const ROLE_NAMES = {
  root: ['body', 'hips', 'pelvis'],
  chest: ['torso', 'chest', 'upperchest', 'spine2', 'spine1', 'spine'],
  neck: ['neck'],
  head: ['head'],
  clavicle: ['{side}clavicle', 'clavicle{s}', 'shoulder{s}', '{side}shoulder'],
  upperArm: ['upperarm{s}', '{side}arm', '{side}upperarm', '{side}shoulder'],
  lowerArm: ['lowerarm{s}', '{side}forearm', '{side}elbow', '{side}lowerarm'],
  upperLeg: ['upperleg{s}', '{side}upleg', '{side}hip', '{side}thigh', '{side}upperleg'],
  lowerLeg: ['lowerleg{s}', '{side}leg', '{side}knee', '{side}shin', '{side}lowerleg'],
};
/** Membros com correção de repouso → papel do osso seguinte (null = primeiro osso filho). */
export const LIMBS = {'clavicle.L': 'upperArm.L', 'clavicle.R': 'upperArm.R', 'upperArm.L': 'lowerArm.L', 'upperArm.R': 'lowerArm.R', 'lowerArm.L': null, 'lowerArm.R': null,
  'upperLeg.L': 'lowerLeg.L', 'upperLeg.R': 'lowerLeg.R', 'lowerLeg.L': null, 'lowerLeg.R': null};
export const REQUIRED = ['root', 'chest', 'head', 'upperArm.L', 'upperArm.R', 'lowerArm.L', 'lowerArm.R', 'upperLeg.L', 'upperLeg.R', 'lowerLeg.L', 'lowerLeg.R'];
export const normalizeBoneName = n => String(n).replace(/^mixamorig[:_]?/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

/** Papel → osso, para uma lista de ossos (Object3D) em ordem de hierarquia. Cada osso recebe no máximo um papel. */
export function mapRoles(bones) {
  const byName = new Map();for (const b of bones) if (!byName.has(normalizeBoneName(b.name))) byName.set(normalizeBoneName(b.name), b);
  const used = new Set(), roles = {};
  const take = list => {for (const n of list) {const b = byName.get(n);if (b && !used.has(b)) {used.add(b);return b;}}return null;};
  for (const role of ['root', 'chest', 'neck', 'head']) roles[role] = take(ROLE_NAMES[role]);
  for (const role of ['clavicle', 'upperArm', 'lowerArm', 'upperLeg', 'lowerLeg']) for (const [side, [s, word]] of Object.entries(SIDES))
    roles[`${role}.${side}`] = take(ROLE_NAMES[role].map(p => p.replace('{s}', s).replace('{side}', word)));
  // Sem tórax distinto, o primeiro osso da coluna acima da raiz faz o papel.
  return Object.fromEntries(Object.entries(roles).filter(([, b]) => b));
}

/** Esqueleto de origem (nós da biblioteca) montado como hierarquia Three.js em repouso. */
export function buildSourceSkeleton(library) {
  const map = new Map(), root = new T.Group();root.name = library.source.id + ':root';
  for (const n of library.nodes) {
    const o = n.joint ? new T.Bone() : new T.Object3D();o.name = n.name;
    o.position.fromArray(n.t);o.quaternion.fromArray(n.r);o.scale.fromArray(n.s);
    (n.parent ? map.get(n.parent) : root).add(o);map.set(n.name, o);
  }
  root.updateMatrixWorld(true);
  return {root, nodes: map, bones: library.nodes.filter(n => n.joint).map(n => map.get(n.name))};
}

/** Põe o esqueleto de origem na pose do clipe no instante `time` (repouso + trilhas). Devolve uma função que restaura o repouso. */
export function poseSource(source, clip, time) {
  source.rest ??= new Map(source.bones.map(b => [b, {q: b.quaternion.clone(), p: b.position.clone()}]));
  source.interp ??= new Map();
  if (!source.interp.has(clip)) source.interp.set(clip, clip.tracks.map(t => {
    const K = t.path === 'quaternion' ? T.QuaternionKeyframeTrack : T.VectorKeyframeTrack;
    return {node: source.nodes.get(t.node), path: t.path, ev: new K('x.' + t.path, t.times, t.values).createInterpolant()};
  }).filter(i => i.node));
  for (const [b, r] of source.rest) {b.quaternion.copy(r.q);b.position.copy(r.p);}
  for (const i of source.interp.get(clip)) {const v = i.ev.evaluate(time);if (i.path === 'quaternion') i.node.quaternion.fromArray(v).normalize();else i.node.position.fromArray(v);}
  source.root.updateMatrixWorld(true);
  return () => {for (const [b, r] of source.rest) {b.quaternion.copy(r.q);b.position.copy(r.p);}source.root.updateMatrixWorld(true);};
}

const rootSpaceQ = (root, o) => root.getWorldQuaternion(new T.Quaternion()).invert().multiply(o.getWorldQuaternion(new T.Quaternion()));
const rootSpaceP = (root, o) => root.worldToLocal(o.getWorldPosition(new T.Vector3()));

/** Rotação que leva os eixos (lado, cima) da origem aos do alvo. */
function alignment(src, srcRoot, tgt, tgtRoot) {
  const basis = (roles, root) => {
    const up = rootSpaceP(root, roles.head).sub(rootSpaceP(root, roles.root)).normalize();
    const side = rootSpaceP(root, roles['upperArm.L']).sub(rootSpaceP(root, roles['upperArm.R']));
    side.addScaledVector(up, -side.dot(up)).normalize();
    const fwd = new T.Vector3().crossVectors(side, up).normalize();
    return new T.Matrix4().makeBasis(side, up, fwd);
  };
  const m = basis(tgt, tgtRoot).multiply(basis(src, srcRoot).transpose());
  return new T.Quaternion().setFromRotationMatrix(m);
}

/** Bones do modelo em ordem de hierarquia (pais antes dos filhos). */
export function modelBones(model) {const out = [];model.traverse(o => {if (o.isBone) out.push(o);});return out;}

/** Verifica se o personagem pode receber as animações: papéis obrigatórios encontrados. */
export function inspectTarget(model) {
  const roles = mapRoles(modelBones(model)), missing = REQUIRED.filter(r => !roles[r]);
  return {ok: !missing.length, missing, roles: Object.fromEntries(Object.entries(roles).map(([k, b]) => [k, b.name]))};
}

/**
 * Converte um clipe da biblioteca para o personagem `model` (na pose de repouso). Devolve um THREE.AnimationClip com
 * trilhas `<nome do osso>.quaternion` (e `.position` da raiz e dos ossos que a origem translada). `fps` define a amostragem (os tempos-chave de origem
 * também são incluídos).
 */
export function retargetClip(library, clipName, model, {fps = 30, source = buildSourceSkeleton(library)} = {}) {
  const clip = library.clips.find(c => c.name === clipName);if (!clip) throw Error('Clipe inexistente na biblioteca: ' + clipName);
  const srcRoles = mapRoles(source.bones), tgtBones = modelBones(model), tgtRoles = mapRoles(tgtBones);
  const missing = REQUIRED.filter(r => !tgtRoles[r]);if (missing.length) throw Error('O personagem não tem ossos para: ' + missing.join(', '));
  model.updateMatrixWorld(true);
  const roleOfTarget = new Map(Object.entries(tgtRoles).filter(([r]) => srcRoles[r]).map(([r, b]) => [b, r]));
  const A = alignment(srcRoles, source.root, tgtRoles, model), Ainv = A.clone().invert();
  // Repouso da origem (espaço da raiz) e interpolantes das trilhas.
  const srcRestQ = new Map(Object.values(srcRoles).map(b => [b, rootSpaceQ(source.root, b)]));
  const srcRootRestP = rootSpaceP(source.root, srcRoles.root);
  // Repouso do alvo.
  const tgtRootQ = model.getWorldQuaternion(new T.Quaternion()).invert();
  const tgtRest = new Map(tgtBones.map(b => [b, {local: b.quaternion.clone(), world: tgtRootQ.clone().multiply(b.getWorldQuaternion(new T.Quaternion()))}]));
  const parentRestQ = b => b.parent && !b.parent.isBone ? tgtRootQ.clone().multiply(b.parent.getWorldQuaternion(new T.Quaternion())) : null;
  // Correção de repouso dos membros (C), no espaço da raiz do alvo.
  const firstChild = b => b.children.find(c => c.isBone) || null, correction = new Map();
  for (const [role, next] of Object.entries(LIMBS)) {
    const s = srcRoles[role], g = tgtRoles[role];if (!s || !g) continue;
    const sc = next ? srcRoles[next] : firstChild(s), gc = next ? tgtRoles[next] : firstChild(g);if (!sc || !gc) continue;
    const ds = rootSpaceP(source.root, sc).sub(rootSpaceP(source.root, s)).applyQuaternion(A).normalize(), dg = rootSpaceP(model, gc).sub(rootSpaceP(model, g)).normalize();
    if (ds.lengthSq() > .5 && dg.lengthSq() > .5) correction.set(g, new T.Quaternion().setFromUnitVectors(dg, ds));
  }
  const tgtRoot = tgtRoles.root, tgtRootRestP = tgtRoot.position.clone();
  const scale = rootSpaceP(model, tgtRoles.head).distanceTo(rootSpaceP(model, tgtRoot)) / rootSpaceP(source.root, srcRoles.head).distanceTo(srcRootRestP);
  // Parte linear (rotação e escala, ex.: Armature 0,01 do Mixamo) do espaço da raiz do modelo → espaço local do pai da raiz.
  const toParent = new T.Matrix3().setFromMatrix4(new T.Matrix4().copy(model.matrixWorld).invert().multiply(tgtRoot.parent.matrixWorld).invert());
  // Tempos: grade fixa + tempos-chave da origem.
  const times = new Set([0, clip.duration]);for (let t = 0; t < clip.duration; t += 1 / fps) times.add(Math.round(t * 1e5) / 1e5);
  for (const t of clip.tracks) for (const k of t.times) times.add(k);
  const sorted = [...times].filter(t => t <= clip.duration + 1e-9).sort((a, b) => a - b);
  const out = new Map(tgtBones.filter(b => roleOfTarget.has(b)).map(b => [b, []])), rootPos = [];
  // Translações de ossos que não são a raiz (ex.: cabeça e ombros em Death): o deslocamento local da origem é levado
  // ao espaço da raiz pela rotação do pai no quadro, alinhado por A, escalado pela razão dos comprimentos do osso e trazido ao espaço do pai no alvo.
  // Escala por segmento: o deslocamento é proporcional ao comprimento do osso (distância ao pai) em cada rig.
  const worldScale = (o, root) => o.getWorldScale(new T.Vector3()).x / root.getWorldScale(new T.Vector3()).x;
  const kFor = (src, tgt) => {const ls = src.position.length() * worldScale(src.parent, source.root), lt = tgt.position.length() * worldScale(tgt.parent, model);return (ls > 1e-9 ? lt / ls : scale) * worldScale(src.parent, source.root) / worldScale(tgt.parent, model);};
  const moving = new Map(clip.tracks.filter(t => t.path === 'position').map(t => source.nodes.get(t.node)).filter(n => n && n !== srcRoles.root)
    .map(n => [n, Object.keys(srcRoles).find(r => srcRoles[r] === n)]).filter(([, r]) => r && tgtRoles[r]).map(([n, r]) => [tgtRoles[r], {src: n, rest: n.position.clone(), out: [], tgtRest: tgtRoles[r].position.clone(), k: kFor(n, tgtRoles[r])}]));
  const q = new T.Quaternion();let restore = null;
  for (const time of sorted) {
    restore = poseSource(source, clip, time);
    const world = new Map();
    for (const b of tgtBones) {
      const rest = tgtRest.get(b), parentW = b.parent?.isBone ? world.get(b.parent) : parentRestQ(b), role = roleOfTarget.get(b);
      let w;
      if (role) {
        const s = srcRoles[role], delta = rootSpaceQ(source.root, s).multiply(srcRestQ.get(s).clone().invert());
        w = A.clone().multiply(delta).multiply(Ainv);if (correction.has(b)) w.multiply(correction.get(b));w.multiply(rest.world);
        const local = (parentW ? parentW.clone().invert() : new T.Quaternion()).multiply(w).normalize();
        // Continuidade: evita saltos de sinal entre quadros (q e −q são a mesma rotação).
        const list = out.get(b), prev = list.length ? q.fromArray(list.slice(-4)) : null;
        if (prev && prev.dot(local) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
        list.push(...local.toArray());
        const mv = moving.get(b);
        if (mv) {
          const dl = mv.src.position.clone().sub(mv.rest).applyQuaternion(rootSpaceQ(source.root, mv.src.parent)).applyQuaternion(A).multiplyScalar(mv.k);
          mv.out.push(...mv.tgtRest.clone().add(dl.applyQuaternion(parentW ? parentW.clone().invert() : new T.Quaternion())).toArray());
        }
      } else w = (parentW ? parentW.clone() : new T.Quaternion()).multiply(rest.local);
      world.set(b, w);
    }
    const d = rootSpaceP(source.root, srcRoles.root).sub(srcRootRestP).applyQuaternion(A).multiplyScalar(scale);
    // d está no espaço da raiz do modelo; a posição local do osso raiz é relativa ao pai dele.
    rootPos.push(...tgtRootRestP.clone().add(d.applyMatrix3(toParent)).toArray());
  }
  restore?.();
  const tracks = [...out].map(([b, v]) => new T.QuaternionKeyframeTrack(`${b.name}.quaternion`, sorted, v));
  tracks.push(new T.VectorKeyframeTrack(`${tgtRoot.name}.position`, sorted, rootPos));
  for (const [b, mv] of moving) tracks.push(new T.VectorKeyframeTrack(`${b.name}.position`, sorted, mv.out));
  const result = new T.AnimationClip(`${clip.name} · ${library.source.title} (CC0)`, clip.duration, tracks);
  result.userData = {library: library.source.id, sourceClip: clip.name, license: library.source.license, author: library.source.author, loop: clip.loop, alignment: A.toArray(), scale, restCorrected: [...correction.keys()].map(b => b.name),
    roles: Object.fromEntries([...roleOfTarget].map(([b, r]) => [r, b.name]))};
  return result;
}
